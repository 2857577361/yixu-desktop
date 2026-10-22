// 国办发明电〔2025〕7号。仅覆盖 2026，后续年份需维护。
// https://www.beijing.gov.cn/zhengce/zhengcefagui/202511/t20251104_4258873.html
const dates={};for(const [month,start,end]of [[1,1,3],[2,15,23],[4,4,6],[5,1,5],[6,19,21],[9,25,27],[10,1,7]])for(let day=start;day<=end;day++)dates[`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`]='holiday';for(const date of ['01-04','02-14','02-28','05-09','09-20','10-10'])dates['2026-'+date]='work';module.exports=dates;
