// settings/companySettings.js

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, doc, getDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getLocalSession } from "../auth/authManager.js";
import { SUPPORTED_CURRENCIES } from "./multicurrency.js";

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook",
    storageBucket: "vnvcloudbook.firebasestorage.app"
};

// SAFE INITIALIZATION: Prevent Duplicate App errors
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export async function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const session = getLocalSession();
    if (!session.companyId || session.companyId === 'null') {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #d9534f;">No company workspace found.</div>`;
        return;
    }

    // --- INITIAL RENDER: SKELETON ---
    container.innerHTML = `
        <style>
            .cs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .cs-header h1 { margin: 0; font-size: 24px; color: var(--primary-dark); }
            .cs-header p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
            
            .cs-section { background: #fff; border-radius: 6px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 25px 30px; margin-bottom: 25px; transition: box-shadow 0.3s; }
            .cs-section:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
            
            .cs-sec-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eaedf1; padding-bottom: 15px; margin-bottom: 20px; }
            .cs-sec-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--primary-dark); text-transform: uppercase; letter-spacing: 0.5px; }
            
            .cs-btn-edit { background: transparent; border: 1px solid var(--primary-dark); color: var(--primary-dark); padding: 6px 15px; border-radius: 4px; font-size: 13px; cursor: pointer; transition: all 0.2s; }
            .cs-btn-edit:hover { background: var(--primary-dark); color: #fff; }
            
            .cs-btn-save { background: var(--primary-dark); color: #fff; border: none; padding: 6px 15px; border-radius: 4px; font-size: 13px; cursor: pointer; display: none; }
            .cs-btn-save:hover { background: var(--primary-light); }
            .cs-btn-cancel { background: transparent; color: #666; border: none; padding: 6px 15px; font-size: 13px; cursor: pointer; display: none; }
            .cs-btn-cancel:hover { text-decoration: underline; color: #333; }
            
            .cs-row { display: flex; margin-bottom: 15px; align-items: center; }
            .cs-label { width: 180px; font-size: 14px; font-weight: 500; color: #555; }
            
            .cs-val-text { flex: 1; font-size: 14px; color: #000; font-weight: 500; }
            
            /* Line-Input Aesthetic for Edit Mode */
            .cs-input-line { flex: 1; border: none; border-bottom: 1px solid #000; padding: 6px 0; font-size: 14px; background: transparent; outline: none; display: none; transition: border-bottom-color 0.2s; }
            .cs-input-line:focus { border-bottom: 2px solid var(--primary-dark); }
            
            .cs-select { flex: 1; border: none; border-bottom: 1px solid #000; padding: 6px 0; font-size: 14px; background: transparent; outline: none; display: none; cursor: pointer; }
            .cs-select:focus { border-bottom: 2px solid var(--primary-dark); }
            
            .cs-warning { font-size: 12px; color: #d9534f; margin-left: 180px; margin-top: -10px; margin-bottom: 15px; display: none; }
        </style>

        <div class="cs-header">
            <div>
                <h1>Company Settings</h1>
                <p>Manage your workspace profile and financial preferences.</p>
            </div>
        </div>

        <div id="cs-loading" style="padding: 40px; text-align: center; color: #666;">Loading settings...</div>
        <div id="cs-content" style="display: none;">

            <div class="cs-section" id="sec-profile">
                <div class="cs-sec-header">
                    <h3>Company Profile</h3>
                    <div>
                        <button class="cs-btn-edit" id="btn-edit-profile">Edit</button>
                        <button class="cs-btn-cancel" id="btn-cancel-profile">Cancel</button>
                        <button class="cs-btn-save" id="btn-save-profile">Save</button>
                    </div>
                </div>
                
                <div class="cs-row">
                    <label class="cs-label">Company Name:</label>
                    <span class="cs-val-text" id="val-name"></span>
                    <input type="text" class="cs-input-line" id="inp-name">
                </div>
                <div class="cs-row">
                    <label class="cs-label">TIN / Tax ID:</label>
                    <span class="cs-val-text" id="val-tin"></span>
                    <input type="text" class="cs-input-line" id="inp-tin">
                </div>
                <div class="cs-row">
                    <label class="cs-label">Industry:</label>
                    <span class="cs-val-text" id="val-industry"></span>
                    <input type="text" class="cs-input-line" id="inp-industry">
                </div>
            </div>

            <div class="cs-section" id="sec-address">
                <div class="cs-sec-header">
                    <h3>Contact & Address</h3>
                    <div>
                        <button class="cs-btn-edit" id="btn-edit-address">Edit</button>
                        <button class="cs-btn-cancel" id="btn-cancel-address">Cancel</button>
                        <button class="cs-btn-save" id="btn-save-address">Save</button>
                    </div>
                </div>
                
                <div class="cs-row">
                    <label class="cs-label">Business Address:</label>
                    <span class="cs-val-text" id="val-address"></span>
                    <input type="text" class="cs-input-line" id="inp-address">
                </div>
            </div>

            <div class="cs-section" id="sec-financial">
                <div class="cs-sec-header">
                    <h3>Financial Settings</h3>
                    <div>
                        <button class="cs-btn-edit" id="btn-edit-financial">Edit</button>
                        <button class="cs-btn-cancel" id="btn-cancel-financial">Cancel</button>
                        <button class="cs-btn-save" id="btn-save-financial">Save</button>
                    </div>
                </div>
                
                <div class="cs-row">
                    <label class="cs-label">Currency Mode:</label>
                    <span class="cs-val-text" id="val-currencyMode"></span>
                    <select class="cs-select" id="inp-currencyMode">
                        <option value="single">Single Currency</option>
                        <option value="multi">Multi-Currency</option>
                    </select>
                </div>
                
                <div class="cs-row">
                    <label class="cs-label">Home Currency:</label>
                    <span class="cs-val-text" id="val-homeCurrency"></span>
                    <select class="cs-select" id="inp-homeCurrency"></select>
                </div>
                <div class="cs-warning" id="warn-financial">
                    <strong>Warning:</strong> Changing your Home Currency will affect how historical reports are calculated. Only change this if you have not posted transactions yet.
                </div>
            </div>

        </div>
    `;

    // --- DATA FETCHING & POPULATION ---
    let companyData = {};
    try {
        const docRef = doc(db, "companies", session.companyId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            companyData = docSnap.data();
            
            // Populate DOM Texts
            document.getElementById('val-name').textContent = companyData.name || '-';
            document.getElementById('val-tin').textContent = companyData.tin || '-';
            document.getElementById('val-industry').textContent = companyData.industry || '-';
            document.getElementById('val-address').textContent = companyData.address || '-';
            
            const modeText = companyData.currencyMode === 'multi' ? 'Multi-Currency' : 'Single Currency';
            document.getElementById('val-currencyMode').textContent = modeText;
            document.getElementById('val-homeCurrency').textContent = companyData.homeCurrency || 'PHP';

            // Populate Dropdowns
            const homeCurrSelect = document.getElementById('inp-homeCurrency');
            SUPPORTED_CURRENCIES.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.code;
                opt.textContent = `${c.code} - ${c.name}`;
                homeCurrSelect.appendChild(opt);
            });

            // Reveal Content
            document.getElementById('cs-loading').style.display = 'none';
            document.getElementById('cs-content').style.display = 'block';

        } else {
            document.getElementById('cs-loading').textContent = "Error: Company data not found.";
        }
    } catch (error) {
        console.error("Error fetching company details:", error);
        document.getElementById('cs-loading').textContent = "Error loading settings.";
    }

    // --- INLINE EDIT LOGIC HANDLER ---
    
    // Helper to toggle a specific section between View and Edit modes
    const toggleEditMode = (sectionId, isEditing) => {
        const section = document.getElementById(sectionId);
        
        // Buttons
        section.querySelector('.cs-btn-edit').style.display = isEditing ? 'none' : 'inline-block';
        section.querySelector('.cs-btn-save').style.display = isEditing ? 'inline-block' : 'none';
        section.querySelector('.cs-btn-cancel').style.display = isEditing ? 'inline-block' : 'none';

        // Toggle Fields
        const viewTexts = section.querySelectorAll('.cs-val-text');
        const inputFields = section.querySelectorAll('.cs-input-line, .cs-select');
        
        viewTexts.forEach(el => el.style.display = isEditing ? 'none' : 'block');
        inputFields.forEach(el => el.style.display = isEditing ? 'block' : 'none');

        // Specific Financial Warning
        if (sectionId === 'sec-financial') {
            document.getElementById('warn-financial').style.display = isEditing ? 'block' : 'none';
        }
    };

    // Helper to sync inputs with current db state before editing
    const populateInputs = () => {
        document.getElementById('inp-name').value = companyData.name || '';
        document.getElementById('inp-tin').value = companyData.tin || '';
        document.getElementById('inp-industry').value = companyData.industry || '';
        document.getElementById('inp-address').value = companyData.address || '';
        document.getElementById('inp-currencyMode').value = companyData.currencyMode || 'single';
        document.getElementById('inp-homeCurrency').value = companyData.homeCurrency || 'PHP';
    };

    // --- EVENT LISTENERS: PROFILE SECTION ---
    document.getElementById('btn-edit-profile').addEventListener('click', () => {
        populateInputs();
        toggleEditMode('sec-profile', true);
        document.getElementById('inp-name').focus();
    });
    document.getElementById('btn-cancel-profile').addEventListener('click', () => toggleEditMode('sec-profile', false));
    
    document.getElementById('btn-save-profile').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-profile');
        const newName = document.getElementById('inp-name').value.trim();
        
        if(!newName) return alert("Company Name is required.");
        
        btn.textContent = "Saving..."; btn.disabled = true;
        try {
            const updates = {
                name: newName,
                tin: document.getElementById('inp-tin').value.trim(),
                industry: document.getElementById('inp-industry').value.trim()
            };
            await updateDoc(doc(db, "companies", session.companyId), updates);
            
            // Update local state and UI
            companyData = { ...companyData, ...updates };
            document.getElementById('val-name').textContent = companyData.name;
            document.getElementById('val-tin').textContent = companyData.tin;
            document.getElementById('val-industry').textContent = companyData.industry;
            
            // Update header name via index.html logic
            document.querySelectorAll('.client-name-display').forEach(s => s.textContent = companyData.name);
            
            toggleEditMode('sec-profile', false);
        } catch (e) {
            console.error(e); alert("Failed to save profile.");
        } finally {
            btn.textContent = "Save"; btn.disabled = false;
        }
    });

    // --- EVENT LISTENERS: ADDRESS SECTION ---
    document.getElementById('btn-edit-address').addEventListener('click', () => {
        populateInputs();
        toggleEditMode('sec-address', true);
        document.getElementById('inp-address').focus();
    });
    document.getElementById('btn-cancel-address').addEventListener('click', () => toggleEditMode('sec-address', false));
    
    document.getElementById('btn-save-address').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-address');
        btn.textContent = "Saving..."; btn.disabled = true;
        try {
            const updates = { address: document.getElementById('inp-address').value.trim() };
            await updateDoc(doc(db, "companies", session.companyId), updates);
            
            companyData = { ...companyData, ...updates };
            document.getElementById('val-address').textContent = companyData.address || '-';
            
            toggleEditMode('sec-address', false);
        } catch (e) {
            console.error(e); alert("Failed to save address.");
        } finally {
            btn.textContent = "Save"; btn.disabled = false;
        }
    });

    // --- EVENT LISTENERS: FINANCIAL SECTION ---
    document.getElementById('btn-edit-financial').addEventListener('click', () => {
        populateInputs();
        toggleEditMode('sec-financial', true);
    });
    document.getElementById('btn-cancel-financial').addEventListener('click', () => toggleEditMode('sec-financial', false));
    
    document.getElementById('btn-save-financial').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-financial');
        const newMode = document.getElementById('inp-currencyMode').value;
        const newHome = document.getElementById('inp-homeCurrency').value;

        // Common Practice Check: Did they change the currency?
        const currencyChanged = (newHome !== companyData.homeCurrency) || (newMode !== companyData.currencyMode);

        if (currencyChanged) {
            const confirmed = confirm("Are you sure you want to change your financial setup? If you have existing transactions, their home-currency values will remain locked to the old currency setting.");
            if (!confirmed) return;
        }

        btn.textContent = "Saving..."; btn.disabled = true;
        try {
            const updates = { currencyMode: newMode, homeCurrency: newHome };
            await updateDoc(doc(db, "companies", session.companyId), updates);
            
            if (currencyChanged) {
                // Must update local storage so multicurrency.js sees it immediately
                localStorage.setItem('vnv_homeCurrency', newHome);
                localStorage.setItem('vnv_currencyMode', newMode);
                
                alert("Financial settings updated. The application will now reload to apply the new currency configurations globally.");
                window.location.reload();
            } else {
                toggleEditMode('sec-financial', false);
            }
        } catch (e) {
            console.error(e); alert("Failed to save financial settings.");
            btn.textContent = "Save"; btn.disabled = false;
        }
    });
}
