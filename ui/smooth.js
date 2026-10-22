// Reconcile existing DOM on the same page; keep nodes, focus, selection and scroll.
let renderedPage='';
function nodeKey(n){if(n.nodeType!==1)return '';return n.id||n.dataset.key||(n.dataset.id?`${n.tagName}:${n.dataset.id}:${n.dataset.action?(n.dataset.action+':'+(n.dataset.operation||'')):n.dataset.entryField||n.dataset.taskField||''}`:'')||(n.dataset.cellDate?`cell:${n.dataset.cellDate}:${n.dataset.cellCategory}`:'')||(n.name?`${n.tagName}:${n.name}`:'');}
function patchNode(a,b){
 if(a.nodeType!==b.nodeType||a.nodeName!==b.nodeName){a.replaceWith(b.cloneNode(true));return;}
 if(a.nodeType!==1){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return;}
 if(a.classList.contains('rich-host')&&b.classList.contains('rich-host')&&a.dataset.key===b.dataset.key){const source=a.querySelector('textarea'),next=b.querySelector('textarea');if(source.value!==next.value&&!a.contains(document.activeElement)){source.value=next.value;richSyncFromSource(source);}return;}
 if(a.id==='reader-surface'&&a.dataset.renderKey===b.dataset.renderKey)return;
 const focused=a===document.activeElement,opened=a.tagName==='DETAILS'&&a.open;
 for(const attr of [...a.attributes])if(!b.hasAttribute(attr.name)&&!(attr.name==='open'&&opened))a.removeAttribute(attr.name);
 for(const attr of [...b.attributes])if(a.getAttribute(attr.name)!==attr.value)a.setAttribute(attr.name,attr.value);
 if(a.matches('input,textarea')){if(!focused&&a.value!==b.value)a.value=b.value;if(a.type==='checkbox')a.checked=b.checked;return;}
 if(a.tagName==='CANVAS')return;
 patchChildren(a,b);if(a.tagName==='SELECT'&&!focused)a.value=b.value;
}
function patchChildren(a,b){let cursor=a.firstChild;for(const next of [...b.childNodes]){const key=nodeKey(next);let found=key?[...a.childNodes].find(n=>nodeKey(n)===key):cursor&&!nodeKey(cursor)&&cursor.nodeName===next.nodeName?cursor:null;if(!found){found=next.cloneNode(true);a.insertBefore(found,cursor);}else{if(found!==cursor)a.insertBefore(found,cursor);patchNode(found,next);}cursor=found.nextSibling;}while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}}
function paintPage(html){const host=document.querySelector('#main');const t=document.createElement('template');t.innerHTML='<div class="page">'+html+'</div>';prepareRichEditors(t.content);if(renderedPage!==page||!host.firstChild){host.replaceChildren(t.content.cloneNode(true));renderedPage=page;}else{const scrolls=[...host.querySelectorAll('*')].filter(e=>e.scrollTop||e.scrollLeft).map(e=>[e,e.scrollTop,e.scrollLeft]);const x=window.scrollX,y=window.scrollY;patchChildren(host,t.content);for(const [e,top,left]of scrolls)if(e.isConnected){e.scrollTop=top;e.scrollLeft=left;}window.scrollTo(x,y);}}
