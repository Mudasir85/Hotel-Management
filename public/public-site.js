const PUBLIC_BASE = window.location.pathname.startsWith('/sitesh') ? '/sitesh' : '';

function initPublicSite(activePage) {
  const nav = document.querySelector('.site-nav');
  const menuBtn = document.getElementById('menuToggle');

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => nav.classList.toggle('open'));
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => nav.classList.remove('open'));
    });
  }

  document.querySelectorAll('[data-page]').forEach((link) => {
    if (link.dataset.page === activePage) {
      link.classList.add('active');
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  document.querySelectorAll('.js-login-prompt').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const shouldGo = window.confirm('Please sign in to continue with booking. Go to Sign In page now?');
      if (shouldGo) window.location.href = PUBLIC_BASE + '/login';
    });
  });

  document.querySelectorAll('.js-book-now').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const bookingUrl = btn.getAttribute('data-booking-url') || btn.getAttribute('href') || (PUBLIC_BASE + '/dashboard/bookings');
      const token = localStorage.getItem('token');

      event.preventDefault();
      if (token) {
        window.location.href = bookingUrl;
        return;
      }

      const shouldGo = window.confirm('Please sign in to continue with booking. Go to Sign In page now?');
      if (!shouldGo) return;
      window.location.href = PUBLIC_BASE + '/login?next=' + encodeURIComponent(bookingUrl);
    });
  });

  const contactForm = document.getElementById('publicContactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const status = document.getElementById('contactStatus');
      if (status) {
        status.textContent = 'Thanks for your message. Our team will contact you shortly.';
        status.style.color = '#1a73e8';
      }
      contactForm.reset();
    });
  }
}
