import { UNITS, ROLE_LABELS, ROLE_PERMISSIONS } from './data.js';

const e = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const r = (key, label, type='text', extra='') => `<div class="field"><label for="x-${key}">${label}</label><input id="x-${key}" name="${key}" type="${type}" ${extra} required></div>`;
const choice = (key,label,options) => `<div class="field"><label for="x-${key}">${label}</label><select id="x-${key}" name="${key}" required>${options.map(([id,name])=>`<option value="${e(id)}">${e(name)}</option>`).join('')}</select></div>`;
const row = cells => `<tr>${cells.map(cell=>`<td>${cell}</td>`).join('')}</tr>`;
const table = (headers,rows,empty='Belum ada data.') => rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<div class="empty"><strong>${empty}</strong><p>Gunakan tombol di atas untuk memulai.</p></div>`;
const btn = (kind,label,secondary=false) => `<button class="button ${secondary?'secondary':''}" data-modal="${kind}">+ ${label}</button>`;
const opt = list => list.map(x=>[x.id,x.name||x.full_name||x.company_name||x.title]);
function tabs(items,active) { return `<div class="subtabs" role="tablist">${items.map(([id,label])=>`<button data-subtab="${id}" class="${active===id?'active':''}" role="tab" aria-selected="${active===id}">${label}</button>`).join('')}</div>`; }
function head(kicker,title,copy,actions='') { return `<div class="view-head"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${copy}</p></div><div class="view-actions">${actions}</div></div>`; }
function unitData(ctx,key) { return ctx.scope(ctx.state.data[key]||[]); }
function scopedPeople(ctx) {
  const role=ctx.state.user.role,managers=['CEO','CORSEC_DIRECTOR','FINANCE_DIRECTOR','CREATIVE_DIRECTOR','SENIOR_PM','PM','TALENT_MANAGER','TALENT_OFFICER','GA_SUPERVISOR','LOGISTICS'];
  return (ctx.state.data.employees||[]).filter(x=>x.user_id===ctx.state.user.id || managers.includes(role)&&(ctx.state.user.global||x.business_unit_id===ctx.state.user.business_unit_id));
}
function access(role,roles) { return roles.includes(role); }
const FINANCE=['CEO','FINANCE_DIRECTOR','CORSEC_DIRECTOR'];
const TALENT=['CEO','SENIOR_PM','PM','TALENT_MANAGER','TALENT_OFFICER'];
const EXPENSE=['CEO','FINANCE_DIRECTOR','CREATIVE_DIRECTOR','SENIOR_PM','PM','ADMIN_PROJECT','TAX'];
const PURCHASE=['CEO','FINANCE_DIRECTOR','SENIOR_PM','PM','GA_SUPERVISOR','ADMIN_PROJECT'];
const VENDOR=['CEO','FINANCE_DIRECTOR','GA_SUPERVISOR','ADMIN_PROJECT'];
const CRM=['CEO','PAM','PM','SENIOR_PM','CREATIVE_DIRECTOR','ADMIN_PROJECT'];
const BILLING=['CEO','FINANCE_DIRECTOR','ADMIN_PROJECT','TAX'];

export function peoplePage(ctx) {
  const {state,unitTag,dateLabel,badge,writable}=ctx,role=state.user.role;
  const available=[['employees','Karyawan'],...(access(role,TALENT)?[['talent','Talent']]:[]),...(access(role,['CEO','CORSEC_DIRECTOR','FINANCE_DIRECTOR','CREATIVE_DIRECTOR','SENIOR_PM','PM','TALENT_MANAGER','TALENT_OFFICER','TALENT_PROJECT'])?[['shifts','Jadwal']]:[]),['leave','Cuti & izin'],['timesheet','Jam kerja']];
  const active=available.some(([key])=>key===state.subtab)?state.subtab:'employees';
  let body='',action='';
  if(active==='employees') {
    const list=scopedPeople(ctx);action=writable('people')?btn('employee','Daftarkan karyawan'):'';
    body=table(['Nama','Jabatan','Unit','Status','Aksi'],list.map(x=>row([`<strong>${e(x.name)}</strong><small>@${e(x.username||'belum diatur')} · ${e(x.employee_code)} · ${e(x.email)}</small>`,e(x.title),unitTag(x.business_unit_id),badge(x.status),writable('people')?`${x.user_id!==state.user.id?`<button class="button small secondary" data-action="employee-status" data-id="${e(x.id)}" data-status="${x.status==='ACTIVE'?'INACTIVE':'ACTIVE'}">${x.status==='ACTIVE'?'Nonaktifkan':'Aktifkan'}</button> <button class="button small secondary" data-action="reset-password" data-user-id="${e(x.user_id)}">Atur ulang sandi</button>`:''} ${x.status==='ACTIVE'?`<button class="button small secondary" data-modal="nfcEnroll:${e(x.id)}">${x.nfc_enrolled?'Ganti':'Daftarkan'} kartu NFC</button>`:''}`:'—'])), 'Belum ada profil karyawan.');
  } else if(active==='talent') {
    const list=unitData(ctx,'talents');action=writable('talent')?btn('talent','Tambah talent')+btn('deployment','Jadwalkan talent',true):'';
    body=table(['Nama','Keahlian','Kota','Rate','Unit'],list.map(x=>row([`<strong>${e(x.full_name)}</strong><small>${e(x.phone)}</small>`,e(x.skill),e(x.city),ctx.money(x.daily_rate),unitTag(x.business_unit_id)])),'Talent belum terdaftar.')+`<div class="section-title"><h2>Penugasan</h2></div>`+table(['Talent','Proyek','Tanggal','Peran'],unitData(ctx,'deployments').map(x=>row([e(list.find(t=>t.id===x.talent_id)?.full_name||'—'),e(state.data.projects.find(p=>p.id===x.project_id)?.name||'—'),dateLabel(x.work_date),e(x.role_name)])),'Belum ada penugasan.');
  } else if(active==='shifts') {
    action=writable('shifts')?btn('shift','Buat jadwal'):'';
    body=table(['Karyawan','Proyek','Tanggal','Jam'],unitData(ctx,'shifts').map(x=>row([e(state.data.employees.find(u=>u.user_id===x.user_id)?.name||'Saya'),e(state.data.projects.find(p=>p.id===x.project_id)?.name||'—'),dateLabel(x.work_date),`${e(x.start_time)}–${e(x.end_time)}`])),'Belum ada jadwal.');
  } else if(active==='leave') {
    action=btn('leave','Ajukan cuti/izin');
    body=table(['Pemohon','Tanggal','Jenis','Status'],unitData(ctx,'leaves').map(x=>row([e(state.data.employees.find(u=>u.user_id===x.user_id)?.name||'Saya'),`${dateLabel(x.start_date)} – ${dateLabel(x.end_date)}`,e(x.leave_type),badge(x.status)])),'Belum ada pengajuan cuti.');
  } else {
    action=btn('timesheet','Catat jam kerja');
    body=table(['Tanggal','Proyek','Jam','Catatan'],unitData(ctx,'timesheets').map(x=>row([dateLabel(x.work_date),e(state.data.projects.find(p=>p.id===x.project_id)?.name||'—'),`${e(x.hours)} jam`,e(x.note)])),'Belum ada catatan jam kerja.');
  }
  return `${head('HRIS','Tim & kehadiran','Informasi orang, jadwal, izin, dan pekerjaan harian.',action)}${tabs(available,active)}${body}`;
}

export function moneyPage(ctx) {
  const {state,dateLabel,badge,money,writable}=ctx,role=state.user.role;
  const available=[['reimbursement','Reimburse'],...(access(role,EXPENSE)?[['expenses','Biaya proyek']]:[]),...(access(role,PURCHASE)?[['purchases','Pengadaan']]:[]),...(access(role,VENDOR)?[['vendors','Vendor']]:[]),...(access(role,BILLING)?[['invoices','Tagihan']]:[]),...(access(role,['CEO','FINANCE_DIRECTOR','TAX'])?[['ledger','Buku besar']]:[]),...(access(role,FINANCE)?[['payroll','Day payment']]:[])];
  const active=available.some(([key])=>key===state.subtab)?state.subtab:'reimbursement';let body='',action='';
  if(active==='reimbursement') {
    action=btn('reimbursement','Ajukan reimburse');
    body=table(['Kategori','Keterangan','Nominal','Status'],unitData(ctx,'reimbursements').map(x=>row([e(x.category),e(x.description),money(x.amount),badge(x.status)])),'Belum ada reimburse.');
  } else if(active==='expenses') {
    action=writable('expenses')?btn('expense','Ajukan biaya proyek'):'';
    body=table(['Proyek','Kategori','Nominal','Status'],unitData(ctx,'expenses').map(x=>row([e(state.data.projects.find(p=>p.id===x.project_id)?.name||'—'),`${e(x.category)}<small>${e(x.description)}</small>`,money(x.amount),badge(x.status)])),'Belum ada biaya proyek.');
  } else if(active==='purchases') {
    action=writable('purchasing')?btn('purchase','Ajukan pembelian'):'';
    body=table(['Barang/jasa','Vendor','Total','Status','Aksi'],unitData(ctx,'purchases').map(x=>row([e(x.title),e(state.data.vendors.find(v=>v.id===x.vendor_id)?.name||'—'),money(x.total),badge(x.status),x.status==='Disetujui'&&access(role,['CEO','FINANCE_DIRECTOR','GA_SUPERVISOR'])&&!state.data.orders.some(o=>o.purchase_request_id===x.id)?`<button class="button small" data-action="issue-order" data-id="${e(x.id)}">Buat pesanan</button>`:'—'])),'Belum ada permintaan pembelian.')+`<div class="section-title"><h2>Pesanan pembelian</h2></div>`+table(['Nomor','Barang/jasa','Total','Status','Aksi'],unitData(ctx,'orders').map(x=>{const pr=state.data.purchases.find(p=>p.id===x.purchase_request_id);return row([e(x.id.slice(0,8)),e(pr?.title||'—'),money(x.total),badge(x.status),x.status==='Draft'&&access(role,['CEO','FINANCE_DIRECTOR','GA_SUPERVISOR'])?`<button class="button small" data-action="issue-po" data-id="${e(x.id)}">Terbitkan</button>`:x.status==='Diterbitkan'&&access(role,['CEO','GA_SUPERVISOR'])?`<button class="button small secondary" data-modal="receiveOrder:${e(x.id)}">Catat diterima</button>`:'—']);}),'Belum ada pesanan pembelian.');
  } else if(active==='vendors') {
    action=writable('vendors')?btn('vendor','Tambah vendor'):'';
    body=table(['Vendor','Kontak','Unit'],unitData(ctx,'vendors').map(x=>row([`<strong>${e(x.name)}</strong>`,`${e(x.email)}<small>${e(x.phone)}</small>`,ctx.unitTag(x.business_unit_id)])),'Belum ada vendor.');
  } else if(active==='invoices') {
    const invoices=unitData(ctx,'invoices'),payments=unitData(ctx,'payments');
    action=(writable('invoices')?btn('invoice','Buat tagihan'):'')+(writable('payments')?btn('payment','Catat pembayaran',true):'');
    body=`<div class="notice"><strong>Catatan pembayaran internal.</strong><br>Tagihan dibuat dari pesanan yang sudah dipenuhi. Mencatat pembayaran tidak memindahkan uang dan bukan faktur pajak.</div>`+
      table(['Nomor','Klien','Nilai','Sudah dibayar','Sisa','Jatuh tempo','Status'],invoices.map(x=>row([e(x.number),e(x.client_name),money(x.amount),money(x.paid_amount),money(Math.max(0,Number(x.amount)-Number(x.paid_amount))),dateLabel(x.due_date),badge(x.status)])),'Belum ada tagihan.')+
      `<div class="section-title"><h2>Riwayat pembayaran</h2></div>`+
      table(['Tagihan','Tanggal','Cara bayar','Referensi','Nominal'],payments.map(x=>row([e(invoices.find(i=>i.id===x.invoice_id)?.number||'—'),dateLabel(x.paid_at),e(x.method),e(x.reference),money(x.amount)])),'Belum ada pembayaran.');
  } else if(active==='ledger') {
    const journals=unitData(ctx,'journals'),summary=state.ledgerSummary?.business_unit_id===(state.unit==='ALL'?state.user.business_unit_id:state.unit)?state.ledgerSummary:null;
    action=(access(role,['CEO','FINANCE_DIRECTOR'])?btn('journal','Buat jurnal'):'')+'<button class="button secondary" data-action="ledger-summary">Hitung saldo</button>';
    body=`<div class="notice"><strong>Jurnal manual.</strong><br>Debit dan kredit harus seimbang. Jurnal masuk buku besar setelah disetujui orang lain. Tagihan dan pembayaran belum otomatis membuat jurnal.</div>`+
      table(['Tanggal','Referensi','Uraian','Debit/Kredit','Status','Aksi'],journals.map(x=>row([dateLabel(x.entry_date),e(x.reference),e(x.description),money(x.lines.reduce((sum,line)=>sum+Number(line.debit),0)),badge(x.status),x.status==='Draft'&&x.created_by===state.user.id?`<button class="button small" data-action="journal-submit" data-id="${e(x.id)}">Kirim persetujuan</button>`:x.status==='Posted'&&access(role,['CEO','FINANCE_DIRECTOR'])?`<button class="button small secondary" data-modal="journalReverse:${e(x.id)}">Buat pembalik</button>`:'—'])),'Belum ada jurnal.')+
      (summary?`<div class="section-title"><h2>Saldo sampai ${dateLabel(summary.end_date==='9999-12-31'?new Date().toISOString():summary.end_date)}</h2></div>`+table(['Kode','Akun','Debit','Kredit','Saldo'],summary.accounts.map(x=>row([e(x.code),e(x.name),money(x.debit),money(x.credit),money(x.balance)])),'Belum ada akun.'): '');
  } else {
    action=btn('payroll','Hitung pratinjau');
    const preview=state.payrollPreview;
    body=`<div class="notice"><strong>Pratinjau day payment</strong><br>Dihitung dari absensi hari tambahan yang sudah ditutup dan rate pada profil karyawan. Finance wajib memeriksa sebelum membayar.</div>${preview?`<div class="section-title"><h2>${e(preview.period)} · ${money(preview.total)}</h2></div>`+table(['Karyawan','Hari tambahan','Rate','Estimasi'],preview.lines.map(x=>row([e(x.name),e(x.extra_days),money(x.rate),money(x.estimated_day_payment)]))):''}`;
  }
  return `${head('ERP','Keuangan & pengadaan','Catat permintaan, tunggu keputusan, lalu tindak lanjuti.',action)}${tabs(available,active)}${body}`;
}

export function crmPage(ctx) {
  const {state,dateLabel,badge,money,writable}=ctx,role=state.user.role;
  const available=[['leads','Lead'],...(access(role,CRM)?[['clients','Klien'],['opportunities','Peluang'],['quotes','Quotation'],['activities','Tindak lanjut']]:[])];
  const active=available.some(([key])=>key===state.subtab)?state.subtab:'leads';let body='',action='';
  if(active==='leads') {
    action=writable('leads')?btn('lead','Tambah lead'):'';
    body=table(['Perusahaan','Kontak','Unit','Status','Aksi'],unitData(ctx,'leads').map(x=>row([`<strong>${e(x.company_name)}</strong>`,`${e(x.contact_name)}<small>${e(x.contact_email)}</small>`,ctx.unitTag(x.business_unit_id),badge(x.stage),x.stage!=='Converted'&&writable('clients')?`<button class="button small secondary" data-modal="convertLead:${e(x.id)}">Jadi peluang</button>`:'—'])),'Belum ada lead.');
  } else if(active==='clients') {
    action=writable('clients')?btn('client','Tambah klien'):'';
    body=table(['Perusahaan','PIC','Kontak'],unitData(ctx,'clients').map(x=>row([`<strong>${e(x.company_name)}</strong><small>${e(x.industry)}</small>`,e(x.pic_name),`${e(x.email)}<small>${e(x.phone)}</small>`])),'Belum ada klien.');
  } else if(active==='opportunities') {
    action=writable('opportunities')?btn('opportunity','Buat peluang'):'';
    body=table(['Peluang','Nilai','Keputusan','Tahap','Aksi'],unitData(ctx,'opportunities').map(x=>row([`<strong>${e(x.name)}</strong>`,money(x.value),dateLabel(x.expected_date),badge(x.stage),!['Menang','Kalah'].includes(x.stage)&&writable('opportunities')?`<button class="button small secondary" data-modal="opportunityStage:${e(x.id)}">Ubah tahap</button>`:'—'])),'Belum ada peluang.');
  } else if(active==='quotes') {
    action=writable('quotes')?btn('quotation','Buat revisi quotation'):'';
    body=table(['Peluang','Versi','Nominal','Berlaku sampai','Status'],unitData(ctx,'quotations').map(x=>row([e(state.data.opportunities.find(o=>o.id===x.opportunity_id)?.name||'—'),`v${e(x.version)}`,money(x.amount),dateLabel(x.valid_until),badge(x.status)])),'Belum ada quotation.');
  } else {
    action=writable('activities')?btn('activity','Catat tindak lanjut'):'';
    body=table(['Klien','Kegiatan','Berikutnya'],unitData(ctx,'activities').map(x=>row([e(state.data.clients.find(c=>c.id===x.client_id)?.company_name||'—'),`${e(x.type)}<small>${e(x.note)}</small>`,dateLabel(x.followup_at)])),'Belum ada kegiatan.');
  }
  return `${head('CRM','Klien & peluang','Dari lead, penawaran, hingga tindak lanjut.',action)}${tabs(available,active)}${body}`;
}

export function approvalsPage(ctx) {
  const {state,badge,dateLabel,unitTag,writable}=ctx;
  const all=unitData(ctx,'approvals');
  const mine=all.filter(x=>x.requester_user_id===state.user.id),pending=all.filter(x=>x.status==='Menunggu'&&x.requester_user_id!==state.user.id&&(state.user.role==='CEO'||x.approver_role===state.user.role));
  const approvalRow=x=>`<div class="list-row"><div>${unitTag(x.business_unit_id)}<strong style="display:block;margin:8px 0 3px">${e(x.title)}</strong><small>${e(x.type)} · ${dateLabel(x.created_at)}</small></div><div class="list-right">${badge(x.status)}${x.status==='Menunggu'&&x.requester_user_id!==state.user.id&&(state.user.role==='CEO'||x.approver_role===state.user.role)?`<div style="margin-top:10px;display:flex;gap:6px"><button class="button small" data-action="approve" data-id="${e(x.id)}">Setujui</button><button class="button small secondary" data-action="reject" data-id="${e(x.id)}">Tolak</button></div>`:''}</div></div>`;
  return `${head('Keputusan','Persetujuan','Ajukan kebutuhan dan pantau keputusan yang masuk.',btn('approvalRequest','Buat permintaan'))}<div class="two-col"><section class="panel"><div class="panel-header"><h2>Perlu keputusan saya</h2><small>${pending.length} permintaan</small></div>${pending.length?pending.map(approvalRow).join(''):'<p class="muted">Tidak ada permintaan yang menunggu Anda.</p>'}</section><section class="panel"><div class="panel-header"><h2>Permintaan saya</h2></div>${mine.length?mine.map(approvalRow).join(''):'<p class="muted">Belum ada permintaan.</p>'}</section></div>`;
}

export function assetSection(ctx) {
  const {state,writable,badge}=ctx,items=unitData(ctx,'assets');
  if(!access(state.user.role,['CEO','GA_SUPERVISOR','LOGISTICS','RUNNER']))return '';
  return `<div class="section-title"><h2>Aset perusahaan</h2>${writable('assets')?btn('asset','Daftarkan aset'):''}</div>${table(['Aset','Nomor seri','Lokasi','Status','Aksi'],items.map(x=>row([e(x.name),e(x.serial_number),e(x.location),badge(x.status),writable('assets')&&x.status==='Tersedia'?`<button class="button small secondary" data-modal="assetAssign:${e(x.id)}">Tugaskan</button>`:'—'])),'Aset belum terdaftar.')}`;
}

export function stockCountsSection(ctx) {
  const counts=unitData(ctx,'stock_counts'),role=ctx.state.user.role;
  const action=access(role,['CEO','GA_SUPERVISOR','LOGISTICS'])&&unitData(ctx,'inventory').length?btn('stockCount','Catat opname'):'';
  return `<div class="section-title"><h2>Opname stok</h2>${action}</div><div class="notice"><strong>Selisih perlu persetujuan.</strong><br>Stok baru berubah setelah GA Supervisor atau CEO menyetujui. Jika stok bergerak sementara menunggu, lakukan hitung ulang.</div>${table(['Barang','Lokasi','Sistem','Fisik','Selisih','Status'],counts.map(x=>row([e(x.item_name),e(x.location),e(x.expected_quantity),e(x.counted_quantity),e(x.delta),ctx.badge(x.status)])),'Belum ada opname.')}`;
}

export function reportsPage(ctx) {
  const {state,money,badge}=ctx,projects=unitData(ctx,'projects');
  const approved=unitData(ctx,'expenses').filter(x=>x.status==='Disetujui');
  const total=approved.reduce((sum,x)=>sum+Number(x.amount),0),budget=projects.reduce((sum,p)=>sum+Number(p.budget||0),0);
  const sales=unitData(ctx,'sales').filter(x=>x.status==='Terpenuhi').reduce((sum,x)=>sum+Number(x.total),0);
  const invoices=unitData(ctx,'invoices'),billed=invoices.reduce((sum,x)=>sum+Number(x.amount),0),paid=invoices.reduce((sum,x)=>sum+Number(x.paid_amount),0);
  const actions={'project.create':'Proyek dibuat','project.stage':'Tahap proyek berubah','task.create':'Tugas dibuat','task.update':'Tugas diperbarui','inventory.move':'Stok bergerak','stock.count':'Opname dicatat','approval.decide':'Persetujuan diputuskan','purchase.orderCreate':'Pesanan pembelian dibuat','order.issue':'Pesanan diterbitkan','order.receive':'Pesanan diterima','sale.create':'Pesanan penjualan dibuat','sale.fulfill':'Pesanan dipenuhi','invoice.create':'Tagihan dibuat','payment.record':'Pembayaran dicatat'};
  const audit=access(state.user.role,['CEO','CORSEC_DIRECTOR','FINANCE_DIRECTOR'])?(state.data.audits||[]).slice(0,12):[];
  return `${head('Business insight','Laporan operasional','Ringkasan unit dari data yang telah dicatat.',btn('export','Unduh data'))}<section class="stats"><div class="stat"><span class="stat-label">Anggaran proyek</span><strong class="money-stat">${money(budget)}</strong></div><div class="stat"><span class="stat-label">Biaya disetujui</span><strong class="money-stat">${money(total)}</strong></div><div class="stat"><span class="stat-label">Penjualan terpenuhi</span><strong class="money-stat">${money(sales)}</strong></div><div class="stat"><span class="stat-label">Permintaan beli menunggu</span><strong>${unitData(ctx,'purchases').filter(x=>x.status==='Menunggu').length}</strong></div></section>${access(state.user.role,BILLING)?`<div class="section-title"><h2>Tagihan internal</h2></div><section class="stats"><div class="stat"><span class="stat-label">Ditagihkan</span><strong class="money-stat">${money(billed)}</strong></div><div class="stat"><span class="stat-label">Pembayaran tercatat</span><strong class="money-stat">${money(paid)}</strong></div><div class="stat"><span class="stat-label">Belum dibayar</span><strong class="money-stat">${money(billed-paid)}</strong></div></section>`:''}<div class="section-title"><h2>Anggaran dan biaya</h2></div>${table(['Proyek','Anggaran','Biaya disetujui','Sisa','Status'],projects.map(p=>{const actual=approved.filter(x=>x.project_id===p.id).reduce((sum,x)=>sum+Number(x.amount),0);return row([e(p.name),money(p.budget),money(actual),money(Number(p.budget)-actual),badge(actual>Number(p.budget)?'Melebihi':'Terkendali')]);}),'Belum ada proyek.')}${access(state.user.role,['CEO','CORSEC_DIRECTOR','FINANCE_DIRECTOR'])?`<div class="section-title"><h2>Aktivitas terbaru</h2></div>${table(['Waktu','Petugas','Kegiatan'],audit.map(x=>row([ctx.dateLabel(x.created_at),e(state.data.employees.find(v=>v.user_id===x.actor_user_id)?.name||'Pengguna'),e(actions[x.action]||x.action)])),'Belum ada aktivitas yang tercatat.')}`:''}`;
}

export function salesPage(ctx) {
  const {state,badge,money,dateLabel,writable}=ctx,orders=unitData(ctx,'sales');
  const lines=state.data.sales_lines||[];
  return `${head('ERP','Pesanan & stok','Pesanan dicatat lebih dulu. Gudang mengurangi stok saat pemenuhan.',writable('sales')?btn('sale','Buat pesanan'):'')}${table(['Klien','Proyek','Barang','Total','Status','Aksi'],orders.map(o=>row([e(o.client_name||state.data.clients.find(c=>c.id===o.client_id)?.company_name||'—'),e(state.data.projects.find(p=>p.id===o.project_id)?.name||'—'),lines.filter(x=>x.order_id===o.id).map(x=>`${e(x.item_name)} × ${e(x.quantity)}`).join('<br>'),money(o.total),badge(o.status),o.status==='Menunggu gudang'&&access(state.user.role,['CEO','LOGISTICS','GA_SUPERVISOR'])?`<button class="button small" data-action="fulfill-sale" data-id="${e(o.id)}">Penuhi pesanan</button>`:dateLabel(o.fulfilled_at)])),'Belum ada pesanan.')}`;
}

export function saleLineHtml(ctx) {
  const items=[...new Map(ctx.scope(ctx.state.data.inventory||[]).map(x=>[x.sku,x])).values()];
  const options=items.map(x=>`<option value="${e(x.sku)}">${e(x.item_name)} (${e(x.sku)})</option>`).join('');
  return `<div class="sale-line" data-sale-line><div class="form-row"><label class="field">Barang<select name="sku" required>${options}</select></label><label class="field">Jumlah<input name="quantity" type="number" min="1" step="1" required></label></div><label class="field">Harga jual per unit (Rp)<input name="unit_price" type="number" min="1" required></label><button type="button" class="text-button" data-action="remove-sale-line">Hapus baris</button></div>`;
}

export function projectExtras(ctx) {
  const {state,dateLabel,badge,writable}=ctx,ids=new Set(ctx.scope(state.data.projects).map(p=>p.id));
  const meetings=(state.data.meetings||[]).filter(x=>ids.has(x.project_id));
  const moms=(state.data.moms||[]).filter(x=>ids.has(x.project_id));
  const documents=(state.data.documents||[]).filter(x=>ids.has(x.entity_id));
  const projectName=id=>e(state.data.projects.find(p=>p.id===id)?.name||'—');
  const safeUrl=url=>/^https:\/\/(drive|docs)\.google\.com\//.test(String(url||''))?e(url):'';
  return `<div class="section-title"><h2>Meeting & catatan</h2>${writable('projects')?btn('meeting','Jadwalkan meeting')+btn('mom','Tulis MOM',true):''}</div>${table(['Meeting','Proyek','Waktu','Kalender'],meetings.map(x=>row([e(x.title),projectName(x.project_id),e(String(x.starts_at).replace('T',' ')),badge(x.calendar_sync_status)])),'Belum ada meeting.')}${moms.length?`<div class="section-title"><h2>Catatan meeting</h2></div>`+table(['Judul','Proyek','Catatan'],moms.map(x=>row([e(x.title),projectName(x.project_id),e(x.notes)]))):''}<div class="section-title"><h2>Dokumen proyek</h2>${btn('document','Unggah dokumen')}</div>${table(['File','Proyek','Tanggal'],documents.map(x=>row([safeUrl(x.file_url)?`<a href="${safeUrl(x.file_url)}" target="_blank" rel="noopener noreferrer">${e(x.file_name)}</a>`:e(x.file_name),projectName(x.entity_id),dateLabel(x.created_at)])),'Belum ada dokumen.')}`;
}

export function moduleModal(modal,ctx) {
  const [kind,id]=modal.split(':'),{state}=ctx;
  const units=UNITS.filter(u=>state.user.global||u.id===state.user.business_unit_id).map(u=>[u.id,u.name]);
  const projects=opt(ctx.scope(state.data.projects||[])),people=opt(scopedPeople(ctx).map(x=>({id:x.user_id,name:x.name}))),talents=opt(unitData(ctx,'talents')),vendors=opt(unitData(ctx,'vendors'));
  const clients=opt(unitData(ctx,'clients')),opps=opt(unitData(ctx,'opportunities'));
  const definitions={
    employee:['Daftarkan karyawan',r('name','Nama lengkap')+r('username','Nama pengguna')+r('email','Email kontak','email')+r('employee_code','Kode karyawan')+r('title','Jabatan')+choice('role','Peran',Object.entries(ROLE_LABELS).map(([k,v])=>[k,v]))+choice('business_unit_id','Unit bisnis',units)+r('join_date','Tanggal masuk','date')+choice('employment_type','Jenis kontrak',[['Internal','Internal'],['Kontrak','Kontrak']])+r('weekend_rate','Rate hari tambahan (Rp)','number','min="0" step="1"')+`<div class="field"><label for="x-phone">Nomor WhatsApp (opsional)</label><input id="x-phone" name="phone" type="tel" placeholder="08... atau 62..."></div>`],
    nfcEnroll:['Daftarkan kartu NFC',`<div class="notice">Tempelkan tag NFC pada perangkat yang mendukung Web NFC. Kartu yang sudah terdaftar akan menggantikan kartu lama karyawan ini.</div><button type="button" class="button secondary" data-action="scan-nfc">Pindai kartu</button><p id="nfc-label" class="muted">Kartu belum dipindai.</p>`],
    talent:['Tambah talent',r('full_name','Nama lengkap')+r('phone','Nomor telepon','tel')+r('skill','Keahlian')+r('city','Kota')+r('daily_rate','Rate per hari (Rp)','number','min="1"')+choice('business_unit_id','Unit bisnis',units)],
    deployment:['Jadwalkan talent',choice('talent_id','Talent',talents)+choice('project_id','Proyek',projects)+r('work_date','Tanggal tugas','date')+r('role_name','Peran di event')],
    shift:['Buat jadwal',choice('user_id','Karyawan',people)+choice('project_id','Proyek',projects)+r('work_date','Tanggal','date')+r('start_time','Mulai','time')+r('end_time','Selesai','time')],
    leave:['Ajukan cuti atau izin',choice('leave_type','Jenis',[['Cuti','Cuti'],['Izin','Izin'],['Sakit','Sakit']])+r('start_date','Tanggal mulai','date')+r('end_date','Tanggal selesai','date')+r('reason','Alasan')],
    timesheet:['Catat jam kerja',choice('project_id','Proyek',projects)+r('work_date','Tanggal','date')+r('hours','Jam kerja','number','min="0.25" max="24" step="0.25"')+r('note','Pekerjaan yang dilakukan')],
    reimbursement:['Ajukan reimburse',`<div class="field"><label for="x-project_id">Proyek (opsional)</label><select id="x-project_id" name="project_id"><option value="">Tanpa proyek</option>${projects.map(([id,name])=>`<option value="${e(id)}">${e(name)}</option>`).join('')}</select></div>`+r('category','Kategori')+r('description','Keterangan')+r('amount','Nominal (Rp)','number','min="1"')],
    expense:['Ajukan biaya proyek',choice('project_id','Proyek',projects)+r('category','Kategori biaya')+r('description','Keterangan')+r('amount','Nominal (Rp)','number','min="1"')],
    vendor:['Tambah vendor',r('name','Nama vendor')+r('email','Email vendor','email')+r('phone','Telepon','tel')+choice('business_unit_id','Unit bisnis',units)],
    receiveOrder:['Catat penerimaan PO',`<div class="notice">Pastikan barang atau jasa sudah benar-benar diterima. Untuk barang stok, isi lokasi tujuan; penerimaan hanya satu kali untuk seluruh jumlah PR.</div><div class="field"><label for="x-location">Lokasi stok (kosongkan untuk jasa)</label><input id="x-location" name="location" maxlength="100" placeholder="Contoh: Gudang Utama"></div>`],
    purchase:['Ajukan pembelian',choice('project_id','Proyek',projects)+choice('vendor_id','Vendor',vendors)+r('title','Barang atau jasa')+`<div class="field"><label for="x-sku">Barang stok (opsional)</label><select id="x-sku" name="sku"><option value="">Jasa / tidak menambah stok</option>${[...new Map(unitData(ctx,'inventory').map(x=>[x.sku,x])).values()].map(x=>`<option value="${e(x.sku)}">${e(x.item_name)} (${e(x.sku)})</option>`).join('')}</select></div>`+r('quantity','Jumlah','number','min="1" step="1"')+r('unit_cost','Harga per unit (Rp)','number','min="1"')],
    receiveOrder:['Catat penerimaan pesanan pembelian',`<div class="notice">Pastikan barang atau jasa sudah benar-benar diterima. Untuk barang stok, isi lokasi tujuan. Penerimaan dilakukan sekali untuk seluruh jumlah pesanan.</div><div class="field"><label for="x-location">Lokasi stok (kosongkan untuk jasa)</label><input id="x-location" name="location" maxlength="100" placeholder="Contoh: Gudang Utama"></div>`],
    receiveOrder:['Catat penerimaan PO',`<div class="notice">Pastikan barang atau jasa sudah benar-benar diterima. Untuk barang stok, isi lokasi tujuan; penerimaan hanya satu kali untuk seluruh jumlah PR.</div><div class="field"><label for="x-location">Lokasi stok (kosongkan untuk jasa)</label><input id="x-location" name="location" maxlength="100" placeholder="Contoh: Gudang Utama"></div>`],
    client:['Tambah klien',r('company_name','Perusahaan')+r('industry','Industri')+r('pic_name','Nama PIC')+r('email','Email','email')+r('phone','Telepon','tel')+choice('business_unit_id','Unit bisnis',units)],
    opportunity:['Buat peluang',choice('client_id','Klien',clients)+r('name','Nama peluang')+r('value','Potensi nilai (Rp)','number','min="1"')+r('expected_date','Perkiraan keputusan','date')],
    quotation:['Buat revisi quotation',choice('opportunity_id','Peluang',opps)+r('amount','Nilai quotation (Rp)','number','min="1"')+r('description','Lingkup pekerjaan')+r('valid_until','Berlaku sampai','date')],
    activity:['Catat tindak lanjut',choice('client_id','Klien',clients)+choice('type','Jenis',[['Meeting','Meeting'],['Telepon','Telepon'],['Email','Email'],['WhatsApp','WhatsApp']])+r('note','Catatan')+r('followup_at','Tanggal tindak lanjut','date')],
    asset:['Daftarkan aset',r('name','Nama aset')+r('serial_number','Nomor seri')+r('location','Lokasi')+choice('business_unit_id','Unit bisnis',units)],
    assetAssign:['Tugaskan aset',choice('user_id','Karyawan',people)],
    approvalRequest:['Buat permintaan',r('title','Apa yang diminta?')+choice('type','Jenis',[['Operasional','Operasional'],['Dokumen','Dokumen'],['Anggaran','Anggaran']])+choice('business_unit_id','Unit bisnis',units)],
    convertLead:['Jadikan peluang',r('value','Potensi nilai (Rp)','number','min="1"')+r('expected_date','Perkiraan keputusan','date')],
    opportunityStage:['Ubah tahap peluang',choice('stage','Tahap',[['Pitching','Pitching'],['Negosiasi','Negosiasi'],['Menang','Menang'],['Kalah','Kalah']])],
    payroll:['Hitung day payment',r('period','Periode','month')+choice('business_unit_id','Unit bisnis',units)],
    meeting:['Jadwalkan meeting',choice('project_id','Proyek',projects)+r('title','Judul meeting')+r('starts_at','Mulai','datetime-local')+r('ends_at','Selesai','datetime-local')+`<div class="field"><label>Undang anggota</label><div class="checks">${scopedPeople(ctx).map(x=>`<label><input type="checkbox" name="attendee_user_ids" value="${e(x.user_id)}">${e(x.name)}</label>`).join('')}</div></div>`],
    mom:['Tulis catatan meeting',choice('project_id','Proyek',projects)+r('title','Judul')+`<div class="field"><label for="x-notes">Catatan dan keputusan</label><textarea id="x-notes" name="notes" maxlength="5000" required></textarea></div>`],
    document:['Unggah dokumen proyek',choice('entity_id','Proyek',projects)+`<div class="field"><label for="x-file">PDF atau gambar (maks. 2 MB)</label><input id="x-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required></div>`],
    stockCount:['Catat opname',choice('inventory_id','Barang dan lokasi',unitData(ctx,'inventory').map(x=>[x.id,`${x.item_name} · ${x.location} (sistem ${x.quantity} ${x.unit})`]))+r('counted_quantity','Jumlah fisik','number','min="0" step="1"')+r('reason','Catatan hasil hitung')],
    invoice:['Buat tagihan',choice('sale_order_id','Pesanan terpenuhi',unitData(ctx,'sales').filter(s=>s.status==='Terpenuhi'&&!state.data.invoices.some(i=>i.sale_order_id===s.id)).map(s=>[s.id,`${s.client_name||s.id} · ${ctx.money(s.total)}`]))+r('due_date','Jatuh tempo','date')],
    payment:['Catat pembayaran',choice('invoice_id','Tagihan',unitData(ctx,'invoices').filter(i=>i.status!=='Lunas').map(i=>[i.id,`${i.number} · sisa ${ctx.money(Number(i.amount)-Number(i.paid_amount))}`]))+r('amount','Nominal diterima (Rp)','number','min="0.01" step="0.01"')+choice('method','Cara bayar',[['Transfer','Transfer'],['Cash','Tunai'],['QRIS','QRIS']])+r('reference','Nomor bukti / referensi')+r('paid_at','Tanggal diterima','date')],
    journal:['Buat jurnal manual',`<div class="notice">Gunakan unit yang dipilih di bagian atas. Isi akun, debit, dan kredit hingga seimbang.</div><input name="business_unit_id" type="hidden" value="${e(state.unit==='ALL'?state.user.business_unit_id:state.unit)}">`+r('entry_date','Tanggal jurnal','date')+r('reference','Nomor referensi')+r('description','Uraian')+`<div id="journal-lines">${journalLineHtml(ctx)}${journalLineHtml(ctx)}</div><button type="button" class="button small secondary" data-action="add-journal-line">+ Tambah baris</button>`],
    journalReverse:['Buat jurnal pembalik',r('entry_date','Tanggal pembalik','date')+r('reason','Alasan pembalik')],
    export:['Unduh data CSV',choice('dataset','Jenis data',[...((ROLE_PERMISSIONS[state.user.role]||[]).includes('projects')?[['projects','Proyek']]:[]),['tasks','Tugas'],['attendance','Absensi saya'],['work_items','Pekerjaan'],...(access(state.user.role,['CEO','GA_SUPERVISOR','LOGISTICS','RUNNER'])?[['inventory','Gudang']]:[]),...(access(state.user.role,CRM)?[['leads','Lead'],['clients','Klien']]:[]),...(access(state.user.role,BILLING)?[['invoices','Tagihan'],['payments','Pembayaran']]:[]),...(access(state.user.role,['CEO','FINANCE_DIRECTOR','TAX'])?[['journals','Jurnal']]:[])])],
    import:['Impor master CSV',`<div class="notice">Maksimal 100 baris per impor. Unduh contoh kolom, isi datanya, lalu periksa hasil sebelum menyimpan.</div>`+choice('dataset','Jenis data',[...(access(state.user.role,['CEO','PAM','PM','SENIOR_PM','ADMIN_PROJECT'])?[['clients','Klien']]:[]),...(access(state.user.role,['CEO','FINANCE_DIRECTOR','GA_SUPERVISOR','ADMIN_PROJECT'])?[['vendors','Vendor']]:[]),...(access(state.user.role,['CEO','CORSEC_DIRECTOR'])?[['holidays','Hari libur']]:[])])+choice('business_unit_id','Unit bisnis',units)+`<button type="button" class="button small secondary" data-action="download-import-template">Unduh contoh kolom</button><div class="field"><label for="x-import-file">File CSV</label><input id="x-import-file" name="file" type="file" accept=".csv,text/csv" required></div>`],
    sale:['Buat pesanan',choice('client_id','Klien',clients)+choice('project_id','Proyek',projects)+choice('location','Lokasi stok',[...new Set(ctx.scope(state.data.inventory||[]).map(x=>x.location))].map(x=>[x,x]))+`<div id="sale-lines">${saleLineHtml(ctx)}</div><button type="button" class="button small secondary" data-action="add-sale-line">+ Tambah barang</button>`],
  };
  const definition=definitions[kind];if(!definition)return '';
  return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><span class="eyebrow">ARAIA Workspace</span><h2 id="modal-title">${definition[0]}</h2><p class="muted">Isi data berikut, lalu simpan.</p></div><button class="close" data-action="close-modal" aria-label="Tutup">×</button></div><form id="entry-form" data-kind="${kind}" data-id="${e(id||'')}"><div class="form-grid">${definition[1]}<div class="form-actions"><button type="button" class="button secondary" data-action="close-modal">Batal</button><button class="button" type="submit">${kind==='payroll'?'Hitung':kind==='export'?'Unduh':'Simpan'}</button></div></div></form></div></div>`;
}

export const MODULE_ACTIONS={employee:'employee.create',nfcEnroll:'employee.nfcEnroll',talent:'talent.create',deployment:'talent.deploy',shift:'shift.create',leave:'leave.request',timesheet:'timesheet.create',reimbursement:'reimbursement.request',expense:'expense.request',vendor:'vendor.create',purchase:'purchase.request',client:'client.create',opportunity:'opportunity.create',quotation:'quotation.create',activity:'activity.create',asset:'asset.create',assetAssign:'asset.assign',approvalRequest:'approval.request',convertLead:'lead.convert',opportunityStage:'opportunity.stage',meeting:'meeting.create',mom:'mom.create',document:'document.upload',sale:'sale.create',stockCount:'stock.count',invoice:'invoice.create',payment:'payment.record',receiveOrder:'order.receive',journal:'journal.create',journalReverse:'journal.reverse'};

export function demoLedgerSummary(state,bu) {
  const ids=new Set((state.data.journals||[]).filter(j=>j.status==='Posted'&&j.business_unit_id===bu).map(j=>j.id));
  return {business_unit_id:bu,end_date:'9999-12-31',journals:ids.size,accounts:(state.data.accounts||[]).filter(a=>a.business_unit_id===bu).map(a=>{const lines=(state.data.journals||[]).filter(j=>ids.has(j.id)).flatMap(j=>j.lines||[]).filter(l=>l.account_code===a.code),debit=lines.reduce((n,l)=>n+Number(l.debit),0),credit=lines.reduce((n,l)=>n+Number(l.credit),0);return {code:a.code,name:a.name,type:a.type,debit,credit,balance:['ASET','BEBAN'].includes(a.type)?debit-credit:credit-debit};})};
}

export function journalLineHtml(ctx) {
  const bu=ctx.state.unit==='ALL'?ctx.state.user.business_unit_id:ctx.state.unit;
  const accounts=(ctx.state.data.accounts||[]).filter(x=>x.business_unit_id===bu);
  return `<div class="sale-line" data-journal-line><label class="field">Akun<select name="account_code" required>${accounts.map(x=>`<option value="${e(x.code)}">${e(x.code)} · ${e(x.name)}</option>`).join('')}</select></label><div class="form-row"><label class="field">Debit<input name="debit" type="number" min="0" step="0.01" value="0" required></label><label class="field">Kredit<input name="credit" type="number" min="0" step="0.01" value="0" required></label></div><button type="button" class="text-button" data-action="remove-journal-line">Hapus baris</button></div>`;
}

export function moduleDemoAction(action,p,state,uid) {
  const d=state.data,now=new Date().toISOString(),id=uid();let out;
  const add=(key,row)=>{d[key].unshift(row);return row;};
  const approval=(type,reference,title,bu,chosen)=>{let approver=chosen||({LEAVE:'SENIOR_PM',REIMBURSEMENT:'FINANCE_DIRECTOR',PURCHASE_REQUEST:'FINANCE_DIRECTOR',PROJECT_EXPENSE:'FINANCE_DIRECTOR'})[type]||'SENIOR_PM';if(approver===state.user.role)approver='CEO';return add('approvals',{id:uid(),type,reference_id:reference,title,business_unit_id:bu,requester_user_id:state.user.id,approver_role:approver,status:'Menunggu',created_at:now}).id;};
  const project=projectId=>{const x=d.projects.find(v=>v.id===projectId);if(!x)throw Error('Pilih proyek.');if(!state.user.global&&x.business_unit_id!==state.user.business_unit_id)throw Error('Proyek berada di luar unit Anda.');return x;};
  if(action==='employee.create'){if(d.employees.some(x=>x.email.toLowerCase()===p.email.toLowerCase()))throw Error('Email sudah terdaftar.');out=add('employees',{...p,id,user_id:uid(),name:p.name,status:'ACTIVE'});}
  else if(action==='employee.nfcEnroll'){out=d.employees.find(x=>x.id===p.id);if(!out||!p.serial)throw Error('Pindai kartu lebih dahulu.');out.nfc_enrolled=true;}
  else if(action==='employee.status'){out=d.employees.find(x=>x.id===p.id);if(!out||out.user_id===state.user.id)throw Error('Karyawan tidak ditemukan.');out.status=p.status;}
  else if(action==='talent.create')out=add('talents',{...p,id,status:'ACTIVE',created_at:now});
  else if(action==='talent.deploy'){const t=d.talents.find(x=>x.id===p.talent_id),pr=project(p.project_id);if(!t||t.business_unit_id!==pr.business_unit_id)throw Error('Talent dan proyek harus satu unit.');out=add('deployments',{...p,id,daily_rate:t.daily_rate,business_unit_id:pr.business_unit_id,status:'Terjadwal',created_at:now});}
  else if(action==='shift.create'){const pr=project(p.project_id);out=add('shifts',{...p,id,business_unit_id:pr.business_unit_id,created_at:now});}
  else if(action==='leave.request'){if(p.end_date<p.start_date)throw Error('Tanggal selesai harus setelah tanggal mulai.');out={...p,id,user_id:state.user.id,business_unit_id:state.user.business_unit_id,status:'Menunggu',created_at:now};out.approval_id=approval('LEAVE',id,'Cuti/izin '+state.user.name,out.business_unit_id);add('leaves',out);}
  else if(action==='timesheet.create'){const pr=project(p.project_id);out=add('timesheets',{...p,id,user_id:state.user.id,business_unit_id:pr.business_unit_id,status:'Tercatat',created_at:now});}
  else if(action==='reimbursement.request'){const pr=p.project_id?project(p.project_id):null;out={...p,id,user_id:state.user.id,business_unit_id:pr?.business_unit_id||state.user.business_unit_id,status:'Menunggu',created_at:now};out.approval_id=approval('REIMBURSEMENT',id,'Reimburse '+p.category,out.business_unit_id);add('reimbursements',out);}
  else if(action==='expense.request'){const pr=project(p.project_id);out={...p,id,requester_user_id:state.user.id,business_unit_id:pr.business_unit_id,status:'Menunggu',created_at:now};out.approval_id=approval('PROJECT_EXPENSE',id,'Biaya '+p.category,out.business_unit_id);add('expenses',out);}
  else if(action==='vendor.create')out=add('vendors',{...p,id,status:'ACTIVE',created_at:now});
  else if(action==='purchase.request'){const pr=project(p.project_id),v=d.vendors.find(x=>x.id===p.vendor_id);if(!v||v.business_unit_id!==pr.business_unit_id)throw Error('Vendor dan proyek harus satu unit.');if(p.sku&&!d.inventory.some(x=>x.sku===p.sku&&x.business_unit_id===pr.business_unit_id))throw Error('SKU tidak tersedia di unit ini.');out={...p,id,total:Number(p.quantity)*Number(p.unit_cost),business_unit_id:pr.business_unit_id,requester_user_id:state.user.id,status:'Menunggu',created_at:now};out.approval_id=approval('PURCHASE_REQUEST',id,'PR '+p.title,out.business_unit_id);add('purchases',out);}
  else if(action==='order.create'){const pr=d.purchases.find(x=>x.id===p.purchase_request_id);if(!pr||pr.status!=='Disetujui'||d.orders.some(x=>x.purchase_request_id===pr.id))throw Error('PR belum disetujui atau PO sudah ada.');out=add('orders',{id,purchase_request_id:pr.id,vendor_id:pr.vendor_id,project_id:pr.project_id,total:pr.total,business_unit_id:pr.business_unit_id,status:'Draft',created_at:now});}
  else if(action==='order.issue'){out=d.orders.find(x=>x.id===p.id);if(!out||out.status!=='Draft'||!access(state.user.role,['CEO','FINANCE_DIRECTOR','GA_SUPERVISOR']))throw Error('PO draft tidak tersedia.');out.status='Diterbitkan';out.issued_at=now;}
  else if(action==='order.receive'){out=d.orders.find(x=>x.id===p.id);const pr=d.purchases.find(x=>x.id===out?.purchase_request_id);if(!out||out.status!=='Diterbitkan'||!pr||!access(state.user.role,['CEO','GA_SUPERVISOR']))throw Error('PO belum diterbitkan.');if(pr.sku){if(!p.location?.trim())throw Error('Isi lokasi penerimaan stok.');const ref=d.inventory.find(x=>x.sku===pr.sku&&x.business_unit_id===out.business_unit_id);if(!ref)throw Error('Barang tidak ditemukan.');const target=d.inventory.find(x=>x.sku===pr.sku&&x.business_unit_id===out.business_unit_id&&x.location.toLowerCase()===p.location.toLowerCase());if(target){target.quantity+=Number(pr.quantity);target.updated_at=now;}else d.inventory.push({...ref,id:uid(),location:p.location,quantity:Number(pr.quantity),updated_at:now});d.movements.unshift({id:uid(),sku:pr.sku,item_name:ref.item_name,business_unit_id:out.business_unit_id,from_location:'',to_location:p.location,quantity:Number(pr.quantity),project_id:out.project_id,condition:'Good',actor_user_id:state.user.id,created_at:now,reference_id:out.id});}out.status='Diterima';out.received_at=now;out.received_by=state.user.id;out.received_quantity=Number(pr.quantity);out.receipt_location=pr.sku?p.location:'';}
  else if(action==='client.create')out=add('clients',{...p,id,created_at:now});
  else if(action==='opportunity.create'){const c=d.clients.find(x=>x.id===p.client_id);if(!c)throw Error('Klien tidak ditemukan.');out=add('opportunities',{...p,id,business_unit_id:c.business_unit_id,owner_user_id:state.user.id,stage:'Pitching',created_at:now});}
  else if(action==='opportunity.stage'){out=d.opportunities.find(x=>x.id===p.id);if(!out)throw Error('Peluang tidak ditemukan.');out.stage=p.stage;}
  else if(action==='lead.convert'){const lead=d.leads.find(x=>x.id===p.id);if(!lead||lead.stage==='Converted')throw Error('Lead sudah dikonversi.');const c=add('clients',{id:uid(),company_name:lead.company_name,industry:'Belum diisi',pic_name:lead.contact_name,email:lead.contact_email,phone:'Belum diisi',business_unit_id:lead.business_unit_id,created_at:now});out=add('opportunities',{id:uid(),client_id:c.id,lead_id:lead.id,name:lead.company_name+' · peluang baru',value:p.value,stage:'Pitching',expected_date:p.expected_date,business_unit_id:lead.business_unit_id,created_at:now});Object.assign(lead,{stage:'Converted',client_id:c.id,opportunity_id:out.id});}
  else if(action==='quotation.create'){const opp=d.opportunities.find(x=>x.id===p.opportunity_id);if(!opp)throw Error('Peluang tidak ditemukan.');out=add('quotations',{...p,id,business_unit_id:opp.business_unit_id,version:1+Math.max(0,...d.quotations.filter(x=>x.opportunity_id===opp.id).map(x=>Number(x.version))),status:'Draft',created_at:now});}
  else if(action==='activity.create'){const c=d.clients.find(x=>x.id===p.client_id);if(!c)throw Error('Klien tidak ditemukan.');out=add('activities',{...p,id,business_unit_id:c.business_unit_id,created_at:now});}
  else if(action==='asset.create')out=add('assets',{...p,id,condition:'Good',status:'Tersedia',assigned_user_id:'',created_at:now});
  else if(action==='asset.assign'){out=d.assets.find(x=>x.id===p.id);if(!out)throw Error('Aset tidak ditemukan.');out.assigned_user_id=p.user_id;out.status='Dipakai';}
  else if(action==='approval.request'){let role=({Operasional:'SENIOR_PM',Dokumen:'CORSEC_DIRECTOR',Anggaran:'FINANCE_DIRECTOR'})[p.type];if(role===state.user.role)role='CEO';out=add('approvals',{...p,id,requester_user_id:state.user.id,approver_role:role,status:'Menunggu',created_at:now});}
  else if(action==='notification.read'){out=d.notifications.find(x=>x.id===p.id);if(out)out.status='Dibaca';}
  else if(action==='meeting.create'){const pr=project(p.project_id);out=add('meetings',{...p,id,business_unit_id:pr.business_unit_id,calendar_sync_status:'Belum dikonfigurasi',created_at:now});}
  else if(action==='mom.create'){project(p.project_id);out=add('moms',{...p,id,meeting_at:now,created_at:now});}
  else if(action==='document.upload'){const pr=project(p.entity_id);out=add('documents',{id,entity_type:'PROJECT',entity_id:pr.id,file_name:p.file_name,file_url:'',business_unit_id:pr.business_unit_id,created_at:now});}
  else if(action==='stock.count'){if(!access(state.user.role,['CEO','GA_SUPERVISOR','LOGISTICS']))throw Error('Opname hanya untuk pengelola gudang.');const item=d.inventory.find(x=>x.id===p.inventory_id);if(!item||!state.user.global&&item.business_unit_id!==state.user.business_unit_id)throw Error('Barang tidak tersedia.');const qty=Number(p.counted_quantity);if(!Number.isInteger(qty)||qty<0)throw Error('Jumlah fisik harus bilangan bulat.');if(d.stock_counts.some(x=>x.inventory_id===item.id&&x.status==='Menunggu persetujuan'))throw Error('Opname sebelumnya masih menunggu.');const delta=qty-Number(item.quantity);out={id,inventory_id:item.id,sku:item.sku,item_name:item.item_name,location:item.location,business_unit_id:item.business_unit_id,expected_quantity:Number(item.quantity),counted_quantity:qty,delta,reason:p.reason,status:delta?'Menunggu persetujuan':'Sesuai',counted_by:state.user.id,created_at:now};if(delta)out.approval_id=approval('STOCK_COUNT',id,'Opname '+item.item_name+' · '+item.location,item.business_unit_id,'GA_SUPERVISOR');add('stock_counts',out);}
  else if(action==='invoice.create'){if(!access(state.user.role,['CEO','FINANCE_DIRECTOR','ADMIN_PROJECT']))throw Error('Peran Anda tidak dapat membuat tagihan.');const sale=d.sales.find(x=>x.id===p.sale_order_id);if(!sale||sale.status!=='Terpenuhi'||d.invoices.some(i=>i.sale_order_id===sale.id))throw Error('Pesanan belum terpenuhi atau sudah ditagihkan.');const day=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date());if(!p.due_date||p.due_date<day)throw Error('Tanggal jatuh tempo tidak valid.');out=add('invoices',{id,number:`INV-${day.replaceAll('-','')}-${String(d.invoices.length+1).padStart(4,'0')}`,sale_order_id:sale.id,client_id:sale.client_id,client_name:sale.client_name,project_id:sale.project_id,business_unit_id:sale.business_unit_id,amount:Number(sale.total),paid_amount:0,due_date:p.due_date,status:'Belum dibayar',issued_by:state.user.id,issued_at:now,updated_at:now});}
  else if(action==='payment.record'){if(!access(state.user.role,['CEO','FINANCE_DIRECTOR']))throw Error('Pembayaran hanya dicatat Finance.');const inv=d.invoices.find(x=>x.id===p.invoice_id),amount=Number(p.amount);if(!inv||inv.status==='Lunas'||!Number.isFinite(amount)||amount<=0||Math.abs(Math.round(amount*100)-amount*100)>1e-6||amount>Number(inv.amount)-Number(inv.paid_amount))throw Error('Nominal melebihi sisa tagihan.');if(d.payments.some(x=>x.invoice_id===inv.id&&x.reference.toLowerCase()===p.reference.toLowerCase()))throw Error('Nomor bukti sudah tercatat.');out=add('payments',{...p,id,amount,recorded_by:state.user.id,business_unit_id:inv.business_unit_id,created_at:now});inv.paid_amount=Math.round((Number(inv.paid_amount)+amount)*100)/100;inv.status=inv.paid_amount>=Number(inv.amount)?'Lunas':'Sebagian';inv.updated_at=now;}
  else if(action==='journal.create'){
    if(!access(state.user.role,['CEO','FINANCE_DIRECTOR']))throw Error('Akses jurnal tidak tersedia.');
    if(d.journals.some(j=>j.business_unit_id===p.business_unit_id&&j.reference.toLowerCase()===p.reference.toLowerCase()))throw Error('Referensi jurnal sudah ada.');
    if(!Array.isArray(p.lines)||p.lines.length<2||p.lines.length>20)throw Error('Isi 2–20 baris.');
    let debit=0,credit=0;const lines=p.lines.map(l=>{if(!d.accounts.some(a=>a.business_unit_id===p.business_unit_id&&a.code===l.account_code))throw Error('Akun tidak tersedia.');const a=Number(l.debit),b=Number(l.credit);if(!Number.isFinite(a)||!Number.isFinite(b)||(a>0)===(b>0)||a<0||b<0)throw Error('Debit/kredit baris tidak valid.');debit+=Math.round(a*100);credit+=Math.round(b*100);return {account_code:l.account_code,debit:a,credit:b};});if(!debit||debit!==credit)throw Error('Debit dan kredit harus sama.');
    out=add('journals',{id,entry_date:p.entry_date,description:p.description,reference:p.reference,business_unit_id:p.business_unit_id,status:'Draft',created_by:state.user.id,created_at:now,lines});
  }
  else if(action==='journal.submit'){
    out=d.journals.find(j=>j.id===p.id);if(!out||out.status!=='Draft'||out.created_by!==state.user.id)throw Error('Jurnal draft tidak tersedia.');out.status='Menunggu persetujuan';const approver=state.user.role==='CEO'?'FINANCE_DIRECTOR':'CEO';const approval=add('approvals',{id:uid(),type:'JOURNAL',reference_id:out.id,title:'Jurnal '+out.reference,business_unit_id:out.business_unit_id,requester_user_id:state.user.id,approver_role:approver,status:'Menunggu',created_at:now});out.approval_id=approval.id;
  }
  else if(action==='journal.reverse'){
    const original=d.journals.find(j=>j.id===p.id);if(!original||original.status!=='Posted'||d.journals.some(j=>j.reversal_of===original.id))throw Error('Pembalik sudah ada atau jurnal belum posted.');out=add('journals',{id,entry_date:p.entry_date,description:'Pembalik '+original.reference+' · '+p.reason,reference:'REV-'+original.id,business_unit_id:original.business_unit_id,status:'Draft',created_by:state.user.id,reversal_of:original.id,created_at:now,lines:original.lines.map(l=>({account_code:l.account_code,debit:l.credit,credit:l.debit}))});
  }
  else if(action==='sale.create'){const pr=project(p.project_id),client=d.clients.find(x=>x.id===p.client_id);if(!client||client.business_unit_id!==pr.business_unit_id)throw Error('Klien dan proyek harus satu unit.');if(!p.items?.length||p.items.length>20||new Set(p.items.map(x=>x.sku)).size!==p.items.length)throw Error('Isi 1–20 barang berbeda.');const selected=p.items.map(line=>{const ref=d.inventory.find(x=>x.sku===line.sku&&x.business_unit_id===pr.business_unit_id);if(!ref||!Number.isInteger(Number(line.quantity))||Number(line.quantity)<1||Number(line.unit_price)<=0)throw Error('Periksa barang, jumlah, dan harga.');return {...line,item_name:ref.item_name};});const total=selected.reduce((sum,line)=>sum+Number(line.quantity)*Number(line.unit_price),0);out=add('sales',{id,client_id:client.id,client_name:client.company_name,project_id:pr.id,business_unit_id:pr.business_unit_id,location:p.location,total,status:'Menunggu gudang',requester_user_id:state.user.id,created_at:now});selected.forEach(line=>add('sales_lines',{...line,id:uid(),order_id:id,business_unit_id:pr.business_unit_id}));}
  else if(action==='sale.fulfill'){out=d.sales.find(x=>x.id===p.id);if(!out||out.status!=='Menunggu gudang')throw Error('Pesanan tidak dapat diproses.');const lines=d.sales_lines.filter(x=>x.order_id===out.id);if(!lines.length)throw Error('Baris pesanan tidak ada.');const changes=lines.map(line=>{const item=d.inventory.find(x=>x.sku===line.sku&&x.business_unit_id===out.business_unit_id&&x.location.toLowerCase()===out.location.toLowerCase());if(!item||Number(item.quantity)<Number(line.quantity))throw Error('Stok '+line.item_name+' tidak cukup.');return {item,line};});changes.forEach(({item,line})=>{item.quantity-=Number(line.quantity);item.updated_at=now;d.movements.unshift({id:uid(),sku:line.sku,item_name:line.item_name,business_unit_id:out.business_unit_id,from_location:out.location,to_location:'',quantity:Number(line.quantity),project_id:out.project_id,condition:'Good',actor_user_id:state.user.id,created_at:now,reference_id:out.id});});out.status='Terpenuhi';out.fulfilled_at=now;}
  else return null;
  return out;
}

export function demoDecisionCascade(approval,state,decision) {
  if(approval.type==='JOURNAL'){
    const journal=(state.data.journals||[]).find(x=>x.id===approval.reference_id);
    if(journal&&journal.approval_id===approval.id){journal.status=decision==='Disetujui'?'Posted':'Ditolak';if(journal.status==='Posted')journal.posted_at=new Date().toISOString();}
  }
  if(approval.type==='WORK_ITEM'){
    const item=(state.data.work_items||[]).find(x=>x.id===approval.reference_id);
    if(item&&item.approval_id===approval.id){item.status=decision;item.version++;item.updated_at=new Date().toISOString();}
  }
  if(approval.type==='STOCK_COUNT'){
    const count=state.data.stock_counts.find(x=>x.id===approval.reference_id);
    if(count){const item=state.data.inventory.find(x=>x.id===count.inventory_id);count.approved_by=state.user.id;if(decision==='Ditolak')count.status='Ditolak';else if(!item||Number(item.quantity)!==Number(count.expected_quantity))count.status='Perlu hitung ulang';else{count.status='Disesuaikan';count.applied_at=new Date().toISOString();item.quantity=Number(count.counted_quantity);item.updated_at=count.applied_at;state.data.movements.unshift({id:crypto.randomUUID(),sku:count.sku,item_name:count.item_name,business_unit_id:count.business_unit_id,from_location:count.delta<0?count.location:'',to_location:count.delta>0?count.location:'',quantity:Math.abs(count.delta),project_id:'',condition:'Good',actor_user_id:state.user.id,created_at:count.applied_at,reference_id:count.id});}}
  }
  const key={LEAVE:'leaves',REIMBURSEMENT:'reimbursements',PURCHASE_REQUEST:'purchases',PROJECT_EXPENSE:'expenses'}[approval.type];
  if(key){const target=state.data[key].find(x=>x.id===approval.reference_id);if(target)target.status=decision;}
  approval.status=decision;approval.decided_at=new Date().toISOString();
}

export function demoPayroll(state,period,bu) {
  const lines=state.data.employees.filter(e=>e.business_unit_id===bu&&e.status==='ACTIVE').map(e=>{const count=state.data.attendance.filter(a=>a.user_id===e.user_id&&String(a.check_in_at).slice(0,7)===period&&a.extra_day&&a.check_out_at).length;return {employee_id:e.id,name:e.name,extra_days:count,rate:Number(e.weekend_rate)||0,estimated_day_payment:count*(Number(e.weekend_rate)||0)};});
  return {period,business_unit_id:bu,lines,total:lines.reduce((sum,x)=>sum+x.estimated_day_payment,0)};
}
