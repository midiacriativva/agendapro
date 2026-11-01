import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
const root=resolve(import.meta.dirname,'..');
const bin=process.env.PB_BIN||resolve(root,process.platform==='win32'?'pocketbase.exe':'pocketbase');
function cli(args,env){const r=spawnSync(bin,args,{cwd:root,env:{...process.env,...env},encoding:'utf8'});assert.equal(r.status,0,((r.stderr||'')+(r.stdout||'')).replace(/https?:\/\/\S+\/_\/[^\s]*/g,'[setup URL hidden]'));return r;}
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
test('PocketBase 0.40.6: aprovação, concorrência, isolamento, visitas e privacidade',{timeout:180000},async t=>{
 const version=spawnSync(bin,['--version'],{encoding:'utf8'});assert.match(version.stdout,/0\.40\.6/);
 const data=await mkdtemp(join(tmpdir(),'agendapro-pb-test-')),p=await port(),base='http://127.0.0.1:'+p;
 const fixturePassword=randomBytes(24).toString('base64url'); // ephemeral test-only; never printed or included in deliverable credentials
 const adminEmail='admin@example.test',env={FRONTEND_ORIGIN:base};
 cli(['migrate','up','--dir='+data,'--migrationsDir='+join(root,'pb_migrations'),'--hooksDir='+join(root,'pb_hooks')],env);
 cli(['superuser','create',adminEmail,fixturePassword,'--dir='+data,'--hooksDir='+join(root,'pb_hooks'),'--migrationsDir='+join(root,'pb_migrations')],env);
 let logs='';const child=spawn(bin,['serve','--http=127.0.0.1:'+p,'--dir='+data,'--hooksDir='+join(root,'pb_hooks'),'--migrationsDir='+join(root,'pb_migrations'),'--publicDir='+join(root,'pb_public'),'--origins='+base,'--hooksWatch=false'],{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
 t.after(async()=>{child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r)});await rm(data,{recursive:true,force:true})});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw Error('Servidor não iniciou: '+logs.replaceAll(fixturePassword,'[redacted]'));}
 async function api(path,{method='GET',body,token,origin}={}){const res=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:token}:{}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined});let data;try{data=await res.json()}catch{data={}}return{status:res.status,data,headers:res.headers};}
 async function ok(path,options,status=200){const r=await api(path,options);assert.equal(r.status,status,JSON.stringify({path,result:r.data}));return r.data;}
 const admin=await ok('/api/collections/_superusers/auth-with-password',{method:'POST',body:{identity:adminEmail,password:fixturePassword}}),adminToken=admin.token;
 const ownerPolicy=await ok('/api/agendapro/policies/owner'),clientPolicy=await ok('/api/agendapro/policies/client');
 const request=async email=>ok('/api/agendapro/register',{method:'POST',body:{email,owner:'Dono fictício',business:'Negócio fictício',city:'Cidade fictícia',branch:'beauty',password:fixturePassword,consent:{accepted:true,version:ownerPolicy.version}}},201);
 const a=await request('owner-a@example.test'),b=await request('owner-b@example.test'),rejected=await request('rejected@example.test');
 const pending=await api('/api/collections/users/auth-with-password',{method:'POST',body:{identity:'owner-a@example.test',password:fixturePassword}});assert.ok(pending.status>=400,'Pendente não pode autenticar.');
 for(const r of [a,b])await ok('/api/agendapro/admin/businesses/'+r.id+'/decision',{method:'POST',token:adminToken,body:{decision:'approved',actor:'forged'}});
 await ok('/api/agendapro/admin/businesses/'+rejected.id+'/decision',{method:'POST',token:adminToken,body:{decision:'refused'}});
 assert.equal((await api('/api/agendapro/admin/businesses/'+a.id+'/decision',{method:'POST',token:adminToken,body:{decision:'approved'}})).status,409);
 const authA=await ok('/api/collections/users/auth-with-password',{method:'POST',body:{identity:'owner-a@example.test',password:fixturePassword}}),authB=await ok('/api/collections/users/auth-with-password',{method:'POST',body:{identity:'owner-b@example.test',password:fixturePassword}});
 const A=authA.token,B=authB.token;
 assert.ok((await api('/api/agendapro/admin/overview',{token:A})).status>=400);
 assert.ok((await api('/api/collections/businesses/records/'+b.id,{token:A})).status>=400);
 assert.ok((await api('/api/collections/businesses/records/'+a.id,{method:'PATCH',token:A,body:{status:'approved',owner:authB.record.id}})).status>=400);
 assert.ok((await api('/api/collections/users/records/'+authA.record.id,{method:'PATCH',token:A,body:{business:b.id}})).status>=400);
 const pro=await ok('/api/collections/professionals/records',{method:'POST',token:A,body:{business:a.id,name:'Profissional fictício',whatsapp:'',working_hours:{start:'08:00',end:'18:00',days:[0,1,2,3,4,5,6]}}},200);
 const service=await ok('/api/collections/services/records',{method:'POST',token:A,body:{business:a.id,name:'Serviço fictício',duration_minutes:60,price_cents:10000,professional_ids:[pro.id]}},200);
 const state=await ok('/api/agendapro/owner/state',{token:A});assert.equal(state.professionals.length,1);assert.equal(state.services.length,1);assert.equal(state.demo,false);

 const editable=await ok('/api/agendapro/owner/state',{token:A});editable.name='Nome atualizado no servidor';await ok('/api/agendapro/owner/state',{method:'PUT',token:A,body:{revision:editable.revision,state:editable}});assert.equal((await ok('/api/agendapro/owner/state',{token:A})).name,'Nome atualizado no servidor');
 const badSync=await ok('/api/agendapro/owner/state',{token:B});badSync.professionals=[{...editable.professionals[0]}];assert.ok((await api('/api/agendapro/owner/state',{method:'PUT',token:B,body:{revision:badSync.revision,state:badSync}})).status>=400);
 const otherList=await ok('/api/collections/professionals/records',{token:B});assert.equal(otherList.items.length,0);
 assert.ok((await api('/api/collections/services/records',{method:'POST',token:B,body:{business:b.id,name:'Invasão',duration_minutes:60,price_cents:5000,professional_ids:[pro.id]}})).status>=400);
 const pub=await ok('/api/agendapro/public/'+state.slug);assert.equal(pub.services.length,1);assert.equal(pub.appointments.length,0);assert.equal(pub.owner,undefined);
 const rejectedBusiness=await ok('/api/collections/businesses/records/'+rejected.id,{token:adminToken});assert.equal((await api('/api/agendapro/public/'+rejectedBusiness.slug)).status,404);
 const future=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 const booking={business:a.id,professional:pro.id,service:service.id,date:future,start_time:'10:00',end_time:'23:59',client_name:'Cliente fictício',client_phone:'11900000000',consent_accepted:true,consent_policy_version:clientPolicy.version,status:'attended',source:'declared',final_price_cents:1};
 const invalidConsent=await api('/api/collections/bookings/records',{method:'POST',body:{...booking,consent_accepted:false}});assert.ok(invalidConsent.status>=400);
 const races=await Promise.all(Array.from({length:8},()=>api('/api/collections/bookings/records',{method:'POST',body:booking})));assert.equal(races.filter(r=>r.status===200).length,1,JSON.stringify(races.map(r=>r.data)));
 for(const r of races.filter(r=>r.status!==200))assert.match(r.data.message,/Horário ocupado/);
 const created=races.find(r=>r.status===200).data;assert.equal(created.end_time,'11:00');assert.equal(created.status,'scheduled');assert.equal(created.source,'verified');assert.equal(created.final_price_cents,10000);assert.equal(created.consent_policy_version,clientPolicy.version);assert.ok(created.consent_accepted_at);
 assert.equal((await ok('/api/collections/bookings/records')).items.length,0);assert.ok((await api('/api/collections/bookings/records/'+created.id)).status>=400);assert.equal((await ok('/api/collections/bookings/records',{token:B})).items.length,0);
 assert.ok((await api('/api/collections/bookings/records/'+created.id,{method:'PATCH',token:B,body:{status:'attended'}})).status>=400);
 const after=await ok('/api/agendapro/owner/state',{token:A});assert.equal(after.appointments.length,1);assert.ok(after.revision>state.revision);
 const stale=await api('/api/agendapro/owner/state',{method:'PUT',token:A,body:{revision:state.revision,state}});assert.equal(stale.status,409);
 await ok('/api/collections/bookings/records/'+created.id,{method:'PATCH',token:A,body:{status:'attended',reviewed_by:authB.record.id,reviewed_at:'2000-01-01 00:00:00Z'}});
 const reviewed=await ok('/api/collections/bookings/records/'+created.id,{token:A});assert.equal(reviewed.reviewed_by,authA.record.id);assert.notEqual(reviewed.reviewed_at,'2000-01-01 00:00:00.000Z');
 const money=await ok('/api/agendapro/owner/revenue?month='+future.slice(0,7),{token:A});assert.equal(money.verified,100);assert.equal(money.declared,0);
 const audits=await ok('/api/collections/audit_log/records?filter='+encodeURIComponent('entity_id="'+created.id+'"'),{token:A});assert.ok(audits.items.some(x=>x.actor==='users:'+authA.record.id));assert.ok(!JSON.stringify(audits).includes('11900000000'));
 assert.ok((await api('/api/collections/audit_log/records',{method:'POST',token:A,body:{business:a.id,entity:'bookings',entity_id:created.id,action:'forged',actor:'forged'}})).status>=400);
 await ok('/api/collections/visits/records',{method:'POST',body:{page:'home',visited_at:'2000-01-01',anonymous_session:randomUUID(),ip:'not-stored'}},200);
 await ok('/api/collections/visits/records',{method:'POST',body:{page:'demo',anonymous_session:randomUUID()}},200);
 assert.ok((await api('/api/collections/visits/records',{token:A})).status>=400);assert.ok((await api('/api/collections/visits/records')).status>=400);
 const overview=await ok('/api/agendapro/admin/overview',{token:adminToken});assert.equal(overview.counts.approved,2);assert.equal(overview.counts.refused,1);assert.equal(overview.visits.reduce((s,v)=>s+v.visits,0),2);assert.ok(overview.decisions.every(d=>d.actor==='_superusers:'+admin.record.id));
 const visits=await ok('/api/collections/visits/records',{token:adminToken});assert.ok(visits.items.every(v=>!('ip' in v)&&!('email' in v)));assert.ok(!visits.items[0].visited_at.startsWith('2000'));
 const evil=await api('/api/collections/visits/records',{method:'POST',origin:'https://evil.example',body:{page:'home',anonymous_session:randomUUID()}});assert.equal(evil.status,403);
 const clients=await ok('/api/agendapro/owner/clients',{token:A});assert.equal(clients.length,1);await ok('/api/agendapro/owner/clients/'+created.id,{method:'DELETE',token:A,body:{confirm:true}});const erased=await ok('/api/collections/bookings/records/'+created.id,{token:A});assert.equal(erased.client_name,'');assert.equal(erased.client_phone,'');assert.equal(erased.is_anonymized,true);assert.equal((await ok('/api/agendapro/owner/revenue?month='+future.slice(0,7),{token:A})).verified,100);

 const availability=await ok('/api/agendapro/public/'+state.slug+'/availability?'+new URLSearchParams({service:service.id,pro:pro.id,date:future}));assert.ok(!availability.slots.includes('10:00'));
 const tooLate=await api('/api/collections/bookings/records',{method:'POST',body:{...booking,start_time:'17:30'}});assert.ok(tooLate.status>=400);assert.match(tooLate.data.message,/jornada|duração/);
 const png=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5kcAAAAASUVORK5CYII=','base64')],{type:'image/png'}),form=new FormData();form.set('photo',png,'test.png');const upload=await fetch(base+'/api/collections/professionals/records/'+pro.id,{method:'PATCH',headers:{Authorization:A},body:form});assert.equal(upload.status,200);const uploaded=await upload.json();assert.ok(uploaded.photo);assert.equal((await fetch(base+'/api/agendapro/photos/'+pro.id)).status,200);assert.ok((await fetch(base+'/api/files/'+uploaded.collectionId+'/'+pro.id+'/'+uploaded.photo)).status>=400);
 const access=await ok('/api/collections/access_log/records',{token:A});assert.equal(access.items.length,1);
 // Seed reads only credentials supplied to this disposable test process.
 const seed=spawnSync(process.execPath,['scripts/seed.mjs'],{cwd:root,env:{...process.env,PB_URL:base,PB_ADMIN_EMAIL:adminEmail,PB_ADMIN_PASSWORD:fixturePassword},encoding:'utf8'});assert.equal(seed.status,0,seed.stderr+seed.stdout);
 const demoSession=randomUUID(),demo=await ok('/api/agendapro/demo/open',{method:'POST',body:{session:demoSession,branch:'beauty'}});assert.equal(demo.demo,true);assert.equal(demo.professionals.length,3);assert.equal((await ok('/api/agendapro/admin/overview',{token:adminToken})).counts.approved,2);
 demo.name='Demonstração persistida no PocketBase';const demoSaved=await ok('/api/agendapro/demo/state',{method:'PUT',body:{session:demoSession,state:demo}});assert.equal(demoSaved.name,demo.name);const resume=await ok('/api/agendapro/demo/open',{method:'POST',body:{session:demoSession,branch:'beauty'}});assert.equal(resume.name,demo.name);assert.equal(resume.revision,demoSaved.revision);
 const session2=await ok('/api/agendapro/demo/open',{method:'POST',body:{session:randomUUID(),branch:'barber'}});assert.equal(session2.branch,'barber');assert.notEqual(session2.name,demo.name);
 let limited=false;for(let i=0;i<10;i++){const r=await api('/api/collections/users/auth-with-password',{method:'POST',body:{identity:'owner-a@example.test',password:'invalid-test-only'}});if(r.status===429){limited=true;break;}}assert.equal(limited,true,'Rate limit de login deve atuar.');
 console.log('Aprovação, recusa, 8 reservas concorrentes (1 salva), isolamento de dois donos, visitas anônimas, auditoria, privacidade, seed e rate limit: aprovados.');
});
