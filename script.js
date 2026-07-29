// script.js — Phase 5 final
// Responsibilities:
// - Build 62 PDF-style pages (image-01.jpg ... image-62.jpg)
// - Lazy-load images with IntersectionObserver and smooth reveal (fade + soft zoom)
// - Intro animation (letter-by-letter) and cinematic ENTER transition
// - Category -> section cinematic scroll with camera effect
// - Scroll-spy to highlight active category
// - Back-to-top button
// - Responsive and performance-aware (respects prefers-reduced-motion)
//
// Keep code minimal and efficient; no external libraries.

(function () {
  'use strict';

  /* -------------------------
     Config & State
     ------------------------- */
  const CONFIG = {
    IMAGE_COUNT: 62,
    IMAGE_DIR: '',
    IMAGE_PREFIX: 'image-',
    IMAGE_EXT: 'jpg',
    PAGE_SELECTOR: '#viewer-inner',
    INTRO_ID: 'intro-overlay',
    CAMERA_EFFECT_MS: 700,
    LAZY_ROOT_MARGIN: '420px 0px',
    LAZY_THRESHOLD: 0.02,
    PRELOAD_ADJACENT: true,
    BACK_TO_TOP_SHOW_PX: 600
  };

  const CATEGORY_MAP_START = {
    profile: 3,
    logo: 4,
    poster: 8,
    print: 20,
    marketing: 36,
    packaging: 46,
    event: 50
  };

  // Derived category ranges for scroll-spy (inclusive)
  const CATEGORY_RANGES = {
    profile: [3, 3],
    logo: [4, 7],
    poster: [8, 19],
    print: [20, 35],
    marketing: [36, 45],
    packaging: [46, 49],
    event: [50, 62]
  };

  const state = {
    pages: [],
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    observer: null,
    spyObserver: null
  };

  /* -------------------------
     DOM helpers
     ------------------------- */
  const qs = (sel, scope = document) => scope.querySelector(sel);
  const qsa = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const pad = (n, d = 2) => String(n).padStart(d, '0');

  /* -------------------------
     Build pages metadata & render placeholders
     ------------------------- */
  function buildPages() {
    const pages = [];
    for (let i = 1; i <= CONFIG.IMAGE_COUNT; i++) {
      const idx = pad(i, 2);
      pages.push({
        id: i,
        idx,
        src: `${CONFIG.IMAGE_DIR}${CONFIG.IMAGE_PREFIX}${idx}.${CONFIG.IMAGE_EXT}`,
        loaded: false
      });
    }
    return pages;
  }

  function renderPlaceholders(pages) {
    const container = qs(CONFIG.PAGE_SELECTOR);
    if (!container) return;
    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    pages.forEach(p => {
      const article = document.createElement('article');
      article.className = 'page loading';
      article.id = `image-${p.idx}`;
      article.setAttribute('data-page-id', p.id);
      article.setAttribute('role', 'listitem');
      article.setAttribute('tabindex', '-1');
      article.setAttribute('aria-label', `Portfolio page ${p.id}`);

      const inner = document.createElement('div');
      inner.className = 'page-inner';

      const placeholder = document.createElement('div');
      placeholder.className = 'placeholder';

      const img = document.createElement('img');
      img.className = 'page-img';
      img.setAttribute('data-src', p.src);
      img.setAttribute('alt', `Portfolio page ${p.id}`);
      img.setAttribute('decoding', 'async');
      img.setAttribute('loading', 'lazy');

      inner.appendChild(placeholder);
      inner.appendChild(img);
      article.appendChild(inner);
      frag.appendChild(article);
    });

    container.appendChild(frag);
  }

  /* -------------------------
     Lazy-load logic
     ------------------------- */
  function onIntersect(entries, obs) {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.classList.contains('revealed')) {
        obs.unobserve(el);
        return;
      }
      loadImageFor(el);
      obs.unobserve(el);
    });
  }

  function loadImageFor(pageEl) {
    const img = pageEl.querySelector('img.page-img');
    if (!img) return;
    const src = img.dataset.src;
    if (!src) return;
    if (img.dataset.loaded === 'true') return;

    const loader = new Image();
    loader.decoding = 'async';
    loader.src = src;

    loader.onload = () => {
      img.src = src;
      img.dataset.loaded = 'true';
      requestAnimationFrame(() => {
        pageEl.classList.add('revealed');
        pageEl.classList.remove('loading');
      });
      // remove placeholder after transition
      setTimeout(() => {
        const ph = pageEl.querySelector('.placeholder');
        if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
      }, 600);

      // preload next
      if (CONFIG.PRELOAD_ADJACENT) {
        const id = parseInt(pageEl.getAttribute('data-page-id'), 10);
        if (!isNaN(id)) preloadAdjacent(id);
      }
    };

    loader.onerror = () => {
      pageEl.classList.remove('loading');
      const ph = pageEl.querySelector('.placeholder');
      if (ph) ph.textContent = `Page ${pageEl.getAttribute('data-page-id')} — image not found`;
    };
  }

  function preloadAdjacent(pageId) {
    const next = pageId + 1;
    if (next > CONFIG.IMAGE_COUNT) return;
    const nextIdx = pad(next, 2);
    const nextSrc = `${CONFIG.IMAGE_DIR}${CONFIG.IMAGE_PREFIX}${nextIdx}.${CONFIG.IMAGE_EXT}`;
    const pageEl = qs(`#image-${nextIdx}`);
    if (pageEl) {
      const img = pageEl.querySelector('img.page-img');
      if (img && !img.dataset.loaded && !img.dataset.prefetched) {
        const p = new Image();
        p.src = nextSrc;
        p.onload = () => { if (img) img.dataset.prefetched = 'true'; };
      }
    }
  }

  function initObserver() {
    if (!('IntersectionObserver' in window)) {
      // fallback: load first 6 images to avoid big blocking
      const immediate = qsa('.page').slice(0, 6);
      immediate.forEach(p => loadImageFor(p));
      return;
    }
    state.observer = new IntersectionObserver(onIntersect, {
      root: null,
      rootMargin: CONFIG.LAZY_ROOT_MARGIN,
      threshold: CONFIG.LAZY_THRESHOLD
    });
    qsa('.page').forEach(p => state.observer.observe(p));
  }

  function eagerLoadInitial(n = 2) {
    for (let i = 1; i <= n; i++) {
      const el = qs(`.page[data-page-id="${i}"]`);
      if (el) loadImageFor(el);
    }
  }

  /* -------------------------
     Intro sequence (letter-by-letter) and enter transition
     ------------------------- */
  function playIntro() {
    const overlay = qs(`#${CONFIG.INTRO_ID}`);
    const wordsContainer = qs('#intro-words');
    if (!overlay || !wordsContainer) return;

    const raw = 'PORTFOLIO';
    wordsContainer.innerHTML = '';
    const letters = Array.from(raw);
    letters.forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'word';
      s.textContent = ch;
      s.style.setProperty('--i', i);
      wordsContainer.appendChild(s);
    });

    const nodes = qsa('.word', wordsContainer);
    if (state.reducedMotion) {
      nodes.forEach(n => n.classList.add('show'));
      qs('#intro-sub')?.classList.add('show');
      qs('#enter-btn')?.classList.add('visible');
      afterIntroReady();
      return;
    }

    nodes.forEach((n, i) => {
      setTimeout(() => n.classList.add('show'), i * 82);
    });

    setTimeout(() => {
      qs('#intro-sub')?.classList.add('show');
      setTimeout(() => qs('#enter-btn')?.classList.add('visible'), 260);
      // after a small pause, allow interaction
      setTimeout(afterIntroReady, 900);
    }, nodes.length * 82 + 160);
  }

  function afterIntroReady() {
    // reveal categories (stagger) if present
    qs('.categories-grid')?.classList.add('loaded');
    // keep overlay until enter click
    setupEnter();
  }

  function setupEnter() {
    const enter = qs('#enter-btn');
    if (!enter) return;
    enter.addEventListener('click', (e) => {
      e.preventDefault();
      const overlay = qs(`#${CONFIG.INTRO_ID}`);
      const ripple = enter.querySelector('.ripple');
      if (ripple) {
        ripple.classList.remove('animate');
        void ripple.offsetWidth;
        ripple.classList.add('animate');
      }
      if (state.reducedMotion) {
        finalizeIntro();
        return;
      }
      document.body.classList.add('camera-effect');
      overlay.classList.add('hidden');
      setTimeout(() => {
        document.body.classList.remove('camera-effect');
        finalizeIntro();
      }, 900);
    });

    enter.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        enter.click();
      }
    });
  }

  function finalizeIntro() {
    const overlay = qs(`#${CONFIG.INTRO_ID}`);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.body.classList.remove('locked');
    document.body.setAttribute('data-ready', 'true');
    // focus hero for accessibility
    const hero = qs('#hero');
    if (hero) hero.focus({preventScroll: true});
  }

  /* -------------------------
     Cinematic scroll to target page
     ------------------------- */
  function cinematicScrollToPage(pageId) {
    const target = qs(`#image-${pad(pageId,2)}`);
    if (!target) return;
    // start loading immediately
    loadImageFor(target);

    if (state.reducedMotion) {
      target.scrollIntoView({behavior: 'auto', block: 'start'});
      target.focus({preventScroll: true});
      return;
    }

    document.body.classList.add('camera-effect');
    target.scrollIntoView({behavior: 'smooth', block: 'start'});
    setTimeout(() => {
      document.body.classList.remove('camera-effect');
      try { target.focus({preventScroll: true}); } catch (err) { /* noop */ }
    }, CONFIG.CAMERA_EFFECT_MS + 120);
  }

  /* -------------------------
     Wire category buttons and header nav
     ------------------------- */
  function wireCategoryButtons() {
    const buttons = qsa('.category-card, .nav-item');
    buttons.forEach(b => {
      b.addEventListener('click', () => {
        const key = b.getAttribute('data-target');
        if (!key) return;
        const start = CATEGORY_MAP_START[key];
        if (!start) return;
        cinematicScrollToPage(start);
      });
    });

    // "View Portfolio" → first page
    const view = qs('#view-portfolio');
    if (view) view.addEventListener('click', () => cinematicScrollToPage(1));
  }

  /* -------------------------
     Scroll-spy: highlight active category
     ------------------------- */
  function spyIntersection(entries) {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      // find page id
      const id = parseInt(entry.target.getAttribute('data-page-id'), 10);
      if (isNaN(id)) return;
      // determine category by ranges
      const cat = findCategoryFor(id);
      if (!cat) return;
      setActiveCategory(cat);
    });
  }

  function findCategoryFor(pageId) {
    for (const [cat, range] of Object.entries(CATEGORY_RANGES)) {
      if (pageId >= range[0] && pageId <= range[1]) return cat;
    }
    // fallback: return 'profile' if not found
    return null;
  }

  let activeCategory = null;
  function setActiveCategory(cat) {
    if (activeCategory === cat) return;
    activeCategory = cat;
    // nav items
    qsa('.nav-item').forEach(n => {
      if (n.getAttribute('data-target') === cat) n.classList.add('active'); else n.classList.remove('active');
    });
    // category cards
    qsa('.category-card').forEach(c => {
      if (c.getAttribute('data-target') === cat) c.classList.add('active'); else c.classList.remove('active');
    });
  }

  function initSpyObserver() {
    if (!('IntersectionObserver' in window)) return;
    // Observe pages with threshold array to detect meaningful presence
    state.spyObserver = new IntersectionObserver(spyIntersection, {
      root: null,
      rootMargin: '-30% 0px -40% 0px',
      threshold: 0.25
    });
    qsa('.page').forEach(p => state.spyObserver.observe(p));
  }

  /* -------------------------
     Back-to-top button
     ------------------------- */
  function setupBackToTop() {
    const btn = qs('#back-to-top');
    if (!btn) return;
    const onScroll = throttle(() => {
      if (window.scrollY > CONFIG.BACK_TO_TOP_SHOW_PX) btn.classList.add('visible'); else btn.classList.remove('visible');
    }, 180);
    window.addEventListener('scroll', onScroll, {passive:true});
    btn.addEventListener('click', () => {
      if (state.reducedMotion) window.scrollTo({top:0});
      else window.scrollTo({top:0, behavior:'smooth'});
    });
  }

  /* -------------------------
     Utility: simple throttle
     ------------------------- */
  function throttle(fn, wait = 100) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  /* -------------------------
     App init
     ------------------------- */
 function init() {
    state.pages = buildPages();
    renderPlaceholders(state.pages);

    // start lazy loading
    initObserver();
    eagerLoadInitial(2);

    // skip intro animation
    finalizeIntro();
    qs('.categories-grid')?.classList.add('loaded');

    // wire nav & categories to scroll
    wireCategoryButtons();

    // scroll-spy
    initSpyObserver();

    // back to top
    setupBackToTop();
}

  /* -------------------------
     Run on DOM ready
     ------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
