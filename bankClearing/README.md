# Bank Transactions Engine

## Architecture
The module strictly separates parsing/IO (`uploadBankTransactions.js`) from the core transaction state machine (`bankTransactions.js`). It adheres to an Event-Sourcing architecture where state changes (Approvals, Matches, Posting) push immutable events into an internal log. Dependencies on external systems (Ledgers, Databases, IAM) are abstracted through isolated adapters, making it 100% framework-agnostic.

## Tradeoffs
* **In-Memory State**: For performance, the current core module stores transactions in an in-memory `Map()`. In a stateless serverless environment, the `storageAdapter` should immediately persist the state, and `listTransactions` should fetch directly from the DB.
* **Heuristic vs. ML Matching**: The matching engine uses deterministic rules (Exact Amount) and fuzzy string matching (Payee/Invoice). While less robust than a trained LLM classifier, it ensures 100% explainability, which is critical for financial auditability.

## Recommended Defaults
**Configuration**: Set `autoPostThreshold` to **95%** (requires exact amount + exact invoice match), `suggestThreshold` to **60%** (for UI visual badging), and `anomalyAlerting` to flag absolute amounts > 3 standard deviations from the 30-day moving average.
