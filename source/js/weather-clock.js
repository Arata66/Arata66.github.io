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
    // 长时间停留也要撤下过旧数据，无需增加额外天气轮询。
    if (weatherCache && Date.now() - weatherCache.savedAt >= MAX_STALE_TIME) {
      weatherCache = null;
      renderWeatherState();
    }
  }

  function fetchWeather(force) {
    if (!document.querySelector('.weather-clock-card')) return;
    if (!WEATHER_KEY) {
      var wrap = document.querySelector('.wc-weather-wrap');
      if (wrap) wrap.setAttribute('data-enabled', 'false');
      return;
    }

    if (force !== true && weatherCache && Date.now() - weatherCache.savedAt < CACHE_TIME) {
      renderWeatherState();
      return;
    }
    if (weatherRequest) return;

    var url = 'https://' + API_HOST + '/v7/weather/now?location=' + encodeURIComponent(CITY) + '&key=' + WEATHER_KEY;
    weatherState = 'loading';
    renderWeatherState();
    var controller = new AbortController();
    var timedOut = false;
    var timeout;
    var deadline = new Promise(function (resolve, reject) {
      timeout = setTimeout(function () {
        timedOut = true;
        reject(new Error('天气请求超时'));
        controller.abort();
      }, 15000);
    });
    // 解析也可能停住，超时后迟到结果不再更新天气或缓存。
    var request = fetch(url, { signal: controller.signal })
      .then(function (r) {
        if (!r.ok) throw new Error('天气请求失败');
        return r.json();
      });
    weatherRequest = Promise.race([request, deadline])
      .then(function (data) {
        if (!data || data.code !== '200' || !validWeather(data.now)) throw new Error('天气暂不可用');
        weatherCache = { savedAt: Date.now(), now: data.now };
        try { localStorage.setItem('weather-clock-cache', JSON.stringify(weatherCache)); } catch (e) {}
        weatherState = 'ready';
        renderWeatherState();
      })
      .catch(function () {
        weatherState = 'error';
        weatherError = timedOut ? '更新超时' : '更新失败';
        renderWeatherState();
      })
      .finally(function () {
        clearTimeout(timeout);
        weatherRequest = null;
      });
  }

  function validWeather(now) {
    return now && typeof now.temp === 'string' && now.temp.trim() && Number.isFinite(Number(now.temp)) && typeof now.text === 'string' && now.text.trim();
  }

  function renderWeatherState() {
    if (!managedCard || !managedCard.isConnected) return;
    var cached = weatherCache && Date.now() - weatherCache.savedAt < MAX_STALE_TIME;
    var now = cached ? weatherCache.now : null;
    managedCard.querySelector('.wc-weather-icon').textContent = now ? WEATHER_ICON[now.icon] || '🌤️' : '🌤️';
    managedCard.querySelector('.wc-weather-temp').textContent = now ? now.temp + '°C' : '--°C';
    managedCard.querySelector('.wc-weather-desc').textContent = now ? now.text : weatherState === 'error' ? '天气暂不可用' : '等待天气更新…';
    var message = weatherState === 'loading' ? '天气更新中…' : weatherState === 'error' ? weatherError + '，可以刷新重试。' : '';
    if (cached) {
      var updated = new Date(weatherCache.savedAt);
      var time = (updated.getMonth() + 1) + '月' + updated.getDate() + '日 ' + pad(updated.getHours()) + ':' + pad(updated.getMinutes());
      var stale = weatherState === 'error' || Date.now() - weatherCache.savedAt >= CACHE_TIME;
      message += (message ? ' ' : '') + (stale ? '上次更新 ' : '更新于 ') + time;
    }
    managedCard.querySelector('.wc-weather-status').textContent = message;
    // 加载期间保留按钮焦点，共享请求仍阻止重复刷新。
    managedCard.querySelector('.wc-refresh').setAttribute('aria-disabled', String(weatherState === 'loading'));
    managedCard.querySelector('.wc-weather-wrap').setAttribute('aria-busy', String(weatherState === 'loading'));
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
        '<div class="wc-weather-heading">' +
          '<span class="wc-weather-label">杭州天气</span>' +
          '<button type="button" class="wc-refresh" aria-label="刷新杭州天气">刷新</button>' +
        '</div>' +
        '<div class="wc-weather">' +
          '<div class="wc-weather-icon">🌤️</div>' +
          '<div class="wc-weather-info">' +
            '<div class="wc-weather-temp">--°C</div>' +
            '<div class="wc-weather-desc">等待天气更新…</div>' +
          '</div>' +
        '</div>' +
        '<div class="wc-weather-status" role="status" aria-live="polite"></div>' +
      '</div>';

    card.querySelector('.wc-refresh').addEventListener('click', function () { fetchWeather(true); });
    announcementCard.parentNode.insertBefore(card, announcementCard.nextSibling);
    return card;
  }

  var CACHE_TIME = 30 * 60 * 1000;
  var MAX_STALE_TIME = 24 * 60 * 60 * 1000;
  var weatherState = 'idle';
  var weatherError = '';
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
    renderWeatherState();
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
