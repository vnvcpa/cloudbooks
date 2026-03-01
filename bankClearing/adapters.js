/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} date
 * @property {number} amount
 * @property {string} currency
 * @property {string} payee
 * @property {string} rawDescription
 * @property {string} sourceId
 * @property {string} sourceType 'CSV' | 'PDF' | 'FEED'
 * @property {string} mappingId
 * @property {number} ocrConfidence
 * @property {string} status 'draft' | 'pending_review' | 'approved' | 'posted'
 */

export const ledgerAdapter = {
    /** @param {Transaction} tx */
    async post(tx) {
        console.log(`[Ledger] Posting transaction ${tx.id}`);
        return { eventId: `evt_${Date.now()}`, status: 'success' };
    },
    async reverse(eventId) {
        console.log(`[Ledger] Reversing event ${eventId}`);
        return { status: 'reversed' };
    },
    async getTransaction(ledgerId) {
        // Mock historical ledger data
        const mockLedger = {
            "L1": { ledgerId: "L1", payee: "ACME Supplies", amount: 150.00, invoice: "INV123" }
        };
        return mockLedger[ledgerId] || null;
    },
    async getHistoricalTransactions() {
        return [{ ledgerId: "L1", payee: "ACME Supplies", amount: 150.00, invoice: "INV123" }];
    }
};

export const ocrAdapter = {
    async extractRows(pdfBlob) {
        console.log("[OCR] Extracting from PDF...");
        return { 
            rows: [["2026-02-25", "ACME Supplies INV123", "-150.00", "USD"]], 
            confidence: 88 
        };
    }
};

export const storageAdapter = {
    _store: new Map(),
    async saveMapping(mapping) { this._store.set(mapping.bankId, mapping); },
    async getMapping(bankId) { return this._store.get(bankId); },
    async saveSnapshot(snapshot) { this._store.set(snapshot.id, snapshot); return snapshot.id; }
};

export const authAdapter = {
    async getUser(userId) { return { id: userId, role: userId === 'admin1' ? 'approver' : 'clerk' }; },
    canApprove(user, action) { return user.role === 'approver' || user.role === 'admin'; }
};

export const bankFeedAdapter = {
    async fetchStatement(bankId, dateRange) { return []; }
};
