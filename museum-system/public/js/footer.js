(function(){
  const footer = document.getElementById('siteFooter') || (function(){ const f = document.createElement('footer'); f.id='siteFooter'; document.body.appendChild(f); return f; })();
  
  async function loadFooter() {
    try {
      const res = await fetch('/api/museum-info');
      const { museumInfo } = await res.json();
      
      const linksHtml = (museumInfo.footerLinks || []).map(l => 
        `<a href="${l.href}">${l.label}</a>`
      ).join('');
      
      footer.innerHTML = `
        <div class="footer-inner">
          <div class="footer-brand">${museumInfo.name || 'Museo Sang Bata sa Negros'}</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.72); margin:2px 0 10px; max-width:540px; line-height:1.4;">${museumInfo.tagline || 'A Hands-on and Interactive Children\'s Museum.'}</div>
          <div class="footer-links">${linksHtml}</div>
          <div class="footer-meta">${museumInfo.address || ''} · ${museumInfo.phone || ''}</div>
        </div>
      `;
    } catch (e) {
      console.error('Footer load error:', e);
      footer.innerHTML = `
        <div class="footer-inner">
          <div class="footer-brand">Museo Sang Bata sa Negros</div>
          <div style="font-size:11px; color:rgba(255,255,255,0.72); margin:2px 0 10px; max-width:540px; line-height:1.4;">A Hands-on and Interactive Children's Museum. Member of the Intercontinental Museum Network, SAMP</div>
          <div class="footer-links">
            <a href="/donate.html">💖 Donate</a>
            <a href="/contact.html">✉️ Contact</a>
            <a href="/about.html">ℹ️ About</a>
          </div>
          <div class="footer-meta">Barangay Old Sagay, Sagay City, Negros Occidental · +63 917 798 7420</div>
        </div>
      `;
    }
  }
  
  loadFooter();
})();
