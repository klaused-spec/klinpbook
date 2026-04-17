/**
 * FlipBook Builder - Preview
 * Renders a live preview using StPageFlip within the builder
 */

const Preview = (() => {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    let pageFlip = null;
    let initialized = false;

    function init(project) {
        if (!project || !project.pages || project.pages.length === 0) {
            const container = $('#preview-container');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="icon">👁</span>
                        <h3>Sem páginas para preview</h3>
                        <p>Adicione páginas na aba "Páginas" para visualizar o flipbook</p>
                    </div>
                `;
            }
            $('#preview-page-indicator').textContent = 'Sem páginas';
            return;
        }

        destroy();

        const container = $('#preview-container');
        if (!container) return;

        container.innerHTML = '';
        container.style.background = project.bg_color || '#1a1a2e';

        const pageWidth = project.page_width || 800;
        const pageHeight = project.page_height || 1100;

        try {
            pageFlip = new St.PageFlip(container, {
                width: pageWidth,
                height: pageHeight,
                size: 'stretch',
                minWidth: 200,
                maxWidth: 900,
                minHeight: 300,
                maxHeight: 1300,
                showCover: project.cover_mode === 'hardcover',
                maxShadowOpacity: 0.5,
                mobileScrollSupport: true,
                useMouseEvents: true,
                flippingTime: 800,
                usePortrait: true,
                startZIndex: 0,
                autoSize: true,
                drawShadow: true
            });

            const imageSrcs = project.pages.map(p => p.url || p.thumb_url);
            pageFlip.loadFromImages(imageSrcs);

            pageFlip.on('flip', (e) => {
                updateIndicator(e.data, project.pages.length);
            });

            pageFlip.on('init', (e) => {
                updateIndicator(e.data.page, project.pages.length);
            });

            initialized = true;

            // Bind controls
            $('#preview-prev')?.addEventListener('click', () => {
                if (pageFlip) pageFlip.flipPrev();
            });

            $('#preview-next')?.addEventListener('click', () => {
                if (pageFlip) pageFlip.flipNext();
            });

            updateIndicator(0, project.pages.length);
        } catch (err) {
            console.error('Preview init error:', err);
            container.innerHTML = `
                <div class="empty-state">
                    <span class="icon">⚠️</span>
                    <h3>Erro ao carregar preview</h3>
                    <p>${err.message}</p>
                </div>
            `;
        }
    }

    function updateIndicator(page, total) {
        const el = $('#preview-page-indicator');
        if (el) {
            el.textContent = `${page + 1} / ${total}`;
        }
    }

    function destroy() {
        if (pageFlip) {
            try {
                pageFlip.destroy();
            } catch (e) { /* ignore */ }
            pageFlip = null;
        }
        initialized = false;
    }

    return { init, destroy };
})();
