// Shared helpers for driving the Momentum app during capture.
import { makeL } from '../tools/i18n.mjs';

export const APP_URL = process.env.MOMENTUM_URL ?? 'http://127.0.0.1:5199/';
export const L = makeL('zh');

/** Init script: Chinese UI, dark theme, and hide the backend-less check-in demo card. */
export function initScript(seed) {
  return `(() => {
    const seed = ${JSON.stringify(seed ?? null)};
    if (seed && !sessionStorage.getItem('__seeded')) {
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      sessionStorage.setItem('__seeded', '1');
    }
    localStorage.setItem('language', 'zh');
    localStorage.setItem('theme', 'dark');
    const hide = () => {
      for (const n of document.querySelectorAll('div.mb-12')) {
        if (n.textContent && n.textContent.includes('演示模式')) n.style.display = 'none';
      }
    };
    new MutationObserver(hide).observe(document, { childList: true, subtree: true });
    const style = document.createElement('style');
    // the floating pet is a side feature; keep it out of these shots
    // a 2px ticker repaints every frame so the screencast never stalls on a torn frame
    style.textContent = 'div.fixed.z-40.select-none{display:none!important} *{scrollbar-width:none} ::-webkit-scrollbar{display:none}' +
      ' html::after{content:"";position:fixed;right:0;bottom:0;width:2px;height:2px;z-index:2147483647;pointer-events:none;animation:__tick 1s linear infinite}' +
      ' @keyframes __tick{0%{background:#0b0d12}50%{background:#0c0e13}100%{background:#0b0d12}}';
    const add = () => { if (!style.isConnected) (document.head || document.documentElement).appendChild(style); };
    if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
    document.addEventListener('DOMContentLoaded', add);
  })();`;
}
