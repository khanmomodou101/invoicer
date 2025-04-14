/**
 * EventManager.js
 * 
 * Manages events for the print designer
 * Handles element interactions, keyboard shortcuts, and drag-and-drop
 */

class EventManager {
    constructor(options) {
        this.designerInstance = options.designerInstance;
        this.wrapper = options.wrapper;
    }

    /**
     * Initialize all event handlers
     */
    initialize() {
        this.bind_events();
        this.setup_keyboard_shortcuts();
    }

    /**
     * Bind general events for the canvas
     */
    bind_events() {
        const canvas = document.getElementById('print-canvas');
        
        // Make the canvas a drop zone
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const data = e.dataTransfer.getData('text/plain');
            
            // Get drop coordinates relative to the canvas
            const canvasRect = canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left;
            const y = e.clientY - canvasRect.top;
            
            if (data.startsWith('element:')) {
                // Handle dropping new elements
                const elementType = data.split(':')[1];
                const newElement = this.designerInstance.create_element(elementType);
                
                if (newElement) {
                    // Position the element at the drop location
                    newElement.style.position = 'absolute';
                    newElement.style.left = x + 'px';
                    newElement.style.top = y + 'px';
                    
                    // Add to the canvas
                    canvas.appendChild(newElement);
                    
                    // Add event handlers
                    this.attach_element_events(newElement);
                    
                    // Select the new element
                    document.querySelectorAll('.canvas-element.selected').forEach(el => {
                        el.classList.remove('selected');
                    });
                    newElement.classList.add('selected');
                    this.designerInstance.propertiesPanel.show_properties(newElement);
                }
            } else if (data.startsWith('field:')) {
                // Handle dropping fields
                const [_, fieldname, fieldtype, options, doctype] = data.split(':');
                const newElement = this.designerInstance.create_field_element(fieldname, fieldtype, options, doctype);
                
                if (newElement) {
                    // Position the element at the drop location
                    newElement.style.position = 'absolute';
                    newElement.style.left = x + 'px';
                    newElement.style.top = y + 'px';
                    
                    // Add to the canvas
                    canvas.appendChild(newElement);
                    
                    // Add event handlers
                    this.attach_element_events(newElement);
                    
                    // Select the new element
                    document.querySelectorAll('.canvas-element.selected').forEach(el => {
                        el.classList.remove('selected');
                    });
                    newElement.classList.add('selected');
                    this.designerInstance.propertiesPanel.show_properties(newElement);
                }
            }
        });
    }

    /**
     * Attach drag-and-drop event handlers to elements
     * @param {HTMLElement} element - The element to attach events to
     */
    attach_element_events(element) {
        // Make the element selectable
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Deselect all other elements
            document.querySelectorAll('.canvas-element.selected, .canvas-element.table-selected').forEach(el => {
                el.classList.remove('selected');
                el.classList.remove('table-selected');
            });
            
            // Select this element
            element.classList.add('selected');
            
            // Check if it's a table element
            const tableElement = element.querySelector('.table-element');
            if (tableElement) {
                element.classList.add('table-selected');
            }
            
            // Show properties panel
            this.designerInstance.propertiesPanel.show_properties(element);
        });
        
        // Add drag functionality for moving elements
        this.add_edge_drag(element);
        
        // If it contains editable content, attach content events
        const contentElement = element.querySelector('[contenteditable="true"]');
        if (contentElement) {
            this.attach_content_events(contentElement);
        }
        
        // If it's a container, add events to its children
        const containerElement = element.querySelector('.container-element');
        if (containerElement) {
            // Make it a drop zone for other elements
            containerElement.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                containerElement.classList.add('dragover');
            });
            
            containerElement.addEventListener('dragleave', (e) => {
                containerElement.classList.remove('dragover');
            });
            
            containerElement.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                containerElement.classList.remove('dragover');
                
                const data = e.dataTransfer.getData('text/plain');
                
                if (data.startsWith('element:')) {
                    // Handle dropping new elements into the container
                    const elementType = data.split(':')[1];
                    const newElement = this.designerInstance.create_element(elementType);
                    
                    if (newElement) {
                        // Remove positioning for container children
                        newElement.style.position = '';
                        newElement.style.left = '';
                        newElement.style.top = '';
                        
                        // Add to the container
                        containerElement.appendChild(newElement);
                        
                        // Add event handlers
                        this.attach_element_events(newElement);
                        
                        // Select the new element
                        document.querySelectorAll('.canvas-element.selected').forEach(el => {
                            el.classList.remove('selected');
                        });
                        newElement.classList.add('selected');
                        this.designerInstance.propertiesPanel.show_properties(newElement);
                    }
                } else if (data.startsWith('field:')) {
                    // Handle dropping fields
                    const [_, fieldname, fieldtype, options, doctype] = data.split(':');
                    const newElement = this.designerInstance.create_field_element(fieldname, fieldtype, options, doctype);
                    
                    if (newElement) {
                        // Remove positioning for container children
                        newElement.style.position = '';
                        newElement.style.left = '';
                        newElement.style.top = '';
                        
                        // Add to the container
                        containerElement.appendChild(newElement);
                        
                        // Add event handlers
                        this.attach_element_events(newElement);
                        
                        // Select the new element
                        document.querySelectorAll('.canvas-element.selected').forEach(el => {
                            el.classList.remove('selected');
                        });
                        newElement.classList.add('selected');
                        this.designerInstance.propertiesPanel.show_properties(newElement);
                    }
                } else if (data.startsWith('move:')) {
                    // Handle moving existing elements between containers
                    const elementId = data.split(':')[1];
                    const elementToMove = document.getElementById(elementId);
                    
                    if (elementToMove) {
                        // Remove positioning for container children
                        elementToMove.style.position = '';
                        elementToMove.style.left = '';
                        elementToMove.style.top = '';
                        
                        // Move to the container
                        containerElement.appendChild(elementToMove);
                        
                        // Select the moved element
                        document.querySelectorAll('.canvas-element.selected').forEach(el => {
                            el.classList.remove('selected');
                        });
                        elementToMove.classList.add('selected');
                        this.designerInstance.propertiesPanel.show_properties(elementToMove);
                    }
                }
            });
        }
    }

    /**
     * Attach edge drag functionality to an element for moving
     * @param {HTMLElement} element - The element to make draggable
     */
    add_edge_drag(element) {
        // Enable drag detection near edges
        element.addEventListener('mousemove', (e) => {
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const edgeSize = 20; // Size of the drag area near edges
            
            // Check if mouse is near any edge
            const isNearTop = y < edgeSize;
            const isNearBottom = y > rect.height - edgeSize;
            const isNearLeft = x < edgeSize;
            const isNearRight = x > rect.width - edgeSize;
            
            if (isNearTop || isNearBottom || isNearLeft || isNearRight) {
                // Near an edge, show move cursor
                element.style.cursor = 'move';
                element.classList.add('dragging-enabled');
            } else {
                // Not near an edge, use default cursor
                element.style.cursor = '';
                element.classList.remove('dragging-enabled');
            }
        });
        
        // Reset cursor when mouse leaves
        element.addEventListener('mouseleave', () => {
            element.style.cursor = '';
            element.classList.remove('dragging-enabled');
        });
        
        // Make draggable
        element.setAttribute('draggable', 'true');
        
        // Drag start event
        element.addEventListener('dragstart', (e) => {
            // Only allow dragging if near an edge
            if (!element.classList.contains('dragging-enabled')) {
                e.preventDefault();
                return;
            }
            
            e.dataTransfer.setData('text/plain', `move:${element.id}`);
            element.classList.add('dragging');
        });
        
        // Drag end event
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
        });
    }

    /**
     * Attach events to content-editable elements
     * @param {HTMLElement} content - The content-editable element
     */
    attach_content_events(content) {
        // Prevent propagation of clicks to avoid selecting the parent
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Focus/blur events to handle editing
        content.addEventListener('focus', () => {
            content.dataset.originalContent = content.textContent;
        });
        
        content.addEventListener('blur', () => {
            if (content.dataset.originalContent !== content.textContent) {
                // Content changed
                console.log('Content changed:', content.textContent);
            }
        });
    }

    /**
     * Reattach events to all elements (useful after DOM changes)
     */
    reattach_element_events() {
        const elements = document.querySelectorAll('.canvas-element');
        elements.forEach(element => {
            this.attach_element_events(element);
        });
    }

    /**
     * Set up keyboard shortcuts for common actions
     */
    setup_keyboard_shortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle if not in an input field or content-editable area
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }
            
            const selectedElement = document.querySelector('.canvas-element.selected');
            
            // Delete/Backspace: Delete selected element
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
                e.preventDefault();
                selectedElement.remove();
                this.designerInstance.propertiesPanel.hide_panel();
            }
            
            // Ctrl+S: Save design
            if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.designerInstance.save_design();
            }
            
            // Ctrl+P: Preview design
            if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.designerInstance.preview_current_design();
            }
        });
    }

    /**
     * Handle global hotkeys
     * @param {KeyboardEvent} e - The keyboard event
     */
    handle_global_hotkeys(e) {
        // Only handle if not in an input field or content-editable area
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        const selectedElement = document.querySelector('.canvas-element.selected');
        
        // Delete/Backspace: Delete selected element
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
            e.preventDefault();
            selectedElement.remove();
            this.designerInstance.propertiesPanel.hide_panel();
        }
        
        // Ctrl+S: Save design
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.designerInstance.save_design();
        }
        
        // Ctrl+P: Preview design
        if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.designerInstance.preview_current_design();
        }
    }
}

export default EventManager; 