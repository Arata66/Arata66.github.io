(function () {
  let cleanup = () => {};
  let navigating = false;

  function init() {
    if (navigating) return;
    const page = document.querySelector('.music-room');
    if (page instanceof HTMLElement && page.dataset.musicReady) return;
    cleanup();
    const player = window.BLOG_MUSIC;
    if (!(page instanceof HTMLElement) || !player) return;
    const loadButton = page.querySelector('.music-load');
    const search = page.querySelector('.music-search');
    const input = page.querySelector('.music-query');
    const clear = page.querySelector('.music-clear');
    const more = page.querySelector('.music-more');
    const results = page.querySelector('.music-results');
    const status = page.querySelector('.music-results-status');
    const toggle = page.querySelector('.music-toggle');
    if (!(loadButton instanceof HTMLButtonElement) || !(search instanceof HTMLElement) || !(input instanceof HTMLInputElement) || !(clear instanceof HTMLButtonElement) || !(more instanceof HTMLButtonElement) || !results || !status || !(toggle instanceof HTMLButtonElement)) return;
    if (page.dataset.musicReady) return;
    const ui = { page, input, loadButton, clear, more, toggle, search };
    ui.page.dataset.musicReady = 'true';
    let active = true;
    let catalog = null;
    let requesting = false;
    let visible = 40;
    const removers = [];

    function listen(target, event, handler) {
      target.addEventListener(event, handler);
      removers.push(() => target.removeEventListener(event, handler));
    }

    function updateCurrent() {
      if (!active || !ui.page.isConnected) return;
      const state = player.getState();
      ui.page.dataset.playing = String(state.playing);
      ui.page.querySelector('.music-current-label').textContent = state.index < 0 ? '还没开始，先挑一首' : state.playing ? '正在播放' : '已选择 · 已暂停';
      ui.page.querySelector('.music-current-title').textContent = state.title;
      ui.page.querySelector('.music-current-artist').textContent = state.artist;
      const message = ui.page.querySelector('.music-current-message');
      if (message instanceof HTMLElement) {
        message.textContent = state.message;
        message.hidden = !state.message;
      }
      ui.toggle.hidden = state.index < 0;
      ui.toggle.textContent = state.playing ? '暂停' : '播放';
      ui.toggle.setAttribute('aria-label', state.playing ? '暂停当前歌曲' : '播放当前歌曲');
      results.querySelectorAll('button').forEach(button => {
        const current = Number(button.getAttribute('data-music-index')) === state.index;
        button.setAttribute('aria-pressed', String(current && state.playing));
        button.classList.toggle('is-current', current);
        const action = current && state.playing ? '暂停' : '播放';
        button.setAttribute('aria-label', `${action}：${button.querySelector('.music-track-title').textContent}`);
        button.querySelector('.music-track-action').textContent = action;
      });
    }

    function normalize(value) { return value.normalize('NFKC').toLocaleLowerCase().trim(); }

    function render() {
      if (!catalog) return;
      const terms = normalize(ui.input.value).split(/\s+/).filter(Boolean);
      const matches = catalog.filter(song => terms.every(term => normalize(`${song.title} ${song.artist}`).includes(term)));
      results.replaceChildren();
      for (const song of matches.slice(0, visible)) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'music-track';
        button.setAttribute('data-music-index', song.index);
        for (const [className, text] of [['music-track-number', String(song.index + 1).padStart(2, '0')], ['music-track-title', song.title], ['music-track-artist', song.artist], ['music-track-action', '播放']]) {
          const span = document.createElement('span');
          span.className = className;
          span.textContent = text;
          button.append(span);
        }
        item.append(button);
        results.append(item);
      }
      ui.clear.hidden = !ui.input.value;
      ui.more.hidden = matches.length <= visible;
      if (!catalog.length) status.textContent = '在线歌单暂时为空。可以重新加载，或先看看文中歌单。';
      else if (!matches.length) status.textContent = '没有找到相关歌曲，试试更短的歌名，或换成歌手名字。';
      else status.textContent = `${ui.input.value.trim() ? '找到' : '歌单共'} ${matches.length} 首 · 已显示 ${Math.min(visible, matches.length)} 首`;
      updateCurrent();
    }

    async function load() {
      ui.search.hidden = false;
      if (catalog?.length) { render(); return; }
      if (requesting) return;
      requesting = true;
      ui.loadButton.disabled = true;
      ui.loadButton.textContent = '正在加载…';
      status.textContent = '正在加载在线歌单…';
      results.setAttribute('aria-busy', 'true');
      try {
        const songs = await player.getPlaylist();
        if (!active || !ui.page.isConnected) return;
        catalog = songs;
        visible = 40;
        render();
        ui.loadButton.hidden = songs.length > 0;
      } catch {
        if (!active || !ui.page.isConnected) return;
        status.textContent = '暂时无法加载在线歌单，可以重新试试，也可以先读下面的听歌报告。';
      } finally {
        if (active && ui.page.isConnected) {
          requesting = false;
          ui.loadButton.disabled = false;
          ui.loadButton.textContent = '重新加载歌单';
          results.setAttribute('aria-busy', 'false');
        }
      }
    }

    ui.loadButton.hidden = false;
    ui.loadButton.disabled = false;
    const initialState = player.getState();
    ui.loadButton.textContent = initialState.message ? '重新加载歌单' : '浏览完整歌单';
    status.textContent = initialState.message || '点“浏览完整歌单”后加载。文中歌单也可以直接阅读。';
    results.setAttribute('aria-busy', 'false');
    listen(ui.loadButton, 'click', () => { load(); });
    listen(ui.input, 'input', () => { visible = 40; render(); });
    listen(ui.clear, 'click', () => { ui.input.value = ''; visible = 40; render(); ui.input.focus(); });
    listen(ui.more, 'click', () => { visible += 40; render(); });
    listen(ui.toggle, 'click', () => player.toggle());
    listen(results, 'click', event => {
      const button = event.target instanceof Element ? event.target.closest('[data-music-index]') : null;
      if (!button) return;
      const index = Number(button.getAttribute('data-music-index'));
      if (player.getState().index === index) player.toggle();
      else player.play(index);
    });
    ui.page.querySelectorAll('[data-music-find]').forEach(button => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.hidden = false;
      listen(button, 'click', () => {
        ui.input.value = button.dataset.musicFind;
        visible = 40;
        load();
        ui.input.focus({ preventScroll: true });
        ui.page.querySelector('.music-online').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      });
    });
    listen(document, 'blog:music-change', () => {
      updateCurrent();
      if (!catalog && !requesting && player.getState().loaded && player.getState().index >= 0) load();
    });
    updateCurrent();
    if (initialState.loading || (initialState.loaded && initialState.index >= 0)) load();
    cleanup = () => {
      active = false;
      removers.forEach(remove => remove());
      delete ui.page.dataset.musicReady;
    };
  }

  document.addEventListener('pjax:send', () => { navigating = true; cleanup(); });
  document.addEventListener('pjax:complete', () => { navigating = false; init(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
