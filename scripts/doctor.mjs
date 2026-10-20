import 'dotenv/config';
import { existsSync } from 'node:fs';
const deploy=process.argv.includes('--deployment');
const files=["Dockerfile", "package-lock.json", ".env.example", "public/index.html", "public/app.js", "public/styles.css", "src/server.mjs"];
const missing=files.filter(p=>!existsSync(p));
if(deploy){for(const name of ['BACKEND_URL','OPERATOR_SIGNING_KEY','OPERATOR_ACCESS_CODE'])if(!process.env[name])missing.push('Variable '+name);if(process.env.BACKEND_AUTH!=='iam')missing.push('BACKEND_AUTH=iam');}
if(missing.length){console.error('Faltantes:',missing.join(', '));process.exitCode=1;}else console.log('Doctor OK: archivos y configuracion requerida presentes. No prueba conectividad cloud.');
