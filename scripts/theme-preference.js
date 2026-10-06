const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '../source/js/theme-preference.js'), 'utf8');

function enhanceThemePreference(html) {
  if (html.includes('<script data-theme-preference>')) return html;
  const anchor = /<script>(?:(?!<\/script>)[\s\S])*?\bconst saveToLocal =/;
  if (!anchor.test(html)) throw new Error('主题初始化结构变化，无法提前迁移旧主题偏好');
  return html.replace(anchor, match => '<script data-theme-preference>' + migration + '</script>' + match);
}

module.exports = { enhanceThemePreference };
