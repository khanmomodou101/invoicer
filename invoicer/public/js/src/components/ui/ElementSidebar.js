/**
 * ElementSidebar.js
 * 
 * Manages the sidebar containing element types and fields
 * Handles draggable elements and field loading
 */

class ElementSidebar {
    constructor(options) {
        this.wrapper = options.wrapper;
        this.designerInstance = options.designerInstance;
        this.doctype = options.doctype;
        this.document_data = null;
        this.initialized = false;
    }

    /**
     * Initialize the element sidebar
     */
    initialize() {
        if (this.initialized) return;

        // Create sidebar HTML
        this.wrapper.find('.print-designer-container').prepend(`
            <div class="elements-sidebar">
                <div class="element-group">
                    <div class="element-group-title">${__("Elements")}</div>
                    <div class="element-items">
                        <div class="element-item" draggable="true" data-type="container">
                            <span class="element-item-icon"><i class="fa fa-columns"></i></span>
                            <span>${__("Container")}</span>
                        </div>
                        <div class="element-item" draggable="true" data-type="text">
                            <span class="element-item-icon"><i class="fa fa-font"></i></span>
                            <span>${__("Text")}</span>
                        </div>
                        <div class="element-item" draggable="true" data-type="heading">
                            <span class="element-item-icon"><i class="fa fa-header"></i></span>
                            <span>${__("Heading")}</span>
                        </div>
                        <div class="element-item" draggable="true" data-type="image">
                            <span class="element-item-icon"><i class="fa fa-image"></i></span>
                            <span>${__("Image")}</span>
                        </div>
                        <div class="element-item" draggable="true" data-type="qrcode">
                            <span class="element-item-icon"><i class="fa fa-qrcode"></i></span>
                            <span>${__("QR Code")}</span>
                        </div>
                    </div>
                </div>
                
                <div class="element-group">
                    <div class="element-group-title">${__("DocType Fields")}</div>
                    <div class="doctype-selector-container">
                        <select class="form-control doctype-selector">
                            <option value="">${__("Loading doctypes...")}</option>
                        </select>
                    </div>
                    <div class="doctype-fields-container">
                        <div class="placeholder text-center">
                            ${__("Select a DocType to view fields")}
                        </div>
                    </div>
                </div>
                
                <!-- Add help section -->
                <div class="element-group">
                    <div class="element-group-title">${__("Quick Help")}</div>
                    <div class="quick-help-section">
                        <h6 class="sidebar-label">${__('Quick Help')}</h6>
                        <ul class="quick-help-list">
                            <li><i class="fa fa-mouse-pointer"></i> ${__('Click element to edit properties')}</li>
                            <li><i class="fa fa-arrows"></i> ${__('Drag near edges to move elements')}</li>
                            <li><i class="fa fa-times"></i> ${__('Drag element outside to delete')}</li>
                        </ul>
                    </div>
                </div>
            </div>
        `);

        this.initialized = true;
        
        // Initialize doctype selector
        this.init_doctype_selector();
        
        // Initialize draggable elements
        this.init_sidebar_draggables();
    }

    /**
     * Initialize doctype selector with linked doctypes
     */
    init_doctype_selector() {
        const me = this;

        // Load doctypes linked to the selected doctype
        frappe.call({
            method: 'invoicer.invoicer.page.invoicer.invoicer.get_linked_doctypes',
            args: { doctype: this.doctype },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const linkedDoctypes = r.message.linked_doctypes;
                    
                    // Update the dropdown
                    let options = '';
                    linkedDoctypes.forEach(dt => {
                        options += `<option value="${dt.value}"${dt.value === me.doctype ? ' selected' : ''}
                            ${dt.fieldname ? ` data-fieldname="${dt.fieldname}"` : ''}>${dt.label}</option>`;
                    });
                    
                    me.wrapper.find('.doctype-selector').html(options);
                    
                    // Load fields for the selected doctype
                    me.load_fields_for_doctype(me.doctype);
                    
                    // Add change handler
                    me.wrapper.find('.doctype-selector').on('change', function() {
                        const selectedDoctype = $(this).val();
                        const linkFieldname = $(this).find('option:selected').data('fieldname');
                        
                        me.load_fields_for_doctype(selectedDoctype, me.doctype, linkFieldname);
                    });
                    
                    // Load data for the current document
                    me.load_latest_document_data(me.doctype);
                } else {
                    me.wrapper.find('.doctype-selector').html(`<option value="">${__("Failed to load doctypes")}</option>`);
                }
            }
        });
    }

    /**
     * Initialize draggable elements in the sidebar
     */
    init_sidebar_draggables() {
        const me = this;
        
        // Set up drag events for base elements
        this.wrapper.find('.element-item[draggable=true]').each(function() {
            $(this).on('dragstart', function(e) {
                const type = $(this).data('type');
                e.originalEvent.dataTransfer.setData('text/plain', `element:${type}`);
            });
        });
    }

    /**
     * Create a draggable item
     * @param {string} elementType - Type of the element
     * @param {string} icon - Icon class for the element
     * @param {string} label - Label for the element
     * @returns {HTMLElement} - The created draggable element
     */
    create_draggable_item(elementType, icon, label) {
        const item = document.createElement('div');
        item.className = 'element-item';
        item.draggable = true;
        item.dataset.type = elementType;
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'element-item-icon';
        iconSpan.innerHTML = `<i class="fa ${icon}"></i>`;
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        
        item.appendChild(iconSpan);
        item.appendChild(labelSpan);
        
        // Add dragstart event
        $(item).on('dragstart', this.handle_drag_start.bind(this));
        
        return item;
    }

    /**
     * Handle drag start event for elements
     * @param {Event} e - The dragstart event
     */
    handle_drag_start(e) {
        const type = $(e.currentTarget).data('type');
        e.originalEvent.dataTransfer.setData('text/plain', `element:${type}`);
    }

    /**
     * Load fields for a specific doctype
     * @param {string} doctype - The doctype to load fields for
     * @param {string} parent_doctype - The parent doctype (for linked fields)
     * @param {string} link_fieldname - The field that links to this doctype
     */
    load_fields_for_doctype(doctype, parent_doctype = null, link_fieldname = null) {
        console.log("Loading fields for doctype:", doctype);
        frappe.call({
            method: 'invoicer.invoicer.page.invoicer.invoicer.get_doctype_fields',
            args: { 
                doctype: doctype,
                parent_doctype: parent_doctype,
                link_fieldname: link_fieldname
            },
            callback: (r) => {
                console.log("Response from get_doctype_fields:", r.message);
                if (r.message && r.message.success) {
                    const fields = r.message.fields;
                    let html = '';
                    
                    // Display all fields in one list
                    if (fields.length) {
                        console.log("Found " + fields.length + " fields for doctype " + doctype);
                        html += `<div class="field-group">
                            <div class="field-group-title small">${__("Fields")}</div>`;
                        
                        fields.forEach(field => {
                            html += `
                                <div class="element-item field-item" draggable="true" 
                                    data-type="field" 
                                    data-fieldname="${field.fieldname}" 
                                    data-fieldtype="${field.fieldtype}"
                                    data-options="${field.options || ''}"
                                    data-doctype="${field.doctype}">
                                    <span>${field.label}</span>
                                </div>
                            `;
                        });
                        
                        html += `</div>`;
                    } else {
                        console.log("No fields returned for doctype " + doctype);
                        html = `<div class="text-center text-muted">
                            ${__("No fields available")}
                        </div>`;
                    }
                    
                    this.wrapper.find('.doctype-fields-container').html(html);
                    console.log("Updated fields container HTML");
                    
                    // Add drag events to field items
                    this.bind_field_drag_events();
                } else {
                    console.error("Failed to load fields for doctype " + doctype);
                    if (r.message && r.message.message) {
                        console.error("Error message:", r.message.message);
                    }
                    
                    // Show a message in the UI
                    this.wrapper.find('.doctype-fields-container').html(`
                        <div class="text-center text-muted">
                            ${__("Failed to load fields for")} ${doctype}
                        </div>
                    `);
                }
            }
        });
    }

    /**
     * Bind drag events to field items
     */
    bind_field_drag_events() {
        // Find all field items and add drag events
        const fieldItems = this.wrapper.find('.field-item');
        console.log("Found " + fieldItems.length + " field items to bind drag events");
        
        fieldItems.each((i, el) => {
            $(el).on('dragstart', (e) => {
                const fieldname = $(el).data('fieldname');
                const fieldtype = $(el).data('fieldtype');
                const options = $(el).data('options');
                const doctype = $(el).data('doctype');
                
                e.originalEvent.dataTransfer.setData('text/plain', 
                    `field:${fieldname}:${fieldtype}:${options}:${doctype}`);
            });
        });
    }

    /**
     * Load latest document data for a given doctype
     * @param {string} doctype - The doctype to load data for
     */
    load_latest_document_data(doctype) {
        console.log("Loading latest document data for:", doctype);
        
        // Add loading indicator
        this.wrapper.find('.doctype-fields-container').prepend(`
            <div class="latest-document-info alert alert-info">
                ${__("Loading latest document data...")}
            </div>
        `);
        
        frappe.call({
            method: 'invoicer.invoicer.page.invoicer.invoicer.get_doctype_data',
            args: { doctype: doctype },
            callback: (r) => {
                if (r.message && r.message.success) {
                    // Store the document data
                    this.document_data = r.message.doc;
                    
                    // Store main document info
                    this.main_document = {
                        doctype: doctype,
                        docname: this.document_data.name
                    };
                    
                    // Store current document (same as main initially)
                    this.current_document = {
                        doctype: doctype,
                        docname: this.document_data.name,
                        is_related: false
                    };
                    
                    // Update the UI with document info
                    this.wrapper.find('.latest-document-info').html(`
                        <div>
                            <strong>${__("Using document")}:</strong> ${this.document_data.name}
                            <button class="btn btn-xs btn-default refresh-document-btn ml-2">
                                <i class="fa fa-refresh"></i>
                            </button>
                        </div>
                    `);
                    
                    // Add refresh button handler
                    this.wrapper.find('.refresh-document-btn').on('click', () => {
                        this.load_latest_document_data(doctype);
                    });
                    
                    // Notify the main designer that data is loaded
                    if (this.designerInstance && this.designerInstance.update_field_elements_with_real_data) {
                        this.designerInstance.update_field_elements_with_real_data();
                    }
                } else {
                    // Update the UI with error
                    this.wrapper.find('.latest-document-info').html(`
                        <div class="text-danger">
                            ${__("No documents found for")} ${doctype}
                            <button class="btn btn-xs btn-default refresh-document-btn ml-2">
                                <i class="fa fa-refresh"></i>
                            </button>
                        </div>
                    `);
                    
                    // Add refresh button handler
                    this.wrapper.find('.refresh-document-btn').on('click', () => {
                        this.load_latest_document_data(doctype);
                    });
                }
            }
        });
    }

    /**
     * Get field icon based on field type
     * @param {string} fieldtype - The field type
     * @returns {string} - Icon class for the field type
     */
    get_field_icon(fieldtype) {
        const icons = {
            // Basic
            'Data': 'font',
            'Text': 'align-left',
            'Small Text': 'align-left',
            'Link': 'link',
            'Select': 'list',
            'Read Only': 'lock',
            'Check': 'check-square-o',
            
            // Date & Time
            'Date': 'calendar',
            'Datetime': 'clock-o',
            'Time': 'clock-o',
            
            // Numbers
            'Int': 'hashtag',
            'Float': 'calculator',
            'Currency': 'money',
            'Percent': 'percent',
            'Rating': 'star',
            
            // Rich Content
            'Code': 'code',
            'Text Editor': 'file-text-o',
            'Markdown Editor': 'markdown',
            'HTML Editor': 'code',
            'Color': 'paint-brush',
            
            // Files & Media
            'Attach': 'paperclip',
            'Attach Image': 'image',
            'Signature': 'pencil',
            'Barcode': 'barcode',
            'Image': 'image',
            
            // References
            'Dynamic Link': 'external-link',
            'Password': 'key',
            'Autocomplete': 'search',
            'Geolocation': 'map-marker',
            'JSON': 'code',
            
            // Tables
            'Table': 'table',
            'Table MultiSelect': 'th-list'
        };
        
        return icons[fieldtype] || 'circle';
    }
}

export default ElementSidebar;