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

// ─── Sidebar Renderer ───────────────────────────────────────────
function renderSidebar(activePage) {
  const user = Auth.getUser();
  const sidebar = document.getElementById('app-navbar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-logo">H</div>
        <span>Hotel Booking</span>
      </div>
      <nav class="sidebar-nav">
        <a href="/dashboard" class="${activePage === 'dashboard' ? 'active' : ''}">
          <span class="nav-icon">&#9632;</span> Dashboard
        </a>
        <a href="/dashboard/bookings" class="${activePage === 'bookings' ? 'active' : ''}">
          <span class="nav-icon">&#128203;</span> Bookings
        </a>
        <a href="/dashboard/contact" class="${activePage === 'contact' ? 'active' : ''}">
          <span class="nav-icon">&#9993;</span> Contact
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-avatar">${user ? user.full_name.charAt(0).toUpperCase() : 'U'}</div>
          <div class="sidebar-user-info">
            <span class="sidebar-user-name">${user ? user.full_name : 'User'}</span>
            <span class="sidebar-user-role">Administrator</span>
          </div>
        </div>
        <button onclick="Auth.logout()" class="btn-logout">Logout</button>
      </div>
    </div>
  `;
}

// ─── Sidebar Styles (injected once) ─────────────────────────────
function injectNavbarStyles() {
  if (document.getElementById('navbar-styles')) return;

  const style = document.createElement('style');
  style.id = 'navbar-styles';
  style.textContent = `
    /* ── Layout: sidebar + main ── */
    body {
      display: flex;
      min-height: 100vh;
      margin: 0;
    }

    #app-navbar {
      width: 250px;
      min-height: 100vh;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      height: 100vh;
    }

    .sidebar {
      width: 250px;
      background: #1e293b;
      color: #fff;
      display: flex;
      flex-direction: column;
      height: 100vh;
      position: fixed;
      top: 0;
      left: 0;
      z-index: 1000;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .sidebar-logo {
      width: 36px;
      height: 36px;
      background: #1a73e8;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .sidebar-brand span {
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .sidebar-nav {
      flex: 1;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sidebar-nav a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      color: rgba(255,255,255,0.65);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      border-radius: 8px;
      transition: all 0.15s;
    }

    .sidebar-nav a:hover {
      color: #fff;
      background: rgba(255,255,255,0.08);
    }

    .sidebar-nav a.active {
      color: #fff;
      background: #1a73e8;
    }

    .nav-icon {
      font-size: 1rem;
      width: 20px;
      text-align: center;
    }

    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }

    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .sidebar-avatar {
      width: 34px;
      height: 34px;
      background: #1a73e8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 600;
      flex-shrink: 0;
    }

    .sidebar-user-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-user-name {
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidebar-user-role {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.5);
    }

    .btn-logout {
      width: 100%;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.8);
      border: 1px solid rgba(255,255,255,0.12);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-logout:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }

    /* ── Main content area ── */
    .main-content {
      flex: 1;
      min-width: 0;
    }

    @media (max-width: 768px) {
      #app-navbar {
        width: 60px;
      }

      .sidebar {
        width: 60px;
      }

      .sidebar-brand span,
      .sidebar-nav a span:not(.nav-icon),
      .sidebar-user-info,
      .sidebar-user-role {
        display: none;
      }

      .sidebar-brand {
        justify-content: center;
        padding: 16px 8px;
      }

      .sidebar-nav a {
        justify-content: center;
        padding: 12px;
      }

      .sidebar-footer {
        padding: 8px;
      }

      .sidebar-user {
        justify-content: center;
      }

      .btn-logout {
        font-size: 0;
        padding: 8px;
      }

      .btn-logout::after {
        content: '\\2192';
        font-size: 1rem;
      }
    }
  `;
  document.head.appendChild(style);
}

// ─── Init App Page ───────────────────────────────────────────────
function initAppPage(activePage) {
  if (!Auth.requireAuth()) return false;
  injectNavbarStyles();
  renderSidebar(activePage);
  return true;
}
