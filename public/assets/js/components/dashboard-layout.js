async function mountDashboardLayout(options) {
  const user = await window.SessionService.getAuthenticatedUser();
  if (!user) {
    window.location.href = '/login';
    return;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-shell">
      ${window.SidebarComponent.renderSidebar(options.activePage)}
      ${window.NavbarComponent.renderNavbar(user)}
      <main class="main">${options.contentHtml}</main>
    </div>
  `;

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', async () => {
    await window.SessionService.logoutUser();
    window.location.href = '/login';
  });
}

window.DashboardLayout = {
  mountDashboardLayout
};
