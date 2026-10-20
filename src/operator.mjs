import { createHmac,timingSafeEqual } from 'node:crypto';
export function operatorAuth({key,accessCode,actorId,secure}){
 const sign=(prefix,payload)=>createHmac('sha256',key).update(prefix+payload).digest('hex');
 const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
 const session=req=>{try{const token=(req.headers.cookie??'').split(';').map(v=>v.trim()).find(v=>v.startsWith('review_session='))?.slice(15);if(!token)return undefined;const [raw,sig]=token.split('.');if(!equal(sig,sign('session:',raw)))return undefined;const p=JSON.parse(Buffer.from(raw,'base64url').toString());return p.exp>Date.now()&&p.actorId===actorId?p:undefined;}catch{return undefined;}};
 return {
  session,
  login(code){if(!equal(code,accessCode))return undefined;const raw=Buffer.from(JSON.stringify({actorId,exp:Date.now()+30*60*1000})).toString('base64url');return `review_session=${raw}.${sign('session:',raw)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${secure?'; Secure':''}`;},
  logout(){return `review_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`;},
  assertion(req,body){const s=session(req);if(!s)return undefined;const raw=Buffer.from(JSON.stringify({actorId:s.actorId,exp:Date.now()+60000,method:req.method,path:req.url,payloadHash:createHmac('sha256',key).update(JSON.stringify(body??null)).digest('hex')})).toString('base64url');return raw+'.'+sign('action:',raw);}
 };
}
