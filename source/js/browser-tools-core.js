(function () {
  function formatJSON(source, indent = 2) {
    if (!source.trim()) throw new Error('请先输入 JSON 内容。');
    if (source.length > 200000) throw new Error('输入超过 20 万字符，请分批处理。');
    if (![0, 2, 4].includes(indent)) throw new Error('请选择二或四空格缩进。');
    try { JSON.parse(source); } catch (error) {
      const position = String(error.message).match(/position (\d+)/)?.[1];
      const before = position === undefined ? null : source.slice(0, Number(position));
      const location = before === null ? '' : `，第 ${before.split('\n').length} 行、第 ${before.length - before.lastIndexOf('\n')} 列`;
      throw new Error(`JSON 格式有误${location}。请检查引号、逗号和括号。`);
    }
    // 校验不参与输出，避免长编号、重复键和原始数值写法被重新解释。
    const tokens = source.match(/"(?:[^"\\]|\\.)*"|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]/g) || [];
    if (!indent) return tokens.join('');
    let depth = 0;
    let length = 0;
    const output = [];
    function append(text) {
      length += text.length;
      if (length > 1000000) throw new Error('排版结果超过 100 万字符，可以尝试压缩或分批处理。');
      output.push(text);
    }
    function newline() { append('\n' + ' '.repeat(depth * indent)); }
    tokens.forEach((token, index) => {
      if (token === '{' || token === '[') {
        append(token);
        depth++;
        if (depth > 100) throw new Error('嵌套超过 100 层，可以尝试压缩或分批处理。');
        if (tokens[index + 1] !== (token === '{' ? '}' : ']')) newline();
      } else if (token === '}' || token === ']') {
        depth--;
        if (tokens[index - 1] !== (token === '}' ? '{' : '[')) newline();
        append(token);
      } else if (token === ',') { append(','); newline(); }
      else append(token === ':' ? ': ' : token);
    });
    return output.join('');
  }

  function validMilliseconds(value) {
    if (!Number.isSafeInteger(value) || !Number.isFinite(new Date(value).getTime())) throw new Error('数值超出可转换的日期范围。');
    return value;
  }

  function parseTimestamp(source, unit) {
    const value = source.trim();
    if (value.length > 64) throw new Error('数值超出可转换的日期范围。');
    const pattern = unit === 'seconds' ? /^-?\d+(?:\.\d{1,3})?$/ : /^-?\d+$/;
    if (!pattern.test(value)) throw new Error(unit === 'seconds' ? '请输入有效秒数，最多保留三位小数。' : '请输入有效的整数毫秒数。');
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
    let milliseconds = BigInt(whole);
    if (unit === 'seconds') milliseconds = milliseconds * 1000n + BigInt(fraction.padEnd(3, '0'));
    if (negative) milliseconds = -milliseconds;
    if (milliseconds > 8640000000000000n || milliseconds < -8640000000000000n) throw new Error('数值超出可转换的日期范围。');
    return validMilliseconds(Number(milliseconds));
  }

  function formatDate(milliseconds, offset) {
    validMilliseconds(milliseconds);
    const date = new Date(milliseconds + offset * 60000);
    if (!Number.isFinite(date.getTime())) throw new Error('数值超出可转换的日期范围。');
    const value = date.toISOString();
    if (value.length !== 24 || value.startsWith('0000-')) throw new Error('日期年份须在 0001 到 9999 之间。');
    return value.slice(0, 23);
  }

  function dateToTimestamp(source, offset) {
    const match = source.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
    if (!match) throw new Error('请填写完整日期和时间。');
    if (match[1].startsWith('0000-')) throw new Error('日期年份须在 0001 到 9999 之间。');
    const canonical = `${match[1]}T${match[2]}:${match[3] || '00'}.${(match[4] || '').padEnd(3, '0')}`;
    const utc = Date.parse(canonical + 'Z');
    if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 23) !== canonical) throw new Error('日期或时间无效，请检查年月日和时分秒。');
    return validMilliseconds(utc - offset * 60000);
  }

  function formatSeconds(milliseconds) {
    validMilliseconds(milliseconds);
    const value = BigInt(milliseconds);
    const absolute = value < 0n ? -value : value;
    const fraction = String(absolute % 1000n).padStart(3, '0').replace(/0+$/, '');
    return `${value < 0n ? '-' : ''}${absolute / 1000n}${fraction ? '.' + fraction : ''}`;
  }

  window.BLOG_TOOLS = { formatJSON, parseTimestamp, formatDate, dateToTimestamp, formatSeconds };
})();
