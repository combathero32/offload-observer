const fs = require('fs');
const path = require('path');
(async()=>{
  const create = require(path.resolve(process.argv[2]));
  const mod = await create({wasmBinary:fs.readFileSync(process.argv[3]),print:()=>{},printErr:()=>{}});
  const core = fs.readFileSync(path.join(__dirname,'../root/usr/share/ucode/offload-observer/core.uc'),'utf8');
  mod.FS_createPath('/','usr/share/ucode/offload-observer',true,true);
  mod.FS_createDataFile('/usr/share/ucode/offload-observer','core.uc',core,true,true);
  mod.FS_createDataFile('/usr/share/ucode/offload-observer','uplink.uc',fs.readFileSync(path.join(__dirname,'../root/usr/share/ucode/offload-observer/uplink.uc'),'utf8'),true,true);
  const daemon = fs.readFileSync(path.join(__dirname,'../root/usr/sbin/offload-observer'),'utf8')
    .replace(/^#!.*\n/,'').replace(/^import (?!.*\/usr\/share\/ucode\/offload-observer\/).*;\n/gm,'');
  const mocks = fs.readFileSync(path.join(__dirname,'daemon-mocks.uc'),'utf8');
  const assertions = fs.readFileSync(path.join(__dirname,'daemon-assertions.uc'),'utf8');
  const source = mocks+'\n'+daemon+'\n'+assertions;
  const p = mod._malloc(mod.lengthBytesUTF8(source)+1);
  mod.stringToUTF8(source,p,mod.lengthBytesUTF8(source)+1);
  mod._ucode_run(p);mod._free(p);
  const out=mod.UTF8ToString(mod._ucode_get_output()),err=mod.UTF8ToString(mod._ucode_get_error());
  process.stdout.write(out);
  if(err || !out.includes('PASS:')){process.stderr.write(err+'\n');process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
