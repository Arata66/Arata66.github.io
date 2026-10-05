// 终端风格首页组件
// 在首页展示伪终端交互界面
(function () {
  var COMMANDS = {
    help: {
      output: [
        '可用命令：',
        '  about    - 关于我',
        '  blog     - 最近文章',
        '  works    - 折腾记录',
        '  tech     - 学习与接触',
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
        '在这里记录学习、兴趣和日常的折腾',
        { text: '→ 关于我与近况', href: '/about/' }
      ]
    },
    blog: { output: [] },
    works: { output: [] },
    tech: {
      output: [
        '💻 正在学习与接触：',
        '',
        '  后端：Java / Spring Boot / MySQL / Redis',
        '  前端：CSS / JavaScript / Hexo',
        '  工具：Docker / Git / Linux',
        '',
        '边学边用，慢慢把想法做出来。'
      ]
    },
    social: {
      output: [
        '🔗 社交链接：',
        '',
        { text: '  GitHub: Arata66', href: 'https://github.com/Arata66' },
        { text: '  博客: arata66.top', href: '/' }
      ]
    },
    clear: { clear: true }
  };

  var WELCOME = [
    'Welcome to arata66\'s terminal ~',
    '输入 help 查看命令，文章和记录可以直接点击。',
    ''
  ];

  var history = [];
  var historyIdx = -1;

  var outputVersion = 0;

  function commandOutput(name) {
    if (name === 'blog') {
      var lines = [];
      lines.push('📝 最近文章：', '');
      var data = document.getElementById('terminal-home-data');
      var posts = [];
      try {
        var parsed = JSON.parse(data ? data.textContent : '[]');
        if (Array.isArray(parsed)) posts = parsed;
      } catch {
        // 构建数据缺失时仍提供归档入口。
      }
      posts.forEach(function (post, index) {
        if (!post || typeof post.title !== 'string' || typeof post.url !== 'string') return;
        lines.push({ text: '  ' + (index + 1) + '. ' + post.title + ' (' + post.date + ')', href: post.url });
      });
      if (!posts.length) lines.push('文章清单暂未载入，可以到归档看看。');
      lines.push('', { text: '→ 全部文章', href: '/archives/' });
      return lines;
    }
    if (name === 'works') {
      var projects = [];
      projects.push('🌱 折腾记录：', '');
      (window.WORKS_DATA || []).forEach(function (project) {
        projects.push('  ' + project.name + ' [' + (project.statusText || '记录中') + ']');
      });
      projects.push('', { text: '→ 查看记录与相关介绍', href: '/works/' });
      return projects;
    }
    return COMMANDS[name].output;
  }

  function scrollOutput(container) {
    var body = container.querySelector('.th-body');
    body.scrollTop = body.scrollHeight;
  }

  function typeOutput(container, lines, callback) {
    var outputDiv = container.querySelector('.th-output');
    var i = 0;
    var version = outputVersion;
    function printLine() {
      // 清屏或离开页面后，旧打印任务不再写入。
      if (version !== outputVersion || !container.isConnected) return;
      if (i >= lines.length) {
        if (callback) callback();
        return;
      }
      var p = document.createElement('div');
      p.className = 'th-line';
      var line = lines[i];
      if (typeof line === 'object') {
        var link = document.createElement('a');
        link.textContent = line.text;
        if (/^\/(?!\/)[^\\\s]*$/.test(line.href) || line.href === 'https://github.com/Arata66') {
          link.href = line.href;
          p.appendChild(link);
        } else {
          p.textContent = line.text;
        }
      } else {
        p.textContent = line || '\u00a0';
      }
      outputDiv.appendChild(p);
      scrollOutput(container);
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
    var prompt = document.createElement('span');
    prompt.className = 'th-prompt';
    prompt.textContent = '❯';
    inputLine.append(prompt, document.createTextNode(' ' + cmd));
    outputDiv.appendChild(inputLine);

    if (trimmed === 'clear') {
      outputVersion++;
      outputDiv.innerHTML = '';
      return;
    }

    var cmdData = Object.hasOwn(COMMANDS, trimmed) ? COMMANDS[trimmed] : null;
    if (cmdData) {
      typeOutput(container, commandOutput(trimmed), function () {
        outputDiv.appendChild(document.createElement('div')).className = 'th-line';
        scrollOutput(container);
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
    scrollOutput(container);
  }

  function createTerminal() {
    // 只在首页生效
    if (window.location.pathname !== '/' && window.location.pathname !== '') return;

    var target = document.querySelector('.recent-posts');
    if (!target) return;
    if (target.querySelector('.terminal-home')) return;

    history = [];
    historyIdx = -1;
    outputVersion++;

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
          '<input type="text" class="th-input" aria-label="终端命令" autocomplete="off" spellcheck="false" placeholder="输入 help 查看命令...">' +
        '</div>' +
      '</div>';

    // 插入到文章容器最前面
    target.insertBefore(term, target.firstChild);

    const input = term.querySelector('.th-input');
    if (!(input instanceof HTMLInputElement)) return;

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
    term.addEventListener('click', function (event) {
      if (event.target instanceof Element && event.target.closest('a')) return;
      var selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      input.focus();
    });
  }

  function init() {
    createTerminal();
  }

  document.addEventListener('pjax:complete', function () { setTimeout(init, 200); });

  // 延迟确保 Butterfly 动态 DOM 已渲染
  setTimeout(init, 500);
})();
