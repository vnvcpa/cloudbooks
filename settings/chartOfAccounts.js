// settings/chartOfAccounts.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, query, where, getDocs, doc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getLocalSession } from "../auth/authManager.js";
import { init as openAddCoaModal } from "./addChartOfAccount.js"; // Adjust path if necessary based on your folder structure

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const session = getLocalSession();
    if (!session.companyId || session.companyId === 'null') {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #d9534f;">Please set up your company workspace first.</div>`;
        return;
    }

    // Render Dashboard Skeleton
    container.innerHTML = `
        <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
                <h1>Chart of Accounts</h1>
                <p>Manage your company's ledger accounts.</p>
            </div>
            <button id="coa-btnAddNew" style="background: var(--primary-dark); color: #fff; border: none; padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: 4px; cursor: pointer; transition: background 0.2s;">
                + Add New Account
            </button>
        </div>
        
        <div class="dashboard-card" style="padding: 0; overflow: visible;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead style="background-color: #f4f7f9; color: var(--primary-dark); border-bottom: 2px solid var(--border-color);">
                        <tr>
                            <th style="padding: 15px 20px; width: 120px;">CODE</th>
                            <th style="padding: 15px 20px;">ACCOUNT NAME</th>
                            <th style="padding: 15px 20px; width: 150px;">TYPE</th>
                            <th style="padding: 15px 20px; width: 100px;">STATUS</th>
                            <th style="padding: 15px 20px; width: 60px; text-align: center;">ACTION</th>
                        </tr>
                    </thead>
                    <tbody id="coa-tableBody">
                        <tr><td colspan="5" style="padding: 30px; text-align: center; color: #666;">Loading accounts...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const tableBody = document.getElementById('coa-tableBody');
    const btnAddNew = document.getElementById('coa-btnAddNew');

    // Bind Add Button to the external modal module
    btnAddNew.addEventListener('click', () => {
        openAddCoaModal(containerId, null);
    });

    // Expose a global refresh function so the modal can trigger a table redraw on save
    window.refreshChartOfAccountsTable = async () => {
        try {
            // 1. Filtered Query: ONLY fetch data matching this session's companyId
            const q = query(
                collection(db, "chartOfAccounts"), 
                where("companyId", "==", session.companyId)
            );
            const querySnapshot = await getDocs(q);
            
            const accounts = [];
            querySnapshot.forEach((doc) => {
                accounts.push({ id: doc.id, ...doc.data() });
            });

            // Sort by code naturally
            accounts.sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true}));

            if (accounts.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" style="padding: 30px; text-align: center; color: #666;">No accounts found. Click 'Add New Account' to start.</td></tr>`;
                return;
            }

            // Render Rows
            tableBody.innerHTML = accounts.map(acc => {
                const statusHtml = acc.isActive !== false 
                    ? `<span style="color: #5cb85c; font-weight: 500;">Active</span>` 
                    : `<span style="color: #d9534f; font-weight: 500;">Inactive</span>`;
                
                const rowStyle = acc.isActive === false ? 'opacity: 0.6; background: #fafafa;' : '';

                return `
                    <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s; ${rowStyle}">
                        <td style="padding: 15px 20px; font-weight: 600;">${acc.code}</td>
                        <td style="padding: 15px 20px; color: var(--primary-dark);">${acc.name}</td>
                        <td style="padding: 15px 20px;">${acc.type}</td>
                        <td style="padding: 15px 20px;">${statusHtml}</td>
                        <td style="padding: 15px 20px; text-align: center; position: relative;">
                            <button class="coa-btn-action" data-id="${acc.id}" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">&#8942;</button>
                            <div class="coa-row-menu" id="menu-${acc.id}" style="display: none; position: absolute; right: 40px; top: 20px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid #ccc; border-radius: 4px; z-index: 100; width: 140px; text-align: left;">
                                <div class="coa-menu-item" data-action="edit" data-id="${acc.id}" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee;">Edit</div>
                                <div class="coa-menu-item" data-action="ledger" data-id="${acc.id}" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee;">View Ledger</div>
                                <div class="coa-menu-item" data-action="toggle" data-id="${acc.id}" data-current="${acc.isActive !== false}" style="padding: 10px 15px; cursor: pointer; color: ${acc.isActive !== false ? '#d9534f' : '#5cb85c'};">
                                    ${acc.isActive !== false ? 'Make Inactive' : 'Make Active'}
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Bind Row Actions using event delegation
            tableBody.querySelectorAll('.coa-btn-action').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Close all other menus first
                    document.querySelectorAll('.coa-row-menu').forEach(m => m.style.display = 'none');
                    const id = e.target.getAttribute('data-id');
                    document.getElementById(`menu-${id}`).style.display = 'block';
                });
            });

            tableBody.querySelectorAll('.coa-menu-item').forEach(item => {
                item.addEventListener('click', async (e) => {
                    const action = e.target.getAttribute('data-action');
                    const id = e.target.getAttribute('data-id');

                    if (action === 'edit') {
                        openAddCoaModal(containerId, id);
                    } else if (action === 'ledger') {
                        if (window.handleMenuClick) window.handleMenuClick('accounting', 'ledger', { detail: { accountId: id } });
                    } else if (action === 'toggle') {
                        const currentStatus = e.target.getAttribute('data-current') === 'true';
                        try {
                            await updateDoc(doc(db, "chartOfAccounts", id), { isActive: !currentStatus });
                            window.refreshChartOfAccountsTable();
                        } catch(err) { console.error("Toggle failed", err); }
                    }
                });
            });

        } catch (error) {
            console.error("Error fetching Chart of Accounts:", error);
            tableBody.innerHTML = `<tr><td colspan="5" style="padding: 30px; text-align: center; color: #d9534f;">Error loading data. Check console.</td></tr>`;
        }
    };

    // Close dropdowns if clicked outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.coa-row-menu').forEach(m => m.style.display = 'none');
    });

    // Initial Load
    window.refreshChartOfAccountsTable();
}
