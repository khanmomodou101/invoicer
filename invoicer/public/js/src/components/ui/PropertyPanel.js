/**
 * PropertyPanel.js
 * 
 * Manages the properties panel for the print designer
 * Displays and allows editing of element properties
 * Dynamically shows different property sets based on element type
 */

import { rgb2hex, normalizeColor, getFieldOptionsForQRCode } from '../../utils/DesignUtils.js';

class PropertyPanel {
    constructor(options) {
        this.wrapper = options.wrapper;
        this.designerInstance = options.designerInstance;
        this.panelElement = null;
        this.currentElement = null;
        this.initialized = false;
    }

    /**
     * Initialize the properties panel
     */
    initialize() {
        if (this.initialized) return;

        // Create properties panel HTML
        this.wrapper.find('.print-designer-container').append(`
            <div class="properties-panel">
                <div class="properties-panel-title">
                    ${__("Properties")}
                    <div>
                        <span class="properties-panel-delete"><i class="fa fa-trash"></i></span>
                        <span class="properties-panel-close"><i class="fa fa-times"></i></span>
                    </div>
                </div>
                <div class="properties-content"></div>
            </div>
        `);

        this.panelElement = this.wrapper.find('.properties-panel');

        // Setup close button
        this.wrapper.find('.properties-panel-close').on('click', () => {
            this.hide_panel();
        });

        // Setup delete button
        this.wrapper.find('.properties-panel-delete').on('click', () => {
            if (this.currentElement) {
                // Remove the element
                this.currentElement.remove();
                this.hide_panel();
            }
        });

        this.initialized = true;
    }

    /**
     * Show properties for a specific element
     * @param {HTMLElement} element - The element to show properties for
     */
    show_properties(element) {
        if (!element) return;
        
        this.currentElement = element;
        
        // Get the element type
        const typeElement = element.querySelector('[data-type]');
        if (!typeElement) return;
        
        const elementType = typeElement.getAttribute('data-type');
        
        // Show the properties panel
        this.panelElement.addClass('show');
        
        // Get the content container
        const contentElement = this.wrapper.find('.properties-content');
        contentElement.empty();
        
        // Generate the properties based on element type
        let propertiesHTML = '';
        
        // Common properties for all elements
        propertiesHTML += this.get_common_properties_html(element);
        
        // Element-specific properties
        switch (elementType) {
            case 'container':
                propertiesHTML += this.get_container_properties_html(element);
                break;
            case 'text':
                propertiesHTML += this.get_text_properties_html(element);
                break;
            case 'heading':
                propertiesHTML += this.get_heading_properties_html(element);
                break;
            case 'image':
                propertiesHTML += this.get_image_properties_html(element);
                break;
            case 'field':
                propertiesHTML += this.get_field_properties_html(element);
                break;
            case 'table':
                propertiesHTML += this.get_table_properties_html(element);
                break;
            case 'qrcode':
                propertiesHTML += this.get_qrcode_properties_html(element);
                break;
        }
        
        // Add the properties HTML to the panel
        contentElement.html(propertiesHTML);
        
        // Bind events for property inputs
        this.bind_property_events(element);
    }

    /**
     * Hide the properties panel
     */
    hide_panel() {
        this.panelElement.removeClass('show');
        this.currentElement = null;
    }

    /**
     * Get HTML for common properties shared by all elements
     * @param {HTMLElement} element - The element to get properties for
     * @returns {string} - HTML for common properties
     */
    get_common_properties_html(element) {
        return `
            <div class="property-group">
                <div class="property-group-title">${__("Position & Size")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Width")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="width" value="${element.style.width || 'auto'}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Height")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="height" value="${element.style.height || 'auto'}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Margin")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="margin" value="${element.style.margin || '0px'}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Padding")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="padding" value="${element.style.padding || '0px'}">
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="property-group">
                <div class="property-group-title">${__("Appearance")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Background")}</label>
                        <div class="property-control">
                            <input type="color" class="form-control" name="background-color" value="${
                                rgb2hex(element.style.backgroundColor || '#ffffff')
                            }">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Border")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="border" value="${element.style.border || 'none'}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Border Radius")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="border-radius" value="${element.style.borderRadius || '0px'}">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get HTML for container-specific properties
     * @param {HTMLElement} element - The container element
     * @returns {string} - HTML for container properties
     */
    get_container_properties_html(element) {
        const containerElement = element.querySelector('.container-element');
        const direction = containerElement ? 
            (containerElement.style.flexDirection === 'column' ? 'column' : 'row') : 'row';
        
        return `
            <div class="property-group">
                <div class="property-group-title">${__("Container Settings")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Direction")}</label>
                        <div class="property-control">
                            <select class="form-control" name="flex-direction">
                                <option value="row" ${direction === 'row' ? 'selected' : ''}>${__("Horizontal (Row)")}</option>
                                <option value="column" ${direction === 'column' ? 'selected' : ''}>${__("Vertical (Column)")}</option>
                            </select>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Justify")}</label>
                        <div class="property-control">
                            <select class="form-control" name="justify-content">
                                <option value="flex-start" ${containerElement && containerElement.style.justifyContent === 'flex-start' ? 'selected' : ''}>${__("Start")}</option>
                                <option value="center" ${containerElement && containerElement.style.justifyContent === 'center' ? 'selected' : ''}>${__("Center")}</option>
                                <option value="flex-end" ${containerElement && containerElement.style.justifyContent === 'flex-end' ? 'selected' : ''}>${__("End")}</option>
                                <option value="space-between" ${containerElement && containerElement.style.justifyContent === 'space-between' ? 'selected' : ''}>${__("Space Between")}</option>
                                <option value="space-around" ${containerElement && containerElement.style.justifyContent === 'space-around' ? 'selected' : ''}>${__("Space Around")}</option>
                            </select>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Align")}</label>
                        <div class="property-control">
                            <select class="form-control" name="align-items">
                                <option value="flex-start" ${containerElement && containerElement.style.alignItems === 'flex-start' ? 'selected' : ''}>${__("Start")}</option>
                                <option value="center" ${containerElement && containerElement.style.alignItems === 'center' ? 'selected' : ''}>${__("Center")}</option>
                                <option value="flex-end" ${containerElement && containerElement.style.alignItems === 'flex-end' ? 'selected' : ''}>${__("End")}</option>
                                <option value="stretch" ${containerElement && containerElement.style.alignItems === 'stretch' ? 'selected' : ''}>${__("Stretch")}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get HTML for text-specific properties
     * @param {HTMLElement} element - The text element
     * @returns {string} - HTML for text properties
     */
    get_text_properties_html(element) {
        const textElement = element.querySelector('.text-element');
        
        return `
            <div class="property-group">
                <div class="property-group-title">${__("Text Settings")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Font Size")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="font-size" value="${textElement ? textElement.style.fontSize || '16px' : '16px'}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Font Weight")}</label>
                        <div class="property-control">
                            <select class="form-control" name="font-weight">
                                <option value="normal" ${textElement && textElement.style.fontWeight === 'normal' ? 'selected' : ''}>${__("Normal")}</option>
                                <option value="bold" ${textElement && textElement.style.fontWeight === 'bold' ? 'selected' : ''}>${__("Bold")}</option>
                            </select>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Text Color")}</label>
                        <div class="property-control">
                            <input type="color" class="form-control" name="color" value="${
                                rgb2hex(textElement ? textElement.style.color || '#000000' : '#000000')
                            }">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Text Align")}</label>
                        <div class="property-control">
                            <select class="form-control" name="text-align">
                                <option value="left" ${textElement && textElement.style.textAlign === 'left' ? 'selected' : ''}>${__("Left")}</option>
                                <option value="center" ${textElement && textElement.style.textAlign === 'center' ? 'selected' : ''}>${__("Center")}</option>
                                <option value="right" ${textElement && textElement.style.textAlign === 'right' ? 'selected' : ''}>${__("Right")}</option>
                                <option value="justify" ${textElement && textElement.style.textAlign === 'justify' ? 'selected' : ''}>${__("Justify")}</option>
                            </select>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Line Height")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="line-height" value="${textElement ? textElement.style.lineHeight || 'normal' : 'normal'}">
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="property-group">
                <div class="property-group-title">${__("Content")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <div class="property-control">
                            <textarea class="form-control" name="content" rows="3">${textElement ? textElement.textContent : ''}</textarea>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get HTML for heading-specific properties
     * @param {HTMLElement} element - The heading element
     * @returns {string} - HTML for heading properties
     */
    get_heading_properties_html(element) {
        const headingElement = element.querySelector('.heading-element');
        
        return `
            <div class="property-group">
                <div class="property-group-title">${__("Heading Settings")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Font Size")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="font-size" value="${headingElement ? headingElement.style.fontSize || '24px' : '24px'}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Font Weight")}</label>
                        <div class="property-control">
                            <select class="form-control" name="font-weight">
                                <option value="normal" ${headingElement && headingElement.style.fontWeight === 'normal' ? 'selected' : ''}>${__("Normal")}</option>
                                <option value="bold" ${headingElement && headingElement.style.fontWeight === 'bold' ? 'selected' : ''}>${__("Bold")}</option>
                            </select>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Text Color")}</label>
                        <div class="property-control">
                            <input type="color" class="form-control" name="color" value="${
                                rgb2hex(headingElement ? headingElement.style.color || '#000000' : '#000000')
                            }">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Text Align")}</label>
                        <div class="property-control">
                            <select class="form-control" name="text-align">
                                <option value="left" ${headingElement && headingElement.style.textAlign === 'left' ? 'selected' : ''}>${__("Left")}</option>
                                <option value="center" ${headingElement && headingElement.style.textAlign === 'center' ? 'selected' : ''}>${__("Center")}</option>
                                <option value="right" ${headingElement && headingElement.style.textAlign === 'right' ? 'selected' : ''}>${__("Right")}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="property-group">
                <div class="property-group-title">${__("Content")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <div class="property-control">
                            <input type="text" class="form-control" name="content" value="${headingElement ? headingElement.textContent : ''}">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get HTML for image-specific properties
     * @param {HTMLElement} element - The image element
     * @returns {string} - HTML for image properties
     */
    get_image_properties_html(element) {
        const imgElement = element.querySelector('.image-element img');
        
        return `
            <div class="property-group">
                <div class="property-group-title">${__("Image Settings")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Image URL")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="src" value="${imgElement ? imgElement.src : ''}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Alt Text")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="alt" value="${imgElement ? imgElement.alt : ''}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Object Fit")}</label>
                        <div class="property-control">
                            <select class="form-control" name="object-fit">
                                <option value="contain" ${imgElement && imgElement.style.objectFit === 'contain' ? 'selected' : ''}>${__("Contain")}</option>
                                <option value="cover" ${imgElement && imgElement.style.objectFit === 'cover' ? 'selected' : ''}>${__("Cover")}</option>
                                <option value="fill" ${imgElement && imgElement.style.objectFit === 'fill' ? 'selected' : ''}>${__("Fill")}</option>
                                <option value="scale-down" ${imgElement && imgElement.style.objectFit === 'scale-down' ? 'selected' : ''}>${__("Scale Down")}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get HTML for field-specific properties
     * @param {HTMLElement} element - The field element
     * @returns {string} - HTML for field properties
     */
    get_field_properties_html(element) {
        const fieldElement = element.querySelector('.field-element');
        
        if (!fieldElement) return '';
        
        const fieldname = fieldElement.getAttribute('data-fieldname');
        const fieldtype = fieldElement.getAttribute('data-fieldtype');
        
        // Get current styles or set defaults if not defined
        const fontSize = fieldElement.style.fontSize || '16px';
        const fontWeight = fieldElement.style.fontWeight || 'normal';
        const color = fieldElement.style.color || '#000000';
        const textAlign = fieldElement.style.textAlign || 'left';
        const lineHeight = fieldElement.style.lineHeight || 'normal';
        
        return `
            <div class="property-group">
                <div class="property-group-title">${__("Field Settings")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Field")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="fieldname" value="${fieldname}" readonly>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Type")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="fieldtype" value="${fieldtype}" readonly>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Font Size")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="font-size" value="${fontSize}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Line Height")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="line-height" value="${lineHeight}">
                            <div class="text-muted small">${__("E.g. 1.5, 200%, 24px or normal")}</div>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Font Weight")}</label>
                        <div class="property-control">
                            <select class="form-control" name="font-weight">
                                <option value="normal" ${fontWeight === 'normal' ? 'selected' : ''}>${__("Normal")}</option>
                                <option value="bold" ${fontWeight === 'bold' ? 'selected' : ''}>${__("Bold")}</option>
                            </select>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Text Color")}</label>
                        <div class="property-control">
                            <input type="color" class="form-control" name="color" value="${
                                rgb2hex(color || '#000000')
                            }">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Text Align")}</label>
                        <div class="property-control">
                            <select class="form-control" name="text-align">
                                <option value="left" ${textAlign === 'left' ? 'selected' : ''}>${__("Left")}</option>
                                <option value="center" ${textAlign === 'center' ? 'selected' : ''}>${__("Center")}</option>
                                <option value="right" ${textAlign === 'right' ? 'selected' : ''}>${__("Right")}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get HTML for table-specific properties
     * @param {HTMLElement} element - The table element
     * @returns {string} - HTML for table properties
     */
    get_table_properties_html(element) {
        const tableElement = element.querySelector('.table-element');
        
        if (!tableElement) return '';
        
        const fieldname = tableElement.getAttribute('data-fieldname');
        let rowStyles = {};
        
        try {
            rowStyles = JSON.parse(tableElement.getAttribute('data-row-styles') || '{}');
        } catch (e) {
            console.error("Error parsing row styles", e);
        }
        
        return `
            <div class="property-group">
                <div class="property-group-title">${__("Table Settings")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Field")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="fieldname" value="${fieldname}" readonly>
                        </div>
                    </div>
                    <div class="property-row">
                        <div class="property-control">
                            <button class="btn btn-default btn-sm btn-configure-table">
                                <i class="fa fa-table"></i> ${__("Configure Table")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="property-group">
                <div class="property-group-title">${__("Cell Styles")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Font Size")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="table-font-size" value="${rowStyles.fontSize || '14px'}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Font Weight")}</label>
                        <div class="property-control">
                            <select class="form-control" name="table-font-weight">
                                <option value="normal" ${rowStyles.fontWeight === 'normal' ? 'selected' : ''}>${__("Normal")}</option>
                                <option value="bold" ${rowStyles.fontWeight === 'bold' ? 'selected' : ''}>${__("Bold")}</option>
                            </select>
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Text Color")}</label>
                        <div class="property-control">
                            <input type="color" class="form-control" name="table-color" value="${
                                rgb2hex(rowStyles.color || '#000000')
                            }">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Background")}</label>
                        <div class="property-control">
                            <input type="color" class="form-control" name="table-background-color" value="${
                                rgb2hex(rowStyles.backgroundColor || '#ffffff')
                            }">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Padding")}</label>
                        <div class="property-control">
                            <input type="text" class="form-control" name="table-padding" value="${rowStyles.padding || '8px'}">
                        </div>
                    </div>
                    <div class="property-row">
                        <label>${__("Text Align")}</label>
                        <div class="property-control">
                            <select class="form-control" name="table-text-align">
                                <option value="left" ${rowStyles.textAlign === 'left' ? 'selected' : ''}>${__("Left")}</option>
                                <option value="center" ${rowStyles.textAlign === 'center' ? 'selected' : ''}>${__("Center")}</option>
                                <option value="right" ${rowStyles.textAlign === 'right' ? 'selected' : ''}>${__("Right")}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get HTML for QR code-specific properties
     * @param {HTMLElement} element - The QR code element
     * @returns {string} - HTML for QR code properties
     */
    get_qrcode_properties_html(element) {
        const qrcodeElement = element.querySelector('.qrcode-element');
        const qrValue = qrcodeElement ? qrcodeElement.getAttribute('data-value') || '{{ doc.name }}' : '{{ doc.name }}';
        const qrSize = qrcodeElement ? qrcodeElement.getAttribute('data-size') || '150' : '150';
        const qrColor = qrcodeElement ? qrcodeElement.getAttribute('data-color') || '000000' : '000000';
        const qrBgColor = qrcodeElement ? qrcodeElement.getAttribute('data-bg-color') || 'FFFFFF' : 'FFFFFF';
        const qrErrorCorrection = qrcodeElement ? qrcodeElement.getAttribute('data-error-correction') || 'H' : 'H';
        
        return `
            <div class="property-group">
                <div class="property-group-title">${__("QR Code Settings")}</div>
                <div class="property-group-content">
                    <div class="property-row">
                        <label>${__("Document Field")}</label>
                        <div class="property-control">
                            <select class="form-control" name="qrcode-value">
                                <option value="{{ doc.name }}" ${qrValue === '{{ doc.name }}' ? 'selected' : ''}>${__("Document Name (doc.name)")}</option>
                                ${this.generate_field_options_for_qrcode(qrValue)}
                            </select>
                            <div class="text-muted small mt-1">
                                ${__("This field value will be used in the QR code")}
                            </div>
                        </div>
                    </div>
                    
                    <div class="property-row">
                        <label>${__("Size (px)")}</label>
                        <div class="property-control">
                            <input type="number" class="form-control" name="qrcode-size" value="${qrSize}" min="50" max="500">
                        </div>
                    </div>
                    
                    <div class="property-row">
                        <label>${__("Error Correction")}</label>
                        <div class="property-control">
                            <select class="form-control" name="qrcode-error-correction">
                                <option value="L" ${qrErrorCorrection === 'L' ? 'selected' : ''}>Low (7%)</option>
                                <option value="M" ${qrErrorCorrection === 'M' ? 'selected' : ''}>Medium (15%)</option>
                                <option value="Q" ${qrErrorCorrection === 'Q' ? 'selected' : ''}>Quartile (25%)</option>
                                <option value="H" ${qrErrorCorrection === 'H' ? 'selected' : ''}>High (30%)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="property-row">
                        <label>${__("Color")}</label>
                        <div class="property-control">
                            <input type="color" class="form-control" name="qrcode-color" value="#${qrColor}">
                        </div>
                    </div>
                    
                    <div class="property-row">
                        <label>${__("Background")}</label>
                        <div class="property-control">
                            <input type="color" class="form-control" name="qrcode-bg-color" value="#${qrBgColor}">
                        </div>
                    </div>
                    
                    <div class="property-row">
                        <div class="text-muted small">
                            ${__("QR code preview shows sample data. The actual QR code will use the selected field value.")}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate options for QR code field selection
     * @param {string} currentValue - Current selected field template
     * @returns {string} - HTML options string
     */
    generate_field_options_for_qrcode(currentValue) {
        let optionsHtml = '';
        
        // Add document fields from the main doctype if available
        if (this.designerInstance.docFields && this.designerInstance.docFields.length) {
            // Focus on text-like fields that make sense in QR codes
            const suitableFieldTypes = ['Data', 'Link', 'Dynamic Link', 'Int', 'Float', 'Currency', 'Email', 'Phone', 'URL'];
            
            // First add standard fields
            this.designerInstance.docFields.forEach(field => {
                if (suitableFieldTypes.includes(field.fieldtype)) {
                    const template = `{{ doc.${field.fieldname} }}`;
                    optionsHtml += `<option value="${template}" ${currentValue === template ? 'selected' : ''}>${field.label}</option>`;
                }
            });
        }
        
        // If current value is not in the list but is a valid template, add it as custom option
        if (currentValue && 
            currentValue !== '{{ doc.name }}' && 
            currentValue.includes('{{') && 
            currentValue.includes('}}') && 
            !optionsHtml.includes(`value="${currentValue}"`)) {
            
            const fieldPath = currentValue.match(/{{(.*?)}}/)[1].trim();
            optionsHtml += `<option value="${currentValue}" selected>${__('Custom Field')}: ${fieldPath}</option>`;
        }
        
        return optionsHtml;
    }

    /**
     * Create an input field for a specific property type
     * @param {string} fieldtype - The type of field to create
     * @param {string} fieldname - The name of the field
     * @param {string} value - The current value of the field
     * @returns {HTMLElement} - The created input element
     */
    create_input_for_type(fieldtype, fieldname, value) {
        let input;
        
        switch (fieldtype) {
            case 'text':
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-control';
                input.name = fieldname;
                input.value = value || '';
                break;
                
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.className = 'form-control';
                input.name = fieldname;
                input.value = value || 0;
                break;
                
            case 'select':
                input = document.createElement('select');
                input.className = 'form-control';
                input.name = fieldname;
                break;
                
            case 'color':
                input = document.createElement('input');
                input.type = 'color';
                input.className = 'form-control';
                input.name = fieldname;
                input.value = normalizeColor(value || '#000000');
                break;
                
            case 'checkbox':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'form-check-input';
                input.name = fieldname;
                input.checked = value === true || value === 'true' || value === 1;
                break;
                
            case 'textarea':
                input = document.createElement('textarea');
                input.className = 'form-control';
                input.name = fieldname;
                input.rows = 3;
                input.value = value || '';
                break;
                
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-control';
                input.name = fieldname;
                input.value = value || '';
        }
        
        return input;
    }

    /**
     * Update a property value for the current element
     * @param {string} propName - The name of the property to update
     * @param {any} value - The new value for the property
     */
    update_property(propName, value) {
        if (!this.currentElement) return;
        
        // Get the actual element to modify based on property name
        let targetElement = this.currentElement;
        
        // Special handling for certain elements
        const typeElement = this.currentElement.querySelector('[data-type]');
        if (!typeElement) return;
        
        const elementType = typeElement.getAttribute('data-type');
        
        switch (elementType) {
            case 'container':
                if (['flex-direction', 'justify-content', 'align-items'].includes(propName)) {
                    targetElement = this.currentElement.querySelector('.container-element');
                }
                break;
                
            case 'text':
                if (['font-size', 'font-weight', 'color', 'text-align', 'line-height'].includes(propName)) {
                    targetElement = this.currentElement.querySelector('.text-element');
                } else if (propName === 'content') {
                    const textElement = this.currentElement.querySelector('.text-element');
                    if (textElement) {
                        textElement.textContent = value;
                    }
                    return;
                }
                break;
                
            case 'heading':
                if (['font-size', 'font-weight', 'color', 'text-align'].includes(propName)) {
                    targetElement = this.currentElement.querySelector('.heading-element');
                } else if (propName === 'content') {
                    const headingElement = this.currentElement.querySelector('.heading-element');
                    if (headingElement) {
                        headingElement.textContent = value;
                    }
                    return;
                }
                break;
                
            case 'image':
                if (propName === 'src' || propName === 'alt') {
                    const imgElement = this.currentElement.querySelector('.image-element img');
                    if (imgElement) {
                        imgElement[propName] = value;
                    }
                    return;
                } else if (propName === 'object-fit') {
                    targetElement = this.currentElement.querySelector('.image-element img');
                }
                break;
                
            case 'field':
                if (['font-size', 'font-weight', 'color', 'text-align', 'line-height'].includes(propName)) {
                    targetElement = this.currentElement.querySelector('.field-element');
                    if (targetElement) {
                        // Directly apply the style to the field element
                        targetElement.style[propName] = value;
                        console.log(`Applied ${propName}=${value} to field element`);
                    }
                    return;
                }
                break;
                
            case 'table':
                if (propName.startsWith('table-')) {
                    // Handle table row styles
                    const tableElement = this.currentElement.querySelector('.table-element');
                    if (tableElement) {
                        const propKey = propName.replace('table-', '');
                        let rowStyles = {};
                        
                        try {
                            rowStyles = JSON.parse(tableElement.getAttribute('data-row-styles') || '{}');
                        } catch (e) {
                            console.error("Error parsing row styles", e);
                        }
                        
                        rowStyles[propKey] = value;
                        tableElement.setAttribute('data-row-styles', JSON.stringify(rowStyles));
                        
                        // Update the table preview
                        this.designerInstance.update_table_preview(
                            tableElement,
                            JSON.parse(tableElement.getAttribute('data-all-fields') || '[]'),
                            JSON.parse(tableElement.getAttribute('data-selected-fields') || '[]')
                        );
                    }
                    return;
                }
                break;
                
            case 'qrcode':
                if (propName === 'qrcode-value') {
                    const qrcodeElement = this.currentElement.querySelector('.qrcode-element');
                    if (qrcodeElement) {
                        // Store the value
                        qrcodeElement.setAttribute('data-value', value);
                        // Update QR code
                        this.update_qrcode_preview(qrcodeElement);
                    }
                    return;
                } else if (propName === 'qrcode-size') {
                    const qrcodeElement = this.currentElement.querySelector('.qrcode-element');
                    if (qrcodeElement) {
                        // Store the size
                        qrcodeElement.setAttribute('data-size', value);
                        // Update QR code
                        this.update_qrcode_preview(qrcodeElement);
                    }
                    return;
                } else if (propName === 'qrcode-error-correction') {
                    const qrcodeElement = this.currentElement.querySelector('.qrcode-element');
                    if (qrcodeElement) {
                        // Store the error correction level
                        qrcodeElement.setAttribute('data-error-correction', value);
                        // Update QR code
                        this.update_qrcode_preview(qrcodeElement);
                    }
                    return;
                } else if (propName === 'qrcode-color') {
                    const qrcodeElement = this.currentElement.querySelector('.qrcode-element');
                    if (qrcodeElement) {
                        // Store the color (without # prefix)
                        qrcodeElement.setAttribute('data-color', value.replace('#', ''));
                        // Update QR code
                        this.update_qrcode_preview(qrcodeElement);
                    }
                    return;
                } else if (propName === 'qrcode-bg-color') {
                    const qrcodeElement = this.currentElement.querySelector('.qrcode-element');
                    if (qrcodeElement) {
                        // Store the background color (without # prefix)
                        qrcodeElement.setAttribute('data-bg-color', value.replace('#', ''));
                        // Update QR code
                        this.update_qrcode_preview(qrcodeElement);
                    }
                    return;
                }
                break;
        }
        
        // Apply the style to the target element
        targetElement.style[propName] = value;
    }

    /**
     * Bind event handlers to property inputs
     * @param {HTMLElement} element - The element whose properties are being edited
     */
    bind_property_events(element) {
        const me = this;
        
        // Bind events for text inputs and select elements
        this.wrapper.find('.property-control input, .property-control select, .property-control textarea').on('change', function() {
            const propName = $(this).attr('name');
            const propValue = $(this).val();
            
            me.update_property(propName, propValue);
        });
        
        // Special handling for the table configure button
        this.wrapper.find('.btn-configure-table').on('click', function() {
            me.designerInstance.configure_table(element);
        });
    }

    /**
     * Update QR code preview
     * @param {HTMLElement} qrcodeElement - The QR code element to update
     */
    update_qrcode_preview(qrcodeElement) {
        if (!qrcodeElement) return;
        
        // Get QR code parameters
        const qrValue = qrcodeElement.getAttribute('data-value') || '{{ doc.name }}';
        const qrSize = qrcodeElement.getAttribute('data-size') || '150';
        const qrErrorCorrection = qrcodeElement.getAttribute('data-error-correction') || 'H';
        const qrColor = qrcodeElement.getAttribute('data-color') || '000000';
        const qrBgColor = qrcodeElement.getAttribute('data-bg-color') || 'FFFFFF';
        
        // For preview, we'll always use a placeholder value to make it clear it's a preview
        const previewValue = "Preview QR Code";
        
        // Generate the QR code URL for the preview
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(previewValue)}&size=${qrSize}x${qrSize}&ecc=${qrErrorCorrection}&color=${qrColor}&bgcolor=${qrBgColor}`;
        
        // Clear existing content and add the image
        const qrDisplayElement = qrcodeElement.querySelector('.qrcode-display');
        if (qrDisplayElement) {
            qrDisplayElement.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="width:${qrSize}px;height:${qrSize}px;"/>`;
        } else {
            qrcodeElement.innerHTML = `
                <div class="qrcode-display" style="width: ${qrSize}px; height: ${qrSize}px; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                    <img src="${qrUrl}" alt="QR Code" style="width:${qrSize}px;height:${qrSize}px;"/>
                </div>
            `;
        }
        
        // Store a simple HTML template for the actual print format
        // Always use {{ doc.name }} as the default if the value isn't already a template
        let templateValue = qrValue;
        if (!templateValue.includes('{{') && !templateValue.includes('}}')) {
            templateValue = '{{ doc.name }}';
        }
        
        // Create a simple, clean image tag
        const actualHtml = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${templateValue}&size=${qrSize}x${qrSize}" alt="QR Code" style="width:${qrSize}px;height:${qrSize}px;"/>`;
        qrcodeElement.setAttribute('data-html-template', actualHtml);
    }
}

export default PropertyPanel; 