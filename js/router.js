/* ACEDB - router.js  SPA navigation */
const Router = {
  currentPage: 'dashboard',
  pages: {},

  init() {
    this.pages = {
      dashboard: { title: 'dashboard', icon: 'bi-grid-1x2-fill', load: loadDashboard, roles: ['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'] },
      employees: { title: 'employees', icon: 'bi-people-fill', load: loadEmployees, roles: ['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'] },
      salary: { title: 'salary', icon: 'bi-cash-stack', load: loadSalary, roles: ['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'] },
      leave: { title: 'leave', icon: 'bi-calendar-check', load: loadLeave, roles: ['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'] },
      contracts: { title: 'contracts', icon: 'bi-file-earmark-text-fill', load: loadContracts, roles: ['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'] },
      notifications: { title: 'notifications', icon: 'bi-bell-fill', load: loadNotifications, roles: ['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'] },
      reports: { title: 'reports', icon: 'bi-bar-chart-fill', load: loadReports, roles: ['SuperAdmin','ITAdmin','SectionAdmin','DistrictAdmin','Viewer'] },
      users: { title: 'users', icon: 'bi-shield-lock-fill', load: loadUsers, roles: ['SuperAdmin','ITAdmin'] },
      settings: { title: 'settings', icon: 'bi-gear-fill', load: loadSettings, roles: ['SuperAdmin'] },
      audit: { title: 'audit_log', icon: 'bi-clock-history', load: loadAudit, roles: ['SuperAdmin','ITAdmin'] }
    };

    // Build sidebar AFTER pages are populated
    this.buildSidebar();

    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  navigate(page) {
    window.location.hash = '#' + page;
  },

  handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const page = this.pages[hash];
    if (!page) { this.navigate('dashboard'); return; }

    const role = getCurrentRole();
    if (!page.roles.includes(role)) { showToast('Unauthorized access', 'error'); this.navigate('dashboard'); return; }

    this.currentPage = hash;
    
    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === hash);
    });

    // Update header title
    const headerTitle = document.getElementById('pageTitle');
    if (headerTitle) headerTitle.textContent = t(page.title);

    // Load page content
    if (typeof page.load === 'function') page.load();
  },

  buildSidebar() {
    const role = getCurrentRole();
    const nav = document.getElementById('sidebarNav');
    if (!nav) return;

    let html = '';
    const sections = {
      'Main': ['dashboard'],
      'Management': ['employees', 'salary', 'leave', 'contracts'],
      'Communication': ['notifications'],
      'Analytics': ['reports'],
      'Administration': ['users', 'settings', 'audit']
    };

    for (const [section, pages] of Object.entries(sections)) {
      const visiblePages = pages.filter(p => this.pages[p] && this.pages[p].roles.includes(role));
      if (visiblePages.length === 0) continue;

      html += '<div class="nav-section"><div class="nav-section-title">' + section + '</div>';
      visiblePages.forEach(p => {
        const pg = this.pages[p];
        html += '<a class="nav-item" data-page="' + p + '" onclick="Router.navigate(\'' + p + '\')">';
        html += '<i class="bi ' + pg.icon + '"></i><span data-i18n="' + pg.title + '">' + t(pg.title) + '</span></a>';
      });
      html += '</div>';
    }
    nav.innerHTML = html;
  }
};
