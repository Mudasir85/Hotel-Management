function getLinkClass(activePage, page) {
  return activePage === page ? 'menu-link active' : 'menu-link';
}

function renderSidebar(activePage) {
  return `
    <aside class="sidebar">
      <div class="menu-title">Menu</div>
      <a class="${getLinkClass(activePage, 'dashboard')}" href="/dashboard">Dashboard</a>
      <a class="${getLinkClass(activePage, 'bookings')}" href="/bookings">Bookings</a>
    </aside>
  `;
}

window.SidebarComponent = {
  renderSidebar
};
