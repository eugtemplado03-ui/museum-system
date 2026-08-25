(function() {
  function initMobileSidebar() {
    const sidebar = document.querySelector('.user-sidebar, .admin-sidebar');
    if (!sidebar) return;

    // Create or find toggle button
    let toggleBtn = document.getElementById('mobileSidebarToggle');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.id = 'mobileSidebarToggle';
      toggleBtn.className = 'mobile-sidebar-toggle-btn';
      toggleBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
      
      const isExhibits = window.location.pathname.includes('exhibit');
      const isCat = sidebar.querySelector('#sidebarCategoryNav') !== null;
      const labelText = isCat || isExhibits ? 'Categories' : 'Menu';
      const icon = isCat || isExhibits ? '🏷️' : '☰';

      toggleBtn.innerHTML = `<span class="toggle-icon">${icon}</span> <span class="toggle-text">${labelText}</span>`;
      document.body.appendChild(toggleBtn);
    }

    // Create or find backdrop
    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebarBackdrop';
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    // Add close button to sidebar brand/header on mobile if missing
    const brand = sidebar.querySelector('.user-sidebar-brand, .admin-sidebar-brand');
    if (brand && !sidebar.querySelector('.sidebar-close-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'sidebar-close-btn';
      closeBtn.setAttribute('type', 'button');
      closeBtn.setAttribute('aria-label', 'Close sidebar');
      closeBtn.innerHTML = '✕';
      brand.appendChild(closeBtn);
      closeBtn.addEventListener('click', closeSidebar);
    }

    function openSidebar() {
      sidebar.classList.add('mobile-drawer-open');
      backdrop.classList.add('active');
      toggleBtn.classList.add('active');
      document.body.classList.add('sidebar-locked');
    }

    function closeSidebar() {
      sidebar.classList.remove('mobile-drawer-open');
      backdrop.classList.remove('active');
      toggleBtn.classList.remove('active');
      document.body.classList.remove('sidebar-locked');
    }

    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains('mobile-drawer-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    };

    backdrop.onclick = closeSidebar;

    // Auto-close when clicking links/buttons inside sidebar on mobile screen
    sidebar.addEventListener('click', (e) => {
      const target = e.target.closest('a, button, .user-sidebar-btn, .cat-sidebar-btn, .admin-sidebar-btn');
      if (target && !target.classList.contains('sidebar-close-btn')) {
        if (window.innerWidth <= 860) {
          closeSidebar();
        }
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('mobile-drawer-open')) {
        closeSidebar();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileSidebar);
  } else {
    initMobileSidebar();
  }

  window.initMobileSidebar = initMobileSidebar;
})();
