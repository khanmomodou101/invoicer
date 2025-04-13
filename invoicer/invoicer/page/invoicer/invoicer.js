frappe.pages['invoicer'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Print Designer',
		single_column: true
	});

	frappe.print_designer = new frappe.PrintDesigner(page);
	frappe.breadcrumbs.add("Invoicer", "Print Designer");
}

frappe.pages['invoicer'].on_page_show = function(wrapper) {
	var route = frappe.get_route();
	if (route.length > 1) {
		// Load existing design if in route
		frappe.model.with_doc("Print Design", route[1], function() {
			frappe.print_designer.load_design(route[1]);
		});
	} else if (frappe.route_options) {
		if (frappe.route_options.make_new) {
			// Create new design with specified options
			frappe.print_designer.setup_new_design(
				frappe.route_options.doctype, 
				frappe.route_options.name
			);
			frappe.route_options = null;
		} else if (frappe.route_options.doc) {
			// Use provided doc
			frappe.print_designer.print_design = frappe.route_options.doc;
			frappe.route_options = null;
			frappe.print_designer.refresh();
		}
	} else {
		// Show start page
		frappe.print_designer.show_start();
	}
}

frappe.PrintDesigner = class PrintDesigner {
	constructor(page) {
		this.page = page;
		this.wrapper = $(page.body);
		this.sidebar = $(page.sidebar);
		
		// Initialize handle_drop method
		this.handle_drop = (e) => {
			e.preventDefault();
			e.stopPropagation();
			
			const container = e.target.closest('.container-element');
			if (!container || container.hasAttribute('data-processing')) return;
			
			container.setAttribute('data-processing', 'true');
			container.classList.remove('drag-over');
			
			// Remove any placeholder before adding the new element
			const placeholder = container.querySelector('.container-placeholder');
			if (placeholder) {
				placeholder.remove();
			}
			
			const data = e.dataTransfer.getData('text/plain');
			let element;
			
			if (data.startsWith('new:')) {
				// Creating a new element from sidebar
				const elementType = data.replace('new:', '');
				element = this.create_element(elementType);
			} else if (data.startsWith('field:')) {
				// Creating a field element
				const parts = data.split(':');
				const fieldname = parts[1];
				const fieldtype = parts[2];
				const options = parts[3];
				const doctype = parts[4] || this.doctype; // Get doctype info, fallback to main doctype
				
				element = this.create_field_element(fieldname, fieldtype, options, doctype);
			} else {
				// Moving an existing element
				const sourceElement = document.getElementById(data);
				if (sourceElement) {
					// Check if we're not trying to drop a container inside itself or its children
					if (sourceElement.contains(container)) {
						console.log("Cannot drop a container inside itself");
						setTimeout(() => {
							container.removeAttribute('data-processing');
						}, 100);
						return;
					}
					
					// Clone the element if it's being moved
					element = sourceElement.cloneNode(true);
					
					// Remove the original element
					sourceElement.remove();
					
					// Reattach event listeners to the cloned element
					this.attach_element_events(element);
					
					// Also attach events to any text/heading elements inside
					const contentElements = element.querySelectorAll('.text-element, .heading-element');
					contentElements.forEach(content => {
						// Ensure text editing works for content elements
						this.attach_content_events(content);
					});
					
					// If it's a container element, reattach container events to all nested containers
					const nestedContainers = element.querySelectorAll('.container-element');
					nestedContainers.forEach(nestedContainer => {
						this.attach_container_events(nestedContainer);
					});
				}
			}
			
			if (element) {
				// Add the element to the container
				container.appendChild(element);
				
				// Apply container's direction to position the element
				this.apply_container_direction(container);
			}
			
			setTimeout(() => {
				container.removeAttribute('data-processing');
			}, 100);
		};
		
		this.setup_page();
	}

	setup_page() {
		// Set title
		this.page.set_title(__('Invoice Designer'));
		
		// Add CSS
		this.add_custom_css();
		
		// Set primary action
		this.page.set_primary_action(__('Save'), () => {
			this.save_design();
		});
		
		// Add menu items
		this.page.add_menu_item(__('Print Design List'), () => {
			this.show_start();
		});
		
		// Load the required libraries
		this.load_libraries()
			.then(() => {
				// Show start screen
				this.show_start();
			})
			.catch(err => {
				console.error('Error loading libraries:', err);
				frappe.throw(__('Failed to load required libraries'));
			});
	}

	load_libraries() {
		return new Promise((resolve, reject) => {
			// Load QRious library for QR code generation
			$.getScript('https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js')
				.done(() => {
					console.log("QRious library loaded successfully");
					resolve();
				})
				.fail((jqxhr, settings, exception) => {
					console.error('Failed to load QRious library:', exception);
					reject(exception);
				});
		});
	}

	add_custom_css() {
		frappe.dom.set_style(`
			.print-designer-container {
				display: flex;
				height: calc(100vh - 140px);
				background: var(--bg-light);
				margin: -15px;
				padding: 15px;
				gap: 15px;
			}
			
			.canvas-element.table-selected {
				border-color: var(--blue);
				background-color: rgba(var(--blue-rgb), 0.05);
				box-shadow: 0 0 5px rgba(var(--blue-rgb), 0.2);
			}
			
			.canvas-element.table-selected .table-element {
				background-color: rgba(var(--blue-rgb), 0.1);
				border-radius: 4px;
				padding: 4px;
			}
			
			/* Container styling */
			.container-element {
				min-height: auto;
			}
			
			/* When container is empty */
			.container-element:empty {
				min-height: 60px; /* Minimal height when empty */
			}
			
			/* Placeholder in containers */
			.container-placeholder {
				min-height: 40px;
				display: flex;
				align-items: center;
				justify-content: center;
			}
			
			/* Properties panel delete button */
			.properties-panel-delete {
				cursor: pointer;
				color: var(--text-muted);
				margin-right: 10px;
			}
			
			.properties-panel-delete:hover {
				color: var(--red);
			}
			
			/* Resizable table columns */
			.table-element table {
				table-layout: fixed;
				width: 100% !important;
			}
			
			.table-element th {
				position: relative;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			
			.table-element th .column-resizer {
				position: absolute;
				top: 0;
				right: 0;
				width: 5px;
				height: 100%;
				cursor: col-resize;
				background-color: rgba(0, 0, 0, 0.05);
			}
			
			.table-element th .column-resizer:hover,
			.table-element th .column-resizer.resizing {
				background-color: var(--primary);
			}
			
			/* Layers Panel */
			.layers-panel {
				position: fixed;
				right: 20px;
				top: 60px;
				width: 300px;
				background: var(--bg-white);
				border: 1px solid var(--border-color);
				border-radius: 6px;
				padding: 15px;
				box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
				z-index: 1000;
				max-height: calc(100vh - 120px);
				overflow-y: auto;
				display: none;
			}
			
			.layers-panel.show {
				display: block;
			}
			
			.layers-panel-title {
				font-weight: 600;
				margin-bottom: 15px;
				padding-bottom: 8px;
				border-bottom: 1px solid var(--border-color);
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			
			.layers-panel-close {
				cursor: pointer;
				color: var(--text-muted);
			}
			
			.layers-panel-close:hover {
				color: var(--text-color);
			}
			
			.layer-item {
				padding: 8px 10px;
				border: 1px solid var(--border-color);
				border-radius: 4px;
				margin-bottom: 5px;
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 8px;
				transition: all 0.2s;
			}
			
			.layer-item:hover {
				background-color: var(--bg-light);
			}
			
			.layer-item.selected {
				border-color: var(--primary);
				background-color: rgba(var(--primary-rgb), 0.05);
			}
			
			.layer-item-icon {
				color: var(--text-muted);
				width: 20px;
				text-align: center;
			}
			
			.layer-item-label {
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			
			.layer-item-children {
				margin-left: 20px;
				margin-top: 5px;
			}
			
			.layer-toggle {
				width: 16px;
				height: 16px;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
			}
			
			/* Other existing styles... */
		`);

		// Additional dynamic CSS that's not in the CSS file
		$('head').append(`
			<style>
				.print-canvas {
					background: white;
					padding: 20px;
					box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
					min-height: 100%;
					position: relative;
				}
			</style>
		`);

		// Add styles for the editor
		let style = document.createElement('style');
		style.textContent = `
			/* ... existing styles ... */
			
			.quick-help-section {
				padding: 10px;
				color: var(--text-muted);
			}
			
			.sidebar-label {
				font-size: 12px;
				margin-bottom: 8px;
				font-weight: 600;
			}
			
			.quick-help-list {
				list-style: none;
				padding-left: 0;
				font-size: 12px;
			}
			
			.quick-help-list li {
				margin-bottom: 8px;
				display: flex;
				align-items: center;
			}
			
			.quick-help-list li i {
				margin-right: 8px;
				min-width: 14px;
				text-align: center;
			}
			
			/* Properties panel delete button styling */
			.properties-panel-delete {
				cursor: pointer;
				color: #ff5858;
				margin-right: 10px;
				padding: 2px 6px;
				border-radius: 3px;
				transition: all 0.3s ease;
			}
			
			.properties-panel-delete:hover {
				background-color: #ffeeee;
				color: #ff3333;
			}
			
			.properties-panel-delete i {
				font-size: 14px;
			}
		`;
		document.head.appendChild(style);
	}

	show_start() {
		// Clear the wrapper
		this.wrapper.empty();
		
		// Update page actions
		this.page.clear_primary_action();
		this.page.clear_secondary_action();
		
		this.page.set_primary_action(__('New Format'), () => {
			this.show_new_format_dialog();
		});
		
		// Load the design list
		this.load_print_list();
	}

	load_print_list() {
		frappe.call({
			method: 'invoicer.invoicer.page.invoicer.invoicer.get_invoice_designs',
			freeze: true,
			freeze_message: __("Loading designs..."),
			callback: (r) => {
				if (r.message) {
					const designs = r.message;
					let html = `
						<div class="print-list-view">
							<div class="toolbar">
								<div class="flex flex-wrap justify-between w-full">
									<h5 class="m-0">${__("Your Print Designs")}</h5>
								</div>
							</div>
							
							<div class="frappe-list">
								<div class="list-row list-row-head text-muted small">
									<div class="row">
										<div class="col-5">${__("Design Name")}</div>
										<div class="col-3">${__("Reference DocType")}</div>
										<div class="col-2">${__("Last Modified")}</div>
										<div class="col-2">${__("Actions")}</div>
									</div>
								</div>
								<div class="result">
					`;

					if (designs.length === 0) {
						html += `
							<div class="no-content">
								<i class="fa fa-file-o"></i>
								<p>${__("No print designs found. Click 'New Format' to create one.")}</p>
							</div>
						`;
					} else {
					designs.forEach(design => {
							const isDefault = design.is_default ? 
								`<span class="indicator-pill green">${__("Default")}</span>` : '';
								
						html += `
							<div class="list-row small">
								<div class="row">
										<div class="col-5">
											${design.design_name} ${isDefault}
										</div>
									<div class="col-3">${design.reference_doctype || ''}</div>
										<div class="col-2">${frappe.datetime.prettyDate(design.modified)}</div>
										<div class="col-2">
											<div class="actions">
										<button class="btn btn-xs btn-default edit-design" 
											data-name="${design.name}">
													<i class="fa fa-pencil"></i>
										</button>
										<button class="btn btn-xs btn-default preview-design" 
											data-name="${design.name}">
													<i class="fa fa-eye"></i>
										</button>
												<div class="dropdown">
													<button class="btn btn-xs btn-default dropdown-toggle" 
														data-toggle="dropdown">
														<i class="fa fa-cog"></i>
										</button>
													<ul class="dropdown-menu dropdown-menu-right" role="menu">
														${!design.is_default ? 
															`<li><a class="dropdown-item set-default-design" data-name="${design.name}">
																${__("Set as Default")}
															</a></li>` : ''
														}
														<li><a class="dropdown-item duplicate-design" data-name="${design.name}">
															${__("Duplicate")}
														</a></li>
														<li><a class="dropdown-item delete-design" data-name="${design.name}">
															${__("Delete")}
														</a></li>
													</ul>
												</div>
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

					// Clear the page and add the list view
					this.wrapper.html(html);

					// Add event handlers for the buttons
					this.wrapper.find('.edit-design').on('click', (e) => {
						const designName = $(e.currentTarget).data('name');
						frappe.set_route("invoicer", designName);
					});

					this.wrapper.find('.preview-design').on('click', (e) => {
						const designName = $(e.currentTarget).data('name');
						this.preview_design(designName);
					});

					this.wrapper.find('.delete-design').on('click', (e) => {
						const designName = $(e.currentTarget).data('name');
						this.delete_design(designName);
					});

					this.wrapper.find('.duplicate-design').on('click', (e) => {
						const designName = $(e.currentTarget).data('name');
						this.duplicate_design(designName);
					});
					
					this.wrapper.find('.set-default-design').on('click', (e) => {
						const designName = $(e.currentTarget).data('name');
						this.set_default_design(designName);
					});
				}
			}
		});
	}

	show_new_format_dialog() {
		const d = new frappe.ui.Dialog({
			title: __("New Print Format"),
			fields: [
				{
					fieldtype: 'Data',
					fieldname: 'design_name',
					label: __('Format Name'),
					reqd: 1
				},
				{
					fieldtype: 'Link',
					fieldname: 'doctype',
					label: __('Reference DocType'),
					options: 'DocType',
					reqd: 1,
					get_query: () => {
						return {
							filters: [['DocType', 'istable', '=', 0]]
						}
					}
				}
			],
			primary_action_label: __('Create'),
			primary_action: (values) => {
				d.hide();
				this.setup_new_design(values.doctype, values.design_name);
			}
		});
		
		d.show();
	}
	
	duplicate_design(designName) {
		frappe.prompt(
			{
				fieldtype: 'Data',
				fieldname: 'new_name',
				label: __('New Design Name'),
				reqd: 1
			},
			(values) => {
							frappe.call({
					method: 'invoicer.invoicer.page.invoicer.invoicer.duplicate_print_design',
								args: {
									design_name: designName,
						new_name: values.new_name
								},
					callback: (r) => {
									if (r.message && r.message.success) {
										frappe.show_alert({
								message: __("Design duplicated successfully"),
											indicator: 'green'
										}, 3);
							// Navigate to the new design
							frappe.set_route("invoicer", r.message.name);
									} else {
										frappe.show_alert({
								message: __("Failed to duplicate design"),
											indicator: 'red'
										}, 3);
									}
								}
							});
			},
			__('Duplicate Print Design'),
			__('Create')
		);
	}
	
	set_default_design(designName) {
		frappe.call({
			method: 'invoicer.invoicer.page.invoicer.invoicer.set_default_print_design',
			args: {
				design_name: designName
			},
			callback: (r) => {
				if (r.message && r.message.success) {
					frappe.show_alert({
						message: __("Print design set as default"),
						indicator: 'green'
					}, 3);
					this.load_print_list();
				} else {
					frappe.show_alert({
						message: __("Failed to set default design"),
						indicator: 'red'
					}, 3);
				}
			}
		});
	}
	
	delete_design(designName) {
						frappe.confirm(
			__('Are you sure you want to delete this design?'),
							() => {
								frappe.call({
									method: 'invoicer.invoicer.page.invoicer.invoicer.delete_invoice_design',
									args: { design_name: designName },
					callback: (r) => {
										if (r.message && r.message.success) {
											frappe.show_alert({
												message: __('Design deleted successfully'),
												indicator: 'green'
											});
							this.load_print_list();
										}
									}
								});
							}
						);
	}

	load_design(designName) {
		frappe.call({
			method: 'invoicer.invoicer.page.invoicer.invoicer.get_invoice_design',
			args: { design_name: designName },
			freeze: true,
			freeze_message: __("Loading design..."),
			callback: (r) => {
				if (r.message && r.message.success) {
					this.current_design = designName;
					this.design_name = r.message.design_name;
					this.properties = r.message.properties || {};
					this.doctype = this.properties.doctype || r.message.properties.doctype;
					this.is_default = r.message.is_default;
					
					// Update page title and actions
					this.page.set_title(__("Editing: {0}", [this.design_name]));
					
					// Update the URL to reflect the current design
					frappe.set_route("invoicer", designName, false);
					
					// Setup design editor
					this.setup_design_editor(r.message.content);
				} else {
					frappe.throw(__("Failed to load design"));
				}
			}
		});
	}

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
		
		// Create design editor UI
		this.wrapper.html(`
			<div class="print-designer-container">
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
						<div class="doctype-fields">
							<div class="placeholder text-center">
								${__("Loading fields...")}
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
				
				<div class="canvas-container">
					<div class="toolbar">
						<div class="btn-group">
							<button class="btn btn-default btn-sm zoom-out-btn">
								<i class="fa fa-search-minus"></i>
							</button>
							<button class="btn btn-default btn-sm zoom-reset-btn">
								100%
							</button>
							<button class="btn btn-default btn-sm zoom-in-btn">
								<i class="fa fa-search-plus"></i>
							</button>
						</div>
						
						<button class="btn btn-default btn-sm toggle-grid-btn">
							<i class="fa fa-th"></i> ${__('Toggle Grid')}
						</button>
						
						<button class="btn btn-default btn-sm navigator-btn">
							<i class="fa fa-sitemap"></i> ${__('Layers')}
						</button>
					</div>
					
					<div id="print-canvas" class="print-canvas">
						<!-- Canvas content will be loaded here -->
					</div>
				</div>
				
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
				
				<div class="layers-panel">
					<div class="layers-panel-title">
						${__("Layers")}
						<span class="layers-panel-close"><i class="fa fa-times"></i></span>
					</div>
					<div class="layers-content"></div>
				</div>
			</div>
		`);
		
		// Initialize the canvas
		this.init_canvas();
		
		// Load doctype fields
		this.load_doctype_fields();
		
		// Setup properties panel close button
		this.wrapper.find('.properties-panel-close').on('click', () => {
			this.wrapper.find('.properties-panel').removeClass('show');
		});
		
		// Setup properties panel delete button
		this.wrapper.find('.properties-panel-delete').on('click', () => {
			const selectedElement = document.querySelector('.canvas-element.selected');
			if (selectedElement) {
				// Check if it's a container with nested elements
				const isContainer = selectedElement.querySelector('.container-element');
				const hasNestedElements = isContainer && selectedElement.querySelectorAll('.canvas-element').length > 1;
				
				// For containers with nested elements, ask for confirmation
				if (hasNestedElements) {
					frappe.confirm(
						__('This container has nested elements. Delete anyway?'),
						() => {
							// On Yes
							selectedElement.remove();
							
							// Close the properties panel
							this.wrapper.find('.properties-panel').removeClass('show');
							
							// Show a notification
							frappe.show_alert({
								message: __('Container and nested elements deleted'),
								indicator: 'red'
							}, 3);
						},
						() => {
							// On No - do nothing
						}
					);
				} else {
					// Delete the selected element immediately
					selectedElement.remove();
					
					// Close the properties panel
					this.wrapper.find('.properties-panel').removeClass('show');
					
					// Show a notification
					frappe.show_alert({
						message: __('Element deleted'),
						indicator: 'red'
					}, 3);
				}
			}
		});
		
		// Setup help button click event
		this.wrapper.find('.help-btn').on('click', () => {
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
		
		// Show a quick help tooltip on first load
		setTimeout(() => {
			frappe.show_alert({
				message: __('Hover near element edges to move, click to edit, drag out to delete'),
				indicator: 'blue'
			}, 8);
		}, 1000);
		
		// Setup share button click event
		this.wrapper.find('.share-btn').on('click', () => {
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
	}
	
	create_default_container() {
		const container = document.createElement('div');
		container.className = 'canvas-element';
		container.id = 'element-' + Date.now();
		container.style.padding = '0';
		container.style.margin = '0';
		container.style.width = '100%'; // Ensure container takes full width
		
		const containerElement = document.createElement('div');
		containerElement.className = 'container-element';
		containerElement.setAttribute('data-type', 'container');
		containerElement.setAttribute('data-direction', 'vertical');
		
		containerElement.style.display = 'flex';
		containerElement.style.flexDirection = 'column';
		containerElement.style.minHeight = 'auto'; // Change from fixed height to auto
		containerElement.style.width = '100%';
		containerElement.style.border = 'none'; // Remove default border
		
		containerElement.style.padding = '5px';
		containerElement.style.backgroundColor = 'var(--bg-light)';
		
		// Add a placeholder text to make it more obvious
		const placeholder = document.createElement('div');
		placeholder.className = 'container-placeholder';
		placeholder.innerHTML = `<div class="text-muted text-center">${__('Drag elements here')}</div>`;
		placeholder.style.padding = '20px';
		containerElement.appendChild(placeholder);
		
		container.appendChild(containerElement);
		
		return container;
	}
	
	// Define attach_container_events as a class method before it's used
	attach_container_events(container) {
		container.addEventListener('dragover', (e) => {
			e.preventDefault();
			container.classList.add('drag-over');
		});

		container.addEventListener('dragleave', () => {
			container.classList.remove('drag-over');
		});

		container.addEventListener('drop', this.handle_drop);
	}
	
	init_canvas() {
		const canvas = document.getElementById('print-canvas');
		
		// Ensure there's a container if the canvas is empty
		if (!canvas.querySelector('.canvas-element')) {
			canvas.innerHTML = this.create_default_container().outerHTML;
		}
		
		// Initialize all the canvas elements
		this.reattach_element_events();
		
		// Bind drag and drop events
		this.bind_events();
		
		// Set up toolbar events
		this.setup_toolbar_events();
		
		// Add the 'Add Container' button at the bottom
		this.add_container_button();
	}
	
	add_container_button() {
		const canvas = document.getElementById('print-canvas');
		
		// Remove existing add buttons first
		const existingButtons = canvas.querySelectorAll('.add-container-button');
		existingButtons.forEach(btn => btn.remove());
		
		// Create a button to add new containers
		const addButton = document.createElement('div');
		addButton.className = 'add-container-button';
		addButton.innerHTML = `<button class="btn btn-default btn-sm">
			<i class="fa fa-plus"></i> ${__('Add Container')}
		</button>`;
		addButton.style.textAlign = 'center';
		addButton.style.margin = '20px 0';
		
		// Add click event to add a new container
		addButton.querySelector('button').addEventListener('click', () => {
			const newContainer = this.create_default_container();
			canvas.insertBefore(newContainer, addButton);
			
			// Attach events to the new container
			this.attach_element_events(newContainer);
			this.attach_container_events(newContainer.querySelector('.container-element'));
			
			// Scroll to the new container
			newContainer.scrollIntoView({ behavior: 'smooth' });
		});
		
		// Add the button at the end of the canvas
		canvas.appendChild(addButton);
	}
	
	load_doctype_fields() {
		if (!this.doctype) {
			this.wrapper.find('.doctype-fields').html(`
				<div class="text-center text-muted">
					${__("No DocType selected")}
				</div>
			`);
			return;
		}
		
		// First, get all linked doctypes
		frappe.call({
			method: 'invoicer.invoicer.page.invoicer.invoicer.get_linked_doctypes',
			args: { doctype: this.doctype },
			callback: (r) => {
				if (r.message && r.message.success) {
					const linkedDoctypes = r.message.linked_doctypes;
					
					// Store for later use
					this.linkedDoctypes = linkedDoctypes;
					
					// Create the doctype selector HTML
					let selectorHtml = `
						<div class="doctype-selector-container mb-3">
							<label class="small text-muted">${__("Select DocType")}</label>
							<div class="input-group">
								<select class="form-control doctype-selector">
					`;
					
					// Add options for each linked doctype
					linkedDoctypes.forEach(dt => {
						selectorHtml += `<option value="${dt.value}" 
							data-fieldname="${dt.fieldname || ''}">${dt.label}</option>`;
					});
					
					selectorHtml += `
								</select>
							</div>
						</div>
						<div class="doctype-fields-container"></div>
					`;
					
					// Add the selector to the UI
					this.wrapper.find('.doctype-fields').html(selectorHtml);
					
					// Add event handler for the selector
					this.wrapper.find('.doctype-selector').on('change', (e) => {
						const selectedOption = e.target.options[e.target.selectedIndex];
						const selectedDoctype = e.target.value;
						const linkFieldname = selectedOption.getAttribute('data-fieldname');
						
						// Load fields for the selected doctype
						this.load_fields_for_doctype(selectedDoctype, this.doctype, linkFieldname);
					});
					
					// Load fields for the default doctype (the main one)
					this.load_fields_for_doctype(this.doctype);
				}
			}
		});
	}
	
	// Helper method to load fields for a specific doctype
	load_fields_for_doctype(doctype, parent_doctype = null, link_fieldname = null) {
		frappe.call({
			method: 'invoicer.invoicer.page.invoicer.invoicer.get_doctype_fields',
			args: { 
				doctype: doctype,
				parent_doctype: parent_doctype,
				link_fieldname: link_fieldname
			},
			callback: (r) => {
				if (r.message && r.message.success) {
					const fields = r.message.fields;
					let html = '';
					
					// Display all fields in one list
					if (fields.length) {
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
						html = `<div class="text-center text-muted">
							${__("No fields available")}
						</div>`;
					}
					
					this.wrapper.find('.doctype-fields-container').html(html);
					
					// Add drag events to field items
					this.bind_field_drag_events();
				}
			}
		});
	}
	
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
	
	bind_field_drag_events() {
		const fieldItems = this.wrapper.find('.field-item').get();
		
		fieldItems.forEach(item => {
			item.addEventListener('dragstart', (e) => {
				const doctype = item.dataset.doctype || this.doctype;
				e.dataTransfer.setData('text/plain', `field:${item.dataset.fieldname}:${item.dataset.fieldtype}:${item.dataset.options}:${doctype}`);
				item.classList.add('dragging');
			});
			
			item.addEventListener('dragend', () => {
				item.classList.remove('dragging');
			});
		});
	}
	
	setup_toolbar_events() {
		const me = this;
		
		// Set up zoom controls
		this.wrapper.find('.zoom-in-btn').on('click', () => {
			const canvas = this.wrapper.find('.print-canvas');
			const currentZoom = parseFloat(canvas.css('zoom') || 1);
			const newZoom = Math.min(currentZoom + 0.1, 2.0); // Max zoom: 200%
			canvas.css('zoom', newZoom);
			this.wrapper.find('.zoom-reset-btn').text(Math.round(newZoom * 100) + '%');
		});
		
		this.wrapper.find('.zoom-out-btn').on('click', () => {
			const canvas = this.wrapper.find('.print-canvas');
			const currentZoom = parseFloat(canvas.css('zoom') || 1);
			const newZoom = Math.max(currentZoom - 0.1, 0.5); // Min zoom: 50%
			canvas.css('zoom', newZoom);
			this.wrapper.find('.zoom-reset-btn').text(Math.round(newZoom * 100) + '%');
		});
		
		this.wrapper.find('.zoom-reset-btn').on('click', () => {
			const canvas = this.wrapper.find('.print-canvas');
			canvas.css('zoom', 1);
			this.wrapper.find('.zoom-reset-btn').text('100%');
		});
		
		// Toggle grid
		this.wrapper.find('.toggle-grid-btn').on('click', () => {
			const canvas = this.wrapper.find('.print-canvas');
			canvas.toggleClass('show-grid');
			
			if (canvas.hasClass('show-grid')) {
				canvas.css('background-image', 'linear-gradient(rgba(150, 150, 150, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(150, 150, 150, 0.1) 1px, transparent 1px)');
				canvas.css('background-size', '20px 20px');
			} else {
				canvas.css('background-image', 'none');
			}
		});
		
		// Navigator button for layer selection
		this.wrapper.find('.navigator-btn').on('click', () => {
			const layersPanel = this.wrapper.find('.layers-panel');
			
			// Toggle layers panel
			if (layersPanel.hasClass('show')) {
				layersPanel.removeClass('show');
			} else {
				// Hide properties panel if open
				this.wrapper.find('.properties-panel').removeClass('show');
				
				// Show layers panel
				layersPanel.addClass('show');
				
				// Generate the layers tree
				this.generate_layers_tree();
			}
		});
		
		// Close button for layers panel
		this.wrapper.find('.layers-panel-close').on('click', () => {
			this.wrapper.find('.layers-panel').removeClass('show');
		});
	}
	
	// New method to generate the layers tree
	generate_layers_tree() {
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
	
	// Helper method to generate a single layer item
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
			me.wrapper.find('.layers-panel').removeClass('show');
			
			// Show properties panel
			me.show_properties_panel(element);
			
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
	
	save_design() {
		const canvas = document.getElementById('print-canvas');
		if (!canvas) return;
		
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
		
		// Handle table elements - replace sample data with Jinja templates
		tempCanvas.querySelectorAll('.table-element').forEach(tableElement => {
			const jinjaTemplate = tableElement.getAttribute('data-jinja-template');
			if (jinjaTemplate) {
				const table = tableElement.querySelector('table');
				if (table && table.querySelector('tbody')) {
					table.querySelector('tbody').innerHTML = jinjaTemplate;
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
		
		// Prepare properties
		const properties = {
			doctype: this.doctype,
			...this.properties
		};
		
		frappe.call({
			method: 'invoicer.invoicer.page.invoicer.invoicer.save_invoice_design',
			args: {
				design_name: this.design_name,
				content: tempCanvas.innerHTML,
				properties: properties,
				is_default: this.is_default ? 1 : 0
			},
			freeze: true,
			freeze_message: __("Saving design..."),
			callback: (r) => {
				if (r.message && r.message.success) {
					frappe.show_alert({
						message: __('Design saved successfully'),
						indicator: 'green'
					}, 3);
					
					// Update current design name if it's a new design
					if (!this.current_design) {
						this.current_design = r.message.name;
						// Update the URL with the new design name
						frappe.set_route("invoicer", r.message.name, false);
					}
				} else {
					frappe.show_alert({
						message: __('Failed to save design'),
						indicator: 'red'
					}, 3);
				}
			}
		});
	}

	bind_events() {
		const me = this;
		
		// Get elements
		const elements = this.wrapper.find('.element-item').get();
		const canvas = this.wrapper.find('#print-canvas').get(0);
		
		if (!canvas || !elements.length) return;

		// Bind drag and drop for sidebar elements
		elements.forEach(element => {
			element.addEventListener('dragstart', function(e) {
				this.classList.add('dragging');
				e.dataTransfer.setData('text/plain', 'new:' + this.dataset.type);
			});

			element.addEventListener('dragend', function() {
				this.classList.remove('dragging');
			});
		});

		// Canvas events for dragover
		canvas.addEventListener('dragover', (e) => {
			e.preventDefault();
			const container = e.target.closest('.container-element');
			if (container) {
				container.classList.add('drag-over');
			}
		});

		// Canvas events for dragleave
		canvas.addEventListener('dragleave', (e) => {
			const container = e.target.closest('.container-element');
			if (container) {
				container.classList.remove('drag-over');
			}
		});

		// Initialize containers
		canvas.querySelectorAll('.container-element').forEach(container => {
			this.attach_container_events(container);
		});
		
		// Setup properties panel close button
		this.wrapper.find('.properties-panel-close').on('click', () => {
			this.wrapper.find('.properties-panel').removeClass('show');
		});
		
		// Setup properties panel delete button
		this.wrapper.find('.properties-panel-delete').on('click', () => {
			const selectedElement = document.querySelector('.canvas-element.selected');
			if (selectedElement) {
				// Confirm deletion
				frappe.confirm(
					__('Are you sure you want to delete this element?'),
					() => {
						// On confirm
						selectedElement.remove();
						me.wrapper.find('.properties-panel').removeClass('show');
						
						// Update layers panel if visible
						if (me.wrapper.find('.layers-panel').hasClass('show')) {
							me.generate_layers_tree();
						}
						
						// Show alert
						frappe.show_alert({
							message: __('Element deleted'),
							indicator: 'red'
						}, 3);
					}
				);
			}
		});
		
		// Add drop event to canvas as a fallback
		canvas.addEventListener('drop', (e) => {
			const container = e.target.closest('.container-element');
			if (!container) return;
			
			this.handle_drop(e);
		});
		
		// Add keyboard event listener for the Escape key to delete selected elements
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				const selectedElement = document.querySelector('.canvas-element.selected');
				if (selectedElement) {
					// Confirm deletion
					if (confirm(__('Delete this element and everything inside it?'))) {
						selectedElement.remove();
						
						// Close properties panel
						this.wrapper.find('.properties-panel').removeClass('show');
						
						// Show alert
						frappe.show_alert({
							message: __('Element deleted'),
							indicator: 'red'
						}, 3);
					}
				}
			}
		});
	}
	
	// Apply the container's direction to its children
	apply_container_direction(container) {
		const direction = container.getAttribute('data-direction') || 'vertical';
		
		// Get current properties
		const justifyContent = container.style.justifyContent || '';
		const alignItems = container.style.alignItems || '';
		const gap = container.style.gap || '10px';
		
		// Set styles
		container.style.display = 'flex';
		container.style.flexDirection = direction === 'vertical' ? 'column' : 'row';
		container.style.width = '100%'; // Always make container take full width
		container.style.minHeight = 'auto'; // Make container fit its content
		
		// Reset justifyContent and alignItems if they weren't set
		if (justifyContent) {
			container.style.justifyContent = justifyContent;
		} else {
			container.style.justifyContent = 'flex-start';
		}
		
		if (alignItems) {
			container.style.alignItems = alignItems;
		} else {
			container.style.alignItems = 'flex-start';
		}
		
		// Preserve gap
		container.style.gap = gap;
		
		// Apply a minimum height if container is empty
		if (!container.children.length) {
			container.style.minHeight = '60px';
		}
		
		// Adjust layout for horizontal containers
		if (direction === 'horizontal') {
			// For horizontal containers, child elements should properly size
			const children = container.querySelectorAll('.canvas-element');
			children.forEach(child => {
				// Set default flex value for children in horizontal containers
				child.style.flex = child.style.flex || '1';
			});
		} else {
			// For vertical containers, children should take full width
			const children = container.querySelectorAll('.canvas-element');
			children.forEach(child => {
				child.style.width = '100%';
				// Remove flex if it was set previously
				if (child.style.flex === '1') {
					child.style.flex = '';
				}
			});
		}
	}

	create_element(type) {
		const element = document.createElement('div');
		element.className = 'canvas-element';
		element.draggable = true;
		element.id = 'element-' + Date.now();
		element.style.padding = '0';
		element.style.margin = '0';
		element.style.width = '100%'; // Make all elements take full width by default

		let content = '';
		switch (type) {
			case 'text':
				content = `<div class="text-element" data-type="text" contenteditable="true" data-content-type="static">${__('Click to edit text')}</div>`;
				break;
			case 'heading':
				content = `<div class="heading-element" data-type="heading" contenteditable="true" data-content-type="static">
					<h3 style="margin: 0; padding: 0; font-size: 24px;">${__('Click to edit heading')}</h3>
				</div>`;
				break;
			case 'image':
				content = `<div class="image-element" data-type="image" data-content-type="static">
					<img src="/assets/frappe/images/frappe-framework-logo.png" style="width: 200px; height: 200px; object-fit: contain;">
				</div>`;
				break;
			case 'qrcode':
				const canvasId = 'qrcode-canvas-' + Date.now();
				content = `<div class="qrcode-element" data-type="qrcode" data-value="https://frappeframework.com" data-size="150" data-background="white" data-foreground="black" data-padding="10" data-level="L">
					<div class="qrcode-display" style="width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
						<canvas id="${canvasId}" width="150" height="150"></canvas>
					</div>
				</div>`;
				break;
			case 'container':
				// Create a nested container element that can be placed inside another container
				content = `<div class="container-element" data-type="container" data-direction="vertical" style="display: flex; flex-direction: column; gap: 10px; min-height: auto; padding: 5px; width: 100%"></div>`;
				break;
			default:
				content = `<div class="unknown-element" data-type="unknown">${__('Unknown Element Type')}</div>`;
				break;
		}

		element.innerHTML = content;

		// Attach events to the new element
		this.attach_element_events(element);
		
		// Also attach events to any content elements (text/heading)
		if (['text', 'heading'].includes(type)) {
		const contentElement = element.querySelector('.text-element, .heading-element');
		if (contentElement) {
				this.attach_content_events(contentElement);
			}
		}

		// If it's a container, attach container events
		if (type === 'container') {
			const containerElement = element.querySelector('.container-element');
			if (containerElement) {
				this.attach_container_events(containerElement);
				
				// Add a placeholder initially
				const placeholder = document.createElement('div');
				placeholder.className = 'container-placeholder';
				placeholder.innerHTML = `<div class="text-muted text-center">${__('Drag elements here')}</div>`;
				placeholder.style.padding = '20px';
				containerElement.appendChild(placeholder);
			}
		}

		// If it's a table element, show configuration dialog immediately
		if (type === 'table') {
			setTimeout(() => {
				this.configure_table(element);
			}, 100);
		}

		// Initialize QR code if it's a QR code element
		if (type === 'qrcode') {
			setTimeout(() => {
				this.generateQRCode(element.querySelector('.qrcode-element'));
			}, 100);  // Small timeout to ensure element is properly rendered
		}

		return element;
	}

	create_field_element(fieldname, fieldtype, options, doctype) {
		const element = document.createElement('div');
		element.className = 'canvas-element';
		element.draggable = true;
		element.id = 'element-' + Date.now();
		element.style.width = '100%'; // Ensure field elements take full width
		element.style.padding = '0';
		element.style.margin = '0';
		
		// Get the display fieldname (for printing in the template)
		// Check if this is a linked doctype field
		let fieldPath = fieldname;
		let isLinkedField = false;
		let contentTemplate = '';
		
		// If doctype is provided and is different from the main doctype, it's a linked field
		if (doctype && doctype !== this.doctype) {
			// Find the link field in the linked doctypes
			const linkField = this.linkedDoctypes.find(dt => dt.value === doctype)?.fieldname;
			
			if (linkField) {
				// Determine if fieldname already has a prefix
				const originalFieldname = fieldname.includes('.') ? fieldname.split('.')[1] : fieldname;
				isLinkedField = true;
				
				// Format: {{frappe.db.get_value("LinkedDoctype", doc.link_field, "field_name")}}
				contentTemplate = `{{frappe.db.get_value("${doctype}", doc.${linkField}, "${originalFieldname}")}}`;
			}
		}
		
		// If not a linked field, use standard format
		if (!isLinkedField) {
			contentTemplate = `{{${fieldPath}}}`;
		}
		
		let content = '';
		switch (fieldtype) {
			case 'Data':
			case 'Text':
			case 'Small Text':
			case 'Link':
			case 'Select':
			case 'Date':
			case 'Datetime':
			case 'Time':
			case 'Int':
			case 'Float':
			case 'Currency':
			case 'Code':
			case 'Text Editor':
			case 'Markdown Editor':
			case 'HTML Editor':
			case 'Check':
			case 'Password':
			case 'Read Only':
			case 'Color':
			case 'Percent':
			case 'Rating':
			case 'JSON':
				content = `<div class="text-element" data-type="text" data-content-type="field" data-fieldname="${fieldname}" data-fieldtype="${fieldtype}" data-doctype="${doctype || ''}">${contentTemplate}</div>`;
				break;
			case 'Attach Image':
			case 'Image':
			case 'Signature':
			case 'Barcode':
				content = `<div class="image-element" data-type="image" data-content-type="field" data-fieldname="${fieldname}" data-fieldtype="${fieldtype}" data-doctype="${doctype || ''}">
					<img src="/assets/frappe/images/fallback.png" style="width: 200px; height: 200px; object-fit: contain;" data-src="${contentTemplate}">
				</div>`;
				break;
			case 'Table':
			case 'Table MultiSelect':
				// For table fields, show a simple table without sample columns
				content = `<div class="table-element" data-type="table" data-content-type="field" data-fieldname="${fieldname}" data-fieldtype="${fieldtype}" data-options="${options}" data-doctype="${doctype || ''}" style="width: 100%">
					<div class="table-placeholder">
						<table class="table table-bordered" style="width: 100%">
							<thead>
								<tr>
									<th>${__("Table") + ": " + options}</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>${__("Click to configure table")}</td>
								</tr>
							</tbody>
						</table>
					</div>
					<div class="table-dynamic-note" style="font-size: 10px; color: #888; margin-top: 5px;">
						${__("Dynamic table will be rendered using")} {% for row in doc.${fieldPath} %}
					</div>
				</div>`;
				break;
			default:
				content = `<div class="text-element" data-type="text" data-content-type="field" data-fieldname="${fieldname}" data-fieldtype="${fieldtype}" data-doctype="${doctype || ''}">${contentTemplate}</div>`;
				break;
		}
		
		element.innerHTML = content;
		
		// For text elements, attach specific content events 
		if (['Data', 'Text', 'Small Text', 'Link', 'Select', 'Date', 'Datetime', 'Time', 'Int', 'Float', 'Currency',
			 'Code', 'Text Editor', 'Markdown Editor', 'HTML Editor', 'Check', 'Password', 'Read Only', 'Color',
			 'Percent', 'Rating', 'JSON'].includes(fieldtype)) {
			const contentElement = element.querySelector('.text-element');
			if (contentElement) {
				this.attach_content_events(contentElement);
			}
		}

		// If it's a table element, show configuration dialog immediately
		if (fieldtype === 'Table' || fieldtype === 'Table MultiSelect') {
			setTimeout(() => {
				this.configure_table(element);
			}, 100);
		}

		return element;
	}

	attach_element_events(element) {
		// Add drag functionality - only from the edge
		this.add_edge_drag(element);
		
		// Selection event - clicking on element opens properties panel
		element.addEventListener('click', (e) => {
			e.stopPropagation();
			if (e.target.contentEditable === 'true' && document.activeElement === e.target) {
				return; // Don't show properties panel when editing text
			}
			
			// Check if clicking on or within a table element
			const clickedTableElement = e.target.closest('.table-element');
			if (clickedTableElement) {
				// If the click is on a table element, handle it specially
				document.querySelectorAll('.canvas-element.selected, .canvas-element.table-selected').forEach(el => {
					el.classList.remove('selected');
					el.classList.remove('table-selected');
				});
				
				// Add selected class to this element and mark as table selected
				element.classList.add('selected');
				element.classList.add('table-selected');
				
				// Hide layers panel if it's visible
				this.wrapper.find('.layers-panel').removeClass('show');
				
				// Show the table properties panel for this element
				this.show_properties_panel(element);
				
				// Update selection in the layers panel if visible
				if (this.wrapper.find('.layers-panel').hasClass('show')) {
					this.wrapper.find('.layer-item').removeClass('selected');
					this.wrapper.find(`.layer-item[data-element-id="${element.id}"]`).addClass('selected');
				}
				
				return;
			}
			
			// Remove selected class from all elements
			document.querySelectorAll('.canvas-element.selected, .canvas-element.table-selected').forEach(el => {
				el.classList.remove('selected');
				el.classList.remove('table-selected');
			});
			
			// Add selected class to this element
			element.classList.add('selected');
			
			// Hide layers panel if it's visible
			this.wrapper.find('.layers-panel').removeClass('show');
			
			// Show properties panel
			this.show_properties_panel(element);
			
			// Update selection in the layers panel if visible
			if (this.wrapper.find('.layers-panel').hasClass('show')) {
				this.wrapper.find('.layer-item').removeClass('selected');
				this.wrapper.find(`.layer-item[data-element-id="${element.id}"]`).addClass('selected');
			}
		});

		// Add content editing events
		const content = element.querySelector('.text-element, .heading-element');
		if (content) {
			this.attach_content_events(content);
		}
		
		// Add specific events for table elements
		const tableElement = element.querySelector('.table-element');
		if (tableElement) {
			// Handle direct clicks on the table element
			tableElement.addEventListener('click', (e) => {
				e.stopPropagation();
				
				// Select the parent canvas element
				document.querySelectorAll('.canvas-element.selected, .canvas-element.table-selected').forEach(el => {
					el.classList.remove('selected');
					el.classList.remove('table-selected');
				});
				element.classList.add('selected');
				element.classList.add('table-selected');
				
				// Show table properties and configure it if it's the first time
				this.show_properties_panel(element);
			});
			
			// Make all parts of the table clickable to show table properties
			const tableParts = tableElement.querySelectorAll('table, th, td, tr, thead, tbody');
			tableParts.forEach(part => {
				part.addEventListener('click', (e) => {
					e.stopPropagation();
					
					// Select the parent canvas element
					document.querySelectorAll('.canvas-element.selected, .canvas-element.table-selected').forEach(el => {
						el.classList.remove('selected');
						el.classList.remove('table-selected');
					});
					element.classList.add('selected');
					element.classList.add('table-selected');
					
					// Show table properties
					this.show_properties_panel(element);
				});
			});
		}
		
		// Delete by dragging to empty space
		element.addEventListener('dragend', (e) => {
			// Check if dragged outside any container
			if (!e.target.parentElement || !e.target.parentElement.closest('.container-element')) {
				element.remove();
				
				// Close properties panel if open for this element
				if (element.classList.contains('selected')) {
					this.wrapper.find('.properties-panel').removeClass('show');
				}
			}
		});
		
		// Initialize nested dropzones
		const dropzones = element.querySelectorAll('.dropzone');
		if (dropzones.length) {
			dropzones.forEach(dropzone => {
				this.attach_dropzone_events(dropzone);
				if (Array.from(dropzone.children).some(child => child.classList.contains('canvas-element'))) {
					dropzone.classList.add('has-elements');
				}
			});
		}
	}
	
	// New method to separate content-specific event handling
	attach_content_events(content) {
		content.addEventListener('mousedown', (e) => {
			e.stopPropagation();
		});

		content.addEventListener('click', (e) => {
			e.stopPropagation();
			
			// Find the parent canvas-element to select it
			const parentElement = content.closest('.canvas-element');
			if (parentElement) {
				// Remove selected class from all elements
				document.querySelectorAll('.canvas-element.selected').forEach(el => {
					el.classList.remove('selected');
				});
				
				// Add selected class to parent element
				parentElement.classList.add('selected');
				
				// Show properties panel for the parent element
				this.show_properties_panel(parentElement);
			}
		});

		content.addEventListener('blur', () => {
			if (content.getAttribute('data-content-type') !== 'field') {
				content.setAttribute('data-content-type', 'static');
			}
		});

		content.addEventListener('dragstart', (e) => {
			if (document.activeElement === content) {
				e.preventDefault();
			}
		});

		if (content.getAttribute('data-content-type') === 'field') {
			content.setAttribute('contenteditable', 'false');
		} else {
			content.setAttribute('contenteditable', 'true');
		}
	}
	
	// Add new method for edge-based dragging
	add_edge_drag(element) {
		const EDGE_SIZE = 10; // pixels from edge that activate dragging
		
		element.addEventListener('mousedown', (e) => {
			const rect = element.getBoundingClientRect();
			const isLeftEdge = e.clientX - rect.left < EDGE_SIZE;
			const isRightEdge = rect.right - e.clientX < EDGE_SIZE;
			const isTopEdge = e.clientY - rect.top < EDGE_SIZE;
			const isBottomEdge = rect.bottom - e.clientY < EDGE_SIZE;
			
			if (isLeftEdge || isRightEdge || isTopEdge || isBottomEdge) {
				element.draggable = true;
				element.classList.add('dragging-enabled');
				
				// Add cursor styling
				if ((isLeftEdge && isTopEdge) || (isRightEdge && isBottomEdge)) {
					element.style.cursor = 'nwse-resize';
				} else if ((isRightEdge && isTopEdge) || (isLeftEdge && isBottomEdge)) {
					element.style.cursor = 'nesw-resize';
				} else if (isLeftEdge || isRightEdge) {
					element.style.cursor = 'ew-resize';
				} else if (isTopEdge || isBottomEdge) {
					element.style.cursor = 'ns-resize';
				}
			} else {
				element.draggable = false;
				element.style.cursor = 'default';
			}
		});
		
		element.addEventListener('mouseup', () => {
			element.draggable = false;
			element.classList.remove('dragging-enabled');
			element.style.cursor = 'default';
		});
		
		element.addEventListener('mouseleave', () => {
			if (!element.classList.contains('dragging-enabled')) {
				element.style.cursor = 'default';
			}
		});
		
		element.addEventListener('dragstart', (e) => {
			e.stopPropagation();
			e.dataTransfer.setData('text/plain', element.id);
		});
	}
	
	reattach_element_events() {
		const canvas = document.getElementById('print-canvas');
		
		// Add events to all canvas elements
		canvas.querySelectorAll('.canvas-element').forEach(element => {
			// Ensure element has an ID
			if (!element.id) {
				element.id = 'element-' + Date.now();
			}

			// Reattach all events
			this.attach_element_events(element);
			
			// Also reattach content events to any text/heading elements inside
			const contentElements = element.querySelectorAll('.text-element, .heading-element');
			contentElements.forEach(content => {
				this.attach_content_events(content);
			});
		});

		// Reattach container events to ALL container elements, including nested ones
		canvas.querySelectorAll('.container-element').forEach(container => {
			this.attach_container_events(container);
			
			// Ensure container direction is applied
			this.apply_container_direction(container);
			
			// If a container is empty, add a placeholder
			if (!container.querySelector('.canvas-element, .container-placeholder')) {
				const placeholder = document.createElement('div');
				placeholder.className = 'container-placeholder';
				placeholder.innerHTML = `<div class="text-muted text-center">${__('Drag elements here')}</div>`;
				placeholder.style.padding = '20px';
				container.appendChild(placeholder);
			}
		});
		
		// Add canvas click event to deselect elements
		canvas.addEventListener('click', (e) => {
			if (e.target === canvas || e.target.id === 'print-canvas') {
				document.querySelectorAll('.canvas-element.selected, .canvas-element.table-selected').forEach(el => {
					el.classList.remove('selected');
					el.classList.remove('table-selected');
				});
				this.wrapper.find('.properties-panel').removeClass('show');
			}
		});
		
		// Add global keydown event to delete selected elements with Escape key
		this.setup_keyboard_shortcuts();
		
		// Update the layers panel if it's visible
		if (this.wrapper.find('.layers-panel').hasClass('show')) {
			this.generate_layers_tree();
		}
	}
	
	// Add a new method to handle keyboard shortcuts
	setup_keyboard_shortcuts() {
		// Remove any existing event listener to avoid duplicates
		document.removeEventListener('keydown', this.handle_keydown_events);
		
		// Add the keydown event listener
		this.handle_keydown_events = (e) => {
			// Check if Escape key is pressed
			if (e.key === 'Escape' || e.keyCode === 27) {
				// Don't delete if user is editing text
				if (document.activeElement.contentEditable === 'true') {
					// Just blur the text element
					document.activeElement.blur();
					return;
				}
				
				// Find the currently selected element
				const selectedElement = document.querySelector('.canvas-element.selected');
				
				if (selectedElement) {
					// Check if it's a container with nested elements
					const isContainer = selectedElement.querySelector('.container-element');
					const hasNestedElements = isContainer && selectedElement.querySelectorAll('.canvas-element').length > 1;
					
					// For containers with nested elements, show a confirmation dialog
					if (hasNestedElements) {
						frappe.confirm(
							__('This container has nested elements. Delete anyway?'),
							() => {
								// On Yes
								selectedElement.remove();
								
								// Close the properties panel
								this.wrapper.find('.properties-panel').removeClass('show');
								
								// Show a notification
						frappe.show_alert({
									message: __('Container and nested elements deleted'),
									indicator: 'orange'
						}, 3);
							},
							() => {
								// On No - do nothing
							}
						);
					} else {
						// Delete the selected element immediately
						selectedElement.remove();
						
						// Close the properties panel
						this.wrapper.find('.properties-panel').removeClass('show');
						
						// Show a notification
						frappe.show_alert({
							message: __('Element deleted'),
							indicator: 'orange'
						}, 3);
					}
				}
			}
		};
		
		document.addEventListener('keydown', this.handle_keydown_events);
	}

	show_properties_panel(element) {
		const panel = this.wrapper.find('.properties-panel');
		const content = panel.find('.properties-content');
		
		// Check if element contains a table element, and if the table is the intended focus
		let elementType = '';
		let elementTypeTarget = element.querySelector('[data-type]');
		
		// Special handling for tables - they should show table properties, not container properties
		const tableElement = element.querySelector('.table-element');
		if (tableElement && element.classList.contains('table-selected')) {
			elementType = 'table';
			elementTypeTarget = tableElement;
		} else if (elementTypeTarget) {
			elementType = elementTypeTarget.getAttribute('data-type');
		}
		
		let html = '';
		
		// Common properties
		html += `
			<div class="property-group">
				<div class="property-group-title">${__("Layout")}</div>
				<div class="property-field">
					<label>${__("Width")}</label>
					<div class="input-group">
						<input type="text" class="form-control prop-width" value="${element.style.width || 'auto'}">
						<div class="input-group-append">
							<button class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown">
								<span>${element.style.width ? (element.style.width.includes('%') ? '%' : 'px') : 'auto'}</span>
							</button>
							<ul class="dropdown-menu dropdown-menu-right width-unit" role="menu">
								<li><a class="dropdown-item" data-value="auto">auto</a></li>
								<li><a class="dropdown-item" data-value="%">%</a></li>
								<li><a class="dropdown-item" data-value="px">px</a></li>
							</ul>
						</div>
					</div>
				</div>
				<div class="property-field">
					<label>${__("Margin")}</label>
					<div class="d-flex">
						<input type="number" class="form-control prop-margin-top" placeholder="Top" value="${element.style.marginTop ? parseInt(element.style.marginTop) : 0}">
						<input type="number" class="form-control prop-margin-right ml-1" placeholder="Right" value="${element.style.marginRight ? parseInt(element.style.marginRight) : 0}">
						<input type="number" class="form-control prop-margin-bottom ml-1" placeholder="Bottom" value="${element.style.marginBottom ? parseInt(element.style.marginBottom) : 0}">
						<input type="number" class="form-control prop-margin-left ml-1" placeholder="Left" value="${element.style.marginLeft ? parseInt(element.style.marginLeft) : 0}">
					</div>
				</div>
				<div class="property-field">
					<label>${__("Padding")}</label>
					<div class="d-flex">
						<input type="number" class="form-control prop-padding-top" placeholder="Top" value="${element.style.paddingTop ? parseInt(element.style.paddingTop) : 0}">
						<input type="number" class="form-control prop-padding-right ml-1" placeholder="Right" value="${element.style.paddingRight ? parseInt(element.style.paddingRight) : 0}">
						<input type="number" class="form-control prop-padding-bottom ml-1" placeholder="Bottom" value="${element.style.paddingBottom ? parseInt(element.style.paddingBottom) : 0}">
						<input type="number" class="form-control prop-padding-left ml-1" placeholder="Left" value="${element.style.paddingLeft ? parseInt(element.style.paddingLeft) : 0}">
					</div>
				</div>
				<div class="property-field">
					<label>${__("Text Align")}</label>
					<div class="btn-group d-flex">
						<button class="btn btn-default btn-sm prop-align${element.style.textAlign === 'left' || !element.style.textAlign ? ' active' : ''}" data-value="left">
							<i class="fa fa-align-left"></i>
						</button>
						<button class="btn btn-default btn-sm prop-align${element.style.textAlign === 'center' ? ' active' : ''}" data-value="center">
							<i class="fa fa-align-center"></i>
						</button>
						<button class="btn btn-default btn-sm prop-align${element.style.textAlign === 'right' ? ' active' : ''}" data-value="right">
							<i class="fa fa-align-right"></i>
						</button>
						<button class="btn btn-default btn-sm prop-align${element.style.textAlign === 'justify' ? ' active' : ''}" data-value="justify">
							<i class="fa fa-align-justify"></i>
						</button>
					</div>
				</div>
				
				<!-- Enhanced Border Controls -->
				<div class="property-group-title mt-3">${__("Border")}</div>
				<div class="property-field">
					<label>${__("Border Style")}</label>
					<select class="form-control prop-element-border-style">
						<option value="none" ${element.style.borderStyle === 'none' || !element.style.borderStyle ? 'selected' : ''}>${__("None")}</option>
						<option value="solid" ${element.style.borderStyle === 'solid' ? 'selected' : ''}>${__("Solid")}</option>
						<option value="dashed" ${element.style.borderStyle === 'dashed' ? 'selected' : ''}>${__("Dashed")}</option>
						<option value="dotted" ${element.style.borderStyle === 'dotted' ? 'selected' : ''}>${__("Dotted")}</option>
					</select>
				</div>
				<div class="property-field">
					<label>${__("Border Color")}</label>
					<input type="color" class="form-control prop-element-border-color" value="${this.rgb2hex(element.style.borderColor || '#000000')}">
				</div>
				<div class="property-field">
					<label>${__("Border Width")}</label>
					<div class="d-flex">
						<input type="number" class="form-control prop-border-top" placeholder="Top" value="${element.style.borderTopWidth ? parseInt(element.style.borderTopWidth) : 0}">
						<input type="number" class="form-control prop-border-right ml-1" placeholder="Right" value="${element.style.borderRightWidth ? parseInt(element.style.borderRightWidth) : 0}">
						<input type="number" class="form-control prop-border-bottom ml-1" placeholder="Bottom" value="${element.style.borderBottomWidth ? parseInt(element.style.borderBottomWidth) : 0}">
						<input type="number" class="form-control prop-border-left ml-1" placeholder="Left" value="${element.style.borderLeftWidth ? parseInt(element.style.borderLeftWidth) : 0}">
					</div>
				</div>
				<div class="property-field">
					<label>${__("Border Radius")}</label>
					<div class="d-flex">
						<input type="number" class="form-control prop-border-radius-tl" placeholder="TL" value="${element.style.borderTopLeftRadius ? parseInt(element.style.borderTopLeftRadius) : 0}">
						<input type="number" class="form-control prop-border-radius-tr ml-1" placeholder="TR" value="${element.style.borderTopRightRadius ? parseInt(element.style.borderTopRightRadius) : 0}">
						<input type="number" class="form-control prop-border-radius-br ml-1" placeholder="BR" value="${element.style.borderBottomRightRadius ? parseInt(element.style.borderBottomRightRadius) : 0}">
						<input type="number" class="form-control prop-border-radius-bl ml-1" placeholder="BL" value="${element.style.borderBottomLeftRadius ? parseInt(element.style.borderBottomLeftRadius) : 0}">
					</div>
				</div>
			</div>
		`;
		
		// Type-specific properties
		if (['text', 'heading'].includes(elementType)) {
			const contentElement = element.querySelector('.text-element, .heading-element');
			const isField = contentElement.getAttribute('data-content-type') === 'field';
			
			// For heading elements, add heading level selector
			let headingLevelHtml = '';
			if (elementType === 'heading') {
				// Find current heading level (h1-h6)
				const headingTag = contentElement.querySelector('h1, h2, h3, h4, h5, h6');
				const currentLevel = headingTag ? headingTag.tagName.toLowerCase().replace('h', '') : '3';
				
				headingLevelHtml = `
					<div class="property-field">
						<label>${__("Heading Level")}</label>
						<select class="form-control prop-heading-level">
							<option value="1" ${currentLevel === '1' ? 'selected' : ''}>H1</option>
							<option value="2" ${currentLevel === '2' ? 'selected' : ''}>H2</option>
							<option value="3" ${currentLevel === '3' ? 'selected' : ''}>H3</option>
							<option value="4" ${currentLevel === '4' ? 'selected' : ''}>H4</option>
							<option value="5" ${currentLevel === '5' ? 'selected' : ''}>H5</option>
							<option value="6" ${currentLevel === '6' ? 'selected' : ''}>H6</option>
						</select>
					</div>
				`;
			}
			
			html += `
				<div class="property-group">
					<div class="property-group-title">${__("Text")}</div>
					${headingLevelHtml}
					<div class="property-field">
						<label>${__("Font Size")}</label>
						<div class="input-group">
							<input type="number" class="form-control prop-font-size" value="${contentElement.style.fontSize ? parseInt(contentElement.style.fontSize) : (elementType === 'heading' ? 24 : 14)}">
							<div class="input-group-append">
								<span class="input-group-text">px</span>
							</div>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Font Weight")}</label>
						<select class="form-control prop-font-weight">
							<option value="normal" ${contentElement.style.fontWeight === 'normal' || contentElement.style.fontWeight === '400' || !contentElement.style.fontWeight ? 'selected' : ''}>${__("Normal")}</option>
							<option value="bold" ${contentElement.style.fontWeight === 'bold' || contentElement.style.fontWeight === '700' ? 'selected' : ''}>${__("Bold")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Text Color")}</label>
						<div class="input-group">
							<input type="color" class="form-control prop-text-color" value="${contentElement.style.color || '#000000'}">
						</div>
					</div>
					<div class="property-field">
						<label>${__("Background")}</label>
						<div class="input-group">
							<input type="color" class="form-control prop-bg-color" value="${contentElement.style.backgroundColor || '#ffffff'}">
						</div>
					</div>
				</div>
			`;
		}
		
		// Image properties
		if (elementType === 'image') {
			const imageElement = element.querySelector('.image-element img');
			const isField = element.querySelector('.image-element').getAttribute('data-content-type') === 'field';
			
			// Get the current width and height
			const width = imageElement.style.width ? parseInt(imageElement.style.width) : 200;
			const height = imageElement.style.height ? parseInt(imageElement.style.height) : 200;
			
			html += `
				<div class="property-group">
					<div class="property-group-title">${__("Image Properties")}</div>
					<div class="property-field">
						<label>${__("Width")}</label>
						<div class="input-group">
							<input type="number" class="form-control prop-image-width" value="${width}">
							<div class="input-group-append">
								<span class="input-group-text">px</span>
							</div>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Height")}</label>
						<div class="input-group">
							<input type="number" class="form-control prop-image-height" value="${height}">
							<div class="input-group-append">
								<span class="input-group-text">px</span>
							</div>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Object Fit")}</label>
						<select class="form-control prop-object-fit">
							<option value="contain" ${imageElement.style.objectFit === 'contain' ? 'selected' : ''}>${__("Contain")}</option>
							<option value="cover" ${imageElement.style.objectFit === 'cover' ? 'selected' : ''}>${__("Cover")}</option>
							<option value="fill" ${imageElement.style.objectFit === 'fill' ? 'selected' : ''}>${__("Fill")}</option>
							<option value="scale-down" ${imageElement.style.objectFit === 'scale-down' ? 'selected' : ''}>${__("Scale Down")}</option>
							<option value="none" ${imageElement.style.objectFit === 'none' ? 'selected' : ''}>${__("None")}</option>
						</select>
					</div>
					${!isField ? `
					<div class="property-field">
						<label>${__("Image URL")}</label>
						<div class="input-group">
							<input type="text" class="form-control prop-image-url" value="${imageElement.src}">
							<div class="input-group-append">
								<button class="btn btn-sm btn-default prop-browse-image">
									<i class="fa fa-folder-open"></i>
								</button>
							</div>
						</div>
					</div>
					` : ''}
				</div>
			`;
		}
		
		if (elementType === 'container') {
			const containerElement = element.querySelector('.container-element');
			const direction = containerElement.getAttribute('data-direction') || 'vertical';
			
			// Get current alignment values
			const justifyContent = containerElement.style.justifyContent || 'flex-start';
			const alignItems = containerElement.style.alignItems || 'flex-start';
			const gap = containerElement.style.gap || '10px';
			
			html += `
				<div class="property-group">
					<div class="property-group-title">${__("Container")}</div>
					<div class="property-field">
						<label>${__("Direction")}</label>
						<div class="btn-group d-flex">
							<button class="btn btn-default btn-sm prop-direction${direction === 'vertical' ? ' active' : ''}" data-value="vertical">
								<i class="fa fa-arrow-down"></i> ${__("Vertical")}
							</button>
							<button class="btn btn-default btn-sm prop-direction${direction === 'horizontal' ? ' active' : ''}" data-value="horizontal">
								<i class="fa fa-arrow-right"></i> ${__("Horizontal")}
							</button>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Gap")} <small>(${__("space between elements")})</small></label>
						<div class="input-group">
							<input type="number" class="form-control prop-container-gap" value="${parseInt(gap) || 10}">
							<div class="input-group-append">
								<span class="input-group-text">px</span>
							</div>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Main Axis Alignment")} <small>(${direction === 'vertical' ? 'vertical' : 'horizontal'})</small></label>
						<select class="form-control prop-justify-content">
							<option value="flex-start" ${justifyContent === 'flex-start' ? 'selected' : ''}>${__("Start")}</option>
							<option value="flex-end" ${justifyContent === 'flex-end' ? 'selected' : ''}>${__("End")}</option>
							<option value="center" ${justifyContent === 'center' ? 'selected' : ''}>${__("Center")}</option>
							<option value="space-between" ${justifyContent === 'space-between' ? 'selected' : ''}>${__("Space Between")}</option>
							<option value="space-around" ${justifyContent === 'space-around' ? 'selected' : ''}>${__("Space Around")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Cross Axis Alignment")} <small>(${direction === 'vertical' ? 'horizontal' : 'vertical'})</small></label>
						<select class="form-control prop-align-items">
							<option value="flex-start" ${alignItems === 'flex-start' ? 'selected' : ''}>${__("Start")}</option>
							<option value="flex-end" ${alignItems === 'flex-end' ? 'selected' : ''}>${__("End")}</option>
							<option value="center" ${alignItems === 'center' ? 'selected' : ''}>${__("Center")}</option>
							<option value="stretch" ${alignItems === 'stretch' ? 'selected' : ''}>${__("Stretch")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Background Color")}</label>
						<div class="input-group">
							<input type="color" class="form-control prop-container-bg" value="${this.rgb2hex(containerElement.style.backgroundColor || 'transparent')}">
						</div>
					</div>
					<div class="property-field">
						<label>${__("Padding")}</label>
						<div class="input-group">
							<input type="number" class="form-control prop-container-padding" value="${containerElement.style.padding ? parseInt(containerElement.style.padding) : 10}">
							<div class="input-group-append">
								<span class="input-group-text">px</span>
							</div>
						</div>
					</div>
				</div>
			`;
		}
		
		// Add QR Code properties if element is a QR code
		if (elementType === 'qrcode') {
			const qrcodeElement = element.querySelector('.qrcode-element');
			const qrValue = qrcodeElement.getAttribute('data-value') || '';
			const qrSize = qrcodeElement.getAttribute('data-size') || '150';
			const qrBgColor = qrcodeElement.getAttribute('data-background') || 'white';
			const qrFgColor = qrcodeElement.getAttribute('data-foreground') || 'black';
			const qrPadding = qrcodeElement.getAttribute('data-padding') || '10';
			const qrLevel = qrcodeElement.getAttribute('data-level') || 'L';
			
			html += `
				<div class="property-group">
					<div class="property-group-title">${__("QR Code Properties")}</div>
					<div class="property-field">
						<label>${__("QR Code Data")}</label>
						<select class="form-control prop-qrcode-data-type">
							<option value="static" ${!qrValue.includes('{{') ? 'selected' : ''}>${__("Static Value")}</option>
							<option value="field" ${qrValue.includes('{{') ? 'selected' : ''}>${__("Document Field")}</option>
						</select>
					</div>
					<div class="property-field prop-static-value-field" ${qrValue.includes('{{') ? 'style="display:none;"' : ''}>
						<label>${__("Value")}</label>
						<input type="text" class="form-control prop-qrcode-value" value="${qrValue.includes('{{') ? '' : qrValue}" placeholder="${__("URL or text for QR code")}">
					</div>
					<div class="property-field prop-field-value-field" ${!qrValue.includes('{{') ? 'style="display:none;"' : ''}>
						<label>${__("Field")}</label>
						<select class="form-control prop-qrcode-field">
							<option value="">${__("Select Field")}</option>
							${this.getFieldOptionsForQRCode(qrValue)}
						</select>
					</div>
					<div class="property-field">
						<label>${__("Size (px)")}</label>
						<div class="input-group">
							<input type="number" class="form-control prop-qrcode-size" value="${qrSize}">
							<div class="input-group-append">
								<span class="input-group-text">px</span>
							</div>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Error Correction Level")}</label>
						<select class="form-control prop-qrcode-level">
							<option value="L" ${qrLevel === 'L' ? 'selected' : ''}>${__("Low (7%)")}</option>
							<option value="M" ${qrLevel === 'M' ? 'selected' : ''}>${__("Medium (15%)")}</option>
							<option value="Q" ${qrLevel === 'Q' ? 'selected' : ''}>${__("Quartile (25%)")}</option>
							<option value="H" ${qrLevel === 'H' ? 'selected' : ''}>${__("High (30%)")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Padding (px)")}</label>
						<input type="number" class="form-control prop-qrcode-padding" value="${qrPadding}">
					</div>
					<div class="property-field">
						<label>${__("Foreground Color")}</label>
						<input type="color" class="form-control prop-qrcode-foreground" value="${this.normalizeColor(qrFgColor)}">
					</div>
					<div class="property-field">
						<label>${__("Background Color")}</label>
						<input type="color" class="form-control prop-qrcode-background" value="${this.normalizeColor(qrBgColor)}">
					</div>
					<div class="property-field mt-2">
						<button class="btn btn-sm btn-primary btn-generate-qrcode">${__("Generate QR Code")}</button>
					</div>
				</div>
			`;
		}

		// Add Table properties if element is a table
		if (elementType === 'table') {
			const tableElement = element.querySelector('.table-element');
			const fieldname = tableElement.getAttribute('data-fieldname');
			const childDoctype = tableElement.getAttribute('data-options');
			const selectedFields = tableElement.getAttribute('data-selected-fields');
			
			let selectedFieldsCount = 0;
			if (selectedFields) {
				try {
					const parsed = JSON.parse(selectedFields);
					selectedFieldsCount = parsed.length;
				} catch (e) {
					console.error("Error parsing selected fields", e);
					selectedFieldsCount = 0;
				}
			}
			
			html += `
				<div class="property-group">
					<div class="property-group-title">${__("Table Properties")}</div>
					<div class="property-field">
						<div class="text-muted mb-2">
							${__("Child DocType:")} <strong>${childDoctype || __('Not set')}</strong>
						</div>
						<div class="text-muted mb-2">
							${__("Field:")} <strong>${fieldname || __('Not set')}</strong>
						</div>
						<div class="text-muted mb-3">
							${__("Selected Fields:")} <strong>${selectedFieldsCount || __('Default 5')}</strong>
						</div>
						<button class="btn btn-primary configure-table-btn w-100" style="font-size: 14px; padding: 10px;">
							<i class="fa fa-table mr-1"></i> ${__("Edit Table Fields")}
						</button>
					</div>
					<div class="property-field mt-3">
						<label>${__("Border Style")}</label>
						<select class="form-control prop-table-border">
							<option value="bordered" ${tableElement.getAttribute('data-border-style') === 'bordered' || !tableElement.getAttribute('data-border-style') ? 'selected' : ''}>${__("Bordered")}</option>
							<option value="no-border" ${tableElement.getAttribute('data-border-style') === 'no-border' ? 'selected' : ''}>${__("No Border")}</option>
							<option value="horizontal" ${tableElement.getAttribute('data-border-style') === 'horizontal' ? 'selected' : ''}>${__("Horizontal Only")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Table Style")}</label>
						<select class="form-control prop-table-style">
							<option value="default" ${tableElement.getAttribute('data-table-style') === 'default' || !tableElement.getAttribute('data-table-style') ? 'selected' : ''}>${__("Default")}</option>
							<option value="striped" ${tableElement.getAttribute('data-table-style') === 'striped' ? 'selected' : ''}>${__("Striped")}</option>
							<option value="condensed" ${tableElement.getAttribute('data-table-style') === 'condensed' ? 'selected' : ''}>${__("Condensed")}</option>
						</select>
					</div>
					
					<!-- Table Row Styling Options -->
					<div class="property-group-title mt-3">${__("Row Styling")}</div>
					<div class="property-field">
						<label>${__("Font Size")}</label>
						<div class="input-group">
							<input type="number" class="form-control prop-table-font-size" value="${tableElement.getAttribute('data-font-size') || '12'}">
							<div class="input-group-append">
								<span class="input-group-text">px</span>
							</div>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Font Weight")}</label>
						<select class="form-control prop-table-font-weight">
							<option value="normal" ${tableElement.getAttribute('data-font-weight') === 'normal' || !tableElement.getAttribute('data-font-weight') ? 'selected' : ''}>${__("Normal")}</option>
							<option value="bold" ${tableElement.getAttribute('data-font-weight') === 'bold' ? 'selected' : ''}>${__("Bold")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Text Color")}</label>
						<input type="color" class="form-control prop-table-text-color" value="${tableElement.getAttribute('data-text-color') || '#000000'}">
					</div>
					<div class="property-field">
						<label>${__("Row Padding")}</label>
						<div class="input-group">
							<input type="number" class="form-control prop-table-padding" value="${tableElement.getAttribute('data-padding') || '5'}">
							<div class="input-group-append">
								<span class="input-group-text">px</span>
							</div>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Row Background")}</label>
						<input type="color" class="form-control prop-table-row-bg" value="${tableElement.getAttribute('data-row-bg') || '#ffffff'}">
					</div>
					<div class="property-field">
						<label>${__("Text Alignment")}</label>
						<select class="form-control prop-table-text-align">
							<option value="left" ${tableElement.getAttribute('data-text-align') === 'left' || !tableElement.getAttribute('data-text-align') ? 'selected' : ''}>${__("Left")}</option>
							<option value="center" ${tableElement.getAttribute('data-text-align') === 'center' ? 'selected' : ''}>${__("Center")}</option>
							<option value="right" ${tableElement.getAttribute('data-text-align') === 'right' ? 'selected' : ''}>${__("Right")}</option>
						</select>
					</div>
				</div>
			`;
		}
		
		content.html(html);
		
		// Hide layers panel if it's visible
		this.wrapper.find('.layers-panel').removeClass('show');
		
		// Show properties panel
		panel.addClass('show');
		
		// Bind events to the properties panel
		this.bind_property_events(element);
	}
	
	bind_property_events(element) {
		const me = this;
		const panel = this.wrapper.find('.properties-panel');
		
		// Width property
		panel.find('.prop-width').on('input', function() {
			let value = $(this).val();
			const unit = panel.find('.width-unit .dropdown-toggle span').text();
			if (value && unit !== 'auto') {
				value = value + unit;
				element.style.width = value;
			} else if (unit === 'auto' || value === '') {
				element.style.width = 'auto';
			}
		});
		
		// Width unit toggle
		panel.find('.width-unit .dropdown-item').on('click', function() {
			const value = $(this).data('value');
			panel.find('.width-unit .dropdown-toggle span').text(value);
			
			let width = panel.find('.prop-width').val();
			if (width && value !== 'auto') {
				width = width + value;
				element.style.width = width;
			} else if (value === 'auto' || width === '') {
				element.style.width = 'auto';
			}
		});
		
		// Margin properties
		['top', 'right', 'bottom', 'left'].forEach(position => {
			panel.find(`.prop-margin-${position}`).on('change', function() {
				const value = $(this).val() + 'px';
				element.style[`margin${position.charAt(0).toUpperCase() + position.slice(1)}`] = value;
			});
		});
		
		// Padding properties
		['top', 'right', 'bottom', 'left'].forEach(position => {
			panel.find(`.prop-padding-${position}`).on('change', function() {
				const value = $(this).val() + 'px';
				element.style[`padding${position.charAt(0).toUpperCase() + position.slice(1)}`] = value;
			});
		});
		
		// Text align
		panel.find('.prop-align').on('click', function() {
			panel.find('.prop-align').removeClass('active');
			$(this).addClass('active');
			element.style.textAlign = $(this).data('value');
		});
		
		// Border Style for all elements
		panel.find('.prop-element-border-style').on('change', function() {
			const value = $(this).val();
			element.style.borderStyle = value;
		});
		
		// Border Color for all elements
		panel.find('.prop-element-border-color').on('change', function() {
			const value = $(this).val();
			element.style.borderColor = value;
		});
		
		// Border Width for all sides
		['top', 'right', 'bottom', 'left'].forEach(position => {
			panel.find(`.prop-border-${position}`).on('change', function() {
				const value = $(this).val() + 'px';
				element.style[`border${position.charAt(0).toUpperCase() + position.slice(1)}Width`] = value;
			});
		});
		
		// Border Radius for all corners
		const radiusMap = {
			'tl': 'TopLeft',
			'tr': 'TopRight',
			'br': 'BottomRight',
			'bl': 'BottomLeft'
		};
		
		Object.keys(radiusMap).forEach(corner => {
			panel.find(`.prop-border-radius-${corner}`).on('change', function() {
				const value = $(this).val() + 'px';
				element.style[`border${radiusMap[corner]}Radius`] = value;
			});
		});
		
		// Font properties
		const contentElement = element.querySelector('.text-element, .heading-element');
		if (contentElement) {
			// Handle heading level selection
			panel.find('.prop-heading-level').on('change', function() {
				const level = $(this).val();
				const headingContent = contentElement.querySelector('h1, h2, h3, h4, h5, h6');
				
				if (headingContent) {
					// Create new heading element of selected level
					const newHeading = document.createElement('h' + level);
					// Copy the content from the old heading
					newHeading.innerHTML = headingContent.innerHTML;
					// Apply any specific styles from the old heading
					newHeading.style.margin = '0';
					newHeading.style.padding = '0';
					
					// Replace the old heading with the new one
					headingContent.replaceWith(newHeading);
				}
			});

			panel.find('.prop-font-size').on('change', function() {
				const fontSize = $(this).val() + 'px';
				
				// If it's a heading element, apply font size to the h1-h6 tag inside
				if (contentElement.classList.contains('heading-element')) {
					const headingTag = contentElement.querySelector('h1, h2, h3, h4, h5, h6');
					if (headingTag) {
						headingTag.style.fontSize = fontSize;
					}
				} else {
					// For regular text elements, apply directly
					contentElement.style.fontSize = fontSize;
				}
			});
			
			panel.find('.prop-font-weight').on('change', function() {
				const fontWeight = $(this).val();
				
				// If it's a heading element, apply font weight to the h1-h6 tag inside
				if (contentElement.classList.contains('heading-element')) {
					const headingTag = contentElement.querySelector('h1, h2, h3, h4, h5, h6');
					if (headingTag) {
						headingTag.style.fontWeight = fontWeight;
					}
				} else {
					// For regular text elements, apply directly
					contentElement.style.fontWeight = fontWeight;
				}
			});
			
			panel.find('.prop-text-color').on('change', function() {
				const color = $(this).val();
				
				// If it's a heading element, apply color to the h1-h6 tag inside
				if (contentElement.classList.contains('heading-element')) {
					const headingTag = contentElement.querySelector('h1, h2, h3, h4, h5, h6');
					if (headingTag) {
						headingTag.style.color = color;
					}
				} else {
					// For regular text elements, apply directly
					contentElement.style.color = color;
				}
			});
			
			panel.find('.prop-bg-color').on('change', function() {
				const bgColor = $(this).val();
				
				// If it's a heading element, apply background color to the h1-h6 tag inside
				if (contentElement.classList.contains('heading-element')) {
					const headingTag = contentElement.querySelector('h1, h2, h3, h4, h5, h6');
					if (headingTag) {
						headingTag.style.backgroundColor = bgColor;
					}
				} else {
					// For regular text elements, apply directly
					contentElement.style.backgroundColor = bgColor;
				}
			});
		}
		
		// Image properties
		const imageElement = element.querySelector('.image-element img');
		if (imageElement) {
			// Width property
			panel.find('.prop-image-width').on('change', function() {
				imageElement.style.width = $(this).val() + 'px';
			});
			
			// Height property
			panel.find('.prop-image-height').on('change', function() {
				imageElement.style.height = $(this).val() + 'px';
			});
			
			// Object fit property
			panel.find('.prop-object-fit').on('change', function() {
				imageElement.style.objectFit = $(this).val();
			});
			
			// Image URL (if not a field)
			panel.find('.prop-image-url').on('change', function() {
				imageElement.src = $(this).val();
			});
			
			// Browse button
			panel.find('.prop-browse-image').on('click', function() {
				new frappe.ui.FileUploader({
					folder: 'Home/Attachments',
					on_success: (file_doc) => {
						imageElement.src = file_doc.file_url;
						panel.find('.prop-image-url').val(file_doc.file_url);
					}
				});
			});
		}
		
		// Container properties
		const containerElement = element.querySelector('.container-element');
		if (containerElement) {
			// Fix the direction buttons to apply changes immediately to ALL elements
			panel.find('.prop-direction').on('click', function() {
				panel.find('.prop-direction').removeClass('active');
				$(this).addClass('active');
				
				const direction = $(this).data('value');
				containerElement.setAttribute('data-direction', direction);
				
				// Update alignment labels based on new direction
				const mainAxisLabel = direction === 'vertical' ? 'vertical' : 'horizontal';
				const crossAxisLabel = direction === 'vertical' ? 'horizontal' : 'vertical';
				panel.find('.prop-justify-content').closest('.property-field').find('label small').text(`(${mainAxisLabel})`);
				panel.find('.prop-align-items').closest('.property-field').find('label small').text(`(${crossAxisLabel})`);
				
				// Apply the new direction to the container and ALL its children
				me.apply_container_direction(containerElement);
			});
			
			// Add handlers for justify-content and align-items
			panel.find('.prop-justify-content').on('change', function() {
				containerElement.style.justifyContent = $(this).val();
				// No need to call apply_container_direction as it would reset these values
			});
			
			panel.find('.prop-align-items').on('change', function() {
				containerElement.style.alignItems = $(this).val();
				// No need to call apply_container_direction as it would reset these values
			});

			// Add handler for gap property
			panel.find('.prop-container-gap').on('change', function() {
				const gapValue = $(this).val() + 'px';
				containerElement.style.gap = gapValue;
			});
			
			panel.find('.prop-container-bg').on('change', function() {
				containerElement.style.backgroundColor = $(this).val();
			});
			
			panel.find('.prop-border-style').on('change', function() {
				containerElement.style.borderStyle = $(this).val();
			});
			
			// Add handler for the container padding
			panel.find('.prop-container-padding').on('change', function() {
				const paddingValue = $(this).val() + 'px';
				containerElement.style.padding = paddingValue;
			});
		}
		
		// QR Code properties
		const qrcodeElement = element.querySelector('.qrcode-element');
		if (qrcodeElement) {
			// Handle data type selection (static vs field)
			panel.find('.prop-qrcode-data-type').on('change', function() {
				const dataType = $(this).val();
				if (dataType === 'static') {
					panel.find('.prop-static-value-field').show();
					panel.find('.prop-field-value-field').hide();
				} else {
					panel.find('.prop-static-value-field').hide();
					panel.find('.prop-field-value-field').show();
				}
			});
			
			// Handle QR code value change
			panel.find('.prop-qrcode-value').on('change', function() {
				const value = $(this).val();
				qrcodeElement.setAttribute('data-value', value);
			});
			
			// Handle field selection for dynamic QR codes
			panel.find('.prop-qrcode-field').on('change', function() {
				const fieldName = $(this).val();
				if (fieldName) {
					qrcodeElement.setAttribute('data-value', `{{${fieldName}}}`);
				}
			});
			
			// Handle size change
			panel.find('.prop-qrcode-size').on('change', function() {
				const size = $(this).val();
				qrcodeElement.setAttribute('data-size', size);
				const qrcodeDisplay = qrcodeElement.querySelector('.qrcode-display');
				const qrcodeCanvas = qrcodeElement.querySelector('canvas');
				if (qrcodeDisplay) {
					qrcodeDisplay.style.width = size + 'px';
					qrcodeDisplay.style.height = size + 'px';
				}
			});
			
			// Handle color change
			panel.find('.prop-qrcode-foreground').on('change', function() {
				const color = $(this).val();
				qrcodeElement.setAttribute('data-foreground', color);
			});
			
			// Handle background color change
			panel.find('.prop-qrcode-background').on('change', function() {
				const bgcolor = $(this).val();
				qrcodeElement.setAttribute('data-background', bgcolor);
				const qrcodeDisplay = qrcodeElement.querySelector('.qrcode-display');
				if (qrcodeDisplay) {
					qrcodeDisplay.style.backgroundColor = bgcolor;
				}
			});
			
			// Handle generate button click
			panel.find('.btn-generate-qrcode').on('click', function() {
				me.generateQRCode(qrcodeElement);
			});
		}
		
		// Bind event for the configure table button
		panel.find('.configure-table-btn').on('click', function() {
			me.configure_table(element);
		});
		
		// Bind events for the border style
		panel.find('.prop-table-border').on('change', function() {
			const value = $(this).val();
			const tableElement = element.querySelector('.table-element');
			if (!tableElement) return;
			
			// Remove all previous classes
			tableElement.classList.remove('table-bordered', 'table-no-border', 'table-horizontal');
			
			// Add new class based on selection
			if (value === 'bordered') {
				tableElement.classList.add('table-bordered');
			} else if (value === 'horizontal') {
				tableElement.classList.add('table-horizontal');
			} else if (value === 'no-border') {
				tableElement.classList.add('table-no-border');
			}
			
			// Update the data attribute
			tableElement.setAttribute('data-border-style', value);
		});
		
		// Bind events for the table style
		panel.find('.prop-table-style').on('change', function() {
			const value = $(this).val();
			const tableElement = element.querySelector('.table-element');
			if (!tableElement) return;
			
			// Remove all previous classes
			tableElement.classList.remove('table-striped', 'table-condensed');
			
			// Add new class based on selection
			if (value === 'striped') {
				tableElement.classList.add('table-striped');
			} else if (value === 'condensed') {
				tableElement.classList.add('table-condensed');
			}
			
			// Update the data attribute
			tableElement.setAttribute('data-table-style', value);
		});
		
		// Table Row Font Size
		panel.find('.prop-table-font-size').on('change', function() {
			const value = $(this).val();
			const tableElement = element.querySelector('.table-element');
			if (!tableElement) return;
			
			// Update the data attribute
			tableElement.setAttribute('data-font-size', value);
			
			// Apply the style to the table
			const table = tableElement.querySelector('table');
			if (table) {
				// Apply font size to all cells in the table
				const cells = table.querySelectorAll('td');
				cells.forEach(cell => {
					cell.style.fontSize = value + 'px';
				});
				
				// Store for the template
				if (!tableElement.hasAttribute('data-row-styles')) {
					tableElement.setAttribute('data-row-styles', JSON.stringify({}));
				}
				
				try {
					const styles = JSON.parse(tableElement.getAttribute('data-row-styles') || '{}');
					styles.fontSize = value + 'px';
					tableElement.setAttribute('data-row-styles', JSON.stringify(styles));
				} catch (e) {
					console.error("Error updating row styles", e);
				}
			}
		});
		
		// Table Row Font Weight
		panel.find('.prop-table-font-weight').on('change', function() {
			const value = $(this).val();
			const tableElement = element.querySelector('.table-element');
			if (!tableElement) return;
			
			// Update the data attribute
			tableElement.setAttribute('data-font-weight', value);
			
			// Apply the style to the table
			const table = tableElement.querySelector('table');
			if (table) {
				// Apply font weight to all cells in the table
				const cells = table.querySelectorAll('td');
				cells.forEach(cell => {
					cell.style.fontWeight = value;
				});
				
				// Store for the template
				try {
					const styles = JSON.parse(tableElement.getAttribute('data-row-styles') || '{}');
					styles.fontWeight = value;
					tableElement.setAttribute('data-row-styles', JSON.stringify(styles));
				} catch (e) {
					console.error("Error updating row styles", e);
				}
			}
		});
		
		// Table Row Text Color
		panel.find('.prop-table-text-color').on('change', function() {
			const value = $(this).val();
			const tableElement = element.querySelector('.table-element');
			if (!tableElement) return;
			
			// Update the data attribute
			tableElement.setAttribute('data-text-color', value);
			
			// Apply the style to the table
			const table = tableElement.querySelector('table');
			if (table) {
				// Apply text color to all cells in the table
				const cells = table.querySelectorAll('td');
				cells.forEach(cell => {
					cell.style.color = value;
				});
				
				// Store for the template
				try {
					const styles = JSON.parse(tableElement.getAttribute('data-row-styles') || '{}');
					styles.color = value;
					tableElement.setAttribute('data-row-styles', JSON.stringify(styles));
				} catch (e) {
					console.error("Error updating row styles", e);
				}
			}
		});
		
		// Table Row Padding
		panel.find('.prop-table-padding').on('change', function() {
			const value = $(this).val();
			const tableElement = element.querySelector('.table-element');
			if (!tableElement) return;
			
			// Update the data attribute
			tableElement.setAttribute('data-padding', value);
			
			// Apply the style to the table
			const table = tableElement.querySelector('table');
			if (table) {
				// Apply padding to all cells in the table
				const cells = table.querySelectorAll('td');
				cells.forEach(cell => {
					cell.style.padding = value + 'px';
				});
				
				// Store for the template
				try {
					const styles = JSON.parse(tableElement.getAttribute('data-row-styles') || '{}');
					styles.padding = value + 'px';
					tableElement.setAttribute('data-row-styles', JSON.stringify(styles));
				} catch (e) {
					console.error("Error updating row styles", e);
				}
			}
		});
		
		// Table Row Background
		panel.find('.prop-table-row-bg').on('change', function() {
			const value = $(this).val();
			const tableElement = element.querySelector('.table-element');
			if (!tableElement) return;
			
			// Update the data attribute
			tableElement.setAttribute('data-row-bg', value);
			
			// Apply the style to the table
			const table = tableElement.querySelector('table');
			if (table) {
				// Apply background to all cells in the table (except headers)
				const cells = table.querySelectorAll('td');
				cells.forEach(cell => {
					cell.style.backgroundColor = value;
				});
				
				// Store for the template
				try {
					const styles = JSON.parse(tableElement.getAttribute('data-row-styles') || '{}');
					styles.backgroundColor = value;
					tableElement.setAttribute('data-row-styles', JSON.stringify(styles));
				} catch (e) {
					console.error("Error updating row styles", e);
				}
			}
		});
		
		// Table Text Alignment
		panel.find('.prop-table-text-align').on('change', function() {
			const value = $(this).val();
			const tableElement = element.querySelector('.table-element');
			if (!tableElement) return;
			
			// Update the data attribute
			tableElement.setAttribute('data-text-align', value);
			
			// Apply the style to the table
			const table = tableElement.querySelector('table');
			if (table) {
				// Apply text alignment to all cells in the table (except headers)
				const cells = table.querySelectorAll('td');
				cells.forEach(cell => {
					cell.style.textAlign = value;
				});
				
				// Store for the template
				try {
					const styles = JSON.parse(tableElement.getAttribute('data-row-styles') || '{}');
					styles.textAlign = value;
					tableElement.setAttribute('data-row-styles', JSON.stringify(styles));
				} catch (e) {
					console.error("Error updating row styles", e);
				}
			}
		});
	}
	
	// Helper function to convert RGB to Hex
	rgb2hex(rgb) {
		if (!rgb || rgb === 'transparent' || rgb === 'var(--bg-light)') return '#f8f9fa';
		
		// Check if already a hex color
		if (rgb.startsWith('#')) return rgb;
		
		// Convert rgb(r,g,b) to hex
		const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
		if (!match) return '#f8f9fa';
		
		function hex(x) {
			return ("0" + parseInt(x).toString(16)).slice(-2);
		}
		
		return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
	}
	
	// Helper to normalize color names to hex values for the color picker
	normalizeColor(color) {
		// Simple color name to hex mapping for common QR code colors
		const colorMap = {
			'black': '#000000',
			'white': '#ffffff',
			'red': '#ff0000',
			'green': '#00ff00',
			'blue': '#0000ff',
			'yellow': '#ffff00',
			'purple': '#800080',
			'gray': '#808080'
		};
		
		// Return mapped color or original if it's already a hex value or not in map
		return colorMap[color.toLowerCase()] || (color.startsWith('#') ? color : '#000000');
	}
	
	// Helper method to generate field options for QR Code
	getFieldOptionsForQRCode(currentValue) {
		if (!this.doctype) return '';
		
		let options = '';
		let selectedFieldName = '';
		
		// Extract field name from curly braces if present
		if (currentValue && currentValue.includes('{{') && currentValue.includes('}}')) {
			selectedFieldName = currentValue.replace('{{', '').replace('}}', '').trim();
		}
		
		// Get all available fields for the current doctype
		if (this.fields && this.fields.length) {
			this.fields.forEach(field => {
				const selected = field.fieldname === selectedFieldName ? 'selected' : '';
				options += `<option value="${field.fieldname}" ${selected}>${field.label}</option>`;
			});
		}
		
		return options;
	}
	
	edit_element(element, type) {
		// The functionality is now handled directly in the properties panel
		// This method is kept for compatibility but doesn't do anything
		return;
	}
	
	configure_table(element) {
		const tableElement = element.querySelector('.table-element');
		if (!tableElement) return;
		
		const fieldname = tableElement.getAttribute('data-fieldname');
		const options = tableElement.getAttribute('data-options'); // Child DocType
		
		if (!options) {
			frappe.msgprint(__("Table configuration not possible. Missing child doctype information."));
				return;
			}

		// Fetch fields from child doctype
		frappe.call({
			method: 'invoicer.invoicer.page.invoicer.invoicer.get_doctype_fields',
			args: { doctype: options },
			freeze: true,
			freeze_message: __("Loading fields..."),
			callback: (r) => {
				if (r.message && r.message.success) {
					const fields = r.message.fields || [];
					this.show_table_field_selector(element, fieldname, options, fields);
				} else {
					frappe.msgprint(__("Could not fetch fields for {0}", [options]));
				}
			}
		});
	}
	
	show_table_field_selector(element, fieldname, childDoctype, fields) {
		const tableElement = element.querySelector('.table-element');
		if (!tableElement) return;
		
		// Get current selected fields if any
		const currentSelectedFields = tableElement.getAttribute('data-selected-fields');
		let selectedFields = [];
		
		if (currentSelectedFields) {
			try {
				selectedFields = JSON.parse(currentSelectedFields);
			} catch (e) {
				console.error("Error parsing selected fields", e);
				selectedFields = [];
			}
		}
		
		// Store all fields information in the table element
		tableElement.setAttribute('data-all-fields', JSON.stringify(fields));
		
		// Create dialog field rows for each field
		const fieldRows = [];
		fields.forEach(field => {
			fieldRows.push({
				fieldtype: 'Check',
				fieldname: `field_${field.fieldname}`,
				label: field.label || field.fieldname,
				default: selectedFields.includes(field.fieldname),
				onchange: function() {
					// This function will be called when the checkbox value changes
				}
			});
		});
		
		// Create the dialog
		const dialog = new frappe.ui.Dialog({
			title: __("Configure Table Fields"),
			fields: [
				{
					fieldtype: 'HTML',
					fieldname: 'fields_description',
					options: `
						<div class="text-muted">
							${__("Select fields to display in the table. The fields will appear in the order they are selected.")}
						</div>
					`
				},
				{
					fieldtype: 'Section Break',
					label: __('Available Fields')
				},
				...fieldRows,
				{
					fieldtype: 'Section Break'
					},
					{
						fieldtype: 'HTML',
					fieldname: 'preview_html',
					label: __('Preview'),
					options: `<div class="table-preview"></div>`
				}
			],
			primary_action_label: __('Apply'),
			primary_action: (values) => {
				// Extract selected fields
				const newSelectedFields = [];
				
				// Iterate through all fields and check if they are selected
				fields.forEach(field => {
					if (values[`field_${field.fieldname}`]) {
						newSelectedFields.push(field.fieldname);
					}
				});
				
				// Save selected fields to the table element
				tableElement.setAttribute('data-selected-fields', JSON.stringify(newSelectedFields));
				
				// Update table preview based on selected fields
				this.update_table_preview(tableElement, fields, newSelectedFields);
				
				dialog.hide();
			}
		});
		
		dialog.show();
		
		// Set up a change handler for preview updates
		dialog.$wrapper.find('.form-section').on('change', 'input[type=checkbox]', () => {
			const values = dialog.get_values();
			const previewFields = [];
			
			fields.forEach(field => {
				if (values[`field_${field.fieldname}`]) {
					previewFields.push(field);
				}
			});
			
			// Update preview
			const previewHtml = this.get_table_preview_html(previewFields);
			dialog.$wrapper.find('.table-preview').html(previewHtml);
			
			// Initialize column resizers in the preview
			const previewTable = dialog.$wrapper.find('.table-preview table')[0];
			if (previewTable) {
				this.initializeColumnResizers(previewTable);
			}
		});
		
		// Show initial preview if fields are already selected
		if (selectedFields.length > 0) {
			const previewFields = fields.filter(f => selectedFields.includes(f.fieldname));
			const previewHtml = this.get_table_preview_html(previewFields);
			dialog.$wrapper.find('.table-preview').html(previewHtml);
			
			// Initialize column resizers in the preview
			const previewTable = dialog.$wrapper.find('.table-preview table')[0];
			if (previewTable) {
				this.initializeColumnResizers(previewTable);
			}
		} else {
			// Show default preview with first 5 fields
			const previewFields = fields.slice(0, 5);
			const previewHtml = this.get_table_preview_html(previewFields);
			dialog.$wrapper.find('.table-preview').html(previewHtml);
			
			// Initialize column resizers in the preview
			const previewTable = dialog.$wrapper.find('.table-preview table')[0];
			if (previewTable) {
				this.initializeColumnResizers(previewTable);
			}
		}
	}
	
	get_table_preview_html(fields) {
		if (!fields || !fields.length) {
			return `<div class="text-muted">${__("No fields selected")}</div>`;
		}
		
		// Generate a preview table with selected fields
		let html = `
			<table class="table table-bordered table-preview" style="width: 100%; table-layout: fixed;">
				<thead>
					<tr>
		`;
		
		// Add headers with resizers
		fields.forEach((field, index) => {
			// Add column resizer handles to each header except the last one
			const resizer = index < fields.length - 1 ? 
				`<div class="column-resizer" data-column-index="${index}"></div>` : '';
				
			// Check if field has a custom width
			const widthAttr = field.custom_width ? `style="width:${field.custom_width}"` : '';
				
			html += `<th ${widthAttr} data-fieldname="${field.fieldname}" style="font-weight: 700; background-color: #f8f8f8; text-align: center;"><strong>${field.label || field.fieldname}</strong>${resizer}</th>`;
		});
		
		html += `
					</tr>
				</thead>
				<tbody>
					<tr>
		`;
		
		// Add sample data row
		fields.forEach(field => {
			html += `<td>${__("Sample data")}</td>`;
		});
		
		html += `
					</tr>
				</tbody>
			</table>
		`;
		
		return html;
	}
	
	update_table_preview(tableElement, allFields, selectedFieldnames) {
		// Find the fields that are selected
		const selectedFields = allFields.filter(f => selectedFieldnames.includes(f.fieldname));
		
		// Get the table element within the table placeholder
		const table = tableElement.querySelector('table');
		if (!table) return;
		
		// Get table field name and child doctype
		const fieldname = tableElement.getAttribute('data-fieldname');
		const childDoctype = tableElement.getAttribute('data-options');
		
		// Ensure table has 100% width and fixed layout
		table.style.width = '100%';
		table.style.tableLayout = 'fixed';
		
		// Create table header
		let theadHTML = '<tr>';
		selectedFields.forEach((field, index) => {
			// Check if a width was previously set
			const widthAttr = field.custom_width ? `style="width:${field.custom_width}"` : '';
			
			// Add column resizer handles to each header except the last one
			const resizer = index < selectedFields.length - 1 ? 
				`<div class="column-resizer" data-column-index="${index}"></div>` : '';
				
			theadHTML += `<th ${widthAttr} data-fieldname="${field.fieldname}" style="font-weight: 700; background-color: #f8f8f8; text-align: center;"><strong>${field.label || field.fieldname}</strong>${resizer}</th>`;
		});
		theadHTML += '</tr>';
		
		// Get row styles from the table element attributes
		let rowStyles = {};
		try {
			rowStyles = JSON.parse(tableElement.getAttribute('data-row-styles') || '{}');
		} catch (e) {
			console.error("Error parsing row styles", e);
		}
		
		// Create a style string for the cells
		let cellStyleStr = '';
		if (rowStyles.fontSize) cellStyleStr += `font-size: ${rowStyles.fontSize}; `;
		if (rowStyles.fontWeight) cellStyleStr += `font-weight: ${rowStyles.fontWeight}; `;
		if (rowStyles.color) cellStyleStr += `color: ${rowStyles.color}; `;
		if (rowStyles.padding) cellStyleStr += `padding: ${rowStyles.padding}; `;
		if (rowStyles.backgroundColor) cellStyleStr += `background-color: ${rowStyles.backgroundColor}; `;
		if (rowStyles.textAlign) cellStyleStr += `text-align: ${rowStyles.textAlign}; `;
		
		// Create table body with Jinja template for looping over the table data
		let tbodyHTML = `{% for row in doc.${fieldname} %}\n<tr>`;
		selectedFields.forEach(field => {
			tbodyHTML += `\n  <td style="${cellStyleStr}">{{ row.${field.fieldname} }}</td>`;
		});
		tbodyHTML += `\n</tr>\n{% endfor %}`;
		
		// For display in the editor, add a sample row
		let sampleHTML = '<tr>';
		selectedFields.forEach(() => {
			sampleHTML += `<td style="${cellStyleStr}">${__("Sample data")}</td>`;
		});
		sampleHTML += '</tr>';
		
		// Update the table
		table.querySelector('thead').innerHTML = theadHTML;
		
		// Store both the Jinja template and sample HTML
		tableElement.setAttribute('data-jinja-template', tbodyHTML);
		table.querySelector('tbody').innerHTML = sampleHTML;
		
		// Add a hidden div with a note about the dynamic table
		let noteElement = tableElement.querySelector('.table-dynamic-note');
		if (!noteElement) {
			noteElement = document.createElement('div');
			noteElement.className = 'table-dynamic-note';
			noteElement.style.fontSize = '10px';
			noteElement.style.color = '#888';
			noteElement.style.marginTop = '5px';
			tableElement.appendChild(noteElement);
		}
		noteElement.textContent = `Dynamic table from ${fieldname} (${childDoctype})`;
		
		// Initialize column resizers
		this.initializeColumnResizers(table);
	}
	
	// New method to initialize table column resizers
	initializeColumnResizers(table) {
		const me = this;
		const resizers = table.querySelectorAll('.column-resizer');
		
		// Add event listeners for each resizer
		resizers.forEach(resizer => {
			resizer.addEventListener('mousedown', function(e) {
				e.preventDefault();
				e.stopPropagation();
				
				// Mark as resizing
				resizer.classList.add('resizing');
				
				// Get the column index
				const columnIndex = parseInt(resizer.getAttribute('data-column-index'));
				
				// Get the header cell
				const th = resizer.parentElement;
				
				// Initial width
				const initialWidth = th.getBoundingClientRect().width;
				const initialX = e.clientX;
				
				// Create a function to handle mouse movement
				function handleMouseMove(e) {
					// Calculate the width change
					const deltaX = e.clientX - initialX;
					
					// Apply the new width
					const newWidth = initialWidth + deltaX;
					if (newWidth > 30) { // Minimum column width
						th.style.width = newWidth + 'px';
						
						// Store the width in the field's data attribute
						const fieldname = th.getAttribute('data-fieldname');
						if (fieldname) {
							// Find the field in allFields
							const tableElement = table.closest('.table-element');
							if (tableElement) {
								const selectedFields = JSON.parse(tableElement.getAttribute('data-selected-fields') || '[]');
								const allFieldsStr = tableElement.getAttribute('data-all-fields');
								
								if (allFieldsStr) {
									try {
										const allFields = JSON.parse(allFieldsStr);
										const field = allFields.find(f => f.fieldname === fieldname);
										if (field) {
											field.custom_width = newWidth + 'px';
											tableElement.setAttribute('data-all-fields', JSON.stringify(allFields));
										}
									} catch (e) {
										console.error('Error updating field width', e);
									}
								}
							}
						}
					}
				}
				
				// Create a function to handle mouse up
				function handleMouseUp() {
					// Remove the resizing class
					resizer.classList.remove('resizing');
					
					// Remove event listeners
					document.removeEventListener('mousemove', handleMouseMove);
					document.removeEventListener('mouseup', handleMouseUp);
				}
				
				// Add event listeners for mouse movement and up
				document.addEventListener('mousemove', handleMouseMove);
				document.addEventListener('mouseup', handleMouseUp);
			});
		});
	}
	
	preview_design(designName) {
		frappe.call({
			method: 'invoicer.invoicer.page.invoicer.invoicer.get_invoice_design',
			args: { design_name: designName },
			callback: (r) => {
				if (r.message && r.message.success) {
					const tempDiv = document.createElement('div');
					tempDiv.innerHTML = r.message.content;
					
					// Remove controls from the preview
					tempDiv.querySelectorAll('.element-controls').forEach(control => {
						control.remove();
					});
					
					// Remove dropzones from the preview
					tempDiv.querySelectorAll('.dropzone').forEach(dropzone => {
						dropzone.style.display = 'none';
					});
					
					// Remove helper classes from elements
					tempDiv.querySelectorAll('.canvas-element').forEach(element => {
						// Remove any helper classes
						element.classList.remove('selected', 'dragging-enabled');
						element.style.cursor = '';
						element.style.boxShadow = '';
					});
					
					// Process QR codes for rendering
					tempDiv.querySelectorAll('.qrcode-element').forEach(qrElement => {
						this.generateQRCode(qrElement, true);
					});
					
					// Open preview in new window
					const w = window.open();
					const html = `
						<!DOCTYPE html>
						<html>
						<head>
							<title>${__("Print Preview: ")}${r.message.design_name}</title>
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
								@media print {
									body {
										padding: 0;
									}
									.print-canvas {
										box-shadow: none;
									}
									.toolbar {
										display: none;
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
							<div class="print-canvas">${tempDiv.innerHTML}</div>
						</body>
						</html>
					`;
					
					$(w.document.body).html(html);
				}
			}
		});
	}

	// Method to generate QR code using QRious
	generateQRCode(qrcodeElement, isPreview = false) {
		// Check if QRious library is loaded
		if (typeof QRious === 'undefined') {
			frappe.throw(__('QRious library not loaded. Please refresh the page.'));
			return;
		}
		
		// Get QR code parameters
		const value = qrcodeElement.getAttribute('data-value') || 'https://frappeframework.com';
		const size = parseInt(qrcodeElement.getAttribute('data-size')) || 150;
		const background = qrcodeElement.getAttribute('data-background') || 'white';
		const foreground = qrcodeElement.getAttribute('data-foreground') || 'black';
		const padding = parseInt(qrcodeElement.getAttribute('data-padding')) || 10;
		const level = qrcodeElement.getAttribute('data-level') || 'L';
		
		// Determine the QR code value
		let qrValue = value;
		
		// If it's a field reference and we're in preview mode, generate a sample value
		if (value.includes('{{') && value.includes('}}')) {
			if (isPreview) {
				const fieldName = value.replace('{{', '').replace('}}', '').trim();
				qrValue = `Sample data for ${fieldName}`;
			} else {
				// In design mode, we just show a placeholder with the field name
				qrValue = 'https://frappeframework.com';
			}
		}
		
		// Find or create canvas for the QR code
		let canvas = qrcodeElement.querySelector('canvas');
		if (!canvas) {
			const canvasId = 'qrcode-canvas-' + Date.now();
			canvas = document.createElement('canvas');
			canvas.id = canvasId;
			canvas.width = size;
			canvas.height = size;
			
			// Get or create the display container
			let qrcodeDisplay = qrcodeElement.querySelector('.qrcode-display');
			if (!qrcodeDisplay) {
				qrcodeDisplay = document.createElement('div');
				qrcodeDisplay.className = 'qrcode-display';
				qrcodeDisplay.style.width = size + 'px';
				qrcodeDisplay.style.height = size + 'px';
				qrcodeDisplay.style.display = 'flex';
				qrcodeDisplay.style.alignItems = 'center';
				qrcodeDisplay.style.justifyContent = 'center';
				qrcodeDisplay.style.margin = '0 auto';
				
				// Clear the element and append the new display div
				qrcodeElement.innerHTML = '';
				qrcodeDisplay.appendChild(canvas);
				qrcodeElement.appendChild(qrcodeDisplay);
			} else {
				qrcodeDisplay.innerHTML = '';
				qrcodeDisplay.appendChild(canvas);
			}
		}
		
		// Generate the QR code using QRious
		try {
			// Create new QRious instance
			new QRious({
				element: canvas,
				value: qrValue,
				size: size,
				background: background,
				foreground: foreground,
				padding: padding, 
				level: level
			});
				} catch (e) {
			console.error('Error generating QR code:', e);
			const qrcodeDisplay = qrcodeElement.querySelector('.qrcode-display');
			if (qrcodeDisplay) {
				qrcodeDisplay.innerHTML = `<div class="text-danger p-2">${__('Error generating QR code')}</div>`;
				}
			}
	}
}