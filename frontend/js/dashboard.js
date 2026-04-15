/* ACEDB - dashboard-internal.js */
async function loadDashboard() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="animate-slide"><div id="dashNotifBanner"></div><div id="dashStats" class="stats-grid"></div>
    <div class="charts-grid"><div class="card"><div class="card-header"><h3>Employees by Scheme</h3></div><div class="card-body"><div class="chart-container"><canvas id="schemeChart"></canvas></div></div></div>
    <div class="card"><div class="card-header"><h3>Employees by District</h3></div><div class="card-body"><div class="chart-container"><canvas id="districtChart"></canvas></div></div></div></div>
  </div>`;

  const result = await API.getInternalDashboard();
  if (!result.success) { showToast(result.error, 'error'); return; }
  const d = result.data;

  // Stats cards
  document.getElementById('dashStats').innerHTML = `
    <div class="stat-card purple animate-fade stagger-1"><div class="stat-icon purple"><i class="bi bi-people-fill"></i></div><div class="stat-value" id="statActive">${formatNumber(d.totalActive)}</div><div class="stat-label">${t('active_employees')}</div></div>
    <div class="stat-card red animate-fade stagger-2"><div class="stat-icon red"><i class="bi bi-person-slash"></i></div><div class="stat-value">${formatNumber(d.totalSuspended)}</div><div class="stat-label">${t('suspended')}</div></div>
    <div class="stat-card green animate-fade stagger-3"><div class="stat-icon green"><i class="bi bi-cash-stack"></i></div><div class="stat-value">${formatCurrency(d.salaryPaid)}</div><div class="stat-label">${t('salary_paid')}</div></div>
    <div class="stat-card amber animate-fade stagger-4"><div class="stat-icon amber"><i class="bi bi-hourglass-split"></i></div><div class="stat-value">${formatCurrency(d.salaryPending)}</div><div class="stat-label">${t('salary_pending')}</div></div>
    <div class="stat-card blue animate-fade stagger-5"><div class="stat-icon blue"><i class="bi bi-file-earmark-text"></i></div><div class="stat-value">${d.expiringContracts}</div><div class="stat-label">${t('expiring_contracts')}</div></div>`;

  // Notifications banner
  if (d.recentNotifications?.length) {
    document.getElementById('dashNotifBanner').innerHTML = d.recentNotifications.map(n =>
      `<div class="alert alert-${n.Priority==='Urgent'?'danger':n.Priority==='High'?'warning':'info'} animate-fade"><i class="bi bi-bell"></i> <strong>${escapeHtml(n.Title)}</strong> - ${escapeHtml(n.Content?.substring(0,100))}</div>`
    ).join('');
  }

  // Charts
  if (typeof Chart !== 'undefined') {
    const schemeLabels = Object.keys(d.byScheme);
    const schemeData = Object.values(d.byScheme);
    const colors = ['#7E57C2','#FFB300','#10B981','#EF4444','#6366F1','#EC4899','#14B8A6','#F97316','#8B5CF6','#06B6D4'];

    new Chart(document.getElementById('schemeChart'), {
      type: 'doughnut',
      data: { labels: schemeLabels, datasets: [{ data: schemeData, backgroundColor: colors.slice(0, schemeLabels.length), borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    const distLabels = Object.keys(d.byDistrict);
    const distData = Object.values(d.byDistrict);
    new Chart(document.getElementById('districtChart'), {
      type: 'bar',
      data: { labels: distLabels, datasets: [{ label: 'Employees', data: distData, backgroundColor: '#7E57C2cc', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
}
