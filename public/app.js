const BASE = '/sitesh';

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
      window.location.href = BASE + '/login';
      return false;
    }
    return true;
  },

  logout() {
    this.clear();
    window.location.href = BASE + '/login';
  }
};

// ─── Sidebar Renderer ───────────────────────────────────────────
function renderSidebar(activePage) {
  const sidebar = document.getElementById('app-navbar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-logo">H</div>
        <span>Hotel Booking</span>
      </div>
      <nav class="sidebar-nav">
        <a href="${BASE}/dashboard" class="${activePage === 'dashboard' ? 'active' : ''}">
          <span class="nav-icon">&#9632;</span> Dashboard
        </a>
        <a href="${BASE}/rooms" class="${activePage === 'rooms' ? 'active' : ''}">
          <span class="nav-icon">&#127968;</span> Our Rooms
        </a>
        <a href="${BASE}/bookings" class="${activePage === 'bookings' ? 'active' : ''}">
          <span class="nav-icon">&#128203;</span> Bookings
        </a>
        <a href="${BASE}/about" class="${activePage === 'about' ? 'active' : ''}">
          <span class="nav-icon">&#8505;</span> About Us
        </a>
        <a href="${BASE}/gallery" class="${activePage === 'gallery' ? 'active' : ''}">
          <span class="nav-icon">&#128247;</span> Gallery
        </a>
        <a href="${BASE}/blogs" class="${activePage === 'blogs' ? 'active' : ''}">
          <span class="nav-icon">&#128240;</span> Blogs
        </a>
        <a href="${BASE}/contact" class="${activePage === 'contact' ? 'active' : ''}">
          <span class="nav-icon">&#9993;</span> Contact
        </a>
      </nav>
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
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
    }

    body {
      display: flex;
      min-height: 100vh;
    }

    #app-navbar {
      width: 250px;
      flex-shrink: 0;
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
      padding: 0 20px;
      height: 60px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
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

    /* ── Main content area ── */
    .main-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: #f0f2f5;
    }

    @media (max-width: 768px) {
      #app-navbar {
        width: 60px;
      }

      .sidebar {
        width: 60px;
      }

      .sidebar-brand span,
      .sidebar-nav a span:not(.nav-icon) {
        display: none;
      }

      .sidebar-brand {
        justify-content: center;
        padding: 0 8px;
      }

      .sidebar-nav a {
        justify-content: center;
        padding: 12px;
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
    <div class="top-header-title">Hotel Booking & Reservation</div>
    <div class="top-header-right">
      <div class="top-header-user" id="userDropdownToggle">
        <div class="top-header-avatar">${initials}</div>
        <span class="top-header-name">${fullName}</span>
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
          <a href="${BASE}/profile" class="user-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Profile
          </a>
          <a href="${BASE}/settings" class="user-dropdown-item">
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
      justify-content: space-between;
      padding: 0 24px;
      height: 60px;
      background: #1e293b;
      color: #fff;
      position: sticky;
      top: 0;
      z-index: 900;
      flex-shrink: 0;
    }

    .top-header-title {
      font-size: 1rem;
      font-weight: 600;
      color: #fff;
      letter-spacing: -0.2px;
    }

    .top-header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .top-header-user {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 8px;
      transition: background 0.15s;
    }

    .top-header-user:hover {
      background: rgba(255,255,255,0.08);
    }

    .top-header-avatar {
      width: 34px;
      height: 34px;
      background: #1a73e8;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.82rem;
      font-weight: 600;
      flex-shrink: 0;
      letter-spacing: 0.5px;
    }

    .top-header-name {
      font-size: 0.88rem;
      font-weight: 500;
      color: rgba(255,255,255,0.9);
      white-space: nowrap;
    }

    .top-header-chevron {
      color: rgba(255,255,255,0.5);
      transition: transform 0.2s;
    }

    .top-header-user:hover .top-header-chevron {
      color: #fff;
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
      box-shadow: 0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
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
        padding: 0 16px;
      }

      .top-header-name {
        display: none;
      }

      .top-header-title {
        font-size: 0.9rem;
      }

      .top-header-logout span {
        display: none;
      }

      .user-dropdown {
        width: 240px;
        right: -8px;
      }
    }
  `;
  document.head.appendChild(style);
}

// ─── Toast Notification System ──────────────────────────────────
function injectToastStyles() {
  if (document.getElementById('toast-styles')) return;

  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 500;
      color: #fff;
      min-width: 280px;
      max-width: 420px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      pointer-events: auto;
      transform: translateX(120%);
      opacity: 0;
      transition: transform 0.35s cubic-bezier(0.21, 1.02, 0.73, 1), opacity 0.35s ease;
    }

    .toast.show {
      transform: translateX(0);
      opacity: 1;
    }

    .toast.hide {
      transform: translateX(120%);
      opacity: 0;
    }

    .toast.success {
      background: #0f9d58;
    }

    .toast.error {
      background: #db4437;
    }

    .toast.info {
      background: #4285f4;
    }

    .toast-icon {
      font-size: 1.15rem;
      flex-shrink: 0;
      line-height: 1;
    }

    .toast-msg {
      flex: 1;
      line-height: 1.3;
    }

    .toast-close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.7);
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0 2px;
      line-height: 1;
      flex-shrink: 0;
      transition: color 0.15s;
    }

    .toast-close:hover {
      color: #fff;
    }

    @media (max-width: 480px) {
      .toast-container {
        top: 12px;
        right: 12px;
        left: 12px;
      }
      .toast {
        min-width: auto;
        max-width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

const TOAST_ICONS = {
  success: '\u2714',
  error: '\u2716',
  info: '\u2139'
};

function showToast(message, type = 'info', duration = 3000) {
  injectToastStyles();
  const container = ensureToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" onclick="this.parentElement.classList.replace('show','hide');setTimeout(()=>this.parentElement.remove(),350)">&times;</button>
  `;

  container.appendChild(toast);

  // Trigger slide-in
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-dismiss
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.replace('show', 'hide');
      setTimeout(() => toast.remove(), 350);
    }
  }, duration);
}

// ─── Lightweight SPA Navigation ─────────────────────────────────
function isAppRoute(pathname) {
  if (!pathname.startsWith(BASE + '/')) return false;
  const afterBase = pathname.slice(BASE.length);
  const firstSegment = afterBase.split('/').filter(Boolean)[0];
  return firstSegment && firstSegment !== 'login' && firstSegment !== 'api';
}

function getActivePageFromPath(pathname) {
  const afterBase = pathname.slice(BASE.length);
  const segments = afterBase.split('/').filter(Boolean);
  if (segments.length === 0 || segments[0] === 'dashboard') return 'dashboard';
  return segments[0];
}

function ensureMainContentSlot() {
  const main = document.querySelector('.main-content');
  if (!main) return null;

  let slot = main.querySelector('[data-router-slot]');
  if (slot) return slot;

  slot = document.createElement('div');
  slot.setAttribute('data-router-slot', 'true');

  const movableChildren = Array.from(main.children).filter(
    (child) => !child.classList.contains('top-header')
  );

  movableChildren.forEach((child) => slot.appendChild(child));
  main.appendChild(slot);
  return slot;
}

function sanitizeInlineScript(scriptText) {
  return scriptText.replace(
    /if\s*\(!initAppPage\([^)]*\)\)\s*throw\s+new\s+Error\((['"])Not authenticated\1\);?/g,
    "if (!Auth.requireAuth()) throw new Error('Not authenticated');"
  );
}

function executeRouteScriptsFromDocument(doc) {
  const scripts = doc.querySelectorAll('script');
  scripts.forEach((script) => {
    if (script.src) return;
    const raw = script.textContent || '';
    if (!raw.trim()) return;

    const safeScript = sanitizeInlineScript(raw);
    try {
      new Function(safeScript)();
    } catch (err) {
      console.error('SPA route script error:', err);
    }
  });
}

function swapRouteMainContent(doc) {
  const currentMain = document.querySelector('.main-content');
  const nextMain = doc.querySelector('.main-content');
  if (!currentMain || !nextMain) return false;

  const slot = ensureMainContentSlot();
  if (!slot) return false;

  const nextChildren = Array.from(nextMain.children).filter(
    (child) => !child.classList.contains('top-header')
  );

  slot.innerHTML = '';
  nextChildren.forEach((child) => {
    slot.appendChild(child.cloneNode(true));
  });

  return true;
}

function injectPageStyles(doc) {
  // Remove previously injected page styles
  const old = document.getElementById('page-route-styles');
  if (old) old.remove();

  // Collect <style> tags from <head> that don't have an ID (page-specific)
  const headStyles = doc.querySelectorAll('head style:not([id])');
  if (headStyles.length === 0) return;

  const combined = document.createElement('style');
  combined.id = 'page-route-styles';
  combined.textContent = Array.from(headStyles).map(s => s.textContent).join('\n');
  document.head.appendChild(combined);
}

function injectBodyElements(doc) {
  // Remove previously injected body elements
  document.querySelectorAll('[data-spa-injected]').forEach(el => el.remove());

  // Find elements in the fetched doc that are direct children of body
  // but not app-navbar, main-content, or script tags
  const bodyChildren = Array.from(doc.body.children).filter(child => {
    if (child.tagName === 'SCRIPT') return false;
    if (child.id === 'app-navbar') return false;
    if (child.classList.contains('main-content')) return false;
    return true;
  });

  bodyChildren.forEach(child => {
    const clone = child.cloneNode(true);
    clone.setAttribute('data-spa-injected', 'true');
    document.body.appendChild(clone);
  });
}

async function navigateRoute(pathAndQuery, options = {}) {
  const { replace = false, fromPopState = false } = options;
  const absoluteUrl = new URL(pathAndQuery, window.location.origin);

  if (!isAppRoute(absoluteUrl.pathname)) {
    window.location.href = absoluteUrl.pathname + absoluteUrl.search;
    return;
  }

  try {
    const response = await fetch(absoluteUrl.pathname + absoluteUrl.search, {
      headers: { 'X-Requested-With': 'spa' }
    });

    if (!response.ok) {
      window.location.href = absoluteUrl.pathname + absoluteUrl.search;
      return;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    if (!swapRouteMainContent(doc)) {
      window.location.href = absoluteUrl.pathname + absoluteUrl.search;
      return;
    }

    // Inject page-specific styles from fetched document
    injectPageStyles(doc);

    // Inject body-level elements (e.g. modals) from fetched document
    injectBodyElements(doc);

    if (!fromPopState) {
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({ spa: true }, '', absoluteUrl.pathname + absoluteUrl.search);
    }

    document.title = doc.title || document.title;
    renderSidebar(getActivePageFromPath(absoluteUrl.pathname));
    executeRouteScriptsFromDocument(doc);
    window.scrollTo(0, 0);
  } catch {
    window.location.href = absoluteUrl.pathname + absoluteUrl.search;
  }
}

function initSpaNavigation() {
  if (window.__spaNavInitialized) return;
  window.__spaNavInitialized = true;

  ensureMainContentSlot();

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href]');
    if (!link) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download') || link.getAttribute('rel') === 'external') return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    if (!isAppRoute(url.pathname)) return;

    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    navigateRoute(url.pathname + url.search);
  });

  window.addEventListener('popstate', () => {
    if (!isAppRoute(window.location.pathname)) return;
    navigateRoute(window.location.pathname + window.location.search, { fromPopState: true });
  });
}

// ─── Init App Page ───────────────────────────────────────────────
function initAppPage(activePage) {
  if (!Auth.requireAuth()) return false;
  injectNavbarStyles();
  injectHeaderStyles();
  injectToastStyles();
  renderSidebar(activePage);
  renderHeader();
  ensureToastContainer();
  initSpaNavigation();
  return true;
}
