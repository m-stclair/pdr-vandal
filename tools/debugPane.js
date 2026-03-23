(function () {
    const MAX_LOGS = 200;
    const LOG_LEVELS = {log: 'lime', warn: 'orange', error: 'red'};
    let visible = false;

    const root = document.getElementById('debug-pane-root');
    const style = document.createElement('style');
    style.textContent = `
    #debug-log-pane {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      max-height: 50vh;
      overflow-y: auto;
      background: #111;
      color: lime;
      font-family: monospace;
      font-size: 12px;
      padding: 5px;
      z-index: 99999;
      border-top: 1px solid #444;
    }
    .debug-log-line { white-space: pre-wrap; margin-bottom: 3px; }
    .debug-log-line span.level { display: inline-block; min-width: 50px; font-weight: bold; }
    .debug-log-line span.time { color: #666; margin-right: 5px; }
    .debug-log-entry { display: block; margin-left: 1em; }
    .debug-collapser { cursor: pointer; color: #ccc; }
    .debug-collapser:hover { text-decoration: underline; }
    .debug-object { margin-left: 1.5em; white-space: pre-wrap; }
  `;
    document.head.appendChild(style);

    const pane = document.createElement('div');
    pane.id = 'debug-log-pane';

    let resizing = false;
    window.addEventListener('mousemove', e => {
        if (!resizing) return;
        const newHeight = window.innerHeight - e.clientY;
        pane.style.maxHeight = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => resizing = false);


    root.appendChild(pane);

    const logs = [];

    function getCallerLocation() {
        const stack = new Error().stack;
        if (!stack) return null;
        const lines = stack.split('\n');

        // Skip first line (the Error itself) and find first non-logger frame
        for (let i = 2; i < lines.length; i++) {
            const m = lines[i].match(/\(?(\S+:\d+:\d+)\)?$/);
            if (m) return m[1]; // e.g., "http://...:line:col"
        }
        return null;
    }


    function renderValue(val, depth = 0, maxDepth = 2) {
        if (val === null) return document.createTextNode("null");
        if (typeof val !== 'object') return document.createTextNode(JSON.stringify(val));
        if (depth > maxDepth) return document.createTextNode("[…]");

        const isArray = Array.isArray(val);
        const wrapper = document.createElement('div');
        wrapper.className = 'debug-object';

        const collapser = document.createElement('span');
        collapser.className = 'debug-collapser';
        collapser.textContent = isArray ? '[Array]' : '[Object]';
        wrapper.appendChild(collapser);

        const content = document.createElement('div');
        content.style.display = 'none';

        const entries = Object.entries(val);
        for (let [key, value] of entries.slice(0, 50)) {
            const entry = document.createElement('div');
            entry.className = 'debug-log-entry';
            const valRendered = renderValue(value, depth + 1, maxDepth);
            entry.textContent = key + ': ';
            entry.appendChild(valRendered);
            content.appendChild(entry);
        }
        if (entries.length > 50) {
            const more = document.createElement('div');
            more.textContent = '[…]';
            content.appendChild(more);
        }

        collapser.onclick = () => {
            const isOpen = content.style.display !== 'none';
            content.style.display = isOpen ? 'none' : 'block';
        };

        wrapper.appendChild(content);
        return wrapper;
    }

    function renderLogs() {
        if (!visible) {
            pane.style.display = 'none';
            return;
        }
        pane.style.display = 'block';

        pane.innerHTML = '';
        const grip = document.createElement('div');
        grip.style.position = 'absolute';
        grip.style.top = '0';
        grip.style.right = '0';
        grip.style.width = '14px';
        grip.style.height = '14px';
        grip.style.cursor = 'ns-resize';
        grip.style.background = 'linear-gradient(135deg, #444 50%, transparent 50%)';
        grip.title = 'Resize log pane';
        grip.style.zIndex = '100001';
        pane.appendChild(grip);
        grip.addEventListener('mousedown', e => {
            e.preventDefault();
            resizing = true;
        });
        for (const log of logs) {
            const line = document.createElement('div');
            line.className = 'debug-log-line';
            line.style.color = LOG_LEVELS[log.level] || 'white';
            const t = new Date(log.time).toISOString().split('T')[1].replace('Z', '');

            const prefix = document.createElement('span');
            prefix.className = 'time';
            prefix.textContent = `[${t}]`;
            line.appendChild(prefix);

            if (log.loc) {
                const loc = document.createElement('span');
                loc.style.color = '#888';
                loc.style.marginRight = '6px';
                loc.textContent = `[${log.loc}]`;
                line.appendChild(loc);
            }

            for (const val of log.args) {
                const node = (typeof val === 'object' && val !== null)
                    ? renderValue(val)
                    : document.createTextNode(' ' + String(val));
                line.appendChild(node);
            }

            pane.appendChild(line);

            line.addEventListener('contextmenu', e => {
                e.preventDefault();
                const text = line.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    console.log('[log copied]');
                });
            });
        }
    }

    function pushLog(level, args) {
        logs.push({time: Date.now(), level, args, loc: getCallerLocation()});
        if (logs.length > MAX_LOGS) logs.shift();
        renderLogs();
    }

    ['log', 'warn', 'error'].forEach(method => {
        const orig = console[method];
        console[method] = function (...args) {
            pushLog(method, args);
            orig.apply(console, args);
        };
    });

    // Toggle with ~ key
    document.addEventListener('keydown', e => {
        if (e.key === '`' || e.key === '~') {
            visible = !visible;
            renderLogs();
        }
    });

    console.log('%c[debug pane online — press `~` to toggle]', 'color: lime');
})();
