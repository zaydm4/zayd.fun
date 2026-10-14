/* Dithering for the media tiles: Dither.tile(canvas, source, pos) draws an image (or a placeholder)
   with Floyd-Steinberg error diffusion across four tones of the site palette.
   Error diffusion keeps edges and fine detail far better than a fixed pattern, so photos stay readable.
   Dots that sit on the edge between two tones slowly twinkle, so visible tiles shimmer very slightly. */
(function () {
  'use strict';

  // Tweak these:
  var DOT = 1.05;       // dot size in CSS pixels. 1 keeps the most detail, 2 is chunkier.
  var GAMMA = 0.9;   // brightness curve. 0.8 is lifted, 1 is neutral, higher is darker.
  var GRAIN = 0.02;  // how many dots twinkle (0 = none, 0.3 = lots). They only move between neighbouring tones.
  var SPEED = 1.5;   // how fast they drift, in radians per second. Lower is calmer.
  var FPS = 10;      // how often the twinkle updates.

  var probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  var pctx = probe.getContext('2d', { willReadFrequently: true });

  function rgbOf(css) {
    pctx.clearRect(0, 0, 1, 1);
    pctx.fillStyle = css;
    pctx.fillRect(0, 0, 1, 1);
    var d = pctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function isDark() { return document.documentElement.dataset.theme === 'dark'; }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  // Four tones, darkest to brightest as they appear on screen.
  function palette() {
    var ink = rgbOf(cssVar('--dither')), paper = rgbOf(cssVar('--paper'));
    if (isDark()) return [paper, mix(paper, ink, 0.32), ink, mix(ink, [255, 255, 255], 0.5)];
    return [mix(ink, [0, 0, 0], 0.62), ink, mix(ink, paper, 0.55), paper];
  }

  /* ---------------- placeholder ---------------- */

  // A soft shaded blob for tiles that have no image yet.
  function placeholder(w, h, seed) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    var dk = isDark();
    g.fillStyle = dk ? '#000' : '#fff'; g.fillRect(0, 0, w, h);
    var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(seed * 9301 + 49297);
    var i;
    for (i = 0; i < 3; i++) {
      var cx = (0.2 + rnd() * 0.6) * w, cy = (0.2 + rnd() * 0.6) * h, r = (0.25 + rnd() * 0.3) * Math.min(w, h);
      var grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, dk ? 'rgba(70,70,70,0.9)' : 'rgba(175,175,175,0.9)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
    c.isPlaceholder = true;
    return c;
  }

  /* ---------------- motion ---------------- */

  // Every dot sitting near the edge between two tones has a twin one tone over, and a private phase.
  // Each frame it shows whichever of the two its own slow sine wave points to, so dots change one at a time.
  function render(canvas, t) {
    var st = canvas.__dither;
    if (!st || !st.ambIdx.length) return;
    var o = st.img.data, pal = st.pal, idx = st.ambIdx, alt = st.ambAlt, ph = st.phase, q0 = st.q0;
    var j, k, c, tt = t * SPEED;
    for (j = 0; j < idx.length; j++) {
      k = idx[j];
      c = pal[Math.sin(tt + ph[j]) > 0 ? alt[j] : q0[k]];
      o[k * 4] = c[0]; o[k * 4 + 1] = c[1]; o[k * 4 + 2] = c[2];
    }
    st.ctx.putImageData(st.img, 0, 0);
  }

  var tiles = [], observer = null, looping = false, lastFrame = 0;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loop(now) {
    requestAnimationFrame(loop);
    if (now - lastFrame < 1000 / FPS) return;
    lastFrame = now;
    if (document.hidden || document.querySelector('.lightbox:not([hidden])')) return;
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].__visible) render(tiles[i], now / 1000);
    }
  }

  function watch(canvas) {
    if (canvas.__watched) return;
    canvas.__watched = true;
    tiles.push(canvas);
    if ('IntersectionObserver' in window) {
      if (!observer) {
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { e.target.__visible = e.isIntersecting; });
        }, { rootMargin: '80px' });
      }
      observer.observe(canvas);
    } else {
      canvas.__visible = true;
    }
    if (!looping && !still && GRAIN > 0) { looping = true; requestAnimationFrame(loop); }
  }

  /* ---------------- tile ---------------- */

  // pos: { x, y } from 0 to 1, which part of the picture stays visible when it is cropped (0.5 is centered)
  function tile(canvas, source, pos) {
    var fx = pos ? pos.x : 0.5, fy = pos ? pos.y : 0.5;
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    var sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
    if (!sw || !sh) return;

    // One dot per DOT css pixels, on whole device pixels so dots stay crisp on retina screens.
    var dpr = window.devicePixelRatio || 1;
    var cell = Math.max(1, Math.round(dpr * DOT));
    var w = Math.max(8, Math.round(cw * dpr / cell)), h = Math.max(8, Math.round(ch * dpr / cell));
    canvas.width = w; canvas.height = h;

    var tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    var t = tmp.getContext('2d', { willReadFrequently: true });
    t.imageSmoothingEnabled = true;
    t.imageSmoothingQuality = 'high';
    // object-fit: cover
    var s = Math.max(w / sw, h / sh), dw = sw * s, dh = sh * s;
    t.fillStyle = '#fff'; t.fillRect(0, 0, w, h);
    t.drawImage(source, (w - dw) * fx, (h - dh) * fy, dw, dh);

    var px = t.getImageData(0, 0, w, h).data, n = w * h, v = new Float32Array(n), i, hist = new Uint32Array(256);
    for (i = 0; i < n; i++) {
      var l = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
      v[i] = l; hist[l | 0]++;
    }

    // Stretch levels between the 1st and 99th percentile, then apply the brightness curve.
    var lo = 0, hi = 255, acc = 0;
    if (!source.isPlaceholder) {
      for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.01) { lo = i; break; } }
      acc = 0;
      for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.01) { hi = i; break; } }
      if (hi - lo < 16) { lo = Math.max(0, lo - 8); hi = Math.min(255, hi + 8); }
    }
    for (i = 0; i < n; i++) {
      var u = Math.min(1, Math.max(0, (v[i] - lo) / (hi - lo)));
      v[i] = source.isPlaceholder ? u : Math.pow(u, GAMMA);
    }

    // Light sharpening so edges survive the dithering (3x3 box blur, subtracted).
    if (!source.isPlaceholder) {
      var sharp = new Float32Array(n), x, y, xx, yy, sum, cnt;
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          sum = 0; cnt = 0;
          for (yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) {
            for (xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) { sum += v[yy * w + xx]; cnt++; }
          }
          var val = v[y * w + x] + 0.6 * (v[y * w + x] - sum / cnt);
          sharp[y * w + x] = val < 0 ? 0 : val > 1 ? 1 : val;
        }
      }
      v = sharp;
    }

    // Floyd-Steinberg error diffusion to four levels, scanning in alternating directions.
    var pal = palette(), LEVELS = 3;
    var ctx = canvas.getContext('2d'), img = ctx.createImageData(w, h), o = img.data;
    var q0 = new Uint8Array(n), left = new Float32Array(n);
    var xs, xe, dir, k, old, qi, err, c;
    for (y = 0; y < h; y++) {
      dir = (y & 1) ? -1 : 1;
      xs = dir > 0 ? 0 : w - 1;
      xe = dir > 0 ? w : -1;
      for (x = xs; x !== xe; x += dir) {
        k = y * w + x;
        old = v[k];
        qi = Math.round(old * LEVELS);
        qi = qi < 0 ? 0 : qi > LEVELS ? LEVELS : qi;
        q0[k] = qi;
        left[k] = old * LEVELS - qi;   // how close this dot was to rounding the other way (-0.5 to 0.5)
        err = old - qi / LEVELS;
        c = pal[qi];
        o[k * 4] = c[0]; o[k * 4 + 1] = c[1]; o[k * 4 + 2] = c[2]; o[k * 4 + 3] = 255;
        if (x + dir >= 0 && x + dir < w) v[k + dir] += err * 7 / 16;
        if (y + 1 < h) {
          if (x - dir >= 0 && x - dir < w) v[k + w - dir] += err * 3 / 16;
          v[k + w] += err * 5 / 16;
          if (x + dir >= 0 && x + dir < w) v[k + w + dir] += err * 1 / 16;
        }
      }
    }
    ctx.putImageData(img, 0, 0);   // the clean, still picture

    // Dots that nearly rounded the other way are the ones allowed to twinkle.
    var idxList = [], altList = [], f, a2;
    for (k = 0; k < n; k++) {
      f = left[k];
      if (Math.abs(f) < 0.5 - GRAIN || Math.abs(f) > 0.5001) continue;
      a2 = f > 0 ? q0[k] + 1 : q0[k] - 1;
      if (a2 < 0 || a2 > LEVELS) continue;
      idxList.push(k); altList.push(a2);
    }
    var ph = new Float32Array(idxList.length);
    for (i = 0; i < ph.length; i++) ph[i] = Math.random() * Math.PI * 2;

    var visible = canvas.__visible;
    canvas.__dither = { img: img, ctx: ctx, pal: pal, q0: q0, ambIdx: Int32Array.from(idxList), ambAlt: Uint8Array.from(altList), phase: ph };
    canvas.__visible = visible;
    watch(canvas);
  }

  window.Dither = { tile: tile, placeholder: placeholder };
})();
