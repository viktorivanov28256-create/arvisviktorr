(() => {
  'use strict';
  const script = document.currentScript;
  const counter = Number(script?.dataset.arvisCounter);
  const storageKey = 'arvis.analytics-consent.v1';
  const validFor = 180 * 24 * 60 * 60 * 1000;
  let enabled = false;
  let choice = null;
  let banner;
  // Insert inside the owning consent IIFE, after its private enabled/choice declarations.
  // This fragment does not initialise an SDK or save a consent choice.
  function installGoalDispatcher() {
    if ('ArvisAnalyticsGoals' in window) return;
    const names = new Set(['BOOK_CLICK', 'CALL_CLICK', 'booking_open']);
    const allowed = () => enabled === true && choice?.statistics === true
      && counter === 111043604 && typeof window.ym === 'function';
    const goal = name => {
      if (!names.has(name) || !allowed()) return false;
      try {
        window.ym(counter, 'reachGoal', name);
        return true; // Accepted for dispatch; this is not proof of server delivery.
      } catch (_) { return false; }
    };
    Object.defineProperty(window, 'ArvisAnalyticsGoals', {
      value: Object.freeze({ version: '20261110-source-r1', counter: 111043604, allowed, goal }),
      writable: false, configurable: false
    });
  }
  installGoalDispatcher();
  const readChoice = () => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (value?.version === 1 && typeof value.statistics === 'boolean' &&
          Number.isFinite(value.savedAt) && Date.now() - value.savedAt >= 0 &&
          Date.now() - value.savedAt < validFor) return value;
    } catch (_) { /* Storage restrictions keep optional analytics off by default. */ }
    return null;
  };
  function enableStatistics() {
    if (enabled) return;
    enabled = true;
    // Do not pass custom user identifiers, form values or raw URL search terms.
    if (Number.isSafeInteger(counter) && counter >= 100000) {
      window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
      window.ym.l = Date.now();
      window.ym(counter, 'init', { defer: true, webvisor: false, clickmap: false, trackLinks: false, accurateTrackBounce: true });
      window.ym(counter, 'hit', location.origin + location.pathname, { title: document.title, referer: document.referrer.split('?')[0].split('#')[0] });
      const metrika = document.createElement('script');
      metrika.async = true;
      metrika.src = 'https://mc.yandex.ru/metrika/tag.js';
      metrika.dataset.arvisAnalytics = 'metrika';
      document.head.append(metrika);
    }
    const uis = document.createElement('script');
    uis.async = true;
    uis.src = 'https://app.uiscom.ru/static/cs.min.js?k=gv5yf4OrUtWbMygxAUYSDRvk_Lr4Kh_D';
    uis.dataset.arvisAnalytics = 'uis';
    document.head.append(uis);
  }
  function save(statistics) {
    const reload = enabled && !statistics;
    choice = { version: 1, statistics, savedAt: Date.now() };
    try { localStorage.setItem(storageKey, JSON.stringify(choice)); } catch (_) {}
    banner.hidden = true;
    if (reload) {
      location.reload();
      return;
    }
    if (statistics) enableStatistics();
  }
  function showSettings() {
    if (!banner) return;
    banner.hidden = false;
    const necessary = banner.querySelector('[data-arvis-cookie-necessary]');
    necessary.textContent = enabled ? 'Отключить статистику и обновить' : 'Только необходимые';
  }
  function start() {
    banner = document.querySelector('[data-arvis-cookie-notice]');
    if (!banner) return;
    choice = readChoice();
    banner.querySelector('[data-arvis-cookie-accept]')?.addEventListener('click', () => save(true));
    banner.querySelector('[data-arvis-cookie-necessary]')?.addEventListener('click', () => save(false));
    document.querySelectorAll('[data-arvis-cookie-settings]').forEach(button => {
      button.hidden = false;
      button.addEventListener('click', showSettings);
    });
    if (choice?.statistics) enableStatistics();
    if (!choice) showSettings();
    // A keyboard user who reopens preferences can return to the invoking button.
    banner.addEventListener('keydown', event => {
      if (event.key === 'Escape' && choice) {
        banner.hidden = true;
        document.querySelector('[data-arvis-cookie-settings]')?.focus();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
