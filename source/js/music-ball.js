// 悬浮球音乐播放器 v3 — 黑胶唱片风格 + 音量控制
(function () {
  var API = "https://arata66.top/meting/?type=playlist&id=2690018998";
  var songs = [];
  var curIdx = 0;
  var audio = new Audio();
  var playing = false;
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
      '<div class="cover"><img id="ball-cover" src="" alt=""></div>' +
      '<div class="hole"></div>' +
    '</div>';

  // 播放器面板
  var panel = document.createElement("div");
  panel.id = "music-panel";
  panel.innerHTML =
    // 封面区域
    '<div class="cover-section">' +
      '<div class="cover-wrap">' +
        '<img id="mp-cover" src="" alt="">' +
        '<div class="cover-placeholder">♪</div>' +
      '</div>' +
      '<div class="track-text">' +
        '<div class="track-title" id="mp-title">加载中...</div>' +
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
  fetch(API)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      songs = Array.isArray(d) ? d : d.data || [];
      renderPlaylist();
      if (songs.length > 0) loadSong(0);
    })
    .catch(function () {
      document.getElementById("mp-title").textContent = "歌单加载失败";
    });

  // ---- 歌曲操作 ----
  function loadSong(i) {
    curIdx = i;
    var s = songs[i];
    var titleEl = document.getElementById("mp-title");
    var artistEl = document.getElementById("mp-artist");
    titleEl.textContent = s.name || s.title || "未知";
    artistEl.textContent = s.artist || s.author || "";
    audio.src = s.url || "";

    // 封面图片
    var cover = s.pic || s.pic_url || "";
    document.getElementById("mp-cover").src = cover;
    document.getElementById("ball-cover").src = cover;

    updatePlaylistActive();
  }

  function togglePlay() {
    if (!audio.src) return;
    if (playing) {
      audio.pause();
      playing = false;
    } else {
      audio.play().catch(function () {});
      playing = true;
    }
    syncPlayState();
  }

  function syncPlayState() {
    document.getElementById("mp-play").textContent = playing ? "⏸" : "▶";
    var btn = document.getElementById("music-ball-btn");
    if (playing) btn.classList.add("playing");
    else btn.classList.remove("playing");
  }

  function prev() {
    curIdx = (curIdx - 1 + songs.length) % songs.length;
    loadSong(curIdx);
    if (playing) audio.play().catch(function () {});
  }

  function next() {
    curIdx = (curIdx + 1) % songs.length;
    loadSong(curIdx);
    if (playing) audio.play().catch(function () {});
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
      el.onclick = function () {
        loadSong(parseInt(this.dataset.i));
        audio.play().catch(function () {});
        playing = true;
        syncPlayState();
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
    localStorage.setItem("music-ball-vol", audio.volume);
    updateVolumeUI();
  }

  // 初始化音量 UI
  updateVolumeUI();

  // 点击音量条调节
  volumeWrap.onclick = function (e) {
    var rect = this.getBoundingClientRect();
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
    var rect = this.getBoundingClientRect();
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
  document.getElementById("mp-progress-wrap").onclick = function (e) {
    if (!audio.duration) return;
    var rect = this.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  };

  // 面板展开/收起（用 wasDragged 标记区分拖拽和点击）
  var wasDragged = false;
  document.getElementById("music-ball-btn").onclick = function () {
    if (wasDragged) return;
    panelOpen = !panelOpen;
    panel.classList.toggle("show", panelOpen);
  };

  // ---- 拖动 ----
  var startX, startY, origLeft, origBottom;

  root.onmousedown = function (e) {
    wasDragged = false;
    startX = e.clientX;
    startY = e.clientY;
    // 拖拽时关闭面板，避免干扰
    if (panelOpen) {
      panelOpen = false;
      panel.classList.remove("show");
    }
    var rect = root.getBoundingClientRect();
    origLeft = rect.left;
    origBottom = window.innerHeight - rect.bottom;

    document.onmousemove = function (ev) {
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged = true;
      if (wasDragged) {
        var newLeft = Math.max(0, Math.min(window.innerWidth - 60, origLeft + dx));
        var newBottom = Math.max(0, Math.min(window.innerHeight - 60, origBottom - dy));
        root.style.left = newLeft + "px";
        root.style.bottom = newBottom + "px";
        root.style.top = "auto";
      }
    };

    document.onmouseup = function () {
      document.onmousemove = null;
      document.onmouseup = null;
      if (wasDragged) {
        localStorage.setItem(
          "music-ball-pos",
          JSON.stringify({
            left: parseInt(root.style.left),
            bottom: parseInt(root.style.bottom),
          })
        );
      }
    };
  };

  // 点击外部关闭面板
  document.addEventListener("click", function (e) {
    if (!wasDragged && panelOpen && !root.contains(e.target)) {
      panelOpen = false;
      panel.classList.remove("show");
    }
  });
})();
