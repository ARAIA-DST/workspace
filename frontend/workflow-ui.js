import { WORKFLOW_TYPES } from './workflow-catalog.js';
import { UNITS } from './data.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',"'":'&#39;'}[c]));
const AUDIENCES = {
  HR:['CEO','CORSEC_DIRECTOR'], ESS:null,
  PROJECT:['CEO','CREATIVE_DIRECTOR','SENIOR_PM','PM','PAM','ADMIN_PROJECT','PERMITTER'],
  TALENT:['CEO','SENIOR_PM','TALENT_MANAGER','TALENT_OFFICER'],
  WAREHOUSE:['CEO','GA_SUPERVISOR','LOGISTICS'],
  PURCHASING:['CEO','FINANCE_DIRECTOR','GA_SUPERVISOR','ADMIN_PROJECT'],
  FINANCE:['CEO','FINANCE_DIRECTOR'], TAX:['CEO','FINANCE_DIRECTOR','TAX'],
  CRM:['CEO','PAM','PM','SENIOR_PM','CREATIVE_DIRECTOR','ADMIN_PROJECT'],
  GOVERNANCE:['CEO','CORSEC_DIRECTOR','ADMIN_CORSEC']
};
const SUBJECTS = {
  PROJECT:['projects','name'],CLIENT:['clients','company_name'],EMPLOYEE:['employees','name'],
  VENDOR:['vendors','name'],ASSET:['assets','name'],OPPORTUNITY:['opportunities','name']
};
const SUBJECT_ALLOWED={HR:['EMPLOYEE'],ESS:['EMPLOYEE','PROJECT'],PROJECT:['PROJECT'],TALENT:['PROJECT','EMPLOYEE'],WAREHOUSE:['ASSET','PROJECT'],PURCHASING:['PROJECT','VENDOR'],FINANCE:['PROJECT','CLIENT','VENDOR'],TAX:['PROJECT','CLIENT'],CRM:['CLIENT','OPPORTUNITY'],GOVERNANCE:['PROJECT','CLIENT','EMPLOYEE']};
const AREA_LABEL={HRIS:'Tim',ERP:'Operasional',CRM:'Klien',SHARED:'Sistem'};
export function workflowTypes(user){return WORKFLOW_TYPES.filter(t=>!AUDIENCES[t.audience]||AUDIENCES[t.audience].includes(user.role));}
export function workflowPage(ctx) {
  const {state,h,badge,dateLabel,unitTag}=ctx,types=workflowTypes(state.user);
  const area=state.workArea||'HRIS',visible=types.filter(t=>t.area===area&&(!state.search||t.label.toLowerCase().includes(state.search.toLowerCase())));
  const selected=types.find(t=>t.id===state.workType&&t.area===area);
  const records=(state.data.work_items||[]).filter(x=>!selected||x.type===selected.id).filter(x=>state.user.global||x.business_unit_id===state.user.business_unit_id).filter(x=>state.unit==='ALL'||x.business_unit_id===state.unit);
  const recordRows=selected?records.map(x=>`<tr><td><strong>${h(x.title)}</strong><small>${h(x.details?.summary||x.details?.category||'')}</small></td><td>${unitTag(x.business_unit_id)}</td><td>${badge(x.status)}</td><td>${dateLabel(x.updated_at)}</td><td>${x.status==='Draft'?`<button class="button small secondary" data-modal="workEdit:${h(x.id)}">Ubah</button> <button class="button small" data-work-action="submit" data-id="${h(x.id)}">Kirim</button>`:['Berjalan','Disetujui'].includes(x.status)?`<button class="button small" data-work-action="complete" data-id="${h(x.id)}">Tandai selesai</button>`:'—'}</td></tr>`).join(''):'';
  return `<div class="view-head"><div><span class="eyebrow">ARAIA Workspace</span><h1>Pusat pekerjaan</h1><p>Pilih bagian, catat kebutuhan, dan pantau keputusannya.</p></div></div>
    <div class="subtabs" role="tablist">${Object.keys(AREA_LABEL).filter(a=>types.some(t=>t.area===a)).map(a=>`<button data-work-area="${a}" class="${area===a?'active':''}" role="tab" aria-selected="${area===a}">${AREA_LABEL[a]}</button>`).join('')}</div>
    <div class="toolbar"><input data-search placeholder="Cari jenis pekerjaan" aria-label="Cari jenis pekerjaan" value="${h(state.search)}"><small>${visible.length} pilihan</small></div>
    <div class="workflow-grid">${visible.map(t=>`<button class="workflow-card ${selected?.id===t.id?'selected':''}" data-work-type="${t.id}"><strong>${h(t.label)}</strong><small>${AREA_LABEL[t.area]}</small></button>`).join('')}</div>
    ${selected?`<div class="section-title"><h2>${h(selected.label)}</h2><button class="button" data-modal="workCreate:${h(selected.id)}">+ Catat baru</button></div><p class="muted">Simpan sebagai draft, kirim untuk diproses, lalu tandai selesai setelah pekerjaan benar-benar selesai.</p>
      ${records.length?`<div class="table-wrap"><table><thead><tr><th>Pekerjaan</th><th>Unit</th><th>Status</th><th>Diperbarui</th><th>Aksi</th></tr></thead><tbody>${recordRows}</tbody></table></div>`:'<div class="empty"><strong>Belum ada catatan</strong><p>Pilih Catat baru untuk memulai.</p></div>'}`:''}`;
}
export function workflowModal(kind,ctx) {
  const [mode,key]=kind.split(':');if(!['workCreate','workEdit'].includes(mode))return '';
  const item=mode==='workEdit'?(ctx.state.data.work_items||[]).find(x=>x.id===key):null;
  const type=WORKFLOW_TYPES.find(x=>x.id===(item?.type||key));
  if(!type||!workflowTypes(ctx.state.user).some(x=>x.id===type.id)||mode==='workEdit'&&!item)return '';
  const units=UNITS.filter(x=>ctx.state.user.global||x.id===ctx.state.user.business_unit_id);
  const bu=item?.business_unit_id||ctx.state.user.business_unit_id;
  const options=SUBJECT_ALLOWED[type.audience].flatMap(subject=>{
    const [list,label]=SUBJECTS[subject];
    return (ctx.state.data[list]||[]).filter(x=>x.business_unit_id===bu).filter(x=>subject!=='EMPLOYEE'||['CEO','CORSEC_DIRECTOR'].includes(ctx.state.user.role)||x.user_id===ctx.state.user.id).map(x=>[`${subject}|${x.id}`,`${subject==='PROJECT'?'Proyek':subject==='CLIENT'?'Klien':subject==='EMPLOYEE'?'Karyawan':subject==='VENDOR'?'Vendor':subject==='ASSET'?'Aset':'Peluang'} · ${x[label]}`]);
  });
  const input=(key,label,kind,value)=>`<div class="field"><label for="w-${key}">${esc(label)}</label>${kind==='textarea'?`<textarea id="w-${key}" name="detail:${key}" maxlength="2000" required>${esc(value||'')}</textarea>`:`<input id="w-${key}" name="detail:${key}" type="${kind==='integer'||kind==='rating'?'number':kind==='number'?'number':kind}" ${kind==='number'?'step="0.01" min="0.01"':kind==='integer'?'step="1" min="1"':kind==='rating'?'step="1" min="1" max="5"':''} value="${esc(value??'')}" required>`}</div>`;
  return `<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><span class="eyebrow">${AREA_LABEL[type.area]}</span><h2 id="modal-title">${esc(type.label)}</h2><p class="muted">Isi dengan kalimat singkat dan jelas.</p></div><button class="close" data-action="close-modal" aria-label="Tutup">×</button></div><form id="entry-form" data-kind="${mode}" data-type="${type.id}" data-id="${esc(item?.id||'')}" data-version="${esc(item?.version||'')}"><div class="form-grid">
    <div class="field"><label for="w-title">Judul pekerjaan</label><input id="w-title" name="title" maxlength="120" value="${esc(item?.title||'')}" required></div>
    ${mode==='workCreate'?`<div class="field"><label for="w-bu">Unit bisnis</label><select id="w-bu" name="business_unit_id" required>${units.map(u=>`<option value="${u.id}" ${bu===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="w-subject">Terkait dengan (opsional)</label><select id="w-subject" name="subject"><option value="">Tanpa data terkait</option>${options.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>
    <div class="field"><label for="w-assignee">Penanggung jawab</label><select id="w-assignee" name="assignee_user_id">${(ctx.state.data.employees||[]).filter(x=>x.business_unit_id===bu&&x.status==='ACTIVE'&&(type.audience!=='ESS'||x.user_id===ctx.state.user.id)).map(x=>`<option value="${esc(x.user_id)}" ${x.user_id===ctx.state.user.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>`:''}
    ${type.fields.map(f=>input(f.key,f.label,f.kind,item?.details?.[f.key])).join('')}
    <div class="form-actions"><button type="button" class="button secondary" data-action="close-modal">Batal</button><button class="button" type="submit">Simpan draft</button></div></div></form></div></div>`;
}
export function workflowDemoAction(action,p,state,uuid) {
  const type=WORKFLOW_TYPES.find(t=>t.id===p.type),all=state.data.work_items||[],now=new Date().toISOString();let item;
  if(action==='work.create'){
    if(!type||!workflowTypes(state.user).some(x=>x.id===p.type))throw Error('Jenis pekerjaan tidak tersedia.');
    if(!state.user.global&&p.business_unit_id!==state.user.business_unit_id)throw Error('Unit tidak sesuai.');
    item={...p,id:uuid(),owner_user_id:state.user.id,assignee_user_id:p.assignee_user_id||state.user.id,status:'Draft',version:1,created_at:now,updated_at:now};
    all.unshift(item);return item;
  }
  item=all.find(x=>x.id===p.id);if(!item)throw Error('Pekerjaan tidak ditemukan.');
  if(action==='work.update'){if(!['Draft','Berjalan'].includes(item.status)||Number(p.version)!==Number(item.version))throw Error('Data sudah berubah.');Object.assign(item,{title:p.title,details:p.details,version:item.version+1,updated_at:now});return item;}
  if(action==='work.submit'){
    if(item.status!=='Draft')throw Error('Pekerjaan sudah dikirim.');
    const def=WORKFLOW_TYPES.find(t=>t.id===item.type);
    if(def.approver!=='NONE'){
      const approval={id:uuid(),type:'WORK_ITEM',reference_id:item.id,title:def.label+' · '+item.title,business_unit_id:item.business_unit_id,requester_user_id:state.user.id,approver_role:state.user.role===def.approver?'CEO':def.approver,status:'Menunggu',created_at:now};
      state.data.approvals.unshift(approval);item.approval_id=approval.id;item.status='Menunggu persetujuan';
    }else item.status='Berjalan';
  }else if(action==='work.complete'){
    if(!['Berjalan','Disetujui'].includes(item.status))throw Error('Pekerjaan belum dapat diselesaikan.');
    item.status='Selesai';
  }else throw Error('Aksi pekerjaan tidak dikenal.');
  item.version++;item.updated_at=now;return item;
}
