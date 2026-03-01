import { ocrAdapter, storageAdapter } from './adapters.js';

/**
 * Suggests column mapping based on sample CSV/OCR rows.
 * @param {string[][]} sampleRows 
 * @returns {{ mapping: Object, confidence: number }}
 */
export function suggestMapping(sampleRows) {
    if (!sampleRows || sampleRows.length === 0) return { mapping: null, confidence: 0 };
    const header = sampleRows[0].map(h => h.toLowerCase());
    
    let mapping = { date: -1, description: -1, amount: -1, currency: -1 };
    header.forEach((col, idx) => {
        if (col.includes('date')) mapping.date = idx;
        if (col.includes('desc') || col.includes('payee')) mapping.description = idx;
        if (col.includes('amount')) mapping.amount = idx;
        if (col.includes('currency')) mapping.currency = idx;
    });

    // Calculate heuristic confidence
    const mappedFields = Object.values(mapping).filter(v => v !== -1).length;
    const confidence = (mappedFields / 4) * 100;
    
    return { mapping, confidence };
}

/**
 * Parses and normalizes raw text/data into canonical transaction objects.
 * @param {string} fileContent Raw CSV string
 * @param {Object} mapping 
 * @param {string} sourceId 
 * @returns {Transaction[]}
 */
export function parseAndNormalize(fileContent, mapping, sourceId = 'upload') {
    const lines = fileContent.trim().split('\n');
    const dataRows = lines.slice(1); // skip header
    
    return dataRows.map((line, idx) => {
        const cols = line.split(',').map(s => s.trim());
        const desc = cols[mapping.description] || '';
        
        return {
            id: `${sourceId}_row_${idx}`,
            date: cols[mapping.date],
            amount: parseFloat(cols[mapping.amount]),
            currency: cols[mapping.currency] || 'USD',
            payee: desc.split(' ')[0], // basic payee extraction
            rawDescription: desc,
            sourceId,
            sourceType: 'CSV',
            mappingId: mapping.bankId || 'auto',
            ocrConfidence: 100, // CSV is 100%
            status: 'draft'
        };
    });
}

/**
 * Main upload entry point.
 */
export async function uploadFile(fileData, { bankId, fileType, userId }) {
    let rawRows = [];
    let ocrConfidence = 100;

    if (fileType === 'PDF') {
        const result = await ocrAdapter.extractRows(fileData);
        rawRows = result.rows;
        ocrConfidence = result.confidence;
    } else {
        // Simple CSV split for simulation
        rawRows = fileData.trim().split('\n').map(r => r.split(','));
    }

    let mapping = await storageAdapter.getMapping(bankId);
    if (!mapping) {
        const suggestion = suggestMapping(rawRows.slice(0, 5));
        mapping = { bankId, ...suggestion.mapping };
        await storageAdapter.saveMapping(mapping);
    }

    const fileContent = rawRows.map(r => r.join(',')).join('\n');
    const transactions = parseAndNormalize(fileContent, mapping, `upload_${Date.now()}`);
    
    if (fileType === 'PDF') {
        transactions.forEach(tx => tx.ocrConfidence = ocrConfidence);
    }

    return transactions;
}
