function renderNavbar(user) {
  return `
    <header class="topbar">
      <div class="brand">Hotel Booking System</div>
      <div class="user-controls">
        <span>${user.username}</span>
        <button id="logoutBtn" class="btn btn-danger" type="button">Logout</button>
      </div>
    </header>
  `;
}

window.NavbarComponent = {
  renderNavbar
};
