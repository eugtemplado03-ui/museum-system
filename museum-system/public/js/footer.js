(function(){
  const footer = document.getElementById('siteFooter') || (function(){ const f = document.createElement('footer'); f.id='siteFooter'; document.body.appendChild(f); return f; })();
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">Museo Sang Bata sa Negros</div>
      <div class="footer-links">
        <a href="/donate.html">💖 Donate</a>
        <a href="/contact.html">✉️ Contact</a>
        <a href="/about.html">ℹ️ About</a>
      </div>
      <div class="footer-meta">Barangay Old Sagay, Sagay City, Negros Occidental · +63 917 798 7420</div>
    </div>
  `;
})();
