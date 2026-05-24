/* ACEDB - settings.js */
async function loadSettings() {
  const content = document.getElementById('pageContent');
  const user = getCurrentUser();
  const isSuper = user && user.role === 'SuperAdmin';
  
  let html = `<div class="animate-slide">`;
  
  if (isSuper) {
    html += `
      <div class="card"><div class="card-header"><h3>Scheme Management</h3></div><div class="card-body">
        <div style="display:flex;gap:8px;margin-bottom:16px"><input class="form-control" id="newScheme" placeholder="New scheme name" style="max-width:300px">
          <button class="btn btn-primary btn-sm" onclick="addNewScheme()"><i class="bi bi-plus-lg"></i> Add</button></div>
        <div id="schemesList">${t('loading')}</div>
      </div></div>
      
      <div class="card"><div class="card-header"><h3>Feature Entry Locks</h3></div><div class="card-body" id="locksConfigList">
        <div class="text-center" style="padding:10px"><div class="spinner" style="margin:0 auto 10px"></div><p class="text-muted">Loading...</p></div>
      </div></div>
    `;
  }
  
  html += `
    <div class="card"><div class="card-header"><h3>${t('change_password')}</h3></div><div class="card-body">
      <div class="form-group"><label class="form-label">${t('old_password')}</label><input type="password" class="form-control" id="oldPwd" style="max-width:300px"></div>
      <div class="form-group"><label class="form-label">${t('new_password')}</label><input type="password" class="form-control" id="newPwd" style="max-width:300px"></div>
      <button class="btn btn-primary" onclick="doChangePassword()">${t('change_password')}</button>
    </div></div>
  `;
  
  if (isSuper) {
    html += `<div class="card"><div class="card-header"><h3>System Configuration</h3></div><div class="card-body" id="configList">${t('loading')}</div></div>`;
  }
  
  html += `</div>`;
  content.innerHTML = html;
  
  if (isSuper) {
    loadSchemes();
    loadLocksConfig();
    loadConfigList();
  }
}

async function loadLocksConfig() {
  const result = await API.getConfig();
  const container = document.getElementById('locksConfigList');
  if (!result.success) {
    container.innerHTML = '<p class="text-muted">Could not load locks config</p>';
    return;
  }
  const config = result.data;
  
  const lockHonorarium = String(config.LOCK_HONORARIUM || 'false').toLowerCase() === 'true';
  const lockFestival = String(config.LOCK_FESTIVAL_ALLOWANCE || 'false').toLowerCase() === 'true';
  const lockMaternity = String(config.LOCK_MATERNITY_PAY || 'false').toLowerCase() === 'true';
  const lockEL = String(config.LOCK_EL_SURRENDER || 'false').toLowerCase() === 'true';
  const lockEmoluments = String(config.LOCK_EMOLUMENTS || 'false').toLowerCase() === 'true';
  const lockLeave = String(config.LOCK_LEAVE || 'false').toLowerCase() === 'true';
  const lockContract = String(config.LOCK_CONTRACT || 'false').toLowerCase() === 'true';
  const lockFinancialYear = String(config.LOCK_FINANCIAL_YEAR || 'false').toLowerCase() === 'true';
  
  container.innerHTML = `
    <p class="text-muted" style="margin-bottom:20px; font-size:13px;">Configure lock status for data entry facilities. When locked, non-Superadmin roles (e.g. District Admins) will be restricted from adding or updating records. Superadmins always have full access.</p>
    <div style="display:grid;gap:16px;max-width:550px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-light);border-radius:6px">
        <div>
          <strong>Lock Honorarium updates</strong><br>
          <small class="text-muted">Prevents updating Last Paid Date and Partial Month/Amount</small>
        </div>
        <input type="checkbox" id="lock_honorarium" style="width:20px;height:20px;cursor:pointer" ${lockHonorarium ? 'checked' : ''}>
      </div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-light);border-radius:6px">
        <div>
          <strong>Lock Emoluments page</strong><br>
          <small class="text-muted">Prevents adding or modifying any emolument records</small>
        </div>
        <input type="checkbox" id="lock_emoluments" style="width:20px;height:20px;cursor:pointer" ${lockEmoluments ? 'checked' : ''}>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-light);border-radius:6px">
        <div>
          <strong>Lock Financial Year selection</strong><br>
          <small class="text-muted">Prevents changing the default Financial Year in Emoluments popup</small>
        </div>
        <input type="checkbox" id="lock_financial_year" style="width:20px;height:20px;cursor:pointer" ${lockFinancialYear ? 'checked' : ''}>
      </div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-light);border-radius:6px">
        <div>
          <strong>Lock Festival Allowance entry</strong><br>
          <small class="text-muted">Prevents inputting Festival Allowance in other emoluments</small>
        </div>
        <input type="checkbox" id="lock_festival" style="width:20px;height:20px;cursor:pointer" ${lockFestival ? 'checked' : ''}>
      </div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-light);border-radius:6px">
        <div>
          <strong>Lock Maternity Pay entry</strong><br>
          <small class="text-muted">Prevents inputting Maternity Pay in other emoluments</small>
        </div>
        <input type="checkbox" id="lock_maternity" style="width:20px;height:20px;cursor:pointer" ${lockMaternity ? 'checked' : ''}>
      </div>
      
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-light);border-radius:6px">
        <div>
          <strong>Lock EL Surrender entry</strong><br>
          <small class="text-muted">Prevents inputting EL Surrender in other emoluments</small>
        </div>
        <input type="checkbox" id="lock_el" style="width:20px;height:20px;cursor:pointer" ${lockEL ? 'checked' : ''}>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-light);border-radius:6px">
        <div>
          <strong>Lock Leave module</strong><br>
          <small class="text-muted">Prevents registering new leaves or editing leave records</small>
        </div>
        <input type="checkbox" id="lock_leave" style="width:20px;height:20px;cursor:pointer" ${lockLeave ? 'checked' : ''}>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg-light);border-radius:6px">
        <div>
          <strong>Lock Contract module</strong><br>
          <small class="text-muted">Prevents adding or modifying Contract/GO records</small>
        </div>
        <input type="checkbox" id="lock_contract" style="width:20px;height:20px;cursor:pointer" ${lockContract ? 'checked' : ''}>
      </div>
      
      <button class="btn btn-primary" onclick="saveFeatureLocks()"><i class="bi bi-save"></i> Save Lock Settings</button>
    </div>
  `;
}

async function saveFeatureLocks() {
  const lockHonorarium = document.getElementById('lock_honorarium').checked ? 'true' : 'false';
  const lockFestival = document.getElementById('lock_festival').checked ? 'true' : 'false';
  const lockMaternity = document.getElementById('lock_maternity').checked ? 'true' : 'false';
  const lockEL = document.getElementById('lock_el').checked ? 'true' : 'false';
  const lockEmoluments = document.getElementById('lock_emoluments').checked ? 'true' : 'false';
  const lockLeave = document.getElementById('lock_leave').checked ? 'true' : 'false';
  const lockContract = document.getElementById('lock_contract').checked ? 'true' : 'false';
  const lockFinancialYear = document.getElementById('lock_financial_year').checked ? 'true' : 'false';
  
  showLoading(true);
  try {
    await Promise.all([
      API.updateConfig('LOCK_HONORARIUM', lockHonorarium),
      API.updateConfig('LOCK_FESTIVAL_ALLOWANCE', lockFestival),
      API.updateConfig('LOCK_MATERNITY_PAY', lockMaternity),
      API.updateConfig('LOCK_EL_SURRENDER', lockEL),
      API.updateConfig('LOCK_EMOLUMENTS', lockEmoluments),
      API.updateConfig('LOCK_LEAVE', lockLeave),
      API.updateConfig('LOCK_CONTRACT', lockContract),
      API.updateConfig('LOCK_FINANCIAL_YEAR', lockFinancialYear)
    ]);
    showToast('Lock settings saved successfully', 'success');
    loadLocksConfig();
  } catch (err) {
    showToast('Failed to save lock settings: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function loadSchemes() {
  const result = await API.getSchemes();
  const container = document.getElementById('schemesList');
  if (!result.success || !result.data.length) { container.innerHTML = '<p class="text-muted">No schemes configured yet</p>'; return; }
  container.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px">' + result.data.map(s =>
    '<span class="badge badge-role" style="font-size:14px;padding:8px 16px">' + escapeHtml(s) + ' <button style="background:none;border:none;color:var(--danger);cursor:pointer;margin-left:4px" onclick="removeScheme(\''+s+'\')"><i class="bi bi-x"></i></button></span>'
  ).join('') + '</div>';
}

async function addNewScheme() {
  const name = document.getElementById('newScheme').value.trim();
  if (!name) return;
  const result = await API.addScheme(name);
  if (result.success) { showToast('Scheme added', 'success'); document.getElementById('newScheme').value = ''; loadSchemes(); }
  else showToast(result.error, 'error');
}

async function removeScheme(name) {
  if (!confirm('Remove scheme: ' + name + '?')) return;
  const result = await API.deleteScheme(name);
  if (result.success) { showToast('Removed', 'success'); loadSchemes(); }
  else showToast(result.error, 'error');
}

async function doChangePassword() {
  const result = await API.changePassword(document.getElementById('oldPwd').value, document.getElementById('newPwd').value);
  if (result.success) { showToast(result.message, 'success'); document.getElementById('oldPwd').value = ''; document.getElementById('newPwd').value = ''; }
  else showToast(result.error, 'error');
}

async function loadConfigList() {
  const result = await API.getConfig();
  const container = document.getElementById('configList');
  if (!result.success) { container.innerHTML = '<p class="text-muted">Could not load config</p>'; return; }
  const config = result.data;
  let html = '<table class="data-table"><thead><tr><th>Key</th><th>Value</th><th>Action</th></tr></thead><tbody>';
  for (const key in config) {
    if (key.endsWith('_COUNTER') || key === 'DEFAULT_PASSWORD') continue;
    html += `<tr><td><strong>${escapeHtml(key)}</strong></td><td><input class="form-control" id="cfg_${key}" value="${escapeHtml(config[key])}" style="max-width:400px"></td>
      <td><button class="btn btn-sm btn-outline" onclick="saveConfig('${key}')">Save</button></td></tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function saveConfig(key) {
  const value = document.getElementById('cfg_' + key)?.value;
  const result = await API.updateConfig(key, value);
  if (result.success) showToast('Saved', 'success');
  else showToast(result.error, 'error');
}

/* ACEDB - audit log viewer */
async function loadAudit() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="animate-slide">
    <div class="table-toolbar">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="form-select" style="padding:8px 36px 8px 12px;font-size:13px;min-width:120px" id="auditModFilter" onchange="fetchAudit()">
          <option value="">All Modules</option><option value="Employee">Employee</option><option value="Salary">Honorarium</option>
          <option value="Leave">Leave</option><option value="Contract">Contract</option><option value="User">User</option>
          <option value="Notification">Notification</option><option value="Config">Config</option>
        </select>
        <select class="form-select" style="padding:8px 36px 8px 12px;font-size:13px;min-width:120px" id="auditActFilter" onchange="fetchAudit()">
          <option value="">All Actions</option><option value="CREATE">Create</option><option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option><option value="LOGIN">Login</option><option value="LOGOUT">Logout</option>
        </select>
        <input type="date" class="form-control" style="max-width:150px" id="auditFrom" onchange="fetchAudit()">
        <input type="date" class="form-control" style="max-width:150px" id="auditTo" onchange="fetchAudit()">
      </div>
    </div>
    <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
      <table class="data-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Record</th><th>Description</th></tr></thead>
        <tbody id="auditTableBody"><tr><td colspan="6" class="text-center">${t('loading')}</td></tr></tbody></table>
    </div></div></div>
  </div>`;
  fetchAudit();
}

async function fetchAudit() {
  const filters = {};
  const mod = document.getElementById('auditModFilter')?.value;
  const act = document.getElementById('auditActFilter')?.value;
  const from = document.getElementById('auditFrom')?.value;
  const to = document.getElementById('auditTo')?.value;
  if (mod) filters.module = mod;
  if (act) filters.action = act;
  if (from) filters.fromDate = from;
  if (to) filters.toDate = to;

  const result = await API.getAuditLog(filters);
  const tbody = document.getElementById('auditTableBody');
  if (!result.success || !result.data.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No logs found</td></tr>'; return; }
  tbody.innerHTML = result.data.map(r => `<tr>
    <td style="font-size:12px">${formatDateDisplay(r.Timestamp)}</td><td>${escapeHtml(r.UserID)}</td>
    <td><span class="badge badge-role">${r.Action}</span></td><td>${r.Module}</td>
    <td>${escapeHtml(r.RecordID)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.Description)}</td>
  </tr>`).join('');
}
