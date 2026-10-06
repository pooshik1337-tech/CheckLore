/* ================= CheckLore — доска v4.0 (Photoshop-like + Связи) ================= */
const boardEl         = document.getElementById('board');
const viewport        = document.getElementById('boardViewport');
const contextMenu     = document.getElementById('contextMenu');
const modalBackdrop   = document.getElementById('modalBackdrop');
const modal           = document.getElementById('modal');
const boardInfo       = document.getElementById('boardInfo');
const zoomInfo        = document.getElementById('zoomInfo');
const btnTheme        = document.getElementById('btnTheme');
const btnSettings     = document.getElementById('btnSettings');
const btnSaveBoard    = document.getElementById('btnSaveBoard');
const welcomeOverlay  = document.getElementById('welcomeOverlay');
const btnCreateBoard  = document.getElementById('btnCreateBoard');
const btnBrowseBoards = document.getElementById('btnBrowseBoards');
const btnResumeLast   = document.getElementById('btnResumeLast');
const btnSwitchBoard  = document.getElementById('btnSwitchBoard');
const btnWelcomeTheme = document.getElementById('btnWelcomeTheme');

const btnUndo         = document.getElementById('btnUndo');
const btnRedo         = document.getElementById('btnRedo');
const btnSearch       = document.getElementById('btnSearch');
const btnGlobalSearch = document.getElementById('btnGlobalSearch');
const btnFilter       = document.getElementById('btnFilter');
const btnZoomIn       = document.getElementById('btnZoomIn');
const btnZoomOut      = document.getElementById('btnZoomOut');
const btnZoomReset    = document.getElementById('btnZoomReset');
const btnFit          = document.getElementById('btnFit');
const btnTomeManager  = document.getElementById('btnTomeManager');
const btnExportBoard  = document.getElementById('btnExportBoard');
const btnHelp         = document.getElementById('btnHelp');
const btnAnalytics    = document.getElementById('btnAnalytics');

const searchBar       = document.getElementById('searchBar');
const searchInput     = document.getElementById('searchInput');
const searchCounter   = document.getElementById('searchCounter');
const btnSearchPrev   = document.getElementById('btnSearchPrev');
const btnSearchNext   = document.getElementById('btnSearchNext');
const btnSearchClose  = document.getElementById('btnSearchClose');
const selectionRectEl = document.getElementById('selectionRect');

const filterBar       = document.getElementById('filterBar');
const filterType      = document.getElementById('filterType');
const filterTag       = document.getElementById('filterTag');
const filterAuthor    = document.getElementById('filterAuthor');
const filterDeadline  = document.getElementById('filterDeadline');
const filterCounter   = document.getElementById('filterCounter');
const btnFilterClear  = document.getElementById('btnFilterClear');
const btnFilterClose  = document.getElementById('btnFilterClose');

const helpOverlay     = document.getElementById('helpOverlay');
const analyticsOverlay   = document.getElementById('analyticsOverlay');
const analyticsContent   = document.getElementById('analyticsContent');
const btnAnalyticsClose  = document.getElementById('btnAnalyticsClose');
const btnHelpClose    = document.getElementById('btnHelpClose');

const propsPanel      = document.getElementById('propsPanel');
const propsEmpty      = document.getElementById('propsEmpty');
const propsContent    = document.getElementById('propsContent');

let board = { name: 'Новая доска', width: 1000, height: 1000, items: [], links: [] };
let currentBoardId = null;
let isDirty = false;
let currentTheme = localStorage.getItem('cl-theme') || 'dark';
let selectedIds = new Set();
let clipboard = [];
let searchQuery = '';
let searchMatches = [];
let searchIndex = -1;
let activeTool = 'select';
let linkAnchorId = null;
let snapMode = localStorage.getItem('cl-snap-mode') || 'board';   // 'off' | 'grid' | 'board'
let viewMode = 'board';   // 'board' | 'kanban'
let tempAttachments = []; // временное хранилище вложений при редактировании формы
let appSettings = { defaultCardOpacity: 85 }; // кеш настроек
const activeFilters = { type: '', tag: '', author: '', deadline: '' };

function defaultCardOpacity() {
  const v = Number(appSettings.defaultCardOpacity ?? 85);
  return Math.max(0.2, Math.min(1, v / 100));
}

function applyLinkColor(color) {
  if (!color) color = '#4c8dff';
  document.documentElement.style.setProperty('--link-color', color);
}
const isFrame = (item) => item && item.type === 'frame';
const SVG_NS = 'http://www.w3.org/2000/svg';
const isOutsideBoard = (item) => {
  if (!item || isFrame(item)) return false;
  return item.x + item.w <= 0 ||
         item.y + item.h <= 0 ||
         item.x >= board.width ||
         item.y >= board.height;
};

const BASE_STATUSES = [
  { id: 'todo',        label: 'TODO',       title: 'К выполнению', color: '#6b7280', isBase: true },
  { id: 'in_progress', label: 'В работе',   title: 'В работе',     color: '#3b82f6', isBase: true },
  { id: 'done',        label: 'Готово',     title: 'Готово',       color: '#16a34a', isBase: true },
  { id: 'cancelled',   label: 'Отменено',   title: 'Отменено',     color: '#b91c1c', isBase: true }
];

// Возвращает все статусы: стандартные + кастомные из настроек
function getAllStatuses() {
  const custom = Array.isArray(appSettings.customStatuses) ? appSettings.customStatuses : [];
  return [...BASE_STATUSES, ...custom.map(s => ({ ...s, isBase: false }))];
}

// Возвращает статус по id или null
function getStatusById(id) {
  return getAllStatuses().find(s => s.id === id) || null;
}

// Название статуса по id (для карточек и свойств)
function statusLabel(id) {
  const s = getStatusById(id);
  return s ? s.label : (id || '');
}

// Цвет статуса по id
function statusColor(id) {
  const s = getStatusById(id);
  return s ? s.color : '#6b7280';
}

// Для обратной совместимости со старым кодом
const STATUSES = BASE_STATUSES;
const STATUS_LABELS = {};
const STATUS_COLORS = {};
for (const s of BASE_STATUSES) {
  STATUS_LABELS[s.id] = s.label;
  STATUS_COLORS[s.id] = s.color;
}
/* =========================================================
   ФРАЗЫ-ПРИЗРАКИ ДЛЯ ПОЛЕЙ ВВОДА
   ========================================================= */
const PLACEHOLDERS = {
  noteTitle: [
    // Работа и офис
    'Позвонить клиенту', 'Ответить на письмо', 'Подготовить отчёт',
    'Согласовать встречу', 'Проверить договор', 'Оформить документы',
    'Обсудить с командой', 'Напомнить о дедлайне', 'Встреча в 15:00',
    'Задача на сегодня', 'Срочно до вечера', 'На согласование',
    // Разработка
    'Проверить звук', 'Добавить анимацию', 'Поправить баг',
    'Ревизия кода', 'Обновить зависимости', 'Написать тесты',
    'Сделать рефакторинг', 'Проверить логи', 'Разобрать задачу',
    // Учёба и саморазвитие
    'Прочитать главу', 'Выучить 20 слов', 'Конспект лекции',
    'Сделать домашку', 'Посмотреть вебинар', 'Повторить тему',
    'Разобрать ошибки', 'Пройти тест',
    // Дом и быт
    'Купить продукты', 'Записаться к врачу', 'Оплатить счета',
    'Забрать посылку', 'Починить кран', 'Помыть машину',
    'Заказать доставку', 'Сходить в спортзал', 'Сдать анализы',
    'Полить цветы', 'Погулять с собакой', 'Проверить почту',
    // Финансы
    'Перевести деньги', 'Проверить бюджет', 'Оплатить подписку',
    'Разобрать траты', 'Отложить на отпуск',
    // Творчество и хобби
    'Идея для поста', 'Наброски статьи', 'Черновик рассказа',
    'Идея на потом', 'Скетч персонажа', 'Записать трек',
    'Продумать сюжет', 'Раскадровка сцены',
    // Личное
    'Позвонить маме', 'Поздравить друга', 'Купить подарок',
    'Записаться на курсы', 'Начать бегать по утрам', 'Сходить к парикмахеру',
    'Забронировать билеты', 'Выбрать отель',
    // Разное
    'Не забыть', 'Разобраться позже', 'Уточнить детали',
    'Ожидание ответа', 'Личная заметка', 'Разное', 'На будущее'
  ],

  noteContent: [
    // Работа и задачи
    'Сделать до конца недели, потом отчитаться',
    'Уточнить требования у заказчика перед началом',
    'Позвонить и согласовать детали встречи',
    'Проверить всё перед отправкой клиенту',
    'Обсудить состав команды на проекте',
    'Подготовить материалы к презентации',
    'Не забыть приложить файлы к письму',
    // Разработка
    'Доработать анимацию взмаха мечом',
    'Проверить поведение при переполнении',
    'Идея: добавить горячую клавишу для быстрого сохранения',
    'Связаться с подрядчиком по звуку',
    'Проверить на слабом железе',
    'Написать тесты для краевых случаев',
    'Отрефакторить перед добавлением новой фичи',
    'Проверить кроссплатформенность',
    // Учёба
    'Повторить материал по конспекту',
    'Сделать карточки для запоминания',
    'Посмотреть ещё раз разбор задачи',
    'Найти дополнительные примеры',
    'Разобрать ошибки из последнего теста',
    // Дом и быт
    'Купить хлеб, молоко и что-нибудь к чаю',
    'Записаться к врачу на следующей неделе',
    'Уточнить время приёма',
    'Оплатить коммуналку до 10-го числа',
    'Не забыть взять наличные',
    'Заехать по пути домой',
    // Финансы
    'Посчитать траты за месяц',
    'Отложить 10% от зарплаты',
    'Проверить подписки — что не используется',
    'Сравнить цены перед покупкой',
    // Творчество
    'Записать идею, пока не забыл(а)',
    'Продумать структуру и раскидать по главам',
    'Набросать черновик, отредактируем позже',
    'Найти референсы в интернете',
    'Посмотреть, как это делают другие',
    // Личное
    'Позвонить, узнать как дела',
    'Напомнить о договорённости',
    'Выбрать подарок до конца месяца',
    'Записаться на пробное занятие',
    // Разное
    'Разобраться попозже, сейчас не до этого',
    'Просто мысль, вернуться к ней на выходных',
    'Пометить, чтобы не потерять'
  ],

  noteAuthor: [
    'Макс', 'Иван', 'Аня', 'Саша', 'Мария', 'Олег', 'Катя', 'Дима',
    'Настя', 'Петя', 'Лена', 'Костя', 'Оля', 'Женя', 'Артём', 'Вика',
    'Юля', 'Никита', 'Соня', 'Стас', 'Кира', 'Тимур', 'Даша', 'Рома'
  ],

  tag: [
    // Рабочие
    'Работа', 'Офис', 'Клиенты', 'Проект', 'Встреча', 'Созвон',
    'Документы', 'Отчёт', 'Срочно', 'На проверку', 'Согласование',
    // Разработка
    'Разработка', 'Дизайн', 'Звук', 'Тестирование', 'Баги', 'Рефакторинг',
    'Идея', 'Фича', 'Техдолг',
    // Учёба
    'Учёба', 'Курсы', 'Чтение', 'Практика', 'Экзамен', 'Конспект',
    // Дом и быт
    'Дом', 'Быт', 'Покупки', 'Семья', 'Здоровье', 'Спорт',
    // Финансы
    'Финансы', 'Бюджет', 'Платежи', 'Инвестиции',
    // Личное
    'Личное', 'Хобби', 'Отдых', 'Путешествия', 'Друзья',
    // Общее
    'Важное', 'На будущее', 'Отложено', 'Обсудить', 'Входящие', 'Архив'
  ],

  paragraphTitle: [
    // Работа
    'Итоги недели', 'План на месяц', 'Заметки к встрече', 'Разбор полётов',
    'Ключевые задачи', 'Основные пункты', 'Резюме проекта',
    'Вводная часть отчёта', 'Описание процесса', 'Чек-лист подготовки',
    // Документация
    'Описание задачи', 'Черновик документа', 'Инструкция', 'Пояснения',
    'Технические детали', 'Краткое содержание',
    // Учёба
    'Конспект лекции', 'Основные тезисы', 'Материал по теме',
    'Краткий пересказ', 'Схема разбора', 'Ответы на вопросы',
    // Творчество
    'Набросок главы', 'Описание сцены', 'Характеристика персонажа',
    'Заметки по миру', 'Идея сюжета', 'План рассказа',
    // Дом
    'Список дел на выходные', 'План ремонта', 'Покупки к празднику',
    'Меню на неделю', 'Список книг', 'Планы на отпуск'
  ],

  paragraphContent: [
    // Универсальные
    'Тут можно написать развёрнутое описание...',
    'Основные тезисы по этой теме:',
    'Краткое введение в тему:',
    'Черновые мысли — потом доработать...',
    'Тезисно: 1) ... 2) ... 3) ...',
    'Описание в двух-трёх предложениях...',
    'Средний текстовый блок с описанием...',
    'Важно: вернуться к этому и дополнить',
    // Рабочие
    'Итог: сделали то-то, осталось то-то...',
    'Обсудили в команде, пришли к решению...',
    'Ожидания: срок — до конца месяца',
    'Причины и следствия — разобрать подробнее',
    // Документация
    'Шаг 1: открыть... Шаг 2: настроить... Шаг 3: проверить...',
    'Порядок действий: сначала А, потом Б, при необходимости В',
    'Ключевые моменты, на которые стоит обратить внимание',
    // Учёба
    'Определение: ... Пример: ... Применение: ...',
    'Сначала разберём теорию, потом перейдём к практике',
    'Что нужно запомнить по этой теме:',
    // Творчество
    'Атмосфера: тихая, вечерняя, немного тревожная',
    'Главный герой — ..., его цель — ...',
    'Завязка: ... Развитие: ... Финал: ...',
    // Дом
    'Что нужно: список покупок, время, помощники',
    'Сделать сначала самое важное, потом по мелочи',
    'Бюджет: ~ такая-то сумма, срок — до конца месяца'
  ],

  linkTitle: [
    // Работа
    'Полезная статья', 'Документация', 'Регламент', 'Инструкция',
    'Примеры', 'Шаблон', 'Образец',
    // Обучение
    'Обучающее видео', 'Туториал', 'Гайд', 'Курс', 'Вебинар',
    'Шпаргалка', 'Конспект', 'Референс',
    // Разное
    'Ресурс по теме', 'Инструмент', 'Полезный сервис', 'Сайт',
    'Канал', 'Подкаст', 'Книга', 'Статья на Habr',
    'Обсуждение', 'Вопрос на Stack Overflow', 'Сравнение'
  ],

  linkUrl: [
    'https://example.com',
    'https://www.youtube.com/...',
    'https://habr.com/...',
    'https://stackoverflow.com/...',
    'https://developer.mozilla.org/...',
    'https://docs.google.com/...',
    'https://github.com/...',
    'https://medium.com/...',
    'https://ru.wikipedia.org/...',
    'https://www.notion.so/...',
    'https://trello.com/...',
    'https://www.figma.com/...'
  ],

  frameTitle: [
    // Работа
    'Проект', 'Задачи', 'Спринт 1', 'Этап 1', 'Архив', 'Срочное',
    'Входящие', 'На согласование', 'Бэклог',
    // Разработка
    'Разработка', 'Дизайн', 'Звук', 'Арт', 'Тестирование', 'Референсы',
    'Идеи', 'Черновики', 'Концепты',
    // Личное
    'Личное', 'Учёба', 'Дом', 'Финансы', 'Здоровье', 'Путешествия',
    'Хобби', 'Чтение', 'Спорт',
    // Разное
    'Разное', 'На будущее', 'Важное', 'Отложено'
  ],

  statusName: [
    // Рабочие
    'На проверке', 'Ждёт ответа', 'Заблокировано', 'Запланировано',
    'В очереди', 'Доработка', 'Согласование', 'Тестирование',
    'В процессе', 'Ожидание', 'Согласовано', 'На паузе',
    // Учёба и личное
    'Изучаю', 'Практика', 'Повторение', 'На потом', 'Сделано сегодня',
    // Общее
    'Архив', 'Отложено', 'Не срочно', 'Важное', 'Срочное'
  ],

  boardName: [
    // Универсальные
    'Моя доска', 'Рабочая доска', 'Новая доска', 'Черновик проекта',
    'Доска идей', 'Доска задач', 'Доска команды', 'Например: Проект X',
    // Работа
    'Проект 2026', 'Планирование', 'Спринт', 'Рабочие задачи',
    'План на квартал', 'Список дел',
    // Учёба
    'Учёба', 'Курсы', 'Конспекты', 'Материалы',
    // Личное
    'Дом', 'Покупки', 'Ремонт', 'Отпуск', 'Чтение', 'Хобби',
    'Дневник', 'Планы', 'Идеи',
    // Творчество
    'Черновики', 'Наброски', 'Референсы', 'Вдохновение'
  ],

  fileName: [
    'Название', 'Черновик', 'Итог', 'Файл', 'Описание',
    'Референс', 'Скриншот', 'Фото', 'Рисунок', 'Схема',
    'Карта', 'Макет', 'Логотип', 'Иконка', 'Пример'
  ]
};

function pickPlaceholder(list) {
  if (!Array.isArray(list) || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}
const LABELS = [
  { id: 'important', mark: '!', title: 'Важное' },
  { id: 'question',  mark: '?', title: 'Вопрос' },
  { id: 'done',      mark: '✓', title: 'Сделано' }
];

/* =========================================================
   VIEW
   ========================================================= */
const view = { tx: 0, ty: 0, scale: 1 };

function applyTransform() {
  if (!boardEl) return;
  boardEl.style.left = '';
  boardEl.style.top  = '';
  boardEl.style.zoom = '';
  boardEl.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
  if (zoomInfo) zoomInfo.textContent = Math.round(view.scale * 100) + '%';
}

function screenToBoard(clientX, clientY) {
  const r = viewport.getBoundingClientRect();
  return {
    x: (clientX - r.left - view.tx) / view.scale,
    y: (clientY - r.top  - view.ty) / view.scale
  };
}
function fitBoard() {
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  if (!vw || !vh) return;
  const pad = 60;
  const s = Math.min((vw - pad*2) / board.width, (vh - pad*2) / board.height, 1);
  view.scale = s;
  view.tx = (vw - board.width  * s) / 2;
  view.ty = (vh - board.height * s) / 2;
  applyTransform();
}
function zoomBy(factor, centerX, centerY) {
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const cx = centerX != null ? centerX : vw / 2;
  const cy = centerY != null ? centerY : vh / 2;
  const oldScale = view.scale;
  const newScale = Math.max(0.15, Math.min(4, oldScale * factor));
  view.tx = cx - (cx - view.tx) * (newScale / oldScale);
  view.ty = cy - (cy - view.ty) * (newScale / oldScale);
  view.scale = newScale;
  applyTransform();
}
function zoomReset() {
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const cx = vw / 2, cy = vh / 2;
  const oldScale = view.scale;
  view.tx = cx - (cx - view.tx) * (1 / oldScale);
  view.ty = cy - (cy - view.ty) * (1 / oldScale);
  view.scale = 1;
  applyTransform();
}
function centerOnItem(id) {
  const item = board.items.find(i => i.id === id);
  if (!item) return;
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  view.tx = vw / 2 - (item.x + item.w / 2) * view.scale;
  view.ty = vh / 2 - (item.y + item.h / 2) * view.scale;
  applyTransform();
}

viewport.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const r = viewport.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const oldScale = view.scale;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const newScale = Math.max(0.15, Math.min(4, oldScale * factor));
  view.tx = mx - (mx - view.tx) * (newScale / oldScale);
  view.ty = my - (my - view.ty) * (newScale / oldScale);
  view.scale = newScale;
  applyTransform();
}, { passive: false });

let panning = false, panStart = null;
viewport.addEventListener('pointerdown', (e) => {
  if (e.button !== 1) return;
  e.preventDefault();
  panning = true;
  panStart = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  try { viewport.setPointerCapture(e.pointerId); } catch {}
  viewport.classList.add('panning');
});
viewport.addEventListener('pointermove', (e) => {
  if (!panning) return;
  view.tx = panStart.tx + (e.clientX - panStart.x);
  view.ty = panStart.ty + (e.clientY - panStart.y);
  applyTransform();
});
viewport.addEventListener('pointerup', (e) => {
  if (!panning) return;
  panning = false;
  try { viewport.releasePointerCapture(e.pointerId); } catch {}
  viewport.classList.remove('panning');
});
viewport.addEventListener('pointercancel', () => {
  panning = false;
  viewport.classList.remove('panning');
});
viewport.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

/* =========================================================
   УТИЛИТЫ
   ========================================================= */
const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toFileUrl(p) {
  let s = String(p).replace(/\\/g, '/');
  if (!s.startsWith('/')) s = '/' + s;
  return 'file://' + s;
}
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function markDirty() { isDirty = true; }

async function saveBoard(showNotify = true) {
  if (!currentBoardId) return false;
  try {
    const ok = await window.api.boardSave({ id: currentBoardId, data: board });
    if (ok) {
      isDirty = false;
      if (showNotify) {
        showToast('success', 'Успешно сохранено!', 'Доска записана на диск.');
      }
    } else {
      if (showNotify) {
        showToast('error', 'Не удалось сохранить', 'Доска не записана. Проверьте доступ к папке workspace.', 'ERR-SAVE-FALSE');
      }
    }
    return ok;
  } catch (err) {
    console.error('[CheckLore] saveBoard error', err);
    if (showNotify) {
      showToast('error', 'Не удалось сохранить', String(err && err.message || err), 'ERR-SAVE-EXC');
    }
    return false;
  }
}

/* =========================================================
   GHOST-ИНСТРУМЕНТЫ (карточка следует за курсором)
   ========================================================= */
let ghostEl = null;
let ghostTool = null;

const GHOST_DIMS = {
  note:      [240, 160],
  paragraph: [320, 200],
  tome:      [260, 150],
  link:      [220, 100]
};
const GHOST_LABELS = {
  note: 'Заметка', paragraph: 'Абзац', tome: 'Том', link: 'Ссылка'
};

function startGhostTool(tool) {
  cancelGhostTool();
  ghostTool = tool;
  const [w, h] = GHOST_DIMS[tool];
  ghostEl = document.createElement('div');
  ghostEl.className = 'ghost-item ghost-' + tool;
  ghostEl.dataset.label = GHOST_LABELS[tool] || 'Карточка';
  ghostEl.style.width  = w + 'px';
  ghostEl.style.height = h + 'px';
  const r = viewport.getBoundingClientRect();
  ghostEl.style.left = (r.left + viewport.clientWidth  / 2 - w / 2) + 'px';
  ghostEl.style.top  = (r.top  + viewport.clientHeight / 2 - h / 2) + 'px';
  document.body.appendChild(ghostEl);
  document.addEventListener('mousemove', onGhostMove);
  viewport.addEventListener('click', onGhostPlace, true);
  document.addEventListener('keydown', onGhostKeydown);
}

function onGhostMove(e) {
  if (!ghostEl) return;
  const w = ghostEl.offsetWidth, h = ghostEl.offsetHeight;
  ghostEl.style.left = (e.clientX - w / 2) + 'px';
  ghostEl.style.top  = (e.clientY - h / 2) + 'px';
}

function onGhostPlace(e) {
  if (!ghostEl) return;
  if (e.target.closest('.item, .frame, .tools-panel, .props-panel, .topbar, .context-menu, .modal-backdrop, .search-bar, .filter-bar, .help-overlay')) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();

  const tool = ghostTool;
  const [w, h] = GHOST_DIMS[tool];
  const pos = screenToBoard(e.clientX, e.clientY);
  const px = pos.x - w / 2;
  const py = pos.y - h / 2;

  cancelGhostTool();
  setActiveTool('select');

  if (tool === 'note')           createNote(px, py);
  else if (tool === 'paragraph') createParagraph(px, py);
  else if (tool === 'tome')      createTome(px, py);
  else if (tool === 'link')      createLink(px, py);
}

function onGhostKeydown(e) {
  if (e.key === 'Escape') {
    cancelGhostTool();
    setActiveTool('select');
  }
}

function cancelGhostTool() {
  if (ghostEl) { ghostEl.remove(); ghostEl = null; }
  ghostTool = null;
  document.removeEventListener('mousemove', onGhostMove);
  viewport.removeEventListener('click', onGhostPlace, true);
  document.removeEventListener('keydown', onGhostKeydown);
}

/* =========================================================
   ИНСТРУМЕНТЫ (левая панель)
   ========================================================= */
function setActiveTool(tool) {
  cancelGhostTool();

  // «Изображение» — сразу открываем диалог выбора файла, в центр экрана
  if (tool === 'image') {
    activeTool = 'select';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === 'select'));
    viewport.style.cursor = '';
    const r = viewport.getBoundingClientRect();
    const c = screenToBoard(r.left + viewport.clientWidth / 2, r.top + viewport.clientHeight / 2);
    addImageFromDialog(c.x - 110, c.y - 90);
    return;
  }

  activeTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });

  if (tool === 'pan')       viewport.style.cursor = 'grab';
  else if (tool === 'zoom') viewport.style.cursor = 'zoom-in';
  else if (tool === 'select') viewport.style.cursor = '';
  else if (tool === 'frame')  viewport.style.cursor = 'crosshair';
  else if (['note','paragraph','tome','link'].includes(tool)) {
    viewport.style.cursor = '';
    startGhostTool(tool);
  }
  else viewport.style.cursor = 'crosshair';
}
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.onclick = () => setActiveTool(btn.dataset.tool);
});

let drawingRect = null;

viewport.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (activeTool === 'select') return;
  if (e.target.closest('.item, .frame, .context-menu, .modal-backdrop, .tools-panel, .props-panel, .topbar')) return;

  // ПАНОРАМА
  if (activeTool === 'pan') {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startTx = view.tx, startTy = view.ty;
    viewport.classList.add('panning');
    try { viewport.setPointerCapture(e.pointerId); } catch {}
    const onMove = (ev) => {
      view.tx = startTx + (ev.clientX - startX);
      view.ty = startTy + (ev.clientY - startY);
      applyTransform();
    };
    const onUp = (ev) => {
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerup', onUp);
      viewport.removeEventListener('pointercancel', onUp);
      viewport.classList.remove('panning');
      try { viewport.releasePointerCapture(ev.pointerId); } catch {}
    };
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onUp);
    return;
  }

  // ЗУМ (ЛКМ — приближение)
  if (activeTool === 'zoom') {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    zoomBy(1.25, e.clientX - r.left, e.clientY - r.top);
    return;
  }

  // РИСОВАНИЕ ОБЛАСТИ
  if (activeTool === 'frame') {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    try { viewport.setPointerCapture(e.pointerId); } catch {}

    drawingRect = document.createElement('div');
    drawingRect.className = 'drawing-rect';
    document.body.appendChild(drawingRect);

    const onMove = (ev) => {
      const x = Math.min(startX, ev.clientX);
      const y = Math.min(startY, ev.clientY);
      const w = Math.abs(ev.clientX - startX);
      const h = Math.abs(ev.clientY - startY);
      drawingRect.style.left = x + 'px';
      drawingRect.style.top = y + 'px';
      drawingRect.style.width = w + 'px';
      drawingRect.style.height = h + 'px';
    };
    const onUp = (ev) => {
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerup', onUp);
      try { viewport.releasePointerCapture(ev.pointerId); } catch {}

      const x = Math.min(startX, ev.clientX);
      const y = Math.min(startY, ev.clientY);
      const w = Math.abs(ev.clientX - startX);
      const h = Math.abs(ev.clientY - startY);

      if (drawingRect) { drawingRect.remove(); drawingRect = null; }

      setActiveTool('select');
      if (w < 40 || h < 40) return;

      const p1 = screenToBoard(x, y);
      const p2 = screenToBoard(x + w, y + h);
      const bx = Math.min(p1.x, p2.x);
      const by = Math.min(p1.y, p2.y);
      const bw = Math.max(180, Math.abs(p2.x - p1.x));
      const bh = Math.max(120, Math.abs(p2.y - p1.y));
      createFrame(bx, by, bw, bh);
    };
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    return;
  }
});

// ПКМ в режиме зума — отдаление (capture-фаза, до контекстного меню)
viewport.addEventListener('contextmenu', (e) => {
  if (activeTool !== 'zoom') return;
  e.preventDefault();
  e.stopPropagation();
  const r = viewport.getBoundingClientRect();
  zoomBy(1 / 1.25, e.clientX - r.left, e.clientY - r.top);
}, true);

/* =========================================================
   ПАНЕЛЬ СВОЙСТВ (правая)
   ========================================================= */
function updatePropsPanel() {
  if (!propsContent || !propsEmpty) return;
  if (selectedIds.size === 0) {
    propsEmpty.style.display = '';
    propsContent.style.display = 'none';
    propsContent.innerHTML = '';
    return;
  }
  if (selectedIds.size > 1) {
    propsEmpty.style.display = 'none';
    propsContent.style.display = 'block';
    propsContent.innerHTML = `
      <div class="props-section-title">Множественное выделение</div>
      <div class="props-row"><span class="props-label">Карточек</span><span class="props-value">${selectedIds.size}</span></div>

      <div class="props-section-title">Выравнивание</div>
      <div class="props-align-grid props-align-grid-2">
        <button data-action="align-left" title="Выстроить в столбик по левому краю">⇤ По X</button>
        <button data-action="align-top"  title="Выстроить в ряд по верхнему краю">↥ По Y</button>
      </div>

      <div class="props-actions">
        <button class="tb-btn" data-action="copy">Копировать</button>
        <button class="tb-btn" data-action="duplicate">Дублировать</button>
      </div>
      <div class="props-actions">
        <button class="tb-btn danger" data-action="delete">Удалить выделенное</button>
      </div>`;
    attachPropsActions();
    return;
  }
  const id = Array.from(selectedIds)[0];
  const item = board.items.find(i => i.id === id);
  if (!item) {
    propsEmpty.style.display = '';
    propsContent.style.display = 'none';
    return;
  }
  propsEmpty.style.display = 'none';
  propsContent.style.display = 'block';
  const typeLabels = {note:'Заметка', paragraph:'Абзац', tome:'Том', image:'Картинка', link:'Ссылка'};
  let html = '<div class="props-section-title">Карточка</div>';
  html += `<div class="props-row"><span class="props-label">Тип</span><span class="props-value">${typeLabels[item.type] || item.type}</span></div>`;
  if (item.title) html += `<div class="props-row"><span class="props-label">Название</span><span class="props-value">${escapeHtml(item.title)}</span></div>`;
  if (item.tag) html += `<div class="props-row"><span class="props-label">Тег</span><span class="props-value">${escapeHtml(item.tag)}</span></div>`;
  if (item.status && item.type === 'note') {
    const lbl = STATUS_LABELS[item.status] || item.status;
    html += `<div class="props-row"><span class="props-label">Статус</span><span class="props-value"><span class="props-status-badge" data-status="${item.status}">${lbl}</span></span></div>`;
  }
  if (Array.isArray(item.labels) && item.labels.length) {
    const marks = item.labels.map(id => (LABELS.find(l => l.id === id)?.mark || '')).join(' ');
    html += `<div class="props-row"><span class="props-label">Метки</span><span class="props-value">${marks}</span></div>`;
  }
  if (item.author) html += `<div class="props-row"><span class="props-label">Автор</span><span class="props-value">${escapeHtml(item.author)}</span></div>`;
  if (item.deadline) html += `<div class="props-row"><span class="props-label">Срок</span><span class="props-value">${escapeHtml(item.deadline)}</span></div>`;
  if (item.url) html += `<div class="props-row"><span class="props-label">URL</span><span class="props-value">${escapeHtml(item.url)}</span></div>`;
  html += `<div class="props-row"><span class="props-label">Позиция</span><span class="props-value">${Math.round(item.x)}, ${Math.round(item.y)}</span></div>`;
  html += `<div class="props-row"><span class="props-label">Размер</span><span class="props-value">${Math.round(item.w)} × ${Math.round(item.h)}</span></div>`;

  const linkCount = (board.links || []).filter(l => l.from === item.id || l.to === item.id).length;
  if (linkCount) {
    html += '<div class="props-section-title">Связи</div>';
    html += `<div class="props-row"><span class="props-label">Всего</span><span class="props-value">${linkCount}</span></div>`;
  }

  html += '<div class="props-actions"><button class="tb-btn" data-action="edit">Редактировать</button></div>';
  html += '<div class="props-actions"><button class="tb-btn" data-action="duplicate">Дублировать</button><button class="tb-btn" data-action="link">Связать</button></div>';
  html += '<div class="props-actions"><button class="tb-btn danger" data-action="delete">Удалить</button></div>';
  propsContent.innerHTML = html;
  attachPropsActions();
}

function attachPropsActions() {
  if (!propsContent) return;
  propsContent.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.action;
      const ids = Array.from(selectedIds);
      if (action === 'copy') copySelection();
      else if (action === 'duplicate') duplicateSelection();
      else if (action === 'delete') deleteSelection();
      else if (action === 'edit' && ids.length === 1) {
        const it = board.items.find(i => i.id === ids[0]);
        if (it) editItem(it);
      }
      else if (action === 'link' && ids.length === 1) {
        const it = board.items.find(i => i.id === ids[0]);
        if (it) openLinkPicker(it);
      }
      else if (action === 'align-left') alignSelection('left');
      else if (action === 'align-top')  alignSelection('top');
    };
  });
}

/* =========================================================
   ИСТОРИЯ
   ========================================================= */
const history = { stack: [], index: -1, maxSize: 80 };
function snapshotBoard() {
  return JSON.stringify({
    width: board.width, height: board.height,
    items: board.items, links: board.links || []
  });
}
function pushHistory() {
  const snap = snapshotBoard();
  if (history.index >= 0 && history.stack[history.index] === snap) return;
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(snap);
  if (history.stack.length > history.maxSize) history.stack.shift();
  history.index = history.stack.length - 1;
  updateUndoRedoButtons();
}
function resetHistory() {
  history.stack = [snapshotBoard()];
  history.index = 0;
  updateUndoRedoButtons();
}
function undo() {
  if (history.index <= 0) return;
  history.index--;
  applyHistorySnapshot(history.stack[history.index]);
  updateUndoRedoButtons();
}
function redo() {
  if (history.index >= history.stack.length - 1) return;
  history.index++;
  applyHistorySnapshot(history.stack[history.index]);
  updateUndoRedoButtons();
}
function applyHistorySnapshot(snap) {
  const data = JSON.parse(snap);
  board.width = data.width;
  board.height = data.height;
  board.items = data.items;
  board.links = data.links || [];
  selectedIds.clear();
  renderBoard();
  markDirty();
}
function updateUndoRedoButtons() {
  if (btnUndo) btnUndo.disabled = history.index <= 0;
  if (btnRedo) btnRedo.disabled = history.index >= history.stack.length - 1;
}

/* =========================================================
   МАГНИТЫ
   ========================================================= */
const SNAP_THRESHOLD = 40;
function findSnapX(item, newX, others) {
  let best = null;
  for (const o of others) {
    if (o.id === item.id || isFrame(o)) continue;
    for (const t of [o.x, o.x + o.w, o.x - item.w, o.x + o.w - item.w]) {
      const d = Math.abs(t - newX);
      if (d <= SNAP_THRESHOLD && (!best || d < best.d)) best = { value: t, d };
    }
  }
  return best ? best.value : null;
}
function findSnapY(item, newY, others) {
  let best = null;
  for (const o of others) {
    if (o.id === item.id || isFrame(o)) continue;
    for (const t of [o.y, o.y + o.h, o.y - item.h, o.y + o.h - item.h]) {
      const d = Math.abs(t - newY);
      if (d <= SNAP_THRESHOLD && (!best || d < best.d)) best = { value: t, d };
    }
  }
  return best ? best.value : null;
}

/* =========================================================
   СТОПКИ
   ========================================================= */
function overlapRatio(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  if (inter <= 0) return 0;
  const smaller = Math.min(a.w * a.h, b.w * b.h) || 1;
  return inter / smaller;
}
function updateStackIndicators() {
  boardEl.querySelectorAll('.stack-indicator').forEach(n => n.remove());
  const items = board.items.filter(it => !isFrame(it) && !isOutsideBoard(it));
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let hiddenBehind = 0, hasFront = false;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      if (overlapRatio(item, items[j]) < 0.5) continue;
      if (j < i) hiddenBehind++;
      else hasFront = true;
    }
    if (hiddenBehind > 0 && !hasFront) {
      const el = boardEl.querySelector(`.item[data-id="${item.id}"]`);
      if (!el) continue;
      const badge = document.createElement('div');
      badge.className = 'stack-indicator';
      badge.title = `Под этой карточкой ещё ${hiddenBehind}`;
      badge.textContent = hiddenBehind;
      badge.addEventListener('pointerdown', (e) => e.stopPropagation());
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        bringNextBehindToFront(item.id);
      });
      el.appendChild(badge);
    }
  }
}
function bringNextBehindToFront(itemId) {
  const idx = board.items.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  const item = board.items[idx];
  let bestJ = -1;
  for (let j = idx - 1; j >= 0; j--) {
    if (isFrame(board.items[j])) continue;
    if (overlapRatio(item, board.items[j]) >= 0.5) { bestJ = j; break; }
  }
  if (bestJ === -1) return;
  const [moved] = board.items.splice(bestJ, 1);
  board.items.push(moved);
  renderBoard();
  markDirty();
  pushHistory();
}

/* =========================================================
   ВЫДЕЛЕНИЕ
   ========================================================= */
function updateSelectionClasses() {
  boardEl.querySelectorAll('.item').forEach(el => {
    if (selectedIds.has(el.dataset.id)) el.classList.add('selected');
    else el.classList.remove('selected');
    if (linkAnchorId && el.dataset.id === linkAnchorId) el.classList.add('link-anchor');
    else el.classList.remove('link-anchor');
  });
  updatePropsPanel();
}
function selectOnly(id) {
  selectedIds.clear();
  if (id) selectedIds.add(id);
  updateSelectionClasses();
}
function toggleSelect(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  updateSelectionClasses();
}
function clearSelection() {
  selectedIds.clear();
  linkAnchorId = null;
  updateSelectionClasses();
}
function selectAll() {
  selectedIds = new Set(board.items.filter(it => !isFrame(it)).map(i => i.id));
  updateSelectionClasses();
}
function itemIntersectsRect(item, rect) {
  return !(item.x + item.w < rect.x || item.x > rect.x + rect.w ||
           item.y + item.h < rect.y || item.y > rect.y + rect.h);
}

let marquee = null;
viewport.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (activeTool !== 'select') return;
  if (e.target.closest('.item, .frame, .context-menu, .modal-backdrop')) return;
  if (panning) return;
  marquee = {
    startScreenX: e.clientX, startScreenY: e.clientY,
    currentScreenX: e.clientX, currentScreenY: e.clientY
  };
  try { viewport.setPointerCapture(e.pointerId); } catch {}
});
viewport.addEventListener('pointermove', (e) => {
  if (!marquee) return;
  marquee.currentScreenX = e.clientX;
  marquee.currentScreenY = e.clientY;
  updateMarqueeRect();
});
viewport.addEventListener('pointerup', (e) => {
  if (!marquee) return;
  try { viewport.releasePointerCapture(e.pointerId); } catch {}
  const m = marquee;
  marquee = null;
  hideMarqueeRect();
  const dxS = Math.abs(m.currentScreenX - m.startScreenX);
  const dyS = Math.abs(m.currentScreenY - m.startScreenY);
  if (dxS > 4 || dyS > 4) {
    const p1 = screenToBoard(m.startScreenX, m.startScreenY);
    const p2 = screenToBoard(m.currentScreenX, m.currentScreenY);
    const rect = {
      x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
      w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y)
    };
    if (!e.shiftKey) selectedIds.clear();
    for (const item of board.items) {
      if (isFrame(item)) continue;
      if (itemIntersectsRect(item, rect)) selectedIds.add(item.id);
    }
    updateSelectionClasses();
  } else {
    if (!e.shiftKey) clearSelection();
  }
});
function updateMarqueeRect() {
  if (!selectionRectEl || !marquee) return;
  const r = viewport.getBoundingClientRect();
  selectionRectEl.style.display = 'block';
  selectionRectEl.style.left = (Math.min(marquee.startScreenX, marquee.currentScreenX) - r.left) + 'px';
  selectionRectEl.style.top  = (Math.min(marquee.startScreenY, marquee.currentScreenY) - r.top) + 'px';
  selectionRectEl.style.width  = Math.abs(marquee.currentScreenX - marquee.startScreenX) + 'px';
  selectionRectEl.style.height = Math.abs(marquee.currentScreenY - marquee.startScreenY) + 'px';
}
function hideMarqueeRect() {
  if (selectionRectEl) selectionRectEl.style.display = 'none';
}

/* =========================================================
   ПОИСК
   ========================================================= */
function openSearch() {
  searchBar.classList.add('show');
  filterBar.classList.remove('show');
  searchInput.focus();
  searchInput.select();
}
function closeSearch() {
  searchBar.classList.remove('show');
  searchInput.value = '';
  searchQuery = '';
  searchMatches = [];
  searchIndex = -1;
  applySearchClasses();
  updateSearchCounter();
}
function runSearch(q) {
  searchQuery = (q || '').trim().toLowerCase();
  searchMatches = [];
  if (searchQuery) {
    board.items.forEach(item => {
      if (isFrame(item)) return;
      const text = [item.title, item.content, item.url, item.tag, item.author]
        .filter(Boolean).join(' ').toLowerCase();
      if (text.includes(searchQuery)) searchMatches.push(item.id);
    });
  }
  searchIndex = searchMatches.length ? 0 : -1;
  applySearchClasses();
  updateSearchCounter();
  if (searchIndex >= 0) centerOnItem(searchMatches[searchIndex]);
}
function applySearchClasses() {
  boardEl.querySelectorAll('.item').forEach(el => {
    if (!searchQuery) { el.classList.remove('dimmed', 'search-hit'); return; }
    if (searchMatches.includes(el.dataset.id)) {
      el.classList.remove('dimmed');
      el.classList.add('search-hit');
    } else {
      el.classList.add('dimmed');
      el.classList.remove('search-hit');
    }
  });
}
function updateSearchCounter() {
  if (!searchCounter) return;
  searchCounter.textContent = searchMatches.length ? (searchIndex + 1) + '/' + searchMatches.length : '0/0';
}
function searchNext(dir = 1) {
  if (!searchMatches.length) return;
  searchIndex = (searchIndex + dir + searchMatches.length) % searchMatches.length;
  updateSearchCounter();
  centerOnItem(searchMatches[searchIndex]);
}
if (searchInput) {
  searchInput.addEventListener('input', (e) => runSearch(e.target.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchNext(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
  });
}
if (btnSearchPrev) btnSearchPrev.onclick = () => searchNext(-1);
if (btnSearchNext) btnSearchNext.onclick = () => searchNext(1);
if (btnSearchClose) btnSearchClose.onclick = closeSearch;
if (btnSearch) btnSearch.onclick = () => {
  if (searchBar.classList.contains('show')) closeSearch(); else openSearch();
};

/* =========================================================
   ФИЛЬТРЫ
   ========================================================= */
function collectFilterOptions() {
  const tags = new Set(), authors = new Set();
  board.items.forEach(i => {
    if (isFrame(i)) return;
    if (i.tag) tags.add(i.tag);
    if (i.author) authors.add(i.author);
  });
  return { tags: Array.from(tags).sort(), authors: Array.from(authors).sort() };
}
function refreshFilterDropdowns() {
  if (!filterTag || !filterAuthor) return;
  const { tags, authors } = collectFilterOptions();
  const prevTag = filterTag.value, prevAuthor = filterAuthor.value;
  filterTag.innerHTML = '<option value="">Все теги</option>' +
    tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  filterAuthor.innerHTML = '<option value="">Все авторы</option>' +
    authors.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  if (tags.includes(prevTag)) filterTag.value = prevTag;
  if (authors.includes(prevAuthor)) filterAuthor.value = prevAuthor;
}
function itemPassesFilter(item) {
  if (activeFilters.type && item.type !== activeFilters.type) return false;
  if (activeFilters.tag && (item.tag || '') !== activeFilters.tag) return false;
  if (activeFilters.author && (item.author || '') !== activeFilters.author) return false;
  if (activeFilters.deadline) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (activeFilters.deadline === 'nodeadline') {
      if (item.deadline) return false;
    } else {
      if (!item.deadline) return false;
      const dl = new Date(item.deadline);
      if (activeFilters.deadline === 'overdue') { if (dl >= today) return false; }
      else if (activeFilters.deadline === 'today') {
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        if (dl < today || dl >= tomorrow) return false;
      } else if (activeFilters.deadline === 'week') {
        const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
        if (dl < today || dl >= weekEnd) return false;
      }
    }
  }
  return true;
}
function isFilterActive() {
  return !!(activeFilters.type || activeFilters.tag || activeFilters.author || activeFilters.deadline);
}
function applyFilterClasses() {
  let shown = 0, total = 0;
  boardEl.querySelectorAll('.item').forEach(el => {
    const item = board.items.find(i => i.id === el.dataset.id);
    if (!item) return;
    total++;
    if (!isFilterActive() || itemPassesFilter(item)) {
      el.classList.remove('filtered-out'); shown++;
    } else {
      el.classList.add('filtered-out');
    }
  });
  if (filterCounter) {
    filterCounter.textContent = isFilterActive() ? `Показано ${shown} из ${total}` : '';
  }
}
function onFilterChange() {
  activeFilters.type = filterType.value;
  activeFilters.tag = filterTag.value;
  activeFilters.author = filterAuthor.value;
  activeFilters.deadline = filterDeadline.value;
  applyFilterClasses();
  refreshFilterDropdowns();
}
[filterType, filterTag, filterAuthor, filterDeadline].forEach(sel => {
  if (sel) sel.addEventListener('change', onFilterChange);
});
if (btnFilterClear) btnFilterClear.onclick = () => {
  filterType.value = ''; filterTag.value = ''; filterAuthor.value = ''; filterDeadline.value = '';
  onFilterChange();
};
if (btnFilterClose) btnFilterClose.onclick = () => filterBar.classList.remove('show');
if (btnFilter) btnFilter.onclick = () => {
  if (filterBar.classList.contains('show')) { filterBar.classList.remove('show'); }
  else { closeSearch(); refreshFilterDropdowns(); filterBar.classList.add('show'); applyFilterClasses(); }
};

/* =========================================================
   БУФЕР ОБМЕНА
   ========================================================= */
function copySelection() {
  clipboard = board.items
    .filter(i => !isFrame(i) && selectedIds.has(i.id))
    .map(i => JSON.parse(JSON.stringify(i)));
}
async function pasteClipboard() {
  if (!clipboard.length) return;
  const newIds = new Set();
  for (const src of clipboard) {
    const item = JSON.parse(JSON.stringify(src));
    item.id = uid();
    item.x += 24; item.y += 24;
    if (item.type === 'tome' && item.filePath) {
      try {
        const t = await window.api.readTome(item.filePath);
        if (t) {
          const newTomeId = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          item.filePath = await window.api.createTome({
            id: newTomeId, title: t.title || 'Новый том', content: t.content || ''
          });
        }
      } catch (e) { console.error(e); }
    }
    board.items.push(item);
    newIds.add(item.id);
  }
  selectedIds = newIds;
  renderBoard();
  markDirty();
  pushHistory();
}
function duplicateSelection() { copySelection(); pasteClipboard(); }

/* =========================================================
   РАСШИРЕНИЕ ДОСКИ
   ========================================================= */
function expandBoard(direction, amount) {
  if (amount <= 0) return;
  if (direction === 'right') { board.width += amount; }
  else if (direction === 'left') {
    board.width += amount;
    for (const it of board.items) it.x += amount;
    view.tx -= amount * view.scale;
  } else if (direction === 'down') { board.height += amount; }
  else if (direction === 'up') {
    board.height += amount;
    for (const it of board.items) it.y += amount;
    view.ty -= amount * view.scale;
  }
  renderBoard();
  markDirty();
  pushHistory();
}
function openExpandDialog() {
  modal.innerHTML = `
    <h3>Расширить доску</h3>
    <div class="expand-rows" id="expandRows"></div>
    <div class="modal-actions">
      <button class="tb-btn modal-cancel">Отмена</button>
      <button class="tb-btn accent" id="btnExpandApply">Расширить</button>
    </div>`;
  modalBackdrop.classList.add('show');
  const container = modal.querySelector('#expandRows');
  addExpandRow(container);
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelector('#btnExpandApply').onclick = () => {
    const rows = container.querySelectorAll('.expand-row');
    for (const row of rows) {
      const dir = row.querySelector('[name=dir]').value;
      const amtVal = row.querySelector('[name=amount]').value;
      const amount = amtVal === 'custom'
        ? Math.max(1, Number(row.querySelector('[name=customAmount]').value) || 0)
        : Number(amtVal);
      if (amount > 0) expandBoard(dir, amount);
    }
    closeModal();
  };
}
function addExpandRow(container, afterRow = null) {
  const row = document.createElement('div');
  row.className = 'expand-row';
  let options = '';
  for (let v = 50; v <= 1000; v += 50) options += `<option value="${v}">${v}</option>`;
  row.innerHTML = `
    <button class="remove-row-btn" title="Удалить строку">×</button>
    <div class="expand-row-header">
      <span class="expand-row-title">+ Расширить…</span>
      <button class="expand-add-btn" title="Добавить ещё строку">+</button>
    </div>
    <label>Направление
      <select name="dir">
        <option value="right">вправо</option>
        <option value="left">влево</option>
        <option value="down">вниз</option>
        <option value="up">вверх</option>
      </select>
    </label>
    <label>Количество
      <select name="amount">${options}<option value="custom">Своё количество</option></select>
    </label>
    <label class="custom-amount-label" style="display:none">Своё количество
      <input type="number" name="customAmount" min="1" step="1" value="100">
    </label>`;
  if (afterRow && afterRow.nextSibling) container.insertBefore(row, afterRow.nextSibling);
  else container.appendChild(row);
  row.querySelector('[name=amount]').value = '100';
  const amtSel = row.querySelector('[name=amount]');
  const customWrap = row.querySelector('.custom-amount-label');
  amtSel.addEventListener('change', () => {
    customWrap.style.display = amtSel.value === 'custom' ? 'block' : 'none';
  });
  row.querySelector('.expand-add-btn').onclick = () => addExpandRow(container, row);
  row.querySelector('.remove-row-btn').onclick = () => {
    if (container.querySelectorAll('.expand-row').length <= 1) return;
    row.remove();
  };
}

/* =========================================================
   ОБЛАСТИ / РАМКИ
   ========================================================= */
function itemCenterInsideFrame(item, frame) {
  if (isFrame(item)) return false;
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  return cx >= frame.x && cx <= frame.x + frame.w &&
         cy >= frame.y && cy <= frame.y + frame.h;
}
function itemsInsideFrame(frame) {
  return board.items.filter(it => itemCenterInsideFrame(it, frame));
}

function createFrame(x, y, w, h) {
  openModal(`
    <h3>Новая область</h3>
    <label>Название<input name="title" placeholder="Арт, Лор, Спринт 1..."></label>
  `, (m) => {
    const title = m.querySelector('[name=title]').value.trim() || 'Область';
    const frame = {
      id: uid(), type: 'frame',
      x, y,
      w: Math.max(180, w),
      h: Math.max(120, h),
      title, collapsed: false, color: null
    };
    board.items.unshift(frame);
    renderBoard(); markDirty(); pushHistory();
  });
}

function createFrameEl(frame) {
  const el = document.createElement('div');
  el.className = 'frame' + (frame.collapsed ? ' collapsed' : '');
  el.dataset.id = frame.id;
  el.style.left = frame.x + 'px';
  el.style.top = frame.y + 'px';
  el.style.width = frame.w + 'px';
  el.style.height = frame.h + 'px';
  if (frame.color) {
    el.style.background = frame.color.background || frame.color;
    el.style.borderColor = frame.color.border || frame.color;
  }
  el.innerHTML = `
    <div class="frame-head">
      <button class="frame-btn frame-toggle" title="${frame.collapsed ? 'Развернуть' : 'Свернуть'}">${frame.collapsed ? '▶' : '▼'}</button>
      <span class="frame-title">${escapeHtml(frame.title || 'Область')}</span>
      <span class="frame-spacer"></span>
      <button class="frame-btn frame-del" title="Удалить область">✕</button>
    </div>
    <div class="frame-body"></div>
    <div class="frame-resize"></div>`;
  attachFrameEvents(el, frame);
  return el;
}

function openPrompt(title, defaultValue, onOk) {
  modal.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <label>Значение
      <input name="value" value="${escapeHtml(defaultValue || '')}">
    </label>
    <div class="modal-actions">
      <button class="tb-btn modal-cancel">Отмена</button>
      <button class="tb-btn accent modal-ok">OK</button>
    </div>`;
  modalBackdrop.classList.add('show');
  const input = modal.querySelector('[name=value]');
  input.focus(); input.select();
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelector('.modal-ok').onclick = () => {
    const v = input.value;
    closeModal();
    if (typeof onOk === 'function') onOk(v);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); modal.querySelector('.modal-ok').click(); }
  });
}

function attachFrameEvents(el, frame) {
  const head = el.querySelector('.frame-head');

  head.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.frame-btn')) return;
    e.preventDefault(); e.stopPropagation();

    const startX = e.clientX, startY = e.clientY;
    const frameOrigin = { x: frame.x, y: frame.y };
    const inside = itemsInsideFrame(frame);
    const itemOrigins = inside.map(it => ({ id: it.id, x: it.x, y: it.y }));
    let moved = false;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / view.scale;
      const dy = (ev.clientY - startY) / view.scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      frame.x = frameOrigin.x + dx;
      frame.y = frameOrigin.y + dy;
      el.style.left = frame.x + 'px';
      el.style.top = frame.y + 'px';
      for (const oi of itemOrigins) {
        const it = board.items.find(b => b.id === oi.id);
        if (!it) continue;
        it.x = oi.x + dx; it.y = oi.y + dy;
        const itemEl = boardEl.querySelector(`.item[data-id="${oi.id}"]`);
        if (itemEl) { itemEl.style.left = it.x + 'px'; itemEl.style.top = it.y + 'px'; }
        updateLinksForItem(it.id);
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      el.classList.remove('dragging');
      if (moved) { markDirty(); pushHistory(); updateStackIndicators(); }
    };
    el.classList.add('dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  head.addEventListener('dblclick', (e) => {
    if (e.target.closest('.frame-btn')) return;
    e.stopPropagation();
    openPrompt('Название области', frame.title, (v) => {
      if (v && v.trim()) {
        frame.title = v.trim(); renderBoard(); markDirty(); pushHistory();
      }
    });
  });

  head.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    showMenu(e.clientX, e.clientY, [
      { label: frame.collapsed ? 'Развернуть' : 'Свернуть', action: () => {
        frame.collapsed = !frame.collapsed; renderBoard(); markDirty(); pushHistory();
      }},
      { label: 'Переименовать', action: () => {
        openPrompt('Название области', frame.title, (v) => {
          if (v && v.trim()) { frame.title = v.trim(); renderBoard(); markDirty(); pushHistory(); }
        });
      }},
      { label: 'Изменить цвет', action: () => openFrameColorPicker(frame) },
      '---',
      { label: 'Удалить область', action: () => {
        if (!confirm('Удалить область? Карточки внутри останутся.')) return;
        board.items = board.items.filter(it => it.id !== frame.id);
        renderBoard(); markDirty(); pushHistory();
      }}
    ]);
  });

  head.addEventListener('click', (e) => {
    const toggle = e.target.closest('.frame-toggle');
    if (toggle) {
      e.stopPropagation(); e.preventDefault();
      frame.collapsed = !frame.collapsed; renderBoard(); markDirty(); pushHistory();
      return;
    }
        const del = e.target.closest('.frame-del');
    if (del) {
      e.stopPropagation(); e.preventDefault();
      if (!confirm('Удалить область? Карточки внутри останутся.')) return;
      board.items = board.items.filter(it => it.id !== frame.id);
      renderBoard(); markDirty(); pushHistory();
    }
  });

  const rh = el.querySelector('.frame-resize');
  if (rh) attachFrameResize(rh, el, frame);
}

function attachFrameResize(handle, el, frame) {
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = frame.w, startH = frame.h;
    try { handle.setPointerCapture(e.pointerId); } catch {}
    const onMove = (ev) => {
      const dw = (ev.clientX - startX) / view.scale;
      const dh = (ev.clientY - startY) / view.scale;
      frame.w = Math.max(180, startW + dw);
      frame.h = Math.max(28,  startH + dh);
      el.style.width = frame.w + 'px';
      el.style.height = frame.h + 'px';
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      markDirty(); pushHistory();
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
}

const FRAME_PALETTE = [
  { name: 'Синий',      value: { background: 'rgba(76,141,255,.06)',  border: '#4c8dff' } },
  { name: 'Зелёный',    value: { background: 'rgba(81,207,102,.06)',  border: '#51cf66' } },
  { name: 'Жёлтый',     value: { background: 'rgba(255,212,59,.08)',  border: '#ffd43b' } },
  { name: 'Оранжевый',  value: { background: 'rgba(255,169,77,.08)',  border: '#ffa94d' } },
  { name: 'Красный',    value: { background: 'rgba(255,107,107,.06)', border: '#ff6b6b' } },
  { name: 'Фиолетовый', value: { background: 'rgba(177,151,252,.08)', border: '#b197fc' } },
  { name: 'Розовый',    value: { background: 'rgba(247,131,172,.08)', border: '#f783ac' } },
  { name: 'Серый',      value: { background: 'rgba(173,181,189,.06)', border: '#adb5bd' } }
];

function openFrameColorPicker(frame) {
  const swatches = FRAME_PALETTE.map((p, i) => {
    const selected = frame.color && frame.color.border === p.value.border ? ' selected' : '';
    return `<div class="color-swatch${selected}" data-idx="${i}" title="${escapeHtml(p.name)}" style="background:${p.value.border}"></div>`;
  }).join('');
  modal.innerHTML = `
    <h3>Цвет области</h3>
    <div class="color-palette">${swatches}</div>
    <div class="modal-actions"><button class="tb-btn modal-cancel">Закрыть</button></div>`;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelectorAll('.color-swatch').forEach(sw => {
    sw.onclick = () => {
      const idx = Number(sw.dataset.idx);
      frame.color = FRAME_PALETTE[idx].value;
      closeModal(); renderBoard(); markDirty(); pushHistory();
    };
  });
}

function updateFrameHiddenItems() {
  boardEl.querySelectorAll('.item').forEach(el => el.classList.remove('hidden-by-frame'));
  for (const frame of board.items.filter(isFrame)) {
    if (!frame.collapsed) continue;
    for (const it of itemsInsideFrame(frame)) {
      const el = boardEl.querySelector(`.item[data-id="${it.id}"]`);
      if (el) el.classList.add('hidden-by-frame');
    }
  }
}

/* =========================================================
   СВЯЗИ
   ========================================================= */
let linksLayer = null;
function ensureLinksLayer() {
  if (linksLayer && linksLayer.parentNode === boardEl) return linksLayer;
  linksLayer = document.createElementNS(SVG_NS, 'svg');
  linksLayer.setAttribute('class', 'links-layer');
  linksLayer.setAttribute('id', 'linksLayer');
  return linksLayer;
}

function edgePoint(from, to) {
  const cx1 = from.x + from.w / 2;
  const cy1 = from.y + from.h / 2;
  const cx2 = to.x + to.w / 2;
  const cy2 = to.y + to.h / 2;
  const dx = cx2 - cx1;
  const dy = cy2 - cy1;
  if (dx === 0 && dy === 0) return { x: cx1, y: cy1 };
  const tx = dx !== 0 ? (from.w / 2) / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? (from.h / 2) / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx1 + dx * t, y: cy1 + dy * t };
}

function updateLinksForItem(itemId) {
  if (!linksLayer) return;
  const links = board.links || [];
  for (const link of links) {
    if (link.from !== itemId && link.to !== itemId) continue;
    const a = board.items.find(i => i.id === link.from);
    const b = board.items.find(i => i.id === link.to);
    if (!a || !b) continue;
    const pA = edgePoint(a, b);
    const pB = edgePoint(b, a);
    linksLayer.querySelectorAll(`[data-link-id="${link.id}"]`).forEach(el => {
      el.setAttribute('x1', pA.x); el.setAttribute('y1', pA.y);
      el.setAttribute('x2', pB.x); el.setAttribute('y2', pB.y);
    });
  }
}

function renderLinks() {
  const svg = ensureLinksLayer();
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('width', board.width);
  svg.setAttribute('height', board.height);
  svg.setAttribute('viewBox', `0 0 ${board.width} ${board.height}`);

  const links = Array.isArray(board.links) ? board.links : [];
  for (const link of links) {
    const a = board.items.find(i => i.id === link.from);
    const b = board.items.find(i => i.id === link.to);
    if (!a || !b || isFrame(a) || isFrame(b)) continue;
    const pA = edgePoint(a, b);
    const pB = edgePoint(b, a);

    const hit = document.createElementNS(SVG_NS, 'line');
    hit.setAttribute('x1', pA.x); hit.setAttribute('y1', pA.y);
    hit.setAttribute('x2', pB.x); hit.setAttribute('y2', pB.y);
    hit.setAttribute('class', 'link-hit');
    hit.dataset.linkId = link.id;
    svg.appendChild(hit);

    const vis = document.createElementNS(SVG_NS, 'line');
    vis.setAttribute('x1', pA.x); vis.setAttribute('y1', pA.y);
    vis.setAttribute('x2', pB.x); vis.setAttribute('y2', pB.y);
    const outside = isOutsideBoard(a) || isOutsideBoard(b);
    vis.setAttribute('class', 'link-line' + (outside ? ' outside' : ''));
    vis.dataset.linkId = link.id;
    svg.appendChild(vis);
  }

  svg.querySelectorAll('.link-hit').forEach(hit => {
    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      const linkId = hit.dataset.linkId;
      if (!confirm('Удалить связь?')) return;
      board.links = (board.links || []).filter(l => l.id !== linkId);
      renderLinks(); markDirty(); pushHistory(); updatePropsPanel();
    });
  });

  if (boardEl.lastChild !== svg) boardEl.appendChild(svg);
}

/* ---------- Ctrl-связывание ---------- */
function handleLinkClick(item) {
  if (isFrame(item)) return;

  if (!linkAnchorId) {
    selectOnly(item.id);
    linkAnchorId = item.id;
    updateSelectionClasses();
    return;
  }

  if (linkAnchorId === item.id) return;

  const anchor = board.items.find(i => i.id === linkAnchorId);
  if (!anchor || isFrame(anchor)) {
    selectOnly(item.id);
    linkAnchorId = item.id;
    updateSelectionClasses();
    return;
  }

  if (!Array.isArray(board.links)) board.links = [];

  const exists = board.links.some(l =>
    (l.from === anchor.id && l.to === item.id) ||
    (l.from === item.id && l.to === anchor.id)
  );

  if (exists) {
    // Связь уже есть — удаляем её (toggle)
    const link = board.links.find(l =>
      (l.from === anchor.id && l.to === item.id) ||
      (l.from === item.id && l.to === anchor.id)
    );
    if (link) {
      board.links = board.links.filter(l => l.id !== link.id);
      renderLinks();
      flashUnlink(anchor.id, item.id);
      markDirty();
      pushHistory();
      updatePropsPanel();
    }
    return;
  }

  board.links.push({
    id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    from: anchor.id,
    to: item.id
  });

  renderLinks();
  flashCard(item.id);
  markDirty();
  pushHistory();
  updatePropsPanel();
}
function flashUnlink(fromId, toId) {
  // вспышка на обеих карточках при отвязке
  flashCardUnlink(fromId);
  flashCardUnlink(toId);
}
function flashCardUnlink(id) {
  const el = boardEl.querySelector(`.item[data-id="${id}"]`);
  if (!el) return;
  el.classList.remove('link-removed');
  void el.offsetWidth;
  el.classList.add('link-removed');
  setTimeout(() => el.classList.remove('link-removed'), 400);
}
function flashCard(id) {
  const el = boardEl.querySelector(`.item[data-id="${id}"]`);
  if (!el) return;
  el.classList.remove('link-created');
  void el.offsetWidth;
  el.classList.add('link-created');
  setTimeout(() => el.classList.remove('link-created'), 400);
}

function flashLink(fromId, toId) {
  if (!linksLayer) return;
  const link = (board.links || []).find(l =>
    (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId)
  );
  if (!link) return;
  linksLayer.querySelectorAll(`.link-line[data-link-id="${link.id}"]`).forEach(el => {
    el.classList.remove('link-flash');
    void el.getBoundingClientRect();
    el.classList.add('link-flash');
    setTimeout(() => el.classList.remove('link-flash'), 500);
  });
}

function openLinkPicker(item) {
  const others = board.items.filter(i => !isFrame(i) && i.id !== item.id);
  const existingLinks = (board.links || []).filter(l => l.from === item.id || l.to === item.id);
  const linkedMap = new Map();
  for (const l of existingLinks) {
    const otherId = l.from === item.id ? l.to : l.from;
    linkedMap.set(otherId, l.id);
  }

  let html = '<h3>Связи карточки</h3>';
  if (!others.length) {
    html += '<div class="board-empty">Нет других карточек на доске.</div>';
  } else {
    html += '<div class="link-picker">';
    for (const o of others) {
      const linked = linkedMap.has(o.id);
      const mark = o.type === 'note' ? 'N' : o.type === 'paragraph' ? 'P'
                 : o.type === 'tome' ? 'B' : o.type === 'image' ? 'I' : 'L';
      const title = o.title || ({ note:'Заметка', paragraph:'Абзац', tome:'Том', image:'Картинка', link:'Ссылка' }[o.type] || 'Карточка');
      html += `
        <div class="link-item${linked ? ' linked' : ''}" data-id="${o.id}" data-link-id="${linked ? linkedMap.get(o.id) : ''}">
          <span class="link-icon">${mark}</span>
          <span class="link-title">${escapeHtml(title)}</span>
          ${linked
            ? '<span class="link-badge link-badge-unlink">отвязать</span>'
            : '<span class="link-badge link-badge-link">связать</span>'}
        </div>`;
    }
    html += '</div>';
  }
  html += '<div class="modal-actions"><button class="tb-btn modal-cancel">Закрыть</button></div>';
  modal.innerHTML = html;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;

  modal.querySelectorAll('.link-item').forEach(el => {
    el.onclick = () => {
      const otherId = el.dataset.id;
      const linkId = el.dataset.linkId;
      if (linkId) {
        board.links = (board.links || []).filter(l => l.id !== linkId);
        renderLinks();
        markDirty();
        pushHistory();
        updatePropsPanel();
        closeModal();
      } else {
        if (!Array.isArray(board.links)) board.links = [];
        board.links.push({
          id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          from: item.id, to: otherId
        });
        renderLinks();
        flashCard(otherId);
        markDirty();
        pushHistory();
        updatePropsPanel();
        closeModal();
      }
    };
  });
}

/* ---------- Статус карточки ---------- */
function openUnlinkPicker(item) {
  const myLinks = (board.links || []).filter(l => l.from === item.id || l.to === item.id);

  let html = '<h3>Связи карточки</h3>';
  if (!myLinks.length) {
    html += '<div class="board-empty">У этой карточки нет связей.</div>';
  } else {
    html += '<div class="link-picker">';
    for (const l of myLinks) {
      const otherId = l.from === item.id ? l.to : l.from;
      const other = board.items.find(i => i.id === otherId);
      const mark = other && other.type === 'note' ? 'N' : other && other.type === 'paragraph' ? 'P'
                 : other && other.type === 'tome' ? 'B' : other && other.type === 'image' ? 'I' : 'L';
      const title = other ? (other.title || 'без названия') : 'удалённая карточка';
      html += `
        <div class="link-item linked" data-link-id="${l.id}">
          <span class="link-icon">${mark}</span>
          <span class="link-title">${escapeHtml(title)}</span>
          <span class="link-badge link-badge-unlink">отвязать</span>
        </div>`;
    }
    html += '</div>';
  }

  html += `
    <div class="modal-actions centered">
      ${myLinks.length ? '<button class="tb-btn danger" id="btnUnlinkAll">Отвязать от всего</button>' : ''}
      <button class="tb-btn modal-cancel">Закрыть</button>
    </div>`;

  modal.innerHTML = html;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;

  modal.querySelectorAll('.link-item').forEach(el => {
    el.onclick = () => {
      const linkId = el.dataset.linkId;
      board.links = (board.links || []).filter(l => l.id !== linkId);
      renderLinks(); markDirty(); pushHistory(); updatePropsPanel();
      closeModal();
    };
  });

  const btnAll = modal.querySelector('#btnUnlinkAll');
  if (btnAll) {
    btnAll.onclick = () => {
      if (!confirm(`Удалить все связи карточки? (${myLinks.length})`)) return;
      board.links = (board.links || []).filter(l => l.from !== item.id && l.to !== item.id);
      renderLinks(); markDirty(); pushHistory(); updatePropsPanel();
      closeModal();
    };
  }
}

function openTomeDeadline(item) {
  openModal(`
    <h3>Срок тома</h3>
    <label>Дата
      <input name="deadline" type="date" value="${escapeHtml(item.deadline || '')}">
    </label>
  `, (m) => {
    item.deadline = m.querySelector('[name=deadline]').value || '';
    renderBoard();
    markDirty();
    pushHistory();
  });
}
/* ---------- Управление кастомными статусами ---------- */
function openManageStatusesDialog() {
  const custom = Array.isArray(appSettings.customStatuses) ? appSettings.customStatuses : [];

  let html = '<h3>Управление статусами</h3>';
  if (!custom.length) {
    html += '<div class="board-empty">Кастомных статусов пока нет.</div>';
  } else {
    html += '<div class="link-picker">';
    for (const s of custom) {
      html += `
        <div class="link-item" data-id="${s.id}" style="cursor:default;">
          <span class="props-status-badge" style="background:${s.color || '#6b7280'};margin-right:8px;">${escapeHtml(s.label)}</span>
          <span class="link-title">${escapeHtml(s.title)}</span>
          <button class="tb-btn danger" data-delete="${s.id}" style="margin-left:auto;height:22px;padding:0 10px;font-size:11px;">Удалить</button>
        </div>`;
    }
    html += '</div>';
  }
  html += `
    <div class="modal-actions centered">
      <button class="tb-btn accent" id="btnNewStatus">+ Создать новый</button>
      <button class="tb-btn modal-cancel">Закрыть</button>
    </div>`;
  modal.innerHTML = html;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;

  modal.querySelector('#btnNewStatus').onclick = () => {
    closeModal();
    openCreateStatusDialog(() => {
      renderKanban();
      openManageStatusesDialog();
    });
  };

  modal.querySelectorAll('[data-delete]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.delete;
      const used = board.items.some(i => i.status === id);
      if (used && !confirm('Этот статус используется в заметках. Удалить? Заметки перейдут в «TODO».')) return;
      if (!used && !confirm('Удалить статус?')) return;

      // Перевести заметки с этим статусом в todo
      for (const it of board.items) {
        if (it.status === id) it.status = 'todo';
      }

      const settings = await window.api.loadSettings();
      settings.customStatuses = (settings.customStatuses || []).filter(s => s.id !== id);
      await window.api.saveSettings(settings);
      appSettings = settings;

      renderBoard();
      markDirty();
      pushHistory();
      renderKanban();
      openManageStatusesDialog();
    };
  });
}
/* ---------- Создание своего статуса ---------- */
const CUSTOM_STATUS_COLORS = [
  '#8b5cf6', '#ec4899', '#f97316', '#eab308',
  '#14b8a6', '#06b6d4', '#3b82f6', '#84cc16',
  '#a855f7', '#ef4444', '#22c55e', '#64748b'
];

function openCreateStatusDialog(onCreated) {
  let selectedColor = CUSTOM_STATUS_COLORS[0];

  const swatches = CUSTOM_STATUS_COLORS.map((c, i) =>
    `<div class="status-color-swatch${i === 0 ? ' selected' : ''}" data-color="${c}" style="background:${c}"></div>`
  ).join('');

  modal.innerHTML = `
    <h3>Новый статус</h3>
    <label>Название<input name="name" placeholder="Например: На проверке" maxlength="32"></label>
    <label>Цвет
      <div class="status-color-palette" id="statusColorPalette">${swatches}</div>
    </label>
    <div class="modal-actions">
      <button class="tb-btn modal-cancel">Отмена</button>
      <button class="tb-btn accent modal-ok">Создать</button>
    </div>`;
  modalBackdrop.classList.add('show');

  const nameInp = modal.querySelector('[name=name]');
  nameInp.focus();

  modal.querySelectorAll('.status-color-swatch').forEach(sw => {
    sw.onclick = () => {
      modal.querySelectorAll('.status-color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = sw.dataset.color;
    };
  });

  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelector('.modal-ok').onclick = async () => {
    const name = nameInp.value.trim();
    if (!name) { nameInp.focus(); return; }

    // Проверка на дубликат (по названию, регистронезависимо)
    const existing = getAllStatuses().find(s =>
      s.title.toLowerCase() === name.toLowerCase() ||
      s.label.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      alert('Такой статус уже есть');
      return;
    }

    // Генерируем id из названия + случайный суффикс
    const slug = name.toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'status';
    const id = 'c_' + slug + '_' + Math.random().toString(36).slice(2, 6);

    const newStatus = {
      id,
      label: name,
      title: name,
      color: selectedColor
    };

    // Сохраняем в настройки
    const settings = await window.api.loadSettings();
    if (!Array.isArray(settings.customStatuses)) settings.customStatuses = [];
    settings.customStatuses.push(newStatus);
    await window.api.saveSettings(settings);
    appSettings = settings;

    closeModal();
    if (typeof onCreated === 'function') onCreated(newStatus);
  };
}

function openStatusPicker(item) {
  const cur = item.status || 'todo';
  const all = (typeof getAllStatuses === 'function') ? getAllStatuses() : STATUSES;
  const list = all.map(s => {
    const active = s.id === cur ? ' selected' : '';
    const color = s.color || '#6b7280';
    return `<div class="link-item${active}" data-status="${s.id}" style="cursor:pointer;">
      <span class="props-status-badge" style="background:${color};margin-right:8px;">${escapeHtml(s.label)}</span>
      <span class="link-title">${escapeHtml(s.title)}</span>
    </div>`;
  }).join('');
  modal.innerHTML = `
    <h3>Статус заметки</h3>
    <div class="link-picker">${list}</div>
    <div class="modal-actions"><button class="tb-btn modal-cancel">Закрыть</button></div>`;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelectorAll('[data-status]').forEach(el => {
    el.onclick = () => {
      item.status = el.dataset.status;
      closeModal(); renderBoard(); markDirty(); pushHistory();
    };
  });
}

/* ---------- Метки ---------- */
function openLabelsPicker(item) {
  const cur = Array.isArray(item.labels) ? item.labels.slice() : [];
  const list = LABELS.map(l => {
    const active = cur.includes(l.id);
    return `<div class="link-item${active ? ' linked' : ''}" data-label="${l.id}" style="cursor:pointer;">
      <span class="item-label" data-label="${l.id}" style="position:static;margin-right:8px;">${l.mark}</span>
      <span class="link-title">${l.title}</span>
      ${active ? '<span class="link-badge">включено</span>' : ''}
    </div>`;
  }).join('');
  modal.innerHTML = `
    <h3>Метки карточки</h3>
    <div class="link-picker">${list}</div>
    <div class="modal-actions"><button class="tb-btn modal-cancel">Закрыть</button></div>`;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelectorAll('[data-label]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.label;
      if (!Array.isArray(item.labels)) item.labels = [];
      const idx = item.labels.indexOf(id);
      if (idx === -1) item.labels.push(id);
      else item.labels.splice(idx, 1);
      closeModal(); renderBoard(); markDirty(); pushHistory();
    };
  });
}

/* ---------- Скрытые карточки ---------- */
function updateHiddenCounter() {
  const old = document.getElementById('hiddenCounter');
  if (old) old.remove();
  const hidden = board.items.filter(i => i.hidden && !isFrame(i));
  if (!hidden.length) return;
  const btn = document.createElement('button');
  btn.id = 'hiddenCounter';
  btn.className = 'hidden-counter';
  btn.textContent = 'Скрытых: ' + hidden.length;
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('mousedown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    openHiddenList();
  });
  viewport.appendChild(btn);
}

function openHiddenList() {
  const hidden = board.items.filter(i => i.hidden && !isFrame(i));
  let html = '<h3>Скрытые карточки</h3>';
  if (!hidden.length) {
    html += '<div class="board-empty">Скрытых карточек нет.</div>';
  } else {
    html += '<div class="hidden-list">';
    for (const it of hidden) {
      const mark = it.type === 'note' ? 'N' : it.type === 'paragraph' ? 'P'
                 : it.type === 'tome' ? 'B' : it.type === 'image' ? 'I' : 'L';
      const title = it.title || ({ note:'Заметка', paragraph:'Абзац', tome:'Том', image:'Картинка', link:'Ссылка' }[it.type] || 'Карточка');
      html += `
        <div class="hidden-item" data-id="${it.id}">
          <span class="link-icon">${mark}</span>
          <span class="h-title">${escapeHtml(title)}</span>
          <button class="h-btn" data-action="show">Показать</button>
        </div>`;
    }
    html += '</div>';
  }
  html += '<div class="modal-actions"><button class="tb-btn modal-cancel">Закрыть</button></div>';
  modal.innerHTML = html;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelectorAll('.hidden-item').forEach(el => {
    const id = el.dataset.id;
    el.querySelector('[data-action=show]').onclick = () => {
      const it = board.items.find(i => i.id === id);
      if (it) { it.hidden = false; renderBoard(); markDirty(); pushHistory(); }
      closeModal();
      if (board.items.filter(i => i.hidden).length) openHiddenList();
    };
  });
}

/* =========================================================
   ВЫРАВНИВАНИЕ И РАСПРЕДЕЛЕНИЕ
   ========================================================= */
function getSelectedItems() {
  return Array.from(selectedIds)
    .map(id => board.items.find(i => i.id === id))
    .filter(Boolean);
}

function alignSelection(mode) {
  const items = getSelectedItems();
  if (items.length < 2) return;

  if (mode === 'left') {
    // Выстроить столбиком по левому краю
    const v = Math.min(...items.map(i => i.x));
    items.forEach(i => i.x = v);
    spreadOverlaps(items, 'y');
  } else if (mode === 'top') {
    // Выстроить рядом по верхнему краю
    const v = Math.min(...items.map(i => i.y));
    items.forEach(i => i.y = v);
    spreadOverlaps(items, 'x');
  }

  renderBoard();
  markDirty();
  pushHistory();
}

/* Расталкивание перекрывающихся карточек по оси axis ('x' или 'y'). */
function spreadOverlaps(items, axis) {
  const MIN_GAP = 8;
  const sizeKey = axis === 'x' ? 'w' : 'h';
  const sorted = items.slice().sort((a, b) => a[axis] - b[axis]);

  // Проверяем, есть ли вообще перекрытие. Если нет — не трогаем.
  let hasOverlap = false;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur  = sorted[i];
    if (cur[axis] < prev[axis] + prev[sizeKey]) { hasOverlap = true; break; }
  }
  if (!hasOverlap) return;

  // Общая ширина группы с зазорами
  const totalSize = sorted.reduce((s, i) => s + i[sizeKey], 0) + MIN_GAP * (sorted.length - 1);

  // Центр группы до расталкивания — чтобы группа осталась на месте
  const minV = Math.min(...sorted.map(i => i[axis]));
  const maxV = Math.max(...sorted.map(i => i[axis] + i[sizeKey]));
  const centerV = (minV + maxV) / 2;

  let cursor = centerV - totalSize / 2;
  for (const it of sorted) {
    it[axis] = Math.round(cursor);
    cursor += it[sizeKey] + MIN_GAP;
  }
}

/* =========================================================
   ВЛОЖЕНИЯ (изображения и ссылки)
   ========================================================= */
function uidAttach() {
  return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function attachBlockHtml() {
  return `
    <div class="attach-section">
      <div class="attach-section-title">Вложения</div>
      <div class="attach-list" id="attachList"></div>
      <div class="attach-link-row" id="attachLinkRow" style="display:none;">
        <input type="text" id="attachLinkUrl" placeholder="https://...">
        <input type="text" id="attachLinkTitle" placeholder="Название (необязательно)">
        <div class="attach-link-actions">
          <button type="button" id="attachLinkCancel">Отмена</button>
          <button type="button" id="attachLinkAdd">Добавить</button>
        </div>
      </div>
      <div class="attach-buttons">
        <button type="button" id="btnAttachImage">+ Изображение</button>
        <button type="button" id="btnAttachLink">+ Ссылка</button>
      </div>
    </div>`;
}

function renderAttachList() {
  const listEl = modal.querySelector('#attachList');
  if (!listEl) return;
  if (!tempAttachments.length) {
    listEl.innerHTML = '<div class="attach-empty">Пока ничего не прикреплено</div>';
    return;
  }
  listEl.innerHTML = tempAttachments.map(a => {
    if (a.type === 'image') {
      return `
        <div class="attach-item" data-attach-id="${a.id}" title="${escapeHtml(a.title || '')} — клик, чтобы открыть">
          <img src="${toFileUrl(a.src)}" alt="" data-open-img="${escapeHtml(a.src)}">
          <button class="attach-remove" data-remove="${a.id}" title="Убрать">✕</button>
        </div>`;
    }
    return `
      <div class="attach-item link-attach" data-attach-id="${a.id}" title="${escapeHtml(a.url || '')}">
        <span data-open-url="${escapeHtml(a.url || '')}">${escapeHtml(a.title || a.url || 'Ссылка')}</span>
        <button class="attach-remove" data-remove="${a.id}" title="Убрать">✕</button>
      </div>`;
  }).join('');

  listEl.querySelectorAll('[data-remove]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      tempAttachments = tempAttachments.filter(a => a.id !== btn.dataset.remove);
      renderAttachList();
    };
  });

  listEl.querySelectorAll('[data-open-url]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = el.dataset.openUrl;
      if (url) window.api.openExternal(url);
    };
  });

  listEl.querySelectorAll('[data-open-img]').forEach(el => {
    el.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const src = el.dataset.openImg;
      if (src) window.api.openPath(src);
    };
  });
}
function bindAttachButtons() {
  const imgBtn = modal.querySelector('#btnAttachImage');
  if (imgBtn) {
    imgBtn.onclick = async (e) => {
      e.preventDefault();
      const src = await window.api.pickImage();
      if (!src) return;
      tempAttachments.push({
        id: uidAttach(),
        type: 'image',
        src,
        title: src.split(/[\\/]/).pop()
      });
      renderAttachList();
    };
  }

  const linkBtn = modal.querySelector('#btnAttachLink');
  const linkRow = modal.querySelector('#attachLinkRow');
  const urlInput = modal.querySelector('#attachLinkUrl');
  const titleInput = modal.querySelector('#attachLinkTitle');

  if (linkBtn && linkRow) {
    linkBtn.onclick = (e) => {
      e.preventDefault();
      linkRow.style.display = '';
      if (urlInput) { urlInput.value = ''; urlInput.focus(); }
      if (titleInput) titleInput.value = '';
    };
  }

  const cancelBtn = modal.querySelector('#attachLinkCancel');
  if (cancelBtn && linkRow) {
    cancelBtn.onclick = (e) => {
      e.preventDefault();
      linkRow.style.display = 'none';
    };
  }

  const addBtn = modal.querySelector('#attachLinkAdd');
  if (addBtn) {
    addBtn.onclick = (e) => {
      e.preventDefault();
      const url = (urlInput?.value || '').trim();
      if (!url) return;
      const title = (titleInput?.value || '').trim();
      tempAttachments.push({
        id: uidAttach(),
        type: 'link',
        url,
        title: title || url
      });
      linkRow.style.display = 'none';
      renderAttachList();
    };
  }
}

/* Отдельный редактор вложений для произвольной карточки */
function openAttachEditor(item) {
  tempAttachments = Array.isArray(item.attachments)
    ? JSON.parse(JSON.stringify(item.attachments))
    : [];

  modal.innerHTML = `
    <h3>Вложения карточки</h3>
    ${attachBlockHtml()}
    <div class="modal-actions">
      <button class="tb-btn modal-cancel">Отмена</button>
      <button class="tb-btn accent modal-ok">Сохранить</button>
    </div>`;
  modalBackdrop.classList.add('show');

  renderAttachList();
  bindAttachButtons();

  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelector('.modal-ok').onclick = () => {
    item.attachments = JSON.parse(JSON.stringify(tempAttachments));
    closeModal();
    renderBoard();
    markDirty();
    pushHistory();
  };
}

/* =========================================================
   КАНБАН-ВИД
   ========================================================= */
const kanbanViewEl = document.getElementById('kanbanView');
const btnViewBoard    = document.getElementById('btnViewBoard');
const btnViewKanban   = document.getElementById('btnViewKanban');
const btnViewCalendar = document.getElementById('btnViewCalendar');

function setViewMode(mode) {
  viewMode = mode;
  document.body.classList.toggle('kanban-mode',   mode === 'kanban');
  document.body.classList.toggle('calendar-mode', mode === 'calendar');

  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  if (mode === 'board'    && btnViewBoard)    btnViewBoard.classList.add('active');
  if (mode === 'kanban'   && btnViewKanban)   btnViewKanban.classList.add('active');
  if (mode === 'calendar' && btnViewCalendar) btnViewCalendar.classList.add('active');

  if (mode === 'kanban') {
    renderKanban();
  } else if (mode === 'calendar') {
    renderCalendar();
  } else {
    renderBoard();
    requestAnimationFrame(() => fitBoard());
  }
}

if (btnViewBoard)    btnViewBoard.onclick    = () => setViewMode('board');
if (btnViewKanban)   btnViewKanban.onclick   = () => setViewMode('kanban');
if (btnViewCalendar) btnViewCalendar.onclick = () => {
  calendarMode = 'week';
  setViewMode('calendar');
};

/* ---------- Меню режима календаря (▾ и ПКМ) ---------- */
const btnCalendarCaret = document.getElementById('btnCalendarCaret');
function showCalendarModeMenu(x, y) {
  showMenu(x, y, [
    { label: 'Неделя', action: () => { calendarMode = 'week'; setViewMode('calendar'); } },
    { label: 'Месяц',  action: () => { calendarMode = 'month'; setViewMode('calendar'); } }
  ]);
}
if (btnCalendarCaret) {
  btnCalendarCaret.onclick = (e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    showCalendarModeMenu(r.left, r.bottom + 2);
  };
  btnCalendarCaret.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showCalendarModeMenu(e.clientX, e.clientY);
  });
}
if (btnViewCalendar) {
  btnViewCalendar.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showCalendarModeMenu(e.clientX, e.clientY);
  });
}

function renderKanban() {
  if (!kanbanViewEl) return;
  kanbanViewEl.innerHTML = '';

  const allStatuses = getAllStatuses();

  for (const status of allStatuses) {
    const col = document.createElement('div');
    col.className = 'kanban-column';
    col.dataset.status = status.id;

    const items = board.items.filter(i =>
      i.type === 'note' &&
      !i.hidden &&
      (i.status || 'todo') === status.id
    );

    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    header.innerHTML = `<span>${escapeHtml(status.title)}</span><span class="kc-count">${items.length}</span>`;
    header.style.color = status.color || '';

    // ПКМ по шапке колонки — контекстное меню
    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const entries = [
        { label: 'Создать заметку', action: () => createNoteWithStatus(status.id) }
      ];
      if (!status.isBase) {
        entries.push('---');
        entries.push({ label: 'Переименовать статус', action: () => renameCustomStatus(status.id) });
        entries.push({ label: 'Изменить цвет', action: () => changeStatusColor(status.id) });
        entries.push({ label: 'Удалить статус', action: () => deleteCustomStatus(status.id) });
      }
      showMenu(e.clientX, e.clientY, entries);
    });

    col.appendChild(header);

    const body = document.createElement('div');
    body.className = 'kanban-column-body';
    body.dataset.status = status.id;
    col.appendChild(body);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'kanban-empty';
      empty.textContent = 'пусто';
      body.appendChild(empty);
    } else {
      for (const it of items) {
        body.appendChild(createKanbanCard(it));
      }
    }

    setupKanbanDrop(body, status.id);

    // ПКМ в любом месте колонки (кроме карточек) — создать заметку с этим статусом
    col.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.kanban-card')) return;   // карточка сама обработает
      if (e.target.closest('.kanban-column-header')) return; // шапка уже обработала
      e.preventDefault();
      e.stopPropagation();
      showMenu(e.clientX, e.clientY, [
        { label: 'Создать заметку', action: () => createNoteWithStatus(status.id) }
      ]);
    });

    kanbanViewEl.appendChild(col);
  }

  // Кнопка «+ Добавить статус» в конце
  const addBtn = document.createElement('button');
  addBtn.className = 'kanban-add-column';
  addBtn.textContent = '+ Добавить статус';
  addBtn.onclick = () => {
    openCreateStatusDialog(() => renderKanban());
  };
/* ---------- Кнопка «+ Карточка» в полосе меню ---------- */
const btnMenubarAddCard = document.getElementById('btnMenubarAddCard');
if (btnMenubarAddCard) {
  btnMenubarAddCard.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.left - 100, r.bottom + 2, [
      { label: 'Создать заметку',   action: () => createCardFromMenu('note') },
      { label: 'Создать абзац',     action: () => createCardFromMenu('paragraph') },
      { label: 'Создать том',       action: () => createCardFromMenu('tome') },
      { label: 'Создать ссылку',    action: () => createCardFromMenu('link') },
      '---',
      { label: 'Добавить изображение', action: () => createCardFromMenu('image') }
    ]);
  });
}
/* ---------- Создание карточки из меню ---------- */
function createCardFromMenu(type) {
  // Заметка в канбане — сначала выбор статуса
  if (type === 'note' && viewMode === 'kanban') {
    openKanbanAddPicker();
    return;
  }
  const spot = (typeof findFreeSpot === 'function')
    ? findFreeSpot(240, 160)
    : { x: 40, y: 40 };
  if (type === 'note')           createNote(spot.x, spot.y);
  else if (type === 'paragraph') createParagraph(spot.x, spot.y);
  else if (type === 'tome')      createTome(spot.x, spot.y);
  else if (type === 'link')      createLink(spot.x, spot.y);
  else if (type === 'image')     addImageFromDialog(spot.x, spot.y);
}
function openKanbanAddPicker() {
  const all = getAllStatuses();
  const list = all.map(s => `
    <div class="link-item" data-status="${s.id}" style="cursor:pointer;">
      <span class="props-status-badge" style="background:${s.color};margin-right:8px;">${escapeHtml(s.label)}</span>
      <span class="link-title">${escapeHtml(s.title)}</span>
    </div>
  `).join('');
  modal.innerHTML = `
    <h3>Создать заметку в статусе</h3>
    <div class="link-picker">${list}</div>
    <div class="modal-actions"><button class="tb-btn modal-cancel">Отмена</button></div>
  `;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelectorAll('.link-item').forEach(el => {
    el.onclick = () => {
      const statusId = el.dataset.status;
      closeModal();
      createNoteWithStatus(statusId);
    };
  });
}

function createNoteWithStatus(statusId) {
  const spot = (typeof findFreeSpot === 'function')
    ? findFreeSpot(240, 160)
    : { x: 40, y: 40 };
  tempAttachments = [];
  openModal(noteForm(null, null, statusId), (m) => {
    const item = {
      id: uid(), type: 'note', x: spot.x, y: spot.y, w: 240, h: 160,
      title: m.querySelector('[name=title]').value || 'Заметка',
      content: m.querySelector('[name=content]').value,
      status: statusId,
      labels: [],
      author: m.querySelector('[name=author]').value,
      deadline: m.querySelector('[name=deadline]').value,
      tag: m.querySelector('[name=tag]').value.trim(),
      attachments: JSON.parse(JSON.stringify(tempAttachments)),
      opacity: defaultCardOpacity(),
      createdAt: Date.now(), autoSize: true
    };
    board.items.push(item);
    if (viewMode === 'kanban') renderKanban();
    else renderBoard();
    markDirty();
    pushHistory();
  });
}
  addBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showMenu(e.clientX, e.clientY, [
      { label: 'Создать статус', action: () => openCreateStatusDialog(() => renderKanban()) },
      '---',
      { label: 'Управление статусами', action: () => openManageStatusesDialog() }
    ]);
  });
  kanbanViewEl.appendChild(addBtn);
}
function renameCustomStatus(statusId) {
  const s = (appSettings.customStatuses || []).find(x => x.id === statusId);
  if (!s) return;
  openPrompt('Новое название статуса', s.title, async (v) => {
    const name = (v || '').trim();
    if (!name) return;
    const settings = await window.api.loadSettings();
    const target = (settings.customStatuses || []).find(x => x.id === statusId);
    if (!target) return;
    target.label = name;
    target.title = name;
    await window.api.saveSettings(settings);
    appSettings = settings;
    renderBoard();
    renderKanban();
    markDirty();
  });
}

async function changeStatusColor(statusId) {
  const s = (appSettings.customStatuses || []).find(x => x.id === statusId);
  if (!s) return;

  let selectedColor = s.color || CUSTOM_STATUS_COLORS[0];
  const swatches = CUSTOM_STATUS_COLORS.map(c =>
    `<div class="status-color-swatch${c === selectedColor ? ' selected' : ''}" data-color="${c}" style="background:${c}"></div>`
  ).join('');

  modal.innerHTML = `
    <h3>Цвет статуса</h3>
    <div class="status-color-palette" id="statusColorPalette">${swatches}</div>
    <div class="modal-actions">
      <button class="tb-btn modal-cancel">Отмена</button>
      <button class="tb-btn accent modal-ok">OK</button>
    </div>`;
  modalBackdrop.classList.add('show');

  modal.querySelectorAll('.status-color-swatch').forEach(sw => {
    sw.onclick = () => {
      modal.querySelectorAll('.status-color-swatch').forEach(x => x.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = sw.dataset.color;
    };
  });

  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelector('.modal-ok').onclick = async () => {
    const settings = await window.api.loadSettings();
    const target = (settings.customStatuses || []).find(x => x.id === statusId);
    if (!target) return;
    target.color = selectedColor;
    await window.api.saveSettings(settings);
    appSettings = settings;
    closeModal();
    renderBoard();
    renderKanban();
    markDirty();
  };
}

async function deleteCustomStatus(statusId) {
  const s = (appSettings.customStatuses || []).find(x => x.id === statusId);
  if (!s) return;
  const used = board.items.some(i => i.status === statusId);
  const msg = used
    ? `Этот статус используется в заметках. Удалить? Заметки перейдут в «TODO».`
    : `Удалить статус «${s.title}»?`;
  if (!confirm(msg)) return;

  for (const it of board.items) {
    if (it.status === statusId) it.status = 'todo';
  }

  const settings = await window.api.loadSettings();
  settings.customStatuses = (settings.customStatuses || []).filter(x => x.id !== statusId);
  await window.api.saveSettings(settings);
  appSettings = settings;

  renderBoard();
  markDirty();
  pushHistory();
  renderKanban();
}
function createKanbanCard(item) {
  const el = document.createElement('div');
  el.className = 'kanban-card';
  el.dataset.id = item.id;
  el.draggable = true;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let deadlineCls = '';
  let deadlineHtml = '';
  if (item.deadline) {
    const d = new Date(item.deadline);
    if (d < today) { el.classList.add('overdue'); deadlineCls = 'kanban-card-dl-overdue'; }
    else {
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      if (d < tomorrow) el.classList.add('today');
    }
    deadlineHtml = `<span class="${deadlineCls}">до ${escapeHtml(item.deadline)}</span>`;
  }

  const authorHtml = item.author ? `<span>${escapeHtml(item.author)}</span>` : '';

  const contentPreview = item.content
    ? `<div class="kanban-card-body">${escapeHtml(item.content)}</div>`
    : '';

  const tagHtml = item.tag
    ? `<div class="kanban-card-tag">${escapeHtml(item.tag)}</div>`
    : '';

  el.innerHTML = `
    <div class="kanban-card-title">${escapeHtml(item.title || 'Заметка')}</div>
    ${contentPreview}
    <div class="kanban-card-meta">${authorHtml}${deadlineHtml}</div>
    ${tagHtml}
  `;

  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
  });

  el.addEventListener('dblclick', () => {
    editItem(item);
  });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    showMenu(e.clientX, e.clientY, [
      { label: 'Редактировать', action: () => editItem(item) },
      '---',
      { label: 'Удалить', action: () => {
        board.items = board.items.filter(i => i.id !== item.id);
        board.links = (board.links || []).filter(l => l.from !== item.id && l.to !== item.id);
        markDirty(); pushHistory();
        renderKanban();
      }}
    ]);
  });

  return el;
}

function setupKanbanDrop(bodyEl, statusId) {
  bodyEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    bodyEl.classList.add('drag-over');
  });
  bodyEl.addEventListener('dragleave', (e) => {
    if (!bodyEl.contains(e.relatedTarget)) {
      bodyEl.classList.remove('drag-over');
    }
  });
  bodyEl.addEventListener('drop', (e) => {
    e.preventDefault();
    bodyEl.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const item = board.items.find(i => i.id === id);
    if (!item || item.type !== 'note') return;
    if ((item.status || 'todo') === statusId) return;

    item.status = statusId;
    markDirty();
    pushHistory();
    renderKanban();
  });
}

/* =========================================================
   КАЛЕНДАРЬ
   ========================================================= */
const calendarViewEl = document.getElementById('calendarView');
let calendarWeekOffset = 0;   // 0 = текущая неделя
let calendarMode = 'week';    // 'week' | 'month'
let calendarMonthOffset = 0;  // 0 = текущий месяц

function getWeekStart(offset) {
  const now = new Date();
  const day = now.getDay(); // 0=Вс, 1=Пн, ...
  const diff = (day === 0 ? -6 : 1 - day); // сдвиг к понедельнику
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function fmtDayMonth(d) {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function renderCalendar() {
  if (!calendarViewEl) return;
  calendarViewEl.innerHTML = '';

  // ─── Верхняя панель ───
  const header = document.createElement('div');
  header.className = 'cal-header';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'cal-nav-btn';
  prevBtn.textContent = '←';
  prevBtn.title = calendarMode === 'week' ? 'Предыдущая неделя' : 'Предыдущий месяц';
  prevBtn.onclick = () => {
    if (calendarMode === 'week') calendarWeekOffset--;
    else calendarMonthOffset--;
    renderCalendar();
  };

  const nextBtn = document.createElement('button');
  nextBtn.className = 'cal-nav-btn';
  nextBtn.textContent = '→';
  nextBtn.title = calendarMode === 'week' ? 'Следующая неделя' : 'Следующий месяц';
  nextBtn.onclick = () => {
    if (calendarMode === 'week') calendarWeekOffset++;
    else calendarMonthOffset++;
    renderCalendar();
  };

  const rangeLbl = document.createElement('div');
  rangeLbl.className = 'cal-range';
  rangeLbl.textContent = calendarMode === 'week'
    ? weekRangeLabel()
    : monthRangeLabel();

  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'cal-mode-tabs';
  const tabWeek = document.createElement('button');
  tabWeek.textContent = 'Неделя';
  tabWeek.classList.toggle('active', calendarMode === 'week');
  tabWeek.onclick = () => { calendarMode = 'week'; renderCalendar(); };
  const tabMonth = document.createElement('button');
  tabMonth.textContent = 'Месяц';
  tabMonth.classList.toggle('active', calendarMode === 'month');
  tabMonth.onclick = () => { calendarMode = 'month'; renderCalendar(); };
  tabsWrap.appendChild(tabWeek);
  tabsWrap.appendChild(tabMonth);

  const spacer = document.createElement('div');
  spacer.className = 'cal-spacer';

  const todayBtn = document.createElement('button');
  todayBtn.className = 'cal-today-btn';
  todayBtn.textContent = 'Сегодня';
  todayBtn.onclick = () => {
    calendarWeekOffset = 0;
    calendarMonthOffset = 0;
    renderCalendar();
  };

  header.appendChild(prevBtn);
  header.appendChild(nextBtn);
  header.appendChild(rangeLbl);
  header.appendChild(tabsWrap);
  header.appendChild(spacer);
  header.appendChild(todayBtn);
  calendarViewEl.appendChild(header);

  // ─── Сетка ───
  if (calendarMode === 'week') {
    renderWeekGrid();
  } else {
    renderMonthGrid();
  }
}

function weekRangeLabel() {
  const start = getWeekStart(calendarWeekOffset);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  return `${fmtDayMonth(start)} — ${fmtDayMonth(end)} ${end.getFullYear()}`;
}

function monthRangeLabel() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1);
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

/* ---------- Неделя ---------- */
function renderWeekGrid() {
  const weekStart = getWeekStart(calendarWeekOffset);
  const weekGrid = document.createElement('div');
  weekGrid.className = 'cal-week';
  calendarViewEl.appendChild(weekGrid);

  const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const dayStr = ymd(day);

    const dayEl = document.createElement('div');
    dayEl.className = 'cal-day';
    dayEl.dataset.date = dayStr;
    if (day.getTime() === today.getTime()) dayEl.classList.add('today');
    if (i >= 5) dayEl.classList.add('weekend');

    const head = document.createElement('div');
    head.className = 'cal-day-head';
    head.innerHTML = `
      <span>${dayNames[i]}</span>
      <span class="cal-day-num">${day.getDate()}</span>
    `;
    dayEl.appendChild(head);

    const body = document.createElement('div');
    body.className = 'cal-day-body';
    body.dataset.date = dayStr;
    dayEl.appendChild(body);

    const tasks = board.items.filter(it =>
      (it.type === 'note' || it.type === 'paragraph' || it.type === 'tome') &&
      !it.hidden &&
      it.deadline === dayStr
    );

    if (!tasks.length) {
      const empty = document.createElement('div');
      empty.className = 'cal-empty';
      empty.textContent = '—';
      body.appendChild(empty);
    } else {
      for (const t of tasks) body.appendChild(createCalCard(t, day));
    }

    setupCalDrop(body, dayStr);
    setupCalContextMenu(body, dayStr);
    weekGrid.appendChild(dayEl);
  }
}

/* ---------- Месяц ---------- */
function renderMonthGrid() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const monthStartDay = firstOfMonth.getDay(); // 0 = Вс
  const shiftToMonday = (monthStartDay === 0 ? -6 : 1 - monthStartDay);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() + shiftToMonday);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Отдельная полоса с днями недели (не входит в сетку дней)
  const headRow = document.createElement('div');
  headRow.className = 'cal-month-head-row';
  const dayShort = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
  for (const d of dayShort) {
    const h = document.createElement('div');
    h.className = 'cal-month-head';
    h.textContent = d;
    headRow.appendChild(h);
  }
  calendarViewEl.appendChild(headRow);

  // Сетка дней месяца
  const grid = document.createElement('div');
  grid.className = 'cal-month';
  calendarViewEl.appendChild(grid);

  // 6 строк × 7 колонок
  const cells = 42;
  for (let i = 0; i < cells; i++) {
    const day = new Date(gridStart);
    day.setDate(day.getDate() + i);
    const dayStr = ymd(day);
    const inCurrentMonth = day.getMonth() === firstOfMonth.getMonth();

    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    cell.dataset.date = dayStr;
    if (day.getTime() === today.getTime()) cell.classList.add('today');
    if (!inCurrentMonth) cell.classList.add('other-month');

    const numRow = document.createElement('div');
    numRow.className = 'cal-day-cell-num';
    numRow.innerHTML = `<span>${day.getDate()}</span>`;
    cell.appendChild(numRow);

    const body = document.createElement('div');
    body.className = 'cal-day-cell-body';
    cell.appendChild(body);

    const tasks = board.items.filter(it =>
      (it.type === 'note' || it.type === 'paragraph' || it.type === 'tome') &&
      !it.hidden &&
      it.deadline === dayStr
    );
    for (const t of tasks) body.appendChild(createCalMiniCard(t));

    setupCalDrop(body, dayStr);
    setupCalContextMenu(body, dayStr);
    grid.appendChild(cell);
  }
}

function createCalMiniCard(item) {
  const el = document.createElement('div');
  el.className = 'cal-mini-card status-' + (item.status || 'todo');
  el.draggable = true;
  el.dataset.id = item.id;
  el.textContent = item.title || 'Заметка';
  el.title = item.title || '';

  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dblclick', () => editItem(item));
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    showMenu(e.clientX, e.clientY, [
      { label: 'Редактировать', action: () => editItem(item) },
      { label: 'Убрать срок', action: () => {
        item.deadline = '';
        markDirty(); pushHistory(); renderCalendar();
      }},
      '---',
      { label: 'Удалить', action: () => {
        board.items = board.items.filter(i => i.id !== item.id);
        board.links = (board.links || []).filter(l => l.from !== item.id && l.to !== item.id);
        markDirty(); pushHistory(); renderCalendar();
      }}
    ]);
  });
  return el;
}

function createCalCard(item, day) {
  const el = document.createElement('div');
  el.className = 'cal-card status-' + (item.status || 'todo');
  el.draggable = true;
  el.dataset.id = item.id;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (day.getTime() < today.getTime()) el.classList.add('overdue');

  el.innerHTML = `
    <div class="cal-card-title">${escapeHtml(item.title || 'Заметка')}</div>
    ${item.author ? `<div class="cal-card-author">${escapeHtml(item.author)}</div>` : ''}
    ${item.tag ? `<div class="cal-card-tag">${escapeHtml(item.tag)}</div>` : ''}
  `;

  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));

  el.addEventListener('dblclick', () => editItem(item));

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    showMenu(e.clientX, e.clientY, [
      { label: 'Редактировать', action: () => editItem(item) },
      { label: 'Убрать срок', action: () => {
        item.deadline = '';
        markDirty(); pushHistory(); renderCalendar();
      }},
      '---',
      { label: 'Удалить', action: () => {
        board.items = board.items.filter(i => i.id !== item.id);
        board.links = (board.links || []).filter(l => l.from !== item.id && l.to !== item.id);
        markDirty(); pushHistory(); renderCalendar();
      }}
    ]);
  });

  return el;
}

function findFreeSpot(w, h) {
  const stepX = 30, stepY = 30;
  let x = 40, y = 40;
  for (let tries = 0; tries < 300; tries++) {
    const clash = board.items.some(it =>
      !isFrame(it) &&
      !(it.x + it.w < x || it.x > x + w || it.y + it.h < y || it.y > y + h)
    );
    if (!clash) return { x, y };
    x += stepX;
    if (x > board.width - w - 20) { x = 40; y += 60; }
    if (y > board.height - h - 20) break;
  }
  return { x: 40, y: 40 };
}

function createNoteForDate(dayStr) {
  const { x, y } = findFreeSpot(240, 160);
  tempAttachments = [];
  openModal(noteForm(null, dayStr), (m) => {
    const item = {
      id: uid(), type: 'note', x, y, w: 240, h: 160,
      title: m.querySelector('[name=title]').value || 'Заметка',
      content: m.querySelector('[name=content]').value,
      status: m.querySelector('[name=status]').value || 'todo',
      labels: [],
      author: m.querySelector('[name=author]').value,
      deadline: m.querySelector('[name=deadline]').value || dayStr,
      tag: m.querySelector('[name=tag]').value.trim(),
      attachments: JSON.parse(JSON.stringify(tempAttachments)),
      opacity: defaultCardOpacity(),
      createdAt: Date.now(), autoSize: true
    };
    board.items.push(item); renderBoard(); markDirty(); pushHistory();
  });
}

function createParagraphForCalendar(dayStr) {
  const { x, y } = findFreeSpot(320, 200);
  createParagraph(x, y, dayStr);
}

function createTomeForCalendar(dayStr) {
  const { x, y } = findFreeSpot(260, 150);
  createTome(x, y, dayStr);
}

function setupCalContextMenu(bodyEl, dayStr) {
  bodyEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showMenu(e.clientX, e.clientY, [
      { label: 'Создать заметку',  action: () => createNoteForDate(dayStr) },
      { label: 'Создать абзац',    action: () => createParagraphForCalendar(dayStr) },
      { label: 'Создать том',      action: () => createTomeForCalendar(dayStr) }
    ]);
  });
}

function setupCalDrop(bodyEl, dayStr) {
  bodyEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    bodyEl.classList.add('drag-over');
  });
  bodyEl.addEventListener('dragleave', (e) => {
    if (!bodyEl.contains(e.relatedTarget)) bodyEl.classList.remove('drag-over');
  });
  bodyEl.addEventListener('drop', (e) => {
    e.preventDefault();
    bodyEl.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const item = board.items.find(i => i.id === id);
    if (!item) return;
    if (item.type !== 'note' && item.type !== 'paragraph' && item.type !== 'tome') return;
    if (item.deadline === dayStr) return;
    item.deadline = dayStr;
    markDirty(); pushHistory();
    renderCalendar();
  });
}

/* =========================================================
   РЕНДЕР
   ========================================================= */
function renderBoard() {
  boardEl.style.width  = board.width  + 'px';
  boardEl.style.height = board.height + 'px';
  boardInfo.textContent = (board.name || 'Доска') + ' · ' + board.width + '×' + board.height;

  boardEl.querySelectorAll('.item, .frame').forEach(e => e.remove());

  board.items.filter(isFrame).forEach(item => {
    boardEl.appendChild(createFrameEl(item));
  });
  board.items.filter(it => !isFrame(it)).forEach(item => {
    const el = createItemEl(item);
    boardEl.appendChild(el);
    if (item.autoSize) autoSizeItem(el, item);
  });

  applyTransform();
  updateFrameHiddenItems();
  updateStackIndicators();
  updateSelectionClasses();
  applySearchClasses();
  applyFilterClasses();
  refreshFilterDropdowns();
  renderLinks();
  updateHiddenCounter();

  // Если открыт канбан или календарь — синхронизируем
  if (viewMode === 'kanban')   renderKanban();
  if (viewMode === 'calendar') renderCalendar();
}

function tagHtml(tag) {
  return tag ? `<div class="item-tag">${escapeHtml(tag)}</div>` : '';
}

function createItemEl(item) {
  const el = document.createElement('div');
  let cls = 'item item-' + item.type;
  if (item.locked) cls += ' locked';
  if (item.hidden) cls += ' hidden';
  if (isOutsideBoard(item)) cls += ' outside-board';
  el.className = cls;
  el.dataset.id = item.id;
  el.draggable = false;
  el.style.left   = item.x + 'px';
  el.style.top    = item.y + 'px';
  el.style.width  = item.w + 'px';
  el.style.height = item.h + 'px';
  if (item.color) el.style.background = item.color;
  if (typeof item.opacity === 'number' && item.opacity < 1) {
    el.style.opacity = item.opacity;
  }

  if (item.type === 'note') {
    el.innerHTML = `
      <div class="item-head">${escapeHtml(item.title || 'Заметка')}</div>
      ${tagHtml(item.tag)}
      <div class="item-body">${escapeHtml(item.content || '')}</div>
      <div class="item-meta">${escapeHtml(item.author || '')}${item.author ? ' · ' : ''}${fmtDate(item.createdAt)}${item.deadline ? ' · до ' + escapeHtml(item.deadline) : ''}</div>`;
  } else if (item.type === 'paragraph') {
    el.innerHTML = `
      <div class="item-head">${escapeHtml(item.title || 'Абзац')}</div>
      ${tagHtml(item.tag)}
      <div class="item-body">${escapeHtml(item.content || '')}</div>`;
  } else if (item.type === 'image') {
    el.innerHTML = `
      <img src="${toFileUrl(item.src)}" alt="" draggable="false">
      ${tagHtml(item.tag)}
      <div class="item-meta">${escapeHtml(item.title || '')}</div>`;
  } else if (item.type === 'tome') {
    el.innerHTML = `
      <div class="item-head">${escapeHtml(item.title || 'Том')}</div>
      ${tagHtml(item.tag)}
      <div class="item-body">${escapeHtml(item.preview || 'Пусто. Двойной клик — открыть редактор.')}</div>
      <div class="item-meta">Двойной клик — открыть</div>`;
  } else if (item.type === 'link') {
    el.innerHTML = `
      <div class="item-head">${escapeHtml(item.title || 'Ссылка')}</div>
      ${tagHtml(item.tag)}
      <div class="item-body url">${escapeHtml(item.url || '')}</div>`;
  }

    // Бейдж статуса
  if (item.type === 'note' && item.status) {
    const st = document.createElement('div');
    st.className = 'item-status';
    st.dataset.status = item.status;
    st.textContent = STATUS_LABELS[item.status] || item.status;
    el.appendChild(st);
  }

  // Метки
  const labels = Array.isArray(item.labels) ? item.labels : [];
  if (labels.length) {
    const wrap = document.createElement('div');
    wrap.className = 'item-labels';
    for (const labId of labels) {
      const lab = LABELS.find(l => l.id === labId);
      if (!lab) continue;
      const d = document.createElement('div');
      d.className = 'item-label';
      d.dataset.label = lab.id;
      d.textContent = lab.mark;
      d.title = lab.title;
      wrap.appendChild(d);
    }
    el.appendChild(wrap);
  }

  // Вложения (миниатюры и чипы ссылок)
  const attachs = Array.isArray(item.attachments) ? item.attachments : [];
  if (attachs.length) {
    const wrap = document.createElement('div');
    wrap.className = 'item-attachments';
    for (const a of attachs) {
      if (a.type === 'image') {
        const th = document.createElement('div');
        th.className = 'item-attach-thumb';
        th.title = (a.title || '') + ' — клик, чтобы открыть';
        th.innerHTML = `<img src="${toFileUrl(a.src)}" alt="">`;
        th.addEventListener('pointerdown', (e) => e.stopPropagation());
        th.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (a.src) window.api.openPath(a.src);
        });
        wrap.appendChild(th);
      } else {
        const chip = document.createElement('div');
        chip.className = 'item-attach-chip';
        chip.textContent = a.title || a.url || 'Ссылка';
        chip.title = a.url || '';
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (a.url) window.api.openExternal(a.url);
        });
        chip.addEventListener('pointerdown', (e) => e.stopPropagation());
        wrap.appendChild(chip);
      }
    }
    el.appendChild(wrap);
  }

  // Замочек
  if (item.locked) {
    const lock = document.createElement('div');
    lock.className = 'item-lock';
    lock.textContent = 'L';
    lock.title = 'Заблокировано';
    el.appendChild(lock);
  }

  const rh = document.createElement('div');
  rh.className = 'resize-handle';
  el.appendChild(rh);
  attachResize(rh, el, item);
  attachItemEvents(el, item);
  return el;
}

function autoSizeItem(el, item) {
  el.style.width = 'max-content';
  el.style.height = 'auto';
  el.style.maxWidth = '320px';
  el.style.minWidth = '140px';
  void el.offsetWidth;
  const rect = el.getBoundingClientRect();
  item.w = Math.ceil(rect.width  / view.scale) + 2;
  item.h = Math.ceil(rect.height / view.scale) + 2;
  el.style.width = item.w + 'px';
  el.style.height = item.h + 'px';
  el.style.maxWidth = '';
  el.style.minWidth = '';
  item.autoSize = false;
  markDirty();
}

function attachItemEvents(el, item) {
  let dragState = null;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (activeTool !== 'select') return;
    if (e.target.classList.contains('resize-handle')) return;
    if (e.target.classList.contains('stack-indicator')) return;

    // Ctrl / Cmd (+Shift) — создать связь с якорем
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      e.preventDefault();
      handleLinkClick(item);
      return;
    }

    if (e.shiftKey) { e.stopPropagation(); toggleSelect(item.id); return; }

    // Заблокированную карточку можно выделить, но не таскать
    if (item.locked) {
      e.stopPropagation();
      if (!selectedIds.has(item.id)) selectOnly(item.id);
      linkAnchorId = item.id;
      updateSelectionClasses();
      return;
    }

    if (!selectedIds.has(item.id)) selectOnly(item.id);
    linkAnchorId = item.id;
    updateSelectionClasses();
    const ids = Array.from(selectedIds);
    dragState = {
      ids,
      origin: ids.map(id => {
        const it = board.items.find(b => b.id === id);
        return { id, x: it.x, y: it.y, w: it.w, h: it.h };
      }),
      startX: e.clientX, startY: e.clientY, moved: false
    };
    try { el.setPointerCapture(e.pointerId); } catch {}
    el.classList.add('dragging');
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const dx = (e.clientX - dragState.startX) / view.scale;
    const dy = (e.clientY - dragState.startY) / view.scale;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
        for (const d of dragState.origin) {
      const it = board.items.find(b => b.id === d.id);
      if (!it) continue;
      let nx = d.x + dx;
      let ny = d.y + dy;
      // Привязка к сетке 50×50 — только в режиме 'grid'
      if (snapMode === 'grid') {
        nx = Math.round(nx / 50) * 50;
        ny = Math.round(ny / 50) * 50;
      }
      const M = 4000;
      nx = Math.max(-M, Math.min(board.width  + M - it.w, nx));
      ny = Math.max(-M, Math.min(board.height + M - it.h, ny));
      it.x = nx; it.y = ny;
      const itemEl = boardEl.querySelector(`.item[data-id="${d.id}"]`);
      if (itemEl) {
        itemEl.style.left = nx + 'px';
        itemEl.style.top  = ny + 'px';
        // Обновляем статус «спящая» во время движения
        itemEl.classList.toggle('outside-board', isOutsideBoard(it));
      }
      updateLinksForItem(d.id);
    }
  });

  el.addEventListener('pointerup', (e) => {
    if (!dragState) return;
    const wasMoved = dragState.moved;
    const ids = dragState.ids.slice();
    dragState = null;
    el.classList.remove('dragging');
    try { el.releasePointerCapture(e.pointerId); } catch {}
    if (!wasMoved) return;

    if (ids.length === 1 && snapMode === 'board') {
      const it = board.items.find(b => b.id === ids[0]);
      if (it) {
        const snapX = findSnapX(it, it.x, board.items);
        const snapY = findSnapY(it, it.y, board.items);
        if (snapX !== null || snapY !== null) {
          const itemEl = boardEl.querySelector(`.item[data-id="${it.id}"]`);
          if (itemEl) {
            itemEl.style.transition = 'left .12s ease-out, top .12s ease-out';
            if (snapX !== null) { it.x = snapX; itemEl.style.left = snapX + 'px'; }
            if (snapY !== null) { it.y = snapY; itemEl.style.top  = snapY + 'px'; }
            setTimeout(() => { itemEl.style.transition = ''; }, 140);
            updateLinksForItem(it.id);
          }
        }
      }
    }
    markDirty();
    pushHistory();
    updateStackIndicators();
    updateFrameHiddenItems();
    updatePropsPanel();
  });

  el.addEventListener('dblclick', (e) => { e.stopPropagation(); openItem(item); });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!selectedIds.has(item.id)) selectOnly(item.id);
    showItemMenu(e.clientX, e.clientY, item);
  });
}

function attachResize(handle, el, item) {
  handle.addEventListener('pointerdown', (e) => {
    if (item.locked) return;
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = item.w, startH = item.h;
    try { handle.setPointerCapture(e.pointerId); } catch {}
    item.autoSize = false;
    const onMove = (ev) => {
      const dw = (ev.clientX - startX) / view.scale;
      const dh = (ev.clientY - startY) / view.scale;
      item.w = Math.max(120, startW + dw);
      item.h = Math.max(70,  startH + dh);
      el.style.width  = Math.round(item.w * view.scale) + 'px';
      el.style.height = Math.round(item.h * view.scale) + 'px';
      updateLinksForItem(item.id);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      markDirty(); pushHistory();
      updateStackIndicators();
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
}

async function openItem(item) {
  if (isOutsideBoard(item)) return;
  if (item.type === 'tome') await window.api.openTome({ filePath: item.filePath });
  else if (item.type === 'link') { if (item.url) window.api.openExternal(item.url); }
  else if (item.type === 'image') { if (item.src) window.api.openPath(item.src); }
  else editItem(item);
}

function deleteItem(item) {
  board.items = board.items.filter(i => i.id !== item.id);
  board.links = (board.links || []).filter(l => l.from !== item.id && l.to !== item.id);
  selectedIds.delete(item.id);
  renderBoard(); markDirty(); pushHistory();
}
function deleteSelection() {
  if (!selectedIds.size) return;
  const ids = new Set(selectedIds);
  board.items = board.items.filter(i => !ids.has(i.id));
  board.links = (board.links || []).filter(l => !ids.has(l.from) && !ids.has(l.to));
  selectedIds.clear();
  renderBoard(); markDirty(); pushHistory();
}

/* ---------- контекстное меню ---------- */
let opacitySubmenuEl = null;

function showMenu(x, y, entries) {
  hideOpacitySubmenu();
  contextMenu.innerHTML = '';
  entries.forEach(en => {
    if (en === '---') {
      const sep = document.createElement('div'); sep.className = 'sep';
      contextMenu.appendChild(sep); return;
    }
    const b = document.createElement('button');
    b.textContent = en.label;
    if (en.opacityTarget) {
      // Пункт "Прозрачность" — при наведении открывает подменю со слайдером
      b.addEventListener('mouseenter', () => showOpacitySubmenu(b, en.opacityTarget));
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    } else {
      b.onclick = () => { hideMenu(); en.action(); };
      b.addEventListener('mouseenter', hideOpacitySubmenu);
    }
    contextMenu.appendChild(b);
  });
  contextMenu.classList.add('show');
  const rect = contextMenu.getBoundingClientRect();
  contextMenu.style.left = Math.min(x, window.innerWidth  - rect.width  - 6) + 'px';
  contextMenu.style.top  = Math.min(y, window.innerHeight - rect.height - 6) + 'px';
}
function hideMenu() {
  contextMenu.classList.remove('show');
  hideOpacitySubmenu();
}

function showOpacitySubmenu(anchorBtn, item) {
  hideOpacitySubmenu();
  const r = anchorBtn.getBoundingClientRect();
  const current = (typeof item.opacity === 'number') ? Math.round(item.opacity * 100) : 100;

  opacitySubmenuEl = document.createElement('div');
  opacitySubmenuEl.className = 'opacity-submenu';
  opacitySubmenuEl.innerHTML = `
    <label>Прозрачность <span class="opacity-value">${current}%</span></label>
    <input type="range" min="20" max="100" step="1" value="${current}">
  `;

  // Позиционируем справа от пункта, при нехватке места — слева
  const width = 220;
  let left = r.right + 6;
  if (left + width > window.innerWidth - 6) left = r.left - width - 6;
  if (left < 6) left = 6;
  let top = r.top;
  const approxH = 70;
  if (top + approxH > window.innerHeight - 6) top = window.innerHeight - approxH - 6;

  opacitySubmenuEl.style.left = left + 'px';
  opacitySubmenuEl.style.top  = top + 'px';
  document.body.appendChild(opacitySubmenuEl);

  const slider = opacitySubmenuEl.querySelector('input[type=range]');
  const valEl  = opacitySubmenuEl.querySelector('.opacity-value');

  slider.addEventListener('input', (e) => {
    const p = Number(e.target.value);
    valEl.textContent = p + '%';
    item.opacity = p / 100;
    const el = boardEl.querySelector(`.item[data-id="${item.id}"]`);
    if (el) el.style.opacity = item.opacity;
  });
  slider.addEventListener('change', () => {
    markDirty();
    pushHistory();
  });

  // Задержка, чтобы мышь успела уехать из пункта в подменю
  opacitySubmenuEl.addEventListener('mouseleave', () => {
    setTimeout(() => {
      if (!opacitySubmenuEl) return;
      if (opacitySubmenuEl.matches(':hover')) return;
      if (anchorBtn.matches(':hover')) return;
      hideOpacitySubmenu();
    }, 250);
  });
}

function hideOpacitySubmenu() {
  if (opacitySubmenuEl) {
    opacitySubmenuEl.remove();
    opacitySubmenuEl = null;
  }
}
document.addEventListener('click', hideMenu);
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.item, .frame')) hideMenu(); });

boardEl.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.item') || e.target.closest('.frame')) return;
  e.preventDefault(); e.stopPropagation();
  const pos = screenToBoard(e.clientX, e.clientY);
  const x = Math.max(0, pos.x), y = Math.max(0, pos.y);
  showMenu(e.clientX, e.clientY, [
    { label: 'Создать заметку',    action: () => createNote(x, y) },
    { label: 'Создать абзац',      action: () => createParagraph(x, y) },
    { label: 'Создать том',        action: () => createTome(x, y) },
    { label: 'Добавить изображение', action: () => addImageFromDialog(x, y) },
    { label: 'Добавить ссылку',    action: () => createLink(x, y) },
    '---',
    { label: 'Создать область',    action: () => createFrame(x, y, 320, 240) },
    { label: 'Вернуть все спящие карточки', action: () => {
      let count = 0;
      for (const it of board.items) {
        const outside = isFrame(it)
          ? (it.x + it.w <= 0 || it.y + it.h <= 0 || it.x >= board.width || it.y >= board.height)
          : isOutsideBoard(it);
        if (outside) {
          it.x = Math.max(20, Math.min(board.width  - it.w - 20, it.x));
          it.y = Math.max(20, Math.min(board.height - it.h - 20, it.y));
          count++;
        }
      }
      if (count) { renderBoard(); markDirty(); pushHistory(); }
    }},
    { label: 'Расширить доску…',   action: () => openExpandDialog() },
    { label: 'По центру',          action: () => fitBoard() },
    { label: 'Сменить тему',       action: () => { currentTheme = currentTheme === 'dark' ? 'light' : 'dark'; applyTheme(currentTheme); } }
  ]);
});

function showItemMenu(cx, cy, item) {
  if (isOutsideBoard(item)) {
    showMenu(cx, cy, [
      { label: 'Вернуть на доску', action: () => {
        item.x = Math.max(20, Math.min(board.width  - item.w - 20, item.x));
        item.y = Math.max(20, Math.min(board.height - item.h - 20, item.y));
        renderBoard(); markDirty(); pushHistory();
      }},
      '---',
      { label: 'Удалить', action: () => deleteItem(item) }
    ]);
    return;
  }
  const entries = [];
  const multi = selectedIds.size > 1 && selectedIds.has(item.id);
  if (multi) {
    entries.push({ label: `Копировать (${selectedIds.size})`, action: () => copySelection() });
    entries.push({ label: `Дублировать (${selectedIds.size})`, action: () => duplicateSelection() });
    entries.push('---');
    entries.push({ label: `Удалить выделенные (${selectedIds.size})`, action: () => deleteSelection() });
  } else {
    if (item.type === 'tome') entries.push({ label: 'Открыть', action: () => openItem(item) });
    if (item.type === 'link') entries.push({ label: 'Открыть в браузере', action: () => openItem(item) });
    if (item.type !== 'image' && item.type !== 'tome') entries.push({ label: 'Редактировать', action: () => editItem(item) });
    if (item.type === 'image') entries.push({ label: 'Переименовать', action: () => renameImage(item) });
    entries.push({ label: 'Копировать', action: () => copySelection() });
    entries.push({ label: 'Дублировать', action: () => duplicateSelection() });
        entries.push({ label: 'Изменить тег', action: () => editTag(item) });
    entries.push({ label: 'Изменить цвет', action: () => openColorPicker(item) });
    entries.push({ label: 'Связать с…', action: () => openLinkPicker(item) });

    if (item.type === 'note') {
      entries.push({ label: 'Статус…', action: () => openStatusPicker(item) });
    }
    entries.push({ label: 'Метки…', action: () => openLabelsPicker(item) });
    if (item.type === 'tome') {
      entries.push({ label: 'Вложения…', action: () => openAttachEditor(item) });
      entries.push({ label: 'Срок…', action: () => openTomeDeadline(item) });
    }
    entries.push({ label: item.locked ? 'Разблокировать' : 'Заблокировать', action: () => {
      item.locked = !item.locked;
      renderBoard(); markDirty(); pushHistory();
    }});
    entries.push({ label: 'Скрыть карточку', action: () => {
      item.hidden = true;
      selectedIds.delete(item.id);
      renderBoard(); markDirty(); pushHistory();
    }});

    const myLinks = (board.links || []).filter(l => l.from === item.id || l.to === item.id);
    if (myLinks.length > 0) {
      entries.push({ label: `Отвязать от… (${myLinks.length})`, action: () => openUnlinkPicker(item) });
    }

    entries.push('---');
    entries.push({ label: 'Прозрачность  ›', opacityTarget: item });
    entries.push('---');
    entries.push({ label: 'Удалить', action: () => deleteItem(item) });
  }
  showMenu(cx, cy, entries);
}

/* ---------- модалка ---------- */
function openModal(html, onSubmit) {
  modal.innerHTML = html + `
    <div class="modal-actions">
      <button class="tb-btn modal-cancel">Отмена</button>
      <button class="tb-btn accent modal-ok">OK</button>
    </div>`;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelector('.modal-ok').onclick = () => {
    const r = onSubmit(modal);
    if (r !== false) closeModal();
  };

  // Инициализируем секцию вложений, если она есть в форме
  if (modal.querySelector('#attachList')) {
    renderAttachList();
    bindAttachButtons();
  }

  const first = modal.querySelector('input,textarea');
  if (first) first.focus();
}
function closeModal() {
  modalBackdrop.classList.remove('show');
  modal.innerHTML = '';
}
modalBackdrop.addEventListener('mousedown', (e) => { if (e.target === modalBackdrop) closeModal(); });

/* ---------- формы ---------- */
function tagField(item) {
  return `<label>Тег / Категория<input name="tag" value="${escapeHtml(item?.tag || '')}" placeholder="Референс персонажа, Задумка..."></label>`;
}
function noteForm(item, defaultDeadline, defaultStatus) {
  const phTitle   = pickPlaceholder(PLACEHOLDERS.noteTitle);
  const phContent = pickPlaceholder(PLACEHOLDERS.noteContent);
  const phAuthor  = pickPlaceholder(PLACEHOLDERS.noteAuthor);
  const phTag     = pickPlaceholder(PLACEHOLDERS.tag);

  const allStatuses = getAllStatuses();
  const currentStatus = (item && item.status) || defaultStatus || 'todo';
  const statusOptions = allStatuses.map(s =>
    `<option value="${s.id}"${currentStatus === s.id ? ' selected' : ''}>${escapeHtml(s.label)}</option>`
  ).join('');

  return `
    <h3>${item ? 'Редактировать заметку' : 'Новая заметка'}</h3>
    <label>Заголовок
      <input name="title" value="${escapeHtml(item?.title || '')}" placeholder="${escapeHtml(phTitle)}">
    </label>
    <label>Текст
      <textarea name="content" rows="5" placeholder="${escapeHtml(phContent)}">${escapeHtml(item?.content || '')}</textarea>
    </label>
    <label>Статус
      <select name="status">${statusOptions}</select>
    </label>
    <label>Автор
      <input name="author" value="${escapeHtml(item?.author || '')}" placeholder="${escapeHtml(phAuthor)}">
    </label>
    <label>Срок
      <input name="deadline" type="date" value="${escapeHtml(item?.deadline || defaultDeadline || '')}">
    </label>
    <label>Тег / Категория
      <input name="tag" value="${escapeHtml(item?.tag || '')}" placeholder="${escapeHtml(phTag)}">
    </label>
    ${attachBlockHtml()}`;
}

function paragraphForm(item, defaultDeadline) {
  const phTitle   = pickPlaceholder(PLACEHOLDERS.paragraphTitle);
  const phContent = pickPlaceholder(PLACEHOLDERS.paragraphContent);
  return `
    <h3>${item ? 'Редактировать абзац' : 'Новый текстовый абзац'}</h3>
    <label>Заголовок<input name="title" value="${escapeHtml(item?.title || '')}" placeholder="${escapeHtml(phTitle)}"></label>
    <label>Текст (до 1000 символов)
      <textarea name="content" rows="8" maxlength="1000" placeholder="${escapeHtml(phContent)}">${escapeHtml(item?.content || '')}</textarea>
    </label>
    <label>Срок<input name="deadline" type="date" value="${escapeHtml(item?.deadline || defaultDeadline || '')}"></label>
    ${tagField(item)}
    ${attachBlockHtml()}`;
}
function createNote(x, y, defaultStatus) {
  tempAttachments = [];
  openModal(noteForm(null, null, defaultStatus), (m) => {
    const item = {
      id: uid(), type: 'note', x, y, w: 240, h: 160,
      title: m.querySelector('[name=title]').value || 'Заметка',
      content: m.querySelector('[name=content]').value,
      status: m.querySelector('[name=status]').value || 'todo',
      labels: [],
      author: m.querySelector('[name=author]').value,
      deadline: m.querySelector('[name=deadline]').value,
      tag: m.querySelector('[name=tag]').value.trim(),
      attachments: JSON.parse(JSON.stringify(tempAttachments)),
      opacity: defaultCardOpacity(),
      createdAt: Date.now(), autoSize: true
    };
    board.items.push(item); renderBoard(); markDirty(); pushHistory();
  });
}
function createParagraph(x, y, defaultDeadline) {
  tempAttachments = [];
  openModal(paragraphForm(null, defaultDeadline), (m) => {
    const content = m.querySelector('[name=content]').value.slice(0, 1000);
    const item = {
      id: uid(), type: 'paragraph', x, y, w: 320, h: 200,
      title: m.querySelector('[name=title]').value || 'Абзац',
      content,
      tag: m.querySelector('[name=tag]').value.trim(),
      deadline: m.querySelector('[name=deadline]').value || defaultDeadline || '',
      attachments: JSON.parse(JSON.stringify(tempAttachments)),
      opacity: defaultCardOpacity(),
      autoSize: true
    };
    board.items.push(item);
    renderBoard();
    markDirty();
    pushHistory();
  });
}
async function createTome(x, y, defaultDeadline) {
  const id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const filePath = await window.api.createTome({ id, title: 'Новый том', content: '' });
  const item = {
    id, type: 'tome', x, y, w: 260, h: 150,
    title: 'Новый том', preview: '', filePath, tag: '',
    deadline: defaultDeadline || '',
    autoSize: false
  };
  board.items.push(item); renderBoard(); markDirty(); pushHistory();
  await window.api.openTome({ filePath });
}
function createLink(x, y) {
  openModal(`
    <h3>Новая ссылка</h3>
    <label>Название<input name="title" placeholder="Документация Unity"></label>
    <label>URL<input name="url" placeholder="https://..."></label>
    ${tagField(null)}
  `, (m) => {
    const url = m.querySelector('[name=url]').value.trim();
    if (!url) return false;
    const item = {
      id: uid(), type: 'link', x, y, w: 220, h: 100,
      title: m.querySelector('[name=title]').value || url,
      url, tag: m.querySelector('[name=tag]').value.trim(),
      opacity: defaultCardOpacity(),
      autoSize: true
    };
    board.items.push(item); renderBoard(); markDirty(); pushHistory();
  });
}
function addImageItem(src, x, y) {
  const item = {
    id: uid(), type: 'image', x, y, w: 220, h: 180,
    src, title: src.split(/[\\/]/).pop(), tag: '',
    opacity: defaultCardOpacity(),
    autoSize: false
  };
  board.items.push(item); renderBoard(); markDirty(); pushHistory();
}
async function addImageFromDialog(x, y) {
  const src = await window.api.pickImage();
  if (src) addImageItem(src, x, y);
}
function renameImage(item) {
  openModal(`
    <h3>Переименовать изображение</h3>
    <label>Название<input name="title" value="${escapeHtml(item.title || '')}"></label>
    ${tagField(item)}
  `, (m) => {
    item.title = m.querySelector('[name=title]').value;
    item.tag = m.querySelector('[name=tag]').value.trim();
    renderBoard(); markDirty(); pushHistory();
  });
}
function editTag(item) {
  openModal(`<h3>Тег / Категория</h3>${tagField(item)}`, (m) => {
    item.tag = m.querySelector('[name=tag]').value.trim();
    renderBoard(); markDirty(); pushHistory();
  });
}
function editItem(item) {
  if (item.type === 'tome') {
    openItem(item);
    return;
  }
  if (item.type === 'note') {
    tempAttachments = Array.isArray(item.attachments) ? JSON.parse(JSON.stringify(item.attachments)) : [];
    openModal(noteForm(item), (m) => {
      item.title    = m.querySelector('[name=title]').value || 'Заметка';
      item.content  = m.querySelector('[name=content]').value;
      item.status   = m.querySelector('[name=status]').value || 'todo';
      item.author   = m.querySelector('[name=author]').value;
      item.deadline = m.querySelector('[name=deadline]').value;
      item.tag      = m.querySelector('[name=tag]').value.trim();
      item.attachments = JSON.parse(JSON.stringify(tempAttachments));
      renderBoard(); markDirty(); pushHistory();
    });
  } else if (item.type === 'paragraph') {
    tempAttachments = Array.isArray(item.attachments) ? JSON.parse(JSON.stringify(item.attachments)) : [];
    openModal(paragraphForm(item), (m) => {
      item.title    = m.querySelector('[name=title]').value || 'Абзац';
      item.content  = m.querySelector('[name=content]').value.slice(0, 1000);
      item.tag      = m.querySelector('[name=tag]').value.trim();
      item.deadline = m.querySelector('[name=deadline]').value || '';
      item.attachments = JSON.parse(JSON.stringify(tempAttachments));
      renderBoard(); markDirty(); pushHistory();
    });
  } else if (item.type === 'link') {
    openModal(`
      <h3>Редактировать ссылку</h3>
      <label>Название<input name="title" value="${escapeHtml(item.title)}"></label>
      <label>URL<input name="url" value="${escapeHtml(item.url || '')}"></label>
      ${tagField(item)}
    `, (m) => {
      item.title = m.querySelector('[name=title]').value;
      item.url   = m.querySelector('[name=url]').value;
      item.tag   = m.querySelector('[name=tag]').value.trim();
      renderBoard(); markDirty(); pushHistory();
    });
  }
}
const PALETTE = [
  { name: 'По умолчанию', value: null },
  { name: 'Красный',    value: '#FF6B6B66' },
  { name: 'Оранжевый',  value: '#FFA94D66' },
  { name: 'Жёлтый',     value: '#FFD43B66' },
  { name: 'Зелёный',    value: '#51CF6666' },
  { name: 'Бирюзовый',  value: '#38D9A966' },
  { name: 'Голубой',    value: '#4DABF766' },
  { name: 'Синий',      value: '#748FFC66' },
  { name: 'Фиолетовый', value: '#B197FC66' },
  { name: 'Розовый',    value: '#F783AC66' },
  { name: 'Серый',      value: '#ADB5BD66' }
];
function openColorPicker(item) {
  const swatches = PALETTE.map(p => {
    const selected = (item.color || null) === p.value ? ' selected' : '';
    const bg = p.value || 'transparent';
    const border = p.value ? '' : 'border-style:dashed;';
    return `<div class="color-swatch${selected}" data-color="${p.value || ''}" title="${escapeHtml(p.name)}" style="background:${bg};${border}"></div>`;
  }).join('');
  modal.innerHTML = `
    <h3>Цвет карточки</h3>
    <div class="color-palette">${swatches}</div>
    <div class="modal-actions"><button class="tb-btn modal-cancel">Закрыть</button></div>`;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelectorAll('.color-swatch').forEach(sw => {
    sw.onclick = () => {
      item.color = sw.dataset.color || null;
      closeModal(); renderBoard(); markDirty(); pushHistory();
    };
  });
}

/* ---------- drag&drop картинок ---------- */
['dragover','drop'].forEach(ev => viewport.addEventListener(ev, e => e.preventDefault()));
viewport.addEventListener('drop', async (e) => {
  e.preventDefault();
  const pos = screenToBoard(e.clientX, e.clientY);
  const x = Math.max(0, pos.x), y = Math.max(0, pos.y);
  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
  let offset = 0;
  for (const f of files) {
    const dataUrl = await new Promise(res => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(f);
    });
    const src = await window.api.saveImageDataUrl({ dataUrl });
    if (src) addImageItem(src, x + offset, y + offset);
    offset += 20;
  }
});

if (window.api.onSettingsChanged) {
  window.api.onSettingsChanged((s) => {
    if (!s) return;
    appSettings = s;
    if (s.linkColor) applyLinkColor(s.linkColor);
  });
}

window.api.onTomeUpdated(({ filePath, title, preview }) => {
  const item = board.items.find(i => i.type === 'tome' && i.filePath === filePath);
  if (!item) return;
  item.title = title;
  item.preview = preview;
  renderBoard(); markDirty();
});

/* =========================================================
   ТЕМА
   ========================================================= */
function applyTheme(t) {
  // Сохраняем классы режимов (канбан/календарь), чтобы не сбросить вид
  const modes = [];
  if (document.body.classList.contains('kanban-mode'))   modes.push('kanban-mode');
  if (document.body.classList.contains('calendar-mode')) modes.push('calendar-mode');

  document.body.className = ['theme-' + t, ...modes].join(' ');

  if (btnWelcomeTheme) {
    btnWelcomeTheme.textContent = t === 'dark' ? 'Перейти на светлое оформление' : 'Перейти на темное оформление';
  }
  localStorage.setItem('cl-theme', t);
}
if (btnTheme) btnTheme.onclick = () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
};
if (btnSettings) btnSettings.onclick = () => window.api.openSettings();
if (btnWelcomeTheme) btnWelcomeTheme.onclick = () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
};
if (btnSwitchBoard) btnSwitchBoard.onclick = () => showBrowseModal(currentBoardId);
if (btnSaveBoard) btnSaveBoard.onclick = () => saveBoard(true);
if (btnUndo) btnUndo.onclick = undo;
if (btnRedo) btnRedo.onclick = redo;
if (btnZoomIn) btnZoomIn.onclick = () => zoomBy(1.2);
if (btnZoomOut) btnZoomOut.onclick = () => zoomBy(1/1.2);
if (btnZoomReset) btnZoomReset.onclick = zoomReset;
if (btnFit) btnFit.onclick = fitBoard;

/* --- Переключатель режима снапа: Свободно / Сетка 50 / Магнит --- */
const btnSnapGrid = document.getElementById('btnSnapGrid');

const SNAP_MODES = ['off', 'grid', 'board'];
const SNAP_LABELS = {
  off:   { text: 'Свободно', title: 'Свободное перемещение. Нажми, чтобы включить привязку к сетке 50×50.' },
  grid:  { text: '#50',      title: 'Привязка к сетке 50×50. Нажми, чтобы включить магнит к соседним карточкам.' },
  board: { text: 'Магнит',   title: 'Магнит к соседним карточкам. Нажми, чтобы выключить привязку.' }
};

function applySnapGridUI() {
  if (!btnSnapGrid) return;
  const info = SNAP_LABELS[snapMode] || SNAP_LABELS.board;
  btnSnapGrid.textContent = info.text;
  btnSnapGrid.title = info.title;
  btnSnapGrid.classList.toggle('snap-active', snapMode !== 'off');
}

if (btnSnapGrid) {
  btnSnapGrid.onclick = () => {
    const idx = SNAP_MODES.indexOf(snapMode);
    setSnapMode(SNAP_MODES[(idx + 1) % SNAP_MODES.length]);
  };
}
applySnapGridUI();
applySnapGridUI();

/* =========================================================
   МЕНЕДЖЕР ТОМОВ
   ========================================================= */
async function openTomeManager() {
  const tomes = await window.api.listAllTomes();
  let html = '<h3>Менеджер томов</h3>';
  if (!tomes.length) {
    html += '<div class="board-empty">Томов пока нет.<br>Создай первый на доске (ПКМ → Создать том).</div>';
  } else {
    html += '<div class="tome-list">';
    for (const t of tomes) {
      const date = new Date(t.updatedAt).toLocaleString();
      const orphan = t.linkedBoards.length === 0;
      const links = t.linkedBoards.length
        ? t.linkedBoards.map(b => escapeHtml(b.name)).join(', ')
        : 'не привязан ни к одной доске';
            html += `
        <div class="tome-item${orphan ? ' orphan' : ''}" data-path="${escapeHtml(t.filePath)}">
          <div class="t-info">
            <div class="t-name">${escapeHtml(t.title)}</div>
            <div class="t-meta">${date} · ${t.chars} симв. · ${links}</div>
          </div>
          <div class="t-actions">
            <button data-act="open" title="Открыть">O</button>
            <button data-act="rename" title="Переименовать">R</button>
            <button data-act="export" title="Экспорт в .md">E</button>
            <button class="danger" data-act="delete" title="Удалить файл тома">X</button>
          </div>
        </div>`;
    }
    html += '</div>';
  }
  html += `
    <div class="modal-actions centered">
      <button class="tb-btn" id="btnCleanOrphans">Удалить пустые тома</button>
      <button class="tb-btn modal-cancel">Закрыть</button>
    </div>`;
  modal.innerHTML = html;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;
  modal.querySelector('#btnCleanOrphans').onclick = async () => {
    const list = await window.api.listAllTomes();
    const empty = list.filter(t => t.chars === 0 && t.linkedBoards.length === 0);
    if (!empty.length) { alert('Пустых и непривязанных томов нет.'); return; }
    if (!confirm(`Найдено ${empty.length} пустых непривязанных томов. Удалить?`)) return;
    for (const t of empty) await window.api.deleteTomeFile(t.filePath);
    await openTomeManager();
  };
  modal.querySelectorAll('.tome-item').forEach(el => {
    const fp = el.dataset.path;
    el.querySelectorAll('[data-act]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'open') {
          closeModal();
          await window.api.openTome({ filePath: fp });
        } else if (act === 'rename') {
          const cur = el.querySelector('.t-name').textContent;
          openPrompt('Новое название тома', cur, async (title) => {
            if (title && title.trim()) {
              await window.api.renameTomeFile({ filePath: fp, title: title.trim() });
              await openTomeManager();
            }
          });
        } else if (act === 'export') {
          const r = await window.api.exportTome(fp);
          if (r && r.ok) console.log('Экспортировано в', r.path);
          else if (r && r.error && r.error !== 'Отменено') alert('Ошибка: ' + r.error);
        } else if (act === 'delete') {
          if (!confirm('Удалить файл тома с диска? Действие необратимо.')) return;
          await window.api.deleteTomeFile(fp);
          await openTomeManager();
        }
      };
    });
  });
}
if (btnTomeManager) btnTomeManager.onclick = openTomeManager;

/* =========================================================
   ГЛОБАЛЬНЫЙ ПОИСК
   ========================================================= */
async function openGlobalSearch() {
  modal.innerHTML = `
    <h3>Поиск по всем томам</h3>
    <div class="gsearch-input-row">
      <input id="gsearchInput" type="text" placeholder="Введите текст для поиска...">
    </div>
    <div class="gsearch-results" id="gsearchResults"></div>
    <div class="modal-actions centered">
      <button class="tb-btn modal-cancel">Закрыть</button>
    </div>`;
  modalBackdrop.classList.add('show');
  modal.querySelector('.modal-cancel').onclick = closeModal;
  const input = modal.querySelector('#gsearchInput');
  const results = modal.querySelector('#gsearchResults');
  const tomes = await window.api.listAllTomes();
  function render(q) {
    const query = q.trim().toLowerCase();
    if (!query) {
      results.innerHTML = `<div class="board-empty">Введите запрос — найду во всех ${tomes.length} томах.</div>`;
      return;
    }
    const hits = [];
    for (const t of tomes) {
      const idx = t.preview.toLowerCase().indexOf(query);
      const titleHit = t.title.toLowerCase().includes(query);
      if (idx >= 0 || titleHit) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(t.preview.length, idx + query.length + 60);
        const snippet = t.preview.slice(start, end);
        hits.push({ t, snippet, idx: idx - start });
      }
    }
    if (!hits.length) { results.innerHTML = '<div class="board-empty">Ничего не найдено.</div>'; return; }
    results.innerHTML = hits.map(h => {
      const before = escapeHtml(h.snippet.slice(0, h.idx));
      const match = h.idx >= 0 ? escapeHtml(h.snippet.slice(h.idx, h.idx + query.length)) : '';
      const after = h.idx >= 0 ? escapeHtml(h.snippet.slice(h.idx + query.length)) : escapeHtml(h.snippet);
      return `
        <div class="gsearch-item" data-path="${escapeHtml(h.t.filePath)}">
          <div class="gs-title">${escapeHtml(h.t.title)}</div>
          <div class="gs-preview">...${before}<mark>${match}</mark>${after}...</div>
        </div>`;
    }).join('');
    results.querySelectorAll('.gsearch-item').forEach(el => {
      el.onclick = async () => {
        closeModal();
        await window.api.openTome({ filePath: el.dataset.path });
      };
    });
  }
  render('');
  input.addEventListener('input', () => render(input.value));
  setTimeout(() => input.focus(), 50);
}
if (btnGlobalSearch) btnGlobalSearch.onclick = openGlobalSearch;

/* =========================================================
   СПРАВКА
   ========================================================= */
function openHelp() { helpOverlay.classList.add('show'); }
function closeHelp() { helpOverlay.classList.remove('show'); }
if (btnHelp) btnHelp.onclick = openHelp;
if (btnHelpClose) btnHelpClose.onclick = closeHelp;
if (helpOverlay) helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) closeHelp();
});

/* =========================================================
   АНАЛИТИКА
   ========================================================= */
function openAnalytics() {
  if (!analyticsOverlay || !analyticsContent) return;
  analyticsContent.innerHTML = buildAnalyticsHtml();
  analyticsOverlay.classList.add('show');
}
function closeAnalytics() {
  if (analyticsOverlay) analyticsOverlay.classList.remove('show');
}

function buildAnalyticsHtml() {
  const notes      = board.items.filter(i => i.type === 'note' && !i.hidden);
  const paragraphs = board.items.filter(i => i.type === 'paragraph' && !i.hidden);
  const tomes      = board.items.filter(i => i.type === 'tome' && !i.hidden);
  const images     = board.items.filter(i => i.type === 'image' && !i.hidden);
  const links      = board.items.filter(i => i.type === 'link' && !i.hidden);
  const frames     = board.items.filter(i => i.type === 'frame');
  const hiddenCnt  = board.items.filter(i => i.hidden).length;
  const linksCnt   = (board.links || []).length;

  let html = '';

  // 1. Всего карточек
  html += '<div class="an-section"><h2>Состав доски</h2><div class="an-numbers">';
  html += `<div class="an-num-cell"><div class="an-num-value">${notes.length}</div><div class="an-num-label">Заметки</div></div>`;
  html += `<div class="an-num-cell"><div class="an-num-value">${paragraphs.length}</div><div class="an-num-label">Абзацы</div></div>`;
  html += `<div class="an-num-cell"><div class="an-num-value">${tomes.length}</div><div class="an-num-label">Тома</div></div>`;
  html += `<div class="an-num-cell"><div class="an-num-value">${images.length}</div><div class="an-num-label">Картинки</div></div>`;
  html += `<div class="an-num-cell"><div class="an-num-value">${links.length}</div><div class="an-num-label">Ссылки</div></div>`;
  html += `<div class="an-num-cell"><div class="an-num-value">${frames.length}</div><div class="an-num-label">Области</div></div>`;
  html += `<div class="an-num-cell"><div class="an-num-value">${linksCnt}</div><div class="an-num-label">Связи</div></div>`;
  html += `<div class="an-num-cell"><div class="an-num-value">${hiddenCnt}</div><div class="an-num-label">Скрытые</div></div>`;
  html += '</div></div>';

  // 2. Статусы заметок
  html += '<div class="an-section"><h2>Статусы заметок</h2>';
  if (!notes.length) {
    html += '<div class="an-empty">Заметок нет.</div>';
  } else {
    const total = notes.length;
    const maxV = total;
    for (const st of STATUSES) {
      const cnt = notes.filter(n => (n.status || 'todo') === st.id).length;
      const pct = maxV ? Math.round(cnt / maxV * 100) : 0;
      html += `
        <div class="an-row">
          <div class="an-row-label">${st.title}</div>
          <div class="an-row-bar"><div class="an-row-bar-fill status-${st.id}" style="width:${pct}%"></div></div>
          <div class="an-row-value">${cnt} / ${total}</div>
        </div>`;
    }
  }
  html += '</div>';

  // 3. Дедлайны
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

  const overdue = notes.filter(n => n.deadline && new Date(n.deadline) < today);
  const todayTasks = notes.filter(n => {
    if (!n.deadline) return false;
    const d = new Date(n.deadline);
    return d >= today && d < tomorrow;
  });
  const weekTasks = notes.filter(n => {
    if (!n.deadline) return false;
    const d = new Date(n.deadline);
    return d >= tomorrow && d < weekEnd;
  });

  html += '<div class="an-section"><h2>Дедлайны заметок</h2>';
  const dMax = Math.max(overdue.length, todayTasks.length, weekTasks.length, 1);
  html += `
    <div class="an-row">
      <div class="an-row-label">Просрочено</div>
      <div class="an-row-bar"><div class="an-row-bar-fill overdue" style="width:${Math.round(overdue.length/dMax*100)}%"></div></div>
      <div class="an-row-value">${overdue.length}</div>
    </div>
    <div class="an-row">
      <div class="an-row-label">Сегодня</div>
      <div class="an-row-bar"><div class="an-row-bar-fill soon" style="width:${Math.round(todayTasks.length/dMax*100)}%"></div></div>
      <div class="an-row-value">${todayTasks.length}</div>
    </div>
    <div class="an-row">
      <div class="an-row-label">Эта неделя</div>
      <div class="an-row-bar"><div class="an-row-bar-fill" style="width:${Math.round(weekTasks.length/dMax*100)}%"></div></div>
      <div class="an-row-value">${weekTasks.length}</div>
    </div>`;
  html += '</div>';

  // 4. Топ-5 авторов (по всем карточкам с полем author)
  const authors = {};
  board.items.forEach(i => {
    if (i.hidden || isFrame(i)) return;
    if (!i.author) return;
    authors[i.author] = (authors[i.author] || 0) + 1;
  });
  const authorList = Object.entries(authors).sort((a, b) => b[1] - a[1]).slice(0, 5);

  html += '<div class="an-section"><h2>Топ авторов</h2>';
  if (!authorList.length) {
    html += '<div class="an-empty">Ни у одной карточки не указан автор.</div>';
  } else {
    const maxA = authorList[0][1];
    for (const [name, cnt] of authorList) {
      html += `
        <div class="an-row">
          <div class="an-row-label">${escapeHtml(name)}</div>
          <div class="an-row-bar"><div class="an-row-bar-fill" style="width:${Math.round(cnt/maxA*100)}%"></div></div>
          <div class="an-row-value">${cnt}</div>
        </div>`;
    }
  }
  html += '</div>';

  // 5. Топ-5 тегов
  const tags = {};
  board.items.forEach(i => {
    if (i.hidden || isFrame(i)) return;
    if (!i.tag) return;
    tags[i.tag] = (tags[i.tag] || 0) + 1;
  });
  const tagList = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5);

  html += '<div class="an-section"><h2>Топ тегов</h2>';
  if (!tagList.length) {
    html += '<div class="an-empty">Ни у одной карточки не указан тег.</div>';
  } else {
    const maxT = tagList[0][1];
    for (const [name, cnt] of tagList) {
      html += `
        <div class="an-row">
          <div class="an-row-label">${escapeHtml(name)}</div>
          <div class="an-row-bar"><div class="an-row-bar-fill" style="width:${Math.round(cnt/maxT*100)}%"></div></div>
          <div class="an-row-value">${cnt}</div>
        </div>`;
    }
  }
  html += '</div>';

  return html;
}

if (btnAnalytics) btnAnalytics.onclick = openAnalytics;
if (btnAnalyticsClose) btnAnalyticsClose.onclick = closeAnalytics;
if (analyticsOverlay) analyticsOverlay.addEventListener('click', (e) => {
  if (e.target === analyticsOverlay) closeAnalytics();
});
/* =========================================================
   ЭКСПОРТ ДОСКИ
   ========================================================= */
if (btnExportBoard) btnExportBoard.onclick = async () => {
  if (!currentBoardId) return;
  const r = await window.api.boardExport({ id: currentBoardId, data: board });
  if (r && r.ok) console.log('Экспортировано в', r.path);
  else if (r && r.error && r.error !== 'Отменено') alert('Ошибка экспорта: ' + r.error);
};

/* =========================================================
   ЭКСПОРТ ДОСКИ В PNG
   ========================================================= */
async function exportBoardPng() {
  if (!boardEl) return;
  if (typeof htmlToImage === 'undefined') {
    alert('Библиотека html-to-image не загружена');
    return;
  }
  if (!confirm('Экспортировать всю доску в PNG? Это может занять несколько секунд.')) return;

  // Запоминаем состояние
  const savedTransform = boardEl.style.transform;
  const savedAnim = viewMode === 'kanban';

  // Готовим доску к снимку: снимаем transform и служебные выделения
  boardEl.style.transform = 'none';
  const selectedEls   = boardEl.querySelectorAll('.selected');
  const anchorEls     = boardEl.querySelectorAll('.link-anchor');
  const stackEls      = boardEl.querySelectorAll('.stack-indicator');
  const outsideEls    = boardEl.querySelectorAll('.outside-board');

  selectedEls.forEach(el => el.classList.remove('selected'));
  anchorEls.forEach(el => el.classList.remove('link-anchor'));
  stackEls.forEach(el => el.style.display = 'none');
  outsideEls.forEach(el => el.style.opacity = '');

  try {
    const dataUrl = await htmlToImage.toPng(boardEl, {
      width:  board.width,
      height: board.height,
      backgroundColor: getComputedStyle(document.body).getPropertyValue('--board-bg').trim() || '#404040',
      pixelRatio: 2,
      style: {
        transform: 'none',
        boxShadow: 'none',
        margin: '0',
        top: '0',
        left: '0'
      }
    });

    const safeName = (board.name || 'board').replace(/[\\/:*?"<>|]/g, '_');
    const r = await window.api.boardExportPng({ dataUrl, defaultName: safeName });
    if (r && r.ok) {
      console.log('PNG сохранён:', r.path);
      alert('PNG сохранён:\n' + r.path);
    } else if (r && r.error && r.error !== 'Отменено') {
      alert('Ошибка экспорта PNG: ' + r.error);
    }
  } catch (e) {
    console.error('[CheckLore] export PNG error', e);
    alert('Не удалось создать PNG: ' + e.message);
  } finally {
    // Возвращаем всё как было
    boardEl.style.transform = savedTransform;
    stackEls.forEach(el => el.style.display = '');
    updateSelectionClasses();
    updateStackIndicators();
    applyTransform();
  }
}

if (btnExportPng) btnExportPng.onclick = exportBoardPng;

/* =========================================================
   ПРИВЕТСТВИЕ / ЗАГРУЗКА
   ========================================================= */
function showWelcome() {
  welcomeOverlay.style.display = 'flex';
  welcomeOverlay.classList.remove('hidden');
}
function hideWelcome() {
  welcomeOverlay.classList.add('hidden');
  setTimeout(() => { welcomeOverlay.style.display = 'none'; }, 320);
}
async function openBoardById(id) {
  const res = await window.api.boardLoad({ id });
  if (!res) return false;
  board = res.data;
  if (!Array.isArray(board.links)) board.links = [];
  currentBoardId = id;
  isDirty = false;
  selectedIds.clear();
  searchQuery = ''; searchMatches = []; searchIndex = -1;
  if (searchBar) searchBar.classList.remove('show');
  if (searchInput) searchInput.value = '';
  if (filterType) { filterType.value = ''; filterTag.value = ''; filterAuthor.value = ''; filterDeadline.value = ''; }
  activeFilters.type = activeFilters.tag = activeFilters.author = activeFilters.deadline = '';
  if (filterBar) filterBar.classList.remove('show');
  window.api.boardSetTitle('CheckLore — ' + (board.name || 'Доска'));
  renderBoard();
  resetHistory();
  requestAnimationFrame(() => fitBoard());
  hideWelcome();
  return true;
}

function showCreateBoardForm(onCancel) {
  modal.innerHTML = `
    <h3>Новая доска</h3>
    <label>Название<input name="name" placeholder="Например: Проект X" value="Новая доска"></label>
    <div class="modal-actions centered">
      <button class="tb-btn modal-cancel">Отмена</button>
      <button class="tb-btn accent modal-ok">Создать</button>
    </div>`;
  modalBackdrop.classList.add('show');
  const first = modal.querySelector('input');
  if (first) { first.focus(); first.select(); }
  modal.querySelector('.modal-cancel').onclick = () => {
    if (typeof onCancel === 'function') onCancel(); else closeModal();
  };
  modal.querySelector('.modal-ok').onclick = async () => {
    const name = modal.querySelector('[name=name]').value.trim() || 'Новая доска';
    const res = await window.api.boardCreate({ name });
    if (!res) return;
    closeModal();
    await openBoardById(res.id);
  };
}
btnCreateBoard.onclick = () => showCreateBoardForm();
async function showBrowseModal(currentId = null) {
  const boards = await window.api.boardList();
  let html = '<h3>Обзор досок</h3>';
  if (!boards.length) {
    html += '<div class="board-empty">Сохранённых досок пока нет.<br>Создай первую!</div>';
  } else {
    html += '<div class="board-list">';
    boards.forEach(b => {
      const date = new Date(b.updatedAt).toLocaleString();
      const isCurrent = currentId && b.id === currentId;
      html += `
        <div class="board-item${isCurrent ? ' current' : ''}" data-id="${b.id}">
          <div class="info">
            <div class="name">${escapeHtml(b.name)}</div>
            <div class="meta">${date} · ${b.itemsCount} карточек</div>
          </div>
          <button class="ren" title="Переименовать доску">✎</button>
          ${isCurrent ? '' : '<button class="del" title="Удалить доску">✕</button>'}
        </div>`;
    });
    html += '</div>';
  }
  html += `
    <div class="modal-actions centered">
      <button class="tb-btn accent" id="btnNewBoardFromBrowse">Создать доску</button>
      <button class="tb-btn" id="btnImportBoard">Открыть из…</button>
      <button class="tb-btn" id="btnBackFromBrowse">Назад</button>
    </div>`;
  modal.innerHTML = html;
  modalBackdrop.classList.add('show');
  modal.querySelector('#btnBackFromBrowse').onclick = () => closeModal();
  modal.querySelector('#btnImportBoard').onclick = async () => {
    const res = await window.api.boardImport();
    if (!res) return;
    if (res.error) { alert(res.error); return; }
    closeModal();
    await openBoardById(res.id);
  };
  modal.querySelector('#btnNewBoardFromBrowse').onclick = () => {
    showCreateBoardForm(() => showBrowseModal(currentBoardId));
  };
  modal.querySelectorAll('.board-item').forEach(el => {
    const isCurrent = el.classList.contains('current');
    el.addEventListener('click', async (ev) => {
      if (ev.target.classList.contains('ren')) {
        ev.stopPropagation();
        const id = el.dataset.id;
        const cur = el.querySelector('.name').textContent;
        openPrompt('Новое название доски', cur, async (name) => {
          if (!name || !name.trim()) return;
          await window.api.boardRename({ id, name: name.trim() });
          if (id === currentBoardId) {
            board.name = name.trim();
            window.api.boardSetTitle('CheckLore — ' + name.trim());
            renderBoard();
          }
          await showBrowseModal(currentBoardId);
        });
        return;
      }
      if (isCurrent) return;
      if (ev.target.classList.contains('del')) {
        ev.stopPropagation();
        showDeleteConfirm(el.dataset.id);
        return;
      }
      closeModal();
      await openBoardById(el.dataset.id);
    });
  });
}

async function showDeleteConfirm(id) {
  const boards = await window.api.boardList();
  const target = boards.find(b => b.id === id);
  const name = target ? target.name : 'эту доску';
  modal.innerHTML = `
    <div class="confirm-modal">
      <h3>Вы уверены, что хотите удалить доску?<br>
        <span style="color:var(--text-dim);font-weight:400;font-size:12px;">«${escapeHtml(name)}»</span>
      </h3>
      <div class="modal-actions">
        <button class="tb-btn danger" id="btnConfirmDelete">Да, удалить</button>
        <button class="tb-btn" id="btnCancelDelete">Нет, не удалять</button>
      </div>
    </div>`;
  modalBackdrop.classList.add('show');
  modal.querySelector('#btnConfirmDelete').onclick = async () => {
    await window.api.boardDelete({ id });
    await showBrowseModal();
  };
  modal.querySelector('#btnCancelDelete').onclick = () => showBrowseModal();
}
btnBrowseBoards.onclick = () => showBrowseModal();
btnResumeLast.onclick = async () => {
  const st = await window.api.stateGet();
  if (st.lastBoardId) {
    const ok = await openBoardById(st.lastBoardId);
    if (!ok) alert('Не удалось открыть последнюю доску — возможно, файл удалён.');
  }
};

/* =========================================================
   ГОРЯЧИЕ КЛАВИШИ
   ========================================================= */
document.addEventListener('keydown', (e) => {
  const t = e.target;
  const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  const mod = e.ctrlKey || e.metaKey;

  if (e.key === 'F1') { e.preventDefault(); openHelp(); return; }
  if (e.key === 'Escape') {
    if (tutorialOverlay && tutorialOverlay.classList.contains('show')) { closeTutorial(); return; }
    if (helpOverlay.classList.contains('show')) { closeHelp(); return; }
    if (searchBar.classList.contains('show')) { closeSearch(); return; }
    hideMenu();
    clearSelection();
    return;
  }
  if (inField) return;

  if (mod && e.shiftKey && e.code === 'KeyF') { e.preventDefault(); openGlobalSearch(); return; }
  if (mod && e.code === 'KeyF') { e.preventDefault(); openSearch(); return; }
  if (mod && e.code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (mod && e.code === 'KeyA') { e.preventDefault(); selectAll(); return; }
  if (mod && e.code === 'KeyD') { e.preventDefault(); duplicateSelection(); return; }
  if (mod && e.code === 'KeyC') { e.preventDefault(); copySelection(); return; }
  if (mod && e.code === 'KeyV') { e.preventDefault(); pasteClipboard(); return; }
  if (mod && e.code === 'KeyS') { if (currentBoardId) { e.preventDefault(); saveBoard(true); } return; }
  if (mod && e.code === 'Digit0') { e.preventDefault(); zoomReset(); return; }
  if (mod && e.code === 'Digit1') { e.preventDefault(); fitBoard(); return; }
  if (mod && (e.code === 'Equal' || e.code === 'NumpadAdd')) { e.preventDefault(); zoomBy(1.2); return; }
  if (mod && (e.code === 'Minus' || e.code === 'NumpadSubtract')) { e.preventDefault(); zoomBy(1/1.2); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedIds.size) { e.preventDefault(); deleteSelection(); }
    return;
  }

  // Инструменты
  const toolMap = {
    'KeyV': 'select', 'KeyH': 'pan', 'KeyZ': 'zoom',
    'KeyN': 'note', 'KeyP': 'paragraph', 'KeyB': 'tome',
    'KeyI': 'image', 'KeyL': 'link', 'KeyR': 'frame'
  };
  if (!mod && toolMap[e.code]) {
    e.preventDefault();
    setActiveTool(toolMap[e.code]);
  }
}, true);

/* =========================================================
   ЗАКРЫТИЕ
   ========================================================= */
window.api.onBeforeClose(async () => {
  if (!currentBoardId || !isDirty) { window.api.confirmClose(); return; }
  const choice = await window.api.askSaveChanges();
  if (choice === 0) { await saveBoard(false); window.api.confirmClose(); }
  else if (choice === 1) { window.api.confirmClose(); }
});

/* =========================================================
   СТАРТ
   ========================================================= */
(async function init() {
  try {
    applyTheme(currentTheme);
    renderBoard();
    resetHistory();
    const settings = await window.api.loadSettings();
    appSettings = settings || appSettings;
    applyLinkColor(settings.linkColor);
    const st = await window.api.stateGet();
    btnResumeLast.disabled = !st.lastBoardId;
    if (settings.welcomeScreen === 'last' && st.lastBoardId) {
      const ok = await openBoardById(st.lastBoardId);
      if (!ok) showWelcome();
    } else {
      showWelcome();
    }
  } catch (e) {
    console.error('[CheckLore] init error', e);
    showWelcome();
  }
})();
/* =========================================================
   УПРАВЛЕНИЕ ОКНОМ (frameless)
   ========================================================= */
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
/* =========================================================
   ЛОГИКА МЕНЮ
   ========================================================= */
(function initMenubar() {
  const menubar = document.getElementById('menubar');
  if (!menubar) return;

  const items = menubar.querySelectorAll('.menu-item');

  function closeAllMenus() {
    items.forEach(it => it.classList.remove('open'));
  }

  items.forEach(item => {
    const label = item.querySelector('.menu-label');
    if (!label) return;

    // Клик по заголовку меню — открыть/закрыть
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = item.classList.contains('open');
      closeAllMenus();
      if (!wasOpen) item.classList.add('open');
    });

    // Наведение — переключить открытое меню, если уже что-то открыто
    item.addEventListener('mouseenter', () => {
      const anyOpen = Array.from(items).some(it => it.classList.contains('open'));
      if (anyOpen) {
        closeAllMenus();
        item.classList.add('open');
      }
    });
  });

  // Клик вне меню — закрыть
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menubar')) closeAllMenus();
  });

  // Esc — закрыть
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllMenus();
  });

  // Обработка клика по пунктам меню
  menubar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.dataset.action;
    closeAllMenus();

    switch (action) {
      /* ---------- Файл ---------- */
      case 'save':           if (currentBoardId) saveBoard(true); break;
      case 'export-board':   if (btnExportBoard) btnExportBoard.click(); break;
      case 'export-png':     if (typeof exportBoardPng === 'function') exportBoardPng(); break;
      case 'tome-manager':   if (typeof openTomeManager === 'function') openTomeManager(); break;
      case 'browse-boards':  if (typeof showBrowseModal === 'function') showBrowseModal(currentBoardId); break;
      case 'settings':       window.api.openSettings(); break;
      case 'quit':           window.api.windowClose(); break;

      /* ---------- Правка ---------- */
      case 'undo':           if (typeof undo === 'function') undo(); break;
      case 'redo':           if (typeof redo === 'function') redo(); break;
      case 'copy':           if (typeof copySelection === 'function') copySelection(); break;
      case 'paste':          if (typeof pasteClipboard === 'function') pasteClipboard(); break;
      case 'duplicate':      if (typeof duplicateSelection === 'function') duplicateSelection(); break;
      case 'select-all':     if (typeof selectAll === 'function') selectAll(); break;
      case 'delete':         if (typeof deleteSelection === 'function') deleteSelection(); break;

      /* ---------- Вид ---------- */
      case 'zoom-in':        zoomBy(1.2); break;
      case 'zoom-out':       zoomBy(1 / 1.2); break;
      case 'zoom-100':       zoomReset(); break;
      case 'fit':            fitBoard(); break;
      case 'view-board':     if (typeof setViewMode === 'function') setViewMode('board'); break;
      case 'view-kanban':    if (typeof setViewMode === 'function') setViewMode('kanban'); break;
      case 'view-calendar':  if (typeof setViewMode === 'function') setViewMode('calendar'); break;
      case 'snap-off':       setSnapMode('off'); break;
      case 'snap-grid':      setSnapMode('grid'); break;
      case 'snap-board':     setSnapMode('board'); break;
      case 'toggle-theme':
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
        break;

      /* ---------- Окно ---------- */
      case 'win-minimize':   window.api.windowMinimize(); break;
      case 'win-maximize':   window.api.windowToggleMaximize(); break;
      case 'win-close':      window.api.windowClose(); break;

      /* ---------- Справка ---------- */
      case 'help':           if (typeof openHelp === 'function') openHelp(); break;
      case 'tutorial':       openTutorial(); break;
      case 'analytics':      if (typeof openAnalytics === 'function') openAnalytics(); break;
      case 'about':          showAboutDialog(); break;

      /* ---------- Создание карточек из меню ---------- */
      case 'new-note':       createCardFromMenu('note'); break;
      case 'new-paragraph':  createCardFromMenu('paragraph'); break;
      case 'new-tome':       createCardFromMenu('tome'); break;
      case 'new-link':       createCardFromMenu('link'); break;
      case 'new-image':      createCardFromMenu('image'); break;
    }
  });
})();

/* =========================================================
   TOAST-УВЕДОМЛЕНИЯ
   ========================================================= */
let toastContainerEl = null;

function ensureToastContainer() {
  if (toastContainerEl && document.body.contains(toastContainerEl)) return toastContainerEl;
  toastContainerEl = document.createElement('div');
  toastContainerEl.className = 'toast-container';
  document.body.appendChild(toastContainerEl);
  return toastContainerEl;
}

function showToast(type, title, body, errorCode) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;

  const titleEl = document.createElement('div');
  titleEl.className = 'toast-title';
  titleEl.textContent = title;
  toast.appendChild(titleEl);

  if (body) {
    const bodyEl = document.createElement('div');
    bodyEl.className = 'toast-body';
    bodyEl.textContent = body;
    toast.appendChild(bodyEl);
  }

  if (errorCode) {
    const codeEl = document.createElement('div');
    codeEl.className = 'toast-code';
    codeEl.textContent = 'Код: ' + errorCode;
    toast.appendChild(codeEl);
  }

  // Кнопка закрытия — только для ошибок
  let closeBtn = null;
  if (type === 'error') {
    closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Закрыть';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast(toast);
    });
    toast.appendChild(closeBtn);
  }

  container.appendChild(toast);

  // Автозакрытие: успех — 3 сек, ошибка — 15 сек
  const ttl = type === 'error' ? 15000 : 3000;
  const timer = setTimeout(() => dismissToast(toast), ttl);

  // Если тост убрали вручную — снять таймер
  toast._dismissTimer = timer;
  toast._dismiss = () => dismissToast(toast);

  return toast;
}

function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;
  clearTimeout(toast._dismissTimer);
  toast.classList.add('closing');
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 260);
}

/* ---------- Функция setSnapMode (для меню и кнопки) ---------- */
function setSnapMode(mode) {
  if (!['off', 'grid', 'board'].includes(mode)) return;
  snapMode = mode;
  localStorage.setItem('cl-snap-mode', snapMode);
  if (typeof applySnapGridUI === 'function') applySnapGridUI();
}

/* ---------- О программе ---------- */
function showAboutDialog() {
  openModal(`
    <h3>О программе CheckLore</h3>
    <div style="line-height:1.7;font-size:13px;">
      <p style="margin:0 0 10px;"><b>CheckLore</b> — версия 1.0</p>
      <p style="margin:0 0 10px;color:var(--text-dim);">
        Визуальная доска и текстовый редактор для инди-команд.
        Открытый исходный код, лицензия MIT.
      </p>
      <p style="margin:0 0 10px;color:var(--text-dim);">
        Powered by Electron ${typeof process !== 'undefined' && process.versions ? process.versions.electron : ''}
      </p>
      <p style="margin:0;color:var(--text-faint);font-size:11px;">
        © ${new Date().getFullYear()} CheckLore Team
      </p>
    </div>
  `, () => {});
}
/* =========================================================
   ГОРИЗОНТАЛЬНАЯ ПРОКРУТКА КАНБАНА КОЛЕСОМ
   ========================================================= */
(function initKanbanWheel() {
  const el = document.getElementById('kanbanView');
  if (!el) return;
  el.addEventListener('wheel', (e) => {
    if (e.deltaY === 0) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    // Если курсор над колонкой и у неё есть что скроллить по вертикали — пусть скроллит сама
    const body = e.target.closest('.kanban-column-body');
    if (body && body.scrollHeight > body.clientHeight + 2) {
      return;   // не перехватываем, даём браузеру прокрутить колонку
    }

    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, { passive: false });
})();
/* =========================================================
   КНОПКИ ОКНА В ПРИВЕТСТВИИ
   ========================================================= */
(function initWelcomeWindowControls() {
  const wMin = document.getElementById('welcomeMinimize');
  const wMax = document.getElementById('welcomeMaximize');
  const wCls = document.getElementById('welcomeClose');
  if (wMin) wMin.onclick = () => window.api.windowMinimize();
  if (wMax) wMax.onclick = () => window.api.windowToggleMaximize();
  if (wCls) wCls.onclick = () => window.api.windowClose();

  if (window.api.onMaximizedChanged) {
    window.api.onMaximizedChanged((isMax) => {
      if (wMax) {
        wMax.textContent = isMax ? '❐' : '□';
        wMax.title = isMax ? 'Свернуть в окно' : 'Развернуть';
      }
    });
  }
})();
/* =========================================================
   ПОДРОБНЫЙ ТУТОРИАЛ
   ========================================================= */
const tutorialOverlay  = document.getElementById('tutorialOverlay');
const btnTutorialClose = document.getElementById('btnTutorialClose');
const btnHelpDetailed  = document.getElementById('btnHelpDetailed');

function openTutorial() {
  if (!tutorialOverlay) return;
  if (helpOverlay) helpOverlay.classList.remove('show');
  tutorialOverlay.classList.add('show');
}

function closeTutorial() {
  if (tutorialOverlay) tutorialOverlay.classList.remove('show');
}

if (btnHelpDetailed)  btnHelpDetailed.onclick  = openTutorial;
if (btnTutorialClose) btnTutorialClose.onclick = closeTutorial;
if (tutorialOverlay)  tutorialOverlay.addEventListener('click', (e) => {
  if (e.target === tutorialOverlay) closeTutorial();
});