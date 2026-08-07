window.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle');
  const menuClose = document.getElementById('menuClose');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const sidebarLinks = sidebar ? sidebar.querySelectorAll('.sidebar-link') : [];

  if (menuToggle && menuClose && sidebar && sidebarBackdrop) {
    function openSidebar() {
      document.body.classList.add('sidebar-open');
      sidebar.setAttribute('aria-hidden', 'false');
      menuToggle.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
      document.body.classList.remove('sidebar-open');
      sidebar.setAttribute('aria-hidden', 'true');
      menuToggle.setAttribute('aria-expanded', 'false');
    }

    menuToggle.addEventListener('click', () => {
      if (document.body.classList.contains('sidebar-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    menuClose.addEventListener('click', closeSidebar);
    sidebarBackdrop.addEventListener('click', closeSidebar);

    sidebarLinks.forEach((link) => {
      link.addEventListener('click', closeSidebar);
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
        closeSidebar();
      }
    });
  }

  const statsToggle = document.getElementById('statsToggle');
  const statsPanel = document.getElementById('statsPanel');
  const statsClose = document.getElementById('statsClose');
  const statsBackdrop = document.getElementById('statsBackdrop');

  if (statsToggle && statsPanel) {
    function openStatsPanel() {
      document.body.classList.add('stats-panel-open');
      statsPanel.setAttribute('aria-hidden', 'false');
      statsToggle.setAttribute('aria-expanded', 'true');
    }

    function closeStatsPanel() {
      document.body.classList.remove('stats-panel-open');
      statsPanel.setAttribute('aria-hidden', 'true');
      statsToggle.setAttribute('aria-expanded', 'false');
    }

    statsToggle.addEventListener('click', () => {
      if (document.body.classList.contains('stats-panel-open')) {
        closeStatsPanel();
      } else {
        openStatsPanel();
      }
    });

    if (statsClose) {
      statsClose.addEventListener('click', closeStatsPanel);
    }

    if (statsBackdrop) {
      statsBackdrop.addEventListener('click', closeStatsPanel);
    }

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('stats-panel-open')) {
        closeStatsPanel();
      }
    });
  }
});
