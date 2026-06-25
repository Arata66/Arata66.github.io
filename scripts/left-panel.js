// 左侧悬浮信息面板 — injector 脚本
// 包含：日历、今日运势、快捷导航

hexo.extend.injector.register('body_end', `
<style>
/* ========== 左侧悬浮面板 ========== */
#left-panel {
  position: fixed;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 9989;
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: opacity 0.4s, transform 0.4s;
  pointer-events: auto;
}

#left-panel.hide {
  opacity: 0;
  transform: translateY(-50%) translateX(-20px);
  pointer-events: none;
}

.lp-card {
  background: rgba(26, 16, 37, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(180, 142, 173, 0.15);
  border-radius: 14px;
  padding: 14px;
  color: #f0e6f6;
  font-size: 12px;
  line-height: 1.6;
  transition: transform 0.3s, box-shadow 0.3s;
}

.lp-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(180, 142, 173, 0.15);
}

/* 日历 */
.lp-calendar-header {
  text-align: center;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  color: #d4b5e0;
}

.lp-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  text-align: center;
}

.lp-calendar-grid .day-label {
  font-size: 10px;
  color: #c8b8d4;
  padding: 2px 0;
}

.lp-calendar-grid .day {
  padding: 3px 0;
  border-radius: 6px;
  font-size: 11px;
  color: #c8b8d4;
  transition: all 0.2s;
}

.lp-calendar-grid .day.today {
  background: linear-gradient(135deg, #b48ead, #f4a9c0);
  color: #fff;
  font-weight: 700;
  border-radius: 50%;
}

.lp-calendar-grid .day.other-month {
  opacity: 0.3;
}

/* 今日运势 */
.lp-fortune-btn {
  display: block;
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  border: 1px solid rgba(244, 169, 192, 0.3);
  border-radius: 10px;
  background: rgba(244, 169, 192, 0.1);
  color: #f4a9c0;
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  transition: all 0.3s;
}

.lp-fortune-btn:hover {
  background: rgba(244, 169, 192, 0.2);
  transform: scale(1.02);
}

.lp-fortune-result {
  text-align: center;
  margin-top: 8px;
  padding: 10px;
  background: rgba(180, 142, 173, 0.1);
  border-radius: 10px;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.lp-fortune-result .fortune-emoji {
  font-size: 28px;
  margin-bottom: 4px;
}

.lp-fortune-result .fortune-text {
  font-size: 13px;
  font-weight: 600;
  color: #d4b5e0;
}

.lp-fortune-result .fortune-desc {
  font-size: 11px;
  color: #c8b8d4;
  margin-top: 2px;
}

/* 快捷导航 */
.lp-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lp-nav a {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  color: #f0e6f6;
  text-decoration: none;
  font-size: 12px;
  transition: all 0.2s;
  background: rgba(180, 142, 173, 0.08);
}

.lp-nav a:hover {
  background: rgba(180, 142, 173, 0.2);
  transform: translateX(3px);
}

.lp-nav a .nav-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

/* 移动端隐藏 */
@media (max-width: 1200px) {
  #left-panel {
    display: none;
  }
}
</style>

<div id="left-panel">
  <!-- 日历卡片 -->
  <div class="lp-card" id="lp-calendar"></div>

  <!-- 今日运势 -->
  <div class="lp-card">
    <div style="text-align:center;font-weight:600;font-size:13px;color:#d4b5e0;margin-bottom:4px">
      今日运势
    </div>
    <div class="lp-fortune-result" id="lp-fortune-display">
      <div class="fortune-emoji">🎴</div>
      <div class="fortune-desc">点击下方抽签</div>
    </div>
    <button class="lp-fortune-btn" id="lp-fortune-btn" onclick="drawFortune()">抽取今日运势</button>
  </div>

  <!-- 快捷导航 -->
  <div class="lp-card">
    <div style="text-align:center;font-weight:600;font-size:13px;color:#d4b5e0;margin-bottom:6px">
      快捷导航
    </div>
    <div class="lp-nav">
      <a href="/archives/"><span class="nav-icon">📚</span>文章归档</a>
      <a href="/tags/"><span class="nav-icon">🏷️</span>标签云</a>
      <a href="https://github.com/Arata66" target="_blank"><span class="nav-icon">🐱</span>GitHub</a>
    </div>
  </div>
</div>

<script>
// 日历渲染
(function() {
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();
  var today = now.getDate();
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var daysInPrev = new Date(year, month, 0).getDate();

  var monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var dayLabels = ['日','一','二','三','四','五','六'];

  var html = '<div class="lp-calendar-header">' + year + '年 ' + monthNames[month] + '</div>';
  html += '<div class="lp-calendar-grid">';

  dayLabels.forEach(function(d) {
    html += '<div class="day-label">' + d + '</div>';
  });

  // 上月补位
  for (var i = firstDay - 1; i >= 0; i--) {
    html += '<div class="day other-month">' + (daysInPrev - i) + '</div>';
  }

  // 本月
  for (var d = 1; d <= daysInMonth; d++) {
    var cls = d === today ? 'day today' : 'day';
    html += '<div class="' + cls + '">' + d + '</div>';
  }

  // 下月补位
  var totalCells = firstDay + daysInMonth;
  var remaining = (7 - (totalCells % 7)) % 7;
  for (var r = 1; r <= remaining; r++) {
    html += '<div class="day other-month">' + r + '</div>';
  }

  html += '</div>';
  document.getElementById('lp-calendar').innerHTML = html;
})();

// 今日运势
var fortunes = [
  { emoji: '🌸', text: '大吉', desc: '万事顺遂，好运连连' },
  { emoji: '🌸', text: '中吉', desc: '稳步前进，心想事成' },
  { emoji: '🌸', text: '小吉', desc: '小事顺利，保持心态' },
  { emoji: '🍂', text: '末吉', desc: '虽有波折，终会好转' },
  { emoji: '🍂', text: '凶', desc: '谨慎行事，低调为上' },
  { emoji: '🌸', text: '大吉', desc: '今日宜写代码' },
  { emoji: '🌸', text: '中吉', desc: '适合学习新知识' },
  { emoji: '🍂', text: '小凶', desc: '别熬夜，早点休息' }
];

function drawFortune() {
  // 基于日期的伪随机，同一天结果固定
  var seed = new Date().getDate();
  var f = fortunes[seed % fortunes.length];
  var display = document.getElementById('lp-fortune-display');
  display.innerHTML = '<div class="fortune-emoji">' + f.emoji + '</div>' +
    '<div class="fortune-text">' + f.text + '</div>' +
    '<div class="fortune-desc">' + f.desc + '</div>';
  display.style.animation = 'none';
  display.offsetHeight;
  display.style.animation = 'fortunePop 0.4s ease';
}

// 滚动时隐藏/显示面板
(function() {
  var panel = document.getElementById('left-panel');
  var lastScroll = 0;
  window.addEventListener('scroll', function() {
    var st = window.scrollY;
    if (st > 300 && st > lastScroll) {
      panel.classList.add('hide');
    } else {
      panel.classList.remove('hide');
    }
    lastScroll = st;
  });
})();
</script>
`, 'body');
