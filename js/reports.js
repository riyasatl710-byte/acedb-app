/* ACEDB - reports.js */
async function loadReports() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="animate-slide">
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
      <div class="stat-card purple hover-lift cursor-pointer" onclick="generateReportUI('employeeCount')"><div class="stat-icon purple"><i class="bi bi-people"></i></div><div class="stat-label fw-bold">${t('employee_count')}</div></div>
      <div class="stat-card amber hover-lift cursor-pointer" onclick="generateReportUI('salaryExpenditure')"><div class="stat-icon amber"><i class="bi bi-cash-stack"></i></div><div class="stat-label fw-bold">${t('salary_expenditure')}</div></div>
      <div class="stat-card red hover-lift cursor-pointer" onclick="generateReportUI('pendingPayments')"><div class="stat-icon red"><i class="bi bi-hourglass-split"></i></div><div class="stat-label fw-bold">${t('pending_payments')}</div></div>
      <div class="stat-card green hover-lift cursor-pointer" onclick="generateReportUI('serviceExperience')"><div class="stat-icon green"><i class="bi bi-clock-history"></i></div><div class="stat-label fw-bold">${t('service_report')}</div></div>
      <div class="stat-card blue hover-lift cursor-pointer" onclick="generateReportUI('leaveReport')"><div class="stat-icon blue"><i class="bi bi-calendar-check"></i></div><div class="stat-label fw-bold">${t('leave_report')}</div></div>
    </div>
    <div id="reportFilters" class="card hidden"><div class="card-header"><h3 id="reportTitle">Report</h3></div><div class="card-body" id="reportFilterBody"></div></div>
    <div id="reportResults" class="card hidden"><div class="card-header"><h3>Results</h3><div class="table-actions">
      <button class="btn btn-outline btn-sm" onclick="printReport()"><i class="bi bi-printer"></i> ${t('print')}</button>
      <button class="btn btn-primary btn-sm" onclick="downloadReportCSV()"><i class="bi bi-download"></i> ${t('download_csv')}</button>
    </div></div><div class="card-body" id="reportResultsBody"></div></div>
  </div>`;
}

let lastReportData = null;
let lastReportType = '';

async function generateReportUI(type) {
  lastReportType = type;
  const filterCard = document.getElementById('reportFilters');
  const filterBody = document.getElementById('reportFilterBody');
  const title = document.getElementById('reportTitle');
  filterCard.classList.remove('hidden');

  if (type === 'serviceExperience') {
    title.textContent = t('service_report');
    filterBody.innerHTML = `<div class="form-row"><div class="form-group"><label class="form-label">${t('min_experience')}</label><input type="number" class="form-control" id="repMinYears" value="5"></div>
      <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-primary" onclick="runReport('${type}')">${t('generate')}</button></div></div>`;
  } else if (type === 'salaryExpenditure') {
    title.textContent = t('salary_expenditure');
    filterBody.innerHTML = `<div class="form-row"><div class="form-group"><label class="form-label">From Month</label><input type="month" class="form-control" id="repFromMonth"></div>
      <div class="form-group"><label class="form-label">To Month</label><input type="month" class="form-control" id="repToMonth"></div>
      <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-primary" onclick="runReport('${type}')">${t('generate')}</button></div></div>`;
  } else if (type === 'leaveReport') {
    title.textContent = t('leave_report');
    filterBody.innerHTML = `<div class="form-row"><div class="form-group"><label class="form-label">${t('year')}</label><input type="number" class="form-control" id="repYear" value="${new Date().getFullYear()}"></div>
      <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-primary" onclick="runReport('${type}')">${t('generate')}</button></div></div>`;
  } else {
    title.textContent = type === 'employeeCount' ? t('employee_count') : t('pending_payments');
    filterBody.innerHTML = `<button class="btn btn-primary" onclick="runReport('${type}')">${t('generate')}</button>`;
  }
}

async function runReport(type) {
  const filters = {};
  if (type === 'serviceExperience') filters.minYears = document.getElementById('repMinYears')?.value || 5;
  if (type === 'salaryExpenditure') { filters.fromMonth = document.getElementById('repFromMonth')?.value; filters.toMonth = document.getElementById('repToMonth')?.value; }
  if (type === 'leaveReport') filters.year = document.getElementById('repYear')?.value;

  let result;
  if (type === 'serviceExperience') result = await API.getServiceReport(filters.minYears, {});
  else result = await API.generateReport(type, filters);

  const resCard = document.getElementById('reportResults');
  const resBody = document.getElementById('reportResultsBody');
  resCard.classList.remove('hidden');

  if (!result.success) { resBody.innerHTML = `<div class="alert alert-danger">${result.error}</div>`; return; }

  lastReportData = result.data;

  if (type === 'employeeCount' && result.data.table) {
    let html = `<div class="mb-3"><strong>${t('total')}: ${formatNumber(result.data.total)}</strong></div>`;
    html += '<table class="data-table"><thead><tr><th>Scheme</th><th>District</th><th>Count</th></tr></thead><tbody>';
    result.data.table.forEach(r => html += `<tr><td>${r.Scheme}</td><td>${r.District}</td><td>${r.Count}</td></tr>`);
    html += '</tbody></table>';
    resBody.innerHTML = html;
  } else if (type === 'salaryExpenditure') {
    const d = result.data;
    resBody.innerHTML = `<div class="stats-grid mb-4"><div class="stat-card purple"><div class="stat-value">${formatCurrency(d.grandTotal)}</div><div class="stat-label">Grand Total</div></div>
      <div class="stat-card amber"><div class="stat-value">${formatCurrency(d.totalBasic)}</div><div class="stat-label">Basic Salary</div></div>
      <div class="stat-card green"><div class="stat-value">${formatCurrency(d.totalMaternity)}</div><div class="stat-label">Maternity</div></div>
      <div class="stat-card blue"><div class="stat-value">${formatNumber(d.recordCount)}</div><div class="stat-label">Records</div></div></div>`;
  } else if (type === 'pendingPayments') {
    const d = result.data;
    let html = `<div class="alert alert-warning mb-3"><strong>${t('total')}: ${formatCurrency(d.totalPending)}</strong> (${d.count} records)</div>`;
    if (d.records?.length) {
      html += '<table class="data-table"><thead><tr><th>Employee</th><th>Month</th><th>Amount</th></tr></thead><tbody>';
      d.records.forEach(r => html += `<tr><td>${r.EmployeeName} (${r.EmpID})</td><td>${r.Month}</td><td>${formatCurrency(r.TotalPaid)}</td></tr>`);
      html += '</tbody></table>';
    }
    resBody.innerHTML = html;
  } else if (type === 'serviceExperience') {
    let html = `<div class="mb-3"><strong>${result.data.length} employees found</strong></div>`;
    html += '<table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>District</th><th>Scheme</th><th>Joining</th><th>Service</th></tr></thead><tbody>';
    result.data.forEach(r => html += `<tr><td>${r.EmpID}</td><td>${r.EmployeeName}</td><td>${r.District}</td><td>${r.Scheme}</td><td>${formatDateDisplay(r.DateOfFirstJoining)}</td><td>${r.serviceDuration?.years}y ${r.serviceDuration?.months}m ${r.serviceDuration?.days}d</td></tr>`);
    html += '</tbody></table>';
    resBody.innerHTML = html;
  } else if (type === 'leaveReport' && result.data.report) {
    let html = '<table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>District</th><th>CL Used</th><th>CL Bal</th><th>EL Used</th><th>EL Bal</th></tr></thead><tbody>';
    result.data.report.forEach(r => html += `<tr><td>${r.EmpID}</td><td>${r.EmployeeName}</td><td>${r.District}</td><td>${r.CLUsed}</td><td>${r.CLBalance}</td><td>${r.ELUsed}</td><td>${r.ELBalance}</td></tr>`);
    html += '</tbody></table>';
    resBody.innerHTML = html;
  }
}

function printReport() { window.print(); }

function downloadReportCSV() {
  if (!lastReportData) return;
  const dataArr = lastReportData.table || lastReportData.records || lastReportData.report || lastReportData;
  if (!Array.isArray(dataArr) || !dataArr.length) { showToast('No data to export', 'warning'); return; }
  const headers = Object.keys(dataArr[0]).filter(h => typeof dataArr[0][h] !== 'object');
  let csv = headers.join(',') + '\n';
  dataArr.forEach(row => { csv += headers.map(h => '"' + String(row[h]||'').replace(/"/g,'""') + '"').join(',') + '\n'; });
  downloadCSV(csv, lastReportType + '_report.csv');
}
