(function () {
  'use strict';
  if (document.documentElement.dataset.readingListController) return;
  document.documentElement.dataset.readingListController = 'ready';
  const KEY = 'blog-reading-list-v1';
  let undo = null;

  function safePath(value) {
    if (typeof value !== 'string' || !/^\/\d{4}\/\d{2}\/\d{2}\/[^/].*\/$/.test(value) || /[\\?#]/.test(value) || [...value].some(char => char.charCodeAt(0) <= 32)) return false;
    try {
      const decoded = decodeURIComponent(value);
      return !decoded.includes('\\') && ![...decoded].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) && !decoded.split('/').some(part => part === '.' || part === '..');
    } catch { return false; }
  }
  function read() {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [];
    let items;
    try { items = JSON.parse(raw); } catch { throw Object.assign(new Error('本机收藏数据无法识别。可重试读取，或明确重置本机列表。'), { damaged: true }); }
    if (!Array.isArray(items)) throw Object.assign(new Error('本机收藏格式不正确。可重试读取，或明确重置本机列表。'), { damaged: true });
    return [...new Set(items.filter(safePath))];
  }
  function pageUi() {
    const root = document.querySelector('.reading-list-page');
    if (!root) return null;
    const count = root.querySelector('[data-reading-count]');
    const list = root.querySelector('[data-reading-list]');
    const empty = root.querySelector('[data-reading-empty]');
    const status = root.querySelector('[data-reading-status]');
    const clear = root.querySelector('[data-reading-clear]');
    const revert = root.querySelector('[data-reading-undo]');
    const retry = root.querySelector('[data-reading-retry]');
    const reset = root.querySelector('[data-reading-reset]');
    if (!(count instanceof HTMLElement && list instanceof HTMLElement && empty instanceof HTMLElement && status instanceof HTMLElement && clear instanceof HTMLButtonElement && revert instanceof HTMLButtonElement && retry instanceof HTMLButtonElement && reset instanceof HTMLButtonElement)) return null;
    return { root, count, list, empty, status, clear, revert, retry, reset };
  }
  function catalogFor(root) {
    try {
      const data = JSON.parse(root.querySelector('#reading-catalog')?.textContent || '[]');
      return new Map(data.filter(item => item && safePath(item.path) && typeof item.title === 'string').map(item => [item.path, item]));
    } catch { return new Map(); }
  }
  function focusEntry(ui, pathname, index = 0) {
    const rows = [...ui.list.querySelectorAll('[data-reading-entry]')];
    const row = rows.find(item => item.getAttribute('data-reading-path') === pathname) || rows[Math.min(index, rows.length - 1)];
    const target = row?.querySelector('.reading-entry-title, .reading-entry-unavailable') || ui.empty.querySelector('a');
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  }
  function render(items, message = '') {
    for (const button of document.querySelectorAll('[data-reading-toggle]')) {
      if (!(button instanceof HTMLButtonElement)) continue;
      const selected = items.includes(button.dataset.readingPath);
      button.hidden = false;
      button.disabled = false;
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = selected ? '已加入稍后读' : '加入稍后读';
      button.setAttribute('aria-label', `${selected ? '移出' : '加入'}稍后读：${button.dataset.readingTitle || '这篇文章'}`);
      const status = button.parentElement.querySelector('.reading-action-status');
      if (status) status.textContent = '';
    }
    const ui = pageUi();
    if (!ui) return;
    const active = document.activeElement?.closest('[data-reading-entry]');
    const focusPath = active?.getAttribute('data-reading-path');
    const focusIndex = active ? [...ui.list.children].indexOf(active) : 0;
    const catalog = catalogFor(ui.root);
    ui.list.replaceChildren();
    for (const pathname of items) {
      const item = catalog.get(pathname);
      const row = document.createElement('div');
      row.className = 'reading-entry';
      row.setAttribute('role', 'listitem');
      row.setAttribute('data-reading-entry', '');
      row.setAttribute('data-reading-path', pathname);
      const content = document.createElement('div');
      content.className = 'reading-entry-content';
      const title = document.createElement(item ? 'a' : 'span');
      title.className = item ? 'reading-entry-title' : 'reading-entry-unavailable';
      title.textContent = item ? item.title : '暂未在目录中找到';
      if (title instanceof HTMLAnchorElement) title.href = pathname;
      else title.tabIndex = -1;
      const meta = document.createElement('p');
      meta.className = 'reading-entry-meta';
      meta.textContent = item ? [item.date, item.category].filter(Boolean).join(' · ') : pathname;
      content.append(title, meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('data-reading-remove', '');
      remove.setAttribute('data-reading-path', pathname);
      remove.setAttribute('aria-label', `移除：${item?.title || pathname}`);
      remove.textContent = '移除';
      row.append(content, remove);
      ui.list.appendChild(row);
    }
    // 列表由脚本生成，补入站内切页以延续全站音乐播放。
    window.pjax?.refresh(ui.list);
    ui.count.textContent = `${items.length} 篇待阅读`;
    ui.empty.hidden = items.length !== 0;
    ui.clear.hidden = items.length === 0;
    ui.revert.hidden = !undo;
    ui.retry.hidden = true;
    ui.reset.hidden = true;
    ui.status.textContent = message;
    if (focusPath) focusEntry(ui, focusPath, focusIndex);
  }
  function readFailure(error) {
    const message = error?.damaged ? error.message : '暂时无法读取本机收藏，请检查浏览器存储设置后重试。';
    undo = null;
    for (const button of document.querySelectorAll('[data-reading-toggle]')) {
      if (!(button instanceof HTMLButtonElement)) continue;
      button.hidden = false;
      button.disabled = true;
      button.textContent = '暂不可保存';
      const status = button.parentElement.querySelector('.reading-action-status');
      if (status) status.textContent = message;
    }
    const ui = pageUi();
    if (!ui) return;
    ui.list.replaceChildren();
    ui.count.textContent = '本机列表暂不可读';
    ui.empty.hidden = true;
    ui.clear.hidden = true;
    ui.revert.hidden = true;
    ui.retry.hidden = false;
    ui.reset.hidden = !error?.damaged;
    ui.status.textContent = message;
  }
  function refresh(message = '') {
    try { render(read(), message); } catch (error) { readFailure(error); }
  }
  function write(items, status) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
    catch {
      if (status) status.textContent = '未能保存更改，浏览器存储可能不可用或已满。请稍后重试，原收藏未改变。';
      return false;
    }
  }
  document.addEventListener('click', function (event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button[data-reading-toggle], .reading-list-page button');
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;
    if (!button.matches('[data-reading-toggle], [data-reading-remove], [data-reading-clear], [data-reading-undo], [data-reading-retry], [data-reading-reset]')) return;
    const ui = pageUi();
    if (button.hasAttribute('data-reading-retry')) { refresh('已重新读取本机收藏。'); return; }
    if (button.hasAttribute('data-reading-reset')) {
      if (write([], ui?.status)) { undo = null; render([], '本机列表已重置。'); focusEntry(ui, null); }
      return;
    }
    let before;
    try { before = read(); } catch (error) { readFailure(error); return; }
    const status = button.hasAttribute('data-reading-toggle') ? button.parentElement.querySelector('.reading-action-status') : ui?.status;
    if (button.hasAttribute('data-reading-toggle')) {
      const pathname = button.dataset.readingPath;
      if (!safePath(pathname)) return;
      const selected = before.includes(pathname);
      const after = selected ? before.filter(item => item !== pathname) : [pathname, ...before];
      if (!write(after, status)) return;
      undo = null;
      render(after);
      if (status) status.textContent = selected ? '已移出稍后读。' : '已保存到本机稍后读。';
      return;
    }
    if (!ui) return;
    if (button.hasAttribute('data-reading-undo')) {
      if (!undo) return;
      // 撤销前重新比较，避免覆盖另一页面刚保存的文章。
      if (JSON.stringify(before) !== JSON.stringify(undo.after)) { undo = null; render(before, '列表已在其他页面更新，本次移除无法撤销。'); focusEntry(ui, before[0]); return; }
      const restored = undo.before;
      if (!write(restored, status)) return;
      undo = null;
      render(restored, '已撤销移除。');
      focusEntry(ui, restored[0]);
      return;
    }
    const removed = button.dataset.readingPath;
    const after = button.hasAttribute('data-reading-clear') ? [] : before.filter(item => item !== removed);
    if (after.length === before.length || !write(after, status)) return;
    const index = [...ui.list.querySelectorAll('[data-reading-entry]')].indexOf(button.closest('[data-reading-entry]'));
    undo = { before, after };
    render(after, after.length ? '已移除，可以撤销。' : '列表已清空，可以撤销。');
    if (button.hasAttribute('data-reading-clear')) ui.revert.focus({ preventScroll: true });
    else focusEntry(ui, null, Math.max(0, index));
  });
  document.addEventListener('pjax:send', () => { undo = null; });
  document.addEventListener('pjax:complete', () => refresh());
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    undo = null;
    refresh('本机收藏已同步。');
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => refresh(), { once: true });
  else refresh();
}());
