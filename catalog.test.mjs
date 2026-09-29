import assert from 'node:assert/strict';
import {MODULE_CATALOG} from '../frontend/module-catalog.js';
import {WORKFLOW_TYPES} from '../frontend/workflow-catalog.js';
import {canQueue} from '../frontend/offline.js';
assert.equal(MODULE_CATALOG.length,150);
assert.deepEqual(Object.fromEntries(['HRIS','ERP','CRM','SHARED'].map(area=>[area,MODULE_CATALOG.filter(x=>x.area===area).length])),{HRIS:30,ERP:45,CRM:45,SHARED:30});
assert.equal(new Set(WORKFLOW_TYPES.map(x=>x.id)).size,60);
for(const item of MODULE_CATALOG){if(item.route.startsWith('work:'))assert.ok(WORKFLOW_TYPES.some(type=>type.id===item.route.slice(5)),item.id+' missing workflow');}
assert.equal(canQueue('attendance.checkIn',{source:'FIELD'}),false,'field photos stay online');
assert.equal(canQueue('attendance.checkIn',{source:'OFFICE'}),true);
assert.equal(canQueue('payment.record',{}),false,'financial writes stay online');
console.log('Catalog passed: all 150 entries link to known screens/workflows; offline safety checked.');
