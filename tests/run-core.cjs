// Execute the actual ucode core on a real ucode WebAssembly VM.
// Run: node tests/run-core.cjs /path/to/ucode.js /path/to/ucode.wasm
const fs = require('fs');
const path = require('path');
(async () => {
  const create = require(path.resolve(process.argv[2]));
  const mod = await create({wasmBinary:fs.readFileSync(process.argv[3]),print:()=>{},printErr:()=>{}});
  const core = fs.readFileSync(path.join(__dirname,'../root/usr/share/ucode/offload-observer/core.uc'),'utf8');
  if (/^}\r?$/m.test(core)) throw new Error('OpenWrt 25.12 requires top-level exported functions to end with };');
  mod.FS_createPath('/','usr/share/ucode/offload-observer',true,true);
  mod.FS_createDataFile('/usr/share/ucode/offload-observer','core.uc',core,true,true);
  const exports = [...core.matchAll(/^export function (\w+)/gm)].map(m=>m[1]);
  // Import the shipped module verbatim: never erase export declarations.
  const imports = 'import { '+exports.join(', ')+" } from '/usr/share/ucode/offload-observer/core.uc';\n";
  const tests = fs.readFileSync(path.join(__dirname,'core-tests.uc'),'utf8');
  const source = imports+tests;
  const p = mod._malloc(mod.lengthBytesUTF8(source)+1);
  mod.stringToUTF8(source,p,mod.lengthBytesUTF8(source)+1);
  mod._ucode_run(p); mod._free(p);
  const out = mod.UTF8ToString(mod._ucode_get_output());
  const err = mod.UTF8ToString(mod._ucode_get_error());
  process.stdout.write(out);
  if (err || !out.includes('PASS:')) {process.stderr.write(err+'\n');process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
