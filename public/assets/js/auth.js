async function checkExistingSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (res.ok) {
      window.location.href = '/dashboard';
    }
  } catch (_err) {
    // Ignore session check errors on login page
  }
}

function setNotice(message, type) {
  const notice = document.getElementById('notice');
  notice.textContent = message;
  notice.className = `notice ${type || ''}`;
}

async function onLoginSubmit(event) {
  event.preventDefault();
  setNotice('');

  const form = event.currentTarget;
  const payload = {
    username: form.username.value.trim(),
    password: form.password.value
  };

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error || 'Login failed', 'error');
      return;
    }

    setNotice('Login successful. Redirecting...', 'success');
    window.location.href = '/dashboard';
  } catch (_err) {
    setNotice('Network error while logging in', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkExistingSession();
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', onLoginSubmit);
});
