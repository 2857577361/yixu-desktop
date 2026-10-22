const {ReadingClock}=require('./reading.cjs');
module.exports=function(core){
 const clocks=new Map();let suspended=false;
 function attach(w){const x={w,bookId:null,seen:0,clock:new ReadingClock(a=>core.run('reader.time.record',a))};clocks.set(w.id,x);
  for(const event of ['blur','hide','minimize','close'])w.on(event,()=>x.clock.update(null));
  w.on('focus',()=>sync(x));w.on('closed',()=>{x.clock.update(null);clocks.delete(w.id);});
  w.webContents.on('render-process-gone',()=>{x.bookId=null;x.clock.update(null);});
 }
 function sync(x){x.clock.update(!suspended&&!x.w.isDestroyed()&&x.w.isVisible()&&x.w.isFocused()&&!x.w.isMinimized()&&Date.now()-x.seen<10000?x.bookId:null);}
 function presence(w,a){const x=clocks.get(w.id);if(!x)return {active:false};const s=core.read();x.bookId=a.visible&&s.library.some(b=>b.id===a.id&&!b.archived)?a.id:null;x.seen=Date.now();sync(x);x.clock.flush();const stats=core.run('reader.stats',{id:a.id||undefined});return {active:!!x.clock.active,todaySeconds:stats.totals.day,bookSeconds:stats.total};}
 function suspend(value){suspended=value;for(const x of clocks.values()){if(value){x.bookId=null;x.clock.update(null);}else sync(x);}}
 function tick(){for(const x of clocks.values()){try{sync(x);x.clock.flush();}catch(e){console.error('Reading clock:',e.message);x.clock.active=null;}}}
 function stop(){for(const x of clocks.values())x.clock.update(null);}
 return {attach,presence,suspend,tick,stop};
};
