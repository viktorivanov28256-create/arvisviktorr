(() => {
  'use strict';
  if (document.getElementById('arvis-reading-panel')) return;
  const key = 'arvis_reading_v1';
  const defaults = () => ({ enabled:false, size:'20', theme:'light', spacing:'normal' });
  const sanitize = value => ({
    enabled:value?.enabled === true,
    size:['20','26','34'].includes(value?.size) ? value.size : '20',
    theme:['light','dark','blue'].includes(value?.theme) ? value.theme : 'light',
    spacing:value?.spacing === 'wide' ? 'wide' : 'normal'
  });
  let settings = defaults();
  try { settings = sanitize(JSON.parse(localStorage.getItem(key) || 'null')); } catch (_) {}
  let opener;
  const panel = document.createElement('dialog');
  panel.id = 'arvis-reading-panel';
  panel.className = 'arvis-reading-panel';
  panel.setAttribute('aria-labelledby','arvis-reading-title');
  panel.innerHTML = `<div class="arvis-reading-panel__heading"><h2 id="arvis-reading-title">Версия для слабовидящих</h2><button type="button" data-reading-close aria-label="Закрыть настройки доступности">Закрыть</button></div>
    <p>Увеличенный текст, контрастная тема и спокойное чтение. Врачи, цены, адреса и запись остаются на тех же страницах.</p>
    <fieldset><legend>Размер текста</legend>
      <label><input type="radio" name="arvis-reading-size" value="20">Крупный — 20 пикселей</label>
      <label><input type="radio" name="arvis-reading-size" value="26">Очень крупный — 26 пикселей</label>
      <label><input type="radio" name="arvis-reading-size" value="34">Максимальный — 34 пикселя</label></fieldset>
    <fieldset><legend>Цветовая тема</legend>
      <label><input type="radio" name="arvis-reading-theme" value="light">Чёрный текст на белом</label>
      <label><input type="radio" name="arvis-reading-theme" value="dark">Белый текст на чёрном</label>
      <label><input type="radio" name="arvis-reading-theme" value="blue">Тёмно-синий текст на светло-голубом</label></fieldset>
    <fieldset><legend>Интервалы</legend>
      <label><input type="radio" name="arvis-reading-spacing" value="normal">Обычные</label>
      <label><input type="radio" name="arvis-reading-spacing" value="wide">Увеличенные между буквами и словами</label></fieldset>
    <p class="arvis-reading-panel__status" data-reading-status role="status" aria-live="polite"></p>
    <div class="arvis-reading-panel__actions"><button type="button" class="arvis-reading-enable" data-reading-enable>Включить версию</button><button type="button" data-reading-reset>Обычная версия</button></div>`;
  document.body.append(panel);
  const status = panel.querySelector('[data-reading-status]');
  const enable = panel.querySelector('[data-reading-enable]');
  // Reading mode requires a deliberate media action. Existing visibility observers
  // may still call play(), so pausing only once when the mode opens is insufficient.
  let manualMedia = new WeakSet();
  const isMainVideo = video => video instanceof HTMLVideoElement && video.closest('main');
  const allowMediaAction = event => {
    if (!settings.enabled || !event.isTrusted || !(event.target instanceof Element)) return;
    const control = event.target.closest('button.arvis-equipment-toggle[aria-controls]');
    if (control) {
      if (event.type !== 'click') return;
      const video = document.getElementById(control.getAttribute('aria-controls'));
      if (!isMainVideo(video)) return;
      if (video.paused || video.ended) manualMedia.add(video);
      else manualMedia.delete(video);
      return;
    }
    const video = event.target.closest('video[controls]');
    if (!isMainVideo(video)) return;
    if (event.type === 'pointerdown' || (event.type === 'keydown' && [' ','Enter'].includes(event.key))) {
      if (video.paused || video.ended) manualMedia.add(video);
      else manualMedia.delete(video);
    }
  };
  ['click','pointerdown','keydown'].forEach(name => document.addEventListener(name,allowMediaAction,true));
  document.addEventListener('play',event => {
    const video = event.target;
    if (settings.enabled && isMainVideo(video) && !manualMedia.has(video)) video.pause();
  },true);
  document.addEventListener('pause',event => {
    if (settings.enabled && isMainVideo(event.target)) manualMedia.delete(event.target);
  },true);
  const apply = () => {
    const root = document.documentElement;
    if (settings.enabled) {
      root.setAttribute('data-arvis-reading','on');
      root.setAttribute('data-arvis-reading-theme',settings.theme);
      root.setAttribute('data-arvis-reading-spacing',settings.spacing);
      root.style.setProperty('--arvis-reading-size',settings.size + 'px');
      manualMedia = new WeakSet();
      document.querySelectorAll('main video').forEach(video => video.pause());
    } else {
      root.removeAttribute('data-arvis-reading');
      root.removeAttribute('data-arvis-reading-theme');
      root.removeAttribute('data-arvis-reading-spacing');
      root.style.removeProperty('--arvis-reading-size');
    }
    for (const name of ['size','theme','spacing']) {
      panel.querySelectorAll(`input[name="arvis-reading-${name}"]`).forEach(input => { input.checked = input.value === settings[name]; });
    }
    status.textContent = settings.enabled ? 'Версия для слабовидящих включена.' : 'Сейчас открыта обычная версия.';
    enable.textContent = settings.enabled ? 'Продолжить чтение' : 'Включить версию';
  };
  const persist = () => {
    try { settings.enabled ? localStorage.setItem(key,JSON.stringify(settings)) : localStorage.removeItem(key); } catch (_) {}
  };
  const close = () => {
    if (typeof panel.close === 'function' && panel.open) panel.close();
    else { panel.removeAttribute('open'); restoreFocus(); }
  };
  const restoreFocus = () => {
    const canFocus = element => element?.isConnected && element.getClientRects().length && !element.closest('dialog:not([open]),[hidden],[inert]');
    const target = canFocus(opener) ? opener : document.querySelector('button[data-open-nav]');
    if (canFocus(target)) target.focus({preventScroll:true});
  };
  const open = event => {
    opener = event.currentTarget;
    const parentDialog = opener.closest('dialog');
    if (parentDialog?.open && typeof parentDialog.close === 'function') parentDialog.close();
    if (typeof panel.showModal === 'function') panel.showModal();
    else panel.setAttribute('open','');
    requestAnimationFrame(() => panel.querySelector('[data-reading-close]').focus({preventScroll:true}));
  };
  for (const container of [document.querySelector('#nav-dialog .dialog-top'),document.querySelector('.site-footer .footer-bottom')].filter(Boolean)) {
    const holder = document.createElement('span');
    holder.className = 'arvis-reading-entry';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'arvis-reading-trigger';
    trigger.textContent = 'Версия для слабовидящих';
    trigger.setAttribute('aria-controls',panel.id);
    trigger.setAttribute('aria-haspopup','dialog');
    trigger.addEventListener('click',open);
    holder.append(trigger);
    container.matches('.dialog-top') ? container.after(holder) : container.append(holder);
  }
  panel.querySelector('[data-reading-close]').addEventListener('click',close);
  panel.addEventListener('cancel',event => { event.preventDefault(); close(); });
  panel.addEventListener('close',restoreFocus);
  panel.querySelectorAll('input[type="radio"]').forEach(input => input.addEventListener('change',() => {
    settings[input.name.replace('arvis-reading-','')] = input.value;
    settings = sanitize(settings);
    apply();
    persist();
  }));
  enable.addEventListener('click',() => { settings.enabled = true; apply(); persist(); close(); });
  panel.querySelector('[data-reading-reset]').addEventListener('click',() => { settings = defaults(); apply(); persist(); close(); });
  apply();
})();
