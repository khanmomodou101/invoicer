(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };

  // ../invoicer/invoicer/invoicer/page/invoicer/layers_panel.js
  frappe.provide("frappe.invoicer");
  frappe.invoicer.LayersPanel = class LayersPanel {
    constructor(parent) {
      this.parent = parent;
      this.wrapper = parent.wrapper;
      this.setup();
    }
    setup() {
      this.create_panel_html();
      this.bind_events();
    }
    create_panel_html() {
      this.panel = this.wrapper.find(".layers-panel");
      this.panel_content = this.wrapper.find(".layers-content");
    }
    bind_events() {
      const me = this;
      this.wrapper.find(".layers-panel-close").on("click", () => {
        this.hide();
      });
      this.wrapper.find(".navigator-btn").on("click", () => {
        this.toggle();
      });
    }
    toggle() {
      if (this.panel.hasClass("show")) {
        this.hide();
      } else {
        this.wrapper.find(".properties-panel").removeClass("show");
        this.show();
        this.generate_layers_tree();
      }
    }
    show() {
      this.panel.addClass("show");
    }
    hide() {
      this.panel.removeClass("show");
    }
    generate_layers_tree() {
      const canvas = document.getElementById("print-canvas");
      this.panel_content.empty();
      const treeHTML = this.generate_element_tree(canvas, 0);
      this.panel_content.html(treeHTML);
      this.bind_layer_events();
    }
    generate_element_tree(element, level) {
      let html = "";
      if (element.id === "print-canvas") {
        const children = element.querySelectorAll(":scope > .canvas-element");
        children.forEach((child) => {
          html += this.generate_layer_item(child, level);
        });
      } else if (element.classList.contains("canvas-element")) {
        const containerElement = element.querySelector(".container-element");
        if (containerElement) {
          const children = containerElement.querySelectorAll(":scope > .canvas-element");
          if (children.length > 0) {
            html += '<div class="layer-item-children">';
            children.forEach((child) => {
              html += this.generate_layer_item(child, level + 1);
            });
            html += "</div>";
          }
        }
      }
      return html;
    }
    generate_layer_item(element, level) {
      const typeElement = element.querySelector("[data-type]");
      if (!typeElement)
        return "";
      const elementType = typeElement.getAttribute("data-type");
      const elementId = element.id;
      const isSelected = element.classList.contains("selected");
      let icon = "fa-question";
      let label = "Unknown";
      switch (elementType) {
        case "container":
          icon = "fa-columns";
          label = "Container";
          break;
        case "text":
          icon = "fa-font";
          label = "Text";
          const textElement = element.querySelector(".text-element");
          if (textElement) {
            const textContent = textElement.textContent.trim();
            if (textContent) {
              label += ": " + (textContent.length > 15 ? textContent.substring(0, 15) + "..." : textContent);
            }
          }
          break;
        case "heading":
          icon = "fa-header";
          label = "Heading";
          const headingElement = element.querySelector(".heading-element");
          if (headingElement) {
            const headingContent = headingElement.textContent.trim();
            if (headingContent) {
              label += ": " + (headingContent.length > 15 ? headingContent.substring(0, 15) + "..." : headingContent);
            }
          }
          break;
        case "image":
          icon = "fa-image";
          label = "Image";
          break;
        case "qrcode":
          icon = "fa-qrcode";
          label = "QR Code";
          break;
        case "table":
          icon = "fa-table";
          label = "Table";
          const tableElement = element.querySelector(".table-element");
          if (tableElement) {
            const fieldname = tableElement.getAttribute("data-fieldname");
            if (fieldname) {
              label += ": " + fieldname;
            }
          }
          break;
      }
      let html = `
            <div class="layer-item ${isSelected ? "selected" : ""}" data-element-id="${elementId}">
                <div class="layer-item-icon">
                    <i class="fa ${icon}"></i>
                </div>
                <div class="layer-item-label">
                    ${label}
                </div>
        `;
      const containerElement = element.querySelector(".container-element");
      if (containerElement && containerElement.querySelectorAll(".canvas-element").length > 0) {
        html += `
                <div class="layer-toggle">
                    <i class="fa fa-chevron-down"></i>
                </div>
            `;
      }
      html += `</div>`;
      if (elementType === "container") {
        html += this.generate_element_tree(element, level + 1);
      }
      return html;
    }
    bind_layer_events() {
      const me = this;
      this.wrapper.find(".layer-item").on("click", function(e) {
        e.stopPropagation();
        const elementId = $(this).data("element-id");
        if (!elementId)
          return;
        const element = document.getElementById(elementId);
        if (!element)
          return;
        document.querySelectorAll(".canvas-element.selected, .canvas-element.table-selected").forEach((el) => {
          el.classList.remove("selected");
          el.classList.remove("table-selected");
        });
        element.classList.add("selected");
        const tableElement = element.querySelector(".table-element");
        if (tableElement) {
          element.classList.add("table-selected");
        }
        me.hide();
        me.parent.show_properties_panel(element);
        me.wrapper.find(".layer-item").removeClass("selected");
        $(this).addClass("selected");
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      this.wrapper.find(".layer-toggle").on("click", function(e) {
        e.stopPropagation();
        const layerItem = $(this).closest(".layer-item");
        const children = layerItem.next(".layer-item-children");
        if (children.is(":visible")) {
          children.slideUp(200);
          $(this).find("i").removeClass("fa-chevron-down").addClass("fa-chevron-right");
        } else {
          children.slideDown(200);
          $(this).find("i").removeClass("fa-chevron-right").addClass("fa-chevron-down");
        }
      });
    }
  };

  // ../invoicer/invoicer/invoicer/page/invoicer/invoicer.js
  frappe.pages["invoicer"].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
      parent: wrapper,
      title: "Print Designer",
      single_column: true
    });
    frappe.print_designer = new frappe.PrintDesigner(page);
    frappe.breadcrumbs.add("Invoicer", "Print Designer");
  };
  frappe.pages["invoicer"].on_page_show = function(wrapper) {
    var route = frappe.get_route();
    if (route.length > 1) {
      frappe.model.with_doc("Print Design", route[1], function() {
        frappe.print_designer.load_design(route[1]);
      });
    } else if (frappe.route_options) {
      if (frappe.route_options.make_new) {
        frappe.print_designer.setup_new_design(
          frappe.route_options.doctype,
          frappe.route_options.name
        );
        frappe.route_options = null;
      } else if (frappe.route_options.doc) {
        frappe.print_designer.print_design = frappe.route_options.doc;
        frappe.route_options = null;
        frappe.print_designer.refresh();
      }
    } else {
      frappe.print_designer.show_start();
    }
  };
  frappe.PrintDesigner = class PrintDesigner {
    constructor(page) {
      this.page = page;
      this.wrapper = $(page.body);
      this.sidebar = $(page.sidebar);
      this.handle_drop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const container = e.target.closest(".container-element");
        if (!container || container.hasAttribute("data-processing"))
          return;
        container.setAttribute("data-processing", "true");
        container.classList.remove("drag-over");
        const placeholder = container.querySelector(".container-placeholder");
        if (placeholder) {
          placeholder.remove();
        }
        const data = e.dataTransfer.getData("text/plain");
        let element;
        if (data.startsWith("new:")) {
          const elementType = data.replace("new:", "");
          element = this.create_element(elementType);
        } else if (data.startsWith("field:")) {
          const [, fieldname, fieldtype, options] = data.split(":");
          element = this.create_field_element(fieldname, fieldtype, options);
        } else {
          const sourceElement = document.getElementById(data);
          if (sourceElement) {
            if (sourceElement.contains(container)) {
              console.log("Cannot drop a container inside itself");
              setTimeout(() => {
                container.removeAttribute("data-processing");
              }, 100);
              return;
            }
            element = sourceElement.cloneNode(true);
            sourceElement.remove();
            this.attach_element_events(element);
            const contentElements = element.querySelectorAll(".text-element, .heading-element");
            contentElements.forEach((content) => {
              this.attach_content_events(content);
            });
            const nestedContainers = element.querySelectorAll(".container-element");
            nestedContainers.forEach((nestedContainer) => {
              this.attach_container_events(nestedContainer);
            });
          }
        }
        if (element) {
          container.appendChild(element);
          this.apply_container_direction(container);
        }
        setTimeout(() => {
          container.removeAttribute("data-processing");
        }, 100);
      };
      this.setup_page();
    }
    setup_page() {
      this.page.set_title(__("Invoice Designer"));
      this.add_custom_css();
      this.page.set_primary_action(__("Save"), () => {
        this.save_design();
      });
      this.page.add_menu_item(__("Print Design List"), () => {
        this.show_start();
      });
      this.load_libraries().then(() => {
        this.show_start();
      }).catch((err) => {
        console.error("Error loading libraries:", err);
        frappe.throw(__("Failed to load required libraries"));
      });
    }
    load_libraries() {
      return new Promise((resolve, reject) => {
        $.getScript("https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js").done(() => {
          console.log("QRious library loaded successfully");
          resolve();
        }).fail((jqxhr, settings, exception) => {
          console.error("Failed to load QRious library:", exception);
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
      $("head").append(`
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
      let style = document.createElement("style");
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
      this.wrapper.empty();
      this.page.clear_primary_action();
      this.page.clear_secondary_action();
      this.page.set_primary_action(__("New Format"), () => {
        this.show_new_format_dialog();
      });
      this.load_print_list();
    }
    load_print_list() {
      frappe.call({
        method: "invoicer.invoicer.page.invoicer.invoicer.get_invoice_designs",
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
              designs.forEach((design) => {
                const isDefault = design.is_default ? `<span class="indicator-pill green">${__("Default")}</span>` : "";
                html += `
							<div class="list-row small">
								<div class="row">
										<div class="col-5">
											${design.design_name} ${isDefault}
										</div>
									<div class="col-3">${design.reference_doctype || ""}</div>
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
														${!design.is_default ? `<li><a class="dropdown-item set-default-design" data-name="${design.name}">
																${__("Set as Default")}
															</a></li>` : ""}
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
            this.wrapper.html(html);
            this.wrapper.find(".edit-design").on("click", (e) => {
              const designName = $(e.currentTarget).data("name");
              frappe.set_route("invoicer", designName);
            });
            this.wrapper.find(".preview-design").on("click", (e) => {
              const designName = $(e.currentTarget).data("name");
              this.preview_design(designName);
            });
            this.wrapper.find(".delete-design").on("click", (e) => {
              const designName = $(e.currentTarget).data("name");
              this.delete_design(designName);
            });
            this.wrapper.find(".duplicate-design").on("click", (e) => {
              const designName = $(e.currentTarget).data("name");
              this.duplicate_design(designName);
            });
            this.wrapper.find(".set-default-design").on("click", (e) => {
              const designName = $(e.currentTarget).data("name");
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
            fieldtype: "Data",
            fieldname: "design_name",
            label: __("Format Name"),
            reqd: 1
          },
          {
            fieldtype: "Link",
            fieldname: "doctype",
            label: __("Reference DocType"),
            options: "DocType",
            reqd: 1,
            get_query: () => {
              return {
                filters: [["DocType", "istable", "=", 0]]
              };
            }
          }
        ],
        primary_action_label: __("Create"),
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
          fieldtype: "Data",
          fieldname: "new_name",
          label: __("New Design Name"),
          reqd: 1
        },
        (values) => {
          frappe.call({
            method: "invoicer.invoicer.page.invoicer.invoicer.duplicate_print_design",
            args: {
              design_name: designName,
              new_name: values.new_name
            },
            callback: (r) => {
              if (r.message && r.message.success) {
                frappe.show_alert({
                  message: __("Design duplicated successfully"),
                  indicator: "green"
                }, 3);
                frappe.set_route("invoicer", r.message.name);
              } else {
                frappe.show_alert({
                  message: __("Failed to duplicate design"),
                  indicator: "red"
                }, 3);
              }
            }
          });
        },
        __("Duplicate Print Design"),
        __("Create")
      );
    }
    set_default_design(designName) {
      frappe.call({
        method: "invoicer.invoicer.page.invoicer.invoicer.set_default_print_design",
        args: {
          design_name: designName
        },
        callback: (r) => {
          if (r.message && r.message.success) {
            frappe.show_alert({
              message: __("Print design set as default"),
              indicator: "green"
            }, 3);
            this.load_print_list();
          } else {
            frappe.show_alert({
              message: __("Failed to set default design"),
              indicator: "red"
            }, 3);
          }
        }
      });
    }
    delete_design(designName) {
      frappe.confirm(
        __("Are you sure you want to delete this design?"),
        () => {
          frappe.call({
            method: "invoicer.invoicer.page.invoicer.invoicer.delete_invoice_design",
            args: { design_name: designName },
            callback: (r) => {
              if (r.message && r.message.success) {
                frappe.show_alert({
                  message: __("Design deleted successfully"),
                  indicator: "green"
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
        method: "invoicer.invoicer.page.invoicer.invoicer.get_invoice_design",
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
            this.page.set_title(__("Editing: {0}", [this.design_name]));
            frappe.set_route("invoicer", designName, false);
            this.setup_design_editor(r.message.content);
          } else {
            frappe.throw(__("Failed to load design"));
          }
        }
      });
    }
    setup_design_editor(content) {
      this.wrapper = this.page.main.empty().html(`
			<div class="print-designer-container">
				<div class="elements-sidebar">
					<div class="element-group">
						<div class="element-group-title">${__("Basic Elements")}</div>
						
						<div class="element-item" draggable="true" data-type="text">
							<div class="element-item-icon"><i class="fa fa-font"></i></div>
							<div class="element-item-label">${__("Text")}</div>
						</div>
						
						<div class="element-item" draggable="true" data-type="heading">
							<div class="element-item-icon"><i class="fa fa-header"></i></div>
							<div class="element-item-label">${__("Heading")}</div>
						</div>
						
						<div class="element-item" draggable="true" data-type="image">
							<div class="element-item-icon"><i class="fa fa-image"></i></div>
							<div class="element-item-label">${__("Image")}</div>
						</div>
						
						<div class="element-item" draggable="true" data-type="container">
							<div class="element-item-icon"><i class="fa fa-columns"></i></div>
							<div class="element-item-label">${__("Container")}</div>
						</div>
						
						<div class="element-item" draggable="true" data-type="qrcode">
							<div class="element-item-icon"><i class="fa fa-qrcode"></i></div>
							<div class="element-item-label">${__("QR Code")}</div>
						</div>
						
						<div class="element-item" draggable="true" data-type="table">
							<div class="element-item-icon"><i class="fa fa-table"></i></div>
							<div class="element-item-label">${__("Table")}</div>
						</div>
					</div>
					
					<div class="element-group doctype-fields">
						<div class="element-group-title">${__("Document Fields")}</div>
						<!-- Fields will be loaded dynamically -->
						<div class="text-muted small text-center">
							${__("Loading fields...")}
						</div>
					</div>
					
					<div class="element-group">
						<div class="element-group-title">${__("Actions")}</div>
						<div class="btn-group mb-3 w-100">
							<button class="btn btn-default btn-sm help-btn">
								<i class="fa fa-question-circle"></i> ${__("Help")}
							</button>
							<button class="btn btn-default btn-sm share-btn">
								<i class="fa fa-share-alt"></i> ${__("Share")}
							</button>
						</div>
						<button class="btn btn-primary btn-sm w-100 preview-btn">
							<i class="fa fa-eye"></i> ${__("Preview Design")}
						</button>
						<button class="btn btn-success btn-sm w-100 mt-2 save-btn">
							<i class="fa fa-save"></i> ${__("Save Design")}
						</button>
					</div>
					
					<div class="element-group">
						<div class="element-group-title">${__("Quick Help")}</div>
						<div class="quick-help-section">
							<h6 class="sidebar-label">${__("Quick Help")}</h6>
							<ul class="quick-help-list">
								<li><i class="fa fa-mouse-pointer"></i> ${__("Click element to edit properties")}</li>
								<li><i class="fa fa-arrows"></i> ${__("Drag near edges to move elements")}</li>
								<li><i class="fa fa-times"></i> ${__("Drag element outside to delete")}</li>
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
							<i class="fa fa-th"></i> ${__("Toggle Grid")}
						</button>
						
						<button class="btn btn-default btn-sm navigator-btn">
							<i class="fa fa-sitemap"></i> ${__("Layers")}
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
      this.init_canvas();
      this.load_doctype_fields();
      this.wrapper.find(".properties-panel-close").on("click", () => {
        this.wrapper.find(".properties-panel").removeClass("show");
      });
      this.wrapper.find(".properties-panel-delete").on("click", () => {
        const selectedElement = document.querySelector(".canvas-element.selected");
        if (selectedElement) {
          const isContainer = selectedElement.querySelector(".container-element");
          const hasNestedElements = isContainer && selectedElement.querySelectorAll(".canvas-element").length > 1;
          if (hasNestedElements) {
            frappe.confirm(
              __("This container has nested elements. Delete anyway?"),
              () => {
                selectedElement.remove();
                this.wrapper.find(".properties-panel").removeClass("show");
                frappe.show_alert({
                  message: __("Container and nested elements deleted"),
                  indicator: "red"
                }, 3);
              },
              () => {
              }
            );
          } else {
            selectedElement.remove();
            this.wrapper.find(".properties-panel").removeClass("show");
            frappe.show_alert({
              message: __("Element deleted"),
              indicator: "red"
            }, 3);
          }
        }
      });
      this.wrapper.find(".help-btn").on("click", () => {
        const d = new frappe.ui.Dialog({
          title: __("How to Use the Editor"),
          fields: [
            {
              fieldtype: "HTML",
              fieldname: "help_html",
              options: `
							<div style="padding: 10px 0;">
								<h5>${__("New Interaction Model")}</h5>
								<div class="help-item" style="margin-bottom: 15px;">
									<strong>${__("Edit Elements:")}</strong> ${__("Click directly on any element to open its properties panel on the right side")}
								</div>
								<div class="help-item" style="margin-bottom: 15px;">
									<strong>${__("Container Layout:")}</strong> ${__("Select a container and change its direction instantly from the properties panel")}
								</div>
								<div class="help-item" style="margin-bottom: 15px;">
									<strong>${__("Move Elements:")}</strong> ${__("Hover near the edge of an element until you see the cursor change, then drag it")}
								</div>
								<div class="help-item" style="margin-bottom: 15px;">
									<strong>${__("Delete Elements:")}</strong> ${__("Drag an element to an empty area outside any container to delete it, or use the trash icon in the properties panel")}
								</div>
								<div class="help-item" style="margin-bottom: 15px;">
									<strong>${__("Edit Text:")}</strong> ${__("Click directly on text to edit its content")}
								</div>
							</div>
						`
            }
          ],
          primary_action_label: __("Got It"),
          primary_action: () => {
            d.hide();
          }
        });
        d.show();
      });
      setTimeout(() => {
        frappe.show_alert({
          message: __("Hover near element edges to move, click to edit, drag out to delete"),
          indicator: "blue"
        }, 8);
      }, 1e3);
      this.wrapper.find(".share-btn").on("click", () => {
        const designUrl = window.location.origin + frappe.urllib.get_base_url() + "invoicer/" + encodeURIComponent(this.current_design || this.design_name);
        const d = new frappe.ui.Dialog({
          title: __("Share Design URL"),
          fields: [
            {
              fieldtype: "Code",
              fieldname: "design_url",
              label: __("Direct URL to this design"),
              default: designUrl,
              read_only: 1
            }
          ],
          primary_action_label: __("Copy to Clipboard"),
          primary_action: () => {
            navigator.clipboard.writeText(designUrl).then(() => {
              frappe.show_alert({
                message: __("URL copied to clipboard"),
                indicator: "green"
              }, 3);
              d.hide();
            }).catch((err) => {
              console.error("Could not copy text: ", err);
            });
          }
        });
        d.show();
      });
      this.layers_panel = new frappe.invoicer.LayersPanel(this);
      if (content) {
        this.wrapper.find(".print-canvas").html(content);
        this.reattach_element_events();
      } else {
        const container = this.create_default_container();
        this.wrapper.find(".print-canvas").append(container);
        this.attach_element_events(container);
      }
    }
    save_design() {
      const canvas = document.getElementById("print-canvas");
      if (!canvas)
        return;
      const tempCanvas = canvas.cloneNode(true);
      tempCanvas.querySelectorAll(".element-controls").forEach((control) => {
        control.remove();
      });
      tempCanvas.querySelectorAll(".canvas-element").forEach((element) => {
        element.classList.remove("selected", "dragging-enabled");
        element.style.cursor = "";
        element.style.boxShadow = "";
        element.removeAttribute("draggable");
        const dragIndicators = element.querySelectorAll("::after");
        if (dragIndicators) {
          dragIndicators.forEach((indicator) => indicator.remove());
        }
      });
      const properties = __spreadValues({
        doctype: this.doctype
      }, this.properties);
      frappe.call({
        method: "invoicer.invoicer.page.invoicer.invoicer.save_invoice_design",
        args: {
          design_name: this.design_name,
          content: tempCanvas.innerHTML,
          properties,
          is_default: this.is_default ? 1 : 0
        },
        freeze: true,
        freeze_message: __("Saving design..."),
        callback: (r) => {
          if (r.message && r.message.success) {
            frappe.show_alert({
              message: __("Design saved successfully"),
              indicator: "green"
            }, 3);
            if (!this.current_design) {
              this.current_design = r.message.name;
              frappe.set_route("invoicer", r.message.name, false);
            }
          } else {
            frappe.show_alert({
              message: __("Failed to save design"),
              indicator: "red"
            }, 3);
          }
        }
      });
    }
    bind_events() {
      const me = this;
      const elements = this.wrapper.find(".element-item").get();
      const canvas = this.wrapper.find("#print-canvas").get(0);
      if (!canvas || !elements.length)
        return;
      elements.forEach((element) => {
        element.addEventListener("dragstart", function(e) {
          this.classList.add("dragging");
          e.dataTransfer.setData("text/plain", "new:" + this.dataset.type);
        });
        element.addEventListener("dragend", function() {
          this.classList.remove("dragging");
        });
      });
      canvas.addEventListener("dragover", (e) => {
        e.preventDefault();
        const container = e.target.closest(".container-element");
        if (container) {
          container.classList.add("drag-over");
        }
      });
      canvas.addEventListener("dragleave", (e) => {
        const container = e.target.closest(".container-element");
        if (container) {
          container.classList.remove("drag-over");
        }
      });
      canvas.querySelectorAll(".container-element").forEach((container) => {
        this.attach_container_events(container);
      });
      this.wrapper.find(".properties-panel-close").on("click", () => {
        this.wrapper.find(".properties-panel").removeClass("show");
      });
      this.wrapper.find(".properties-panel-delete").on("click", () => {
        const selectedElement = document.querySelector(".canvas-element.selected");
        if (selectedElement) {
          const isContainer = selectedElement.querySelector(".container-element");
          const hasNestedElements = isContainer && selectedElement.querySelectorAll(".canvas-element").length > 1;
          if (hasNestedElements) {
            frappe.confirm(
              __("This container has nested elements. Delete anyway?"),
              () => {
                selectedElement.remove();
                this.wrapper.find(".properties-panel").removeClass("show");
                frappe.show_alert({
                  message: __("Container and nested elements deleted"),
                  indicator: "red"
                }, 3);
              },
              () => {
              }
            );
          } else {
            selectedElement.remove();
            this.wrapper.find(".properties-panel").removeClass("show");
            frappe.show_alert({
              message: __("Element deleted"),
              indicator: "red"
            }, 3);
          }
        }
      });
      canvas.addEventListener("drop", (e) => {
        const container = e.target.closest(".container-element");
        if (!container)
          return;
        this.handle_drop(e);
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const selectedElement = document.querySelector(".canvas-element.selected");
          if (selectedElement) {
            if (confirm(__("Delete this element and everything inside it?"))) {
              selectedElement.remove();
              this.wrapper.find(".properties-panel").removeClass("show");
              frappe.show_alert({
                message: __("Element deleted"),
                indicator: "red"
              }, 3);
            }
          }
        }
      });
    }
    apply_container_direction(container) {
      const direction = container.getAttribute("data-direction") || "vertical";
      const justifyContent = container.style.justifyContent || "";
      const alignItems = container.style.alignItems || "";
      const gap = container.style.gap || "10px";
      container.style.display = "flex";
      container.style.flexDirection = direction === "vertical" ? "column" : "row";
      container.style.width = "100%";
      container.style.minHeight = "auto";
      if (justifyContent) {
        container.style.justifyContent = justifyContent;
      } else {
        container.style.justifyContent = "flex-start";
      }
      if (alignItems) {
        container.style.alignItems = alignItems;
      } else {
        container.style.alignItems = "flex-start";
      }
      container.style.gap = gap;
      if (!container.children.length) {
        container.style.minHeight = "60px";
      }
      if (direction === "horizontal") {
        const children = container.querySelectorAll(".canvas-element");
        children.forEach((child) => {
          child.style.flex = child.style.flex || "1";
        });
      } else {
        const children = container.querySelectorAll(".canvas-element");
        children.forEach((child) => {
          child.style.width = "100%";
          if (child.style.flex === "1") {
            child.style.flex = "";
          }
        });
      }
    }
    create_element(type) {
      const element = document.createElement("div");
      element.className = "canvas-element";
      element.draggable = true;
      element.id = "element-" + Date.now();
      element.style.padding = "0";
      element.style.margin = "0";
      element.style.width = "100%";
      let content = "";
      switch (type) {
        case "text":
          content = `<div class="text-element" data-type="text" contenteditable="true" data-content-type="static">${__("Click to edit text")}</div>`;
          break;
        case "heading":
          content = `<div class="heading-element" data-type="heading" contenteditable="true" data-content-type="static">
					<h3 style="margin: 0; padding: 0; font-size: 24px;">${__("Click to edit heading")}</h3>
				</div>`;
          break;
        case "image":
          content = `<div class="image-element" data-type="image" data-content-type="static">
					<img src="/assets/frappe/images/frappe-framework-logo.png" style="width: 200px; height: 200px; object-fit: contain;">
				</div>`;
          break;
        case "qrcode":
          const canvasId = "qrcode-canvas-" + Date.now();
          content = `<div class="qrcode-element" data-type="qrcode" data-value="https://frappeframework.com" data-size="150" data-background="white" data-foreground="black" data-padding="10" data-level="L">
					<div class="qrcode-display" style="width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
						<canvas id="${canvasId}" width="150" height="150"></canvas>
					</div>
				</div>`;
          break;
        case "container":
          content = `<div class="container-element" data-type="container" data-direction="vertical" style="display: flex; flex-direction: column; gap: 10px; min-height: auto; padding: 5px; width: 100%"></div>`;
          break;
        default:
          content = `<div class="unknown-element" data-type="unknown">${__("Unknown Element Type")}</div>`;
          break;
      }
      element.innerHTML = content;
      this.attach_element_events(element);
      if (["text", "heading"].includes(type)) {
        const contentElement = element.querySelector(".text-element, .heading-element");
        if (contentElement) {
          this.attach_content_events(contentElement);
        }
      }
      if (type === "container") {
        const containerElement = element.querySelector(".container-element");
        if (containerElement) {
          this.attach_container_events(containerElement);
          const placeholder = document.createElement("div");
          placeholder.className = "container-placeholder";
          placeholder.innerHTML = `<div class="text-muted text-center">${__("Drag elements here")}</div>`;
          placeholder.style.padding = "20px";
          containerElement.appendChild(placeholder);
        }
      }
      if (type === "table") {
        setTimeout(() => {
          this.configure_table(element);
        }, 100);
      }
      if (type === "qrcode") {
        setTimeout(() => {
          this.generateQRCode(element.querySelector(".qrcode-element"));
        }, 100);
      }
      return element;
    }
    create_field_element(fieldname, fieldtype, options) {
      const element = document.createElement("div");
      element.className = "canvas-element";
      element.draggable = true;
      element.id = "element-" + Date.now();
      element.style.width = "100%";
      element.style.padding = "0";
      element.style.margin = "0";
      let content = "";
      switch (fieldtype) {
        case "Data":
        case "Text":
        case "Small Text":
        case "Link":
        case "Select":
        case "Date":
        case "Datetime":
        case "Time":
        case "Int":
        case "Float":
        case "Currency":
          content = `<div class="text-element" data-type="text" data-content-type="field" data-fieldname="${fieldname}" data-fieldtype="${fieldtype}">{{${fieldname}}}</div>`;
          break;
        case "Attach Image":
          content = `<div class="image-element" data-type="image" data-content-type="field" data-fieldname="${fieldname}" data-fieldtype="${fieldtype}">
					<img src="/assets/frappe/images/fallback.png" style="width: 200px; height: 200px; object-fit: contain;" data-src="{{${fieldname}}}">
				</div>`;
          break;
        case "Table":
          content = `<div class="table-element" data-type="table" data-content-type="field" data-fieldname="${fieldname}" data-fieldtype="${fieldtype}" data-options="${options}" style="width: 100%">
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
				</div>`;
          break;
        default:
          content = `<div class="text-element" data-type="text" data-content-type="field" data-fieldname="${fieldname}" data-fieldtype="${fieldtype}">{{${fieldname}}}</div>`;
          break;
      }
      element.innerHTML = content;
      if (["Data", "Text", "Small Text", "Link", "Select", "Date", "Datetime", "Time", "Int", "Float", "Currency"].includes(fieldtype)) {
        const contentElement = element.querySelector(".text-element");
        if (contentElement) {
          this.attach_content_events(contentElement);
        }
      }
      if (fieldtype === "Table") {
        setTimeout(() => {
          this.configure_table(element);
        }, 100);
      }
      return element;
    }
    attach_element_events(element) {
      this.add_edge_drag(element);
      element.addEventListener("click", (e) => {
        e.stopPropagation();
        if (e.target.contentEditable === "true" && document.activeElement === e.target) {
          return;
        }
        const clickedTableElement = e.target.closest(".table-element");
        if (clickedTableElement) {
          document.querySelectorAll(".canvas-element.selected, .canvas-element.table-selected").forEach((el) => {
            el.classList.remove("selected");
            el.classList.remove("table-selected");
          });
          element.classList.add("selected");
          element.classList.add("table-selected");
          this.wrapper.find(".layers-panel").removeClass("show");
          this.show_properties_panel(element);
          if (this.wrapper.find(".layers-panel").hasClass("show")) {
            this.wrapper.find(".layer-item").removeClass("selected");
            this.wrapper.find(`.layer-item[data-element-id="${element.id}"]`).addClass("selected");
          }
          return;
        }
        document.querySelectorAll(".canvas-element.selected, .canvas-element.table-selected").forEach((el) => {
          el.classList.remove("selected");
          el.classList.remove("table-selected");
        });
        element.classList.add("selected");
        this.wrapper.find(".layers-panel").removeClass("show");
        this.show_properties_panel(element);
        if (this.wrapper.find(".layers-panel").hasClass("show")) {
          this.wrapper.find(".layer-item").removeClass("selected");
          this.wrapper.find(`.layer-item[data-element-id="${element.id}"]`).addClass("selected");
        }
      });
      const content = element.querySelector(".text-element, .heading-element");
      if (content) {
        this.attach_content_events(content);
      }
      const tableElement = element.querySelector(".table-element");
      if (tableElement) {
        tableElement.addEventListener("click", (e) => {
          e.stopPropagation();
          document.querySelectorAll(".canvas-element.selected, .canvas-element.table-selected").forEach((el) => {
            el.classList.remove("selected");
            el.classList.remove("table-selected");
          });
          element.classList.add("selected");
          element.classList.add("table-selected");
          this.show_properties_panel(element);
        });
        const tableParts = tableElement.querySelectorAll("table, th, td, tr, thead, tbody");
        tableParts.forEach((part) => {
          part.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".canvas-element.selected, .canvas-element.table-selected").forEach((el) => {
              el.classList.remove("selected");
              el.classList.remove("table-selected");
            });
            element.classList.add("selected");
            element.classList.add("table-selected");
            this.show_properties_panel(element);
          });
        });
      }
      element.addEventListener("dragend", (e) => {
        if (!e.target.parentElement || !e.target.parentElement.closest(".container-element")) {
          element.remove();
          if (element.classList.contains("selected")) {
            this.wrapper.find(".properties-panel").removeClass("show");
          }
        }
      });
      const dropzones = element.querySelectorAll(".dropzone");
      if (dropzones.length) {
        dropzones.forEach((dropzone) => {
          this.attach_dropzone_events(dropzone);
          if (Array.from(dropzone.children).some((child) => child.classList.contains("canvas-element"))) {
            dropzone.classList.add("has-elements");
          }
        });
      }
    }
    attach_content_events(content) {
      content.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
      content.addEventListener("click", (e) => {
        e.stopPropagation();
        const parentElement = content.closest(".canvas-element");
        if (parentElement) {
          document.querySelectorAll(".canvas-element.selected").forEach((el) => {
            el.classList.remove("selected");
          });
          parentElement.classList.add("selected");
          this.show_properties_panel(parentElement);
        }
      });
      content.addEventListener("blur", () => {
        if (content.getAttribute("data-content-type") !== "field") {
          content.setAttribute("data-content-type", "static");
        }
      });
      content.addEventListener("dragstart", (e) => {
        if (document.activeElement === content) {
          e.preventDefault();
        }
      });
      if (content.getAttribute("data-content-type") === "field") {
        content.setAttribute("contenteditable", "false");
      } else {
        content.setAttribute("contenteditable", "true");
      }
    }
    add_edge_drag(element) {
      const EDGE_SIZE = 10;
      element.addEventListener("mousedown", (e) => {
        const rect = element.getBoundingClientRect();
        const isLeftEdge = e.clientX - rect.left < EDGE_SIZE;
        const isRightEdge = rect.right - e.clientX < EDGE_SIZE;
        const isTopEdge = e.clientY - rect.top < EDGE_SIZE;
        const isBottomEdge = rect.bottom - e.clientY < EDGE_SIZE;
        if (isLeftEdge || isRightEdge || isTopEdge || isBottomEdge) {
          element.draggable = true;
          element.classList.add("dragging-enabled");
          if (isLeftEdge && isTopEdge || isRightEdge && isBottomEdge) {
            element.style.cursor = "nwse-resize";
          } else if (isRightEdge && isTopEdge || isLeftEdge && isBottomEdge) {
            element.style.cursor = "nesw-resize";
          } else if (isLeftEdge || isRightEdge) {
            element.style.cursor = "ew-resize";
          } else if (isTopEdge || isBottomEdge) {
            element.style.cursor = "ns-resize";
          }
        } else {
          element.draggable = false;
          element.style.cursor = "default";
        }
      });
      element.addEventListener("mouseup", () => {
        element.draggable = false;
        element.classList.remove("dragging-enabled");
        element.style.cursor = "default";
      });
      element.addEventListener("mouseleave", () => {
        if (!element.classList.contains("dragging-enabled")) {
          element.style.cursor = "default";
        }
      });
      element.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        e.dataTransfer.setData("text/plain", element.id);
      });
    }
    reattach_element_events() {
      const canvas = document.getElementById("print-canvas");
      canvas.querySelectorAll(".canvas-element").forEach((element) => {
        if (!element.id) {
          element.id = "element-" + Date.now();
        }
        this.attach_element_events(element);
        const contentElements = element.querySelectorAll(".text-element, .heading-element");
        contentElements.forEach((content) => {
          this.attach_content_events(content);
        });
      });
      canvas.querySelectorAll(".container-element").forEach((container) => {
        this.attach_container_events(container);
        this.apply_container_direction(container);
        if (!container.querySelector(".canvas-element, .container-placeholder")) {
          const placeholder = document.createElement("div");
          placeholder.className = "container-placeholder";
          placeholder.innerHTML = `<div class="text-muted text-center">${__("Drag elements here")}</div>`;
          placeholder.style.padding = "20px";
          container.appendChild(placeholder);
        }
      });
      canvas.addEventListener("click", (e) => {
        if (e.target === canvas || e.target.id === "print-canvas") {
          document.querySelectorAll(".canvas-element.selected, .canvas-element.table-selected").forEach((el) => {
            el.classList.remove("selected");
            el.classList.remove("table-selected");
          });
          this.wrapper.find(".properties-panel").removeClass("show");
        }
      });
      this.setup_keyboard_shortcuts();
      if (this.wrapper.find(".layers-panel").hasClass("show")) {
        this.generate_layers_tree();
      }
    }
    setup_keyboard_shortcuts() {
      document.removeEventListener("keydown", this.handle_keydown_events);
      this.handle_keydown_events = (e) => {
        if (e.key === "Escape" || e.keyCode === 27) {
          if (document.activeElement.contentEditable === "true") {
            document.activeElement.blur();
            return;
          }
          const selectedElement = document.querySelector(".canvas-element.selected");
          if (selectedElement) {
            const isContainer = selectedElement.querySelector(".container-element");
            const hasNestedElements = isContainer && selectedElement.querySelectorAll(".canvas-element").length > 1;
            if (hasNestedElements) {
              frappe.confirm(
                __("This container has nested elements. Delete anyway?"),
                () => {
                  selectedElement.remove();
                  this.wrapper.find(".properties-panel").removeClass("show");
                  frappe.show_alert({
                    message: __("Container and nested elements deleted"),
                    indicator: "orange"
                  }, 3);
                },
                () => {
                }
              );
            } else {
              selectedElement.remove();
              this.wrapper.find(".properties-panel").removeClass("show");
              frappe.show_alert({
                message: __("Element deleted"),
                indicator: "orange"
              }, 3);
            }
          }
        }
      };
      document.addEventListener("keydown", this.handle_keydown_events);
    }
    show_properties_panel(element) {
      const panel = this.wrapper.find(".properties-panel");
      const content = panel.find(".properties-content");
      let elementType = "";
      let elementTypeTarget = element.querySelector("[data-type]");
      const tableElement = element.querySelector(".table-element");
      if (tableElement && element.classList.contains("table-selected")) {
        elementType = "table";
        elementTypeTarget = tableElement;
      } else if (elementTypeTarget) {
        elementType = elementTypeTarget.getAttribute("data-type");
      }
      let html = "";
      html += `
			<div class="property-group">
				<div class="property-group-title">${__("Layout")}</div>
				<div class="property-field">
					<label>${__("Width")}</label>
					<div class="input-group">
						<input type="text" class="form-control prop-width" value="${element.style.width || "auto"}">
						<div class="input-group-append">
							<button class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown">
								<span>${element.style.width ? element.style.width.includes("%") ? "%" : "px" : "auto"}</span>
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
						<button class="btn btn-default btn-sm prop-align${element.style.textAlign === "left" || !element.style.textAlign ? " active" : ""}" data-value="left">
							<i class="fa fa-align-left"></i>
						</button>
						<button class="btn btn-default btn-sm prop-align${element.style.textAlign === "center" ? " active" : ""}" data-value="center">
							<i class="fa fa-align-center"></i>
						</button>
						<button class="btn btn-default btn-sm prop-align${element.style.textAlign === "right" ? " active" : ""}" data-value="right">
							<i class="fa fa-align-right"></i>
						</button>
						<button class="btn btn-default btn-sm prop-align${element.style.textAlign === "justify" ? " active" : ""}" data-value="justify">
							<i class="fa fa-align-justify"></i>
						</button>
					</div>
				</div>
			</div>
		`;
      if (["text", "heading"].includes(elementType)) {
        const contentElement = element.querySelector(".text-element, .heading-element");
        const isField = contentElement.getAttribute("data-content-type") === "field";
        let headingLevelHtml = "";
        if (elementType === "heading") {
          const headingTag = contentElement.querySelector("h1, h2, h3, h4, h5, h6");
          const currentLevel = headingTag ? headingTag.tagName.toLowerCase().replace("h", "") : "3";
          headingLevelHtml = `
					<div class="property-field">
						<label>${__("Heading Level")}</label>
						<select class="form-control prop-heading-level" ${isField ? "disabled" : ""}>
							<option value="1" ${currentLevel === "1" ? "selected" : ""}>H1</option>
							<option value="2" ${currentLevel === "2" ? "selected" : ""}>H2</option>
							<option value="3" ${currentLevel === "3" ? "selected" : ""}>H3</option>
							<option value="4" ${currentLevel === "4" ? "selected" : ""}>H4</option>
							<option value="5" ${currentLevel === "5" ? "selected" : ""}>H5</option>
							<option value="6" ${currentLevel === "6" ? "selected" : ""}>H6</option>
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
							<input type="number" class="form-control prop-font-size" value="${contentElement.style.fontSize ? parseInt(contentElement.style.fontSize) : elementType === "heading" ? 24 : 14}" ${isField ? "disabled" : ""}>
							<div class="input-group-append">
								<span class="input-group-text">px</span>
							</div>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Font Weight")}</label>
						<select class="form-control prop-font-weight" ${isField ? "disabled" : ""}>
							<option value="normal" ${contentElement.style.fontWeight === "normal" || contentElement.style.fontWeight === "400" || !contentElement.style.fontWeight ? "selected" : ""}>${__("Normal")}</option>
							<option value="bold" ${contentElement.style.fontWeight === "bold" || contentElement.style.fontWeight === "700" ? "selected" : ""}>${__("Bold")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Text Color")}</label>
						<div class="input-group">
							<input type="color" class="form-control prop-text-color" value="${contentElement.style.color || "#000000"}" ${isField ? "disabled" : ""}>
						</div>
					</div>
					<div class="property-field">
						<label>${__("Background")}</label>
						<div class="input-group">
							<input type="color" class="form-control prop-bg-color" value="${contentElement.style.backgroundColor || "#ffffff"}" ${isField ? "disabled" : ""}>
						</div>
					</div>
				</div>
			`;
      }
      if (elementType === "image") {
        const imageElement = element.querySelector(".image-element img");
        const isField = element.querySelector(".image-element").getAttribute("data-content-type") === "field";
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
							<option value="contain" ${imageElement.style.objectFit === "contain" ? "selected" : ""}>${__("Contain")}</option>
							<option value="cover" ${imageElement.style.objectFit === "cover" ? "selected" : ""}>${__("Cover")}</option>
							<option value="fill" ${imageElement.style.objectFit === "fill" ? "selected" : ""}>${__("Fill")}</option>
							<option value="scale-down" ${imageElement.style.objectFit === "scale-down" ? "selected" : ""}>${__("Scale Down")}</option>
							<option value="none" ${imageElement.style.objectFit === "none" ? "selected" : ""}>${__("None")}</option>
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
					` : ""}
				</div>
			`;
      }
      if (elementType === "container") {
        const containerElement = element.querySelector(".container-element");
        const direction = containerElement.getAttribute("data-direction") || "vertical";
        const justifyContent = containerElement.style.justifyContent || "flex-start";
        const alignItems = containerElement.style.alignItems || "flex-start";
        const gap = containerElement.style.gap || "10px";
        html += `
				<div class="property-group">
					<div class="property-group-title">${__("Container")}</div>
					<div class="property-field">
						<label>${__("Direction")}</label>
						<div class="btn-group d-flex">
							<button class="btn btn-default btn-sm prop-direction${direction === "vertical" ? " active" : ""}" data-value="vertical">
								<i class="fa fa-arrow-down"></i> ${__("Vertical")}
							</button>
							<button class="btn btn-default btn-sm prop-direction${direction === "horizontal" ? " active" : ""}" data-value="horizontal">
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
						<label>${__("Main Axis Alignment")} <small>(${direction === "vertical" ? "vertical" : "horizontal"})</small></label>
						<select class="form-control prop-justify-content">
							<option value="flex-start" ${justifyContent === "flex-start" ? "selected" : ""}>${__("Start")}</option>
							<option value="flex-end" ${justifyContent === "flex-end" ? "selected" : ""}>${__("End")}</option>
							<option value="center" ${justifyContent === "center" ? "selected" : ""}>${__("Center")}</option>
							<option value="space-between" ${justifyContent === "space-between" ? "selected" : ""}>${__("Space Between")}</option>
							<option value="space-around" ${justifyContent === "space-around" ? "selected" : ""}>${__("Space Around")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Cross Axis Alignment")} <small>(${direction === "vertical" ? "horizontal" : "vertical"})</small></label>
						<select class="form-control prop-align-items">
							<option value="flex-start" ${alignItems === "flex-start" ? "selected" : ""}>${__("Start")}</option>
							<option value="flex-end" ${alignItems === "flex-end" ? "selected" : ""}>${__("End")}</option>
							<option value="center" ${alignItems === "center" ? "selected" : ""}>${__("Center")}</option>
							<option value="stretch" ${alignItems === "stretch" ? "selected" : ""}>${__("Stretch")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Background Color")}</label>
						<div class="input-group">
							<input type="color" class="form-control prop-container-bg" value="${this.rgb2hex(containerElement.style.backgroundColor || "transparent")}">
						</div>
					</div>
					<div class="property-field">
						<label>${__("Border Style")}</label>
						<select class="form-control prop-border-style">
							<option value="none" ${containerElement.style.borderStyle === "none" ? "selected" : ""}>${__("None")}</option>
							<option value="solid" ${containerElement.style.borderStyle === "solid" ? "selected" : ""}>${__("Solid")}</option>
							<option value="dashed" ${containerElement.style.borderStyle === "dashed" ? "selected" : ""}>${__("Dashed")}</option>
							<option value="dotted" ${containerElement.style.borderStyle === "dotted" ? "selected" : ""}>${__("Dotted")}</option>
						</select>
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
      if (elementType === "qrcode") {
        const qrcodeElement = element.querySelector(".qrcode-element");
        const qrValue = qrcodeElement.getAttribute("data-value") || "";
        const qrSize = qrcodeElement.getAttribute("data-size") || "150";
        const qrBgColor = qrcodeElement.getAttribute("data-background") || "white";
        const qrFgColor = qrcodeElement.getAttribute("data-foreground") || "black";
        const qrPadding = qrcodeElement.getAttribute("data-padding") || "10";
        const qrLevel = qrcodeElement.getAttribute("data-level") || "L";
        html += `
				<div class="property-group">
					<div class="property-group-title">${__("QR Code Properties")}</div>
					<div class="property-field">
						<label>${__("QR Code Data")}</label>
						<select class="form-control prop-qrcode-data-type">
							<option value="static" ${!qrValue.includes("{{") ? "selected" : ""}>${__("Static Value")}</option>
							<option value="field" ${qrValue.includes("{{") ? "selected" : ""}>${__("Document Field")}</option>
						</select>
					</div>
					<div class="property-field prop-static-value-field" ${qrValue.includes("{{") ? 'style="display:none;"' : ""}>
						<label>${__("Value")}</label>
						<input type="text" class="form-control prop-qrcode-value" value="${qrValue.includes("{{") ? "" : qrValue}" placeholder="${__("URL or text for QR code")}">
					</div>
					<div class="property-field prop-field-value-field" ${!qrValue.includes("{{") ? 'style="display:none;"' : ""}>
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
							<option value="L" ${qrLevel === "L" ? "selected" : ""}>${__("Low (7%)")}</option>
							<option value="M" ${qrLevel === "M" ? "selected" : ""}>${__("Medium (15%)")}</option>
							<option value="Q" ${qrLevel === "Q" ? "selected" : ""}>${__("Quartile (25%)")}</option>
							<option value="H" ${qrLevel === "H" ? "selected" : ""}>${__("High (30%)")}</option>
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
      if (elementType === "table") {
        const tableElement2 = element.querySelector(".table-element");
        const fieldname = tableElement2.getAttribute("data-fieldname");
        const childDoctype = tableElement2.getAttribute("data-options");
        const selectedFields = tableElement2.getAttribute("data-selected-fields");
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
							${__("Child DocType:")} <strong>${childDoctype || __("Not set")}</strong>
						</div>
						<div class="text-muted mb-2">
							${__("Field:")} <strong>${fieldname || __("Not set")}</strong>
						</div>
						<div class="text-muted mb-3">
							${__("Selected Fields:")} <strong>${selectedFieldsCount || __("Default 5")}</strong>
						</div>
						<button class="btn btn-primary configure-table-btn w-100" style="font-size: 14px; padding: 10px;">
							<i class="fa fa-table mr-1"></i> ${__("Edit Table Fields")}
						</button>
					</div>
					<div class="property-field mt-3">
						<label>${__("Border Style")}</label>
						<select class="form-control prop-table-border">
							<option value="bordered" ${tableElement2.getAttribute("data-border-style") === "bordered" || !tableElement2.getAttribute("data-border-style") ? "selected" : ""}>${__("Bordered")}</option>
							<option value="no-border" ${tableElement2.getAttribute("data-border-style") === "no-border" ? "selected" : ""}>${__("No Border")}</option>
							<option value="horizontal" ${tableElement2.getAttribute("data-border-style") === "horizontal" ? "selected" : ""}>${__("Horizontal Only")}</option>
						</select>
					</div>
					<div class="property-field">
						<label>${__("Table Style")}</label>
						<select class="form-control prop-table-style">
							<option value="default" ${tableElement2.getAttribute("data-table-style") === "default" || !tableElement2.getAttribute("data-table-style") ? "selected" : ""}>${__("Default")}</option>
							<option value="striped" ${tableElement2.getAttribute("data-table-style") === "striped" ? "selected" : ""}>${__("Striped")}</option>
							<option value="condensed" ${tableElement2.getAttribute("data-table-style") === "condensed" ? "selected" : ""}>${__("Condensed")}</option>
						</select>
					</div>
				</div>
			`;
      }
      content.html(html);
      this.wrapper.find(".layers-panel").removeClass("show");
      panel.addClass("show");
      this.bind_property_events(element);
    }
    bind_property_events(element) {
      const me = this;
      const panel = this.wrapper.find(".properties-panel");
      panel.find(".prop-width").on("input", function() {
        let value = $(this).val();
        const unit = panel.find(".width-unit .dropdown-toggle span").text();
        if (value && unit !== "auto") {
          value = value + unit;
          element.style.width = value;
        } else if (unit === "auto" || value === "") {
          element.style.width = "auto";
        }
      });
      panel.find(".width-unit .dropdown-item").on("click", function() {
        const value = $(this).data("value");
        panel.find(".width-unit .dropdown-toggle span").text(value);
        let width = panel.find(".prop-width").val();
        if (width && value !== "auto") {
          width = width + value;
          element.style.width = width;
        } else if (value === "auto" || width === "") {
          element.style.width = "auto";
        }
      });
      ["top", "right", "bottom", "left"].forEach((position) => {
        panel.find(`.prop-margin-${position}`).on("change", function() {
          const value = $(this).val() + "px";
          element.style[`margin${position.charAt(0).toUpperCase() + position.slice(1)}`] = value;
        });
      });
      ["top", "right", "bottom", "left"].forEach((position) => {
        panel.find(`.prop-padding-${position}`).on("change", function() {
          const value = $(this).val() + "px";
          element.style[`padding${position.charAt(0).toUpperCase() + position.slice(1)}`] = value;
        });
      });
      panel.find(".prop-align").on("click", function() {
        panel.find(".prop-align").removeClass("active");
        $(this).addClass("active");
        element.style.textAlign = $(this).data("value");
      });
      const contentElement = element.querySelector(".text-element, .heading-element");
      if (contentElement) {
        panel.find(".prop-heading-level").on("change", function() {
          const level = $(this).val();
          const headingContent = contentElement.querySelector("h1, h2, h3, h4, h5, h6");
          if (headingContent) {
            const newHeading = document.createElement("h" + level);
            newHeading.innerHTML = headingContent.innerHTML;
            newHeading.style.margin = "0";
            newHeading.style.padding = "0";
            headingContent.replaceWith(newHeading);
          }
        });
        panel.find(".prop-font-size").on("change", function() {
          const fontSize = $(this).val() + "px";
          if (contentElement.classList.contains("heading-element")) {
            const headingTag = contentElement.querySelector("h1, h2, h3, h4, h5, h6");
            if (headingTag) {
              headingTag.style.fontSize = fontSize;
            }
          } else {
            contentElement.style.fontSize = fontSize;
          }
        });
        panel.find(".prop-font-weight").on("change", function() {
          const fontWeight = $(this).val();
          if (contentElement.classList.contains("heading-element")) {
            const headingTag = contentElement.querySelector("h1, h2, h3, h4, h5, h6");
            if (headingTag) {
              headingTag.style.fontWeight = fontWeight;
            }
          } else {
            contentElement.style.fontWeight = fontWeight;
          }
        });
        panel.find(".prop-text-color").on("change", function() {
          const color = $(this).val();
          if (contentElement.classList.contains("heading-element")) {
            const headingTag = contentElement.querySelector("h1, h2, h3, h4, h5, h6");
            if (headingTag) {
              headingTag.style.color = color;
            }
          } else {
            contentElement.style.color = color;
          }
        });
        panel.find(".prop-bg-color").on("change", function() {
          const bgColor = $(this).val();
          if (contentElement.classList.contains("heading-element")) {
            const headingTag = contentElement.querySelector("h1, h2, h3, h4, h5, h6");
            if (headingTag) {
              headingTag.style.backgroundColor = bgColor;
            }
          } else {
            contentElement.style.backgroundColor = bgColor;
          }
        });
      }
      const imageElement = element.querySelector(".image-element img");
      if (imageElement) {
        panel.find(".prop-image-width").on("change", function() {
          imageElement.style.width = $(this).val() + "px";
        });
        panel.find(".prop-image-height").on("change", function() {
          imageElement.style.height = $(this).val() + "px";
        });
        panel.find(".prop-object-fit").on("change", function() {
          imageElement.style.objectFit = $(this).val();
        });
        panel.find(".prop-image-url").on("change", function() {
          imageElement.src = $(this).val();
        });
        panel.find(".prop-browse-image").on("click", function() {
          new frappe.ui.FileUploader({
            folder: "Home/Attachments",
            on_success: (file_doc) => {
              imageElement.src = file_doc.file_url;
              panel.find(".prop-image-url").val(file_doc.file_url);
            }
          });
        });
      }
      const containerElement = element.querySelector(".container-element");
      if (containerElement) {
        panel.find(".prop-direction").on("click", function() {
          panel.find(".prop-direction").removeClass("active");
          $(this).addClass("active");
          const direction = $(this).data("value");
          containerElement.setAttribute("data-direction", direction);
          const mainAxisLabel = direction === "vertical" ? "vertical" : "horizontal";
          const crossAxisLabel = direction === "vertical" ? "horizontal" : "vertical";
          panel.find(".prop-justify-content").closest(".property-field").find("label small").text(`(${mainAxisLabel})`);
          panel.find(".prop-align-items").closest(".property-field").find("label small").text(`(${crossAxisLabel})`);
          me.apply_container_direction(containerElement);
        });
        panel.find(".prop-justify-content").on("change", function() {
          containerElement.style.justifyContent = $(this).val();
        });
        panel.find(".prop-align-items").on("change", function() {
          containerElement.style.alignItems = $(this).val();
        });
        panel.find(".prop-container-gap").on("change", function() {
          const gapValue = $(this).val() + "px";
          containerElement.style.gap = gapValue;
        });
        panel.find(".prop-container-bg").on("change", function() {
          containerElement.style.backgroundColor = $(this).val();
        });
        panel.find(".prop-border-style").on("change", function() {
          containerElement.style.borderStyle = $(this).val();
        });
        panel.find(".prop-container-padding").on("change", function() {
          const paddingValue = $(this).val() + "px";
          containerElement.style.padding = paddingValue;
        });
      }
      const qrcodeElement = element.querySelector(".qrcode-element");
      if (qrcodeElement) {
        panel.find(".prop-qrcode-data-type").on("change", function() {
          const dataType = $(this).val();
          if (dataType === "static") {
            panel.find(".prop-static-value-field").show();
            panel.find(".prop-field-value-field").hide();
          } else {
            panel.find(".prop-static-value-field").hide();
            panel.find(".prop-field-value-field").show();
          }
        });
        panel.find(".prop-qrcode-value").on("change", function() {
          const value = $(this).val();
          qrcodeElement.setAttribute("data-value", value);
        });
        panel.find(".prop-qrcode-field").on("change", function() {
          const fieldName = $(this).val();
          if (fieldName) {
            qrcodeElement.setAttribute("data-value", `{{${fieldName}}}`);
          }
        });
        panel.find(".prop-qrcode-size").on("change", function() {
          const size = $(this).val();
          qrcodeElement.setAttribute("data-size", size);
          const qrcodeDisplay = qrcodeElement.querySelector(".qrcode-display");
          const qrcodeCanvas = qrcodeElement.querySelector("canvas");
          if (qrcodeDisplay) {
            qrcodeDisplay.style.width = size + "px";
            qrcodeDisplay.style.height = size + "px";
          }
        });
        panel.find(".prop-qrcode-foreground").on("change", function() {
          const color = $(this).val();
          qrcodeElement.setAttribute("data-foreground", color);
        });
        panel.find(".prop-qrcode-background").on("change", function() {
          const bgcolor = $(this).val();
          qrcodeElement.setAttribute("data-background", bgcolor);
          const qrcodeDisplay = qrcodeElement.querySelector(".qrcode-display");
          if (qrcodeDisplay) {
            qrcodeDisplay.style.backgroundColor = bgcolor;
          }
        });
        panel.find(".btn-generate-qrcode").on("click", function() {
          me.generateQRCode(qrcodeElement);
        });
      }
      panel.find(".configure-table-btn").on("click", function() {
        me.configure_table(element);
      });
      panel.find(".prop-table-border").on("change", function() {
        const value = $(this).val();
        const tableElement = element.querySelector(".table-element");
        if (!tableElement)
          return;
        tableElement.classList.remove("table-bordered", "table-no-border", "table-horizontal");
        if (value === "bordered") {
          tableElement.classList.add("table-bordered");
        } else if (value === "horizontal") {
          tableElement.classList.add("table-horizontal");
        } else if (value === "no-border") {
          tableElement.classList.add("table-no-border");
        }
        tableElement.setAttribute("data-border-style", value);
      });
      panel.find(".prop-table-style").on("change", function() {
        const value = $(this).val();
        const tableElement = element.querySelector(".table-element");
        if (!tableElement)
          return;
        tableElement.classList.remove("table-striped", "table-condensed");
        if (value === "striped") {
          tableElement.classList.add("table-striped");
        } else if (value === "condensed") {
          tableElement.classList.add("table-condensed");
        }
        tableElement.setAttribute("data-table-style", value);
      });
    }
    rgb2hex(rgb) {
      if (!rgb || rgb === "transparent" || rgb === "var(--bg-light)")
        return "#f8f9fa";
      if (rgb.startsWith("#"))
        return rgb;
      const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      if (!match)
        return "#f8f9fa";
      function hex(x) {
        return ("0" + parseInt(x).toString(16)).slice(-2);
      }
      return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
    }
    normalizeColor(color) {
      const colorMap = {
        "black": "#000000",
        "white": "#ffffff",
        "red": "#ff0000",
        "green": "#00ff00",
        "blue": "#0000ff",
        "yellow": "#ffff00",
        "purple": "#800080",
        "gray": "#808080"
      };
      return colorMap[color.toLowerCase()] || (color.startsWith("#") ? color : "#000000");
    }
    getFieldOptionsForQRCode(currentValue) {
      if (!this.doctype)
        return "";
      let options = "";
      let selectedFieldName = "";
      if (currentValue && currentValue.includes("{{") && currentValue.includes("}}")) {
        selectedFieldName = currentValue.replace("{{", "").replace("}}", "").trim();
      }
      if (this.fields && this.fields.length) {
        this.fields.forEach((field) => {
          const selected = field.fieldname === selectedFieldName ? "selected" : "";
          options += `<option value="${field.fieldname}" ${selected}>${field.label}</option>`;
        });
      }
      return options;
    }
    edit_element(element, type) {
      return;
    }
    configure_table(element) {
      const tableElement = element.querySelector(".table-element");
      if (!tableElement)
        return;
      const fieldname = tableElement.getAttribute("data-fieldname");
      const options = tableElement.getAttribute("data-options");
      if (!options) {
        frappe.msgprint(__("Table configuration not possible. Missing child doctype information."));
        return;
      }
      frappe.call({
        method: "invoicer.invoicer.page.invoicer.invoicer.get_doctype_fields",
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
      const tableElement = element.querySelector(".table-element");
      if (!tableElement)
        return;
      const currentSelectedFields = tableElement.getAttribute("data-selected-fields");
      let selectedFields = [];
      if (currentSelectedFields) {
        try {
          selectedFields = JSON.parse(currentSelectedFields);
        } catch (e) {
          console.error("Error parsing selected fields", e);
          selectedFields = [];
        }
      }
      tableElement.setAttribute("data-all-fields", JSON.stringify(fields));
      const fieldRows = [];
      fields.forEach((field) => {
        fieldRows.push({
          fieldtype: "Check",
          fieldname: `field_${field.fieldname}`,
          label: field.label || field.fieldname,
          default: selectedFields.includes(field.fieldname),
          onchange: function() {
          }
        });
      });
      const dialog = new frappe.ui.Dialog({
        title: __("Configure Table Fields"),
        fields: [
          {
            fieldtype: "HTML",
            fieldname: "fields_description",
            options: `
						<div class="text-muted">
							${__("Select fields to display in the table. The fields will appear in the order they are selected.")}
						</div>
					`
          },
          {
            fieldtype: "Section Break",
            label: __("Available Fields")
          },
          ...fieldRows,
          {
            fieldtype: "Section Break"
          },
          {
            fieldtype: "HTML",
            fieldname: "preview_html",
            label: __("Preview"),
            options: `<div class="table-preview"></div>`
          }
        ],
        primary_action_label: __("Apply"),
        primary_action: (values) => {
          const newSelectedFields = [];
          fields.forEach((field) => {
            if (values[`field_${field.fieldname}`]) {
              newSelectedFields.push(field.fieldname);
            }
          });
          tableElement.setAttribute("data-selected-fields", JSON.stringify(newSelectedFields));
          this.update_table_preview(tableElement, fields, newSelectedFields);
          dialog.hide();
        }
      });
      dialog.show();
      dialog.$wrapper.find(".form-section").on("change", "input[type=checkbox]", () => {
        const values = dialog.get_values();
        const previewFields = [];
        fields.forEach((field) => {
          if (values[`field_${field.fieldname}`]) {
            previewFields.push(field);
          }
        });
        const previewHtml = this.get_table_preview_html(previewFields);
        dialog.$wrapper.find(".table-preview").html(previewHtml);
        const previewTable = dialog.$wrapper.find(".table-preview table")[0];
        if (previewTable) {
          this.initializeColumnResizers(previewTable);
        }
      });
      if (selectedFields.length > 0) {
        const previewFields = fields.filter((f) => selectedFields.includes(f.fieldname));
        const previewHtml = this.get_table_preview_html(previewFields);
        dialog.$wrapper.find(".table-preview").html(previewHtml);
        const previewTable = dialog.$wrapper.find(".table-preview table")[0];
        if (previewTable) {
          this.initializeColumnResizers(previewTable);
        }
      } else {
        const previewFields = fields.slice(0, 5);
        const previewHtml = this.get_table_preview_html(previewFields);
        dialog.$wrapper.find(".table-preview").html(previewHtml);
        const previewTable = dialog.$wrapper.find(".table-preview table")[0];
        if (previewTable) {
          this.initializeColumnResizers(previewTable);
        }
      }
    }
    get_table_preview_html(fields) {
      if (!fields || !fields.length) {
        return `<div class="text-muted">${__("No fields selected")}</div>`;
      }
      let html = `
			<table class="table table-bordered table-preview" style="width: 100%; table-layout: fixed;">
				<thead>
					<tr>
		`;
      fields.forEach((field, index) => {
        const resizer = index < fields.length - 1 ? `<div class="column-resizer" data-column-index="${index}"></div>` : "";
        const widthAttr = field.custom_width ? `style="width:${field.custom_width}"` : "";
        html += `<th ${widthAttr} data-fieldname="${field.fieldname}">${field.label || field.fieldname}${resizer}</th>`;
      });
      html += `
					</tr>
				</thead>
				<tbody>
					<tr>
		`;
      fields.forEach((field) => {
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
      const selectedFields = allFields.filter((f) => selectedFieldnames.includes(f.fieldname));
      const table = tableElement.querySelector("table");
      if (!table)
        return;
      table.style.width = "100%";
      table.style.tableLayout = "fixed";
      let theadHTML = "<tr>";
      selectedFields.forEach((field, index) => {
        const widthAttr = field.custom_width ? `style="width:${field.custom_width}"` : "";
        const resizer = index < selectedFields.length - 1 ? `<div class="column-resizer" data-column-index="${index}"></div>` : "";
        theadHTML += `<th ${widthAttr} data-fieldname="${field.fieldname}">${field.label || field.fieldname}${resizer}</th>`;
      });
      theadHTML += "</tr>";
      let tbodyHTML = "<tr>";
      selectedFields.forEach(() => {
        tbodyHTML += `<td>${__("Data")}</td>`;
      });
      tbodyHTML += "</tr>";
      table.querySelector("thead").innerHTML = theadHTML;
      table.querySelector("tbody").innerHTML = tbodyHTML;
      this.initializeColumnResizers(table);
    }
    initializeColumnResizers(table) {
      const me = this;
      const resizers = table.querySelectorAll(".column-resizer");
      resizers.forEach((resizer) => {
        resizer.addEventListener("mousedown", function(e) {
          e.preventDefault();
          e.stopPropagation();
          resizer.classList.add("resizing");
          const columnIndex = parseInt(resizer.getAttribute("data-column-index"));
          const th = resizer.parentElement;
          const initialWidth = th.getBoundingClientRect().width;
          const initialX = e.clientX;
          function handleMouseMove(e2) {
            const deltaX = e2.clientX - initialX;
            const newWidth = initialWidth + deltaX;
            if (newWidth > 30) {
              th.style.width = newWidth + "px";
              const fieldname = th.getAttribute("data-fieldname");
              if (fieldname) {
                const tableElement = table.closest(".table-element");
                if (tableElement) {
                  const selectedFields = JSON.parse(tableElement.getAttribute("data-selected-fields") || "[]");
                  const allFieldsStr = tableElement.getAttribute("data-all-fields");
                  if (allFieldsStr) {
                    try {
                      const allFields = JSON.parse(allFieldsStr);
                      const field = allFields.find((f) => f.fieldname === fieldname);
                      if (field) {
                        field.custom_width = newWidth + "px";
                        tableElement.setAttribute("data-all-fields", JSON.stringify(allFields));
                      }
                    } catch (e3) {
                      console.error("Error updating field width", e3);
                    }
                  }
                }
              }
            }
          }
          function handleMouseUp() {
            resizer.classList.remove("resizing");
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          }
          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        });
      });
    }
    preview_design(designName) {
      frappe.call({
        method: "invoicer.invoicer.page.invoicer.invoicer.get_invoice_design",
        args: { design_name: designName },
        callback: (r) => {
          if (r.message && r.message.success) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = r.message.content;
            tempDiv.querySelectorAll(".element-controls").forEach((control) => {
              control.remove();
            });
            tempDiv.querySelectorAll(".dropzone").forEach((dropzone) => {
              dropzone.style.display = "none";
            });
            tempDiv.querySelectorAll(".canvas-element").forEach((element) => {
              element.classList.remove("selected", "dragging-enabled");
              element.style.cursor = "";
              element.style.boxShadow = "";
            });
            tempDiv.querySelectorAll(".qrcode-element").forEach((qrElement) => {
              this.generateQRCode(qrElement, true);
            });
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
    generateQRCode(qrcodeElement, isPreview = false) {
      if (typeof QRious === "undefined") {
        frappe.throw(__("QRious library not loaded. Please refresh the page."));
        return;
      }
      const value = qrcodeElement.getAttribute("data-value") || "https://frappeframework.com";
      const size = parseInt(qrcodeElement.getAttribute("data-size")) || 150;
      const background = qrcodeElement.getAttribute("data-background") || "white";
      const foreground = qrcodeElement.getAttribute("data-foreground") || "black";
      const padding = parseInt(qrcodeElement.getAttribute("data-padding")) || 10;
      const level = qrcodeElement.getAttribute("data-level") || "L";
      let qrValue = value;
      if (value.includes("{{") && value.includes("}}")) {
        if (isPreview) {
          const fieldName = value.replace("{{", "").replace("}}", "").trim();
          qrValue = `Sample data for ${fieldName}`;
        } else {
          qrValue = "https://frappeframework.com";
        }
      }
      let canvas = qrcodeElement.querySelector("canvas");
      if (!canvas) {
        const canvasId = "qrcode-canvas-" + Date.now();
        canvas = document.createElement("canvas");
        canvas.id = canvasId;
        canvas.width = size;
        canvas.height = size;
        let qrcodeDisplay = qrcodeElement.querySelector(".qrcode-display");
        if (!qrcodeDisplay) {
          qrcodeDisplay = document.createElement("div");
          qrcodeDisplay.className = "qrcode-display";
          qrcodeDisplay.style.width = size + "px";
          qrcodeDisplay.style.height = size + "px";
          qrcodeDisplay.style.display = "flex";
          qrcodeDisplay.style.alignItems = "center";
          qrcodeDisplay.style.justifyContent = "center";
          qrcodeDisplay.style.margin = "0 auto";
          qrcodeElement.innerHTML = "";
          qrcodeDisplay.appendChild(canvas);
          qrcodeElement.appendChild(qrcodeDisplay);
        } else {
          qrcodeDisplay.innerHTML = "";
          qrcodeDisplay.appendChild(canvas);
        }
      }
      try {
        new QRious({
          element: canvas,
          value: qrValue,
          size,
          background,
          foreground,
          padding,
          level
        });
      } catch (e) {
        console.error("Error generating QR code:", e);
        const qrcodeDisplay = qrcodeElement.querySelector(".qrcode-display");
        if (qrcodeDisplay) {
          qrcodeDisplay.innerHTML = `<div class="text-danger p-2">${__("Error generating QR code")}</div>`;
        }
      }
    }
    setup_toolbar_events() {
      const me = this;
      this.wrapper.find(".zoom-in-btn").on("click", () => {
        const canvas = this.wrapper.find(".print-canvas");
        const currentZoom = parseFloat(canvas.css("zoom") || 1);
        const newZoom = Math.min(currentZoom + 0.1, 2);
        canvas.css("zoom", newZoom);
        this.wrapper.find(".zoom-reset-btn").text(Math.round(newZoom * 100) + "%");
      });
      this.wrapper.find(".zoom-out-btn").on("click", () => {
        const canvas = this.wrapper.find(".print-canvas");
        const currentZoom = parseFloat(canvas.css("zoom") || 1);
        const newZoom = Math.max(currentZoom - 0.1, 0.5);
        canvas.css("zoom", newZoom);
        this.wrapper.find(".zoom-reset-btn").text(Math.round(newZoom * 100) + "%");
      });
      this.wrapper.find(".zoom-reset-btn").on("click", () => {
        const canvas = this.wrapper.find(".print-canvas");
        canvas.css("zoom", 1);
        this.wrapper.find(".zoom-reset-btn").text("100%");
      });
      this.wrapper.find(".toggle-grid-btn").on("click", () => {
        const canvas = this.wrapper.find(".print-canvas");
        canvas.toggleClass("show-grid");
        if (canvas.hasClass("show-grid")) {
          canvas.css("background-image", "linear-gradient(rgba(150, 150, 150, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(150, 150, 150, 0.1) 1px, transparent 1px)");
          canvas.css("background-size", "20px 20px");
        } else {
          canvas.css("background-image", "none");
        }
      });
      this.wrapper.find(".preview-btn").on("click", () => {
        this.preview_current_design();
      });
      this.wrapper.find(".save-btn").on("click", () => {
        this.save_design();
      });
    }
    generate_layers_tree() {
      if (this.layers_panel) {
        this.layers_panel.generate_layers_tree();
      }
    }
    generate_element_tree(element, level) {
      return "";
    }
    generate_layer_item(element, level) {
      return "";
    }
    bind_layer_events() {
    }
  };
})();
//# sourceMappingURL=invoicer_page.bundle.SSDGOZST.js.map
