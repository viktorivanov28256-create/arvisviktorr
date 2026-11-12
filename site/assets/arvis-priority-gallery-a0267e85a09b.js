(function () {
  'use strict';

  function initGallery() {
    var gallery = document.querySelector('[data-arvis-directions="kosmetologiya"] .dp-gallery');
    if (!gallery || typeof HTMLDialogElement === 'undefined' || document.getElementById('dp-voroshilova-lightbox')) return;
    var links = Array.from(gallery.querySelectorAll('a[data-dp-gallery]')).filter(function (link) {
      try {
        var url = new URL(link.href, location.href);
        return url.origin === location.origin && url.pathname.indexOf('/recovery-assets/clinic/voroshilova/') === 0;
      } catch (_) { return false; }
    });
    if (!links.length) return;

    var dialog = document.createElement('dialog');
    dialog.id = 'dp-voroshilova-lightbox';
    dialog.className = 'dp-lightbox';
    dialog.setAttribute('aria-label', 'Фотографии филиала на Ворошилова, 8Б');
    dialog.innerHTML = '<button class="dp-lightbox__close" type="button">Закрыть</button>' +
      '<div class="dp-lightbox__frame">' +
      '<p class="dp-lightbox__error" hidden>Не удалось загрузить фотографию. Закройте просмотр и попробуйте открыть её ещё раз.</p></div>' +
      '<p class="dp-lightbox__caption"></p>' +
      '<div class="dp-lightbox__controls"><button type="button" data-dp-prev>Предыдущее</button>' +
      '<span class="dp-lightbox__status" aria-live="polite" aria-atomic="true"></span>' +
      '<button type="button" data-dp-next>Следующее</button></div>';
    var image = document.createElement('img');
    image.className = 'dp-lightbox__image';
    image.alt = links[0].querySelector('img') ? links[0].querySelector('img').alt : 'Филиал на Ворошилова, 8Б';
    image.decoding = 'async';
    image.loading = 'lazy';
    image.src = links[0].href;
    dialog.querySelector('.dp-lightbox__frame').prepend(image);
    document.body.appendChild(dialog);
    var caption = dialog.querySelector('.dp-lightbox__caption');
    var status = dialog.querySelector('.dp-lightbox__status');
    var error = dialog.querySelector('.dp-lightbox__error');
    var close = dialog.querySelector('.dp-lightbox__close');
    var previous = dialog.querySelector('[data-dp-prev]');
    var next = dialog.querySelector('[data-dp-next]');
    var index = 0;
    var trigger = null;

    function showPhoto(nextIndex) {
      index = (nextIndex + links.length) % links.length;
      var link = links[index];
      var thumb = link.querySelector('img');
      var figure = link.closest('figure');
      var label = figure && figure.querySelector('figcaption');
      error.hidden = true;
      image.hidden = false;
      image.alt = thumb ? thumb.alt : 'Филиал на Ворошилова, 8Б';
      image.src = link.href;
      caption.textContent = label ? label.textContent.trim() : image.alt;
      status.textContent = (index + 1) + ' из ' + links.length;
      previous.disabled = next.disabled = links.length < 2;
    }

    image.addEventListener('error', function () {
      image.hidden = true;
      error.hidden = false;
    });
    image.addEventListener('load', function () {
      image.hidden = false;
      error.hidden = true;
    });
    previous.addEventListener('click', function () { showPhoto(index - 1); });
    next.addEventListener('click', function () { showPhoto(index + 1); });
    close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        showPhoto(index + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    dialog.addEventListener('close', function () {
      document.documentElement.classList.remove('dp-lightbox-open');
      if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
    });
    links.forEach(function (link, position) {
      link.setAttribute('aria-haspopup', 'dialog');
      link.setAttribute('aria-controls', dialog.id);
      link.addEventListener('click', function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        showPhoto(position);
        trigger = link;
        try { dialog.showModal(); } catch (_) { return; }
        event.preventDefault();
        document.documentElement.classList.add('dp-lightbox-open');
        close.focus({ preventScroll: true });
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGallery, { once: true });
  else initGallery();
}());
