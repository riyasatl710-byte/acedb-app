/* ACEDB - contracts.js */
async function loadContracts() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="animate-slide">
    <div id="contractAlerts"></div>
    <div class="table-toolbar">
      <div style="display:flex;gap:8px"><select class="form-select" style="padding:8px 36px 8px 12px;font-size:13px" id="conSchemeFilter" onchange="fetchContracts()"><option value="">${t('all_schemes')}</option></select></div>
      ${hasRole('SuperAdmin','SectionAdmin','ITAdmin') ? '<button class="btn btn-primary btn-sm" onclick="showAddContractModal()"><i class="bi bi-plus-lg"></i> Add Contract/GO</button>' : ''}
    </div>
    <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
      <table class="data-table"><thead><tr>
        <th>ID</th><th>${t('scheme')}</th><th>${t('go_number')}</th><th>Type</th><th>${t('start_date')}</th>
        <th>${t('expiry_date')}</th><th>Posts</th><th>Honorarium</th><th>${t('status')}</th><th>${t('actions')}</th>
      </tr></thead><tbody id="conTableBody"><tr><td colspan="10" class="text-center">${t('loading')}</td></tr></tbody></table>
    </div></div></div>
  </div>`;

  const schRes = await API.getSchemes();
  if (schRes.success) populateSelect('conSchemeFilter', schRes.data, t('all_schemes'));
  fetchContracts();
}

async function fetchContracts() {
  const scheme = document.getElementById('conSchemeFilter')?.value || '';
  const result = await API.getContracts({ scheme });
  const tbody = document.getElementById('conTableBody');
  
  // Show expiring alerts
  const expiring = result.success ? result.data.filter(r => r.expiryStatus === 'Expiring Soon') : [];
  if (expiring.length > 0) {
    document.getElementById('contractAlerts').innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> <strong>${expiring.length} contract(s) expiring soon!</strong></div>`;
  }

  if (!result.success || !result.data.length) { tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">${t('no_data')}</td></tr>`; return; }

  tbody.innerHTML = result.data.map(r => `<tr>
    <td>${r.ContractID}</td><td>${escapeHtml(r.Scheme)}</td><td>${escapeHtml(r.GONumber)}</td>
    <td><span class="badge badge-role">${r.SanctionType}</span></td>
    <td>${formatDateDisplay(r.StartDate)}</td><td>${formatDateDisplay(r.ExpiryDate)}</td>
    <td>${r.SanctionedPosts}</td><td>${formatCurrency(r.HonorariumAmount)}</td>
    <td>${r.expiryStatus ? getStatusBadge(r.expiryStatus) : '-'}</td>
    <td>${hasRole('SuperAdmin','SectionAdmin','ITAdmin') ? `<button class="btn btn-ghost btn-sm" onclick="editContractPrompt('${r.ContractID}')"><i class="bi bi-pencil"></i></button>` : ''}</td>
  </tr>`).join('');
}

function showAddContractModal() {
  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3>Add Contract / GO</h3><button class="modal-close" onclick="hideModal('mainModal')">&times;</button></div>
    <div class="modal-body">
      <div class="form-row"><div class="form-group"><label class="form-label">${t('scheme')} *</label><input class="form-control" id="conScheme"></div>
      <div class="form-group"><label class="form-label">${t('go_number')} *</label><input class="form-control" id="conGO"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">${t('go_date')}</label><input type="date" class="form-control" id="conGODate"></div>
      <div class="form-group"><label class="form-label">Sanction Type</label><select class="form-select" id="conType"><option value="New">${t('new_sanction')}</option><option value="Extension">${t('extension')}</option><option value="Revision">${t('revision')}</option></select></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">${t('start_date')} *</label><input type="date" class="form-control" id="conStart"></div>
      <div class="form-group"><label class="form-label">${t('expiry_date')} *</label><input type="date" class="form-control" id="conExpiry"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">${t('sanctioned_posts')}</label><input type="number" class="form-control" id="conPosts"></div>
      <div class="form-group"><label class="form-label">${t('honorarium')} (₹)</label><input type="number" class="form-control" id="conHon"></div></div>
      <div class="form-group"><label class="form-label">${t('remarks')}</label><input class="form-control" id="conRemarks"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button><button class="btn btn-primary" onclick="saveContract()">${t('save')}</button></div>
  </div>`;
  showModal('mainModal');
}

async function saveContract() {
  const result = await API.addContract({
    scheme: document.getElementById('conScheme').value, goNumber: document.getElementById('conGO').value,
    goDate: document.getElementById('conGODate').value, sanctionType: document.getElementById('conType').value,
    startDate: document.getElementById('conStart').value, expiryDate: document.getElementById('conExpiry').value,
    sanctionedPosts: document.getElementById('conPosts').value, honorariumAmount: document.getElementById('conHon').value,
    remarks: document.getElementById('conRemarks').value
  });
  if (result.success) { showToast(result.message, 'success'); hideModal('mainModal'); fetchContracts(); }
  else showToast(result.error, 'error');
}

async function editContractPrompt(contractId) {
  const newExpiry = prompt('Update expiry date (YYYY-MM-DD):');
  if (!newExpiry) return;
  const result = await API.editContract({ contractId, expiryDate: newExpiry });
  if (result.success) { showToast('Contract updated', 'success'); fetchContracts(); }
  else showToast(result.error, 'error');
}
