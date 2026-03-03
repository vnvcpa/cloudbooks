// settings/multicurrency.js

/**
 * Core utility for handling multi-currency logic, exchange rates, and formatting.
 * Assumes 'vnv_homeCurrency' and 'vnv_currencyMode' are stored in localStorage via setupCompany.js.
 */

// List of supported currencies. Expand as needed.
export const SUPPORTED_CURRENCIES = [
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar' }
];

/**
 * Returns the company's currency configuration.
 * @returns {{ isMultiCurrency: boolean, homeCurrency: string }}
 */
export function getCurrencyConfig() {
    return {
        isMultiCurrency: localStorage.getItem('vnv_currencyMode') === 'multi',
        homeCurrency: localStorage.getItem('vnv_homeCurrency') || 'USD'
    };
}

/**
 * Fetches the exchange rate for a given date.
 * If date is today, gets live rate. If past, gets historical rate.
 * @param {string} targetCurrency - e.g., 'USD'
 * @param {string} date - 'YYYY-MM-DD' (Optional, defaults to today)
 * @returns {Promise<number>} - The multiplier (e.g., 1 Target = X Home Currency)
 */
export async function getExchangeRate(targetCurrency, date = new Date().toISOString().split('T')[0]) {
    const config = getCurrencyConfig();
    if (!config.isMultiCurrency || targetCurrency === config.homeCurrency) {
        return 1.0; // 1:1 ratio if single currency or same currency
    }

    // TODO: Replace this mock block with a real API call later (e.g., https://open.er-api.com)
    // Example Mock Logic:
    console.log(`[FX ENGINE] Fetching rate for ${targetCurrency} to ${config.homeCurrency} on ${date}`);
    
    // Mock standard rates assuming PHP is Home for demonstration
    const mockRatesToPhp = { 'USD': 56.20, 'EUR': 60.50, 'GBP': 70.10, 'AUD': 36.80, 'SGD': 41.50, 'JPY': 0.37, 'TWD': 1.78 };
    
    // Return mock rate, or default to 1 if not found
    return mockRatesToPhp[targetCurrency] || 1.0; 
}

/**
 * Calculates the home currency amount based on a foreign amount and a rate.
 * @param {number} foreignAmount 
 * @param {number} exchangeRate 
 * @returns {number} Standardized to 2 decimal places
 */
export function calculateHomeAmount(foreignAmount, exchangeRate) {
    const result = foreignAmount * exchangeRate;
    return Math.round(result * 100) / 100;
}

/**
 * Standardized currency formatter using the browser's Intl.NumberFormat API.
 * @param {number} amount 
 * @param {string} currencyCode 
 * @returns {string} e.g., "₱1,250.00"
 */
export function formatCurrency(amount, currencyCode) {
    if (isNaN(amount)) return '';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Populates an existing <select> element with available currencies.
 * Automatically selects the Home Currency if no default is provided.
 * @param {HTMLSelectElement} selectElement - The DOM element to populate
 * @param {string|null} selectedCurrency - The currency code to pre-select
 */
export function populateCurrencyDropdown(selectElement, selectedCurrency = null) {
    if (!selectElement) return;
    
    const config = getCurrencyConfig();
    selectElement.innerHTML = ''; // clear existing

    if (!config.isMultiCurrency) {
        // If single currency, only show the home currency
        const opt = document.createElement('option');
        opt.value = config.homeCurrency;
        opt.textContent = config.homeCurrency;
        selectElement.appendChild(opt);
        selectElement.disabled = true; // Lock the dropdown
        return;
    }

    // Populate all
    SUPPORTED_CURRENCIES.forEach(curr => {
        const opt = document.createElement('option');
        opt.value = curr.code;
        opt.textContent = `${curr.code} - ${curr.name}`;
        
        if (selectedCurrency && curr.code === selectedCurrency) {
            opt.selected = true;
        } else if (!selectedCurrency && curr.code === config.homeCurrency) {
            opt.selected = true;
        }
        
        selectElement.appendChild(opt);
    });
}
