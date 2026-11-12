/* Uses the documented UIS JS API. No visitor identifiers or booking data are read. */
(() => {
  'use strict';
  if (window.__arvisUISBridgeInstalled) return;
  window.__arvisUISBridgeInstalled = true;
  const reserve = '74732016743';
  const sourceNumbers = new Set(['74732111717', '74732016921', reserve]);
  let assigned = null;
  let enabled = true;
  let scheduled = false;
  const normalize = value => {
    let digits = String(value || '').replace(/[^0-9]/g, '');
    if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
    if (digits.length === 10) digits = '7' + digits;
    if (digits.length === 7) digits = '7473' + digits;
    return digits;
  };
  function scan() {
    scheduled = false;
    document.querySelectorAll('a[href^="tel:"],a[data-arvis-call="site"]').forEach(link => {
      const current = link.getAttribute('href') || '';
      if (link.getAttribute('data-arvis-call') !== 'site' && !sourceNumbers.has(normalize(current.slice(4)))) return;
      link.setAttribute('data-arvis-call', 'site');
      const target = 'tel:+' + (assigned || reserve);
      if (current !== target) link.setAttribute('href', target);
      if (/^\+?[0-9()\s\-]+$/.test(link.textContent.trim())) link.textContent = 'Позвонить';
      if (!link.getAttribute('aria-label')) link.setAttribute('aria-label', 'Позвонить в клинику');
    });
  }
  function queueScan() {
    if (!scheduled) { scheduled = true; queueMicrotask(scan); }
  }
  function phoneForSite(phones) {
    if (!Array.isArray(phones)) return null;
    const values = new Set(phones.filter(p => p && /^number=["']?(?:7|8)?4732111717["']?$/.test(String(p.id)))
      .map(p => String(p.raw || '')).filter(raw => /^7[0-9]{10}$/.test(raw)));
    return values.size === 1 ? values.values().next().value : null;
  }
  function accept(phones) {
    const phone = phoneForSite(phones);
    if (enabled && phone && phone !== assigned) { assigned = phone; queueScan(); }
  }
  const previous = window.__cs_onReplacePhones;
  const onReplace = function (phones) {
    const allowed = typeof previous === 'function' ? previous(phones) : true;
    enabled = Boolean(allowed);
    if (!enabled) { assigned = null; queueScan(); }
    if (allowed) accept(phones);
    return allowed;
  };
  window.__cs_onReplacePhones = onReplace;
  function start() {
    scan();
    new MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    let attempts = 0;
    const poll = () => {
      const api = window.Comagic;
      if (api) {
        try {
          const dynamic = typeof api.getDTPhones === 'function' ? api.getDTPhones() : null;
          const phone = phoneForSite(dynamic);
          if (phone) onReplace(dynamic);
          else if (typeof api.getPhones === 'function') {
            const phones = api.getPhones();
            if (phoneForSite(phones)) onReplace(phones);
          }
        } catch (error) { /* The verified reserve remains callable while UIS starts. */ }
      }
      if (!assigned && enabled && ++attempts < 40) setTimeout(poll, 500);
    };
    poll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
