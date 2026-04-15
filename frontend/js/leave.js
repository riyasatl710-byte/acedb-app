/* ACEDB - leave.js */
async function loadLeave() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="animate-slide">
    <div class="table-toolbar">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input class="form-control" style="max-width:160px" id="levEmpId" placeholder="Employee ID">
        <select class="form-select" style="padding:8px 36px 8px 12px;font-size:13px;min-width:100px" id="levYear">
          <option value="${new Date().getFullYear()}">${new Date().getFullYear()}</option>
          <option value="${new Date().getFullYear()-1}">${new Date().getFullYear()-1}</option>
        </select>
        <button class="btn btn-outline btn-sm" onclick="fetchLeaveData()">View Balance</button>
      </div>
      ${hasRole('SuperAdmin','DistrictAdmin') ? '<button class="btn btn-primary btn-sm" onclick="showAddLeaveModal()"><i class="bi bi-plus-lg"></i> Record Leave</button>' : ''}
    </div>
    <div id="leaveBalanceCards"></div>
    <div class="card"><div class="card-header"><h3>${t('leave')} Records</h3></div>
      <div class="card-body" style="padding:0"><div class="table-wrapper">
        <table class="data-table"><thead><tr>
          <th>ID</th><th>Employee</th><th>${t('year')}</th><th>${t('month')}</th><th>Type</th><th>Days</th><th>From</th><th>To</th><th>${t('status')}</th>
        </tr></thead><tbody id="levTableBody"><tr><td colspan="9" class="text-center text-muted" style="padding:40px">Enter Employee ID and click View Balance</td></tr></tbody></table>
      </div></div>
    </div>
    <div class="card mt-3"><div class="card-header"><h3>Monthly Leave Breakdown</h3></div>
      <div class="card-body"><div id="leaveMonthlyGrid"></div></div>
    </div>
  </div>`;
}

async function fetchLeaveData() {
  const empId = document.getElementById('levEmpId').value;
  const year = document.getElementById('levYear').value;
  if (!empId) { showToast('Please enter Employee ID', 'warning'); return; }

  const [balRes, recRes, monthRes] = await Promise.all([
    API.getLeaveBalance(empId, year),
    API.getLeaveRecords({ empId, year }),
    API.getLeaveMonthly(empId, year)
  ]);

  // Balance cards
  if (balRes.success) {
    const d = balRes.data;
    document.getElementById('leaveBalanceCards').innerHTML = `<div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin-bottom:20px">
      <div class="stat-card purple"><div class="stat-icon purple"><i class="bi bi-calendar-x"></i></div><div class="stat-value">${d.cl.balance}</div><div class="stat-label">CL Balance (of ${d.cl.quota})</div></div>
      <div class="stat-card amber"><div class="stat-icon amber"><i class="bi bi-calendar-check"></i></div><div class="stat-value">${d.el.balance}</div><div class="stat-label">EL Balance (of ${d.el.quota})</div></div>
      <div class="stat-card green"><div class="stat-icon green"><i class="bi bi-calendar-minus"></i></div><div class="stat-value">${d.cl.used}</div><div class="stat-label">CL Used</div></div>
      <div class="stat-card blue"><div class="stat-icon blue"><i class="bi bi-calendar-minus"></i></div><div class="stat-value">${d.el.used}</div><div class="stat-label">EL Used</div></div>
    </div>`;
  }

  // Records table
  const tbody = document.getElementById('levTableBody');
  if (recRes.success && recRes.data.length) {
    tbody.innerHTML = recRes.data.map(r => `<tr>
      <td>${r.LeaveID}</td><td>${r.EmpID}</td><td>${r.Year}</td><td>${r.Month}</td>
      <td><span class="badge ${r.LeaveType==='CL'?'badge-role':'badge-active'}">${r.LeaveType}</span></td>
      <td>${r.DaysAvailed}</td><td>${formatDateDisplay(r.FromDate)}</td><td>${formatDateDisplay(r.ToDate)}</td>
      <td>${getStatusBadge(r.Status)}</td>
    </tr>`).join('');
  } else tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No leave records</td></tr>';

  // Monthly grid (SPARK-style)
  if (monthRes.success) {
    const months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const monthNums = [4,5,6,7,8,9,10,11,12,1,2,3];
    let grid = '<table class="data-table"><thead><tr><th>Type</th>';
    months.forEach(m => grid += '<th>' + m + '</th>');
    grid += '<th>Total</th></tr></thead><tbody>';
    ['CL','EL'].forEach(type => {
      let total = 0;
      grid += '<tr><td><strong>' + type + '</strong></td>';
      monthNums.forEach(m => {
        const val = monthRes.data[m] ? (monthRes.data[m][type] || 0) : 0;
        total += val;
        grid += '<td class="text-center">' + (val > 0 ? '<span class="badge badge-pending">' + val + '</span>' : '-') + '</td>';
      });
      grid += '<td class="text-center"><strong>' + total + '</strong></td></tr>';
    });
    grid += '</tbody></table>';
    document.getElementById('leaveMonthlyGrid').innerHTML = grid;
  }
}

function showAddLeaveModal() {
  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3>Record Leave</h3><button class="modal-close" onclick="hideModal('mainModal')">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label class="form-label">Employee ID *</label><input class="form-control" id="levNewEmpId" value="${document.getElementById('levEmpId')?.value||''}"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('year')} *</label><input type="number" class="form-control" id="levNewYear" value="${new Date().getFullYear()}"></div>
        <div class="form-group"><label class="form-label">${t('month')} *</label><input type="number" class="form-control" id="levNewMonth" min="1" max="12" value="${new Date().getMonth()+1}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Leave Type *</label><select class="form-select" id="levNewType"><option value="CL">${t('casual_leave')}</option><option value="EL">${t('earned_leave')}</option></select></div>
        <div class="form-group"><label class="form-label">Days *</label><input type="number" class="form-control" id="levNewDays" min="0.5" step="0.5"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('from_date')}</label><input type="date" class="form-control" id="levNewFrom"></div>
        <div class="form-group"><label class="form-label">${t('to_date')}</label><input type="date" class="form-control" id="levNewTo"></div>
      </div>
      <div class="form-group"><label class="form-label">${t('remarks')}</label><input class="form-control" id="levNewRemarks"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button><button class="btn btn-primary" onclick="saveLeave()">${t('save')}</button></div>
  </div>`;
  showModal('mainModal');
}

async function saveLeave() {
  const result = await API.addLeave({
    empId: document.getElementById('levNewEmpId').value,
    year: document.getElementById('levNewYear').value,
    month: document.getElementById('levNewMonth').value,
    leaveType: document.getElementById('levNewType').value,
    daysAvailed: document.getElementById('levNewDays').value,
    fromDate: document.getElementById('levNewFrom').value,
    toDate: document.getElementById('levNewTo').value,
    remarks: document.getElementById('levNewRemarks').value
  });
  if (result.success) { showToast(result.message, 'success'); hideModal('mainModal'); fetchLeaveData(); }
  else showToast(result.error, 'error');
}
