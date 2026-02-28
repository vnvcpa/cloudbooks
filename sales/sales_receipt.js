// sales/sales_receipt.js

export function initSalesReceipt(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Render your specific view
    container.innerHTML = `
        <div class="dashboard-header">
            <h1>Sales Receipt</h1>
            <p>Create a new sales receipt</p>
        </div>
        <div class="dashboard-card">
            <p>Sales receipt form loading...</p>
        </div>
    `;

    console.log("Sales receipt module initialized successfully.");
}
