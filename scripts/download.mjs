import {readFile,mkdtemp,rm,copyFile,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const manifest=JSON.parse(await readFile(new URL('./pocketbase-checksums.json',import.meta.url),'utf8'));
const platform={linux:'linux',darwin:'darwin',win32:'windows'}[process.platform],arch={x64:'amd64',arm64:'arm64'}[process.arch];
if(!platform||!arch)throw new Error('Baixe manualmente a versão '+manifest.version+' para sua plataforma.');
const name='pocketbase_'+manifest.version+'_'+platform+'_'+arch+'.zip',expected=manifest.assets[name];if(!/^[a-f0-9]{64}$/.test(expected||''))throw new Error('Checksum oficial não encontrado para '+name);
const dir=await mkdtemp(join(tmpdir(),'agendapro-pb-download-')),zip=join(dir,'pb.zip');
try{const r=spawnSync(process.platform==='win32'?'curl.exe':'curl',['--fail','--location','--silent','--show-error','--max-time','120','https://github.com/pocketbase/pocketbase/releases/download/v'+manifest.version+'/'+name,'--output',zip],{stdio:'inherit'});if(r.status!==0)throw new Error('Download falhou. Baixe manualmente na release oficial.');const bytes=await readFile(zip);if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('Checksum divergente. O binário não será instalado.');const extraction=process.platform==='win32'?spawnSync('powershell',['-NoProfile','-Command','Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1]',zip,dir],{stdio:'inherit'}):spawnSync('unzip',['-o',zip,'pocketbase','-d',dir],{stdio:'inherit'});if(extraction.status!==0)throw new Error('Extração falhou. Use o extrator de ZIP do sistema.');const executable=process.platform==='win32'?'pocketbase.exe':'pocketbase';await copyFile(join(dir,executable),resolve(executable));if(process.platform!=='win32')await chmod(resolve(executable),0o755);console.log('PocketBase '+manifest.version+' instalado e SHA-256 verificado.');}finally{await rm(dir,{recursive:true,force:true})}
