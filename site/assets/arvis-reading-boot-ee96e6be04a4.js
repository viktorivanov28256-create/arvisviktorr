/* Read only explicit display preferences. No identifiers or external requests. */
(() => {
  'use strict';
  try {
    const value = JSON.parse(localStorage.getItem('arvis_reading_v1') || 'null');
    if (!value || value.enabled !== true) return;
    const root = document.documentElement;
    root.setAttribute('data-arvis-reading', 'on');
    root.setAttribute('data-arvis-reading-theme', ['light', 'dark', 'blue'].includes(value.theme) ? value.theme : 'light');
    root.setAttribute('data-arvis-reading-spacing', value.spacing === 'wide' ? 'wide' : 'normal');
    root.style.setProperty('--arvis-reading-size', ['20', '26', '34'].includes(value.size) ? value.size + 'px' : '20px');
  } catch (_) { /* Storage may be unavailable; the normal site remains usable. */ }
})();
