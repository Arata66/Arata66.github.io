function enhanceThemeMotion(source) {
  const marker = "      if ('scrollBehavior' in document.documentElement.style) {";
  const ownMarker = "      // 减少动态效果时直接定位，保留主题原有的导航偏移。";
  if (source.includes(ownMarker)) return source;
  if (source.split(marker).length !== 2) throw new Error('主题滚动结构已改变，需重新核对减少动态效果支持');
  return source.replace(marker, `${ownMarker}
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.scrollTo({ top: pos, behavior: 'auto' })
        return
      }

${marker}`);
}

module.exports = { enhanceThemeMotion };
