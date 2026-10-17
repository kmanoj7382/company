/* Atlas Desk — front-end workspace. Google Sheets sync is configured in Settings. */
const STORAGE_KEY = 'atlas-travel-bookings-v1';
const CONFIG_KEY = 'atlas-sheet-config-v1';
const SCANS_KEY = 'atlas-scan-log-v1';
const seedBookings = [
  { id:'AT-0948', reference:'VCH-SWZ-8841', traveller:'Riya Mehta', destination:'Swiss Alps Escape', travelDate:'2026-10-18', returnDate:'2026-10-25', guests:4, amount:384000, status:'Confirmed', agent:'Aarav Sharma', notes:'Vegetarian meals requested.', createdAt:'2026-10-09T08:30:00Z' },
  { id:'AT-0947', reference:'VCH-KER-3093', traveller:'Sanjay Kapoor', destination:'Kerala Backwaters', travelDate:'2026-10-20', returnDate:'2026-10-24', guests:6, amount:126600, status:'Confirmed', agent:'Meera Shah', notes:'Airport transfer included.', createdAt:'2026-10-08T10:20:00Z' },
  { id:'AT-0946', reference:'VCH-DXB-9060', traveller:'Alina Fernandes', destination:'Dubai City Break', travelDate:'2026-10-23', returnDate:'2026-10-27', guests:2, amount:98200, status:'Pending', agent:'Aarav Sharma', notes:'Awaiting second payment.', createdAt:'2026-10-07T09:15:00Z' },
  { id:'AT-0945', reference:'VCH-JPN-5291', traveller:'Nikhil Iyer', destination:'Japan Autumn Trail', travelDate:'2026-11-02', returnDate:'2026-11-11', guests:3, amount:268500, status:'Confirmed', agent:'Anika Roy', notes:'JR passes arranged.', createdAt:'2026-10-05T11:40:00Z' },
  { id:'AT-0944', reference:'VCH-RJ-1165', traveller:'Prisha Malhotra', destination:'Rajasthan Royal Route', travelDate:'2026-11-05', returnDate:'2026-11-09', guests:2, amount:74600, status:'Cancelled', agent:'Meera Shah', notes:'Cancelled due to schedule change.', createdAt:'2026-10-04T07:10:00Z' },
  { id:'AT-0943', reference:'VCH-MAL-6827', traveller:'Karan Bhatia', destination:'Maldives Island Stay', travelDate:'2026-11-12', returnDate:'2026-11-17', guests:2, amount:192000, status:'Pending', agent:'Aarav Sharma', notes:'Passport scans received.', createdAt:'2026-10-03T12:50:00Z' }
];
let bookings = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || seedBookings;
let config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
let activeFilter = 'all';
let importRows = [];
let scannerStream = null;
let detectorTimer = null;
let activeScannerTarget = 'reference';

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const inr = (amount) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(amount || 0));
const prettyDate = (date) => date ? new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${date}T00:00:00`)) : '—';
const saveLocal = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
const makeId = () => `AT-${String(Math.max(948, ...bookings.map(b => Number(String(b.id).replace(/\D/g,'')) || 0)) + 1).padStart(4,'0')}`;

function icon(name) { return `<i data-lucide="${name}"></i>`; }
function refreshIcons() { if (window.lucide) lucide.createIcons(); }
function toast(message, type='success') { const item=document.createElement('div'); item.className=`toast ${type}`; item.innerHTML=`${icon(type==='error'?'circle-alert':'circle-check')}<span>${message}</span>`; $('#toastWrap').append(item); refreshIcons(); setTimeout(()=>item.remove(), 3600); }
function openModal(id) { $(`#${id}`).classList.add('open'); $(`#${id}`).setAttribute('aria-hidden','false'); }
function closeModal(id) { $(`#${id}`).classList.remove('open'); $(`#${id}`).setAttribute('aria-hidden','true'); if (id==='scannerModal') stopScanner(); }

function renderMetrics() {
  const confirmed = bookings.filter(b=>b.status==='Confirmed');
  const active = bookings.filter(b=>b.status!=='Cancelled');
  const revenue = confirmed.reduce((sum,b)=>sum+Number(b.amount||0),0);
  const travellers = active.reduce((sum,b)=>sum+Number(b.guests||0),0);
  const due = bookings.filter(b=>b.status==='Pending').reduce((sum,b)=>sum+Number(b.amount||0),0);
  $('#revenueMetric').textContent=inr(revenue); $('#chartRevenue').textContent=inr(revenue); $('#activeMetric').textContent=active.length; $('#travellerMetric').textContent=travellers; $('#dueMetric').textContent=inr(due); $('#bookingCount').textContent=active.length;
}
function renderTable() {
  const q = ($('#globalSearch').dataset.query || '').toLowerCase();
  const filtered = bookings.filter(b => (activeFilter==='all'||b.status===activeFilter) && [b.id,b.reference,b.traveller,b.destination].join(' ').toLowerCase().includes(q));
  $('#bookingsTable').innerHTML = filtered.slice(0,8).map(b=>`<tr data-id="${b.id}"><td>${b.id}<br><small>${b.reference || 'No reference'}</small></td><td>${escapeHtml(b.traveller)}</td><td><span class="trip-cell"><span class="destination-dot">${icon('map-pin')}</span>${escapeHtml(b.destination)}</span></td><td>${prettyDate(b.travelDate)}</td><td>${inr(b.amount)}</td><td><span class="status ${String(b.status).toLowerCase()}">${b.status}</span></td><td><button class="table-action" title="Edit ${escapeHtml(b.id)}" data-edit="${b.id}">${icon('ellipsis')}</button></td></tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:30px">No bookings match this view.</td></tr>`;
  $('#tableSummary').textContent=`Showing ${Math.min(filtered.length,8)} of ${filtered.length} booking${filtered.length===1?'':'s'}`;
  refreshIcons();
}
function escapeHtml(value='') { const node=document.createElement('div'); node.textContent=value; return node.innerHTML; }
function renderAll() { renderMetrics(); renderTable(); updateConnectionUI(); }
function updateConnectionUI() {
  const connected=Boolean(config.endpoint); $('#connectionDot').classList.toggle('connected',connected); const status=$('#connectionStatus'); status.innerHTML=`<span class="connection-dot ${connected?'connected':''}"></span><span><b>${connected?'Google Sheets connected':'Demo workspace'}</b><small>${connected?'Bookings are sent to your Apps Script database.':'Changes are stored locally until a Sheet is connected.'}</small></span>`; $('#sheetEndpoint').value=config.endpoint||'';
}

function openBooking(booking) {
  $('#bookingForm').reset(); $('#bookingId').value=booking?.id||''; $('#bookingMode').textContent=booking?'Update record':'New record'; $('#bookingModalTitle').textContent=booking?'Edit booking':'Create a booking'; $('#deleteBooking').classList.toggle('hidden',!booking);
  const values=booking||{id:makeId(), travelDate:'2026-10-17',guests:1,status:'Confirmed',agent:'Aarav Sharma'};
  ['bookingId','reference','traveller','destination','travelDate','returnDate','guests','amount','status','agent','notes'].forEach(k=>{const el=$(`#${k}`);if(el&&values[k]!==undefined)el.value=values[k]??''});
  openModal('bookingModal'); setTimeout(()=>$('#reference').focus(),100);
}
async function saveBooking(event) {
  event.preventDefault(); const data=Object.fromEntries(new FormData(event.currentTarget)); data.amount=Number(data.amount); data.guests=Number(data.guests); data.updatedAt=new Date().toISOString();
  const existing=bookings.findIndex(b=>b.id===data.bookingId); let action='create';
  if(existing>=0){data.id=data.bookingId;data.createdAt=bookings[existing].createdAt;bookings[existing]={...bookings[existing],...data};action='update';}else{data.id=makeId();data.createdAt=new Date().toISOString();bookings.unshift(data)}
  delete data.bookingId; saveLocal(); renderAll(); closeModal('bookingModal');
  const remote=await sheetRequest(action, data, true); toast(remote ? `Booking ${action==='create'?'created':'updated'} and synced to Google Sheets.` : `Booking ${action==='create'?'created':'updated'} locally.`);
}
async function deleteBooking() { const id=$('#bookingId').value; if(!id)return; const booking=bookings.find(b=>b.id===id); if(!confirm(`Delete booking ${id} for ${booking?.traveller || 'this traveller'}?`))return; bookings=bookings.filter(b=>b.id!==id); saveLocal();renderAll();closeModal('bookingModal');const remote=await sheetRequest('delete',{id},true);toast(remote?'Booking deleted from Sheets.':'Booking deleted locally.'); }

async function sheetRequest(action, payload={}, quiet=false) {
  if(!config.endpoint)return false;
  try { const response=await fetch(config.endpoint,{method:'POST',body:JSON.stringify({action,payload}),headers:{'Content-Type':'text/plain;charset=utf-8'}}); const result=await response.json(); if(!result.ok)throw new Error(result.error||'Sync failed'); return result; }
  catch(err){ console.warn('Sheet sync:',err); if(!quiet)toast('Could not reach Google Sheets. Your local data is safe.','error');return false; }
}
async function syncFromSheet() { if(!config.endpoint){openModal('settingsModal');toast('Add your Apps Script Web App URL to enable cloud sync.','error');return;} const button=$('#syncButton');button.disabled=true;button.innerHTML=`${icon('loader-circle')} Syncing…`;refreshIcons(); const result=await sheetRequest('list'); button.disabled=false;button.innerHTML=`${icon('refresh-cw')} Sync data`;refreshIcons(); if(result?.records){bookings=result.records.map(normaliseRecord);saveLocal();renderAll();toast(`${bookings.length} bookings synced from Google Sheets.`);} }
function normaliseRecord(row){return {...row,guests:Number(row.guests||1),amount:Number(row.amount||0)}}

async function startScanner() {
  openModal('scannerModal'); $('#scanStatus').innerHTML=`${icon('loader-circle')} Starting camera…`;refreshIcons();
  if(!navigator.mediaDevices?.getUserMedia){$('#scanStatus').innerHTML=`${icon('triangle-alert')} This browser does not support camera scanning. Use the code field below.`;refreshIcons();return;}
  try { scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}); const video=$('#scannerVideo');video.srcObject=scannerStream;$('.scanner-window').classList.add('has-video');$('#scannerEmpty').style.display='none';await video.play(); $('#scanStatus').innerHTML=`${icon('radio')} Looking for a QR code or barcode…`;refreshIcons(); scanFrames(); }
  catch(e){$('#scanStatus').innerHTML=`${icon('triangle-alert')} Camera access was blocked. Use manual entry below.`;refreshIcons();}
}
function scanFrames() {
  if(!('BarcodeDetector' in window)){ $('#scanStatus').innerHTML=`${icon('info')} Live barcode detection is unavailable here. Type or paste the code below.`;refreshIcons();return; }
  const detector=new BarcodeDetector({formats:['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e','itf']}); const video=$('#scannerVideo');
  detectorTimer=setInterval(async()=>{if(video.readyState<2)return;try{const found=await detector.detect(video);if(found.length)useBarcode(found[0].rawValue);}catch(_){/* camera frame not ready */}},650);
}
function stopScanner(){if(detectorTimer){clearInterval(detectorTimer);detectorTimer=null}if(scannerStream){scannerStream.getTracks().forEach(track=>track.stop());scannerStream=null}const video=$('#scannerVideo');video.srcObject=null;$('.scanner-window').classList.remove('has-video');$('#scannerEmpty').style.display='flex';}
function useBarcode(code) { if(!code)return; stopScanner(); closeModal('scannerModal'); const scans=JSON.parse(localStorage.getItem(SCANS_KEY)||'[]');scans.unshift({code,at:new Date().toISOString()});localStorage.setItem(SCANS_KEY,JSON.stringify(scans)); sheetRequest('scan',{code,scannedAt:new Date().toISOString()},true); const matching=bookings.find(b=>b.reference?.toLowerCase()===code.toLowerCase()||b.id.toLowerCase()===code.toLowerCase()); if(matching){toast(`Found ${matching.id} — opening booking.`);openBooking(matching);return;} $('#reference').value=code; toast(`Barcode ${code} captured. Complete the booking details.`); openBooking(); $('#reference').value=code; }

function analyseExcel(file) { const reader=new FileReader(); reader.onload=e=>{try{const workbook=XLSX.read(e.target.result,{type:'array',cellDates:true});const name=workbook.SheetNames[0];const rows=XLSX.utils.sheet_to_json(workbook.Sheets[name],{defval:''});importRows=rows;const headers=rows[0]?Object.keys(rows[0]):[];$('#importAnalysis').innerHTML=`<div>${icon('circle-check')}<span><b>${escapeHtml(file.name)} is ready</b><small>${workbook.SheetNames.length} sheet${workbook.SheetNames.length===1?'':'s'} · ${rows.length} records · columns: ${headers.slice(0,4).map(escapeHtml).join(', ')}${headers.length>4?'…':''}</small></span></div>`;$('#confirmImport').disabled=!rows.length;refreshIcons();}catch(err){importRows=[];$('#importAnalysis').innerHTML=`<div>${icon('circle-alert')}<span><b>We couldn't read that file</b><small>Please select a valid .xls, .xlsx, or .csv report.</small></span></div>`;refreshIcons();}}, reader.readAsArrayBuffer(file); }
function mappedValue(row, options){const key=Object.keys(row).find(k=>options.some(o=>k.toLowerCase().replace(/[^a-z]/g,'').includes(o)));return key?row[key]:''}
async function importExcel(){if(!importRows.length)return; const newRows=importRows.map((row,index)=>({id:makeImportId(index),reference:String(mappedValue(row,['billno','bookingid','reference','invoice'])||`IMP-${Date.now().toString().slice(-5)}-${index+1}`),traveller:String(mappedValue(row,['traveller','customer','party','name'])||'Imported traveller'),destination:String(mappedValue(row,['destination','trip','tour','place'])||'Imported travel record'),travelDate:toIsoDate(mappedValue(row,['traveldate','date'])||'2026-10-17'),returnDate:'',guests:Number(mappedValue(row,['guests','passengers','pax'])||1),amount:Number(String(mappedValue(row,['amount','value','total'])||0).replace(/[^0-9.]/g,'')),status:'Pending',agent:'Imported from Excel',notes:`Imported from ${$('#excelFile').files[0]?.name||'Excel report'}`,createdAt:new Date().toISOString()})); bookings=[...newRows,...bookings];saveLocal();renderAll();closeModal('importModal'); const result=await sheetRequest('bulkCreate',{records:newRows},true);toast(`${newRows.length} rows imported${result?' and synced to Google Sheets':''}.`);}
function makeImportId(index){let n=Math.max(948,...bookings.map(b=>Number(String(b.id).replace(/\D/g,''))||0))+index+1;return `AT-${String(n).padStart(4,'0')}`}
function toIsoDate(value){if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);const parsed=new Date(value);return isNaN(parsed)?'2026-10-17':parsed.toISOString().slice(0,10)}

function bindEvents(){
  $('#openCreate').addEventListener('click',()=>openBooking()); $$('[data-open-booking]').forEach(e=>e.addEventListener('click',()=>openBooking())); $('#formScan').addEventListener('click',()=>{activeScannerTarget='reference';startScanner()}); $('#openScanner').addEventListener('click',()=>{activeScannerTarget='reference';startScanner()}); $('#submitBarcode').addEventListener('click',()=>useBarcode($('#manualBarcode').value.trim())); $('#manualBarcode').addEventListener('keydown',e=>{if(e.key==='Enter')useBarcode(e.target.value.trim())});
  $('#openImport').addEventListener('click',()=>openModal('importModal')); $('#excelFile').addEventListener('change',e=>e.target.files[0]&&analyseExcel(e.target.files[0])); $('#fileDrop').addEventListener('dragover',e=>{e.preventDefault();$('#fileDrop').style.borderColor='#2c789a'}); $('#fileDrop').addEventListener('dragleave',()=>$('#fileDrop').style.borderColor=''); $('#fileDrop').addEventListener('drop',e=>{e.preventDefault();$('#fileDrop').style.borderColor='';const file=e.dataTransfer.files[0];if(file){$('#excelFile').files=e.dataTransfer.files;analyseExcel(file)}}); $('#confirmImport').addEventListener('click',importExcel);
  $('#openSettings').addEventListener('click',()=>openModal('settingsModal')); $('#settingsForm').addEventListener('submit',e=>{e.preventDefault();config={endpoint:$('#sheetEndpoint').value.trim()};localStorage.setItem(CONFIG_KEY,JSON.stringify(config));updateConnectionUI();closeModal('settingsModal');toast(config.endpoint?'Google Sheets connection saved.':'Using local demo workspace.');}); $('#syncButton').addEventListener('click',syncFromSheet); $('#bookingForm').addEventListener('submit',saveBooking);$('#deleteBooking').addEventListener('click',deleteBooking);
  $$('[data-close]').forEach(el=>el.addEventListener('click',()=>closeModal(el.dataset.close))); $$('.modal-backdrop').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)closeModal(el.id)})); $('#bookingsTable').addEventListener('click',e=>{const button=e.target.closest('[data-edit]');if(button)openBooking(bookings.find(b=>b.id===button.dataset.edit));}); $$('.filter-pills button').forEach(btn=>btn.addEventListener('click',()=>{$$('.filter-pills button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeFilter=btn.dataset.filter;renderTable()}));
  $('#globalSearch').addEventListener('click',()=>{const term=prompt('Search bookings by ID, traveller, destination, or barcode:');if(term!==null){$('#globalSearch').dataset.query=term;renderTable();}}); document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').click()}if(e.key==='Escape')$$('.modal-backdrop.open').forEach(m=>closeModal(m.id));}); $('#menuToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open')); $('#viewAllBookings').addEventListener('click',()=>{activeFilter='all';$('#globalSearch').dataset.query='';renderTable();$('#bookings').scrollIntoView({behavior:'smooth'});}); $('#viewInsights').addEventListener('click',()=>toast('Insight: confirmed revenue and traveller volume are both trending up this month.')); $('#showAllDepartures').addEventListener('click',()=>{activeFilter='Confirmed';renderTable();$('#bookings').scrollIntoView({behavior:'smooth'});});
}
renderAll();bindEvents();refreshIcons();
