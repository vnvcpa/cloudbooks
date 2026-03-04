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
            .bt-header h3 { margin: 0; font-size: 20px; color: var(--primary-dark); }
            .bt-header p { margin: 4px 0 0 0; font-size: 13px; color: #666; }
            
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
            .bt-table { --grid-cols: 40px 100px 1fr 120px 120px; width: 100%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-radius: 6px; overflow-x: auto; }
            .bt-table-inner { min-width: 600px; }
            .bt-thead { display: grid; grid-template-columns: var(--grid-cols); background: #f4f7f9; font-weight: 600; font-size: 12px; color: var(--primary-dark); border-bottom: 2px solid #eaedf1; position: relative; }
            .bt-th { padding: 12px 10px; display: flex; align-items: center; position: relative; }
            .bt-th-sortable { cursor: pointer; user-select: none; }
            .bt-th-sortable:hover { background: #eaedf1; }
            .bt-resizer { position: absolute; right: 0; top: 0; bottom: 0; width: 5px; cursor: col-resize; z-index: 2; }
            .bt-resizer:hover { background: rgba(0,0,0,0.1); }
            
            /* Row Colors & Hover */
            .bt-row-group { display: grid; grid-template-columns: var(--grid-cols); border-bottom: 1px solid #c0c7d0; background-color: #fff; transition: background-color 0.2s; }
            .bt-row-group:hover { background-color: #f1f8ff !important; }
            .row-reviewed { background-color: #f4fbf4; }
            .row-split { background-color: #f0f7ff; }

            .bt-cell { padding: 12px 10px; font-size: 13px; align-self: start; }
            .bt-cell-chk { grid-column: 1; grid-row: 1; text-align: center; }
            .bt-cell-date { grid-column: 2; grid-row: 1; }
            .bt-cell-cat { grid-column: 3; grid-row: 1; display: flex; align-items: flex-start; }
            .bt-cell-amt { grid-column: 4; grid-row: 1; text-align: right; }
            .bt-cell-bal { grid-column: 5; grid-row: 1; text-align: right; }
            
            /* Enhanced Sub-Row Layout */
            .bt-cell-desc { grid-column: 1 / 5; grid-row: 2; padding: 0 10px 12px 40px; font-size: 12px; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .bt-cell-acts { grid-column: 5; grid-row: 2; display: flex; justify-content: flex-end; gap: 12px; padding: 0 10px 12px 0; align-items: baseline; }
            
            .mobile-label { display: none; }
            
            /* Dashed bottom borders for posted items */
            .dashed-border { border-bottom: 1px dashed #81c784; padding-bottom: 2px; display: inline-block; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
            .bt-cell-desc .dashed-border { white-space: normal; }

            /* Perfectly Aligned Balance Row */
            .bt-bal-row { display: grid; grid-template-columns: var(--grid-cols); background: #fcfcfc; font-weight: 600; font-size: 13px; border-bottom: 1px solid #c0c7d0; }
            .bt-bal-label { grid-column: 1 / 5; padding: 12px 10px; text-align: right; color: #666; }
            .bt-bal-amt { grid-column: 5; padding: 12px 10px; text-align: right; }
            
            .cat-select { width: 100%; padding: 4px 0; border: none; border-bottom: 1px solid #ccc; border-radius: 0; font-size: 12px; background: transparent; outline: none; appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;utf8,<svg fill="black" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>'); background-repeat: no-repeat; background-position-x: 100%; background-position-y: center; background-size: 16px; padding-right: 20px; margin-top: -4px;}
            .cat-select:focus { border-bottom-color: var(--primary-dark); }
            
            /* Text Links instead of bulky buttons */
            .bt-action-link { font-weight: 600; font-size: 13px; text-decoration: none; cursor: pointer; transition: opacity 0.2s; color: var(--primary-dark); }
            .bt-action-link:hover { text-decoration: underline; opacity: 0.8; }
            .bt-action-link.post { color: #2e7d32; }
            .bt-action-link.undo { color: #999; font-size: 12px; font-weight: normal; }
            
            /* Allow Full Category Text wrapping */
            .cat-reviewed-text { font-size: 13px; font-weight: 500; color: #333; display: flex; align-items: flex-start; gap: 8px; white-space: normal; line-height: 1.3; }
            
            .txt-green { color: #2e7d32; font-weight: 500; }
            .txt-red { color: #d32f2f; font-weight: 500; }

            /* MOBILE LAYOUT overrides */
            @media (max-width: 768px) {
                .bt-table { --grid-cols: 30px 1fr 80px 80px; }
                .bt-table-inner { min-width: 100%; }
                
                .bt-th:nth-child(3) { display: none; }
                .bt-th:nth-child(4) { grid-column: 3; justify-content: flex-end; }
                .bt-th:nth-child(5) { grid-column: 4; justify-content: flex-end; }
                
                .bt-cell-chk { grid-column: 1; grid-row: 1; padding: 10px 5px; }
                .bt-cell-date { grid-column: 2; grid-row: 1; padding: 10px 5px; font-size: 12px; }
                .bt-cell-amt { grid-column: 3; grid-row: 1; padding: 10px 5px; font-size: 12px; }
                .bt-cell-bal { grid-column: 4; grid-row: 1; padding: 10px 5px; font-size: 12px; }
                
                .bt-cell-cat { grid-column: 1 / 4; grid-row: 2; padding: 2px 5px 6px 30px; display: flex; align-items: flex-start; }
                .mobile-label { display: block; font-size: 11px; color: #666; margin-right: 5px; margin-top: 1px;}
                
                .bt-cell-acts { display: contents; }
                .btn-post-wrapper { grid-column: 4; grid-row: 2; padding: 2px 5px 6px 0; display: flex; justify-content: flex-end; align-items: flex-start; }
                .btn-split-wrapper { grid-column: 4; grid-row: 3; padding: 2px 5px 12px 0; display: flex; justify-content: flex-end; align-items: flex-start; }
                
                .bt-cell-desc { grid-column: 1 / 4; grid-row: 3; padding: 2px 5px 12px 30px; }
                
                /* Perfect Mobile Balance Alignment */
                .bt-bal-label { grid-column: 1 / 4; }
                .bt-bal-amt { grid-column: 4; }
            }
        </style>

        <div class="bt-header">
            <div>
                <h3>Bank Transactions</h3>
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
            <button class="bt-action-link post" id="bt-btnBatchPost" style="border:1px solid #ccc; padding:4px 8px;">Post Selected</button>
            <button class="bt-action-link undo" id="bt-btnBatchUndo">Undo Selected</button>
            <button class="bt-action-link undo" id="bt-btnBatchDelete" style="color: #d32f2f;">Delete Selected</button>
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

    const initResizer = () => {
        const table = document.querySelector('.bt-table');
        const headers = table.querySelectorAll('.bt-th');
        let isMobile = window.innerWidth <= 768;
        let colWidths = isMobile ? [30, 80, 200, 80, 80] : [40, 100, 350, 120, 120];

        headers.forEach((th, i) => {
            const resizer = th.querySelector('.bt-resizer');
            if (!resizer) return;
            let startX, startWidth;
            resizer.addEventListener('mousedown', (e) => {
                startX = e.pageX;
                startWidth = colWidths[i];
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
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    };
    initResizer();

    const primaryBtn = document.getElementById('bt-btnPrimaryDropdown');
    const primaryMenu = document.getElementById('bt-primaryMenu');
    primaryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        primaryMenu.style.display = primaryMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => primaryMenu.style.display = 'none');
    document.getElementById('bt-optUpload').addEventListener('click', () => openUploadModal(containerId));

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
            const isSelected = selectedCatId === acc.id ? 'selected' : '';
            options += `<option value="${acc.id}" ${isSelected}>${acc.code} - ${acc.name}</option>`;
        });
        options += `<option value="ADD_NEW" style="font-weight: bold; color: var(--primary-dark);">+ Add New Account</option>`;
        return options;
    };

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

    window.refreshBankTransactionsTable = async () => {
        const targetAccountId = elAccount.value;
        if (!targetAccountId) {
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Select an account to view transactions.</div>`;
            batchBar.style.display = 'none';
            selectAll.checked = false;
            return;
        }

        const isCC = bankAccountsMap[targetAccountId].type === 'Liability';
        const startStr = elStart.value; 
        const endStr = elEnd.value;
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
            allTxs.sort((a, b) => new Date(a.date) - new Date(b.date));

            let runningBalance = 0;
            let displayTxs = [];
            let beginningBalance = 0;

            allTxs.forEach(tx => {
                if (startStr && tx.date < startStr) {
                    runningBalance += tx.foreignAmount;
                    beginningBalance = runningBalance;
                } else {
                    runningBalance += tx.foreignAmount;
                    tx.calculatedBalance = runningBalance;
                    
                    if (endStr && tx.date > endStr) return;

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
                let amountClass = '';
                
                if (!isCC) {
                    amountClass = tx.foreignAmount > 0 ? 'txt-green' : 'txt-red';
                } else {
                    amountClass = tx.foreignAmount > 0 ? 'txt-red' : 'txt-green';
                }

                let catHtml = '';
                let actionHtmlPost = '';
                let actionHtmlSplit = '';
                let statusClass = '';
                let dashedClass = tx.status !== 'Unreviewed' ? 'dashed-border' : '';

                if (tx.status === 'Unreviewed') {
                    let defCatId = tx.postedCategoryId;
                    if(!defCatId) {
                        const matchedCat = chartOfAccounts.find(c => c.name === tx.suggestedCategory);
                        defCatId = matchedCat ? matchedCat.id : "";
                    }
                    catHtml = `<select class="cat-select" id="sel-${tx.id}">${buildCategoryDropdown(defCatId)}</select>`;
                    actionHtmlPost = `<a href="#" class="bt-action-link post btn-post" data-id="${tx.id}">Post</a>`;
                    actionHtmlSplit = `<a href="#" class="bt-action-link btn-split" data-id="${tx.id}">Split</a>`;
                } else if (tx.status === 'Split') {
                    statusClass = 'row-split';
                    catHtml = `
                        <div class="cat-reviewed-text">
                            <span style="color: #2e7d32;">&#10003;</span> 
                            <span class="${dashedClass}">Split (${tx.splits ? tx.splits.length : 0})</span>
                        </div>`;
                    actionHtmlPost = `<a href="#" class="bt-action-link undo cat-btn-undo" data-id="${tx.id}">Undo</a>`;
                } else {
                    statusClass = 'row-reviewed';
                    const postedName = chartOfAccounts.find(c => c.id === tx.postedCategoryId)?.name || 'Categorized';
                    catHtml = `
                        <div class="cat-reviewed-text">
                            <span style="color: #2e7d32;">&#10003;</span> 
                            <span class="${dashedClass}">${postedName}</span>
                        </div>`;
                    actionHtmlPost = `<a href="#" class="bt-action-link undo cat-btn-undo" data-id="${tx.id}">Undo</a>`;
                }

                html += `
                    <div class="bt-row-group ${statusClass}">
                        <div class="bt-cell bt-cell-chk"><input type="checkbox" class="bt-row-check" data-id="${tx.id}"></div>
                        <div class="bt-cell bt-cell-date"><span class="${dashedClass}">${tx.date}</span></div>
                        <div class="bt-cell bt-cell-cat">
                            <div style="flex:1;">${catHtml}</div>
                        </div>
                        <div class="bt-cell bt-cell-amt ${amountClass}">
                            <span class="${dashedClass}">${formatCurrency(Math.abs(tx.foreignAmount), tx.currency)}</span>
                        </div>
                        <div class="bt-cell bt-cell-bal"><span class="${dashedClass}">${formatCurrency(tx.calculatedBalance, tx.currency)}</span></div>
                        
                        <div class="bt-cell-desc"><span class="${dashedClass}">${tx.description} ${tx.checkNo ? '(Ref: ' + tx.checkNo + ')' : ''}</span></div>
                        <div class="bt-cell-acts">
                            <div class="btn-post-wrapper">${actionHtmlPost}</div>
                            <div class="btn-split-wrapper">${actionHtmlSplit}</div>
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

            // Prevent default href jumping on link clicks
            document.querySelectorAll('.btn-post').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const txId = e.target.getAttribute('data-id');
                    const selVal = document.getElementById(`sel-${txId}`).value;
                    if (!selVal) return alert("Select a category first.");
                    e.target.textContent = "Saving...";
                    await updateDoc(doc(db, "bankTransactions", txId), { status: 'Reviewed', postedCategoryId: selVal });
                    window.refreshBankTransactionsTable();
                });
            });

            document.querySelectorAll('.btn-split').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const txId = e.target.getAttribute('data-id');
                    const tx = currentTransactions.find(t => t.id === txId);
                    openSplitModal(tx, isCC);
                });
            });

            document.querySelectorAll('.cat-btn-undo').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const txId = e.target.getAttribute('data-id');
                    e.target.textContent = "Undo...";
                    await updateDoc(doc(db, "bankTransactions", txId), { status: 'Unreviewed', postedCategoryId: null, splits: null });
                    window.refreshBankTransactionsTable();
                });
            });

        } catch (e) {
            console.error(e);
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #d9534f;">Error loading data.</div>`;
        }
    };

    document.getElementById('bt-btnBatchPost').addEventListener('click', async (e) => {
        e.preventDefault();
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

    document.getElementById('bt-btnBatchUndo').addEventListener('click', async (e) => {
        e.preventDefault();
        const checked = document.querySelectorAll('.bt-row-check:checked');
        for (let chk of checked) {
            const txId = chk.getAttribute('data-id');
            await updateDoc(doc(db, "bankTransactions", txId), { status: 'Unreviewed', postedCategoryId: null, splits: null });
        }
        window.refreshBankTransactionsTable();
    });

    document.getElementById('bt-btnBatchDelete').addEventListener('click', async (e) => {
        e.preventDefault();
        if(!confirm("Are you sure you want to permanently delete the selected transactions?")) return;
        const checked = document.querySelectorAll('.bt-row-check:checked');
        for (let chk of checked) {
            const txId = chk.getAttribute('data-id');
            await deleteDoc(doc(db, "bankTransactions", txId));
        }
        window.refreshBankTransactionsTable();
    });

    // --- SPLIT TRANSACTION MODAL (Untouched from previous iteration) ---
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
                
                .sp-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .sp-th { text-align: left; font-size: 12px; color: #666; padding-bottom: 5px; border-bottom: 1px solid #ccc; }
                
                .sp-row-group { background: #fff; }
                .sp-row-group.dragging { opacity: 0.5; background: #f9f9f9; }
                
                .sp-cell { padding: 8px 5px; vertical-align: top; }
                .sp-input { width: 100%; border: none; border-bottom: 1px solid #ccc; padding: 6px 0; font-size: 13px; outline: none; background: transparent; }
                .sp-input:focus { border-bottom: 2px solid var(--primary-dark); }
                .sp-amt-input { width: 120px; text-align: right; }
                
                .sp-desc-input { display: none; width: 100%; resize: none; font-size: 12px; color: #555; padding: 4px 0; border: none; border-bottom: 1px solid #ccc; outline: none; background: transparent; font-family: inherit; }
                .sp-desc-input:focus { border-bottom-color: var(--primary-dark); }
                
                .sp-handle { cursor: grab; color: #ccc; font-size: 16px; padding-right: 5px; user-select: none; }
                
                .sp-menu-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; padding: 0 5px; }
                .sp-menu-dropdown { display: none; position: absolute; right: 10px; top: 30px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 1px solid #ccc; border-radius: 4px; z-index: 10; width: 140px; text-align: left; }
                .sp-menu-item { padding: 10px 12px; font-size: 12px; cursor: pointer; border-bottom: 1px solid #eee; }
                .sp-menu-item:hover { background: #f4f7f9; }
                
                .sp-total-row { font-weight: bold; font-size: 14px; text-align: right; padding: 15px 5px; }
                .sp-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eaedf1; padding-top: 20px; }

                @media (max-width: 768px) {
                    .sp-amt-input { width: 85px; } 
                }
            </style>
            <div class="sp-modal" id="sp-modalBox">
                <div class="sp-header">
                    <div class="sp-title">Split Transaction: ${tx.date} (${typeLabel})</div>
                    <div class="sp-amt-display">${formatCurrency(targetAmount, tx.currency)}</div>
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 5px;">Bank Description: ${tx.description}</div>
                <textarea class="sp-desc-box" id="sp-customMemo" placeholder="Optional custom memo/description for this transaction..."></textarea>
                
                <table class="sp-table" id="sp-table-main">
                    <thead>
                        <tr><th style="width:20px;"></th><th class="sp-th">Category</th><th class="sp-th" style="text-align: right;">Amount</th><th style="width:30px;"></th></tr>
                    </thead>
                    <tfoot id="sp-tfoot">
                        <tr>
                            <td colspan="2" class="sp-total-row">Total Assigned:</td>
                            <td class="sp-total-row" id="sp-totalAssigned">0.00</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2" style="text-align: right; font-size: 12px; color: #666; padding-right: 5px;">Remaining:</td>
                            <td style="font-size: 12px; color: #d32f2f; text-align: right; padding: 0 5px;" id="sp-difference">${targetAmount.toFixed(2)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
                
                <div class="sp-footer">
                    <button class="bt-btn-main" id="sp-btnAddRow" style="background:#fff; color:#666; border:1px solid #ccc; font-size:12px; padding:6px 10px;">+ Add Split Row</button>
                    <div style="display:flex; gap: 10px;">
                        <button class="bt-action-link undo" id="sp-btnCancel">Cancel</button>
                        <button class="bt-btn-main" id="sp-btnSave" style="background:#5cb85c; padding:6px 15px;">Save Split</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const spTable = document.getElementById('sp-table-main');
        const tfoot = document.getElementById('sp-tfoot');
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
            spTable.querySelectorAll('.sp-amt-input').forEach(inp => {
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
            const tbodyGroup = document.createElement('tbody');
            tbodyGroup.className = 'sp-row-group';
            tbodyGroup.draggable = true;
            tbodyGroup.innerHTML = `
                <tr class="sp-row">
                    <td class="sp-cell" style="padding-top:12px;"><span class="sp-handle">&#8942;&#8942;</span></td>
                    <td class="sp-cell">
                        <select class="sp-input sp-cat-input">${catOptions}</select>
                    </td>
                    <td class="sp-cell" style="text-align: right;">
                        <input type="text" class="sp-input sp-amt-input" placeholder="0.00">
                    </td>
                    <td class="sp-cell" style="text-align: center; position: relative;">
                        <button class="sp-menu-btn">&#8942;</button>
                        <div class="sp-menu-dropdown">
                            <div class="sp-menu-item toggle-desc">Add Description</div>
                            <div class="sp-menu-item del-row" style="color:#d32f2f;">Delete Row</div>
                        </div>
                    </td>
                </tr>
                <tr class="sp-desc-row" style="display:none;">
                    <td></td>
                    <td colspan="2" style="padding: 0 5px 10px 5px;">
                        <textarea class="sp-desc-input" rows="2" placeholder="Line description..."></textarea>
                    </td>
                    <td></td>
                </tr>
            `;
            
            const amtInp = tbodyGroup.querySelector('.sp-amt-input');
            amtInp.addEventListener('blur', (e) => {
                let val = safeMathEval(e.target.value);
                e.target.value = val ? val.toFixed(2) : '';
                calcTotals();
            });

            tbodyGroup.addEventListener('dragstart', () => tbodyGroup.classList.add('dragging'));
            tbodyGroup.addEventListener('dragend', () => tbodyGroup.classList.remove('dragging'));

            spTable.insertBefore(tbodyGroup, tfoot);
        };

        createRow(); createRow();

        spTable.addEventListener('dragover', e => {
            e.preventDefault();
            const draggingGroup = document.querySelector('.sp-row-group.dragging');
            if(!draggingGroup) return;
            const targetGroup = e.target.closest('.sp-row-group');
            if(targetGroup && targetGroup !== draggingGroup) {
                const rect = targetGroup.getBoundingClientRect();
                const offset = e.clientY - rect.top;
                if(offset > rect.height / 2) targetGroup.after(draggingGroup);
                else targetGroup.before(draggingGroup);
            }
        });

        document.getElementById('sp-modalBox').addEventListener('click', (e) => {
            document.querySelectorAll('.sp-menu-dropdown').forEach(m => {
                if (m !== e.target.nextElementSibling) m.style.display = 'none';
            });

            if (e.target.classList.contains('sp-menu-btn')) {
                const menu = e.target.nextElementSibling;
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }

            if (e.target.classList.contains('toggle-desc')) {
                const group = e.target.closest('.sp-row-group');
                const descRow = group.querySelector('.sp-desc-row');
                const descInput = group.querySelector('.sp-desc-input');
                
                if (descRow.style.display === 'table-row') {
                    if (descInput.value.trim() !== '') {
                        alert("Please clear the text before hiding the description box.");
                    } else {
                        descRow.style.display = 'none';
                        descInput.style.display = 'none';
                        e.target.textContent = 'Add Description';
                    }
                } else {
                    descRow.style.display = 'table-row';
                    descInput.style.display = 'block';
                    descInput.focus();
                    e.target.textContent = 'Hide Description';
                }
                e.target.parentElement.style.display = 'none';
            }

            if (e.target.classList.contains('del-row')) {
                e.target.closest('.sp-row-group').remove();
                calcTotals();
            }
        });

        document.getElementById('sp-btnAddRow').addEventListener('click', createRow);
        document.getElementById('sp-btnCancel').addEventListener('click', (e) => { e.preventDefault(); overlay.remove(); });
        
        document.getElementById('sp-btnSave').addEventListener('click', async (e) => {
            e.preventDefault();
            let sum = 0;
            let splits = [];
            let valid = true;
            
            spTable.querySelectorAll('.sp-row-group').forEach(group => {
                const cat = group.querySelector('.sp-cat-input').value;
                const desc = group.querySelector('.sp-desc-input').value.trim();
                const amt = parseFloat(group.querySelector('.sp-amt-input').value);
                
                if (amt && amt > 0) {
                    if (!cat || cat === 'ADD_NEW') valid = false;
                    sum += amt;
                    splits.push({ categoryId: cat, description: desc, amount: amt });
                }
            });

            if (!valid) return alert("Please select a valid category for all lines with amounts.");
            if (Math.abs(targetAmount - sum) > 0.01) return alert("The split total must equal the transaction amount.");

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
            } catch(err) {
                console.error(err); alert("Failed to save split.");
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
