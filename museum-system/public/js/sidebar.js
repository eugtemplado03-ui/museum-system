/**
 * Museo Sang Bata sa Negros — Slide-out Sidebar Controller
 * Manages the topbar navigation button (in the very left corner) and the slide-to-show sidebar
 * for both User Dashboard pages and the Staff Admin Portal.
 */

(function () {
  'use strict';

  if (window.__MUSEO_SIDEBAR_INIT__) return;
  window.__MUSEO_SIDEBAR_INIT__ = true;

  const currentPath = window.location.pathname.toLowerCase();

  function getActiveNavKey() {
    if (currentPath === '/' || currentPath.endsWith('/index.html') || currentPath === '') return 'home';
    if (currentPath.includes('exhibit')) return 'exhibits';
    if (currentPath.includes('program')) return 'programs';
    if (currentPath.includes('gallery')) return 'gallery';
    if (currentPath.includes('event')) return 'events';
    if (currentPath.includes('checkin')) return 'checkin';
    if (currentPath.includes('donate')) return 'donate';
    if (currentPath.includes('about')) return 'about';
    if (currentPath.includes('contact')) return 'contact';
    if (currentPath.includes('admin')) return 'admin';
    return '';
  }

  const activeKey = getActiveNavKey();

  function getActiveSidebarElement() {
    return document.querySelector('.admin-sidebar') || document.querySelector('.user-sidebar') || document.getElementById('userSidebar');
  }

  function initSidebar() {
    // 1. Place Navigation Button in the VERY LEFT CORNER of .topbar
    const topbar = document.querySelector('.topbar');
    let toggleBtn = document.getElementById('sidebarToggleBtn');

    if (topbar && !toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.id = 'sidebarToggleBtn';
      toggleBtn.className = 'sidebar-toggle-btn';
      toggleBtn.setAttribute('aria-label', 'Open navigation sidebar');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.setAttribute('aria-controls', 'userSidebar');
      toggleBtn.title = 'Open Menu';
      toggleBtn.innerHTML = `
        <span class="toggle-bar"></span>
        <span class="toggle-bar"></span>
        <span class="toggle-bar"></span>
      `;

      // Insert at the VERY START of topbar
      if (topbar.firstChild) {
        topbar.insertBefore(toggleBtn, topbar.firstChild);
      } else {
        topbar.appendChild(toggleBtn);
      }
    }

    // 2. Ensure Backdrop exists
    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebarBackdrop';
      backdrop.className = 'sidebar-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }

    // 3. Ensure Sidebar exists (or enhance existing .user-sidebar / .admin-sidebar)
    let sidebar = getActiveSidebarElement();
    if (!sidebar && !currentPath.includes('admin')) {
      sidebar = document.createElement('aside');
      sidebar.id = 'userSidebar';
      sidebar.className = 'user-sidebar';
      sidebar.setAttribute('aria-label', 'Navigation Sidebar');
      sidebar.setAttribute('aria-hidden', 'true');

      sidebar.innerHTML = `
        <div class="user-sidebar-brand">
          <div class="user-sidebar-logo">🏛️</div>
          <div class="user-sidebar-title">Explore Museo<br><span>Navigation</span></div>
          <button type="button" class="user-sidebar-close" id="sidebarCloseBtn" aria-label="Close sidebar">✕</button>
        </div>

        <nav class="user-sidebar-nav">
          <div class="user-sidebar-section-title">Navigation</div>
          <a class="user-sidebar-btn ${activeKey === 'home' ? 'active' : ''}" href="/">
            <span class="user-sidebar-icon">🏠</span>
            <span class="user-sidebar-label">Home</span>
            ${activeKey === 'home' ? '<span class="user-sidebar-indicator"></span>' : ''}
          </a>
          <a class="user-sidebar-btn ${activeKey === 'exhibits' ? 'active' : ''}" href="/exhibits.html">
            <span class="user-sidebar-icon">🏛️</span>
            <span class="user-sidebar-label">Exhibits</span>
            ${activeKey === 'exhibits' ? '<span class="user-sidebar-indicator"></span>' : ''}
          </a>
          <a class="user-sidebar-btn ${activeKey === 'programs' ? 'active' : ''}" href="/programs.html">
            <span class="user-sidebar-icon">🌱</span>
            <span class="user-sidebar-label">Programs</span>
            ${activeKey === 'programs' ? '<span class="user-sidebar-indicator"></span>' : ''}
          </a>
          <a class="user-sidebar-btn ${activeKey === 'gallery' ? 'active' : ''}" href="/gallery.html">
            <span class="user-sidebar-icon">🖼️</span>
            <span class="user-sidebar-label">Gallery</span>
            ${activeKey === 'gallery' ? '<span class="user-sidebar-indicator"></span>' : ''}
          </a>
          <a class="user-sidebar-btn ${activeKey === 'events' ? 'active' : ''}" href="/events.html">
            <span class="user-sidebar-icon">📅</span>
            <span class="user-sidebar-label">Events</span>
            ${activeKey === 'events' ? '<span class="user-sidebar-indicator"></span>' : ''}
          </a>

          <div class="user-sidebar-section-title" style="margin-top:12px;">Quick Jump</div>
          <a class="user-sidebar-btn" href="/#scannerSection">
            <span class="user-sidebar-icon">📷</span>
            <span class="user-sidebar-label">Tag Scanner</span>
          </a>
          <a class="user-sidebar-btn" href="/exhibits.html#favorites">
            <span class="user-sidebar-icon">❤️</span>
            <span class="user-sidebar-label">My Favorites</span>
          </a>

          <div class="user-sidebar-section-title" style="margin-top:12px;">Exhibit Categories</div>
          <div id="dynamicSidebarCategories" style="display:flex; flex-direction:column; gap:2px;"></div>
        </nav>

        <div class="user-sidebar-footer">
          <a class="user-sidebar-sublink" href="/checkin.html">
            <span>📋</span> Visitor Check-in
          </a>
          <a class="user-sidebar-sublink" href="/donate.html">
            <span>💖</span> Support Us
          </a>
          <a class="user-sidebar-sublink" href="/admin.html">
            <span>⚙️</span> Staff Admin
          </a>
        </div>
      `;

      document.body.appendChild(sidebar);
    } else if (sidebar) {
      if (sidebar.classList.contains('user-sidebar')) {
        if (!sidebar.id) sidebar.id = 'userSidebar';
        const brand = sidebar.querySelector('.user-sidebar-brand');
        if (brand && !brand.querySelector('.user-sidebar-close')) {
          const closeBtn = document.createElement('button');
          closeBtn.type = 'button';
          closeBtn.className = 'user-sidebar-close';
          closeBtn.id = 'sidebarCloseBtn';
          closeBtn.setAttribute('aria-label', 'Close sidebar');
          closeBtn.textContent = '✕';
          brand.appendChild(closeBtn);
        }
      } else if (sidebar.classList.contains('admin-sidebar')) {
        const brand = sidebar.querySelector('.admin-sidebar-brand');
        if (brand && !brand.querySelector('.admin-sidebar-close')) {
          const closeBtn = document.createElement('button');
          closeBtn.type = 'button';
          closeBtn.className = 'admin-sidebar-close';
          closeBtn.id = 'adminSidebarCloseBtn';
          closeBtn.setAttribute('aria-label', 'Close admin sidebar');
          closeBtn.textContent = '✕';
          brand.appendChild(closeBtn);
        }
      }
    }

    // 4. Attach event handlers
    if (toggleBtn) {
      // Remove old listener if any and add fresh
      toggleBtn.onclick = function (e) {
        e.preventDefault();
        toggleSidebar();
      };
    }

    document.addEventListener('click', function (e) {
      const closeBtn = e.target.closest('#sidebarCloseBtn, #adminSidebarCloseBtn, .user-sidebar-close, .admin-sidebar-close');
      if (closeBtn) {
        e.preventDefault();
        closeSidebar();
        return;
      }

      if (e.target.id === 'sidebarBackdrop' || e.target.classList.contains('sidebar-backdrop')) {
        closeSidebar();
      }
    });

    // Keyboard navigation: Escape key closes sidebar
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
        closeSidebar();
      }
    });

    // Touch swipe left to close sidebar
    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener('touchstart', function (e) {
      const activeEl = getActiveSidebarElement();
      if (activeEl && activeEl.contains(e.target)) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      const activeEl = getActiveSidebarElement();
      if (activeEl && activeEl.contains(e.target)) {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        if (diffX < -50 && Math.abs(diffX) > Math.abs(diffY)) {
          closeSidebar();
        }
      }
    }, { passive: true });

    // Dynamic category loading for user sidebar
    loadCategoriesForSidebar();
  }

  function openSidebar() {
    const sidebar = getActiveSidebarElement();
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!sidebar) return;

    document.body.classList.add('sidebar-open');
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    if (toggleBtn) {
      toggleBtn.classList.add('active');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
    sidebar.setAttribute('aria-hidden', 'false');
  }

  function closeSidebar() {
    const sidebar = getActiveSidebarElement();
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const backdrop = document.getElementById('sidebarBackdrop');

    document.body.classList.remove('sidebar-open');
    if (sidebar) {
      sidebar.classList.remove('open');
      sidebar.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.classList.remove('open');
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleSidebar() {
    if (document.body.classList.contains('sidebar-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  async function loadCategoriesForSidebar() {
    const container = document.getElementById('dynamicSidebarCategories') || document.getElementById('homeSidebarCategories');
    if (!container) return;

    try {
      const res = await fetch('/api/exhibits');
      if (!res.ok) return;
      const data = await res.json();
      const exhibits = Array.isArray(data) ? data : (data.exhibits || []);
      if (!exhibits.length) return;

      const counts = {};
      exhibits.forEach(ex => {
        const cat = ex.category || 'General';
        counts[cat] = (counts[cat] || 0) + 1;
      });

      const categories = Object.keys(counts).sort();
      const icons = {
        'Marine Life': '🐬',
        'Ocean Ecology': '🌊',
        'Mangroves': '🌿',
        'Reefs': '🪸',
        'History': '📜',
        'Art': '🎨',
        'Interactive': '🧩'
      };

      container.innerHTML = categories.map(cat => {
        const icon = icons[cat] || '🏷️';
        const count = counts[cat];
        return `
          <a class="user-sidebar-btn" href="/exhibits.html?category=${encodeURIComponent(cat)}">
            <span class="user-sidebar-icon">${icon}</span>
            <span class="user-sidebar-label">${cat}</span>
            <span class="user-sidebar-count">${count}</span>
          </a>
        `;
      }).join('');
    } catch (e) {
      // Quiet fail
    }
  }

  window.MuseoSidebar = {
    open: openSidebar,
    close: closeSidebar,
    toggle: toggleSidebar,
    init: initSidebar
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }
})();
