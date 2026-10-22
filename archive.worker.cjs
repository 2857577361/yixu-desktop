const {parentPort,workerData}=require('node:worker_threads');
(async()=>{const core=require('./core.cjs'),archive=require('./archive.cjs'),s=core.read(),{action,dest,args}=workerData;const result=await archive.exportAll(s,core.dir,dest,p=>parentPort.postMessage({progress:p}));parentPort.postMessage({result});})().catch(e=>{parentPort.postMessage({error:e.message});});
