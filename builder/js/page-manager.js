/**
 * FlipBook Builder - Page Manager
 * Handles page grid rendering, drag & drop reordering, page type toggling, deletion
 */

const PageManager = (() => {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    let project = null;
    let sortable = null;
    let selectedPages = new Set();

    function init(proj) {
        project = proj;
        render();
        initSortable();
        bindEvents();
    }

    function update(proj) {
        project = proj;
        render();
        initSortable();
    }

    function render() {
        const grid = $('#pages-grid');
        const countEl = $('#page-count');
        
        if (!project || !project.pages) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <span class="icon">📄</span>
                    <h3>Nenhuma página</h3>
                    <p>Arraste imagens para a área acima para adicionar páginas ao flipbook</p>
                </div>
            `;
            if (countEl) countEl.textContent = '0';
            return;
        }

        const pages = project.pages;
        if (countEl) countEl.textContent = pages.length.toString();

        let html = '';
        pages.forEach((page, index) => {
            const isSelected = selectedPages.has(page.id);
            const typeClass = page.page_type || 'soft';
            const typeLabel = typeClass === 'hard' ? 'HARD' : 'SOFT';

            html += `
                <div class="page-thumb ${isSelected ? 'selected' : ''}" data-page-id="${page.id}" data-index="${index}">
                    <img src="${page.thumb_url || page.url}" alt="Página ${index + 1}" loading="lazy">
                    <div class="page-number">
                        <span>${index + 1}</span>
                        <span class="page-type-badge ${typeClass}">${typeLabel}</span>
                    </div>
                    <div class="page-actions">
                        <button class="page-action-btn type-toggle" data-page-id="${page.id}" data-current-type="${typeClass}" title="Alternar tipo">
                            ${typeClass === 'hard' ? '📋' : '📕'}
                        </button>
                        <button class="page-action-btn delete-page" data-page-id="${page.id}" title="Excluir">🗑</button>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
        bindPageEvents();
        updateDeleteButton();
    }

    function initSortable() {
        const grid = $('#pages-grid');
        if (!grid) return;

        if (sortable) {
            sortable.destroy();
        }

        sortable = new Sortable(grid, {
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            filter: '.empty-state',
            onEnd: async (evt) => {
                if (evt.oldIndex === evt.newIndex) return;

                // Get new order
                const items = grid.querySelectorAll('.page-thumb');
                const pageIds = Array.from(items).map(el => parseInt(el.dataset.pageId));

                try {
                    await App.api('pages.php?reorder=1', {
                        method: 'PUT',
                        body: JSON.stringify({
                            project_id: project.id,
                            pages: pageIds
                        })
                    });

                    App.toast('Páginas reordenadas', 'success');
                    App.refreshProject();
                } catch (err) {
                    App.toast('Erro ao reordenar', 'error');
                    render(); // Revert
                }
            }
        });
    }

    function bindEvents() {
        $('#btn-select-all')?.addEventListener('click', () => {
            if (!project || !project.pages) return;

            if (selectedPages.size === project.pages.length) {
                selectedPages.clear();
            } else {
                project.pages.forEach(p => selectedPages.add(p.id));
            }
            render();
        });

        $('#btn-delete-selected')?.addEventListener('click', async () => {
            if (selectedPages.size === 0) return;

            const confirmed = await App.confirm(
                'Excluir Páginas',
                `Excluir ${selectedPages.size} página(s) selecionada(s)?`
            );

            if (confirmed) {
                try {
                    for (const pageId of selectedPages) {
                        await App.api(`pages.php?id=${pageId}`, { method: 'DELETE' });
                    }
                    selectedPages.clear();
                    App.toast('Páginas excluídas', 'success');
                    App.refreshProject();
                } catch (err) {
                    App.toast('Erro ao excluir páginas', 'error');
                }
            }
        });
    }

    function bindPageEvents() {
        // Toggle selection on click
        $$('.page-thumb').forEach(thumb => {
            thumb.addEventListener('click', (e) => {
                if (e.target.closest('.page-actions')) return;
                const id = parseInt(thumb.dataset.pageId);
                if (selectedPages.has(id)) {
                    selectedPages.delete(id);
                } else {
                    selectedPages.add(id);
                }
                thumb.classList.toggle('selected');
                updateDeleteButton();
            });
        });

        // Type toggle
        $$('.type-toggle').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const pageId = parseInt(btn.dataset.pageId);
                const currentType = btn.dataset.currentType;
                const newType = currentType === 'soft' ? 'hard' : 'soft';

                try {
                    await App.api('pages.php', {
                        method: 'PUT',
                        body: JSON.stringify({ id: pageId, page_type: newType })
                    });
                    App.refreshProject();
                } catch (err) {
                    App.toast('Erro ao alterar tipo', 'error');
                }
            });
        });

        // Delete page
        $$('.delete-page').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const pageId = parseInt(btn.dataset.pageId);

                const confirmed = await App.confirm('Excluir Página', 'Excluir esta página?');
                if (confirmed) {
                    try {
                        await App.api(`pages.php?id=${pageId}`, { method: 'DELETE' });
                        selectedPages.delete(pageId);
                        App.toast('Página excluída', 'success');
                        App.refreshProject();
                    } catch (err) {
                        App.toast('Erro ao excluir página', 'error');
                    }
                }
            });
        });
    }

    function updateDeleteButton() {
        const btn = $('#btn-delete-selected');
        if (btn) {
            btn.style.display = selectedPages.size > 0 ? '' : 'none';
        }
    }

    return { init, update, render };
})();
