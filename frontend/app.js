import { CONFIG } from './config.js';
import { api } from './bridge.js';
import { UNITS, ROLE_LABELS, ROLE_PERMISSIONS, WRITE_PERMISSIONS, seedData } from './data.js';
import { peoplePage, moneyPage, crmPage, approvalsPage as workspaceApprovalsPage, assetSection, stockCountsSection, projectExtras, reportsPage, salesPage, saleLineHtml, journalLineHtml, demoLedgerSummary, moduleModal, MODULE_ACTIONS, moduleDemoAction, demoDecisionCascade, demoPayroll } from './workspace.js';
import { workflowPage, workflowModal, workflowDemoAction, workflowTypes } from './workflow-ui.js';
import {canQueue,enqueue,listQueue,markQueue,removeQueue,saveSnapshot,loadSnapshot} from './offline.js';
import {catalogPage} from './catalog-ui.js';
import {WORKFLOW_TYPES} from './workflow-catalog.js';
import {parseCsv} from './csv.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const NAV = [
  ['home', 'Beranda'], ['projects', 'Proyek'], ['tasks', 'Tugas'], ['attendance', 'Absensi'],
  ['people', 'Tim'], ['work', 'Pusat pekerjaan'], ['inventory', 'Gudang'], ['sales', 'Pesanan'], ['money', 'Keuangan'], ['leads', 'Klien'],
  ['approvals', 'Persetujuan'], ['reports', 'Laporan'], ['search', 'Cari data'], ['catalog', 'Semua modul'], ['offline', 'Antrean offline'],
];
const STAGES = ['New Lead', 'Pitching', 'Win/Deal', 'New Project', 'In-Progress', 'On-Event Execution', 'Project Settlement', 'Project Closed'];
const STAGE_LABELS = {'New Lead':'Calon proyek','Pitching':'Presentasi penawaran','Win/Deal':'Sepakat','New Project':'Proyek baru','In-Progress':'Sedang dikerjakan','On-Event Execution':'Pelaksanaan event','Project Settlement':'Penyelesaian biaya','Project Closed':'Proyek ditutup'};
const state = {
  mode: localStorage.getItem('araia-demo-user') ? 'demo' : 'login',
  user: JSON.parse(localStorage.getItem('araia-demo-user') || 'null'),
  token: sessionStorage.getItem('araia-session') || '',
  data: {...seedData(), ...(JSON.parse(localStorage.getItem('araia-demo-data') || 'null') || {})},
  page: 'home', subtab: '', workArea:'HRIS', workType:'', catalogArea:'HRIS', results:[], importDraft:null, unit: JSON.parse(localStorage.getItem('araia-demo-user') || 'null')?.business_unit_id || 'ALL', search: '', modal: '', oneTimeCredential:null, photoData: '', coords: null, stream: null, scanTimer:null,nfcAbort:null,nfcSerial:'', payrollPreview: null, queue:[],syncing:false,lastQueued:false,
};

function h(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function uid() { return crypto.randomUUID(); }
function unit(id) { return UNITS.find(item => item.id === id) || UNITS[0]; }
function unitTag(id) { const u = unit(id); return `<span class="unit-label" style="--unit:${u.color}">${h(u.name)}</span>`; }
function dateLabel(value) { if (!value) return 'Belum ditentukan'; const d = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(d.getTime()) ? h(value) : new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(d); }
function money(value) { return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value)||0); }
function allowed(key) { return key === 'home'||key==='catalog'||key==='search'||key==='offline'&&state.mode==='remote' || key==='work'&&!!state.user&&workflowTypes(state.user).length>0 || (ROLE_PERMISSIONS[state.user?.role] || []).includes(key); }
function writable(key) { return (WRITE_PERMISSIONS[key] || []).includes(state.user?.role); }
function scope(list) { return (list || []).filter(item => (state.unit === 'ALL' || item.business_unit_id === state.unit) && (state.user?.global || item.business_unit_id === state.user?.business_unit_id)); }
function projectFor(id) { return state.data.projects.find(p => p.id === id); }
function scopedProjects() { return scope(state.data.projects); }
function scopedTasks() { const ids = new Set(scopedProjects().map(p => p.id)); const manager=['CEO','CREATIVE_DIRECTOR','SENIOR_PM','PM','PAM','ADMIN_PROJECT','TALENT_MANAGER'].includes(state.user?.role); return state.data.tasks.filter(t => t.assignee_user_id === state.user.id || (manager && ids.has(t.project_id))); }
function ctx() { return {state,h,unitTag,dateLabel,money,badge,scope,writable}; }
function initial(name) { return (name || 'A').split(/\s+/).slice(0,2).map(s => s[0]).join('').toUpperCase(); }
function badge(value) { const tone = /selesai|ditutup|disetujui|hadir|lunas|disesuaikan|diterima/i.test(value) ? 'green' : /menunggu|belum|pitch|hitung ulang/i.test(value) ? 'yellow' : /ditolak|gagal/i.test(value) ? 'pink' : 'gray'; return `<span class="badge ${tone}">${h(value)}</span>`; }
function saveDemo() { localStorage.setItem('araia-demo-data', JSON.stringify(state.data)); localStorage.setItem('araia-demo-user', JSON.stringify(state.user)); }
function toast(message) { toastEl.textContent = state.lastQueued?'Disimpan di antrean offline. Belum tercatat di server.':message;state.lastQueued=false;toastEl.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => toastEl.classList.remove('show'), 3500); }

function renderLogin() {
  const changing=state.mode==='change';
  app.innerHTML = `<div class="login"><section class="login-art"><img class="brand-logo" src="./assets/araia-logo-white.png" alt="ARAIA Group"><div><span class="eyebrow">Satu ruang untuk bekerja bersama</span><h1>Kerja jadi<br>lebih jelas.</h1><p>Proyek, tim, klien, dan operasional dalam satu tempat yang mudah digunakan.</p><div class="brand-stripes"><span></span><span></span><span></span><span></span><span></span></div></div><footer>ARAIA GROUP · WORKSPACE</footer></section><section class="login-form-wrap"><div class="login-card"><span class="eyebrow">${changing?'Satu langkah lagi':'Selamat datang'}</span><h2>${changing?'Buat kata sandi baru':'Masuk ke ruang kerja'}</h2><p>${changing?'Ganti kata sandi sementara sebelum mulai bekerja. Gunakan minimal 12 karakter.':'Masukkan nama pengguna dan kata sandi yang diberikan admin.'}</p>${changing?`<form id="change-password-form"><label class="field">Kata sandi sementara<input name="currentPassword" type="password" autocomplete="current-password" required></label><label class="field">Kata sandi baru<input name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label class="field">Ulangi kata sandi baru<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button class="button" type="submit">Simpan kata sandi</button></form>${state.user?.must_change_password?'':'<button class="button secondary" data-action="cancel-change">Batal</button>'}<button class="button secondary" data-action="logout">Keluar</button>`:`<form id="login-form"><label class="field">Nama pengguna<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></label><label class="field">Kata sandi<input name="password" type="password" autocomplete="current-password" required></label><button class="button" type="submit">Masuk</button></form><button class="button secondary" data-action="demo-login">Coba tampilan</button><div class="demo-note"><strong>Mode contoh</strong><br>Gunakan data simulasi untuk mencoba alur dan warna unit bisnis. Data contoh hanya tersimpan di perangkat ini.</div>`}<div class="login-units">${UNITS.map(u => unitTag(u.id)).join('')}</div></div></section></div>`;
}

function render() {
  if (state.mode === 'login' || state.mode === 'change' || !state.user) { renderLogin(); return; }
  if (!allowed(state.page)) state.page = 'home';
  const visible = NAV.filter(([key]) => allowed(key));
  const u = unit(state.unit === 'ALL' ? state.user.business_unit_id : state.unit);
  app.innerHTML = `${!navigator.onLine ? '<div class="offline-banner">Sedang offline. Beberapa pekerjaan dapat disimpan sebagai antrean; periksa statusnya di Antrean offline.</div>' : ''}<div class="shell"><aside class="sidebar"><img class="sidebar-logo" src="./assets/araia-logo-white.png" alt="ARAIA Group"><p class="sidebar-caption">Ruang kerja</p><nav class="nav" aria-label="Menu utama">${visible.map(([key,label],i) => `<button data-page="${key}" class="${state.page===key?'active':''}" ${state.page===key?'aria-current="page"':''}><span class="nav-number">${String(i+1).padStart(2,'0')}</span>${label}${key==='offline'&&state.queue.length?` <span class="badge yellow">${state.queue.length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><strong>${h(state.user.name)}</strong>${h(ROLE_LABELS[state.user.role] || state.user.role)}<br>${state.mode==='demo'?'<button class="text-button" style="color:#fff;padding:14px 0 0;margin-right:12px" data-action="more-menu">Coba peran lain</button>':''}<button class="text-button" style="color:#fff;padding:14px 0 0" data-action="logout">Keluar</button></div></aside><div class="content-shell"><header class="topbar"><div class="topbar-left"><strong>ARAIA Workspace</strong><small>${state.mode==='demo'?'Mode contoh · Data simulasi':'Ruang kerja aman'}</small></div><div class="topbar-right"><div class="select-wrap"><label class="sr-only" for="unitSelect">Unit bisnis</label><select id="unitSelect">${state.user.global ? '<option value="ALL">Semua unit</option>' : ''}${UNITS.filter(x => state.user.global || x.id === state.user.business_unit_id).map(x => `<option value="${x.id}" ${state.unit===x.id?'selected':''}>${h(x.name)}</option>`).join('')}</select></div><span class="avatar" title="${h(state.user.name)}">${h(initial(state.user.name))}</span></div></header><main class="main" id="main">${pageHtml(u)}</main></div></div><nav class="mobile-nav" aria-label="Menu ponsel">${visible.slice(0,4).map(([key,label],i)=>`<button data-page="${key}" class="${state.page===key?'active':''}" ${state.page===key?'aria-current="page"':''}><span>${String(i+1).padStart(2,'0')}</span>${label}</button>`).join('')}<button data-action="more-menu"><span>···</span>Lainnya</button></nav>${state.modal ? modalHtml() : ''}`;
  if (state.modal === 'attendance' && state.photoData) showPhoto();
}

function pageHtml(u) {
  switch(state.page) {
    case 'projects': return projectsPage(); case 'tasks': return tasksPage();
    case 'attendance': return attendancePage(); case 'inventory': return inventoryPage();
    case 'people': return peoplePage(ctx()); case 'money': return moneyPage(ctx());
    case 'sales': return salesPage(ctx());
    case 'work': return workflowPage(ctx());
    case 'offline': return offlinePage();
    case 'catalog': return catalogPage(state);
    case 'search': return searchPage();
    case 'leads': return crmPage(ctx()); case 'approvals': return workspaceApprovalsPage(ctx());
    case 'reports': return reportsPage(ctx());
    default: return homePage(u);
  }
}
function offlinePage(){return `${head('Data tersimpan di perangkat','Antrean offline','Data dikirim ke server saat koneksi kembali dan sesi masih berlaku.',navigator.onLine?'<button class="button" data-action="sync-offline">Kirim sekarang</button>':'')}${state.queue.length?`<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Jenis</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>${state.queue.map(q=>`<tr><td>${dateLabel(q.created_at)}</td><td>${h(q.action)}</td><td>${badge(q.status)}</td><td>${h(q.error||'Menunggu koneksi dan sesi aktif.')}</td><td>${q.status==='Gagal'?`<button class="button small" data-action="retry-offline" data-id="${h(q.id)}">Coba lagi</button> `:''}<button class="button small secondary" data-action="discard-offline" data-id="${h(q.id)}">Hapus antrean</button></td></tr>`).join('')}</tbody></table></div>`:empty('Antrean kosong','Tidak ada pekerjaan yang menunggu pengiriman.')}`;}
function searchPage(){return `${head('Pencarian','Cari data','Cari proyek, tugas, klien, stok, atau pekerjaan yang boleh Anda lihat.')}<form id="search-form" class="toolbar"><input name="query" required minlength="2" maxlength="100" placeholder="Ketik minimal dua huruf" aria-label="Kata pencarian" value="${h(state.search)}"><button class="button" type="submit">Cari</button></form>${state.results.length?`<div class="panel">${state.results.map(x=>`<div class="list-row"><div><small>${h(x.type)} · ${h(unit(x.business_unit_id).name)}</small><strong>${h(x.label)}</strong></div><button class="button small secondary" data-page="${h(x.page)}">Buka</button></div>`).join('')}</div>`:empty('Belum ada hasil','Isi kata pencarian lalu pilih Cari.')}`;}
function head(kicker,title,subtitle,button='') { return `<div class="view-head"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div><div class="view-actions">${button}</div></div>`; }
function empty(title,copy) { return `<div class="empty"><strong>${title}</strong><p>${copy}</p></div>`; }
function homePage(u) {
  const ps = scopedProjects(), ts = scopedTasks(), waiting = scope(state.data.approvals).filter(a=>a.status==='Menunggu');
  return `<section class="hero" style="--unit:${u.color}"><div><span class="eyebrow">${new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date())}</span><h1>Halo, ${h(state.user.name.split(' ')[0])}.<br>Apa yang perlu selesai hari ini?</h1><p>Mulai dari pekerjaan yang paling penting. Setiap langkah tercatat di satu tempat.</p></div><div class="hero-unit"><div class="hero-unit-block"><small>UNIT BISNIS</small><strong>${h(u.name)}</strong></div></div></section><div class="section-title"><h2>Ringkasan hari ini</h2></div><section class="stats"><div class="stat"><span class="stat-label">Proyek aktif</span><strong>${ps.filter(p=>!['Project Closed','New Lead'].includes(p.stage)).length}</strong><small>di unit yang dipilih</small><div class="stat-accent" style="--accent:${u.color}"></div></div><div class="stat"><span class="stat-label">Tugas belum selesai</span><strong>${ts.filter(t=>t.status!=='Selesai').length}</strong><small>butuh perhatian</small><div class="stat-accent" style="--accent:#111"></div></div><div class="stat"><span class="stat-label">Menunggu keputusan</span><strong>${allowed('approvals')?waiting.length:'—'}</strong><small>${allowed('approvals')?'permintaan masuk':'sesuai peran Anda'}</small><div class="stat-accent" style="--accent:var(--pink)"></div></div><div class="stat"><span class="stat-label">Lead klien</span><strong>${allowed('leads')?scope(state.data.leads).length:'—'}</strong><small>${allowed('leads')?'peluang terbuka':'sesuai peran Anda'}</small><div class="stat-accent" style="--accent:var(--gray)"></div></div></section><div class="section-title"><h2>Langsung kerjakan</h2></div><div class="two-col"><section class="panel"><div class="panel-header"><h2>Proyek terbaru</h2>${allowed('projects')?'<button class="text-button" data-page="projects">Lihat semua</button>':''}</div>${ps.length?ps.slice(0,4).map(p=>`<div class="list-row"><div>${unitTag(p.business_unit_id)}<strong style="display:block;margin-top:7px">${h(p.name)}</strong><small>${h(p.client_name)} · ${dateLabel(p.end_date)}</small></div><div class="list-right">${badge(STAGE_LABELS[p.stage]||p.stage)}</div></div>`).join(''):empty('Belum ada proyek','Proyek akan muncul di sini.')}</section><section class="panel"><div class="panel-header"><h2>Mulai cepat</h2></div><div class="quick-grid">${[...(['tasks','attendance','projects','inventory','leads','approvals'].filter(allowed))].slice(0,4).map((key,i)=>`<button class="quick-action" data-page="${key}"><span>${String(i+1).padStart(2,'0')}</span>${({tasks:'Lihat tugas',attendance:'Isi absensi',projects:'Buka proyek',inventory:'Cek gudang',leads:'Lihat klien',approvals:'Cek persetujuan'})[key]}</button>`).join('')}</div><div class="notice"><strong>Satu langkah setiap kali.</strong><br>Pilih menu, isi data yang diperlukan, lalu simpan. Anda hanya melihat yang sesuai dengan peran.</div></section></div>${notificationPanel()}`;
}
function notificationPanel() {
  const items=(state.data.notifications||[]).filter(n=>n.status==='Baru').slice(0,4);
  if(!items.length)return '';
  return `<div class="section-title"><h2>Pemberitahuan</h2></div><section class="panel">${items.map(n=>`<div class="list-row"><div><strong>${h(n.title)}</strong><small>${h(n.body)}</small></div><button class="button small secondary" data-action="read-notification" data-id="${h(n.id)}">Sudah dibaca</button></div>`).join('')}</section>`;
}
function projectsPage() {
  const ps = scopedProjects().filter(p=>`${p.name} ${p.client_name}`.toLowerCase().includes(state.search.toLowerCase()));
  return `${head('Operasional','Proyek','Lihat tahap, progres tugas, dan batas waktu.',writable('projects')?'<button class="button" data-modal="project">+ Buat proyek</button>':'')}<div class="toolbar"><input data-search placeholder="Cari nama proyek atau klien" aria-label="Cari proyek" value="${h(state.search)}"><small>${ps.length} proyek</small></div>${ps.length?`<div class="grid-cards">${ps.map(p=>{const tasks=state.data.tasks.filter(t=>t.project_id===p.id),done=tasks.filter(t=>t.status==='Selesai').length,progress=tasks.length?Math.round(done/tasks.length*100):0,next=STAGES[STAGES.indexOf(p.stage)+1];return `<article class="item-card">${unitTag(p.business_unit_id)}<h3>${h(p.name)}</h3><p>${h(p.client_name)}</p>${badge(STAGE_LABELS[p.stage]||p.stage)}<div class="progress-copy">Tugas selesai <strong>${done}/${tasks.length}</strong></div><div class="progress-track" role="progressbar" aria-label="Progres tugas" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div>${next&&writable('projects')?`<button class="text-button stage-button" data-action="advance-project" data-id="${h(p.id)}" data-stage="${h(next)}">Lanjut ke ${h(STAGE_LABELS[next]||next)}</button>`:''}<div class="item-card-foot"><small>Selesai ${dateLabel(p.end_date)}</small><small>${money(p.budget)}</small></div></article>`;}).join('')}</div>`:empty('Proyek belum ada','Buat proyek baru atau pilih unit bisnis lain.')}${projectExtras(ctx())}`;
}
function tasksPage() {
  const ts = scopedTasks().filter(t=>t.title.toLowerCase().includes(state.search.toLowerCase()));
  return `${head('Pekerjaan','Tugas','Setiap tugas punya proyek, penanggung jawab, dan tanggal.',writable('tasks')?'<button class="button" data-modal="task">+ Buat tugas</button>':'')}<div class="toolbar"><input data-search placeholder="Cari tugas" aria-label="Cari tugas" value="${h(state.search)}"><small>${ts.length} tugas</small></div>${ts.length?`<div class="table-wrap"><table><thead><tr><th>Tugas</th><th>Proyek</th><th>Penanggung jawab</th><th>Batas waktu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${ts.map(t=>`<tr><td><strong>${h(t.title)}</strong></td><td>${h(projectFor(t.project_id)?.name || '—')}</td><td>${h(state.data.employees.find(e=>e.user_id===t.assignee_user_id)?.name||'Saya')}</td><td>${dateLabel(t.due_date)}</td><td>${badge(t.status)}</td><td>${t.status==='Belum mulai'?`<button class="button small secondary" data-action="start-task" data-id="${h(t.id)}">Mulai</button>`:t.status==='Dikerjakan'?`<button class="button small secondary" data-action="finish-task" data-id="${h(t.id)}">Selesai</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:empty('Belum ada tugas','Tugas akan muncul setelah dibuat oleh tim.')}`;
}
function attendancePage() {
  const records=state.data.attendance.filter(a=>a.user_id===state.user.id).sort((a,b)=>String(b.check_in_at).localeCompare(String(a.check_in_at)));
  const active=records.find(a=>!a.check_out_at); const today=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date());
  return `${head('Kehadiran','Absensi saya','Catat masuk dan pulang. Lokasi dan foto diperlukan saat tugas lapangan.')}<div class="attendance-card"><section class="attendance-status"><div><span class="eyebrow" style="color:#aaa">${today}</span><div class="big-time" id="clock">${new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date())}</div><p>${active?'Anda sudah masuk. Catat pulang setelah tugas selesai.':'Anda belum mencatat kehadiran hari ini.'}</p></div><button class="button yellow" ${active?'data-action="check-out"':'data-modal="attendance"'}>${active?'Catat pulang':'Catat masuk'}</button></section><section class="panel"><h2>Caranya sederhana</h2><div class="steps"><div class="step"><div><strong>Pilih tempat kerja</strong><small>Kantor atau lokasi event.</small></div></div><div class="step"><div><strong>Izinkan lokasi</strong><small>Untuk tugas lapangan, lokasi dicatat bersama kehadiran.</small></div></div><div class="step"><div><strong>Ambil foto lalu simpan</strong><small>Foto hanya diminta untuk tugas lapangan.</small></div></div></div><div class="notice"><strong>Hari tambahan</strong><br>Hari Sabtu, Minggu, dan tanggal libur yang terdaftar ditandai untuk diperiksa dalam proses day payment.</div></section></div><div class="section-title"><h2>Riwayat saya</h2></div>${records.length?`<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Tempat</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr></thead><tbody>${records.map(a=>`<tr><td>${dateLabel(a.check_in_at)}</td><td>${h(a.source==='FIELD'?'Lapangan':'Kantor')}</td><td>${new Date(a.check_in_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})}</td><td>${a.check_out_at?new Date(a.check_out_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}):'—'}</td><td>${badge(a.check_out_at?'Selesai':'Hadir')}</td></tr>`).join('')}</tbody></table></div>`:empty('Belum ada catatan','Catat masuk untuk memulai riwayat kehadiran.')}`;
}
function inventoryPage() {
  const items=scope(state.data.inventory).filter(i=>`${i.sku} ${i.item_name} ${i.location}`.toLowerCase().includes(state.search.toLowerCase()));
  return `${head('Operasional','Gudang','Stok tercatat per barang dan lokasi.',writable('inventory')?`<button class="button secondary" data-modal="item" ${['CEO','GA_SUPERVISOR','LOGISTICS'].includes(state.user.role)?'':'hidden'}>+ Daftar barang</button><button class="button" data-modal="movement" ${state.data.inventory.length?'':'disabled'}>+ Catat pergerakan</button>`:'')}<div class="toolbar"><input data-search placeholder="Cari barang atau lokasi" aria-label="Cari stok" value="${h(state.search)}"><small>${items.length} baris stok</small></div>${items.length?`<div class="table-wrap"><table><thead><tr><th>Barang</th><th>Kode</th><th>Lokasi</th><th>Stok</th><th>Terakhir diperbarui</th></tr></thead><tbody>${items.map(i=>`<tr><td><strong>${h(i.item_name)}</strong></td><td>${h(i.sku)}</td><td>${h(i.location)}</td><td><strong>${h(i.quantity)} ${h(i.unit)}</strong></td><td>${dateLabel(i.updated_at)}</td></tr>`).join('')}</tbody></table></div>`:empty('Stok belum ada','Daftarkan barang, lalu catat stok masuk.')}` + stockCountsSection(ctx()) + assetSection(ctx());
}
function leadsPage() {
  const leads=scope(state.data.leads).filter(l=>`${l.company_name} ${l.contact_name}`.toLowerCase().includes(state.search.toLowerCase()));
  return `${head('Hubungan klien','Klien & peluang','Simpan kontak dan pantau peluang baru.',writable('leads')?'<button class="button" data-modal="lead">+ Tambah peluang</button>':'')}<div class="toolbar"><input data-search placeholder="Cari perusahaan" aria-label="Cari klien" value="${h(state.search)}"><small>${leads.length} peluang</small></div>${leads.length?`<div class="grid-cards">${leads.map(l=>`<article class="item-card">${unitTag(l.business_unit_id)}<h3>${h(l.company_name)}</h3><p>${h(l.contact_name)}<br>${h(l.contact_email)}</p><div class="item-card-foot">${badge(l.stage)}<small>${dateLabel(l.created_at)}</small></div></article>`).join('')}</div>`:empty('Belum ada peluang','Tambahkan calon klien pertama.')}`;
}
function approvalsPage() {
  const items=scope(state.data.approvals);
  return `${head('Keputusan','Persetujuan','Periksa permintaan sebelum memberi keputusan.')}<div class="panel">${items.length?items.map(a=>`<div class="list-row"><div>${unitTag(a.business_unit_id)}<strong style="display:block;margin:8px 0 3px">${h(a.title)}</strong><small>${h(a.type)} · ${dateLabel(a.created_at)}</small></div><div class="list-right">${badge(a.status)}${a.status==='Menunggu'&&writable('approvals')?`<div style="margin-top:10px;display:flex;gap:6px"><button class="button small" data-action="approve" data-id="${h(a.id)}">Setujui</button><button class="button small secondary" data-action="reject" data-id="${h(a.id)}">Tolak</button></div>`:''}</div></div>`).join(''):empty('Tidak ada permintaan','Permintaan baru akan tampil di sini.')}</div>`;
}

function field(name,label,type='text',extra='') { return `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" ${extra} required></div>`; }
function selectField(name,label,options) { return `<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}" required>${options.map(([value,label])=>`<option value="${h(value)}">${h(label)}</option>`).join('')}</select></div>`; }
function modalHtml() {
  const opts=UNITS.filter(u=>state.user.global||u.id===state.user.business_unit_id).map(u=>[u.id,u.name]);
  const projects=scopedProjects().map(p=>[p.id,p.name]);
  const forms={
    project: {title:'Buat proyek',intro:'Isi data utama. Lokasi absensi dapat ditambahkan bila sudah diketahui.',html:field('name','Nama proyek','text','maxlength="100"')+field('client_name','Nama klien','text','maxlength="100"')+selectField('business_unit_id','Unit bisnis',opts)+selectField('stage','Tahap proyek',STAGES.map(s=>[s,STAGE_LABELS[s]]))+`<div class="form-row">${field('start_date','Mulai','date')}${field('end_date','Selesai','date')}</div>`+field('budget','Anggaran (Rp)','number','min="0" step="1"')+`<details class="optional-fields"><summary>Atur lokasi absensi lapangan (opsional)</summary><p>Isi ketiganya untuk membatasi catat masuk di sekitar lokasi event.</p><div class="form-row"><label class="field">Lintang<input name="site_latitude" type="number" step="any" min="-90" max="90" placeholder="-6.2000"></label><label class="field">Bujur<input name="site_longitude" type="number" step="any" min="-180" max="180" placeholder="106.8167"></label></div><label class="field">Radius (meter)<input name="geofence_radius_m" type="number" min="20" max="5000" step="1" placeholder="200"></label></details>`},
    task: {title:'Buat tugas',intro:'Pilih penanggung jawab yang aktif dan berada di unit proyek.',html:field('title','Apa pekerjaannya?','text','maxlength="120"')+selectField('project_id','Proyek',projects)+selectField('assignee_user_id','Penanggung jawab',scope(state.data.employees).filter(e=>e.status==='ACTIVE').map(e=>[e.user_id,e.name]))+field('due_date','Batas waktu','date')},
    movement: {title:'Catat pergerakan barang',intro:'Untuk barang keluar, isi lokasi asal. Untuk barang masuk, isi lokasi tujuan.',html:selectField('sku','Barang',[...new Map(scope(state.data.inventory).map(i=>[i.sku,[i.sku,`${i.item_name} (${i.sku})`]])).values()])+`<div class="field"><button class="button small secondary" type="button" data-action="scan-barcode">Pindai QR / barcode</button><div id="scanner-container"></div><small class="field-hint">Jika kamera tidak mendukung pemindaian, pilih kode barang dari daftar.</small></div><div class="field"><label for="f-from_location">Dari lokasi (kosong jika stok baru)</label><input id="f-from_location" name="from_location" placeholder="Contoh: Gudang Utama"></div><div class="field"><label for="f-to_location">Ke lokasi (kosong jika barang keluar)</label><input id="f-to_location" name="to_location" placeholder="Contoh: Main Booth"></div>`+field('quantity','Jumlah','number','min="1" step="1"')+selectField('condition','Kondisi',[['Good','Baik'],['Damaged','Rusak']])},
    item: {title:'Daftarkan barang',intro:'Buat kode dan lokasi awal. Stok awal nol; catat barang masuk setelah disimpan.',html:field('sku','Kode barang','text','maxlength="80"')+field('item_name','Nama barang','text','maxlength="100"')+selectField('business_unit_id','Unit bisnis',opts)+field('location','Lokasi awal','text','maxlength="100"')+field('unit','Satuan','text','placeholder="Contoh: pcs" maxlength="20"')},
    lead: {title:'Tambah peluang klien',intro:'Catat kontak agar tim bisa melanjutkan percakapan.',html:field('company_name','Nama perusahaan','text','maxlength="100"')+field('contact_name','Nama kontak','text','maxlength="100"')+field('contact_email','Email kontak','email')+selectField('business_unit_id','Unit bisnis',opts)},
    attendance: {title:'Catat masuk',intro:'Pilih tempat kerja, lalu ikuti petunjuk di bawah.',html:selectField('source','Tempat kerja',[['FIELD','Lokasi event / lapangan'],['OFFICE','Kantor']])+`<div class="field"><label for="f-project_id">Proyek (jika lapangan)</label><select id="f-project_id" name="project_id"><option value="">Pilih proyek</option>${projects.map(([v,l])=>`<option value="${h(v)}">${h(l)}</option>`).join('')}</select></div><div class="field"><label>Bukti lapangan</label><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="button small secondary" data-action="get-location">Ambil lokasi</button><button type="button" class="button small secondary" data-action="open-camera">Buka kamera</button></div><small class="field-hint" id="location-label">Lokasi belum diambil.</small><div id="photo-container"></div></div>${state.data.employees.find(x=>x.user_id===state.user.id)?.nfc_enrolled?`<div class="field"><label>Kartu kantor</label><button type="button" class="button small secondary" data-action="scan-nfc">Pindai kartu NFC</button><p id="nfc-label" class="muted">Belum dipindai.</p></div>`:''}`},
  };
  if(state.modal==='credential'){const c=state.oneTimeCredential;return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Kata sandi sementara"><div class="modal-head"><h2>Kredensial untuk ${h(c?.name||c?.username)}</h2></div><p>Sampaikan secara pribadi kepada karyawan. Sandi ini hanya tampil sekarang dan harus diganti saat masuk pertama kali.</p><div class="field"><label>Nama pengguna<input readonly value="${h(c?.username||'')}"></label></div><div class="field"><label>Kata sandi sementara<input readonly value="${h(c?.temporary_password||'')}"></label></div><button class="button" data-action="dismiss-credential">Sudah saya catat</button></div></div>`;}
  if(state.modal==='importConfirm')return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-label="Periksa impor"><div class="modal-head"><h2>Periksa sebelum impor</h2><button class="close" data-action="close-modal" aria-label="Tutup">×</button></div><p>${h(state.importDraft?.dataset)} · ${h(state.importDraft?.rows.length||0)} baris siap disimpan.</p><div class="notice">Data baru akan ditambahkan. Baris dengan nama/tanggal ganda ditolak server.</div><div class="form-actions"><button class="button secondary" data-action="close-modal">Batal</button><button class="button" data-action="confirm-import">Simpan ${h(state.importDraft?.rows.length||0)} baris</button></div></div></div>`;
  if(state.modal==='more') return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-label="Menu lainnya"><div class="modal-head"><h2>Menu lainnya</h2><button class="close" data-action="close-modal" aria-label="Tutup">×</button></div><div class="nav" style="margin-top:20px">${NAV.filter(([k])=>allowed(k)).map(([k,l])=>`<button style="color:#111" data-page="${k}">${l}</button>`).join('')}${state.mode==='remote'?'<button style="color:#111" data-action="change-password">Ganti kata sandi</button><button style="color:#111" data-action="enable-notifications">Aktifkan pemberitahuan perangkat</button>':''}<button style="color:#111" data-action="logout">Keluar</button></div>${state.mode==='demo'?`<div class="field" style="margin-top:22px"><label for="roleSelect">Coba peran lain</label><select id="roleSelect">${Object.entries(ROLE_LABELS).map(([k,l])=>`<option value="${k}" ${state.user.role===k?'selected':''}>${h(l)}</option>`).join('')}</select></div>`:''}</div></div>`;
  const form=forms[state.modal]; if(!form)return workflowModal(state.modal,ctx())||moduleModal(state.modal,ctx());
  return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><span class="eyebrow">ARAIA Workspace</span><h2 id="modal-title">${form.title}</h2><p class="muted">${form.intro}</p></div><button class="close" data-action="close-modal" aria-label="Tutup">×</button></div><form id="entry-form" data-kind="${state.modal}"><div class="form-grid">${form.html}<div class="form-actions"><button type="button" class="button secondary" data-action="close-modal">Batal</button><button class="button" type="submit">Simpan</button></div></div></form></div></div>`;
}

async function call(action,payload={}) {
  if(state.mode==='demo') return demoAction(action,payload);
  if(!navigator.onLine){if(!canQueue(action,payload))throw Error('Aksi ini memerlukan koneksi internet.');await enqueue(state.user.id,action,payload);state.queue=await listQueue(state.user.id);state.lastQueued=true;return {queued:true};}
  try{return await api(action,payload,state.token);}catch(err){
    if(canQueue(action,payload)&&/Permintaan terlalu lama|Koneksi Apps Script belum siap|Layanan sedang bermasalah/.test(String(err.message))){await enqueue(state.user.id,action,payload);state.queue=await listQueue(state.user.id);state.lastQueued=true;return {queued:true};}
    throw err;
  }
}
function demoAction(action,p) {
  const d=state.data, now=new Date().toISOString(), id=uid(); let out;
  if(action==='project.create'){out={...p,id,owner_user_id:state.user.id,created_at:now,updated_at:now};d.projects.unshift(out);}
  else if(action==='task.create'){const pr=d.projects.find(x=>x.id===p.project_id),e=d.employees.find(x=>x.user_id===p.assignee_user_id&&x.status==='ACTIVE');if(!pr||!e||e.business_unit_id!==pr.business_unit_id)throw Error('PIC harus aktif dan satu unit dengan proyek.');out={...p,id,status:'Belum mulai',created_at:now};d.tasks.unshift(out);}
  else if(action==='task.update'){out=d.tasks.find(t=>t.id===p.id);if(!out||out.status==='Selesai'||!['Dikerjakan','Selesai'].includes(p.status))throw Error('Status tugas tidak valid.');out.status=p.status;}
  else if(action==='project.stage'){out=d.projects.find(x=>x.id===p.id);if(!out||STAGES[STAGES.indexOf(out.stage)+1]!==p.stage)throw Error('Proyek hanya dapat maju ke tahap berikutnya.');if(p.stage==='Project Closed'&&d.tasks.some(t=>t.project_id===out.id&&t.status!=='Selesai'))throw Error('Selesaikan seluruh tugas dahulu.');out.stage=p.stage;out.updated_at=now;}
  else if(action==='lead.create'){out={...p,id,stage:'Brief diterima',created_at:now};d.leads.unshift(out);}
  else if(action==='attendance.checkIn'){if(d.attendance.some(a=>a.user_id===state.user.id&&!a.check_out_at))throw Error('Catatan masuk masih aktif.');out={id,user_id:state.user.id,check_in_at:now,check_out_at:'',extra_day:[0,6].includes(new Date().getDay()),...p};d.attendance.unshift(out);}
  else if(action==='attendance.checkOut'){out=d.attendance.find(a=>a.user_id===state.user.id&&!a.check_out_at);if(!out)throw Error('Belum ada catatan masuk.');out.check_out_at=now;}
  else if(action==='inventory.move'){if(!p.from_location&&!p.to_location)throw Error('Isi lokasi asal atau tujuan.');if(p.from_location===p.to_location)throw Error('Lokasi asal dan tujuan harus berbeda.');const qty=Number(p.quantity);if(!Number.isInteger(qty)||qty<1)throw Error('Jumlah harus bilangan positif.');const from=d.inventory.find(i=>i.sku===p.sku&&i.location.toLowerCase()===p.from_location.toLowerCase());const target=d.inventory.find(i=>i.sku===p.sku&&i.location.toLowerCase()===p.to_location.toLowerCase());if(p.from_location&&(!from||from.quantity<qty))throw Error('Stok di lokasi asal tidak cukup.');const ref=from||d.inventory.find(i=>i.sku===p.sku);if(!ref)throw Error('Barang tidak ditemukan.');if(!state.user.global&&ref.business_unit_id!==state.user.business_unit_id)throw Error('Barang berada di luar unit Anda.');if(from){from.quantity-=qty;from.updated_at=now;}if(p.to_location){if(target){target.quantity+=qty;target.updated_at=now;}else d.inventory.push({id:uid(),sku:p.sku,item_name:ref.item_name,business_unit_id:ref.business_unit_id,location:p.to_location,quantity:qty,unit:ref.unit,updated_at:now});}out={...p,id,business_unit_id:ref.business_unit_id,actor_user_id:state.user.id,created_at:now};d.movements.unshift(out);}
  else if(action==='inventory.itemCreate'){if(d.inventory.some(i=>i.sku.toUpperCase()===p.sku.toUpperCase()))throw Error('Kode barang sudah terdaftar.');out={...p,sku:p.sku.toUpperCase(),id,quantity:0,updated_at:now};d.inventory.push(out);}
  else if(action==='approval.decide'){out=d.approvals.find(a=>a.id===p.id);if(!out)throw Error('Permintaan tidak ditemukan.');if(out.requester_user_id===state.user.id)throw Error('Permintaan sendiri tidak dapat disetujui.');if(out.approver_role&&out.approver_role!==state.user.role&&state.user.role!=='CEO')throw Error('Permintaan memerlukan peran lain.');demoDecisionCascade(out,state,p.decision);}
  else if(action.startsWith('work.'))out=workflowDemoAction(action,p,state,uid);
  else {out=moduleDemoAction(action,p,state,uid);if(out===null)throw Error('Aksi belum tersedia.');}
  saveDemo();return out;
}
async function reload() { if(state.mode==='remote'&&navigator.onLine){state.data=await api('app.bootstrap',{},state.token);saveSnapshot(state.data).catch(()=>{});}render(); }
async function refreshQueue(){if(state.mode==='remote'&&state.user){state.queue=await listQueue(state.user.id);render();}}
async function syncQueued(){if(state.syncing||state.mode!=='remote'||!state.user||!navigator.onLine)return;state.syncing=true;let sent=0;try{for(const job of await listQueue(state.user.id)){if(job.status==='Gagal')continue;try{await api(job.action,job.payload,state.token);await removeQueue(job.id);sent++;}catch(err){await markQueue(job,'Gagal',err.message);}}state.queue=await listQueue(state.user.id);if(sent)await reload();else render();if(sent)toast(`${sent} pekerjaan terkirim ke server.`);}finally{state.syncing=false;}}
function navigate(page) { state.page=page;state.subtab='';state.search='';state.modal='';stopCamera();render();window.scrollTo(0,0); }
function closeModal(){state.modal='';state.importDraft=null;state.photoData='';state.coords=null;state.nfcSerial='';if(state.nfcAbort){state.nfcAbort.abort();state.nfcAbort=null;}stopCamera();render();}
function downloadText(name,content){const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function stopCamera(){if(state.scanTimer){clearTimeout(state.scanTimer);state.scanTimer=null;}if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null;}}
function showPhoto(){const container=document.getElementById('photo-container');if(container)container.innerHTML=`<img class="photo-preview" alt="Foto bukti yang baru diambil" src="${state.photoData}">`;}
async function startRemoteSession(result){state.token=result.token;sessionStorage.setItem('araia-session',state.token);state.user=result.user;sessionStorage.setItem('araia-user-id',state.user.id);state.unit=state.user.global?'ALL':state.user.business_unit_id;state.mode=state.user.must_change_password?'change':'remote';if(state.mode==='remote'){await reload();await refreshQueue();await syncQueued();}else render();}
async function getLocation(){if(!navigator.geolocation){toast('Lokasi tidak tersedia pada perangkat ini.');return;}const label=document.getElementById('location-label');if(label)label.textContent='Mengambil lokasi…';navigator.geolocation.getCurrentPosition(pos=>{state.coords={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy};const el=document.getElementById('location-label');if(el)el.textContent=`Lokasi didapat (akurasi ±${Math.round(pos.coords.accuracy)} m).`;},()=>{const el=document.getElementById('location-label');if(el)el.textContent='Lokasi gagal diambil. Izinkan akses lokasi dan coba lagi.';},{enableHighAccuracy:true,timeout:12000,maximumAge:0});}
async function openCamera(){try{stopCamera();state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640}},audio:false});const target=document.getElementById('photo-container');target.innerHTML='<video id="camera" class="camera-video" autoplay playsinline muted></video><div class="camera-actions"><button type="button" class="button small" data-action="capture-photo">Ambil foto</button></div>';document.getElementById('camera').srcObject=state.stream;}catch{toast('Kamera tidak dapat dibuka. Periksa izin kamera dan HTTPS.');}}
function capturePhoto(){const v=document.getElementById('camera');if(!v||!v.videoWidth){toast('Tunggu kamera siap.');return;}const c=document.createElement('canvas');c.width=640;c.height=Math.round(v.videoHeight*640/v.videoWidth);c.getContext('2d').drawImage(v,0,0,c.width,c.height);state.photoData=c.toDataURL('image/jpeg',.68);stopCamera();showPhoto();}
async function scanBarcode(){
  if(!('BarcodeDetector' in window)){toast('Pemindaian tidak didukung perangkat ini. Pilih barang dari daftar.');return;}
  try{stopCamera();const detector=new BarcodeDetector({formats:['qr_code','code_128','ean_13','ean_8']});state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});const target=document.getElementById('scanner-container');if(!target){stopCamera();return;}target.innerHTML='<video id="barcode-video" class="camera-video" autoplay playsinline muted></video><button type="button" class="button small secondary" data-action="stop-scanner">Tutup kamera</button>';const video=document.getElementById('barcode-video');video.srcObject=state.stream;const detect=async()=>{if(!state.stream||!document.getElementById('barcode-video'))return;try{if(video.readyState>=2){const values=await detector.detect(video);if(values.length){const sku=String(values[0].rawValue||'').trim().toUpperCase();const select=document.getElementById('f-sku');if(select&&[...select.options].some(x=>x.value.toUpperCase()===sku)){select.value=[...select.options].find(x=>x.value.toUpperCase()===sku).value;stopCamera();target.innerHTML='';toast('Kode barang ditemukan.');return;}toast('Kode belum ada di daftar barang unit ini.');stopCamera();target.innerHTML='';return;}}}catch{}state.scanTimer=setTimeout(detect,350);};state.scanTimer=setTimeout(detect,350);
  }catch{stopCamera();toast('Kamera tidak dapat digunakan. Pilih barang dari daftar.');}
}
async function scanNfc(){
  if(!('NDEFReader' in window)){toast('Web NFC tidak didukung di perangkat ini. Gunakan perangkat NFC yang sesuai.');return;}
  try{if(state.nfcAbort)state.nfcAbort.abort();const controller=new AbortController();state.nfcAbort=controller;const reader=new NDEFReader();reader.addEventListener('reading',event=>{const serial=String(event.serialNumber||'').toUpperCase();if(!serial){toast('Nomor kartu tidak terbaca. Coba lagi.');return;}state.nfcSerial=serial;const label=document.getElementById('nfc-label');if(label)label.textContent='Kartu terbaca. Lanjut simpan.';controller.abort();state.nfcAbort=null;},{once:true});await reader.scan({signal:controller.signal});const label=document.getElementById('nfc-label');if(label)label.textContent='Tempelkan kartu NFC sekarang.';setTimeout(()=>{if(state.nfcAbort===controller){controller.abort();state.nfcAbort=null;}},20000);}catch{toast('Kartu NFC gagal dipindai. Periksa izin dan coba lagi.');}
}

app.addEventListener('click',async event=>{
  const catalogArea=event.target.closest('[data-catalog-area]');if(catalogArea){state.catalogArea=catalogArea.dataset.catalogArea;state.search='';render();return;}
  const catalogRoute=event.target.closest('[data-catalog-route]');if(catalogRoute){const route=catalogRoute.dataset.catalogRoute;if(route.startsWith('work:')){const type=WORKFLOW_TYPES.find(x=>x.id===route.slice(5));if(type&&workflowTypes(state.user).some(x=>x.id===type.id)){navigate('work');state.workArea=type.area;state.workType=type.id;render();}else toast('Modul ini tidak tersedia untuk peran Anda.');}else if(route==='export'){state.modal='export';render();}else if(route==='import'){if(['CEO','CORSEC_DIRECTOR','FINANCE_DIRECTOR','PAM','PM','SENIOR_PM','ADMIN_PROJECT','GA_SUPERVISOR'].includes(state.user.role)){state.modal='import';render();}else toast('Impor master tidak tersedia untuk peran Anda.');}else{const [page,tab]=route.split(':');if(allowed(page)){navigate(page);if(tab){state.subtab=tab;render();}}else toast('Bagian ini tidak tersedia untuk peran Anda.');}return;}
  const workArea=event.target.closest('[data-work-area]');if(workArea){state.workArea=workArea.dataset.workArea;state.workType='';state.search='';render();return;}
  const workType=event.target.closest('[data-work-type]');if(workType){state.workType=workType.dataset.workType;render();return;}
  const workAction=event.target.closest('[data-work-action]');if(workAction){try{await call('work.'+workAction.dataset.workAction,{id:workAction.dataset.id,requestId:uid()});await reload();toast('Pekerjaan diperbarui.');}catch(err){toast(err.message);}return;}
  const subtab=event.target.closest('[data-subtab]');if(subtab){state.subtab=subtab.dataset.subtab;state.search='';render();return;}
  const page=event.target.closest('[data-page]');if(page){navigate(page.dataset.page);return;}
  const modal=event.target.closest('[data-modal]');if(modal){state.modal=modal.dataset.modal;state.photoData='';state.coords=null;render();return;}
  const button=event.target.closest('[data-action]');if(!button)return;
  if(button.classList.contains('modal-backdrop') && event.target!==button)return;
  const action=button.dataset.action;
  try{
    if(action==='demo-login'){state.mode='demo';state.user={id:'demo',name:'Mimo',role:'PM',business_unit_id:'DOTSIXTWOO',global:false};state.unit='DOTSIXTWOO';saveDemo();render();}
    else if(action==='logout'){if(state.mode==='remote'||state.mode==='change'){try{await api('auth.logout',{},state.token);}catch{}sessionStorage.removeItem('araia-session');sessionStorage.removeItem('araia-user-id');}else localStorage.removeItem('araia-demo-user');state.user=null;state.token='';state.mode='login';state.oneTimeCredential=null;render();}
    else if(action==='change-password'){state.modal='';state.mode='change';render();}
    else if(action==='cancel-change'){state.mode='remote';render();}
    else if(action==='dismiss-credential'){state.oneTimeCredential=null;state.modal='';render();}
    else if(action==='reset-password'){const result=await call('auth.resetPassword',{user_id:button.dataset.userId,requestId:uid()});if(result.temporary_password){state.oneTimeCredential={...result,name:state.data.employees.find(x=>x.user_id===button.dataset.userId)?.name};state.modal='credential';render();}else toast('Sandi sudah diatur ulang, tetapi tampilan sekali telah lewat. Atur ulang lagi untuk sandi baru.');}
    else if(action==='sync-offline'){await syncQueued();toast('Antrean sudah diperiksa.');}
    else if(action==='discard-offline'){await removeQueue(button.dataset.id);await refreshQueue();toast('Satu antrean dihapus dari perangkat.');}
    else if(action==='retry-offline'){const item=state.queue.find(q=>q.id===button.dataset.id);if(item){await markQueue(item,'Menunggu','');await syncQueued();}}
    else if(action==='download-import-template'){const dataset=document.querySelector('#entry-form select[name="dataset"]')?.value;const fields={clients:['company_name','industry','pic_name','email','phone'],vendors:['name','email','phone'],holidays:['date','name']}[dataset];if(fields)downloadText(`ARAIA_template_${dataset}.csv`,'\uFEFF'+fields.join(',')+'\r\n');}
    else if(action==='confirm-import'){if(!state.importDraft)throw Error('Pratinjau impor hilang. Pilih file lagi.');const result=await call('data.import',{...state.importDraft,requestId:uid()});closeModal();await reload();toast(`${result.imported} baris ditambahkan.`);}
    else if(action==='close-modal')closeModal();
    else if(action==='more-menu'){state.modal='more';render();}
    else if(action==='get-location')await getLocation();
    else if(action==='open-camera')await openCamera();
    else if(action==='capture-photo')capturePhoto();
    else if(action==='scan-barcode')await scanBarcode();
    else if(action==='stop-scanner'){stopCamera();const target=document.getElementById('scanner-container');if(target)target.innerHTML='';}
    else if(action==='scan-nfc')await scanNfc();
    else if(action==='start-task'||action==='finish-task'){await call('task.update',{id:button.dataset.id,status:action==='start-task'?'Dikerjakan':'Selesai',requestId:uid()});await reload();toast('Status tugas diperbarui.');}
    else if(action==='advance-project'){await call('project.stage',{id:button.dataset.id,stage:button.dataset.stage,requestId:uid()});await reload();toast('Tahap proyek diperbarui.');}
    else if(action==='check-out'){await call('attendance.checkOut',{requestId:uid()});await reload();toast('Waktu pulang tersimpan.');}
    else if(action==='approve'||action==='reject'){await call('approval.decide',{id:button.dataset.id,decision:action==='approve'?'Disetujui':'Ditolak',requestId:uid()});await reload();toast('Keputusan tersimpan.');}
    else if(action==='issue-order'){await call('order.create',{purchase_request_id:button.dataset.id,requestId:uid()});await reload();toast('Draft PO dibuat.');}
    else if(action==='issue-po'){await call('order.issue',{id:button.dataset.id,requestId:uid()});await reload();toast('PO ditandai diterbitkan.');}
    else if(action==='journal-submit'){await call('journal.submit',{id:button.dataset.id,requestId:uid()});await reload();toast('Jurnal menunggu persetujuan.');}
    else if(action==='ledger-summary'){const bu=state.unit==='ALL'?state.user.business_unit_id:state.unit;state.ledgerSummary=state.mode==='demo'?demoLedgerSummary(state,bu):await call('ledger.summary',{business_unit_id:bu});render();}
    else if(action==='employee-status'){await call('employee.status',{id:button.dataset.id,status:button.dataset.status,requestId:uid()});await reload();toast('Status karyawan diperbarui.');}
    else if(action==='read-notification'){await call('notification.read',{id:button.dataset.id,requestId:uid()});await reload();}
    else if(action==='fulfill-sale'){await call('sale.fulfill',{id:button.dataset.id,requestId:uid()});await reload();toast('Pesanan terpenuhi dan stok berkurang.');}
    else if(action==='add-sale-line'){const target=document.getElementById('sale-lines');if(target&&target.children.length<20)target.insertAdjacentHTML('beforeend',saleLineHtml(ctx()));}
    else if(action==='add-journal-line'){const target=document.getElementById('journal-lines');if(target&&target.children.length<20)target.insertAdjacentHTML('beforeend',journalLineHtml(ctx()));}
    else if(action==='remove-journal-line'){const target=button.closest('[data-journal-line]');if(target&&document.querySelectorAll('[data-journal-line]').length>2)target.remove();}
    else if(action==='remove-sale-line'){const target=button.closest('[data-sale-line]');if(target&&document.querySelectorAll('[data-sale-line]').length>1)target.remove();}
    else if(action==='enable-notifications'){if(!('Notification' in window)){toast('Pemberitahuan perangkat tidak didukung di browser ini.');return;}const permission=await Notification.requestPermission();toast(permission==='granted'?'Pemberitahuan aktif selama aplikasi terbuka.':'Izin pemberitahuan belum diberikan.');}
  }catch(err){toast(err.message||'Terjadi kesalahan.');}
});
app.addEventListener('change',event=>{
  if(event.target.id==='unitSelect'){state.unit=event.target.value;state.search='';render();}
  if(event.target.id==='roleSelect'&&state.mode==='demo'){state.user.role=event.target.value;state.user.id=state.user.role==='PM'?'demo':state.user.role==='TALENT_PROJECT'?'staff-1':`demo-${state.user.role}`;state.user.name=state.data.employees.find(x=>x.user_id===state.user.id)?.name||ROLE_LABELS[state.user.role];state.user.global=['CEO','CORSEC_DIRECTOR','FINANCE_DIRECTOR','CREATIVE_DIRECTOR'].includes(state.user.role);state.unit=state.user.global?'ALL':state.user.business_unit_id;saveDemo();closeModal();}
});
app.addEventListener('input',event=>{if(event.target.matches('[data-search]')){const pos=event.target.selectionStart;state.search=event.target.value;render();const input=app.querySelector('[data-search]');input?.focus();input?.setSelectionRange(pos,pos);}});
app.addEventListener('submit',async event=>{
  if(event.target.id==='login-form'||event.target.id==='change-password-form'){
    event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]'),p=Object.fromEntries(new FormData(form));button.disabled=true;
    try{
      if(form.id==='login-form'){
        if(!CONFIG.gasUrl)throw Error('Alamat Apps Script belum diisi di config.js.');
        await startRemoteSession(await api('auth.login',{username:p.username,password:p.password}));
      }else{
        if(p.newPassword!==p.confirmPassword)throw Error('Ulangi kata sandi baru dengan sama.');
        await api('auth.changePassword',{currentPassword:p.currentPassword,newPassword:p.newPassword},state.token);
        state.user.must_change_password=false;state.mode='remote';await reload();await refreshQueue();toast('Kata sandi berhasil diganti.');
      }
    }catch(err){toast(err.message||'Coba lagi.');button.disabled=false;}return;
  }
  if(event.target.id==='search-form'){
    event.preventDefault();const query=String(new FormData(event.target).get('query')||'').trim();
    try{state.search=query;if(state.mode==='remote')state.results=await call('data.search',{query});else{const sources=[['Proyek','projects','name'],['Tugas','tasks','title'],['Lead','leads','company_name'],['Klien','clients','company_name'],['Stok','inventory','item_name'],['Pekerjaan','work_items','title']];state.results=sources.flatMap(([type,key,field])=>(state.data[key]||[]).filter(x=>(state.user.global||x.business_unit_id===state.user.business_unit_id)&&allowed({projects:'projects',tasks:'tasks',leads:'leads',clients:'leads',inventory:'inventory',work_items:'work'}[key])&&String(x[field]||'').toLowerCase().includes(query.toLowerCase())).map(x=>({id:x.id,type,label:x[field],page:{projects:'projects',tasks:'tasks',leads:'leads',clients:'leads',inventory:'inventory',work_items:'work'}[key],business_unit_id:x.business_unit_id}))).slice(0,50);}render();}catch(err){toast(err.message);}return;
  }
  if(event.target.id!=='entry-form')return;event.preventDefault();const form=event.target,kind=form.dataset.kind,submit=form.querySelector('[type=submit]');const p=Object.fromEntries(new FormData(form));
  try{
    if(kind==='project' && p.end_date<p.start_date)throw Error('Tanggal selesai harus setelah tanggal mulai.');
    if(kind==='task'&&!p.project_id)throw Error('Pilih proyek lebih dahulu.');
    if(kind==='movement'&&(!p.from_location&&!p.to_location||p.from_location===p.to_location))throw Error('Isi lokasi asal dan/atau tujuan yang berbeda.');
    if(kind==='attendance'){if(p.source==='FIELD'){if(!p.project_id)throw Error('Pilih proyek untuk tugas lapangan.');if(!state.coords)throw Error('Ambil lokasi sebelum menyimpan.');if(!state.photoData)throw Error('Ambil foto sebelum menyimpan.');}else if(state.data.employees.find(x=>x.user_id===state.user.id)?.nfc_enrolled&&!state.nfcSerial)throw Error('Pindai kartu NFC yang terdaftar sebelum mencatat masuk.');Object.assign(p,state.coords||{});p.photoData=state.photoData;p.nfc_serial=state.nfcSerial;}
    if(kind==='nfcEnroll'){if(!state.nfcSerial)throw Error('Pindai kartu NFC lebih dahulu.');p.serial=state.nfcSerial;}
    if(kind==='meeting'){p.attendee_user_ids=[...form.querySelectorAll('input[name="attendee_user_ids"]:checked')].map(input=>input.value);if(!p.attendee_user_ids.length)throw Error('Pilih setidaknya satu anggota meeting.');}
    if(kind==='document'){
      const file=form.querySelector('input[name="file"]').files[0];
      if(!file||file.size>2*1024*1024||!['application/pdf','image/png','image/jpeg'].includes(file.type))throw Error('Pilih PDF, PNG, atau JPEG maksimal 2 MB.');
      p.file_name=file.name;p.entity_type='PROJECT';p.dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('File gagal dibaca.'));reader.readAsDataURL(file);});delete p.file;
    }
    if(kind==='sale'){
      p.items=[...form.querySelectorAll('[data-sale-line]')].map(line=>({sku:line.querySelector('select[name="sku"]').value,quantity:Number(line.querySelector('input[name="quantity"]').value),unit_price:Number(line.querySelector('input[name="unit_price"]').value)}));
      if(!p.items.length||new Set(p.items.map(x=>x.sku)).size!==p.items.length)throw Error('Pilih barang yang berbeda di setiap baris.');
      delete p.sku;delete p.quantity;delete p.unit_price;
    }
    if(kind==='journal'){
      p.lines=[...form.querySelectorAll('[data-journal-line]')].map(line=>({account_code:line.querySelector('select[name="account_code"]').value,debit:Number(line.querySelector('input[name="debit"]').value),credit:Number(line.querySelector('input[name="credit"]').value)}));delete p.account_code;delete p.debit;delete p.credit;
      const debit=p.lines.reduce((n,l)=>n+Math.round(l.debit*100),0),credit=p.lines.reduce((n,l)=>n+Math.round(l.credit*100),0);
      if(!debit||debit!==credit)throw Error('Jumlah debit dan kredit harus sama.');
    }
    if(kind==='workCreate'||kind==='workEdit'){
      p.details={};for(const key of Object.keys(p)){if(key.startsWith('detail:')){p.details[key.slice(7)]=p[key];delete p[key];}}
      if(kind==='workCreate'){
        p.type=form.dataset.type;
        if(p.subject){const [subject_type,subject_id]=p.subject.split('|');p.subject_type=subject_type;p.subject_id=subject_id;}delete p.subject;
      }else{p.id=form.dataset.id;p.version=Number(form.dataset.version);}
      submit.disabled=true;submit.textContent='Menyimpan…';
      await call(kind==='workCreate'?'work.create':'work.update',{...p,requestId:uid()});closeModal();await reload();toast('Draft pekerjaan tersimpan.');return;
    }
    if(kind==='export'){
      const response=state.mode==='demo'?{dataset:p.dataset,fields:Object.keys((state.data[p.dataset]||[])[0]||{}),rows:state.data[p.dataset]||[]}:await call('data.export',{dataset:p.dataset,business_unit_id:state.unit==='ALL'?'':state.unit});
      const csvCell=value=>{let s=String(value??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
      const csv='\uFEFF'+[response.fields.map(csvCell).join(','),...response.rows.map(row=>response.fields.map(key=>csvCell(row[key])).join(','))].join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`ARAIA_${p.dataset}_${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);closeModal();toast('Data diunduh.');return;
    }
    if(kind==='import'){
      if(state.mode==='demo')throw Error('Impor master membutuhkan backend Google yang aktif.');
      const fields={clients:['company_name','industry','pic_name','email','phone'],vendors:['name','email','phone'],holidays:['date','name']}[p.dataset];
      const file=form.querySelector('input[name="file"]').files[0];if(!file||file.size>100000)throw Error('Pilih CSV maksimal 100 KB.');
      const rows=parseCsv(await file.text(),fields);const preview=await call('data.importPreview',{dataset:p.dataset,business_unit_id:p.business_unit_id,rows});
      if(preview.issues.length)throw Error(`Periksa baris ${preview.issues[0].line}: ${preview.issues[0].message}`);
      state.importDraft={dataset:p.dataset,business_unit_id:p.business_unit_id,rows};state.modal='importConfirm';render();return;
    }
    submit.disabled=true;submit.textContent='Menyimpan…';
    if(kind==='payroll'){
      state.payrollPreview=state.mode==='demo'?demoPayroll(state,p.period,p.business_unit_id):await call('payroll.preview',p);
      closeModal();render();toast('Pratinjau siap diperiksa.');return;
    }
    const action=({project:'project.create',task:'task.create',movement:'inventory.move',item:'inventory.itemCreate',lead:'lead.create',attendance:'attendance.checkIn'})[kind]||MODULE_ACTIONS[kind];
    if(!action)throw Error('Form belum tersedia.');
    const saved=await call(action,{...p,...(form.dataset.id?{id:form.dataset.id}:{}),requestId:uid()});
    if(saved?.temporary_password){state.oneTimeCredential={...saved,name:p.name};state.modal='credential';await reload();toast('Akun dibuat. Sampaikan sandi sementara secara pribadi.');return;}
    closeModal();await reload();toast(saved?.credentialAlreadyIssued?'Akun dibuat. Atur ulang sandi untuk memperoleh sandi baru.':'Data berhasil disimpan.');
  }catch(err){toast(err.message||'Gagal menyimpan.');submit.disabled=false;submit.textContent='Simpan';}
});
window.addEventListener('online',()=>{render();if(state.mode==='remote')syncQueued().then(()=>reload()).catch(err=>toast(err.message));});window.addEventListener('offline',render);
setInterval(()=>{const clock=document.getElementById('clock');if(clock)clock.textContent=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date());},30000);
setInterval(async()=>{if(state.mode!=='remote'||!state.user||!navigator.onLine)return;try{const previous=new Set((state.data.notifications||[]).map(x=>x.id));const list=await api('notification.list',{},state.token);const fresh=list.filter(x=>!previous.has(x.id)&&x.status==='Baru');state.data.notifications=list;if(fresh.length){if('Notification' in window&&Notification.permission==='granted')new Notification(fresh[0].title,{body:fresh[0].body});if(state.page==='home'&&!state.modal)render();else toast(`${fresh.length} pemberitahuan baru.`);}}catch{}},60000);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
if(state.mode==='login'&&state.token){
  state.mode='remote';
  if(!navigator.onLine){
    loadSnapshot(sessionStorage.getItem('araia-user-id')).then(snapshot=>{if(!snapshot)throw Error('Belum ada ringkasan offline.');state.user=snapshot.user;state.data={...seedData(),...snapshot};state.unit=state.user.global?'ALL':state.user.business_unit_id;render();refreshQueue().catch(()=>{});}).catch(()=>{state.mode='login';render();});
  }else{
    api('auth.session',{},state.token).then(user=>{
      state.user=user;
      if(user.must_change_password){state.mode='change';render();return;}
      return api('app.bootstrap',{},state.token).then(data=>{state.data=data;state.user=data.user;sessionStorage.setItem('araia-user-id',data.user.id);state.unit=state.user.global?'ALL':state.user.business_unit_id;render();saveSnapshot(data).catch(()=>{});refreshQueue().then(syncQueued).catch(()=>{});});
    }).catch(()=>{sessionStorage.removeItem('araia-session');state.token='';state.user=null;state.mode='login';render();});
  }
}else render();
