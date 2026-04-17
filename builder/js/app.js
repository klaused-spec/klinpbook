/**
 * FlipBook Builder - Main Application Controller
 * Manages state, routing, API communication, and UI coordination
 */

const App = (() => {
    'use strict';

    // ── Config ──
    const API_BASE = '../api';

    // ── State ──
    let currentView = 'dashboard';
    let currentProject = null;
    let projects = [];

    // ── Helpers ──
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ── API ──
    async function api(endpoint, options = {}) {
        const url = `${API_BASE}/${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    }

    async function apiFormData(endpoint, formData) {
        const url = `${API_BASE}/${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
            return data;
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    }

    // ── Toast Notifications ──
    function toast(message, type = 'info') {
        const container = $('#toast-container');
        const t = document.createElement('div');
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

        t.className = `toast ${type}`;
        t.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;
        container.appendChild(t);

        setTimeout(() => {
            t.classList.add('toast-fade-out');
            setTimeout(() => t.remove(), 300);
        }, 4000);
    }

    // ── Confirm Dialog ──
    function confirm(title, message) {
        return new Promise((resolve) => {
            const modal = $('#modal-confirm');
            $('#confirm-title').textContent = title;
            $('#confirm-message').textContent = message;
            modal.classList.add('active');

            const cleanup = () => {
                modal.classList.remove('active');
                $('#btn-confirm-ok').removeEventListener('click', onOk);
                $('#btn-confirm-cancel').removeEventListener('click', onCancel);
                $('#modal-close-confirm').removeEventListener('click', onCancel);
            };

            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };

            $('#btn-confirm-ok').addEventListener('click', onOk);
            $('#btn-confirm-cancel').addEventListener('click', onCancel);
            $('#modal-close-confirm').addEventListener('click', onCancel);
        });
    }

    // ── Views ──
    function showView(view) {
        currentView = view;

        if (view === 'dashboard') {
            $('#view-dashboard').style.display = '';
            $('#view-editor').style.display = 'none';
            loadProjects();
        } else if (view === 'editor') {
            $('#view-dashboard').style.display = 'none';
            $('#view-editor').style.display = '';
        }

        // Update nav
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        $(`[data-view="${view}"]`)?.classList.add('active');
    }

    // ── Dashboard ──
    async function loadProjects() {
        try {
            projects = await api('projects.php');
            renderProjects();
        } catch (err) {
            toast('Erro ao carregar projetos', 'error');
        }
    }

    function renderProjects() {
        const grid = $('#projects-grid');
        
        let html = `
            <div class="card card-new" id="card-new-project">
                <div class="plus-icon">+</div>
                <span>Novo Flipbook</span>
            </div>
        `;

        for (const project of projects) {
            const coverImg = project.cover_url
                ? `<img src="${project.cover_url}" alt="${project.title}" loading="lazy">`
                : `<div class="placeholder">📖</div>`;

            const statusClass = project.status === 'published' ? 'published' : 'draft';
            const statusText = project.status === 'published' ? 'Publicado' : 'Rascunho';
            const pageCount = project.page_count || 0;

            html += `
                <div class="card" data-project-id="${project.id}">
                    <div class="card-cover">
                        ${coverImg}
                        <span class="card-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="card-body">
                        <h3 class="card-title">${escapeHtml(project.title)}</h3>
                        <div class="card-meta">
                            <span>📄 ${pageCount} páginas</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sm btn-primary btn-edit-project" data-id="${project.id}">Editar</button>
                        <button class="btn btn-sm btn-danger btn-delete-project" data-id="${project.id}">🗑</button>
                    </div>
                </div>
            `;
        }

        grid.innerHTML = html;

        // Bind events
        $('#card-new-project')?.addEventListener('click', openNewProjectModal);

        $$('.btn-edit-project').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openProject(parseInt(btn.dataset.id));
            });
        });

        $$('.btn-delete-project').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const confirmed = await confirm('Excluir Flipbook', 'Tem certeza? Esta ação não pode ser desfeita.');
                if (confirmed) {
                    try {
                        await api(`projects.php?id=${id}`, { method: 'DELETE' });
                        toast('Flipbook excluído', 'success');
                        loadProjects();
                    } catch (err) {
                        toast('Erro ao excluir', 'error');
                    }
                }
            });
        });

        // Card click to open
        $$('.card[data-project-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-actions')) return;
                openProject(parseInt(card.dataset.projectId));
            });
        });
    }

    // ── Project CRUD ──
    function openNewProjectModal() {
        $('#project-title').value = '';
        $('#project-description').value = '';
        $('#project-cover-mode').value = 'hardcover';
        $('#project-bg-color').value = '#1a1a2e';
        $('#project-bg-color-text').value = '#1a1a2e';
        $('#modal-new-project').classList.add('active');
        setTimeout(() => $('#project-title').focus(), 100);
    }

    async function createProject() {
        const title = $('#project-title').value.trim();
        if (!title) {
            toast('Título é obrigatório', 'warning');
            return;
        }

        try {
            const project = await api('projects.php', {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    description: $('#project-description').value.trim(),
                    cover_mode: $('#project-cover-mode').value,
                    bg_color: $('#project-bg-color').value
                })
            });

            $('#modal-new-project').classList.remove('active');
            toast('Flipbook criado!', 'success');
            openProject(project.id);
        } catch (err) {
            toast('Erro ao criar flipbook', 'error');
        }
    }

    async function openProject(id) {
        try {
            currentProject = await api(`projects.php?id=${id}`);
            $('#editor-title').textContent = currentProject.title;
            showView('editor');

            // Initialize editor modules
            PageManager.init(currentProject);
            HotspotEditor.init(currentProject);
            Preview.destroy(); // Reset preview

            // Switch to pages tab
            switchTab('pages');
        } catch (err) {
            toast('Erro ao abrir projeto', 'error');
        }
    }

    async function refreshProject() {
        if (!currentProject) return;
        try {
            currentProject = await api(`projects.php?id=${currentProject.id}`);
            PageManager.update(currentProject);
            HotspotEditor.update(currentProject);
        } catch (err) {
            console.error('Failed to refresh project:', err);
        }
    }

    // ── Editor Tabs ──
    function switchTab(tab) {
        $$('.editor-tab').forEach(t => t.classList.remove('active'));
        $$('.editor-panel').forEach(p => p.classList.remove('active'));

        $(`.editor-tab[data-tab="${tab}"]`).classList.add('active');
        $(`#panel-${tab}`).classList.add('active');

        if (tab === 'preview') {
            Preview.init(currentProject);
        }
    }

    // ── Publish ──
    async function publishProject() {
        if (!currentProject) return;

        if (!currentProject.pages || currentProject.pages.length === 0) {
            toast('Adicione páginas antes de publicar', 'warning');
            return;
        }

        try {
            toast('Publicando...', 'info');
            const result = await api('publish.php', {
                method: 'POST',
                body: JSON.stringify({ project_id: currentProject.id })
            });

            toast('Flipbook publicado com sucesso! 🎉', 'success');

            // Show URL
            if (result.url) {
                setTimeout(() => {
                    toast(`URL: ${result.url}`, 'info');
                }, 500);
            }

            refreshProject();
        } catch (err) {
            toast('Erro ao publicar: ' + err.message, 'error');
        }
    }

    async function exportProject() {
        if (!currentProject) return;

        if (currentProject.status !== 'published') {
            toast('Publique o flipbook antes de exportar', 'warning');
            return;
        }

        try {
            toast('Gerando ZIP...', 'info');
            window.open(`${API_BASE}/export.php?id=${currentProject.id}`, '_blank');
            toast('Download iniciado!', 'success');
        } catch (err) {
            toast('Erro ao exportar', 'error');
        }
    }

    // ── Settings ──
    function openSettings() {
        if (!currentProject) return;

        $('#settings-title').value = currentProject.title;
        $('#settings-description').value = currentProject.description || '';
        $('#settings-cover-mode').value = currentProject.cover_mode;
        $('#settings-bg-color').value = currentProject.bg_color;
        $('#settings-bg-color-text').value = currentProject.bg_color;
        $('#settings-sound').value = currentProject.sound_enabled ? '1' : '0';
        $('#modal-settings').classList.add('active');
    }

    async function saveSettings() {
        if (!currentProject) return;

        try {
            await api('projects.php', {
                method: 'PUT',
                body: JSON.stringify({
                    id: currentProject.id,
                    title: $('#settings-title').value.trim(),
                    description: $('#settings-description').value.trim(),
                    cover_mode: $('#settings-cover-mode').value,
                    bg_color: $('#settings-bg-color').value,
                    sound_enabled: parseInt($('#settings-sound').value)
                })
            });

            $('#modal-settings').classList.remove('active');
            toast('Configurações salvas', 'success');
            refreshProject();
            $('#editor-title').textContent = $('#settings-title').value.trim();
        } catch (err) {
            toast('Erro ao salvar configurações', 'error');
        }
    }

    // ── Utilities ──
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Event Bindings ──
    function bindEvents() {
        // Navigation
        $('#nav-dashboard').addEventListener('click', () => showView('dashboard'));
        $('#btn-back').addEventListener('click', () => showView('dashboard'));

        // New project
        $('#btn-new-project').addEventListener('click', openNewProjectModal);
        $('#btn-create-project').addEventListener('click', createProject);
        $('#btn-cancel-new').addEventListener('click', () => $('#modal-new-project').classList.remove('active'));
        $('#modal-close-new').addEventListener('click', () => $('#modal-new-project').classList.remove('active'));

        // Enter key on title
        $('#project-title').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') createProject();
        });

        // Editor tabs
        $$('.editor-tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Publish & Export
        $('#btn-publish').addEventListener('click', publishProject);
        $('#btn-export').addEventListener('click', exportProject);

        // Settings
        $('#btn-settings').addEventListener('click', openSettings);
        $('#btn-save-settings').addEventListener('click', saveSettings);
        $('#btn-cancel-settings').addEventListener('click', () => $('#modal-settings').classList.remove('active'));
        $('#modal-close-settings').addEventListener('click', () => $('#modal-settings').classList.remove('active'));

        // Color sync
        $('#project-bg-color').addEventListener('input', (e) => {
            $('#project-bg-color-text').value = e.target.value;
        });
        $('#project-bg-color-text').addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                $('#project-bg-color').value = e.target.value;
            }
        });
        $('#settings-bg-color').addEventListener('input', (e) => {
            $('#settings-bg-color-text').value = e.target.value;
        });
        $('#settings-bg-color-text').addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                $('#settings-bg-color').value = e.target.value;
            }
        });

        // Mobile menu
        $('#mobile-menu-btn').addEventListener('click', () => {
            $('#sidebar').classList.toggle('open');
            $('#sidebar-overlay').classList.toggle('active');
        });
        $('#sidebar-overlay').addEventListener('click', () => {
            $('#sidebar').classList.remove('open');
            $('#sidebar-overlay').classList.remove('active');
        });

        // Close modals on overlay click
        $$('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        });
    }

    // ── Init ──
    function init() {
        bindEvents();
        showView('dashboard');
    }

    document.addEventListener('DOMContentLoaded', init);

    // Public API
    return {
        api,
        apiFormData,
        toast,
        confirm,
        refreshProject,
        getCurrentProject: () => currentProject,
        escapeHtml
    };
})();
