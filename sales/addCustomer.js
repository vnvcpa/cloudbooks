// sales/addCustomer.js

export function init(containerId) {
    // 1. Remove existing overlay if it already exists to prevent duplicates
    let existing = document.getElementById('addCustomerOverlay');
    if (existing) existing.remove();

    // 2. Create the overlay container
    const overlay = document.createElement('div');
    overlay.id = 'addCustomerOverlay';
    
    // The overlay is fixed, covers the main screen and sidebar, but sits BELOW the header (z-index 990 vs header 1000)
    overlay.style.cssText = `
        position: fixed;
        top: var(--header-height); 
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.4);
        z-index: 990;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 30px;
        overflow-y: auto;
    `;

    // 3. Inject CSS and HTML for the layout
    overlay.innerHTML = `
        <style>
            .ac-modal {
                background: #ffffff;
                width: 600px;
                max-width: 95%;
                border-radius: 4px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.2);
                padding: 30px 40px;
                margin-bottom: 40px;
                font-family: 'Segoe UI', Arial, sans-serif;
                color: #000;
            }
            .ac-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
            .ac-header-row h2 { margin: 0; font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
            .ac-close-x { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; line-height: 1; padding: 0; }
            .ac-close-x:hover { color: #000; }
            
            .ac-row { display: flex; margin-bottom: 12px; align-items: baseline; }
            .ac-label { width: 140px; font-size: 14px; }
            .ac-label-indent { width: 120px; padding-left: 20px; font-size: 14px; }
            
            .ac-input-line {
                flex: 1;
                border: none;
                border-bottom: 1px solid #000;
                padding: 4px 0;
                font-size: 14px;
                background: transparent;
                outline: none;
                transition: border-bottom-color 0.2s;
            }
            .ac-input-line:focus { border-bottom: 2px solid var(--primary-dark); }
            .ac-input-half { max-width: 200px; }
            
            .ac-subtext { font-size: 12px; color: #333; text-align: center; margin-top: 4px; }
            
            .ac-footer { display: flex; justify-content: flex-end; align-items: center; gap: 15px; margin-top: 30px; }
            .ac-btn-cancel { background: transparent; border: none; color: #333; cursor: pointer; font-size: 14px; }
            .ac-btn-cancel:hover { text-decoration: underline; }
            
            /* Split Button Styling */
            .ac-split-btn-group { display: flex; position: relative; }
            .ac-split-btn-main { background: transparent; border: none; font-size: 14px; cursor: pointer; padding-right: 5px; }
            .ac-split-btn-arrow { background: transparent; border: none; font-size: 10px; cursor: pointer; padding-left: 5px; display:flex; align-items:center; }
            .ac-dropdown-menu { 
                display: none; position: absolute; bottom: 100%; right: 0; background: #fff; 
                border: 1px solid #ccc; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 130px; z-index: 1000;
            }
            .ac-dropdown-item { padding: 10px 15px; font-size: 13px; cursor: pointer; }
            .ac-dropdown-item:hover { background: #f0f0f0; }
        </style>

        <div class="ac-modal">
            <div class="ac-header-row">
                <h2>CUSTOMER:</h2>
                <button class="ac-close-x" id="ac-btnCloseX" title="Close">&times;</button>
            </div>

            <div class="ac-row" style="align-items: flex-start;">
                <label class="ac-label" style="padding-top: 4px;">Customer Name:</label>
                <div style="display: flex; gap: 15px; flex: 1;">
                    <div style="flex: 2;">
                        <input type="text" class="ac-input-line" id="ac-lastName" style="width: 100%;">
                        <div class="ac-subtext">[Last Name]</div>
                    </div>
                    <div style="flex: 1; max-width: 60px;">
                        <input type="text" class="ac-input-line" id="ac-mi" style="width: 100%;">
                        <div class="ac-subtext">[MI]</div>
                    </div>
                    <div style="flex: 2;">
                        <input type="text" class="ac-input-line" id="ac-firstName" style="width: 100%;">
                        <div class="ac-subtext">[First Name]</div>
                    </div>
                </div>
            </div>

            <div class="ac-row"><label class="ac-label">Full Name:</label><input type="text" class="ac-input-line" id="ac-fullName"></div>
            <div class="ac-row"><label class="ac-label">Company Name:</label><input type="text" class="ac-input-line" id="ac-companyName"></div>
            <div class="ac-row"><label class="ac-label">Address</label></div>
            
            <div class="ac-row"><label class="ac-label-indent">Street:</label><input type="text" class="ac-input-line" id="ac-street"></div>
            <div class="ac-row"><label class="ac-label-indent">Barangay:</label><input type="text" class="ac-input-line" id="ac-barangay"></div>
            <div class="ac-row"><label class="ac-label-indent">Town/City:</label><input type="text" class="ac-input-line" id="ac-city"></div>
            <div class="ac-row"><label class="ac-label-indent">ZIP Code:</label><input type="text" class="ac-input-line ac-input-half" id="ac-zipCode"></div>
            <div class="ac-row"><label class="ac-label-indent">Province/State:</label><input type="text" class="ac-input-line ac-input-half" id="ac-province"></div>
            <div class="ac-row"><label class="ac-label-indent">Country:</label><input type="text" class="ac-input-line ac-input-half" id="ac-country"></div>
            
            <div class="ac-row"><label class="ac-label">Phone:</label><input type="text" class="ac-input-line ac-input-half" id="ac-phone"></div>
            <div class="ac-row"><label class="ac-label">Email:</label><input type="text" class="ac-input-line" id="ac-email"></div>
            
            <div class="ac-row" style="margin-top: 15px;">
                <label class="ac-label">Is 1099:</label>
                <input type="checkbox" id="ac-is1099" style="width: 16px; height: 16px; cursor: pointer;">
            </div>

            <div class="ac-footer">
                <div class="ac-split-btn-group">
                    <button class="ac-split-btn-main" id="ac-btnSaveAction">Save & Close</button>
                    <button class="ac-split-btn-arrow" id="ac-btnToggleDropdown">▼</button>
                    <div class="ac-dropdown-menu" id="ac-dropdownMenu">
                        <div class="ac-dropdown-item" data-action="save">Save</div>
                        <div class="ac-dropdown-item" data-action="saveNew">Save & New</div>
                        <div class="ac-dropdown-item" data-action="saveClose">Save & Close</div>
                    </div>
                </div>
                <button class="ac-btn-cancel" id="ac-btnCancel">Cancel</button>
            </div>
        </div>
    `;

    // 4. Attach to body
    document.body.appendChild(overlay);

    // 5. Establish Logic
    let currentSaveMode = 'saveClose';
    
    // DOM Elements
    const btnCloseX = overlay.querySelector('#ac-btnCloseX');
    const btnCancel = overlay.querySelector('#ac-btnCancel');
    const btnSaveAction = overlay.querySelector('#ac-btnSaveAction');
    const btnToggleDropdown = overlay.querySelector('#ac-btnToggleDropdown');
    const dropdownMenu = overlay.querySelector('#ac-dropdownMenu');
    
    // Close form function
    const closeForm = () => { overlay.remove(); };

    // Clear form function
    const clearForm = () => {
        const inputs = overlay.querySelectorAll('input[type="text"]');
        inputs.forEach(input => input.value = '');
        overlay.querySelector('#ac-is1099').checked = false;
        overlay.querySelector('#ac-lastName').focus();
    };

    // Save Function (Saves locally to a JSON file)
    const saveCustomer = () => {
        const customerData = {
            lastName: overlay.querySelector('#ac-lastName').value,
            mi: overlay.querySelector('#ac-mi').value,
            firstName: overlay.querySelector('#ac-firstName').value,
            fullName: overlay.querySelector('#ac-fullName').value,
            companyName: overlay.querySelector('#ac-companyName').value,
            address: {
                street: overlay.querySelector('#ac-street').value,
                barangay: overlay.querySelector('#ac-barangay').value,
                city: overlay.querySelector('#ac-city').value,
                zipCode: overlay.querySelector('#ac-zipCode').value,
                province: overlay.querySelector('#ac-province').value,
                country: overlay.querySelector('#ac-country').value,
            },
            contact: {
                phone: overlay.querySelector('#ac-phone').value,
                email: overlay.querySelector('#ac-email').value,
            },
            is1099: overlay.querySelector('#ac-is1099').checked,
            timestamp: new Date().toISOString()
        };

        // Export data to a local JSON file
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customerData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (customerData.lastName || 'New_Customer') + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        // Handle the routing based on the selected mode
        if (currentSaveMode === 'saveClose') {
            closeForm();
        } else if (currentSaveMode === 'saveNew') {
            clearForm();
        } else {
            // Mode is just "Save", keep the form exactly as is
            console.log("Customer saved. Form left open.");
        }
    };

    // Event Listeners
    btnCloseX.addEventListener('click', closeForm);
    btnCancel.addEventListener('click', closeForm);
    
    // Stop click propagation on the modal window so clicking the background overlay does NOT close it
    overlay.querySelector('.ac-modal').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Dropdown toggle logic
    btnToggleDropdown.addEventListener('click', () => {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    // Dropdown item selection logic
    overlay.querySelectorAll('.ac-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            currentSaveMode = e.target.getAttribute('data-action');
            btnSaveAction.textContent = e.target.textContent;
            dropdownMenu.style.display = 'none';
        });
    });

    // Hide dropdown if clicked outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ac-split-btn-group')) {
            dropdownMenu.style.display = 'none';
        }
    });

    // Save button click
    btnSaveAction.addEventListener('click', saveCustomer);
}
