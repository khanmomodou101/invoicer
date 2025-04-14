/**
 * TemplateGallery.js
 * 
 * A gallery-style view component for displaying invoice templates
 * Renders templates in a responsive grid with thumbnail previews
 */

class TemplateGallery {
    constructor(options) {
        this.wrapper = options.wrapper;
        this.designs = options.designs || [];
        this.onSelect = options.onSelect; // Callback when a template is selected
        this.onDuplicate = options.onDuplicate;
        this.onDelete = options.onDelete;
        this.onSetDefault = options.onSetDefault;
    }

    /**
     * Render the template gallery
     */
    render() {
        // Create gallery container
        let html = `
            <div class="template-gallery">
                <div class="gallery-toolbar mb-3">
                    <div class="row">
                        <div class="col-md-12">
                            <p class="text-muted">${__("Click on a template to edit or use the menu for more options")}</p>
                        </div>
                    </div>
                </div>
                
                <div class="gallery-grid">
                    <div class="row">
        `;

        // No templates message
        if (!this.designs || this.designs.length === 0) {
            html += `
                <div class="col-12">
                    <div class="template-empty text-center p-5">
                        <i class="fa fa-file-o fa-3x text-muted mb-3"></i>
                        <p>${__("No templates found. Click 'New Format' to create one.")}</p>
                    </div>
                </div>
            `;
        } else {
            // Generate template cards
            this.designs.forEach(design => {
                // Get the design name from server-provided field or format it nicely
                let designName = design.design_name || design.name || __("Untitled Design");
                // Remove any dashes or underscores for display purposes
                designName = designName.replace(/-|_/g, ' ');
                // Apply proper capitalization
                designName = designName.replace(/\w\S*/g, function(txt) {
                    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                });
                
                html += `
                    <div class="col-md-4 mb-4">
                        <div class="template-card position-relative" data-name="${design.name}">
                            <div class="template-preview">
                                <div class="preview-placeholder">
                                    <i class="fa fa-file-text-o fa-3x text-muted"></i>
                                    <span>${designName}</span>
                                </div>
                            </div>
                            <div class="template-info p-2">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0">${designName}</h6>
                                    <div class="template-actions">
                                        <div class="dropdown d-inline-block">
                                            <button class="btn btn-xs btn-default dropdown-toggle" 
                                                data-toggle="dropdown" title="${__("More options")}">
                                                <i class="fa fa-ellipsis-v"></i>
                                            </button>
                                            <ul class="dropdown-menu dropdown-menu-right" role="menu">
                                                <li><a class="dropdown-item duplicate-design" data-name="${design.name}">
                                                    <i class="fa fa-copy"></i> ${__("Duplicate")}
                                                </a></li>
                                                <li><a class="dropdown-item delete-design" data-name="${design.name}">
                                                    <i class="fa fa-trash"></i> ${__("Delete")}
                                                </a></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <div class="template-meta text-muted small mt-1">
                                    <div>${design.reference_doctype || ''}</div>
                                    <div>${frappe.datetime.prettyDate(design.modified)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                    </div>
                </div>
            </div>
        `;

        this.wrapper.html(html);
        this.attachEventHandlers();
        this.loadPreviews();
    }

    /**
     * Attach event handlers to template cards and buttons
     */
    attachEventHandlers() {
        // Template card click - navigate to edit mode
        this.wrapper.find('.template-card').on('click', (e) => {
            if ($(e.target).closest('.template-actions').length === 0) {
                const designName = $(e.currentTarget).data('name');
                // Use the original onSelect handler for editing
                if (this.onSelect) this.onSelect(designName);
            }
        });

        // Delete option
        this.wrapper.find('.delete-design').on('click', (e) => {
            e.stopPropagation();
            const designName = $(e.currentTarget).data('name');
            if (this.onDelete) this.onDelete(designName);
        });

        // Duplicate option
        this.wrapper.find('.duplicate-design').on('click', (e) => {
            e.stopPropagation();
            const designName = $(e.currentTarget).data('name');
            if (this.onDuplicate) this.onDuplicate(designName);
        });
    }

    /**
     * Load thumbnail previews for each template
     */
    loadPreviews() {
        // For each template, try to load a preview
        this.designs.forEach(design => {
            this.loadTemplatePreview(design);
        });
    }

    /**
     * Load a preview for a specific template
     * @param {Object} design - The design object
     */
    loadTemplatePreview(design) {
        // Use the server-side method to get thumbnails
        frappe.call({
            method: 'invoicer.invoicer.page.invoicer.invoicer.get_design_thumbnail',
            args: { design_name: design.name },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const previewEl = this.wrapper.find(`.template-card[data-name="${design.name}"] .template-preview`);
                    
                    // Create a sanitized iframe to display the HTML content
                    const iframeHtml = `
                        <iframe 
                            class="template-preview-frame" 
                            srcdoc="${this.formatPreviewHtml(r.message.thumbnail)}"
                            frameborder="0"
                            style="width:100%; height:100%; transform: scale(0.5); transform-origin: top center;"
                        ></iframe>
                    `;
                    
                    previewEl.html(iframeHtml);
                }
            }
        });
    }
    
    /**
     * Format HTML content for the preview
     * @param {string} html - The HTML content to format
     * @returns {string} - Formatted HTML
     */
    formatPreviewHtml(html) {
        // Sanitize HTML content to prevent XSS and escape quotes
        let sanitized = html.replace(/"/g, '&quot;');
        
        // Add wrapper with styling to make it look like an invoice
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: Arial, sans-serif;
                        zoom: 0.5;
                        transform: scale(0.5);
                        transform-origin: top left;
                    }
                    /* Add any additional styles needed for previews */
                </style>
            </head>
            <body>
                ${sanitized}
            </body>
            </html>
        `;
    }
}

export default TemplateGallery; 