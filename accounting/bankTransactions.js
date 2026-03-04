// accounting/bankTransactions.js

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getLocalSession } from "../auth/authManager.js";
import { init as openUploadModal } from "./uploadBankTransactions.js";
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
            .bt-controls { display: flex; gap: 15px; margin-bottom: 20px; align-items: center; }
            .bt-select { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; outline: none; min-width: 200px; }
            
            /* Split Button for Header */
            .bt-split-btn { display: flex; position: relative; }
            .bt-btn-main { background: var(--primary-dark); color: #fff; border: none; padding: 10px 15px; font-size: 14px; border-radius: 4px 0 0 4px; cursor: pointer; }
            .bt-btn-arrow { background: var(--primary-dark); color: #fff; border: none; border-left: 1px solid rgba(255,255,255,0.3); padding: 10px 10px; border-radius: 0 4px 4px 0; cursor: pointer; }
            .bt-dropdown { display: none; position: absolute; top: 100%; right: 0; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 4px; border: 1px solid #eee; z-index: 100; min-width: 180px; }
            .bt-dropdown div { padding: 10px 15px; font-size: 13px; cursor: pointer; color: #333; }
            .bt-dropdown div:hover { background: #f4f7f9; color: var(--primary-dark); }
            
            /* Custom Table Layout */
            .bt-table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-radius: 6px; overflow: hidden; }
            .bt-thead { display: grid; grid-template-columns: 100px 300px 150px 150px; background: #f4f7f9; font-weight: 600; font-size: 13px; color: var(--primary-dark); border-bottom: 2px solid #eaedf1; }
            .bt-th { padding: 12px 15px; }
            
            .bt-row-group { border-bottom: 1px solid #eaedf1; transition: background 0.2s; }
            .bt-row-group:hover { background: #fafbfc; }
            .bt-row-main { display: grid; grid-template-columns: 100px 300px 150px 150px; align-items: center; }
            .bt-td { padding: 10px 15px; font-size: 14px; }
            
            /* Sub-Row for Description */
            .bt-row-sub { grid-column: 1 / -1; padding: 0 15px 12px 15px; font-size: 12px; color: #666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            
            .bt-bal-row { display: grid; grid-template-columns: 1fr 150px; background: #fcfcfc; font-weight: 600; font-size: 13px; border-bottom: 1px solid #eaedf1; }
            .bt-bal-label { padding: 12px 15px; text-align: right; color: #666; }
            
            /* Categorization Controls */
            .cat-controls { display: flex; gap: 8px; align-items: center; }
            .cat-select { flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; }
            .cat-btn-ok { background: #5cb85c; color: #fff; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 12px; font-weight: bold; }
            .cat-btn-split { background: #fff; color: #666; border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 12px; }
            .cat-btn-split:hover { background: #f0f0f0; }
            .cat-badge { font-size: 11px; padding: 3px 8px; border-radius: 12px; background: #eee; color: #555; }
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
            <select class="bt-select" id="bt-filterSort">
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
            </select>
        </div>

        <div class="bt-table">
            <div class="bt-thead">
                <div class="bt-th">DATE</div>
                <div class="bt-th">CATEGORY</div>
                <div class="bt-th" style="text-align: right;">AMOUNT</div>
                <div class="bt-th" style="text-align: right;">BALANCE</div>
            </div>
            <div id="bt-listContainer">
                <div style="padding: 40px; text-align: center; color: #666;">Select an account to view transactions.</div>
            </div>
        </div>
    `;

    const elAccount = document.getElementById('bt-filterAccount');
    const elSort = document.getElementById('bt-filterSort');
    const listContainer = document.getElementById('bt-listContainer');
    
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

    // Fetch Accounts
    const loadDependencies = async () => {
        try {
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
        return options;
    };

    window.refreshBankTransactionsTable = async () => {
        const targetAccountId = elAccount.value;
        if (!targetAccountId) {
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Select an account to view transactions.</div>`;
            return;
        }

        const isCC = bankAccountsMap[targetAccountId].type === 'Liability';
        const sortOrder = elSort.value;

        try {
            const q = query(
                collection(db, "bank_transactions"), 
                where("companyId", "==", session.companyId),
                where("bankAccountId", "==", targetAccountId)
            );
            const snap = await getDocs(q);
            
            let txs = [];
            snap.forEach(doc => { txs.push({ id: doc.id, ...doc.data() }); });

            // Sort logic - chronologically first to calculate balance accurately
            txs.sort((a, b) => new Date(a.date) - new Date(b.date));

            let runningBalance = 0;
            txs.forEach(tx => {
                runningBalance += tx.homeAmount;
                tx.calculatedBalance = runningBalance;
            });

            // If user wants newest first, reverse the array AFTER balance calculation
            if (sortOrder === 'desc') txs.reverse();

            if (txs.length === 0) {
                listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">No transactions found.</div>`;
                return;
            }

            let html = '';
            const begBalHtml = `<div class="bt-bal-row"><div class="bt-bal-label">Beginning Balance</div><div class="bt-th" style="text-align: right;">${formatCurrency(0, 'USD')}</div></div>`;
            const endBalHtml = `<div class="bt-bal-row"><div class="bt-bal-label">Ending Balance</div><div class="bt-th" style="text-align: right;">${formatCurrency(runningBalance, 'USD')}</div></div>`;

            if (sortOrder === 'asc') html += begBalHtml;
            else html += endBalHtml;

            txs.forEach(tx => {
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
                            <button class="cat-btn-ok btn-post" data-id="${tx.id}">&#10003;</button>
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

            // Bind Actions
            document.querySelectorAll('.btn-post').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const txId = e.target.getAttribute('data-id');
                    const selVal = document.getElementById(`sel-${txId}`).value;
                    if (!selVal) return alert("Select a category first.");
                    
                    e.target.textContent = "...";
                    await updateDoc(doc(db, "bank_transactions", txId), {
                        status: 'Reviewed',
                        postedCategoryId: selVal
                    });
                    window.refreshBankTransactionsTable();
                });
            });

            document.querySelectorAll('.cat-btn-undo').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const txId = e.target.getAttribute('data-id');
                    await updateDoc(doc(db, "bank_transactions", txId), {
                        status: 'Unreviewed',
                        postedCategoryId: null
                    });
                    window.refreshBankTransactionsTable();
                });
            });

        } catch (e) {
            console.error(e);
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #d9534f;">Error loading data.</div>`;
        }
    };

    elAccount.addEventListener('change', window.refreshBankTransactionsTable);
    elSort.addEventListener('change', window.refreshBankTransactionsTable);

    loadDependencies();
}
