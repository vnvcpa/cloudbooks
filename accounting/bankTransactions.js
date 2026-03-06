// accounting/bankTransactions.js

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getLocalSession } from "../auth/authManager.js";
import { init as openUploadModal } from "./uploadBankTransactions.js";
import { init as openAddCoaModal } from "../settings/addChartOfAccount.js";
import { formatCurrency } from "../settings/multicurrency.js";

const firebaseConfig = {
    apiKey: "AIzaSyAH-mM4QI_yLxJY1iUAmaJD-mQpEaxeugw",
    authDomain: "vnvcloudbook.firebaseapp.com",
    projectId: "vnvcloudbook",
    storageBucket: "vnvcloudbook.firebasestorage.app"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export function init(containerId, entityId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const session = getLocalSession();
    if (!session.companyId || session.companyId === 'null') {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #d9534f;">Please set up your company workspace first.</div>`;
        return;
    }

    container.innerHTML = `
        <style>
            .bt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .bt-header h3 { margin: 0; font-size: 20px; color: var(--primary-dark); }
            
            /* ========================================= */
            /* FLUID CONTROLS BAR                        */
            /* ========================================= */
            .bt-ctrl-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 15px; margin-bottom: 20px; }
            .bt-ctrl-group { display: flex; align-items: center; gap: 8px; position: relative; }
            
            /* Oval Hover Inputs (Hidden by default, visible on hover) */
            .bt-oval-input { 
                padding: 6px 14px; 
                border: 1px solid transparent; 
                border-radius: 20px; 
                font-size: 13px; 
                outline: none; 
                color: #000; 
                background: transparent; 
                transition: border-color 0.2s, width 0.1s ease-out; 
                appearance: none; 
                -webkit-appearance: none; 
                height: 32px; 
                box-sizing: border-box; 
                cursor: pointer;
            }
            .bt-oval-input:hover { border-color: #ccc; }
            .bt-oval-input:focus { border-color: var(--primary-dark); }
            
            select.bt-oval-input { 
                background-image: url('data:image/svg+xml;utf8,<svg fill="black" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>'); 
                background-repeat: no-repeat; 
                background-position-x: calc(100% - 12px); 
                background-position-y: center; 
                background-size: 16px; 
                padding-right: 42px; /* Increased to prevent text clipping */
            }
            
            /* Specific Group Overlaps & Layouts */
            .grp-acc { position: relative; order: 1; }
            /*.bt-ctrl-lbl { font-weight: 600; font-size: 12px; color: var(--primary-dark); text-transform: uppercase; position: relative; z-index: 2; pointer-events: none; }*/
            .bt-ctrl-lbl { display: inline-block; font-weight: 600; font-size: 12px; color: #ffffff; background: var(--primary-dark); padding: 4px; text-transform: uppercase; position: relative; z-index: 2; pointer-events: none; line-height: 1; vertical-align: middle; border-radius: 20px; }
            
            /* Slides the border exactly behind the 'O' in ACCOUNT: */
            #bt-filterAccount { margin-left: -40px; padding-left: 45px; position: relative; z-index: 1; }
            
            .grp-search { order: 2; flex: 1; display: flex; justify-content: center; }
            .bt-search { width: 100%; max-width: 400px; padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; outline: none; height: 32px; box-sizing: border-box; color: #000; }
            
            .grp-date { order: 3; justify-content: flex-end; }
            
            /* Headless Date Pickers (Visually hidden but functional) */
            .bt-headless-date { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; border: none; top: 15px; left: 50%; z-index: -1; }
            
            /* Persistent Oval Border for Active Date Display */
            #bt-date-display-container {
                border: 1px solid #ccc;
                border-radius: 20px;
                padding: 4px 14px;
                background: #fff;
                align-items: center;
                gap: 8px;
                height: 32px;
                box-sizing: border-box;
            }
            #bt-date-display-text { font-size: 13px; font-weight: 500; color: #000; white-space: nowrap; }

            /* Responsive Cascading Controls */
            @media (max-width: 1100px) {
                .bt-ctrl-bar { row-gap: 2px; } 
                .grp-acc { flex: 1 1 100%; margin-bottom: 5px; }
                .grp-date { order: 2; justify-content: flex-start; flex: 1; }
                .grp-search { order: 3; justify-content: flex-end; flex: initial; }
                .bt-search { width: 250px; }
            }
            @media (max-width: 650px) {
                .bt-ctrl-bar { row-gap: 2px; }
                .grp-date { flex: 1 1 100%; margin-bottom: 5px; }
                .grp-search { flex: 1 1 100%; justify-content: flex-start; width: 100%; }
                .bt-search { max-width: 100%; width: 100%; }
            }

            /* Header Options */
            .bt-options-wrapper { position: relative; display: inline-block; cursor: pointer; }
            .bt-btn-options { background: transparent; color: #333; border: none; padding: 6px 0; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; outline: none; }
            .bt-btn-options:hover { color: var(--primary-dark); }
            .bt-dropdown { display: none; position: absolute; top: 100%; right: 0; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 4px; border: 1px solid #eee; z-index: 100; min-width: 180px; }
            .bt-dropdown div { padding: 10px 15px; font-size: 13px; cursor: pointer; color: #333; }
            .bt-dropdown div:hover { background: #f4f7f9; color: var(--primary-dark); }
            
            .bt-batch-bar { display: none; padding: 10px 15px; background: #e3f2fd; border-radius: 4px; margin-bottom: 15px; align-items: center; gap: 12px; border: 1px solid #bbdefb; }
            
            /* ========================================= */
            /* ABSOLUTE GRID LOCKING ARCHITECTURE        */
            /* ========================================= */
            .bt-table { 
                --col-chk: 24px;
                --col-date: 4.5rem;
                --col-vend: 18rem;
                --col-cat: 18rem;
                --col-desc: 1fr;
                --col-amt: 7rem;
                --col-bal: 7rem;
                --col-post: 2.25rem;
                --col-split: 2.8125rem;
                --gap: 0.5rem;
                width: 100%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-radius: 6px 6px 0 0; overflow-x: auto; 
            }
            .bt-table-inner { min-width: 65rem; }
            
            .bt-thead, .bt-row-group, .bt-bal-row { display: grid; gap: 0 var(--gap); padding: 10px 15px; }

            .bt-thead { background: #f4f7f9; border-bottom: 2px solid #c0c7d0; }
            .bt-th { padding: 0; display: flex; align-items: center; font-weight: 600; font-size: 12px; color: var(--primary-dark); text-transform: uppercase; position: relative; }
            .bt-th-sortable { cursor: pointer; user-select: none; }
            .bt-th-sortable:hover { opacity: 0.8; }
            .bt-resizer { position: absolute; right: -6px; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 2; }
            .bt-resizer:hover { background: rgba(0,0,0,0.1); }
            
            .bt-row-group { border-bottom: 1px solid #dcdcdc; transition: background-color 0.2s; background-color: #fff; align-items: end; }
            .bt-row-group:hover { background-color: #f1f8ff !important; }
            .row-reviewed { background-color: #f4fbf4; }
            .row-split { background-color: #f0f7ff; }

            .bt-cell { padding: 0; font-size: 13px; color: #000; display: flex; flex-direction: column; justify-content: flex-end; }
            .bt-cell-chk { text-align: center; }
            .bt-cell-desc { line-height: 1.3; }
            
            .bt-th-amt, .bt-th-bal, .bt-th-post, .bt-th-split { justify-content: flex-end; }
            .bt-cell-amt, .bt-cell-bal { text-align: right; align-items: flex-end; }
            .bt-cell-post, .bt-cell-split { text-align: right; align-items: flex-end; }

            .bt-bal-row { background: #fcfcfc; border-bottom: 2px solid #c0c7d0; font-weight: 600; font-size: 13px; align-items: center; }
            .bt-bal-label { padding: 0; text-align: right; color: #666; }
            .bt-bal-amt { padding: 0; text-align: right; color: #000; }

            .inline-lbl { display: none; font-weight: 600; font-size: 11px; color: var(--primary-dark); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }

            .cat-select { width: 100%; padding: 2px 0; border: none; border-radius: 0; font-size: 13px; background: transparent; outline: none; appearance: none; color: #000; }
            .cat-select.is-empty { color: #999; }
            .cat-select option { color: #000; }
            .cat-select option[value=""] { color: #999; }
            
            .solid-border { border-bottom: 1px solid #ccc; width: 100%; display: inline-block; padding-bottom: 2px; min-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .dashed-border { border-bottom: 1px dashed #81c784; width: 100%; display: inline-block; padding-bottom: 2px; min-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            .bt-cell-desc .solid-border, .bt-cell-desc .dashed-border { white-space: normal; overflow: visible; word-break: break-word; }
            .bt-cell-amt .solid-border, .bt-cell-amt .dashed-border, .bt-cell-bal .solid-border, .bt-cell-bal .dashed-border { text-align: right; }

            .txt-link { font-weight: 600; font-size: 13px; cursor: pointer; color: var(--primary-dark); text-decoration: none; transition: opacity 0.2s; }
            .txt-link:hover { text-decoration: underline; opacity: 0.8; }
            .txt-link.post { color: #2e7d32; }
            .txt-link.undo { color: #999; font-weight: normal; }
            .txt-green { color: #2e7d32; font-weight: 500; font-size: 16px; }
            .txt-red { color: #d32f2f; font-weight: 500; font-size: 13px; }

            /* Pagination Controls */
            .bt-pagination { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #fff; border: 1px solid #eaedf1; border-top: none; border-radius: 0 0 6px 6px; font-size: 13px; color: #666; }
            .bt-page-controls { display: flex; align-items: center; gap: 15px; }
            .bt-page-btn { background: #f4f7f9; border: 1px solid #ccc; padding: 5px 12px; border-radius: 4px; cursor: pointer; color: #333; transition: background 0.2s; font-size: 13px; }
            .bt-page-btn:hover:not(:disabled) { background: #e2e6ea; }
            .bt-page-btn:disabled { opacity: 0.5; cursor: not-allowed; }

            /* ========================================= */
            /* CASCADING MATRIX LOGIC                    */
            /* ========================================= */

            @media (min-width: 1401px) {
                .bt-thead, .bt-row-group, .bt-bal-row { grid-template-columns: var(--col-chk) var(--col-date) var(--col-vend) var(--col-cat) var(--col-desc) var(--col-amt) var(--col-bal) var(--col-post) var(--col-split); }
                
                .bt-cell-chk, .bt-th-chk { grid-column: 1; grid-row: 1; }
                .bt-cell-date, .bt-th-date { grid-column: 2; grid-row: 1; }
                .bt-cell-vend, .bt-th-vend { grid-column: 3; grid-row: 1; }
                .bt-cell-cat, .bt-th-cat { grid-column: 4; grid-row: 1; }
                .bt-cell-desc, .bt-th-desc { grid-column: 5; grid-row: 1; }
                .bt-cell-amt, .bt-th-amt { grid-column: 6; grid-row: 1; }
                .bt-cell-bal, .bt-th-bal { grid-column: 7; grid-row: 1; }
                .bt-cell-post, .bt-th-post { grid-column: 8; grid-row: 1; }
                .bt-cell-split, .bt-th-split { grid-column: 9; grid-row: 1; }
                
                .bt-bal-label { grid-column: 1 / 7; }
                .bt-bal-amt { grid-column: 7; }
            }

            @media (max-width: 1400px) and (min-width: 1101px) {
                .bt-thead, .bt-row-group, .bt-bal-row { grid-template-columns: var(--col-chk) var(--col-date) 1fr 1fr var(--col-amt) var(--col-bal) var(--col-post) var(--col-split); }
                
                .bt-th-desc { display: none; }
                .lbl-desc { display: block; }
                .bt-row-group { grid-template-rows: auto auto; }
                
                .bt-cell-chk, .bt-th-chk { grid-column: 1; grid-row: 1; }
                .bt-cell-date, .bt-th-date { grid-column: 2; grid-row: 1; }
                .bt-cell-vend, .bt-th-vend { grid-column: 3; grid-row: 1; }
                .bt-cell-cat, .bt-th-cat { grid-column: 4; grid-row: 1; }
                .bt-cell-amt, .bt-th-amt { grid-column: 5; grid-row: 1; }
                .bt-cell-bal, .bt-th-bal { grid-column: 6; grid-row: 1; }
                .bt-cell-post, .bt-th-post { grid-column: 7; grid-row: 1; }
                .bt-cell-split, .bt-th-split { grid-column: 8; grid-row: 1; }
                
                .bt-cell-desc { grid-column: 3 / 7; grid-row: 2; margin-top: 8px; }
                .bt-bal-label { grid-column: 1 / 6; }
                .bt-bal-amt { grid-column: 6; }
            }

            @media (max-width: 1100px) and (min-width: 901px) {
                .bt-table-inner { min-width: 59rem; }
                .bt-thead, .bt-row-group, .bt-bal-row { grid-template-columns: var(--col-chk) var(--col-date) 1fr 1fr var(--col-amt) var(--col-bal); }
                
                .bt-th-desc, .bt-th-post, .bt-th-split { display: none; }
                .lbl-desc { display: block; }
                .bt-row-group { grid-template-rows: auto auto; }
                
                .bt-cell-chk, .bt-th-chk { grid-column: 1; grid-row: 1; }
                .bt-cell-date, .bt-th-date { grid-column: 2; grid-row: 1; }
                .bt-cell-vend, .bt-th-vend { grid-column: 3; grid-row: 1; }
                .bt-cell-cat, .bt-th-cat { grid-column: 4; grid-row: 1; }
                .bt-cell-amt, .bt-th-amt { grid-column: 5; grid-row: 1; }
                .bt-cell-bal, .bt-th-bal { grid-column: 6; grid-row: 1; }
                
                .bt-cell-desc { grid-column: 3 / 5; grid-row: 2; margin-top: 8px; }
                .bt-cell-post { grid-column: 5; grid-row: 2; margin-top: 8px; align-items: flex-end; }
                .bt-cell-split { grid-column: 6; grid-row: 2; margin-top: 8px; align-items: flex-end; }
                
                .bt-bal-label { grid-column: 1 / 6; }
                .bt-bal-amt { grid-column: 6; }
            }

            @media (max-width: 900px) and (min-width: 769px) {
                .bt-table-inner { min-width: 100%; }
                .bt-thead, .bt-row-group, .bt-bal-row { grid-template-columns: var(--col-chk) var(--col-date) 1fr var(--col-amt) var(--col-bal); }
                
                .bt-th-cat, .bt-th-desc, .bt-th-post, .bt-th-split { display: none; }
                .lbl-cat, .lbl-desc { display: block; }
                .bt-row-group { grid-template-rows: auto auto auto; }
                
                .bt-cell-chk, .bt-th-chk { grid-column: 1; grid-row: 1; }
                .bt-cell-date, .bt-th-date { grid-column: 2; grid-row: 1; }
                .bt-cell-vend, .bt-th-vend { grid-column: 3; grid-row: 1; }
                .bt-cell-amt, .bt-th-amt { grid-column: 4; grid-row: 1; }
                .bt-cell-bal, .bt-th-bal { grid-column: 5; grid-row: 1; }
                
                .bt-cell-cat { grid-column: 3; grid-row: 2; margin-top: 8px; }
                .bt-cell-post { grid-column: 5; grid-row: 2; margin-top: 8px; align-items: flex-end; }
                
                .bt-cell-desc { grid-column: 3; grid-row: 3; margin-top: 8px; }
                .bt-cell-split { grid-column: 5; grid-row: 3; margin-top: 8px; align-items: flex-end; }
                
                .bt-bal-label { grid-column: 1 / 5; }
                .bt-bal-amt { grid-column: 5; }
            }

            @media (max-width: 768px) {
                .bt-table { --gap: 0.5rem; }
                .bt-table-inner { min-width: 100%; }
                
                .bt-thead, .bt-row-group, .bt-bal-row { grid-template-columns: 24px 1fr 6.5rem 6.5rem; padding: 10px 8px; }
                
                .bt-th-vend, .bt-th-cat, .bt-th-desc, .bt-th-post, .bt-th-split { display: none !important; }
                .lbl-vend, .lbl-cat, .lbl-desc { display: block; }
                .bt-row-group { grid-template-rows: auto auto auto auto; }
                
                .bt-cell-chk, .bt-th-chk { grid-column: 1; grid-row: 1; }
                .bt-cell-date, .bt-th-date { grid-column: 2; grid-row: 1; }
                .bt-cell-amt, .bt-th-amt { grid-column: 3; grid-row: 1; }
                .bt-cell-bal, .bt-th-bal { grid-column: 4; grid-row: 1; }
                
                .bt-cell-vend { grid-column: 2 / 4; grid-row: 2; margin-top: 6px; }
                .bt-cell-post { grid-column: 4; grid-row: 2; margin-top: 6px; align-items: flex-end; }
                
                .bt-cell-cat { grid-column: 2 / 4; grid-row: 3; margin-top: 6px; }
                .bt-cell-split { grid-column: 4; grid-row: 3; margin-top: 6px; align-items: flex-end; }
                
                .bt-cell-desc { grid-column: 2 / 5; grid-row: 4; margin-top: 6px; }

                .bt-bal-label { grid-column: 1 / 4; padding-right: 10px; }
                .bt-bal-amt { grid-column: 4; }
                .bt-pagination { flex-direction: column; gap: 15px; }
            }
        </style>

        <div class="bt-header">
            <div>
                <h3>Transactions</h3>
            </div>
            <div class="bt-options-wrapper" id="bt-optionsGroup">
                <button class="bt-btn-options" id="bt-btnOptions">
                    Options <span style="font-size:10px;">▼</span>
                </button>
                <div class="bt-dropdown" id="bt-primaryMenu">
                    <div id="bt-optConnect">Connect Bank</div>
                    <div>Add Manual Deposit</div>
                    <div>Add Manual Withdrawal</div>
                    <div>Add CC Charge</div>
                    <div>Add CC Credit</div>
                    <div id="bt-optUpload">Upload Transactions</div>
                    <div style="border-top: 1px solid #eaedf1; margin-top: 4px; padding-top: 8px;">Reconcile</div>
                </div>
            </div>
        </div>

        <div class="bt-ctrl-bar">
            <div class="bt-ctrl-group grp-acc">
                <span class="bt-ctrl-lbl">Account:</span>
                <select class="bt-oval-input" id="bt-filterAccount">
                    <option value="">Select Account...</option>
                </select>
            </div>
            
            <div class="bt-ctrl-group grp-search">
                <input type="text" id="bt-search" class="bt-search" placeholder="Search date, description, or amount...">
            </div>
            
            <div class="bt-ctrl-group grp-date">
                <select class="bt-oval-input" id="bt-dateMode">
                    <option value="all">All Dates</option>
                    <option value="eq">Equals</option>
                    <option value="neq">Not equals</option>
                    <option value="before">Before</option>
                    <option value="on_before">On or before</option>
                    <option value="after">After</option>
                    <option value="on_after">On or after</option>
                    <option value="between">Between / Range</option>
                    <option value="not_between">Not between</option>
                </select>
                
                <input type="date" id="bt-date1" class="bt-headless-date">
                <input type="date" id="bt-date2" class="bt-headless-date">
                
                <div id="bt-date-display-container" style="display:none;">
                    <span id="bt-date-display-text"></span>
                    <button id="bt-date-clear" title="Clear Filter">&times;</button>
                </div>
            </div>
        </div>

        <div class="bt-batch-bar" id="bt-batchBar">
            <span style="font-size: 13px; font-weight: 600; color: var(--primary-dark);" id="bt-batchCount">0 selected</span>
            <button class="txt-link post" id="bt-btnBatchPost" style="border:1px solid #ccc; padding:4px 8px; border-radius: 4px; background:#fff;">Post Selected</button>
            <button class="txt-link undo" id="bt-btnBatchUndo">Undo Selected</button>
            <button class="txt-link undo" id="bt-btnBatchDelete" style="color: #d32f2f;">Delete Selected</button>
        </div>

        <div class="bt-table">
            <div class="bt-table-inner">
                <div class="bt-thead" id="bt-thead">
                    <div class="bt-th bt-th-chk" style="justify-content:center;"><input type="checkbox" id="bt-selectAll"></div>
                    <div class="bt-th bt-th-sortable bt-th-date" id="bt-headerDate">DATE <span id="bt-sortArrow" style="margin-left:5px;">&#8595;</span></div>
                    <div class="bt-th bt-th-vend">VENDOR<div class="bt-resizer"></div></div>
                    <div class="bt-th bt-th-cat">CATEGORY<div class="bt-resizer"></div></div>
                    <div class="bt-th bt-th-desc">DESCRIPTION<div class="bt-resizer"></div></div>
                    <div class="bt-th bt-th-amt">AMOUNT<div class="bt-resizer"></div></div>
                    <div class="bt-th bt-th-bal">BALANCE</div>
                    <div class="bt-th bt-th-post">POST</div>
                    <div class="bt-th bt-th-split">SPLIT</div>
                </div>
                <div id="bt-listContainer">
                    <div style="padding: 40px; text-align: center; color: #666;">Select an account to view transactions.</div>
                </div>
            </div>
        </div>
        
        <div class="bt-pagination" id="bt-pagination" style="display:none;">
            <div id="bt-page-info">Showing 0-0 of 0</div>
            <div class="bt-page-controls">
                <label style="margin-right: 10px;">Rows per page: 
                    <select class="bt-oval-input" style="border: 1px solid #ccc; width:auto;" id="bt-rowsPerPage">
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="75">75</option>
                        <option value="100">100</option>
                    </select>
                </label>
                <button class="bt-page-btn" id="bt-btnPrev">Prev</button>
                <button class="bt-page-btn" id="bt-btnNext">Next</button>
            </div>
        </div>
    `;

    const elAccount = document.getElementById('bt-filterAccount');
    const dateMode = document.getElementById('bt-dateMode');
    const elDate1 = document.getElementById('bt-date1');
    const elDate2 = document.getElementById('bt-date2');
    const dateDisplayContainer = document.getElementById('bt-date-display-container');
    const dateDisplayText = document.getElementById('bt-date-display-text');
    const dateClearBtn = document.getElementById('bt-date-clear');
    const elSearch = document.getElementById('bt-search');
    
    const listContainer = document.getElementById('bt-listContainer');
    const selectAll = document.getElementById('bt-selectAll');
    const batchBar = document.getElementById('bt-batchBar');
    const batchCount = document.getElementById('bt-batchCount');
    
    let sortOrder = 'desc'; 
    let chartOfAccounts = [];
    let vendorsList = [];
    let bankAccountsMap = {};
    let currentTransactions = []; 
    let currentPage = 1;
    let rowsPerPage = 25;

    // --- Core Action: Dynamic Width Calculator for Selects ---
    const adjustSelectWidth = (selElement, extraPadding) => {
        let span = document.createElement('span');
        span.style.font = window.getComputedStyle(selElement).font;
        span.style.visibility = 'hidden';
        span.style.whiteSpace = 'pre';
        span.style.position = 'absolute';
        span.textContent = selElement.options[selElement.selectedIndex]?.text || selElement.value || '';
        document.body.appendChild(span);
        const newWidth = span.offsetWidth + extraPadding;
        selElement.style.width = newWidth + 'px';
        span.remove();
    };

    // Header Options Actions
    const optionsGroup = document.getElementById('bt-optionsGroup');
    const primaryMenu = document.getElementById('bt-primaryMenu');
    optionsGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        primaryMenu.style.display = primaryMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => primaryMenu.style.display = 'none');
    document.getElementById('bt-optUpload').addEventListener('click', () => openUploadModal(containerId));

    // Smart Resizer
    const initResizer = () => {
        if(window.innerWidth <= 768) return; 
        const table = document.querySelector('.bt-table');
        const headers = table.querySelectorAll('.bt-th');
        const varNames = ['--col-chk', '--col-date', '--col-vend', '--col-cat', '--col-desc', '--col-amt', '--col-bal'];
        
        headers.forEach((th, i) => {
            const resizer = th.querySelector('.bt-resizer');
            if (!resizer || !varNames[i]) return;
            let startX, startWidth;
            resizer.addEventListener('mousedown', (e) => {
                startX = e.pageX;
                startWidth = th.offsetWidth;
                const onMouseMove = (e) => {
                    const diff = e.pageX - startX;
                    const newWidth = Math.max(30, startWidth + diff);
                    table.style.setProperty(varNames[i], newWidth + 'px');
                };
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    };
    initResizer();

    const loadDependencies = async () => {
        try {
            chartOfAccounts = [];
            vendorsList = [];
            elAccount.innerHTML = '<option value="">Select Account...</option>';
            
            const qCoa = query(collection(db, "chartOfAccounts"), where("companyId", "==", session.companyId));
            const snapCoa = await getDocs(qCoa);
            snapCoa.forEach(doc => {
                const data = doc.data();
                chartOfAccounts.push({ id: doc.id, ...data });
                if (data.type === 'Asset' || data.type === 'Liability') {
                    bankAccountsMap[doc.id] = data;
                    const opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.textContent = `${data.code} - ${data.name}`;
                    elAccount.appendChild(opt);
                }
            });

            const qVend = query(collection(db, "vendors"), where("companyId", "==", session.companyId));
            const snapVend = await getDocs(qVend);
            snapVend.forEach(doc => vendorsList.push({ id: doc.id, ...doc.data() }));

            // Adjust widths instantly on load
            adjustSelectWidth(elAccount, 90); 
            adjustSelectWidth(dateMode, 60);

        } catch(e) { console.error(e); }
    };

    const buildCategoryDropdown = (selectedCatId) => {
        let options = `<option value="">[Select Category]</option>`;
        chartOfAccounts.forEach(acc => {
            const isSelected = selectedCatId === acc.id ? 'selected' : '';
            options += `<option value="${acc.id}" ${isSelected}>${acc.code} - ${acc.name}</option>`;
        });
        options += `<option value="ADD_NEW" style="font-weight: bold; color: var(--primary-dark);">+ Add New Account</option>`;
        return options;
    };

    const buildVendorDropdown = (selectedVendId) => {
        let options = `<option value="">[Add New or Select a Vendor]</option>`;
        vendorsList.forEach(v => {
            const isSelected = selectedVendId === v.id ? 'selected' : '';
            options += `<option value="${v.id}" ${isSelected}>${v.name || v.companyName}</option>`;
        });
        return options;
    };

    const updateBatchUI = () => {
        const checked = document.querySelectorAll('.bt-row-check:checked');
        if (checked.length > 0) {
            batchBar.style.display = 'flex';
            batchCount.textContent = `${checked.length} selected`;
        } else {
            batchBar.style.display = 'none';
            selectAll.checked = false;
        }
    };

    selectAll.addEventListener('change', (e) => {
        document.querySelectorAll('.bt-row-check').forEach(chk => chk.checked = e.target.checked);
        updateBatchUI();
    });

    const resetFiltersAndFetch = () => {
        currentPage = 1;
        window.refreshBankTransactionsTable();
    };

    // --- Dynamic Headless Date Picker Engine ---
    const updateDateUI = () => {
        const mode = dateMode.value;
        const d1 = elDate1.value;
        const d2 = elDate2.value;
        const requiresTwo = mode === 'between' || mode === 'not_between';

        if (mode === 'all') {
            dateDisplayContainer.style.display = 'none';
            resetFiltersAndFetch();
        } else {
            const isPopulated = requiresTwo ? (d1 && d2) : (d1 !== '');
            if (isPopulated) {
                dateDisplayText.textContent = requiresTwo ? `${d1} and ${d2}` : d1;
                dateDisplayContainer.style.display = 'flex';
                resetFiltersAndFetch();
            } else {
                dateDisplayContainer.style.display = 'none';
            }
        }
    };

    dateMode.addEventListener('change', () => {
        adjustSelectWidth(dateMode, 60);
        elDate1.value = '';
        elDate2.value = '';
        updateDateUI();
        
        // Trigger native calendar programmatically
        if (dateMode.value !== 'all') {
            try { elDate1.showPicker(); } catch(e) { console.warn("Auto-picker not supported by this browser."); }
        }
    });

    elDate1.addEventListener('change', () => {
        updateDateUI();
        const mode = dateMode.value;
        if ((mode === 'between' || mode === 'not_between') && !elDate2.value) {
            try { 
                setTimeout(() => elDate2.showPicker(), 100); 
            } catch(e) {}
        }
    });

    elDate2.addEventListener('change', updateDateUI);

    dateClearBtn.addEventListener('click', () => {
        dateMode.value = 'all';
        adjustSelectWidth(dateMode, 60);
        elDate1.value = '';
        elDate2.value = '';
        updateDateUI();
    });

   elAccount.addEventListener('change', () => {
        adjustSelectWidth(elAccount, 90);
        resetFiltersAndFetch();
    });
    
    elSearch.addEventListener('input', resetFiltersAndFetch);

    document.getElementById('bt-headerDate').addEventListener('click', () => {
        sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        document.getElementById('bt-sortArrow').innerHTML = sortOrder === 'desc' ? '&#8595;' : '&#8593;';
        resetFiltersAndFetch();
    });

    document.getElementById('bt-rowsPerPage').addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderTablePage();
    });

    document.getElementById('bt-btnPrev').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTablePage(); }
    });

    document.getElementById('bt-btnNext').addEventListener('click', () => {
        const totalPages = Math.ceil(currentTransactions.length / rowsPerPage);
        if (currentPage < totalPages) { currentPage++; renderTablePage(); }
    });

    window.refreshBankTransactionsTable = async () => {
        const targetAccountId = elAccount.value;
        if (!targetAccountId) {
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">Select an account to view transactions.</div>`;
            batchBar.style.display = 'none';
            document.getElementById('bt-pagination').style.display = 'none';
            selectAll.checked = false;
            return;
        }

        const mode = dateMode.value;
        const d1 = elDate1.value;
        const d2 = elDate2.value;
        const searchTxt = elSearch.value.toLowerCase();

        try {
            const q = query(collection(db, "bankTransactions"), where("companyId", "==", session.companyId), where("bankAccountId", "==", targetAccountId));
            const snap = await getDocs(q);
            
            let allTxs = [];
            snap.forEach(doc => allTxs.push({ id: doc.id, ...doc.data() }));
            
            allTxs.sort((a, b) => new Date(a.date) - new Date(b.date));

            let runningBalance = 0, displayTxs = [];

            allTxs.forEach(tx => {
                runningBalance += tx.foreignAmount;
                tx.calculatedBalance = runningBalance;
                
                let includeDate = true;
                if (mode !== 'all' && d1) {
                    if (mode === 'eq') includeDate = (tx.date === d1);
                    else if (mode === 'neq') includeDate = (tx.date !== d1);
                    else if (mode === 'before') includeDate = (tx.date < d1);
                    else if (mode === 'on_before') includeDate = (tx.date <= d1);
                    else if (mode === 'after') includeDate = (tx.date > d1);
                    else if (mode === 'on_after') includeDate = (tx.date >= d1);
                    else if (mode === 'between') includeDate = d2 ? (tx.date >= d1 && tx.date <= d2) : (tx.date >= d1);
                    else if (mode === 'not_between') includeDate = d2 ? (tx.date < d1 || tx.date > d2) : (tx.date < d1);
                }

                if (!includeDate) return;

                if (searchTxt && !tx.description.toLowerCase().includes(searchTxt) && !String(Math.abs(tx.foreignAmount)).includes(searchTxt) && !tx.date.includes(searchTxt)) return;
                
                displayTxs.push(tx);
            });

            if (sortOrder === 'desc') displayTxs.reverse();
            currentTransactions = displayTxs;
            renderTablePage(); 

        } catch (e) { 
            console.error(e); 
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #d9534f;">Error loading data.</div>`;
        }
    };

    const renderTablePage = () => {
        if (currentTransactions.length === 0) {
            listContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: #666;">No matching transactions found.</div>`;
            document.getElementById('bt-pagination').style.display = 'none';
            batchBar.style.display = 'none';
            selectAll.checked = false;
            return;
        }

        const totalRows = currentTransactions.length;
        const totalPages = Math.ceil(totalRows / rowsPerPage);
        if (currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
        const paginatedTxs = currentTransactions.slice(startIndex, endIndex);

        document.getElementById('bt-pagination').style.display = 'flex';
        document.getElementById('bt-page-info').textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalRows}`;
        document.getElementById('bt-btnPrev').disabled = currentPage === 1;
        document.getElementById('bt-btnNext').disabled = currentPage === totalPages;

        const targetAccountId = elAccount.value;
        const isCC = bankAccountsMap[targetAccountId].type === 'Liability';
        const currencyCode = paginatedTxs[0]?.currency || 'PHP';

        const chronFirstItem = sortOrder === 'asc' ? paginatedTxs[0] : paginatedTxs[paginatedTxs.length - 1];
        const chronLastItem = sortOrder === 'asc' ? paginatedTxs[paginatedTxs.length - 1] : paginatedTxs[0];
        
        const pageBeginningBal = chronFirstItem.calculatedBalance - chronFirstItem.foreignAmount;
        const pageClosingBal = chronLastItem.calculatedBalance;

        let html = '';
        const balRow = (lbl, amt) => `<div class="bt-bal-row"><div class="bt-bal-label">${lbl}</div><div class="bt-bal-amt">${formatCurrency(amt || 0, currencyCode)}</div></div>`;
        
        html += (sortOrder === 'asc') ? balRow('Beginning Balance', pageBeginningBal) : balRow('Ending Balance', pageClosingBal);

        paginatedTxs.forEach(tx => {
            const isPosted = tx.status !== 'Unreviewed';
            const borderClass = isPosted ? 'dashed-border' : 'solid-border';
            const amtClass = tx.foreignAmount > 0 ? (!isCC ? 'txt-green' : 'txt-red') : (!isCC ? 'txt-red' : 'txt-green');
            
            let vendHtml = '', catHtml = '', postHtml = '', splitHtml = '', statusClass = '';

            if (!isPosted) {
                let defCatId = tx.postedCategoryId || (chartOfAccounts.find(c => c.name === tx.suggestedCategory)?.id || "");
                const vendEmptyCls = tx.vendorId ? '' : 'is-empty';
                const catEmptyCls = defCatId ? '' : 'is-empty';
                
                vendHtml = `
                    <span class="inline-lbl lbl-vend">Vendor</span>
                    <select class="cat-select vend-select-box ${vendEmptyCls}" id="vend-${tx.id}">${buildVendorDropdown(tx.vendorId)}</select>
                `;
                catHtml = `
                    <span class="inline-lbl lbl-cat">Category</span>
                    <select class="cat-select cat-select-box ${catEmptyCls}" id="sel-${tx.id}">${buildCategoryDropdown(defCatId)}</select>
                `;
                postHtml = `<a class="txt-link post btn-post" data-id="${tx.id}">Post</a>`;
                splitHtml = `<a class="txt-link btn-split" data-id="${tx.id}">Split</a>`;
            } else {
                statusClass = tx.status === 'Split' ? 'row-split' : 'row-reviewed';
                const vendName = vendorsList.find(v => v.id === tx.vendorId)?.name || '';
                const catName = tx.status === 'Split' ? `Split (${tx.splits ? tx.splits.length : 0})` : (chartOfAccounts.find(c => c.id === tx.postedCategoryId)?.name || 'Categorized');
                
                vendHtml = `
                    <span class="inline-lbl lbl-vend">Vendor</span>
                    <span class="${borderClass}">${vendName}</span>
                `;
                catHtml = `
                    <span class="inline-lbl lbl-cat">Category</span>
                    <span class="${borderClass}" style="color: #2e7d32; font-weight: 500;">${catName}</span>
                `;
                
                postHtml = `<span class="txt-green">&#10003;</span>`;
                splitHtml = `<a class="txt-link undo cat-btn-undo" data-id="${tx.id}">Undo</a>`;
            }

            html += `
                <div class="bt-row-group ${statusClass}">
                    <div class="bt-cell bt-cell-chk"><input type="checkbox" class="bt-row-check" data-id="${tx.id}"></div>
                    <div class="bt-cell bt-cell-date"><span class="${borderClass}">${tx.date}</span></div>
                    <div class="bt-cell bt-cell-vend"><div style="flex:1; min-width:0;">${vendHtml}</div></div>
                    <div class="bt-cell bt-cell-cat"><div style="flex:1; min-width:0;">${catHtml}</div></div>
                    <div class="bt-cell bt-cell-desc"><span class="inline-lbl lbl-desc">Bank Memo</span><span class="${borderClass}">${tx.description}</span></div>
                    <div class="bt-cell bt-cell-amt ${amtClass}"><span class="${borderClass}">${formatCurrency(Math.abs(tx.foreignAmount), tx.currency)}</span></div>
                    <div class="bt-cell bt-cell-bal"><span class="${borderClass}">${formatCurrency(tx.calculatedBalance, tx.currency)}</span></div>
                    <div class="bt-cell bt-cell-post">${postHtml}</div>
                    <div class="bt-cell bt-cell-split">${splitHtml}</div>
                </div>
            `;
        });

        html += (sortOrder === 'asc') ? balRow('Ending Balance', pageClosingBal) : balRow('Beginning Balance', pageBeginningBal);
        
        listContainer.innerHTML = html;
        selectAll.checked = false;
        updateBatchUI();
        bindRenderedRowEvents();
    };

    const bindRenderedRowEvents = () => {
        document.querySelectorAll('.bt-row-check').forEach(chk => chk.addEventListener('change', updateBatchUI));

        document.querySelectorAll('.cat-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                if (e.target.value && e.target.value !== 'ADD_NEW') e.target.classList.remove('is-empty');
                else e.target.classList.add('is-empty');
                
                if (e.target.classList.contains('cat-select-box') && e.target.value === 'ADD_NEW') {
                    openAddCoaModal(containerId); e.target.value = ''; e.target.classList.add('is-empty');
                }
            });
        });

        document.querySelectorAll('.btn-post').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const txId = e.target.getAttribute('data-id');
                const selVal = document.getElementById(`sel-${txId}`).value;
                const vendVal = document.getElementById(`vend-${txId}`)?.value || null;
                if (!selVal) return alert("Select a category first.");
                e.target.textContent = "Saving...";
                await updateDoc(doc(db, "bankTransactions", txId), { status: 'Reviewed', postedCategoryId: selVal, vendorId: vendVal });
                window.refreshBankTransactionsTable(); 
            });
        });

        document.querySelectorAll('.btn-split').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const txId = e.target.getAttribute('data-id');
                const targetAccountId = elAccount.value;
                const isCC = bankAccountsMap[targetAccountId].type === 'Liability';
                const tx = currentTransactions.find(t => t.id === txId);
                openSplitModal(tx, isCC);
            });
        });

        document.querySelectorAll('.cat-btn-undo').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const txId = e.target.getAttribute('data-id');
                e.target.textContent = "Undo...";
                await updateDoc(doc(db, "bankTransactions", txId), { status: 'Unreviewed', postedCategoryId: null, vendorId: null, splits: null });
                window.refreshBankTransactionsTable(); 
            });
        });
    };

    document.getElementById('bt-btnBatchPost').addEventListener('click', async (e) => {
        e.preventDefault();
        const checked = document.querySelectorAll('.bt-row-check:checked');
        for (let chk of checked) {
            const txId = chk.getAttribute('data-id');
            const sel = document.getElementById(`sel-${txId}`);
            const vend = document.getElementById(`vend-${txId}`);
            if (sel && sel.value && sel.value !== 'ADD_NEW') {
                await updateDoc(doc(db, "bankTransactions", txId), { status: 'Reviewed', postedCategoryId: sel.value, vendorId: vend ? vend.value : null });
            }
        }
        window.refreshBankTransactionsTable();
    });

    document.getElementById('bt-btnBatchUndo').addEventListener('click', async (e) => {
        e.preventDefault();
        const checked = document.querySelectorAll('.bt-row-check:checked');
        for (let chk of checked) {
            const txId = chk.getAttribute('data-id');
            await updateDoc(doc(db, "bankTransactions", txId), { status: 'Unreviewed', postedCategoryId: null, vendorId: null, splits: null });
        }
        window.refreshBankTransactionsTable();
    });

    document.getElementById('bt-btnBatchDelete').addEventListener('click', async (e) => {
        e.preventDefault();
        if(!confirm("Are you sure you want to permanently delete the selected transactions?")) return;
        const checked = document.querySelectorAll('.bt-row-check:checked');
        for (let chk of checked) {
            const txId = chk.getAttribute('data-id');
            await deleteDoc(doc(db, "bankTransactions", txId));
        }
        window.refreshBankTransactionsTable();
    });

    const openSplitModal = (tx, isCC) => {
        let existing = document.getElementById('splitModalOverlay');
        if (existing) existing.remove();

        const typeLabel = !isCC ? (tx.foreignAmount > 0 ? 'Deposit' : 'Withdrawal') : (tx.foreignAmount > 0 ? 'CC Charge' : 'CC Credit');
        const targetAmount = Math.abs(tx.foreignAmount);

        const overlay = document.createElement('div');
        overlay.id = 'splitModalOverlay';
        overlay.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; justify-content: center; align-items: flex-start; padding-top: 50px; overflow-y: auto;`;

        overlay.innerHTML = `
            <style>
                .sp-modal { background: #fff; width: 700px; max-width: 95%; border-radius: 4px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); padding: 30px; font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin-bottom: 50px;}
                .sp-header { display: flex; justify-content: space-between; border-bottom: 2px solid var(--primary-dark); padding-bottom: 10px; margin-bottom: 20px; }
                .sp-title { font-size: 18px; font-weight: 600; color: var(--primary-dark); }
                .sp-amt-display { font-size: 18px; font-weight: bold; color: ${tx.foreignAmount > 0 ? '#2e7d32' : '#d32f2f'}; }
                .sp-desc-box { width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 10px; font-size: 13px; font-family: inherit; resize: vertical; min-height: 60px; margin-bottom: 20px; box-sizing: border-box; }
                
                .sp-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .sp-th { text-align: left; font-size: 12px; color: #666; padding-bottom: 5px; border-bottom: 1px solid #ccc; }
                
                .sp-row-group { background: #fff; }
                .sp-row-group.dragging { opacity: 0.5; background: #f9f9f9; }
                
                .sp-cell { padding: 8px 5px; vertical-align: top; }
                .sp-input { width: 100%; border: none; border-bottom: 1px solid #ccc; padding: 6px 0; font-size: 13px; outline: none; background: transparent; }
                .sp-input:focus { border-bottom: 2px solid var(--primary-dark); }
                .sp-amt-input { width: 120px; text-align: right; }
                
                .sp-desc-input { display: none; width: 100%; resize: none; font-size: 12px; color: #555; padding: 4px 0; border: none; border-bottom: 1px solid #ccc; outline: none; background: transparent; font-family: inherit; }
                .sp-desc-input:focus { border-bottom-color: var(--primary-dark); }
                
                .sp-handle { cursor: grab; color: #ccc; font-size: 16px; padding-right: 5px; user-select: none; }
                
                .sp-menu-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; padding: 0 5px; }
                .sp-menu-dropdown { display: none; position: absolute; right: 10px; top: 30px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 1px solid #ccc; border-radius: 4px; z-index: 10; width: 140px; text-align: left; }
                .sp-menu-item { padding: 10px 12px; font-size: 12px; cursor: pointer; border-bottom: 1px solid #eee; }
                .sp-menu-item:hover { background: #f4f7f9; }
                
                .sp-total-row { font-weight: bold; font-size: 14px; text-align: right; padding: 15px 5px; }
                .sp-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eaedf1; padding-top: 20px; }

                @media (max-width: 768px) { .sp-amt-input { width: 85px; } }
            </style>
            <div class="sp-modal" id="sp-modalBox">
                <div class="sp-header">
                    <div class="sp-title">Split Transaction: ${tx.date} (${typeLabel})</div>
                    <div class="sp-amt-display">${formatCurrency(targetAmount, tx.currency)}</div>
                </div>
                <div style="font-size: 13px; color: #666; margin-bottom: 5px;">Bank Description: ${tx.description}</div>
                <textarea class="sp-desc-box" id="sp-customMemo" placeholder="Optional custom memo/description for this transaction..."></textarea>
                
                <table class="sp-table" id="sp-table-main">
                    <thead>
                        <tr><th style="width:20px;"></th><th class="sp-th">Category</th><th class="sp-th" style="text-align: right;">Amount</th><th style="width:30px;"></th></tr>
                    </thead>
                    <tfoot id="sp-tfoot">
                        <tr>
                            <td colspan="2" class="sp-total-row">Total Assigned:</td>
                            <td class="sp-total-row" id="sp-totalAssigned">0.00</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colspan="2" style="text-align: right; font-size: 12px; color: #666; padding-right: 5px;">Remaining:</td>
                            <td style="font-size: 12px; color: #d32f2f; text-align: right; padding: 0 5px;" id="sp-difference">${targetAmount.toFixed(2)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
                
                <div class="sp-footer">
                    <button class="bt-btn-main" id="sp-btnAddRow" style="background:#fff; color:#666; border:1px solid #ccc; font-size:12px; padding:6px 10px;">+ Add Split Row</button>
                    <div style="display:flex; gap: 10px;">
                        <a href="#" class="txt-link undo" id="sp-btnCancel">Cancel</a>
                        <button class="bt-btn-main" id="sp-btnSave" style="background:#5cb85c; padding:6px 15px;">Save Split</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const spTable = document.getElementById('sp-table-main');
        const tfoot = document.getElementById('sp-tfoot');
        const catOptions = buildCategoryDropdown('');

        const safeMathEval = (str) => {
            try {
                let sanitized = str.replace(/[^0-9+\-*/().]/g, '');
                if (!sanitized) return 0;
                let result = Function(`'use strict'; return (${sanitized})`)();
                return isNaN(result) ? 0 : Number(result);
            } catch(e) { return 0; }
        };

        const calcTotals = () => {
            let sum = 0;
            spTable.querySelectorAll('.sp-amt-input').forEach(inp => {
                let val = parseFloat(inp.value);
                if(!isNaN(val)) sum += val;
            });
            document.getElementById('sp-totalAssigned').textContent = sum.toFixed(2);
            const diff = targetAmount - sum;
            const diffEl = document.getElementById('sp-difference');
            diffEl.textContent = diff.toFixed(2);
            diffEl.style.color = Math.abs(diff) < 0.01 ? '#2e7d32' : '#d32f2f';
        };

        const createRow = () => {
            const tbodyGroup = document.createElement('tbody');
            tbodyGroup.className = 'sp-row-group';
            tbodyGroup.draggable = true;
            tbodyGroup.innerHTML = `
                <tr class="sp-row">
                    <td class="sp-cell" style="padding-top:12px;"><span class="sp-handle">&#8942;&#8942;</span></td>
                    <td class="sp-cell">
                        <select class="sp-input sp-cat-input">${catOptions}</select>
                    </td>
                    <td class="sp-cell" style="text-align: right;">
                        <input type="text" class="sp-input sp-amt-input" placeholder="0.00">
                    </td>
                    <td class="sp-cell" style="text-align: center; position: relative;">
                        <button class="sp-menu-btn">&#8942;</button>
                        <div class="sp-menu-dropdown">
                            <div class="sp-menu-item toggle-desc">Add Description</div>
                            <div class="sp-menu-item del-row" style="color:#d32f2f;">Delete Row</div>
                        </div>
                    </td>
                </tr>
                <tr class="sp-desc-row" style="display:none;">
                    <td></td>
                    <td colspan="2" style="padding: 0 5px 10px 5px;">
                        <textarea class="sp-desc-input" rows="2" placeholder="Line description..."></textarea>
                    </td>
                    <td></td>
                </tr>
            `;
            
            const amtInp = tbodyGroup.querySelector('.sp-amt-input');
            amtInp.addEventListener('blur', (e) => {
                let val = safeMathEval(e.target.value);
                e.target.value = val ? val.toFixed(2) : '';
                calcTotals();
            });

            tbodyGroup.addEventListener('dragstart', () => tbodyGroup.classList.add('dragging'));
            tbodyGroup.addEventListener('dragend', () => tbodyGroup.classList.remove('dragging'));

            spTable.insertBefore(tbodyGroup, tfoot);
        };

        createRow(); createRow();

        spTable.addEventListener('dragover', e => {
            e.preventDefault();
            const draggingGroup = document.querySelector('.sp-row-group.dragging');
            if(!draggingGroup) return;
            const targetGroup = e.target.closest('.sp-row-group');
            if(targetGroup && targetGroup !== draggingGroup) {
                const rect = targetGroup.getBoundingClientRect();
                const offset = e.clientY - rect.top;
                if(offset > rect.height / 2) targetGroup.after(draggingGroup);
                else targetGroup.before(draggingGroup);
            }
        });

        document.getElementById('sp-modalBox').addEventListener('click', (e) => {
            document.querySelectorAll('.sp-menu-dropdown').forEach(m => {
                if (m !== e.target.nextElementSibling) m.style.display = 'none';
            });

            if (e.target.classList.contains('sp-menu-btn')) {
                const menu = e.target.nextElementSibling;
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }

            if (e.target.classList.contains('toggle-desc')) {
                const group = e.target.closest('.sp-row-group');
                const descRow = group.querySelector('.sp-desc-row');
                const descInput = group.querySelector('.sp-desc-input');
                
                if (descRow.style.display === 'table-row') {
                    if (descInput.value.trim() !== '') {
                        alert("Please clear the text before hiding the description box.");
                    } else {
                        descRow.style.display = 'none';
                        descInput.style.display = 'none';
                        e.target.textContent = 'Add Description';
                    }
                } else {
                    descRow.style.display = 'table-row';
                    descInput.style.display = 'block';
                    descInput.focus();
                    e.target.textContent = 'Hide Description';
                }
                e.target.parentElement.style.display = 'none';
            }

            if (e.target.classList.contains('del-row')) {
                e.target.closest('.sp-row-group').remove();
                calcTotals();
            }
        });

        document.getElementById('sp-btnAddRow').addEventListener('click', createRow);
        document.getElementById('sp-btnCancel').addEventListener('click', (e) => { e.preventDefault(); overlay.remove(); });
        
        document.getElementById('sp-btnSave').addEventListener('click', async (e) => {
            e.preventDefault();
            let sum = 0; let splits = []; let valid = true;
            
            spTable.querySelectorAll('.sp-row-group').forEach(group => {
                const cat = group.querySelector('.sp-cat-input').value;
                const desc = group.querySelector('.sp-desc-input').value.trim();
                const amt = parseFloat(group.querySelector('.sp-amt-input').value);
                
                if (amt && amt > 0) {
                    if (!cat || cat === 'ADD_NEW') valid = false;
                    sum += amt;
                    splits.push({ categoryId: cat, description: desc, amount: amt });
                }
            });

            if (!valid) return alert("Please select a valid category for all lines with amounts.");
            if (Math.abs(targetAmount - sum) > 0.01) return alert("The split total must equal the transaction amount.");

            const btn = document.getElementById('sp-btnSave');
            btn.textContent = "Saving..."; btn.disabled = true;

            try {
                await updateDoc(doc(db, "bankTransactions", tx.id), {
                    status: 'Split',
                    postedCategoryId: 'SPLIT',
                    customMemo: document.getElementById('sp-customMemo').value.trim(),
                    splits: splits
                });
                overlay.remove();
                window.refreshBankTransactionsTable(); // Keeps current page
            } catch(err) {
                console.error(err); alert("Failed to save split.");
                btn.textContent = "Save Split"; btn.disabled = false;
            }
        });
    };

    loadDependencies();
}
