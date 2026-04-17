/**
 * FlipBook Builder - Hotspot Editor
 * Visual editor for placing and configuring interactive hotspots on pages
 */

const HotspotEditor = (() => {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    let project = null;
    let currentPageIndex = 0;
    let hotspots = [];
    let selectedHotspot = null;
    let isDrawing = false;
    let drawStart = null;

    function init(proj) {
        project = proj;
        currentPageIndex = 0;
        selectedHotspot = null;
        bindEvents();
        renderPage();
    }

    function update(proj) {
        project = proj;
        renderPage();
    }

    function bindEvents() {
        // Page navigation
        $('#hs-prev')?.addEventListener('click', () => {
            if (currentPageIndex > 0) {
                currentPageIndex--;
                renderPage();
            }
        });

        $('#hs-next')?.addEventListener('click', () => {
            if (project && project.pages && currentPageIndex < project.pages.length - 1) {
                currentPageIndex++;
                renderPage();
            }
        });

        // Add hotspot button
        $('#btn-add-hotspot')?.addEventListener('click', startDrawing);

        // Save hotspot
        $('#btn-save-hotspot')?.addEventListener('click', saveHotspot);
        $('#btn-cancel-hotspot')?.addEventListener('click', cancelEdit);
        $('#btn-delete-hotspot')?.addEventListener('click', deleteHotspot);

        // Action type change
        $('#hs-action-type')?.addEventListener('change', (e) => {
            updateFormFields(e.target.value);
        });

        // Canvas drawing events
        const canvas = $('#hotspot-canvas');
        if (canvas) {
            canvas.addEventListener('mousedown', onCanvasMouseDown);
            canvas.addEventListener('mousemove', onCanvasMouseMove);
            canvas.addEventListener('mouseup', onCanvasMouseUp);
        }
    }

    function renderPage() {
        if (!project || !project.pages || project.pages.length === 0) {
            $('#hotspot-canvas').innerHTML = '<div class="empty-state"><span class="icon">📄</span><h3>Sem páginas</h3><p>Adicione páginas na aba "Páginas" primeiro</p></div>';
            $('#hs-page-indicator').textContent = 'Sem páginas';
            return;
        }

        const page = project.pages[currentPageIndex];
        if (!page) return;

        const img = $('#hotspot-page-image');
        if (img) {
            img.src = page.url || page.thumb_url;
            img.alt = `Página ${currentPageIndex + 1}`;
        }

        $('#hs-page-indicator').textContent = `Página ${currentPageIndex + 1} de ${project.pages.length}`;

        // Load hotspots for this page
        hotspots = page.hotspots || [];
        renderHotspots();
        renderHotspotList();
        hideForm();
    }

    function renderHotspots() {
        // Remove existing hotspot rects
        $$('.hotspot-rect').forEach(el => el.remove());

        const canvas = $('#hotspot-canvas');
        if (!canvas) return;

        hotspots.forEach((hs, index) => {
            const rect = document.createElement('div');
            rect.className = `hotspot-rect ${selectedHotspot && selectedHotspot.id === hs.id ? 'selected' : ''}`;
            rect.style.left = hs.x_percent + '%';
            rect.style.top = hs.y_percent + '%';
            rect.style.width = hs.width_percent + '%';
            rect.style.height = hs.height_percent + '%';

            if (hs.label) {
                rect.innerHTML = `<span class="hotspot-label">${App.escapeHtml(hs.label)}</span>`;
            }

            rect.addEventListener('click', (e) => {
                e.stopPropagation();
                selectHotspot(hs);
            });

            canvas.appendChild(rect);
        });
    }

    function renderHotspotList() {
        const list = $('#hotspot-list');
        if (!list) return;

        if (hotspots.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:1rem">Nenhum hotspot nesta página.<br>Clique em "Adicionar" para criar um.</p>';
            return;
        }

        let html = '';
        hotspots.forEach((hs) => {
            const types = { popup: '💬', link: '🔗', zoom: '🔍', animation: '✨' };
            const isActive = selectedHotspot && selectedHotspot.id === hs.id;
            html += `
                <div class="hotspot-list-item ${isActive ? 'active' : ''}" data-hotspot-id="${hs.id}">
                    <span>${types[hs.action_type] || '•'} ${App.escapeHtml(hs.label || hs.tooltip || `Hotspot #${hs.id}`)}</span>
                    <span style="font-size:0.75rem;color:var(--text-muted)">${hs.action_type}</span>
                </div>
            `;
        });

        list.innerHTML = html;

        // Bind click on list items
        $$('.hotspot-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.hotspotId);
                const hs = hotspots.find(h => h.id === id);
                if (hs) selectHotspot(hs);
            });
        });
    }

    function selectHotspot(hs) {
        selectedHotspot = hs;
        renderHotspots();
        renderHotspotList();
        showForm(hs);
    }

    // ── Drawing ──
    function startDrawing() {
        isDrawing = true;
        drawStart = null;
        App.toast('Clique e arraste sobre a página para criar um hotspot', 'info');

        const canvas = $('#hotspot-canvas');
        if (canvas) canvas.style.cursor = 'crosshair';
    }

    function onCanvasMouseDown(e) {
        if (!isDrawing) return;
        e.preventDefault();

        const canvas = $('#hotspot-canvas');
        const rect = canvas.getBoundingClientRect();
        drawStart = {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100
        };

        // Create preview rect
        let preview = canvas.querySelector('.hotspot-drawing');
        if (!preview) {
            preview = document.createElement('div');
            preview.className = 'hotspot-rect hotspot-drawing';
            canvas.appendChild(preview);
        }
        preview.style.left = drawStart.x + '%';
        preview.style.top = drawStart.y + '%';
        preview.style.width = '0%';
        preview.style.height = '0%';
    }

    function onCanvasMouseMove(e) {
        if (!isDrawing || !drawStart) return;

        const canvas = $('#hotspot-canvas');
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const preview = canvas.querySelector('.hotspot-drawing');
        if (preview) {
            const left = Math.min(drawStart.x, x);
            const top = Math.min(drawStart.y, y);
            const width = Math.abs(x - drawStart.x);
            const height = Math.abs(y - drawStart.y);

            preview.style.left = left + '%';
            preview.style.top = top + '%';
            preview.style.width = width + '%';
            preview.style.height = height + '%';
        }
    }

    async function onCanvasMouseUp(e) {
        if (!isDrawing || !drawStart) return;

        const canvas = $('#hotspot-canvas');
        const rect = canvas.getBoundingClientRect();
        const endX = ((e.clientX - rect.left) / rect.width) * 100;
        const endY = ((e.clientY - rect.top) / rect.height) * 100;

        // Remove preview
        canvas.querySelector('.hotspot-drawing')?.remove();
        canvas.style.cursor = '';
        isDrawing = false;

        const left = Math.min(drawStart.x, endX);
        const top = Math.min(drawStart.y, endY);
        const width = Math.abs(endX - drawStart.x);
        const height = Math.abs(endY - drawStart.y);

        // Minimum size check
        if (width < 2 || height < 2) {
            drawStart = null;
            return;
        }

        drawStart = null;

        // Get current page
        const page = project.pages[currentPageIndex];
        if (!page) return;

        // Create hotspot via API
        try {
            const newHotspot = await App.api('hotspots.php', {
                method: 'POST',
                body: JSON.stringify({
                    page_id: page.id,
                    x_percent: Math.round(left * 100) / 100,
                    y_percent: Math.round(top * 100) / 100,
                    width_percent: Math.round(width * 100) / 100,
                    height_percent: Math.round(height * 100) / 100,
                    action_type: 'popup',
                    label: 'Novo Hotspot',
                    animation_class: 'pulse'
                })
            });

            hotspots.push(newHotspot);

            // Also update project data
            if (project.pages[currentPageIndex].hotspots) {
                project.pages[currentPageIndex].hotspots.push(newHotspot);
            } else {
                project.pages[currentPageIndex].hotspots = [newHotspot];
            }

            selectHotspot(newHotspot);
            App.toast('Hotspot criado! Configure-o no painel lateral.', 'success');
        } catch (err) {
            App.toast('Erro ao criar hotspot', 'error');
        }
    }

    // ── Form ──
    function showForm(hs) {
        const form = $('#hotspot-form');
        if (!form) return;

        form.style.display = '';

        $('#hs-label').value = hs.label || '';
        $('#hs-action-type').value = hs.action_type || 'popup';
        $('#hs-animation').value = hs.animation_class || 'pulse';
        $('#hs-tooltip').value = hs.tooltip || '';

        const data = hs.action_data || {};
        $('#hs-popup-title').value = data.title || '';
        $('#hs-popup-content').value = data.content || '';
        $('#hs-link-url').value = data.url || '';

        updateFormFields(hs.action_type || 'popup');
    }

    function hideForm() {
        const form = $('#hotspot-form');
        if (form) form.style.display = 'none';
        selectedHotspot = null;
    }

    function updateFormFields(actionType) {
        $('#hs-popup-fields').style.display = actionType === 'popup' ? '' : 'none';
        $('#hs-link-fields').style.display = actionType === 'link' ? '' : 'none';
    }

    async function saveHotspot() {
        if (!selectedHotspot) return;

        const actionType = $('#hs-action-type').value;
        let actionData = {};

        if (actionType === 'popup') {
            actionData = {
                title: $('#hs-popup-title').value,
                content: $('#hs-popup-content').value
            };
        } else if (actionType === 'link') {
            actionData = { url: $('#hs-link-url').value };
        }

        try {
            await App.api('hotspots.php', {
                method: 'PUT',
                body: JSON.stringify({
                    id: selectedHotspot.id,
                    label: $('#hs-label').value,
                    action_type: actionType,
                    action_data: actionData,
                    animation_class: $('#hs-animation').value,
                    tooltip: $('#hs-tooltip').value
                })
            });

            App.toast('Hotspot salvo', 'success');
            App.refreshProject();
        } catch (err) {
            App.toast('Erro ao salvar hotspot', 'error');
        }
    }

    function cancelEdit() {
        hideForm();
        selectedHotspot = null;
        renderHotspots();
        renderHotspotList();
    }

    async function deleteHotspot() {
        if (!selectedHotspot) return;

        const confirmed = await App.confirm('Excluir Hotspot', 'Excluir este hotspot?');
        if (!confirmed) return;

        try {
            await App.api(`hotspots.php?id=${selectedHotspot.id}`, { method: 'DELETE' });
            App.toast('Hotspot excluído', 'success');
            hideForm();
            App.refreshProject();
        } catch (err) {
            App.toast('Erro ao excluir', 'error');
        }
    }

    return { init, update };
})();
