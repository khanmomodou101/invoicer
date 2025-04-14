/**
 * APIManager.js
 * 
 * Manages API interactions with the server
 * Handles loading, saving, and manipulating invoice designs
 */

class APIManager {
    constructor(options) {
        this.designerInstance = options.designerInstance;
    }

    /**
     * Load a print design by name
     * @param {string} designName - The name of the design to load
     * @returns {Promise} - Promise that resolves with the design data
     */
    load_design(designName) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.get_invoice_design',
                args: { design_name: designName },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        resolve(r.message);
                    } else {
                        reject(new Error(r.message?.message || "Failed to load design"));
                    }
                }
            });
        });
    }

    /**
     * Save the current print design
     * @param {string} designName - The name to save the design as
     * @param {HTMLElement} canvas - The canvas element containing the design
     * @param {Object} properties - Properties of the design
     * @param {boolean} isDefault - Whether this design should be set as default
     * @returns {Promise} - Promise that resolves when the design is saved
     */
    save_design(designName, canvas, properties, isDefault = false) {
        return new Promise((resolve, reject) => {
            if (!canvas) {
                reject(new Error("Canvas not found"));
                return;
            }
            
            // Clone the canvas to remove helper elements
            const tempCanvas = canvas.cloneNode(true);
            
            // Remove any remaining control elements
            tempCanvas.querySelectorAll('.element-controls').forEach(control => {
                control.remove();
            });
            
            // Clean up elements for saving
            tempCanvas.querySelectorAll('.canvas-element').forEach(element => {
                // Remove any helper classes and attributes
                element.classList.remove('selected', 'dragging-enabled');
                element.style.cursor = '';
                element.style.boxShadow = '';
                element.removeAttribute('draggable');
                
                // Remove the drag indicator
                const dragIndicators = element.querySelectorAll('::after');
                if (dragIndicators) {
                    dragIndicators.forEach(indicator => indicator.remove());
                }
            });
            
            // Handle QR code elements - replace with the HTML template
            tempCanvas.querySelectorAll('.qrcode-element').forEach(qrcodeElement => {
                const htmlTemplate = qrcodeElement.getAttribute('data-html-template');
                if (htmlTemplate) {
                    // Use the template directly - it already contains the proper field references
                    qrcodeElement.innerHTML = htmlTemplate;
                } else {
                    // Fallback for QR codes without a template
                    let value = qrcodeElement.getAttribute('data-value') || '{{ doc.name }}';
                    // Always use {{ doc.name }} if the value isn't already a template
                    if (!value.includes('{{') && !value.includes('}}')) {
                        value = '{{ doc.name }}';
                    }
                    const size = qrcodeElement.getAttribute('data-size') || '150';
                    
                    // Create image-based QR code with direct value reference
                    // Do not use encodeURIComponent here as it will encode the template braces
                    const imgHtml = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${value}&size=${size}x${size}" alt="QR Code" style="width:${size}px;height:${size}px;"/>`;
                    qrcodeElement.innerHTML = imgHtml;
                }
                
                // Remove any nested structure (display container div)
                const displayContainer = qrcodeElement.querySelector('.qrcode-display');
                if (displayContainer) {
                    const img = displayContainer.querySelector('img');
                    if (img) {
                        // Replace the container with just the img tag
                        qrcodeElement.innerHTML = '';
                        qrcodeElement.appendChild(img.cloneNode(true));
                    }
                }
                
                // Ensure no canvas elements remain in the QR code
                const canvas = qrcodeElement.querySelector('canvas');
                if (canvas) {
                    canvas.remove();
                }
            });
            
            // Handle field elements - replace actual values with templates for saving
            tempCanvas.querySelectorAll('.field-element').forEach(fieldElement => {
                const template = fieldElement.getAttribute('data-template');
                if (template) {
                    // Replace the real data with the template
                    fieldElement.textContent = template;
                }
            });
            
            // Handle table elements - replace sample data with Jinja templates
            tempCanvas.querySelectorAll('.table-element').forEach(tableElement => {
                const jinjaTemplate = tableElement.getAttribute('data-jinja-template');
                if (jinjaTemplate) {
                    // First, fix any doc.row references in the template
                    let fixedTemplate = jinjaTemplate;
                    if (fixedTemplate.includes('doc.row.')) {
                        console.error('Found doc.row. references in template during save, fixing...');
                        fixedTemplate = fixedTemplate.replace(/doc\.row\./g, 'row.');
                        tableElement.setAttribute('data-jinja-template', fixedTemplate);
                    }
                    
                    const table = tableElement.querySelector('table');
                    if (table && table.querySelector('tbody')) {
                        // Instead of trying to insert the Jinja template as HTML (which can cause issues with special characters),
                        // we'll add a special marker that will be replaced server-side
                        const tbody = table.querySelector('tbody');
                        tbody.innerHTML = '<tr><td colspan="100%" data-jinja-placeholder="true">TABLE_TEMPLATE_PLACEHOLDER</td></tr>';
                        
                        // Store the actual template as a data attribute that won't be parsed as HTML
                        // Use the fixed template (without doc.row) for jinja-code
                        table.setAttribute('data-jinja-code', fixedTemplate);
                    }
                    
                    // Check the innerHTML as well
                    if (tableElement.innerHTML.includes('doc.row.')) {
                        console.error('Found doc.row. in table element innerHTML, fixing...');
                        tableElement.innerHTML = tableElement.innerHTML.replace(/doc\.row\./g, 'row.');
                    }
                }
                
                // Remove design notes
                const noteElement = tableElement.querySelector('.table-dynamic-note');
                if (noteElement) {
                    noteElement.remove();
                }
            });
            
            // Add global styles for tables
            let styleElement = tempCanvas.querySelector('#invoicer-table-styles');
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = 'invoicer-table-styles';
                
                // Basic header styles
                let styleContent = `
                    .table-element table th {
                        font-weight: 700 !important;
                        background-color: #f8f8f8 !important;
                        text-align: center !important;
                    }
                `;
                
                // Collect all table elements and their row styles
                tempCanvas.querySelectorAll('.table-element').forEach(tableEl => {
                    try {
                        const tableId = tableEl.closest('.canvas-element').id;
                        const rowStyles = JSON.parse(tableEl.getAttribute('data-row-styles') || '{}');
                        
                        if (Object.keys(rowStyles).length > 0) {
                            styleContent += `\n#${tableId} .table-element table td {`;
                            
                            if (rowStyles.fontSize) styleContent += `\n  font-size: ${rowStyles.fontSize} !important;`;
                            if (rowStyles.fontWeight) styleContent += `\n  font-weight: ${rowStyles.fontWeight} !important;`;
                            if (rowStyles.color) styleContent += `\n  color: ${rowStyles.color} !important;`;
                            if (rowStyles.padding) styleContent += `\n  padding: ${rowStyles.padding} !important;`;
                            if (rowStyles.backgroundColor) styleContent += `\n  background-color: ${rowStyles.backgroundColor} !important;`;
                            if (rowStyles.textAlign) styleContent += `\n  text-align: ${rowStyles.textAlign} !important;`;
                            
                            styleContent += `\n}\n`;
                        }
                    } catch (e) {
                        console.error("Error processing table styles", e);
                    }
                });
                
                styleElement.textContent = styleContent;
                tempCanvas.prepend(styleElement);
            }
            
            // Save the design to the server
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.save_invoice_design',
                args: {
                    design_name: designName,
                    content: tempCanvas.innerHTML,
                    properties: properties,
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        resolve(r.message);
                    } else {
                        reject(new Error(r.message?.message || "Failed to save design"));
                    }
                }
            });
        });
    }

    /**
     * Delete a print design
     * @param {string} designName - The name of the design to delete
     * @returns {Promise} - Promise that resolves when the design is deleted
     */
    delete_design(designName) {
        return new Promise((resolve, reject) => {
            frappe.confirm(__('Are you sure you want to delete the design "{0}"?', [designName]), () => {
                frappe.call({
                    method: 'invoicer.invoicer.page.invoicer.invoicer.delete_invoice_design',
                    args: { design_name: designName },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            resolve(r.message);
                        } else {
                            reject(new Error(r.message?.message || "Failed to delete design"));
                        }
                    }
                });
            });
        });
    }

    /**
     * Duplicate a print design
     * @param {string} designName - The name of the design to duplicate
     * @param {string} newName - The name for the duplicated design
     * @returns {Promise} - Promise that resolves when the design is duplicated
     */
    duplicate_design(designName, newName) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.duplicate_print_design',
                args: { 
                    design_name: designName,
                    new_name: newName
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        resolve(r.message);
                    } else {
                        reject(new Error(r.message?.message || "Failed to duplicate design"));
                    }
                }
            });
        });
    }

    /**
     * Set a design as the default for its doctype
     * @param {string} designName - The name of the design to set as default
     * @returns {Promise} - Promise that resolves when the design is set as default
     */
    set_default_design(designName) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.set_default_print_design',
                args: { design_name: designName },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        resolve(r.message);
                    } else {
                        reject(new Error(r.message?.message || "Failed to set design as default"));
                    }
                }
            });
        });
    }

    /**
     * Get a list of all print designs
     * @returns {Promise} - Promise that resolves with the list of designs
     */
    get_design_list() {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.get_invoice_designs',
                callback: (r) => {
                    if (r.message) {
                        resolve(r.message);
                    } else {
                        reject(new Error("Failed to get design list"));
                    }
                }
            });
        });
    }

    /**
     * Get data for a document of a specific doctype
     * @param {string} doctype - The doctype to get data for
     * @param {string} docname - The name of the document (optional)
     * @returns {Promise} - Promise that resolves with the document data
     */
    get_document_data(doctype, docname = null) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.get_doctype_data',
                args: { doctype: doctype, docname: docname },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        resolve(r.message.doc);
                    } else {
                        reject(new Error(r.message?.message || `No documents found for ${doctype}`));
                    }
                }
            });
        });
    }

    /**
     * Get fields for a specific doctype
     * @param {string} doctype - The doctype to get fields for
     * @param {string} parent_doctype - The parent doctype (for linked fields)
     * @param {string} link_fieldname - The field that links to this doctype
     * @returns {Promise} - Promise that resolves with the fields
     */
    get_doctype_fields(doctype, parent_doctype = null, link_fieldname = null) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.get_doctype_fields',
                args: { 
                    doctype: doctype,
                    parent_doctype: parent_doctype,
                    link_fieldname: link_fieldname
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        resolve(r.message.fields);
                    } else {
                        reject(new Error(r.message?.message || `Failed to get fields for ${doctype}`));
                    }
                }
            });
        });
    }

    /**
     * Get data for a document related to the main document
     * @param {string} main_doctype - The main doctype
     * @param {string} main_docname - The main document name
     * @param {string} related_doctype - The related doctype
     * @param {string} link_fieldname - The field that links to the related doctype
     * @returns {Promise} - Promise that resolves with the related document data
     */
    get_related_document_data(main_doctype, main_docname, related_doctype, link_fieldname = null) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.get_related_doctype_data',
                args: {
                    main_doctype: main_doctype,
                    main_docname: main_docname,
                    related_doctype: related_doctype,
                    link_fieldname: link_fieldname
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        resolve(r.message.doc);
                    } else {
                        reject(new Error(r.message?.message || `Failed to get related document data for ${related_doctype}`));
                    }
                }
            });
        });
    }

    /**
     * Get a specific field value from a related document
     * @param {string} main_doctype - The main doctype
     * @param {string} main_docname - The main document name
     * @param {string} related_doctype - The related doctype
     * @param {string} link_fieldname - The field that links to the related doctype
     * @param {string} field_name - The field to get the value for
     * @returns {Promise} - Promise that resolves with the field value
     */
    get_related_field_value(main_doctype, main_docname, related_doctype, link_fieldname, field_name) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.get_related_field_value',
                args: {
                    main_doctype: main_doctype,
                    main_docname: main_docname,
                    related_doctype: related_doctype,
                    link_fieldname: link_fieldname,
                    field_name: field_name
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        resolve({
                            value: r.message.value,
                            docname: r.message.docname
                        });
                    } else {
                        reject(new Error(r.message?.message || `Failed to get field value for ${field_name}`));
                    }
                }
            });
        });
    }

    /**
     * Preview a design in a new window
     * @param {string} designName - The name of the design to preview
     * @param {Object} doc - The document data to use for the preview
     */
    preview_design(designName, doc = null) {
        const url = frappe.urllib.get_full_url(
            '/api/method/invoicer.invoicer.page.invoicer.invoicer.preview_design?' +
            'design_name=' + encodeURIComponent(designName) +
            (doc ? '&doctype=' + encodeURIComponent(doc.doctype) + '&docname=' + encodeURIComponent(doc.name) : '')
        );
        
        const w = window.open(url);
        if (!w) {
            frappe.msgprint(__('Please allow pop-ups to preview the design'));
        }
    }
}

export default APIManager; 