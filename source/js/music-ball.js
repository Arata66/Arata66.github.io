// 悬浮球音乐播放器 v3 — 黑胶唱片风格 + 音量控制
(function () {
  if (document.getElementById("music-ball")) return;
  var API = "https://api.injahow.cn/meting/?type=playlist&id=2690018998";
  var DEFAULT_COVER = "/img/theme/azusa-sidebar.73c9217b52.webp";
  var songs = [];
  var playlistLoaded = false;
  var playlistRequest = null;
  var curIdx = 0;
  var audio = new Audio();
  audio.preload = "none";
  var playing = false;
  var playbackAttempt = 0;
  var needsReload = false;
  var panelOpen = false;

  // 音量初始化：从 localStorage 读取，默认 0.8
  function readPreference(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function savePreference(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  var savedVol = parseFloat(readPreference("music-ball-vol"));
  audio.volume = isNaN(savedVol) ? 0.8 : Math.min(1, Math.max(0, savedVol));

  // ---- DOM 构建 ----
  var root = document.createElement("div");
  root.id = "music-ball";

  // 悬浮球
  root.innerHTML =
    '<button type="button" class="ball" id="music-ball-btn" aria-label="展开音乐面板" aria-controls="music-panel" aria-expanded="false">' +
      '<div class="cover"><img id="ball-cover" src="/img/theme/azusa-sidebar.73c9217b52.webp" alt="" draggable="false"></div>' +
      '<div class="hole"></div>' +
    '</button>';

  // 播放器面板
  var panel = document.createElement("div");
  panel.id = "music-panel";
  panel.innerHTML =
    // 封面区域
    '<div class="cover-section">' +
      '<div class="cover-wrap">' +
        '<img id="mp-cover" alt="">' +
        '<div class="cover-placeholder">♪</div>' +
      '</div>' +
      '<div class="track-text">' +
        '<div class="track-title" id="mp-title">点击展开加载歌单</div>' +
        '<div class="track-artist" id="mp-artist"></div>' +
      '</div>' +
    '</div>' +
    '<div class="load-feedback">' +
      '<p id="mp-status" role="status" aria-live="polite"></p>' +
      '<button type="button" id="mp-retry" hidden>重新加载歌单</button>' +
    '</div>' +
    // 控制区域
    '<div class="ctrl-section">' +
      '<div class="btn-row">' +
        '<button type="button" class="ctrl-btn" id="mp-prev" title="上一首" aria-label="上一首">⏮</button>' +
        '<button type="button" class="ctrl-btn play-btn" id="mp-play" title="播放/暂停" aria-label="播放">▶</button>' +
        '<button type="button" class="ctrl-btn" id="mp-next" title="下一首" aria-label="下一首">⏭</button>' +
      '</div>' +
      // 音量条
      '<div class="volume-area">' +
        '<span class="vol-icon" id="mp-vol-icon">🔊</span>' +
        '<div class="volume-track" id="mp-volume-wrap">' +
          '<div class="volume-fill" id="mp-volume"></div>' +
        '</div>' +
      '</div>' +
      '<div class="progress-area">' +
        '<span class="time now" id="mp-cur">0:00</span>' +
        '<div class="progress-track" id="mp-progress-wrap">' +
          '<div class="progress-fill" id="mp-progress"></div>' +
        '</div>' +
        '<span class="time" id="mp-dur">0:00</span>' +
      '</div>' +
    '</div>' +
    // 播放列表
    '<div class="playlist" id="mp-playlist"></div>';

  root.appendChild(panel);
  document.body.appendChild(root);

  // ---- 恢复位置 ----
  var saved = readPreference("music-ball-pos");
  if (saved) {
    try {
      var p = JSON.parse(saved);
      root.style.left = p.left + "px";
      root.style.bottom = p.bottom + "px";
      root.style.top = "auto";
    } catch (e) {}
  }

  // ---- 加载歌单 ----
  function showStatus(message, retry) {
    document.getElementById("mp-status").textContent = message;
    var button = document.getElementById("mp-retry");
    // 重试入口隐藏时保留键盘操作位置，不干扰已移到其他位置的焦点。
    if (!retry && document.activeElement === button) document.getElementById("mp-play").focus();
    button.hidden = !retry;
  }

  function ensurePlaylist() {
    if (playlistLoaded) return Promise.resolve(true);
    if (playlistRequest) return playlistRequest;
    document.getElementById("mp-title").textContent = "加载歌单…";
    showStatus("正在加载歌单…", false);
    panel.setAttribute("aria-busy", "true");
    var controller = new AbortController();
    var timedOut = false;
    var timeout;
    var deadline = new Promise(function (resolve, reject) {
      timeout = setTimeout(function () {
        timedOut = true;
        reject(new Error("歌单请求超时"));
        controller.abort();
      }, 15000);
    });
    // 超时也覆盖响应解析；迟到数据只能停留在已结束的请求中。
    var request = fetch(API, { signal: controller.signal })
      .then(function (r) {
        if (!r.ok) throw new Error("歌单请求失败");
        return r.json();
      });
    playlistRequest = Promise.race([request, deadline])
      .then(function (d) {
        var items = Array.isArray(d) ? d : d && Array.isArray(d.data) ? d.data : null;
        if (!items) throw new Error("歌单格式不可用");
        songs = items.filter(function (s) {
          return s && typeof s === "object" && typeof s.url === "string" && safeUrl(s.url);
        });
        if (items.length && !songs.length) throw new Error("没有可播放的歌曲");
        playlistLoaded = true;
        renderPlaylist();
        if (songs.length > 0) loadSong(0);
        else {
          document.getElementById("mp-title").textContent = "暂无歌曲";
          showStatus("歌单暂时为空，可以稍后重新加载。", true);
        }
        return true;
      })
      .catch(function () {
        document.getElementById("mp-title").textContent = "歌单加载失败";
        showStatus(timedOut ? "歌单加载超时，可以重新试试。" : "暂时无法加载歌单，可以重新试试。", true);
        return false;
      })
      .finally(function () {
        clearTimeout(timeout);
        panel.setAttribute("aria-busy", "false");
        playlistRequest = null;
      });
    return playlistRequest;
  }

  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      var url = new URL(value, document.baseURI);
      return /^https?:$/.test(url.protocol) ? value : "";
    } catch (e) { return ""; }
  }

  document.getElementById("mp-retry").onclick = function () {
    if (playlistRequest) return;
    playlistLoaded = false;
    ensurePlaylist();
  };

  // ---- 歌曲操作 ----
  function loadSong(i) {
    if (!songs.length || !songs[i]) return;
    playbackAttempt++;
    curIdx = i;
    var s = songs[i];
    var titleEl = document.getElementById("mp-title");
    var artistEl = document.getElementById("mp-artist");
    titleEl.textContent = s.name || s.title || "未知";
    artistEl.textContent = s.artist || s.author || "";
    audio.src = s.url || "";
    needsReload = false;
    showStatus("", false);
    document.getElementById("mp-progress").style.width = "0%";
    document.getElementById("mp-cur").textContent = "0:00";
    document.getElementById("mp-dur").textContent = "0:00";

    // 封面图片
    var cover = safeUrl(s.pic || s.pic_url);
    if (cover) document.getElementById("mp-cover").setAttribute("src", cover);
    else document.getElementById("mp-cover").removeAttribute("src");
    document.getElementById("ball-cover").setAttribute("src", cover || DEFAULT_COVER);

    updatePlaylistActive();
  }

  function togglePlay() {
    if (!playlistLoaded) {
      ensurePlaylist().then(function (ready) {
        if (ready && !playing) startPlayback();
      });
      return;
    }
    if (!audio.src) return;
    if (playing) {
      playbackAttempt++;
      audio.pause();
      playing = false;
    } else {
      startPlayback();
    }
    syncPlayState();
  }

  function startPlayback() {
    if (!audio.src) return;
    // 媒体错误会保留在Audio上，重试须重新加载同一首才能恢复。
    if (needsReload) {
      audio.load();
      needsReload = false;
    }
    var attempt = ++playbackAttempt;
    showStatus("", false);
    playing = true;
    syncPlayState();
    audio.play().catch(function () {
      // 换歌或暂停会中断旧请求，旧失败不能覆盖新的播放状态。
      if (attempt !== playbackAttempt) return;
      playing = false;
      syncPlayState();
      showStatus("播放失败，可以点击播放重试或换一首。", false);
    });
  }

  function syncPlayState() {
    document.getElementById("mp-play").textContent = playing ? "⏸" : "▶";
    document.getElementById("mp-play").setAttribute("aria-label", playing ? "暂停" : "播放");
    var btn = document.getElementById("music-ball-btn");
    if (playing) btn.classList.add("playing");
    else btn.classList.remove("playing");
  }

  function prev() {
    ensurePlaylist().then(function () {
      if (!songs.length) return;
      curIdx = (curIdx - 1 + songs.length) % songs.length;
      loadSong(curIdx);
      if (playing) startPlayback();
    });
  }

  function next() {
    ensurePlaylist().then(function () {
      if (!songs.length) return;
      curIdx = (curIdx + 1) % songs.length;
      loadSong(curIdx);
      if (playing) startPlayback();
    });
  }

  // ---- 播放列表 ----
  function renderPlaylist() {
    var pl = document.getElementById("mp-playlist");
    pl.replaceChildren();
    songs.forEach(function (s, i) {
      var el = document.createElement("button");
      el.type = "button";
      el.className = "pl-item";
      [String(i + 1), s.name || s.title || "未知歌曲", s.artist || s.author || ""].forEach(function (value, field) {
        var span = document.createElement("span");
        span.className = ["pl-num", "pl-title", "pl-singer"][field];
        span.textContent = value;
        el.appendChild(span);
      });
      el.onclick = function () {
        loadSong(i);
        startPlayback();
      };
      pl.appendChild(el);
    });
  }

  function updatePlaylistActive() {
    document.querySelectorAll("#mp-playlist .pl-item").forEach(function (el, i) {
      el.classList.toggle("active", i === curIdx);
    });
  }

  // ---- 音频事件 ----
  audio.ontimeupdate = function () {
    if (!audio.duration) return;
    var pct = (audio.currentTime / audio.duration) * 100;
    document.getElementById("mp-progress").style.width = pct + "%";
    document.getElementById("mp-cur").textContent = fmt(audio.currentTime);
    document.getElementById("mp-dur").textContent = fmt(audio.duration);
  };
  audio.onended = function () { next(); };
  audio.onerror = function () {
    playbackAttempt++;
    needsReload = true;
    playing = false;
    syncPlayState();
    showStatus("播放失败，可以点击播放重试或换一首。", false);
  };

  document.getElementById("ball-cover").onerror = function () {
    if (this.getAttribute("src") !== DEFAULT_COVER) this.setAttribute("src", DEFAULT_COVER);
  };
  document.getElementById("mp-cover").onerror = function () { this.removeAttribute("src"); };

  function fmt(s) {
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  // ---- 按钮绑定 ----
  document.getElementById("mp-play").onclick = togglePlay;
  document.getElementById("mp-prev").onclick = prev;
  document.getElementById("mp-next").onclick = next;

  // ---- 音量控制 ----
  var volumeWrap = document.getElementById("mp-volume-wrap");
  var volumeFill = document.getElementById("mp-volume");
  var volIcon = document.getElementById("mp-vol-icon");

  function updateVolumeUI() {
    volumeFill.style.width = (audio.volume * 100) + "%";
    if (audio.volume === 0) volIcon.textContent = "🔇";
    else if (audio.volume < 0.4) volIcon.textContent = "🔈";
    else if (audio.volume < 0.8) volIcon.textContent = "🔉";
    else volIcon.textContent = "🔊";
  }

  function setVolume(v) {
    audio.volume = Math.min(1, Math.max(0, v));
    savePreference("music-ball-vol", String(audio.volume));
    updateVolumeUI();
  }

  // 初始化音量 UI
  updateVolumeUI();

  // 点击音量条调节
  volumeWrap.onclick = function (e) {
    var rect = volumeWrap.getBoundingClientRect();
    setVolume((e.clientX - rect.left) / rect.width);
  };

  // 点击图标切换静音
  var lastVol = 0.8;
  volIcon.onclick = function () {
    if (audio.volume > 0) {
      lastVol = audio.volume;
      setVolume(0);
    } else {
      setVolume(lastVol);
    }
  };

  // 音量条拖拽
  volumeWrap.onmousedown = function (e) {
    e.stopPropagation();
    var rect = volumeWrap.getBoundingClientRect();
    function onMove(ev) {
      setVolume((ev.clientX - rect.left) / rect.width);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  var progressWrap = document.getElementById("mp-progress-wrap");
  progressWrap.onclick = function (e) {
    if (!audio.duration) return;
    var rect = progressWrap.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  };

  // 面板展开/收起（用 wasDragged 标记区分拖拽和点击）
  var wasDragged = false;
  function closePanel() {
    panelOpen = false;
    panel.classList.remove("show");
    document.getElementById("music-ball-btn").setAttribute("aria-expanded", "false");
    document.getElementById("music-ball-btn").setAttribute("aria-label", "展开音乐面板");
  }
  document.getElementById("music-ball-btn").onclick = function () {
    if (wasDragged) return;
    panelOpen = !panelOpen;
    panel.classList.toggle("show", panelOpen);
    document.getElementById("music-ball-btn").setAttribute("aria-expanded", String(panelOpen));
    document.getElementById("music-ball-btn").setAttribute("aria-label", panelOpen ? "收起音乐面板" : "展开音乐面板");
    if (panelOpen) ensurePlaylist();
  };

  // ---- 拖动（鼠标 + 触屏） ----
  var startX, startY, origLeft, origBottom;

  function clampPos(left, bottom) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    left = Math.max(0, Math.min(w - 60, left));
    bottom = Math.max(0, Math.min(h - 60, bottom));
    return { left: left, bottom: bottom };
  }

  function onDragStart(cx, cy) {
    wasDragged = false;
    startX = cx;
    startY = cy;
    var rect = root.getBoundingClientRect();
    origLeft = rect.left;
    origBottom = window.innerHeight - rect.bottom;
  }

  function onDragMove(cx, cy) {
    var dx = cx - startX;
    var dy = cy - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged = true;
    if (wasDragged) {
      var pos = clampPos(origLeft + dx, origBottom - dy);
      root.style.left = pos.left + "px";
      root.style.bottom = pos.bottom + "px";
      root.style.top = "auto";
    }
  }

  function onDragEnd() {
    if (wasDragged) {
      savePreference(
        "music-ball-pos",
        JSON.stringify({
          left: parseInt(root.style.left),
          bottom: parseInt(root.style.bottom),
        })
      );
    }
  }

  // 鼠标拖动
  root.onmousedown = function (e) {
    if (!(e.target instanceof Node) || panel.contains(e.target)) return;
    onDragStart(e.clientX, e.clientY);
    document.onmousemove = function (ev) { onDragMove(ev.clientX, ev.clientY); };
    document.onmouseup = function () {
      document.onmousemove = null;
      document.onmouseup = null;
      onDragEnd();
    };
  };

  // 触屏拖动
  root.addEventListener("touchstart", function (e) {
    if (!(e.target instanceof Node) || panel.contains(e.target)) return;
    var t = e.touches[0];
    onDragStart(t.clientX, t.clientY);
  }, { passive: true });

  root.addEventListener("touchmove", function (e) {
    if (!(e.target instanceof Node) || panel.contains(e.target)) return;
    var t = e.touches[0];
    onDragMove(t.clientX, t.clientY);
  }, { passive: true });

  root.addEventListener("touchend", function () {
    onDragEnd();
  });

  // 点击外部关闭面板
  document.addEventListener("click", function (e) {
    if (!(e.target instanceof Node)) return;
    if (!wasDragged && panelOpen && !root.contains(e.target)) {
      closePanel();
    }
  });
  document.getElementById("music-ball-btn").onkeydown = function (e) {
    if (e.key === "Enter" || e.key === " ") wasDragged = false;
  };
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !panelOpen || !root.contains(document.activeElement)) return;
    closePanel();
    document.getElementById("music-ball-btn").focus();
  });
})();
