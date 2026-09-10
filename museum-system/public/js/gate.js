// ── Museo Sang Bata sa Negros — Access Gate & Security Interceptor ────
const Gate = (() => {
  const CHECKIN_KEY = 'museum_visitor_checked_in';
  const VISITOR_NAME_KEY = 'museum_visitor_name';
  const CHECKIN_DATE_KEY = 'museum_visitor_date';
  const ADMIN_TOKEN_KEY = 'museum_admin_token';

  function isVisitorCheckedIn() {
    if (sessionStorage.getItem(CHECKIN_KEY) === 'true') return true;
    try {
      const isChecked = localStorage.getItem(CHECKIN_KEY) === 'true';
      const checkDate = localStorage.getItem(CHECKIN_DATE_KEY);
      const today = new Date().toISOString().slice(0, 10);
      if (isChecked && checkDate === today) {
        sessionStorage.setItem(CHECKIN_KEY, 'true');
        return true;
      }
    } catch (e) {}
    return false;
  }

  function isAdminLoggedIn() {
    return !!localStorage.getItem(ADMIN_TOKEN_KEY) || !!sessionStorage.getItem(ADMIN_TOKEN_KEY);
  }

  function isAuthenticated() {
    return isVisitorCheckedIn() || isAdminLoggedIn();
  }

  function getVisitorName() {
    return sessionStorage.getItem(VISITOR_NAME_KEY) || localStorage.getItem(VISITOR_NAME_KEY) || 'Visitor';
  }

  function setVisitorCheckedIn(name) {
    const today = new Date().toISOString().slice(0, 10);
    sessionStorage.setItem(CHECKIN_KEY, 'true');
    localStorage.setItem(CHECKIN_KEY, 'true');
    localStorage.setItem(CHECKIN_DATE_KEY, today);
    if (name) {
      sessionStorage.setItem(VISITOR_NAME_KEY, name);
      localStorage.setItem(VISITOR_NAME_KEY, name);
    }
  }

  function logoutVisitor() {
    sessionStorage.removeItem(CHECKIN_KEY);
    sessionStorage.removeItem(VISITOR_NAME_KEY);
    localStorage.removeItem(CHECKIN_KEY);
    localStorage.removeItem(VISITOR_NAME_KEY);
    localStorage.removeItem(CHECKIN_DATE_KEY);
    window.location.href = '/';
  }

  function logoutAdmin() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    window.location.href = '/?tab=admin';
  }

  function isGatePage(pathname) {
    const p = (pathname || window.location.pathname).toLowerCase();
    return p === '/' || p === '/index.html' || p === '/checkin' || p === '/checkin.html' || p === '/login' || p === '/login.html' || p.endsWith('/index.html');
  }

  function enforce() {
    const isGate = isGatePage();

    if (!isGate && !isAuthenticated()) {
      const destination = window.location.pathname + window.location.search + window.location.hash;
      const redirectParam = encodeURIComponent(destination || '/dashboard.html');
      window.location.replace(`/?redirect=${redirectParam}`);
    } else if (isGate && isAuthenticated()) {
      const urlParams = new URLSearchParams(window.location.search);
      
      // If admin is logged in and navigates to the gate with tab=admin or checkin.html:
      if (isAdminLoggedIn()) {
        const redirectUrl = urlParams.get('redirect') ? decodeURIComponent(urlParams.get('redirect')) : '';
        if (redirectUrl && !isGatePage(redirectUrl)) {
          window.location.replace(redirectUrl);
          return;
        }
        window.location.replace('/admin.html');
        return;
      }

      // If visitor explicitly wants to view the admin login form (tab=admin) but is not admin yet, let them stay.
      if (urlParams.get('tab') === 'admin' && !isAdminLoggedIn()) {
        return;
      }

      const redirectUrl = urlParams.get('redirect') ? decodeURIComponent(urlParams.get('redirect')) : '';
      if (redirectUrl && !isGatePage(redirectUrl)) {
        window.location.replace(redirectUrl);
      } else {
        window.location.replace('/dashboard.html');
      }
    }
  }

  // Inject Mobile "Back to Admin Dashboard" controls when logged in as admin
  function injectAdminPublicControls() {
    if (!isAdminLoggedIn()) return;
    if (isGatePage()) return;
    if (window.location.pathname.toLowerCase().includes('admin.html')) return;

    // 1. Inject Styles
    if (!document.getElementById('adminPublicControlsStyle')) {
      const style = document.createElement('style');
      style.id = 'adminPublicControlsStyle';
      style.textContent = `
        /* Mobile Topbar Admin Quick-Jump Button */
        .admin-mobile-topbar-btn {
          display: none;
          align-items: center;
          gap: 5px;
          background: linear-gradient(135deg, #d94f3d, #b91c1c);
          color: #ffffff !important;
          font-family: 'Nunito', sans-serif;
          font-size: 11.5px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          text-decoration: none !important;
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 0 10px rgba(217, 79, 61, 0.4);
          white-space: nowrap;
          margin-left: auto;
          flex-shrink: 0;
          z-index: 60;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .admin-mobile-topbar-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 14px rgba(217, 79, 61, 0.7);
        }
        @media (max-width: 768px) {
          .admin-mobile-topbar-btn {
            display: inline-flex !important;
          }
        }

        /* Floating Admin Public Mode Dock */
        .admin-public-dock {
          position: fixed;
          bottom: 12px;
          right: 12px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(6, 28, 38, 0.96);
          border: 1.5px solid #00f0ff;
          border-radius: 999px;
          padding: 5px 10px 5px 12px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 240, 255, 0.35);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          font-family: 'Nunito', sans-serif;
          animation: adminDockSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-dock-badge {
          font-size: 11.5px;
          font-weight: 800;
          color: #00f0ff;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .admin-dock-badge::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #00f0ff;
          box-shadow: 0 0 8px #00f0ff;
          display: inline-block;
          animation: adminDotBlink 1.8s infinite;
        }
        @keyframes adminDotBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.85); }
        }
        .admin-dock-btn {
          background: linear-gradient(135deg, #d94f3d, #b91c1c);
          color: #ffffff !important;
          font-size: 11.5px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          text-decoration: none !important;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 2px 8px rgba(217, 79, 61, 0.4);
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .admin-dock-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(217, 79, 61, 0.6);
        }
        .admin-dock-close {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 12px;
          cursor: pointer;
          padding: 2px 4px;
          line-height: 1;
        }
        .admin-dock-close:hover {
          color: #ffffff;
        }
        @keyframes adminDockSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 480px) {
          .admin-public-dock {
            bottom: 8px;
            left: 8px;
            right: 8px;
            justify-content: space-between;
            border-radius: 12px;
            padding: 6px 10px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // 2. Insert Mobile Topbar Button if .topbar exists
    const topbar = document.querySelector('.topbar');
    if (topbar && !document.getElementById('adminMobileTopbarBtn')) {
      const adminBtn = document.createElement('a');
      adminBtn.id = 'adminMobileTopbarBtn';
      adminBtn.className = 'admin-mobile-topbar-btn';
      adminBtn.href = '/admin.html';
      adminBtn.innerHTML = '🛡️ Admin';
      adminBtn.title = 'Return to Admin Dashboard';
      
      const topbarLeft = topbar.querySelector('.topbar-left');
      if (topbarLeft) {
        topbarLeft.appendChild(adminBtn);
      } else {
        topbar.appendChild(adminBtn);
      }
    }

    // 3. Insert Floating Dock if not already present
    if (!document.getElementById('adminPublicDock')) {
      const dock = document.createElement('div');
      dock.id = 'adminPublicDock';
      dock.className = 'admin-public-dock';
      dock.innerHTML = `
        <div class="admin-dock-badge">🛡️ Admin Public View</div>
        <a href="/admin.html" class="admin-dock-btn">Back to Dashboard &rarr;</a>
        <button type="button" class="admin-dock-close" onclick="this.parentElement.remove();" aria-label="Close admin banner">✕</button>
      `;
      document.body.appendChild(dock);
    }
  }

  // Automatically enforce on script load
  enforce();

  // Inject public admin return controls when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAdminPublicControls);
  } else {
    injectAdminPublicControls();
  }

  return {
    isVisitorCheckedIn,
    isAdminLoggedIn,
    isAuthenticated,
    getVisitorName,
    setVisitorCheckedIn,
    logoutVisitor,
    logoutAdmin,
    isGatePage,
    enforce,
    injectAdminPublicControls
  };
})();
