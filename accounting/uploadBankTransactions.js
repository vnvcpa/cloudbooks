// accounting/bankTransactions.js

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getLocalSession } from "../auth/authManager.js";
import { init as openUploadModal } from "./uploadBankTransactions.js";
import { init as openAddCoaModal } from "../settings/addChartOfAccount.js";
import { formatCurrency } from "../settings/multicurrency.js";

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

    const session = getLocalSession();
    if (!session.companyId || session.companyId === 'null') {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #d9534f;">Please set up your company workspace first.</div>`;
        return;
    }

    container.innerHTML = `
        <style>
            .bt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .bt-controls { display: flex; gap: 10px; margin-bottom: 15px; align-items: center; flex-wrap: wrap; }
            .bt-select { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none; min-width: 160px; }
            .bt-search { flex: 1; min-width: 250px; }
            
            .bt-split-btn { display: flex; position: relative; }
            .bt-btn-main { background: var(--primary-dark); color: #fff; border: none; padding: 10px 15px; font-size: 14px; border-radius: 4px 0 0 4px; cursor: pointer; }
            .bt-btn-arrow { background: var(--primary-dark); color: #fff; border: none; border-left: 1px solid rgba(255,255,255,0.3); padding: 10px 10px; border-radius: 0 4px 4px 0; cursor: pointer; }
            .bt-dropdown { display: none; position: absolute; top: 100%; right: 0; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 4px; border: 1px solid #eee; z-index: 100; min-width: 180px; }
            .bt-dropdown div { padding: 10px 15px; font-size: 13px; cursor: pointer; color: #333; }
            .bt-dropdown div:hover { background: #f4f7f9; color: var(--primary-dark); }
            
            /* Batch Action Bar */
            .bt-batch-bar { display: none; padding: 10px 15px; background: #e3f2fd; border-radius: 4px; margin-bottom: 15px; align-items: center; gap: 12px; border: 1px solid #bbdefb; }
            
            /* CSS Grid Table Layout */
            .bt-table { width: 100%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-radius: 6px; overflow: hidden; }
            .bt-thead { display: grid; grid-template-columns: 40px 110px 300px 150px 150px; background: #f4f7f9; font-weight: 600; font-size: 12px; color: var(--primary-dark); border-bottom: 2px solid #eaedf1; }
            .bt-th { padding: 12px 15px; display: flex; align-items: center; }
            .bt-th-sortable { cursor: pointer; user-select: none; }
            .bt-th-sortable:hover { background: #eaedf1; }
            
            .bt-row-group { border-bottom: 1px solid #eaedf1; transition: background 0.2s; }
            .bt-row-group:hover { background: #fafbfc; }
            .bt-row-main { display: grid; grid-template-columns: 40px 110px 300px 150px 150px; align-items: center; }
            .bt-td { padding: 10px 15px; font-size: 13px; }
            
            /* Sub-Row perfectly aligned below the main content */
            .bt-row-sub { grid-column: 1 / -1; padding: 0 15px 12px 65px; font-size: 12px; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            
            /* Balance Rows matching Grid */
            .bt-bal-row { display: grid; grid-template-columns: 40px 110px 300px 150px 150px; background: #fcfcfc; font-weight: 600; font-size: 13px; border-bottom: 1px solid #eaedf1; }
            .bt-bal-label { grid-column: 1 / 5; padding: 12px 15px; text-align: right; color: #666; }
            .bt-bal-amt { padding: 12px 15px; text-align: right; }
            
            /* UI Controls */
            .cat-controls { display: flex; gap: 6px; align-items: center; }
            .cat-select { flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; }
            .cat-btn-ok { background: #5cb85c; color: #fff; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 12px; font-weight: bold; }
            .cat-btn-split { background: #fff; color: #666; border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 12px; }
            .cat-btn-split:hover { background: #f0f0f0; }
            .cat-reviewed-text { font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 10px; }
            .cat-btn-undo { background: none; border: none; color: #999; cursor: pointer; font-size: 12px; text-decoration: underline; }
            
            .txt-green { color: #2e7d32; font-weight: 500; }
            .txt-red { color: #d32f2f; font-weight: 500; }
        </style>

        <div class="bt-header">
            <div>
                <h1>Bank Transactions</h1>
                <p>Categorize and review your connected feeds.</p>
            </div>
            <div class="bt-split-btn">
                <button class="bt-btn-main" id="bt-btnConnect">Connect Bank</button>
                <button class="bt-btn-arrow" id="bt-btnPrimaryDropdown">▼</button>
                <div class="bt-dropdown" id="bt-primaryMenu">
                    <div>Add Manual Deposit</div>
                    <div>Add Manual Withdrawal</div>
                    <div>Add CC Charge</div>
                    <div>Add CC Credit</div>
                    <div id="bt-optUpload">Upload Transactions</div>
                </div>
            </div>
        </div>

        <div class="bt-controls">
            <select class="bt-select" id="bt-filterAccount">
                <option value="">Select Account...</option>
            </select>
            <input type="date" id="bt-filterStart" class="bt-select" title="Start Date">
            <input type="date" id="bt-filterEnd" class="bt-select" title="End Date">
            <input type="text" id="bt-search" class="bt-select bt-search" placeholder="Search date, description, or amount...">
        </div>

        <div class="bt-batch-bar" id="bt-batchBar">
            <span style="font-size: 13px; font-weight: 600; color: var(--primary-dark);" id="bt-batchCount">0 selected</span>
            <button class="cat-btn-ok" id="bt-btnBatchPost">Post Selected</button>
            <button class="cat-btn-split" id="bt-btnBatchUndo">Undo Selected</button>
            <button class="cat-btn-split" id="bt-btnBatchDelete" style="color: #d32f2f; border-color: #d32f2f;">Delete Selected</button>
        </div>

        <div class="bt-table">
            <div class="bt-thead">
                <div class="bt-th" style="justify-content:center;"><input type="checkbox" id="bt-selectAll"></div>
                <div class="bt-th bt-th-sortable" id="bt-headerDate">DATE <span id="bt-sortArrow" style="margin-left:5px;">&#8595;</span></div>
                <div class="bt-th">CATEGORY</div>
                <div class="bt-th" style="justify-content: flex-end;">AMOUNT</div>
                <div class="bt-th" style="justify-content: flex-end;">BALANCE</div>
            </div>
            <div id="bt-listContainer">
                <div style="padding: 40px; text-align: center; color: #666;">Select an account to view transactions.</div>
            </div>
        </div>
    `;

    const elAccount = document.getElementById('bt-filterAccount');
    const elStart = document.getElementById('bt-filterStart');
    const elEnd = document.getElementById('bt-filterEnd');
    const elSearch = document.getElementById('bt-search');
    const listContainer = document.getElementById('bt-listContainer');
    
    let sortOrder = 'desc'; // default newest first
    const headerDate = document.getElementById('bt-headerDate');
    const sortArrow = document.getElementById('bt-sortArrow');

    // Header Actions
    const primaryBtn = document.getElementById('bt-btnPrimaryDropdown');
    const primaryMenu = document.getElementById('bt-primaryMenu');
    primaryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        primaryMenu.style.display = primaryMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => primaryMenu.style.display = 'none');
    
    document.getElementById('bt-optUpload').addEventListener('click', () => {
        openUploadModal(containerId);
    });

    let chartOfAccounts = [];
    let bankAccountsMap = {};

    const loadDependencies = async () => {
        try {
            // Reset to prevent duplicates if re-injected
            chartOfAccounts = [];
            elAccount.innerHTML = '<option value="">Select Account...</option>';
            
            const q = query(collection(db, "chartOfAccounts"), where("companyId", "==", session.companyId));
            const snap = await getDocs(q);
            snap.forEach(doc => {
                const data = doc.data();
                chartOfAccounts.push({ id: doc.id, ...data });
                if (data.type === 'Asset' || data.type === 'Liability') {
                    bankAccountsMap[doc.id] = data;
                    const opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.textContent = `${data.code} - ${data.name}`;
                    elAccount.appendChild(opt);
                }
            });
        } catch(e) { console.error(e); }
    };

    const buildCategoryDropdown = (selectedCat) => {
        let options = `<option value="">Select Category...</option>`;
        chartOfAccounts.forEach(acc => {
            const isSelected = selectedCat === acc.name ? 'selected' : '';
            options += `<option value="${acc.id}" ${isSelected}>${acc.code} - ${acc.name}</option>`;
        });
        options += `<option value="ADD_NEW" style="font-weight: bold; color: var(--primary-dark);">+ Add New Account</option>`;
        return options;
    };

    // Helper: Sort Toggle
    headerDate.addEventListener('click', () => {
        sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        sortArrow.innerHTML = sortOrder === 'desc' ? '&#8595;' : '&#8593;';
        window.refreshBankTransactionsTable();
    });

    window.refreshBankTransactionsTable = async () => {
        const targetAccountId = elAccount.value;
        if (!targetAccountId) {
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Select an account to view transactions.</div>`;
            document.getElementById('bt-batchBar').style.display = 'none';
            return;
        }

        const isCC = bankAccountsMap[targetAccountId].type === 'Liability';
        const startFilter = elStart.value;
        const endFilter = elEnd.value;
        const searchTxt = elSearch.value.toLowerCase();

        try {
            // Fetch all for this account to safely calculate the running balance
            const q = query(
                collection(db, "bankTransactions"), 
                where("companyId", "==", session.companyId),
                where("bankAccountId", "==", targetAccountId)
            );
            const snap = await getDocs(q);
            
            let allTxs = [];
            snap.forEach(doc => { allTxs.push({ id: doc.id, ...doc.data() }); });

            // Sort chronologically (oldest first) to compute running balance
            allTxs.sort((a, b) => new Date(a.date) - new Date(b.date));

            let runningBalance = 0;
            let displayTxs = [];
            let beginningBalance = 0;

            allTxs.forEach(tx => {
                // Determine if this transaction is BEFORE the start filter to calc beginning balance
                if (startFilter && tx.date < startFilter) {
                    runningBalance += tx.foreignAmount;
                    beginningBalance = runningBalance;
                } else {
                    // Update running balance and tag transaction
                    runningBalance += tx.foreignAmount;
                    tx.calculatedBalance = runningBalance;
                    
                    // Apply End Date Filter
                    if (endFilter && tx.date > endFilter) return;

                    // Apply Search Text Filter
                    if (searchTxt) {
                        const amountStr = String(Math.abs(tx.foreignAmount));
                        const match = tx.date.includes(searchTxt) || 
                                      (tx.description || '').toLowerCase().includes(searchTxt) || 
                                      amountStr.includes(searchTxt);
                        if (!match) return;
                    }
                    
                    displayTxs.push(tx);
                }
            });

            // Apply UI Sort Order
            if (sortOrder === 'desc') displayTxs.reverse();

            if (displayTxs.length === 0) {
                listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">No matching transactions found.</div>`;
                return;
            }

            // Render Rows
            let html = '';
            const currencyCode = displayTxs[0].currency; // Base on first filtered tx

            const begBalHtml = `
                <div class="bt-bal-row">
                    <div class="bt-bal-label">Beginning Balance</div>
                    <div class="bt-bal-amt">${formatCurrency(beginningBalance, currencyCode)}</div>
                </div>`;
            
            // Note: The true ending balance of the filtered set is the calculatedBalance of the chronologically last item.
            // If sort is 'desc', the first item in displayTxs is the newest.
            const closingBal = sortOrder === 'desc' ? displayTxs[0].calculatedBalance : displayTxs[displayTxs.length-1].calculatedBalance;
            const endBalHtml = `
                <div class="bt-bal-row">
                    <div class="bt-bal-label">Ending Balance</div>
                    <div class="bt-bal-amt">${formatCurrency(closingBal, currencyCode)}</div>
                </div>`;

            if (sortOrder === 'asc') html += begBalHtml;
            else html += endBalHtml;

            displayTxs.forEach(tx => {
                let amountLabel = '';
                let amountClass = '';
                
                // Accounting Signs Logic
                if (!isCC) {
                    amountLabel = tx.foreignAmount > 0 ? 'Deposit' : 'Withdrawal';
                    amountClass = tx.foreignAmount > 0 ? 'txt-green' : 'txt-red';
                } else {
                    amountLabel = tx.foreignAmount > 0 ? 'CC Charge' : 'CC Credit';
                    amountClass = tx.foreignAmount > 0 ? 'txt-red' : 'txt-green';
                }

                let catHtml = '';
                if (tx.status === 'Unreviewed') {
                    catHtml = `
                        <div class="cat-controls">
                            <select class="cat-select" id="sel-${tx.id}">${buildCategoryDropdown(tx.suggestedCategory)}</select>
                            <button class="cat-btn-ok btn-post" data-id="${tx.id}" title="Post Transaction to Ledger">&#10003;</button>
                            <button class="cat-btn-split">Split</button>
                        </div>
                    `;
                } else {
                    const postedName = chartOfAccounts.find(c => c.id === tx.postedCategoryId)?.name || 'Categorized';
                    catHtml = `
                        <div class="cat-reviewed-text">
                            <span style="color: #2e7d32;">&#10003;</span> ${postedName}
                            <button class="cat-btn-undo" data-id="${tx.id}">Undo</button>
                        </div>
                    `;
                }

                html += `
                    <div class="bt-row-group">
                        <div class="bt-row-main">
                            <div class="bt-td" style="text-align:center;"><input type="checkbox" class="bt-row-check" data-id="${tx.id}"></div>
                            <div class="bt-td">${tx.date}</div>
                            <div class="bt-td">${catHtml}</div>
                            <div class="bt-td ${amountClass}" style="text-align: right;">
                                <div>${formatCurrency(Math.abs(tx.foreignAmount), tx.currency)}</div>
                                <div style="font-size: 11px; color: #999;">${amountLabel}</div>
                            </div>
                            <div class="bt-td" style="text-align: right;">${formatCurrency(tx.calculatedBalance, tx.currency)}</div>
                        </div>
                        <div class="bt-row-sub">${tx.description} ${tx.checkNo ? '(Ref: ' + tx.checkNo + ')' : ''}</div>
                    </div>
                `;
            });

            if (sortOrder === 'asc') html += endBalHtml;
            else html += begBalHtml;

            listContainer.innerHTML = html;

            // --- BIND EVENTS ---
            
            // "Add New Account" Category Interceptor
            document.querySelectorAll('.cat-select').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    if (e.target.value === 'ADD_NEW') {
                        openAddCoaModal(containerId);
                        e.target.value = ''; // Reset
                    }
                });
            });

            // Single Post
            document.querySelectorAll('.btn-post').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const txId = e.target.getAttribute('data-id');
                    const selVal = document.getElementById(`sel-${txId}`).value;
                    if (!selVal) return alert("Select a category first.");
                    
                    e.target.textContent = "...";
                    await updateDoc(doc(db, "bankTransactions", txId), {
                        status: 'Reviewed',
                        postedCategoryId: selVal
                    });
                    window.refreshBankTransactionsTable();
                });
            });

            // Single Undo
            document.querySelectorAll('.cat-btn-undo').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const txId = e.target.getAttribute('data-id');
                    await updateDoc(doc(db, "bankTransactions", txId), {
                        status: 'Unreviewed',
                        postedCategoryId: null
                    });
                    window.refreshBankTransactionsTable();
                });
            });

            // --- BATCH ACTION LOGIC ---
            const selectAll = document.getElementById('bt-selectAll');
            const rowChecks = document.querySelectorAll('.bt-row-check');
            const batchBar = document.getElementById('bt-batchBar');
            const batchCount = document.getElementById('bt-batchCount');

            const updateBatchUI = () => {
                const checked = document.querySelectorAll('.bt-row-check:checked');
                if (checked.length > 0) {
                    batchBar.style.display = 'flex';
                    batchCount.textContent = `${checked.length} selected`;
                } else {
                    batchBar.style.display = 'none';
                    selectAll.checked = false;
                }
            };

            selectAll.addEventListener('change', (e) => {
                rowChecks.forEach(chk => chk.checked = e.target.checked);
                updateBatchUI();
            });

            rowChecks.forEach(chk => chk.addEventListener('change', updateBatchUI));

            // Batch Post
            document.getElementById('bt-btnBatchPost').addEventListener('click', async () => {
                const checked = document.querySelectorAll('.bt-row-check:checked');
                for (let chk of checked) {
                    const txId = chk.getAttribute('data-id');
                    const sel = document.getElementById(`sel-${txId}`);
                    // Only process Unreviewed items that have a category selected
                    if (sel && sel.value) {
                        await updateDoc(doc(db, "bankTransactions", txId), {
                            status: 'Reviewed',
                            postedCategoryId: sel.value
                        });
                    }
                }
                window.refreshBankTransactionsTable();
            });

            // Batch Undo
            document.getElementById('bt-btnBatchUndo').addEventListener('click', async () => {
                const checked = document.querySelectorAll('.bt-row-check:checked');
                for (let chk of checked) {
                    const txId = chk.getAttribute('data-id');
                    await updateDoc(doc(db, "bankTransactions", txId), {
                        status: 'Unreviewed',
                        postedCategoryId: null
                    });
                }
                window.refreshBankTransactionsTable();
            });

            // Batch Delete
            document.getElementById('bt-btnBatchDelete').addEventListener('click', async () => {
                if(!confirm("Are you sure you want to permanently delete the selected transactions?")) return;
                const checked = document.querySelectorAll('.bt-row-check:checked');
                for (let chk of checked) {
                    const txId = chk.getAttribute('data-id');
                    await deleteDoc(doc(db, "bankTransactions", txId));
                }
                window.refreshBankTransactionsTable();
            });

        } catch (e) {
            console.error(e);
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #d9534f;">Error loading data.</div>`;
        }
    };

    elAccount.addEventListener('change', window.refreshBankTransactionsTable);
    elStart.addEventListener('change', window.refreshBankTransactionsTable);
    elEnd.addEventListener('change', window.refreshBankTransactionsTable);
    elSearch.addEventListener('input', window.refreshBankTransactionsTable);

    loadDependencies();
}
