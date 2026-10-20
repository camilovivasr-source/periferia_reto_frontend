import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
test('dashboard: caso, login, justificacion, decision, SSE y salida segura',async()=>{
 const dom=new JSDOM(await readFile('public/index.html','utf8'),{runScripts:'outside-only',url:'http://localhost:3000'}),w=dom.window;
 let logged=false,state='REQUIERE_APROBACION';
 const result=()=>({solicitudId:'sol-003',snapshot:'a'.repeat(64),estado:state,resumen:{id:'sol-003',nit:'900000001',centroCosto:'CC-01',baseCentavos:100000000,ivaCentavos:19000000,totalCentavos:119000000,condicionPago:'P30',fechaSolicitud:'2026-10-19'},controles:[{codigo:'APROBACION',resultado:state==='REQUIERE_APROBACION'?'PENDIENTE':'CUMPLE',motivo:'<img src=x onerror=alert(1)>'}],revision:{actorId:logged?'lider-1':undefined,puedeAprobar:logged&&state!=='CREADA',puedeRechazar:logged&&state!=='CREADA',motivo:'Autoridad revisada'},auditoria:[],...(state==='CREADA'?{sap:{simulado:true,oc:'OC-TEST',solicitudId:'sol-003'}}:{})});
 w.TextDecoder=TextDecoder;w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.fetch=async(url,init)=>{
  if(url==='/api/backend-health')return Response.json({mode:'PRACTICA SIN LLM'});
  if(url==='/api/solicitudes')return Response.json({ids:['sol-003']});
  if(url==='/api/operator/session')return Response.json({actorId:null});
  if(url==='/api/operator/login'){logged=true;return Response.json({actorId:'lider-1'});}
  if(url==='/api/solicitudes/sol-003')return Response.json(result());
  if(url==='/api/confirmar'){assert.ok(JSON.parse(init.body).justificacion.length>=10);state='LISTA_PARA_CREAR';return Response.json(result());}
  if(url==='/api/chat'){state='CREADA';const packets=[{type:'tool_start',id:'call1',name:'crearOrdenCompraSAP',args:{solicitudId:'sol-003'}},{type:'tool_end',id:'call1',name:'crearOrdenCompraSAP',durationMs:3,result:result()},{type:'complete',reply:'OC-TEST creada'}];return new Response(packets.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}});}
  throw Error('Ruta inesperada '+url);
 };
 const wait=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('UI no alcanzo estado esperado');};
 try{
  w.eval(await readFile('public/app.js','utf8'));await wait(()=>w.document.querySelectorAll('#case option').length===2);
  const $=id=>w.document.getElementById(id);$('case').value='sol-003';$('case').dispatchEvent(new w.Event('change'));await wait(()=>$('status').textContent==='Revisión pendiente');assert.equal($('approve').disabled,true);
  $('code').value='passcode';$('login-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(()=>!$('approve').disabled);
  $('reason').value='Evidencia revisada con justificacion';$('approve').click();await wait(()=>$('status').textContent==='Lista para crear');
  $('create').click();await wait(()=>$('status').textContent==='OC creada');assert.match($('sap').textContent,/OC-TEST/);assert.equal($('tool-count').textContent,'1');assert.equal(w.document.querySelectorAll('#controls img').length,0);
 }finally{w.close();}
});
