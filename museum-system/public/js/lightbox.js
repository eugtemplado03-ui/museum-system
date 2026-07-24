document.addEventListener('DOMContentLoaded', () => {
  function createLightbox(){
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <div class="lightbox-wrap" role="dialog" aria-modal="true">
        <button class="lightbox-close" aria-label="Close">✕</button>
        <div class="lightbox-inner">
          <img class="lightbox-img" src="" alt="" />
          <div class="lightbox-caption"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.style.display = 'none';

    const imgEl = overlay.querySelector('.lightbox-img');
    const capEl = overlay.querySelector('.lightbox-caption');
    const closeBtn = overlay.querySelector('.lightbox-close');

    function show(src, alt){
      imgEl.src = src;
      imgEl.alt = alt || '';
      capEl.textContent = alt || '';
      imgEl.classList.remove('zoomed');
      overlay.querySelector('.lightbox-inner').style.overflow = 'hidden';
      overlay.style.display = 'flex';
      setTimeout(()=> overlay.classList.add('open'), 10);
      document.body.style.overflow = 'hidden';
    }
    function hide(){
      overlay.classList.remove('open');
      setTimeout(()=>{ overlay.style.display = 'none'; imgEl.src = ''; }, 200);
      document.body.style.overflow = '';
    }

    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) hide(); });
    closeBtn.addEventListener('click', hide);
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') hide(); });

    // Toggle zoom when clicking the image: fit-to-viewport <-> zoomed (natural size / larger)
    imgEl.addEventListener('click', (e)=>{
      e.stopPropagation();
      const inner = overlay.querySelector('.lightbox-inner');
      if(imgEl.classList.contains('zoomed')){
        imgEl.classList.remove('zoomed');
        inner.style.overflow = 'hidden';
        // reset scroll position
        inner.scrollTop = 0; inner.scrollLeft = 0;
      } else {
        imgEl.classList.add('zoomed');
        inner.style.overflow = 'auto';
      }
    });

    return { show, hide };
  }

  const lb = createLightbox();

  document.body.addEventListener('click', (e)=>{
    const a = e.target.closest && e.target.closest('a.img-link');
    if(!a) return;
    const href = a.getAttribute('href');
    if(!href) return;
    e.preventDefault();
    const img = a.querySelector('img');
    const alt = (img && img.alt) || a.getAttribute('title') || '';
    lb.show(href, alt);
  });
});
