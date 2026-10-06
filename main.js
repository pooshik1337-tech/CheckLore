const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const WORKSPACE     = path.join(app.getPath('userData'), 'CheckLoreWorkspace');
const BOARDS_DIR    = path.join(WORKSPACE, 'boards');
const TOMES_DIR     = path.join(WORKSPACE, 'tomes');
const IMAGES_DIR    = path.join(WORKSPACE, 'images');
const SETTINGS_FILE = path.join(WORKSPACE, 'settings.json');
const STATE_FILE    = path.join(WORKSPACE, 'state.json');
const LEGACY_BOARD  = path.join(WORKSPACE, 'board.json');

const DEFAULT_SETTINGS = {
  autosaveTomeMinutes: 3,
  welcomeScreen: 'menu',
  linkColor: '#4c8dff',
  defaultCardOpacity: 85,
  customStatuses: []
};
const DEFAULT_STATE    = { lastBoardId: null, windowState: null };

function ensureWorkspace() {
  for (const d of [WORKSPACE, BOARDS_DIR, TOMES_DIR, IMAGES_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
  if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  if (!fs.existsSync(STATE_FILE))    fs.writeFileSync(STATE_FILE,    JSON.stringify(DEFAULT_STATE, null, 2));
  if (fs.existsSync(LEGACY_BOARD)) {
    try {
      const any = fs.readdirSync(BOARDS_DIR).filter(f => f.startsWith('board-') && f.endsWith('.json'));
      if (any.length === 0) {
        fs.copyFileSync(LEGACY_BOARD, path.join(BOARDS_DIR, 'board-legacy.json'));
        if (!loadState().lastBoardId) saveState({ lastBoardId: 'legacy' });
      }
    } catch (e) { console.error('[main] migration error', e); }
  }
}
function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s) { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2)); }
function loadState() {
  try { return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; }
  catch { return { ...DEFAULT_STATE }; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
function boardPath(id) { return path.join(BOARDS_DIR, `board-${id}.json`); }

function listBoards() {
  if (!fs.existsSync(BOARDS_DIR)) return [];
  const files = fs.readdirSync(BOARDS_DIR).filter(f => f.startsWith('board-') && f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const id = f.slice('board-'.length, -'.json'.length);
    const full = path.join(BOARDS_DIR, f);
    try {
      const stat = fs.statSync(full);
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      out.push({
        id, name: data.name || 'Без названия',
        updatedAt: stat.mtimeMs,
        itemsCount: Array.isArray(data.items) ? data.items.length : 0
      });
    } catch {}
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* =========================================================
   ОКНА
   ========================================================= */
let mainWindow = null;
let allowClose = false;

function attachDevToolsHotkeys(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = (input.key || '').toLowerCase();
    if (key === 'f12' || ((input.control || input.meta) && input.shift && key === 'i')) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}
function attachConsoleForwarding(win) {
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const tag = ['LOG', 'WARN', 'ERROR', 'DEBUG'][level] || 'LOG';
    console.log(`[renderer:${tag}] ${message}  (${sourceId}:${line})`);
  });
  win.webContents.on('render-process-gone', (_e, details) => console.error('[renderer CRASH]', details));
  win.webContents.on('preload-error', (_e, preloadPath, error) => console.error('[preload ERROR]', preloadPath, error));
}
let windowSaveTimer = null;
function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  const st = loadState();
  if (win.isMaximized()) {
    st.windowState = { ...(st.windowState || {}), maximized: true };
  } else if (win.isMinimized()) {
    // ничего не делаем, восстановится из прежнего состояния
  } else {
    const b = win.getBounds();
    st.windowState = { x: b.x, y: b.y, width: b.width, height: b.height, maximized: false };
  }
  saveState(st);
}
function scheduleWindowStateSave(win) {
  clearTimeout(windowSaveTimer);
  windowSaveTimer = setTimeout(() => saveWindowState(win), 300);
}

function createMainWindow() {
  const st = loadState();
  const ws = st.windowState || null;

  const opts = {
    width: 1400,
    height: 900,
    backgroundColor: '#1b1d21',
    title: 'CheckLore',
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  let applySaved = false;
  if (ws && Number.isFinite(ws.width) && Number.isFinite(ws.height)) {
    // Проверяем, что сохранённые координаты попадают в какой-то из экранов
    let positionOk = true;
    if (Number.isFinite(ws.x) && Number.isFinite(ws.y)) {
      const displays = screen.getAllDisplays();
      positionOk = displays.some(d => {
        const b = d.workArea;
        return ws.x >= b.x - 100 && ws.y >= b.y - 100 &&
               ws.x + 100 <= b.x + b.width &&
               ws.y + 100 <= b.y + b.height;
      });
    }
    if (positionOk) {
      opts.width = Math.max(400, ws.width);
      opts.height = Math.max(300, ws.height);
      if (Number.isFinite(ws.x) && Number.isFinite(ws.y)) {
        opts.x = ws.x;
        opts.y = ws.y;
      }
      applySaved = true;
    }
  }

  if (!applySaved) {
    // Первый запуск или координаты некорректны:
    // подстраиваемся под рабочую область основного экрана
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    opts.width  = Math.min(1600, Math.round(sw * 0.92));
    opts.height = Math.min(1000, Math.round(sh * 0.92));
  }

  mainWindow = new BrowserWindow(opts);
  attachDevToolsHotkeys(mainWindow);
  attachConsoleForwarding(mainWindow);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    // Разворачиваем, если:
    //   - сохранено состояние «максимизировано», ИЛИ
    //   - это первый запуск (нет сохранённого состояния)
    if ((ws && ws.maximized) || !applySaved) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // Сохраняем размер/позицию окна при изменениях (с debounce)
  mainWindow.on('resize',    () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('move',      () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('maximize', () => {
    scheduleWindowStateSave(mainWindow);
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('window:maximized-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    scheduleWindowStateSave(mainWindow);
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('window:maximized-changed', false);
  });

  mainWindow.on('close', (e) => {
    // Успеваем записать финальное состояние до закрытия
    clearTimeout(windowSaveTimer);
    saveWindowState(mainWindow);
    if (allowClose) return;
    e.preventDefault();
    mainWindow.webContents.send('app:before-close');
  });
}
app.whenReady().then(() => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  ensureWorkspace();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* =========================================================
   IPC: НАСТРОЙКИ
   ========================================================= */
ipcMain.handle('settings:load', () => loadSettings());
ipcMain.handle('settings:save', (_e, s) => {
  const clean = { ...DEFAULT_SETTINGS, ...s };
  saveSettings(clean);
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('settings:changed', clean);
  }
  return true;
});
ipcMain.handle('settings:open', () => {
  const existing = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'CheckLore — Настройки');
  if (existing) { existing.focus(); return true; }
  const win = new BrowserWindow({
    width: 560, height: 500, parent: mainWindow || undefined,
    backgroundColor: '#1b1d21', title: 'CheckLore — Настройки',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  attachDevToolsHotkeys(win);
  attachConsoleForwarding(win);
  win.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  return true;
});

/* =========================================================
   IPC: STATE
   ========================================================= */
ipcMain.handle('state:get', () => loadState());
ipcMain.handle('state:set', (_e, s) => { saveState({ ...loadState(), ...s }); return true; });

/* =========================================================
   IPC: BOARD
   ========================================================= */
ipcMain.handle('board:list', () => listBoards());

ipcMain.handle('board:create', (_e, { name }) => {
  const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const data = { name: name || 'Новая доска', width: 1000, height: 1000, items: [] };
  fs.writeFileSync(boardPath(id), JSON.stringify(data, null, 2));
  saveState({ ...loadState(), lastBoardId: id });
  return { id, data };
});

ipcMain.handle('board:load', (_e, { id }) => {
  const p = boardPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!data.name) data.name = 'Без названия';
    if (!Array.isArray(data.items)) data.items = [];
    saveState({ ...loadState(), lastBoardId: id });
    return { id, data };
  } catch (e) { console.error('[main] board:load error', e); return null; }
});

ipcMain.handle('board:save', (_e, { id, data }) => {
  if (!id) return false;
  try {
    fs.writeFileSync(boardPath(id), JSON.stringify(data, null, 2));
    if (loadState().lastBoardId !== id) saveState({ ...loadState(), lastBoardId: id });
    return true;
  } catch (e) { console.error('[main] board:save error', e); return false; }
});

ipcMain.handle('board:delete', (_e, { id }) => {
  const p = boardPath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  if (loadState().lastBoardId === id) saveState({ ...loadState(), lastBoardId: null });
  return true;
});

ipcMain.handle('board:rename', (_e, { id, name }) => {
  if (!id) return false;
  const p = boardPath(id);
  if (!fs.existsSync(p)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    data.name = name || 'Без названия';
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('[main] board:rename error', e);
    return false;
  }
});
ipcMain.handle('board:set-title', (_e, { title }) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(title || 'CheckLore');
  return true;
});

/* =========================================================
   IPC: УПРАВЛЕНИЕ ОКНОМ
   ========================================================= */
ipcMain.on('window:minimize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w && !w.isDestroyed()) w.minimize();
});
ipcMain.on('window:toggle-maximize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w || w.isDestroyed()) return;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});
ipcMain.on('window:close', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w && !w.isDestroyed()) w.close();
});

ipcMain.handle('board:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Доска CheckLore', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePaths.length) return null;
  const src = res.filePaths[0];
  let data;
  try { data = JSON.parse(fs.readFileSync(src, 'utf8')); }
  catch { return { error: 'Не удалось прочитать файл как JSON' }; }
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    return { error: 'Файл не является доской CheckLore' };
  }
  const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clean = {
    name: data.name || path.basename(src, '.json'),
    width: data.width || 1000,
    height: data.height || 1000,
    items: data.items
  };
  fs.writeFileSync(boardPath(id), JSON.stringify(clean, null, 2));
  saveState({ ...loadState(), lastBoardId: id });
  return { id, data: clean };
});

ipcMain.handle('board:export', async (_e, { id, data }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Экспорт доски',
    defaultPath: (data.name || 'board') + '.json',
    filters: [{ name: 'CheckLore доска', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { error: 'Отменено' };
  try {
    fs.writeFileSync(res.filePath, JSON.stringify(data, null, 2));
    return { ok: true, path: res.filePath };
  } catch (e) { return { error: String(e) }; }
});

/* =========================================================
   IPC: ЗАКРЫТИЕ
   ========================================================= */
ipcMain.handle('dialog:ask-save-changes', async () => {
  const res = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Сохранить', 'Не сохранять', 'Отмена'],
    defaultId: 0, cancelId: 2, noLink: true,
    message: 'Сохранить изменения перед закрытием?',
    detail: 'Если не сохранить — все изменения доски будут потеряны.'
  });
  return res.response;
});
ipcMain.on('app:confirm-close', () => {
  allowClose = true;

  // Закрываем все дочерние окна (редакторы томов, настройки и т.п.)
  for (const w of BrowserWindow.getAllWindows()) {
    if (w === mainWindow) continue;
    if (w.isDestroyed()) continue;
    w.destroy();
  }

  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

/* =========================================================
   IPC: ТОМА
   ========================================================= */
ipcMain.handle('tome:create', (_e, { id, title, content }) => {
  const file = path.join(TOMES_DIR, `tome-${id}.json`);
  fs.writeFileSync(file, JSON.stringify({ title, content }, null, 2));
  return file;
});
ipcMain.handle('tome:read', (_e, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
});
ipcMain.handle('tome:write', (_e, { filePath, title, content }) => {
  try { fs.writeFileSync(filePath, JSON.stringify({ title, content }, null, 2)); }
  catch (e) { console.error('[main] tome:write ERROR:', e); throw e; }
  const plain = String(content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tome:updated', { filePath, title: title || 'Без названия', preview: plain.slice(0, 240) });
  }
  return true;
});
ipcMain.handle('tome:open', (_e, { filePath }) => {
  const win = new BrowserWindow({
    width: 1000, height: 760, backgroundColor: '#1b1d21', title: 'CheckLore — Том',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      additionalArguments: ['--tome-file=' + encodeURIComponent(filePath)]
    }
  });
  attachDevToolsHotkeys(win);
  attachConsoleForwarding(win);
  win.loadFile(path.join(__dirname, 'renderer', 'editor.html'));
  return true;
});

/* Список всех томов на диске + привязка к доскам */
ipcMain.handle('tome:list-all', () => {
  if (!fs.existsSync(TOMES_DIR)) return [];
  const files = fs.readdirSync(TOMES_DIR).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const full = path.join(TOMES_DIR, f);
    try {
      const stat = fs.statSync(full);
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      const plain = String(data.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const linkedBoards = [];
      if (fs.existsSync(BOARDS_DIR)) {
        for (const bf of fs.readdirSync(BOARDS_DIR)) {
          if (!bf.startsWith('board-') || !bf.endsWith('.json')) continue;
          try {
            const bd = JSON.parse(fs.readFileSync(path.join(BOARDS_DIR, bf), 'utf8'));
            if (Array.isArray(bd.items) && bd.items.some(it => it.filePath === full)) {
              linkedBoards.push({ id: bf.slice(6, -5), name: bd.name || 'Без названия' });
            }
          } catch {}
        }
      }
      out.push({
        filePath: full,
        fileName: f,
        title: data.title || 'Без названия',
        preview: plain.slice(0, 160),
        size: stat.size,
        updatedAt: stat.mtimeMs,
        chars: plain.length,
        linkedBoards
      });
    } catch {}
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
});

ipcMain.handle('tome:delete-file', (_e, { filePath }) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch (e) { console.error('[main] tome:delete-file error', e); return false; }
});

ipcMain.handle('tome:rename-file', (_e, { filePath, title }) => {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.title = title;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    const plain = String(data.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tome:updated', { filePath, title, preview: plain.slice(0, 240) });
    }
    return true;
  } catch (e) { console.error('[main] tome:rename-file error', e); return false; }
});

/* Экспорт тома в .md / .txt */
ipcMain.handle('tome:export', async (_e, { filePath }) => {
  if (!filePath || !fs.existsSync(filePath)) return { error: 'Файл не найден' };
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Экспорт тома',
    defaultPath: (data.title || 'tome') + '.md',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Текст', extensions: ['txt'] },
      { name: 'HTML', extensions: ['html'] }
    ]
  });
  if (res.canceled || !res.filePath) return { error: 'Отменено' };
  const ext = path.extname(res.filePath).toLowerCase();
  const html = data.content || '';
  let out;
  if (ext === '.html') {
    out = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(data.title || '')}</title></head><body>${html}</body></html>`;
  } else if (ext === '.txt') {
    out = htmlToPlain(html);
  } else {
    out = '# ' + (data.title || 'Без названия') + '\n\n' + htmlToMarkdown(html);
  }
  fs.writeFileSync(res.filePath, out, 'utf8');
  return { ok: true, path: res.filePath };
});

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function htmlToPlain(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function htmlToMarkdown(html) {
  let s = String(html || '');
  s = s.replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, n, t) => '\n' + '#'.repeat(+n) + ' ' + stripTags(t) + '\n\n');
  s = s.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  s = s.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  s = s.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  s = s.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  s = s.replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_');
  s = s.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
  s = s.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~');
  s = s.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  s = s.replace(/<ul[^>]*>/gi, '\n').replace(/<\/ul>/gi, '\n');
  s = s.replace(/<ol[^>]*>/gi, '\n').replace(/<\/ol>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n').replace(/<p[^>]*>/gi, '');
  s = s.replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}
function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, ''); }

/* =========================================================
   IPC: IMAGES / LINKS
   ========================================================= */
ipcMain.handle('image:pick', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Изображения', extensions: ['png','jpg','jpeg','gif','webp','bmp','svg'] }]
  });
  if (res.canceled || !res.filePaths.length) return null;
  const src = res.filePaths[0];
  const ext = path.extname(src) || '.png';
  const dest = path.join(IMAGES_DIR, `img-${Date.now()}-${Math.random().toString(36).slice(2,6)}${ext}`);
  fs.copyFileSync(src, dest);
  return dest;
});

ipcMain.handle('image:saveDataUrl', (_e, { dataUrl }) => {
  const m = /^data:image\/(\w+);base64,(.*)$/.exec(dataUrl || '');
  if (!m) return null;
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const buf = Buffer.from(m[2], 'base64');
  const dest = path.join(IMAGES_DIR, `img-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`);
  fs.writeFileSync(dest, buf);
  return dest;
});

ipcMain.handle('shell:openExternal', (_e, rawUrl) => {
  if (!rawUrl) return false;
  let url = String(rawUrl).trim();
  // Если нет схемы — добавляем https://
  if (!/^[a-z][a-z0-9+\-.]*:\/\//i.test(url)) {
    url = 'https://' + url.replace(/^\/+/, '');
  }
  if (/^https?:\/\//i.test(url)) {
    shell.openExternal(url);
    return true;
  }
  return false;
});
ipcMain.handle('board:export-png', async (_e, { dataUrl, defaultName }) => {
  if (!dataUrl) return { error: 'Пустые данные' };
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Экспорт доски в PNG',
    defaultPath: (defaultName || 'board') + '.png',
    filters: [{ name: 'PNG', extensions: ['png'] }]
  });
  if (res.canceled || !res.filePath) return { error: 'Отменено' };
  try {
    const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(res.filePath, Buffer.from(base64, 'base64'));
    return { ok: true, path: res.filePath };
  } catch (e) {
    console.error('[main] export-png error', e);
    return { error: String(e) };
  }
});

ipcMain.handle('shell:openPath', async (_e, filePath) => {
  if (!filePath) return false;
  try {
    const err = await shell.openPath(filePath);
    if (err) console.error('[main] openPath error:', err);
    return !err;
  } catch (e) {
    console.error('[main] openPath exception:', e);
    return false;
  }
});