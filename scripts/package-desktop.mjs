import {packager} from '@electron/packager';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),platform=process.argv[2]||process.platform,arch=process.argv[3]||(platform==='win32'?'x64':process.arch);
if(!['darwin','win32'].includes(platform))throw Error('支持 darwin 或 win32');
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
if(platform==='win32'){
 const png=await fs.readFile(path.join(root,'assets/icon-256.png'));
 const size=png.readUInt32BE(16);if(size!==png.readUInt32BE(20))throw Error('图标必须为正方形');
 const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=ico[7]=size>=256?0:size;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
 await fs.writeFile(path.join(root,'assets/icon.ico'),Buffer.concat([ico,png]));
}
const paths=await packager({dir:root,name:'一序',platform,arch,out:path.join(root,'dist-desktop'),overwrite:true,asar:false,prune:true,appBundleId:'local.yixu.desktop',icon:path.join(root,'assets',platform==='darwin'?'icon.icns':'icon.ico'),ignore:[/^\/(test|dist[^/]*|screenshots|mobile|supabase|skill|scripts|docs)(\/|$)/,/^\/\./,/^\/(CHANGELOG|RELEASE)[^/]*$/],win32metadata:{CompanyName:'Yixu',FileDescription:'一序 · 习惯、记录与学习',ProductName:'一序'}});
for(const dest of paths){
 if(platform==='darwin')execFileSync('codesign',['--force','--deep','--sign','-','--identifier','local.yixu.desktop',path.join(dest,'一序.app')],{stdio:'inherit'});
 else {
  // npm installs host-specific optional binaries. Replace the canvas binary with the target build.
  const napi=path.join(dest,'resources/app/node_modules/@napi-rs'),canvas=JSON.parse(await fs.readFile(path.join(napi,'canvas/package.json'),'utf8'));
  const target='canvas-win32-'+arch+'-msvc',version=canvas.optionalDependencies['@napi-rs/'+target];
  if(!version)throw Error('未找到 Windows '+arch+' 的 PDF 可选运行库');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'yixu-win-canvas-'));
  try{
   const args=['pack','@napi-rs/'+target+'@'+version,'--json','--pack-destination',temp];
   const output=JSON.parse(process.env.npm_execpath?execFileSync(process.execPath,[process.env.npm_execpath,...args],{encoding:'utf8'}):execFileSync('npm',args,{encoding:'utf8'}));
   for(const name of await fs.readdir(napi))if(name.startsWith('canvas-'))await fs.rm(path.join(napi,name),{recursive:true,force:true});
   await fs.mkdir(path.join(napi,target),{recursive:true});
   execFileSync('tar',['-xzf',path.join(temp,output[0].filename),'--strip-components=1','-C',path.join(napi,target)]);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
  await fs.copyFile(path.join(root,'docs/Windows使用说明.md'),path.join(dest,'先读我.md'));
 }
 console.log(JSON.stringify({version:pkg.version,platform,arch,path:dest}));
}
