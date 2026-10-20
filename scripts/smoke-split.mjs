import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const children=[];
async function start(cwd,script,env){
 const child=spawn(process.execPath,[script],{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});children.push(child);
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Inicio excedido: '+script)),10000);child.once('error',reject);child.once('exit',code=>{clearTimeout(t);reject(Error('Proceso termino '+code));});child.stdout.once('data',()=>{clearTimeout(t);resolve();});});
}
try{
 const backend=path.resolve(process.env.BACKEND_DIR??'../reto-03-backend');
 await start(backend,'dist/src/server.js',{PORT:'3037',AGENT_MODE:'practice',STATE_STORE:'memory',GEMINI_API_KEY:'',HUMAN_AUTH_MODE:'signed',OPERATOR_SIGNING_KEY:'clave-de-integracion-mayor-a-32-caracteres'});
 await start(process.cwd(),'src/server.mjs',{PORT:'3038',BACKEND_URL:'http://127.0.0.1:3037',BACKEND_AUTH:'none',OPERATOR_SIGNING_KEY:'clave-de-integracion-mayor-a-32-caracteres',OPERATOR_ACCESS_CODE:'local-review-only'});
 const base='http://127.0.0.1:3038';
 const login=await fetch(base+'/api/operator/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'local-review-only'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 async function post(route,body){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();}
 assert.equal((await (await fetch(base+'/health')).json()).service,'frontend');
 assert.equal((await (await fetch(base+'/api/backend-health')).json()).mode,'PRACTICA SIN LLM');
 assert.match(await (await fetch(base)).text(),/Control de compras/);
 assert.equal((await fetch(base+'/app.js')).status,200);
 const validated=await post('/api/chat',{message:'validar sol-003'});
 assert.equal(validated.result.estado,'REQUIERE_APROBACION');
 const approved=await post('/api/confirmar',{solicitudId:'sol-003',snapshot:validated.result.snapshot,justificacion:'Revision de prueba autorizada'});assert.equal(approved.estado,'LISTA_PARA_CREAR');
 assert.equal((await post('/api/chat',{message:'crear sol-003'})).result.estado,'CREADA');
 assert.equal((await post('/api/chat',{message:'crear sol-002'})).result.estado,'RECHAZADA');
 assert.equal((await fetch(base+'/ruta-no-permitida')).status,404);
 const stream=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify({message:'validar sol-001'})});const events=await stream.text();assert.match(events,/tool_start/);assert.match(events,/tool_end/);assert.match(events,/complete/);
 console.log('Integracion local frontend -> backend: chat, confirmacion, creacion y rechazo OK. Sin LLM ni IAM reales.');
}finally{for(const child of children)child.kill();}
