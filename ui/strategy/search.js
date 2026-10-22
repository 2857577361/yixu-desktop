(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.StrategySearch=f();})(globalThis,()=>{
 function choose(engine,state,level=2,options={}){const p=state.turn,deadline=Date.now()+(options.timeMs||[200,700,1800][level-1]),maxNodes=options.maxNodes||[1200,9000,35000][level-1];let nodes=0,cutoff=false;
  const list=s=>engine.candidates?engine.candidates(s):engine.moves(s).sort((a,b)=>engine.evaluate(engine.apply(s,b),s.turn)-engine.evaluate(engine.apply(s,a),s.turn)).slice(0,engine.branch);
  function search(s,depth,alpha,beta){nodes++;if(nodes>maxNodes||Date.now()>deadline){cutoff=true;return engine.evaluate(s,p);}if(!depth||s.winner||s.scoring)return engine.evaluate(s,p);const moves=list(s).slice(0,engine.branch);if(!moves.length)return engine.evaluate(s,p);const maximizing=s.turn===p;let best=maximizing?-Infinity:Infinity;for(const a of moves){const value=search(engine.apply(s,a,true),depth-1,alpha,beta);if(maximizing){best=Math.max(best,value);alpha=Math.max(alpha,best);}else{best=Math.min(best,value);beta=Math.min(beta,best);}if(beta<=alpha||cutoff)break;}return best;}
  let moves=list(state);if(!moves.length)return {action:null,candidates:[],nodes,depth:0};let ranked=moves.map(a=>({action:a,score:engine.evaluate(engine.apply(state,a,true),p)+(engine.moveScore?engine.moveScore(state,a)*.3:0)})).sort((a,b)=>b.score-a.score),completed=0;
  for(let depth=1;depth<=engine.depths[level-1];depth++){const next=[];for(const entry of ranked){const value=search(engine.apply(state,entry.action,true),depth-1,-Infinity,Infinity)+(engine.moveScore?engine.moveScore(state,entry.action)*.15:0);next.push({action:entry.action,score:value});if(cutoff)break;}if(cutoff)break;ranked=next.sort((a,b)=>b.score-a.score);completed=depth;}
  return {action:ranked[0].action,candidates:ranked.slice(0,3),nodes,depth:completed,explanation:engine.explain(state,ranked[0].action)};
 }
 return {choose};
});
