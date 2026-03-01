import { ocrAdapter, storageAdapter } from './adapters.js';

/**
 * Suggests column mapping based on sample CSV/OCR rows.
 * @param {string[][]} sampleRows 
 * @returns {{ mapping: Object, confidence: number }}
 */
export function suggestMapping(sampleRows) {
    if (!sampleRows || sampleRows.lengthimport { ocrAdapter, storageAdapter } from './adapters.js';
// Import the load function from your core engine so the uploaded data actually goes somewhere
import { _loadTransactions } from './bankTransactions.js';

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

// ==========================================
// UI INITIALIZATION (Allows index.html to render this module)
// ==========================================
export function init(containerId) {
    // 1. Remove existing overlay to prevent duplicates
    let existing = document.getElementById('uploadBankTxOverlay');
    if (existing) existing.remove();

    // 2. Create the overlay container
    const overlay = document.createElement('div');
    overlay.id = 'uploadBankTxOverlay';
    
    overlay.style.cssText = `
        position: fixed;
        top: var(--header-height); 
        left: 0; right: 0; bottom: 0;
        background-color: rgba(0, 0, 0, 0.4);
        z-index: 990;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 30px;
    `;

    // 3. Inject Layout
    overlay.innerHTML = `
        <style>
            .ubt-modal { background: #ffffff; width: 450px; max-width: 95%; border-radius: 4px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); padding: 30px 40px; font-family: 'Segoe UI', Arial, sans-serif; color: #000; }
            .ubt-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
            .ubt-header-row h2 { margin: 0; font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
            .ubt-close-x { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; line-height: 1; padding: 0; }
            .ubt-close-x:hover { color: #000; }
            .ubt-form-group { margin-bottom: 20px; }
            .ubt-label { display: block; font-size: 14px; margin-bottom: 8px; font-weight: 500;}
            .ubt-select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; background: transparent; outline: none;}
            .ubt-file-input { width: 100%; padding: 15px 10px; border: 1px dashed #000; border-radius: 4px; font-size: 14px; text-align: center; cursor: pointer; background: #fafafa;}
            .ubt-btn-upload { background: var(--primary-dark); color: #fff; border: none; padding: 10px 0; border-radius: 4px; cursor: pointer; font-size: 14px; width: 100%; margin-top: 10px;}
            .ubt-btn-upload:hover { background: var(--primary-light); }
            .ubt-status { margin-top: 15px; font-size: 13px; text-align: center; font-weight: 500; }
        </style>

        <div class="ubt-modal">
            <div class="ubt-header-row">
                <h2>UPLOAD TRANSACTIONS</h2>
                <button class="ubt-close-x" id="ubt-btnCloseX" title="Close">&times;</button>
            </div>

            <div class="ubt-form-group">
                <label class="ubt-label">Bank Account:</label>
                <select class="ubt-select" id="ubt-bankId">
                    <option value="BofA_1234">Bank of America (Checking - 1234)</option>
                    <option value="Chase_5678">Chase (Savings - 5678)</option>
                    <option value="Amex_9012">American Express (Credit - 9012)</option>
                </select>
            </div>

            <div class="ubt-form-group">
                <label class="ubt-label">Statement File (.CSV or .PDF):</label>
                <input type="file" class="ubt-file-input" id="ubt-fileInput" accept=".csv, .pdf">
            </div>

            <button class="ubt-btn-upload" id="ubt-btnUpload">Parse & Upload</button>
            <div class="ubt-status" id="ubt-statusDisplay"></div>
        </div>
    `;

    document.body.appendChild(overlay);

    // 4. Logic & Event Listeners
    const btnCloseX = document.getElementById('ubt-btnCloseX');
    const btnUpload = document.getElementById('ubt-btnUpload');
    const fileInput = document.getElementById('ubt-fileInput');
    const bankSelect = document.getElementById('ubt-bankId');
    const statusDisplay = document.getElementById('ubt-statusDisplay');

    const closeForm = () => overlay.remove();
    btnCloseX.addEventListener('click', closeForm);
    overlay.querySelector('.ubt-modal').addEventListener('click', (e) => e.stopPropagation());

    btnUpload.addEventListener('click', async () => {
        if (!fileInput.files || fileInput.files.length === 0) {
            statusDisplay.style.color = '#d9534f'; // Red
            statusDisplay.innerText = "Error: Please select a file first.";
            return;
        }

        const file = fileInput.files[0];
        const fileType = file.name.endsWith('.pdf') ? 'PDF' : 'CSV';
        const reader = new FileReader();

        statusDisplay.style.color = '#333';
        statusDisplay.innerText = "Analyzing file mapping...";

        // Handle reading the file
        reader.onload = async (e) => {
            try {
                const fileContent = e.target.result;
                
                // Call your exported function
                const transactions = await uploadFile(fileContent, { 
                    bankId: bankSelect.value, 
                    fileType: fileType, 
                    userId: 'current_user' 
                });

                // Load the parsed transactions directly into the bankTransactions engine state!
                _loadTransactions(transactions);

                statusDisplay.style.color = 'green';
                statusDisplay.innerText = `Successfully loaded ${transactions.length} transactions!`;
                
                // Close modal automatically after success
                setTimeout(() => {
                    closeForm();
                    // Optionally trigger the router to switch the view to the Dashboard automatically:
                    if (window.handleMenuClick) window.handleMenuClick('bankClearing', 'bankTransactions', null);
                }, 1500);

            } catch (err) {
                statusDisplay.style.color = '#d9534f';
                statusDisplay.innerText = "Processing Error: " + err.message;
            }
        };

        // For this implementation, we read as text (assuming mostly CSVs are uploaded)
        reader.readAsText(file);
    });
} === 0) return { mapping: null, confidence: 0 };
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
