// admin/setupCompany.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    doc, 
    updateDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook",
    storageBucket: "vnvcloudbook.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Secondary app instance specifically for creating subordinate users without logging the admin out
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

/**
 * Renders the Company Setup modal. Forces the user to create a company before proceeding.
 * @param {string} containerId - The ID of the container where it could attach (defaults to body overlay)
 */
export function init(containerId) {
    let existing = document.getElementById('setupCompanyOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'setupCompanyOverlay';
    
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background-color: rgba(244, 247, 249, 0.95);
        z-index: 2000; display: flex; justify-content: center;
        align-items: center; overflow-y: auto; padding: 20px;
    `;

    overlay.innerHTML = `
        <style>
            .sc-modal { background: #ffffff; width: 500px; max-width: 100%; border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 40px; font-family: 'Segoe UI', Arial, sans-serif; color: #333; }
            .sc-header { text-align: center; margin-bottom: 30px; }
            .sc-header h2 { margin: 0; font-size: 22px; color: var(--primary-dark, #0A4275); letter-spacing: 0.5px; }
            .sc-header p { margin: 8px 0 0 0; font-size: 14px; color: #666; }
            
            .sc-row { margin-bottom: 20px; }
            .sc-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #555; text-transform: uppercase; }
            .sc-input { width: 100%; border: 1px solid #ccc; padding: 10px 12px; font-size: 14px; border-radius: 4px; outline: none; transition: border-color 0.2s; }
            .sc-input:focus { border-color: var(--primary-dark, #0A4275); }
            
            .sc-footer { margin-top: 30px; text-align: center; }
            .sc-btn-submit { background: var(--primary-dark, #0A4275); color: #fff; border: none; padding: 12px 24px; font-size: 15px; font-weight: 600; border-radius: 4px; cursor: pointer; width: 100%; transition: background 0.2s; }
            .sc-btn-submit:hover { background: var(--primary-light, #1584A4); }
            .sc-btn-submit:disabled { background: #ccc; cursor: not-allowed; }
        </style>

        <div class="sc-modal">
            <div class="sc-header">
                <h2>Setup Your Company</h2>
                <p>Let's configure your ledger workspace.</p>
            </div>

            <div class="sc-row">
                <label class="sc-label">Company Name *</label>
                <input type="text" class="sc-input" id="sc-companyName" required>
            </div>
            
            <div class="sc-row">
                <label class="sc-label">TIN / Tax ID</label>
                <input type="text" class="sc-input" id="sc-tin">
            </div>

            <div class="sc-row">
                <label class="sc-label">Industry</label>
                <input type="text" class="sc-input" id="sc-industry">
            </div>

            <div class="sc-row">
                <label class="sc-label">Business Address</label>
                <input type="text" class="sc-input" id="sc-address">
            </div>

            <div class="sc-footer">
                <button class="sc-btn-submit" id="sc-btnSave">Create Company Workspace</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const btnSave = overlay.querySelector('#sc-btnSave');
    const elName = overlay.querySelector('#sc-companyName');
    
    btnSave.addEventListener('click', async () => {
        const companyName = elName.value.trim();
        if (!companyName) {
            elName.style.borderColor = 'red';
            return;
        }

        btnSave.disabled = true;
        btnSave.textContent = "Setting up...";

        const companyData = {
            name: companyName,
            tin: overlay.querySelector('#sc-tin').value.trim(),
            industry: overlay.querySelector('#sc-industry').value.trim(),
            address: overlay.querySelector('#sc-address').value.trim(),
            version: 'Pro', // <--- ADDED THIS: Defaults new companies to Pro (full access)
            createdAt: new Date().toISOString(),
            createdBy: localStorage.getItem('vnv_uid')
        };

        try {
            // 1. Create the company document
            const docRef = await addDoc(collection(db, "companies"), companyData);
            const newCompanyId = docRef.id;

            // 2. Update the user's document to link them to the new company
            const uid = localStorage.getItem('vnv_uid');
            const userRef = doc(db, "users", uid);
            await updateDoc(userRef, { companyId: newCompanyId });

            // 3. Update local session state
            localStorage.setItem('vnv_companyId', newCompanyId);

            // 4. Remove overlay and route to dashboard
            overlay.remove();
            console.log("Company created successfully. ID:", newCompanyId);
            
            // Trigger global router
            if (window.handleMenuClick) {
                window.handleMenuClick('dashboard', null, null);
            } else {
                window.location.reload();
            }

        } catch (error) {
            console.error("Error creating company:", error);
            alert("Failed to create company. Please check your connection.");
            btnSave.disabled = false;
            btnSave.textContent = "Create Company Workspace";
        }
    });
}

/**
 * Creates a subordinate user account. ONLY accessible by superAdmin.
 * Uses a secondary Auth app to prevent logging out the current admin.
 */
export async function addNewUser(email, role, temporaryPassword = "Password123!") {
    const currentRole = localStorage.getItem('vnv_role');
    const currentCompanyId = localStorage.getItem('vnv_companyId');

    // 1. Strict Security Check
    if (currentRole !== 'superAdmin') {
        throw new Error("Unauthorized: Only a superAdmin can create subordinate accounts.");
    }
    if (!currentCompanyId || currentCompanyId === 'null') {
        throw new Error("Cannot create users before setting up a company.");
    }

    try {
        // 2. Create user on secondary Auth instance so admin stays logged in
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, temporaryPassword);
        const newUser = userCredential.user;

        // 3. Sign out the secondary instance immediately
        await secondaryAuth.signOut();

        // 4. Create the Firestore record for the new user, tagging them with the Admin's Company ID
        const userData = {
            uid: newUser.uid,
            email: newUser.email,
            role: role,
            companyId: currentCompanyId,
            createdAt: new Date().toISOString(),
            createdBy: localStorage.getItem('vnv_uid')
        };

        await setDoc(doc(db, "users", newUser.uid), userData);

        console.log(`Subordinate user ${email} created successfully with role ${role}.`);
        return { success: true, uid: newUser.uid };

    } catch (error) {
        console.error("Error creating subordinate user:", error);
        throw error;
    }
}
