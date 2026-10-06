(function () {
  try {
    var previous = localStorage.getItem('theme');
    // 旧快捷菜单保存了裸字符串，必须先迁移再交给主题读取。
    if (previous === 'dark' || previous === 'light') {
      localStorage.setItem('theme', JSON.stringify({ value: previous, expiry: Date.now() + 2 * 86400000 }));
    }
  } catch {
    // 无法访问存储时不影响其余初始化。
  }
})();
