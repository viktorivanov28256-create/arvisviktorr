/* Scoped interactions for preserved clinical content. No legacy shell, tracking,
   form submission, generated medical advice, canvas or scroll-driven scenes. */
(() => {
  'use strict';
  const all = (selector, root) => [...root.querySelectorAll(selector)];
  const one = (selector, root) => root.querySelector(selector);
  const normal = value => String(value || '').toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let serial = 0;
  const identify = (node, prefix) => node.id || (node.id = `content-${prefix}-${++serial}`);
  const css = (node, properties) => {
    for (const [name, value] of Object.entries(properties)) node.style.setProperty(name, value, 'important');
  };
  const visible = (node, show, display = 'block') => {
    node.hidden = !show;
    css(node, { display: show ? display : 'none' });
  };

  function laboratoryFilter(root) {
    const input = one('#apvAnQ', root);
    const list = one('#apvAnAll', root);
    const empty = one('#apvAnNone', root);
    if (!input || !list || !empty) return;
    const rows = all('li[data-s]', list);
    if (!rows.length) return;
    empty.setAttribute('role', 'status');
    const filter = () => {
      const query = normal(input.value);
      let count = 0;
      for (const row of rows) {
        const show = !query || normal(row.dataset.s).includes(query);
        visible(row, show, 'list-item');
        if (show) count++;
      }
      if (query) list.open = true;
      visible(empty, Boolean(query && !count));
    };
    input.addEventListener('input', filter);
    input.addEventListener('search', filter);
    filter();
  }

  // The original card markup and links stay intact. Native scrolling also works
  // when this enhancement is absent; controls reflect the actual scroll bounds.
  function carousels(root) {
    for (const car of all('[data-km-car]', root)) {
      const track = one('.apv-km-car__track', car);
      const items = all('.apv-km-car__i', car);
      const previous = one('[data-car="prev"]', car);
      const next = one('[data-car="next"]', car);
      const controls = one('.apv-km-car__ctl', car);
      const bar = one('.apv-km-car__bar', car);
      if (!track || !items.length) {
        if (controls) visible(controls, false);
        continue;
      }
      const id = identify(track, 'carousel');
      track.tabIndex = 0;
      for (const button of [previous, next].filter(Boolean)) {
        button.type = 'button';
        button.setAttribute('aria-controls', id);
      }
      if (bar) bar.setAttribute('aria-hidden', 'true');
      let frame = 0;
      const update = () => {
        frame = 0;
        const max = Math.max(0, track.scrollWidth - track.clientWidth);
        const position = Math.max(0, Math.min(max, track.scrollLeft));
        const overflow = max > 4;
        car.classList.toggle('is-ov', overflow);
        if (controls) {
          visible(controls, overflow, 'flex');
          controls.setAttribute('aria-hidden', String(!overflow));
        }
        if (previous) previous.disabled = !overflow || position <= 2;
        if (next) next.disabled = !overflow || position >= max - 2;
        const fraction = track.scrollWidth ? Math.min(1, track.clientWidth / track.scrollWidth) : 1;
        const progress = max ? position / max : 0;
        car.style.setProperty('--car-f', `${fraction * 100}%`);
        car.style.setProperty('--car-x', `${fraction < 1 ? progress * (1 - fraction) / fraction * 100 : 0}%`);
        const bounds = track.getBoundingClientRect();
        let current = 0;
        let distance = Infinity;
        items.forEach((item, index) => {
          const delta = Math.abs(item.getBoundingClientRect().left - bounds.left);
          if (delta < distance) { distance = delta; current = index; }
        });
        items.forEach((item, index) => item.classList.toggle('is-cur', index === current));
      };
      const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
      const move = direction => {
        const step = items.length > 1
          ? Math.abs(items[1].getBoundingClientRect().left - items[0].getBoundingClientRect().left)
          : track.clientWidth;
        track.scrollBy({ left: direction * (step || track.clientWidth), behavior: reducedMotion() ? 'instant' : 'smooth' });
      };
      previous?.addEventListener('click', () => move(-1));
      next?.addEventListener('click', () => move(1));
      track.addEventListener('keydown', event => {
        if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          move(event.key === 'ArrowRight' ? 1 : -1);
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          track.scrollTo({ left: event.key === 'Home' ? 0 : track.scrollWidth, behavior: reducedMotion() ? 'instant' : 'smooth' });
        }
      });
      track.addEventListener('scroll', schedule, { passive: true });
      car.addEventListener('load', schedule, true);
      if (window.ResizeObserver) new ResizeObserver(schedule).observe(track);
      else window.addEventListener('resize', schedule, { passive: true });
      update();
    }
  }

  // Button keys, SVG groups and explanatory captions come from the same source.
  // No medical text or handpiece mapping is synthesized in this file.
  function beamDiagrams(root) {
    for (const box of all('[data-km-beam]', root)) {
      const buttons = all('button[data-hp]', box);
      const groups = all('.apv-km-beam__g[data-hp]', box);
      const captions = all('.apv-km-beam__cap[data-hp]', box);
      const complete = buttons.length && buttons.every(button =>
        captions.some(caption => caption.dataset.hp === button.dataset.hp));
      if (!complete) {
        // A single-handpiece article is already a static diagram. Incomplete
        // source mappings likewise remain readable instead of guessing a key.
        captions.forEach(caption => visible(caption, true));
        for (const button of buttons) visible(button, false);
        continue;
      }
      const region = one('.apv-km-beam__caps', box);
      region?.setAttribute('aria-live', 'polite');
      const activate = button => {
        const key = button.dataset.hp;
        buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        groups.forEach(group => group.classList.toggle('is-on', group.dataset.hp === key));
        captions.forEach(caption => {
          const active = caption.dataset.hp === key;
          caption.classList.toggle('is-on', active);
          visible(caption, active);
        });
      };
      for (const button of buttons) {
        button.type = 'button';
        const caption = captions.find(item => item.dataset.hp === button.dataset.hp);
        button.setAttribute('aria-controls', identify(caption, 'handpiece'));
        button.addEventListener('click', () => activate(button));
      }
      activate(buttons.find(button => button.getAttribute('aria-pressed') === 'true') || buttons[0]);
    }
  }

  function depthDiagrams(root) {
    for (const box of all('[data-km-depth]', root)) {
      const scale = one('.apv-km-depth__scale', box);
      const rows = all('button.apv-km-depth__row[data-y]', box);
      if (!scale || !rows.length) continue;
      const valid = rows.filter(row => Number.isFinite(Number(row.dataset.y)) && Number(row.dataset.y) >= 0 && Number(row.dataset.y) <= 100);
      if (valid.length !== rows.length) continue;
      const activate = row => {
        scale.style.setProperty('--y', `${Number(row.dataset.y)}%`);
        rows.forEach(item => item.setAttribute('aria-pressed', String(item === row)));
      };
      for (const row of rows) {
        row.type = 'button';
        row.addEventListener('click', () => activate(row));
      }
      activate(rows.find(row => row.getAttribute('aria-pressed') === 'true') || rows[0]);
    }
    for (const box of all('[data-km-modes]', root)) {
      const buttons = all('button[data-m]', box);
      if (!buttons.length) continue;
      const activate = button => {
        box.dataset.mode = button.dataset.m;
        buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      };
      buttons.forEach(button => {
        button.type = 'button';
        button.addEventListener('click', () => activate(button));
      });
      activate(buttons.find(button => button.getAttribute('aria-pressed') === 'true') || buttons[0]);
    }
    // Article depth scenes have a complete semantic legend in the source. Keep
    // that list visible; do not recreate the old generated 3D/drag interface.
    for (const scene of all('.apv-depth[data-modes]', root)) {
      const legend = one('.apv-depth__legend', scene);
      if (legend) {
        visible(legend, true);
        css(legend, { position: 'static', opacity: '1', visibility: 'visible', transform: 'none', 'max-height': 'none' });
        const layers = [...legend.children];
        const methods = (scene.dataset.modes || '').split('|');
        const hits = (scene.dataset.hit || '').split('|');
        if (methods.length && methods.every((method, index) => method && /^\d+$/.test(hits[index] || '') && layers[Number(hits[index])])) {
          const mapping = document.createElement('ul');
          mapping.className = 'content-depth-methods';
          css(mapping, { margin: '0 0 20px', padding: '0', 'list-style': 'none' });
          methods.forEach((method, index) => {
            const label = one('b', layers[Number(hits[index])]);
            const row = document.createElement('li');
            row.textContent = `${method} — ${label?.textContent || layers[Number(hits[index])].textContent}`;
            css(row, { 'font-size': '15px', margin: '6px 0', color: 'var(--muted)' });
            mapping.append(row);
          });
          legend.before(mapping);
        }
      }
      all('.apv-depth__stage,.apv-depth__ctl,.apv-depth__drag', scene).forEach(node => visible(node, false));
      const introduction = scene.previousElementSibling;
      if (introduction?.matches('p')) {
        // Replace only the old 3D UI directions; retain the clinical clauses.
        const walker = document.createTreeWalker(introduction, NodeFilter.SHOW_TEXT);
        let text;
        while ((text = walker.nextNode())) text.nodeValue = text.nodeValue
          .replace('Ниже: тот же разрез в объёме. Переключите группу методов и посмотрите, до какой глубины она достаёт:', 'Ниже указана глубина воздействия методов:')
          .replace('Ниже: тот же разрез, но живой.', 'Ниже — слои тканей.')
          .replace('Ниже — тот же разрез в объёме:', 'Ниже — слои тканей:')
          .replace(' Переключите метод и сравните.', '')
          .replace(' Схему можно повернуть.', '');
      }
    }
  }

  function questionnaires(root) {
    for (const quiz of all('.apv-quiz', root)) {
      const questions = all('.apv-quiz__q', quiz);
      const go = one('.apv-quiz__go', quiz);
      const result = one('.apv-quiz__res', quiz);
      const templates = all('.apv-quiz__out', quiz);
      if (!questions.length || !go || !result) continue;
      const options = questions.map(question => all('button.apv-quiz__o', question));
      if (options.some(group => !group.length)) continue;
      const scored = templates.some(template => !template.dataset.flag && Number.isFinite(Number(template.dataset.min))) &&
        options.every(group => group.every(option => option.hasAttribute('data-v') && Number.isFinite(Number(option.dataset.v))));
      templates.forEach(template => { visible(template, false); template.setAttribute('aria-hidden', 'true'); });
      visible(result, false);
      result.setAttribute('role', 'region');
      result.setAttribute('aria-label', 'Результат опроса');
      result.setAttribute('aria-live', 'polite');
      result.tabIndex = -1;
      go.type = 'button';
      const progress = document.createElement('p');
      progress.className = 'apv-quiz__progress';
      progress.setAttribute('role', 'status');
      css(progress, { 'font-size': '15px', color: 'var(--muted)', margin: '16px 0' });
      go.before(progress);
      if (!scored) {
        // The ambrosia quiz has no outcome templates in main_html. Its former
        // global bundle generated diagnostic prose. Retain it as a local
        // checklist rather than revive those unversioned medical conclusions.
        visible(go, false);
        const subtitle = one('.apv-quiz__sub', quiz);
        if (subtitle) subtitle.textContent = 'Вопросы для подготовки к приёму. Ответы никуда не отправляются.';
      }
      const selected = () => options.map(group => group.find(option => option.getAttribute('aria-pressed') === 'true'));
      const update = () => {
        const count = selected().filter(Boolean).length;
        progress.textContent = `Отвечено ${count} из ${questions.length}`;
        go.disabled = count !== questions.length;
        go.textContent = go.disabled ? 'Ответьте на все вопросы' : 'Показать результат';
        visible(result, false);
      };
      questions.forEach((question, index) => {
        const title = one('.apv-quiz__qt', question);
        const group = one('.apv-quiz__a', question);
        if (title && group) {
          group.setAttribute('role', 'group');
          group.setAttribute('aria-labelledby', identify(title, 'question'));
        }
        const buttons = options[index];
        buttons.forEach(button => {
          button.type = 'button';
          button.setAttribute('aria-pressed', String(button.classList.contains('apv-quiz__o--on')));
          button.addEventListener('click', () => {
            buttons.forEach(option => {
              const active = option === button;
              option.classList.toggle('apv-quiz__o--on', active);
              option.setAttribute('aria-pressed', String(active));
            });
            update();
          });
        });
      });
      if (scored) go.addEventListener('click', () => {
        const answers = selected();
        if (answers.some(answer => !answer)) return;
        const score = answers.reduce((sum, answer) => sum + Number(answer.dataset.v), 0);
        const flagged = answers.some(answer => Boolean(answer.dataset.flag));
        const regular = templates.filter(template => !template.dataset.flag && Number.isFinite(Number(template.dataset.min)))
          .filter(template => score >= Number(template.dataset.min))
          .sort((a, b) => Number(b.dataset.min) - Number(a.dataset.min));
        const template = (flagged && templates.find(item => Boolean(item.dataset.flag))) || regular[0];
        if (!template) return;
        const fragment = document.createDocumentFragment();
        template.childNodes.forEach(child => fragment.append(child.cloneNode(true)));
        const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
        let text;
        while ((text = walker.nextNode())) text.nodeValue = text.nodeValue.replaceAll('{score}', String(score)).replaceAll('{max}', quiz.dataset.max || '');
        result.replaceChildren(fragment);
        result.classList.toggle('apv-quiz__res--red', Boolean(template.dataset.flag));
        visible(result, true);
        go.textContent = 'Пересчитать';
        result.focus({ preventScroll: true });
        result.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'instant' : 'smooth' });
      });
      update();
    }
  }

  function seasonalDecorations(root) {
    // No live pollen data or seasonal config is loaded by the fresh shell.
    // Hiding the decorative flap also avoids presenting an invented live state.
    for (const flap of all('.apv-flap[data-fx="flap"]', root)) visible(flap, false);
  }

  function init() {
    for (const root of all('.document-content', document)) {
      if (root.dataset.contentInteractions === 'ready') continue;
      root.dataset.contentInteractions = 'ready';
      laboratoryFilter(root);
      carousels(root);
      beamDiagrams(root);
      depthDiagrams(root);
      questionnaires(root);
      seasonalDecorations(root);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
