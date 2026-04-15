/* ACEDB - employees.js  Employee management page */
let allEmployees = [];
let empDistricts = [];
let empSchemes = [];

async function loadEmployees() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `
    <div class="animate-slide">
      <div class="table-toolbar">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <div class="table-search"><i class="bi bi-search"></i><input id="empSearch" placeholder="${t('search')}..." oninput="filterEmployeeTable()"></div>
          <select id="empDistFilter" class="form-select" style="padding:8px 36px 8px 12px;font-size:13px;min-width:140px" onchange="filterEmployeeTable()"><option value="">${t('all_districts')}</option></select>
          <select id="empSchemeFilter" class="form-select" style="padding:8px 36px 8px 12px;font-size:13px;min-width:140px" onchange="filterEmployeeTable()"><option value="">${t('all_schemes')}</option></select>
          <select id="empStatusFilter" class="form-select" style="padding:8px 36px 8px 12px;font-size:13px;min-width:120px" onchange="filterEmployeeTable()">
            <option value="">${t('all_status')}</option><option value="Active">${t('active')}</option><option value="Suspended">${t('suspended')}</option>
          </select>
        </div>
        <div class="table-actions">
          ${hasRole('SuperAdmin','DistrictAdmin') ? '<button class="btn btn-primary btn-sm" onclick="showAddEmployeeModal()"><i class="bi bi-plus-lg"></i> '+t('add_employee')+'</button>' : ''}
          <button class="btn btn-outline btn-sm" onclick="exportEmployees()"><i class="bi bi-download"></i> ${t('export')}</button>
        </div>
      </div>
      <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
        <table class="data-table" id="empTable">
          <thead><tr>
            <th>ID</th><th>${t('name')}</th><th>${t('designation')}</th><th>${t('district')}</th>
            <th>${t('scheme')}</th><th>${t('joining_date')}</th><th>${t('current_salary')}</th>
            <th>${t('status')}</th><th>${t('actions')}</th>
          </tr></thead>
          <tbody id="empTableBody"><tr><td colspan="9" class="text-center text-muted" style="padding:40px">${t('loading')}</td></tr></tbody>
        </table>
      </div></div></div>
      <div id="empPagination" class="pagination"></div>
    </div>`;

  // Load data
  const [empRes, distRes, schRes] = await Promise.all([
    API.getEmployees({}), API.getDistricts(), API.getSchemes()
  ]);

  if (empRes.success) allEmployees = empRes.data;
  if (distRes.success) { empDistricts = distRes.data; populateSelect('empDistFilter', distRes.data, t('all_districts')); }
  if (schRes.success) { empSchemes = schRes.data; populateSelect('empSchemeFilter', schRes.data, t('all_schemes')); }
  filterEmployeeTable();
}

function populateSelect(id, items, allLabel) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '<option value="">' + allLabel + '</option>';
  items.forEach(item => { sel.innerHTML += '<option value="' + item + '">' + item + '</option>'; });
}

let empPage = 1;
function filterEmployeeTable() {
  const search = (document.getElementById('empSearch')?.value || '').toLowerCase();
  const dist = document.getElementById('empDistFilter')?.value || '';
  const scheme = document.getElementById('empSchemeFilter')?.value || '';
  const status = document.getElementById('empStatusFilter')?.value || '';

  let filtered = allEmployees.filter(e => {
    if (dist && e.District !== dist) return false;
    if (scheme && e.Scheme !== scheme) return false;
    if (status && e.Status !== status) return false;
    if (search && !(e.EmployeeName||'').toLowerCase().includes(search) && !(e.EmpID||'').toLowerCase().includes(search) && !(e.Phone||'').toString().includes(search)) return false;
    return true;
  });

  const perPage = ACEDB_CONFIG.ITEMS_PER_PAGE;
  const totalPages = Math.ceil(filtered.length / perPage);
  if (empPage > totalPages) empPage = 1;
  const start = (empPage - 1) * perPage;
  const pageData = filtered.slice(start, start + perPage);

  const tbody = document.getElementById('empTableBody');
  if (!tbody) return;

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:40px"><i class="bi bi-inbox" style="font-size:32px;display:block;margin-bottom:8px"></i>' + t('no_data') + '</td></tr>';
  } else {
    tbody.innerHTML = pageData.map(e => `<tr class="animate-fade">
      <td><strong>${escapeHtml(e.EmpID)}</strong></td>
      <td>${escapeHtml(e.EmployeeName)}</td>
      <td>${escapeHtml(e.Designation)}</td>
      <td>${escapeHtml(e.District)}</td>
      <td>${escapeHtml(e.Scheme)}</td>
      <td>${formatDateDisplay(e.DateOfFirstJoining)}</td>
      <td>${formatCurrency(e.CurrentSalary)}</td>
      <td>${getStatusBadge(e.Status)}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="viewEmployee('${e.EmpID}')" title="${t('view_details')}"><i class="bi bi-eye"></i></button>
          ${hasRole('SuperAdmin','DistrictAdmin') ? `<button class="btn btn-ghost btn-sm" onclick="showEditEmployeeModal('${e.EmpID}')" title="${t('edit')}"><i class="bi bi-pencil"></i></button>` : ''}
          ${hasRole('SuperAdmin','DistrictAdmin') && e.Status==='Active' ? `<button class="btn btn-ghost btn-sm text-danger" onclick="promptSuspend('${e.EmpID}')" title="${t('suspend')}"><i class="bi bi-pause-circle"></i></button>` : ''}
          ${hasRole('SuperAdmin','DistrictAdmin') && e.Status==='Suspended' ? `<button class="btn btn-ghost btn-sm text-success" onclick="doRevokeSuspension('${e.EmpID}')" title="${t('revoke')}"><i class="bi bi-play-circle"></i></button>` : ''}
        </div>
      </td>
    </tr>`).join('');
  }

  // Pagination
  const pagDiv = document.getElementById('empPagination');
  if (pagDiv && totalPages > 1) {
    let pHtml = '';
    for (let i = 1; i <= totalPages; i++) {
      pHtml += `<button class="page-btn ${i===empPage?'active':''}" onclick="empPage=${i};filterEmployeeTable()">${i}</button>`;
    }
    pagDiv.innerHTML = pHtml;
  } else if (pagDiv) pagDiv.innerHTML = '';
}

function showAddEmployeeModal() {
  const user = getCurrentUser();
  showEmployeeForm(null, user.district);
}

function showEditEmployeeModal(empId) {
  const emp = allEmployees.find(e => e.EmpID === empId);
  if (emp) showEmployeeForm(emp);
}

function showEmployeeForm(emp, defaultDistrict) {
  const isEdit = !!emp;
  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h3>${isEdit ? t('edit_employee') : t('add_employee')}</h3><button class="modal-close" onclick="hideModal('mainModal')">&times;</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('name')} *</label><input class="form-control" id="empName" value="${escapeHtml(emp?.EmployeeName||'')}"></div>
        <div class="form-group"><label class="form-label">${t('designation')} *</label><input class="form-control" id="empDesig" value="${escapeHtml(emp?.Designation||'')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('district')} *</label><select class="form-select" id="empDist"></select></div>
        <div class="form-group"><label class="form-label">${t('office')} *</label><input class="form-control" id="empOffice" value="${escapeHtml(emp?.Office||'')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('scheme')}</label><select class="form-select" id="empScheme"></select></div>
        <div class="form-group"><label class="form-label">${t('joining_date')} *</label><input type="date" class="form-control" id="empJoining" value="${formatDateInput(emp?.DateOfFirstJoining)}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('dob')}</label><input type="date" class="form-control" id="empDOB" value="${formatDateInput(emp?.DateOfBirth)}"></div>
        <div class="form-group"><label class="form-label">${t('qualification')}</label><input class="form-control" id="empQual" value="${escapeHtml(emp?.Qualification||'')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('current_salary')} (₹)</label><input type="number" class="form-control" id="empSalary" value="${emp?.CurrentSalary||''}"></div>
        <div class="form-group"><label class="form-label">${t('phone')}</label><input class="form-control" id="empPhone" value="${escapeHtml(emp?.Phone||'')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('bank_account')}</label><input class="form-control" id="empBank" value="${escapeHtml(emp?.BankAccount||'')}"></div>
        <div class="form-group"><label class="form-label">${t('ifsc_code')}</label><input class="form-control" id="empIFSC" value="${escapeHtml(emp?.IFSC||'')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('pan_number')}</label><input class="form-control" id="empPAN" value="${escapeHtml(emp?.PAN||'')}"></div>
        <div class="form-group"><label class="form-label">${t('aadhaar_last4')}</label><input class="form-control" id="empAadhaar" maxlength="4" value="${escapeHtml(emp?.AadhaarLast4||'')}"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button>
      <button class="btn btn-primary" onclick="saveEmployee(${isEdit ? "'" + emp.EmpID + "'" : 'null'})">${t('save')}</button>
    </div>
  </div>`;

  // Populate dropdowns
  const distSel = document.getElementById('empDist');
  empDistricts.forEach(d => { distSel.innerHTML += `<option value="${d}" ${d===(emp?.District||defaultDistrict)?'selected':''}>${d}</option>`; });
  if (getCurrentRole() === 'DistrictAdmin') { distSel.value = getCurrentDistrict(); distSel.disabled = true; }

  const schemeSel = document.getElementById('empScheme');
  schemeSel.innerHTML = '<option value="">-- Select --</option>';
  empSchemes.forEach(s => { schemeSel.innerHTML += `<option value="${s}" ${s===emp?.Scheme?'selected':''}>${s}</option>`; });

  showModal('mainModal');
}

async function saveEmployee(empId) {
  const data = {
    employeeName: document.getElementById('empName').value,
    designation: document.getElementById('empDesig').value,
    district: document.getElementById('empDist').value,
    office: document.getElementById('empOffice').value,
    scheme: document.getElementById('empScheme').value,
    dateOfFirstJoining: document.getElementById('empJoining').value,
    dateOfBirth: document.getElementById('empDOB').value,
    qualification: document.getElementById('empQual').value,
    currentSalary: document.getElementById('empSalary').value,
    phone: document.getElementById('empPhone').value,
    bankAccount: document.getElementById('empBank').value,
    ifsc: document.getElementById('empIFSC').value,
    pan: document.getElementById('empPAN').value,
    aadhaarLast4: document.getElementById('empAadhaar').value
  };

  let result;
  if (empId) { data.empId = empId; result = await API.editEmployee(data); }
  else { result = await API.addEmployee(data); }

  if (result.success) {
    showToast(result.message, 'success');
    hideModal('mainModal');
    loadEmployees();
  } else { showToast(result.error, 'error'); }
}

async function viewEmployee(empId) {
  const result = await API.getEmployee(empId);
  if (!result.success) { showToast(result.error, 'error'); return; }
  const e = result.data;
  const svc = e.serviceDuration || {};
  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal modal-lg">
    <div class="modal-header"><h3>${t('employee_details')}</h3><button class="modal-close" onclick="hideModal('mainModal')">&times;</button></div>
    <div class="modal-body">
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="stat-card purple"><div class="stat-value">${svc.years||0}</div><div class="stat-label">${t('years')}</div></div>
        <div class="stat-card amber"><div class="stat-value">${svc.months||0}</div><div class="stat-label">${t('months')}</div></div>
        <div class="stat-card green"><div class="stat-value">${svc.days||0}</div><div class="stat-label">${t('days')}</div></div>
      </div>
      <table class="data-table">
        <tr><td style="font-weight:600;width:35%">Employee ID</td><td>${escapeHtml(e.EmpID)}</td></tr>
        <tr><td style="font-weight:600">${t('name')}</td><td>${escapeHtml(e.EmployeeName)}</td></tr>
        <tr><td style="font-weight:600">${t('designation')}</td><td>${escapeHtml(e.Designation)}</td></tr>
        <tr><td style="font-weight:600">${t('district')}</td><td>${escapeHtml(e.District)}</td></tr>
        <tr><td style="font-weight:600">${t('office')}</td><td>${escapeHtml(e.Office)}</td></tr>
        <tr><td style="font-weight:600">${t('scheme')}</td><td>${escapeHtml(e.Scheme)}</td></tr>
        <tr><td style="font-weight:600">${t('joining_date')}</td><td>${formatDateDisplay(e.DateOfFirstJoining)}</td></tr>
        <tr><td style="font-weight:600">${t('dob')}</td><td>${formatDateDisplay(e.DateOfBirth)}</td></tr>
        <tr><td style="font-weight:600">${t('qualification')}</td><td>${escapeHtml(e.Qualification)}</td></tr>
        <tr><td style="font-weight:600">${t('current_salary')}</td><td>${formatCurrency(e.CurrentSalary)}</td></tr>
        <tr><td style="font-weight:600">${t('status')}</td><td>${getStatusBadge(e.Status)}</td></tr>
        <tr><td style="font-weight:600">${t('phone')}</td><td>${escapeHtml(e.Phone)}</td></tr>
        <tr><td style="font-weight:600">${t('service_duration')}</td><td>${svc.years}y ${svc.months}m ${svc.days}d (${svc.totalDays} days)</td></tr>
      </table>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('back')}</button></div>
  </div>`;
  showModal('mainModal');
}

async function promptSuspend(empId) {
  const reason = prompt(t('suspension_reason') + ':');
  if (!reason) return;
  const result = await API.suspendEmployee(empId, reason);
  if (result.success) { showToast(result.message, 'success'); loadEmployees(); }
  else showToast(result.error, 'error');
}

async function doRevokeSuspension(empId) {
  if (!confirm(t('revoke') + '?')) return;
  const result = await API.revokeSuspension(empId);
  if (result.success) { showToast(result.message, 'success'); loadEmployees(); }
  else showToast(result.error, 'error');
}

async function exportEmployees() {
  const result = await API.generateReport('employeeCount', {});
  if (result.success && result.data.table) {
    const headers = Object.keys(result.data.table[0]);
    let csv = headers.join(',') + '\n';
    result.data.table.forEach(row => { csv += headers.map(h => '"' + (row[h]||'') + '"').join(',') + '\n'; });
    downloadCSV(csv, 'employees_report.csv');
  } else showToast('Export failed', 'error');
}
