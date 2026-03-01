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
 * @param {string} txId 
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

        // Exact Absolute Amount Match (rule)
        if (Math.abs(tx.amount) === Math.abs(ledgerTx.amount)) {
            score += 50;
            reasons.push("amount exact");
        }

        // Fuzzy Payee Match (simplistic subset for example)
        if (tx.rawDescription.toLowerCase().includes(ledgerTx.payee.toLowerCase())) {
            score += 30;
            reasons.push(`fuzzy payee (~${ledgerTx.payee})`);
        }

        // Invoice Match
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
    state.matches.set(txId, { ledgerId, confidence: 100, explanation: "Manual Match" });
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
    if (tx.status !== 'approved') throw new Error("Transaction must be approved before posting.");
    
    if (dryRun) {
        return dryRunApply([txId]);
    }

    const ledgerResponse = await ledgerAdapter.post(tx);
    tx.status = 'posted';
    const event = { type: 'POSTED', txId, ledgerResponse, userId, timestamp: new Date() };
    state.events.push(event);
    notify('onStateChange', { action: 'posted', txId });
    return event;
}

export function dryRunApply(txIds) {
    let mockBalanceImpact = 0;
    const diff = txIds.map(id => {
        const tx = state.transactions.get(id);
        mockBalanceImpact += tx.amount;
        return { txId: id, action: 'would_post', impact: tx.amount };
    });

    return {
        isDryRun: true,
        totalBalanceImpact: mockBalanceImpact,
        diff
    };
}

export function getAnomalyQueue({ limit = 10 }) {
    const anomalies = Array.from(state.transactions.values()).map(tx => {
        let riskScore = 0;
        let reasons = [];

        // Amount outlier heuristic
        if (Math.abs(tx.amount) > 2000) {
            riskScore += 60;
            reasons.push("High amount deviation");
        }
        // Quality heuristic
        if (tx.ocrConfidence < 90) {
            riskScore += 30;
            reasons.push("Low OCR confidence");
        }

        return { tx, riskScore, reasons };
    });

    return anomalies
        .filter(a => a.riskScore > 0)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, limit);
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
                            <th style="padding: 10px 8px;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="bt-tableBody">
                        <tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">No data loaded</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // DOM Elements
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

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px 8px;">${tx.date}</td>
                    <td style="padding: 12px 8px;">${tx.rawDescription}</td>
                    <td style="padding: 12px 8px; font-family: monospace;">$${tx.amount.toFixed(2)}</td>
                    <td style="padding: 12px 8px;">${matchHtml}</td>
                    <td style="padding: 12px 8px;">
                        <button style="background: transparent; border: none; color: var(--accent); cursor: pointer; font-size: 13px;">Review</button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    // UI Hook: Listen to core engine state changes
    hooks.onStateChange((payload) => {
        statusArea.innerText = `Last Action: ${payload.action.toUpperCase()} - Updated UI successfully.`;
        renderTable();
    });

    // Event Listeners for UI Buttons
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
        for (let tx of txs) {
            await runMatcher(tx.id);
        }
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
