/* "For [personal inquiries v] you can email me at [mail@zayd.fun]"
   A small accessible dropdown. Picking an option swaps the address with a dithery scramble. */
(function () {
  'use strict';

  var root = document.getElementById('contact');
  if (!root) return;

  var btn = document.getElementById('c-btn');
  var label = document.getElementById('c-label');
  var list = document.getElementById('c-list');
  var link = document.getElementById('c-mail');
  var text = document.getElementById('c-text');
  var copy = document.getElementById('c-copy');
  var opts = Array.prototype.slice.call(list.querySelectorAll('[role="option"]'));

  var RAMP = '.:-=+*#%@';   // the same idea as the dither tones, from light to heavy
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = 0, copyTimer = 0, active = 0;

  /* ---------- the scramble ---------- */
  function scramble(from, to) {
    cancelAnimationFrame(raf);
    if (reduce) { text.textContent = to; return; }
    var start = performance.now(), DUR = 520;
    (function frame(now) {
      var t = Math.min(1, (now - start) / DUR);
      var ease = 1 - Math.pow(1 - t, 3);
      var done = Math.floor(ease * to.length);                         // letters already settled
      var len = Math.round(from.length + (to.length - from.length) * ease);
      var out = '', i;
      for (i = 0; i < len; i++) {
        out += i < done ? to.charAt(i) : RAMP.charAt(Math.floor(Math.random() * RAMP.length));
      }
      text.textContent = t < 1 ? out : to;
      if (t < 1) raf = requestAnimationFrame(frame);
    })(start);
  }

  function choose(i, quiet) {
    var o = opts[i], email = o.dataset.email, prev = link.getAttribute('aria-label') || text.textContent;
    opts.forEach(function (n, j) { n.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
    label.textContent = o.dataset.label;
    link.href = 'mailto:' + email;
    link.setAttribute('aria-label', email);
    copy.removeAttribute('data-copied');
    if (quiet) text.textContent = email; else if (prev !== email) scramble(prev, email);
    active = i;
  }

  /* ---------- the dropdown ---------- */
  function isOpen() { return root.hasAttribute('data-open'); }
  function setActive(i) {
    active = (i + opts.length) % opts.length;
    opts.forEach(function (n, j) { n.classList.toggle('on', j === active); });
    opts[active].focus();
  }
  function open() {
    root.setAttribute('data-open', '');
    btn.setAttribute('aria-expanded', 'true');
    var sel = opts.findIndex(function (n) { return n.getAttribute('aria-selected') === 'true'; });
    setActive(sel < 0 ? 0 : sel);
  }
  function close(refocus) {
    root.removeAttribute('data-open');
    btn.setAttribute('aria-expanded', 'false');
    opts.forEach(function (n) { n.classList.remove('on'); });
    if (refocus) btn.focus();
  }

  btn.addEventListener('click', function () { isOpen() ? close(false) : open(); });
  btn.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!isOpen()) open(); }
  });

  opts.forEach(function (o, i) {
    o.tabIndex = -1;
    o.addEventListener('click', function () { choose(i); close(true); });
    o.addEventListener('mousemove', function () { if (active !== i) setActive(i); });
  });
  list.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); close(true); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') { close(false); }
  });
  document.addEventListener('click', function (e) { if (isOpen() && !root.contains(e.target)) close(false); });

  /* ---------- copy ---------- */
  copy.addEventListener('click', function () {
    var email = link.getAttribute('aria-label');
    function done() {
      copy.setAttribute('data-copied', '');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function () { copy.removeAttribute('data-copied'); }, 1600);
    }
    try { navigator.clipboard.writeText(email).then(done, function () {}); } catch (err) {}
  });

  choose(0, true);
})();
