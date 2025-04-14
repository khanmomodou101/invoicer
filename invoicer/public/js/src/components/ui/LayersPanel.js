/**
 * LayersPanel.js
 * 
 * Manages the layers panel for the print designer
 * Displays the hierarchical structure of elements in the design
 * Allows selecting and managing elements through layer representation
 */

class LayersPanel {
    constructor(options) {
        this.wrapper = options.wrapper;
        this.designerInstance = options.designerInstance;
        this.panelElement = null;
        this.initialized = false;
    }

    /**
     * Initialize the layers panel
     */
    initialize() {
        if (this.initialized) return;

        // Create layers panel HTML
        this.wrapper.find('.print-designer-container').append(`
            <div class="layers-panel">
                <div class="layers-panel-title">
                    ${__("Layers")}
                    <span class="layers-panel-close"><i class="fa fa-times"></i></span>
                </div>
                <div class="layers-content"></div>
            </div>
        `);

        this.panelElement = this.wrapper.find('.layers-panel');

        // Setup panel close button
        this.wrapper.find('.layers-panel-close').on('click', () => {
            this.panelElement.removeClass('show');
        });

        // Setup layers button to toggle panel
        this.wrapper.find('.navigator-btn').on('click', () => {
            this.panelElement.toggleClass('show');
            
            // Refresh the layer tree when the panel is shown
            if (this.panelElement.hasClass('show')) {
                this.render_layers();
            }
        });

        this.initialized = true;
    }

    /**
     * Render the layers tree based on the current canvas contents
     */
    render_layers() {
        const canvas = document.getElementById('print-canvas');
        const layersContent = this.wrapper.find('.layers-content');
        
        // Clear the content
        layersContent.empty();
        
        // Generate the tree from the canvas
        const treeHTML = this.generate_element_tree(canvas, 0);
        
        // Add the generated HTML to the layers panel
        layersContent.html(treeHTML);
        
        // Add click handlers to layer items
        this.bind_layer_events();
    }

    /**
     * Generate the HTML for the element tree
     * @param {HTMLElement} element - The element to generate tree for
     * @param {number} level - Current nesting level
     * @returns {string} - HTML for the element tree
     */
    generate_element_tree(element, level) {
        let html = '';
        
        // Process only the canvas element's direct children
        if (element.id === 'print-canvas') {
            // Get all direct child elements with canvas-element class
            const children = element.querySelectorAll(':scope > .canvas-element');
            
            children.forEach((child) => {
                html += this.generate_layer_item(child, level);
            });
        } else if (element.classList.contains('canvas-element')) {
            // For container elements, also process their children
            const containerElement = element.querySelector('.container-element');
            if (containerElement) {
                const children = containerElement.querySelectorAll(':scope > .canvas-element');
                
                if (children.length > 0) {
                    html += '<div class="layer-item-children">';
                    children.forEach((child) => {
                        html += this.generate_layer_item(child, level + 1);
                    });
                    html += '</div>';
                }
            }
        }
        
        return html;
    }

    /**
     * Generate the HTML for a single layer item
     * @param {HTMLElement} element - The element to generate layer item for
     * @param {number} level - Current nesting level
     * @returns {string} - HTML for the layer item
     */
    generate_layer_item(element, level) {
        // Get the element type
        const typeElement = element.querySelector('[data-type]');
        if (!typeElement) return '';
        
        const elementType = typeElement.getAttribute('data-type');
        const elementId = element.id;
        const isSelected = element.classList.contains('selected');
        
        // Determine the icon based on element type
        let icon = 'fa-question';
        let label = 'Unknown';
        
        switch (elementType) {
            case 'container':
                icon = 'fa-columns';
                label = 'Container';
                break;
            case 'text':
                icon = 'fa-font';
                label = 'Text';
                
                // Get the text content if possible
                const textElement = element.querySelector('.text-element');
                if (textElement) {
                    const textContent = textElement.textContent.trim();
                    if (textContent) {
                        label += ': ' + (textContent.length > 15 ? textContent.substring(0, 15) + '...' : textContent);
                    }
                }
                break;
            case 'heading':
                icon = 'fa-header';
                label = 'Heading';
                
                // Get the heading content if possible
                const headingElement = element.querySelector('.heading-element');
                if (headingElement) {
                    const headingContent = headingElement.textContent.trim();
                    if (headingContent) {
                        label += ': ' + (headingContent.length > 15 ? headingContent.substring(0, 15) + '...' : headingContent);
                    }
                }
                break;
            case 'image':
                icon = 'fa-image';
                label = 'Image';
                break;
            case 'qrcode':
                icon = 'fa-qrcode';
                label = 'QR Code';
                break;
            case 'field':
                // Handle field elements
                icon = 'fa-database';
                label = 'Field';
                
                // Get the field element
                const fieldElement = element.querySelector('.field-element');
                if (fieldElement) {
                    // Get the field name
                    const fieldname = fieldElement.getAttribute('data-fieldname');
                    const fieldtype = fieldElement.getAttribute('data-fieldtype');
                    
                    if (fieldname) {
                        label = 'Field: ' + fieldname;
                        
                        // Set icon based on fieldtype
                        if (fieldtype) {
                            switch (fieldtype) {
                                case 'Currency':
                                    icon = 'fa-money';
                                    break;
                                case 'Date':
                                    icon = 'fa-calendar';
                                    break;
                                case 'Int':
                                case 'Float':
                                    icon = 'fa-calculator';
                                    break;
                                case 'Check':
                                    icon = 'fa-check-square-o';
                                    break;
                                case 'Data':
                                    icon = 'fa-font';
                                    break;
                                case 'Text':
                                case 'Small Text':
                                case 'Long Text':
                                    icon = 'fa-align-left';
                                    break;
                                case 'Link':
                                    icon = 'fa-link';
                                    break;
                                case 'Select':
                                    icon = 'fa-list';
                                    break;
                                default:
                                    icon = 'fa-database';
                            }
                        }
                    }
                }
                break;
            case 'table':
                icon = 'fa-table';
                label = 'Table';
                
                // Get the table field name if possible
                const tableElement = element.querySelector('.table-element');
                if (tableElement) {
                    const fieldname = tableElement.getAttribute('data-fieldname');
                    if (fieldname) {
                        label += ': ' + fieldname;
                    }
                }
                break;
        }
        
        // Generate HTML for this item
        let html = `
            <div class="layer-item ${isSelected ? 'selected' : ''}" data-element-id="${elementId}">
                <div class="layer-item-icon">
                    <i class="fa ${icon}"></i>
                </div>
                <div class="layer-item-label">
                    ${label}
                </div>
        `;
        
        // If it's a container, check if it has children
        const containerElement = element.querySelector('.container-element');
        if (containerElement && containerElement.querySelectorAll('.canvas-element').length > 0) {
            html += `
                <div class="layer-toggle">
                    <i class="fa fa-chevron-down"></i>
                </div>
            `;
        }
        
        html += `</div>`;
        
        // Add children elements for containers
        if (elementType === 'container') {
            html += this.generate_element_tree(element, level + 1);
        }
        
        return html;
    }

    /**
     * Update a specific layer's visibility
     * @param {string} elementId - The ID of the element to update
     * @param {boolean} visible - Whether the element should be visible
     */
    update_layer_visibility(elementId, visible) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Update the element's visibility
        element.style.display = visible ? '' : 'none';
        
        // Update the layer item's appearance
        const layerItem = this.wrapper.find(`.layer-item[data-element-id="${elementId}"]`);
        if (layerItem.length) {
            if (visible) {
                layerItem.removeClass('hidden');
            } else {
                layerItem.addClass('hidden');
            }
        }
        
        // Refresh the layers panel
        this.render_layers();
    }

    /**
     * Handle layer selection events
     * @param {Event} e - The click event
     */
    handle_layer_selection(e) {
        e.stopPropagation();
        
        // Get the element ID
        const layerItem = $(e.currentTarget);
        const elementId = layerItem.data('element-id');
        if (!elementId) return;
        
        // Find the element on the canvas
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Remove selected class from all elements
        document.querySelectorAll('.canvas-element.selected, .canvas-element.table-selected').forEach(el => {
            el.classList.remove('selected');
            el.classList.remove('table-selected');
        });
        
        // Add selected class to this element
        element.classList.add('selected');
        
        // Check if it's a table element
        const tableElement = element.querySelector('.table-element');
        if (tableElement) {
            element.classList.add('table-selected');
        }
        
        // Hide layers panel and show properties panel
        this.panelElement.removeClass('show');
        
        // Show properties panel
        this.designerInstance.propertiesPanel.show_properties(element);
        
        // Update selected state in the layers panel (for when it's shown again)
        this.wrapper.find('.layer-item').removeClass('selected');
        layerItem.addClass('selected');
        
        // Scroll the canvas to make the selected element visible if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Bind events to layer items
     */
    bind_layer_events() {
        // Click on a layer item to select the corresponding element
        this.wrapper.find('.layer-item').on('click', this.handle_layer_selection.bind(this));
        
        // Toggle expansion for containers
        this.wrapper.find('.layer-toggle').on('click', (e) => {
            e.stopPropagation();
            
            const layerItem = $(e.currentTarget).closest('.layer-item');
            const children = layerItem.next('.layer-item-children');
            
            if (children.is(':visible')) {
                children.slideUp(200);
                $(e.currentTarget).find('i').removeClass('fa-chevron-down').addClass('fa-chevron-right');
            } else {
                children.slideDown(200);
                $(e.currentTarget).find('i').removeClass('fa-chevron-right').addClass('fa-chevron-down');
            }
        });
    }
}

export default LayersPanel; 