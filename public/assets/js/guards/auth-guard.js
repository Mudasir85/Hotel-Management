async function requireAuthenticatedUser() {
  const user = await window.SessionService.getAuthenticatedUser();
  if (!user) {
    window.location.href = '/login';
    return null;
  }

  return user;
}

async function redirectIfAuthenticated() {
  const user = await window.SessionService.getAuthenticatedUser();
  if (user) {
    window.location.href = '/dashboard';
    return true;
  }

  return false;
}

window.AuthGuard = {
  requireAuthenticatedUser,
  redirectIfAuthenticated
};
