(function () {
  'use strict';

  /* ---------- theme toggle ---------- */
  var root = document.documentElement;
  document.getElementById('theme').addEventListener('click', function () {
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    document.dispatchEvent(new Event('themechange'));
  });

  /* ---------- lightbox ---------- */
  var lb = null, lbImg, lbTitle, lbYear, lbLink, lbPrev, lbNext, lbClose;
  var current = { list: [], i: 0 }, lastFocus = null;

  function buildLightbox() {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML =
      '<button type="button" class="lb-btn lb-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="Previous image"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4.5L7.5 12 15 19.5"/></svg></button>' +
      '<button type="button" class="lb-btn lb-next" aria-label="Next image"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5L16.5 12 9 19.5"/></svg></button>' +
      '<figure class="lb-fig"><img alt="">' +
      '<figcaption><span class="lb-title"></span><span class="lb-year"></span>' +
      '<a class="lb-link" target="_blank" rel="noopener" hidden>View original post</a></figcaption></figure>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('img');
    lbTitle = lb.querySelector('.lb-title');
    lbYear = lb.querySelector('.lb-year');
    lbLink = lb.querySelector('.lb-link');
    lbPrev = lb.querySelector('.lb-prev');
    lbNext = lb.querySelector('.lb-next');
    lbClose = lb.querySelector('.lb-close');

    lbClose.addEventListener('click', closeLightbox);
    lbPrev.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    lbNext.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    // clicking the backdrop or the picture closes; the caption link keeps working
    lb.addEventListener('click', function (e) {
      if (e.target.closest('.lb-link') || e.target.closest('.lb-btn')) return;
      closeLightbox();
    });
    lbImg.addEventListener('load', function () { lbImg.classList.add('ready'); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(lb.querySelectorAll('button, a[href]'), function (n) { return !n.hidden && n.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  function show() {
    var item = current.list[current.i];
    lbImg.classList.remove('ready');
    lbImg.alt = item.alt || item.title || '';
    lbImg.src = item.src;
    lbTitle.textContent = item.title || '';
    lbYear.textContent = item.year || '';
    if (item.href) { lbLink.href = item.href; lbLink.hidden = false; } else { lbLink.hidden = true; }
    var many = current.list.length > 1;
    lbPrev.hidden = lbNext.hidden = !many;
  }
  function step(d) {
    var n = current.list.length;
    if (n < 2) return;
    current.i = (current.i + d + n) % n;
    show();
  }
  function openLightbox(list, i) {
    if (!lb) buildLightbox();
    current = { list: list, i: i };
    lastFocus = document.activeElement;
    show();
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    lbClose.focus();
  }
  function closeLightbox() {
    lb.hidden = true;
    lbImg.removeAttribute('src');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- media tiles ---------- */
  var tiles = [];

  // "50% 20%" (across, down) or one of top / bottom / left / right / center. Defaults to centered.
  function parsePos(str) {
    var p = String(str || '').trim().split(/\s+/), kw = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
    function one(v) {
      if (v in kw) return kw[v];
      var n = parseFloat(v);
      return isNaN(n) ? 0.5 : Math.min(1, Math.max(0, n / 100));
    }
    if (p.length === 1) {
      if (p[0] === 'top' || p[0] === 'bottom') return { x: 0.5, y: one(p[0]) };
      return { x: one(p[0]), y: 0.5 };
    }
    return { x: one(p[0]), y: one(p[1]) };
  }

  // list: the images in this group that can be enlarged, in page order (for prev/next)
  function makeTile(item, index, extraClass, list) {
    var el = document.createElement('figure');
    el.className = 'tile' + (extraClass ? ' ' + extraClass : '');

    var frame = document.createElement('div');
    frame.className = 'frame';
    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', item.alt || item.title || '');

    var entry = { canvas: canvas, img: null, seed: index + 1, el: el, pos: parsePos(item.position) };
    if (item.src) {
      var img = new Image();
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = item.thumb || item.src;   // small preview; the full image loads in the enlarge view
      img.style.objectPosition = (entry.pos.x * 100) + '% ' + (entry.pos.y * 100) + '%';
      img.addEventListener('load', function () { paint(entry); });
      frame.appendChild(img);
      entry.img = img;

      var at = list.push(item) - 1;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Enlarge ' + (item.title || item.alt || 'image'));
      // start fetching the full-size image as soon as someone points at the tile
      el.addEventListener('pointerenter', function () { new Image().src = item.src; }, { once: true });
      el.addEventListener('click', function () { openLightbox(list, at); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(list, at); }
      });
    } else {
      el.classList.add('nocolor');
    }
    frame.appendChild(canvas);
    el.appendChild(frame);

    if (item.title || item.year) {
      var cap = document.createElement('figcaption');
      cap.className = 'cap';
      var t = document.createElement('span');
      t.className = 'cap-t'; t.textContent = item.title || '';
      var y = document.createElement('span');
      y.className = 'cap-y'; y.textContent = item.year || '';
      cap.appendChild(t); cap.appendChild(y);
      el.appendChild(cap);
    }

    tiles.push(entry);
    return el;
  }

  function paint(entry) {
    var src = entry.img;
    if (src) {
      if (!src.complete || !src.naturalWidth) return;
    } else {
      src = window.Dither.placeholder(240, 240, entry.seed);
    }
    window.Dither.tile(entry.canvas, src, entry.pos);
  }

  function fill(id, items, offset) {
    var host = document.getElementById(id), list = [];
    (items || []).forEach(function (item, i) { host.appendChild(makeTile(item, i + offset, '', list)); });
  }

  var media = window.MEDIA || {};
  fill('grid-work', media.work, 0);
  fill('grid-frames', media.frames, 10);
  // Profile photo: whatever is in assets/profile/ (see scripts/build-media.mjs)
  var me = media.profile || { src: '', alt: 'Zayd Mahmud' };
  document.getElementById('profile').appendChild(
    makeTile({ src: me.src, thumb: me.thumb, alt: me.alt || 'Zayd Mahmud', position: me.position }, 20, 'tile-portrait', [])
  );

  function paintAll() { tiles.forEach(paint); }
  paintAll();
  document.addEventListener('themechange', paintAll);
  var timer;
  var ro = new ResizeObserver(function () { clearTimeout(timer); timer = setTimeout(paintAll, 150); });
  document.querySelectorAll('.grid, .hero-art, .posts').forEach(function (g) { ro.observe(g); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintAll);

  /* ---------- writing (from data/posts.js, refreshed by the GitHub Action) ---------- */
  var list = document.getElementById('posts');
  var posts = window.POSTS || [];
  if (!posts.length) {
    var li = document.createElement('li');
    li.className = 'empty';
    li.innerHTML = 'Recent posts will show up here. <a href="https://rectitudes.substack.com">Read Rectitudes on Substack</a>.';
    list.appendChild(li);
  }
  var covers = [];
  posts.slice(0, 6).forEach(function (p) {
    var li = document.createElement('li');
    var time = document.createElement('time');
    time.dateTime = p.date;
    time.textContent = new Date(p.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    var box = document.createElement('div');
    var h = document.createElement('h3');
    var a = document.createElement('a');
    a.href = p.url; a.textContent = p.title;
    h.appendChild(a); box.appendChild(h);
    if (p.excerpt) { var d = document.createElement('p'); d.textContent = p.excerpt; box.appendChild(d); }
    li.appendChild(time); li.appendChild(box);

    // Cover image: dithered, hidden until the row is hovered, fading out toward the text (see .cover in the CSS)
    if (p.cover) {
      var cover = document.createElement('div');
      cover.className = 'cover';
      cover.setAttribute('aria-hidden', 'true');
      var cv = document.createElement('canvas');
      cover.appendChild(cv);
      li.appendChild(cover);
      var ci = new Image();
      var entry = { canvas: cv, img: ci, seed: 0, pos: { x: 0.5, y: 0.5 } };
      ci.addEventListener('load', function () { paint(entry); });
      tiles.push(entry);
      covers.push([ci, p.cover]);
    }
    list.appendChild(li);
  });
  // fetch the covers once the page itself has loaded
  function loadCovers() { covers.forEach(function (c) { c[0].src = c[1]; }); }
  if (document.readyState === 'complete') setTimeout(loadCovers, 200);
  else window.addEventListener('load', function () { setTimeout(loadCovers, 200); });
})();
