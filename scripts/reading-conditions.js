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

function enhanceThemeToc(source) {
  const marker = '    const findHeadPosition = top => {';
  const ownMarker = '      // 手机查看流式目录时保留阅读章节，避免目录被滚到最后一项。';
  let enhanced = source;
  if (!enhanced.includes(ownMarker)) {
    if (enhanced.split(marker).length !== 2) throw new Error('主题目录结构已改变，需重新核对手机目录定位');
    enhanced = enhanced.replace(marker, `${marker}
${ownMarker}
      if (isToc && window.matchMedia('(max-width: 900px)').matches && $cardToc.closest('#card-toc').classList.contains('open')) return
`);
  }
  const positionMarker = '        if (top > btf.getEleTop(ele) - 80) {';
  const ownPositionMarker = '        // 手机按标题实际显示位置判断章节，与目录跳转后的阅读位置一致。';
  if (enhanced.includes(ownPositionMarker)) return enhanced;
  if (enhanced.split(positionMarker).length !== 2) throw new Error('主题章节位置结构已改变，需重新核对手机章节高亮');
  return enhanced.replace(positionMarker, `${ownPositionMarker}
        const headingTop = window.matchMedia('(max-width: 900px)').matches ? ele.getBoundingClientRect().top : btf.getEleTop(ele) - top
        if (headingTop < 80) {`);
}

module.exports = { enhanceThemeMotion, enhanceThemeToc };
