if (typeof hexo !== 'undefined') {
  // Hexo 的模型早于配置创建，统一本次进程时区以保留凌晨文章路径。
  process.env.TZ = hexo.config.timezone || 'Asia/Shanghai';
}
