/**
 * FlipBook Builder - File Uploader
 * Handles drag & drop + click-to-upload with progress
 */

const Uploader = (() => {
    'use strict';

    const $ = (sel) => document.querySelector(sel);

    function init() {
        const area = $('#upload-area');
        const input = $('#file-input');
        if (!area || !input) return;

        // Click to upload
        area.addEventListener('click', (e) => {
            if (e.target !== input) input.click();
        });

        // File selected
        input.addEventListener('change', () => {
            if (input.files.length > 0) {
                uploadFiles(input.files);
                input.value = ''; // Reset
            }
        });

        // Drag and drop
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });

        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadFiles(files);
            }
        });
    }

    async function uploadFiles(files) {
        const project = App.getCurrentProject();
        if (!project) {
            App.toast('Nenhum projeto aberto', 'error');
            return;
        }

        // Filter valid images
        const validFiles = [];
        for (const file of files) {
            if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                validFiles.push(file);
            }
        }

        if (validFiles.length === 0) {
            App.toast('Nenhuma imagem válida selecionada', 'warning');
            return;
        }

        // Show progress
        const progressBar = $('#upload-progress');
        const progressFill = $('#progress-fill');
        progressBar.classList.add('active');
        progressFill.style.width = '0%';

        const formData = new FormData();
        formData.append('project_id', project.id);

        validFiles.forEach((file) => {
            formData.append('pages[]', file);
        });

        try {
            // Use XMLHttpRequest for progress tracking
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        progressFill.style.width = pct + '%';
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        const result = JSON.parse(xhr.responseText);
                        resolve(result);
                    } else {
                        try {
                            const err = JSON.parse(xhr.responseText);
                            reject(new Error(err.error || `HTTP ${xhr.status}`));
                        } catch {
                            reject(new Error(`HTTP ${xhr.status}`));
                        }
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Network error')));

                xhr.open('POST', '../api/pages.php');
                xhr.send(formData);
            });

            App.toast(`${validFiles.length} página(s) carregada(s)!`, 'success');
            App.refreshProject();
        } catch (err) {
            App.toast('Erro no upload: ' + err.message, 'error');
        } finally {
            setTimeout(() => {
                progressBar.classList.remove('active');
                progressFill.style.width = '0%';
            }, 1000);
        }
    }

    // Auto-init when DOM ready
    document.addEventListener('DOMContentLoaded', init);

    return { init, uploadFiles };
})();
