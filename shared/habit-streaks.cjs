/* Natural-day continuity. Rest days neither count nor break a streak. */
(function(root){
const add=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),thresholds=[7,21,66];
const completed=r=>!!r&&(r.status==='done'||r.status==='minimum'||r.status!=='skipped'&&(r.minimumCount||0)>0);
function calculate(s,id,today){
 const dates=Object.keys(s.records||{}).filter(d=>d<=today&&s.records[d]?.[id]).sort(),first=dates[0];let current=0,longest=0,run=0,reached={};if(!first)return {current,longest,reached,todayRecorded:false};
 for(let d=first;d<=today;d=add(d,1)){
  if(s.restDays?.[d])continue;
  const r=s.records[d]?.[id];
  if(completed(r)){run++;longest=Math.max(longest,run);for(const n of thresholds)if(run>=n&&!reached[n])reached[n]=d;}
  else if(d!==today||r?.status==='skipped')run=0;
 }
 current=run;return {current,longest,reached,todayRecorded:completed(s.records[today]?.[id]),resting:!!s.restDays?.[today]};
}
function reconcile(s,today){for(const h of s.habits||[]){const x=calculate(s,h.id,today);for(const n of thresholds)if(x.reached[n]){s.habitAchievements||=[];const id=h.id+':'+n;if(!s.habitAchievements.some(v=>v.id===id))s.habitAchievements.push({id,habitId:h.id,title:h.title,days:n,date:x.reached[n],createdAt:new Date().toISOString(),acknowledgedAt:null});}}}
const api={calculate,reconcile,completed,thresholds};if(typeof module!=='undefined')module.exports=api;else root.HabitStreaks=api;
})(typeof window==='undefined'?globalThis:window);
