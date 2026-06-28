// 天气时钟侧栏组件
// 天气 API：和风天气（需在 WEATHER_KEY 填入 API Key，为空则仅显示时钟）
(function () {
  var WEATHER_KEY = 'b91075fe9ba547a99a3709751b028d07';
  var API_HOST = 'm278m3h4kt.re.qweatherapi.com';
  var CITY = '101210101';  // 杭州

  var WEEK_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  // 天气代码 → emoji
  var WEATHER_ICON = {
    '100': '☀️', '101': '⛅', '102': '🌤️', '103': '🌤️', '104': '☁️',
    '150': '🌙', '151': '🌙', '153': '🌙',
    '300': '🌦️', '301': '🌧️', '302': '⛈️', '303': '⛈️', '304': '⛈️',
    '305': '🌧️', '306': '🌧️', '307': '🌧️', '308': '🌧️',
    '309': '🌦️', '310': '🌧️', '311': '🌧️', '312': '🌧️',
    '313': '🌦️', '314': '🌧️', '315': '🌧️', '316': '🌧️', '317': '🌧️',
    '400': '❄️', '401': '❄️', '402': '❄️', '403': '❄️',
    '404': '🌨️', '405': '🌨️', '406': '🌨️', '407': '🌨️',
    '500': '🌫️', '501': '🌫️', '502': '🌫️', '503': '🌫️', '504': '🌫️',
    '507': '🌫️', '508': '🌫️', '509': '🌫️', '510': '🌫️', '511': '🌫️', '512': '🌫️', '513': '🌫️',
    '900': '🌡️', '901': '❄️'
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function updateClock() {
    var now = new Date();
    var timeEl = document.querySelector('.wc-time');
    var dateEl = document.querySelector('.wc-date');
    if (timeEl) timeEl.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (dateEl) dateEl.textContent = (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + WEEK_CN[now.getDay()];
  }

  function fetchWeather() {
    if (!WEATHER_KEY) {
      var wrap = document.querySelector('.wc-weather-wrap');
      if (wrap) wrap.setAttribute('data-enabled', 'false');
      return;
    }

    var url = 'https://' + API_HOST + '/v7/weather/now?location=' + encodeURIComponent(CITY) + '&key=' + WEATHER_KEY;
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.code !== '200' || !data.now) return;
        var now = data.now;
        var iconEl = document.querySelector('.wc-weather-icon');
        var tempEl = document.querySelector('.wc-weather-temp');
        var descEl = document.querySelector('.wc-weather-desc');
        if (iconEl) iconEl.textContent = WEATHER_ICON[now.icon] || '🌤️';
        if (tempEl) tempEl.textContent = now.temp + '°C';
        if (descEl) descEl.textContent = now.text;
      })
      .catch(function () {
        var wrap = document.querySelector('.wc-weather-wrap');
        if (wrap) wrap.setAttribute('data-enabled', 'false');
      });
  }

  function createCard() {
    // 插入到 card_announcement 之后
    var announcementCard = document.querySelector('.card-announcement');
    if (!announcementCard) return;

    var card = document.createElement('div');
    card.className = 'card-widget weather-clock-card';
    card.innerHTML =
      '<div class="wc-time">00:00:00</div>' +
      '<div class="wc-date"></div>' +
      '<div class="wc-divider"></div>' +
      '<div class="wc-weather-wrap" data-enabled="' + (WEATHER_KEY ? 'true' : 'false') + '">' +
        '<div class="wc-weather">' +
          '<div class="wc-weather-icon">🌤️</div>' +
          '<div class="wc-weather-info">' +
            '<div class="wc-weather-temp">--°C</div>' +
            '<div class="wc-weather-desc">加载中…</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    announcementCard.parentNode.insertBefore(card, announcementCard.nextSibling);
  }

  var clockTimer = null;
  var weatherTimer = null;

  function init() {
    // 去重保护：避免 pjax 回调重复创建卡片和定时器
    if (document.querySelector('.weather-clock-card')) {
      updateClock();
      return;
    }
    createCard();
    updateClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 1000);
    fetchWeather();
    if (weatherTimer) clearInterval(weatherTimer);
    weatherTimer = setInterval(fetchWeather, 30 * 60 * 1000);
  }

  // Pjax 兼容
  document.addEventListener('pjax:complete', function () { setTimeout(init, 100); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
