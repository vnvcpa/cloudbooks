// sales/addCustomer.js

// 1. Firebase Initialization (v9 Modular SDK)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Initializes the Add/Edit Customer Modal
 * @param {string} containerId - The ID of the container (not strictly used for modals, but kept for signature consistency)
 * @param {string|null} customerId - If provided, opens in Edit Mode.
 */
export function init(containerId, customerId = null) {
    // Remove existing overlay if it already exists to prevent duplicates
    let existing = document.getElementById('addCustomerOverlay');
    if (existing) existing.remove();

    const isEditMode = !!customerId;
    
    // Create the overlay container
    const overlay = document.createElement('div');
    overlay.id = 'addCustomerOverlay';
    
    overlay.style.cssText = `
        position: fixed;
        top: var(--header-height); 
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.4);
        z-index: 990;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 30px;
        overflow-y: auto;
        transition: opacity 0.2s ease;
    `;

    // Inject CSS and HTML for the layout
    overlay.innerHTML = `
        <style>
            .ac-modal {
                background: #ffffff;
                width: 600px;
                max-width: 95%;
                border-radius: 4px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.2);
                padding: 30px 40px;
                margin-bottom: 40px;
                font-family: 'Segoe UI', Arial, sans-serif;
                color: #000;
                transition: opacity 0.3s ease;
            }
            .ac-modal.ac-inactive-ui {
                opacity: 0.65;
            }
            .ac-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
            .ac-header-row h2 { margin: 0; font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
            .ac-close-x { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; line-height: 1; padding: 0; }
            .ac-close-x:hover { color: #000; }
            
            .ac-row { display: flex; margin-bottom: 12px; align-items: baseline; }
            .ac-label { width: 140px; font-size: 14px; }
            .ac-label-indent { width: 120px; padding-left: 20px; font-size: 14px; }
            
            .ac-input-line {
                flex: 1;
                border: none;
                border-bottom: 1px solid #000;
                padding: 4px 0;
                font-size: 14px;
                background: transparent;
                outline: none;
                transition: border-bottom-color 0.2s;
            }
            .ac-input-line:focus { border-bottom: 2px solid var(--primary-dark); }
            .ac-error { border-bottom: 2px solid #d9534f !important; background-color: #fff0f0; }
            
            .ac-input-half { max-width: 200px; }
            .ac-subtext { font-size: 12px; color: #333; text-align: center; margin-top: 4px; }
            
            .ac-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 30px; border-top: 1px solid #eaedf1; padding-top: 20px; }
            .ac-footer-left { display: flex; gap: 15px; }
            .ac-footer-right { display: flex; gap: 15px; align-items: center; }
            
            .ac-btn-text { background: transparent; border: none; color: #333; cursor: pointer; font-size: 14px; }
            .ac-btn-text:hover { text-decoration: underline; }
            .ac-btn-text.danger { color: #d9534f; }
            .ac-btn-text.success { color: #5cb85c; }
            
            /* Split Button Styling */
            .ac-split-btn-group { display: flex; position: relative; }
            .ac-split-btn-main { background: var(--primary-dark); color: #fff; border: none; font-size: 14px; cursor: pointer; padding: 8px 15px; border-radius: 4px 0 0 4px; }
            .ac-split-btn-arrow { background: var(--primary-dark); color: #fff; border: none; border-left: 1px solid rgba(255,255,255,0.3); font-size: 10px; cursor: pointer; padding: 8px 10px; border-radius: 0 4px 4px 0; }
            .ac-split-btn-main:hover, .ac-split-btn-arrow:hover { background: var(--primary-light); }
            
            .ac-dropdown-menu { 
                display: none; position: absolute; bottom: 100%; right: 0; background: #fff; margin-bottom: 5px;
                border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 150px; z-index: 1000; border-radius: 4px;
            }
            .ac-dropdown-item { padding: 10px 15px; font-size: 13px; cursor: pointer; }
            .ac-dropdown-item:hover { background: #f4f7f9; color: var(--primary-dark); }
            
            .ac-badge { font-size: 11px; padding: 3px 8px; border-radius: 12px; background: #eee; margin-left: 10px; vertical-align: middle; }
            .ac-badge.inactive { background: #d9534f; color: #fff; }
        </style>

        <div class="ac-modal" id="ac-modalContent">
            <div class="ac-header-row">
                <h2>
                    <span id="ac-headerTitle">CUSTOMER:</span>
                    <span id="ac-statusBadge" class="ac-badge" style="display:none;">INACTIVE</span>
                </h2>
                <div>
                    <button class="ac-btn-text" id="ac-btnViewLedger" style="display: none; margin-right: 15px; font-weight: 500; color: var(--primary-light);">View Ledger</button>
                    <button class="ac-close-x" id="ac-btnCloseX" title="Close (Esc)">&times;</button>
                </div>
            </div>

            <div class="ac-row" style="align-items: flex-start;">
                <label class="ac-label" style="padding-top: 4px;">Customer Name:*</label>
                <div style="display: flex; gap: 15px; flex: 1;">
                    <div style="flex: 2;">
                        <input type="text" class="ac-input-line" id="ac-lastName" style="width: 100%;" required>
                        <div class="ac-subtext">[Last Name]</div>
                    </div>
                    <div style="flex: 1; max-width: 60px;">
                        <input type="text" class="ac-input-line" id="ac-mi" style="width: 100%;">
                        <div class="ac-subtext">[MI]</div>
                    </div>
                    <div style="flex: 2;">
                        <input type="text" class="ac-input-line" id="ac-firstName" style="width: 100%;" required>
                        <div class="ac-subtext">[First Name]</div>
                    </div>
                </div>
            </div>

            <div class="ac-row"><label class="ac-label">Full Name:</label><input type="text" class="ac-input-line" id="ac-fullName" readonly style="color: #666;"></div>
            <div class="ac-row"><label class="ac-label">Company Name:</label><input type="text" class="ac-input-line" id="ac-companyName"></div>
            <div class="ac-row"><label class="ac-label">Address</label></div>
            
            <div class="ac-row"><label class="ac-label-indent">Street:</label><input type="text" class="ac-input-line" id="ac-street"></div>
            <div class="ac-row"><label class="ac-label-indent">Barangay:</label><input type="text" class="ac-input-line" id="ac-barangay"></div>
            <div class="ac-row"><label class="ac-label-indent">Town/City:</label><input type="text" class="ac-input-line" id="ac-city"></div>
            <div class="ac-row"><label class="ac-label-indent">ZIP Code:</label><input type="text" class="ac-input-line ac-input-half" id="ac-zipCode"></div>
            <div class="ac-row"><label class="ac-label-indent">Province/State:</label><input type="text" class="ac-input-line ac-input-half" id="ac-province"></div>
            <div class="ac-row"><label class="ac-label-indent">Country:</label><input type="text" class="ac-input-line ac-input-half" id="ac-country"></div>
            
            <div class="ac-row"><label class="ac-label">Phone:</label><input type="text" class="ac-input-line ac-input-half" id="ac-phone"></div>
            <div class="ac-row"><label class="ac-label">Email:</label><input type="text" class="ac-input-line" id="ac-email"></div>

            <div class="ac-footer">
                <div class="ac-footer-left">
                    <button class="ac-btn-text" id="ac-btnCancel">Cancel</button>
                    <button class="ac-btn-text danger" id="ac-btnToggleActive" style="display: none;">Make Inactive</button>
                </div>
                <div class="ac-footer-right">
                    <div class="ac-split-btn-group">
                        <button class="ac-split-btn-main" id="ac-btnSaveAction" title="Ctrl + Enter">Save & Close</button>
                        <button class="ac-split-btn-arrow" id="ac-btnToggleDropdown">▼</button>
                        <div class="ac-dropdown-menu" id="ac-dropdownMenu">
                            <div class="ac-dropdown-item" data-action="saveNew">Save & New</div>
                            <div class="ac-dropdown-item" data-action="saveClose">Save & Close</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // DOM Elements
    const modalContent = overlay.querySelector('#ac-modalContent');
    const headerTitle = overlay.querySelector('#ac-headerTitle');
    const statusBadge = overlay.querySelector('#ac-statusBadge');
    
    const elFirstName = overlay.querySelector('#ac-firstName');
    const elMi = overlay.querySelector('#ac-mi');
    const elLastName = overlay.querySelector('#ac-lastName');
    const elFullName = overlay.querySelector('#ac-fullName');
    const nameInputs = [elFirstName, elMi, elLastName];

    const btnCloseX = overlay.querySelector('#ac-btnCloseX');
    const btnCancel = overlay.querySelector('#ac-btnCancel');
    const btnSaveAction = overlay.querySelector('#ac-btnSaveAction');
    const btnToggleDropdown = overlay.querySelector('#ac-btnToggleDropdown');
    const dropdownMenu = overlay.querySelector('#ac-dropdownMenu');
    const btnToggleActive = overlay.querySelector('#ac-btnToggleActive');
    const btnViewLedger = overlay.querySelector('#ac-btnViewLedger');

    // State Variables
    let currentSaveMode = localStorage.getItem('vnv_customerSavePreference') || 'saveClose';
    btnSaveAction.textContent = currentSaveMode === 'saveNew' ? 'Save & New' : 'Save & Close';
    let customerIsActive = true; 

    // --- LOGIC: Auto-Concatenation ---
    const updateFullName = () => {
        const first = elFirstName.value.trim();
        const mi = elMi.value.trim();
        const last = elLastName.value.trim();
        
        let full = last;
        if (first) full += (full ? ', ' : '') + first;
        if (mi) full += ' ' + mi;
        
        elFullName.value = full;
    };
    nameInputs.forEach(input => input.addEventListener('input', updateFullName));

    // --- LOGIC: Clear Validation Errors ---
    nameInputs.forEach(input => input.addEventListener('input', (e) => {
        e.target.classList.remove('ac-error');
    }));

    // --- LOGIC: Cleanup & Close ---
    const cleanupAndClose = () => {
        document.removeEventListener('keydown', handleGlobalKeydown);
        overlay.remove();
    };

    // --- LOGIC: Keyboard Shortcuts ---
    const handleGlobalKeydown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cleanupAndClose();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        }
    };
    document.addEventListener('keydown', handleGlobalKeydown);

    // --- LOGIC: UI State Updater ---
    const updateUIState = (isActive) => {
        customerIsActive = isActive;
        if (isActive) {
            modalContent.classList.remove('ac-inactive-ui');
            statusBadge.style.display = 'none';
            if (isEditMode) {
                btnToggleActive.textContent = 'Make Inactive';
                btnToggleActive.className = 'ac-btn-text danger';
            }
        } else {
            modalContent.classList.add('ac-inactive-ui');
            statusBadge.style.display = 'inline-block';
            if (isEditMode) {
                btnToggleActive.textContent = 'Set Active';
                btnToggleActive.className = 'ac-btn-text success';
            }
        }
    };

    // --- LOGIC: Fetch Data for Edit Mode ---
    if (isEditMode) {
        headerTitle.textContent = "LOADING...";
        btnToggleActive.style.display = 'inline-block';
        btnViewLedger.style.display = 'inline-block';

        (async () => {
            try {
                const docRef = doc(db, "customers", customerId);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    headerTitle.textContent = `EDIT CUSTOMER: ${data.fullName || data.lastName}`;
                    
                    elLastName.value = data.lastName || '';
                    elMi.value = data.mi || '';
                    elFirstName.value = data.firstName || '';
                    elFullName.value = data.fullName || '';
                    overlay.querySelector('#ac-companyName').value = data.companyName || '';
                    
                    if (data.address) {
                        overlay.querySelector('#ac-street').value = data.address.street || '';
                        overlay.querySelector('#ac-barangay').value = data.address.barangay || '';
                        overlay.querySelector('#ac-city').value = data.address.city || '';
                        overlay.querySelector('#ac-zipCode').value = data.address.zipCode || '';
                        overlay.querySelector('#ac-province').value = data.address.province || '';
                        overlay.querySelector('#ac-country').value = data.address.country || '';
                    }
                    if (data.contact) {
                        overlay.querySelector('#ac-phone').value = data.contact.phone || '';
                        overlay.querySelector('#ac-email').value = data.contact.email || '';
                    }
                    
                    updateUIState(data.isActive !== false); // Default true if undefined
                } else {
                    headerTitle.textContent = "CUSTOMER NOT FOUND";
                }
            } catch (error) {
                console.error("Error fetching customer:", error);
                headerTitle.textContent = "ERROR LOADING DATA";
            }
        })();
    }

    // --- LOGIC: Save to Firebase ---
    const handleSave = async () => {
        // Validation
        let isValid = true;
        if (!elFirstName.value.trim()) { elFirstName.classList.add('ac-error'); isValid = false; }
        if (!elLastName.value.trim()) { elLastName.classList.add('ac-error'); isValid = false; }
        
        if (!isValid) {
            // Optional: Shake animation or toast notification
            return;
        }

        btnSaveAction.textContent = "Saving...";
        btnSaveAction.disabled = true;

        const customerData = {
            lastName: elLastName.value.trim(),
            mi: elMi.value.trim(),
            firstName: elFirstName.value.trim(),
            fullName: elFullName.value.trim(),
            companyName: overlay.querySelector('#ac-companyName').value.trim(),
            address: {
                street: overlay.querySelector('#ac-street').value.trim(),
                barangay: overlay.querySelector('#ac-barangay').value.trim(),
                city: overlay.querySelector('#ac-city').value.trim(),
                zipCode: overlay.querySelector('#ac-zipCode').value.trim(),
                province: overlay.querySelector('#ac-province').value.trim(),
                country: overlay.querySelector('#ac-country').value.trim(),
            },
            contact: {
                phone: overlay.querySelector('#ac-phone').value.trim(),
                email: overlay.querySelector('#ac-email').value.trim(),
            },
            isActive: customerIsActive,
            updatedAt: new Date().toISOString()
        };

        try {
            if (isEditMode) {
                await updateDoc(doc(db, "customers", customerId), customerData);
                console.log("Customer updated:", customerId);
            } else {
                customerData.createdAt = new Date().toISOString();
                const docRef = await addDoc(collection(db, "customers"), customerData);
                console.log("Customer created with ID:", docRef.id);
            }

            // Routing based on preference
            if (currentSaveMode === 'saveClose') {
                cleanupAndClose();
            } else if (currentSaveMode === 'saveNew') {
                // Reset form completely
                const inputs = overlay.querySelectorAll('input[type="text"]');
                inputs.forEach(input => {
                    input.value = '';
                    input.classList.remove('ac-error');
                });
                updateUIState(true);
                elLastName.focus();
                
                // If it was edit mode, switch it back to add mode
                if (isEditMode) {
                    cleanupAndClose();
                    init(containerId, null); // Re-init as new
                }
            }
        } catch (error) {
            console.error("Error saving customer:", error);
            alert("Failed to save customer. Check console for details.");
        } finally {
            btnSaveAction.textContent = currentSaveMode === 'saveNew' ? 'Save & New' : 'Save & Close';
            btnSaveAction.disabled = false;
        }
    };

    // --- EVENT LISTENERS ---
    btnCloseX.addEventListener('click', cleanupAndClose);
    btnCancel.addEventListener('click', cleanupAndClose);
    
    overlay.querySelector('.ac-modal').addEventListener('click', (e) => e.stopPropagation());

    btnToggleDropdown.addEventListener('click', () => {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    overlay.querySelectorAll('.ac-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            currentSaveMode = e.target.getAttribute('data-action');
            btnSaveAction.textContent = e.target.textContent;
            localStorage.setItem('vnv_customerSavePreference', currentSaveMode);
            dropdownMenu.style.display = 'none';
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ac-split-btn-group')) {
            dropdownMenu.style.display = 'none';
        }
    });

    btnSaveAction.addEventListener('click', handleSave);

    btnToggleActive.addEventListener('click', async () => {
        updateUIState(!customerIsActive);
        // Automatically save the toggled state if in edit mode
        if (isEditMode) {
            try {
                await updateDoc(doc(db, "customers", customerId), { isActive: customerIsActive });
            } catch(e) {
                console.error("Failed to update status", e);
                updateUIState(!customerIsActive); // revert on failure
            }
        }
    });

    btnViewLedger.addEventListener('click', () => {
        cleanupAndClose();
        // Route to the ledger using your global router, passing the ID
        if (window.handleMenuClick) {
            window.handleMenuClick('sales', 'customerLedger', { detail: { customerId } });
        }
    });

    // Auto-focus on load
    setTimeout(() => elLastName.focus(), 100);
}
