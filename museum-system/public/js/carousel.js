/**
 * Touch-enabled Photo Carousel & Media Player Component
 * Supports Photos (Carousel with Next/Prev click navigation, dot pagination, slide counter, and touch swiping)
 * and Videos (YouTube, Vimeo, MP4, WebM embedded players).
 */
(function() {
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  /**
   * Parses video URLs and extracts embed format.
   * Supports YouTube, Vimeo, and direct video files.
   */
  window.parseVideoUrl = function(url) {
    if (!url || typeof url !== 'string') return null;
    const clean = url.trim();
    if (!clean) return null;

    // YouTube regex
    const ytMatch = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return {
        type: 'youtube',
        id: ytMatch[1],
        embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&playsinline=1`
      };
    }

    // Vimeo regex
    const vimeoMatch = clean.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i);
    if (vimeoMatch && vimeoMatch[3]) {
      return {
        type: 'vimeo',
        id: vimeoMatch[3],
        embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}?title=0&byline=0&portrait=0`
      };
    }

    // Direct uploaded or hosted video file
    return {
      type: 'direct',
      url: clean
    };
  };

  /**
   * Renders a responsive video player.
   */
  window.renderVideoPlayer = function(videoUrl, title, customClass) {
    const video = window.parseVideoUrl(videoUrl);
    if (!video) return '';
    const safeTitle = escapeHtml(title || 'Video');
    const extraClass = customClass ? ' ' + customClass : '';

    if (video.type === 'youtube' || video.type === 'vimeo') {
      return `
        <div class="video-container${extraClass}">
          <iframe
            src="${escapeHtml(video.embedUrl)}"
            title="${safeTitle}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            loading="lazy"
          ></iframe>
        </div>`;
    }

    return `
      <div class="video-container direct-video${extraClass}">
        <video src="${escapeHtml(video.url)}" controls playsinline preload="metadata" title="${safeTitle}">
          Your browser does not support the video tag.
        </video>
      </div>`;
  };

  /**
   * Helper to generate carousel HTML for any array of image URLs.
   */
  window.renderPhotoCarousel = function(images, title, fallbackIcon, customClass) {
    const rawPaths = Array.isArray(images) ? images : (images ? [images] : []);
    const paths = rawPaths.map(p => String(p || '').trim()).filter(Boolean);
    const safeTitle = escapeHtml(title || 'Photo');
    const extraClass = customClass ? ' ' + customClass : '';

    if (paths.length === 0) {
      return `
        <div class="photo-carousel empty${extraClass}">
          <div class="placeholder-icon">${fallbackIcon || '📷'}</div>
        </div>`;
    }

    if (paths.length === 1) {
      const src = escapeHtml(paths[0]);
      return `
        <div class="photo-carousel single${extraClass}">
          <div class="carousel-viewport">
            <div class="carousel-slide active">
              <a class="img-link" href="${src}" target="_blank" rel="noopener">
                <img class="img-enhance" src="${src}" alt="${safeTitle}" loading="lazy">
              </a>
            </div>
          </div>
        </div>`;
    }

    const slidesHtml = paths.map((src, idx) => `
      <div class="carousel-slide" data-index="${idx}">
        <a class="img-link" href="${escapeHtml(src)}" target="_blank" rel="noopener">
          <img class="img-enhance" src="${escapeHtml(src)}" alt="${safeTitle} (Photo ${idx + 1})" loading="lazy">
        </a>
      </div>
    `).join('');

    const dotsHtml = paths.map((_, idx) => `
      <button type="button" class="carousel-dot${idx === 0 ? ' active' : ''}" data-index="${idx}" aria-label="Go to slide ${idx + 1}"></button>
    `).join('');

    return `
      <div class="photo-carousel multiple${extraClass}" data-slide="0" data-total="${paths.length}">
        <div class="carousel-viewport">
          <div class="carousel-track">${slidesHtml}</div>
          <button type="button" class="carousel-btn prev" aria-label="Previous photo">&#10094;</button>
          <button type="button" class="carousel-btn next" aria-label="Next photo">&#10095;</button>
          <div class="carousel-badge"><span class="current">1</span> / ${paths.length}</div>
          <div class="carousel-dots">${dotsHtml}</div>
        </div>
      </div>`;
  };

  /**
   * Renders unified media (video player OR photo carousel).
   */
  window.renderMediaBox = function(images, videoUrl, title, fallbackIcon, customClass) {
    const rawPaths = Array.isArray(images) ? images : (images ? [images] : []);
    const paths = rawPaths.map(p => String(p || '').trim()).filter(Boolean);
    const hasVideo = Boolean(videoUrl && String(videoUrl).trim());

    if (hasVideo) {
      return window.renderVideoPlayer(videoUrl, title, customClass);
    }
    return window.renderPhotoCarousel(paths, title, fallbackIcon, customClass);
  };

  /**
   * Initializes all `.photo-carousel.multiple` elements in the DOM.
   * Attaches touch swipe listeners, click controls, and animations.
   */
  window.initPhotoCarousels = function(root) {
    const container = root || document;
    const carousels = container.querySelectorAll('.photo-carousel.multiple');

    carousels.forEach(carousel => {
      if (carousel._carouselInitialized) return;
      carousel._carouselInitialized = true;

      const track = carousel.querySelector('.carousel-track');
      const prevBtn = carousel.querySelector('.carousel-btn.prev');
      const nextBtn = carousel.querySelector('.carousel-btn.next');
      const dots = carousel.querySelectorAll('.carousel-dot');
      const currentLabel = carousel.querySelector('.carousel-badge .current');
      const total = parseInt(carousel.dataset.total, 10) || 1;
      let currentIndex = 0;

      function updateSlide(index, animate = true) {
        currentIndex = (index + total) % total;
        carousel.dataset.slide = currentIndex;

        if (track) {
          track.style.transition = animate ? 'transform 0.32s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
          track.style.transform = `translateX(-${currentIndex * 100}%)`;
        }

        if (currentLabel) {
          currentLabel.textContent = String(currentIndex + 1);
        }

        dots.forEach((dot, idx) => {
          dot.classList.toggle('active', idx === currentIndex);
        });
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          updateSlide(currentIndex - 1);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          updateSlide(currentIndex + 1);
        });
      }

      dots.forEach((dot, idx) => {
        dot.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          updateSlide(idx);
        });
      });

      // Touch swipe gestures
      let touchStartX = 0;
      let touchStartY = 0;
      let touchDeltaX = 0;
      let isSwiping = false;

      carousel.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchDeltaX = 0;
        isSwiping = true;
      }, { passive: true });

      carousel.addEventListener('touchmove', (e) => {
        if (!isSwiping || e.touches.length !== 1) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        touchDeltaX = currentX - touchStartX;
        const deltaY = currentY - touchStartY;

        if (Math.abs(touchDeltaX) > Math.abs(deltaY) && Math.abs(touchDeltaX) > 10) {
          if (e.cancelable) e.preventDefault();
        }
      }, { passive: false });

      carousel.addEventListener('touchend', () => {
        if (!isSwiping) return;
        isSwiping = false;
        const swipeThreshold = 35;

        if (touchDeltaX < -swipeThreshold) {
          updateSlide(currentIndex + 1);
        } else if (touchDeltaX > swipeThreshold) {
          updateSlide(currentIndex - 1);
        }
      }, { passive: true });

      // Initialize initial state
      updateSlide(0, false);
    });
  };

  // Auto-init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    window.initPhotoCarousels();
  });
})();
