// 悬浮球音乐播放器 v3 — 黑胶唱片风格 + 音量控制
(function () {
  if (document.getElementById("music-ball")) return;
  var API = "https://api.injahow.cn/meting/?type=playlist&id=2690018998";
  var songs = [];
  var playlistLoaded = false;
  var playlistRequest = null;
  var curIdx = 0;
  var audio = new Audio();
  audio.preload = "none";
  var playing = false;
  var playbackAttempt = 0;
  var panelOpen = false;

  // 音量初始化：从 localStorage 读取，默认 0.8
  var savedVol = parseFloat(localStorage.getItem("music-ball-vol"));
  audio.volume = isNaN(savedVol) ? 0.8 : Math.min(1, Math.max(0, savedVol));

  // ---- DOM 构建 ----
  var root = document.createElement("div");
  root.id = "music-ball";

  // 悬浮球
  root.innerHTML =
    '<div class="ball" id="music-ball-btn">' +
      '<div class="cover"><img id="ball-cover" src="/img/theme/azusa-sidebar.73c9217b52.webp" alt=""></div>' +
      '<div class="hole"></div>' +
    '</div>';

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
    // 控制区域
    '<div class="ctrl-section">' +
      '<div class="btn-row">' +
        '<button class="ctrl-btn" id="mp-prev" title="上一首">⏮</button>' +
        '<button class="ctrl-btn play-btn" id="mp-play" title="播放/暂停">▶</button>' +
        '<button class="ctrl-btn" id="mp-next" title="下一首">⏭</button>' +
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
  var saved = localStorage.getItem("music-ball-pos");
  if (saved) {
    try {
      var p = JSON.parse(saved);
      root.style.left = p.left + "px";
      root.style.bottom = p.bottom + "px";
      root.style.top = "auto";
    } catch (e) {}
  }

  // ---- 加载歌单 ----
  function ensurePlaylist() {
    if (playlistLoaded) return Promise.resolve(true);
    if (playlistRequest) return playlistRequest;
    document.getElementById("mp-title").textContent = "加载中...";
    // 打开面板与播放操作共享请求，失败后保留再次操作重试的入口。
    playlistRequest = fetch(API)
      .then(function (r) {
        if (!r.ok) throw new Error("歌单请求失败");
        return r.json();
      })
      .then(function (d) {
        songs = Array.isArray(d) ? d : d && Array.isArray(d.data) ? d.data : [];
        playlistLoaded = true;
        renderPlaylist();
        if (songs.length > 0) loadSong(0);
        else document.getElementById("mp-title").textContent = "暂无歌曲";
        return true;
      })
      .catch(function () {
        document.getElementById("mp-title").textContent = "歌单加载失败，点击重试";
        return false;
      })
      .finally(function () { playlistRequest = null; });
    return playlistRequest;
  }

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

    // 封面图片
    var cover = s.pic || s.pic_url || "";
    document.getElementById("mp-cover").setAttribute("src", cover);
    document.getElementById("ball-cover").setAttribute("src", cover);

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
    var attempt = ++playbackAttempt;
    playing = true;
    syncPlayState();
    audio.play().catch(function () {
      // 换歌或暂停会中断旧请求，旧失败不能覆盖新的播放状态。
      if (attempt !== playbackAttempt) return;
      playing = false;
      syncPlayState();
    });
  }

  function syncPlayState() {
    document.getElementById("mp-play").textContent = playing ? "⏸" : "▶";
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
    var h = "";
    songs.forEach(function (s, i) {
      h +=
        '<div class="pl-item" data-i="' + i + '">' +
          '<span class="pl-num">' + (i + 1) + "</span>" +
          '<span class="pl-title">' + (s.name || s.title || "") + "</span>" +
          '<span class="pl-singer">' + (s.artist || s.author || "") + "</span>" +
        "</div>";
    });
    pl.innerHTML = h;
    pl.querySelectorAll(".pl-item").forEach(function (el) {
      if (!(el instanceof HTMLElement)) return;
      el.onclick = function () {
        loadSong(parseInt(el.dataset.i));
        startPlayback();
      };
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
    localStorage.setItem("music-ball-vol", String(audio.volume));
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
  document.getElementById("music-ball-btn").onclick = function () {
    if (wasDragged) return;
    panelOpen = !panelOpen;
    panel.classList.toggle("show", panelOpen);
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
      localStorage.setItem(
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
    var t = e.touches[0];
    onDragStart(t.clientX, t.clientY);
  }, { passive: true });

  root.addEventListener("touchmove", function (e) {
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
      panelOpen = false;
      panel.classList.remove("show");
    }
  });
})();
