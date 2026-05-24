/**
 * ACEDB - Auth.gs
 * Authentication: login, logout, session management.
 */

var SESSION_TTL = 21600;

function handleLogin(data) {
  var userId = sanitize(data.userId);
  var password = data.password;
  if (!userId || !password) return errorResponse('User ID and Password are required');

  var cache = CacheService.getScriptCache();
  var failKey = 'FAIL_' + userId;
  var failCount = parseInt(cache.get(failKey)) || 0;
  if (failCount >= 5) return errorResponse('Account temporarily locked. Try again in 15 minutes.', 429);

  var user = findRow('Users', 'UserID', userId);
  if (!user) {
    cache.put(failKey, String(failCount + 1), 900);
    return errorResponse('Invalid User ID or Password');
  }

  if (String(user.IsActive) !== 'TRUE' && String(user.IsActive) !== 'true' && user.IsActive !== true) {
    return errorResponse('Account is deactivated. Contact IT Admin.');
  }

  var hash = hashPassword(password, user.Salt);
  if (hash !== user.PasswordHash) {
    cache.put(failKey, String(failCount + 1), 900);
    logAudit(userId, 'LOGIN_FAILED', 'User', userId, '', '', '');
    return errorResponse('Invalid User ID or Password');
  }

  var token = generateUUID();
  var sessionData = JSON.stringify({
    userId: user.UserID, role: user.Role, district: user.District || '',
    fullName: user.FullName, email: user.Email || ''
  });
  cache.put('SESSION_' + token, sessionData, SESSION_TTL);
  cache.remove(failKey);
  updateRow('Users', user._rowIndex, { LastLogin: now() });
  logAudit(userId, 'LOGIN', 'User', userId, 'Login successful', '', '');

  return successResponse({
    token: token, role: user.Role, fullName: user.FullName,
    district: user.District || '', userId: user.UserID
  }, 'Login successful');
}

function handleLogout(token) {
  var cache = CacheService.getScriptCache();
  var session = getSession(token);
  if (session) {
    logAudit(session.userId, 'LOGOUT', 'User', session.userId, '', '', '');
    cache.remove('SESSION_' + token);
  }
  return successResponse(null, 'Logged out');
}

function getSession(token) {
  if (!token) return null;
  var data = CacheService.getScriptCache().get('SESSION_' + token);
  if (!data) return null;
  try { return JSON.parse(data); } catch(e) { return null; }
}

function validateSession(token) { return getSession(token); }

function handleChangePassword(data, session) {
  if (!data.oldPassword || !data.newPassword) return errorResponse('Old and new passwords are required');
  if (data.newPassword.length < 6) return errorResponse('Password must be at least 6 characters');

  var user = findRow('Users', 'UserID', session.userId);
  if (!user) return errorResponse('User not found');

  if (hashPassword(data.oldPassword, user.Salt) !== user.PasswordHash)
    return errorResponse('Current password is incorrect');

  var newSalt = generateSalt();
  var newHash = hashPassword(data.newPassword, newSalt);
  updateRow('Users', user._rowIndex, { PasswordHash: newHash, Salt: newSalt, UpdatedAt: now() });
  logAudit(session.userId, 'UPDATE', 'User', session.userId, 'Password changed', '', '');
  return successResponse(null, 'Password changed successfully');
}
