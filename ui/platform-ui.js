const platformIsMac=window.yixu.platform==='darwin';
const platformCommand=platformIsMac?'⌘':'Ctrl+';
const platformShortcut=platformIsMac?'⌘⇧Space':'Ctrl+Shift+Space';
document.documentElement.dataset.platform=window.yixu.platform;
if(!platformIsMac){
 const launch=document.querySelector('.command-launch');
 if(launch){launch.setAttribute('aria-label','快速查找，快捷键 Ctrl K');launch.querySelector('small').textContent='Ctrl+K';}
 const css=document.createElement('style');
 css.textContent='html[data-platform="win32"] .dragbar{display:none}html[data-platform="win32"] .sidebar{padding-top:30px}html[data-platform="win32"] main{padding-top:32px}html[data-platform="win32"] .sticky main{padding-top:22px}html[data-platform="win32"] body{font-family:"Segoe UI","Microsoft YaHei",sans-serif}';
 document.head.append(css);
}
