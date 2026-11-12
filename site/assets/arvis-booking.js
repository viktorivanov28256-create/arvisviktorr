/* Official Medflex launcher/iframe bridge. No independent modal or outbound message API. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    if (root.ArvisBookingBridge) return;
    const bridge = api.createBridge(root, root.document);
    root.ArvisBookingBridge = Object.freeze({ version: '20261108-r4', isReady: bridge.isReady });
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', bridge.start, { once: true });
    else bridge.start();
  }
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const MEDFLEX = 'https://booking.medflex.ru';
  const SHOW = 'medflex-round-widget__iframe-wrapper_show';
  const TRIGGER = 'a[data-arvis-booking-url]';
  function parseUrl(value, base) { try { return new URL(value, base); } catch (_) { return null; } }
  function clinicUrl(url, user) {
    return url && url.origin === MEDFLEX && !url.username && !url.password && !url.hash
      && url.searchParams.getAll('user').length === 1 && url.searchParams.get('user') === user;
  }
  function resolveTarget(anchor, officialSource, siteOrigin) {
    const official = parseUrl(officialSource), user = official && official.searchParams.get('user');
    if (!user || !clinicUrl(official, user)) return null;
    const raw = anchor.getAttribute('href') || '';
    if (/^(?:tel:|mailto:|#)/i.test(raw) || anchor.hasAttribute('download')) return null;
    const fallback = parseUrl(raw, siteOrigin);
    if (!fallback) return null;
    // Only exact targets explicitly supplied by the reviewed server/fixture. No ID inference/map.
    const supplied = anchor.getAttribute('data-arvis-booking-url');
    if (!supplied) return null;
    const target = parseUrl(supplied);
    if (!clinicUrl(target, user)) return null;
    if (fallback.origin === 'https://prodoctorov.ru') {
      if (fallback.search || fallback.hash || !/^\/voronezh\/vrach\/[0-9]+-[a-z0-9-]+\/$/.test(fallback.pathname)) return null;
    } else if (fallback.origin === MEDFLEX) {
      if (!clinicUrl(fallback, user)) return null;
      for (const key of ['service_ids', 'employeeId']) {
        if (fallback.searchParams.has(key) && (fallback.pathname !== target.pathname
            || fallback.searchParams.getAll(key).join('\n') !== target.searchParams.getAll(key).join('\n'))) return null;
      }
    } else if (fallback.origin !== siteOrigin) return null;
    if (target.searchParams.has('service_ids') && (target.searchParams.getAll('service_ids').length !== 1
        || !/^[0-9]+(?:,[0-9]+)*$/.test(target.searchParams.get('service_ids')))) return null;
    if (target.searchParams.has('employeeId') && (target.searchParams.getAll('employeeId').length !== 1
        || !/^[0-9]+$/.test(target.searchParams.get('employeeId')))) return null;
    target.searchParams.set('isRoundWidget', 'true'); return target.href;
  }

  function createBridge(win, doc) {
    let lastTrigger = null, activeFrame = null, pending = null, sequence = 0, started = false, observer = null, observed = null;
    const failedTargets = new Set(); let failureNotice = null, failureContainer = null;
    function elements() {
      const host = doc.querySelector('.medflex-round-widget'), data = doc.getElementById('medflexRoundWidgetData');
      if (!host || !data) return null;
      const launcher = host.querySelector('.medflex-round-widget__button');
      const wrapper = host.querySelector('.medflex-round-widget__iframe-wrapper');
      return launcher && wrapper && typeof launcher.click === 'function' ? { host, data, launcher, wrapper } : null;
    }
    function isReady() { return Boolean(elements()); }
    function visible() { const native = elements(); return Boolean(native && native.wrapper.classList.contains(SHOW)); }
    function focus(element) { if (element && element.isConnected && typeof element.focus === 'function') element.focus({ preventScroll: true }); }
    function focusSoon(element) { win.requestAnimationFrame(() => focus(element)); }
    function restoreFocus() { if (lastTrigger) { const previous = lastTrigger; lastTrigger = null; focusSoon(previous); } }
    function clearPending() {
      if (pending) { win.clearTimeout(pending.timer); pending.frame.style.visibility = pending.visibility; pending = null; }
      const native = elements(); if (native) native.wrapper.removeAttribute('aria-busy');
    }
    function clearFailure() {
      if (failureNotice && failureNotice.parentNode) failureNotice.parentNode.removeChild(failureNotice);
      if (failureContainer) failureContainer.removeAttribute('data-arvis-booking-error');
      failureNotice = null; failureContainer = null;
    }
    function showFailure(anchor) {
      clearFailure(); if (!anchor.isConnected || !anchor.parentNode) return;
      const notice = doc.createElement('span'); notice.className = 'arvis-booking-failure';
      notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.setAttribute('aria-atomic', 'true');
      const parent = anchor.parentNode;
      const context = parent.classList && parent.classList.contains('context-booking');
      const display = typeof win.getComputedStyle === 'function' ? win.getComputedStyle(parent).display : '';
      const adjacent = !context && /^(?:inline-)?(?:flex|grid)$/.test(display) && parent.parentNode ? parent : anchor;
      adjacent.parentNode.insertBefore(notice, adjacent.nextSibling);
      if (context) { failureContainer = parent; parent.setAttribute('data-arvis-booking-error', ''); }
      const message = doc.createElement('span'); message.textContent = 'Онлайн-запись не загрузилась.';
      const phone = doc.createElement('a'); phone.setAttribute('href', 'tel:+74732111717'); phone.textContent = 'Записаться по телефону';
      notice.appendChild(message); notice.appendChild(phone); failureNotice = notice;
    }
    function closeButton(native) {
      let close = native.wrapper.querySelector('[data-arvis-widget-close]');
      if (!close) {
        close = doc.createElement('button'); close.type = 'button';
        close.className = 'medflex-round-widget__cross'; close.setAttribute('data-arvis-widget-close', '');
        close.setAttribute('aria-label', 'Закрыть онлайн-запись'); close.textContent = 'Закрыть';
        close.style.cssText = 'position:fixed;right:8px;top:8px;z-index:1000000000;background:#fff;border-radius:8px;padding:10px 14px;font:inherit;';
        native.wrapper.appendChild(close);
      }
      close.style.display = visible() ? 'flex' : 'none'; return close;
    }
    function observeNative() {
      const native = elements(); if (!native || observed === native.wrapper) return;
      if (observer) observer.disconnect(); observed = native.wrapper;
      // Full focus/background modality must be checked in the genuine cross-origin widget.
      // Do not falsely declare aria-modal or fabricate a focus trap around an opaque frame.
      native.wrapper.setAttribute('role', 'dialog');
      if (!native.wrapper.hasAttribute('aria-label')) native.wrapper.setAttribute('aria-label', 'Онлайн-запись в Арвис Клинику');
      if (!native.launcher.hasAttribute('tabindex')) native.launcher.setAttribute('tabindex', '0');
      if (!native.launcher.hasAttribute('role')) native.launcher.setAttribute('role', 'button');
      native.launcher.setAttribute('aria-haspopup', 'dialog'); closeButton(native);
      native.wrapper.inert = !visible(); native.wrapper.setAttribute('aria-hidden', visible() ? 'false' : 'true');
      native.host.querySelectorAll('button.medflex-round-widget__cross').forEach(button => {
        button.setAttribute('type', 'button');
        if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', 'Закрыть онлайн-запись');
      });
      observer = new win.MutationObserver(() => {
        native.wrapper.inert = !visible(); native.wrapper.setAttribute('aria-hidden', visible() ? 'false' : 'true');
        closeButton(native);
        if (!visible()) { clearPending(); restoreFocus(); }
        else {
          const frame = native.wrapper.querySelector('iframe.medflex-round-widget__iframe');
          if (frame) { activeFrame = frame; frame.setAttribute('title', 'Онлайн-запись в Арвис Клинику'); }
        }
      });
      observer.observe(native.wrapper, { attributes: true, attributeFilter: ['class'] });
    }
    function open(anchor, target) {
      const native = elements(); if (!native || failedTargets.has(target)) return false;
      clearFailure();
      observeNative();
      if (!native.wrapper.classList.contains(SHOW)) native.launcher.click();
      const frame = native.wrapper.querySelector('iframe.medflex-round-widget__iframe');
      if (!native.wrapper.classList.contains(SHOW) || !frame) return false;
      native.wrapper.inert = false; native.wrapper.setAttribute('aria-hidden', 'false');
      lastTrigger = anchor; activeFrame = frame;
      frame.setAttribute('title', 'Онлайн-запись в Арвис Клинику');
      const close = closeButton(native); native.wrapper.appendChild(close);
      focus(close); // Keep keyboard focus visible while the cross-origin form is still loading.
      const previous = parseUrl(frame.getAttribute('src'), win.location.origin);
      const changed = !previous || previous.href !== target;
      if (changed || frame.style.display === 'none') {
        clearPending(); const token = ++sequence, visibility = frame.style.visibility;
        frame.style.visibility = 'hidden'; native.wrapper.setAttribute('aria-busy', 'true');
        const onLoad = () => {
          if (!pending || pending.token !== token) return;
          frame.style.visibility = visibility; pending.loaded = true;
          if (pending.shown) { clearPending(); focusSoon(frame); }
        };
        frame.addEventListener('load', onLoad, { once: true });
        pending = { token, anchor, frame, visibility, loaded: false, shown: false, timer: win.setTimeout(() => {
          if (!pending || pending.token !== token) return;
          failedTargets.add(target); clearPending();
          anchor.setAttribute('title', 'Виджет не загрузился. Повторное нажатие откроет страницу записи.');
          close.click(); restoreFocus(); showFailure(anchor);
        }, 12000) };
        if (changed) frame.src = target;
      } else focusSoon(frame);
      return true;
    }
    function handleClick(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target && typeof event.target.closest === 'function' ? event.target.closest(TRIGGER) : null;
      if (!anchor) {
        if (event.target && typeof event.target.closest === 'function') {
          const launcher = event.target.closest('.medflex-round-widget__button'); if (launcher) lastTrigger = launcher;
        }
        return;
      }
      const native = elements();
      const data = native ? native.data : doc.getElementById('medflexRoundWidgetData');
      if (!data) return;
      const target = resolveTarget(anchor, data.getAttribute('data-src'), win.location.origin);
      if (!target) return;
      if (!native) { event.preventDefault(); showFailure(anchor); return; }
      if (open(anchor, target)) event.preventDefault();
    }
    function handleMessage(event) {
      if (event.origin !== MEDFLEX || !activeFrame || event.source !== activeFrame.contentWindow || event.data !== 'showFrame') return;
      if (pending) { pending.shown = true; if (pending.loaded) { clearPending(); focusSoon(activeFrame); } }
      // A duplicate ready message must not steal focus from a deliberately focused close control.
    }
    function handleKey(event) {
      const native = elements(); if (!native) return;
      if ((event.key === 'Enter' || event.key === ' ') && event.target === native.launcher) {
        event.preventDefault(); native.launcher.click();
      } else if (event.key === 'Escape' && visible()) {
        event.preventDefault(); closeButton(native).click();
      }
    }
    function start() {
      if (started) return; started = true;
      doc.addEventListener('click', handleClick, true); doc.addEventListener('keydown', handleKey, true);
      win.addEventListener('message', handleMessage); observeNative();
      if (!observed) {
        const setup = new win.MutationObserver(() => { if (elements()) { setup.disconnect(); observeNative(); } });
        setup.observe(doc.body, { childList: true, subtree: true }); win.setTimeout(() => setup.disconnect(), 15000);
      }
    }
    return { start, isReady, handleClick };
  }
  return { resolveTarget, createBridge };
});
