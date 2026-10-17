import {onCall} from 'firebase-functions/v2/https';
import {Timestamp} from 'firebase-admin/firestore';
import {randomBytes,randomUUID} from 'node:crypto';
import {authorize,localDatabase,safeId,deny} from './authorization.mjs';
import {customerPayload,invoicePayload,accountingScenarios,retryDelay,safeMoney} from './shared/accountingModel.js';
import {fingerprint,mockRealm,emptyMock,sendMock} from './quickbooksMock.mjs';
const callable=fn=>onCall({region:'us-central1',timeoutSeconds:30,maxInstances:2},fn);
const schema='phase3g-v1';
const text=(v,max=500)=>{if(typeof v!=='string'||!v.trim()||v.length>max)deny('invalid-argument','Valid text is required.');return v.trim();};
async function list(tx,q){const r=await tx.get(q.limit(501));if(r.size>500)deny('resource-exhausted','Accounting view exceeds the local limit; pagination required.');return r.docs.map(d=>({...d.data(),id:d.id}));}
function supported(d,cid){if(d&&(d.schema!==schema||d.companyId!==cid))deny('failed-precondition','Unsupported accounting state; no migration is permitted.');}
function eligible(i,cid){return i?.companyId===cid&&i.financialSchema==='phase3e-v1'&&i.kind==='invoice'&&!i.archived&&['issued','partially_paid','paid'].includes(i.status)&&i.version>0;}
const accountPermission=action=>['beginConnect','completeConnect','disconnect'].includes(action)?'accounting.connect':action==='configure'?'accounting.configure':action==='simulatePayment'?'accounting.reconcile':'accounting.sync';
export const accountingView=callable(async request=>{const db=localDatabase();return db.runTransaction(async tx=>{
 const s=await authorize(db,request,tx,'accounting.read'),root=s.root;
 const c=await tx.get(root.collection('qboConnections').doc('main'));supported(c.data(),s.cid);
 const jobs=await list(tx,root.collection('qboJobs')),mappings=await list(tx,root.collection('qboMappings')),events=await list(tx,root.collection('qboAudit'));
 const customers=s.can('directory.read')?await list(tx,root.collection('customers')):[],invoices=s.can('invoice.read')?await list(tx,root.collection('invoices')):[],reconciliations=s.can('invoice.read')?await list(tx,root.collection('qboReconciliations')):[];
 const connection=c.data(),now=Date.now(),credential=await tx.get(root.collection('qboPrivate').doc('credentials'));const expired=connection?.status==='connected'&&(!credential.exists||credential.data().status!=='valid'||credential.data().refreshExpiresAtMs<=now);return {mockOnly:true,now,connection:connection?{status:expired?'auth_required':connection.status,accessExpiresAtMs:credential.data()?.accessExpiresAtMs||null,refreshExpiresAtMs:credential.data()?.refreshExpiresAtMs||null,realm:connection.realm,companyName:connection.companyName,revision:connection.revision,lastSuccessAtMs:connection.lastSuccessAtMs||null,connectedAtMs:connection.connectedAtMs||null,mapping:connection.mapping||null}:null,permissions:{connect:s.can('accounting.connect'),configure:s.can('accounting.configure'),sync:s.can('accounting.sync'),reconcile:s.can('accounting.reconcile')&&s.can('invoice.read')},customers:customers.filter(c=>c.companyId===s.cid&&!c.deletedAt).map(c=>({id:c.id,name:c.name})),invoices:invoices.filter(i=>eligible(i,s.cid)).map(i=>({id:i.id,number:i.number,title:i.title,totalCents:i.totalCents,balanceCents:i.balanceCents,version:i.version})),jobs:jobs.filter(j=>j.schema===schema&&j.companyId===s.cid).map(j=>({id:j.id,kind:j.kind,sourceId:j.sourceId,status:j.status,attempts:j.attempts,totalAttempts:j.totalAttempts,message:j.message,nextAttemptAtMs:j.nextAttemptAtMs||0,revision:j.revision,remoteId:j.remoteId||'',candidates:s.can('directory.read')?j.candidates||[]:[]})),mappings:mappings.filter(m=>m.schema===schema&&m.companyId===s.cid).map(m=>({id:m.id,kind:m.kind,sourceId:m.sourceId,remoteId:m.remoteId,issuedVersion:m.issuedVersion||null})),reconciliations:reconciliations.filter(r=>r.schema===schema&&r.companyId===s.cid),events:events.filter(e=>e.schema===schema&&e.companyId===s.cid).map(e=>({id:e.id,action:e.action,actorUid:e.actorUid,atMs:e.atMs,note:e.note,jobId:e.jobId||''}))};
 });});
export const accountingCommand=callable(async request=>{
 const db=localDatabase(),i=request.data||{},action=i.action,operationId=safeId(i.operationId),requestHash=fingerprint(i),nonce=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url'),intentId=randomUUID();
 return db.runTransaction(async tx=>{
  const s=await authorize(db,request,tx,'accounting.read');if(!s.can(accountPermission(action)))deny('permission-denied','An explicit accounting permission is required.');
  const root=s.root,ref=(c,id)=>root.collection(c).doc(safeId(id)),op=ref('qboOperations',operationId),prior=await tx.get(op);if(prior.exists){if(prior.data().uid!==s.uid||prior.data().fingerprint!==requestHash)deny('already-exists','Operation ID conflict.');return prior.data().result;}
  const cr=ref('qboConnections','main'),cd=await tx.get(cr),old=cd.data();supported(old,s.cid);const now=Date.now(),at=Timestamp.fromMillis(now),realm=mockRealm(s.cid),base={schema,companyId:s.cid},connection=old||{...base,status:'disconnected',realm,companyName:'Mock QuickBooks · '+s.company.name,revision:0,epoch:0};
  if(connection.realm!==realm)deny('failed-precondition','Stored accounting realm requires review.');if(i.realm&&i.realm!==realm)deny('permission-denied','Accounting realm belongs to another company.');
  const nextConnection={...connection,revision:connection.revision+1,updatedAtMs:now};let result={ok:true},jobId='',refreshCredential=null,auditDetails={};
  const finish=()=>{if(refreshCredential)tx.update(ref('qboPrivate','credentials'),refreshCredential);tx.set(cr,nextConnection);tx.create(ref('qboAudit',randomUUID()),{...base,action,actorUid:s.uid,at,atMs:now,note:text(i.note||'Reviewed local mock accounting operation'),jobId,...auditDetails});tx.create(op,{...base,uid:s.uid,fingerprint:requestHash,result,at});return result;};
  const expectedConnection=()=>{if(i.revision!==connection.revision)deny('aborted','Connection changed. Refresh and review.');};
  if(action==='beginConnect'){
   expectedConnection();if(i.realm&&i.realm!==realm)deny('permission-denied','Mock accounting realm belongs to a different company.');
   tx.create(ref('qboOAuth',intentId),{...base,uid:s.uid,stateHash:fingerprint(state),nonceHash:fingerprint(nonce),expiresAtMs:now+300000,epoch:connection.epoch,consumed:false});result={ok:true,intentId,expiresAtMs:now+300000};finish();return {...result,state,nonce};
  }
  if(action==='completeConnect'){
   const intent=ref('qboOAuth',i.intentId),d=await tx.get(intent),v=d.data(),claim=db.doc('qboRealmClaims/'+fingerprint(realm)),claimed=await tx.get(claim);
   if(!v||v.companyId!==s.cid||v.uid!==s.uid||v.epoch!==connection.epoch||v.consumed||v.expiresAtMs<=now||v.stateHash!==fingerprint(text(i.state,128))||v.nonceHash!==fingerprint(text(i.nonce,128))||i.mockConsent!=='approve'||i.realm&&i.realm!==realm)deny('permission-denied','Mock OAuth identity, state, nonce, expiry or realm is invalid.');
   if(claimed.exists&&claimed.data().companyId!==s.cid)deny('permission-denied','This accounting realm is already reserved for another company.');
   tx.set(claim,{...base,realm});tx.update(intent,{consumed:true,consumedAt:at});
   // Simulated credential metadata ONLY. No access/refresh bearer tokens exist in this adapter.
   tx.set(ref('qboPrivate','credentials'),{...base,status:'valid',generation:1,accessExpiresAtMs:now+3600000,refreshExpiresAtMs:now+86400000});Object.assign(nextConnection,{status:'connected',realm,connectedAtMs:now,epoch:connection.epoch+1});return finish();
  }
  if(action==='disconnect'){
   expectedConnection();Object.assign(nextConnection,{status:'disconnected',epoch:connection.epoch+1});tx.delete(ref('qboPrivate','credentials'));return finish();
  }
  if(action==='configure'){
   expectedConnection();const m=i.mapping;if(!m||Object.keys(m).sort().join(',')!=='discountAccountRef,salesItemRef,taxCodeRef,taxMode'||m.taxMode!=='explicit'||![m.salesItemRef,m.taxCodeRef,m.discountAccountRef].every(x=>typeof x==='string'&&/^mock-[-A-Za-z0-9_]{1,80}$/.test(x)))deny('invalid-argument','Choose explicit mock item, tax and discount references.');nextConnection.mapping={...m};return finish();
  }
  if(connection.status!=='connected')deny('failed-precondition','Connect the local mock accounting company first.');
  const mr=ref('qboMock','main'),md=await tx.get(mr),mock=md.data()?.value||emptyMock();if(md.exists&&(md.data().companyId!==s.cid||mock.schema!=='phase3g-mock-v1'))deny('failed-precondition','Unsupported mock state.');
  const store=value=>{if(Buffer.byteLength(JSON.stringify(value))>700000)deny('resource-exhausted','Local mock store limit reached.');tx.set(mr,{...base,value});};
  async function source(kind,sourceId){
   if(kind==='customer'){
    if(!s.can('directory.read'))deny('permission-denied','Customer read permission required.');const r=await tx.get(ref('customers',sourceId));if(!r.exists||r.data().companyId!==s.cid||r.data().deletedAt||r.data().active===false||r.data().schemaVersion!==1||typeof r.data().name!=='string'||!r.data().name.trim())deny('failed-precondition','Choose an active customer from this company.');return {payload:customerPayload({...r.data(),id:r.id}),customerId:r.id,version:0};
   }
   if(kind!=='invoice'||!s.can('invoice.read'))deny('permission-denied','Invoice read permission required.');const d=await tx.get(ref('invoices',sourceId));if(!eligible(d.data(),s.cid))deny('failed-precondition','Only supported issued invoices are eligible.');const v=await tx.get(d.ref.collection('versions').doc(String(d.data().version)));if(!v.exists||v.data().companyId!==s.cid||v.data().id!==sourceId)deny('failed-precondition','Issued snapshot requires review.');const cm=await tx.get(ref('qboMappings','customer-'+d.data().customerId));supported(cm.data(),s.cid);if(!cm.exists||cm.data().realm!==realm)deny('failed-precondition','Synchronize or explicitly map the invoice customer first.');const customer=await tx.get(ref('customers',d.data().customerId));if(!customer.exists||customer.data().companyId!==s.cid||customer.data().deletedAt||cm.data().sourceHash!==fingerprint(customerPayload({...customer.data(),id:customer.id})))deny('failed-precondition','Customer details or active status changed. Review the mapping.');
   try{return {payload:invoicePayload(v.data(),cm.data().remoteId,connection.mapping),customerId:customer.id,version:d.data().version,local:d.data()};}catch(e){deny('failed-precondition',e.message);}
  }
  if(action==='queueCustomer'||action==='queueInvoice'){
   const kind=action==='queueCustomer'?'customer':'invoice',sourceId=safeId(i.sourceId),src=await source(kind,sourceId);jobId=kind+'-'+sourceId;const jr=ref('qboJobs',jobId),j=await tx.get(jr);supported(j.data(),s.cid);
   if(j.exists){result={ok:true,jobId,existing:true};return finish();}
   const scenario=i.scenario||'success';if(!accountingScenarios.includes(scenario))deny('invalid-argument','Unknown documented mock scenario.');tx.create(jr,{...base,id:jobId,kind,sourceId,customerId:src.customerId,issuedVersion:src.version,payload:src.payload,sourceHash:fingerprint(src.payload),requestKey:fingerprint({cid:s.cid,realm,jobId}),scenario,status:'pending',attempts:0,totalAttempts:0,revision:1,nextAttemptAtMs:0,message:'Ready for local mock synchronization.',createdAt:at});result={ok:true,jobId};return finish();
  }
  if(action==='retryJob'||action==='reviewCustomer'){
   jobId=safeId(i.jobId);const jr=ref('qboJobs',jobId),jd=await tx.get(jr),j=jd.data();supported(j,s.cid);if(!j||j.revision!==i.revision)deny('aborted','Job changed. Refresh and review.');await source(j.kind,j.sourceId);
   if(action==='reviewCustomer'){
    if(j.kind!=='customer'||!['conflict','failed'].includes(j.status)||!['link-existing','create-separate'].includes(i.decision))deny('failed-precondition','This customer job is not awaiting a supported review.');if(i.decision==='link-existing'&&!mock.customers[i.remoteId])deny('invalid-argument','Choose an existing mock customer.');
    const currentMap=await tx.get(ref('qboMappings',jobId));if(currentMap.exists&&(i.decision!=='link-existing'||i.remoteId!==currentMap.data().remoteId))deny('failed-precondition','An existing mapping cannot be redirected; preserve invoice relationships.');
    const src=await source(j.kind,j.sourceId);tx.update(jr,{status:'pending',payload:src.payload,sourceHash:fingerprint(src.payload),reviewDecision:i.decision,reviewRemoteId:i.remoteId||'',attempts:0,nextAttemptAtMs:0,revision:j.revision+1,message:'Explicit customer review recorded.'});
   }else{
    if(!['retry','failed','auth_required'].includes(j.status))deny('failed-precondition','Only recoverable jobs can be retried. Conflicts need review.');if(j.status==='retry'&&j.nextAttemptAtMs>now)deny('failed-precondition','Wait for the bounded retry delay.');tx.update(jr,{status:'pending',attempts:j.attempts>=4?0:j.attempts,nextAttemptAtMs:0,revision:j.revision+1,message:'Explicit retry requested.'});
   }return finish();
  }
  if(action==='processJob'){
   jobId=safeId(i.jobId);const jr=ref('qboJobs',jobId),jd=await tx.get(jr),j=jd.data();supported(j,s.cid);if(!j)deny('not-found','Job not found.');if(j.status==='succeeded'){result={ok:true,jobId,alreadyProcessed:true};return finish();}if(!['pending','retry'].includes(j.status)||j.nextAttemptAtMs>now||j.attempts>=4)deny('failed-precondition','Job is not ready. Review, reconnect or retry explicitly.');
   let src;try{src=await source(j.kind,j.sourceId);}catch(e){if(!['failed-precondition','not-found'].includes(e.code))throw e;tx.update(jr,{status:'conflict',message:'Source missing, inactive or invalid; manual review required.',revision:j.revision+1,updatedAtMs:now});return finish();}const mapRef=ref('qboMappings',jobId),mapped=await tx.get(mapRef),mapping=mapped.data();supported(mapping,s.cid);
   const credentialRef=ref('qboPrivate','credentials'),creds=await tx.get(credentialRef),credential=creds.data();supported(credential,s.cid);
   const update=(status,message,extra={})=>tx.update(jr,{status,message,attempts:j.attempts+1,totalAttempts:j.totalAttempts+1,revision:j.revision+1,updatedAtMs:now,...extra});
   if(!credential||credential.status!=='valid'||credential.refreshExpiresAtMs<=now){nextConnection.status='auth_required';update('auth_required','Mock credentials invalid or expired. Reconnect; no records were exported.');return finish();}
   if(credential.accessExpiresAtMs<=now)refreshCredential={generation:credential.generation+1,accessExpiresAtMs:now+3600000};
   if(fingerprint(src.payload)!==j.sourceHash){update('conflict','ORVEX details or issued version changed; nothing was overwritten.');return finish();}
   if(mapping){
    const remote=(j.kind==='customer'?mock.customers:mock.invoices)[mapping.remoteId];
    if(j.kind==='customer'&&j.reviewDecision==='link-existing'&&j.reviewRemoteId===mapping.remoteId&&remote?.realm===realm){tx.update(mapRef,{sourceHash:j.sourceHash,remoteHash:fingerprint(remote),revision:(mapping.revision||1)+1,reviewedBy:s.uid,reviewedAt:at});auditDetails={mappingBefore:{sourceHash:mapping.sourceHash,remoteHash:mapping.remoteHash},mappingAfter:{sourceHash:j.sourceHash,remoteHash:fingerprint(remote)}};update('succeeded','Explicitly reviewed existing accounting details; neither system was overwritten.',{remoteId:mapping.remoteId});return finish();}
    if(!remote||remote.realm!==realm||fingerprint(remote)!==mapping.remoteHash||mapping.sourceHash!==j.sourceHash){update('conflict','Mapped accounting details changed; manual review required.');return finish();}
    update('succeeded','Mapping already exists; no duplicate export.',{remoteId:mapping.remoteId});nextConnection.lastSuccessAtMs=now;return finish();
   }
   const response=sendMock(mock,j,realm);
   if(response.status==='succeeded'){
    if(j.kind==='invoice'&&fingerprint(Object.fromEntries(Object.keys(j.payload).map(k=>[k,response.remote[k]])))!==j.sourceHash){store(response.store);update('conflict','Accounting response changed invoice amounts or details; review required.',{remoteId:response.remote.id});return finish();}
    const reverse=ref('qboRemoteLinks',fingerprint({realm,kind:j.kind,id:response.remote.id})),reserved=await tx.get(reverse);if(reserved.exists&&reserved.data().sourceId!==j.sourceId){update('conflict','Accounting record already belongs to a different ORVEX record.');return finish();}
    store(response.store);tx.create(mapRef,{...base,kind:j.kind,sourceId:j.sourceId,realm,remoteId:response.remote.id,sourceHash:j.sourceHash,remoteHash:fingerprint(response.remote),issuedVersion:j.issuedVersion,revision:1,linkedAt:at});tx.set(reverse,{...base,kind:j.kind,sourceId:j.sourceId});update('succeeded','Local mock export confirmed.',{remoteId:response.remote.id});nextConnection.lastSuccessAtMs=now;
   }else{store(response.store);const status=response.status==='retry'&&j.attempts+1>=4?'failed':response.status;update(status,response.message,{nextAttemptAtMs:status==='retry'?now+retryDelay(j.attempts+1,response.retryAfterMs||0):0,candidates:response.candidates||[]});}
   return finish();
  }
  if(action==='checkJob'){
   jobId=safeId(i.jobId);const jr=ref('qboJobs',jobId),jd=await tx.get(jr),j=jd.data();supported(j,s.cid);if(!j)deny('not-found','Job not found.');let src;try{src=await source(j.kind,j.sourceId);}catch(e){if(!['failed-precondition','not-found'].includes(e.code))throw e;tx.update(jr,{status:'conflict',message:'Mapped source is missing or inactive; nothing was deleted remotely.',revision:j.revision+1,updatedAtMs:now});return finish();}const mapped=await tx.get(ref('qboMappings',jobId)),m=mapped.data();supported(m,s.cid);if(!m)deny('failed-precondition','No accounting mapping exists.');const remote=(j.kind==='customer'?mock.customers:mock.invoices)[m.remoteId];const conflict=!remote||remote.realm!==realm||fingerprint(remote)!==m.remoteHash||fingerprint(src.payload)!==m.sourceHash;tx.update(jr,{status:conflict?'conflict':'succeeded',message:conflict?'Accounting or ORVEX details differ. Review without overwriting.':'Mapped details match the immutable export.',revision:j.revision+1,updatedAtMs:now});return finish();
  }
  if(action==='simulatePayment'){
   if(!s.can('invoice.read'))deny('permission-denied','Invoice read permission required.');const invoiceId=safeId(i.invoiceId),map=await tx.get(ref('qboMappings','invoice-'+invoiceId));supported(map.data(),s.cid);const m=map.data(),d=await tx.get(ref('invoices',invoiceId));if(!m||m.realm!==realm||!eligible(d.data(),s.cid))deny('failed-precondition','Choose a mapped, active issued invoice.');
   const mode=i.fixture;if(!['partial','full','unmatched','excess','changed-duplicate'].includes(mode))deny('invalid-argument','Choose a documented mock payment fixture.');
   const eventId=safeId(i.eventId),paymentId=safeId(i.paymentId),remoteInvoice=mock.invoices[m.remoteId];if(!remoteInvoice)deny('failed-precondition','Mock invoice missing.');
   const event=ref('qboInbox',eventId),existing=await tx.get(event),paymentRef=ref('qboPayments',fingerprint({realm,paymentId})),priorPayment=await tx.get(paymentRef),all=await list(tx,root.collection('qboPayments'));
   const priorTotal=all.filter(p=>p.realm===realm&&p.remoteInvoiceId===m.remoteId&&p.status==='proposed').reduce((n,p)=>n+p.amountCents,0);
   const amount=mode==='partial'?Math.max(1,Math.floor(remoteInvoice.totalCents/2)):mode==='full'?(priorPayment.data()?.fixture===mode?priorPayment.data().amountCents:remoteInvoice.totalCents-priorTotal):mode==='excess'?remoteInvoice.totalCents+1:remoteInvoice.totalCents;
   if(!safeMoney(amount)||amount<=0)deny('invalid-argument','Mock payment amount is invalid.');const payload={realm,paymentId,fixture:mode,remoteInvoiceId:mode==='unmatched'?'mock-unmatched':m.remoteId,amountCents:mode==='changed-duplicate'?amount+1:amount,currency:'USD'};
   if(existing.exists){if(existing.data().fingerprint!==fingerprint(payload))deny('already-exists','Duplicate event changed its payload.');result={ok:true,duplicate:true};return finish();}
   if(priorPayment.exists){if(priorPayment.data().fingerprint!==fingerprint(payload))deny('already-exists','Accounting payment ID changed its details.');tx.create(event,{...base,eventId,fingerprint:fingerprint(payload),duplicate:true,at});result={ok:true,duplicate:true};return finish();}
   const proposedPaid=priorTotal+payload.amountCents,local=d.data();let status=mode==='unmatched'?'unmatched':proposedPaid>local.totalCents?'conflict':'proposed';
   const expectedBalance=Math.max(0,local.totalCents-proposedPaid),balanceDiff=local.balanceCents!==expectedBalance;
   const record={...base,...payload,invoiceId:mode==='unmatched'?'':invoiceId,eventId,fingerprint:fingerprint(payload),status,at,atMs:now};tx.create(paymentRef,record);tx.create(event,{...base,eventId,fingerprint:record.fingerprint,at});tx.create(ref('qboReconciliations',eventId),{...base,eventId,paymentId,invoiceId:record.invoiceId,amountCents:payload.amountCents,status,localBalanceCents:local.balanceCents,proposedAccountingBalanceCents:expectedBalance,balanceDiff,reviewRequired:true,message:status==='unmatched'?'No mapped invoice; manual review required.':status==='conflict'?'Payment exceeds the invoice; no posting performed.':balanceDiff?'Payment proposal recorded; balances differ until separately reviewed posting.':'Balances agree; proposal only, no posting performed.',atMs:now});result={ok:true,status,reviewRequired:true};return finish();
  }
  deny('invalid-argument','Unknown local accounting action.');
 });
});
