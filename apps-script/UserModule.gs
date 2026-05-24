/**
 * ACEDB - UserModule.gs
 */

function handleGetUsers(data, session) {
  var pc = checkPermission(session, 'user.list');
  if (pc) return pc;
  var rows = readAllRows('Users');
  // Remove sensitive fields
  var users = rows.map(function(r) {
    return {
      UserID: r.UserID, FullName: r.FullName, Role: r.Role,
      District: r.District, Email: r.Email, Phone: r.Phone,
      IsActive: r.IsActive, LastLogin: r.LastLogin ? formatDateISO(r.LastLogin) : '',
      CreatedAt: r.CreatedAt
    };
  });
  return successResponse(users, 'Users retrieved');
}

function handleCreateUser(data, session) {
  var pc = checkPermission(session, 'user.create');
  if (pc) return pc;

  var missing = validateRequired(data, ['userId', 'fullName', 'role']);
  if (missing) return errorResponse('Missing required field: ' + missing);

  var validRoles = ['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'];
  if (validRoles.indexOf(data.role) === -1) return errorResponse('Invalid role');

  // Check if DistrictAdmin has a district
  if (data.role === 'DistrictAdmin' && !data.district) return errorResponse('District is required for District Admin');

  // Check duplicate
  var existing = findRow('Users', 'UserID', data.userId);
  if (existing) return errorResponse('User ID already exists');

  var password = data.password || getConfigValue('DEFAULT_PASSWORD') || 'Acedb@2025';
  var salt = generateSalt();
  var hash = hashPassword(password, salt);

  appendRow_('Users', {
    UserID: sanitize(data.userId),
    PasswordHash: hash,
    Salt: salt,
    FullName: sanitize(data.fullName),
    Role: data.role,
    District: sanitize(data.district || ''),
    Email: sanitize(data.email || ''),
    Phone: sanitize(data.phone || ''),
    IsActive: true,
    LastLogin: '',
    CreatedBy: session.userId,
    CreatedAt: now(),
    UpdatedAt: ''
  });

  logAudit(session.userId, 'CREATE', 'User', data.userId, 'User created: ' + data.fullName + ' (' + data.role + ')', '', '');
  return successResponse(null, 'User created successfully. Default password: ' + password);
}

function handleEditUser(data, session) {
  var pc = checkPermission(session, 'user.edit');
  if (pc) return pc;
  if (!data.userId) return errorResponse('User ID is required');

  var user = findRow('Users', 'UserID', data.userId);
  if (!user) return errorResponse('User not found');

  var updates = { UpdatedAt: now() };
  if (data.fullName) updates.FullName = sanitize(data.fullName);
  if (data.role) updates.Role = data.role;
  if (data.district !== undefined) updates.District = sanitize(data.district);
  if (data.email !== undefined) updates.Email = sanitize(data.email);
  if (data.phone !== undefined) updates.Phone = sanitize(data.phone);
  if (data.isActive !== undefined) updates.IsActive = data.isActive;

  updateRow('Users', user._rowIndex, updates);
  logAudit(session.userId, 'UPDATE', 'User', data.userId, 'User updated', JSON.stringify({role:user.Role}), JSON.stringify(updates));
  return successResponse(null, 'User updated');
}

function handleDeleteUser(data, session) {
  var pc = checkPermission(session, 'user.delete');
  if (pc) return pc;
  if (!data.userId) return errorResponse('User ID is required');
  if (data.userId === session.userId) return errorResponse('Cannot delete your own account');
  if (data.userId === 'superadmin') return errorResponse('Cannot delete the default super admin');

  var user = findRow('Users', 'UserID', data.userId);
  if (!user) return errorResponse('User not found');

  deleteRow_('Users', user._rowIndex);
  logAudit(session.userId, 'DELETE', 'User', data.userId, 'User deleted: ' + user.FullName, '', '');
  return successResponse(null, 'User deleted');
}

function handleResetPassword(data, session) {
  var pc = checkPermission(session, 'user.resetPassword');
  if (pc) return pc;
  if (!data.userId) return errorResponse('User ID is required');

  var user = findRow('Users', 'UserID', data.userId);
  if (!user) return errorResponse('User not found');

  var newPassword = data.newPassword || getConfigValue('DEFAULT_PASSWORD') || 'Acedb@2025';
  var newSalt = generateSalt();
  var newHash = hashPassword(newPassword, newSalt);
  updateRow('Users', user._rowIndex, { PasswordHash: newHash, Salt: newSalt, UpdatedAt: now() });

  logAudit(session.userId, 'UPDATE', 'User', data.userId, 'Password reset by ' + session.userId, '', '');
  return successResponse(null, 'Password reset to: ' + newPassword);
}
