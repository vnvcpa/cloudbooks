// accounting/uploadBankTransactions.js

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getLocalSession } from "../auth/authManager.js";
import { populateCurrencyDropdown, getExchangeRate, calculateHomeAmount } from "../settings/multicurrency.js";
import { init as openAddCoaModal } from "../settings/addChartOfAccount.js";

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook",
    storageBucket: "vnvcloudbook.firebasestorage.app"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export function init(containerId, entityId = null) {
    let existing = document.getElementById('uploadBankOverlay');
    if (existing) existing.remove();

    const session = getLocalSession();
    if (!session.companyId || session.companyId === 'null') {
        alert("No company workspace found. Please set up a company first.");
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'uploadBankOverlay';
    
    overlay.style.cssText = `
        position: fixed; top: var(--header-height); left: 0; right: 0; bottom: 0;
        background-color: rgba(0, 0, 0, 0.4); z-index: 990; display: flex;
        justify-content: center; align-items: flex-start; padding-top: 30px;
        overflow-y: auto; transition: opacity 0.2s ease;
    `;

    overlay.innerHTML = `
        <style>
            .ub-modal { background: #ffffff; width: 600px; max-width: 95%; border-radius: 4px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); padding: 30px 40px; margin-bottom: 40px; font-family: 'Segoe UI', Arial, sans-serif; color: #000; }
            .ub-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
            .ub-header-row h2 { margin: 0; font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
            .ub-close-x { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; line-height: 1; padding: 0; }
            .ub-close-x:hover { color: #000; }
            
            .ub-row { display: flex; margin-bottom: 15px; align-items: center; }
            .ub-label { width: 140px; font-size: 14px; font-weight: 500; color: #333; }
            
            .ub-input-line { flex: 1; border: none; border-bottom: 1px solid #000; padding: 6px 0; font-size: 14px; background: transparent; outline: none; transition: border-bottom-color 0.2s; }
            .ub-input-line:focus { border-bottom: 2px solid var(--primary-dark); }
            .ub-select { flex: 1; border: none; border-bottom: 1px solid #000; padding: 6px 0; font-size: 14px; background: transparent; outline: none; cursor: pointer; }
            .ub-select:focus { border-bottom: 2px solid var(--primary-dark); }
            
            .ub-file-area { border: 2px dashed #ccc; padding: 30px; text-align: center; border-radius: 4px; margin-top: 10px; cursor: pointer; background: #fafafa; transition: background 0.2s; }
            .ub-file-area:hover { background: #f0f0f0; border-color: var(--primary-dark); }
            
            .ub-footer { display: flex; justify-content: flex-end; align-items: center; margin-top: 30px; border-top: 1px solid #eaedf1; padding-top: 20px; gap: 15px; }
            .ub-btn-text { background: transparent; border: none; color: #333; cursor: pointer; font-size: 14px; }
            .ub-btn-text:hover { text-decoration: underline; }
            
            .ub-split-btn-group { display: flex; position: relative; }
            .ub-split-btn-main { background: var(--primary-dark); color: #fff; border: none; font-size: 14px; cursor: pointer; padding: 8px 15px; border-radius: 4px 0 0 4px; }
            .ub-split-btn-arrow { background: var(--primary-dark); color: #fff; border: none; border-left: 1px solid rgba(255,255,255,0.3); font-size: 10px; cursor: pointer; padding: 8px 10px; border-radius: 0 4px 4px 0; }
            .ub-split-btn-main:hover, .ub-split-btn-arrow:hover { background: var(--primary-light); }
            .ub-dropdown-menu { display: none; position: absolute; bottom: 100%; right: 0; background: #fff; margin-bottom: 5px; border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 150px; z-index: 1000; border-radius: 4px; }
            .ub-dropdown-item { padding: 10px 15px; font-size: 13px; cursor: pointer; }
            .ub-dropdown-item:hover { background: #f4f7f9; color: var(--primary-dark); }
            
            .ub-link-row { margin-top: 15px; font-size: 13px; text-align: center; }
            .ub-link { color: var(--primary-dark); text-decoration: none; font-weight: 500; margin: 0 10px; }
            .ub-link:hover { text-decoration: underline; }
        </style>

        <div class="ub-modal" id="ub-modalContent">
            <div class="ub-header-row">
                <h2>UPLOAD BANK TRANSACTIONS</h2>
                <button class="ub-close-x" id="ub-btnCloseX" title="Close (Esc)">&times;</button>
            </div>

            <div class="ub-row">
                <label class="ub-label">Target Account:*</label>
                <select class="ub-select" id="ub-targetAccount" required>
                    <option value="">Select Bank or Credit Card</option>
                    <option value="ADD_NEW" style="font-weight: bold; color: var(--primary-dark);">+ Add New Account</option>
                </select>
            </div>

            <div class="ub-row">
                <label class="ub-label">Currency:*</label>
                <select class="ub-select" id="entityCurrency" required></select>
            </div>

            <div class="ub-file-area" id="ub-fileDropArea">
                <p style="margin: 0 0 10px 0; font-weight: 500; color: var(--primary-dark);">Click to select a CSV file</p>
                <p style="margin: 0; font-size: 12px; color: #666;">Format: Date, Check No, Description, Amount</p>
                <input type="file" id="ub-fileInput" accept=".csv, .xls, .xlsx" style="display: none;">
            </div>
            
            <div class="ub-link-row">
                <a href="./accounting/transactions_upload_template.csv" download="transactions_upload_template.csv" class="ub-link">📥 Download Template</a>
                <a href="./accounting/transactions_upload_readme.txt" target="_blank" class="ub-link">📄 View Instructions (Readme)</a>
            </div>
            
            <div id="ub-fileStatus" style="font-size: 13px; color: #5cb85c; margin-top: 10px; text-align: center; display: none;"></div>

            <div class="ub-footer">
                <button class="ub-btn-text" id="ub-btnCancel">Cancel</button>
                <div class="ub-split-btn-group">
                    <button class="ub-split-btn-main" id="ub-btnSaveAction" title="Ctrl + Enter">Upload & Close</button>
                    <button class="ub-split-btn-arrow" id="ub-btnToggleDropdown">▼</button>
                    <div class="ub-dropdown-menu" id="ub-dropdownMenu">
                        <div class="ub-dropdown-item" data-action="saveNew">Upload & New</div>
                        <div class="ub-dropdown-item" data-action="saveClose">Upload & Close</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    populateCurrencyDropdown(document.getElementById('entityCurrency'));

    const elAccount = document.getElementById('ub-targetAccount');
    const elCurrency = document.getElementById('entityCurrency');
    const elFileInput = document.getElementById('ub-fileInput');
    const elFileDropArea = document.getElementById('ub-fileDropArea');
    const elFileStatus = document.getElementById('ub-fileStatus');
    
    const btnSaveAction = document.getElementById('ub-btnSaveAction');
    const dropdownMenu = document.getElementById('ub-dropdownMenu');
    let currentSaveMode = 'saveClose';
    let selectedFile = null;
    let bankAccountsMap = {};

    const loadAccounts = async () => {
        try {
            // Reset options except the default ones
            elAccount.innerHTML = `
                <option value="">Select Bank or Credit Card</option>
                <option value="ADD_NEW" style="font-weight: bold; color: var(--primary-dark);">+ Add New Account</option>
            `;
            const q = query(collection(db, "chartOfAccounts"), where("companyId", "==", session.companyId));
            const snap = await getDocs(q);
            snap.forEach(doc => {
                const data = doc.data();
                if (data.type === 'Asset' || data.type === 'Liability') {
                    bankAccountsMap[doc.id] = data;
                    const opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.textContent = `${data.code} - ${data.name} (${data.type})`;
                    elAccount.appendChild(opt);
                }
            });
        } catch(e) { console.error("Error loading accounts", e); }
    };
    loadAccounts();

    // Handle "Add New" selection
    elAccount.addEventListener('change', (e) => {
        if (e.target.value === 'ADD_NEW') {
            openAddCoaModal(containerId);
            e.target.value = ''; // Reset selection so they must re-select after creation
        }
    });

    elFileDropArea.addEventListener('click', () => elFileInput.click());
    elFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            elFileStatus.textContent = `Selected: ${selectedFile.name}`;
            elFileStatus.style.display = 'block';
        }
    });

    const cleanupAndClose = () => {
        document.removeEventListener('keydown', handleGlobalKeydown);
        overlay.remove();
        if (window.refreshBankTransactionsTable) window.refreshBankTransactionsTable();
    };

    const handleGlobalKeydown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cleanupAndClose(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleUpload(); }
    };
    document.addEventListener('keydown', handleGlobalKeydown);

    document.getElementById('ub-btnToggleDropdown').addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.querySelectorAll('.ub-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            currentSaveMode = e.target.getAttribute('data-action');
            btnSaveAction.textContent = e.target.textContent;
            dropdownMenu.style.display = 'none';
        });
    });
    document.addEventListener('click', () => dropdownMenu.style.display = 'none');
    document.getElementById('ub-btnCloseX').addEventListener('click', cleanupAndClose);
    document.getElementById('ub-btnCancel').addEventListener('click', cleanupAndClose);
    overlay.querySelector('.ub-modal').addEventListener('click', (e) => e.stopPropagation());

    const handleUpload = async () => {
        if (!elAccount.value || elAccount.value === 'ADD_NEW') return alert("Please select a valid target account.");
        if (!selectedFile) return alert("Please select a file to upload.");

        btnSaveAction.disabled = true;
        btnSaveAction.textContent = "Processing...";

        const accountData = bankAccountsMap[elAccount.value];
        const isCC = accountData.type === 'Liability';

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            let importedCount = 0;

            for (let i = 0; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
                if (cols.length >= 4) {
                    const amount = parseFloat(cols[3]);
                    if (isNaN(amount)) continue;

                    let suggestedCategory = "";
                    if (!isCC) {
                        suggestedCategory = amount > 0 ? "Uncategorized Income" : "Uncategorized Expense";
                    } else {
                        suggestedCategory = amount > 0 ? "Uncategorized Charges" : "Uncategorized Credit";
                    }

                    const exchangeRate = await getExchangeRate(elCurrency.value, cols[0]);
                    const homeAmount = calculateHomeAmount(amount, exchangeRate);

                    const txData = {
                        companyId: session.companyId,
                        createdBy: session.uid,
                        bankAccountId: elAccount.value,
                        date: cols[0],
                        checkNo: cols[1],
                        description: cols[2],
                        foreignAmount: amount,
                        homeAmount: homeAmount,
                        currency: elCurrency.value,
                        exchangeRate: exchangeRate,
                        status: "Unreviewed",
                        suggestedCategory: suggestedCategory,
                        postedCategoryId: null,
                        createdAt: new Date().toISOString()
                    };

                    try {
                        await addDoc(collection(db, "bankTransactions"), txData); // Collection updated here
                        importedCount++;
                    } catch (err) { console.error("Row fail", err); }
                }
            }

            alert(`Successfully imported ${importedCount} transactions.`);
            if (currentSaveMode === 'saveClose') {
                cleanupAndClose();
            } else {
                selectedFile = null;
                elFileInput.value = '';
                elFileStatus.style.display = 'none';
                btnSaveAction.disabled = false;
                btnSaveAction.textContent = "Upload & New";
            }
        };
        reader.readAsText(selectedFile);
    };

    btnSaveAction.addEventListener('click', handleUpload);
}
