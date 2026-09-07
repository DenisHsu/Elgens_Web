'use strict';

const menu = document.querySelector('#mobile-navigation');
const menuTrigger = document.querySelector('.menu-trigger');
const closeMenu = () => menu.close();
menuTrigger.addEventListener('click', () => {
  menu.showModal();
  menuTrigger.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
});
menu.querySelector('.menu-close').addEventListener('click', closeMenu);
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
menu.addEventListener('click', (event) => {
  const bounds = menu.getBoundingClientRect();
  if (event.target === menu && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeMenu();
});
menu.addEventListener('close', () => {
  menuTrigger.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
  menuTrigger.focus({ preventScroll: true });
});
window.addEventListener('resize', () => {
  if (menu.open && getComputedStyle(menuTrigger).display === 'none') closeMenu();
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// Animate content individually instead of moving the whole card.
const contentSections = document.querySelectorAll('main > section:not(.hero)');
contentSections.forEach((section) => {
  section.querySelectorAll('.reveal').forEach((element) => {
    element.classList.remove('reveal', 'pending', 'is-visible');
  });
  section.querySelectorAll('h2, h3').forEach((heading) => {
    const text = document.createElement('span');
    // Keep heading icons separate from the heading text animation.
    Array.from(heading.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') text.append(node);
    });
    heading.append(text);
    text.classList.add('motion-item');
  });
  section.querySelectorAll('p, img, .sizes span, figcaption, .button, .countdown-unit').forEach((element) => {
    if (!element.closest('.application-card') && !element.parentElement.closest('p, .button')) element.classList.add('motion-item');
  });
});

let observer;
function setupReveals() {
  observer?.disconnect();
  const items = document.querySelectorAll('.motion-item');
  items.forEach((item) => {
    item.classList.remove('motion-pending');
    item.style.removeProperty('--item-delay');
    item.style.removeProperty('--entrance-y');
  });
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        entry.target.style.setProperty('--item-delay', '0ms');
        // Move away from the viewport when resetting to avoid edge flicker.
        entry.target.style.setProperty('--entrance-y', entry.boundingClientRect.bottom <= 0 ? '-48px' : '48px');
        entry.target.classList.add('motion-pending');
      }
    });
    const visible = entries.filter((entry) => entry.isIntersecting && entry.target.classList.contains('motion-pending'));
    // Stagger only items currently entering the viewport, including mobile rows.
    visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
    visible.forEach((entry, index) => {
      entry.target.style.setProperty('--item-delay', `${Math.min(index * 130, 1040)}ms`);
      entry.target.classList.remove('motion-pending');
    });
  }, { threshold: 0 });
  items.forEach((item) => {
    const bounds = item.getBoundingClientRect();
    if (bounds.top >= window.innerHeight || bounds.bottom <= 0 || bounds.left >= window.innerWidth || bounds.right <= 0) {
      item.style.setProperty('--entrance-y', bounds.bottom <= 0 ? '-48px' : '48px');
      item.classList.add('motion-pending');
    }
    observer.observe(item);
  });
}
setupReveals();
reducedMotion.addEventListener('change', setupReveals);


// Observe stationary card frames so image motion cannot retrigger visibility.
const applicationCards = document.querySelectorAll('.application-card');
let applicationObserver;
function setupApplicationMotion() {
  applicationObserver?.disconnect();
  applicationCards.forEach((card, index) => {
    card.classList.remove('card-waiting');
    card.style.setProperty('--card-delay', `${index * 180}ms`);
  });
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
  applicationObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('card-waiting', !entry.isIntersecting);
    });
  }, { threshold: 0.12 });
  applicationCards.forEach((card) => {
    const bounds = card.getBoundingClientRect();
    if (bounds.top >= window.innerHeight || bounds.bottom <= 0 || bounds.left >= window.innerWidth) {
      card.classList.add('card-waiting');
    }
    applicationObserver.observe(card);
  });
}
setupApplicationMotion();
reducedMotion.addEventListener('change', setupApplicationMotion);


// Replay each hero text item when it returns into view, even on a tall mobile hero.
const heroSection = document.querySelector('.hero');
const heroTextItems = document.querySelectorAll('.hero-enter');
let heroObserver;
function setupHeroReplay() {
  heroObserver?.disconnect();
  heroSection?.classList.remove('hero-outside');
  heroTextItems.forEach((item) => item.classList.remove('hero-replay-wait'));
  if (!heroSection || reducedMotion.matches || !('IntersectionObserver' in window)) return;
  heroObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const className = entry.target === heroSection ? 'hero-outside' : 'hero-replay-wait';
      entry.target.classList.toggle(className, !entry.isIntersecting);
    });
  }, { threshold: 0 });
  heroObserver.observe(heroSection);
  heroTextItems.forEach((item) => heroObserver.observe(item));
}
setupHeroReplay();
reducedMotion.addEventListener('change', setupHeroReplay);

const progress = document.querySelector('.reading-progress');
let frame = 0;
function updateProgress() {
  frame = 0;
  const range = document.documentElement.scrollHeight - window.innerHeight;
  const fraction = range > 0 ? Math.max(0, Math.min(1, window.scrollY / range)) : 0;
  progress.style.transform = `scaleX(${fraction})`;
}
function scheduleProgress() {
  if (!frame) frame = requestAnimationFrame(updateProgress);
}
window.addEventListener('scroll', scheduleProgress, { passive: true });
window.addEventListener('resize', scheduleProgress);
window.addEventListener('load', scheduleProgress);
if ('ResizeObserver' in window) new ResizeObserver(scheduleProgress).observe(document.body);
updateProgress();


// Event date from the page, with an explicit Paris UTC offset.
const countdown = document.querySelector('.countdown');
if (countdown) {
  const targetTime = Date.parse(countdown.dataset.target);
  const fields = Object.fromEntries(['days', 'hours', 'minutes', 'seconds'].map((unit) => [unit, countdown.querySelector(`[data-count="${unit}"]`)]));
  const status = countdown.querySelector('.countdown-status');
  let countdownTimer;
  function updateCountdown() {
    const total = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
    const values = {
      days: Math.floor(total / 86400),
      hours: Math.floor(total / 3600) % 24,
      minutes: Math.floor(total / 60) % 60,
      seconds: total % 60,
    };
    Object.entries(values).forEach(([unit, value]) => {
      const label = String(value).padStart(2, '0');
      if (fields[unit].textContent !== label) fields[unit].textContent = label;
    });
    if (total === 0) {
      status.textContent = 'The exhibition start date has arrived.';
      clearInterval(countdownTimer);
    }
    return total;
  }
  function resumeCountdown() {
    clearInterval(countdownTimer);
    if (!document.hidden && updateCountdown() > 0) countdownTimer = setInterval(updateCountdown, 1000);
  }
  resumeCountdown();
  document.addEventListener('visibilitychange', resumeCountdown);
  window.addEventListener('pageshow', resumeCountdown);
}


// Use the site's existing analytics when available; downloading works without it.
document.querySelector('.brochure-action')?.addEventListener('click', () => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'feature_click', {
      feature_section: 'DOWNLOAD BROCHURE',
      feature_title: 'Download',
    });
  }
});
