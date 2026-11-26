(() => {
  const root = document.documentElement;
  const site = document.querySelector('.site');
  const rail = document.querySelector('.chapter-nav');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = Array.from(rail.querySelectorAll('a'), link => ({
    link,
    section: document.getElementById(link.hash.slice(1))
  }));
  let current = -1;
  let queued = false;

  function showPosition() {
    queued = false;
    const anchorLine = Math.min(window.innerHeight * .22, 150);
    const tops = chapters.map(entry => entry.section.getBoundingClientRect().top);
    let index = 0;
    for (let i = 1; i < tops.length; i++) {
      if (tops[i] <= anchorLine) index = i;
    }
    if (window.scrollY + window.innerHeight >= root.scrollHeight - 2) {
      index = chapters.length - 1;
    }
    if (index !== current) {
      if (current >= 0) chapters[current].link.removeAttribute('aria-current');
      chapters[index].link.setAttribute('aria-current', 'location');
      root.dataset.chapter = chapters[index].section.id;
      current = index;
    }
    const next = tops[index + 1];
    const fraction = next === undefined ? 0 : Math.max(0, Math.min(1, (anchorLine - tops[index]) / (next - tops[index])));
    rail.style.setProperty('--read-progress', ((index + fraction) / (chapters.length - 1)).toFixed(4));
  }
  function updatePosition() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(showPosition);
  }
  showPosition();
  window.addEventListener('scroll', updatePosition, { passive: true });
  window.addEventListener('resize', updatePosition, { passive: true });
  window.addEventListener('pageshow', updatePosition);
  window.addEventListener('hashchange', updatePosition);
  document.fonts?.ready.then(updatePosition);

  if (!root.classList.contains('title-sequence')) return;
  const opening = document.querySelector('.opening');
  const backdrop = opening.querySelector('.opening-backdrop');
  const replay = root.classList.contains('intro-requested');
  const destination = document.getElementById('paper-title');
  const title = opening.querySelector('.opening-title');
  title.replaceChildren(...destination.cloneNode(true).childNodes);
  const textRange = document.createRange();
  textRange.selectNodeContents(destination);

  // Start a scaled copy of the final typesetting at screen center, including the actual line breaks.
  function alignTitle() {
    if (!root.classList.contains('title-sequence')) return;
    const box = destination.getBoundingClientRect();
    const text = textRange.getBoundingClientRect();
    const css = getComputedStyle(destination);
    const scale = Math.min(1.65, opening.clientWidth * .94 / text.width, opening.clientHeight * .55 / text.height);
    const x = (opening.clientWidth - text.width * scale) / 2 - (text.left - box.left) * scale;
    const y = (opening.clientHeight - text.height * scale) / 2 - (text.top - box.top) * scale;
    const style = opening.style;
    style.setProperty('--title-end-x', box.left + 'px');
    style.setProperty('--title-end-y', box.top + 'px');
    style.setProperty('--title-from-x', x - box.left + 'px');
    style.setProperty('--title-from-y', y - box.top + 'px');
    style.setProperty('--title-from-scale', scale);
    style.setProperty('--title-ribbon-height', box.height * scale + 'px');
    style.setProperty('--title-line-width', box.width + 'px');
    style.setProperty('--title-font-size', css.fontSize);
    style.setProperty('--title-leading', css.lineHeight);
    style.setProperty('--title-tracking', css.letterSpacing);
    style.setProperty('--title-wrap', css.textWrap);
  }
  const resize = new ResizeObserver(alignTitle);
  let frame = 0;
  function updatePlayback() {
    cancelAnimationFrame(frame);
    if (document.hidden) {
      root.classList.add('intro-paused');
      return;
    }
    // Paint the starting frame before running the shared CSS timeline in a visible tab.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!document.hidden) root.classList.remove('intro-paused');
      });
    });
  }
  function onBackdropAnimation(event) {
    if (event.target !== backdrop || event.animationName !== 'uncover-page') return;
    if (event.type === 'animationstart') root.classList.add('cover-arriving');
    else reveal();
  }
  function reveal() {
    if (!root.classList.contains('title-sequence')) return;
    cancelAnimationFrame(frame);
    root.classList.remove('title-sequence','cover-arriving','intro-paused','intro-requested');
    site.inert = false;
    resize.disconnect();
    backdrop.removeEventListener('animationstart', onBackdropAnimation);
    backdrop.removeEventListener('animationend', onBackdropAnimation);
    document.removeEventListener('visibilitychange', updatePlayback);
    document.removeEventListener('keydown', skip);
    opening.removeEventListener('click', reveal);
    window.removeEventListener('pagehide', reveal);
    window.removeEventListener('hashchange', reveal);
    motion.removeEventListener('change', reveal);
    updatePosition();
  }
  function skip(event) {
    if (event.key === 'Escape' || event.key === 'Tab') reveal();
  }
  function startOpening() {
    if (replay) root.classList.add('intro-requested');
    root.classList.add('title-sequence','intro-paused');
    if (getComputedStyle(backdrop).animationName !== 'uncover-page') {
      reveal();
      return;
    }
    site.inert = true;
    if (replay) window.scrollTo({top:0,behavior:'instant'});
    alignTitle();
    document.fonts?.ready.then(alignTitle);
    resize.observe(destination);
    resize.observe(opening);
    backdrop.addEventListener('animationstart', onBackdropAnimation);
    backdrop.addEventListener('animationend', onBackdropAnimation);
    document.addEventListener('visibilitychange', updatePlayback);
    document.addEventListener('keydown', skip);
    opening.addEventListener('click', reveal);
    window.addEventListener('pagehide', reveal, { once:true });
    window.addEventListener('hashchange', reveal, { once:true });
    motion.addEventListener('change', reveal, { once:true });
    updatePlayback();
  }
  startOpening();
  if (replay) window.addEventListener('pageshow', event => {
    if (event.persisted && !location.hash) startOpening();
  });
})();
