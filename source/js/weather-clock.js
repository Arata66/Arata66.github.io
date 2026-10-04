// 天气时钟侧栏组件
// 天气 API：和风天气（需在 WEATHER_KEY 填入 API Key，为空则仅显示时钟）
(function () {
  if (document.documentElement.dataset.weatherClockInitialized === 'true') return;
  document.documentElement.dataset.weatherClockInitialized = 'true';
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
    if (!document.querySelector('.weather-clock-card')) return;
    if (!WEATHER_KEY) {
      var wrap = document.querySelector('.wc-weather-wrap');
      if (wrap) wrap.setAttribute('data-enabled', 'false');
      return;
    }

    if (weatherCache && Date.now() - weatherCache.savedAt < CACHE_TIME) {
      renderWeather(weatherCache.now);
      return;
    }
    if (weatherRequest) return;

    var url = 'https://' + API_HOST + '/v7/weather/now?location=' + encodeURIComponent(CITY) + '&key=' + WEATHER_KEY;
    weatherRequest = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('天气请求失败');
        return r.json();
      })
      .then(function (data) {
        if (data.code !== '200' || !validWeather(data.now)) throw new Error('天气暂不可用');
        weatherCache = { savedAt: Date.now(), now: data.now };
        try { localStorage.setItem('weather-clock-cache', JSON.stringify(weatherCache)); } catch (e) {}
        renderWeather(data.now);
      })
      .catch(function () {
        var descEl = document.querySelector('.wc-weather-desc');
        if (descEl) descEl.textContent = '天气暂不可用';
      })
      .finally(function () { weatherRequest = null; });
  }

  function validWeather(now) {
    return now && typeof now.temp === 'string' && typeof now.text === 'string';
  }

  function renderWeather(now) {
    var iconEl = document.querySelector('.wc-weather-icon');
    var tempEl = document.querySelector('.wc-weather-temp');
    var descEl = document.querySelector('.wc-weather-desc');
    if (iconEl) iconEl.textContent = WEATHER_ICON[now.icon] || '🌤️';
    if (tempEl) tempEl.textContent = now.temp + '°C';
    if (descEl) descEl.textContent = now.text;
  }

  function createCard() {
    // 插入到 card_announcement 之后
    var announcementCard = document.querySelector('.card-announcement');
    if (!announcementCard) return null;

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
            '<div class="wc-weather-desc">等待天气更新…</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    announcementCard.parentNode.insertBefore(card, announcementCard.nextSibling);
    return card;
  }

  var CACHE_TIME = 30 * 60 * 1000;
  var weatherCache = null;
  var weatherRequest = null;
  var clockTimer = null;
  var weatherTimer = null;
  var observer = null;
  var idleHandle = null;
  var fallbackTimer = null;
  var pjaxTimer = null;
  var managedCard = null;

  try {
    var savedCache = JSON.parse(localStorage.getItem('weather-clock-cache'));
    if (savedCache && typeof savedCache.savedAt === 'number' && validWeather(savedCache.now) && savedCache.savedAt <= Date.now()) {
      weatherCache = savedCache;
    }
  } catch (e) {}

  function stopTimers() {
    if (clockTimer !== null) clearInterval(clockTimer);
    if (weatherTimer !== null) clearInterval(weatherTimer);
    if (observer) observer.disconnect();
    if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle);
    if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    clockTimer = weatherTimer = idleHandle = fallbackTimer = null;
    observer = null;
  }

  function waitForWeather(card) {
    var activated = false;
    function activate() {
      if (activated || managedCard !== card || !card.isConnected) return;
      activated = true;
      if (observer) observer.disconnect();
      observer = null;
      idleHandle = fallbackTimer = null;
      fetchWeather();
      weatherTimer = setInterval(fetchWeather, CACHE_TIME);
    }
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) activate();
      }, { rootMargin: '200px' });
      observer.observe(card);
    } else if (typeof window.requestIdleCallback === 'function') {
      // 老浏览器仍能读取天气，空闲等待有上限以避免组件一直停留在占位状态。
      idleHandle = window.requestIdleCallback(activate, { timeout: 3000 });
    } else {
      fallbackTimer = setTimeout(activate, 1000);
    }
  }

  function init() {
    var existingCard = document.querySelector('.weather-clock-card');
    if (existingCard && existingCard === managedCard) {
      updateClock();
      return;
    }
    // 切页时取消旧卡片的观察与刷新任务，无侧栏页面不会继续轮询天气。
    stopTimers();
    managedCard = existingCard || createCard();
    if (!managedCard) return;
    updateClock();
    clockTimer = setInterval(updateClock, 1000);
    if (!WEATHER_KEY) return;
    if (weatherCache && Date.now() - weatherCache.savedAt < CACHE_TIME) renderWeather(weatherCache.now);
    waitForWeather(managedCard);
  }

  // Pjax 兼容
  document.addEventListener('pjax:complete', function () {
    if (pjaxTimer !== null) clearTimeout(pjaxTimer);
    pjaxTimer = setTimeout(function () { pjaxTimer = null; init(); }, 100);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
