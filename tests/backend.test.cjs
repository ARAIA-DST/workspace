const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', 'apps-script');
const tables = {
  PROJECTS: [{_row:2,id:'p1',name:'Event',business_unit_id:'DOTSIXTWOO',budget:1000,stage:'In-Progress',owner_user_id:'pm'}],
  TASKS: [], ATTENDANCE: [], INVENTORY: [
    {_row:2,id:'i1',sku:'PEACH',item_name:'Peach Tea',business_unit_id:'DOTSIXTWOO',location:'Gudang',quantity:90,unit:'pcs'},
    {_row:3,id:'i2',sku:'PEACH',item_name:'Peach Tea',business_unit_id:'DOTSIXTWOO',location:'Booth',quantity:0,unit:'pcs'},
  ], INVENTORY_MOVEMENTS: [], CRM_LEADS: [], APPROVALS: [
    {_row:2,id:'a1',title:'Minta barang',status:'Menunggu',business_unit_id:'DOTSIXTWOO',requester_user_id:'owner'},
  ], REQUESTS: [], LOGS: [], HOLIDAYS: [], SESSIONS: [], USERS: [
    {_row:2,id:'pm',name:'PM',email:'pm@example.com',role:'PM',business_unit_id:'DOTSIXTWOO',status:'ACTIVE'},
    {_row:3,id:'finance',name:'Finance',email:'finance@example.com',role:'FINANCE_DIRECTOR',business_unit_id:'ARAIA',status:'ACTIVE'},
    {_row:4,id:'senior',name:'Senior',email:'senior@example.com',role:'SENIOR_PM',business_unit_id:'DOTSIXTWOO',status:'ACTIVE'},
    {_row:5,id:'ceo',name:'CEO',email:'ceo@example.com',role:'CEO',business_unit_id:'ARAIA',status:'ACTIVE'},
    {_row:6,id:'designer',name:'Desainer',email:'designer@example.com',role:'DESIGNER_2D',business_unit_id:'DOTSIXTWOO',status:'ACTIVE'},
    {_row:7,id:'ga',name:'GA',email:'ga@example.com',role:'GA_SUPERVISOR',business_unit_id:'DOTSIXTWOO',status:'ACTIVE'},
  ],
};
for (const name of ['EMPLOYEES','TALENTS','DEPLOYMENTS','LEAVE_REQUESTS','REIMBURSEMENTS','SHIFTS','TIMESHEETS','VENDORS','PURCHASE_REQUESTS','PURCHASE_ORDERS','PROJECT_EXPENSES','CLIENTS','OPPORTUNITIES','QUOTATIONS','CRM_ACTIVITIES','ASSETS','DOCUMENTS','NOTIFICATIONS','OUTBOX','MEETINGS','MOM','SALES_ORDERS','SALES_ORDER_LINES','STOCK_COUNTS','INVOICES','PAYMENTS','WORK_ITEMS','WORK_ITEM_EVENTS','ACCOUNTS','JOURNALS','JOURNAL_LINES']) tables[name]=[];
let nextId=1, currentUser={id:'logistic',role:'LOGISTICS',name:'Petugas',business_unit_id:'DOTSIXTWOO',global:false};
const ctx = vm.createContext({
  console, Date, Math, JSON,
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})},
  LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
  SpreadsheetApp:{flush:()=>{}},
  Utilities:{getUuid:()=>`00000000-0000-0000-0000-${String(nextId++).padStart(12,'0')}`,formatDate:(date,tz,format)=>format.includes('HH:mm')?new Date(date.getTime()+7*3600000).toISOString().slice(0,16):'2026-09-27'},
  rows_:(name)=>tables[name] || [],
  append_:(name,row)=>{row._row=tables[name].length+2;tables[name].push(row);return row;},
  update_:(name,row,patch)=>Object.assign(tables[name][row-2],patch),
  uuid_:()=>`00000000-0000-0000-0000-${String(nextId++).padStart(12,'0')}`,
  now_:()=> '2026-09-27T02:00:00.000Z',
  log_:(user,action,entity,id)=>tables.LOGS.push({user:user.id,action,entity,id}),
  required_:(v,label)=>{if(!String(v||'').trim())throw Error(label+' wajib diisi.');return String(v).trim();},
  date_:(v)=>v,
  number_:(v,label,min)=>{const n=Number(v);if(v===''||!Number.isFinite(n)||n<min)throw Error(label+' tidak valid.');return n;},
});
for (const file of ['Auth.gs','WorkflowCatalog.gs','Workflow.gs','Ledger.gs','DataAccess.gs','Import.gs','Integrations.gs','Modules.gs','Business.gs','Sales.gs','StockCounts.gs','Billing.gs','Operations.gs','Code.gs']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
ctx.sessionUser_=()=>currentUser;
const call=(action,payload)=>ctx.apiDispatch({action,payload,token:'test'});
const requestId='00000000-0000-0000-0000-000000000001';
const move={sku:'PEACH',from_location:'Gudang',to_location:'Booth',quantity:10,condition:'Good',requestId};
let result=call('inventory.move',move);
assert.equal(result.ok,true,result.error);
assert.equal(tables.INVENTORY[0].quantity,80);
assert.equal(tables.INVENTORY[1].quantity,10);
assert.equal(tables.INVENTORY_MOVEMENTS.length,1);
result=call('inventory.move',move);
assert.equal(result.ok,true);
assert.equal(tables.INVENTORY_MOVEMENTS.length,1,'retry must not move stock twice');
result=call('inventory.move',{...move,quantity:1000,requestId:'00000000-0000-0000-0000-000000000002'});
assert.equal(result.ok,false);
assert.equal(tables.INVENTORY[0].quantity,80,'insufficient stock must not mutate balance');
currentUser={...currentUser,business_unit_id:'DIVI'};
result=call('inventory.move',{...move,requestId:'00000000-0000-0000-0000-000000000003'});
assert.equal(result.ok,false,'other business unit must be blocked');
currentUser={id:'owner',role:'CEO',name:'CEO',business_unit_id:'ARAIA',global:true};
result=call('approval.decide',{id:'a1',decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000004'});
assert.equal(result.ok,false,'self approval must be blocked');
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('expense.request',{project_id:'p1',category:'Produksi',description:'Material',amount:250,requestId:'00000000-0000-0000-0000-000000000005'});
assert.equal(result.ok,true,result.error);
const expense=result.data;
assert.equal(tables.PROJECT_EXPENSES[0].status,'Menunggu');
assert.equal(tables.APPROVALS.find(x=>x.id===expense.approval_id).approver_role,'FINANCE_DIRECTOR');
currentUser={id:'finance',role:'FINANCE_DIRECTOR',name:'Finance',business_unit_id:'ARAIA',global:true};
result=call('approval.decide',{id:expense.approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000006'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.PROJECT_EXPENSES[0].status,'Disetujui');
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('report.get',{business_unit_id:'DOTSIXTWOO'});
assert.equal(result.data.approved_expenses,250);
tables.VENDORS.push({_row:2,id:'v1',name:'Printing',business_unit_id:'DOTSIXTWOO',status:'ACTIVE'});
result=call('purchase.request',{project_id:'p1',vendor_id:'v1',title:'Backdrop',quantity:2,unit_cost:150,requestId:'00000000-0000-0000-0000-000000000007'});
assert.equal(result.ok,true,result.error);
const pr=result.data;
currentUser={id:'finance',role:'FINANCE_DIRECTOR',name:'Finance',business_unit_id:'ARAIA',global:true};
result=call('approval.decide',{id:pr.approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000008'});
assert.equal(result.ok,true,result.error);
result=call('order.create',{purchase_request_id:pr.id,requestId:'00000000-0000-0000-0000-000000000009'});
assert.equal(result.ok,true,result.error);
assert.equal(result.data.total,300);
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
tables.CRM_LEADS.push({_row:2,id:'lead1',company_name:'Brand A',contact_name:'PIC',contact_email:'pic@example.com',business_unit_id:'DOTSIXTWOO',stage:'Brief diterima'});
result=call('lead.convert',{id:'lead1',value:5000,expected_date:'2026-10-30',requestId:'00000000-0000-0000-0000-000000000010'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.OPPORTUNITIES.length,1);
assert.equal(tables.CRM_LEADS[0].stage,'Converted');
result=call('quotation.create',{opportunity_id:tables.OPPORTUNITIES[0].id,amount:4500,description:'Aktivasi',valid_until:'2026-10-20',requestId:'00000000-0000-0000-0000-000000000011'});
assert.equal(result.ok,true,result.error);
assert.equal(result.data.version,1);
result=call('leave.request',{start_date:'2026-10-01',end_date:'2026-10-02',leave_type:'Cuti',reason:'Keperluan keluarga',requestId:'00000000-0000-0000-0000-000000000012'});
assert.equal(result.ok,true,result.error);
currentUser={id:'senior',role:'SENIOR_PM',name:'Senior',business_unit_id:'DOTSIXTWOO',global:false};
result=call('approval.decide',{id:tables.LEAVE_REQUESTS[0].approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000013'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.LEAVE_REQUESTS[0].status,'Disetujui');
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('meeting.create',{project_id:'p1',title:'Kickoff',starts_at:'2026-10-05T10:00',ends_at:'2026-10-05T11:00',attendee_user_ids:['pm','senior'],requestId:'00000000-0000-0000-0000-000000000014'});
assert.equal(result.ok,true,result.error);
assert.equal(result.data.calendar_sync_status,'Belum dikonfigurasi');
result=call('mom.create',{project_id:'p1',title:'MOM Kickoff',notes:'Pembagian tugas disetujui.',requestId:'00000000-0000-0000-0000-000000000015'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.MOM.length,1);
tables.EMPLOYEES.push({_row:2,id:'e-pm',user_id:'pm',employee_code:'A-1',title:'PM',business_unit_id:'DOTSIXTWOO',weekend_rate:400000,status:'ACTIVE'});
tables.ATTENDANCE.push({_row:2,id:'att1',user_id:'pm',work_date:'2026-10-04',check_out_at:'2026-10-04T12:00:00Z',extra_day:true});
currentUser={id:'finance',role:'FINANCE_DIRECTOR',name:'Finance',business_unit_id:'ARAIA',global:true};
result=call('payroll.preview',{period:'2026-10',business_unit_id:'DOTSIXTWOO'});
assert.equal(result.ok,true,result.error);
assert.equal(result.data.total,400000);
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('sale.create',{client_id:tables.CLIENTS[0].id,project_id:'p1',location:'Gudang',items:[{sku:'PEACH',quantity:10,unit_price:20000}],requestId:'00000000-0000-0000-0000-000000000016'});
assert.equal(result.ok,true,result.error);
const sale=result.data;
assert.equal(tables.INVENTORY[0].quantity,80,'order creation must not deduct stock');
result=call('sale.fulfill',{id:sale.id,requestId:'00000000-0000-0000-0000-000000000017'});
assert.equal(result.ok,false,'PM cannot fulfill sales');
currentUser={id:'logistic',role:'LOGISTICS',name:'Petugas',business_unit_id:'DOTSIXTWOO',global:false};
result=call('sale.fulfill',{id:sale.id,requestId:'00000000-0000-0000-0000-000000000018'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.INVENTORY[0].quantity,70);
assert.equal(tables.INVENTORY_MOVEMENTS.at(-1).reference_id,sale.id);
result=call('sale.fulfill',{id:sale.id,requestId:'00000000-0000-0000-0000-000000000018'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.INVENTORY[0].quantity,70,'retry must not deduct twice');
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('task.create',{project_id:'p1',assignee_user_id:'designer',title:'Buat materi desain',due_date:'2026-10-05',requestId:'00000000-0000-0000-0000-000000000019'});
assert.equal(result.ok,true,result.error);
const task=result.data;
assert.equal(task.assignee_user_id,'designer');
assert.equal(tables.NOTIFICATIONS.at(-1).user_id,'designer');
currentUser={id:'designer',role:'DESIGNER_2D',name:'Desainer',business_unit_id:'DOTSIXTWOO',global:false};
assert.equal(call('task.list',{}).data.length,1);
result=call('task.update',{id:task.id,status:'Dikerjakan',requestId:'00000000-0000-0000-0000-000000000020'});
assert.equal(result.ok,true,result.error);
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('project.stage',{id:'p1',stage:'On-Event Execution',requestId:'00000000-0000-0000-0000-000000000021'});
assert.equal(result.ok,true,result.error);
result=call('project.stage',{id:'p1',stage:'Project Closed',requestId:'00000000-0000-0000-0000-000000000022'});
assert.equal(result.ok,false,'cannot skip lifecycle steps');
currentUser={id:'logistic',role:'LOGISTICS',name:'Petugas',business_unit_id:'DOTSIXTWOO',global:false};
result=call('stock.count',{inventory_id:'i1',counted_quantity:68,reason:'Hitung fisik di gudang',requestId:'00000000-0000-0000-0000-000000000023'});
assert.equal(result.ok,true,result.error);
const count=result.data;
assert.equal(tables.INVENTORY[0].quantity,70,'variance must await approval');
assert.equal(tables.APPROVALS.find(x=>x.id===count.approval_id).approver_role,'GA_SUPERVISOR');
result=call('approval.decide',{id:count.approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000024'});
assert.equal(result.ok,false,'count requester cannot approve own variance');
currentUser={id:'ga',role:'GA_SUPERVISOR',name:'GA',business_unit_id:'DOTSIXTWOO',global:false};
result=call('approval.decide',{id:count.approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000025'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.INVENTORY[0].quantity,68);
assert.equal(tables.STOCK_COUNTS[0].status,'Disesuaikan');
assert.equal(tables.INVENTORY_MOVEMENTS.at(-1).reference_id,count.id);
currentUser={id:'logistic',role:'LOGISTICS',name:'Petugas',business_unit_id:'DOTSIXTWOO',global:false};
result=call('stock.count',{inventory_id:'i2',counted_quantity:8,reason:'Hitung fisik di booth',requestId:'00000000-0000-0000-0000-000000000026'});
assert.equal(result.ok,true,result.error);
const stale=result.data;
result=call('inventory.move',{sku:'PEACH',from_location:'Booth',to_location:'',quantity:1,condition:'Good',requestId:'00000000-0000-0000-0000-000000000027'});
assert.equal(result.ok,true,result.error);
currentUser={id:'ga',role:'GA_SUPERVISOR',name:'GA',business_unit_id:'DOTSIXTWOO',global:false};
result=call('approval.decide',{id:stale.approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000028'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.STOCK_COUNTS[1].status,'Perlu hitung ulang');
assert.equal(tables.INVENTORY[1].quantity,9,'stale count cannot overwrite newer stock');
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('invoice.create',{sale_order_id:sale.id,due_date:'2026-10-30',requestId:'00000000-0000-0000-0000-000000000029'});
assert.equal(result.ok,false,'PM cannot issue internal invoice');
currentUser={id:'finance',role:'FINANCE_DIRECTOR',name:'Finance',business_unit_id:'ARAIA',global:true};
result=call('invoice.create',{sale_order_id:sale.id,due_date:'2026-10-30',requestId:'00000000-0000-0000-0000-000000000030'});
assert.equal(result.ok,true,result.error);
const invoice=result.data;
assert.equal(invoice.amount,200000);
result=call('invoice.create',{sale_order_id:sale.id,due_date:'2026-10-30',requestId:'00000000-0000-0000-0000-000000000031'});
assert.equal(result.ok,false,'one invoice per sale');
result=call('payment.record',{invoice_id:invoice.id,amount:50000,method:'Transfer',reference:'BANK-1',paid_at:'2026-09-27',requestId:'00000000-0000-0000-0000-000000000032'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.INVOICES[0].status,'Sebagian');
result=call('payment.record',{invoice_id:invoice.id,amount:150001,method:'Transfer',reference:'BANK-2',paid_at:'2026-09-27',requestId:'00000000-0000-0000-0000-000000000033'});
assert.equal(result.ok,false,'overpayment rejected');
result=call('payment.record',{invoice_id:invoice.id,amount:150000,method:'Transfer',reference:'BANK-2',paid_at:'2026-09-27',requestId:'00000000-0000-0000-0000-000000000034'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.INVOICES[0].status,'Lunas');
assert.equal(tables.INVOICES[0].paid_amount,200000);
result=call('report.get',{business_unit_id:'DOTSIXTWOO'});
assert.equal(result.data.outstanding_amount,0);
assert.equal(result.data.recorded_payments,200000);
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('app.bootstrap',{});
assert.equal(result.ok,true,result.error);
assert.equal(result.data.inventory[0].sku,'PEACH');
assert.equal(Object.hasOwn(result.data.inventory[0],'quantity'),false,'PM sees catalog without warehouse balances');
result=call('report.get',{business_unit_id:'DOTSIXTWOO'});
assert.equal(Object.hasOwn(result.data,'recorded_payments'),false,'PM cannot read finance collection totals');
result=call('purchase.request',{project_id:'p1',vendor_id:'v1',title:'Peach Tea',sku:'PEACH',quantity:3,unit_cost:100,requestId:'00000000-0000-0000-0000-000000000035'});
assert.equal(result.ok,true,result.error);
const stockPr=result.data;
currentUser={id:'finance',role:'FINANCE_DIRECTOR',name:'Finance',business_unit_id:'ARAIA',global:true};
result=call('approval.decide',{id:stockPr.approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000036'});
assert.equal(result.ok,true,result.error);
currentUser={id:'ga',role:'GA_SUPERVISOR',name:'GA',business_unit_id:'DOTSIXTWOO',global:false};
result=call('order.create',{purchase_request_id:stockPr.id,requestId:'00000000-0000-0000-0000-000000000037'});
assert.equal(result.ok,true,result.error);
const po=result.data;
result=call('order.issue',{id:po.id,requestId:'00000000-0000-0000-0000-000000000038'});
assert.equal(result.ok,true,result.error);
result=call('order.receive',{id:po.id,location:'Gudang',requestId:'00000000-0000-0000-0000-000000000039'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.INVENTORY[0].quantity,71);
assert.equal(tables.INVENTORY_MOVEMENTS.at(-1).reference_id,po.id);
result=call('order.receive',{id:po.id,location:'Gudang',requestId:'00000000-0000-0000-0000-000000000039'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.INVENTORY[0].quantity,71,'PO receive retry must not add stock twice');
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('project.create',{name:'Lokasi Baru',client_name:'Brand A',business_unit_id:'DOTSIXTWOO',stage:'New Project',start_date:'2026-10-01',end_date:'2026-10-03',budget:500,site_latitude:-6.2,site_longitude:106.8,geofence_radius_m:200,requestId:'00000000-0000-0000-0000-000000000040'});
assert.equal(result.ok,true,result.error);
assert.equal(result.data.geofence_radius_m,200);
result=call('project.create',{name:'Lokasi Salah',client_name:'Brand A',business_unit_id:'DOTSIXTWOO',stage:'New Project',start_date:'2026-10-01',end_date:'2026-10-03',budget:500,site_latitude:95,site_longitude:106.8,geofence_radius_m:200,requestId:'00000000-0000-0000-0000-000000000041'});
assert.equal(result.ok,false,'invalid GPS coordinates rejected');
result=call('project.stage',{id:'p1',stage:'Project Settlement',requestId:'00000000-0000-0000-0000-000000000042'});
assert.equal(result.ok,true,result.error);
result=call('project.stage',{id:'p1',stage:'Project Closed',requestId:'00000000-0000-0000-0000-000000000043'});
assert.equal(result.ok,false,'open tasks block project closure');
currentUser={id:'designer',role:'DESIGNER_2D',name:'Desainer',business_unit_id:'DOTSIXTWOO',global:false};
result=call('task.update',{id:task.id,status:'Selesai',requestId:'00000000-0000-0000-0000-000000000044'});
assert.equal(result.ok,true,result.error);
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('project.stage',{id:'p1',stage:'Project Closed',requestId:'00000000-0000-0000-0000-000000000045'});
assert.equal(result.ok,true,result.error);
const workDetails={amount:120000,category:'Akomodasi',due_date:'2026-10-20',summary:'Biaya event perlu diperiksa.'};
result=call('work.create',{type:'budget_plan',title:'Rencana biaya roadshow',business_unit_id:'DOTSIXTWOO',subject_type:'PROJECT',subject_id:'p1',details:workDetails,requestId:'00000000-0000-0000-0000-000000000046'});
assert.equal(result.ok,true,result.error);
const work=result.data;
assert.equal(work.status,'Draft');
assert.equal(call('work.list',{type:'budget_plan'}).data.length,1);
result=call('work.update',{id:work.id,title:'Rencana biaya roadshow revisi',details:workDetails,version:2,requestId:'00000000-0000-0000-0000-000000000047'});
assert.equal(result.ok,false,'stale version rejected');
result=call('work.submit',{id:work.id,requestId:'00000000-0000-0000-0000-000000000048'});
assert.equal(result.ok,true,result.error);
assert.equal(tables.WORK_ITEMS[0].status,'Menunggu persetujuan');
result=call('work.complete',{id:work.id,requestId:'00000000-0000-0000-0000-000000000049'});
assert.equal(result.ok,false,'cannot bypass approval');
currentUser={id:'finance',role:'FINANCE_DIRECTOR',name:'Finance',business_unit_id:'ARAIA',global:true};
result=call('approval.decide',{id:tables.WORK_ITEMS[0].approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000050'});
assert.equal(result.ok,true,result.error);
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('work.complete',{id:work.id,requestId:'00000000-0000-0000-0000-000000000051'});
assert.equal(result.ok,true,result.error);
currentUser={id:'designer',role:'DESIGNER_2D',name:'Desainer',business_unit_id:'DOTSIXTWOO',global:false};
assert.equal(call('work.list',{type:'budget_plan'}).data.length,0,'designer cannot read budgets');
result=call('work.create',{type:'grievance',title:'Masalah kerja',business_unit_id:'DOTSIXTWOO',details:{category:'Jadwal',summary:'Perlu diskusi',due_date:'2026-10-30'},requestId:'00000000-0000-0000-0000-000000000052'});
assert.equal(result.ok,true,result.error);
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
assert.equal(call('work.list',{type:'grievance'}).data.length,0,'private grievance hidden from PM');
tables.ACCOUNTS.push({_row:2,id:'ac1',code:'1000',name:'Kas',type:'ASET',business_unit_id:'DOTSIXTWOO',status:'ACTIVE'},{_row:3,id:'ac2',code:'4000',name:'Pendapatan',type:'PENDAPATAN',business_unit_id:'DOTSIXTWOO',status:'ACTIVE'});
currentUser={id:'finance',role:'FINANCE_DIRECTOR',name:'Finance',business_unit_id:'ARAIA',global:true};
result=call('journal.create',{business_unit_id:'DOTSIXTWOO',entry_date:'2026-09-27',description:'Penerimaan jasa',reference:'BANK-100',lines:[{account_code:'1000',debit:50000,credit:0},{account_code:'4000',debit:0,credit:49999}],requestId:'00000000-0000-0000-0000-000000000053'});
assert.equal(result.ok,false,'unbalanced journal rejected');
result=call('journal.create',{business_unit_id:'DOTSIXTWOO',entry_date:'2026-09-27',description:'Penerimaan jasa',reference:'BANK-100',lines:[{account_code:'1000',debit:50000,credit:0},{account_code:'4000',debit:0,credit:50000}],requestId:'00000000-0000-0000-0000-000000000054'});
assert.equal(result.ok,true,result.error);
const journal=result.data;
assert.equal(call('ledger.summary',{business_unit_id:'DOTSIXTWOO'}).data.accounts.find(x=>x.code==='1000').balance,0,'draft excluded');
result=call('journal.submit',{id:journal.id,requestId:'00000000-0000-0000-0000-000000000055'});
assert.equal(result.ok,true,result.error);
currentUser={id:'finance',role:'FINANCE_DIRECTOR',name:'Finance',business_unit_id:'ARAIA',global:true};
assert.equal(call('approval.decide',{id:result.data.approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000056'}).ok,false,'journal maker cannot approve');
currentUser={id:'ceo',role:'CEO',name:'CEO',business_unit_id:'ARAIA',global:true};
assert.equal(call('approval.decide',{id:result.data.approval_id,decision:'Disetujui',requestId:'00000000-0000-0000-0000-000000000057'}).ok,true);
assert.equal(call('ledger.summary',{business_unit_id:'DOTSIXTWOO'}).data.accounts.find(x=>x.code==='1000').balance,50000);
result=call('journal.reverse',{id:journal.id,entry_date:'2026-09-27',reason:'Bukti salah',requestId:'00000000-0000-0000-0000-000000000058'});
assert.equal(result.ok,true,result.error);
assert.equal(call('ledger.summary',{business_unit_id:'DOTSIXTWOO'}).data.accounts.find(x=>x.code==='1000').balance,50000,'draft reversal excluded');
currentUser={id:'designer',role:'DESIGNER_2D',name:'Desainer',business_unit_id:'DOTSIXTWOO',global:false};
assert.equal(call('data.export',{dataset:'invoices'}).ok,false,'invoice export is finance-only');
assert.equal(call('data.export',{dataset:'attendance'}).ok,true);
assert.equal(call('data.search',{query:'Peach'}).data.some(x=>x.type==='Stok'),false,'stock search respects role');
currentUser={id:'finance',role:'FINANCE_DIRECTOR',name:'Finance',business_unit_id:'ARAIA',global:true};
assert.equal(call('data.export',{dataset:'journals',business_unit_id:'DOTSIXTWOO'}).data.rows.length,2);
ctx.digest_=text=>'hash:'+text;
tables.EMPLOYEES.push({_row:3,id:'e-designer',user_id:'designer',employee_code:'A-2',title:'Desainer',business_unit_id:'DOTSIXTWOO',status:'ACTIVE',nfc_tag_hash:''});
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
assert.equal(call('employee.nfcEnroll',{id:'e-designer',serial:'AB:CD:12:34',requestId:'00000000-0000-0000-0000-000000000059'}).ok,false,'PM cannot enroll NFC');
currentUser={id:'ceo',role:'CEO',name:'CEO',business_unit_id:'ARAIA',global:true};
result=call('employee.nfcEnroll',{id:'e-designer',serial:'AB:CD:12:34',requestId:'00000000-0000-0000-0000-000000000060'});
assert.equal(result.ok,true,result.error);
currentUser={id:'designer',role:'DESIGNER_2D',name:'Desainer',business_unit_id:'DOTSIXTWOO',global:false};
assert.equal(call('attendance.checkIn',{source:'OFFICE',requestId:'00000000-0000-0000-0000-000000000061'}).ok,false,'enrolled office check-in needs NFC');
result=call('attendance.checkIn',{source:'OFFICE',nfc_serial:'AB:CD:12:34',requestId:'00000000-0000-0000-0000-000000000062'});
assert.equal(result.ok,true,result.error);
const imported={dataset:'clients',business_unit_id:'DOTSIXTWOO',rows:[{company_name:'Brand Baru',industry:'FMCG',pic_name:'Rina',email:'rina@example.com',phone:'08120000'}]};
assert.equal(call('data.importPreview',imported).ok,false,'designer cannot import clients');
currentUser={id:'pm',role:'PM',name:'PM',business_unit_id:'DOTSIXTWOO',global:false};
result=call('data.importPreview',imported);assert.equal(result.ok,true,result.error);assert.equal(result.data.valid,1);
result=call('data.import',{...imported,requestId:'00000000-0000-0000-0000-000000000063'});
assert.equal(result.ok,true,result.error);assert.equal(result.data.imported,1);
assert.equal(call('data.import',{...imported,requestId:'00000000-0000-0000-0000-000000000063'}).ok,true,'idempotent import retry');
result=call('data.importPreview',imported);assert.equal(result.data.issues.length,1,'duplicate rejected on preview');
result=call('data.importPreview',{...imported,business_unit_id:'DIVI'});assert.equal(result.ok,false,'cross-unit import blocked');
currentUser={id:'ceo',role:'CEO',name:'CEO',business_unit_id:'ARAIA',global:true};
result=call('data.import',{dataset:'holidays',rows:[{date:'2026-12-25',name:'Libur kantor'}],requestId:'00000000-0000-0000-0000-000000000064'});
assert.equal(result.ok,true,result.error);assert.equal(tables.HOLIDAYS.length,1);
console.log('Backend integration passed: stock, RBAC, approvals, PR/PO, CRM, payroll preview, sales, tasks, stock count, billing, workflows, balanced ledger.');
