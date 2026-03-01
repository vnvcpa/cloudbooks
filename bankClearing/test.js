import { uploadFile, suggestMapping } from './uploadBankTransactions.js';
import { 
    _loadTransactions, listTransactions, runMatcher, 
    submitForReview, approve, postTransaction, dryRunApply, getAnomalyQueue, hooks
} from './bankTransactions.js';

async function runTestsAndExample() {
    console.log("--- Starting Initialization & Hooks Example ---");
    
    // UI Hook Example
    hooks.onStateChange((e) => console.log(`[UI UPDATE] State changed: ${e.action}`, e));
    hooks.onError((e) => console.error(`[UI ALERT] Error: ${e.message}`));

    const rawData = {
        csvSample: "Date,Description,Amount,Currency\n2026-02-25,ACME Supplies INV123, -150.00,USD\n2026-02-26,Payroll Feb, -5000.00,USD"
    };

    console.log("\n--- Testing Parsing & Normalization ---");
    const parsedTxs = await uploadFile(rawData.csvSample, { bankId: 'BofA_123', fileType: 'CSV', userId: 'user1' });
    console.assert(parsedTxs.length === 2, "Should parse 2 rows");
    console.assert(parsedTxs[0].amount === -150.00, "Amount should be numeric");
    
    // Load into core module state
    _loadTransactions(parsedTxs);

    console.log("\n--- Testing Matching Engine ---");
    const tx1 = parsedTxs[0].id;
    const matchData = await runMatcher(tx1);
    console.log("Match Result:", matchData);
    console.assert(matchData.confidence === 100, "Should have 100% confidence from Amount(50)+Payee(30)+Invoice(20)");

    console.log("\n--- Testing Anomaly Queue ---");
    const anomalies = getAnomalyQueue({ limit: 5 });
    console.log("Anomalies:", anomalies.map(a => `${a.tx.rawDescription} (Score: ${a.riskScore} - ${a.reasons})`));
    console.assert(anomalies[0].tx.amount === -5000, "Payroll should be highest risk due to amount > 2000");

    console.log("\n--- Testing Sandbox Dry-Run ---");
    const dryRunResult = dryRunApply([tx1]);
    console.log("Dry Run Result:", dryRunResult);
    console.assert(dryRunResult.totalBalanceImpact === -150, "Dry run math should be correct");

    console.log("\n--- Testing Multi-Stage Approval Flow ---");
    
    // 1. Submit
    await submitForReview([tx1], { userId: 'clerk1', comment: 'Looks good' });
    let currentTx = listTransactions().find(t => t.id === tx1);
    console.assert(currentTx.status === 'pending_review', "Status should be pending_review");

    // 2. Approve (Fail auth)
    try {
        await approve([tx1], { userId: 'clerk1', comment: 'Self approving' });
    } catch (e) {
        console.log("Successfully blocked unauthorized approval.");
    }

    // 3. Approve (Pass auth)
    await approve([tx1], { userId: 'admin1', comment: 'Approved for posting' });
    console.assert(currentTx.status === 'approved', "Status should be approved");

    // 4. Post
    await postTransaction(tx1, { userId: 'admin1' });
    console.assert(currentTx.status === 'posted', "Status should be posted");

    console.log("\n✅ All features executed successfully.");
}

runTestsAndExample();
