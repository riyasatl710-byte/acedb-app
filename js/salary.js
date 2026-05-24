/* ACEDB - salary.js */

let allTrackerEmployees = [];
let allEmolumentsList = [];
let salaryFeatureLocks = {};

async function loadSalary() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="animate-slide">
    <div class="tabs">
      <button class="tab-btn active" id="tabTracker" onclick="switchSalaryTab('tracker',this)">Honorarium Tracker</button>
      <button class="tab-btn" id="tabEmoluments" onclick="switchSalaryTab('emoluments',this)">Other Emoluments</button>
      <button class="tab-btn" id="tabRevisions" onclick="switchSalaryTab('revisions',this)">Revisions</button>
    </div>
    <div id="salaryTabContent"></div>
  </div>`;
  switchSalaryTab('tracker', document.getElementById('tabTracker'));
}

async function switchSalaryTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const container = document.getElementById('salaryTabContent');
  container.innerHTML = `<div class="text-center" style="padding:40px"><div class="spinner" style="margin:0 auto 16px"></div><p class="text-muted">${t('loading')}...</p></div>`;

  if (tab === 'tracker') {
    loadHonorariumTracker();
  } else if (tab === 'emoluments') {
    loadOtherEmoluments();
  } else {
    loadSalaryRevisions();
  }
}

/* =========================================================================
   1. HONORARIUM TRACKER
   ========================================================================= */

async function loadHonorariumTracker() {
  const container = document.getElementById('salaryTabContent');
  container.innerHTML = `<div class="table-toolbar">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div class="table-search"><i class="bi bi-search"></i><input id="trackSearch" placeholder="${t('search')}..." oninput="filterTrackerTable()"></div>
      <select id="trackDistFilter" class="form-select" style="padding:8px 36px 8px 12px;font-size:13px;min-width:140px" onchange="filterTrackerTable()"></select>
      <select id="trackSchemeFilter" class="form-select" style="padding:8px 36px 8px 12px;font-size:13px;min-width:140px" onchange="filterTrackerTable()"></select>
    </div>
  </div>
  <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
    <table class="data-table">
      <thead>
        <tr>
          <th>Employee ID</th>
          <th>${t('name')}</th>
          <th>${t('scheme')}</th>
          <th>${t('district')}</th>
          <th>Monthly Honorarium</th>
          <th>Last Fully Paid Date</th>
          <th>Partial Month</th>
          <th>Partial Paid</th>
          <th>Total Pending</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="trackTableBody">
        <tr><td colspan="10" class="text-center">${t('loading')}</td></tr>
      </tbody>
    </table>
  </div></div></div>`;

  // Fetch dropdown lists, employees list, and locks
  const [empRes, distRes, schRes, locksRes] = await Promise.all([
    API.getEmployees({ status: 'Active' }),
    API.getDistricts(),
    API.getSchemes(),
    API.getFeatureLocks()
  ]);

  salaryFeatureLocks = (locksRes.success) ? locksRes.data : {};

  if (distRes.success) {
    if (getCurrentRole() === 'DistrictAdmin') {
      const myDist = getCurrentDistrict();
      populateSelect('trackDistFilter', [myDist]);
      const sel = document.getElementById('trackDistFilter');
      if (sel) { sel.value = myDist; sel.disabled = true; }
    } else {
      populateSelect('trackDistFilter', distRes.data, t('all_districts'));
    }
  }
  if (schRes.success) {
    if (getCurrentRole() === 'SectionAdmin') {
      const myScheme = getCurrentDistrict();
      populateSelect('trackSchemeFilter', [myScheme]);
      const sel = document.getElementById('trackSchemeFilter');
      if (sel) { sel.value = myScheme; sel.disabled = true; }
    } else {
      populateSelect('trackSchemeFilter', schRes.data, t('all_schemes'));
    }
  }

  if (empRes.success) {
    allTrackerEmployees = empRes.data;
  } else {
    showToast(empRes.error || 'Failed to load employees', 'error');
    allTrackerEmployees = [];
  }

  filterTrackerTable();
}

function filterTrackerTable() {
  const search = (document.getElementById('trackSearch')?.value || '').toLowerCase();
  const dist = document.getElementById('trackDistFilter')?.value || '';
  const scheme = document.getElementById('trackSchemeFilter')?.value || '';

  let filtered = allTrackerEmployees.filter(e => {
    if (dist && e.District !== dist) return false;
    if (scheme && e.Scheme !== scheme) return false;
    if (search && !(e.EmployeeName||'').toLowerCase().includes(search) && !(e.EmpID||'').toLowerCase().includes(search)) return false;
    return true;
  });

  const tbody = document.getElementById('trackTableBody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:40px">${t('no_data')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td><strong>${escapeHtml(e.EmpID)}</strong></td>
      <td>${escapeHtml(e.EmployeeName)}</td>
      <td>${escapeHtml(e.Scheme)}</td>
      <td>${escapeHtml(e.District)}</td>
      <td>${formatCurrency(e.activeRate || e.CurrentSalary)}</td>
      <td>${formatDateDisplay(e.LastPaidDate)}</td>
      <td>${e.PartialMonth ? escapeHtml(e.PartialMonth) : '-'}</td>
      <td>${e.PartialAmount ? formatCurrency(e.PartialAmount) : '-'}</td>
      <td><strong style="color:${e.pendingHonorarium > 0 ? 'var(--danger)' : 'var(--success)'}">${formatCurrency(e.pendingHonorarium)}</strong></td>
      <td>
        ${(hasRole('SuperAdmin') || (hasRole('DistrictAdmin') && !salaryFeatureLocks.LOCK_HONORARIUM)) ? `
          <button class="btn btn-ghost btn-sm" onclick="showUpdateTrackerModal('${e.EmpID}')" title="Update Payment Status">
            <i class="bi bi-pencil-square" style="color:var(--primary);font-size:16px"></i>
          </button>
        ` : '-'}
      </td>
    </tr>
  `).join('');
}

function showUpdateTrackerModal(empId) {
  const emp = allTrackerEmployees.find(e => e.EmpID === empId);
  if (!emp) return;

  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal">
    <div class="modal-header">
      <h3>Update Honorarium Status</h3>
      <button class="modal-close" onclick="hideModal('mainModal')">&times;</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--bg-light);padding:12px;border-radius:6px;margin-bottom:16px">
        <strong>${escapeHtml(emp.EmployeeName)}</strong> (${escapeHtml(emp.EmpID)})<br>
        <small class="text-muted">Designation: ${escapeHtml(emp.Designation)} | Current Rate: ${formatCurrency(emp.activeRate || emp.CurrentSalary)}</small>
      </div>
      <div class="form-group">
        <label class="form-label">Last Fully Paid Date *</label>
        <input type="date" class="form-control" id="trackLastPaid" value="${formatDateInput(emp.LastPaidDate)}">
        <small class="text-muted">Only the last day of a month is allowed. Selecting any date will automatically snap to the end of that month.</small>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Partial Payment Month (Optional)</label>
          <input type="month" class="form-control" id="trackPartialMonth" value="${escapeHtml(emp.PartialMonth || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Partial Amount Paid (₹) (Optional)</label>
          <input type="number" class="form-control" id="trackPartialAmount" value="${emp.PartialAmount || ''}">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveTrackerStatus('${emp.EmpID}')">${t('save')}</button>
    </div>
  </div>`;

  showModal('mainModal');

  // Snap function helper
  const snapDateToMonthEnd = (input) => {
    if (input.value) {
      const parts = input.value.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const lastDay = new Date(y, m, 0);
        const year = lastDay.getFullYear();
        const month = String(lastDay.getMonth() + 1).padStart(2, '0');
        const day = String(lastDay.getDate()).padStart(2, '0');
        input.value = year + '-' + month + '-' + day;
      }
    }
  };

  const dateInput = document.getElementById('trackLastPaid');
  if (dateInput) {
    // Snap on load if value is present
    snapDateToMonthEnd(dateInput);
    // Snap on user change
    dateInput.addEventListener('change', function() {
      snapDateToMonthEnd(this);
    });
  }
}

async function saveTrackerStatus(empId) {
  const lastPaidDate = document.getElementById('trackLastPaid').value;
  const partialMonth = document.getElementById('trackPartialMonth').value;
  const partialAmount = document.getElementById('trackPartialAmount').value;

  if (!lastPaidDate) {
    showToast('Last fully paid date is required', 'warning');
    return;
  }

  if (partialMonth) {
    if (!partialAmount || parseFloat(partialAmount) <= 0) {
      showToast('Amount paid is mandatory when a partial month is selected.', 'warning');
      return;
    }
  }

  const result = await API.updateEmployeeHonorariumStatus({
    empId,
    lastPaidDate,
    partialMonth,
    partialAmount: partialAmount || 0
  });

  if (result.success) {
    showToast(result.message || 'Status updated', 'success');
    hideModal('mainModal');
    loadHonorariumTracker();
  } else {
    showToast(result.error, 'error');
  }
}

/* =========================================================================
   2. OTHER EMOLUMENTS
   ========================================================================= */

async function loadOtherEmoluments() {
  const container = document.getElementById('salaryTabContent');
  
  // Fetch locks
  const locksRes = await API.getFeatureLocks();
  salaryFeatureLocks = (locksRes.success) ? locksRes.data : {};

  const currentYear = new Date().getFullYear();
  const fyOptions = [
    `${currentYear-2}-${String(currentYear-1).slice(2)}`,
    `${currentYear-1}-${String(currentYear).slice(2)}`,
    `${currentYear}-${String(currentYear+1).slice(2)}`,
    `${currentYear+1}-${String(currentYear+2).slice(2)}`
  ];

  const allEmolumentsLocked = salaryFeatureLocks.LOCK_EMOLUMENTS || (salaryFeatureLocks.LOCK_MATERNITY_PAY && salaryFeatureLocks.LOCK_FESTIVAL_ALLOWANCE && salaryFeatureLocks.LOCK_EL_SURRENDER);
  const canAdd = hasRole('SuperAdmin') || (hasRole('DistrictAdmin') && !allEmolumentsLocked);

  container.innerHTML = `<div class="table-toolbar">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input class="form-control" style="max-width:160px" id="emolEmpFilter" placeholder="Employee ID" onchange="fetchEmolumentRecords()">
      <select class="form-select" style="max-width:180px;padding:8px 36px 8px 12px;font-size:13px" id="emolMonthFilter" onchange="fetchEmolumentRecords()">
        <option value="">All Financial Years</option>
        ${fyOptions.map(fy => `<option value="${fy}">${fy}</option>`).join('')}
      </select>
    </div>
    ${canAdd ? `
      <button class="btn btn-primary btn-sm" onclick="showAddEmolumentModal()"><i class="bi bi-plus-lg"></i> Add Emolument</button>
    ` : ''}
  </div>
  <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
    <table class="data-table">
      <thead>
        <tr>
          <th>Record ID</th>
          <th>Employee ID</th>
          <th>Financial Year</th>
          <th>Maternity Pay</th>
          <th>Festival Allowance</th>
          <th>EL Surrender</th>
          <th>Total</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="emolTableBody">
        <tr><td colspan="9" class="text-center">${t('loading')}</td></tr>
      </tbody>
    </table>
  </div></div></div>`;

  fetchEmolumentRecords();
}

async function fetchEmolumentRecords() {
  const filters = {};
  const emp = document.getElementById('emolEmpFilter')?.value;
  const month = document.getElementById('emolMonthFilter')?.value;
  if (emp) filters.empId = emp;
  if (month) filters.month = month;

  const result = await API.getSalaryHistory(filters);
  const tbody = document.getElementById('emolTableBody');
  if (!tbody) return;

  if (!result.success || !result.data.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding:40px">${t('no_data')}</td></tr>`;
    return;
  }

  // Filter out records that are solely regular basic salaries (where other emoluments are 0 and basic > 0)
  // Show any records that have MaternityPay, FestivalAllowance, or ELSurrender values logged
  const filtered = result.data.filter(r => (parseFloat(r.MaternityPay) || 0) > 0 || (parseFloat(r.FestivalAllowance) || 0) > 0 || (parseFloat(r.ELSurrender) || 0) > 0);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding:40px">${t('no_data')}</td></tr>`;
    return;
  }

  allEmolumentsList = filtered;

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.RecordID)}</strong></td>
      <td>${escapeHtml(r.EmpID)}</td>
      <td>${escapeHtml(r.Month)}</td>
      <td>${formatCurrency(r.MaternityPay)}</td>
      <td>${formatCurrency(r.FestivalAllowance)}</td>
      <td>${formatCurrency(r.ELSurrender)}</td>
      <td><strong>${formatCurrency(r.TotalPaid)}</strong></td>
      <td>${getStatusBadge(r.PaymentStatus)}</td>
      <td>
        ${hasRole('SuperAdmin','DistrictAdmin') ? `
          <button class="btn btn-ghost btn-sm" onclick="showEditEmolumentModal('${r.RecordID}')" title="Edit Status">
            <i class="bi bi-pencil"></i>
          </button>
        ` : '-'}
      </td>
    </tr>
  `).join('');
}

function showAddEmolumentModal() {
  const isSuper = hasRole('SuperAdmin');
  const emolLocked = !isSuper && salaryFeatureLocks.LOCK_EMOLUMENTS;
  if (emolLocked) {
    showToast('Emolument entry is locked', 'warning');
    return;
  }

  const currentYear = new Date().getFullYear();
  const fyOptions = [
    `${currentYear-2}-${String(currentYear-1).slice(2)}`,
    `${currentYear-1}-${String(currentYear).slice(2)}`,
    `${currentYear}-${String(currentYear+1).slice(2)}`,
    `${currentYear+1}-${String(currentYear+2).slice(2)}`
  ];
  const d = new Date();
  const fyYear = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
  const currentFY = `${fyYear}-${String(fyYear+1).slice(2)}`;

  const festDisabled = !isSuper && (salaryFeatureLocks.LOCK_FESTIVAL_ALLOWANCE || salaryFeatureLocks.LOCK_EMOLUMENTS) ? 'disabled' : '';
  const matDisabled = !isSuper && (salaryFeatureLocks.LOCK_MATERNITY_PAY || salaryFeatureLocks.LOCK_EMOLUMENTS) ? 'disabled' : '';
  const elDisabled = !isSuper && (salaryFeatureLocks.LOCK_EL_SURRENDER || salaryFeatureLocks.LOCK_EMOLUMENTS) ? 'disabled' : '';

  const lockedYears = (salaryFeatureLocks.LOCKED_FINANCIAL_YEARS || '').split(',').map(s => s.trim()).filter(Boolean);

  // Filter active employees based on role-based scope access
  let visibleEmps = allTrackerEmployees;
  if (getCurrentRole() === 'DistrictAdmin') {
    const myDist = getCurrentDistrict();
    visibleEmps = allTrackerEmployees.filter(e => e.District === myDist);
  } else if (getCurrentRole() === 'SectionAdmin') {
    const myScheme = getCurrentDistrict();
    visibleEmps = allTrackerEmployees.filter(e => e.Scheme === myScheme);
  }
  visibleEmps.sort((a, b) => (a.EmployeeName || '').localeCompare(b.EmployeeName || ''));

  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal">
    <div class="modal-header">
      <h3>Add Emolument Record</h3>
      <button class="modal-close" onclick="hideModal('mainModal')">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Employee *</label>
        <select class="form-select" id="emolNewEmpId">
          <option value="">-- Select Employee --</option>
          ${visibleEmps.map(e => `<option value="${e.EmpID}">${escapeHtml(e.EmployeeName)} (${e.EmpID})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Financial Year *</label>
        <select class="form-select" id="emolNewMonth">
          ${fyOptions.map(fy => {
            const isLocked = !isSuper && lockedYears.includes(fy);
            const disabledAttr = isLocked ? 'disabled' : '';
            const label = isLocked ? `${fy} (Locked)` : fy;
            return `<option value="${fy}" ${fy === currentFY ? 'selected' : ''} ${disabledAttr}>${label}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Festival Allowance (₹) ${!isSuper && salaryFeatureLocks.LOCK_FESTIVAL_ALLOWANCE ? '<span class="text-danger">(Locked)</span>' : ''}</label>
          <input type="number" class="form-control" id="emolNewFestival" value="0" ${festDisabled}>
        </div>
        <div class="form-group">
          <label class="form-label">Maternity Pay (₹) ${!isSuper && salaryFeatureLocks.LOCK_MATERNITY_PAY ? '<span class="text-danger">(Locked)</span>' : ''}</label>
          <input type="number" class="form-control" id="emolNewMaternity" value="0" ${matDisabled}>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">EL Surrender (₹) ${!isSuper && salaryFeatureLocks.LOCK_EL_SURRENDER ? '<span class="text-danger">(Locked)</span>' : ''}</label>
          <input type="number" class="form-control" id="emolNewEL" value="0" ${elDisabled}>
        </div>
        <div class="form-group">
          <label class="form-label">${t('status')}</label>
          <select class="form-select" id="emolNewStatus">
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Held">Held</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('remarks')}</label>
        <input class="form-control" id="emolNewRemarks">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveEmolument()">${t('save')}</button>
    </div>
  </div>`;

  showModal('mainModal');
}

async function saveEmolument() {
  const data = {
    empId: document.getElementById('emolNewEmpId').value.trim(),
    month: document.getElementById('emolNewMonth').value,
    basicSalary: 0,
    maternityPay: document.getElementById('emolNewMaternity').value,
    festivalAllowance: document.getElementById('emolNewFestival').value,
    elSurrender: document.getElementById('emolNewEL').value,
    paymentStatus: document.getElementById('emolNewStatus').value,
    remarks: document.getElementById('emolNewRemarks').value
  };

  if (!data.empId || !data.month) {
    showToast('Employee Selection and Financial Year are required', 'warning');
    return;
  }

  const isSuper = hasRole('SuperAdmin');
  const lockedYears = (salaryFeatureLocks.LOCKED_FINANCIAL_YEARS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!isSuper && lockedYears.includes(data.month)) {
    showToast(`Financial Year ${data.month} is locked for editing.`, 'error');
    return;
  }

  const result = await API.addSalary(data);
  if (result.success) {
    showToast(result.message || 'Emolument added', 'success');
    hideModal('mainModal');
    fetchEmolumentRecords();
  } else {
    showToast(result.error, 'error');
  }
}

async function showEditEmolumentModal(recordId) {
  const isSuper = hasRole('SuperAdmin');
  if (!isSuper && salaryFeatureLocks.LOCK_EMOLUMENTS) {
    showToast('Emolument entry is locked', 'warning');
    return;
  }

  const rec = allEmolumentsList.find(r => r.RecordID === recordId);
  if (rec) {
    const lockedYears = (salaryFeatureLocks.LOCKED_FINANCIAL_YEARS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!isSuper && lockedYears.includes(rec.Month)) {
      showToast(`Financial Year ${rec.Month} is locked.`, 'error');
      return;
    }
  }

  const newStatus = prompt('Update payment status (Paid/Pending/Held):');
  if (!newStatus) return;
  
  const formattedStatus = newStatus.charAt(0).toUpperCase() + newStatus.slice(1).toLowerCase();
  if (['Paid', 'Pending', 'Held'].indexOf(formattedStatus) === -1) {
    showToast('Invalid status. Use Paid, Pending, or Held.', 'warning');
    return;
  }

  const result = await API.updateSalary({ recordId, paymentStatus: formattedStatus });
  if (result.success) {
    showToast('Status updated successfully', 'success');
    fetchEmolumentRecords();
  } else {
    showToast(result.error, 'error');
  }
}

/* =========================================================================
   3. REVISIONS
   ========================================================================= */

let activeEmployeesForRevisions = [];

async function loadSalaryRevisions() {
  const container = document.getElementById('salaryTabContent');
  const result = await API.getSalaryRevisions({});

  let html = `<div class="table-toolbar">
    <div></div>
    ${hasRole('SuperAdmin','SectionAdmin','ITAdmin') ? `
      <button class="btn btn-primary btn-sm" onclick="showAddRevisionModal()"><i class="bi bi-plus-lg"></i> Add Revision</button>
    ` : ''}
  </div>
  <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>${t('scheme')}</th>
          <th>${t('designation')}</th>
          <th>Old Amount</th>
          <th>New Amount</th>
          <th>Effective From</th>
          <th>GO Number</th>
        </tr>
      </thead>
      <tbody>`;

  if (result.success && result.data.length) {
    html += result.data.map(r => `
      <tr>
        <td>${escapeHtml(r.RevisionID)}</td>
        <td>${escapeHtml(r.Scheme)}</td>
        <td>${escapeHtml(r.Designation)}</td>
        <td>${formatCurrency(r.OldAmount)}</td>
        <td>${formatCurrency(r.NewAmount)}</td>
        <td>${formatDateDisplay(r.EffectiveFrom)}</td>
        <td>${escapeHtml(r.GONumber)}</td>
      </tr>
    `).join('');
  } else {
    html += `<tr><td colspan="7" class="text-center text-muted" style="padding:40px">${t('no_data')}</td></tr>`;
  }
  html += '</tbody></table></div></div></div>';
  container.innerHTML = html;
}

async function showAddRevisionModal() {
  const modal = document.getElementById('mainModal');
  
  modal.innerHTML = `<div class="modal">
    <div class="modal-header">
      <h3>Add Honorarium Revision</h3>
      <button class="modal-close" onclick="hideModal('mainModal')">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('scheme')} *</label>
          <select class="form-select" id="revScheme" onchange="updateDesignationOptions()"></select>
        </div>
        <div class="form-group">
          <label class="form-label">${t('designation')} *</label>
          <select class="form-select" id="revDesig" disabled>
            <option value="">-- Choose Scheme First --</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Old Amount (₹)</label>
          <input type="number" class="form-control" id="revOld" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">New Amount (₹) *</label>
          <input type="number" class="form-control" id="revNew">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Effective From *</label>
          <input type="date" class="form-control" id="revFrom">
        </div>
        <div class="form-group">
          <label class="form-label">${t('go_number')}</label>
          <input class="form-control" id="revGO">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveRevision()">${t('save')}</button>
    </div>
  </div>`;

  showModal('mainModal');

  // Load Schemes and Employees to dynamically populate dropdowns
  const [schRes, empRes] = await Promise.all([
    API.getSchemes(),
    API.getEmployees({ status: 'Active' })
  ]);

  if (schRes.success) {
    const schemeSelect = document.getElementById('revScheme');
    schemeSelect.innerHTML = '<option value="">-- Select Scheme --</option>' + 
      schRes.data.map(s => `<option value="${s}">${escapeHtml(s)}</option>`).join('');
  }

  if (empRes.success) {
    activeEmployeesForRevisions = empRes.data;
  } else {
    activeEmployeesForRevisions = [];
  }
}

function updateDesignationOptions() {
  const scheme = document.getElementById('revScheme').value;
  const desigSelect = document.getElementById('revDesig');
  
  if (!scheme) {
    desigSelect.innerHTML = '<option value="">-- Choose Scheme First --</option>';
    desigSelect.disabled = true;
    return;
  }

  // Filter employees of the selected Scheme to find unique designations
  const matchingEmployees = activeEmployeesForRevisions.filter(e => e.Scheme === scheme);
  const uniqueDesignations = [...new Set(matchingEmployees.map(e => e.Designation).filter(Boolean))];

  if (uniqueDesignations.length > 0) {
    desigSelect.innerHTML = '<option value="">-- Select Designation --</option>' + 
      uniqueDesignations.map(d => `<option value="${d}">${escapeHtml(d)}</option>`).join('');
    desigSelect.disabled = false;
  } else {
    // If no employees exist in that scheme yet, fetch unique designations from ALL active employees as fallback
    const allDesignations = [...new Set(activeEmployeesForRevisions.map(e => e.Designation).filter(Boolean))];
    if (allDesignations.length > 0) {
      desigSelect.innerHTML = '<option value="">-- Select Designation (All) --</option>' + 
        allDesignations.map(d => `<option value="${d}">${escapeHtml(d)}</option>`).join('');
      desigSelect.disabled = false;
    } else {
      desigSelect.innerHTML = '<option value="">-- No Designations Found --</option>';
      desigSelect.disabled = true;
    }
  }
}

async function saveRevision() {
  const data = {
    scheme: document.getElementById('revScheme').value,
    designation: document.getElementById('revDesig').value,
    oldAmount: document.getElementById('revOld').value,
    newAmount: document.getElementById('revNew').value,
    effectiveFrom: document.getElementById('revFrom').value,
    goNumber: document.getElementById('revGO').value
  };

  if (!data.scheme || !data.designation || !data.newAmount || !data.effectiveFrom) {
    showToast('Required fields are missing', 'warning');
    return;
  }

  const result = await API.addSalaryRevision(data);
  if (result.success) {
    showToast(result.message || 'Revision saved', 'success');
    hideModal('mainModal');
    loadSalaryRevisions();
  } else {
    showToast(result.error, 'error');
  }
}
