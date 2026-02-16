async function getAuthenticatedUser() {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (!res.ok) {
    return null;
  }

  const data = await res.json().catch(() => null);
  return data && data.user ? data.user : null;
}

async function logoutUser() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin'
  });
}

window.SessionService = {
  getAuthenticatedUser,
  logoutUser
};
