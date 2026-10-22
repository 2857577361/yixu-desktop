/* Stable association between a daily habit outcome and its focus session. */
(function(root){
const normalize=v=>String(v||'').replace(/\[([^\]]+)\]\(yixu-hook:([a-f0-9-]+):[01]:[0-9-]+\)/g,'$1 @hook:$2').normalize('NFKC').replace(/\s+/g,' ').trim();
function find(s,date,id,r=s.records?.[date]?.[id]){if(!r)return null;const rows=(s.sessions||[]).filter(x=>x.date===date&&x.habitId===id),linked=rows.find(x=>x.id===r.sourceSessionId);if(linked)return linked;const text=normalize(r.note),same=rows.filter(x=>normalize(x.note)===text),near=same.filter(x=>Math.abs(Date.parse(r.at)-Number(x.endedAt))<5000);if(near.length===1)return near[0];return same.length===1&&text.replace(/ @hook:[a-f0-9-]+/g,'').length>=20?same[0]:null;}
function reconcile(s){const changed=[];for(const [date,rs]of Object.entries(s.records||{}))for(const [id,r]of Object.entries(rs)){const x=find(s,date,id,r);if(x&&r.sourceSessionId!==x.id){r.sourceSessionId=x.id;changed.push({date,habitId:id,sessionId:x.id});}}return changed;}
function update(s,date,id,r,body,now=new Date().toISOString()){const x=find(s,date,id,r);if(!x)return;r.sourceSessionId=x.id;x.note=body;x.updatedAt=now;x.revision=globalThis.crypto.randomUUID();}
const api={normalize,find,reconcile,update};if(typeof module!=='undefined')module.exports=api;else root.RecordLinks=api;
})(typeof window==='undefined'?globalThis:window);
