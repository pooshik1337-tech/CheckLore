const { contextBridge, ipcRenderer } = require('electron');

let tomePath = null;
for (const arg of process.argv) {
  if (arg.startsWith('--tome-file=')) {
    const raw = arg.slice('--tome-file='.length);
    try { tomePath = decodeURIComponent(raw); } catch { tomePath = raw; }
    break;
  }
}

contextBridge.exposeInMainWorld('api', {
  /* Доски */
  boardList:        ()         => ipcRenderer.invoke('board:list'),
  boardCreate:      (data)     => ipcRenderer.invoke('board:create', data),
  boardLoad:        (data)     => ipcRenderer.invoke('board:load', data),
  boardSave:        (data)     => ipcRenderer.invoke('board:save', data),
  boardDelete:      (data)     => ipcRenderer.invoke('board:delete', data),
  boardSetTitle:    (title)    => ipcRenderer.invoke('board:set-title', { title }),
  boardImport:      ()         => ipcRenderer.invoke('board:import'),
  boardExport:      (data)     => ipcRenderer.invoke('board:export', data),
  boardRename:      (data)     => ipcRenderer.invoke('board:rename', data),
  boardExportPng:   (data)     => ipcRenderer.invoke('board:export-png', data),

  /* Состояние */
  stateGet:         ()         => ipcRenderer.invoke('state:get'),
  stateSet:         (s)        => ipcRenderer.invoke('state:set', s),

  /* Тома */
  createTome:       (data)     => ipcRenderer.invoke('tome:create', data),
  readTome:         (filePath) => ipcRenderer.invoke('tome:read', filePath),
  writeTome:        (data)     => ipcRenderer.invoke('tome:write', data),
  openTome:         (data)     => ipcRenderer.invoke('tome:open', data),
  listAllTomes:     ()         => ipcRenderer.invoke('tome:list-all'),
  deleteTomeFile:   (filePath) => ipcRenderer.invoke('tome:delete-file', { filePath }),
  renameTomeFile:   (data)     => ipcRenderer.invoke('tome:rename-file', data),
  exportTome:       (filePath) => ipcRenderer.invoke('tome:export', { filePath }),

  /* Изображения */
  pickImage:        ()         => ipcRenderer.invoke('image:pick'),
  saveImageDataUrl: (data)     => ipcRenderer.invoke('image:saveDataUrl', data),

  /* Ссылки */
  openExternal:     (url)      => ipcRenderer.invoke('shell:openExternal', url),
  openPath:         (p)        => ipcRenderer.invoke('shell:openPath', p),

  /* Настройки */
  loadSettings:      ()    => ipcRenderer.invoke('settings:load'),
  saveSettings:      (s)   => ipcRenderer.invoke('settings:save', s),
  openSettings:      ()    => ipcRenderer.invoke('settings:open'),
  onSettingsChanged: (cb)  => ipcRenderer.on('settings:changed', (_e, s) => cb(s)),

  /* События */
  onTomeUpdated:    (cb) => ipcRenderer.on('tome:updated', (_e, d) => cb(d)),
  onBeforeClose:    (cb) => ipcRenderer.on('app:before-close', () => cb()),

  /* Закрытие */
  askSaveChanges:   ()   => ipcRenderer.invoke('dialog:ask-save-changes'),
  confirmClose:     ()   => ipcRenderer.send('app:confirm-close'),
  windowMinimize:        ()   => ipcRenderer.send('window:minimize'),
  windowToggleMaximize:  ()   => ipcRenderer.send('window:toggle-maximize'),
  windowClose:           ()   => ipcRenderer.send('window:close'),
  onMaximizedChanged:    (cb) => ipcRenderer.on('window:maximized-changed', (_e, isMax) => cb(isMax)),

  tomePath
});