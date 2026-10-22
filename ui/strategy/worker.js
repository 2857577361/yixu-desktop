importScripts('othello.js','go.js','quoridor.js','hive.js','search.js');
onmessage=e=>{const {id,kind,state,level,hint}=e.data;try{const result=StrategySearch.choose(StrategyEngines[kind],state,level);postMessage({id,kind,hint,result});}catch(err){postMessage({id,kind,hint,error:err.message});}};
