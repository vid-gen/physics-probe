(() => {
  const deck = document.querySelector('.control-deck');
  if (!deck) return;

  const cards = Array.from(deck.querySelectorAll('.matched'));
  const videos = cards.map(card => card.querySelector('video'));
  const nav = deck.querySelector('.control-deck__nav');
  const family = nav.querySelector('[data-family]');
  const position = deck.querySelector('[data-position]');
  const announcement = deck.querySelector('[data-announcement]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const holdMs = 7000;

  let index = 0;
  let inView = !('IntersectionObserver' in window);
  let hovered = matchMedia('(hover: hover)').matches && deck.matches(':hover');
  let keyboardFocus = false;
  let resumeOnView = !motion.matches;
  let remaining = holdMs;
  let startedAt = 0;
  let timer = null;

  function stopClock() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (performance.now() - startedAt));
  }

  function canCount() {
    return !motion.matches && inView && !document.hidden && !hovered && !keyboardFocus
      && !document.fullscreenElement && videos[index].ended;
  }

  function syncClock() {
    if (!canCount()) {
      stopClock();
      return;
    }
    if (timer !== null) return;
    startedAt = performance.now();
    timer = setTimeout(() => {
      timer = null;
      remaining = 0;
      if (canCount()) select(index + 1);
    }, remaining);
  }

  function syncPlayback() {
    const video = videos[index];
    if (!inView || document.hidden) {
      if (!video.paused) {
        resumeOnView = !video.ended;
        video.pause();
      }
    } else if (resumeOnView) {
      resumeOnView = false;
      // Browsers that block inline playback still provide native play controls.
      video.play().catch(() => {});
    }
    syncClock();
  }

  function select(next, announce = false) {
    stopClock();
    videos[index].pause();
    index = (next + cards.length) % cards.length;
    const active = cards[index];
    cards.forEach((card, n) => {
      card.classList.toggle('is-active', n === index);
      card.inert = n !== index;
    });
    const label = String(index + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
    position.textContent = label;
    family.textContent = active.dataset.family;
    if (announce) announcement.textContent = active.getAttribute('aria-label');
    const video = videos[index];
    video.currentTime = 0;
    remaining = holdMs;
    resumeOnView = !motion.matches;
    syncPlayback();
  }

  videos.forEach((video, n) => {
    const card = cards[n];
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', (n + 1) + ' of ' + cards.length + '. ' + card.querySelector('h3').textContent);
    video.addEventListener('ended', () => {
      if (n !== index || !video.ended) return;
      stopClock();
      remaining = holdMs;
      syncClock();
    });
    for (const event of ['play', 'seeking']) {
      video.addEventListener(event, () => {
        if (n !== index || video.ended) return;
        stopClock();
        remaining = holdMs;
      });
    }
  });

  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-step]');
    if (button) select(index + Number(button.dataset.step), true);
  });
  deck.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    syncClock();
  });
  deck.addEventListener('pointerleave', event => {
    if (event.pointerType === 'touch') return;
    hovered = false;
    syncClock();
  });
  deck.addEventListener('pointerdown', () => { keyboardFocus = false; syncClock(); });
  deck.addEventListener('focusin', event => {
    keyboardFocus = event.target.matches(':focus-visible');
    syncClock();
  });
  deck.addEventListener('focusout', event => {
    if (!deck.contains(event.relatedTarget)) { keyboardFocus = false; syncClock(); }
  });
  deck.addEventListener('keydown', event => {
    if (event.target.closest('video')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    keyboardFocus = true;
    select(index + (event.key === 'ArrowLeft' ? -1 : 1), true);
  });
  motion.addEventListener('change', () => {
    resumeOnView = !motion.matches && !videos[index].ended;
    if (motion.matches) videos[index].pause();
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  document.addEventListener('fullscreenchange', syncClock);
  function linkedCard() {
    return cards.findIndex(card => '#' + card.id === location.hash);
  }
  window.addEventListener('hashchange', () => {
    const target = linkedCard();
    if (target >= 0 && target !== index) select(target);
  });

  deck.classList.add('is-ready');
  deck.setAttribute('aria-roledescription', 'carousel');
  nav.hidden = false;
  select(Math.max(0, linkedCard()));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= .3;
      syncPlayback();
    }, {threshold: [0, .3]}).observe(deck.querySelector('.control-deck__slides'));
  }
})();
