// bankClearing/bankTransactions.js
import { ledgerAdapter, authAdapter, storageAdapter } from './adapters.js';

// ==========================================
// 1. CORE ENGINE & STATE MANAGEMENT
// ==========================================

const state = {
    transactions: new Map(),
    matches: new Map(),
    events: [], // Event sourcing logs
    listeners: { onStateChange: [], onError: [], onProgress: [] }
};

const notify = (event, payload) => state.listeners[event].forEach(cb => cb(payload));

export const hooks = {
    onStateChange: (cb) => state.listeners.onStateChange.push(cb),
    onError: (cb) => state.listeners.onError.push(cb),
    onProgress: (cb) => state.listeners.onProgress.push(cb),
};

export function _loadTransactions(txList) {
    txList.forEach(tx => state.transactions.set(tx.id, tx));
    notify('onStateChange', { action: 'loaded', count: txList.length });
}

export function listTransactions(filter = {}, paging = { limit: 50, offset: 0 }) {
    let txs = Array.from(state.transactions.values());
    if (filter.status) txs = txs.filter(tx => tx.status === filter.status);
    return txs.slice(paging.offset, paging.offset + paging.limit);
}

export function getTransaction(txId) {
    return state.transactions.get(txId);
}

/**
 * Explainable Matching Engine
 */
export async function runMatcher(txId) {
    const tx = state.transactions.get(txId);
    if (!tx) throw new Error("Transaction not found");

    const historical = await ledgerAdapter.getHistoricalTransactions();
    let bestMatch = null;
    let highestScore = 0;
    let explanation = [];

    historical.forEach(ledgerTx => {
        let score = 0;
        let reasons = [];

        if (Math.abs(tx.amount) === Math.abs(ledgerTx.amount)) {
            score += 50;
            reasons.push("amount exact");
        }
        if (tx.rawDescription.toLowerCase().includes(ledgerTx.payee.toLowerCase())) {
            score += 30;
            reasons.push(`fuzzy payee (~${ledgerTx.payee})`);
        }
        if (ledgerTx.invoice && tx.rawDescription.includes(ledgerTx.invoice)) {
            score += 20;
            reasons.push(`invoice # matched`);
        }

        if (score > highestScore) {
            highestScore = score;
            explanation = reasons;
            bestMatch = ledgerTx;
        }
    });

    const result = bestMatch ? {
        ledgerId: bestMatch.ledgerId,
        confidence: highestScore,
        explanation: explanation.join('; ')
    } : { confidence: 0, explanation: "No historical match found." };

    state.matches.set(txId, result);
    return result;
}

export function matchTransaction(txId, ledgerId, { userId }) {
    const event = { id: `m_${Date.now()}`, type: 'MATCH', txId, ledgerId, userId, timestamp: new Date() };
    state.events.push(event);
    state.matches.set(txId, { ledgerId, confidence: 100, explanation: "Manually Matched" });
    notify('onStateChange', { action: 'matched', txId });
    return event;
}

export async function submitForReview(batchIds, { userId, comment }) {
    batchIds.forEach(id => {
        const tx = state.transactions.get(id);
        if (tx) tx.status = 'pending_review';
    });
    state.events.push({ type: 'SUBMIT_REVIEW', batchIds, userId, comment, timestamp: new Date() });
    notify('onStateChange', { action: 'submitted', batchIds });
}

export async function approve(batchIds, { userId, comment }) {
    const user = await authAdapter.getUser(userId);
    if (!authAdapter.canApprove(user, 'approve_tx')) {
        notify('onError', { message: 'Unauthorized approval attempt.' });
        throw new Error("Unauthorized");
    }

    batchIds.forEach(id => {
        const tx = state.transactions.get(id);
        if (tx) tx.status = 'approved';
    });
    state.events.push({ type: 'APPROVED', batchIds, userId, comment, timestamp: new Date() });
    notify('onStateChange', { action: 'approved', batchIds });
}

export async function postTransaction(txId, { userId, dryRun = false }) {
    const tx = state.transactions.get(txId);
    // Auto-approve for manual posting in this simplified demo flow
    if (tx.status === 'draft') tx.status = 'approved'; 
    
    if (tx.status !== 'approved') throw new Error("Transaction must be approved before posting.");
    
    if (dryRun) return dryRunApply([txId]);

    const ledgerResponse = await ledgerAdapter.post(tx);
    tx.status = 'posted';
    const event = { type: 'POSTED', txId, ledgerResponse, userId, timestamp: new Date() };
    state.events.push(event);
    notify('onStateChange', { action: 'posted', txId });
    return event;
}

/**
 * Creates a brand new ledger transaction based on a bank feed item.
 */
export async function createTransactionFromBank(txId, txType, { userId }) {
    const tx = state.transactions.get(txId);
    if (!tx) throw new Error("Transaction not found");

    // In a real app, this creates a record in your DB. Here we mock a ledger ID.
    const newLedgerId = `L_NEW_${Date.now()}`;
    const event = { type: 'CREATE_TX', txId, newLedgerId, txType, userId, timestamp: new Date() };
    state.events.push(event);
    
    // Automatically match the bank tx to this newly created ledger item
    matchTransaction(txId, newLedgerId, { userId });
    
    return newLedgerId;
}

export function dryRunApply(txIds) {
    let mockBalanceImpact = 0;
    const diff = txIds.map(id => {
        const tx = state.transactions.get(id);
        mockBalanceImpact += tx.amount;
        return { txId: id, action: 'would_post', impact: tx.amount };
    });

    return { isDryRun: true, totalBalanceImpact: mockBalanceImpact, diff };
}

export function getAnomalyQueue({ limit = 10 }) {
    const anomalies = Array.from(state.transactions.values()).map(tx => {
        let riskScore = 0;
        let reasons = [];
        if (Math.abs(tx.amount) > 2000) { riskScore += 60; reasons.push("High amount deviation"); }
        if (tx.ocrConfidence < 90) { riskScore += 30; reasons.push("Low OCR confidence"); }
        return { tx, riskScore, reasons };
    });
    return anomalies.filter(a => a.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
}


// ==========================================
// 2. UI INITIALIZATION & DASHBOARD RENDERER
// ==========================================

export function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Render the base dashboard HTML
    container.innerHTML = `
        <div class="dashboard-header">
            <h1>Bank Transactions Clearing</h1>
            <p>Upload, review, match, and post bank feeds to the general ledger.</p>
        </div>
        
        <div class="dashboard-card" style="text-align: left; padding: 20px 30px;">
            <div style="display: flex; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 20px;">
                <button id="bt-btnLoadMock" style="background: var(--primary-dark); color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;">Load Sample Data</button>
                <button id="bt-btnRunMatch" style="background: var(--bg-app); border: 1px solid var(--primary-dark); color: var(--primary-dark); padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;">Auto-Match Engine</button>
                <button id="bt-btnAnomalies" style="background: transparent; border: 1px solid #d9534f; color: #d9534f; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;">View Anomaly Queue</button>
            </div>
            
            <div id="bt-statusArea" style="margin-bottom: 20px; font-size: 14px; font-weight: 500; color: var(--text-muted);">
                System ready. Waiting for transactions...
            </div>
            
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--primary-dark);">
                            <th style="padding: 10px 8px;">Date</th>
                            <th style="padding: 10px 8px;">Description</th>
                            <th style="padding: 10px 8px;">Amount</th>
                            <th style="padding: 10px 8px;">Match Status</th>
                            <th style="padding: 10px 8px;">State</th>
                            <th style="padding: 10px 8px;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="bt-tableBody">
                        <tr><td colspan="6" style="padding: 20px; text-align: center; color: #999;">No data loaded</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const btnLoadMock = document.getElementById('bt-btnLoadMock');
    const btnRunMatch = document.getElementById('bt-btnRunMatch');
    const btnAnomalies = document.getElementById('bt-btnAnomalies');
    const statusArea = document.getElementById('bt-statusArea');
    const tableBody = document.getElementById('bt-tableBody');

    // UI Helper: Render the transaction table
    const renderTable = () => {
        const txs = listTransactions();
        if (txs.length === 0) return;

        tableBody.innerHTML = txs.map(tx => {
            const match = state.matches.get(tx.id);
            let matchHtml = `<span style="color: #999;">Unmatched</span>`;
            
            if (match) {
                const color = match.confidence > 80 ? 'green' : (match.confidence > 0 ? 'orange' : 'red');
                matchHtml = `
                    <div style="color: ${color}; font-weight: 600;">Score: ${match.confidence}%</div>
                    <div style="font-size: 11px; color: #666;">${match.explanation}</div>
                `;
            }
            
            const stateColor = tx.status === 'posted' ? 'green' : (tx.status === 'pending_review' ? 'orange' : 'var(--text-muted)');

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px 8px;">${tx.date}</td>
                    <td style="padding: 12px 8px;">${tx.rawDescription}</td>
                    <td style="padding: 12px 8px; font-family: monospace;">$${tx.amount.toFixed(2)}</td>
                    <td style="padding: 12px 8px;">${matchHtml}</td>
                    <td style="padding: 12px 8px; color: ${stateColor}; font-weight: 500;">${tx.status.toUpperCase()}</td>
                    <td style="padding: 12px 8px;">
                        ${tx.status !== 'posted' 
                            ? `<button class="bt-btn-review" data-id="${tx.id}" style="background: transparent; border: none; color: var(--accent); cursor: pointer; font-size: 13px; font-weight: bold;">Review</button>` 
                            : `<span style="color: green;">✓ Done</span>`
                        }
                    </td>
                </tr>
            `;
        }).join('');

        // Attach listeners to newly created Review buttons
        document.querySelectorAll('.bt-btn-review').forEach(btn => {
            btn.addEventListener('click', (e) => openReviewModal(e.target.getAttribute('data-id')));
        });
    };

    // UI Hook: Listen to core engine state changes
    hooks.onStateChange((payload) => {
        statusArea.innerText = `Last Action: ${payload.action.toUpperCase()} - Updated UI successfully.`;
        renderTable();
    });

    // ---------------------------------------------------------
    // REVIEW MODAL LOGIC
    // ---------------------------------------------------------
    const openReviewModal = (txId) => {
        const tx = getTransaction(txId);
        const matchInfo = state.matches.get(txId);
        
        let existing = document.getElementById('reviewTxOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'reviewTxOverlay';
        overlay.style.cssText = `
            position: fixed; top: var(--header-height); left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.4); z-index: 1001; display: flex;
            justify-content: center; align-items: flex-start; padding-top: 30px; overflow-y: auto;
        `;

        overlay.innerHTML = `
            <style>
                .rv-modal { background: #fff; width: 600px; max-width: 95%; border-radius: 4px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); padding: 30px 40px; font-family: 'Segoe UI', Arial, sans-serif; color: #000; }
                .rv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--primary-dark); padding-bottom: 10px; }
                .rv-header h2 { margin: 0; font-size: 18px; color: var(--primary-dark); }
                .rv-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
                .rv-tx-details { background: #f4f7f9; padding: 15px; border-radius: 4px; margin-bottom: 25px; font-size: 14px; }
                .rv-section { margin-bottom: 25px; }
                .rv-section h3 { font-size: 14px; text-transform: uppercase; margin-bottom: 10px; color: #666; }
                .rv-select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px; }
                .rv-btn-group { display: flex; gap: 10px; justify-content: flex-end; }
                .rv-btn { padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; border: none; }
                .rv-btn-primary { background: var(--primary-dark); color: #fff; }
                .rv-btn-secondary { background: var(--bg-app); border: 1px solid var(--primary-dark); color: var(--primary-dark); }
                .rv-btn-warning { background: #f0ad4e; color: #fff; }
            </style>
            <div class="rv-modal">
                <div class="rv-header">
                    <h2>Review Transaction</h2>
                    <button class="rv-close" id="rv-btnClose">&times;</button>
                </div>
                
                <div class="rv-tx-details">
                    <strong>Date:</strong> ${tx.date} <br>
                    <strong>Desc:</strong> ${tx.rawDescription} <br>
                    <strong>Amount:</strong> <span style="font-family: monospace; font-size: 16px;">$${tx.amount.toFixed(2)}</span>
                </div>

                <div class="rv-section">
                    <h3>1. Match to Existing Ledger Entry</h3>
                    <select class="rv-select" id="rv-matchSelect">
                        <option value="">-- Select Existing Transaction --</option>
                        <option value="L1" ${matchInfo?.ledgerId === 'L1' ? 'selected' : ''}>ACME Supplies - INV123 ($150.00)</option>
                        <option value="L2">Office Depot - Receipt ($45.00)</option>
                    </select>
                    <div style="text-align: right;">
                        <button class="rv-btn rv-btn-secondary" id="rv-btnMatchPost">Match & Post</button>
                    </div>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

                <div class="rv-section">
                    <h3>2. Or Create New Transaction</h3>
                    <select class="rv-select" id="rv-createSelect">
                        <optgroup label="Bank Account Types">
                            <option value="sales_receipt">Sales Receipt</option>
                            <option value="ar_collection">AR Collection</option>
                            <option value="deposit">Deposit (Owner Investment)</option>
                            <option value="cash_purchase">Cash Purchase</option>
                            <option value="ap_payment">AP Payment</option>
                        </optgroup>
                        <optgroup label="Credit Card Types">
                            <option value="cc_charge">Credit Card Charge</option>
                            <option value="cc_credit">Credit Card Credit</option>
                        </optgroup>
                    </select>
                    <div style="text-align: right;">
                        <button class="rv-btn rv-btn-primary" id="rv-btnCreatePost">Create & Post</button>
                    </div>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

                <div class="rv-btn-group" style="justify-content: space-between;">
                    <button class="rv-btn rv-btn-warning" id="rv-btnSubmitReview">Send to Approver</button>
                    <button class="rv-btn" id="rv-btnCancel" style="background: transparent; color: #333; text-decoration: underline;">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Modal Event Listeners
        const closeModal = () => overlay.remove();
        document.getElementById('rv-btnClose').addEventListener('click', closeModal);
        document.getElementById('rv-btnCancel').addEventListener('click', closeModal);
        
        // Match & Post Action
        document.getElementById('rv-btnMatchPost').addEventListener('click', async () => {
            const ledgerId = document.getElementById('rv-matchSelect').value;
            if(!ledgerId) return alert("Please select a ledger entry to match.");
            
            try {
                matchTransaction(txId, ledgerId, { userId: 'current_user' });
                await postTransaction(txId, { userId: 'current_user' });
                closeModal();
            } catch(e) { alert(e.message); }
        });

        // Create & Post Action
        document.getElementById('rv-btnCreatePost').addEventListener('click', async () => {
            const txType = document.getElementById('rv-createSelect').value;
            try {
                // Creates the record in the engine, matches it, and posts it
                await createTransactionFromBank(txId, txType, { userId: 'current_user' });
                await postTransaction(txId, { userId: 'current_user' });
                closeModal();
            } catch(e) { alert(e.message); }
        });

        // Submit for Review Action
        document.getElementById('rv-btnSubmitReview').addEventListener('click', async () => {
            await submitForReview([txId], { userId: 'current_user', comment: 'Requires manager approval.' });
            closeModal();
        });
    };

    // ---------------------------------------------------------
    // TOP LEVEL BUTTON LISTENERS
    // ---------------------------------------------------------
    btnLoadMock.addEventListener('click', () => {
        const mockData = [
            { id: 'tx_001', date: '2026-02-25', amount: -150.00, currency: 'USD', rawDescription: 'ACME Supplies INV123', payee: 'ACME', status: 'draft', ocrConfidence: 100 },
            { id: 'tx_002', date: '2026-02-26', amount: -5000.00, currency: 'USD', rawDescription: 'Payroll Feb Transfer', payee: 'Payroll', status: 'draft', ocrConfidence: 100 }
        ];
        _loadTransactions(mockData);
    });

    btnRunMatch.addEventListener('click', async () => {
        const txs = listTransactions();
        if (txs.length === 0) return alert("Load data first!");
        
        statusArea.innerText = "Running matching engine...";
        for (let tx of txs) { await runMatcher(tx.id); }
        renderTable();
    });

    btnAnomalies.addEventListener('click', () => {
        const anomalies = getAnomalyQueue({ limit: 5 });
        if (anomalies.length === 0) {
            alert("No anomalies found in current dataset.");
        } else {
            const list = anomalies.map(a => `• ${a.tx.rawDescription}\n  Risk: ${a.riskScore} (${a.reasons.join(', ')})`).join('\n\n');
            alert(`Highest Risk Anomalies:\n\n${list}`);
        }
    });

    console.log("Bank Transactions module initialized successfully.");
}
