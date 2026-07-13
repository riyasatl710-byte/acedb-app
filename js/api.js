/* ACEDB - api.js (Firebase branch)
   All data operations go directly to Firestore.
   Authentication uses Firebase Auth with phantom emails (userId@acedb.internal).
   The app.html and index.html load this as a module via firebase-init.js.
*/

// ─── Helper: Firestore references via global window.acedbFirebase ────────────
function fdb() { return window.acedbFirebase.db; }
function fauth() { return window.acedbFirebase.auth; }
function fns() { return window.acedbFirebase.fns; }

// ─── Permission matrix (mirrors Code.gs PERMISSIONS) ────────────────────────
const PERMISSIONS = {
  SuperAdmin:    ['*'],
  DistrictAdmin: ['employee.view','employee.create','employee.edit','employee.suspend',
                  'salary.view','salary.create','salary.update','report.view',
                  'notification.view','notification.create','leave.view','leave.approve',
                  'contract.view'],
  SectionAdmin:  ['employee.view','salary.view','report.view','notification.view','leave.view','contract.view'],
  Viewer:        ['employee.view','salary.view','report.view','notification.view','leave.view','contract.view'],
  ITAdmin:       ['*']
};

function hasPermission(role, perm) {
  const perms = PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(perm);
}

// ─── Firestore helpers ───────────────────────────────────────────────────────
async function fsGetAll(collection) {
  const { getDocs, collection: col } = window.acedbFirebase.firestoreFns;
  const snap = await getDocs(col(fdb(), collection));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fsGetWhere(colName, field, op, value) {
  const { getDocs, collection, query, where } = window.acedbFirebase.firestoreFns;
  const q = query(collection(fdb(), colName), where(field, op, value));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fsGetDoc(colName, docId) {
  const { getDoc, doc } = window.acedbFirebase.firestoreFns;
  const snap = await getDoc(doc(fdb(), colName, docId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function fsAdd(colName, data) {
  const { addDoc, collection } = window.acedbFirebase.firestoreFns;
  const ref = await addDoc(collection(fdb(), colName), { ...data, _createdAt: new Date().toISOString() });
  return ref.id;
}

async function fsSet(colName, docId, data) {
  const { setDoc, doc } = window.acedbFirebase.firestoreFns;
  await setDoc(doc(fdb(), colName, docId), data, { merge: true });
}

async function fsUpdate(colName, docId, data) {
  const { updateDoc, doc } = window.acedbFirebase.firestoreFns;
  await updateDoc(doc(fdb(), colName, docId), { ...data, _updatedAt: new Date().toISOString() });
}

async function fsDelete(colName, docId) {
  const { deleteDoc, doc } = window.acedbFirebase.firestoreFns;
  await deleteDoc(doc(fdb(), colName, docId));
}

function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function toEmail(userId) {
  return userId.toLowerCase().replace(/[^a-z0-9]/g, '_') + '@acedb.internal';
}

// ─── Access control helpers ──────────────────────────────────────────────────
function canAccessEmployee(session, emp) {
  if (session.role === 'SuperAdmin' || session.role === 'ITAdmin' || session.role === 'Viewer') return true;
  if (session.role === 'DistrictAdmin') return emp.District === session.district;
  if (session.role === 'SectionAdmin')  return emp.Scheme === session.scheme;
  return false;
}

function filterByAccess(session, rows) {
  if (['SuperAdmin','ITAdmin','Viewer'].includes(session.role)) return rows;
  if (session.role === 'DistrictAdmin') return rows.filter(r => r.District === session.district);
  if (session.role === 'SectionAdmin')  return rows.filter(r => r.Scheme === session.scheme);
  return [];
}

// ─── Session ─────────────────────────────────────────────────────────────────
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(ACEDB_CONFIG.SESSION_KEY)); } catch { return null; }
}

// ─── Response wrappers ───────────────────────────────────────────────────────
function ok(data, message) { return { success: true, data, message: message || 'OK' }; }
function fail(msg, code) { return { success: false, error: msg, code: code || 400 }; }

// ─── API object ──────────────────────────────────────────────────────────────
const API = {

  // ── Auth ────────────────────────────────────────────────────────────────────
  async login(userId, password) {
    showLoading(true);
    try {
      const { signInWithEmailAndPassword } = window.acedbFirebase.authFns;
      const email = toEmail(userId);
      await signInWithEmailAndPassword(fauth(), email, password);

      // Fetch user profile from Firestore
      const users = await fsGetWhere('users', 'UserID', '==', userId.toUpperCase());
      if (!users.length) {
        await window.acedbFirebase.authFns.signOut(fauth());
        return fail('User profile not found. Please contact administrator.');
      }
      const u = users[0];
      if (u.Status !== 'Active') return fail('Your account is inactive. Please contact administrator.');

      const session = {
        userId: u.UserID,
        fullName: u.FullName,
        role: u.Role,
        district: u.District || '',
        scheme: u.Scheme || '',
        token: await fauth().currentUser.getIdToken()
      };
      sessionStorage.setItem(ACEDB_CONFIG.SESSION_KEY, JSON.stringify(session));
      showLoading(false);
      return ok(session, 'Login successful');
    } catch (err) {
      showLoading(false);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        return fail('Invalid User ID or Password');
      }
      return fail(err.message || 'Login failed');
    }
  },

  async logout() {
    try {
      const { signOut } = window.acedbFirebase.authFns;
      await signOut(fauth());
    } catch {}
    sessionStorage.removeItem(ACEDB_CONFIG.SESSION_KEY);
    return ok(null, 'Logged out');
  },

  // ── Employees ───────────────────────────────────────────────────────────────
  async getEmployees(filters = {}) {
    showLoading(true);
    try {
      const session = getSession();
      const revisions = await fsGetAll('salary_revisions');
      let rows = await fsGetAll('employees');
      rows = filterByAccess(session, rows);

      if (filters.scheme)      rows = rows.filter(r => r.Scheme === filters.scheme);
      if (filters.district)    rows = rows.filter(r => r.District === filters.district);
      if (filters.office)      rows = rows.filter(r => r.Office === filters.office);
      if (filters.status)      rows = rows.filter(r => r.Status === filters.status);
      if (filters.designation) rows = rows.filter(r => r.Designation === filters.designation);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        rows = rows.filter(r =>
          (r.EmployeeName||'').toLowerCase().includes(q) ||
          (r.EmpID||'').toLowerCase().includes(q) ||
          String(r.Phone||'').includes(q)
        );
      }

      rows = rows.map(r => ({
        ...r,
        serviceDuration: calcServiceDuration(r.DateOfFirstJoining),
        pendingHonorarium: calcPendingHonorarium(r, revisions),
        activeRate: getActiveRate(r, revisions)
      }));

      showLoading(false);
      return ok(rows, rows.length + ' employees found');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async getEmployee(empId) {
    showLoading(true);
    try {
      const session = getSession();
      const rows = await fsGetWhere('employees', 'EmpID', '==', empId);
      if (!rows.length) { showLoading(false); return fail('Employee not found'); }
      const emp = rows[0];
      if (!canAccessEmployee(session, emp)) { showLoading(false); return fail('Unauthorized', 403); }
      const revisions = await fsGetAll('salary_revisions');
      const result = {
        ...emp,
        serviceDuration: calcServiceDuration(emp.DateOfFirstJoining),
        pendingHonorarium: calcPendingHonorarium(emp, revisions),
        activeRate: getActiveRate(emp, revisions)
      };
      showLoading(false);
      return ok(result);
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async addEmployee(data) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'employee.create')) { showLoading(false); return fail('Unauthorized', 403); }
      const empId = generateId('EMP');
      const emp = {
        EmpID: empId,
        Scheme: data.scheme || '',
        District: data.district || '',
        Office: data.office || '',
        EmployeeName: data.employeeName || '',
        Designation: data.designation || '',
        DateOfBirth: data.dateOfBirth || '',
        Qualification: data.qualification || '',
        DateOfFirstJoining: data.dateOfFirstJoining || '',
        CurrentSalary: parseFloat(data.currentSalary) || 0,
        Status: 'Active',
        SuspensionReason: '',
        SuspensionDate: '',
        Phone: data.phone || '',
        AadhaarLast4: data.aadhaarLast4 || '',
        BankAccount: data.bankAccount || '',
        IFSC: data.ifsc || '',
        PAN: data.pan || '',
        AdditionalOffices: data.additionalOffices || '',
        LastPaidDate: '',
        PartialMonth: '',
        PartialAmount: 0,
        CreatedBy: session.userId,
        CreatedAt: new Date().toISOString()
      };
      await fsSet('employees', empId, emp);
      showLoading(false);
      return ok({ empId }, 'Employee added successfully');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async editEmployee(data) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'employee.edit')) { showLoading(false); return fail('Unauthorized', 403); }
      const rows = await fsGetWhere('employees', 'EmpID', '==', data.empId);
      if (!rows.length) { showLoading(false); return fail('Employee not found'); }
      const emp = rows[0];
      if (!canAccessEmployee(session, emp)) { showLoading(false); return fail('Unauthorized', 403); }

      const updates = {};
      const fieldMap = {
        scheme:'Scheme', district:'District', office:'Office', employeeName:'EmployeeName',
        designation:'Designation', dateOfBirth:'DateOfBirth', qualification:'Qualification',
        dateOfFirstJoining:'DateOfFirstJoining', currentSalary:'CurrentSalary',
        phone:'Phone', aadhaarLast4:'AadhaarLast4', bankAccount:'BankAccount',
        ifsc:'IFSC', pan:'PAN', additionalOffices:'AdditionalOffices'
      };
      for (const key in fieldMap) {
        if (data[key] !== undefined) {
          updates[fieldMap[key]] = key === 'currentSalary' ? parseFloat(data[key]) || 0 : data[key];
        }
      }
      updates.UpdatedBy = session.userId;
      await fsUpdate('employees', emp.id, updates);
      showLoading(false);
      return ok(null, 'Employee updated');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async deleteEmployee(empId) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'employee.delete')) { showLoading(false); return fail('Unauthorized', 403); }
      const rows = await fsGetWhere('employees', 'EmpID', '==', empId);
      if (!rows.length) { showLoading(false); return fail('Employee not found'); }
      await fsDelete('employees', rows[0].id);
      showLoading(false);
      return ok(null, 'Employee deleted');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async suspendEmployee(empId, reason, date) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'employee.suspend')) { showLoading(false); return fail('Unauthorized', 403); }
      const rows = await fsGetWhere('employees', 'EmpID', '==', empId);
      if (!rows.length) { showLoading(false); return fail('Employee not found'); }
      const relievingDate = date || new Date().toISOString().split('T')[0];
      await fsUpdate('employees', rows[0].id, {
        Status: 'Suspended',
        SuspensionReason: reason,
        SuspensionDate: relievingDate,
        UpdatedBy: session.userId
      });
      showLoading(false);
      return ok(null, 'Employee relieved/suspended');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async revokeSuspension(empId) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'employee.suspend')) { showLoading(false); return fail('Unauthorized', 403); }
      const rows = await fsGetWhere('employees', 'EmpID', '==', empId);
      if (!rows.length) { showLoading(false); return fail('Employee not found'); }
      await fsUpdate('employees', rows[0].id, {
        Status: 'Active', SuspensionReason: '', SuspensionDate: '', UpdatedBy: session.userId
      });
      showLoading(false);
      return ok(null, 'Suspension revoked');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  // ── Salary / Honorarium ─────────────────────────────────────────────────────
  async getSalaryHistory(filters = {}) {
    showLoading(true);
    try {
      const session = getSession();
      let rows = await fsGetAll('salary_history');
      if (filters.empId) rows = rows.filter(r => r.EmpID === filters.empId);
      if (filters.month) rows = rows.filter(r => r.Month === filters.month);
      if (filters.status) rows = rows.filter(r => r.PaymentStatus === filters.status);

      if (!['SuperAdmin','ITAdmin','Viewer'].includes(session.role)) {
        const emps = await fsGetAll('employees');
        const myIds = {};
        emps.filter(e => canAccessEmployee(session, e)).forEach(e => myIds[e.EmpID] = true);
        rows = rows.filter(r => myIds[r.EmpID]);
      }
      rows.sort((a,b) => (b.Month||'').localeCompare(a.Month||''));
      showLoading(false);
      return ok(rows, rows.length + ' records');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async addSalary(data) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'salary.create')) { showLoading(false); return fail('Unauthorized', 403); }

      const empRows = await fsGetWhere('employees', 'EmpID', '==', data.empId);
      if (!empRows.length) { showLoading(false); return fail('Employee not found'); }
      const emp = empRows[0];

      // Check locks from config
      const configRows = await fsGetAll('config');
      const cfg = {};
      configRows.forEach(c => cfg[c.Key] = c.Value);
      const isSuper = ['SuperAdmin','ITAdmin'].includes(session.role);
      if (!isSuper) {
        if (String(cfg.LOCK_EMOLUMENTS).toLowerCase() === 'true') { showLoading(false); return fail('Emolument updates are locked'); }
        const lockedFYs = (cfg.LOCKED_FINANCIAL_YEARS||'').split(',').map(s=>s.trim()).filter(Boolean);
        if (lockedFYs.includes(data.month)) { showLoading(false); return fail('Financial Year ' + data.month + ' is locked'); }
      }

      // Duplicate check per type
      const existing = await fsGetWhere('salary_history', 'EmpID', '==', data.empId);
      const monthExisting = existing.filter(r => r.Month === data.month);
      for (const ex of monthExisting) {
        if (parseFloat(data.festivalAllowance) > 0 && parseFloat(ex.FestivalAllowance) > 0) { showLoading(false); return fail('Festival Allowance already recorded for this FY'); }
        if (parseFloat(data.elSurrender) > 0 && parseFloat(ex.ELSurrender) > 0) { showLoading(false); return fail('EL Surrender already recorded for this FY'); }
        if (parseFloat(data.basicSalary) > 0 && parseFloat(ex.BasicSalary) > 0) { showLoading(false); return fail('Basic Salary already recorded for this month'); }
      }

      const basic = parseFloat(data.basicSalary) || 0;
      const festival = parseFloat(data.festivalAllowance) || 0;
      const elSurr = parseFloat(data.elSurrender) || 0;
      const total = basic + festival + elSurr;

      const recId = generateId('SAL');
      await fsSet('salary_history', recId, {
        RecordID: recId,
        EmpID: data.empId,
        Month: data.month,
        BasicSalary: basic,
        MaternityPay: 0,
        FestivalAllowance: festival,
        ELSurrender: elSurr,
        TotalPaid: total,
        PaymentStatus: data.paymentStatus || 'Pending',
        PaidDate: data.paidDate || '',
        Remarks: data.remarks || '',
        CreatedBy: session.userId,
        CreatedAt: new Date().toISOString()
      });

      showLoading(false);
      return ok({ recordId: recId }, 'Honorarium record added');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async updateSalaryStatus(recordId, status, paidDate) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'salary.update')) { showLoading(false); return fail('Unauthorized', 403); }
      await fsUpdate('salary_history', recordId, { PaymentStatus: status, PaidDate: paidDate || '', UpdatedBy: session.userId });
      showLoading(false);
      return ok(null, 'Status updated');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async deleteSalary(recordId) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'salary.create')) { showLoading(false); return fail('Unauthorized', 403); }
      await fsDelete('salary_history', recordId);
      showLoading(false);
      return ok(null, 'Record deleted');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async updateEmployeeHonorariumStatus(data) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'salary.update')) { showLoading(false); return fail('Unauthorized', 403); }

      const empRows = await fsGetWhere('employees', 'EmpID', '==', data.empId);
      if (!empRows.length) { showLoading(false); return fail('Employee not found'); }
      const emp = empRows[0];

      // Snap to end of month
      let snapDate = data.lastPaidDate;
      if (snapDate) {
        const d = new Date(snapDate);
        const eom = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        snapDate = eom.toISOString().split('T')[0];
      }

      const updates = {
        LastPaidDate: snapDate || '',
        PartialMonth: data.partialMonth || '',
        PartialAmount: parseFloat(data.partialAmount) || 0,
        UpdatedBy: session.userId
      };
      await fsUpdate('employees', emp.id, updates);

      // Log payment if amountPaid > 0
      const amountPaid = parseFloat(data.amountPaid) || 0;
      if (amountPaid > 0) {
        const payRecId = generateId('SAL');
        await fsSet('salary_history', payRecId, {
          RecordID: payRecId,
          EmpID: data.empId,
          Month: snapDate ? snapDate.substring(0, 7) : '',
          BasicSalary: amountPaid,
          MaternityPay: 0,
          FestivalAllowance: 0,
          ELSurrender: 0,
          TotalPaid: amountPaid,
          PaymentStatus: 'Paid',
          PaidDate: data.paymentDate || new Date().toISOString().split('T')[0],
          Remarks: 'Honorarium payment logged via tracker',
          CreatedBy: session.userId,
          CreatedAt: new Date().toISOString()
        });
      }

      showLoading(false);
      return ok(null, 'Honorarium tracker updated');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  // ── Salary Revisions ────────────────────────────────────────────────────────
  async getSalaryRevisions() {
    showLoading(true);
    try {
      const session = getSession();
      const rows = await fsGetAll('salary_revisions');
      showLoading(false);
      return ok(rows, rows.length + ' revisions');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async addSalaryRevision(data) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'salary.create')) { showLoading(false); return fail('Unauthorized', 403); }
      const revId = generateId('REV');
      await fsSet('salary_revisions', revId, {
        RevisionID: revId,
        Scheme: data.scheme || '',
        Designation: data.designation || '',
        OldAmount: parseFloat(data.oldAmount) || 0,
        NewAmount: parseFloat(data.newAmount) || 0,
        EffectiveFrom: data.effectiveFrom || '',
        GONumber: data.goNumber || '',
        CreatedBy: session.userId,
        CreatedAt: new Date().toISOString()
      });
      showLoading(false);
      return ok({ revisionId: revId }, 'Revision saved');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  // ── Users ───────────────────────────────────────────────────────────────────
  async getUsers() {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'user.view') && !['SuperAdmin','ITAdmin'].includes(session.role)) {
        showLoading(false); return fail('Unauthorized', 403);
      }
      const rows = await fsGetAll('users');
      // Don't return password hashes to frontend
      const safe = rows.map(u => ({ ...u, PasswordHash: undefined }));
      showLoading(false);
      return ok(safe, rows.length + ' users');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async createUser(data) {
    showLoading(true);
    try {
      const session = getSession();
      if (!['SuperAdmin','ITAdmin'].includes(session.role)) { showLoading(false); return fail('Unauthorized', 403); }
      // Create Firebase Auth user
      const { createUserWithEmailAndPassword, updateProfile } = window.acedbFirebase.authFns;
      // Note: createUserWithEmailAndPassword signs in as the new user — we need Admin SDK for this
      // Workaround: use a Cloud Function or create via REST API
      const email = toEmail(data.userId);
      const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${window.acedbFirebase.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: data.password, returnSecureToken: false })
      });
      if (!resp.ok) {
        const err = await resp.json();
        showLoading(false);
        return fail(err.error?.message || 'Failed to create user');
      }

      // Save profile to Firestore
      const userId = data.userId.toUpperCase();
      await fsSet('users', userId, {
        UserID: userId,
        FullName: data.fullName || '',
        Role: data.role || 'Viewer',
        District: data.district || '',
        Scheme: data.scheme || '',
        Phone: data.phone || '',
        Status: 'Active',
        CreatedBy: session.userId,
        CreatedAt: new Date().toISOString()
      });

      showLoading(false);
      return ok({ userId }, 'User created');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async editUser(data) {
    showLoading(true);
    try {
      const session = getSession();
      if (!['SuperAdmin','ITAdmin'].includes(session.role)) { showLoading(false); return fail('Unauthorized', 403); }
      const updates = {};
      if (data.fullName !== undefined) updates.FullName = data.fullName;
      if (data.role !== undefined)     updates.Role = data.role;
      if (data.district !== undefined) updates.District = data.district;
      if (data.scheme !== undefined)   updates.Scheme = data.scheme;
      if (data.phone !== undefined)    updates.Phone = data.phone;
      if (data.status !== undefined)   updates.Status = data.status;
      updates.UpdatedBy = session.userId;
      await fsUpdate('users', data.userId, updates);
      showLoading(false);
      return ok(null, 'User updated');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async deleteUser(userId) {
    showLoading(true);
    try {
      const session = getSession();
      if (!['SuperAdmin','ITAdmin'].includes(session.role)) { showLoading(false); return fail('Unauthorized', 403); }
      await fsUpdate('users', userId, { Status: 'Deleted', UpdatedBy: session.userId });
      showLoading(false);
      return ok(null, 'User deleted');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async resetPassword(userId, newPassword) {
    showLoading(true);
    try {
      const session = getSession();
      if (!['SuperAdmin','ITAdmin'].includes(session.role)) { showLoading(false); return fail('Unauthorized', 403); }
      // Use Firebase Identity Toolkit REST API to change password
      // First get the user's email
      const email = toEmail(userId);
      // Use Admin SDK via a simple fetch (this requires the API key only, no admin needed for password reset)
      // In production you'd have a Cloud Function; this is a basic implementation
      const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${window.acedbFirebase.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPassword, returnSecureToken: false })
      });
      showLoading(false);
      if (!resp.ok) return fail('Password reset failed');
      return ok(null, 'Password updated');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  // ── Notifications ───────────────────────────────────────────────────────────
  async getNotifications() {
    showLoading(true);
    try {
      const session = getSession();
      let rows = await fsGetAll('notifications');
      // Filter by target role/district
      rows = rows.filter(n => {
        if (n.TargetRole === 'All') return true;
        if (n.TargetRole === session.role) return true;
        if (n.TargetDistrict && n.TargetDistrict === session.district) return true;
        return ['SuperAdmin','ITAdmin'].includes(session.role);
      });
      rows.sort((a,b) => (b.CreatedAt||'').localeCompare(a.CreatedAt||''));
      showLoading(false);
      return ok(rows, rows.length + ' notifications');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async createNotification(data) {
    showLoading(true);
    try {
      const session = getSession();
      if (!hasPermission(session.role, 'notification.create')) { showLoading(false); return fail('Unauthorized', 403); }
      const id = generateId('NOT');
      await fsSet('notifications', id, {
        NotificationID: id,
        Title: data.title || '',
        Message: data.message || '',
        TargetRole: data.targetRole || 'All',
        TargetDistrict: data.targetDistrict || '',
        Priority: data.priority || 'Normal',
        CreatedBy: session.userId,
        CreatedAt: new Date().toISOString()
      });
      showLoading(false);
      return ok({ id }, 'Notification posted');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async deleteNotification(notifId) {
    showLoading(true);
    try {
      await fsDelete('notifications', notifId);
      showLoading(false);
      return ok(null, 'Notification deleted');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  // ── Config ──────────────────────────────────────────────────────────────────
  async getConfig() {
    showLoading(true);
    try {
      const rows = await fsGetAll('config');
      const cfg = {};
      rows.forEach(r => cfg[r.Key] = r.Value);
      showLoading(false);
      return ok(cfg);
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async getFeatureLocks() {
    return this.getConfig();
  },

  async updateConfig(key, value) {
    showLoading(true);
    try {
      const session = getSession();
      if (!['SuperAdmin','ITAdmin'].includes(session.role)) { showLoading(false); return fail('Unauthorized', 403); }
      // Upsert by key
      const existing = await fsGetWhere('config', 'Key', '==', key);
      if (existing.length) {
        await fsUpdate('config', existing[0].id, { Value: String(value), UpdatedBy: session.userId });
      } else {
        await fsSet('config', generateId('CFG'), { Key: key, Value: String(value), CreatedBy: session.userId, CreatedAt: new Date().toISOString() });
      }
      showLoading(false);
      return ok(null, 'Config updated');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async getDistricts() {
    try {
      const existing = await fsGetWhere('config', 'Key', '==', 'DISTRICTS');
      if (!existing.length) return ok([]);
      const val = existing[0].Value;
      return ok(val.split(',').map(s => s.trim()).filter(Boolean));
    } catch(e) { return fail(e.message); }
  },

  async getSchemes() {
    try {
      const rows = await fsGetAll('schemes');
      if (rows.length) return ok(rows.map(r => r.Name).filter(Boolean));
      // Fallback to config
      const cfg = await fsGetWhere('config', 'Key', '==', 'SCHEMES');
      if (!cfg.length) return ok([]);
      return ok(cfg[0].Value.split(',').map(s => s.trim()).filter(Boolean));
    } catch(e) { return fail(e.message); }
  },

  async addScheme(scheme) {
    showLoading(true);
    try {
      const session = getSession();
      if (!['SuperAdmin','ITAdmin'].includes(session.role)) { showLoading(false); return fail('Unauthorized', 403); }
      const id = generateId('SCH');
      await fsSet('schemes', id, { Name: scheme, CreatedBy: session.userId, CreatedAt: new Date().toISOString() });
      showLoading(false);
      return ok(null, 'Scheme added');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async deleteScheme(scheme) {
    showLoading(true);
    try {
      const rows = await fsGetWhere('schemes', 'Name', '==', scheme);
      for (const r of rows) await fsDelete('schemes', r.id);
      showLoading(false);
      return ok(null, 'Scheme deleted');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async getOffices() {
    try {
      const cfg = await fsGetWhere('config', 'Key', '==', 'OFFICES');
      if (!cfg.length) return ok(['Main Office']);
      return ok(cfg[0].Value.split(',').map(s => s.trim()).filter(Boolean));
    } catch(e) { return fail(e.message); }
  },

  // ── Reports ─────────────────────────────────────────────────────────────────
  async generateReport(type, filters = {}) {
    showLoading(true);
    try {
      const session = getSession();
      let result;
      switch(type) {
        case 'employeeCount':   result = await this._reportEmployeeCount(session); break;
        case 'pendingPayments': result = await this._reportPendingPayments(session, filters); break;
        case 'salaryExpenditure': result = await this._reportSalaryExpenditure(session, filters); break;
        case 'serviceExperience': result = await this._reportServiceExperience(session, filters); break;
        case 'paidExpenditure': result = await this._reportPaidExpenditure(session, filters); break;
        default: result = fail('Unknown report type');
      }
      showLoading(false);
      return result;
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async _reportEmployeeCount(session) {
    const emps = await fsGetAll('employees');
    const visible = filterByAccess(session, emps);
    const active = visible.filter(e => e.Status === 'Active').length;
    const suspended = visible.filter(e => e.Status === 'Suspended').length;
    const byDistrict = {};
    visible.forEach(e => { byDistrict[e.District] = (byDistrict[e.District]||0) + 1; });
    return ok({ total: visible.length, active, suspended, byDistrict });
  },

  async _reportPendingPayments(session, filters) {
    const emps = await fsGetAll('employees');
    const revisions = await fsGetAll('salary_revisions');
    let visible = filterByAccess(session, emps).filter(e => e.Status === 'Active');
    if (filters.district) visible = visible.filter(e => e.District === filters.district);
    if (filters.scheme)   visible = visible.filter(e => e.Scheme === filters.scheme);
    const report = visible.map(e => ({
      EmpID: e.EmpID,
      EmployeeName: e.EmployeeName,
      District: e.District,
      Scheme: e.Scheme,
      Designation: e.Designation,
      LastPaidDate: e.LastPaidDate || 'Never',
      PendingHonorarium: calcPendingHonorarium(e, revisions),
      ActiveRate: getActiveRate(e, revisions)
    })).filter(e => e.PendingHonorarium > 0);
    const totalPending = report.reduce((s, e) => s + e.PendingHonorarium, 0);
    return ok({ report, totalPending, count: report.length });
  },

  async _reportSalaryExpenditure(session, filters) {
    let salaries = await fsGetAll('salary_history');
    if (filters.fromMonth) salaries = salaries.filter(r => r.Month >= filters.fromMonth);
    if (filters.toMonth)   salaries = salaries.filter(r => r.Month <= filters.toMonth);
    if (!['SuperAdmin','ITAdmin','Viewer'].includes(session.role)) {
      const emps = await fsGetAll('employees');
      const myIds = {};
      emps.filter(e => canAccessEmployee(session, e)).forEach(e => myIds[e.EmpID] = true);
      salaries = salaries.filter(r => myIds[r.EmpID]);
    }
    const totalBasic = salaries.reduce((s,r) => s + (parseFloat(r.BasicSalary)||0), 0);
    const totalFestival = salaries.reduce((s,r) => s + (parseFloat(r.FestivalAllowance)||0), 0);
    const totalEL = salaries.reduce((s,r) => s + (parseFloat(r.ELSurrender)||0), 0);
    const grandTotal = salaries.reduce((s,r) => s + (parseFloat(r.TotalPaid)||0), 0);
    return ok({ totalBasic, totalFestival, totalEL, grandTotal, count: salaries.length });
  },

  async _reportServiceExperience(session, filters) {
    const emps = await fsGetAll('employees');
    let visible = filterByAccess(session, emps);
    const minYears = parseFloat(filters.minYears) || 0;
    const maxYears = parseFloat(filters.maxYears) || 999;
    const report = visible.map(e => {
      const dur = calcServiceDuration(e.DateOfFirstJoining);
      const years = dur.years + dur.months / 12;
      return { ...e, years, serviceDuration: dur };
    }).filter(e => e.years >= minYears && e.years <= maxYears);
    return ok({ report, count: report.length });
  },

  async _reportPaidExpenditure(session, filters) {
    const fy = filters.financialYear;
    if (!fy) return fail('Financial Year is required');
    const fyParts = fy.split('-');
    const fyStartYear = parseInt(fyParts[0]);
    const fyStart = new Date(fyStartYear, 3, 1);
    const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59);

    let salaries = await fsGetAll('salary_history');
    if (!['SuperAdmin','ITAdmin','Viewer'].includes(session.role)) {
      const emps = await fsGetAll('employees');
      const myIds = {};
      emps.filter(e => canAccessEmployee(session, e)).forEach(e => myIds[e.EmpID] = true);
      salaries = salaries.filter(r => myIds[r.EmpID]);
    }

    const emps = await fsGetAll('employees');
    const empLookup = {};
    emps.forEach(e => empLookup[e.EmpID] = e);

    const paidRecords = salaries.filter(r => {
      if (r.PaymentStatus !== 'Paid') return false;
      const pd = r.PaidDate ? new Date(r.PaidDate) : (r.CreatedAt ? new Date(r.CreatedAt) : null);
      return pd && pd >= fyStart && pd <= fyEnd;
    });

    let totalBasic = 0, totalFestival = 0, totalEL = 0, grandTotal = 0;
    const records = paidRecords.map(r => {
      const b = parseFloat(r.BasicSalary)||0, f = parseFloat(r.FestivalAllowance)||0, e = parseFloat(r.ELSurrender)||0;
      totalBasic += b; totalFestival += f; totalEL += e; grandTotal += parseFloat(r.TotalPaid)||0;
      const emp = empLookup[r.EmpID] || {};
      return { RecordID: r.RecordID, EmpID: r.EmpID, EmployeeName: emp.EmployeeName || r.EmpID,
               Scheme: emp.Scheme || '', District: emp.District || '',
               Period: r.Month || '', BasicSalary: b, FestivalAllowance: f, ELSurrender: e,
               MaternityPay: 0, TotalPaid: parseFloat(r.TotalPaid)||0, PaidDate: r.PaidDate || '' };
    });

    return ok({ financialYear: fy, totalBasic, totalMaternity: 0, totalFestival, totalEL, grandTotal, records, count: records.length });
  },

  async getServiceReport(minYears, filters) {
    showLoading(true);
    try {
      const session = getSession();
      const result = await this._reportServiceExperience(session, { minYears, ...filters });
      showLoading(false);
      return result;
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  // ── Audit Log ───────────────────────────────────────────────────────────────
  async getAuditLog(filters = {}) {
    showLoading(true);
    try {
      let rows = await fsGetAll('audit_log');
      rows.sort((a,b) => (b.Timestamp||'').localeCompare(a.Timestamp||''));
      rows = rows.slice(0, 200);
      showLoading(false);
      return ok(rows);
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  // ── Leave ───────────────────────────────────────────────────────────────────
  async getLeaveRecords(empId) {
    showLoading(true);
    try {
      let rows = empId ? await fsGetWhere('leave_records', 'EmpID', '==', empId) : await fsGetAll('leave_records');
      showLoading(false);
      return ok(rows);
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async applyLeave(data) {
    showLoading(true);
    try {
      const session = getSession();
      const id = generateId('LVE');
      await fsSet('leave_records', id, { ...data, LeaveID: id, Status: 'Pending', CreatedBy: session.userId, CreatedAt: new Date().toISOString() });
      showLoading(false);
      return ok({ leaveId: id }, 'Leave applied');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async approveLeave(leaveId, action) {
    showLoading(true);
    try {
      const session = getSession();
      await fsUpdate('leave_records', leaveId, { Status: action, ApprovedBy: session.userId, ApprovedAt: new Date().toISOString() });
      showLoading(false);
      return ok(null, 'Leave ' + action);
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  // ── Contracts ───────────────────────────────────────────────────────────────
  async getContracts(filters = {}) {
    showLoading(true);
    try {
      let rows = await fsGetAll('contracts');
      if (filters.status) rows = rows.filter(r => r.Status === filters.status);
      showLoading(false);
      return ok(rows);
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  async addContract(data) {
    showLoading(true);
    try {
      const session = getSession();
      const id = generateId('CON');
      await fsSet('contracts', id, { ...data, ContractID: id, CreatedBy: session.userId, CreatedAt: new Date().toISOString() });
      showLoading(false);
      return ok({ contractId: id }, 'Contract added');
    } catch(e) { showLoading(false); return fail(e.message); }
  },

  // ── Public Dashboard ─────────────────────────────────────────────────────────
  async getPublicDashboard() {
    try {
      const emps = await fsGetAll('employees');
      return ok({
        totalEmployees: emps.filter(e => e.Status === 'Active').length,
        suspended: emps.filter(e => e.Status === 'Suspended').length
      });
    } catch(e) { return fail(e.message); }
  },
  async getPublicDistricts() { return this.getDistricts(); },
  async getPublicSchemes()   { return this.getSchemes(); }
};

// ─── Client-side calculation helpers ─────────────────────────────────────────
function calcServiceDuration(dateStr) {
  if (!dateStr) return { years: 0, months: 0, days: 0, text: 'N/A' };
  const start = new Date(dateStr);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  const text = [years > 0 ? years + 'y' : '', months > 0 ? months + 'm' : '', days + 'd'].filter(Boolean).join(' ');
  return { years, months, days, text };
}

function getActiveRate(emp, revisions) {
  const empRevs = (revisions || []).filter(r => r.Scheme === emp.Scheme && r.Designation === emp.Designation);
  empRevs.sort((a, b) => new Date(a.EffectiveFrom) - new Date(b.EffectiveFrom));
  const today = new Date();
  let rate = parseFloat(emp.CurrentSalary) || 0;
  for (const rev of empRevs) {
    if (new Date(rev.EffectiveFrom) <= today) rate = parseFloat(rev.NewAmount) || 0;
  }
  return rate;
}

function calcPendingHonorarium(emp, revisions) {
  if (emp.Status !== 'Active' && emp.Status !== 'Suspended') return 0;
  if (!emp.DateOfFirstJoining) return 0;

  const joinDate = new Date(emp.DateOfFirstJoining);
  let startYear, startMonth;
  if (emp.LastPaidDate) {
    const lp = new Date(emp.LastPaidDate);
    startMonth = lp.getMonth() + 1;
    startYear = lp.getFullYear();
    if (startMonth > 11) { startYear++; startMonth = 0; }
  } else {
    startYear = joinDate.getFullYear();
    startMonth = joinDate.getMonth();
  }

  let endDate;
  if (emp.Status === 'Suspended' && emp.SuspensionDate) {
    endDate = new Date(emp.SuspensionDate);
  } else {
    const t = new Date();
    endDate = new Date(t.getFullYear(), t.getMonth(), 0);
  }
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();

  const empRevs = (revisions || []).filter(r => r.Scheme === emp.Scheme && r.Designation === emp.Designation);
  empRevs.sort((a, b) => new Date(a.EffectiveFrom) - new Date(b.EffectiveFrom));

  let total = 0, cY = startYear, cM = startMonth;
  while (cY < endYear || (cY === endYear && cM <= endMonth)) {
    const monthEnd = new Date(cY, cM + 1, 0);
    let rate = parseFloat(emp.CurrentSalary) || 0;
    for (const rev of empRevs) {
      if (new Date(rev.EffectiveFrom) <= monthEnd) rate = parseFloat(rev.NewAmount) || 0;
    }
    let owed = rate;
    const daysInMonth = monthEnd.getDate();
    if (cY === joinDate.getFullYear() && cM === joinDate.getMonth() && joinDate.getDate() > 1) {
      owed = (rate / daysInMonth) * (daysInMonth - joinDate.getDate() + 1);
    }
    if (emp.Status === 'Suspended' && emp.SuspensionDate) {
      const rel = new Date(emp.SuspensionDate);
      if (cY === rel.getFullYear() && cM === rel.getMonth()) {
        owed = (rate / daysInMonth) * rel.getDate();
      }
    }
    if (emp.PartialMonth) {
      const pp = String(emp.PartialMonth).split('-');
      if (pp.length >= 2 && parseInt(pp[0]) === cY && parseInt(pp[1]) - 1 === cM) {
        owed = Math.max(0, owed - (parseFloat(emp.PartialAmount) || 0));
      }
    }
    total += Math.round(owed * 100) / 100;
    cM++;
    if (cM > 11) { cM = 0; cY++; }
  }
  return total;
}
