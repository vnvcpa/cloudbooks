// accountant/accountant.js

export function initSalesReceipt(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Render your specific view
    container.innerHTML = `
        <div class="dashboard-header">
            <h1>Accountant</h1>
            <p>Create the accountant dashboard</p>
        </div>
        <div class="dashboard-card">
            <p>Accountant dashboard is loading...</p>
        </div>
    `;

    console.log("Accountant module initialized successfully.");
}
