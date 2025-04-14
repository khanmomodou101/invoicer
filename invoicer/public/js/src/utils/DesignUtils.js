/**
 * DesignUtils.js
 * 
 * Utility functions for the print designer
 * Contains helper methods for working with colors, layouts, and other design elements
 */

/**
 * Convert RGB color string to hex format
 * @param {string} rgb - RGB color string (e.g., "rgb(255, 0, 0)")
 * @returns {string} - Hex color string (e.g., "#FF0000")
 */
export function rgb2hex(rgb) {
    if (!rgb) return '#000000';
    
    // Check if already a hex color
    if (rgb.startsWith('#')) {
        return rgb;
    }
    
    // Extract RGB values
    let rgbRegex = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/;
    let rgbaRegex = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/;
    
    let rgbMatch = rgb.match(rgbRegex);
    let rgbaMatch = rgb.match(rgbaRegex);
    
    if (rgbMatch) {
        return "#" + hex(parseInt(rgbMatch[1])) + hex(parseInt(rgbMatch[2])) + hex(parseInt(rgbMatch[3]));
    } else if (rgbaMatch) {
        return "#" + hex(parseInt(rgbaMatch[1])) + hex(parseInt(rgbaMatch[2])) + hex(parseInt(rgbaMatch[3]));
    }
    
    // Default fallback
    return "#000000";
    
    // Helper function to convert decimal to hex
    function hex(x) {
        return ("0" + x.toString(16)).slice(-2).toUpperCase();
    }
}

/**
 * Normalize color to a standard format
 * @param {string} color - Color string in any format
 * @returns {string} - Normalized color string
 */
export function normalizeColor(color) {
    if (!color) return '#000000';
    
    if (color.startsWith('rgb')) {
        return rgb2hex(color);
    }
    
    if (color.startsWith('#')) {
        // Ensure 6-digit hex (convert 3-digit if needed)
        if (color.length === 4) {
            return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        }
        return color;
    }
    
    // Named colors - add more as needed
    const namedColors = {
        'black': '#000000',
        'white': '#FFFFFF',
        'red': '#FF0000',
        'green': '#008000',
        'blue': '#0000FF',
        'yellow': '#FFFF00',
    };
    
    if (namedColors[color.toLowerCase()]) {
        return namedColors[color.toLowerCase()];
    }
    
    // Default fallback
    return '#000000';
}

/**
 * Generate a unique ID for elements
 * @returns {string} - Unique ID
 */
export function generateUniqueId() {
    return 'element_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get field placeholder based on field type
 * @param {string} fieldtype - The type of the field
 * @returns {string} - Placeholder text for the field type
 */
export function getFieldPlaceholder(fieldtype) {
    switch (fieldtype) {
        case 'Data':
        case 'Link':
        case 'Dynamic Link':
            return 'Text Value';
        case 'Int':
        case 'Float':
            return '0';
        case 'Currency':
            return '0.00';
        case 'Percent':
            return '0%';
        case 'Date':
            return 'YYYY-MM-DD';
        case 'Datetime':
            return 'YYYY-MM-DD HH:MM:SS';
        case 'Time':
            return 'HH:MM:SS';
        case 'Text':
        case 'Small Text':
        case 'Long Text':
        case 'Text Editor':
        case 'Markdown Editor':
            return 'Text Content';
        case 'Check':
            return '✓';
        case 'Select':
            return 'Option';
        case 'Image':
            return 'Image';
        case 'Attach':
        case 'Attach Image':
            return 'File';
        case 'Barcode':
            return 'Barcode';
        case 'Color':
            return 'Color';
        case 'Signature':
            return 'Signature';
        case 'Rating':
            return '★★★☆☆';
        case 'Table':
        case 'Table MultiSelect':
            return 'Table Data';
        default:
            return 'Field Value';
    }
}

/**
 * Get options for QR code field selection
 * @param {string} currentValue - Current selected field value
 * @returns {Array} - Array of field options for QR code
 */
export function getFieldOptionsForQRCode(currentValue, docFields) {
    let options = [
        { value: 'name', label: __('Document Name') }
    ];
    
    // Add actual fields from the document
    if (docFields && docFields.length) {
        const validFieldTypes = ['Data', 'Link', 'Dynamic Link', 'Int', 'Float', 'Currency'];
        
        docFields.forEach(field => {
            if (validFieldTypes.includes(field.fieldtype)) {
                options.push({
                    value: field.fieldname,
                    label: `${field.label} (${field.fieldname})`
                });
            }
        });
    }
    
    // Add custom option if current value isn't in the list
    if (currentValue && currentValue !== 'name' && !options.find(opt => opt.value === currentValue)) {
        options.push({
            value: currentValue,
            label: __('Custom: {0}', [currentValue])
        });
    }
    
    return options;
}

/**
 * Apply container direction to a container element
 * @param {HTMLElement} container - The container element
 * @param {string} direction - The direction to apply (row or column)
 */
export function applyContainerDirection(container, direction) {
    if (!container) return;
    
    // Update the container's flex direction
    container.style.flexDirection = direction;
    
    // Update visual indicators
    container.classList.remove('horizontal-container', 'vertical-container');
    container.classList.add(direction === 'column' ? 'vertical-container' : 'horizontal-container');
    
    // Update the container's children based on the new direction
    const children = container.querySelectorAll(':scope > .canvas-element');
    
    children.forEach(child => {
        if (direction === 'column') {
            // For vertical layout, set width to 100% and clear height
            child.style.width = '100%';
            child.style.height = '';
        } else {
            // For horizontal layout, distribute width and set height to 100%
            child.style.width = (100 / children.length) + '%';
            child.style.height = '100%';
        }
    });
}

export default {
    rgb2hex,
    normalizeColor,
    generateUniqueId,
    getFieldPlaceholder,
    getFieldOptionsForQRCode,
    applyContainerDirection
}; 