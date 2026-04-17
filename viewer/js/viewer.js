/**
 * FlipBook Viewer - Main Controller
 * Initializes StPageFlip, manages navigation, hotspots, and sound
 */

(function () {
    'use strict';

    // ── State ──
    let pageFlip = null;
    let flipbookData = null;
    let currentPage = 0;
    let isFullscreen = false;
    let controlsTimeout = null;
    let isLoading = true;

    // ── DOM Elements ──
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ── Initialize ──
    function init() {
        flipbookData = window.FLIPBOOK_DATA;
        if (!flipbookData || !flipbookData.pages || flipbookData.pages.length === 0) {
            showError('No flipbook data found.');
            return;
        }

        // Set page title
        document.title = flipbookData.title || 'FlipBook';

        // Set background
        document.body.style.backgroundColor = flipbookData.bgColor || '#1a1a2e';

        // Init sound
        FlipBookSounds.init(flipbookData.soundType || 'flip1');
        if (!flipbookData.soundEnabled) {
            FlipBookSounds.setEnabled(false);
            updateSoundButton();
        }

        // Load images then initialize
        preloadImages().then(() => {
            initPageFlip();
            initControls();
            initKeyboard();
            hideLoading();
        });
    }

    // ── Preload Images ──
    function preloadImages() {
        const loader = $('#loading-progress');
        let loaded = 0;
        const total = flipbookData.pages.length;

        return new Promise((resolve) => {
            if (total === 0) { resolve(); return; }

            flipbookData.pages.forEach((page, index) => {
                const img = new Image();
                img.onload = img.onerror = () => {
                    loaded++;
                    if (loader) {
                        const pct = Math.round((loaded / total) * 100);
                        loader.style.width = pct + '%';
                        loader.setAttribute('data-progress', pct + '%');
                    }
                    if (loaded >= total) resolve();
                };
                img.src = page.src;
            });
        });
    }

    // ── Initialize StPageFlip ──
    function initPageFlip() {
        const container = $('#flipbook-container');
        if (!container) return;

        const isMobile = window.innerWidth <= 768;
        const pageWidth = flipbookData.pageWidth || 800;
        const pageHeight = flipbookData.pageHeight || 1100;

        pageFlip = new St.PageFlip(container, {
            width: pageWidth,
            height: pageHeight,
            size: 'stretch',
            minWidth: 280,
            maxWidth: 1200,
            minHeight: 400,
            maxHeight: 1600,
            showCover: flipbookData.coverMode === 'hardcover',
            maxShadowOpacity: 0.5,
            mobileScrollSupport: true,
            useMouseEvents: true,
            flippingTime: 800,
            usePortrait: true,
            startZIndex: 0,
            autoSize: true,
            drawShadow: true,
            showPageCorners: !isMobile,
            swipeDistance: 30
        });

        // Load from images
        const imageSrcs = flipbookData.pages.map(p => p.src);
        pageFlip.loadFromImages(imageSrcs);

        // Events
        pageFlip.on('flip', (e) => {
            currentPage = e.data;
            FlipBookSounds.play();
            updatePageIndicator();
            updateHotspots();
        });

        pageFlip.on('changeOrientation', (e) => {
            updateHotspots();
        });

        pageFlip.on('changeState', (e) => {
            // Show controls briefly when interacting
            showControls();
        });

        pageFlip.on('init', (e) => {
            currentPage = e.data.page;
            updatePageIndicator();
            updateHotspots();
        });

        // Setup hotspot overlay
        setupHotspotOverlay();
    }

    // ── Controls ──
    function initControls() {
        // Navigation buttons
        const prevBtn = $('#btn-prev');
        const nextBtn = $('#btn-next');

        if (prevBtn) prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            pageFlip.flipPrev();
        });

        if (nextBtn) nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            pageFlip.flipNext();
        });

        // Page slider
        const slider = $('#page-slider');
        if (slider) {
            slider.max = flipbookData.totalPages - 1;
            slider.addEventListener('input', (e) => {
                const page = parseInt(e.target.value);
                pageFlip.turnToPage(page);
            });
        }

        // Sound toggle
        const soundBtn = $('#btn-sound');
        if (soundBtn) soundBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            FlipBookSounds.setEnabled(!FlipBookSounds.isEnabled());
            updateSoundButton();
        });

        // Fullscreen toggle
        const fsBtn = $('#btn-fullscreen');
        if (fsBtn) fsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFullscreen();
        });

        // Auto-hide controls
        const viewer = $('#viewer');
        if (viewer) {
            viewer.addEventListener('mousemove', showControls);
            viewer.addEventListener('touchstart', showControls, { passive: true });
        }

        // Initial auto-hide
        showControls();
    }

    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowRight':
                case 'PageDown':
                    pageFlip.flipNext();
                    break;
                case 'ArrowLeft':
                case 'PageUp':
                    pageFlip.flipPrev();
                    break;
                case 'Home':
                    pageFlip.turnToPage(0);
                    break;
                case 'End':
                    pageFlip.turnToPage(flipbookData.totalPages - 1);
                    break;
                case 'f':
                case 'F':
                    toggleFullscreen();
                    break;
                case 'm':
                case 'M':
                    FlipBookSounds.setEnabled(!FlipBookSounds.isEnabled());
                    updateSoundButton();
                    break;
                case 'Escape':
                    if (isFullscreen) toggleFullscreen();
                    closePopup();
                    break;
            }
        });
    }

    // ── UI Updates ──
    function updatePageIndicator() {
        const indicator = $('#page-indicator');
        const slider = $('#page-slider');
        const total = flipbookData.totalPages;
        
        if (indicator) {
            indicator.textContent = `${currentPage + 1} / ${total}`;
        }
        if (slider) {
            slider.value = currentPage;
        }
    }

    function updateSoundButton() {
        const btn = $('#btn-sound');
        if (!btn) return;
        const icon = btn.querySelector('.icon');
        if (icon) {
            icon.textContent = FlipBookSounds.isEnabled() ? '🔊' : '🔇';
        }
    }

    function showControls() {
        const controls = $('#controls');
        const topBar = $('#top-bar');
        if (controls) controls.classList.add('visible');
        if (topBar) topBar.classList.add('visible');

        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (controls) controls.classList.remove('visible');
            if (topBar) topBar.classList.remove('visible');
        }, 3000);
    }

    function toggleFullscreen() {
        const elem = document.documentElement;
        if (!isFullscreen) {
            if (elem.requestFullscreen) elem.requestFullscreen();
            else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
            else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
            isFullscreen = true;
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
            isFullscreen = false;
        }
        updateFullscreenButton();
    }

    function updateFullscreenButton() {
        const btn = $('#btn-fullscreen');
        if (!btn) return;
        const icon = btn.querySelector('.icon');
        if (icon) {
            icon.textContent = isFullscreen ? '⛶' : '⛶';
        }
    }

    // ── Hotspots ──
    function setupHotspotOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'hotspot-overlay';
        overlay.className = 'hotspot-overlay';
        const container = $('#flipbook-container');
        if (container) {
            container.parentElement.appendChild(overlay);
        }
    }

    function updateHotspots() {
        const overlay = $('#hotspot-overlay');
        if (!overlay) return;

        overlay.innerHTML = '';

        const pageData = flipbookData.pages[currentPage];
        if (!pageData || !pageData.hotspots || pageData.hotspots.length === 0) return;

        pageData.hotspots.forEach((hotspot) => {
            const el = document.createElement('div');
            el.className = `hotspot hotspot-${hotspot.animation_class || 'pulse'}`;
            el.style.left = hotspot.x_percent + '%';
            el.style.top = hotspot.y_percent + '%';
            el.style.width = hotspot.width_percent + '%';
            el.style.height = hotspot.height_percent + '%';

            if (hotspot.tooltip) {
                el.title = hotspot.tooltip;
            }

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                handleHotspotAction(hotspot);
            });

            overlay.appendChild(el);
        });
    }

    function handleHotspotAction(hotspot) {
        const data = hotspot.action_data || {};

        switch (hotspot.action_type) {
            case 'popup':
                showPopup(data.title || hotspot.label || '', data.content || '', data.image || '');
                break;
            case 'link':
                if (data.url) {
                    window.open(data.url, '_blank', 'noopener');
                }
                break;
            case 'zoom':
                showZoom(hotspot);
                break;
            case 'animation':
                playAnimation(hotspot);
                break;
        }
    }

    function showPopup(title, content, image) {
        let popup = $('#popup-overlay');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'popup-overlay';
            popup.className = 'popup-overlay';
            popup.innerHTML = `
                <div class="popup-content">
                    <button class="popup-close" id="popup-close">✕</button>
                    <h3 class="popup-title"></h3>
                    <div class="popup-image-container"></div>
                    <div class="popup-text"></div>
                </div>
            `;
            document.body.appendChild(popup);
            popup.addEventListener('click', (e) => {
                if (e.target === popup) closePopup();
            });
            popup.querySelector('#popup-close').addEventListener('click', closePopup);
        }

        popup.querySelector('.popup-title').textContent = title;
        popup.querySelector('.popup-text').innerHTML = content;

        const imgContainer = popup.querySelector('.popup-image-container');
        if (image) {
            imgContainer.innerHTML = `<img src="${image}" alt="${title}" class="popup-image">`;
        } else {
            imgContainer.innerHTML = '';
        }

        popup.classList.add('active');
    }

    function closePopup() {
        const popup = $('#popup-overlay');
        if (popup) popup.classList.remove('active');
    }

    function showZoom(hotspot) {
        const pageData = flipbookData.pages[currentPage];
        if (!pageData) return;

        showPopup(
            hotspot.tooltip || 'Zoom',
            '',
            pageData.src
        );
    }

    function playAnimation(hotspot) {
        const el = document.querySelector(`.hotspot[style*="left: ${hotspot.x_percent}"]`);
        if (el) {
            el.classList.add('animate-active');
            setTimeout(() => el.classList.remove('animate-active'), 1000);
        }
    }

    // ── Loading ──
    function hideLoading() {
        const loading = $('#loading-screen');
        if (loading) {
            loading.classList.add('fade-out');
            setTimeout(() => {
                loading.style.display = 'none';
                isLoading = false;
            }, 500);
        }
    }

    function showError(msg) {
        const loading = $('#loading-screen');
        if (loading) {
            loading.innerHTML = `
                <div class="loading-error">
                    <div class="error-icon">⚠️</div>
                    <p>${msg}</p>
                </div>
            `;
        }
    }

    // ── Service Worker Registration ──
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then((reg) => {
                    console.log('Service Worker registered:', reg.scope);
                })
                .catch((err) => {
                    console.warn('Service Worker registration failed:', err);
                });
        }
    }

    // ── Boot ──
    document.addEventListener('DOMContentLoaded', () => {
        registerSW();
        init();
    });

    // Handle first user interaction for audio context
    document.addEventListener('click', () => {
        const sd = window.FLIPBOOK_DATA;
        FlipBookSounds.init(sd && sd.soundType || 'flip1');
    }, { once: true });

    document.addEventListener('touchstart', () => {
        const sd = window.FLIPBOOK_DATA;
        FlipBookSounds.init(sd && sd.soundType || 'flip1');
    }, { once: true });

})();
