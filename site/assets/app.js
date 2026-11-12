(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const norm = value => String(value || '').toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
  const params = new URLSearchParams(location.search);
  let indexPromise;
  let indexRows;
  const searchRuns = new WeakMap();

  function getIndex() {
    if (!indexPromise) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      indexPromise = fetch('/search-documents.json', { method: 'GET', signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error('Search index unavailable');
          return response.json();
        })
        .then(rows => {
          if (!Array.isArray(rows)) throw new Error('Invalid search index');
          indexRows = rows;
          return rows;
        })
        .catch(error => {
          indexPromise = undefined;
          throw error;
        })
        .finally(() => clearTimeout(timeout));
    }
    return indexPromise;
  }

  function hint(root, text) {
    if (!root) return;
    const paragraph = document.createElement('p');
    paragraph.className = 'search-hint';
    paragraph.textContent = text;
    root.replaceChildren(paragraph);
  }

  function results(root, query, rows, limit = 12) {
    if (!root) return;
    root.replaceChildren();
    const words = norm(query).split(' ').filter(Boolean);
    if (!words.length) {
      hint(root, 'Введите имя врача, специальность или название услуги.');
      return;
    }
    const matches = rows.map(row => {
      const title = norm(row.title);
      const text = norm(row.text || row.search || row.description);
      return {
        row,
        all: words.every(word => title.includes(word) || text.includes(word)),
        score: words.reduce((score, word) => score + (title.includes(word) ? 10 : text.includes(word) ? 1 : 0), 0)
      };
    }).filter(item => item.all).sort((a, b) => b.score - a.score).slice(0, limit);
    if (!matches.length) {
      hint(root, 'Ничего не найдено. Попробуйте другое название или свяжитесь с клиникой.');
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const { row } of matches) {
      const link = document.createElement('a');
      link.href = row.url;
      link.className = 'search-result';
      const type = document.createElement('span');
      type.className = 'search-result-type';
      type.textContent = row.type_label || 'Материал клиники';
      const title = document.createElement('strong');
      title.textContent = row.title;
      const description = document.createElement('p');
      description.textContent = String(row.description || row.text || '').slice(0, 190);
      link.append(type, title, description);
      fragment.append(link);
    }
    root.append(fragment);
  }

  async function runSearch(root, input, limit = 12) {
    if (!root || !input) return;
    const revision = (searchRuns.get(root) || 0) + 1;
    searchRuns.set(root, revision);
    const query = input.value;
    if (!norm(query)) {
      root.setAttribute('aria-busy', 'false');
      hint(root, 'Введите имя врача, специальность или название услуги.');
      return;
    }
    if (indexRows) {
      root.setAttribute('aria-busy', 'false');
      results(root, query, indexRows, limit);
      return;
    }
    root.setAttribute('aria-busy', 'true');
    hint(root, 'Ищем по сайту…');
    try {
      const rows = await getIndex();
      if (searchRuns.get(root) === revision) results(root, query, rows, limit);
    } catch {
      if (searchRuns.get(root) !== revision) return;
      const recovery = document.createElement('div');
      recovery.className = 'search-hint';
      const message = document.createElement('p');
      message.textContent = 'Не удалось загрузить поиск. Повторите попытку или откройте нужный раздел.';
      const actions = document.createElement('p');
      actions.className = 'actions';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn btn-secondary';
      retry.textContent = 'Повторить поиск';
      retry.addEventListener('click', () => {
        // runSearch() replaces this button; keep keyboard focus on a live control.
        input.focus({ preventScroll: true });
        runSearch(root, input, limit);
      });
      actions.append(retry);
      for (const [href, label] of [['/doctors/', 'Врачи'], ['/prices/', 'Цены']]) {
        const link = document.createElement('a');
        link.className = 'text-link';
        link.href = href;
        link.textContent = label;
        actions.append(link);
      }
      recovery.append(message, actions);
      root.replaceChildren(recovery);
    } finally {
      if (searchRuns.get(root) === revision) root.setAttribute('aria-busy', 'false');
    }
  }

  const navDialog = $('#nav-dialog');
  const navTriggers = $$('button[data-open-nav]');
  const searchDialog = $('#search-dialog');
  const searchInput = $('#dialog-search');
  const searchResults = $('#dialog-results');
  let navOpener;
  let searchOpener;
  let returnNavFocus = true;
  let returnSearchFocus = true;

  function canFocus(element) {
    if (!element?.isConnected || !element.getClientRects().length || element.closest('[hidden],[inert]')) return false;
    const parentDialog = element.closest('dialog');
    return !parentDialog || parentDialog.open;
  }

  function focusBack(element, fallback) {
    const destination = canFocus(element) ? element : fallback.find(canFocus);
    destination?.focus({ preventScroll: true });
  }

  function navExpanded(open) {
    navTriggers.forEach(button => button.setAttribute('aria-expanded', String(open)));
  }

  function closeNav(restoreFocus = true) {
    if (!navDialog?.open) return;
    returnNavFocus = restoreFocus;
    navDialog.close();
  }

  function closeSearch(restoreFocus = true) {
    if (!searchDialog?.open) return;
    returnSearchFocus = restoreFocus;
    searchDialog.close();
  }

  function openNav(button) {
    if (!navDialog || navDialog.open) return;
    if (searchDialog?.open) closeSearch(false);
    navOpener = button;
    returnNavFocus = true;
    navDialog.showModal();
    navExpanded(true);
    $('[data-close-nav]', navDialog)?.focus({ preventScroll: true });
  }

  function openSearch(button) {
    if (!searchDialog || !searchInput || !searchResults) return;
    // A trigger in the closing navigation dialog cannot receive focus later.
    searchOpener = navDialog?.contains(button)
      ? navOpener || navTriggers.find(canFocus)
      : button || document.activeElement;
    if (navDialog?.open) closeNav(false);
    returnSearchFocus = true;
    if (!searchDialog.open) searchDialog.showModal();
    searchInput.focus({ preventScroll: true });
    runSearch(searchResults, searchInput);
  }

  navTriggers.forEach(button => button.addEventListener('click', () => openNav(button)));
  $('[data-close-nav]')?.addEventListener('click', () => closeNav());
  navDialog?.addEventListener('close', () => {
    if (navDialog.open) return;
    navExpanded(false);
    if (returnNavFocus) focusBack(navOpener, navTriggers);
  });
  navDialog?.addEventListener('click', event => {
    if (event.target.closest('a[href]')) closeNav(false);
  });
  // Only buttons open search; source anchors carrying the same data attribute
  // retain their actual links and never become inert JavaScript controls.
  $$('button[data-search]').forEach(button => button.addEventListener('click', () => openSearch(button)));
  $('[data-close-search]')?.addEventListener('click', () => closeSearch());
  searchDialog?.addEventListener('close', () => {
    if (!searchDialog.open && returnSearchFocus) focusBack(searchOpener, $$('button[data-search]').filter(button => !navDialog?.contains(button)).concat(navTriggers));
  });

  function modalDismissal(dialog, close) {
    if (!dialog) return;
    let startedOnBackdrop = false;
    const outside = event => {
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener('pointerdown', event => {
      startedOnBackdrop = event.target === dialog && outside(event);
    });
    dialog.addEventListener('click', event => {
      if (startedOnBackdrop && event.target === dialog && outside(event)) close();
      startedOnBackdrop = false;
    });
  }
  modalDismissal(navDialog, closeNav);
  modalDismissal(searchDialog, closeSearch);

  // A populated native search input consumes Escape before the dialog cancel event.
  searchDialog?.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeSearch();
  });
  searchInput?.addEventListener('input', () => runSearch(searchResults, searchInput));
  searchDialog?.querySelector('form')?.addEventListener('submit', event => {
    if (!searchInput) return;
    event.preventDefault();
    location.href = '/search/?q=' + encodeURIComponent(searchInput.value);
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!searchDialog?.open) openSearch(navDialog?.open ? navOpener : $('button[data-search]'));
    }
  });

  function state(values) {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  const doctorQuery = $('#doctor-query');
  const specialty = $('#specialty-filter');
  const doctorBranch = $('#branch-filter');
  const practicePairs = new WeakMap();
  function practices(card) {
    if (!practicePairs.has(card)) {
      let pairs = [];
      try {
        const source = JSON.parse(card.dataset.practices || card.dataset.actualPracticePairs || '[]');
        if (Array.isArray(source)) pairs = source;
      } catch { /* An invalid card does not break the rest of the directory. */ }
      practicePairs.set(card, pairs);
    }
    return practicePairs.get(card);
  }
  function filterDoctors() {
    const words = norm(doctorQuery.value).split(' ').filter(Boolean);
    const selectedSpecialty = specialty.value;
    const selectedBranch = doctorBranch.value;
    let count = 0;
    $$('[data-doctor-card]').forEach(card => {
      // Specialty and address must belong to one actual practice pair.
      const matchedPractice = (!selectedSpecialty && !selectedBranch) || practices(card).some(pair => (!selectedSpecialty || pair.specialty_id === selectedSpecialty) && (!selectedBranch || pair.branch_id === selectedBranch));
      const searchable = norm(card.dataset.search);
      const show = matchedPractice && words.every(word => searchable.includes(word));
      card.hidden = !show;
      count += Number(show);
    });
    if ($('#doctor-status')) $('#doctor-status').textContent = count ? `Специалистов: ${count}` : 'Специалисты не найдены';
    if ($('#doctor-empty')) $('#doctor-empty').hidden = Boolean(count);
    state({ q: doctorQuery.value, specialty: selectedSpecialty, branch: selectedBranch });
  }
  if (doctorQuery && specialty && doctorBranch) {
    doctorQuery.value = params.get('q') || '';
    specialty.value = params.get('specialty') || '';
    doctorBranch.value = params.get('branch') || '';
    if (!specialty.value) specialty.value = '';
    if (!doctorBranch.value) doctorBranch.value = '';
    [doctorQuery, specialty, doctorBranch].forEach(control => control.addEventListener(control === doctorQuery ? 'input' : 'change', filterDoctors));
    $('[data-doctor-reset]')?.addEventListener('click', () => {
      doctorQuery.value = '';
      specialty.value = '';
      doctorBranch.value = '';
      filterDoctors();
      doctorQuery.focus();
    });
    filterDoctors();
  }

  const priceQuery = $('#price-query');
  const priceBranch = $('#price-branch');
  const priceGroup = $('#price-group');
  function priceWordMatches(text, word) {
    // Keep УЗИ/ТРУЗИ, but exclude the incidental substring in инфузия.
    return word === 'узи' ? /узи(?![\p{L}\p{N}])/u.test(text) : text.includes(word);
  }
  function filterPrices() {
    const words = norm(priceQuery.value).split(' ').filter(Boolean);
    const branch = priceBranch.value;
    const selectedGroup = priceGroup.value;
    const scopeMatches = row => (!branch || row.dataset.branch === branch) && (!selectedGroup || row.dataset.group === selectedGroup);
    const serviceName = row => norm(row.dataset.serviceName || $('.price-service', row)?.textContent || '');
    const serviceWords = words.filter(word => word.length >= 3);
    const directNames = new Set(words.length ? $$('[data-price-row]').filter(row => scopeMatches(row) && words.every(word => priceWordMatches(norm(row.dataset.search), word)) && serviceWords.some(word => priceWordMatches(serviceName(row), word))) : []);
    let count = 0;
    $$('[data-price-group]').forEach(group => {
      let shown = 0;
      $$('[data-price-row]', group).forEach(row => {
        const searchable = norm(row.dataset.search);
        const show = scopeMatches(row) && (directNames.size ? directNames.has(row) : words.every(word => priceWordMatches(searchable, word)));
        row.hidden = !show;
        shown += Number(show);
        count += Number(show);
      });
      group.hidden = !shown;
    });
    if ($('#price-status')) $('#price-status').textContent = count ? `Услуг: ${count}` : 'Услуги не найдены';
    if ($('#price-empty')) $('#price-empty').hidden = Boolean(count);
    state({ q: priceQuery.value, branch, group: selectedGroup });
  }
  if (priceQuery && priceBranch && priceGroup) {
    priceQuery.value = params.get('q') || params.get('search') || '';
    priceBranch.value = params.get('branch') || '';
    priceGroup.value = params.get('group') || '';
    if (!priceBranch.value) priceBranch.value = '';
    if (!priceGroup.value) priceGroup.value = '';
    [priceQuery, priceBranch, priceGroup].forEach(control => control.addEventListener(control === priceQuery ? 'input' : 'change', filterPrices));
    $('[data-price-reset]')?.addEventListener('click', () => {
      priceQuery.value = '';
      priceBranch.value = '';
      priceGroup.value = '';
      filterPrices();
      priceQuery.focus();
    });
    filterPrices();
  }

  const pageSearch = $('#page-search');
  if (pageSearch) {
    pageSearch.value = params.get('q') || '';
    const run = async () => {
      state({ q: pageSearch.value });
      await runSearch($('#page-search-results'), pageSearch, 50);
    };
    pageSearch.addEventListener('input', run);
    pageSearch.closest('form')?.addEventListener('submit', event => { event.preventDefault(); run(); });
    run();
  }

  // Only literal source FAQ items gain native controls; preparation and other
  // H2 sections are never automatically hidden or moved inside an accordion.
  $$('.document-content .apv-faq__item').forEach(item => {
    const question = $('.apv-faq__q', item);
    const answer = $('.apv-faq__a', item);
    if (!question || !answer || item.closest('details')) return;
    const details = document.createElement('details');
    for (const attribute of item.attributes) {
      if (!['role', 'aria-expanded'].includes(attribute.name)) details.setAttribute(attribute.name, attribute.value);
    }
    details.classList.add('new-faq');
    const summary = document.createElement('summary');
    question.removeAttribute('tabindex');
    question.removeAttribute('role');
    answer.removeAttribute('hidden');
    answer.removeAttribute('aria-hidden');
    summary.append(question);
    details.append(summary, answer);
    item.replaceWith(details);
  });

  const tabGroups = [];
  $$('.document-content [role=tablist]').forEach(list => {
    const tabs = $$('[role=tab]', list);
    if (!tabs.length) return;
    const activate = tab => {
      for (const candidate of tabs) {
        const selected = candidate === tab;
        candidate.setAttribute('aria-selected', String(selected));
        candidate.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(candidate.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      }
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        activate(tabs[next]);
        tabs[next].focus();
      });
    });
    activate(tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0]);
    tabGroups.push({ tabs, activate });
  });

  function revealAnchor() {
    if (!location.hash) return;
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    for (const { tabs, activate } of tabGroups) {
      const tab = tabs.find(candidate => {
        const panel = document.getElementById(candidate.getAttribute('aria-controls'));
        return panel && (panel === target || panel.contains(target));
      });
      if (tab) activate(tab);
    }
    let details = target.closest('details');
    while (details) {
      details.open = true;
      details = details.parentElement?.closest('details');
    }
    target.scrollIntoView({ block: 'start' });
  }
  revealAnchor();
  window.addEventListener('hashchange', revealAnchor);
  window.addEventListener('load', revealAnchor, { once: true });

  const profileHero = $('[data-profile-hero]');
  const contextBooking = $('[data-context-booking]');
  if (profileHero && contextBooking) {
    let observer;
    let scheduled = false;
    let observedHeaderHeight = -1;
    const setBooking = show => {
      contextBooking.hidden = !show;
      document.body.classList.toggle('has-context-booking', show);
    };
    const headerHeight = () => {
      const rect = $('.site-header')?.getBoundingClientRect();
      return rect ? Math.max(0, Math.ceil(rect.bottom)) : 0;
    };
    const measure = () => {
      const rect = profileHero.getBoundingClientRect();
      const visible = rect.height > 0 && rect.bottom > headerHeight() && rect.top < window.innerHeight;
      setBooking(!visible);
    };
    const observe = () => {
      const height = headerHeight();
      if (!('IntersectionObserver' in window) || height === observedHeaderHeight) return;
      observedHeaderHeight = height;
      observer?.disconnect();
      observer = new IntersectionObserver(entries => {
        const entry = entries[entries.length - 1];
        if (entry) setBooking(!(entry.isIntersecting && entry.intersectionRect.height > 0));
      }, { rootMargin: `-${height}px 0px 0px 0px`, threshold: 0 });
      observer.observe(profileHero);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        measure();
        observe();
      });
    };
    measure();
    observe();
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('hashchange', schedule);
    window.addEventListener('load', schedule, { once: true });
    if (!('IntersectionObserver' in window)) window.addEventListener('scroll', schedule, { passive: true });
    // Native initial hash scrolling can occur after the deferred script runs.
    requestAnimationFrame(() => requestAnimationFrame(schedule));
    document.fonts?.ready.then(schedule);
  }
})();
