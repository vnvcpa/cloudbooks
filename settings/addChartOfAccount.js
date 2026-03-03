// settings/addChartOfAccount.js

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getLocalSession } from "../auth/authManager.js";

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook",
    storageBucket: "vnvcloudbook.firebasestorage.app"
};

// SAFE INITIALIZATION: Check if Firebase is already running before initializing
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

/**
 * Initializes the Add/Edit Chart of Accounts Modal
 * @param {string} containerId - The ID of the container
 * @param {string|null} accountId - If provided, opens in Edit Mode.
 */
export function init(containerId, accountId = null) {
    let existing = document.getElementById('addCoaOverlay');
    if (existing) existing.remove();

    const isEditMode = !!accountId;
    const session = getLocalSession();

    if (!session.companyId || session.companyId === 'null') {
        alert("No company workspace found. Please set up a company first.");
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'addCoaOverlay';
    
    overlay.style.cssText = `
        position: fixed; top: var(--header-height); left: 0; right: 0; bottom: 0;
        background-color: rgba(0, 0, 0, 0.4); z-index: 990; display: flex;
        justify-content: center; align-items: flex-start; padding-top: 30px;
        overflow-y: auto; transition: opacity 0.2s ease;
    `;

    overlay.innerHTML = `
        <style>
            .coa-modal { background: #ffffff; width: 600px; max-width: 95%; border-radius: 4px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); padding: 30px 40px; margin-bottom: 40px; font-family: 'Segoe UI', Arial, sans-serif; color: #000; transition: opacity 0.3s ease; }
            .coa-modal.coa-inactive-ui { opacity: 0.65; }
            .coa-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
            .coa-header-row h2 { margin: 0; font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
            .coa-close-x { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; line-height: 1; padding: 0; }
            .coa-close-x:hover { color: #000; }
            
            .coa-row { display: flex; margin-bottom: 15px; align-items: center; }
            .coa-label { width: 140px; font-size: 14px; font-weight: 500; color: #333; }
            
            .coa-input-line { flex: 1; border: none; border-bottom: 1px solid #000; padding: 6px 0; font-size: 14px; background: transparent; outline: none; transition: border-bottom-color 0.2s; }
            .coa-input-line:focus { border-bottom: 2px solid var(--primary-dark); }
            .coa-select { flex: 1; border: none; border-bottom: 1px solid #000; padding: 6px 0; font-size: 14px; background: transparent; outline: none; cursor: pointer; }
            .coa-select:focus { border-bottom: 2px solid var(--primary-dark); }
            .coa-error { border-bottom: 2px solid #d9534f !important; background-color: #fff0f0; }
            
            .coa-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 30px; border-top: 1px solid #eaedf1; padding-top: 20px; }
            .coa-btn-text { background: transparent; border: none; color: #333; cursor: pointer; font-size: 14px; }
            .coa-btn-text:hover { text-decoration: underline; }
            .coa-btn-text.danger { color: #d9534f; }
            .coa-btn-text.success { color: #5cb85c; }
            
            .coa-split-btn-group { display: flex; position: relative; }
            .coa-split-btn-main { background: var(--primary-dark); color: #fff; border: none; font-size: 14px; cursor: pointer; padding: 8px 15px; border-radius: 4px 0 0 4px; }
            .coa-split-btn-arrow { background: var(--primary-dark); color: #fff; border: none; border-left: 1px solid rgba(255,255,255,0.3); font-size: 10px; cursor: pointer; padding: 8px 10px; border-radius: 0 4px 4px 0; }
            .coa-split-btn-main:hover, .coa-split-btn-arrow:hover { background: var(--primary-light); }
            
            .coa-dropdown-menu { display: none; position: absolute; bottom: 100%; right: 0; background: #fff; margin-bottom: 5px; border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 150px; z-index: 1000; border-radius: 4px; }
            .coa-dropdown-item { padding: 10px 15px; font-size: 13px; cursor: pointer; }
            .coa-dropdown-item:hover { background: #f4f7f9; color: var(--primary-dark); }
            
            .coa-badge { font-size: 11px; padding: 3px 8px; border-radius: 12px; background: #eee; margin-left: 10px; vertical-align: middle; }
            .coa-badge.inactive { background: #d9534f; color: #fff; }

            .coa-import-btn { background: #f4f7f9; border: 1px solid #ccc; color: #333; padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer; transition: all 0.2s; text-decoration: none; display: inline-block; }
            .coa-import-btn:hover { border-color: var(--primary-dark); color: var(--primary-dark); }
        </style>

        <div class="coa-modal" id="coa-modalContent">
            <div class="coa-header-row">
                <h2>
                    <span id="coa-headerTitle">ACCOUNT:</span>
                    <span id="coa-statusBadge" class="coa-badge" style="display:none;">INACTIVE</span>
                </h2>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <a href="./settings/coa_template.csv" download="coa_template.csv" class="coa-import-btn">Download Template</a>
                    <input type="file" id="coa-csvUpload" accept=".csv" style="display: none;">
                    <button class="coa-import-btn" id="coa-btnImportCsv" title="Import filled CSV template">Import CSV</button>
                    <button class="coa-close-x" id="coa-btnCloseX" title="Close (Esc)" style="margin-left: 5px;">&times;</button>
                </div>
            </div>

            <div class="coa-row">
                <label class="coa-label">Account Code:*</label>
                <input type="text" class="coa-input-line" id="coa-code" required placeholder="e.g. 1010">
            </div>
            
            <div class="coa-row">
                <label class="coa-label">Account Name:*</label>
                <input type="text" class="coa-input-line" id="coa-name" required placeholder="e.g. Checking Account">
            </div>

            <div class="coa-row">
                <label class="coa-label">Account Type:*</label>
                <select class="coa-select" id="coa-type" required>
                    <option value="">Select Type</option>
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Equity">Equity</option>
                    <option value="Revenue">Revenue</option>
                    <option value="Expense">Expense</option>
                </select>
            </div>

            <div class="coa-row">
                <label class="coa-label">Balance Type:*</label>
                <select class="coa-select" id="coa-balanceType" required>
                    <option value="Debit">Debit</option>
                    <option value="Credit">Credit</option>
                </select>
            </div>

            <div class="coa-row">
                <label class="coa-label">Sub-account of:</label>
                <select class="coa-select" id="coa-subAccount">
                    <option value="">None (Parent Account)</option>
                    </select>
            </div>

            <div class="coa-row">
                <label class="coa-label">Description:</label>
                <input type="text" class="coa-input-line" id="coa-description" placeholder="Optional details">
            </div>

            <div class="coa-footer">
                <div style="display: flex; gap: 15px;">
                    <button class="coa-btn-text" id="coa-btnCancel">Cancel</button>
                    <button class="coa-btn-text danger" id="coa-btnToggleActive" style="display: none;">Make Inactive</button>
                </div>
                <div class="coa-split-btn-group">
                    <button class="coa-split-btn-main" id="coa-btnSaveAction" title="Ctrl + Enter">Save & Close</button>
                    <button class="coa-split-btn-arrow" id="coa-btnToggleDropdown">▼</button>
                    <div class="coa-dropdown-menu" id="coa-dropdownMenu">
                        <div class="coa-dropdown-item" data-action="saveNew">Save & New</div>
                        <div class="coa-dropdown-item" data-action="saveClose">Save & Close</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // DOM Elements
    const modalContent = overlay.querySelector('#coa-modalContent');
    const headerTitle = overlay.querySelector('#coa-headerTitle');
    const statusBadge = overlay.querySelector('#coa-statusBadge');
    
    const elCode = overlay.querySelector('#coa-code');
    const elName = overlay.querySelector('#coa-name');
    const elType = overlay.querySelector('#coa-type');
    const elBalanceType = overlay.querySelector('#coa-balanceType');
    const elSubAccount = overlay.querySelector('#coa-subAccount');
    const elDesc = overlay.querySelector('#coa-description');
    
    const requiredInputs = [elCode, elName, elType, elBalanceType];

    const btnCloseX = overlay.querySelector('#coa-btnCloseX');
    const btnCancel = overlay.querySelector('#coa-btnCancel');
    const btnSaveAction = overlay.querySelector('#coa-btnSaveAction');
    const btnToggleDropdown = overlay.querySelector('#coa-btnToggleDropdown');
    const dropdownMenu = overlay.querySelector('#coa-dropdownMenu');
    const btnToggleActive = overlay.querySelector('#coa-btnToggleActive');
    
    const btnImportCsv = overlay.querySelector('#coa-btnImportCsv');
    const fileInputCsv = overlay.querySelector('#coa-csvUpload');

    // State Variables
    let currentSaveMode = localStorage.getItem('vnv_coaSavePref') || 'saveClose';
    btnSaveAction.textContent = currentSaveMode === 'saveNew' ? 'Save & New' : 'Save & Close';
    let accountIsActive = true; 

    // --- LOGIC: Auto-set Balance Type based on Account Type ---
    elType.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'Asset' || val === 'Expense') elBalanceType.value = 'Debit';
        else if (val === 'Liability' || val === 'Equity' || val === 'Revenue') elBalanceType.value = 'Credit';
    });

    // --- LOGIC: Fetch Parent Accounts for Dropdown ---
    const loadParentAccounts = async () => {
        try {
            const q = query(collection(db, "chartOfAccounts"), where("companyId", "==", session.companyId));
            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (docSnap.id !== accountId) {
                    const opt = document.createElement('option');
                    opt.value = docSnap.id;
                    opt.textContent = `${data.code} - ${data.name}`;
                    elSubAccount.appendChild(opt);
                }
            });
        } catch(e) { console.error("Failed to load parent accounts", e); }
    };
    loadParentAccounts();

    // --- LOGIC: CSV Import Engine ---
    btnImportCsv.addEventListener('click', () => fileInputCsv.click());
    
    fileInputCsv.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            if(lines.length < 2) return alert("CSV is empty or missing headers.");

            btnImportCsv.textContent = "Importing...";
            btnImportCsv.disabled = true;

            let successCount = 0;
            
            // Start from 1 to skip header row
            for(let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim());
                if(cols.length >= 3) {
                    const type = cols[2];
                    
                    // Assign from CSV, fallback to standard accounting rules if missing
                    const balanceType = cols[3] || ((type === 'Asset' || type === 'Expense') ? 'Debit' : 'Credit');
                    
                    const accData = {
                        code: cols[0],
                        name: cols[1],
                        type: type,
                        balanceType: balanceType,
                        subAccountOf: cols[4] || '',
                        description: cols[5] || '',
                        companyId: session.companyId,
                        createdBy: session.uid,
                        isActive: true,
                        createdAt: new Date().toISOString()
                    };
                    try {
                        await addDoc(collection(db, "chartOfAccounts"), accData);
                        successCount++;
                    } catch(err) { console.error("Row import failed", err); }
                }
            }
            alert(`Successfully imported ${successCount} accounts!`);
            cleanupAndClose();
            if(window.refreshChartOfAccountsTable) window.refreshChartOfAccountsTable();
        };
        reader.readAsText(file);
    });

    // --- LOGIC: Validation & Cleanup ---
    requiredInputs.forEach(input => input.addEventListener('input', (e) => e.target.classList.remove('coa-error')));

    const cleanupAndClose = () => {
        document.removeEventListener('keydown', handleGlobalKeydown);
        overlay.remove();
        if(window.refreshChartOfAccountsTable) window.refreshChartOfAccountsTable();
    };

    const handleGlobalKeydown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cleanupAndClose(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
    };
    document.addEventListener('keydown', handleGlobalKeydown);

    const updateUIState = (isActive) => {
        accountIsActive = isActive;
        if (isActive) {
            modalContent.classList.remove('coa-inactive-ui');
            statusBadge.style.display = 'none';
            if (isEditMode) { btnToggleActive.textContent = 'Make Inactive'; btnToggleActive.className = 'coa-btn-text danger'; }
        } else {
            modalContent.classList.add('coa-inactive-ui');
            statusBadge.style.display = 'inline-block';
            if (isEditMode) { btnToggleActive.textContent = 'Set Active'; btnToggleActive.className = 'coa-btn-text success'; }
        }
    };

    // --- LOGIC: Fetch Data for Edit Mode ---
    if (isEditMode) {
        headerTitle.textContent = "LOADING...";
        btnToggleActive.style.display = 'inline-block';

        (async () => {
            try {
                const docRef = doc(db, "chartOfAccounts", accountId);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if(data.companyId !== session.companyId) {
                        headerTitle.textContent = "UNAUTHORIZED ACCESS";
                        return;
                    }

                    headerTitle.textContent = `EDIT ACCOUNT: ${data.code} - ${data.name}`;
                    
                    elCode.value = data.code || '';
                    elName.value = data.name || '';
                    elType.value = data.type || '';
                    elBalanceType.value = data.balanceType || '';
                    elDesc.value = data.description || '';
                    
                    setTimeout(() => elSubAccount.value = data.subAccountOf || '', 300);
                    updateUIState(data.isActive !== false); 
                } else {
                    headerTitle.textContent = "ACCOUNT NOT FOUND";
                }
            } catch (error) {
                console.error("Error fetching account:", error);
                headerTitle.textContent = "ERROR LOADING DATA";
            }
        })();
    }

    // --- LOGIC: Save to Firebase ---
    const handleSave = async () => {
        let isValid = true;
        requiredInputs.forEach(input => {
            if (!input.value.trim()) { input.classList.add('coa-error'); isValid = false; }
        });
        if (!isValid) return;

        btnSaveAction.textContent = "Saving...";
        btnSaveAction.disabled = true;

        const accountData = {
            code: elCode.value.trim(),
            name: elName.value.trim(),
            type: elType.value,
            balanceType: elBalanceType.value,
            subAccountOf: elSubAccount.value,
            description: elDesc.value.trim(),
            companyId: session.companyId,
            isActive: accountIsActive,
            updatedAt: new Date().toISOString()
        };

        try {
            if (isEditMode) {
                await updateDoc(doc(db, "chartOfAccounts", accountId), accountData);
            } else {
                accountData.createdBy = session.uid;
                accountData.createdAt = new Date().toISOString();
                await addDoc(collection(db, "chartOfAccounts"), accountData);
            }

            if (currentSaveMode === 'saveClose') {
                cleanupAndClose();
            } else if (currentSaveMode === 'saveNew') {
                elCode.value = ''; elName.value = ''; elDesc.value = '';
                elCode.classList.remove('coa-error'); elName.classList.remove('coa-error');
                updateUIState(true);
                elCode.focus();
                if (isEditMode) { cleanupAndClose(); init(containerId, null); }
            }
        } catch (error) {
            console.error("Error saving account:", error);
            alert("Failed to save account.");
        } finally {
            btnSaveAction.textContent = currentSaveMode === 'saveNew' ? 'Save & New' : 'Save & Close';
            btnSaveAction.disabled = false;
        }
    };

    // --- EVENT LISTENERS ---
    btnCloseX.addEventListener('click', cleanupAndClose);
    btnCancel.addEventListener('click', cleanupAndClose);
    overlay.querySelector('.coa-modal').addEventListener('click', (e) => e.stopPropagation());

    btnToggleDropdown.addEventListener('click', () => {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    overlay.querySelectorAll('.coa-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            currentSaveMode = e.target.getAttribute('data-action');
            btnSaveAction.textContent = e.target.textContent;
            localStorage.setItem('vnv_coaSavePref', currentSaveMode);
            dropdownMenu.style.display = 'none';
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.coa-split-btn-group')) dropdownMenu.style.display = 'none';
    });

    btnSaveAction.addEventListener('click', handleSave);

    btnToggleActive.addEventListener('click', async () => {
        updateUIState(!accountIsActive);
        if (isEditMode) {
            try { await updateDoc(doc(db, "chartOfAccounts", accountId), { isActive: accountIsActive }); }
            catch(e) { updateUIState(!accountIsActive); }
        }
    });

    setTimeout(() => elCode.focus(), 100);
}
