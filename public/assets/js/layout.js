async function mountLayout(options) {
  if (!window.DashboardLayout || typeof window.DashboardLayout.mountDashboardLayout !== 'function') {
    throw new Error('DashboardLayout component is not loaded');
  }

  return window.DashboardLayout.mountDashboardLayout(options);
}

window.AppLayout = { mountLayout };
