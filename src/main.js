import { createClient } from '@supabase/supabase-js'
import './style.css'

const config = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY,
}
const configured = Boolean(config.url && config.key)
const supabase = configured ? createClient(config.url, config.key) : null
const roles = {
  admin: 'Administrator', section_leader: 'Section leader',
  stock_requisition: 'Stock requisition', gatepass_verifier: 'Gatepass verifier', guard: 'Guard',
}
const icons = {
  overview: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',
  request: '<path d="M12 5v14m-7-7h14"/>', box: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8m-9 5v9"/>',
  gate: '<path d="M4 21V4l8-2v19m0-12h8v12m-12-8h.01M16 15h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>', users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.87m-1-11.13a4 4 0 0 1 0 7.75"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
}
const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.overview}</svg>`
const $ = (s) => document.querySelector(s)
const state = { user: null, profile: null, page: 'overview', items: [], requests: [], gatepasses: [], profiles: [] }

function renderLogin() {
  $('#app').innerHTML = `<main class="login-page"><section class="login-art"><div class="art-top"><div class="brand-mark">L</div><span>LIVELIHOOD HUB</span></div><div class="art-copy"><div class="eyebrow">WORK MADE VISIBLE</div><h1>Good work<br>moves forward.</h1><p>One clear place to request supplies, prepare gatepasses, and keep every handoff accounted for.</p></div><div class="art-foot"><span class="art-dot"></span> A calmer way to keep things moving</div><div class="art-shape shape-one"></div><div class="art-shape shape-two"></div></section><section class="login-side"><div class="login-box"><div class="mobile-brand"><div class="brand-mark">L</div> LIVELIHOOD HUB</div><div class="eyebrow">WELCOME BACK</div><h2>Sign in to your workspace</h2><p class="muted">Use your organization account to continue.</p>${!configured ? '<div class="setup-alert"><strong>Connect Supabase to get started</strong><br>Copy <code>.env.example</code> to <code>.env</code> and add your project URL and publishable key. Then create users in Supabase Auth.</div>' : ''}<form id="login-form"><label>Email address<input name="email" type="email" placeholder="you@organization.com" required autocomplete="username"></label><label>Password<input name="password" type="password" placeholder="Enter your password" required autocomplete="current-password"></label><button class="btn btn-primary btn-wide" type="submit">Sign in <span>→</span></button><div class="form-error" id="login-error"></div></form><div class="login-note">Need an account? Ask your administrator to invite you.</div></div><div class="login-side-foot">LIVELIHOOD OPERATIONS <span>·</span> PRIVATE WORKSPACE</div></section></main>`
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    if (!configured) return showError('login-error', 'Add your Supabase URL and publishable key to .env, then restart the app.')
    const { data: result, error } = await supabase.auth.signInWithPassword({ email: data.get('email'), password: data.get('password') })
    if (error) return showError('login-error', error.message)
    await loadUser(result.user)
  })
}

function showError(id, message) { const node = document.getElementById(id); if (node) node.textContent = message }
function titleFor(page) { return ({ overview: 'Overview', request: 'New stock request', requests: 'Stock requests', gatepass: 'Create gatepass', verify: 'Gatepass review', passes: 'Gatepasses', items: 'Item inventory', accounts: 'User accounts' })[page] || 'Overview' }
function sectionsForRole(role) {
  if (role === 'admin') return [['overview','Overview','overview'],['requests','Stock requests','box'],['passes','Gatepasses','gate'],['items','Item inventory','box'],['accounts','User accounts','users']]
  if (role === 'section_leader') return [['overview','Overview','overview'],['request','Request items','request'],['requests','My requests','box'],['gatepass','Create gatepass','gate'],['passes','My gatepasses','gate']]
  if (role === 'stock_requisition') return [['overview','Overview','overview'],['requests','Stock requests','box'],['items','Item inventory','box']]
  if (role === 'gatepass_verifier') return [['overview','Overview','overview'],['verify','Review gatepasses','check'],['passes','Gatepass history','gate']]
  return [['overview','Overview','overview'],['passes','Approved gatepasses','gate']]
}
function renderShell() {
  const role = state.profile?.role || 'section_leader'
  const nav = sectionsForRole(role)
  $('#app').innerHTML = `<div class="app-shell"><aside class="sidebar" id="sidebar"><a class="brand" href="#"><span class="brand-mark">L</span><span>LIVELIHOOD<small>OPERATIONS HUB</small></span></a><div class="workspace-label">WORKSPACE</div><nav>${nav.map(([id,label,ic])=>`<button class="nav-link ${state.page===id?'active':''}" data-page="${id}">${icon(ic)}<span>${label}</span>${id==='verify'&&state.gatepasses.filter(g=>g.status==='pending').length?'<b class="nav-count">'+state.gatepasses.filter(g=>g.status==='pending').length+'</b>':''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="help-card"><div class="help-icon">✳</div><strong>Need a hand?</strong><span>Contact your administrator for account or access help.</span></div><button id="signout" class="signout">${icon('logout')}<span>Sign out</span></button><div class="user-mini"><div class="avatar">${initials(state.profile?.full_name)}</div><div><strong>${esc(state.profile?.full_name || state.user?.email)}</strong><span>${esc(roles[role] || role)}</span></div><span class="online-dot"></span></div></div></aside><main class="main"><header class="topbar"><button class="icon-btn mobile-menu" id="menu-toggle">${icon('menu')}</button><div class="breadcrumb">Livelihood Hub <span>/</span> <strong>${titleFor(state.page)}</strong></div><div class="top-actions"><span class="today-label">OPERATIONS</span><div class="avatar avatar-small">${initials(state.profile?.full_name)}</div></div></header><section class="content" id="content"></section></main></div>`
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{state.page=b.dataset.page;renderShell();$('#sidebar').classList.remove('open')}))
  $('#signout').addEventListener('click', async()=>{if(supabase) await supabase.auth.signOut(); state.user=null;state.profile=null;renderLogin()})
  $('#menu-toggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'))
  renderPage()
}
function initials(name='U') { return name.split(/[\s@]/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() }
function esc(x='') { return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }
function statusPill(s='pending') { return `<span class="status status-${s}"><i></i>${s[0].toUpperCase()+s.slice(1)}</span>` }
function dateText(d) { return d ? new Date(d).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'}) : '—' }
function welcomeBlock(sub) { return `<div class="page-heading"><div><div class="eyebrow">${dateText(new Date())} <span>·</span> ${esc(roles[state.profile?.role]||'WORKSPACE')}</div><h1>${titleFor(state.page)}</h1><p>${sub}</p></div>${state.page==='overview'?'<button class="btn btn-quiet" id="refresh">↻ &nbsp; Refresh data</button>':''}</div>` }
function renderPage() {
  const root=$('#content'), role=state.profile?.role
  const intro = {
    overview:'A clear view of requests and gatepasses moving through your workflow.',
    request:'Tell the stock team what your section needs.', requests:'Review request progress and current stock availability.',
    gatepass:'List the items leaving your section and send them for verification.', verify:'Check the submitted item list before approving a gatepass.',
    passes:role==='guard'?'View approved gatepasses and the items listed for exit.':'Follow gatepass status and verification history.',
    items:'Keep an eye on available livelihood supplies.', accounts:'Manage the people who can access this workspace.'
  }[state.page]
  root.innerHTML=welcomeBlock(intro||'Manage livelihood operations.')+`<div id="page-body"><div class="loading-card">Loading workspace data<span class="loader"></span></div></div>`
  if($('#refresh')) $('#refresh').onclick=refreshData
  pageData()
}
async function pageData() {
  if (configured && state.user) await refreshData(false)
  const root=$('#page-body'); if(!root) return
  const role=state.profile?.role
  if(state.page==='overview') root.innerHTML=dashboard(role)
  if(state.page==='items') root.innerHTML=inventoryPage(role)
  if(state.page==='request') root.innerHTML=requestForm()
  if(state.page==='requests') root.innerHTML=requestsPage(role)
  if(state.page==='gatepass') root.innerHTML=gatepassForm()
  if(state.page==='verify') root.innerHTML=verifyPage()
  if(state.page==='passes') root.innerHTML=passesPage(role)
  if(state.page==='accounts') root.innerHTML=accountsPage()
  wirePage()
}
async function refreshData(redraw=true) {
  if(!configured||!state.user) return
  const role=state.profile?.role
  const queries=[supabase.from('items').select('*').order('name'),supabase.from('stock_requests').select('*, stock_request_items(*, items(name,unit))').order('created_at',{ascending:false}),supabase.from('gatepasses').select('*, gatepass_items(*, items(name,unit))').order('created_at',{ascending:false})]
  const results=await Promise.all(queries)
  state.items=results[0].data||[];state.requests=results[1].data||[];state.gatepasses=results[2].data||[]
  if(role==='admin'){const users=await supabase.from('profiles').select('*').order('created_at',{ascending:false});state.profiles=users.data||[]}
  const err=results.find(r=>r.error)?.error
  if(err) console.warn('Supabase data query:',err.message)
  if(redraw) pageData()
}
function dashboard(role) {
  const requests=state.requests, passes=state.gatepasses
  const waiting=role==='gatepass_verifier'?passes.filter(x=>x.status==='pending').length:requests.filter(x=>x.status==='pending').length
  const stats=role==='guard'?[['Approved gatepasses',passes.filter(x=>x.status==='approved').length,'Available to view'],['Items in inventory',state.items.length,'Tracked item types']]:role==='stock_requisition'?[['Waiting for review',waiting,'Stock requests'],['Items in inventory',state.items.length,'Tracked item types'],['Requests fulfilled',requests.filter(x=>x.status==='fulfilled').length,'Completed']]:role==='gatepass_verifier'?[['Needs review',waiting,'Gatepasses waiting'],['Approved',passes.filter(x=>x.status==='approved').length,'Ready for guard'],['Reviewed',passes.filter(x=>x.status!=='pending').length,'Total decisions']]:[['Open requests',requests.filter(x=>x.status==='pending').length,'Awaiting stock review'],['Pending gatepasses',passes.filter(x=>x.status==='pending').length,'Awaiting verification'],['Available items',state.items.length,'Tracked inventory']]
  const recent=role==='guard'?passes.filter(x=>x.status==='approved').slice(0,5):role==='gatepass_verifier'?passes.filter(x=>x.status==='pending').slice(0,5):requests.slice(0,5)
  const rows=recent.length?recent.map(x=>`<tr><td><strong>${role==='guard'||role==='gatepass_verifier'?'GP':'REQ'}-${String(x.id).padStart(4,'0')}</strong><small>${esc(x.section||'Unassigned section')}</small></td><td>${dateText(x.created_at)}</td><td>${role==='guard'||role==='gatepass_verifier'?'Gatepass':'Stock request'}</td><td>${statusPill(x.status)}</td></tr>`).join(''):`<tr><td class="empty-cell" colspan="4">Nothing to show yet. New activity will appear here.</td></tr>`
  return `<div class="stats-grid">${stats.map(([a,b,c],i)=>`<article class="stat-card"><div class="stat-top"><span>${a}</span><span class="stat-icon stat-icon-${i}">${icon(i===1?'gate':'box')}</span></div><strong class="stat-number">${b}</strong><span class="stat-note">${c}</span></article>`).join('')}</div><div class="section-heading"><div><h2>Recent activity</h2><p>The latest updates from your workspace.</p></div><button class="text-btn" data-page="${role==='guard'||role==='gatepass_verifier'?'passes':'requests'}">View all →</button></div><div class="table-card"><table><thead><tr><th>REFERENCE</th><th>DATE</th><th>TYPE</th><th>STATUS</th></tr></thead><tbody>${rows}</tbody></table></div>${!configured?'<div class="inline-note">Connect Supabase using the setup steps in README.md. Dashboard counts will populate when your Supabase project is connected.</div>':''}`
}
function inventoryPage(role){return `${role==='admin'?`<form class="inline-form" id="add-item-form"><input name="name" required placeholder="Item name"><input name="unit" required value="pcs" placeholder="Unit"><input name="stock_quantity" type="number" min="0" required value="0" placeholder="Starting stock"><button class="btn btn-primary btn-small">Add inventory item</button></form>`:''}<div class="toolbar"><div class="search-box">${icon('search')}<input id="item-search" placeholder="Search inventory"></div><span class="result-count">${state.items.length} item types</span></div><div class="table-card"><table><thead><tr><th>ITEM</th><th>UNIT</th><th>AVAILABLE STOCK</th><th>AVAILABILITY</th></tr></thead><tbody>${state.items.length?state.items.map(i=>`<tr><td><strong>${esc(i.name)}</strong><small>Inventory item</small></td><td>${esc(i.unit)}</td><td><strong>${i.stock_quantity}</strong></td><td>${i.stock_quantity>0?'<span class="status status-approved"><i></i>In stock</span>':'<span class="status status-rejected"><i></i>Out of stock</span>'}</td></tr>`).join(''):'<tr><td colspan="4" class="empty-cell">No inventory items yet. Ask an admin to add items.</td></tr>'}</tbody></table></div>`}
function itemOptions(){return state.items.map(i=>`<option value="${i.id}">${esc(i.name)} · ${i.stock_quantity} ${esc(i.unit)} available</option>`).join('')}
function requestForm(){return `<form class="form-card" id="request-form"><div class="form-card-head"><div class="form-step">01</div><div><h2>Request supplies</h2><p>Add the items and amounts needed by your section.</p></div></div><label>Section name<input name="section" required value="${esc(state.profile?.section||'')}" placeholder="e.g. Sewing"></label><div class="line-items-head"><span>ITEMS REQUESTED</span><button type="button" class="text-btn" id="add-request-item">+ Add another item</button></div><div id="request-lines">${itemRow()}</div><div class="form-actions"><span>Stock team will review availability.</span><button class="btn btn-primary" type="submit">Submit request <span>→</span></button></div><div class="form-error" id="action-error"></div></form>`}
function itemRow(){return `<div class="item-row"><select name="item_id" required><option value="">Choose an item</option>${itemOptions()}</select><input name="quantity" type="number" min="1" placeholder="Qty" required><button type="button" class="remove-row" aria-label="Remove item">×</button></div>`}
function gatepassForm(){return `<form class="form-card" id="gatepass-form"><div class="form-card-head"><div class="form-step">01</div><div><h2>Gatepass details</h2><p>Identify the section and reason for moving items.</p></div></div><label>Section name<input name="section" required value="${esc(state.profile?.section||'')}" placeholder="e.g. Sewing"></label><label>Purpose<input name="purpose" required placeholder="What are these items for?"></label><div class="line-items-head"><span>ITEMS ON GATEPASS</span><button type="button" class="text-btn" id="add-gate-item">+ Add another item</button></div><div id="gate-lines">${itemRow()}</div><div class="form-actions"><span>A verifier will review the item list.</span><button class="btn btn-primary" type="submit">Submit for review <span>→</span></button></div><div class="form-error" id="action-error"></div></form>`}
function requestsPage(role){const data=role==='section_leader'?state.requests.filter(x=>x.requested_by===state.user?.id):state.requests;return `<div class="toolbar"><div class="search-box">${icon('search')}<input id="table-search" placeholder="Search requests"></div><span class="result-count">${data.length} requests</span></div><div class="table-card"><table><thead><tr><th>REFERENCE</th><th>SECTION</th><th>ITEMS</th><th>SUBMITTED</th><th>STATUS</th>${role==='stock_requisition'?'<th>ACTION</th>':''}</tr></thead><tbody>${data.length?data.map(r=>`<tr><td><strong>REQ-${String(r.id).padStart(4,'0')}</strong></td><td>${esc(r.section||'—')}</td><td>${(r.stock_request_items||[]).map(x=>`${esc(x.items?.name||'Item')} × ${x.quantity}`).join(', ')||'—'}</td><td>${dateText(r.created_at)}</td><td>${statusPill(r.status)}</td>${role==='stock_requisition'?`<td>${r.status==='pending'?`<button class="btn btn-small btn-outline" data-fulfill="${r.id}">Confirm received</button><button class="text-btn" data-reject="${r.id}">Reject</button>`:'—'}</td>`:''}</tr>`).join(''):'<tr><td colspan="6" class="empty-cell">No stock requests yet.</td></tr>'}</tbody></table></div>`}
function passesPage(role){let data=state.gatepasses;if(role==='section_leader')data=data.filter(x=>x.created_by===state.user?.id);if(role==='guard')data=data.filter(x=>x.status==='approved');return `<div class="toolbar"><div class="search-box">${icon('search')}<input id="table-search" placeholder="Search gatepasses"></div><span class="result-count">${data.length} gatepasses</span></div><div class="table-card"><table><thead><tr><th>REFERENCE</th><th>SECTION / PURPOSE</th><th>ITEMS</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>${data.length?data.map(g=>`<tr><td><strong>GP-${String(g.id).padStart(4,'0')}</strong></td><td>${esc(g.section||'—')}<small>${esc(g.purpose||'')}</small></td><td>${(g.gatepass_items||[]).map(x=>`${esc(x.items?.name||'Item')} × ${x.quantity}`).join(', ')||'—'}</td><td>${dateText(g.created_at)}</td><td>${statusPill(g.status)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty-cell">No gatepasses to display.</td></tr>'}</tbody></table></div>`}
function verifyPage(){const data=state.gatepasses.filter(x=>x.status==='pending');return `<div class="review-note"><span class="review-symbol">✓</span><div><strong>Before you approve</strong><p>Confirm the item names and quantities match what the section leader submitted.</p></div></div><div class="table-card"><table><thead><tr><th>REFERENCE</th><th>SECTION / PURPOSE</th><th>ITEMS TO VERIFY</th><th>SUBMITTED</th><th>DECISION</th></tr></thead><tbody>${data.length?data.map(g=>`<tr><td><strong>GP-${String(g.id).padStart(4,'0')}</strong></td><td>${esc(g.section||'—')}<small>${esc(g.purpose||'')}</small></td><td>${(g.gatepass_items||[]).map(x=>`${esc(x.items?.name||'Item')} × ${x.quantity} ${esc(x.items?.unit||'')}`).join('<br>')||'—'}</td><td>${dateText(g.created_at)}</td><td><div class="decision-actions"><button class="btn btn-small btn-primary" data-verify="approved" data-id="${g.id}">Approve</button><button class="btn btn-small btn-danger" data-verify="rejected" data-id="${g.id}">Reject</button></div></td></tr>`).join(''):'<tr><td colspan="5" class="empty-cell">All caught up. No gatepasses need review.</td></tr>'}</tbody></table></div>`}
function accountsPage(){return `<form class="inline-form account-form" id="create-user-form"><input name="full_name" required placeholder="Full name"><input name="email" required type="email" placeholder="Email address"><select name="role" required>${Object.entries(roles).filter(([r])=>r!=='admin').map(([r,label])=>`<option value="${r}">${label}</option>`).join('')}</select><input name="section" placeholder="Section (optional)"><button class="btn btn-primary btn-small">Invite user</button><div id="account-error" class="form-error"></div></form><div class="toolbar"><span class="result-count">${state.profiles.length} user accounts</span></div><div class="table-card"><table><thead><tr><th>NAME</th><th>SECTION</th><th>ROLE</th><th>ACCOUNT ID</th></tr></thead><tbody>${state.profiles.length?state.profiles.map(p=>`<tr><td><strong>${esc(p.full_name)}</strong></td><td>${esc(p.section||'—')}</td><td>${esc(roles[p.role]||p.role)}</td><td><small>${esc(p.id)}</small></td></tr>`).join(''):'<tr><td colspan="4" class="empty-cell">No user profiles found.</td></tr>'}</tbody></table></div><div class="inline-note">Invites are sent through Supabase Auth email settings. The Edge Function keeps the admin secret on the server.</div>`}
function wirePage(){
  $('#add-request-item')?.addEventListener('click',()=>$('#request-lines').insertAdjacentHTML('beforeend',itemRow()))
  $('#add-gate-item')?.addEventListener('click',()=>$('#gate-lines').insertAdjacentHTML('beforeend',itemRow()))
  document.querySelectorAll('.remove-row').forEach(b=>b.onclick=()=>{if(b.closest('.item-row').parentElement.children.length>1)b.closest('.item-row').remove()})
  $('#request-form')?.addEventListener('submit',submitRequest)
  $('#gatepass-form')?.addEventListener('submit',submitGatepass)
  $('#add-item-form')?.addEventListener('submit',addItem)
  $('#create-user-form')?.addEventListener('submit',createUser)
  document.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>verifyGatepass(b.dataset.id,b.dataset.verify))
  document.querySelectorAll('[data-fulfill]').forEach(b=>b.onclick=()=>fulfillRequest(b.dataset.fulfill))
  document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>updateRequest(b.dataset.reject,'rejected'))
  $('#item-search')?.addEventListener('input',e=>document.querySelectorAll('#page-body tbody tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(e.target.value.toLowerCase())))
  $('#table-search')?.addEventListener('input',e=>document.querySelectorAll('#page-body tbody tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(e.target.value.toLowerCase())))
}
async function submitRequest(e){e.preventDefault();if(!configured)return showError('action-error','Connect Supabase before submitting.');const f=new FormData(e.currentTarget);const {data,error}=await supabase.from('stock_requests').insert({requested_by:state.user.id,section:f.get('section')}).select().single();if(error)return showError('action-error',error.message);const lines=[...e.currentTarget.querySelectorAll('.item-row')].map(row=>({request_id:data.id,item_id:Number(row.querySelector('[name=item_id]').value),quantity:Number(row.querySelector('[name=quantity]').value)}));const result=await supabase.from('stock_request_items').insert(lines);if(result.error)return showError('action-error',result.error.message);state.page='requests';await refreshData();renderShell()}
async function submitGatepass(e){e.preventDefault();if(!configured)return showError('action-error','Connect Supabase before submitting.');const f=new FormData(e.currentTarget);const {data,error}=await supabase.from('gatepasses').insert({created_by:state.user.id,section:f.get('section'),purpose:f.get('purpose')}).select().single();if(error)return showError('action-error',error.message);const lines=[...e.currentTarget.querySelectorAll('.item-row')].map(row=>({gatepass_id:data.id,item_id:Number(row.querySelector('[name=item_id]').value),quantity:Number(row.querySelector('[name=quantity]').value)}));const result=await supabase.from('gatepass_items').insert(lines);if(result.error)return showError('action-error',result.error.message);state.page='passes';await refreshData();renderShell()}
async function verifyGatepass(id,status){if(!confirm(`${status==='approved'?'Approve':'Reject'} this gatepass?`))return;const {error}=await supabase.from('gatepasses').update({status,verifier_id:state.user.id,verified_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);await refreshData();renderShell()}
async function fulfillRequest(id){const {error}=await supabase.from('stock_requests').update({status:'fulfilled'}).eq('id',id);if(error)return alert(error.message);await refreshData();renderShell()}
async function updateRequest(id,status){const {error}=await supabase.from('stock_requests').update({status}).eq('id',id);if(error)return alert(error.message);await refreshData();renderShell()}
async function addItem(e){e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await supabase.from('items').insert({name:f.get('name'),unit:f.get('unit'),stock_quantity:Number(f.get('stock_quantity'))});if(error)return alert(error.message);await refreshData();renderShell()}
async function createUser(e){e.preventDefault();const f=new FormData(e.currentTarget);const {data,error}=await supabase.functions.invoke('admin-create-user',{body:{full_name:f.get('full_name'),email:f.get('email'),role:f.get('role'),section:f.get('section')||null}});if(error||data?.error)return showError('account-error',data?.error||error.message);await refreshData();renderShell()}
async function loadUser(user){state.user=user;const {data,error}=await supabase.from('profiles').select('*').eq('id',user.id).single();if(error){await supabase.auth.signOut();state.user=null;renderLogin();return showError('login-error','No profile found for this account. Ask an admin to finish setting it up.')}state.profile=data;await refreshData(false);renderShell()}
renderLogin()
if(supabase)supabase.auth.getSession().then(({data})=>{if(data.session)loadUser(data.session.user)})
