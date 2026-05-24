/**
 * ACEDB - AuditModule.gs
 */

function logAudit(userId, action, module, recordId, description, oldValue, newValue) {
  try {
    var sheet = getSheet('Audit_Log');
    if (!sheet) return;
    sheet.appendRow([
      'LOG-' + new Date().getTime(), now(), userId || 'SYSTEM',
      action || '', module || '', recordId || '',
      description || '', oldValue || '', newValue || ''
    ]);
  } catch(e) { Logger.log('Audit error: ' + e.message); }
}

function handleGetAuditLog(data, session) {
  var pc = checkPermission(session, 'audit.view');
  if (pc) return pc;
  var rows = readAllRows('Audit_Log');
  if (data.userId) rows = rows.filter(function(r) { return r.UserID === data.userId; });
  if (data.action) rows = rows.filter(function(r) { return r.Action === data.action; });
  if (data.module) rows = rows.filter(function(r) { return r.Module === data.module; });
  if (data.fromDate) { var f=new Date(data.fromDate); rows=rows.filter(function(r){return new Date(r.Timestamp)>=f;}); }
  if (data.toDate) { var t=new Date(data.toDate); t.setHours(23,59,59); rows=rows.filter(function(r){return new Date(r.Timestamp)<=t;}); }
  rows.sort(function(a,b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });
  rows = rows.slice(0, parseInt(data.limit)||200);
  return successResponse(serializeRows(rows), 'Audit log retrieved');
}
