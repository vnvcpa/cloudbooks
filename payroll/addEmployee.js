// payroll/addEmployee.js

export function init(containerId) {
    // 1. Remove existing overlay if it already exists to prevent duplicates
    let existing = document.getElementById('addEmployeeOverlay');
    if (existing) existing.remove();

    // 2. Create the overlay container
    const overlay = document.createElement('div');
    overlay.id = 'addEmployeeOverlay';
    
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
            .ae-modal {
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
            .ae-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
            .ae-header-row h2 { margin: 0; font-size: 16px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
            .ae-close-x { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; line-height: 1; padding: 0; }
            .ae-close-x:hover { color: #000; }
            
            .ae-row { display: flex; margin-bottom: 12px; align-items: baseline; }
            .ae-label { width: 140px; font-size: 14px; }
            .ae-label-indent { width: 120px; padding-left: 20px; font-size: 14px; }
            
            .ae-input-line {
                flex: 1;
                border: none;
                border-bottom: 1px solid #000;
                padding: 4px 0;
                font-size: 14px;
                background: transparent;
                outline: none;
                transition: border-bottom-color 0.2s;
            }
            .ae-input-line:focus { border-bottom: 2px solid var(--primary-dark); }
            .ae-input-half { max-width: 200px; }
            
            .ae-subtext { font-size: 12px; color: #333; text-align: center; margin-top: 4px; }
            
            .ae-footer { display: flex; justify-content: flex-end; align-items: center; gap: 15px; margin-top: 30px; }
            .ae-btn-cancel { background: transparent; border: none; color: #333; cursor: pointer; font-size: 14px; }
            .ae-btn-cancel:hover { text-decoration: underline; }
            
            /* Split Button Styling */
            .ae-split-btn-group { display: flex; position: relative; }
            .ae-split-btn-main { background: transparent; border: none; font-size: 14px; cursor: pointer; padding-right: 5px; }
            .ae-split-btn-arrow { background: transparent; border: none; font-size: 10px; cursor: pointer; padding-left: 5px; display:flex; align-items:center; }
            .ae-dropdown-menu { 
                display: none; position: absolute; bottom: 100%; right: 0; background: #fff; 
                border: 1px solid #ccc; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 130px; z-index: 1000;
            }
            .ae-dropdown-item { padding: 10px 15px; font-size: 13px; cursor: pointer; }
            .ae-dropdown-item:hover { background: #f0f0f0; }
        </style>

        <div class="ae-modal">
            <div class="ae-header-row">
                <h2>EMPLOYEE:</h2>
                <button class="ae-close-x" id="ae-btnCloseX" title="Close">&times;</button>
            </div>

            <div class="ae-row" style="align-items: flex-start;">
                <label class="ae-label" style="padding-top: 4px;">Employee Name:</label>
                <div style="display: flex; gap: 15px; flex: 1;">
                    <div style="flex: 2;">
                        <input type="text" class="ae-input-line" id="ae-lastName" style="width: 100%;">
                        <div class="ae-subtext">[Last Name]</div>
                    </div>
                    <div style="flex: 1; max-width: 60px;">
                        <input type="text" class="ae-input-line" id="ae-mi" style="width: 100%;">
                        <div class="ae-subtext">[MI]</div>
                    </div>
                    <div style="flex: 2;">
                        <input type="text" class="ae-input-line" id="ae-firstName" style="width: 100%;">
                        <div class="ae-subtext">[First Name]</div>
                    </div>
                </div>
            </div>

            <div class="ae-row"><label class="ae-label">Full Name:</label><input type="text" class="ae-input-line" id="ae-fullName"></div>
            <div class="ae-row"><label class="ae-label">Job Title:</label><input type="text" class="ae-input-line" id="ae-jobTitle"></div>
            <div class="ae-row"><label class="ae-label">Address</label></div>
            
            <div class="ae-row"><label class="ae-label-indent">Street:</label><input type="text" class="ae-input-line" id="ae-street"></div>
            <div class="ae-row"><label class="ae-label-indent">Barangay:</label><input type="text" class="ae-input-line" id="ae-barangay"></div>
            <div class="ae-row"><label class="ae-label-indent">Town/City:</label><input type="text" class="ae-input-line" id="ae-city"></div>
            <div class="ae-row"><label class="ae-label-indent">ZIP Code:</label><input type="text" class="ae-input-line ae-input-half" id="ae-zipCode"></div>
            <div class="ae-row"><label class="ae-label-indent">Province/State:</label><input type="text" class="ae-input-line ae-input-half" id="ae-province"></div>
            <div class="ae-row"><label class="ae-label-indent">Country:</label><input type="text" class="ae-input-line ae-input-half" id="ae-country"></div>
            
            <div class="ae-row"><label class="ae-label">Phone:</label><input type="text" class="ae-input-line ae-input-half" id="ae-phone"></div>
            <div class="ae-row"><label class="ae-label">Email:</label><input type="text" class="ae-input-line" id="ae-email"></div>
            
            <div class="ae-row" style="margin-top: 15px;">
                <label class="ae-label">Is Active:</label>
                <input type="checkbox" id="ae-isActive" checked style="width: 16px; height: 16px; cursor: pointer;">
            </div>

            <div class="ae-footer">
                <div class="ae-split-btn-group">
                    <button class="ae-split-btn-main" id="ae-btnSaveAction">Save & Close</button>
                    <button class="ae-split-btn-arrow" id="ae-btnToggleDropdown">▼</button>
                    <div class="ae-dropdown-menu" id="ae-dropdownMenu">
                        <div class="ae-dropdown-item" data-action="save">Save</div>
                        <div class="ae-dropdown-item" data-action="saveNew">Save & New</div>
                        <div class="ae-dropdown-item" data-action="saveClose">Save & Close</div>
                    </div>
                </div>
                <button class="ae-btn-cancel" id="ae-btnCancel">Cancel</button>
            </div>
        </div>
    `;

    // 4. Attach to body
    document.body.appendChild(overlay);

    // 5. Establish Logic
    let currentSaveMode = 'saveClose';
    
    // DOM Elements
    const btnCloseX = overlay.querySelector('#ae-btnCloseX');
    const btnCancel = overlay.querySelector('#ae-btnCancel');
    const btnSaveAction = overlay.querySelector('#ae-btnSaveAction');
    const btnToggleDropdown = overlay.querySelector('#ae-btnToggleDropdown');
    const dropdownMenu = overlay.querySelector('#ae-dropdownMenu');
    
    // Close form function
    const closeForm = () => { overlay.remove(); };

    // Clear form function
    const clearForm = () => {
        const inputs = overlay.querySelectorAll('input[type="text"]');
        inputs.forEach(input => input.value = '');
        overlay.querySelector('#ae-isActive').checked = true; // Default active for new employees
        overlay.querySelector('#ae-lastName').focus();
    };

    // Save Function (Saves locally to a JSON file)
    const saveEmployee = () => {
        const employeeData = {
            lastName: overlay.querySelector('#ae-lastName').value,
            mi: overlay.querySelector('#ae-mi').value,
            firstName: overlay.querySelector('#ae-firstName').value,
            fullName: overlay.querySelector('#ae-fullName').value,
            jobTitle: overlay.querySelector('#ae-jobTitle').value,
            address: {
                street: overlay.querySelector('#ae-street').value,
                barangay: overlay.querySelector('#ae-barangay').value,
                city: overlay.querySelector('#ae-city').value,
                zipCode: overlay.querySelector('#ae-zipCode').value,
                province: overlay.querySelector('#ae-province').value,
                country: overlay.querySelector('#ae-country').value,
            },
            contact: {
                phone: overlay.querySelector('#ae-phone').value,
                email: overlay.querySelector('#ae-email').value,
            },
            isActive: overlay.querySelector('#ae-isActive').checked,
            timestamp: new Date().toISOString()
        };

        // Export data to a local JSON file
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(employeeData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (employeeData.lastName || 'New_Employee') + ".json");
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
            console.log("Employee saved. Form left open.");
        }
    };

    // Event Listeners
    btnCloseX.addEventListener('click', closeForm);
    btnCancel.addEventListener('click', closeForm);
    
    // Stop click propagation on the modal window so clicking the background overlay does NOT close it
    overlay.querySelector('.ae-modal').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Dropdown toggle logic
    btnToggleDropdown.addEventListener('click', () => {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    // Dropdown item selection logic
    overlay.querySelectorAll('.ae-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            currentSaveMode = e.target.getAttribute('data-action');
            btnSaveAction.textContent = e.target.textContent;
            dropdownMenu.style.display = 'none';
        });
    });

    // Hide dropdown if clicked outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ae-split-btn-group')) {
            dropdownMenu.style.display = 'none';
        }
    });

    // Save button click
    btnSaveAction.addEventListener('click', saveEmployee);
}
