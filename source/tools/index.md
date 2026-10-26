---
title: 随手工具
type: page
comments: false
aside: false
description: 在浏览器中校验、格式化和压缩 JSON，或在明确单位与时区下双向转换时间戳和日期。
---

<section class="browser-tools" aria-labelledby="tools-title">
  <header class="tools-header"><div><p class="tools-eyebrow">折腾时，顺手用一下</p><h2 id="tools-title">少开一个窗口，多省一点时间</h2><p>整理一段 JSON，或者对一下时间。输入内容在当前浏览器页面中处理。</p><p>站内切页会保留当前输入与结果，刷新页面后清空。</p></div><nav class="tools-jump" aria-label="选择工具"><a href="#tool-json">JSON 处理</a><a href="#tool-time">时间转换</a></nav></header>
  <noscript><p class="tools-no-script">这两个工具需要启用 JavaScript 后使用，输入内容不会发送到本站服务器。</p></noscript>
  <section class="tool-section" id="tool-json" aria-labelledby="json-title">
    <div class="tool-section-heading"><div><p class="tools-eyebrow">01 / 整理数据</p><h3 id="json-title">JSON 处理</h3></div><p>校验 · 格式化 · 压缩</p></div>
    <p class="tool-note">保留长数字编号、转义和数值写法。支持对象、数组，以及字符串、数字等单一值。</p>
    <div class="tool-toolbar"><label for="json-indent">缩进</label><select id="json-indent"><option value="2">2 个空格</option><option value="4">4 个空格</option></select><button type="button" data-tool-action="json-example" hidden>填入示例</button><button type="button" data-tool-action="json-clear" hidden>清空</button></div>
    <div class="json-editors"><div><label for="json-input">原始内容</label><textarea id="json-input" rows="14" wrap="off" spellcheck="false" placeholder="粘贴 JSON 内容，或点击填入示例" autocapitalize="off" autocomplete="off"></textarea></div><div><label for="json-output">处理结果</label><textarea id="json-output" rows="14" wrap="off" readonly spellcheck="false" placeholder="处理结果会出现在这里"></textarea></div></div>
    <div class="tool-actions"><button class="tool-primary" type="button" data-tool-action="json-format" hidden>校验并格式化</button><button type="button" data-tool-action="json-minify" hidden>压缩</button><button type="button" data-tool-action="json-copy" disabled hidden>复制结果</button><button type="button" data-tool-action="json-download" disabled hidden>下载 JSON</button></div>
    <p class="tool-status" id="json-status" role="status" aria-live="polite">输入后选择格式化或压缩。修改输入会清除旧结果。</p>
  </section>
  <section class="tool-section" id="tool-time" aria-labelledby="time-title">
    <div class="tool-section-heading"><div><p class="tools-eyebrow">02 / 对一下时间</p><h3 id="time-title">时间戳与日期</h3></div><p>双向转换</p></div>
    <p class="tool-note">Unix 时间戳从 1970-01-01 00:00:00 UTC 起算。先选好单位和时区，小数秒最多支持三位。</p>
    <div class="tool-toolbar"><label for="time-zone">日期显示时区</label><select id="time-zone"><option value="480">UTC+8（北京时间）</option><option value="0">UTC（协调世界时）</option></select><button type="button" data-tool-action="time-now" hidden>填入当前时间</button></div>
    <div class="time-converters"><div class="time-direction"><label for="timestamp-input">时间戳</label><div class="timestamp-entry"><input id="timestamp-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="例如 1700000000"><select id="timestamp-unit" aria-label="时间戳单位"><option value="seconds">秒</option><option value="milliseconds">毫秒</option></select></div><button type="button" data-tool-action="time-from-stamp" hidden>转换成日期 →</button></div><div class="time-direction"><label for="date-input">所选时区的日期</label><input id="date-input" type="datetime-local" step="0.001"><button type="button" data-tool-action="time-from-date" hidden>← 转换成时间戳</button></div></div>
    <div class="time-results"><div><label for="timestamp-seconds">Unix 时间戳 · 秒</label><div><input id="timestamp-seconds" type="text" readonly placeholder="等待转换"><button type="button" data-tool-action="time-copy-seconds" disabled hidden>复制秒</button></div></div><div><label for="timestamp-ms">Unix 时间戳 · 毫秒</label><div><input id="timestamp-ms" type="text" readonly placeholder="等待转换"><button type="button" data-tool-action="time-copy-ms" disabled hidden>复制毫秒</button></div></div></div>
    <p class="tool-status" id="time-status" role="status" aria-live="polite">选择一个方向开始转换，也可以填入当前时间。</p>
  </section>
</section>
