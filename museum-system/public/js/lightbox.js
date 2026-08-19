/**
 * Enhanced Lightbox with Next / Previous Photo Navigation and Touch Swipe
 * Displays photos in a full-screen view with Next/Prev buttons, dots, counter, swipe gestures, and zoom.
 */
document.addEventListener('DOMContentLoaded', () => {
  function createLightbox() {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <div class="lightbox-wrap" role="dialog" aria-modal="true">
        <button class="lightbox-close" aria-label="Close viewer">✕</button>
        <button class="lightbox-nav-btn prev" aria-label="Previous photo" style="display:none;">&#10094;</button>
        <button class="lightbox-nav-btn next" aria-label="Next photo" style="display:none;">&#10095;</button>
        <div class="lightbox-counter" style="display:none;"><span class="lb-cur">1</span> / <span class="lb-total">1</span></div>
        <div class="lightbox-inner">
          <img class="lightbox-img" src="" alt="" />
          <div class="lightbox-caption"></div>
          <div class="lightbox-dots"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.style.display = 'none';

    const imgEl = overlay.querySelector('.lightbox-img');
    const capEl = overlay.querySelector('.lightbox-caption');
    const dotsEl = overlay.querySelector('.lightbox-dots');
    const closeBtn = overlay.querySelector('.lightbox-close');
    const prevBtn = overlay.querySelector('.lightbox-nav-btn.prev');
    const nextBtn = overlay.querySelector('.lightbox-nav-btn.next');
    const counterEl = overlay.querySelector('.lightbox-counter');
    const curEl = overlay.querySelector('.lb-cur');
    const totalEl = overlay.querySelector('.lb-total');

    let album = [];
    let currentIndex = 0;

    function renderCurrent(animate = true) {
      if (!album.length) return;
      const item = album[currentIndex];
      imgEl.classList.remove('zoomed');
      overlay.querySelector('.lightbox-inner').style.overflow = 'hidden';

      imgEl.style.opacity = '0.3';
      imgEl.src = item.src;
      imgEl.alt = item.alt || '';
      imgEl.onload = () => { imgEl.style.opacity = '1'; };
      setTimeout(() => { imgEl.style.opacity = '1'; }, 150);

      capEl.textContent = item.caption || item.alt || '';

      const isMulti = album.length > 1;
      prevBtn.style.display = isMulti ? 'flex' : 'none';
      nextBtn.style.display = isMulti ? 'flex' : 'none';
      counterEl.style.display = isMulti ? 'block' : 'none';
      dotsEl.style.display = isMulti ? 'flex' : 'none';

      if (isMulti) {
        curEl.textContent = String(currentIndex + 1);
        totalEl.textContent = String(album.length);
        dotsEl.innerHTML = album.map((_, idx) => `
          <button type="button" class="lightbox-dot${idx === currentIndex ? ' active' : ''}" data-index="${idx}" aria-label="Go to photo ${idx + 1}"></button>
        `).join('');

        dotsEl.querySelectorAll('.lightbox-dot').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            goTo(Number(btn.dataset.index));
          });
        });
      }
    }

    function goTo(index) {
      if (!album.length) return;
      currentIndex = (index + album.length) % album.length;
      renderCurrent();
    }

    function show(items, initialIdx = 0) {
      if (typeof items === 'string') {
        album = [{ src: items, alt: '' }];
        currentIndex = 0;
      } else if (Array.isArray(items)) {
        album = items.map(it => (typeof it === 'string' ? { src: it, alt: '' } : it));
        currentIndex = Math.max(0, Math.min(initialIdx, album.length - 1));
      } else if (items && items.src) {
        album = [items];
        currentIndex = 0;
      } else {
        return;
      }

      renderCurrent(false);
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('open'), 10);
      document.body.style.overflow = 'hidden';
    }

    function hide() {
      overlay.classList.remove('open');
      setTimeout(() => {
        overlay.style.display = 'none';
        imgEl.src = '';
        album = [];
      }, 200);
      document.body.style.overflow = '';
    }

    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      goTo(currentIndex - 1);
    });

    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      goTo(currentIndex + 1);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('lightbox-wrap')) hide();
    });
    closeBtn.addEventListener('click', hide);

    document.addEventListener('keydown', (e) => {
      if (overlay.style.display !== 'flex') return;
      if (e.key === 'Escape') hide();
      else if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
      else if (e.key === 'ArrowRight') goTo(currentIndex + 1);
    });

    // Touch swipe gestures inside the lightbox viewer
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDeltaX = 0;
    let isSwiping = false;

    overlay.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || imgEl.classList.contains('zoomed')) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchDeltaX = 0;
      isSwiping = true;
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
      if (!isSwiping || e.touches.length !== 1 || imgEl.classList.contains('zoomed')) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      touchDeltaX = currentX - touchStartX;
      const deltaY = currentY - touchStartY;

      if (Math.abs(touchDeltaX) > Math.abs(deltaY) && Math.abs(touchDeltaX) > 10) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    overlay.addEventListener('touchend', () => {
      if (!isSwiping || imgEl.classList.contains('zoomed')) return;
      isSwiping = false;
      const threshold = 35;
      if (touchDeltaX < -threshold) {
        // Swiped Left -> Next photo
        goTo(currentIndex + 1);
      } else if (touchDeltaX > threshold) {
        // Swiped Right -> Previous photo
        goTo(currentIndex - 1);
      }
    }, { passive: true });

    // Toggle zoom when clicking the image
    imgEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const inner = overlay.querySelector('.lightbox-inner');
      if (imgEl.classList.contains('zoomed')) {
        imgEl.classList.remove('zoomed');
        inner.style.overflow = 'hidden';
        inner.scrollTop = 0;
        inner.scrollLeft = 0;
      } else {
        imgEl.classList.add('zoomed');
        inner.style.overflow = 'auto';
      }
    });

    return { show, hide, goTo };
  }

  const lb = createLightbox();
  window.appLightbox = lb;

  // Intercept all image clicks to open the multi-photo viewer
  document.body.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.img-link');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();

    // Look for parent container with multiple photos (carousel, card, plaque, gallery)
    const container = a.closest('.photo-carousel, .plaque-media, .content-card, .gallery-item, .multi-photo-grid') || document;
    const allLinks = Array.from(container.querySelectorAll('a.img-link'));

    if (allLinks.length > 1) {
      const items = allLinks.map(link => {
        const linkImg = link.querySelector('img');
        return {
          src: link.getAttribute('href'),
          alt: (linkImg && linkImg.alt) || link.getAttribute('title') || '',
          caption: (linkImg && linkImg.alt) || link.getAttribute('title') || ''
        };
      });
      const clickedIdx = Math.max(0, allLinks.indexOf(a));
      lb.show(items, clickedIdx);
    } else {
      const img = a.querySelector('img');
      const alt = (img && img.alt) || a.getAttribute('title') || '';
      lb.show([{ src: href, alt, caption: alt }], 0);
    }
  });
});
