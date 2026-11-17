const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {createRequire} = require('node:module');
function load(file) {
  const filename = path.resolve(file);
  const localRequire = createRequire(filename);
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(name=>name.startsWith('.')?load(path.resolve(path.dirname(filename),name+'.ts')):localRequire(name),module,module.exports);
  return module.exports;
}
const {whatsappConfig,invitationPayload,sendWhatsAppInvitation,sendWhatsAppSample} = load('src/lib/whatsapp.ts');
(async()=>{
  for(const key of Object.keys(process.env)) if(key.startsWith('WHATSAPP_') || key==='MEMORICA_PUBLIC_URL') delete process.env[key];
  assert(whatsappConfig().missing.includes('Meta access token'));
  Object.assign(process.env,{WHATSAPP_ACCESS_TOKEN:'test-secret-not-real',WHATSAPP_PHONE_NUMBER_ID:'123456',WHATSAPP_API_VERSION:'v25.0',WHATSAPP_INVITATION_TEMPLATE:'memorica_event_invitation',WHATSAPP_TEMPLATE_LANGUAGE:'en_US',WHATSAPP_HOST_USER_IDS:'test-host',MEMORICA_PUBLIC_URL:'https://memorica.example'});
  assert.deepEqual(whatsappConfig().missing,[]);
  const input = {phone:'+919876543210',name:'Test\nGuest',title:'Mehndi',url:'https://memorica.example/invite/test?invitation=mehndi'};
  const payload = invitationPayload(input);
  assert.equal(payload.to,'919876543210');
  assert.deepEqual(payload.template.components[0].parameters.map(p=>p.text),['Test Guest','Mehndi',input.url]);
  assert.throws(()=>invitationPayload({...input,phone:'123'}));
  process.env.WHATSAPP_INVITATION_TEMPLATE='memorica_wedding_celebration';
  const weddingInput = {...input,groomName:'Alex\nSmith',brideName:'Sam Jones'};
  assert.deepEqual(invitationPayload(weddingInput).template.components[0].parameters.map(p=>p.text),['Alex Smith','Sam Jones',input.url]);
  assert.throws(()=>invitationPayload(input),/groom/);
  assert.throws(()=>invitationPayload({...weddingInput,brideName:'  '}),/groom/);
  process.env.WHATSAPP_INVITATION_TEMPLATE='memorica_event_invitation';
  const {normalizeEventSetup,parseEventSetup} = load('src/lib/event-setup.ts');
  assert.equal(normalizeEventSetup({groomName:' Alex ',brideName:' Sam '}).groomName,'Alex');
  assert.equal(parseEventSetup('{}').brideName,'');
  let calls=0;
  const id = await sendWhatsAppInvitation(input,async(url,options)=>{
    calls++;assert.equal(url,'https://graph.facebook.com/v25.0/123456/messages');
    assert.equal(options.headers.Authorization,'Bearer test-secret-not-real');
    assert.deepEqual(JSON.parse(options.body),payload);
    return new Response(JSON.stringify({messages:[{id:'wamid.test'}]}),{status:200});
  });
  assert.equal(id,'wamid.test');assert.equal(calls,1);
  await assert.rejects(sendWhatsAppInvitation(input,async()=>new Response(JSON.stringify({error:{code:190,message:'secret-provider-error'}}),{status:401})),error=>error.message.includes('expired')&&!error.message.includes('secret-provider-error')&&!error.uncertain);
  await assert.rejects(sendWhatsAppInvitation(input,async()=>{throw new Error('network');}),error=>error.uncertain);
  await assert.rejects(sendWhatsAppInvitation(input,async()=>new Response('{}',{status:200})),error=>error.uncertain);
  for(const url of ['http://localhost:3000','https://127.0.0.1:3000','https://name:password@memorica.example']){
    process.env.MEMORICA_PUBLIC_URL=url;
    assert(whatsappConfig().missing.includes('public HTTPS Memorica address'));
    await assert.rejects(sendWhatsAppInvitation(input,async()=>{throw new Error('must not reach transport');}),/setup is incomplete/);
  }
  process.env.NODE_ENV='development';
  process.env.WHATSAPP_TEST_RECIPIENTS='+919876543210';
  let sampleCalls=0;
  await sendWhatsAppSample('+919876543210',async(url,options)=>{
    sampleCalls++;
    assert.deepEqual(JSON.parse(options.body),{messaging_product:'whatsapp',to:'919876543210',type:'template',template:{name:'hello_world',language:{code:'en_US'}}});
    return new Response(JSON.stringify({messages:[{id:'wamid.sample'}]}),{status:200});
  });
  assert.equal(sampleCalls,1);
  await assert.rejects(sendWhatsAppSample('+14155552671'),/configured local test recipient/);
  process.env.NODE_ENV='production';
  await assert.rejects(sendWhatsAppSample('+919876543210'),/configured local test recipient/);
  console.log('PASS: local sample works without public URL or invitation template; unlisted recipients and production sends blocked.');
  console.log('PASS: configuration gates, phone validation, selected invitation payload, provider request, error redaction, ambiguous-send handling. No messages sent.');
})().catch(e=>{console.error(e);process.exitCode=1;});
