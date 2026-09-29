const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const dir=path.join(__dirname,'..','apps-script');
const rows={USERS:[],SESSIONS:[],REQUESTS:[],LOGS:[]};
const props={PASSWORD_PEPPER:'server-side-test-pepper'};
const bytes=value=>Buffer.from(typeof value==='string'?value:value.map(n=>n&255));
const signed=value=>[...value].map(n=>n>127?n-256:n);
const ctx=vm.createContext({
  Date,JSON,Math,
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]||''})},
  LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
  SpreadsheetApp:{flush:()=>{}},
  Utilities:{DigestAlgorithm:{SHA_256:'SHA256'},newBlob:value=>({getBytes:()=>signed(Buffer.from(value))}),computeHmacSha256Signature:(value,key)=>signed(crypto.createHmac('sha256',bytes(key)).update(bytes(value)).digest()),computeDigest:(algo,value)=>signed(crypto.createHash('sha256').update(value).digest())},
  rows_:name=>rows[name]||[],
  append_:(name,row)=>{const record={...row,_row:rows[name].length+2};rows[name].push(record);return record;},
  update_:(name,row,patch)=>Object.assign(rows[name][row-2],patch),
  uuid_:()=>crypto.randomUUID(),
  now_:()=>new Date().toISOString(),
  log_:(user,action,entity,id)=>rows.LOGS.push({user:user.id,action,entity,id}),
});
for(const name of ['Auth.gs','Code.gs'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),ctx,{filename:name});
const ceo={id:'ceo',username:'admin',name:'CEO',role:'CEO',business_unit_id:'ARAIA',status:'ACTIVE',email:'ceo@example.test',_row:2,...ctx.passwordRecord_('initial-passphrase-123')};
const staff={id:'staff',username:'staff',name:'Staf',role:'PM',business_unit_id:'DOTSIXTWOO',status:'ACTIVE',email:'staff@example.test',_row:3,...ctx.passwordRecord_('staff-passphrase-123')};
rows.USERS.push(ceo,staff);
const call=(action,payload={},token='')=>ctx.apiDispatch({action,payload,token});
let result=call('auth.login',{username:'ADMIN',password:'initial-passphrase-123'});
assert.equal(result.ok,true,result.error);
const token=result.data.token;
assert.equal(result.data.user.must_change_password,true);
assert.equal(rows.SESSIONS.length,1);
assert.notEqual(rows.SESSIONS[0].token_hash,token);
assert.equal(call('app.bootstrap',{},token).ok,false,'temporary password cannot access business data');
assert.equal(call('auth.session',{},token).data.must_change_password,true);
assert.equal(call('auth.changePassword',{currentPassword:'bad',newPassword:'new-passphrase-123'},token).ok,false);
result=call('auth.changePassword',{currentPassword:'initial-passphrase-123',newPassword:'new-passphrase-123'},token);
assert.equal(result.ok,true,result.error);
assert.equal(call('auth.session',{},token).data.must_change_password,false);
assert.equal(call('auth.login',{username:'admin',password:'initial-passphrase-123'}).ok,false);
result=call('auth.login',{username:'admin',password:'new-passphrase-123'});
assert.equal(result.ok,true,result.error);
const adminToken=result.data.token;
const staffToken=call('auth.login',{username:'staff',password:'staff-passphrase-123'}).data.token;
const requestId=crypto.randomUUID();
result=call('auth.resetPassword',{user_id:'staff',requestId},adminToken);
assert.equal(result.ok,true,result.error);
assert.equal(result.data.temporary_password.length,32);
assert.equal(rows.REQUESTS.length,1);
assert.equal(rows.REQUESTS[0].result_json.includes(result.data.temporary_password),false,'temporary password not persisted in request log');
assert.equal(call('auth.session',{},staffToken).ok,false,'reset revokes prior sessions');
assert.equal(call('auth.login',{username:'staff',password:'staff-passphrase-123'}).ok,false);
const retry=call('auth.resetPassword',{user_id:'staff',requestId},adminToken);
assert.equal(retry.ok,true);
assert.equal(retry.data.temporary_password,undefined);
assert.equal(retry.data.credentialAlreadyIssued,true);
const newStaff=call('auth.login',{username:'staff',password:result.data.temporary_password});
assert.equal(newStaff.ok,true,newStaff.error);
assert.equal(newStaff.data.user.must_change_password,true);
for(let i=0;i<5;i++)assert.equal(call('auth.login',{username:'staff',password:'wrong-passphrase'}).ok,false);
assert.ok(Date.parse(staff.locked_until)>Date.now());
assert.equal(call('auth.login',{username:'staff',password:result.data.temporary_password}).ok,false,'locked account must remain locked temporarily');
assert.equal(call('auth.resetPassword',{user_id:'ceo',requestId:crypto.randomUUID()},adminToken).ok,false,'self reset must be denied');
console.log('Auth integration passed: login, first password change, reset, session revocation, lockout, one-time secret handling.');
