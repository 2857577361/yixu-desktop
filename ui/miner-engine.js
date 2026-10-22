(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GoldMiner=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const origin={x:480,y:88},W=960,H=600;
 function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
 function head(s){return{x:origin.x+Math.sin(s.angle)*s.length,y:origin.y+Math.cos(s.angle)*s.length};}
 function field(level,seed){const rand=random(seed+level*7919),items=[];for(let i=0;i<Math.min(22,15+level);i++){const type=i<2?'diamond':i%4===0?'rock':'gold',size=type==='gold'?[18,27,39][i%3]:type==='rock'?30:16;let p,tries=0;do{const y=205+rand()*335,spread=Math.min(423,(y-origin.y)*1.75);p={x:480+(rand()*2-1)*spread,y};}while(items.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<a.r+size+12)&&++tries<150);if(tries>=150)continue;items.push({...p,id:i,type,r:size,value:type==='diamond'?420:type==='rock'?25:size===39?310:size===27?175:90,weight:type==='rock'?4.8:type==='diamond'?.8:size===39?3.1:size===27?1.8:1.05,shape:rand()*6,removed:false});}return items;}
 function create({level=1,seed=Date.now(),speed=0,bonusTime=0,bombs=2,total=0}={}){const items=field(level,seed),available=items.reduce((n,x)=>n+x.value,0);return{level,seed,speed,bonusTime,bombs,total,items,target:Math.round(available*(.35+Math.min(level-1,8)*.025)/10)*10,score:0,remaining:65+bonusTime*8,phase:'ready',angle:0,length:64,clock:0,hook:'aim',cargo:null,effects:[],lastCatch:null};}
 function start(s){if(s.phase==='ready'||s.phase==='paused')s.phase='playing';}
 function pause(s){if(s.phase==='playing')s.phase='paused';}
 function launch(s){if(s.phase!=='playing'||s.hook!=='aim')return false;s.hook='out';return true;}
 function bomb(s){if(s.phase!=='playing'||s.hook!=='back'||!s.cargo||s.bombs<1)return false;const p=head(s);s.effects.push({...p,life:.55,kind:'blast'});s.cargo=null;s.bombs--;return true;}
 function distance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
 function step(s,dt){if(s.phase!=='playing')return;dt=Math.min(.05,Math.max(0,Number(dt)||0));s.clock+=dt;s.remaining=Math.max(0,s.remaining-dt);s.effects=s.effects.map(x=>({...x,life:x.life-dt})).filter(x=>x.life>0);
  if(s.hook==='aim'){s.angle=Math.sin(s.clock*1.2)*1.12;s.length=64;}
  else if(s.hook==='out'){const prev=head(s);s.length+=480*dt;const next=head(s);const caught=s.items.filter(x=>!x.removed&&distance(x,prev,next)<=x.r+7).sort((a,b)=>Math.hypot(a.x-prev.x,a.y-prev.y)-Math.hypot(b.x-prev.x,b.y-prev.y))[0];if(caught){caught.removed=true;s.cargo={...caught};s.hook='back';}else if(next.x<16||next.x>W-16||next.y>H-20)s.hook='back';}
  else if(s.hook==='back'){s.length-=Math.min(570,270*(1+s.speed*.24)/(s.cargo?.weight||.65))*dt;if(s.length<=64){s.length=64;s.hook='aim';if(s.cargo){const c=s.cargo;s.score+=c.value;s.lastCatch={type:c.type,value:c.value};s.effects.push({x:origin.x,y:150,life:1.2,kind:'score',value:c.value});s.cargo=null;if(s.score>=s.target){s.phase='cleared';s.total+=s.score;}}}}
  if(s.remaining<=0&&s.phase==='playing')s.phase='over';
 }
 function next(s,upgrade){if(s.phase!=='cleared')return s;return create({level:s.level+1,seed:s.seed,speed:s.speed+(upgrade==='speed'?1:0),bonusTime:s.bonusTime+(upgrade==='time'?1:0),bombs:Math.min(9,s.bombs+(upgrade==='bomb'?3:1)),total:s.total});}
 return{create,head,start,pause,launch,bomb,step,next,field,origin,W,H};
});
