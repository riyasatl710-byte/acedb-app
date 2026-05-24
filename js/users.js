/* ACEDB - users.js */
let allUsers = [];

async function loadUsers() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="animate-slide">
    <div class="table-toolbar"><div></div>
      ${hasRole('SuperAdmin') ? '<button class="btn btn-primary btn-sm" onclick="showCreateUserModal()"><i class="bi bi-plus-lg"></i> '+t('create_user')+'</button>' : ''}
    </div>
    <div class="card"><div class="card-body" style="padding:0"><div class="table-wrapper">
      <table class="data-table"><thead><tr>
        <th>${t('user_id')}</th><th>${t('full_name')}</th><th>${t('role')}</th><th>${t('district')}</th>
        <th>${t('email')}</th><th>${t('phone')}</th><th>${t('status')}</th><th>Last Login</th><th>${t('actions')}</th>
      </tr></thead><tbody id="userTableBody"><tr><td colspan="9" class="text-center">${t('loading')}</td></tr></tbody></table>
    </div></div></div>
  </div>`;
  fetchUsers();
}

async function fetchUsers() {
  const result = await API.getUsers();
  const tbody = document.getElementById('userTableBody');
  if (!result.success || !result.data.length) { tbody.innerHTML = `<tr><td colspan="9" class="text-center">${t('no_data')}</td></tr>`; return; }
  allUsers = result.data;
  tbody.innerHTML = result.data.map(u => `<tr>
    <td><strong>${escapeHtml(u.UserID)}</strong></td><td>${escapeHtml(u.FullName)}</td>
    <td><span class="badge badge-role">${u.Role}</span></td><td>${escapeHtml(u.District || '-')}</td>
    <td>${escapeHtml(u.Email || '-')}</td><td>${escapeHtml(u.Phone || '-')}</td>
    <td>${u.IsActive === true || u.IsActive === 'TRUE' ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-suspended">Inactive</span>'}</td>
    <td>${u.LastLogin ? formatDateDisplay(u.LastLogin) : '-'}</td>
    <td><div style="display:flex;gap:4px">
      ${hasRole('SuperAdmin') ? `<button class="btn btn-ghost btn-sm" onclick="showEditUserModal('${u.UserID}')" title="${t('edit')}"><i class="bi bi-pencil"></i></button>` : ''}
      ${hasRole('SuperAdmin','ITAdmin') ? `<button class="btn btn-ghost btn-sm" onclick="resetUserPwd('${u.UserID}')" title="${t('reset_password')}"><i class="bi bi-key"></i></button>` : ''}
      ${hasRole('SuperAdmin') && u.UserID !== 'superadmin' ? `<button class="btn btn-ghost btn-sm text-danger" onclick="deleteUserConfirm('${u.UserID}')" title="${t('delete')}"><i class="bi bi-trash"></i></button>` : ''}
    </div></td>
  </tr>`).join('');
}

function showCreateUserModal() {
  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3>${t('create_user')}</h3><button class="modal-close" onclick="hideModal('mainModal')">&times;</button></div>
    <div class="modal-body">
      <div class="form-row"><div class="form-group"><label class="form-label">${t('user_id')} *</label><input class="form-control" id="newUserId"></div>
        <div class="form-group"><label class="form-label">${t('full_name')} *</label><input class="form-control" id="newUserName"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">${t('role')} *</label>
        <select class="form-select" id="newUserRole" onchange="toggleDistrictField()">
          <option value="DistrictAdmin">District Admin</option><option value="SectionAdmin">Section Admin</option>
          <option value="ITAdmin">IT Admin</option><option value="Viewer">Viewer</option><option value="SuperAdmin">Super Admin</option>
        </select></div>
        <div class="form-group" id="newUserDistGroup"><label class="form-label">${t('district')} *</label><select class="form-select" id="newUserDist"></select></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">${t('email')}</label><input type="email" class="form-control" id="newUserEmail"></div>
        <div class="form-group"><label class="form-label">${t('phone')}</label><input class="form-control" id="newUserPhone"></div></div>
      <div class="form-group"><label class="form-label">${t('password')} (leave blank for default)</label><input type="password" class="form-control" id="newUserPwd"></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button><button class="btn btn-primary" onclick="createNewUser()">${t('save')}</button></div>
  </div>`;
  
  toggleDistrictField();
  showModal('mainModal');
}

async function toggleDistrictField() {
  const role = document.getElementById('newUserRole').value;
  const distGroup = document.getElementById('newUserDistGroup');
  const distLabel = distGroup.querySelector('.form-label');
  const distSelect = document.getElementById('newUserDist');
  
  if (role === 'DistrictAdmin') {
    distGroup.style.display = 'block';
    distLabel.textContent = t('district') + ' *';
    distSelect.innerHTML = '<option value="">Loading...</option>';
    const res = await API.getDistricts();
    if (res.success) {
      distSelect.innerHTML = '';
      res.data.forEach(d => distSelect.innerHTML += `<option value="${d}">${d}</option>`);
    }
  } else if (role === 'SectionAdmin') {
    distGroup.style.display = 'block';
    distLabel.textContent = t('scheme') + ' *';
    distSelect.innerHTML = '<option value="">Loading...</option>';
    const res = await API.getSchemes();
    if (res.success) {
      distSelect.innerHTML = '';
      res.data.forEach(s => distSelect.innerHTML += `<option value="${s}">${s}</option>`);
    }
  } else {
    distGroup.style.display = 'none';
    distSelect.innerHTML = '';
  }
}

async function createNewUser() {
  const result = await API.createUser({
    userId: document.getElementById('newUserId').value, fullName: document.getElementById('newUserName').value,
    role: document.getElementById('newUserRole').value, district: document.getElementById('newUserDist')?.value || '',
    email: document.getElementById('newUserEmail').value, phone: document.getElementById('newUserPhone').value,
    password: document.getElementById('newUserPwd').value
  });
  if (result.success) { showToast(result.message, 'success'); hideModal('mainModal'); fetchUsers(); }
  else showToast(result.error, 'error');
}

function showEditUserModal(userId) {
  const u = allUsers.find(user => user.UserID === userId);
  if (!u) return;
  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3>${t('edit_user')}</h3><button class="modal-close" onclick="hideModal('mainModal')">&times;</button></div>
    <div class="modal-body">
      <div class="form-row"><div class="form-group"><label class="form-label">${t('user_id')} *</label><input class="form-control" id="editUserId" value="${escapeHtml(u.UserID)}" readonly disabled></div>
        <div class="form-group"><label class="form-label">${t('full_name')} *</label><input class="form-control" id="editUserName" value="${escapeHtml(u.FullName)}"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">${t('role')} *</label>
        <select class="form-select" id="editUserRole" onchange="toggleEditDistrictField()">
          <option value="DistrictAdmin" ${u.Role==='DistrictAdmin'?'selected':''}>District Admin</option>
          <option value="SectionAdmin" ${u.Role==='SectionAdmin'?'selected':''}>Section Admin</option>
          <option value="ITAdmin" ${u.Role==='ITAdmin'?'selected':''}>IT Admin</option>
          <option value="Viewer" ${u.Role==='Viewer'?'selected':''}>Viewer</option>
          <option value="SuperAdmin" ${u.Role==='SuperAdmin'?'selected':''}>Super Admin</option>
        </select></div>
        <div class="form-group" id="editUserDistGroup"><label class="form-label">${t('district')} *</label><select class="form-select" id="editUserDist"></select></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">${t('email')}</label><input type="email" class="form-control" id="editUserEmail" value="${escapeHtml(u.Email||'')}"></div>
        <div class="form-group"><label class="form-label">${t('phone')}</label><input class="form-control" id="editUserPhone" value="${escapeHtml(u.Phone||'')}"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Status</label>
        <select class="form-select" id="editUserActive">
          <option value="true" ${u.IsActive===true || u.IsActive==='TRUE'?'selected':''}>Active</option>
          <option value="false" ${u.IsActive===false || u.IsActive==='FALSE'?'selected':''}>Inactive</option>
        </select></div></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button><button class="btn btn-primary" onclick="saveUserEdit()">${t('save')}</button></div>
  </div>`;
  
  toggleEditDistrictField(u.District);
  showModal('mainModal');
}

async function toggleEditDistrictField(selectedValue = '') {
  const role = document.getElementById('editUserRole').value;
  const distGroup = document.getElementById('editUserDistGroup');
  const distLabel = distGroup.querySelector('.form-label');
  const distSelect = document.getElementById('editUserDist');
  
  if (role === 'DistrictAdmin') {
    distGroup.style.display = 'block';
    distLabel.textContent = t('district') + ' *';
    distSelect.innerHTML = '<option value="">Loading...</option>';
    const res = await API.getDistricts();
    if (res.success) {
      distSelect.innerHTML = '';
      res.data.forEach(d => {
        const sel = d === selectedValue ? 'selected' : '';
        distSelect.innerHTML += `<option value="${d}" ${sel}>${d}</option>`;
      });
    }
  } else if (role === 'SectionAdmin') {
    distGroup.style.display = 'block';
    distLabel.textContent = t('scheme') + ' *';
    distSelect.innerHTML = '<option value="">Loading...</option>';
    const res = await API.getSchemes();
    if (res.success) {
      distSelect.innerHTML = '';
      res.data.forEach(s => {
        const sel = s === selectedValue ? 'selected' : '';
        distSelect.innerHTML += `<option value="${s}" ${sel}>${s}</option>`;
      });
    }
  } else {
    distGroup.style.display = 'none';
    distSelect.innerHTML = '';
  }
}

async function saveUserEdit() {
  const userId = document.getElementById('editUserId').value;
  const fullName = document.getElementById('editUserName').value;
  const role = document.getElementById('editUserRole').value;
  const district = document.getElementById('editUserDist')?.value || '';
  const email = document.getElementById('editUserEmail').value;
  const phone = document.getElementById('editUserPhone').value;
  const isActive = document.getElementById('editUserActive').value === 'true';

  const result = await API.editUser({
    userId, fullName, role, district, email, phone, isActive
  });
  if (result.success) { showToast('User updated successfully', 'success'); hideModal('mainModal'); fetchUsers(); }
  else showToast(result.error, 'error');
}

async function resetUserPwd(userId) {
  const newPwd = prompt('Enter new password (or leave blank for default):');
  const result = await API.resetPassword(userId, newPwd || '');
  if (result.success) showToast(result.message, 'success');
  else showToast(result.error, 'error');
}

async function deleteUserConfirm(userId) {
  if (!confirm(t('confirm_delete'))) return;
  const result = await API.deleteUser(userId);
  if (result.success) { showToast('User deleted', 'success'); fetchUsers(); }
  else showToast(result.error, 'error');
}
