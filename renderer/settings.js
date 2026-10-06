/* ================= CheckLore — окно настроек ================= */
(function () {
  'use strict';
  const api    = window.api;
  const welcomeSel   = document.getElementById('welcomeSelect');
  const autosaveSel  = document.getElementById('autosaveSelect');
  const linkColorInp = document.getElementById('linkColorPicker');
  const opacityInp   = document.getElementById('defaultOpacity');
  const opacityVal   = document.getElementById('defaultOpacityValue');
  const status = document.getElementById('status');

  const currentTheme = localStorage.getItem('cl-theme') || 'dark';
  document.body.className = 'theme-' + currentTheme + ' settings-body';

  let statusTimer = null;
  function flash(text) {
    clearTimeout(statusTimer);
    status.textContent = text;
    statusTimer = setTimeout(() => {
      if (status.textContent === text) status.textContent = '';
    }, 2000);
  }

  function updateOpacityLabel() {
    if (opacityInp && opacityVal) {
      opacityVal.textContent = opacityInp.value + '%';
    }
  }

  async function persist() {
    const s = await api.loadSettings();
    s.welcomeScreen        = welcomeSel.value;
    s.autosaveTomeMinutes  = Number(autosaveSel.value);
    s.linkColor            = linkColorInp.value;
    if (opacityInp) s.defaultCardOpacity = Number(opacityInp.value);
    await api.saveSettings(s);
    flash('✓ Сохранено');
  }

  (async function init() {
    try {
      const s = await api.loadSettings();
      welcomeSel.value  = s.welcomeScreen || 'menu';
      autosaveSel.value = String(s.autosaveTomeMinutes ?? 3);
      linkColorInp.value = s.linkColor || '#4c8dff';
      if (opacityInp) {
        opacityInp.value = String(s.defaultCardOpacity ?? 85);
        updateOpacityLabel();
      }
    } catch (e) {
      console.error('[settings] load error', e);
    }
  })();

  welcomeSel.addEventListener('change', persist);
  autosaveSel.addEventListener('change', persist);
  linkColorInp.addEventListener('change', persist);
  linkColorInp.addEventListener('input', () => {
    // мгновенный предпросмотр в основной доске
    document.documentElement.style.setProperty('--preview-link-color', linkColorInp.value);
  });

  if (opacityInp) {
    // Пока тянешь — обновляем цифру, сохраняем только на отпускании
    opacityInp.addEventListener('input', updateOpacityLabel);
    opacityInp.addEventListener('change', persist);
  }

  document.getElementById('btnClose').onclick = () => window.close();

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