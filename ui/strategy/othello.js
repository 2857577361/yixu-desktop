(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else (root.StrategyEngines||={}).othello=f();})(globalThis,()=>{
 const dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
 const inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
 function initial(){const board=Array(64).fill(0);board[27]=board[36]=2;board[28]=board[35]=1;return {board,turn:1,winner:0,ply:0,log:[]};}
 function flips(s,i,p=s.turn){if(!Number.isInteger(i)||i<0||i>=64||s.board[i])return [];const out=[],r=Math.floor(i/8),c=i%8;for(const [dr,dc] of dirs){const line=[];let y=r+dr,x=c+dc;while(inside(y,x)&&s.board[y*8+x]===3-p){line.push(y*8+x);y+=dr;x+=dc;}if(line.length&&inside(y,x)&&s.board[y*8+x]===p)out.push(...line);}return out;}
 function moves(s,p=s.turn){if(s.winner)return [];return s.board.flatMap((v,i)=>!v&&flips(s,i,p).length?[{i}]:[]);}
 function count(s){return [0,s.board.filter(v=>v===1).length,s.board.filter(v=>v===2).length];}
 function apply(s,a){const list=flips(s,a.i);if(s.winner||!list.length)throw Error('这里不能形成夹击，请选择提示的空格');const x=structuredClone(s),p=s.turn;x.board[a.i]=p;for(const i of list)x.board[i]=p;x.ply++;x.log.push({p,text:label(a)+' · 翻转 '+list.length+' 子'});x.turn=3-p;let skipped=0;if(!moves(x).length){x.turn=p;skipped=3-p;if(!moves(x).length){const n=count(x);x.winner=n[1]===n[2]?3:n[1]>n[2]?1:2;}}
 x.last={...a,p,flipped:list.length,skipped};return x;}
 function evaluate(s,p){const n=count(s);if(s.winner)return s.winner===3?0:s.winner===p?100000:-100000;let score=(n[p]-n[3-p])*(s.ply>44?8:1);const corners=[0,7,56,63];for(const i of corners){if(s.board[i])score+=(s.board[i]===p?1:-1)*180;const r=Math.floor(i/8),c=i%8;for(const [dr,dc] of [[r===0?1:-1,0],[0,c===0?1:-1],[r===0?1:-1,c===0?1:-1]]){const j=(r+dr)*8+c+dc;if(!s.board[i]&&s.board[j])score+=(s.board[j]===p?-1:1)*45;}}
 score+=12*(moves(s,p).length-moves(s,3-p).length);for(let i=0;i<64;i++)if(s.board[i]){const r=Math.floor(i/8),c=i%8;if(dirs.some(([dr,dc])=>inside(r+dr,c+dc)&&!s.board[(r+dr)*8+c+dc]))score+=s.board[i]===p?-4:4;}return score;}
 function label(a){return String.fromCharCode(65+a.i%8)+(Math.floor(a.i/8)+1);}
 function explain(s,a){const n=flips(s,a.i).length;return [0,7,56,63].includes(a.i)?'选择 '+label(a)+' 占住角落；角上的棋子之后不会被翻走。':'选择 '+label(a)+'，本步翻转 '+n+' 子。还要比较下一手给对手留下多少选择；前期吃子多不一定占优。';}
 return {initial,moves,apply,evaluate,label,explain,count,flips,branch:18,depths:[1,3,5]};
});
