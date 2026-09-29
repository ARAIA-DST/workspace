"""Map every named brief item to a working screen or an explicit external dependency."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
brief = (ROOT.parent / 'upload/Pasted text(2).txt').read_text()
routes = {
    'HRIS': '''people:employees work:recruitment work:onboarding attendance people:shifts work:workforce_plan work:manpower_request people:talent people:talent people:employees money:payroll work:benefit people:leave work:kpi work:learning work:employee_contract projects:documents work:discipline work:grievance money:reimbursement inventory:assets work:clearance reports work:talent_rating money:payroll work:pjp attendance people:timesheet reports reports'''.split(),
    'ERP': '''projects tasks work:milestone work:budget_plan work:project_costing money:ledger money:ledger work:payable money:invoices work:cash_plan work:budget_plan reports money:purchases money:purchases work:rfq money:purchases money:vendors work:vendor_evaluation inventory inventory inventory inventory:stock_counts inventory:assets work:shipment work:shipment money:purchases money:expenses work:project_contract projects:documents approvals work:risk work:event_runbook work:project_costing sales money:invoices money:invoices work:tax_register work:bank_reconciliation home projects projects work:project_settlement reports reports reports'''.split(),
    'CRM': '''leads:leads leads:leads leads:clients leads:clients leads:clients work:contact work:decision_maker leads:opportunities leads:opportunities work:revenue_forecast leads:activities leads:activities projects:meetings projects:moms work:brief work:rfp_client work:pitch work:proposal leads:quotes leads:quotes work:negotiation leads:opportunities work:client_agreement sales work:communication work:communication work:complaint work:service_case work:client_survey work:client_feedback work:retention work:repeat_order work:account_review work:account_review work:campaign work:marketing_activity work:lead_source reports work:win_loss work:revenue_forecast reports reports projects:documents reports reports'''.split(),
    'SHARED': '''people:employees work:governance home people:employees work:governance people:employees leads:clients money:vendors projects inventory home approvals work:governance reports projects:documents projects:documents external:signature reports import work:integration_request offline home external:backup work:system_change home projects home external:email external:whatsapp catalog'''.split(),
}
pattern={'HRIS':r'HRIS \([^\n]*', 'ERP':r'ERP \([^\n]*', 'CRM':r'CRM \([^\n]*', 'SHARED':r'SHARED SYSTEM / CROSS-PLATFORM MODULES'}
items=[]
for group,heading in pattern.items():
    match=re.search(r'--- '+heading+r' ---\s*(.*?)(?=\n--- |\n={10,}|\Z)',brief,re.S)
    assert match,group
    names=[x.strip().rstrip('.') for x in re.findall(r'\b\d+\.\s*([^|\n]+)',match.group(1))]
    assert len(names)==len(routes[group]),(group,len(names),len(routes[group]))
    for number,(name,route) in enumerate(zip(names,routes[group]),1):
        items.append({'id':f'{group}-{number:02d}','area':group,'name':name,'route':route,
                      'coverage':'Layanan eksternal' if route.startswith('external:') else 'Alur kerja' if route.startswith('work:') else 'Layar utama'})
assert len(items)==150
encoded=json.dumps(items,ensure_ascii=False,separators=(',',':'))
(ROOT/'frontend/module-catalog.js').write_text('export const MODULE_CATALOG = '+encoded+';\n')
lines=['# Peta 150 kebutuhan pada brief','',
       'Peta ini menunjukkan pintu masuk yang relevan. Beberapa nama modul berbagi satu alur kerja; label **Layar utama** bukan klaim bahwa semua proses enterprise pada nama tersebut sudah otomatis. **Alur kerja** menyimpan catatan bertipe dengan status, PIC, persetujuan, dan jejak aktivitas. **Layanan eksternal** membutuhkan penyedia dan konfigurasi terpisah.','',
       '| Area | No. | Kebutuhan | Pintu masuk | Cakupan |','| --- | ---: | --- | --- | --- |']
for item in items:
    lines.append(f"| {item['area']} | {int(item['id'].split('-')[1])} | {item['name']} | `{item['route']}` | {item['coverage']} |")
(ROOT/'docs/MODULE_MAP.md').write_text('\n'.join(lines)+'\n')
print(f'{len(items)} named requirements mapped')
