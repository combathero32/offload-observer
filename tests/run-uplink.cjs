const fs=require('fs'),path=require('path');
(async()=>{
  const create=require(path.resolve(process.argv[2]));
  const mod=await create({wasmBinary:fs.readFileSync(process.argv[3]),print:()=>{},printErr:()=>{}});
  mod.FS_createPath('/','usr/share/ucode/offload-observer',true,true);
  mod.FS_createDataFile('/usr/share/ucode/offload-observer','uplink.uc',fs.readFileSync(path.join(__dirname,'../root/usr/share/ucode/offload-observer/uplink.uc'),'utf8'),true,true);
  const source="import {parse_station,new_uplink,sample_uplink} from '/usr/share/ucode/offload-observer/uplink.uc';\n"+fs.readFileSync(path.join(__dirname,'uplink-tests.uc'),'utf8');
  const p=mod._malloc(mod.lengthBytesUTF8(source)+1);
  mod.stringToUTF8(source,p,mod.lengthBytesUTF8(source)+1);
  mod._ucode_run(p);mod._free(p);
  const out=mod.UTF8ToString(mod._ucode_get_output()),err=mod.UTF8ToString(mod._ucode_get_error());
  process.stdout.write(out);if(err||!out.includes('PASS:'))throw new Error(err);
})().catch(e=>{console.error(e);process.exitCode=1;});
