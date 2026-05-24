/**
 * ACEDB - NotificationModule.gs
 */

function handleGetNotifications(data, session) {
  var rows = readAllRows('Notifications');
  var today = new Date();

  rows = rows.filter(function(r) {
    if (String(r.IsActive) !== 'TRUE' && String(r.IsActive) !== 'true' && r.IsActive !== true) return false;
    if (r.ExpiresAt && new Date(r.ExpiresAt) < today) return false;
    if (r.VisibleTo === 'All') return true;
    if (!session) return r.VisibleTo === 'All';
    if (r.VisibleTo === session.role) return true;
    if (r.VisibleTo === session.district) return true;
    return false;
  });

  rows.sort(function(a, b) {
    var pOrder = { Urgent: 3, High: 2, Normal: 1 };
    var pDiff = (pOrder[b.Priority] || 0) - (pOrder[a.Priority] || 0);
    if (pDiff !== 0) return pDiff;
    return new Date(b.CreatedAt) - new Date(a.CreatedAt);
  });

  return successResponse(serializeRows(rows), rows.length + ' notifications');
}

function handleAddNotification(data, session) {
  var pc = checkPermission(session, 'notification.create');
  if (pc) return pc;

  var missing = validateRequired(data, ['title', 'content']);
  if (missing) return errorResponse('Missing required field: ' + missing);

  var notifId = generateId('NTF');
  appendRow_('Notifications', {
    NotifID: notifId,
    Title: sanitize(data.title),
    Content: data.content,
    Type: data.type || 'Text',
    AttachmentURL: data.attachmentURL || '',
    Priority: data.priority || 'Normal',
    VisibleTo: data.visibleTo || 'All',
    IsActive: true,
    CreatedBy: session.userId,
    CreatedAt: now(),
    ExpiresAt: data.expiresAt || ''
  });

  logAudit(session.userId, 'CREATE', 'Notification', notifId, 'Notification: ' + data.title, '', '');
  return successResponse({ notifId: notifId }, 'Notification posted');
}

function handleEditNotification(data, session) {
  var pc = checkPermission(session, 'notification.edit');
  if (pc) return pc;
  if (!data.notifId) return errorResponse('Notification ID is required');

  var rec = findRow('Notifications', 'NotifID', data.notifId);
  if (!rec) return errorResponse('Notification not found');

  var updates = {};
  if (data.title) updates.Title = sanitize(data.title);
  if (data.content) updates.Content = data.content;
  if (data.type) updates.Type = data.type;
  if (data.attachmentURL !== undefined) updates.AttachmentURL = data.attachmentURL;
  if (data.priority) updates.Priority = data.priority;
  if (data.visibleTo) updates.VisibleTo = data.visibleTo;
  if (data.isActive !== undefined) updates.IsActive = data.isActive;
  if (data.expiresAt !== undefined) updates.ExpiresAt = data.expiresAt;

  updateRow('Notifications', rec._rowIndex, updates);
  logAudit(session.userId, 'UPDATE', 'Notification', data.notifId, 'Notification updated', '', '');
  return successResponse(null, 'Notification updated');
}

function handleDeleteNotification(data, session) {
  var pc = checkPermission(session, 'notification.delete');
  if (pc) return pc;
  if (!data.notifId) return errorResponse('Notification ID is required');

  var rec = findRow('Notifications', 'NotifID', data.notifId);
  if (!rec) return errorResponse('Notification not found');

  deleteRow_('Notifications', rec._rowIndex);
  logAudit(session.userId, 'DELETE', 'Notification', data.notifId, 'Notification deleted: ' + rec.Title, '', '');
  return successResponse(null, 'Notification deleted');
}
