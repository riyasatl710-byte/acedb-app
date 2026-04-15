/* ACEDB - salary.js */
async function loadSalary() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="animate-slide">
    <div class="tabs"><button class="tab-btn active" onclick="switchSalaryTab('records',this)">Salary Records</button><button class="tab-btn" onclick="switchSalaryTab('revisions',this)">Revisions</button></div>
    <div id="salaryTabContent"></div>
  </div>`;
  loadSalaryRecords();
}

async function switchSalaryTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'records') loadSalaryRecords();
  else loadSalaryRevisions();
}

async function loadSalaryRecords() {
  const container = document.getElementById('salaryTabContent');
  container.innerHTML = `<div class="table-toolbar">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input class="form-control" style="max-width:160px" id="salEmpFilter" placeholder="Employee ID" onchange="fetchSalaryRecords()">
      <input type="month" class="form-control" style="max-width:160px" id="salMonthFilter" onchange="fetchSalaryRecords()">
      <select class="form-select" style="padding:8px 36px 8px 12px;font-size:13px;min-width:120px" id="salStatusFilter" onchange="fetchSalaryRecords()">
        <option value="">${t('all_status')}</option><option value="Paid">${t('paid')}</option><option value="Pending">${t('pending')}</option><option value="Held">${t('held')}</option>
      </select>
    </div>
    ${hasRole('SuperAdmin','DistrictAdmin') ? '<button class="btn btn-primary btn-sm" onclick="showAddSalaryModal()"><i class="bi bi-plus-lg"></i> Add Salary</button>' : ''}
  </div>
  <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
    <table class="data-table"><thead><tr>
      <th>Record ID</th><th>Employee</th><th>${t('month')}</th><th>${t('basic_salary')}</th>
      <th>${t('maternity')}</th><th>${t('festival')}</th><th>${t('el_surrender')}</th>
      <th>${t('total')}</th><th>${t('status')}</th><th>${t('actions')}</th>
    </tr></thead><tbody id="salTableBody"><tr><td colspan="10" class="text-center">${t('loading')}</td></tr></tbody></table>
  </div></div></div>`;
  fetchSalaryRecords();
}

async function fetchSalaryRecords() {
  const filters = {};
  const emp = document.getElementById('salEmpFilter')?.value;
  const month = document.getElementById('salMonthFilter')?.value;
  const status = document.getElementById('salStatusFilter')?.value;
  if (emp) filters.empId = emp;
  if (month) filters.month = month;
  if (status) filters.status = status;

  const result = await API.getSalaryHistory(filters);
  const tbody = document.getElementById('salTableBody');
  if (!result.success || !result.data.length) { tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:40px">${t('no_data')}</td></tr>`; return; }

  tbody.innerHTML = result.data.map(r => `<tr>
    <td><strong>${escapeHtml(r.RecordID)}</strong></td><td>${escapeHtml(r.EmpID)}</td><td>${escapeHtml(r.Month)}</td>
    <td>${formatCurrency(r.BasicSalary)}</td><td>${formatCurrency(r.MaternityPay)}</td>
    <td>${formatCurrency(r.FestivalAllowance)}</td><td>${formatCurrency(r.ELSurrender)}</td>
    <td><strong>${formatCurrency(r.TotalPaid)}</strong></td><td>${getStatusBadge(r.PaymentStatus)}</td>
    <td>${hasRole('SuperAdmin','DistrictAdmin') ? `<button class="btn btn-ghost btn-sm" onclick="showEditSalaryModal('${r.RecordID}')"><i class="bi bi-pencil"></i></button>` : ''}</td>
  </tr>`).join('');
}

function showAddSalaryModal() {
  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3>Add Salary Record</h3><button class="modal-close" onclick="hideModal('mainModal')">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label class="form-label">Employee ID *</label><input class="form-control" id="salNewEmpId" placeholder="EMP-0001"></div>
      <div class="form-group"><label class="form-label">${t('month')} *</label><input type="month" class="form-control" id="salNewMonth"></div>
      <div class="form-row"><div class="form-group"><label class="form-label">${t('basic_salary')} (₹) *</label><input type="number" class="form-control" id="salNewBasic"></div>
      <div class="form-group"><label class="form-label">${t('maternity')} (₹)</label><input type="number" class="form-control" id="salNewMaternity" value="0"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">${t('festival')} (₹)</label><input type="number" class="form-control" id="salNewFestival" value="0"></div>
      <div class="form-group"><label class="form-label">${t('el_surrender')} (₹)</label><input type="number" class="form-control" id="salNewEL" value="0"></div></div>
      <div class="form-group"><label class="form-label">${t('status')}</label><select class="form-select" id="salNewStatus"><option value="Pending">Pending</option><option value="Paid">Paid</option><option value="Held">Held</option></select></div>
      <div class="form-group"><label class="form-label">${t('remarks')}</label><input class="form-control" id="salNewRemarks"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button><button class="btn btn-primary" onclick="saveSalary()">${t('save')}</button></div>
  </div>`;
  showModal('mainModal');
}

async function saveSalary() {
  const data = {
    empId: document.getElementById('salNewEmpId').value,
    month: document.getElementById('salNewMonth').value,
    basicSalary: document.getElementById('salNewBasic').value,
    maternityPay: document.getElementById('salNewMaternity').value,
    festivalAllowance: document.getElementById('salNewFestival').value,
    elSurrender: document.getElementById('salNewEL').value,
    paymentStatus: document.getElementById('salNewStatus').value,
    remarks: document.getElementById('salNewRemarks').value
  };
  const result = await API.addSalary(data);
  if (result.success) { showToast(result.message, 'success'); hideModal('mainModal'); fetchSalaryRecords(); }
  else showToast(result.error, 'error');
}

async function showEditSalaryModal(recordId) {
  const res = await API.getSalaryHistory({ recordId });
  // Simplified edit - prompt based
  const newStatus = prompt('Update payment status (Paid/Pending/Held):');
  if (!newStatus) return;
  const result = await API.updateSalary({ recordId, paymentStatus: newStatus });
  if (result.success) { showToast('Updated', 'success'); fetchSalaryRecords(); }
  else showToast(result.error, 'error');
}

async function loadSalaryRevisions() {
  const container = document.getElementById('salaryTabContent');
  const result = await API.getSalaryRevisions({});
  let html = `<div class="table-toolbar"><div></div>
    ${hasRole('SuperAdmin','SectionAdmin','ITAdmin') ? '<button class="btn btn-primary btn-sm" onclick="showAddRevisionModal()"><i class="bi bi-plus-lg"></i> Add Revision</button>' : ''}
  </div><div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper"><table class="data-table"><thead><tr>
    <th>ID</th><th>${t('scheme')}</th><th>${t('designation')}</th><th>Old Amount</th><th>New Amount</th><th>Effective From</th><th>GO Number</th>
  </tr></thead><tbody>`;
  if (result.success && result.data.length) {
    html += result.data.map(r => `<tr><td>${r.RevisionID}</td><td>${r.Scheme}</td><td>${r.Designation}</td><td>${formatCurrency(r.OldAmount)}</td><td>${formatCurrency(r.NewAmount)}</td><td>${formatDateDisplay(r.EffectiveFrom)}</td><td>${r.GONumber}</td></tr>`).join('');
  } else {
    html += `<tr><td colspan="7" class="text-center text-muted" style="padding:40px">${t('no_data')}</td></tr>`;
  }
  html += '</tbody></table></div></div></div>';
  container.innerHTML = html;
}

function showAddRevisionModal() {
  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3>Add Salary Revision</h3><button class="modal-close" onclick="hideModal('mainModal')">&times;</button></div>
    <div class="modal-body">
      <div class="form-row"><div class="form-group"><label class="form-label">${t('scheme')} *</label><input class="form-control" id="revScheme"></div>
      <div class="form-group"><label class="form-label">${t('designation')} *</label><input class="form-control" id="revDesig"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Old Amount (₹)</label><input type="number" class="form-control" id="revOld"></div>
      <div class="form-group"><label class="form-label">New Amount (₹) *</label><input type="number" class="form-control" id="revNew"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Effective From *</label><input type="date" class="form-control" id="revFrom"></div>
      <div class="form-group"><label class="form-label">${t('go_number')}</label><input class="form-control" id="revGO"></div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button><button class="btn btn-primary" onclick="saveRevision()">${t('save')}</button></div>
  </div>`;
  showModal('mainModal');
}

async function saveRevision() {
  const result = await API.addSalaryRevision({
    scheme: document.getElementById('revScheme').value, designation: document.getElementById('revDesig').value,
    oldAmount: document.getElementById('revOld').value, newAmount: document.getElementById('revNew').value,
    effectiveFrom: document.getElementById('revFrom').value, goNumber: document.getElementById('revGO').value
  });
  if (result.success) { showToast(result.message, 'success'); hideModal('mainModal'); loadSalaryRevisions(); }
  else showToast(result.error, 'error');
}
