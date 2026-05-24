/**
 * ACEDB - RBAC.gs
 * Role-Based Access Control middleware.
 */

var ROLES = { SuperAdmin:5, ITAdmin:4, SectionAdmin:3, DistrictAdmin:2, Viewer:1 };

var PERMISSIONS = {
  'user.create':['SuperAdmin'], 'user.edit':['SuperAdmin'], 'user.delete':['SuperAdmin'],
  'user.list':['SuperAdmin','ITAdmin'], 'user.resetPassword':['SuperAdmin','ITAdmin'],
  'employee.create':['SuperAdmin','DistrictAdmin'], 'employee.edit':['SuperAdmin','DistrictAdmin'],
  'employee.delete':['SuperAdmin','DistrictAdmin'],
  'employee.view':['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'],
  'employee.suspend':['SuperAdmin','DistrictAdmin'],
  'salary.create':['SuperAdmin','DistrictAdmin'], 'salary.edit':['SuperAdmin','DistrictAdmin'],
  'salary.view':['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'],
  'leave.create':['SuperAdmin','DistrictAdmin'], 'leave.edit':['SuperAdmin','DistrictAdmin'],
  'leave.view':['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'],
  'contract.create':['SuperAdmin','SectionAdmin','ITAdmin'],
  'contract.edit':['SuperAdmin','SectionAdmin','ITAdmin'],
  'contract.view':['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'],
  'notification.create':['SuperAdmin','SectionAdmin','ITAdmin'],
  'notification.edit':['SuperAdmin','SectionAdmin','ITAdmin'],
  'notification.delete':['SuperAdmin','SectionAdmin','ITAdmin'],
  'notification.view':['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'],
  'report.view':['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'],
  'report.export':['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'],
  'audit.view':['SuperAdmin','ITAdmin'],
  'config.view':['SuperAdmin'], 'config.edit':['SuperAdmin'],
  'scheme.create':['SuperAdmin'], 'scheme.edit':['SuperAdmin']
};

function hasPermission(session, permission) {
  if (!session || !session.role) return false;
  var allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.indexOf(session.role) !== -1;
}

function checkPermission(session, permission) {
  if (!hasPermission(session, permission)) return errorResponse('Unauthorized: insufficient permissions.', 403);
  return null;
}

function canAccessDistrict(session, targetDistrict) {
  if (!session) return false;
  if (['SuperAdmin','ITAdmin','SectionAdmin','Viewer'].indexOf(session.role) !== -1) return true;
  return session.role === 'DistrictAdmin' && session.district === targetDistrict;
}

function filterByDistrictAccess(session, rows) {
  if (['SuperAdmin','ITAdmin','SectionAdmin','Viewer'].indexOf(session.role) !== -1) return rows;
  if (session.role === 'DistrictAdmin') return rows.filter(function(r) { return r.District === session.district; });
  return [];
}

function getRoleLevel(role) { return ROLES[role] || 0; }
