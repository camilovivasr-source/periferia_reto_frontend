import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { GoogleAuth } from 'google-auth-library';
import { operatorAuth } from './operator.mjs';
const cloud=!!process.env.K_SERVICE,backend=new URL(process.env.BACKEND_URL??'http://127.0.0.1:8080');
if(backend.pathname!=='/'||backend.search||backend.hash||!['http:','https:'].includes(backend.protocol))throw Error('BACKEND_URL debe ser un origen HTTP(S)');
const authMode=process.env.BACKEND_AUTH??'iam';if(!['iam','none'].includes(authMode)||cloud&&authMode!=='iam')throw Error('Cloud Run requiere BACKEND_AUTH=iam');
const key=process.env.OPERATOR_SIGNING_KEY??(cloud?'':'clave-local-educativa-no-usar-en-cloud'),code=process.env.OPERATOR_ACCESS_CODE??(cloud?'':'local-review-only');
if(key.length<32||code.length<12)throw Error('Configurar OPERATOR_SIGNING_KEY (32+) y OPERATOR_ACCESS_CODE (12+)');
const operator=operatorAuth({key,accessCode:code,actorId:process.env.OPERATOR_ID??'lider-1',secure:cloud});
const auth=new GoogleAuth();let client;const limits=new Map();
const assets={'/':['public/index.html','text/html'],'/app.js':['public/app.js','text/javascript'],'/styles.css':['public/styles.css','text/css']};
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
  if(req.method==='GET'&&req.url==='/health'){send(200,{ok:true,service:'frontend'});return;}
  const asset=assets[req.url];if(req.method==='GET'&&asset){res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8'});res.end(await readFile(asset[0]));return;}
  if(req.method==='GET'&&req.url==='/api/operator/session'){send(200,{actorId:operator.session(req)?.actorId??null});return;}
  if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){send(403,{error:'Origen no permitido'});return;}
  const allowed=['/api/chat','/api/confirmar','/api/rechazar','/api/solicitudes','/api/backend-health','/api/operator/login','/api/operator/logout'].includes(req.url)||/^\/api\/solicitudes\/sol-\d{3}$/.test(req.url??'');
  if(!allowed||!['GET','POST'].includes(req.method)){send(404,{error:'Ruta no encontrada'});return;}
  const ip=req.socket.remoteAddress??'unknown',bucket=limits.get(ip),now=Date.now();
  if(!bucket||now-bucket.start>60000){if(limits.size>10000)limits.clear();limits.set(ip,{start:now,count:1});}else if(++bucket.count>90){send(429,{error:'Demasiadas solicitudes. Espera un minuto.'});return;}
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16384){send(413,{error:'Entrada demasiado grande'});return;}chunks.push(chunk);}
  const raw=Buffer.concat(chunks);let body=null;if(raw.length){try{body=JSON.parse(raw.toString());}catch{send(400,{error:'JSON invalido'});return;}}
  if(req.url==='/api/operator/login'){
   if(req.method!=='POST'){send(405,{error:'Metodo no permitido'});return;}
   const cookie=operator.login(body?.code);if(!cookie){send(403,{error:'Codigo de revisor incorrecto'});return;}res.setHeader('Set-Cookie',cookie);send(200,{actorId:operator.session({headers:{cookie:cookie.split(';')[0]}})?.actorId});return;
  }
  if(req.url==='/api/operator/logout'){if(req.method!=='POST'){send(405,{error:'Metodo no permitido'});return;}res.setHeader('Set-Cookie',operator.logout());send(200,{ok:true});return;}
  if(['/api/confirmar','/api/rechazar'].includes(req.url)&&!operator.session(req)){send(403,{error:'Inicia sesion de revisor antes de decidir'});return;}
  const route=req.url==='/api/backend-health'?'/health':req.url,headers={'Content-Type':'application/json'};
  if(req.headers.accept?.includes('text/event-stream'))headers.Accept='text/event-stream';
  const assertion=operator.assertion(req,body);if(assertion)headers['X-Operator-Assertion']=assertion;
  if(authMode==='iam'){client??=await auth.getIdTokenClient(backend.origin);const h=await client.getRequestHeaders();const authorization=h instanceof Headers?h.get('authorization'):h.Authorization??h.authorization;if(!authorization)throw Error('Sin identidad IAM');headers.Authorization=authorization;}
  const controller=new AbortController();res.on('close',()=>controller.abort());
  const upstream=await fetch(new URL(route,backend.origin),{method:req.method,headers,...(req.method==='POST'?{body:raw}:{}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(110000)])});
  res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')??'application/json','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'});
  if(upstream.body)for await(const chunk of upstream.body){if(res.destroyed)break;res.write(chunk);}res.end();
 }catch{if(!res.headersSent)send(502,{error:'No se pudo contactar el backend. Revisa URL, IAM y estado del servicio.'});else res.end();}
});
server.requestTimeout=120000;server.listen(Number(process.env.PORT??3000),'0.0.0.0',()=>console.log('Frontend listo'));
