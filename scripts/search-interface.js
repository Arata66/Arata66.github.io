const { JSDOM } = require('jsdom');

function composeSearchScript(themeScript, interfaceScript) {
  const marker = "window.addEventListener('load', () => {";
  const ownMarker = '// 本站搜索界面\n';
  const selectedMarker = themeScript.includes(ownMarker) ? ownMarker : marker;
  const boundary = themeScript.indexOf(selectedMarker);
  if (boundary < 0 || themeScript.indexOf(selectedMarker, boundary + selectedMarker.length) >= 0 || !themeScript.slice(0, boundary).includes('class LocalSearch') || !interfaceScript.trim()) {
    throw new Error('主题搜索脚本结构已改变，需重新核对界面集成');
  }
  // 保留主题匹配算法，本站界面不再等待图片或第三方资源完成。
  return themeScript.slice(0, boundary) + ownMarker + interfaceScript;
}

function enhanceSearchIndex(xml, journal) {
  const dom = new JSDOM(xml, { contentType: 'text/xml' });
  const document = dom.window.document;
  if (document.documentElement.tagName !== 'search') throw new Error('搜索索引格式无效');
  for (const entry of document.querySelectorAll('entry')) {
    if (entry.querySelector('kind')?.textContent === 'journal') entry.remove();
  }
  for (const note of journal) {
    const entry = document.createElement('entry');
    for (const [key, value] of Object.entries({ title: note.title, content: note.text, url: `/journal/#journal-${note.id}`, kind: 'journal', category: note.category, date: note.date })) {
      const field = document.createElement(key);
      field.textContent = value;
      entry.append(field);
    }
    document.documentElement.append(entry);
  }
  const output = dom.serialize();
  dom.window.close();
  return output;
}

module.exports = { composeSearchScript, enhanceSearchIndex };
