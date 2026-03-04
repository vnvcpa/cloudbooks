import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getLocalSession } from '../auth/authManager.js';

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook",
    storageBucket: "vnvcloudbook.firebasestorage.app"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

let currentSortOrder = 'asc'; 
let allTransactions = [];

const buildCategoryDropdown = (selectedCat) => {
    return `
        <select class="category-select">
            <option value="Uncategorized Income" ${selectedCat === 'Uncategorized Income' ? 'selected' : ''}>Uncategorized Income</option>
            <option value="Uncategorized Expense" ${selectedCat === 'Uncategorized Expense' ? 'selected' : ''}>Uncategorized Expense</option>
            <option value="Uncategorized Charges" ${selectedCat === 'Uncategorized Charges' ? 'selected' : ''}>Uncategorized Charges</option>
            <option value="Uncategorized Credit" ${selectedCat === 'Uncategorized Credit' ? 'selected' : ''}>Uncategorized Credit</option>
            <option value="Meals and Entertainment" ${selectedCat === 'Meals and Entertainment' ? 'selected' : ''}>Meals and Entertainment</option>
            <option value="Office Supplies" ${selectedCat === 'Office Supplies' ? 'selected' : ''}>Office Supplies</option>
            <option disabled>──────────</option>
            <option value="ADD_NEW_ACCOUNT">+ Add New Account</option>
        </select>
    `;
};

async function getBeginningBalance(companyId, accountId, startDate) {
    const q = query(
        collection(db, "bankTransactions"),
        where("companyId", "==", companyId),
        where("accountId", "==", accountId),
        where("date", "<", startDate)
    );
    const snap = await getDocs(q);
    let begBal = 0;
    snap.forEach(doc => {
        begBal += parseFloat(doc.data().amount || 0);
    });
    return begBal;
}

export async function init(containerId, entityId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="dashboard-container">
            <div class="header-actions" style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <h2>Bank Transactions</h2>
                <div class="dropdown">
                    <button class="btn-primary" id="btnMainActions">Manage Transactions ▼</button>
                    <div class="dropdown-content" style="display: none; position: absolute; background: white; border: 1px solid #ccc; z-index: 1000;">
                        <a href="#" id="actManualDep">Add Manual Deposit</a>
                        <a href="#" id="actManualWith">Add Manual Withdrawal</a>
                        <a href="#" id="actCCCharge">Add CC Charge</a>
                        <a href="#" id="actCCCredit">Add CC Credit</a>
                        <a href="#" id="actUpload">Upload Transactions</a>
                        <a href="#" id="actConnect">Connect Bank</a>
                    </div>
                </div>
            </div>

            <div class="filter-bar" style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                <input type="date" id="filterStartDate" class="line-input" value="2026-01-01">
                <input type="date" id="filterEndDate" class="line-input" value="2026-12-31">
                <input type="text" id="searchInput" class="line-input" placeholder="Search by date, description, or amount..." style="flex-grow: 1;">
                <button class="btn-secondary" id="btnApplyFilters">Apply</button>
            </div>

            <div class="batch-actions" style="margin-bottom: 10px;">
                <button class="btn-secondary" id="btnBatchDelete">Delete Selected</button>
                <button class="btn-secondary" id="btnBatchPost">Post Selected</button>
                <button class="btn-secondary" id="btnBatchUndo">Undo Posted</button>
            </div>

            <table class="elegant-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #ccc; text-align: left;">
                        <th style="width: 5%;"><input type="checkbox" id="selectAll"></th>
                        <th id="thDate" style="cursor: pointer; width: 15%;">Date <span id="sortIcon">▲</span></th>
                        <th style="width: 30%;">Category</th>
                        <th style="width: 20%; text-align: right;">Amount</th>
                        <th style="width: 20%; text-align: right;">Balance</th>
                        <th style="width: 10%;">Action</th>
                    </tr>
                </thead>
                <tbody id="transactionsBody">
                    </tbody>
            </table>
        </div>
    `;

    document.getElementById('btnMainActions').addEventListener('click', (e) => {
        const content = e.target.nextElementSibling;
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('actUpload').addEventListener('click', (e) => {
        e.preventDefault();
        import('./uploadBankTransactions.js').then(module => module.init('modalContainer'));
        document.querySelector('.dropdown-content').style.display = 'none';
    });

    document.getElementById('thDate').addEventListener('click', () => {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
        document.getElementById('sortIcon').innerText = currentSortOrder === 'asc' ? '▲' : '▼';
        renderTable();
    });

    document.getElementById('selectAll').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });

    document.getElementById('btnApplyFilters').addEventListener('click', fetchData);
    document.getElementById('searchInput').addEventListener('input', renderTable);

    document.getElementById('btnBatchDelete').addEventListener('click', async () => {
        await handleBatchAction('delete');
    });
    document.getElementById('btnBatchPost').addEventListener('click', async () => {
        await handleBatchAction('post');
    });
    document.getElementById('btnBatchUndo').addEventListener('click', async () => {
        await handleBatchAction('undo');
    });

    await fetchData();
}

async function handleBatchAction(actionType) {
    const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id);
    if (selectedIds.length === 0) {
        alert("Please select at least one transaction.");
        return;
    }

    for (const id of selectedIds) {
        const docRef = doc(db, "bankTransactions", id);
        if (actionType === 'delete') {
            await deleteDoc(docRef);
        } else if (actionType === 'post') {
            await updateDoc(docRef, { status: 'Posted' });
        } else if (actionType === 'undo') {
            await updateDoc(docRef, { status: 'Unreviewed' });
        }
    }
    await fetchData();
}

async function fetchData() {
    const session = getLocalSession();
    if (!session) return;

    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const accountId = 'acc_101'; 

    const q = query(
        collection(db, "bankTransactions"),
        where("companyId", "==", session.companyId),
        where("accountId", "==", accountId),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
    );

    const snapshot = await getDocs(q);
    allTransactions = [];
    snapshot.forEach(doc => {
        allTransactions.push({ id: doc.id, ...doc.data() });
    });

    const begBal = await getBeginningBalance(session.companyId, accountId, startDate);
    renderTable(begBal, startDate, endDate);
}

function renderTable(begBal = 0, startDate, endDate) {
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = '';
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    let filtered = allTransactions.filter(t => 
        (t.description || "").toLowerCase().includes(searchTerm) ||
        (t.date || "").includes(searchTerm) ||
        (t.amount || "").toString().includes(searchTerm)
    );

    filtered.sort((a, b) => currentSortOrder === 'asc' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date));

    let runningBalance = begBal;

    const createBegBalRow = () => `
        <tr style="background-color: #f9f9f9; font-weight: bold;">
            <td></td>
            <td>${startDate || ''}</td>
            <td colspan="2">Beginning Balance</td>
            <td style="text-align: right;">${begBal.toFixed(2)}</td>
            <td></td>
        </tr>
    `;

    if (currentSortOrder === 'asc') tbody.innerHTML += createBegBalRow();

    filtered.forEach(t => {
        runningBalance += parseFloat(t.amount);
        
        let actionsHtml = t.status === 'Posted' 
            ? `<span style="color: green;">Posted</span>`
            : `<button class="btn-post" title="Post Transaction to General Ledger" data-id="${t.id}">Post</button>
               <button class="btn-split" data-id="${t.id}">Split</button>`;

        const trMain = document.createElement('tr');
        trMain.style.borderTop = "1px solid #eee";
        trMain.innerHTML = `
            <td><input type="checkbox" class="row-checkbox" data-id="${t.id}"></td>
            <td>${t.date}</td>
            <td>${buildCategoryDropdown(t.category)}</td>
            <td style="text-align: right; color: ${t.amount < 0 ? 'red' : 'black'};">${parseFloat(t.amount).toFixed(2)}</td>
            <td style="text-align: right;">${runningBalance.toFixed(2)}</td>
            <td>${actionsHtml}</td>
        `;

        const trSub = document.createElement('tr');
        trSub.style.borderBottom = "1px solid #ccc";
        trSub.innerHTML = `
            <td></td>
            <td colspan="4" style="font-size: 0.9em; color: #555; padding-bottom: 10px; white-space: normal; word-wrap: break-word; max-height: 2.4em; overflow: hidden;">
                Description: ${t.description}
            </td>
            <td></td>
        `;

        tbody.appendChild(trMain);
        tbody.appendChild(trSub);
    });

    const createEndBalRow = () => `
        <tr style="background-color: #f9f9f9; font-weight: bold; border-top: 2px solid #ccc;">
            <td></td>
            <td>${endDate || ''}</td>
            <td colspan="2">Ending Balance</td>
            <td style="text-align: right;">${runningBalance.toFixed(2)}</td>
            <td></td>
        </tr>
    `;

    if (currentSortOrder === 'asc') {
        tbody.innerHTML += createEndBalRow();
    } else {
        tbody.insertAdjacentHTML('afterbegin', createEndBalRow());
        tbody.innerHTML += createBegBalRow();
    }

    document.querySelectorAll('.category-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            if (e.target.value === 'ADD_NEW_ACCOUNT') {
                alert('Open Add Account Modal');
                e.target.value = "Uncategorized Expense"; 
            }
        });
    });
}
