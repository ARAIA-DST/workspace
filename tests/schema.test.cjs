const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');

class Sheet {
  constructor(headers=[]) { this.headers=[...headers];this.frozen=0; }
  getLastRow(){return this.headers.length?1:0;}
  getLastColumn(){return this.headers.length;}
  setFrozenRows(n){this.frozen=n;}
  getRange(row,col,height,width){
    assert.equal(row,1);assert.equal(height,1);
    return {
      getValues:()=>[this.headers.slice(col-1,col-1+width)],
      setValues:values=>values[0].forEach((value,index)=>{this.headers[col-1+index]=value;}),
    };
  }
}
const book={
  sheets:new Map(),
  getSheetByName(name){return this.sheets.get(name)||null;},
  insertSheet(name){const sheet=new Sheet();this.sheets.set(name,sheet);return sheet;},
  getId(){return 'test-spreadsheet';},
};
const owner={_row:2,id:'owner',email:'ceo@example.com',username:'ceo',password_hash:'existing-hash',role:'CEO',business_unit_id:'ARAIA'};
const tables={BUSINESS_UNITS:[{id:'ARAIA'}],USERS:[owner],EMPLOYEES:[{id:'e1',user_id:'owner'}],ACCOUNTS:[]};
let nextId=1;
const props={BOOTSTRAP_USERNAME:'ceo',BOOTSTRAP_EMAIL:'ceo@example.com',SPREADSHEET_ID:'test-spreadsheet',PASSWORD_PEPPER:'test-pepper'};
const ctx=vm.createContext({
  SpreadsheetApp:{openById:()=>book},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]||'',setProperty:(key,value)=>{props[key]=value;},deleteProperty:key=>{delete props[key];}})},
  rows_:name=>tables[name]||[],
  append_:(name,row)=>{(tables[name] ||= []).push({...row,_row:tables[name].length+2});},
  update_:(name,row,patch)=>Object.assign(tables[name][row-2],patch),
  uuid_:()=>`id-${nextId++}`,
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','apps-script','Ledger.gs'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','apps-script','Auth.gs'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','apps-script','Setup.gs'),'utf8'),ctx);
const schema=ctx.SCHEMA_;
assert.equal(Object.keys(schema).length,45);
for(const [name,headers] of Object.entries(schema)){
  assert.equal(new Set(headers).size,headers.length,'duplicate column in '+name);
  if(['STOCK_COUNTS','INVOICES','PAYMENTS','WORK_ITEMS','WORK_ITEM_EVENTS','ACCOUNTS','JOURNALS','JOURNAL_LINES'].includes(name))continue;
  const old=name==='PURCHASE_REQUESTS'||name==='EMPLOYEES'?headers.slice(0,-1):name==='PURCHASE_ORDERS'?headers.slice(0,-5):name==='USERS'?headers.slice(0,-7):headers;
  book.sheets.set(name,new Sheet(old));
}
assert.equal(ctx.setupSystem_().tabs,45);
assert.equal(tables.ACCOUNTS.length,40,'ten starter accounts per business unit');
for(const [name,headers] of Object.entries(schema)){
  assert.deepEqual(book.sheets.get(name).headers,Array.from(headers),name+' migration');
  assert.equal(book.sheets.get(name).frozen,1);
}
assert.equal(ctx.setupSystem_().tabs,45,'setup is safe to rerun');
assert.equal(tables.ACCOUNTS.length,40,'rerun does not duplicate chart of accounts');
book.sheets.get('USERS').headers[0]='wrong';
assert.throws(()=>ctx.setupSystem_(),/Header tidak cocok: USERS/);
book.sheets.get('USERS').headers[0]='id';
owner.username='';owner.password_hash='';props.BOOTSTRAP_PASSWORD='new-bootstrap-passphrase';
ctx.passwordRecord_=(password)=>{assert.equal(password,'new-bootstrap-passphrase');return {password_salt:'salt',password_hash:'hash',must_change_password:true};};
ctx.setupSystem_();
assert.equal(owner.username,'ceo');
assert.equal(owner.password_hash,'hash');
assert.equal(owner.must_change_password,true);
assert.equal(props.BOOTSTRAP_PASSWORD,undefined,'bootstrap secret removed after migration');
console.log('Schema migration passed: old headers extended to 45 tabs and drift rejected.');
