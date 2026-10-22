(function(root){
 const add=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const week=date=>add(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7));
 function isWorkday(s,date){if(s.holidays?.[date])return s.holidays[date]==='work';return ![0,6].includes(new Date(date+'T12:00:00Z').getUTCDay());}
 function eligible(s,h,date){if(s.restDays?.[date])return false;if(h.skipHolidays&&s.holidays?.[date]==='holiday')return false;if(h.workdaysOnly)return isWorkday(s,date);if(h.goal?.period==='week')return true;return root.Recurrence.matches(h.recurrence,date,h.days,s);}
 function weekly(s,h,date){const start=week(date),end=add(start,6),goal=s.goalSnapshots?.[start]?.[h.id]||h.goal||{period:'week',unit:'count',target:1};let count=0,minimum=0,seconds=0,rests=0;for(let i=0;i<7;i++){const d=add(start,i),r=s.records[d]?.[h.id];minimum+=r?.minimumCount??(r?.status==='minimum'?1:0);count+=r?.count??(r?.status==='done'?1:0);if(s.restDays?.[d])rests++;}for(const t of s.sessions||[])if(t.habitId===h.id&&t.date>=start&&t.date<=end)seconds+=t.seconds||0;const value=goal.unit==='minutes'?Math.floor(seconds/60):count;return {start,end,unit:goal.unit,target:goal.target,value,minimum,rests,done:value>=goal.target};}
 const api={add,week,isWorkday,eligible,weekly};root.LifeModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
