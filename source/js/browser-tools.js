(function () {
  let cleanup = () => {};
  let navigating = false;
  const savedValues = new Map();
  let suspendedPage = null;

  function init() {
    if (navigating) return;
    const target = document.querySelector('.browser-tools');
    if (!(target instanceof HTMLElement) || target.dataset.toolsReady || !window.BLOG_TOOLS) return;
    cleanup();
    const page = target;
    const core = window.BLOG_TOOLS;
    function field(id) { return page.querySelector('#' + id); }
    const jsonInput = field('json-input');
    const jsonOutput = field('json-output');
    const indent = field('json-indent');
    const stamp = field('timestamp-input');
    const unit = field('timestamp-unit');
    const date = field('date-input');
    const zone = field('time-zone');
    const seconds = field('timestamp-seconds');
    const milliseconds = field('timestamp-ms');
    if (!(jsonInput instanceof HTMLTextAreaElement) || !(jsonOutput instanceof HTMLTextAreaElement) || !(indent instanceof HTMLSelectElement) || !(stamp instanceof HTMLInputElement) || !(unit instanceof HTMLSelectElement) || !(date instanceof HTMLInputElement) || !(zone instanceof HTMLSelectElement) || !(seconds instanceof HTMLInputElement) || !(milliseconds instanceof HTMLInputElement)) return;
    const ui = { jsonInput, jsonOutput, indent, stamp, unit, date, zone, seconds, milliseconds };
    const resumed = suspendedPage === page;
    suspendedPage = null;
    if (!resumed) {
      for (const [name, node] of Object.entries(ui)) {
        if (savedValues.has(name)) node.value = savedValues.get(name);
      }
    }
    const jsonStatus = field('json-status');
    const timeStatus = field('time-status');
    let active = true;
    let currentTime = ui.milliseconds.value ? Number(ui.milliseconds.value) : null;
    const removers = [];
    const pending = new Map();
    page.dataset.toolsReady = 'true';

    function button(name) { return page.querySelector(`button[data-tool-action="${name}"]`); }
    function enable(name, enabled) { const node = button(name); if (node instanceof HTMLButtonElement) node.disabled = !enabled; }
    function listen(node, event, handler) {
      node.addEventListener(event, handler);
      removers.push(() => node.removeEventListener(event, handler));
    }
    function jsonReady(ready) { enable('json-copy', ready); enable('json-download', ready); }
    function clearJSONResult() { ui.jsonOutput.value = ''; jsonReady(false); }
    function clearTimeResult() {
      currentTime = null;
      ui.seconds.value = ''; ui.milliseconds.value = '';
      enable('time-copy-seconds', false); enable('time-copy-ms', false);
    }
    function processJSON(compress) {
      try {
        ui.jsonOutput.value = core.formatJSON(ui.jsonInput.value, compress ? 0 : Number(ui.indent.value));
        jsonReady(true);
        jsonStatus.textContent = compress ? 'JSON 校验通过，已压缩。' : `JSON 校验通过，已按 ${ui.indent.value} 个空格排版。`;
      } catch (error) { clearJSONResult(); jsonStatus.textContent = error.message; }
    }
    function renderTime(value) {
      const display = core.formatDate(value, Number(ui.zone.value));
      ui.date.value = display;
      ui.seconds.value = core.formatSeconds(value);
      ui.milliseconds.value = String(value);
      ui.stamp.value = ui.unit.value === 'seconds' ? ui.seconds.value : ui.milliseconds.value;
      currentTime = value;
      enable('time-copy-seconds', true); enable('time-copy-ms', true);
      timeStatus.textContent = `转换完成 · ${Number(ui.zone.value) ? 'UTC+8（北京时间）' : 'UTC（协调世界时）'} · ${display.replace('T', ' ')}`;
    }
    function convert(fromDate) {
      try { renderTime(fromDate ? core.dateToTimestamp(ui.date.value, Number(ui.zone.value)) : core.parseTimestamp(ui.stamp.value, ui.unit.value)); }
      catch (error) { clearTimeResult(); timeStatus.textContent = error.message; }
    }
    async function copy(output, control, status) {
      const value = output.value;
      if (!value) return;
      control.disabled = true;
      let timeout;
      const attempt = { status, output, cancel: () => {} };
      pending.set(control, attempt);
      status.textContent = '正在复制…';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('剪贴板不可用');
        const request = navigator.clipboard.writeText(value);
        const deadline = new Promise((resolve, reject) => {
          attempt.cancel = () => reject(new Error('复制操作已取消'));
          timeout = setTimeout(() => reject(new Error('复制等待超时')), 3000);
        });
        await Promise.race([request, deadline]);
        if (!active || !page.isConnected || output.value !== value || pending.get(control) !== attempt) return;
        status.textContent = '已复制，可以粘贴使用。';
      } catch {
        if (!active || !page.isConnected || output.value !== value || pending.get(control) !== attempt) return;
        status.textContent = '复制未成功，可以选中结果手动复制。';
        if (document.activeElement === control) { output.focus(); output.select(); }
      } finally {
        clearTimeout(timeout);
        if (pending.get(control) === attempt) {
          pending.delete(control);
          if (active && page.isConnected && output.value === value) control.disabled = false;
        }
      }
    }

    const actions = {
      'json-format': () => processJSON(false),
      'json-minify': () => processJSON(true),
      'json-example': () => {
        ui.jsonInput.value = '{"站点":"Arata66 の Blog","工具":["JSON","时间戳"],"编号":9007199254740993}';
        clearJSONResult(); jsonStatus.textContent = '已填入示例，点击格式化或压缩。';
      },
      'json-clear': () => { ui.jsonInput.value = ''; clearJSONResult(); jsonStatus.textContent = '已清空，可以输入新的内容。'; ui.jsonInput.focus(); },
      'json-copy': event => copy(ui.jsonOutput, event.currentTarget, jsonStatus),
      'json-download': () => {
        if (!ui.jsonOutput.value) return;
        const url = URL.createObjectURL(new Blob([ui.jsonOutput.value], { type: 'application/json;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'formatted.json';
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        jsonStatus.textContent = '已生成 JSON 下载文件。';
      },
      'time-from-stamp': () => convert(false),
      'time-from-date': () => convert(true),
      'time-now': () => { ui.unit.value = 'milliseconds'; ui.stamp.value = String(Date.now()); convert(false); },
      'time-copy-seconds': event => copy(ui.seconds, event.currentTarget, timeStatus),
      'time-copy-ms': event => copy(ui.milliseconds, event.currentTarget, timeStatus)
    };
    Object.entries(actions).forEach(([name, handler]) => {
      const node = button(name);
      if (!(node instanceof HTMLButtonElement)) return;
      node.hidden = false;
      listen(node, 'click', handler);
    });
    listen(ui.jsonInput, 'input', () => { clearJSONResult(); jsonStatus.textContent = '输入已更新，点击格式化或压缩。'; });
    for (const node of [ui.stamp, ui.date]) listen(node, 'input', () => { clearTimeResult(); timeStatus.textContent = '输入已更新，请选择转换方向。'; });
    listen(ui.unit, 'change', () => { clearTimeResult(); timeStatus.textContent = '单位已更新，点击转换成日期。'; });
    listen(ui.zone, 'change', () => {
      if (currentTime === null) return;
      try { renderTime(currentTime); }
      catch (error) { clearTimeResult(); timeStatus.textContent = error.message; }
    });
    // 导航取消会保留原节点，等待期间的新输入优先于离页快照。
    if (resumed) {
      if (ui.jsonInput.value !== savedValues.get('jsonInput')) clearJSONResult();
      if (['stamp', 'date', 'unit', 'zone'].some(name => ui[name].value !== savedValues.get(name))) clearTimeResult();
    }
    jsonReady(!!ui.jsonOutput.value);
    enable('time-copy-seconds', !!ui.seconds.value); enable('time-copy-ms', !!ui.milliseconds.value);
    if (savedValues.size) {
      if (ui.jsonInput.value || ui.jsonOutput.value) jsonStatus.textContent = ui.jsonOutput.value ? '已恢复输入与处理结果，可以继续使用。' : '已恢复输入，可继续修改或处理。';
      if (ui.stamp.value || ui.date.value) timeStatus.textContent = currentTime !== null ? '已恢复输入与转换结果，可以继续使用。' : '已恢复输入，请选择转换方向。';
    }
    cleanup = () => {
      if (!active) return;
      // 仅在本标签的脚本内存中保留往返内容，完整刷新后自然清空。
      for (const [name, node] of Object.entries(ui)) savedValues.set(name, node.value);
      suspendedPage = page;
      active = false;
      removers.forEach(remove => remove());
      pending.forEach((attempt, control) => {
        attempt.cancel();
        control.disabled = !attempt.output.value;
        attempt.status.textContent = '复制操作已取消，可以重新复制。';
      });
      pending.clear();
      delete page.dataset.toolsReady;
    };
  }

  document.addEventListener('pjax:send', () => { navigating = true; cleanup(); });
  document.addEventListener('pjax:complete', () => { navigating = false; init(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
