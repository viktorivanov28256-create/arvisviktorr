/* SOURCE-ONLY proposal. Observes intent/readiness; never opens or changes the widget. */
(() => {
  'use strict';
  if ('ArvisAnalyticsHook' in window) return;
  const VERSION = '20261110-source-r1';
  const MEDFLEX = 'https://booking.medflex.ru';
  const SHOW = 'medflex-round-widget__iframe-wrapper_show';
  const BOOK = 'a[data-arvis-booking-url]';
  const LAUNCHER = '.medflex-round-widget .medflex-round-widget__button';
  let intent = null;
  let observer = null;
  let timer = null;
  let queued = false;

  function dispatcher() {
    const api = window.ArvisAnalyticsGoals;
    return api?.version === VERSION && api.counter === 111043604
      && typeof api.allowed === 'function' && typeof api.goal === 'function' ? api : null;
  }
  function allowed() {
    try { return dispatcher()?.allowed() === true; } catch (_) { return false; }
  }
  function goal(name) {
    try { return dispatcher()?.goal(name) === true; } catch (_) { return false; }
  }
  function clearIntent() {
    intent = null;
    if (observer) observer.disconnect();
    observer = null;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }
  function currentFrame() {
    const host = document.querySelector('.medflex-round-widget');
    const wrapper = host?.querySelector('.medflex-round-widget__iframe-wrapper');
    const frame = wrapper?.querySelector('iframe.medflex-round-widget__iframe');
    return wrapper && frame ? { wrapper, frame } : null;
  }
  function rendered(element) {
    if (!element.isConnected || !Array.from(element.getClientRects()).some(r => r.width > 0 && r.height > 0)) return false;
    for (let node = element; node; node = node.parentElement) {
      if (node.hidden || node.inert || node.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
          || Number(style.opacity) === 0) return false;
    }
    return true;
  }
  function checkReady() {
    if (!intent?.acknowledged) return;
    if (!allowed()) { clearIntent(); return; }
    const current = currentFrame();
    if (!current || current.frame !== intent.frame || current.wrapper !== intent.wrapper
        || !current.wrapper.classList.contains(SHOW)) { clearIntent(); return; }
    if (current.wrapper.getAttribute('aria-busy') === 'true'
        || !rendered(current.wrapper) || !rendered(current.frame)) return;
    clearIntent(); // One attempt per trusted intent; duplicates cannot replay the goal.
    goal('booking_open');
  }
  function scheduleCheck() {
    if (queued) return;
    queued = true;
    window.queueMicrotask(() => { queued = false; checkReady(); });
  }
  function onClick(event) {
    if (event.isTrusted !== true || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target?.closest ? event.target : event.target?.parentElement;
    const booking = target?.closest(BOOK) || target?.closest(LAUNCHER);
    if (booking) {
      clearIntent();
      if (!allowed()) return; // Never retain a denied pre-consent click for later delivery.
      goal('BOOK_CLICK');
      intent = { acknowledged: false, frame: null, wrapper: null };
      timer = window.setTimeout(clearIntent, 12000); // Expiry only discards; it never emits.
      return;
    }
    const phone = target?.closest('a[href]');
    if (phone && /^tel:/i.test(phone.getAttribute('href') || '')) goal('CALL_CLICK');
  }
  function onMessage(event) {
    if (!intent || event.isTrusted !== true || event.origin !== MEDFLEX || event.data !== 'showFrame') return;
    const current = currentFrame();
    if (!current || event.source !== current.frame.contentWindow || !current.wrapper.classList.contains(SHOW)) return;
    if (!allowed()) { clearIntent(); return; }
    intent.frame = current.frame;
    intent.wrapper = current.wrapper;
    intent.acknowledged = true;
    if (!observer) {
      observer = new MutationObserver(scheduleCheck);
      observer.observe(current.wrapper, {
        attributes: true, subtree: true, childList: true,
        attributeFilter: ['class', 'style', 'hidden', 'inert', 'aria-hidden', 'aria-busy']
      });
    }
    scheduleCheck(); // Let the unchanged owning booking handler finish this message first.
  }
  Object.defineProperty(window, 'ArvisAnalyticsHook', {
    value: Object.freeze({ version: VERSION }), writable: false, configurable: false
  });
  // Window capture sees the trusted anchor before the owning bridge's programmatic launcher click.
  window.addEventListener('click', onClick, { capture: true, passive: true });
  window.addEventListener('message', onMessage);
})();
