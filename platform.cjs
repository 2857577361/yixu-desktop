const path=require('node:path'),os=require('node:os');
function dataDirectory(platform=process.platform,env=process.env,home=os.homedir()){
 if(env.YIXU_DATA_DIR)return path.resolve(env.YIXU_DATA_DIR);
 if(platform==='win32')return path.win32.join(env.APPDATA||path.win32.join(home,'AppData','Roaming'),'Yixu');
 if(platform==='darwin')return path.join(home,'Library','Application Support','Yixu');
 return path.join(env.XDG_DATA_HOME||path.join(home,'.local','share'),'Yixu');
}
module.exports={dataDirectory};
