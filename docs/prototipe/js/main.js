/* =========================================================
   Pahami Sehat — halaman penjelasan (statis)

   Halaman ini TIDAK punya demo interaktif. Semua yang bisa
   dicoba ada di aplikasi (lihat tautan "Coba Aplikasinya").

   Skrip ini hanya mengurus hal presentasional:
     1. navbar menempel saat di-scroll + menu mobile
     2. animasi muncul saat di-scroll
     3. penanda menu aktif (scroll-spy)
     4. tombol kembali ke atas

   Tidak ada panggilan jaringan, tidak ada penyimpanan,
   tidak ada simulasi.
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------------- navbar: menempel + hamburger ---------------- */
  const navbar = $('#navbar');
  const navToggle = $('#navToggle');
  const navLinks = $('#navLinks');
  const toTop = $('#toTop');

  const onScroll = () => {
    if (navbar) navbar.classList.toggle('is-stuck', window.scrollY > 8);
    if (toTop) toTop.classList.toggle('is-show', window.scrollY > 600);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && navLinks) {
    const setMenu = (buka) => {
      navLinks.classList.toggle('is-open', buka);
      navToggle.setAttribute('aria-expanded', String(buka));
      navToggle.setAttribute('aria-label', buka ? 'Tutup menu' : 'Buka menu');
    };

    navToggle.addEventListener('click', () =>
      setMenu(!navLinks.classList.contains('is-open')),
    );

    navLinks.addEventListener('click', (e) => {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
        setMenu(false);
        navToggle.focus();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 860) setMenu(false);
    });
  }

  /* ---------------- animasi muncul saat di-scroll ---------------- */
  const elemenReveal = $$('.reveal');
  if (elemenReveal.length) {
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            en.target.classList.add('is-in');
            obs.unobserve(en.target);
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
      );
      elemenReveal.forEach((el) => obs.observe(el));
    } else {
      elemenReveal.forEach((el) => el.classList.add('is-in'));
    }
  }

  /* ---------------- scroll-spy: menu aktif mengikuti posisi ---------------- */
  const tautanNav = $$('.nav-links a[href^="#"]');
  const bagian = tautanNav
    .map((a) => ({ a, el: document.getElementById(a.getAttribute('href').slice(1)) }))
    .filter((x) => x.el);

  if (bagian.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const cocok = bagian.find((b) => b.el === en.target);
          if (!cocok) return;
          tautanNav.forEach((a) => a.classList.remove('is-active'));
          cocok.a.classList.add('is-active');
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    bagian.forEach((b) => obs.observe(b.el));
  }

  /* ---------------- tombol kembali ke atas ---------------- */
  if (toTop) {
    toTop.addEventListener('click', () =>
      window.scrollTo({ top: 0, behavior: 'smooth' }),
    );
  }
})();
