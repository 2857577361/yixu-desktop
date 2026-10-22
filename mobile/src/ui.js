// Update existing nodes so counters, focus and open forms survive routine saves.
const key = node => node.nodeType === 1 ? node.dataset.key || node.id || (node.dataset.form ? `form:${node.dataset.form}:${node.dataset.category || ''}` : node.dataset.act ? `action:${node.dataset.act}:${node.dataset.id || ''}` : node.dataset.page ? `page:${node.dataset.page}` : '') : '';
function patch(old, next) {
  if (old.nodeType !== next.nodeType || old.nodeName !== next.nodeName) { old.replaceWith(next.cloneNode(true)); return; }
  if (old.nodeType === 3) { if (old.nodeValue !== next.nodeValue) old.nodeValue = next.nodeValue; return; }
  if (old.nodeType !== 1) return;
  if (old.matches('form,[data-editing]')) return;
  for (const attr of [...old.attributes]) if (!next.hasAttribute(attr.name) && attr.name !== 'open') old.removeAttribute(attr.name);
  for (const attr of next.attributes) if (attr.name !== 'open' && old.getAttribute(attr.name) !== attr.value) old.setAttribute(attr.name, attr.value);
  patchChildren(old, next);
}
function patchChildren(parent, next) {
  const pool = [...parent.childNodes], used = new Set(); let cursor = parent.firstChild;
  for (const node of next.childNodes) {
    const id = key(node);
    let existing = id ? pool.find(x => !used.has(x) && key(x) === id && x.nodeName === node.nodeName) : pool.find(x => !used.has(x) && !key(x) && x.nodeName === node.nodeName);
    if (!existing) { existing = node.cloneNode(true); parent.insertBefore(existing, cursor); }
    else { if (existing !== cursor) parent.insertBefore(existing, cursor); patch(existing, node); }
    used.add(existing); cursor = existing.nextSibling;
  }
  for (const node of pool) if (!used.has(node) && node.parentNode === parent) node.remove();
}
export function patchRoot(root, html, view) {
  const next = document.createElement('template'); next.innerHTML = html;
  if (root.dataset.view !== view) { root.replaceChildren(next.content); root.dataset.view = view; return true; }
  patchChildren(root, next.content); return false;
}
export function errorMessage(message = '') {
  if (/email not confirmed/i.test(message)) return '邮箱还未验证，请点击确认邮件中的链接，再回来登录。';
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不正确，请检查后再试。';
  if (/rate limit|too many requests/i.test(message)) return '操作太频繁，请稍等片刻再试。';
  if (/fetch|network|timeout/i.test(message)) return '网络暂时不可用，记录仍保存在本机。';
  return message;
}
export function icon(name) {
 const paths = {checkins:'M5 12l4 4L19 6',habits:'M12 3v3m0 12v3M3 12h3m12 0h3M8 8l8 8m0-8l-8 8',today:'M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',records:'M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 4h6m-6 4h6m-6 4h4',plan:'M5 5h14v15H5zM8 3v4m8-4v4M5 10h14m-10 4h1m4 0h1m-6 3h1',mine:'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 21v-2a7 7 0 0 1 14 0v2',sync:'M20 7v5h-5M4 17v-5h5m10-3a7 7 0 0 0-12-3m-2 9a7 7 0 0 0 12 3'};
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.records}"/></svg>`;
}
