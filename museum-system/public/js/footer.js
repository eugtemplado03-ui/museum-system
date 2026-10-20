// Populate the shared site footer and load the sidebar controller when needed.
(function(){
  const footer = document.getElementById('siteFooter') || (function(){ const f = document.createElement('footer'); f.id='siteFooter'; document.body.appendChild(f); return f; })();
  
  // Load shared museum details, render footer links, and show a fallback on failure.
  async function loadFooter() {
    try {
      const res = await fetch('/api/museum-info');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const { museumInfo } = await res.json();
      if (!museumInfo) throw new Error('Museum information is missing from the response');

      const name = museumInfo.name || 'Museo Sang Bata sa Negros';
      const tagline = museumInfo.tagline || '';
      document.querySelectorAll('.brand-text .name').forEach(element => { element.textContent = name; });
      document.querySelectorAll('.brand-text .tagline').forEach(element => { element.textContent = tagline; });

      const inner = document.createElement('div');
      inner.className = 'footer-inner';
      const brand = document.createElement('div');
      brand.className = 'footer-brand';
      brand.textContent = name;
      const description = document.createElement('div');
      description.style.cssText = 'font-size:11px; color:rgba(255,255,255,0.72); margin:2px 0 10px; max-width:540px; line-height:1.4;';
      description.textContent = tagline;
      const links = document.createElement('div');
      links.className = 'footer-links';
      (museumInfo.footerLinks || []).forEach(link => {
        if (!link || !link.label || !link.href) return;
        const isInternalPath = link.href.startsWith('/') && !link.href.startsWith('//');
        const isWebUrl = /^https?:\/\//i.test(link.href);
        if (!isInternalPath && !isWebUrl) return;
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.textContent = link.label;
        links.appendChild(anchor);
      });
      const meta = document.createElement('div');
      meta.className = 'footer-meta';
      meta.textContent = [museumInfo.address, museumInfo.phone].filter(Boolean).join(' · ');
      inner.append(brand, description, links, meta);
      footer.replaceChildren(inner);
    } catch (e) {
      console.error('Footer load error:', e);
      const status = document.createElement('div');
      status.className = 'footer-inner';
      status.textContent = 'Museum information is currently unavailable.';
      footer.replaceChildren(status);
    }
  }
  
  loadFooter();
    
  // Auto-load sidebar controller script if not yet loaded
  if (!window.__MUSEO_SIDEBAR_INIT__ && !document.querySelector('script[src*="sidebar.js"]')) {
    const s = document.createElement('script');
    s.src = '/js/sidebar.js';
    document.head.appendChild(s);
  }
})();
