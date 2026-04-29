(function () {
  var shown = false;
  function show() {
    if (shown) return;
    shown = true;
    if (document.getElementById('stale-asset-fallback')) return;
    var d = document.createElement('div');
    d.id = 'stale-asset-fallback';
    d.setAttribute('style', 'position:fixed;inset:0;z-index:2147483646;background:#0f172a;color:#e2e8f0;padding:2rem;box-sizing:border-box;font:16px/1.5 system-ui,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;');
    d.innerHTML = '<div style="max-width:28rem"><h1 style="font-size:1.25rem;margin:0 0 .75rem">Не удалось загрузить обновление</h1><p style="margin:0 0 1rem;opacity:.92">Обычно так бывает сразу после выката новой версии: в кэше осталась старая страница, а файлы /assets/ на сервере уже другие. Нажмите кнопку или выполните жёсткое обновление (Ctrl+Shift+R).</p><button type="button" id="stale-asset-fallback-btn" style="padding:.6rem 1.1rem;border-radius:.5rem;border:none;background:#4f46e5;color:#fff;font:inherit;cursor:pointer">Обновить страницу</button></div>';
    document.body.appendChild(d);
    var btn = document.getElementById('stale-asset-fallback-btn');
    if (btn) btn.onclick = function () { location.reload(); };
  }
  function fromMessage(m) {
    if (!m) return false;
    return /Unable to preload CSS|Failed to fetch dynamically imported|importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically imported|Failed to load module script|Loading CSS chunk|preload CSS/i.test(m);
  }
  window.addEventListener('error', function (ev) {
    var t = ev && ev.target;
    if (t && t.href && /\/assets\//.test(t.href) && t.tagName === 'LINK') { show(); return; }
    if (t && t.src && /\/assets\//.test(t.src) && t.tagName === 'SCRIPT') { show(); return; }
    if (fromMessage(ev && ev.message) || (ev && ev.error && fromMessage(String(ev.error.message || '')))) show();
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    var m = (r && r.message) || String(r || '');
    if (fromMessage(m)) show();
  });
})();
