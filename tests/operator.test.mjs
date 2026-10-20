import { test } from 'node:test';
import assert from 'node:assert/strict';
import { operatorAuth } from '../src/operator.mjs';
const auth=()=>operatorAuth({key:'clave-de-test-con-mas-de-32-caracteres',accessCode:'passcode-seguro-de-test',actorId:'lider-1',secure:true});
test('codigo incorrecto no crea sesion',()=>assert.equal(auth().login('incorrecto'),undefined));
test('cookie es HttpOnly, Secure, SameSite y rechaza manipulacion',()=>{const a=auth(),cookie=a.login('passcode-seguro-de-test');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Secure/);const req={headers:{cookie:cookie.split(';')[0]},method:'POST',url:'/api/confirmar'};assert.equal(a.session(req).actorId,'lider-1');assert.equal(a.session({...req,headers:{cookie:req.headers.cookie+'x'}}),undefined);assert.ok(a.assertion(req,{solicitudId:'sol-003'}));});
test('sin sesion no se emite identidad de revisor',()=>assert.equal(auth().assertion({headers:{},method:'POST',url:'/api/confirmar'},{}),undefined));
