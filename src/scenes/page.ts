// Wires a scene to the page: scroll position drives it, panels fade in, the nav tracks the section.
import { clamp, type Mount } from './core';

export function startPage(mount: Mount) {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
  const root = document.documentElement;
  const max = () => Math.max(1, root.scrollHeight - innerHeight);

  // ?p=0.5 opens the page half-way through the journey (handy for comparing styles).
  const q = new URLSearchParams(location.search).get('p');
  if (q !== null) {
    history.scrollRestoration = 'manual';
    root.style.scrollBehavior = 'auto';
    scrollTo(0, clamp(parseFloat(q)) * max());
  }

  const sectionAt = (id: string) => {
    const panel = document.querySelector(`#${id} .panel`);
    if (!panel) return 0;
    const r = panel.getBoundingClientRect();
    return clamp((r.top + scrollY + r.height / 2 - innerHeight / 2) / max());
  };
  mount(canvas, { progress: () => clamp(scrollY / max()), sectionAt });

  const seen = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
    }),
    { rootMargin: '0px 0px -10% 0px' },
  );
  document.querySelectorAll('.reveal').forEach((el) => seen.observe(el));

  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav]')];
  // The contact panel is too short to reach the middle of the screen, so mark it at the very end.
  addEventListener('scroll', () => {
    if (scrollY >= max() - 4) links.forEach((a) => a.toggleAttribute('data-on', a.dataset.nav === 'contact'));
  }, { passive: true });

  const current = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.toggleAttribute('data-on', a.dataset.nav === e.target.id));
    }),
    { rootMargin: '-45% 0px -45% 0px' },
  );
  document.querySelectorAll('section.block').forEach((el) => current.observe(el));
}
