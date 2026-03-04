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

// Helper to safely parse dates regardless of formats like MM/DD/YYYY or YYYY-MM-DD
const parseDateSafe = (dateStr) => {
    if (!dateStr) return 0;
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

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
            
            .bt-batch-bar { display: none; padding: 10px 15px; background: #e3f2fd; border-radius: 4px; margin-bottom: 15px; align-items: center; gap: 12px; border: 1px solid #bbdefb; }
            
            /* Dynamic CSS Grid Table Layout */
            .bt-table { --grid-cols: 40px 110px 300px 150px 150px; width: 100%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-radius: 6px; overflow-x: auto; }
            .bt-table-inner { min-width: 600px; }
            .bt-thead { display: grid; grid-template-columns: var(--grid-cols); background: #f4f7f9; font-weight: 600; font-size: 12px; color: var(--primary-dark); border-bottom: 2px solid #eaedf1; position: relative; }
            .bt-th { padding: 12px 15px; display: flex; align-items: center; position: relative; }
            .bt-th-sortable { cursor: pointer; user-select: none; }
            .bt-th-sortable:hover { background: #eaedf1; }
            .bt-resizer { position: absolute; right: 0; top: 0; bottom: 0; width: 5px; cursor: col-resize; z-index: 2; }
            .bt-resizer:hover { background: rgba(0,0,0,0.1); }
            
            .bt-row-group { border-bottom: 1px solid #eaedf1; transition: background 0.2s; border-left: 4px solid transparent; }
            .bt-row-group:hover { background: #f0f7ff !important; }
            .bt-row-group.status-Reviewed { background: #f4fdf4; border-left-color: #5cb85c; }
            .bt-row-group.status-Split { background: #f4fdf4; border-left-color: #5cb85c; }
            
            .bt-row-main { display: grid; grid-template-columns: var(--grid-cols); align-items: center; }
            .bt-td { padding: 10px 15px; font-size: 13px; overflow: hidden; text-overflow: ellipsis; }
            
            .bt-row-sub { grid-column: 1 / -1; padding: 0 15px 12px 65px; font-size: 12px; color: #666; display: flex; justify-content: space-between; align-items: flex-start; }
            .bt-desc-text { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; padding-right: 15px; }
            
            .bt-bal-row { display: grid; grid-template-columns: var(--grid-cols); background: #fcfcfc; font-weight: 600; font-size: 13px; border-bottom: 1px solid #eaedf1; }
            .bt-bal-label { grid-column: 1 / 5; padding: 12px 15px; text-align: right; color: #666; }
            .bt-bal-amt { padding: 12px 15px; text-align: right; }
            
            /* Categorization Controls */
            .cat-controls { display: flex; gap: 6px; align-items: center; width: 100%; }
            .cat-select { flex: 1; padding: 6px 0; border: none; border-bottom: 1px solid #ccc; border-radius: 0; font-size: 12px; background: transparent; outline: none; appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;utf8,<svg fill="black" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>'); background-repeat: no-repeat; background-position-x: 100%; background-position-y: center; background-size: 16px; padding-right: 20px; }
            .cat-select:focus { border-bottom-color: var(--primary-dark); }
            
            .cat-btn-ok { background: #5cb85c; color: #fff; border: none; border-radius: 4px; display: inline-flex; justify-content: center; align-items: center; width: 28px; height: 28px; cursor: pointer; font-size: 14px; font-weight: bold; flex-shrink: 0; }
            .cat-btn-split { background: #fff; color: #666; border: 1px solid #ccc; border-radius: 4px; padding: 0 10px; height: 28px; display: inline-flex; align-items: center; cursor: pointer; font-size: 12px; flex-shrink: 0; }
            .cat-btn-split:hover { background: #f0f0f0; }
            
            .cat-reviewed-text { font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: center; gap: 10px; }
            .cat-btn-undo { background: none; border: none; color: #999; cursor: pointer; font-size: 12px; text-decoration: underline; }
            
            .txt-green { color: #2e7d32; font-weight: 500; }
            .txt-red { color: #d32f2f; font-weight: 500; }
            
            /* Action containers to handle mobile reflow */
            .act-desktop { display: flex; gap: 6px; }
            .act-mobile { display: none; gap: 6px; margin-top: 5px; }

            @media (max-width: 768px) {
                .bt-table { --grid-cols: 30px 75px 1fr 85px 85px; }
                .bt-table-inner { min-width: 100%; }
                .bt-th { padding: 8px 5px; font-size: 10px; }
                .bt-td { padding: 8px 5px; font-size: 11px; }
                .bt-row-sub { padding: 0 5px 8px 35px; flex-direction: column; }
                .act-desktop { display: none; }
                .act-mobile { display: flex; align-self: flex-end; }
                .cat-select { font-size: 11px; }
                .bt-desc-text { padding-right: 0; }
            }
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
            <button class="cat-btn-ok" id="bt-btnBatchPost" style="width: auto; padding: 0 10px;">Post Selected</button>
            <button class="cat-btn-split" id="bt-btnBatchUndo">Undo Selected</button>
            <button class="cat-btn-split" id="bt-btnBatchDelete" style="color: #d32f2f; border-color: #d32f2f;">Delete Selected</button>
        </div>

        <div class="bt-table">
            <div class="bt-table-inner">
                <div class="bt-thead" id="bt-thead">
                    <div class="bt-th" style="justify-content:center;"><input type="checkbox" id="bt-selectAll"><div class="bt-resizer"></div></div>
                    <div class="bt-th bt-th-sortable" id="bt-headerDate">DATE <span id="bt-sortArrow" style="margin-left:5px;">&#8595;</span><div class="bt-resizer"></div></div>
                    <div class="bt-th">CATEGORY<div class="bt-resizer"></div></div>
                    <div class="bt-th" style="justify-content: flex-end;">AMOUNT<div class="bt-resizer"></div></div>
                    <div class="bt-th" style="justify-content: flex-end;">BALANCE</div>
                </div>
                <div id="bt-listContainer">
                    <div style="padding: 40px; text-align: center; color: #666;">Select an account to view transactions.</div>
                </div>
            </div>
        </div>
    `;

    const elAccount = document.getElementById('bt-filterAccount');
    const elStart = document.getElementById('bt-filterStart');
    const elEnd = document.getElementById('bt-filterEnd');
    const elSearch = document.getElementById('bt-search');
    const listContainer = document.getElementById('bt-listContainer');
    const selectAll = document.getElementById('bt-selectAll');
    const batchBar = document.getElementById('bt-batchBar');
    const batchCount = document.getElementById('bt-batchCount');
    
    let sortOrder = 'desc'; 
    let chartOfAccounts = [];
    let bankAccountsMap = {};
    let currentTransactions = []; 

    // --- Column Resizer Logic ---
    const initResizer = () => {
        const table = document.querySelector('.bt-table');
        const headers = table.querySelectorAll('.bt-th');
        let isMobile = window.innerWidth <= 768;
        let colWidths = isMobile ? [30, 75, 200, 85, 85] : [40, 110, 300, 150, 150];

        headers.forEach((th, i) => {
            const resizer = th.querySelector('.bt-resizer');
            if (!resizer) return;
            let startX, startWidth;
            
            const onMouseMove = (e) => {
                const diff = e.pageX - startX;
                colWidths[i] = Math.max(30, startWidth + diff);
                let gridStr = colWidths.map((w, idx) => idx === 2 ? '1fr' : w + 'px').join(' ');
                table.style.setProperty('--grid-cols', gridStr);
            };
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            resizer.addEventListener('mousedown', (e) => {
                startX = e.pageX;
                startWidth = colWidths[i];
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    };
    initResizer();

    // --- Header Actions ---
    const primaryBtn = document.getElementById('bt-btnPrimaryDropdown');
    const primaryMenu = document.getElementById('bt-primaryMenu');
    primaryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        primaryMenu.style.display = primaryMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => primaryMenu.style.display = 'none');
    document.getElementById('bt-optUpload').addEventListener('click', () => openUploadModal(containerId));

    // --- Fetch Dependencies ---
    const loadDependencies = async () => {
        try {
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

    const buildCategoryDropdown = (selectedCatId) => {
        let options = `<option value="">Select Category...</option>`;
        chartOfAccounts.forEach(acc => {
            const isSelected = selectedCatId === acc.id || selectedCatId === acc.name ? 'selected' : '';
            options += `<option value="${acc.id}" ${isSelected}>${acc.code} - ${acc.name}</option>`;
        });
        options += `<option value="ADD_NEW" style="font-weight: bold; color: var(--primary-dark);">+ Add New Account</option>`;
        return options;
    };

    // --- Batch UI Updater ---
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
        const rowChecks = document.querySelectorAll('.bt-row-check');
        rowChecks.forEach(chk => chk.checked = e.target.checked);
        updateBatchUI();
    });

    document.getElementById('bt-headerDate').addEventListener('click', () => {
        sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        document.getElementById('bt-sortArrow').innerHTML = sortOrder === 'desc' ? '&#8595;' : '&#8593;';
        window.refreshBankTransactionsTable();
    });

    // --- Main Render Logic ---
    window.refreshBankTransactionsTable = async () => {
        const targetAccountId = elAccount.value;
        if (!targetAccountId) {
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Select an account to view transactions.</div>`;
            batchBar.style.display = 'none';
            selectAll.checked = false;
            return;
        }

        const isCC = bankAccountsMap[targetAccountId].type === 'Liability';
        const startFilter = elStart.value;
        const endFilter = elEnd.value;
        const searchTxt = elSearch.value.toLowerCase();

        try {
            const q = query(
                collection(db, "bankTransactions"), 
                where("companyId", "==", session.companyId),
                where("bankAccountId", "==", targetAccountId)
            );
            const snap = await getDocs(q);
            
            let allTxs = [];
            snap.forEach(doc => { allTxs.push({ id: doc.id, ...doc.data() }); });
            
            // Sort chronologically to compute running balance
            allTxs.sort((a, b) => new Date(a.date) - new Date(b.date));

            let runningBalance = 0;
            let displayTxs = [];
            let beginningBalance = 0;

            const startTime = parseDateSafe(startFilter);
            const endTime = parseDateSafe(endFilter);

            allTxs.forEach(tx => {
                const txTime = parseDateSafe(tx.date);
                
                if (startTime && txTime < startTime) {
                    runningBalance += tx.homeAmount;
                    beginningBalance = runningBalance;
                } else {
                    runningBalance += tx.homeAmount;
                    tx.calculatedBalance = runningBalance;
                    
                    // The Fix: proper date range inclusion
                    if (endTime && txTime > endTime) return; 

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

            currentTransactions = displayTxs; 
            if (sortOrder === 'desc') displayTxs.reverse();

            if (displayTxs.length === 0) {
                listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">No matching transactions found.</div>`;
                return;
            }

            let html = '';
            const currencyCode = displayTxs[0].currency; 
            const closingBal = sortOrder === 'desc' ? displayTxs[0].calculatedBalance : displayTxs[displayTxs.length-1].calculatedBalance;
            
            const begBalHtml = `<div class="bt-bal-row"><div class="bt-bal-label">Beginning Balance</div><div class="bt-bal-amt">${formatCurrency(beginningBalance, currencyCode)}</div></div>`;
            const endBalHtml = `<div class="bt-bal-row"><div class="bt-bal-label">Ending Balance</div><div class="bt-bal-amt">${formatCurrency(closingBal, currencyCode)}</div></div>`;

            if (sortOrder === 'asc') html += begBalHtml;
            else html += endBalHtml;

            displayTxs.forEach(tx => {
                let amountLabel = '';
                let amountClass = '';
                
                if (!isCC) {
                    amountLabel = tx.foreignAmount > 0 ? 'Deposit' : 'Withdrawal';
                    amountClass = tx.foreignAmount > 0 ? 'txt-green' : 'txt-red';
                } else {
                    amountLabel = tx.foreignAmount > 0 ? 'CC Charge' : 'CC Credit';
                    amountClass = tx.foreignAmount > 0 ? 'txt-red' : 'txt-green';
                }

                let catSelectHtml = '';
                let actionsHtml = '';
                let statusClass = `status-${tx.status}`;

                if (tx.status === 'Unreviewed') {
                    let defCatId = tx.postedCategoryId || tx.suggestedCategory;
                    catSelectHtml = `<select class="cat-select" id="sel-${tx.id}">${buildCategoryDropdown(defCatId)}</select>`;
                    actionsHtml = `
                        <button class="cat-btn-ok btn-post" data-id="${tx.id}" title="Post Transaction">&#10003;</button>
                        <button class="cat-btn-split btn-split" data-id="${tx.id}">Split</button>
                    `;
                } else if (tx.status === 'Split') {
                    catSelectHtml = `<span style="font-size:12px; color:#555;">Split (${tx.splits ? tx.splits.length : 0} lines)</span>`;
                    actionsHtml = `<button class="cat-btn-undo" data-id="${tx.id}">Undo</button>`;
                } else {
                    const postedName = chartOfAccounts.find(c => c.id === tx.postedCategoryId)?.name || 'Categorized';
                    catSelectHtml = `<span style="font-size:12px; color:#333;">${postedName}</span>`;
                    actionsHtml = `<button class="cat-btn-undo" data-id="${tx.id}">Undo</button>`;
                }

                html += `
                    <div class="bt-row-group ${statusClass}">
                        <div class="bt-row-main">
                            <div class="bt-td" style="text-align:center;"><input type="checkbox" class="bt-row-check" data-id="${tx.id}"></div>
                            <div class="bt-td">${tx.date}</div>
                            <div class="bt-td">
                                <div class="cat-controls">
                                    ${catSelectHtml}
                                    <div class="act-desktop">${actionsHtml}</div>
                                </div>
                            </div>
                            <div class="bt-td ${amountClass}" style="text-align: right;">
                                <div>${formatCurrency(Math.abs(tx.foreignAmount), tx.currency)}</div>
                                <div style="font-size: 11px; color: #999;">${amountLabel}</div>
                            </div>
                            <div class="bt-td" style="text-align: right;">${formatCurrency(tx.calculatedBalance, tx.currency)}</div>
                        </div>
                        <div class="bt-row-sub">
                            <div class="bt-desc-text">${tx.description} ${tx.checkNo ? '(Ref: ' + tx.checkNo + ')' : ''}</div>
                            <div class="act-mobile">${actionsHtml}</div>
                        </div>
                    </div>
                `;
            });

            if (sortOrder === 'asc') html += endBalHtml;
            else html += begBalHtml;

            listContainer.innerHTML = html;
            selectAll.checked = false;
            updateBatchUI();

            document.querySelectorAll('.bt-row-check').forEach(chk => chk.addEventListener('change', updateBatchUI));

            document.querySelectorAll('.cat-select').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    if (e.target.value === 'ADD_NEW') {
                        openAddCoaModal(containerId);
                        e.target.value = ''; 
                    }
                });
            });

            document.querySelectorAll('.btn-post').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const txId = e.target.getAttribute('data-id');
                    const selVal = document.getElementById(`sel-${txId}`).value;
                    if (!selVal) return alert("Select a category first.");
                    e.target.textContent = "...";
                    await updateDoc(doc(db, "bankTransactions", txId), { status: 'Reviewed', postedCategoryId: selVal });
                    window.refreshBankTransactionsTable();
                });
            });

            document.querySelectorAll('.btn-split').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const txId = e.target.getAttribute('data-id');
                    const tx = currentTransactions.find(t => t.id === txId);
                    openSplitModal(tx, isCC);
                });
            });

            document.querySelectorAll('.cat-btn-undo').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const txId = e.target.getAttribute('data-id');
                    await updateDoc(doc(db, "bankTransactions", txId), { status: 'Unreviewed', postedCategoryId: null, splits: null });
                    window.refreshBankTransactionsTable();
                });
            });

        } catch (e) {
            console.error(e);
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #d9534f;">Error loading data.</div>`;
        }
    };

    // --- BATCH ACTIONS ---
    document.getElementById('bt-btnBatchPost').addEventListener('click', async () => {
        const checked = document.querySelectorAll('.bt-row-check:checked');
        for (let chk of checked) {
            const txId = chk.getAttribute('data-id');
            const sel = document.getElementById(`sel-${txId}`);
            if (sel && sel.value && sel.value !== 'ADD_NEW') {
                await updateDoc(doc(db, "bankTransactions", txId), { status: 'Reviewed', postedCategoryId: sel.value });
            }
        }
        window.refreshBankTransactionsTable();
    });

    document.getElementById('bt-btnBatchUndo').addEventListener('click', async () => {
        const checked = document.querySelectorAll('.bt-row-check:checked');
        for (let chk of checked) {
            const txId = chk.getAttribute('data-id');
            await updateDoc(doc(db, "bankTransactions", txId), { status: 'Unreviewed', postedCategoryId: null, splits: null });
        }
        window.refreshBankTransactionsTable();
    });

    document.getElementById('bt-btnBatchDelete').addEventListener('click', async () => {
        if(!confirm("Are you sure you want to permanently delete the selected transactions?")) return;
        const checked = document.querySelectorAll('.bt-row-check:checked');
        for (let chk of checked) {
            const txId = chk.getAttribute('data-id');
            await deleteDoc(doc(db, "bankTransactions", txId));
        }
        window.refreshBankTransactionsTable();
    });

    // --- SPLIT TRANSACTION MODAL ---
    const openSplitModal = (tx, isCC) => {
        let existing = document.getElementById('splitModalOverlay');
        if (existing) existing.remove();

        const typeLabel = !isCC ? (tx.foreignAmount > 0 ? 'Deposit' : 'Withdrawal') : (tx.foreignAmount > 0 ? 'CC Charge' : 'CC Credit');
        const targetAmount = Math.abs(tx.foreignAmount);

        const overlay = document.createElement('div');
        overlay.id = 'splitModalOverlay';
        overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; justify-content: center; align-items: flex-start; padding-top: 50px; overflow-y: auto;`;

        overlay.innerHTML = `
            <style>
                .sp-modal { background: #fff; width: 700px; max-width: 95%; border-radius: 4px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); padding: 30px; font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin-bottom: 50px;}
                .sp-header { display: flex; justify-content: space-between; border-bottom: 2px solid var(--primary-dark); padding-bottom: 10px; margin-bottom: 20px; }
                .sp-title { font-size: 18px; font-weight: 600; color: var(--primary-dark); }
                .sp-amt-display { font-size: 18px; font-weight: bold; color: ${tx.foreignAmount > 0 ? '#2e7d32' : '#d32f2f'}; }
                .sp-desc-box { width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 10px; font-size: 13px; font-family: inherit; resize: vertical; min-height: 60px; margin-bottom: 20px; box-sizing: border-box; }
                
                .sp-grid-wrapper { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
                .sp-grid-row { display: grid; grid-template-columns: 20px 1fr 100px 30px; gap: 5px; align-items: start; border-bottom: 1px solid #eee; padding-bottom: 8px; background: #fff; }
                .sp-grid-row.dragging { opacity: 0.5; background: #f9f9f9; }
                
                .sp-input { width: 100%; border: none; border-bottom: 1px solid #ccc; padding: 6px 0; font-size: 13px; outline: none; background: transparent; }
                .sp-input:focus { border-bottom: 2px solid var(--primary-dark); }
                .sp-handle { cursor: grab; color: #ccc; font-size: 16px; padding-top: 5px; user-select: none; }
                
                .sp-total-row { display: flex; justify-content: flex-end; font-weight: bold; font-size: 14px; padding: 10px 40px 10px 0; }
                .sp-diff-row { display: flex; justify-content: flex-end; font-size: 12px; padding: 0 40px 10px 0; }
                
                .sp-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eaedf1; padding-top: 20px; }
                
                .sp-dropdown-menu { display: none; position: absolute; right: 0; top: 100%; background: #fff; border: 1px solid #ccc; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 10; border-radius: 4px; overflow: hidden; }
                .sp-dropdown-item { padding: 8px 15px; font-size: 12px; cursor: pointer; white-space: nowrap; }
                .sp-dropdown-item:hover { background: #f4f7f9; }

                @media (max-width: 768px) {
                    .sp-grid-row { grid-template-columns: 15px 1fr 75px 25px; } /* Amount reduced by 25% */
                }
            </style>
            <div class="sp-modal">
                <div class="sp-header">
                    <div class="sp-title">Split Transaction: ${tx.date} (${typeLabel})</div>
                    <div class="sp-amt-display">${formatCurrency(targetAmount, tx.currency)}</div>
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 5px;">Bank Description: ${tx.description}</div>
                <textarea class="sp-desc-box" id="sp-customMemo" placeholder="Optional custom memo/description for this transaction..."></textarea>
                
                <div class="sp-grid-wrapper" id="sp-tbody"></div>
                
                <div class="sp-total-row">
                    <span style="margin-right: 15px;">Total Assigned:</span>
                    <span id="sp-totalAssigned" style="width: 100px; text-align: right; display: inline-block;">0.00</span>
                </div>
                <div class="sp-diff-row">
                    <span style="margin-right: 15px; color: #666;">Remaining:</span>
                    <span id="sp-difference" style="width: 100px; text-align: right; color: #d32f2f; display: inline-block;">${targetAmount.toFixed(2)}</span>
                </div>
                
                <div class="sp-footer">
                    <button class="cat-btn-split" id="sp-btnAddRow">+ Add Split Row</button>
                    <div style="display:flex; gap: 10px;">
                        <button class="cat-btn-split" id="sp-btnCancel">Cancel</button>
                        <button class="cat-btn-ok" id="sp-btnSave" style="width: auto; padding: 0 15px;">Save Split</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const tbody = document.getElementById('sp-tbody');
        const catOptions = buildCategoryDropdown('');

        const safeMathEval = (str) => {
            try {
                let sanitized = str.replace(/[^0-9+\-*/().]/g, '');
                if (!sanitized) return 0;
                let result = Function(`'use strict'; return (${sanitized})`)();
                return isNaN(result) ? 0 : Number(result);
            } catch(e) { return 0; }
        };

        const calcTotals = () => {
            let sum = 0;
            tbody.querySelectorAll('.sp-amt-input').forEach(inp => {
                let val = parseFloat(inp.value);
                if(!isNaN(val)) sum += val;
            });
            document.getElementById('sp-totalAssigned').textContent = sum.toFixed(2);
            const diff = targetAmount - sum;
            const diffEl = document.getElementById('sp-difference');
            diffEl.textContent = diff.toFixed(2);
            diffEl.style.color = Math.abs(diff) < 0.01 ? '#2e7d32' : '#d32f2f';
        };

        const createRow = () => {
            const row = document.createElement('div');
            row.className = 'sp-grid-row';
            row.draggable = true;
            row.innerHTML = `
                <div class="sp-handle">&#8942;&#8942;</div>
                <div style="display:flex; flex-direction:column;">
                    <select class="sp-input sp-cat-input">${catOptions}</select>
                    <input type="text" class="sp-input sp-desc-input" placeholder="Line description (optional)" style="display:none; margin-top:5px;">
                </div>
                <div><input type="text" class="sp-input sp-amt-input" placeholder="0.00" style="text-align: right;"></div>
                <div style="position: relative; padding-top: 5px; text-align: center;">
                    <button class="sp-menu-btn" style="background:none; border:none; cursor:pointer; font-size:18px; color:#666;">&#8942;</button>
                    <div class="sp-dropdown-menu">
                        <div class="sp-dropdown-item sp-opt-desc">Add Line Description</div>
                        <div class="sp-dropdown-item sp-opt-del" style="color: #d9534f;">Delete Row</div>
                    </div>
                </div>
            `;
            
            // Dropdown Handlers
            const menuBtn = row.querySelector('.sp-menu-btn');
            const menuDrop = row.querySelector('.sp-dropdown-menu');
            const descInput = row.querySelector('.sp-desc-input');
            const catSelect = row.querySelector('.sp-cat-input');
            
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.sp-dropdown-menu').forEach(m => { if(m !== menuDrop) m.style.display = 'none'; });
                menuDrop.style.display = menuDrop.style.display === 'block' ? 'none' : 'block';
            });

            row.querySelector('.sp-opt-desc').addEventListener('click', () => {
                descInput.style.display = 'block';
                descInput.focus();
                // Spanning effect using grid column
                descInput.parentElement.style.gridColumn = '2 / 4';
                catSelect.style.width = 'calc(100% - 105px)'; // visually adjust
                menuDrop.style.display = 'none';
            });

            row.querySelector('.sp-opt-del').addEventListener('click', () => { 
                row.remove(); 
                calcTotals(); 
            });
            
            // Math Handler
            const amtInp = row.querySelector('.sp-amt-input');
            amtInp.addEventListener('blur', (e) => {
                let val = safeMathEval(e.target.value);
                e.target.value = val ? val.toFixed(2) : '';
                calcTotals();
            });

            // Drag and Drop
            row.addEventListener('dragstart', () => row.classList.add('dragging'));
            row.addEventListener('dragend', () => row.classList.remove('dragging'));

            tbody.appendChild(row);
        };

        createRow(); createRow();

        tbody.addEventListener('dragover', e => {
            e.preventDefault();
            const draggingRow = tbody.querySelector('.dragging');
            const targetRow = e.target.closest('.sp-grid-row');
            if(targetRow && targetRow !== draggingRow) {
                const rect = targetRow.getBoundingClientRect();
                const offset = e.clientY - rect.top;
                if(offset > rect.height / 2) targetRow.after(draggingRow);
                else targetRow.before(draggingRow);
            }
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.sp-dropdown-menu').forEach(m => m.style.display = 'none');
        });

        document.getElementById('sp-btnAddRow').addEventListener('click', createRow);
        document.getElementById('sp-btnCancel').addEventListener('click', () => overlay.remove());
        
        document.getElementById('sp-btnSave').addEventListener('click', async () => {
            let sum = 0;
            let splits = [];
            let valid = true;
            
            tbody.querySelectorAll('.sp-grid-row').forEach(row => {
                const cat = row.querySelector('.sp-cat-input').value;
                const desc = row.querySelector('.sp-desc-input').value;
                const amt = parseFloat(row.querySelector('.sp-amt-input').value);
                
                if (amt && amt > 0) {
                    if (!cat || cat === 'ADD_NEW') valid = false;
                    sum += amt;
                    splits.push({ categoryId: cat, description: desc, amount: amt });
                }
            });

            if (!valid) return alert("Please select a valid category for all lines with amounts.");
            if (Math.abs(targetAmount - sum) > 0.01) return alert("The split total must exactly equal the transaction amount.");

            const btn = document.getElementById('sp-btnSave');
            btn.textContent = "Saving..."; btn.disabled = true;

            try {
                await updateDoc(doc(db, "bankTransactions", tx.id), {
                    status: 'Split',
                    postedCategoryId: 'SPLIT',
                    customMemo: document.getElementById('sp-customMemo').value.trim(),
                    splits: splits
                });
                overlay.remove();
                window.refreshBankTransactionsTable();
            } catch(e) {
                console.error(e); alert("Failed to save split.");
                btn.textContent = "Save Split"; btn.disabled = false;
            }
        });
    };

    elAccount.addEventListener('change', window.refreshBankTransactionsTable);
    elStart.addEventListener('change', window.refreshBankTransactionsTable);
    elEnd.addEventListener('change', window.refreshBankTransactionsTable);
    elSearch.addEventListener('input', window.refreshBankTransactionsTable);

    loadDependencies();
}
