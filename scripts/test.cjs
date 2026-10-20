const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
(async()=>{
  const cache=path.join(root,'.cache','ucode');
  fs.mkdirSync(cache,{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tests','ucode-runtime.json'),'utf8'));
  for(const item of manifest.files){
    const target=path.join(cache,item.name);
    if(!fs.existsSync(target)){
      const response=await fetch(item.url);
      if(!response.ok)throw new Error('Runtime download failed: '+response.status);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)
        throw new Error('Upstream runtime changed; review it and update tests/ucode-runtime.json explicitly.');
      fs.writeFileSync(target,bytes);
    }
    if(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==item.sha256)
      throw new Error('Runtime checksum mismatch: '+item.name);
  }
  for(const test of ['run-core.cjs','run-uplink.cjs','daemon-smoke.cjs']){
    const result=spawnSync(process.execPath,[path.join(root,'tests',test),
      path.join(cache,'ucode.js'),path.join(cache,'ucode.wasm')],{cwd:root,stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.status!==0)process.exit(result.status||1);
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
