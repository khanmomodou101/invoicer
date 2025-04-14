/**
 * PrintDesigner.js
 * 
 * Main class for the Print Designer application
 * Orchestrates all components and manages the main application state
 */

import APIManager from './APIManager.js';
import EventManager from './EventManager.js';
import ElementSidebar from '../ui/ElementSidebar.js';
import LayersPanel from '../ui/LayersPanel.js';
import PropertyPanel from '../ui/PropertyPanel.js';
import { generateUniqueId, getFieldPlaceholder, applyContainerDirection } from '../../utils/DesignUtils.js';

class PrintDesigner {
    constructor(page) {
        this.page = page;
        this.wrapper = null;
        this.doctype = null;
        this.design_name = null;
        this.properties = {};
        this.current_design = null;
        this.document_data = null;
        this.field_values_cache = {};
        this.docFields = [];
        this.initialized = false;
        
        // Initialize sub-components
        this.apiManager = new APIManager({ designerInstance: this });
        this.eventManager = new EventManager({ designerInstance: this, wrapper: this.page.main });
        
        // Initialize page
        this.setup_page();
    }

    /**
     * Set up the page structure
     */
    setup_page() {
        this.page.set_title(__("Print Designer"));
        
        // Set primary action to show start screen
        this.page.set_primary_action(__("Show List"), () => {
            this.show_start();
        });
        
        // Load designs on page load
        this.show_start();
    }

    /**
     * Show the start screen with design list
     */
    show_start() {
        this.page.clear_primary_action();
        this.page.clear_secondary_action();
        
        this.page.set_primary_action(__("New Design"), () => {
            this.show_new_format_dialog();
        });
        
        // Clear the page
        this.page.main.empty();
        
        // Show the design list
        this.load_print_list();
    }

    /**
     * Load the list of print designs
     */
    load_print_list() {
        this.page.main.html(`<div class="print-list-container">
            <div class="print-list-header">
                <h4>${__("Print Designs")}</h4>
            </div>
            <div class="print-list">
                <div class="text-muted text-center">${__("Loading designs...")}</div>
            </div>
        </div>`);
        
        // Get all designs from the server
        this.apiManager.get_design_list()
            .then(designs => {
                if (!designs.length) {
                    this.page.main.find('.print-list').html(`
                        <div class="text-muted text-center">
                            <p>${__("No designs found")}</p>
                            <button class="btn btn-primary btn-sm new-design-btn">
                                ${__("Create New Design")}
                            </button>
                        </div>
                    `);
                    
                    this.page.main.find('.new-design-btn').on('click', () => {
                        this.show_new_format_dialog();
                    });
                    
                    return;
                }
                
                // Show the designs
                let html = `<div class="design-cards">`;
                
                designs.forEach(design => {
                    html += `
                        <div class="design-card" data-name="${design.name}">
                            <div class="design-card-header">
                                <h5>${design.name}</h5>
                                <div class="design-doctype">${design.doc_type}</div>
                            </div>
                            <div class="design-card-actions">
                                <button class="btn btn-default btn-sm edit-design-btn" data-name="${design.name}">
                                    <i class="fa fa-pencil"></i> ${__("Edit")}
                                </button>
                                <div class="dropdown">
                                    <button class="btn btn-default btn-sm dropdown-toggle" data-toggle="dropdown">
                                        <i class="fa fa-cog"></i> <span class="caret"></span>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-right">
                                        <li><a href="#" class="duplicate-design-btn" data-name="${design.name}">
                                            <i class="fa fa-copy"></i> ${__("Duplicate")}
                                        </a></li>
                                        <li><a href="#" class="default-design-btn" data-name="${design.name}">
                                            <i class="fa fa-check"></i> ${__("Set as Default")}
                                        </a></li>
                                        <li class="divider"></li>
                                        <li><a href="#" class="delete-design-btn" data-name="${design.name}">
                                            <i class="fa fa-trash"></i> ${__("Delete")}
                                        </a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                html += `</div>`;
                
                this.page.main.find('.print-list').html(html);
                
                // Bind events
                this.page.main.find('.edit-design-btn').on('click', (e) => {
                    const designName = $(e.currentTarget).data('name');
                    this.load_design(designName);
                });
                
                this.page.main.find('.duplicate-design-btn').on('click', (e) => {
                    e.preventDefault();
                    const designName = $(e.currentTarget).data('name');
                    this.duplicate_design(designName);
                });
                
                this.page.main.find('.default-design-btn').on('click', (e) => {
                    e.preventDefault();
                    const designName = $(e.currentTarget).data('name');
                    this.set_default_design(designName);
                });
                
                this.page.main.find('.delete-design-btn').on('click', (e) => {
                    e.preventDefault();
                    const designName = $(e.currentTarget).data('name');
                    this.delete_design(designName);
                });
            })
            .catch(error => {
                console.error("Error loading designs:", error);
                this.page.main.find('.print-list').html(`
                    <div class="text-danger text-center">
                        <p>${__("Failed to load designs")}</p>
                        <p>${error.message || ''}</p>
                    </div>
                `);
            });
    }

    /**
     * Show the dialog to create a new format
     */
    show_new_format_dialog() {
        const d = new frappe.ui.Dialog({
            title: __("New Print Format"),
            fields: [
                {
                    fieldtype: 'Data',
                    fieldname: 'format_name',
                    label: __('Format Name'),
                    reqd: 1
                },
                {
                    fieldtype: 'Link',
                    fieldname: 'doc_type',
                    label: __('DocType'),
                    options: 'DocType',
                    reqd: 1
                }
            ],
            primary_action_label: __('Create'),
            primary_action: (values) => {
                d.hide();
                this.setup_new_design(values.doc_type, values.format_name);
            }
        });
        
        d.show();
    }

    /**
     * Duplicate a design
     * @param {string} designName - Name of the design to duplicate
     */
    duplicate_design(designName) {
        const d = new frappe.ui.Dialog({
            title: __("Duplicate Print Format"),
            fields: [
                {
                    fieldtype: 'Data',
                    fieldname: 'new_name',
                    label: __('New Format Name'),
                    reqd: 1
                }
            ],
            primary_action_label: __('Duplicate'),
            primary_action: (values) => {
                d.hide();
                
                this.apiManager.duplicate_design(designName, values.new_name)
                    .then(result => {
                        frappe.show_alert({
                            message: __("Design duplicated successfully"),
                            indicator: 'green'
                        }, 3);
                        
                        this.load_print_list();
                    })
                    .catch(error => {
                        frappe.throw(error.message || __("Failed to duplicate design"));
                    });
            }
        });
        
        d.show();
    }

    /**
     * Set a design as default
     * @param {string} designName - Name of the design to set as default
     */
    set_default_design(designName) {
        this.apiManager.set_default_design(designName)
            .then(result => {
                frappe.show_alert({
                    message: __("Design set as default"),
                    indicator: 'green'
                }, 3);
            })
            .catch(error => {
                frappe.throw(error.message || __("Failed to set design as default"));
            });
    }

    /**
     * Delete a design
     * @param {string} designName - Name of the design to delete
     */
    delete_design(designName) {
        this.apiManager.delete_design(designName)
            .then(result => {
                frappe.show_alert({
                    message: __("Design deleted successfully"),
                    indicator: 'green'
                }, 3);
                
                this.load_print_list();
            })
            .catch(error => {
                frappe.throw(error.message || __("Failed to delete design"));
            });
    }

    /**
     * Load a design for editing
     * @param {string} designName - Name of the design to load
     */
    load_design(designName) {
        this.apiManager.load_design(designName)
            .then(data => {
                this.design_name = data.design_name;
                this.current_design = data.design_name;
                this.properties = data.properties || {};
                this.doctype = this.properties.doctype;
                
                // Set up page actions
                this.page.set_title(__("Print Design: {0}", [data.design_name]));
                
                // Setup design editor with the loaded content
                this.setup_design_editor(data.content);
            })
            .catch(error => {
                frappe.throw(__("Failed to load design"));
            });
    }

    /**
     * Set up the design editor interface
     * @param {string} content - HTML content for the canvas
     */
    setup_design_editor(content) {
        // Update page actions
        this.page.clear_primary_action();
        this.page.clear_secondary_action();
        
        this.page.set_primary_action(__('Save'), () => {
            this.save_design();
        });
        
        this.page.set_secondary_action(__('Back to List'), () => {
            this.show_start();
        });
        
        // Add a share button in the page menu
        this.page.add_menu_item(__('Share Design URL'), () => {
            // Create the full URL to this design
            const designUrl = window.location.origin + 
                frappe.urllib.get_base_url() + 
                'invoicer/' + 
                encodeURIComponent(this.current_design || this.design_name);
            
            // Show a dialog with the URL
            const d = new frappe.ui.Dialog({
                title: __('Share Design URL'),
                fields: [
                    {
                        fieldtype: 'Code',
                        fieldname: 'design_url',
                        label: __('Direct URL to this design'),
                        default: designUrl,
                        read_only: 1
                    }
                ],
                primary_action_label: __('Copy to Clipboard'),
                primary_action: () => {
                    navigator.clipboard.writeText(designUrl).then(() => {
                        frappe.show_alert({
                            message: __('URL copied to clipboard'),
                            indicator: 'green'
                        }, 3);
                        d.hide();
                    }).catch(err => {
                        console.error('Could not copy text: ', err);
                    });
                }
            });
            d.show();
        });
        
        // Add help button for new interaction
        this.page.add_menu_item(__('How to Use Editor'), () => {
            const d = new frappe.ui.Dialog({
                title: __('How to Use the Editor'),
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'help_html',
                        options: `
                            <div style="padding: 10px 0;">
                                <h5>${__('New Interaction Model')}</h5>
                                <div class="help-item" style="margin-bottom: 15px;">
                                    <strong>${__('Edit Elements:')}</strong> ${__('Click directly on any element to open its properties panel on the right side')}
                                </div>
                                <div class="help-item" style="margin-bottom: 15px;">
                                    <strong>${__('Container Layout:')}</strong> ${__('Select a container and change its direction instantly from the properties panel')}
                                </div>
                                <div class="help-item" style="margin-bottom: 15px;">
                                    <strong>${__('Move Elements:')}</strong> ${__('Hover near the edge of an element until you see the cursor change, then drag it')}
                                </div>
                                <div class="help-item" style="margin-bottom: 15px;">
                                    <strong>${__('Delete Elements:')}</strong> ${__('Drag an element to an empty area outside any container to delete it, or use the trash icon in the properties panel')}
                                </div>
                                <div class="help-item" style="margin-bottom: 15px;">
                                    <strong>${__('Edit Text:')}</strong> ${__('Click directly on text to edit its content')}
                                </div>
                            </div>
                        `
                    }
                ],
                primary_action_label: __('Got It'),
                primary_action: () => {
                    d.hide();
                }
            });
            d.show();
        });
        
        // Initialize the main wrapper
        this.wrapper = this.page.main;
        this.wrapper.empty();
        
        // Create design editor UI
        this.wrapper.html(`
            <div class="print-designer-container">
                <div id="print-canvas" class="print-canvas">
                    <!-- Canvas content will be loaded here -->
                </div>
            </div>
        `);
        
        // Load doctype fields for reference
        this.load_doctype_fields();
        
        // Initialize UI components
        this.elementSidebar = new ElementSidebar({
            wrapper: this.wrapper,
            designerInstance: this,
            doctype: this.doctype
        });
        
        this.layersPanel = new LayersPanel({
            wrapper: this.wrapper,
            designerInstance: this
        });
        
        this.propertiesPanel = new PropertyPanel({
            wrapper: this.wrapper,
            designerInstance: this
        });
        
        // Initialize all components
        this.elementSidebar.initialize();
        this.layersPanel.initialize();
        this.propertiesPanel.initialize();
        
        // Initialize the canvas
        this.init_canvas(content);
        
        // Set up event handlers
        this.eventManager.initialize();
    }

    /**
     * Initialize the canvas with content
     * @param {string} content - HTML content for the canvas
     */
    init_canvas(content) {
        const canvas = document.getElementById('print-canvas');
        
        // Load content if provided
        if (content) {
            canvas.innerHTML = content;
            
            // Reattach events to loaded elements
            this.eventManager.reattach_element_events();
        } else {
            // Create a default container
            this.create_default_container();
        }
        
        // Add container button at the bottom
        this.add_container_button();
    }

    /**
     * Create a default container in the canvas
     */
    create_default_container() {
        const canvas = document.getElementById('print-canvas');
        const container = this.create_element('container');
        
        // Add to canvas
        canvas.appendChild(container);
        
        // Attach events
        this.eventManager.attach_element_events(container);
    }

    /**
     * Add a button to add new containers
     */
    add_container_button() {
        const canvas = document.getElementById('print-canvas');
        
        // Create button
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'add-container-button';
        buttonDiv.style.textAlign = 'center';
        buttonDiv.style.margin = '20px 0px';
        
        buttonDiv.innerHTML = `<button class="btn btn-default btn-sm">
            <i class="fa fa-plus"></i> Add Container
        </button>`;
        
        // Add click handler
        buttonDiv.querySelector('button').addEventListener('click', () => {
            const container = this.create_element('container');
            
            // Add to canvas
            canvas.appendChild(container);
            
            // Attach events
            this.eventManager.attach_element_events(container);
            
            // Select the new container
            document.querySelectorAll('.canvas-element.selected').forEach(el => {
                el.classList.remove('selected');
            });
            container.classList.add('selected');
            this.propertiesPanel.show_properties(container);
        });
        
        // Add to canvas
        canvas.appendChild(buttonDiv);
    }

    /**
     * Create a new element
     * @param {string} type - Type of element to create
     * @returns {HTMLElement} - The created element
     */
    create_element(type) {
        const element = document.createElement('div');
        element.className = 'canvas-element';
        element.id = generateUniqueId();
        
        // Set up the element based on type
        switch (type) {
            case 'container':
                element.innerHTML = `<div class="container-element" data-type="container"></div>`;
                break;
                
            case 'text':
                element.innerHTML = `<div class="text-element" data-type="text" contenteditable="true">Sample Text</div>`;
                break;
                
            case 'heading':
                element.innerHTML = `<div class="heading-element" data-type="heading" contenteditable="true">Heading</div>`;
                element.querySelector('.heading-element').style.fontSize = '24px';
                element.querySelector('.heading-element').style.fontWeight = 'bold';
                break;
                
            case 'image':
                element.innerHTML = `
                    <div class="image-element" data-type="image">
                        <img src="/assets/frappe/images/frappe-framework-logo.png" alt="Sample Image">
                    </div>
                `;
                break;
                
            case 'qrcode':
                // Use api.qrserver.com for QR code generation
                const qrValue = '{{ doc.name }}';
                const qrSize = '150';
                const qrErrorLevel = 'H';
                const qrColor = '000000';
                const qrBgColor = 'FFFFFF';
                
                // QR code HTML template
                const qrHtml = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${qrValue}&size=${qrSize}x${qrSize}&ecc=${qrErrorLevel}&color=${qrColor}&bgcolor=${qrBgColor}" alt="QR Code" style="width:${qrSize}px;height:${qrSize}px;"/>`;
                
                // Create a container for the QR code and store attributes
                element.innerHTML = `<div class="qrcode-element" 
                    data-type="qrcode" 
                    data-value="${qrValue}" 
                    data-size="${qrSize}" 
                    data-error-correction="${qrErrorLevel}" 
                    data-color="${qrColor}" 
                    data-bg-color="${qrBgColor}"
                    data-html-template="${qrHtml}">
                    ${qrHtml}
                </div>`;
                
                // Set dimensions
                element.querySelector('.qrcode-element').style.width = qrSize + 'px';
                element.querySelector('.qrcode-element').style.height = qrSize + 'px';
                break;
                
            default:
                console.error("Unknown element type:", type);
                return null;
        }
        
        return element;
    }

    /**
     * Create a field element
     * @param {string} fieldname - Name of the field
     * @param {string} fieldtype - Type of the field
     * @param {string} options - Options for the field
     * @param {string} doctype - DocType the field belongs to
     * @returns {HTMLElement} - The created field element
     */
    create_field_element(fieldname, fieldtype, options, doctype) {
        const element = document.createElement('div');
        element.className = 'canvas-element';
        element.id = generateUniqueId();
        
        // Create the placeholder text
        const placeholder = getFieldPlaceholder(fieldtype);
        
        // Create the field element
        let fieldElement;
        
        if (fieldtype === 'Table' || fieldtype === 'Table MultiSelect') {
            // Create a table element
            fieldElement = document.createElement('div');
            fieldElement.className = 'table-element';
            fieldElement.setAttribute('data-type', 'table');
            fieldElement.setAttribute('data-fieldname', fieldname);
            fieldElement.setAttribute('data-fieldtype', fieldtype);
            fieldElement.setAttribute('data-options', options || '');
            fieldElement.setAttribute('data-doctype', doctype);
            fieldElement.setAttribute('data-row-styles', JSON.stringify({
                fontSize: '14px',
                fontWeight: 'normal',
                color: '#000000',
                padding: '8px',
                textAlign: 'left'
            }));
            
            // Add a placeholder table or configure button
            fieldElement.innerHTML = `
                <div class="placeholder text-muted text-center" style="padding: 20px; border: 1px dashed #ddd;">
                    <i class="fa fa-table fa-2x"></i>
                    <p>${__("Click to configure table")}</p>
                    <p class="small">${__("Field")}: ${fieldname}</p>
                </div>
            `;
        } else {
            // Create a regular field element
            fieldElement = document.createElement('div');
            fieldElement.className = 'field-element';
            fieldElement.setAttribute('data-type', 'field');
            fieldElement.setAttribute('data-fieldname', fieldname);
            fieldElement.setAttribute('data-fieldtype', fieldtype);
            fieldElement.setAttribute('data-options', options || '');
            fieldElement.setAttribute('data-doctype', doctype);
            
            // Set the template as a data attribute for saving
            fieldElement.setAttribute('data-template', `{{ doc.${fieldname} }}`);
            
            // Set the placeholder text
            fieldElement.textContent = placeholder;
        }
        
        // Add the field element to the container
        element.appendChild(fieldElement);
        
        return element;
    }

    /**
     * Preview the current design
     */
    preview_current_design() {
        const canvas = document.getElementById('print-canvas');
        
        // Clone the canvas to remove any remaining controls or indicators
        const tempCanvas = canvas.cloneNode(true);
        
        // Remove any control elements that might still exist
        tempCanvas.querySelectorAll('.element-controls').forEach(control => {
            control.remove();
        });
        
        // Remove helper indicators
        tempCanvas.querySelectorAll('.canvas-element').forEach(element => {
            // Remove any helper classes
            element.classList.remove('selected', 'dragging-enabled');
            element.style.cursor = '';
            element.style.boxShadow = '';
        });
        
        const w = window.open();
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${__("Print Preview: ")}${this.design_name}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                    margin: 0;
                        padding: 20px;
                    }
                    .print-canvas {
                        background: white;
                        padding: 20px;
                        margin: 0 auto;
                        max-width: 800px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    }
                    .dropzone {
                    display: none;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                        .print-canvas {
                            box-shadow: none;
                        }
                }
                </style>
            </head>
            <body>
                <div class="toolbar" style="text-align: center; margin-bottom: 20px;">
                    <button onclick="window.print()" style="padding: 8px 16px;">
                        <i class="fa fa-print"></i> ${__("Print")}
                    </button>
                    </div>
                <div class="print-canvas">${tempCanvas.innerHTML}</div>
            </body>
            </html>
        `;
        
        $(w.document.body).html(html);
    }

    /**
     * Set up a new design
     * @param {string} doctype - DocType for the design
     * @param {string} name - Name of the design
     */
    setup_new_design(doctype, name) {
        this.current_design = null;
        this.design_name = name;
        this.doctype = doctype;
        this.properties = { doctype: doctype };
        
        // Update page title
        this.page.set_title(__("New Format: {0}", [name]));
        
        // Setup empty design editor
        this.setup_design_editor();
    }

    /**
     * Save the current design
     */
    save_design() {
        const canvas = document.getElementById('print-canvas');
        if (!canvas) return;
        
        this.apiManager.save_design(this.design_name, canvas, this.properties, false)
            .then(result => {
                frappe.show_alert({
                    message: __("Design saved successfully"),
                    indicator: 'green'
                }, 3);
                
                // Update the design name if it's a new design
                if (!this.current_design) {
                    this.current_design = result.name;
                    this.page.set_title(__("Print Design: {0}", [result.name]));
                }
            })
            .catch(error => {
                frappe.msgprint({
                    title: __("Error Saving Design"),
                    message: error.message || __("Failed to save design"),
                    indicator: 'red'
                });
            });
    }

    /**
     * Load fields for the current doctype and related doctypes
     */
    load_doctype_fields() {
        if (!this.doctype) return;
        
        console.log("Loading fields for doctype:", this.doctype);
        
        // First load the fields for the main doctype
        this.apiManager.get_doctype_fields(this.doctype)
            .then(fields => {
                this.docFields = fields;
                console.log("Loaded doctype fields for main doctype:", this.docFields.length);
                
                // Now load linked doctypes
                return this.load_linked_doctypes_fields();
            })
            .catch(error => {
                console.error("Error loading doctype fields:", error);
                this.docFields = [];
            });
    }

    /**
     * Load fields for linked doctypes
     * @returns {Promise} Promise resolving when all linked doctypes fields are loaded
     */
    load_linked_doctypes_fields() {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoicer.invoicer.page.invoicer.invoicer.get_linked_doctypes',
                args: { doctype: this.doctype },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        const linkedDoctypes = r.message.linked_doctypes;
                        console.log("Found linked doctypes:", linkedDoctypes.length);
                        
                        // Skip the main doctype as we already loaded it
                        const otherDoctypes = linkedDoctypes.filter(dt => dt.value !== this.doctype);
                        
                        if (!otherDoctypes.length) {
                            resolve();
                            return;
                        }
                        
                        // Load fields for each linked doctype
                        const promises = otherDoctypes.map(dt => {
                            console.log("Loading fields for linked doctype:", dt.value);
                            return this.apiManager.get_doctype_fields(dt.value, this.doctype, dt.fieldname)
                                .then(linkedFields => {
                                    console.log(`Loaded ${linkedFields.length} fields for ${dt.value}`);
                                    
                                    // Mark these fields as from a linked doctype
                                    linkedFields.forEach(field => {
                                        field.from_doctype = dt.value;
                                        field.link_fieldname = dt.fieldname;
                                        
                                        // Prefix the label to show it's from another doctype
                                        field.label = `${dt.label}: ${field.label}`;
                                    });
                                    
                                    // Add these fields to the main docFields array
                                    this.docFields = this.docFields.concat(linkedFields);
                                })
                                .catch(error => {
                                    console.error(`Error loading fields for ${dt.value}:`, error);
                                    return []; // Return empty array to continue
                                });
                        });
                        
                        // Wait for all promises to complete
                        Promise.all(promises)
                            .then(() => {
                                console.log("All linked doctype fields loaded, total fields:", this.docFields.length);
                                resolve();
                            })
                            .catch(error => {
                                console.error("Error loading linked doctype fields:", error);
                                resolve(); // Still resolve to continue with what we have
                            });
                    } else {
                        console.error("Failed to get linked doctypes");
                        resolve(); // Still resolve to continue with what we have
                    }
                }
            });
        });
    }
}

export default PrintDesigner; 