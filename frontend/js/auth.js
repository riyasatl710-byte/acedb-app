/* ACEDB - auth.js */
function getStoredSession() {
  try {
    const data = sessionStorage.getItem(ACEDB_CONFIG.SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function storeSession(data) {
  sessionStorage.setItem(ACEDB_CONFIG.SESSION_KEY, JSON.stringify(data));
}

function clearSession() {
  sessionStorage.removeItem(ACEDB_CONFIG.SESSION_KEY);
}

function isLoggedIn() {
  return !!getStoredSession();
}

function getCurrentRole() {
  const s = getStoredSession();
  return s ? s.role : null;
}

function getCurrentDistrict() {
  const s = getStoredSession();
  return s ? s.district : null;
}

function getCurrentUser() {
  return getStoredSession();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('loginUserId').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!userId || !password) { showToast('Please enter User ID and Password', 'warning'); return; }

  const result = await API.login(userId, password);
  if (result.success) {
    storeSession({ ...result.data });
    showToast(t('welcome') + ', ' + result.data.fullName, 'success');
    setTimeout(() => window.location.href = 'app.html', 800);
  } else {
    showToast(result.error || t('invalid_credentials'), 'error');
  }
}

async function handleLogout() {
  await API.logout();
  clearSession();
  window.location.href = 'index.html';
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function hasRole(...roles) {
  const current = getCurrentRole();
  return roles.includes(current);
}
