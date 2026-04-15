/* ACEDB - notifications.js */
async function loadNotifications() {
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="animate-slide">
    <div class="table-toolbar"><div></div>
      ${hasRole('SuperAdmin','SectionAdmin','ITAdmin') ? '<button class="btn btn-primary btn-sm" onclick="showAddNotifModal()"><i class="bi bi-plus-lg"></i> Post Notification</button>' : ''}
    </div>
    <div id="notifList">${t('loading')}</div>
  </div>`;
  fetchNotifications();
}

async function fetchNotifications() {
  const result = await API.getNotifications();
  const container = document.getElementById('notifList');
  if (!result.success || !result.data.length) {
    container.innerHTML = `<div class="empty-state"><i class="bi bi-bell-slash"></i><h3>${t('no_data')}</h3><p>No notifications at this time</p></div>`;
    return;
  }
  container.innerHTML = result.data.map(n => `<div class="notif-card animate-fade">
    <div class="notif-priority ${(n.Priority||'normal').toLowerCase()}"></div>
    <div class="notif-content" style="flex:1">
      <h4>${escapeHtml(n.Title)} <span class="badge badge-role" style="font-size:10px">${n.Type}</span></h4>
      <p>${escapeHtml(n.Content)}</p>
      ${n.AttachmentURL ? '<a href="' + n.AttachmentURL + '" target="_blank" class="text-primary" style="font-size:13px"><i class="bi bi-paperclip"></i> Attachment</a>' : ''}
      <div class="notif-meta">Posted by ${n.CreatedBy} on ${formatDateDisplay(n.CreatedAt)}</div>
    </div>
    ${hasRole('SuperAdmin','SectionAdmin','ITAdmin') ? '<button class="btn btn-ghost btn-sm text-danger" onclick="deleteNotif(\''+n.NotifID+'\')"><i class="bi bi-trash"></i></button>' : ''}
  </div>`).join('');
}

function showAddNotifModal() {
  const modal = document.getElementById('mainModal');
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3>Post Notification</h3><button class="modal-close" onclick="hideModal('mainModal')">&times;</button></div>
    <div class="modal-body">
      <div class="form-group"><label class="form-label">${t('title')} *</label><input class="form-control" id="notifTitle"></div>
      <div class="form-group"><label class="form-label">${t('content')} *</label><textarea class="form-control" id="notifContent" rows="4"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="notifType"><option value="Text">Text</option><option value="PDF">PDF</option><option value="Image">Image</option><option value="Link">Hyperlink</option></select></div>
        <div class="form-group"><label class="form-label">${t('priority')}</label><select class="form-select" id="notifPriority"><option value="Normal">${t('normal')}</option><option value="High">${t('high')}</option><option value="Urgent">${t('urgent')}</option></select></div>
      </div>
      <div class="form-group"><label class="form-label">Attachment URL</label><input class="form-control" id="notifURL" placeholder="https://..."></div>
      <div class="form-group"><label class="form-label">Visible To</label><select class="form-select" id="notifVisible"><option value="All">${t('all_roles')}</option><option value="SuperAdmin">Super Admin</option><option value="SectionAdmin">Section Admin</option><option value="DistrictAdmin">District Admin</option><option value="ITAdmin">IT Admin</option></select></div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="hideModal('mainModal')">${t('cancel')}</button><button class="btn btn-primary" onclick="saveNotif()">${t('save')}</button></div>
  </div>`;
  showModal('mainModal');
}

async function saveNotif() {
  const result = await API.addNotification({
    title: document.getElementById('notifTitle').value, content: document.getElementById('notifContent').value,
    type: document.getElementById('notifType').value, priority: document.getElementById('notifPriority').value,
    attachmentURL: document.getElementById('notifURL').value, visibleTo: document.getElementById('notifVisible').value
  });
  if (result.success) { showToast(result.message, 'success'); hideModal('mainModal'); fetchNotifications(); }
  else showToast(result.error, 'error');
}

async function deleteNotif(notifId) {
  if (!confirm(t('confirm_delete'))) return;
  const result = await API.deleteNotification(notifId);
  if (result.success) { showToast('Deleted', 'success'); fetchNotifications(); }
  else showToast(result.error, 'error');
}
