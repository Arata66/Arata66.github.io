// 终端风格首页组件
// 在首页展示伪终端交互界面
(function () {
  var COMMANDS = {
    help: {
      output: [
        '可用命令：',
        '  about    - 关于我',
        '  blog     - 最近文章',
        '  works    - 我的作品',
        '  tech     - 技术栈',
        '  social   - 社交链接',
        '  clear    - 清屏',
        '  help     - 显示此帮助'
      ]
    },
    about: {
      output: [
        '👋 Hi, 我是 arata66',
        '',
        'Java 学习者 / 二次元爱好者',
        '目标是成为一名后端开发者',
        '喜欢折腾技术，也喜欢看番打游戏',
        '',
        '输入 tech 查看我的技术栈'
      ]
    },
    blog: {
      output: [
        '📝 最近文章：',
        '',
        '  1. 我做了一个追番管理工具 (2026-06-29)',
        '  2. 久违的更新 (2026-06-29)',
        '  3. 我最近的目标以及思考 (2025-11-13)',
        '',
        '更多文章请访问 /archives/'
      ]
    },
    works: {
      output: [
        '🚀 我的作品：',
        '',
        '  🌸 Arata66 の Blog    [持续更新]',
        '  🍜 苍穹外卖          [已完成]',
        '  🎬 OtakuLog          [持续更新]',
        '  📚 学习笔记库        [持续更新]',
        '',
        '更多请访问 /works/'
      ],
      link: '/works/'
    },
    tech: {
      output: [
        '💻 技术栈：',
        '',
        '  后端：Java / Spring Boot / MySQL / Redis',
        '  前端：CSS / JavaScript / Hexo',
        '  工具：Docker / Git / Linux'
      ]
    },
    social: {
      output: [
        '🔗 社交链接：',
        '',
        '  GitHub: https://github.com/Arata66',
        '  博客:   https://arata66.top'
      ]
    },
    clear: { clear: true }
  };

  var WELCOME = [
    'Welcome to arata66\'s terminal ~',
    'Type "help" to see available commands.',
    ''
  ];

  var history = [];
  var historyIdx = -1;

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function typeOutput(container, lines, callback) {
    var outputDiv = container.querySelector('.th-output');
    var i = 0;
    function printLine() {
      if (i >= lines.length) {
        if (callback) callback();
        return;
      }
      var p = document.createElement('div');
      p.className = 'th-line';
      if (lines[i] === '') {
        p.innerHTML = '&nbsp;';
      } else {
        p.textContent = lines[i];
      }
      outputDiv.appendChild(p);
      i++;
      setTimeout(printLine, 30);
    }
    printLine();
  }

  function processCommand(cmd, container) {
    var trimmed = cmd.trim().toLowerCase();
    if (trimmed === '') return;

    history.push(trimmed);
    historyIdx = history.length;

    // 显示输入的命令
    var outputDiv = container.querySelector('.th-output');
    var inputLine = document.createElement('div');
    inputLine.className = 'th-line';
    inputLine.innerHTML = '<span class="th-prompt">❯</span> ' + escapeHtml(cmd);
    outputDiv.appendChild(inputLine);

    if (trimmed === 'clear') {
      outputDiv.innerHTML = '';
      return;
    }

    var cmdData = COMMANDS[trimmed];
    if (cmdData) {
      typeOutput(container, cmdData.output, function () {
        outputDiv.appendChild(document.createElement('div')).className = 'th-line';
        if (cmdData.link) {
          var linkLine = document.createElement('div');
          linkLine.className = 'th-line th-hint';
          linkLine.textContent = '→ 输入 "' + trimmed + '" 跳转查看';
          outputDiv.appendChild(linkLine);
        }
      });
    } else {
      var errLine = document.createElement('div');
      errLine.className = 'th-line th-error';
      errLine.textContent = '命令未找到: ' + trimmed + '，输入 help 查看可用命令';
      outputDiv.appendChild(errLine);
      var empty = document.createElement('div');
      empty.className = 'th-line';
      outputDiv.appendChild(empty);
    }

    // 滚动到底部
    container.scrollTop = container.scrollHeight;
  }

  function createTerminal() {
    // 只在首页生效
    if (window.location.pathname !== '/' && window.location.pathname !== '') return;

    var target = document.querySelector('.recent-posts');
    if (!target) return;

    var term = document.createElement('div');
    term.className = 'terminal-home';
    term.innerHTML =
      '<div class="th-titlebar">' +
        '<span class="th-dot th-red"></span>' +
        '<span class="th-dot th-yellow"></span>' +
        '<span class="th-dot th-green"></span>' +
        '<span class="th-title">arata66@blog ~ </span>' +
      '</div>' +
      '<div class="th-body">' +
        '<div class="th-output"></div>' +
        '<div class="th-input-line">' +
          '<span class="th-prompt">❯</span>' +
          '<input type="text" class="th-input" autofocus autocomplete="off" spellcheck="false" placeholder="输入 help 查看命令...">' +
        '</div>' +
      '</div>';

    // 插入到文章容器最前面
    target.insertBefore(term, target.firstChild);

    var input = term.querySelector('.th-input');

    // 输出欢迎语
    typeOutput(term, WELCOME);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var val = input.value;
        processCommand(val, term);
        input.value = '';
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIdx > 0) {
          historyIdx--;
          input.value = history[historyIdx];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIdx < history.length - 1) {
          historyIdx++;
          input.value = history[historyIdx];
        } else {
          historyIdx = history.length;
          input.value = '';
        }
      }
    });

    // 点击终端区域聚焦输入
    term.addEventListener('click', function () { input.focus(); });
  }

  function init() {
    // pjax 导航时重置命令历史
    history = [];
    historyIdx = -1;
    createTerminal();
  }

  document.addEventListener('pjax:complete', function () { setTimeout(init, 200); });

  // 延迟确保 Butterfly 动态 DOM 已渲染
  setTimeout(init, 500);
})();
