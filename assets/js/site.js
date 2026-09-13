/* LA Fence Craft — site behaviour. No dependencies. */
(function () {
  'use strict';

  /* ---- mobile nav ---- */
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', String(!open));
      burger.setAttribute('aria-expanded', String(!open));
    });
  }

  /* ---- estimate form ----
     Single page, one submit. Validation is the browser's own so it stays
     accessible and localised.

     Submits to Netlify Forms by default -- no third-party account, and it's
     built into the host this site already deploys to. Netlify detects the
     form from its static HTML attributes (name + data-netlify="true") at
     deploy time, so nothing else needs registering. Email notification to
     info@lafencecraft.com is a one-time Netlify dashboard setting (Site
     settings -> Forms -> Notifications) -- that step can't be done from code,
     Netlify requires it be set there.

     If FORM_ENDPOINT is also set in build.py, a second copy is sent there too
     (e.g. a CRM webhook) as a fire-and-forget -- it never blocks or fails the
     primary Netlify submission a visitor is waiting on. */
  document.querySelectorAll('.form-card').forEach(function (form) {
    var errorBox = document.createElement('p');
    errorBox.className = 'form-error';
    form.appendChild(errorBox);

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.classList.add('show');
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showSuccess() {
      var done = form.querySelector('[data-success]');
      if (done) {
        Array.prototype.forEach.call(form.children, function (n) {
          if (n !== done) n.hidden = true;
        });
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (window.dataLayer) window.dataLayer.push({ event: 'estimate_request' });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorBox.classList.remove('show');

      var ok = true;
      form.querySelectorAll('[required]').forEach(function (el) {
        if (!el.checkValidity()) { if (ok) el.reportValidity(); ok = false; }
      });
      if (!ok) return;

      // Honeypot: a real visitor never sees or fills this field. Netlify's own
      // spam filter also reads it via data-netlify-honeypot, but checking it
      // here too means a bot submission never even reaches the network.
      var hp = form.querySelector('input[name="website"]');
      if (hp && hp.value) return;

      form.classList.add('form-submitting');
      var data = new FormData(form);

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString()
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Netlify Forms responded ' + res.status);
          showSuccess();
        })
        .catch(function () {
          // Never claim success on a failed request -- say so plainly and
          // give the phone number as a fallback.
          showError('Something went wrong sending your request. Please call ' +
            '(626) 586-3378 and we\\u2019ll get it handled directly.');
        })
        .finally(function () {
          form.classList.remove('form-submitting');
        });

      // Optional second destination. Fire-and-forget: intentionally not
      // awaited or chained onto the block above, so a slow or unreachable
      // secondary endpoint can never affect the primary submission's result.
      var endpoint = form.dataset.endpoint;
      if (endpoint) {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(data))
        }).catch(function () { /* secondary destination only -- ignore failures */ });
      }
    });
  });

  /* ---- reduced motion ----
     Read once and shared by the video and the scroll reveal below. Both features
     must respect it, so it lives here rather than being queried twice. */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- scroll reveal ----
     Content is only ever hidden by JS, never by CSS, and there are three
     independent ways it becomes visible again: the observer fires, the element
     was already on screen at load, or the 1.5s safety net runs. A reveal effect
     must never be the reason a customer can't read the page. */
  var targets = document.querySelectorAll('[data-reveal]');

  function reveal(el) {
    el.style.transition = 'opacity .6s ease, transform .6s ease';
    el.style.opacity = 1;
    el.style.transform = 'none';
  }

  if (!reduce && 'IntersectionObserver' in window && targets.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
      });
    }, { rootMargin: '200px 0px 0px 0px' });

    targets.forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 1.2) return;
      el.style.opacity = 0;
      el.style.transform = 'translateY(14px)';
      io.observe(el);
    });

    setTimeout(function () { targets.forEach(reveal); }, 1500);
  }

  /* ---- hero video: connection-aware, deferred ----
     The poster image renders first and always. The video only ever attaches
     after the page has painted, and only if the connection can afford it, so
     it can never delay the largest paint or burn a metered plan.

     Decided in JS rather than by a CSS width query on purpose: an iPhone 14 Pro
     Max reports a 430px viewport, so a breakpoint would have hidden the video
     on exactly the phones most likely to have a good connection. */
  // A page can carry more than one video mount (e.g. the showroom pagehead
  // background plus a video further down the page), so every mount here is
  // attached independently rather than assuming there's only one.
  var videoMounts = document.querySelectorAll('[data-hero-video]');
  videoMounts.forEach(function (videoMount) {
    if (!videoMount || reduce) return;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var slow = false;

    if (conn) {
      // Respect Data Saver, and skip anything at or below slow-3G.
      if (conn.saveData === true) slow = true;
      if (/^(slow-2g|2g|3g)$/.test(conn.effectiveType || '')) slow = true;
    }

    if (!slow) {
      var attach = function () {
        var id = videoMount.dataset.heroVideo;
        var f = document.createElement('iframe');
        f.className = 'hero-video';
        f.title = 'LA Fence Craft installation work';
        f.setAttribute('allow', 'autoplay; encrypted-media');
        f.setAttribute('aria-hidden', 'true');
        f.setAttribute('tabindex', '-1');
        f.src = 'https://www.youtube-nocookie.com/embed/' + id +
          '?autoplay=1&mute=1&loop=1&playlist=' + id +
          '&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1' +
          '&disablekb=1&iv_load_policy=3';
        videoMount.appendChild(f);
      };

      // Wait for load, then for an idle moment, so the poster paints first.
      var start = function () {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(attach, { timeout: 2500 });
        } else {
          setTimeout(attach, 900);
        }
      };
      if (document.readyState === 'complete') start();
      else window.addEventListener('load', start);

      // If the connection degrades mid-session, don't keep streaming.
      if (conn && conn.addEventListener) {
        conn.addEventListener('change', function () {
          if (conn.saveData === true || /^(slow-2g|2g)$/.test(conn.effectiveType || '')) {
            var f = videoMount.querySelector('.hero-video');
            if (f) f.remove();
          }
        });
      }
    }
  });

  /* ---- slideshow ----
     Every slide is in the DOM and readable without JS; this only adds the
     sliding. Keyboard, swipe and dots all drive the same setSlide(). */
  document.querySelectorAll('[data-slides]').forEach(function (root) {
    var track = root.querySelector('.slides-track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
    var dotsWrap = root.parentNode.querySelector('.slides-dots');
    var count = root.querySelector('.slides-count');
    var i = 0;
    if (slides.length < 2) return;

    var dots = slides.map(function (s, n) {
      var d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', 'Go to slide ' + (n + 1));
      d.addEventListener('click', function () { setSlide(n); });
      if (dotsWrap) dotsWrap.appendChild(d);
      return d;
    });

    function setSlide(n) {
      i = (n + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      slides.forEach(function (s, k) {
        s.setAttribute('aria-hidden', String(k !== i));
        // Keep off-screen slides out of the tab order.
        s.querySelectorAll('a,button').forEach(function (el) {
          el.tabIndex = k === i ? 0 : -1;
        });
      });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', String(k === i)); });
      if (count) count.textContent = (i + 1) + ' / ' + slides.length;
    }

    root.querySelectorAll('[data-prev]').forEach(function (b) {
      b.addEventListener('click', function () { setSlide(i - 1); });
    });
    root.querySelectorAll('[data-next]').forEach(function (b) {
      b.addEventListener('click', function () { setSlide(i + 1); });
    });

    root.setAttribute('tabindex', '0');
    root.setAttribute('role', 'region');
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); setSlide(i - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setSlide(i + 1); }
    });

    var x0 = null;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) setSlide(i + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });

    setSlide(0);
  });

  /* ---- projects filter ----
     Two independent axes (product and material) combined with AND, plus a
     third: the material buttons narrow to only what actually has photos under
     the selected product (WordPress's /portfolio/ did this and it is worth
     matching -- a "Composite" button with zero patio-cover photos behind it is
     worse than not offering the button).

     No photos are capped server-side. Every real photo is in the DOM; a
     "Show more" button reveals them in batches so a visitor who wants to keep
     scrolling can see the whole library, not just a fixed sample.

     Both product and material are written to the URL via replaceState so a
     filtered view is shareable. Progressive enhancement: with JS off every
     tile is visible and un-paginated. */
  var filterBar = document.querySelector('.filters');
  if (filterBar) {
    var tiles = document.querySelectorAll('.tile');
    var counter = document.querySelector('[data-count]');
    var empty = document.querySelector('[data-empty]');
    var loadMoreBtn = document.querySelector('[data-load-more]');
    var prodBtns = document.querySelectorAll('[data-filter]');
    var matBtns = document.querySelectorAll('[data-mat]');
    var state = { cat: 'all', mat: 'all' };

    var PAGE_SIZE = 24;
    var revealed = PAGE_SIZE;

    var pmMapEl = document.getElementById('pm-map');
    var prodMatMap = {};
    if (pmMapEl) {
      try { prodMatMap = JSON.parse(pmMapEl.textContent); } catch (e) { prodMatMap = {}; }
    }
    // "all materials" = union across every product, for when no product filter is set.
    var allMaterials = Array.prototype.reduce.call(
      Object.keys(prodMatMap), function (acc, p) {
        prodMatMap[p].forEach(function (m) { if (acc.indexOf(m) < 0) acc.push(m); });
        return acc;
      }, []);

    function labelFor(key, attr) {
      var b = document.querySelector('[' + attr + '="' + key + '"]');
      return b ? b.textContent : key;
    }

    function updateMaterialButtons() {
      var avail = state.cat === 'all' ? allMaterials : (prodMatMap[state.cat] || []);
      matBtns.forEach(function (b) {
        var key = b.dataset.mat;
        var show = key === 'all' || avail.indexOf(key) > -1;
        b.hidden = !show;
      });
      // If the currently selected material no longer applies, fall back to "all"
      // rather than showing a filter with nothing behind it.
      if (state.mat !== 'all' && avail.indexOf(state.mat) < 0) state.mat = 'all';
    }

    function apply(push, resetPaging) {
      if (resetPaging) revealed = PAGE_SIZE;
      updateMaterialButtons();

      var matching = 0, shown = 0;
      tiles.forEach(function (t) {
        // data-cat is usually one category, but a tile (e.g. the video
        // walkthrough) can legitimately belong to more than one — space-
        // separated, e.g. data-cat="fences gates".
        var cats = (t.dataset.cat || '').split(' ');
        var ok = (state.cat === 'all' || cats.indexOf(state.cat) > -1) &&
                 (state.mat === 'all' || t.dataset.material === state.mat);
        if (ok) {
          matching++;
          var withinPage = matching <= revealed;
          t.hidden = !withinPage;
          if (withinPage) shown++;
        } else {
          t.hidden = true;
        }
      });

      prodBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.filter === state.cat));
      });
      matBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.mat === state.mat));
      });

      if (counter) {
        if (state.cat === 'all' && state.mat === 'all') {
          counter.textContent = 'Showing ' + shown + ' of ' + matching + ' projects';
        } else {
          var bits = [];
          if (state.cat !== 'all') bits.push(labelFor(state.cat, 'data-filter'));
          if (state.mat !== 'all') bits.push(labelFor(state.mat, 'data-mat'));
          counter.textContent = (matching === 0 ? 'No projects' :
            'Showing ' + shown + ' of ' + matching) + ' \u2014 ' + bits.join(' \u00b7 ');
        }
      }
      if (empty) empty.hidden = matching !== 0;
      if (loadMoreBtn) {
        var remaining = matching - shown;
        loadMoreBtn.hidden = remaining <= 0;
        if (remaining > 0) loadMoreBtn.textContent = 'Show ' + Math.min(remaining, PAGE_SIZE) + ' more (' + remaining + ' left)';
      }

      if (push && window.history && history.replaceState) {
        var q = [];
        if (state.cat !== 'all') q.push('service=' + state.cat);
        if (state.mat !== 'all') q.push('material=' + state.mat);
        history.replaceState({ s: state.cat, m: state.mat }, '',
          location.pathname + (q.length ? '?' + q.join('&') : ''));
      }
    }

    document.addEventListener('click', function (e) {
      var p = e.target.closest('[data-filter]');
      var m = e.target.closest('[data-mat]');
      var lm = e.target.closest('[data-load-more]');
      if (p) { state.cat = p.dataset.filter; apply(true, true); }
      if (m) { state.mat = m.dataset.mat; apply(true, true); }
      if (lm) { revealed += PAGE_SIZE; apply(false, false); }
    });

    var q = new URLSearchParams(location.search);
    var qs = q.get('service'), qm = q.get('material');
    if (qs && document.querySelector('[data-filter="' + qs + '"]')) state.cat = qs;
    if (qm && document.querySelector('[data-mat="' + qm + '"]')) state.mat = qm;
    apply(false, true);

    window.addEventListener('popstate', function (e) {
      var p = new URLSearchParams(location.search);
      state.cat = (e.state && e.state.s) || p.get('service') || 'all';
      state.mat = (e.state && e.state.m) || p.get('material') || 'all';
      apply(false, true);
    });
  }

  /* ---- lightbox ----
     One shared overlay for every gallery on the site (service pages, material
     pages, the showroom page, /projects/). Built once, reused via delegated
     click handling so it works on tiles added later by the portfolio filter's
     "Show more" button without any extra wiring.

     Keyboard: Escape closes, Left/Right move between photos currently visible
     in whichever grid was clicked — on /projects/, that means hidden (filtered
     out) tiles are correctly skipped. Focus returns to the trigger on close. */
  var lb = null, lbImg, lbCaption, lbCounter, lbGroup = [], lbIndex = 0, lbLastFocus = null;

  function buildLightbox() {
    lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo viewer');
    lb.hidden = true;
    lb.innerHTML =
      '<button type="button" class="lb-close" aria-label="Close">&times;</button>' +
      '<button type="button" class="lb-nav lb-prev" aria-label="Previous photo">&#8249;</button>' +
      '<figure class="lb-figure">' +
        '<img class="lb-img" alt="">' +
        '<figcaption class="lb-caption"></figcaption>' +
      '</figure>' +
      '<button type="button" class="lb-nav lb-next" aria-label="Next photo">&#8250;</button>' +
      '<span class="lb-count"></span>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector('.lb-img');
    lbCaption = lb.querySelector('.lb-caption');
    lbCounter = lb.querySelector('.lb-count');

    // Delegated backdrop click (click outside the photo closes it)...
    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLightbox();
    });
    // ...plus direct listeners on each control, rather than relying only on
    // closest() delegation from the backdrop handler above. Belt and suspenders:
    // if any browser has a quirk with bubbling or hit-testing inside a
    // position:fixed overlay, a listener bound straight to the button itself
    // is the more robust path and doesn't depend on event delegation at all.
    lb.querySelector('.lb-close').addEventListener('click', closeLightbox);
    lb.querySelector('.lb-next').addEventListener('click', function () { show(lbIndex + 1); });
    lb.querySelector('.lb-prev').addEventListener('click', function () { show(lbIndex - 1); });
  }

  function show(i) {
    lbIndex = (i + lbGroup.length) % lbGroup.length;
    var t = lbGroup[lbIndex];
    lbImg.src = t.dataset.lightbox;
    lbImg.alt = t.dataset.caption || '';
    lbCaption.textContent = t.dataset.caption || '';
    lbCounter.textContent = lbGroup.length > 1 ? (lbIndex + 1) + ' / ' + lbGroup.length : '';
    var multi = lbGroup.length > 1;
    lb.querySelector('.lb-prev').hidden = !multi;
    lb.querySelector('.lb-next').hidden = !multi;
  }

  function openLightbox(trigger) {
    if (!lb) buildLightbox();
    // The group is every visible (not filter-hidden) trigger sharing the same
    // grid as the one clicked, so prev/next only ever move within what the
    // visitor can actually see right now.
    var grid = trigger.closest('.grid') || document;
    lbGroup = Array.prototype.filter.call(
      grid.querySelectorAll('.lb-trigger'),
      function (el) { return !el.closest('[hidden]'); }
    );
    lbIndex = lbGroup.indexOf(trigger);
    if (lbIndex < 0) { lbGroup = [trigger]; lbIndex = 0; }
    lbLastFocus = trigger;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    show(lbIndex);
    lb.querySelector('.lb-close').focus();
  }

  function closeLightbox() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    document.body.style.overflow = '';
    if (lbLastFocus) lbLastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.lb-trigger');
    if (trigger) openLightbox(trigger);
  });

  document.addEventListener('keydown', function (e) {
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') show(lbIndex + 1);
    if (e.key === 'ArrowLeft') show(lbIndex - 1);
  });

  /* ---- video modal ----
     Pairs with a muted, autoplaying [data-hero-video] preview: click it and a
     full player opens with sound and native YouTube controls (play/pause,
     seek, volume), independent of whatever the background preview is doing.
     Closing the modal just clears the iframe src, which stops playback. */
  var vm = null, vmLastFocus = null;

  function buildVideoModal() {
    vm = document.createElement('div');
    vm.className = 'video-modal';
    vm.setAttribute('role', 'dialog');
    vm.setAttribute('aria-modal', 'true');
    vm.setAttribute('aria-label', 'Video player');
    vm.hidden = true;
    vm.innerHTML =
      '<div class="video-modal-inner"><button type="button" class="lb-close" aria-label="Close">&times;</button></div>';
    document.body.appendChild(vm);

    vm.addEventListener('click', function (e) {
      if (e.target === vm) closeVideoModal();
    });
    vm.querySelector('.lb-close').addEventListener('click', closeVideoModal);
  }

  function openVideoModal(id, trigger) {
    if (!vm) buildVideoModal();
    var inner = vm.querySelector('.video-modal-inner');
    var f = document.createElement('iframe');
    f.title = 'LA Fence Craft video';
    f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    f.setAttribute('allowfullscreen', '');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id +
      '?autoplay=1&controls=1&rel=0&playsinline=1&modestbranding=1';
    inner.appendChild(f);
    vmLastFocus = trigger || document.activeElement;
    vm.hidden = false;
    document.body.style.overflow = 'hidden';
    vm.querySelector('.lb-close').focus();
  }

  function closeVideoModal() {
    if (!vm || vm.hidden) return;
    var f = vm.querySelector('iframe');
    if (f) f.remove(); // clearing the iframe stops playback, not just hides it
    vm.hidden = true;
    document.body.style.overflow = '';
    if (vmLastFocus) vmLastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.video-trigger');
    if (trigger) openVideoModal(trigger.dataset.videoModal, trigger);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      var trigger = e.target.closest && e.target.closest('.video-trigger');
      if (trigger) { e.preventDefault(); openVideoModal(trigger.dataset.videoModal, trigger); }
    }
    if (!vm || vm.hidden) return;
    if (e.key === 'Escape') closeVideoModal();
  });

  /* ---- call tracking hook ---- */
  document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (window.dataLayer) window.dataLayer.push({ event: 'phone_call_click' });
    });
  });
})();

/* ---- video-card click-to-play facade (YouTube nocookie embed swap) ---- */
function playLFCVideo(el, id) {
  el.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1" title="LA Fence Craft installation walkthrough" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
  el.classList.add('is-playing');
  el.removeAttribute('onclick');
  el.removeAttribute('onkeydown');
  el.removeAttribute('role');
  el.removeAttribute('tabindex');
}
