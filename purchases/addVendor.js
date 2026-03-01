// purchases/addVendor.js

export function init(containerId) {
    // 1. Remove existing overlay if it already exists to prevent duplicates
    let existing = document.getElementById('addVendorOverlay');
    if (existing) existing.remove();

    // 2. Create the overlay container
    const overlay = document.createElement('div');
    overlay.id = 'addVendorOverlay';
    
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
            .av-modal {
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
            .av-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
            .av-header-row h2 { margin: 0; font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
            .av-close-x { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; line-height: 1; padding: 0; }
            .av-close-x:hover { color: #000; }
            
            .av-row { display: flex; margin-bottom: 12px; align-items: baseline; }
            .av-label { width: 140px; font-size: 14px; }
            .av-label-indent { width: 120px; padding-left: 20px; font-size: 14px; }
            
            .av-input-line {
                flex: 1;
                border: none;
                border-bottom: 1px solid #000;
                padding: 4px 0;
                font-size: 14px;
                background: transparent;
                outline: none;
                transition: border-bottom-color 0.2s;
            }
            .av-input-line:focus { border-bottom: 2px solid var(--primary-dark); }
            .av-input-half { max-width: 200px; }
            
            .av-subtext { font-size: 12px; color: #333; text-align: center; margin-top: 4px; }
            
            .av-footer { display: flex; justify-content: flex-end; align-items: center; gap: 15px; margin-top: 30px; }
            .av-btn-cancel { background: transparent; border: none; color: #333; cursor: pointer; font-size: 14px; }
            .av-btn-cancel:hover { text-decoration: underline; }
            
            /* Split Button Styling */
            .av-split-btn-group { display: flex; position: relative; }
            .av-split-btn-main { background: transparent; border: none; font-size: 14px; cursor: pointer; padding-right: 5px; }
            .av-split-btn-arrow { background: transparent; border: none; font-size: 10px; cursor: pointer; padding-left: 5px; display:flex; align-items:center; }
            .av-dropdown-menu { 
                display: none; position: absolute; bottom: 100%; right: 0; background: #fff; 
                border: 1px solid #ccc; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 130px; z-index: 1000;
            }
            .av-dropdown-item { padding: 10px 15px; font-size: 13px; cursor: pointer; }
            .av-dropdown-item:hover { background: #f0f0f0; }
        </style>

        <div class="av-modal">
            <div class="av-header-row">
                <h2>VENDOR:</h2>
                <button class="av-close-x" id="av-btnCloseX" title="Close">&times;</button>
            </div>

            <div class="av-row" style="align-items: flex-start;">
                <label class="av-label" style="padding-top: 4px;">Vendor Name:</label>
                <div style="display: flex; gap: 15px; flex: 1;">
                    <div style="flex: 2;">
                        <input type="text" class="av-input-line" id="av-lastName" style="width: 100%;">
                        <div class="av-subtext">[Last Name]</div>
                    </div>
                    <div style="flex: 1; max-width: 60px;">
                        <input type="text" class="av-input-line" id="av-mi" style="width: 100%;">
                        <div class="av-subtext">[MI]</div>
                    </div>
                    <div style="flex: 2;">
                        <input type="text" class="av-input-line" id="av-firstName" style="width: 100%;">
                        <div class="av-subtext">[First Name]</div>
                    </div>
                </div>
            </div>

            <div class="av-row"><label class="av-label">Full Name:</label><input type="text" class="av-input-line" id="av-fullName"></div>
            <div class="av-row"><label class="av-label">Company Name:</label><input type="text" class="av-input-line" id="av-companyName"></div>
            <div class="av-row"><label class="av-label">Address</label></div>
            
            <div class="av-row"><label class="av-label-indent">Street:</label><input type="text" class="av-input-line" id="av-street"></div>
            <div class="av-row"><label class="av-label-indent">Barangay:</label><input type="text" class="av-input-line" id="av-barangay"></div>
            <div class="av-row"><label class="av-label-indent">Town/City:</label><input type="text" class="av-input-line" id="av-city"></div>
            <div class="av-row"><label class="av-label-indent">ZIP Code:</label><input type="text" class="av-input-line av-input-half" id="av-zipCode"></div>
            <div class="av-row"><label class="av-label-indent">Province/State:</label><input type="text" class="av-input-line av-input-half" id="av-province"></div>
            <div class="av-row"><label class="av-label-indent">Country:</label><input type="text" class="av-input-line av-input-half" id="av-country"></div>
            
            <div class="av-row"><label class="av-label">Phone:</label><input type="text" class="av-input-line av-input-half" id="av-phone"></div>
            <div class="av-row"><label class="av-label">Email:</label><input type="text" class="av-input-line" id="av-email"></div>
            
            <div class="av-row" style="margin-top: 15px;">
                <label class="av-label">Is 1099:</label>
                <input type="checkbox" id="av-is1099" style="width: 16px; height: 16px; cursor: pointer;">
            </div>

            <div class="av-footer">
                <div class="av-split-btn-group">
                    <button class="av-split-btn-main" id="av-btnSaveAction">Save & Close</button>
                    <button class="av-split-btn-arrow" id="av-btnToggleDropdown">▼</button>
                    <div class="av-dropdown-menu" id="av-dropdownMenu">
                        <div class="av-dropdown-item" data-action="save">Save</div>
                        <div class="av-dropdown-item" data-action="saveNew">Save & New</div>
                        <div class="ac-dropdown-item" data-action="saveClose">Save & Close</div>
                    </div>
                </div>
                <button class="av-btn-cancel" id="av-btnCancel">Cancel</button>
            </div>
        </div>
    `;

    // 4. Attach to body
    document.body.appendChild(overlay);

    // 5. Establish Logic
    let currentSaveMode = 'saveClose';
    
    // DOM Elements
    const btnCloseX = overlay.querySelector('#av-btnCloseX');
    const btnCancel = overlay.querySelector('#av-btnCancel');
    const btnSaveAction = overlay.querySelector('#av-btnSaveAction');
    const btnToggleDropdown = overlay.querySelector('#av-btnToggleDropdown');
    const dropdownMenu = overlay.querySelector('#av-dropdownMenu');
    
    // Close form function
    const closeForm = () => { overlay.remove(); };

    // Clear form function
    const clearForm = () => {
        const inputs = overlay.querySelectorAll('input[type="text"]');
        inputs.forEach(input => input.value = '');
        overlay.querySelector('#av-is1099').checked = false;
        overlay.querySelector('#av-lastName').focus();
    };

    // Save Function (Saves locally to a JSON file)
    const saveVendor = () => {
        const vendorData = {
            lastName: overlay.querySelector('#av-lastName').value,
            mi: overlay.querySelector('#av-mi').value,
            firstName: overlay.querySelector('#av-firstName').value,
            fullName: overlay.querySelector('#av-fullName').value,
            companyName: overlay.querySelector('#av-companyName').value,
            address: {
                street: overlay.querySelector('#av-street').value,
                barangay: overlay.querySelector('#av-barangay').value,
                city: overlay.querySelector('#av-city').value,
                zipCode: overlay.querySelector('#av-zipCode').value,
                province: overlay.querySelector('#av-province').value,
                country: overlay.querySelector('#av-country').value,
            },
            contact: {
                phone: overlay.querySelector('#av-phone').value,
                email: overlay.querySelector('#av-email').value,
            },
            is1099: overlay.querySelector('#av-is1099').checked,
            timestamp: new Date().toISOString()
        };

        // Export data to a local JSON file
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vendorData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (vendorData.lastName || 'New_Vendor') + ".json");
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
            console.log("Vendor saved. Form left open.");
        }
    };

    // Event Listeners
    btnCloseX.addEventListener('click', closeForm);
    btnCancel.addEventListener('click', closeForm);
    
    // Stop click propagation on the modal window so clicking the background overlay does NOT close it
    overlay.querySelector('.av-modal').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Dropdown toggle logic
    btnToggleDropdown.addEventListener('click', () => {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    // Dropdown item selection logic
    overlay.querySelectorAll('.av-dropdown-item, .ac-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            currentSaveMode = e.target.getAttribute('data-action');
            btnSaveAction.textContent = e.target.textContent;
            dropdownMenu.style.display = 'none';
        });
    });

    // Hide dropdown if clicked outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.av-split-btn-group')) {
            dropdownMenu.style.display = 'none';
        }
    });

    // Save button click
    btnSaveAction.addEventListener('click', saveVendor);
}
