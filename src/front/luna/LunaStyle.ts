import { LUNA_FONT_STACK } from './LunaFont'

// A small SVG drawn here, as a CSS image.
const svg = (body: string, size: number): string =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`)}")`

// The grip in the middle of a scroll bar's thumb: four ridges, a light line over a blue one.
const GRIP_V = svg([0, 2, 4, 6].map(y => `<rect x='0' y='${y}' width='8' height='1' fill='#eef4fe'/><rect x='0' y='${y + 1}' width='8' height='1' fill='#8cb0f8'/>`).join(''), 8)
const GRIP_H = svg([0, 2, 4, 6].map(x => `<rect x='${x}' y='0' width='1' height='8' fill='#eef4fe'/><rect x='${x + 1}' y='0' width='1' height='8' fill='#8cb0f8'/>`).join(''), 8)

// The arrows on the scroll bar's buttons.
const arrow = (points: string): string => svg(`<polygon points='${points}' fill='#4d6185'/>`, 9)
const ARROW_UP = arrow('4.5,2 8,6 1,6')
const ARROW_DOWN = arrow('1,3 8,3 4.5,7')
const ARROW_LEFT = arrow('2,4.5 6,1 6,8')
const ARROW_RIGHT = arrow('3,1 7,4.5 3,8')

// The size grip at the bottom right of a resizable window: six raised dots in a triangle.
const SIZE_GRIP = svg([[9, 1], [5, 5], [9, 5], [1, 9], [5, 9], [9, 9]]
    .map(([x, y]) => `<rect x='${x + 1}' y='${y + 1}' width='2' height='2' fill='#fff'/><rect x='${x}' y='${y}' width='2' height='2' fill='#b5b19f'/>`).join(''), 12)

/*
    The look of XP's default theme (Luna, blue), drawn from scratch in CSS: no image of Microsoft's is used. Every
    class is prefixed 'tl-' and lives under '.tl-root', so nothing leaks into Kwirth or comes in from its theme.
*/
const CSS = `
.tl-root { font-family: ${LUNA_FONT_STACK}; font-size: 11px; color: #000; user-select: none; -webkit-font-smoothing: none;
    position: relative; width: 100%; height: 100%; box-sizing: border-box; background: #3a6ea5; overflow: hidden; }
.tl-root * { box-sizing: border-box; }
.tl-root:focus { outline: none; }

/* the window */
.tl-window { position: absolute; display: flex; flex-direction: column; background: #ece9d8;
    border: 1px solid #0831d9; border-top: none; border-radius: 8px 8px 0 0; box-shadow: 2px 2px 8px rgba(0,0,0,.45); }
.tl-window.tl-max { border-radius: 0; box-shadow: none; }
.tl-frame { flex: 1; display: flex; flex-direction: column; min-height: 0; border-left: 3px solid #0054e3; border-right: 3px solid #0054e3; border-bottom: 3px solid #0054e3; }
.tl-title { height: 30px; flex: 0 0 auto; display: flex; align-items: center; padding: 0 5px 0 6px; border-radius: 7px 7px 0 0;
    background: linear-gradient(to bottom, #0997ff 0%, #0053ee 8%, #0050ee 40%, #0066ff 88%, #0066ff 93%, #005bff 95%, #003dd7 96%, #003dd7 100%);
    color: #fff; font-weight: 700; font-size: 13px; text-shadow: 1px 1px #0f1089; }
.tl-max .tl-title { border-radius: 0; }
.tl-title-icon { width: 16px; height: 16px; margin-right: 5px; flex: 0 0 auto; }
.tl-title-text { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tl-caption { width: 21px; height: 21px; margin-left: 2px; border: 1px solid #fff; border-radius: 3px; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 90% 90%, #0054e9 0%, #2263d5 55%, #4479e4 70%, #a3bbec 90%, #fff 100%); }
.tl-caption:hover { filter: brightness(1.15); }
.tl-caption:active { filter: brightness(0.85); }
.tl-caption.tl-close { background: radial-gradient(circle at 90% 90%, #cc4600 0%, #dc6527 55%, #cd7546 70%, #ffccb2 90%, #fff 100%); }
.tl-caption svg { width: 13px; height: 13px; }
/* a window that is not in front: XP's paler title bar */
.tl-window.tl-inactive .tl-title { background: linear-gradient(to bottom, #7697e7 0%, #7e9ee3 8%, #94afe8 40%, #97b4e9 88%, #82a5e4 95%, #7c9fe2 100%); color: #d8e4f8; text-shadow: none; }
.tl-window.tl-inactive { border-color: #6f8ee8; }
.tl-window.tl-inactive .tl-frame { border-color: #7a9be8; }
.tl-window.tl-inactive .tl-caption { filter: saturate(.55) brightness(1.1); }
.tl-caption.tl-disabled { filter: grayscale(.45) opacity(.55); }
.tl-caption.tl-disabled:hover, .tl-caption.tl-disabled:active { filter: grayscale(.45) opacity(.55); }
.tl-title { cursor: default; }

/* tiny footprint: only the panel's content is left, in the window's frame */
.tl-compact .tl-title, .tl-compact .tl-menubar, .tl-compact .tl-tabs, .tl-compact .tl-status { display: none; }
.tl-compact { border-top: 1px solid #0831d9; border-radius: 0; }
.tl-compact .tl-frame { border-top: 3px solid #0054e3; }
.tl-compact .tl-body { padding: 0; }
.tl-compact .tl-tabpanel { border: none; padding: 4px; }
.tl-compact .tl-buttons, .tl-compact .tl-perf-totals { display: none; }

/* the desktop and XP's taskbar */
.tl-desktop { position: absolute; left: 0; top: 0; right: 0; }
.tl-taskbar { position: absolute; left: 0; right: 0; bottom: 0; height: 30px; display: flex; align-items: center; z-index: 40;
    background: linear-gradient(to bottom, #3168d5 0%, #4993e6 3%, #2157d7 6%, #2663e0 10%, #245edb 50%, #1941a5 92%, #1941a5 100%); }
.tl-taskbar .tl-menu { position: absolute; }
.tl-start { height: 30px; display: flex; align-items: center; gap: 4px; padding: 0 22px 0 8px; border-radius: 0 10px 10px 0; cursor: default;
    background: linear-gradient(to bottom, #3c8f3c 0%, #6fbf5c 10%, #4ba443 30%, #388e34 70%, #2c7a2b 90%, #1f5f20 100%);
    box-shadow: inset -1px -1px 2px rgba(0,0,0,.35), 2px 0 3px rgba(0,0,0,.35); }
.tl-start:hover { filter: brightness(1.08); }
.tl-start.tl-pressed { background: linear-gradient(to bottom, #1f5f20 0%, #2c7a2b 30%, #388e34 80%, #3c8f3c 100%); }
.tl-start-logo { width: 22px; height: 22px; filter: drop-shadow(1px 1px 1px rgba(0,0,0,.45)); }
.tl-start-text { color: #fff; font-size: 19px; font-weight: 700; font-style: italic; text-shadow: 1px 1px 2px #1a3e12; padding-bottom: 2px; }
.tl-tasks { flex: 1; min-width: 0; display: flex; gap: 3px; padding: 0 8px; }
.tl-task { width: 160px; height: 24px; display: flex; align-items: center; gap: 5px; padding: 0 8px; border-radius: 3px; color: #fff; cursor: default;
    background: linear-gradient(to bottom, #3c81f3 0%, #3a7ef0 80%, #2b67d5 100%); border: 1px solid #1e4fb1; box-shadow: inset 1px 1px 0 rgba(255,255,255,.3); }
.tl-task:hover { background: linear-gradient(to bottom, #5a98f6 0%, #4f8ff4 80%, #3d78e0 100%); }
.tl-task.tl-active { background: #1e52b7; box-shadow: inset 1px 1px 2px rgba(0,0,0,.5); }
.tl-task .tl-title-icon { margin-right: 0; }
.tl-task-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tl-tray { height: 30px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 14px; color: #fff; border-left: 1px solid #092e51;
    background: linear-gradient(to bottom, #0c59b9 0%, #139ee9 5%, #18b5f2 10%, #139beb 15%, #1290e8 50%, #0d8dea 90%, #0c59b9 100%);
    box-shadow: inset 1px 0 1px #1a9cf3; }
.tl-tray-icon { width: 16px; height: 16px; display: block; }
.tl-clock { white-space: nowrap; }

/* the window is resized by its edges and corners, which only change the pointer, as XP's */
.tl-resize { position: absolute; z-index: 5; }
.tl-resize-n { top: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
.tl-resize-s { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
.tl-resize-e { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
.tl-resize-w { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
.tl-resize-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
.tl-resize-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
.tl-resize-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
.tl-resize-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }

/* the menu bar and its menus */
.tl-menubar { display: flex; height: 20px; flex: 0 0 auto; background: #ece9d8; padding-left: 1px; }
.tl-menubar-item { padding: 0 6px; line-height: 19px; cursor: default; }
.tl-menubar-item.tl-open, .tl-menubar-item:hover { background: #316ac5; color: #fff; }
.tl-menu { position: absolute; z-index: 50; color: #000; font-weight: 400; background: #fff; border: 1px solid #aca899; box-shadow: 2px 2px 3px rgba(0,0,0,.3); padding: 2px 0; min-width: 150px; }
.tl-menu-item { position: relative; display: flex; align-items: center; height: 18px; padding: 0 18px 0 20px; white-space: nowrap; cursor: default; }
.tl-menu-item:hover:not(.tl-disabled), .tl-menu-item.tl-open { background: #316ac5; color: #fff; }
.tl-menu-item.tl-disabled { color: #aca899; }
.tl-menu-item.tl-default { font-weight: 700; }
.tl-menu-check { position: absolute; left: 6px; top: 4px; width: 10px; height: 10px; }
.tl-menu-arrow { position: absolute; right: 6px; top: 5px; width: 0; height: 0; border-top: 4px solid transparent; border-bottom: 4px solid transparent; border-left: 4px solid currentColor; }
.tl-menu-sep { height: 1px; background: #aca899; margin: 3px 1px; }

/* the tabs */
.tl-body { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 6px 7px 0 7px; }
.tl-tabs { display: flex; padding-left: 2px; position: relative; z-index: 1; height: 21px; flex: 0 0 auto; }
.tl-tab { height: 20px; margin-top: 1px; padding: 2px 6px 0 6px; margin-right: -1px; border: 1px solid #919b9c; border-bottom: none; border-radius: 3px 3px 0 0;
    background: linear-gradient(to bottom, #fff 0%, #ecebe5 100%); cursor: default; white-space: nowrap; }
.tl-tab:hover { border-top: 2px solid #ffc83c; padding-top: 1px; }
.tl-tab.tl-selected { height: 22px; margin-top: -1px; padding-top: 3px; border-top: 3px solid #ffc83c; background: #fcfcfe; z-index: 2; position: relative; margin-left: -2px; margin-right: -2px; padding-left: 8px; padding-right: 8px; }
.tl-tabpanel { flex: 1; min-height: 0; border: 1px solid #919b9c; background: linear-gradient(to bottom, #fcfcfe 0%, #f4f3ee 100%); display: flex; flex-direction: column; padding: 8px 9px; }

/* the status bar */
.tl-status { display: flex; height: 22px; flex: 0 0 auto; padding: 3px 2px 2px 2px; gap: 2px; background: #ece9d8; }
.tl-status-panel { border: 1px solid; border-color: #aca899 #fff #fff #aca899; padding: 0 4px; line-height: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* buttons, checkboxes, group boxes */
.tl-button { min-width: 75px; height: 23px; padding: 0 8px; border: 1px solid #003c74; border-radius: 3px; font: inherit; color: #000;
    background: linear-gradient(to bottom, #fff 0%, #f3f3ef 70%, #e3e2dc 90%, #d6d0c5 100%); cursor: default; }
.tl-button:hover:not(:disabled) { box-shadow: inset 0 -2px #f8b330, inset 0 2px #fce7c2, inset 2px 0 #f8b330, inset -2px 0 #f8b330; }
.tl-button:active:not(:disabled) { background: linear-gradient(to bottom, #e5e4de 0%, #e3e2db 80%, #f2f1ee 100%); }
.tl-button:focus { outline: 1px dotted #000; outline-offset: -4px; }
.tl-button:disabled { color: #aca899; border-color: #c9c7ba; background: #f5f4ea; }
.tl-buttons { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; flex: 0 0 auto; }
.tl-check { display: inline-flex; align-items: center; gap: 5px; cursor: default; }
.tl-check-box { width: 13px; height: 13px; border: 1px solid #1c5180; background: linear-gradient(135deg, #dcdcd7 0%, #fff 100%); display: flex; align-items: center; justify-content: center; }
.tl-check-box svg { width: 9px; height: 9px; }
.tl-check.tl-disabled { color: #aca899; }
.tl-check.tl-disabled .tl-check-box { border-color: #cac8bb; background: #fff; }
.tl-group { position: relative; border: 1px solid #d0d0bf; border-radius: 3px; padding: 10px 6px 5px 6px; margin-top: 6px; }
.tl-group-label { position: absolute; top: -7px; left: 6px; padding: 0 2px; color: #0046d5; background: #f8f8f4; }
.tl-field { display: flex; justify-content: space-between; gap: 6px; line-height: 14px; }
.tl-input { height: 21px; border: 1px solid #7f9db9; padding: 2px 3px; font: inherit; background: #fff; color: #000; }
.tl-input:focus { outline: none; }

/* the list view */
.tl-list { flex: 1; min-height: 0; border: 1px solid #7f9db9; background: #fff; overflow: auto; position: relative; }
.tl-list:focus { outline: none; }
.tl-list-table { border-collapse: separate; border-spacing: 0; table-layout: fixed; }
.tl-list-head th { position: sticky; top: 0; z-index: 1; height: 18px; padding: 0 5px; text-align: left; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    background: linear-gradient(to bottom, #fff 0%, #f2f2ee 70%, #ebeadb 100%); border-bottom: 3px solid #e2decd; box-shadow: inset -1px 0 #ccc8b6, inset -2px 0 #fff; cursor: default; }
.tl-list-head th:hover { border-bottom-color: #f9b119; }
.tl-list-head th.tl-right { text-align: right; }
.tl-list-head th.tl-filler { box-shadow: none; }
.tl-resizer { position: absolute; right: 0; top: 0; width: 6px; height: 100%; cursor: col-resize; }
.tl-list-row td { height: 16px; padding: 0 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-list-row td.tl-right { text-align: right; }
.tl-list-row.tl-selected td { background: #ece9d8; }
.tl-list:focus .tl-list-row.tl-selected td, .tl-list:focus-within .tl-list-row.tl-selected td { background: #316ac5; color: #fff; }
.tl-cell-icon { display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; }
.tl-cell-icon svg { width: 16px; height: 16px; flex: 0 0 auto; }

/* scroll bars, as XP drew them */
.tl-root ::-webkit-scrollbar { width: 17px; height: 17px; }
.tl-root ::-webkit-scrollbar-track { background: #fdfdfa; border-left: 1px solid #eeede5; }
.tl-root ::-webkit-scrollbar-thumb { border: 1px solid #fff; border-radius: 3px; box-shadow: inset 0 0 0 1px #9eb6e8; }
.tl-root ::-webkit-scrollbar-thumb:vertical { background: ${GRIP_V} center / 8px 8px no-repeat, linear-gradient(to right, #c9d8fc 0%, #bbcefb 50%, #b4c8f6 100%); min-height: 24px; }
.tl-root ::-webkit-scrollbar-thumb:horizontal { background: ${GRIP_H} center / 8px 8px no-repeat, linear-gradient(to bottom, #c9d8fc 0%, #bbcefb 50%, #b4c8f6 100%); min-width: 24px; }
.tl-root ::-webkit-scrollbar-thumb:hover { box-shadow: inset 0 0 0 1px #7da2ce; }
.tl-root ::-webkit-scrollbar-button:single-button { display: block; width: 17px; height: 17px; border: 1px solid #fff; border-radius: 3px; box-shadow: inset 0 0 0 1px #9eb6e8; }
.tl-root ::-webkit-scrollbar-button:single-button:vertical:decrement { background: ${ARROW_UP} center / 9px 9px no-repeat, linear-gradient(to right, #c9d8fc 0%, #bbcefb 50%, #b4c8f6 100%); }
.tl-root ::-webkit-scrollbar-button:single-button:vertical:increment { background: ${ARROW_DOWN} center / 9px 9px no-repeat, linear-gradient(to right, #c9d8fc 0%, #bbcefb 50%, #b4c8f6 100%); }
.tl-root ::-webkit-scrollbar-button:single-button:horizontal:decrement { background: ${ARROW_LEFT} center / 9px 9px no-repeat, linear-gradient(to bottom, #c9d8fc 0%, #bbcefb 50%, #b4c8f6 100%); }
.tl-root ::-webkit-scrollbar-button:single-button:horizontal:increment { background: ${ARROW_RIGHT} center / 9px 9px no-repeat, linear-gradient(to bottom, #c9d8fc 0%, #bbcefb 50%, #b4c8f6 100%); }
.tl-root ::-webkit-scrollbar-button:single-button:active { box-shadow: inset 0 0 0 1px #7da2ce; filter: brightness(.92); }
.tl-root ::-webkit-scrollbar-corner { background: #ece9d8; }

/* the size grip at the bottom right of the status bar, while the window can be resized */
.tl-grip { width: 12px; height: 12px; align-self: flex-end; flex: 0 0 auto; margin: 0 1px 1px 0; background: ${SIZE_GRIP} no-repeat; cursor: nwse-resize; }

/* performance: the meters and graphs */
.tl-perf { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.tl-perf-row { display: flex; gap: 8px; min-height: 0; }
.tl-perf-row.tl-grow { flex: 1; }
.tl-perf-meter { width: 82px; flex: 0 0 auto; display: flex; flex-direction: column; }
.tl-perf-history { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.tl-perf-row .tl-group { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.tl-screen { flex: 1; min-height: 40px; background: #000; border: 1px solid; border-color: #aca899 #fff #fff #aca899; position: relative; overflow: hidden; }
.tl-screen canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.tl-meter-text { position: absolute; left: 0; right: 0; bottom: 4px; text-align: center; color: #00ff00; font-size: 11px; }
.tl-perf-totals { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; flex: 0 0 auto; }
.tl-graphs { flex: 1; min-height: 0; display: grid; gap: 4px; }
.tl-graph-label { color: #0046d5; padding: 1px 0 2px 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tl-graph-cell { display: flex; flex-direction: column; min-height: 0; min-width: 0; }

/* networking */
.tl-net { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
.tl-net-graphs { flex: 2; min-height: 0; overflow-y: auto; border: 1px solid #7f9db9; background: #fff; padding: 4px; display: flex; flex-direction: column; gap: 6px; }
.tl-net-graph { height: 120px; flex: 0 0 auto; display: flex; flex-direction: column; }
.tl-net-graph .tl-graph-row { flex: 1; display: flex; min-height: 0; }
.tl-net-axis { width: 38px; display: flex; flex-direction: column; justify-content: space-between; text-align: right; padding-right: 3px; color: #000; font-size: 10px; }
.tl-net .tl-list { flex: 1; }
.tl-empty { color: #716f64; padding: 6px; }

/* dialogs */
.tl-modal { position: absolute; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: transparent; }
.tl-dialog { position: relative; display: flex; flex-direction: column; background: #ece9d8; border: 1px solid #0831d9; border-top: none; border-radius: 8px 8px 0 0; box-shadow: 3px 3px 10px rgba(0,0,0,.5); max-width: 95%; max-height: 95%; }
.tl-dialog .tl-title { height: 26px; font-size: 12px; }
.tl-dialog .tl-frame { padding: 12px 11px 10px 11px; }
.tl-message { display: flex; gap: 12px; align-items: flex-start; max-width: 460px; line-height: 14px; }
.tl-message svg { width: 32px; height: 32px; flex: 0 0 auto; }
.tl-message p { margin: 0 0 8px 0; white-space: pre-wrap; }
.tl-message-buttons { display: flex; justify-content: center; gap: 6px; margin-top: 12px; }
.tl-form { display: grid; grid-template-columns: auto 1fr; gap: 6px 8px; align-items: center; margin-top: 10px; }
.tl-props { width: 520px; height: 420px; display: flex; flex-direction: column; }
.tl-props .tl-body { padding: 0; }
.tl-props-general { display: grid; grid-template-columns: 90px 1fr; gap: 7px 6px; line-height: 14px; }
.tl-props-sep { grid-column: 1 / 3; height: 2px; border-top: 1px solid #aca899; border-bottom: 1px solid #fff; margin: 3px 0; }
.tl-columns-list { height: 200px; overflow-y: auto; border: 1px solid #7f9db9; background: #fff; padding: 4px; display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.tl-frame.tl-notepad { padding: 0; }
.tl-notepad-text { flex: 1; min-height: 0; border-top: 1px solid #aca899; background: #fff; user-select: text; overflow: hidden; }
.tl-notepad-text > div { height: 100%; }
.tl-notepad-text .cm-editor { height: 100%; font-family: 'Lucida Console', 'DejaVu Sans Mono', 'Liberation Mono', monospace; font-size: 12px; }
.tl-notepad-text .cm-editor.cm-focused { outline: none; }
.tl-notepad-text .cm-scroller { font-family: inherit; }
.tl-notepad-text .cm-panels { font-family: ${LUNA_FONT_STACK}; font-size: 11px; background: #ece9d8; }
.tl-about { display: flex; gap: 12px; width: 380px; line-height: 15px; }
.tl-about .tl-title-icon { width: 48px; height: 48px; flex: 0 0 auto; }
.tl-about-logo { flex: 0 0 auto; }
.tl-about-logo .tl-start-logo { width: 56px; height: 56px; }
`

const STYLE_ID = 'kwirth-tasklist-luna'

// Once per page, the first time a window is drawn. A newer bundle (an update, a hot reload) replaces the old rules.
export const injectLunaStyle = (): void => {
    let style = document.getElementById(STYLE_ID)
    if (!style) {
        style = document.createElement('style')
        style.id = STYLE_ID
        document.head.appendChild(style)
    }
    if (style.textContent !== CSS) style.textContent = CSS
}
