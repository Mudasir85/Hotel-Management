// ─── Auth Utilities ───────────────────────────────────────────────
const Auth = {
  getToken() {
    return localStorage.getItem('token');
  },

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  save(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    };
  },

  // Redirect to login if not authenticated
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/login';
      return false;
    }
    return true;
  },

  logout() {
    this.clear();
    window.location.href = '/login';
  }
};

// ─── Navbar Renderer ─────────────────────────────────────────────
function renderNavbar(activePage) {
  const user = Auth.getUser();
  const navbar = document.getElementById('app-navbar');
  if (!navbar) return;

  navbar.innerHTML = `
    <div class="navbar">
      <div class="navbar-brand">Hotel Booking System</div>
      <div class="navbar-links">
        <a href="/dashboard" class="${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a>
        <a href="/dashboard/bookings" class="${activePage === 'bookings' ? 'active' : ''}">Bookings</a>
        <a href="/dashboard/contact" class="${activePage === 'contact' ? 'active' : ''}">Contact</a>
      </div>
      <div class="navbar-user">
        <span class="user-name">${user ? user.full_name : 'User'}</span>
        <button onclick="Auth.logout()" class="btn-logout">Logout</button>
      </div>
    </div>
  `;
}

// ─── Navbar Styles (injected once) ───────────────────────────────
function injectNavbarStyles() {
  if (document.getElementById('navbar-styles')) return;

  const style = document.createElement('style');
  style.id = 'navbar-styles';
  style.textContent = `
    #app-navbar {
      background: #1a73e8;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .navbar {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .navbar-brand {
      color: #fff;
      font-size: 1.2rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .navbar-links {
      display: flex;
      gap: 8px;
    }

    .navbar-links a {
      color: rgba(255,255,255,0.8);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .navbar-links a:hover {
      color: #fff;
      background: rgba(255,255,255,0.1);
    }

    .navbar-links a.active {
      color: #fff;
      background: rgba(255,255,255,0.2);
    }

    .navbar-user {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-name {
      color: rgba(255,255,255,0.9);
      font-size: 0.85rem;
      font-weight: 500;
    }

    .btn-logout {
      background: rgba(255,255,255,0.15);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-logout:hover {
      background: rgba(255,255,255,0.25);
    }

    @media (max-width: 600px) {
      .navbar {
        flex-wrap: wrap;
        height: auto;
        padding: 12px;
        gap: 8px;
      }
      .navbar-links { order: 3; width: 100%; justify-content: center; }
      .user-name { display: none; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Init App Page ───────────────────────────────────────────────
function initAppPage(activePage) {
  if (!Auth.requireAuth()) return false;
  injectNavbarStyles();
  renderNavbar(activePage);
  return true;
}
