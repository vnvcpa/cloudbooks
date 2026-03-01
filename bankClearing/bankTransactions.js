import { ledgerAdapter, authAdapter, storageAdapter } from './adapters.js';

// --- State Management ---
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

// --- Module Methods ---

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
