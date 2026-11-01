import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const bin=process.env.PB_BIN||resolve(process.platform==='win32'?'pocketbase.exe':'pocketbase');
const origin=process.env.FRONTEND_ORIGIN||'http://127.0.0.1:8090';if(!/^https?:\/\/[^/]+$/.test(origin))throw new Error('Defina FRONTEND_ORIGIN apenas com protocolo e domínio/porta, sem barra final.');
const result=spawnSync(bin,['serve','--http='+ (process.env.PB_HTTP||'127.0.0.1:8090'),'--dir='+resolve(process.env.PB_DATA_DIR||'pb_data'),'--publicDir='+resolve('pb_public'),'--hooksDir='+resolve('pb_hooks'),'--migrationsDir='+resolve('pb_migrations'),'--origins='+origin,'--hooksWatch=false',...(process.env.PB_ENCRYPTION_KEY?['--encryptionEnv=PB_ENCRYPTION_KEY']:[])],{stdio:'inherit',env:{...process.env,FRONTEND_ORIGIN:origin}});if(result.error)throw result.error;process.exit(result.status||0);
