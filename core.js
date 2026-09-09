/* =========================================
   HERO PARALLAX (TEXT-ONLY + DEPTH)
========================================= */
function initHeroParallax() {
  const hero = document.querySelector('.v2-hero-parallax');
  if (!hero) return;

  const bg = hero.querySelector('.v2-hero-bg');
  const content = hero.querySelector('.v2-hero-content');

  function handleScroll() {
    const headerOffset = 65; 
    const scrollY = Math.max(0, window.scrollY - headerOffset);
    const heroHeight = hero.offsetHeight;
    if (!heroHeight) return;

    const progress = Math.min(scrollY / heroHeight, 1);
    const eased = 1 - Math.pow(1 - progress, 4);

    if (bg) {
      const move = eased * Math.min(heroHeight * 0.18, 160);
      bg.style.transform = `translate3d(0, ${move}px, 0) scale(1.15)`;
    }

    if (content) {
      const start = 0.1;
      const p = Math.max(0, progress - start);
      const norm = Math.min(p / (1 - start), 1);
      const cEase = 1 - Math.pow(1 - norm, 4);

      const translateY = -cEase * 120;
      const opacity = 1 - cEase * 1.1;
      const scale = 1 - cEase * 0.05;

      content.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
      content.style.opacity = opacity;
    }
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  });
}


/* =========================================
   SCALE-UP PREMIUM SCROLL (50% TRIGGER)
========================================= */
function initScaleUpScroll() {
  const elements = document.querySelectorAll('.scale-up');
  if (!elements.length) return;

  function handleScroll() {
    const windowHeight = window.innerHeight;

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();

      // 🔥 trigger starts when element is ~50% into viewport
      const triggerPoint = windowHeight * 0.5;
      const endPoint = windowHeight * 0.15;

      let progress = (triggerPoint - rect.top) / (triggerPoint - endPoint);
      progress = Math.max(0, Math.min(progress, 1));

      const eased = 1 - Math.pow(1 - progress, 4);

      // 🎯 PREMIUM MOTION
      const rotateX = 14 - (14 * eased);     // tilt forward
      const scale = 0.9 + (0.1 * eased);     // scale up
      const translateY = 60 * (1 - eased);   // lift upward

      el.style.transform = `
        perspective(1200px)
        translate3d(0, ${translateY}px, 0)
        rotateX(${rotateX}deg)
        scale(${scale})
      `;
    });
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  });
}


/* =========================================
   FADE SYSTEM
========================================= */
function initFadeSystem() {
  const items = document.querySelectorAll('.fade-in, .fade-scale');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;

      setTimeout(() => {
        entry.target.classList.add('show');
      }, i * 120);
    });
  }, { threshold: 0.15 });

  items.forEach(el => observer.observe(el));
}


/* =========================================
   LOGO CAROUSEL (TRUE INFINITE)
========================================= */
function initLogoCarousel() {
  const track = document.querySelector('.logo-track');
  if (!track) return;

  track.innerHTML += track.innerHTML;

  let pos = 0;
  const speed = 0.3;

  function animate() {
    pos += speed;

    if (pos >= track.scrollWidth / 2) {
      pos = 0;
    }

    track.style.transform = `translateX(${-pos}px)`;
    requestAnimationFrame(animate);
  }

  animate();
}


/* =========================================
   STATS CAROUSEL (FIXED + RESPONSIVE)
========================================= */
function initStatsCarousel() {
  const track = document.querySelector('.stats-track');
  if (!track) return;

  const originalHTML = track.innerHTML;
  let animationId = null;
  let isActive = false;
  let pos = 0;
  const speed = 0.2;

  function animate() {
    pos += speed;

    if (pos >= track.scrollWidth / 2) {
      pos = 0;
    }

    track.style.transform = `translateX(${-(pos) - 40}px)`;
    animationId = requestAnimationFrame(animate);
  }

  function start() {
    if (isActive) return;

    track.innerHTML = originalHTML + originalHTML;
    pos = 0;

    const stats = track.querySelectorAll('.stat-inner');

    stats.forEach((stat, i) => {
      stat.classList.remove('show');

      setTimeout(() => {
        stat.classList.add('show');
      }, i * 80);
    });

    animate();
    isActive = true;
  }

  function stop() {
    if (!isActive) return;

    cancelAnimationFrame(animationId);
    track.innerHTML = originalHTML;
    track.style.transform = 'none';
    isActive = false;
  }

  function check() {
    if (window.innerWidth < 1280) {
      start();
    } else {
      stop();
    }
  }

  check();
  window.addEventListener('resize', check);
}


/* =========================================
   INIT
========================================= */
function initAll() {
  initHeroParallax();
  initScaleUpScroll(); // 👈 premium effect
  initFadeSystem();
  initLogoCarousel();
  initStatsCarousel();
}


/* =========================================
   WEBFLOW SAFE INIT
========================================= */
window.Webflow ||= [];
window.Webflow.push(() => {
  initAll();
});
