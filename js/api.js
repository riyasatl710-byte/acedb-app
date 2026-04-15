/* ACEDB - api.js  API communication layer */
const API = {
  async call(action, data = {}, requireAuth = true) {
    const url = ACEDB_CONFIG.API_URL;
    if (!url || url === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      showToast('API URL not configured. Please update config.js', 'error');
      return { success: false, error: 'API not configured' };
    }

    const body = { action, data };
    if (requireAuth) {
      const session = getStoredSession();
      if (!session || !session.token) {
        window.location.href = 'index.html';
        return { success: false, error: 'Not authenticated' };
      }
      body.token = session.token;
    }

    showLoading(true);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
        redirect: 'follow'
      });
      const result = await response.json();
      showLoading(false);

      if (!result.success && result.code === 401) {
        clearSession();
        showToast(t('session_expired'), 'warning');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return result;
      }
      return result;
    } catch (err) {
      showLoading(false);
      console.error('API Error:', err);
      showToast('Network error. Please try again.', 'error');
      return { success: false, error: err.message };
    }
  },

  // Public endpoints
  login(userId, password) { return this.call('login', { userId, password }, false); },
  getPublicDashboard() { return this.call('getPublicDashboard', {}, false); },
  getPublicDistricts() { return this.call('getPublicDistricts', {}, false); },
  getPublicSchemes() { return this.call('getPublicSchemes', {}, false); },
  
  // Auth
  logout() { return this.call('logout'); },
  changePassword(oldPassword, newPassword) { return this.call('changePassword', { oldPassword, newPassword }); },
  validateToken() { return this.call('validateToken'); },

  // Employees
  getEmployees(filters = {}) { return this.call('getEmployees', filters); },
  getEmployee(empId) { return this.call('getEmployee', { empId }); },
  addEmployee(data) { return this.call('addEmployee', data); },
  editEmployee(data) { return this.call('editEmployee', data); },
  deleteEmployee(empId) { return this.call('deleteEmployee', { empId }); },
  suspendEmployee(empId, reason) { return this.call('suspendEmployee', { empId, reason }); },
  revokeSuspension(empId) { return this.call('revokeSuspension', { empId }); },

  // Salary
  getSalaryHistory(filters = {}) { return this.call('getSalaryHistory', filters); },
  addSalary(data) { return this.call('addSalary', data); },
  updateSalary(data) { return this.call('updateSalary', data); },
  getSalaryRevisions(filters = {}) { return this.call('getSalaryRevisions', filters); },
  addSalaryRevision(data) { return this.call('addSalaryRevision', data); },

  // Leave
  getLeaveRecords(filters = {}) { return this.call('getLeaveRecords', filters); },
  addLeave(data) { return this.call('addLeave', data); },
  editLeave(data) { return this.call('editLeave', data); },
  getLeaveBalance(empId, year) { return this.call('getLeaveBalance', { empId, year }); },
  getLeaveMonthly(empId, year) { return this.call('getLeaveMonthly', { empId, year }); },

  // Contracts
  getContracts(filters = {}) { return this.call('getContracts', filters); },
  addContract(data) { return this.call('addContract', data); },
  editContract(data) { return this.call('editContract', data); },
  getExpiringContracts(days = 60) { return this.call('getExpiringContracts', { daysAhead: days }); },

  // Notifications
  getNotifications() { return this.call('getNotifications'); },
  addNotification(data) { return this.call('addNotification', data); },
  editNotification(data) { return this.call('editNotification', data); },
  deleteNotification(notifId) { return this.call('deleteNotification', { notifId }); },

  // Reports
  getInternalDashboard() { return this.call('getInternalDashboard'); },
  generateReport(reportType, filters = {}) { return this.call('generateReport', { reportType, ...filters }); },
  exportReport(reportType, filters = {}) { return this.call('exportReport', { reportType, ...filters }); },
  getServiceReport(minYears, filters = {}) { return this.call('getServiceReport', { minYears, ...filters }); },

  // Users
  getUsers() { return this.call('getUsers'); },
  createUser(data) { return this.call('createUser', data); },
  editUser(data) { return this.call('editUser', data); },
  deleteUser(userId) { return this.call('deleteUser', { userId }); },
  resetPassword(userId, newPassword) { return this.call('resetPassword', { userId, newPassword }); },

  // Config
  getConfig() { return this.call('getConfig'); },
  updateConfig(key, value) { return this.call('updateConfig', { key, value }); },
  getDistricts() { return this.call('getDistricts'); },
  getSchemes() { return this.call('getSchemes'); },
  addScheme(scheme) { return this.call('addScheme', { scheme }); },
  deleteScheme(scheme) { return this.call('deleteScheme', { scheme }); },

  // Audit
  getAuditLog(filters = {}) { return this.call('getAuditLog', filters); }
};
