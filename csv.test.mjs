import assert from 'node:assert/strict';
import {parseCsv} from '../frontend/csv.js';
const fields=['company_name','industry','pic_name','email','phone'];
const content='\uFEFFcompany_name,industry,pic_name,email,phone\r\n"Brand, Baru",FMCG,"Rina ""PIC""",rina@example.com,08123\r\n';
assert.deepEqual(parseCsv(content,fields),[{company_name:'Brand, Baru',industry:'FMCG',pic_name:'Rina "PIC"',email:'rina@example.com',phone:'08123'}]);
assert.throws(()=>parseCsv('email,name\nexample.com,X',fields),/Kolom CSV/);
assert.throws(()=>parseCsv('company_name,industry,pic_name,email,phone\n"Unclosed,FMCG,Rina,rina@example.com,08',fields),/kutip/);
assert.throws(()=>parseCsv('company_name,industry,pic_name,email,phone\nA,B,C,D',fields),/baris 2/);
console.log('CSV parser passed: quoted commas, escaped quotes, header and row validation.');
