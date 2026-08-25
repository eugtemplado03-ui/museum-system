// ── Museo Sang Bata sa Negros — Access Gate & Security Interceptor ────
const Gate = (() => {
  const CHECKIN_KEY = 'museum_visitor_checked_in';
  const VISITOR_NAME_KEY = 'museum_visitor_name';
  const ADMIN_TOKEN_KEY = 'museum_admin_token';

  function isVisitorCheckedIn() {
    return localStorage.getItem(CHECKIN_KEY) === 'true';
  }

  function isAdminLoggedIn() {
    return !!localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  function isAuthenticated() {
    return isVisitorCheckedIn() || isAdminLoggedIn();
  }

  function getVisitorName() {
    return localStorage.getItem(VISITOR_NAME_KEY) || 'Visitor';
  }

  function setVisitorCheckedIn(name) {
    localStorage.setItem(CHECKIN_KEY, 'true');
    if (name) localStorage.setItem(VISITOR_NAME_KEY, name);
  }

  function logoutVisitor() {
    localStorage.removeItem(CHECKIN_KEY);
    localStorage.removeItem(VISITOR_NAME_KEY);
    window.location.href = '/checkin.html';
  }

  function logoutAdmin() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.location.href = '/checkin.html?tab=admin';
  }

  function enforce() {
    const currentPath = window.location.pathname;
    const isGatePage = currentPath.endsWith('/checkin.html') || currentPath.endsWith('/checkin');

    if (!isGatePage && !isAuthenticated()) {
      const destination = window.location.pathname + window.location.search + window.location.hash;
      const redirectParam = encodeURIComponent(destination);
      window.location.replace(`/checkin.html?redirect=${redirectParam}`);
    }
  }

  // Automatically enforce on script load
  enforce();

  return {
    isVisitorCheckedIn,
    isAdminLoggedIn,
    isAuthenticated,
    getVisitorName,
    setVisitorCheckedIn,
    logoutVisitor,
    logoutAdmin,
    enforce
  };
})();
