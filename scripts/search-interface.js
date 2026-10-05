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

module.exports = { composeSearchScript };
