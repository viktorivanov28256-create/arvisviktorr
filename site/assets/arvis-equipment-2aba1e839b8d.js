/* A small presentation layer for the two device films and two explicitly approved manipule clips.
   experience.js retains ownership of autoplay, visibility, reduced motion and manual-pause state. */
(() => {
  'use strict';
  const CLIPS = new Map([
    ['/recovery-assets/media/arvis-ultraformer-mpt-demo-245702daa96a.mp4', { key: 'ultraformer', name: 'Ultraformer MPT' }],
    ['/recovery-assets/media/arvis-volnewmer-demo-274b1ebfe2d9.mp4', { key: 'volnewmer', name: 'Volnewmer' }],
    ['/recovery-assets/ultraformer-mpt-linear-140e7b346716.mp4', { key: 'ultraformer-linear', name: 'линейной манипулы Ultraformer MPT', manipule: 'linear', poster: '/recovery-assets/ultraformer-mpt-linear-poster-20261103.webp' }],
    ['/recovery-assets/ultraformer-mpt-booster-bed554074e15.mp4', { key: 'ultraformer-booster', name: 'круглой манипулы Ultraformer MPT', manipule: 'booster', poster: '/recovery-assets/ultraformer-mpt-booster-poster-20261103.webp' }]
  ]);
  const SVG = 'http://www.w3.org/2000/svg';
  const PLAY = 'M7 4.8 15 10 7 15.2Z';
  const PAUSE = 'M5.8 4.5h2.8v11H5.8zM11.4 4.5h2.8v11h-2.8z';
  let nextId = 0;

  function clipFor(video) {
    const parent = video.parentElement;
    const manipuleScope = parent && parent.hasAttribute('data-arvis-manipule-motion') && parent.closest('.arvis-mpt-demo');
    if (!video.closest('.xp-cosmetology, .cm-film__media') && !manipuleScope) return null;
    const sources = [video.getAttribute('src'), ...Array.from(video.querySelectorAll('source'), source => source.getAttribute('src'))].filter(Boolean);
    if (!sources.length) return null;
    let clip = null;
    for (const source of sources) {
      let url; try { url = new URL(source, location.href); } catch (_) { return null; }
      const known = CLIPS.get(url.pathname);
      if (url.origin !== location.origin || !known || (clip && known.key !== clip.key)) return null;
      if (known.manipule && (url.search || url.hash)) return null;
      clip = known;
    }
    if (manipuleScope && !clip.manipule) return null;
    if (clip.manipule) {
      if (!manipuleScope || parent.getAttribute('data-arvis-manipule-motion') !== clip.manipule) return null;
      const nodes = Array.from(video.querySelectorAll('source'));
      if (video.hasAttribute('src') || nodes.length !== 1 || nodes[0].getAttribute('type') !== 'video/mp4') return null;
      let poster; try { poster = new URL(video.getAttribute('poster') || '', location.href); } catch (_) { return null; }
      if (poster.origin !== location.origin || poster.pathname !== clip.poster || poster.search || poster.hash) return null;
    }
    return clip;
  }

  function muted(video) {
    video.muted = true;
    video.defaultMuted = true;
  }

  function enhance(video, clip) {
    if (video.hasAttribute('data-arvis-equipment-motion') || video.error) return false;
    const parent = video.parentElement;
    if (!parent || !(parent.matches('.xp-device-object, .cm-film__media') ||
      (clip.manipule && parent.hasAttribute('data-arvis-manipule-motion') && parent.closest('.arvis-mpt-demo')))) return false;
    // Keep the playing media node in place: reparenting can interrupt playback on Safari.
    const stage = parent;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'arvis-equipment-toggle';
    button.style.minHeight = '44px';
    button.style.minWidth = '44px';
    // A stable toggle name; pressed means the animation is playing.
    button.setAttribute('aria-label', 'Анимация ' + clip.name);
    const icon = document.createElementNS(SVG, 'svg');
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.setAttribute('width', '18');
    icon.setAttribute('height', '18');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const path = document.createElementNS(SVG, 'path');
    icon.appendChild(path);
    const label = document.createElement('span');
    label.textContent = 'Анимация';
    button.append(icon, label);

    if (!video.id) {
      let id; do { id = 'arvis-equipment-animation-' + (++nextId); } while (document.getElementById(id));
      video.id = id;
    }
    button.setAttribute('aria-controls', video.id);
    let nativeFallback = false;
    const sync = () => {
      const playing = !video.paused && !video.ended;
      button.setAttribute('aria-pressed', String(playing));
      button.title = (playing ? 'Приостановить анимацию ' : 'Воспроизвести анимацию ') + clip.name;
      path.setAttribute('d', playing ? PAUSE : PLAY);
    };
    const restoreNative = () => {
      nativeFallback = true;
      muted(video);
      video.controls = true;
      button.hidden = true;
      video.setAttribute('data-arvis-equipment-motion', 'native-fallback');
    };
    const playFailed = error => {
      // A quick pause or a device change can abort a pending play request normally.
      if (error && error.name === 'AbortError') { sync(); return; }
      restoreNative();
    };
    button.addEventListener('click', () => {
      if (nativeFallback) return;
      muted(video);
      if (!video.paused && !video.ended) {
        // Native pause event records the user's choice in the existing manager.
        video.pause();
        sync();
        return;
      }
      let play;
      try { play = video.play(); } catch (error) { playFailed(error); return; }
      if (play && typeof play.catch === 'function') play.catch(playFailed);
      sync();
    });
    ['play', 'playing', 'pause', 'ended', 'loadedmetadata'].forEach(name => video.addEventListener(name, sync));
    video.addEventListener('volumechange', () => { if (!nativeFallback && (!video.muted || !video.defaultMuted)) muted(video); });
    video.addEventListener('error', restoreNative);
    // Resource errors on SOURCE do not bubble to VIDEO. clipFor approved every non-empty source.
    Array.from(video.querySelectorAll('source')).filter(source => source.getAttribute('src')).forEach(source => source.addEventListener('error', restoreNative));
    sync();

    // Remove native chrome only after the replacement control exists and is bound.
    const caption = Array.from(stage.children).find(child => child.tagName === 'FIGCAPTION');
    if (caption) stage.insertBefore(button, caption);
    else stage.append(button);
    if (button.parentElement !== stage || !button.isConnected || button.getAttribute('aria-controls') !== video.id || button.type !== 'button') return false;
    stage.classList.add('arvis-equipment-stage');
    stage.setAttribute('data-arvis-equipment-stage', clip.key);
    parent.setAttribute('data-arvis-equipment-media', clip.key);
    video.setAttribute('data-arvis-equipment-motion', clip.key);
    muted(video);
    video.controls = false;
    if (stage.matches('.xp-device-object')) {
      Array.from(stage.children).forEach(child => {
        if (child.tagName === 'SPAN' && child.childElementCount === 0 && child.textContent.trim() === 'Устройство аппарата · видеодемонстрация') child.textContent = 'Демонстрационная анимация аппарата';
      });
      if (video.getAttribute('aria-label') === 'Видеодемонстрация устройства ' + clip.name) video.setAttribute('aria-label', 'Демонстрационная анимация аппарата ' + clip.name);
    }
    return true;
  }

  function mayFade() {
    if (typeof window.matchMedia !== 'function') return false;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      && window.matchMedia('(hover: hover) and (pointer: fine)').matches
      && !(connection && connection.saveData);
  }

  function init() {
    let count = 0;
    document.querySelectorAll('video[playsinline]').forEach(video => {
      const clip = clipFor(video);
      if (clip && enhance(video, clip)) count += 1;
    });
    if (!count) return;
    const intro = document.querySelector('#apparaty-v-detalyah .cm-new-content__intro');
    if (intro && intro.childElementCount === 0) {
      const copy = intro.textContent
        .replace('Видео запускается по нажатию;', 'Анимации аппаратов — без звука;')
        .replace('Видео — без звука, с управлением в плеере;', 'Анимации аппаратов — без звука;');
      if (copy !== intro.textContent) intro.textContent = copy;
    }
    const fades = new WeakMap();
    document.querySelectorAll('.xp-cosmetology [data-xp-device]').forEach(button => {
      button.addEventListener('click', () => {
        if (!mayFade()) return;
        const section = button.closest('.xp-cosmetology');
        window.requestAnimationFrame(() => {
          const scene = section && Array.from(section.querySelectorAll('[data-xp-device-scene]')).find(item => !item.hidden);
          const video = scene && scene.querySelector('video[data-arvis-equipment-motion]');
          if (!video || typeof video.animate !== 'function') return;
          const previous = fades.get(video); if (previous) previous.cancel();
          // Media pixels only. Headings, descriptions and controls never fade or blur.
          fades.set(video, video.animate([{ opacity: 0.82 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }));
        });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
