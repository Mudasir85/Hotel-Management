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

// ─── Header with User Dropdown ───────────────────────────────────
function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function renderHeader() {
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  const user = Auth.getUser();
  const initials = getInitials(user ? user.full_name : '');
  const fullName = user ? user.full_name : 'User';
  const email = user ? (user.email || user.username + '@hotel.com') : 'user@hotel.com';

  const header = document.createElement('div');
  header.className = 'top-header';
  header.innerHTML = `
    <div class="top-header-spacer"></div>
    <div class="top-header-user" id="userDropdownToggle">
      <div class="top-header-avatar">${initials}</div>
      <svg class="top-header-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="user-dropdown" id="userDropdown">
        <div class="user-dropdown-header">
          <div class="user-dropdown-avatar">${initials}</div>
          <div class="user-dropdown-info">
            <span class="user-dropdown-name">${fullName}</span>
            <span class="user-dropdown-email">${email}</span>
          </div>
        </div>
        <div class="user-dropdown-divider"></div>
        <a href="#" class="user-dropdown-item" onclick="event.preventDefault();">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Profile
        </a>
        <a href="#" class="user-dropdown-item" onclick="event.preventDefault();">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Settings
        </a>
        <div class="user-dropdown-divider"></div>
        <a href="#" class="user-dropdown-item user-dropdown-signout" onclick="event.preventDefault(); Auth.logout();">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6M10.5 11.5L14 8l-3.5-3.5M14 8H6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Sign Out
        </a>
      </div>
    </div>
  `;

  mainContent.insertBefore(header, mainContent.firstChild);

  // Toggle dropdown
  const toggle = document.getElementById('userDropdownToggle');
  const dropdown = document.getElementById('userDropdown');

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Prevent dropdown item clicks from closing prematurely
  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

function injectHeaderStyles() {
  if (document.getElementById('header-styles')) return;

  const style = document.createElement('style');
  style.id = 'header-styles';
  style.textContent = `
    /* ── Top Header Bar ── */
    .top-header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 12px 24px;
      background: #fff;
      border-bottom: 1px solid #e9ecef;
      position: sticky;
      top: 0;
      z-index: 900;
    }

    .top-header-spacer {
      flex: 1;
    }

    .top-header-user {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 8px;
      transition: background 0.15s;
    }

    .top-header-user:hover {
      background: #f0f2f5;
    }

    .top-header-avatar {
      width: 36px;
      height: 36px;
      background: #1a73e8;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 600;
      flex-shrink: 0;
      letter-spacing: 0.5px;
    }

    .top-header-chevron {
      color: #666;
      transition: transform 0.2s;
    }

    .top-header-user:hover .top-header-chevron {
      color: #333;
    }

    /* ── User Dropdown ── */
    .user-dropdown {
      display: none;
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 260px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05);
      overflow: hidden;
      z-index: 950;
    }

    .user-dropdown.open {
      display: block;
    }

    .user-dropdown-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
    }

    .user-dropdown-avatar {
      width: 40px;
      height: 40px;
      background: #1a73e8;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      font-weight: 600;
      flex-shrink: 0;
      letter-spacing: 0.5px;
    }

    .user-dropdown-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-dropdown-name {
      font-size: 0.9rem;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-dropdown-email {
      font-size: 0.8rem;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-dropdown-divider {
      height: 1px;
      background: #eee;
      margin: 0;
    }

    .user-dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      color: #555;
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 500;
      transition: all 0.12s;
    }

    .user-dropdown-item:hover {
      background: #f4f6f8;
      color: #333;
    }

    .user-dropdown-item svg {
      flex-shrink: 0;
    }

    .user-dropdown-signout {
      color: #dc3545;
    }

    .user-dropdown-signout:hover {
      background: #fdf0f0;
      color: #b02a37;
    }

    @media (max-width: 768px) {
      .top-header {
        padding: 10px 16px;
      }

      .user-dropdown {
        width: 240px;
        right: -8px;
      }
    }
  `;
  document.head.appendChild(style);
}

// ─── Init App Page ───────────────────────────────────────────────
function initAppPage(activePage) {
  if (!Auth.requireAuth()) return false;
  injectNavbarStyles();
  injectHeaderStyles();
  renderSidebar(activePage);
  renderHeader();
  return true;
}
