import { MODULE_CATALOG } from './module-catalog.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABELS={HRIS:'Tim',ERP:'Operasional',CRM:'Klien',SHARED:'Sistem'};
const EXTERNAL={signature:'Tanda tangan elektronik memerlukan penyedia dan akun organisasi.',whatsapp:'Pengiriman WhatsApp memerlukan token gateway dan persetujuan organisasi.',email:'Pengiriman email memerlukan konfigurasi pengirim dan kebijakan organisasi.',backup:'Pemulihan cadangan memerlukan akses pemilik Google Drive dan prosedur administrasi.'};
export function catalogPage(state){
  const area=state.catalogArea||'HRIS',query=String(state.search||'').toLowerCase(),items=MODULE_CATALOG.filter(item=>item.area===area&&item.name.toLowerCase().includes(query));
  return `<div class="view-head"><div><span class="eyebrow">Peta kerja</span><h1>Semua kebutuhan</h1><p>Cari nama pekerjaan, lalu buka tempat untuk mencatat atau mengerjakannya.</p></div></div>
    <div class="subtabs" role="tablist">${Object.entries(LABELS).map(([id,label])=>`<button role="tab" aria-selected="${area===id}" class="${area===id?'active':''}" data-catalog-area="${id}">${label}</button>`).join('')}</div>
    <div class="toolbar"><input data-search placeholder="Cari modul" aria-label="Cari modul" value="${esc(state.search)}"><small>${items.length} kebutuhan</small></div>
    <div class="workflow-grid">${items.map(item=>`<article class="workflow-card"><small>${esc(item.id)} · ${esc(item.coverage)}</small><strong>${esc(item.name)}</strong>${item.route.startsWith('external:')?`<p class="muted" style="font-size:.76rem;margin:9px 0 0">${esc(EXTERNAL[item.route.split(':')[1]]||'Memerlukan layanan terpisah.')}</p>`:`<button class="text-button" data-catalog-route="${esc(item.route)}">Buka pekerjaan</button>`}</article>`).join('')}</div>`;
}
export function catalogEntry(id){return MODULE_CATALOG.find(x=>x.id===id);}
