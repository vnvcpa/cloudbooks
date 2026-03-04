import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getLocalSession } from '../auth/authManager.js';
import { populateCurrencyDropdown } from '../settings/multicurrency.js';

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook",
    storageBucket: "vnvcloudbook.firebasestorage.app"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export function init(containerId, entityId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="modal-overlay" id="uploadModalOverlay" style="z-index: 990;">
            <div class="modal-content" style="width: 600px;">
                <div class="modal-header">
                    <h2>Upload Bank Transactions</h2>
                    <button class="btn-close" id="ub-btnClose">X</button>
                </div>
                <div class="modal-body">
                    <div class="form-group line-input-group">
                        <label>Target Account</label>
                        <select id="ub-targetAccount" class="line-input">
                            <option value="">Select Account...</option>
                            <option value="acc_101">Checking Account (...1234)</option>
                            <option value="acc_201">Corporate Credit Card (...5678)</option>
                            <option disabled>──────────</option>
                            <option value="ADD_NEW_BANK">+ Add New Bank Account</option>
                            <option value="ADD_NEW_CC">+ Add New Credit Card</option>
                        </select>
                    </div>
                    <div class="form-group line-input-group">
                        <label>Currency</label>
                        <select id="entityCurrency" class="line-input"></select>
                    </div>
                    <div class="ub-file-area" id="ub-fileDropArea" style="border: 2px dashed #ccc; padding: 20px; text-align: center; margin-top: 15px;">
                        <p>Drag and drop your CSV or Excel file here, or click to browse.</p>
                        <input type="file" id="ub-fileInput" accept=".csv, .xls, .xlsx" style="display: none;">
                        <button class="btn-secondary" id="ub-btnBrowse">Browse Files</button>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.9em; text-align: center;">
                        <a href="./accounting/transactions_upload_template.csv" download style="margin-right: 15px; color: #0056b3;">Download Template (CSV)</a>
                        <a href="./accounting/transactions_upload_readme.md" target="_blank" style="color: #0056b3;">View Upload Instructions</a>
                    </div>
                </div>
                <div class="modal-footer split-button-group">
                    <button class="btn-primary" id="ub-btnUpload">Upload & Process</button>
                    <button class="btn-secondary" id="ub-btnCancel">Cancel</button>
                </div>
            </div>
        </div>
    `;

    populateCurrencyDropdown(document.getElementById('entityCurrency'), 'PHP');

    const overlay = document.getElementById('uploadModalOverlay');
    const targetAccountSelect = document.getElementById('ub-targetAccount');
    const btnClose = document.getElementById('ub-btnClose');
    const btnCancel = document.getElementById('ub-btnCancel');
    const btnBrowse = document.getElementById('ub-btnBrowse');
    const fileInput = document.getElementById('ub-fileInput');
    const btnUpload = document.getElementById('ub-btnUpload');

    const closeModal = () => {
        container.innerHTML = '';
        document.removeEventListener('keydown', handleKeydown);
    };

    const handleKeydown = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleKeydown);

    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    targetAccountSelect.addEventListener('change', (e) => {
        if (e.target.value === 'ADD_NEW_BANK' || e.target.value === 'ADD_NEW_CC') {
            alert('Triggering Add New Account Modal for: ' + e.target.value);
            e.target.value = "";
        }
    });

    btnBrowse.addEventListener('click', () => fileInput.click());

    btnUpload.addEventListener('click', async () => {
        const session = getLocalSession();
        if (!session) {
            alert("No active session found.");
            return;
        }

        const accountId = targetAccountSelect.value;
        if (!accountId) {
            alert("Please select a target account.");
            return;
        }

        const file = fileInput.files[0];
        if (!file) {
            alert("Please select a file to upload.");
            return;
        }

        const isCreditCard = accountId.includes('201'); 
        const defaultCategory = isCreditCard ? "Uncategorized Charges" : "Uncategorized Expense";

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const rows = text.split('\n');
            let successCount = 0;

            for (let i = 1; i < rows.length; i++) {
                if (!rows[i].trim()) continue;
                const cols = rows[i].split(',');
                if (cols.length >= 4) {
                    const amount = parseFloat(cols[3].trim());
                    const defaultCatForSign = amount > 0 
                        ? (isCreditCard ? "Uncategorized Charges" : "Uncategorized Income") 
                        : (isCreditCard ? "Uncategorized Credit" : "Uncategorized Expense");

                    const payload = {
                        companyId: session.companyId,
                        createdBy: session.uid,
                        accountId: accountId,
                        date: cols[0].trim(),
                        checkNo: cols[1].trim(),
                        description: cols[2].trim(),
                        amount: amount,
                        category: defaultCatForSign,
                        status: 'Unreviewed',
                        currency: document.getElementById('entityCurrency').value,
                        createdAt: serverTimestamp()
                    };

                    try {
                        await addDoc(collection(db, "bankTransactions"), payload);
                        successCount++;
                    } catch (error) {
                        console.error("Error saving row: ", error);
                    }
                }
            }
            alert(`Successfully uploaded ${successCount} transactions.`);
            closeModal();
        };
        reader.readAsText(file);
    });
}
