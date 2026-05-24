/**
 * ACEDB - Code.gs
 * Main entry point. Routes all doGet and doPost requests.
 */

function doGet(e) {
  // Public dashboard endpoint
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'publicDashboard';
  if (action === 'publicDashboard') return handleGetPublicDashboard({});
  return errorResponse('Use POST for API calls');
}

function doPost(e) {
  try {
    var body = {};
    try {
      body = JSON.parse(e.postData.contents);
    } catch (ex) {
      return errorResponse('Invalid JSON body');
    }

    checkAndUpgradeEmployeesHeaders();
    var action = body.action;
    var token = body.token;
    var data = body.data || {};

    // --- Public actions (no auth) ---
    if (action === 'login') return handleLogin(data);
    if (action === 'getPublicDashboard') return handleGetPublicDashboard(data);
    if (action === 'getPublicSchemes') {
      var val = getConfigValue('SCHEMES') || '';
      var schemes = val ? val.split(',').map(function(s){return s.trim();}).filter(function(s){return s!=='';}) : [];
      return successResponse(schemes, 'Schemes');
    }
    if (action === 'getPublicDistricts') {
      var val2 = getConfigValue('DISTRICTS') || '';
      var districts = val2 ? val2.split(',').map(function(d){return d.trim();}) : [];
      return successResponse(districts, 'Districts');
    }

    // --- Authenticated actions ---
    var session = validateSession(token);
    if (!session) return errorResponse('Session expired. Please login again.', 401);

    switch (action) {
      // Auth
      case 'logout': return handleLogout(token);
      case 'changePassword': return handleChangePassword(data, session);
      case 'validateToken': return successResponse({ role: session.role, fullName: session.fullName, district: session.district, userId: session.userId }, 'Valid');

      // Users
      case 'getUsers': return handleGetUsers(data, session);
      case 'createUser': return handleCreateUser(data, session);
      case 'editUser': return handleEditUser(data, session);
      case 'deleteUser': return handleDeleteUser(data, session);
      case 'resetPassword': return handleResetPassword(data, session);

      // Employees
      case 'getEmployees': return handleGetEmployees(data, session);
      case 'getEmployee': return handleGetEmployee(data, session);
      case 'addEmployee': return handleAddEmployee(data, session);
      case 'editEmployee': return handleEditEmployee(data, session);
      case 'deleteEmployee': return handleDeleteEmployee(data, session);
      case 'suspendEmployee': return handleSuspendEmployee(data, session);
      case 'revokeSuspension': return handleRevokeSuspension(data, session);
      case 'getServiceReport': return handleGetServiceReport(data, session);

      // Salary
      case 'getSalaryHistory': return handleGetSalaryHistory(data, session);
      case 'addSalary': return handleAddSalary(data, session);
      case 'updateSalary': return handleUpdateSalary(data, session);
      case 'getSalaryRevisions': return handleGetSalaryRevisions(data, session);
      case 'addSalaryRevision': return handleAddSalaryRevision(data, session);
      case 'updateEmployeeHonorariumStatus': return handleUpdateEmployeeHonorariumStatus(data, session);

      // Leave
      case 'getLeaveRecords': return handleGetLeaveRecords(data, session);
      case 'addLeave': return handleAddLeave(data, session);
      case 'editLeave': return handleEditLeave(data, session);
      case 'getLeaveBalance': return handleGetLeaveBalance(data, session);
      case 'getLeaveMonthly': return handleGetLeaveMonthly(data, session);

      // Contracts
      case 'getContracts': return handleGetContracts(data, session);
      case 'addContract': return handleAddContract(data, session);
      case 'editContract': return handleEditContract(data, session);
      case 'getExpiringContracts': return handleGetExpiringContracts(data, session);

      // Notifications
      case 'getNotifications': return handleGetNotifications(data, session);
      case 'addNotification': return handleAddNotification(data, session);
      case 'editNotification': return handleEditNotification(data, session);
      case 'deleteNotification': return handleDeleteNotification(data, session);

      // Reports
      case 'getInternalDashboard': return handleGetInternalDashboard(data, session);
      case 'generateReport': return handleGenerateReport(data, session);
      case 'exportReport': return handleExportReport(data, session);

      // Config
      case 'getConfig': return handleGetConfig(data, session);
      case 'getFeatureLocks': return handleGetFeatureLocks(data, session);
      case 'updateConfig': return handleUpdateConfig(data, session);
      case 'getDistricts': return handleGetDistricts(data, session);
      case 'getSchemes': return handleGetSchemes(data, session);
      case 'addScheme': return handleAddScheme(data, session);
      case 'deleteScheme': return handleDeleteScheme(data, session);

      // Audit
      case 'getAuditLog': return handleGetAuditLog(data, session);

      default:
        return errorResponse('Unknown action: ' + action);
    }
  } catch (err) {
    Logger.log('ACEDB Error: ' + err.message + '\n' + err.stack);
    return errorResponse('Server error: ' + err.message, 500);
  }
}

/**
 * Custom menu for setup (run once from Google Sheets).
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ACEDB Admin')
    .addItem('Setup Database', 'setupDatabase')
    .addItem('Backup Data', 'backupData')
    .addToUi();
}

/**
 * Backup all sheets to a new spreadsheet.
 */
function backupData() {
  var ss = getSpreadsheet();
  var backupName = 'ACEDB_Backup_' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd_HH-mm');
  var backup = SpreadsheetApp.create(backupName);
  var sheets = ss.getSheets();
  sheets.forEach(function(sheet) {
    sheet.copyTo(backup);
  });
  // Delete default Sheet1 from backup
  var defSheet = backup.getSheetByName('Sheet1');
  if (defSheet && backup.getSheets().length > 1) backup.deleteSheet(defSheet);
  SpreadsheetApp.getUi().alert('Backup created: ' + backupName + '\nFind it in your Google Drive.');
}
