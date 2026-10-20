import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('cliente no contiene clave Gemini ni llama directamente al proveedor',async()=>{
 const js=await readFile('public/app.js','utf8');
 assert.doesNotMatch(js,/GEMINI_API_KEY|generativelanguage\.googleapis/);
 assert.match(js,/api\/backend-health/);assert.match(js,/api\/chat/);
});
