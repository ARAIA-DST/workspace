export const UNITS = [
  { id: 'ARAIA', name: 'ARAIA Group', color: '#111111' },
  { id: 'DOTSIXTWOO', name: 'DOTSIXTWOO', color: '#F4C844' },
  { id: 'DIVI', name: 'Divi Srikandi Berkarya', color: '#E9A9C3' },
  { id: 'AXLR8', name: 'AXLR8', color: '#A5AAB3' },
];

export const ROLE_LABELS = {
  CEO: 'CEO', CORSEC_DIRECTOR: 'Corporate Secretary Director', FINANCE_DIRECTOR: 'Finance Director',
  CREATIVE_DIRECTOR: 'Event & Creative Director', SENIOR_PM: 'Senior PM', PM: 'Project Manager',
  TALENT_MANAGER: 'Talent Manager', TALENT_OFFICER: 'Talent Officer', PAM: 'Project Account Manager',
  GA_SUPERVISOR: 'General Affair Supervisor', RUNNER: 'Runner', ADMIN_CORSEC: 'Admin Corsec',
  DESIGNER_3D: '3D Designer', DESIGNER_2D: '2D Designer', ADMIN_PROJECT: 'Admin Project Support',
  TALENT_PROJECT: 'Talent Project Support', PERMITTER: 'Permitter', LOGISTICS: 'Logistics', TAX: 'Tax',
};

// Petunjuk tampilan saja. Backend memiliki daftar izin otoritatif sendiri.
export const ROLE_PERMISSIONS = {
  CEO: ['projects', 'tasks', 'attendance', 'inventory', 'leads', 'approvals'],
  CORSEC_DIRECTOR: ['projects', 'tasks', 'attendance', 'approvals'],
  FINANCE_DIRECTOR: ['projects', 'attendance', 'approvals'],
  CREATIVE_DIRECTOR: ['projects', 'tasks', 'attendance', 'approvals'],
  SENIOR_PM: ['projects', 'tasks', 'attendance', 'approvals'],
  PM: ['projects', 'tasks', 'attendance', 'leads'],
  TALENT_MANAGER: ['projects', 'tasks', 'attendance'],
  TALENT_OFFICER: ['tasks', 'attendance'],
  PAM: ['projects', 'tasks', 'attendance', 'leads'],
  GA_SUPERVISOR: ['attendance', 'inventory', 'approvals'],
  RUNNER: ['tasks', 'attendance', 'inventory'],
  ADMIN_CORSEC: ['projects', 'tasks', 'attendance'],
  DESIGNER_3D: ['tasks', 'attendance'], DESIGNER_2D: ['tasks', 'attendance'],
  ADMIN_PROJECT: ['projects', 'tasks', 'attendance', 'leads'],
  TALENT_PROJECT: ['tasks', 'attendance'], PERMITTER: ['projects', 'tasks', 'attendance'],
  LOGISTICS: ['attendance', 'inventory'], TAX: ['projects', 'attendance'],
};

Object.keys(ROLE_PERMISSIONS).forEach(role => ROLE_PERMISSIONS[role].push('people','tasks','money','approvals'));
['CEO','FINANCE_DIRECTOR','CREATIVE_DIRECTOR','SENIOR_PM','PM','PAM','TALENT_MANAGER','GA_SUPERVISOR'].forEach(role => ROLE_PERMISSIONS[role].push('reports'));
ROLE_PERMISSIONS.CORSEC_DIRECTOR.push('reports');
['SENIOR_PM','CREATIVE_DIRECTOR'].forEach(role => ROLE_PERMISSIONS[role].push('leads'));
['CEO','FINANCE_DIRECTOR','PM','PAM','ADMIN_PROJECT','LOGISTICS','GA_SUPERVISOR'].forEach(role => ROLE_PERMISSIONS[role].push('sales'));

export const WRITE_PERMISSIONS = {
  projects: ['CEO', 'CREATIVE_DIRECTOR', 'SENIOR_PM', 'PM', 'PAM', 'ADMIN_PROJECT'],
  tasks: ['CEO', 'CREATIVE_DIRECTOR', 'SENIOR_PM', 'PM', 'TALENT_MANAGER', 'PAM', 'ADMIN_PROJECT', 'PERMITTER'],
  inventory: ['CEO', 'GA_SUPERVISOR', 'LOGISTICS', 'RUNNER'],
  leads: ['CEO', 'PAM', 'PM', 'ADMIN_PROJECT'],
  approvals: ['CEO', 'CORSEC_DIRECTOR', 'FINANCE_DIRECTOR', 'CREATIVE_DIRECTOR', 'SENIOR_PM', 'GA_SUPERVISOR'],
};
Object.assign(WRITE_PERMISSIONS, {
  people: ['CEO','CORSEC_DIRECTOR'],
  talent: ['CEO','SENIOR_PM','TALENT_MANAGER','TALENT_OFFICER'],
  shifts: ['CEO','SENIOR_PM','PM','TALENT_MANAGER','TALENT_OFFICER'],
  expenses: ['CEO','FINANCE_DIRECTOR','SENIOR_PM','PM','ADMIN_PROJECT'],
  purchasing: ['CEO','FINANCE_DIRECTOR','SENIOR_PM','PM','GA_SUPERVISOR','ADMIN_PROJECT'],
  vendors: ['CEO','FINANCE_DIRECTOR','GA_SUPERVISOR','ADMIN_PROJECT'],
  clients: ['CEO','PAM','PM','SENIOR_PM','ADMIN_PROJECT'],
  opportunities: ['CEO','PAM','PM','SENIOR_PM','ADMIN_PROJECT'],
  quotes: ['CEO','PAM','PM','SENIOR_PM','ADMIN_PROJECT'],
  activities: ['CEO','PAM','PM','SENIOR_PM','ADMIN_PROJECT'],
  assets: ['CEO','GA_SUPERVISOR','LOGISTICS'],
  sales: ['CEO','PM','PAM','ADMIN_PROJECT'],
  invoices: ['CEO','FINANCE_DIRECTOR','ADMIN_PROJECT'],
  payments: ['CEO','FINANCE_DIRECTOR'],
});

export function seedData() {
  const d = new Date().toISOString();
  return {
    projects: [
      { id: 'P-101', name: 'Synchronize Festival', client_name: 'Kratingdaeng', business_unit_id: 'DOTSIXTWOO', stage: 'On-Event Execution', start_date: '2026-09-20', end_date: '2026-10-02', owner_user_id: 'demo', budget: 485000000 },
      { id: 'P-102', name: 'Brand Experience Jakarta', client_name: 'Klien Nasional', business_unit_id: 'DIVI', stage: 'In-Progress', start_date: '2026-10-03', end_date: '2026-10-24', owner_user_id: 'demo', budget: 180000000 },
      { id: 'P-103', name: 'Roadshow Retail', client_name: 'Mitra Retail', business_unit_id: 'AXLR8', stage: 'Pitching', start_date: '2026-11-01', end_date: '2026-11-20', owner_user_id: 'demo', budget: 225000000 },
    ],
    tasks: [
      { id: 'T-1', project_id: 'P-101', title: 'Cek kesiapan tim venue', assignee_user_id: 'demo', due_date: '2026-09-27', status: 'Dikerjakan' },
      { id: 'T-2', project_id: 'P-101', title: 'Pastikan stok booth utama', assignee_user_id: 'demo', due_date: '2026-09-28', status: 'Belum mulai' },
      { id: 'T-3', project_id: 'P-102', title: 'Finalisasi materi desain', assignee_user_id: 'demo', due_date: '2026-10-02', status: 'Belum mulai' },
    ],
    attendance: [],
    inventory: [
      { id: 'I-1', sku: 'KTD-PEACH', item_name: 'KTD Peach Tea', business_unit_id: 'DOTSIXTWOO', location: 'Gudang Utama', quantity: 340, unit: 'pcs', updated_at: d },
      { id: 'I-2', sku: 'KTD-PEACH', item_name: 'KTD Peach Tea', business_unit_id: 'DOTSIXTWOO', location: 'Main Booth', quantity: 90, unit: 'pcs', updated_at: d },
      { id: 'I-3', sku: 'KTD-CLASSIC', item_name: 'KTD Classic', business_unit_id: 'DOTSIXTWOO', location: 'Gudang Utama', quantity: 220, unit: 'pcs', updated_at: d },
    ],
    movements: [], stock_counts: [],
    leads: [
      { id: 'L-1', company_name: 'Brand Nusantara', contact_name: 'Tim Marketing', contact_email: 'marketing@example.com', business_unit_id: 'DOTSIXTWOO', stage: 'Brief diterima', created_at: d },
    ],
    approvals: [
      { id: 'A-1', title: 'Permintaan perlengkapan event', type: 'Operasional', business_unit_id: 'DOTSIXTWOO', approver_role: 'SENIOR_PM', status: 'Menunggu', requester_user_id: 'requester-1', created_at: d },
    ],
    employees: [
      {id:'E-1',user_id:'demo',name:'Mimo',email:'mimo@example.com',role:'PM',employee_code:'ARAIA-001',title:'Project Manager',business_unit_id:'DOTSIXTWOO',join_date:'2021-01-01',employment_type:'Internal',status:'ACTIVE',weekend_rate:450000,phone:''},
      {id:'E-2',user_id:'staff-1',name:'Widya',email:'widya@example.com',role:'TALENT_PROJECT',employee_code:'ARAIA-002',title:'Talent Project Support',business_unit_id:'DOTSIXTWOO',join_date:'2024-05-10',employment_type:'Internal',status:'ACTIVE',weekend_rate:300000,phone:''},
    ],
    talents: [{id:'TL-1',full_name:'Rani Putri',phone:'081200000001',skill:'SPG Event',city:'Jakarta',daily_rate:450000,business_unit_id:'DOTSIXTWOO',status:'ACTIVE',created_at:d}],
    deployments: [], leaves: [], shifts: [], timesheets: [], reimbursements: [],
    vendors: [{id:'V-1',name:'Budi Printing',email:'vendor@example.com',phone:'081200000002',business_unit_id:'DOTSIXTWOO',status:'ACTIVE',created_at:d}],
    purchases: [], orders: [], expenses: [],
    clients: [{id:'C-1',company_name:'Kratingdaeng',industry:'Minuman',pic_name:'Tim Brand',email:'brand@example.com',phone:'081200000003',business_unit_id:'DOTSIXTWOO',created_at:d}],
    opportunities: [{id:'O-1',client_id:'C-1',name:'Roadshow 2027',value:750000000,stage:'Pitching',expected_date:'2026-10-30',business_unit_id:'DOTSIXTWOO',created_at:d}],
    work_items: [],
    accounts: UNITS.flatMap(u=>[['1000','Kas dan bank','ASET'],['1100','Piutang','ASET'],['2000','Utang','LIABILITAS'],['4000','Pendapatan','PENDAPATAN'],['5000','Biaya','BEBAN']].map(([code,name,type])=>({id:`${u.id}-${code}`,code,name,type,business_unit_id:u.id,status:'ACTIVE'}))),journals:[],ledger:null,
    quotations: [], activities: [], assets: [], notifications: [], meetings: [], moms: [], documents: [], sales: [], sales_lines: [], invoices: [], payments: [], audits: [],
  };
}
