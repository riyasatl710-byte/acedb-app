/* ACEDB - utils.js  UI utility functions */

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
  toast.innerHTML = '<i class="bi ' + (icons[type]||icons.info) + '"></i><span>' + message + '</span>';
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100px)'; setTimeout(() => toast.remove(), 300); }, duration);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toastContainer';
  c.className = 'toast-container';
  document.body.appendChild(c);
  return c;
}

function showLoading(show) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.classList.toggle('show', show);
}

function showModal(id) {
  document.getElementById(id).classList.add('show');
}

function hideModal(id) {
  document.getElementById(id).classList.remove('show');
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
}

function formatNumber(n) {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateInput(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function getStatusBadge(status) {
  const map = { Active: 'badge-active', Suspended: 'badge-suspended', Terminated: 'badge-suspended', Paid: 'badge-paid', Pending: 'badge-pending', Held: 'badge-pending', Expired: 'badge-expired', 'Expiring Soon': 'badge-expiring' };
  return '<span class="badge ' + (map[status] || 'badge-active') + '">' + status + '</span>';
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename || 'export.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function debounce(fn, delay = 300) {
  let timer;
  return function(...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function initTooltips() {
  document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.style.position = 'relative';
    el.addEventListener('mouseenter', function() {
      const tip = document.createElement('div');
      tip.className = 'tooltip-popup';
      tip.textContent = this.dataset.tooltip;
      tip.style.cssText = 'position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#1A1A2E;color:white;padding:6px 12px;border-radius:6px;font-size:12px;white-space:nowrap;z-index:999;margin-bottom:6px;';
      this.appendChild(tip);
    });
    el.addEventListener('mouseleave', function() {
      const tip = this.querySelector('.tooltip-popup');
      if (tip) tip.remove();
    });
  });
}

function animateCount(el, target, duration = 1000) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { el.textContent = formatNumber(target); clearInterval(timer); }
    else el.textContent = formatNumber(Math.floor(start));
  }, 16);
}
