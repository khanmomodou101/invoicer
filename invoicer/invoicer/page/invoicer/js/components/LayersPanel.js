class LayersPanel {
    constructor(parent) {
        this.parent = parent;
        this.wrapper = parent.wrapper;
        this.panel = this.wrapper.find('.layers-panel');
        this.panel_content = this.wrapper.find('.layers-content');
        this.bind_events();
    }

    bind_events() {
        const me = this;
        
        // Close button for layers panel
        this.wrapper.find('.layers-panel-close').on('click', () => {
            this.hide();
        });
        
        // Navigator button for layer selection
        this.wrapper.find('.navigator-btn').on('click', () => {
            this.toggle();
        });
    }

    toggle() {
        if (this.panel.hasClass('show')) {
            this.hide();
        } else {
            // Hide properties panel if open
            this.wrapper.find('.properties-panel').removeClass('show');
            
            // Show layers panel
            this.show();
            this.generate_layers_tree();
        }
    }

    show() {
        this.panel.addClass('show');
    }

    hide() {
        this.panel.removeClass('show');
    }

    // Generate the layers tree
    generate_layers_tree() {
        const canvas = document.getElementById('print-canvas');
        this.panel_content.empty();
        
        // Generate the tree from the canvas
        const treeHTML = this.generate_element_tree(canvas, 0);
        
        // Add the generated HTML to the layers panel
        this.panel_content.html(treeHTML);
        
        // Add click handlers to layer items
        this.bind_layer_events();
    }

    // Helper method to generate the element tree
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

    generate_layer_item(element, level) {
        // Get the element type
        const typeElement = element.querySelector('[data-type]');
        if (!typeElement) return '';
        
        const elementType = typeElement.getAttribute('data-type');
        const elementId = element.id;
        
        // Check if this element is selected
        const isSelected = element.classList.contains('selected');
        
        // Generate an appropriate label and icon
        let label = elementType.charAt(0).toUpperCase() + elementType.slice(1);
        let icon = 'fa-square-o';
        
        // Set icons based on element type
        switch (elementType) {
            case 'container':
                icon = 'fa-object-group';
                break;
            case 'text':
                icon = 'fa-font';
                // Try to get a preview of the text content for label
                const textContent = element.querySelector('.text-element')?.innerText.trim();
                if (textContent && textContent.length > 0) {
                    label = textContent.length > 20 ? textContent.substring(0, 20) + '...' : textContent;
                }
                break;
            case 'heading':
                icon = 'fa-header';
                // Try to get preview of heading content
                const headingContent = element.querySelector('.heading-element')?.innerText.trim();
                if (headingContent && headingContent.length > 0) {
                    label = headingContent.length > 20 ? headingContent.substring(0, 20) + '...' : headingContent;
                }
                break;
            case 'image':
                icon = 'fa-image';
                break;
            case 'field':
                icon = 'fa-database';
                // Try to get the field name
                const fieldname = typeElement.getAttribute('data-fieldname');
                if (fieldname) {
                    label = fieldname;
                }
                break;
            case 'table':
                icon = 'fa-table';
                // Try to get the table doctype
                const doctype = typeElement.getAttribute('data-doctype');
                if (doctype) {
                    label = doctype;
                }
                break;
            case 'signature':
                icon = 'fa-pencil';
                break;
            case 'barcode':
            case 'qrcode':
                icon = 'fa-qrcode';
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

    // Bind events to layer items
    bind_layer_events() {
        const me = this;
        
        // Click on a layer item to select the corresponding element
        this.wrapper.find('.layer-item').on('click', function(e) {
            e.stopPropagation();
            
            // Get the element ID
            const elementId = $(this).data('element-id');
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
            me.hide();
            
            // Show properties panel
            me.parent.show_properties_panel(element);
            
            // Update selected state in the layers panel (for when it's shown again)
            me.wrapper.find('.layer-item').removeClass('selected');
            $(this).addClass('selected');
            
            // Scroll the canvas to make the selected element visible if needed
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        
        // Toggle expansion for containers
        this.wrapper.find('.layer-toggle').on('click', function(e) {
            e.stopPropagation();
            
            const layerItem = $(this).closest('.layer-item');
            const children = layerItem.next('.layer-item-children');
            
            if (children.is(':visible')) {
                children.slideUp(200);
                $(this).find('i').removeClass('fa-chevron-down').addClass('fa-chevron-right');
            } else {
                children.slideDown(200);
                $(this).find('i').removeClass('fa-chevron-right').addClass('fa-chevron-down');
            }
        });
    }
}

frappe.provide('frappe.invoicer.components');
frappe.invoicer.components.LayersPanel = LayersPanel; 