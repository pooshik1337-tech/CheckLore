/* ================= CheckLore — редактор тома v0.6 ================= */
(function () {
  'use strict';
  const api       = window.api;
  const editor    = document.getElementById('editor');
  const titleInp  = document.getElementById('titleInput');
  const status    = document.getElementById('status');
  const btnTheme  = document.getElementById('btnTheme');
  const toolbar   = document.getElementById('toolbar');
  const btnExport = document.getElementById('btnExport');

  const filePath = api.tomePath;
  let currentTheme = localStorage.getItem('cl-theme') || 'dark';

  function applyTheme(t) {
    document.body.className = 'theme-' + t + ' editor-body';
  if (btnTheme) btnTheme.textContent = '◐ Тема';
    localStorage.setItem('cl-theme', t);
    const cp = document.getElementById('colorPicker');
    if (cp) cp.value = t === 'dark' ? '#e8eaed' : '#1c1e21';
  }
  if (btnTheme) btnTheme.onclick = () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
  };

  let savedRange = null;
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel.rangeCount && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  });
  function restoreSelection() {
    editor.focus();
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  const STATUS_LINGER = 2200;
  let autosaveIntervalMs = 3 * 60 * 1000;
  let autosaveTimer      = null;
  let statusTimer        = null;
  let lastSavedSnapshot  = '';
  let isSaving           = false;
  let dirty              = false;

  function currentSnapshot() { return titleInp.value + '||' + editor.innerHTML; }
  function setStatus(text, linger = STATUS_LINGER) {
    clearTimeout(statusTimer);
    status.textContent = text;
    if (linger > 0) {
      statusTimer = setTimeout(() => {
        if (status.textContent === text) status.textContent = '';
      }, linger);
    }
  }
  async function save(force = false) {
    if (!filePath) { setStatus('⚠ Путь к тому не получен'); return; }
    const snap = currentSnapshot();
    if (!force && snap === lastSavedSnapshot) return;
    if (isSaving) return;
    isSaving = true;
    setStatus('💾 Сохранение...', 0);
    try {
      await api.writeTome({
        filePath,
        title: titleInp.value || 'Без названия',
        content: editor.innerHTML
      });
      lastSavedSnapshot = snap;
      dirty = false;
      setStatus('✓ Сохранено ' + new Date().toLocaleTimeString());
    } catch (err) {
      console.error('[editor] save error', err);
      setStatus('⚠ Ошибка сохранения', 0);
    } finally {
      isSaving = false;
    }
  }
  function markDirty() { dirty = true; }
  function startAutosave() {
    clearInterval(autosaveTimer);
    if (autosaveIntervalMs > 0) {
      autosaveTimer = setInterval(() => { if (dirty) save(false); }, autosaveIntervalMs);
    }
  }
  async function applyAutosaveSetting() {
    try {
      const s = await api.loadSettings();
      const min = Number(s.autosaveTomeMinutes ?? 3);
      autosaveIntervalMs = min === 0 ? 0 : min * 60 * 1000;
      startAutosave();
    } catch (e) { console.error('[editor] autosave error', e); }
  }

  document.getElementById('btnSave').onclick = () => save(true);
  if (btnExport) btnExport.onclick = async () => {
    await save(true);
    const r = await api.exportTome(filePath);
    if (r && r.ok) setStatus('📤 Экспортировано', STATUS_LINGER);
    else if (r && r.error && r.error !== 'Отменено') setStatus('⚠ ' + r.error, 0);
  };

  editor.addEventListener('input', markDirty);
  titleInp.addEventListener('input', markDirty);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyS' || e.key === 's' || e.key === 'S')) {
      e.preventDefault(); e.stopPropagation();
      save(true);
    }
  }, true);

  async function boot() {
    if (!filePath) { status.textContent = '⚠ Путь к тому не получен'; return; }
    try {
      const loaded = await api.readTome(filePath);
      if (loaded) {
        titleInp.value = loaded.title || '';
        editor.innerHTML = loaded.content || '';
      }
      try { document.execCommand('styleWithCSS', false, false); } catch {}
      lastSavedSnapshot = currentSnapshot();
      dirty = false;
      status.textContent = '';
      await applyAutosaveSetting();
    } catch (e) {
      console.error('[editor] boot error', e);
      status.textContent = '⚠ Ошибка загрузки';
    }
  }
  boot();

  if (api.onSettingsChanged) api.onSettingsChanged(() => applyAutosaveSetting());

  toolbar.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    e.preventDefault();
    restoreSelection();
    document.execCommand(btn.dataset.cmd, false, null);
    markDirty();
  });
  document.getElementById('btnHighlight').addEventListener('mousedown', (e) => {
    e.preventDefault(); restoreSelection();
    document.execCommand('hiliteColor', false, '#ffe066'); markDirty();
  });
  document.getElementById('fontFamily').addEventListener('change', (e) => {
    restoreSelection(); document.execCommand('fontName', false, e.target.value); markDirty();
  });
  document.getElementById('fontSize').addEventListener('change', (e) => {
    restoreSelection(); document.execCommand('fontSize', false, e.target.value); markDirty();
  });
  document.getElementById('colorPicker').addEventListener('input', (e) => {
    restoreSelection(); document.execCommand('foreColor', false, e.target.value); markDirty();
  });

  applyTheme(currentTheme);

  // Кнопки управления окном (frameless)
  const wcMinimize = document.getElementById('wcMinimize');
  const wcMaximize = document.getElementById('wcMaximize');
  const wcClose    = document.getElementById('wcClose');
  if (wcMinimize) wcMinimize.onclick = () => window.api.windowMinimize();
  if (wcMaximize) wcMaximize.onclick = () => window.api.windowToggleMaximize();
  if (wcClose)    wcClose.onclick    = () => window.api.windowClose();
  if (window.api.onMaximizedChanged) {
    window.api.onMaximizedChanged((isMax) => {
      if (wcMaximize) {
        wcMaximize.textContent = isMax ? '❐' : '□';
        wcMaximize.title = isMax ? 'Свернуть в окно' : 'Развернуть';
      }
    });
  }
})();