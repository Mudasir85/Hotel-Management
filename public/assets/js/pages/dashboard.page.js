document.addEventListener('DOMContentLoaded', async () => {
  await window.DashboardLayout.mountDashboardLayout({
    activePage: 'dashboard',
    contentHtml: `
      <section class="panel">
        <h1>Dashboard</h1>
        <p class="subtitle">Use the sidebar to open the bookings module.</p>
        <p>This area is protected and only visible to authenticated users.</p>
        <p><a class="btn btn-primary" href="/bookings">Go to Bookings</a></p>
      </section>
    `
  });
});
