/**
 * FlipBook Builder - File Uploader
 * Handles drag & drop + click-to-upload with progress
 */

const Uploader = (() => {
    'use strict';

    const $ = (sel) => document.querySelector(sel);

    function init() {
        // Configure PDF.js worker
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const area = $('#upload-area');
        const input = $('#file-input');
        if (!area || !input) return;

        // ... (rest of init)
        area.addEventListener('click', (e) => {
            if (e.target !== input) input.click();
        });

        input.addEventListener('change', () => {
            if (input.files.length > 0) {
                uploadFiles(input.files);
                input.value = '';
            }
        });

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

        const progressBar = $('#upload-progress');
        const progressFill = $('#progress-fill');
        const uploadText = $('.upload-text');
        const originalText = uploadText.innerHTML;

        const filesToUpload = [];
        
        try {
            // Processing phase
            for (const file of files) {
                if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                    filesToUpload.push(file);
                } else if (file.type === 'application/pdf') {
                    progressBar.classList.add('active');
                    uploadText.innerHTML = `🧬 Processando PDF: ${file.name}...`;
                    
                    const pdfPages = await convertPdfToImages(file);
                    filesToUpload.push(...pdfPages);
                }
            }

            if (filesToUpload.length === 0) {
                App.toast('Nenhum arquivo válido selecionada (JPG, PNG, WebP ou PDF)', 'warning');
                return;
            }

            // Upload phase
            uploadText.innerHTML = `🚀 Enviando ${filesToUpload.length} página(s)...`;
            progressBar.classList.add('active');
            progressFill.style.width = '0%';

            const formData = new FormData();
            formData.append('project_id', project.id);

            filesToUpload.forEach((file, index) => {
                // Ensure name for blobs
                const fileName = file.name || `page-${index + 1}.jpg`;
                formData.append('pages[]', file, fileName);
            });

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
                        resolve(JSON.parse(xhr.responseText));
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

            App.toast(`${filesToUpload.length} página(s) sincronizada(s)!`, 'success');
            App.refreshProject();
        } catch (err) {
            console.error(err);
            App.toast('Erro no processamento/upload: ' + err.message, 'error');
        } finally {
            uploadText.innerHTML = originalText;
            setTimeout(() => {
                progressBar.classList.remove('active');
                progressFill.style.width = '0%';
            }, 1000);
        }
    }

    /**
     * Converts a PDF file into an array of Image Blobs
     */
    async function convertPdfToImages(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageImages = [];
        
        const progressFill = $('#progress-fill');

        for (let i = 1; i <= pdf.numPages; i++) {
            // Update progress during conversion
            const pct = Math.round((i / pdf.numPages) * 100);
            progressFill.style.width = pct + '%';

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // High quality

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
            
            // Add metadata to blob for identification
            const safeName = file.name.replace(/\.[^/.]+$/, "");
            blob.name = `${safeName}-p${i}.jpg`;
            
            pageImages.push(blob);
        }
        
        return pageImages;
    }

    // Auto-init when DOM ready
    document.addEventListener('DOMContentLoaded', init);

    return { init, uploadFiles };
})();
