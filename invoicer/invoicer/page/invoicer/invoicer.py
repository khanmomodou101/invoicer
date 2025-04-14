import frappe
import json
from frappe import _
import re


@frappe.whitelist()
def save_invoice_design(design_name, content, properties, is_default=0):
    """
    Save the print design

    Args:
        design_name (str): Name of the print design
        content (str): HTML content of the design
        properties (dict): Properties of the design including reference doctype

    Returns:
        dict: Status of the save operation
    """
    try:
        # Remove the "Add Container" button from the HTML content
        html_content = content

        # Pattern to remove for "Add Container" button
        add_container_pattern = """<div class="add-container-button" style="text-align: center; margin: 20px 0px;"><button class="btn btn-default btn-sm">
			    <i class="fa fa-plus"></i> Add Container
		        </button></div>"""

        # Remove the pattern from the content
        html_content = html_content.replace(add_container_pattern, "")

        # Also try to remove any variations with different whitespace or formatting
        html_content = re.sub(
            r'<div\s+class=["\']add-container-button["\'][^>]*>.*?Add\s+Container.*?</div>',
            "",
            html_content,
            flags=re.DOTALL | re.IGNORECASE,
        )

        # Process table templates that were stored as data attributes to avoid HTML parsing issues
        # We use a simple regex to find and replace the placeholders with the actual Jinja code
        table_pattern = r'<table[^>]*(data-jinja-code|data-jinja-template)="([^"]*)"[^>]*>.*?</table>'

        def replace_table_placeholder(match):
            # Get the template from the data attribute
            jinja_code = match.group(2)

            # Unescape HTML entities in the Jinja code
            jinja_code = (
                jinja_code.replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", '"')
                .replace("&#39;", "'")
            )

            # Fix incorrect "doc.row." prefix in table templates (should be just "row.")
            # More comprehensive regex to catch variations
            jinja_code = re.sub(
                r"\{\{\s*doc\.row\.([^}]+)\s*\}\}", r"{{ row.\1 }}", jinja_code
            )

            # Extra pass to make sure we catch any remaining doc.row. references
            if "doc.row." in jinja_code:
                frappe.logger().warning(
                    "Found additional doc.row. patterns after regex replacement"
                )
                # Simple string replacement as backup
                jinja_code = jinja_code.replace("doc.row.", "row.")

            # Double-check the pattern again with another regex pass just to be sure
            jinja_code = re.sub(r"doc\.row\.([a-zA-Z0-9_]+)", r"row.\1", jinja_code)

            # Extract the parts of the table before and after the placeholder
            table_html = match.group(0)
            tbody_start_idx = table_html.find("<tbody")
            tbody_end_idx = table_html.find("</tbody")

            # Get the parts before and after tbody
            before_tbody = table_html[: tbody_start_idx + len("<tbody>")]
            after_tbody = table_html[tbody_end_idx:]

            # Return the table with the Jinja code inserted in the tbody
            return before_tbody + jinja_code + after_tbody

        # Apply the table template replacement
        html_content = re.sub(
            table_pattern,
            replace_table_placeholder,
            html_content,
            flags=re.DOTALL,
        )

        # Additional aggressive fix - scan the entire HTML for doc.row patterns outside of templates
        if "doc.row." in html_content:
            frappe.logger().warning(
                "Found doc.row. references in HTML content outside of templates - fixing them"
            )
            # Replace in any HTML attribute values using a non-greedy pattern to avoid overly broad matches
            html_content = re.sub(
                r'(data-[^=]+=)"([^"]*doc\.row\.[^"]*)"',
                lambda m: f'{m.group(1)}"{m.group(2).replace("doc.row.", "row.")}"',
                html_content,
            )

            # Replace in any tbody content
            html_content = re.sub(
                r"(<tbody[^>]*>)(.*?)(</tbody>)",
                lambda m: f'{m.group(1)}{m.group(2).replace("doc.row.", "row.")}{m.group(3)}',
                html_content,
                flags=re.DOTALL,
            )

            # Final fallback - direct string replacement in case the more targeted replacements missed anything
            before_count = html_content.count("doc.row.")
            html_content = html_content.replace("doc.row.", "row.")
            after_count = html_content.count("doc.row.")
            frappe.logger().warning(
                f"Fixed {before_count - after_count} doc.row. references with direct replacement"
            )

        if isinstance(properties, str):
            properties = json.loads(properties)

        # Process field names in curly brackets, but not for frappe.db.get_value tags
        doctype = properties.get("doctype")
        if doctype:
            # Get doctype metadata fields
            meta = frappe.get_meta(doctype)
            field_names = [field.fieldname for field in meta.fields]

            # First, preserve frappe.db.get_value tags by temporarily replacing them
            get_value_pattern = r"{{frappe\.db\.get_value\(.*?\)}}"
            get_value_replacements = []

            def preserve_get_value(match):
                get_value_replacements.append(match.group(0))
                return f"__PRESERVED_GET_VALUE_{len(get_value_replacements) - 1}__"

            html_content = re.sub(get_value_pattern, preserve_get_value, html_content)

            # First process fields from related doctypes which contain a dot (e.g., customer.customer_name)
            related_field_pattern = r"{{([^{}]+\.[^{}]+)}}"

            def replace_related_field(match):
                field_path = match.group(1).strip()
                parts = field_path.split(".")
                if len(parts) == 2:
                    link_field = parts[0]
                    field_name = parts[1]

                    # Get the DocType of the link field
                    link_field_meta = None
                    for field in meta.fields:
                        if field.fieldname == link_field and field.fieldtype == "Link":
                            link_field_meta = field
                            break

                    if link_field_meta and link_field_meta.options:
                        # Format: {{frappe.db.get_value("RelatedDocType", doc.fieldname, "field")}}
                        return f'{{{{frappe.db.get_value("{link_field_meta.options}", doc.{link_field}, "{field_name}")}}}}'

                # DO NOT add doc. prefix - keep the field as is
                return match.group(0)

            html_content = re.sub(
                related_field_pattern, replace_related_field, html_content
            )

            # Then handle simple field placeholders (without dots)
            pattern = r"{{([^{}.\n]+)}}"

            def replace_field(match):
                field_name = match.group(1).strip()
                # DO NOT add doc. prefix - keep the field as is
                return match.group(0)  # Return unchanged

            html_content = re.sub(pattern, replace_field, html_content)

            # ONLY keep the fix for doc.row. references
            if "doc.row." in html_content:
                frappe.logger().warning("Fixing doc.row. references in content")
                html_content = html_content.replace("doc.row.", "row.")

            # Now restore the preserved get_value tags
            for i, replacement in enumerate(get_value_replacements):
                html_content = html_content.replace(
                    f"__PRESERVED_GET_VALUE_{i}__", replacement
                )

        # Check if a design with this name already exists
        existing_design = frappe.db.exists("Print Format", design_name)

        if existing_design:
            # Update existing design
            design_doc = frappe.get_doc("Print Format", existing_design)
            design_doc.html = html_content
            design_doc.save()
            frappe.db.commit()
            saved_name = existing_design
        else:
            # Create new design
            design_doc = frappe.new_doc("Print Format")
            design_doc.__newname = design_name
            design_doc.doc_type = properties.get("doctype")
            design_doc.html = html_content
            design_doc.custom_format = 1
            design_doc.invoicer = 1

            # Set as default if required

            design_doc.insert()
            frappe.db.commit()
            saved_name = design_doc.name

        return {
            "success": True,
            "message": _("Print design saved successfully"),
            "name": saved_name,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to save print design"))
        return {
            "success": False,
            "message": _("Failed to save print design: {0}").format(str(e)),
        }


@frappe.whitelist()
def get_invoice_design(design_name=None):
    """
    Get a print format

    Args:
        design_name (str, optional): Name of the print format.

    Returns:
        dict: The print format content and properties
    """
    try:
        if not design_name:
            # Get the first design if no name specified
            all_designs = frappe.get_all("Print Format", {"invoicer": 1})
            if all_designs:
                design_name = all_designs[0].name
            else:
                return {"success": False, "message": _("No print designs found")}

        # Check if the design exists
        if not frappe.db.exists("Print Format", design_name):
            return {
                "success": False,
                "message": _("Print design '{0}' not found").format(design_name),
            }

        # Get the design
        design_doc = frappe.get_doc("Print Format", design_name)

        # Check if it's an invoicer design
        if not design_doc.get("invoicer"):
            return {
                "success": False,
                "message": _("'{0}' is not an invoicer print design").format(
                    design_name
                ),
            }

        # Parse stored properties or create default
        try:
            properties = json.loads(design_doc.properties or "{}")
        except:
            properties = {}

        # Ensure doctype is always present
        if not properties.get("doctype"):
            properties["doctype"] = design_doc.doc_type

        return {
            "success": True,
            "design_name": design_doc.name,
            "content": design_doc.html,
            "properties": properties,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to get print design"))
        return {
            "success": False,
            "message": _("Failed to get print design: {0}").format(str(e)),
        }


@frappe.whitelist()
def get_invoice_designs():
    """Get all print designs"""
    try:
        designs = frappe.get_all(
            "Print Format",
            {"invoicer": 1},
            [
                "name",
                "doc_type",
                "creation",
                "modified",
            ],
            order_by="creation desc",
        )

        # Add a formatted name for display purposes
        for design in designs:
            # Use the name as the display name
            design["design_name"] = design["name"]
            design["reference_doctype"] = design["doc_type"]

        return designs
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to get print designs"))
        return []


@frappe.whitelist()
def delete_invoice_design(design_name):
    """Delete a print design"""
    try:
        frappe.delete_doc("Print Format", design_name)
        frappe.db.commit()
        return {"success": True, "message": _("Print format deleted successfully")}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to delete print format"))
        return {
            "success": False,
            "message": _("Failed to delete print format: {0}").format(str(e)),
        }


@frappe.whitelist()
def get_linked_doctypes(doctype):
    """Get all doctypes linked to the specified doctype"""
    try:
        # Load DocType metadata
        meta = frappe.get_meta(doctype)
        linked_doctypes = [
            {"label": doctype, "value": doctype}
        ]  # Include the base doctype itself

        # Process only Link fields, exclude Table fields
        for field in meta.fields:
            if field.fieldtype == "Link" and field.options:
                # Add the linked doctype
                linked_doctypes.append(
                    {
                        "label": f"{field.label} ({field.options})",
                        "value": field.options,
                        "fieldname": field.fieldname,
                    }
                )
            # Removed the Table field type handling

        return {"success": True, "linked_doctypes": linked_doctypes}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to get linked doctypes"))
        return {
            "success": False,
            "message": _("Failed to get linked doctypes: {0}").format(str(e)),
        }


@frappe.whitelist()
def get_doctype_fields(doctype, parent_doctype=None, link_fieldname=None):
    """Get fields for a specific DocType"""
    try:
        frappe.logger().info(f"Getting fields for doctype: {doctype}")
        # Load DocType metadata
        meta = frappe.get_meta(doctype)
        fields = []
        prefix = ""

        # Add prefix for linked fields to distinguish them
        if parent_doctype and parent_doctype != doctype and link_fieldname:
            prefix = f"{link_fieldname}."

        # Process fields
        field_count = 0
        for field in meta.fields:
            # Skip only layout and structure field types
            if field.fieldtype in [
                "Section Break",
                "Column Break",
                "Tab Break",
                "Fold",
                "Page Break",
                "Attach",
                "Attach Image",
            ]:
                continue

            field_count += 1
            # Add field to the list
            fields.append(
                {
                    "label": field.label or field.fieldname,
                    "fieldname": (
                        f"{prefix}{field.fieldname}" if prefix else field.fieldname
                    ),
                    "fieldtype": field.fieldtype,
                    "options": field.options,
                    "doctype": doctype,
                    "original_fieldname": field.fieldname,
                }
            )

        frappe.logger().info(f"Found {field_count} fields for doctype {doctype}")
        return {"success": True, "fields": fields}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to get DocType fields"))
        return {
            "success": False,
            "message": _("Failed to get DocType fields: {0}").format(str(e)),
        }


@frappe.whitelist()
def set_default_print_design(design_name):
    """Set a print design as default for its doctype"""
    try:
        # Get the design
        design_doc = frappe.get_doc("Print Format", design_name)
        doc_type = design_doc.doc_type

        # Clear existing defaults for this doctype
        frappe.db.sql(
            """
            UPDATE `tabPrint Format` 
            SET is_default = 0 
            WHERE doc_type = %s AND name != %s
            """,
            (doc_type, design_name),
        )

        # Set this design as default
        design_doc.is_default = 1
        design_doc.save()
        frappe.db.commit()

        return {"success": True, "message": _("Print design set as default")}
    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(), _("Failed to set default print design")
        )
        return {
            "success": False,
            "message": _("Failed to set default print design: {0}").format(str(e)),
        }


@frappe.whitelist()
def duplicate_print_design(design_name, new_name):
    """Duplicate a print design"""
    try:
        # Get the original design
        original = frappe.get_doc("Print Format", design_name)

        # Create new design
        new_design = frappe.new_doc("Print Format")
        new_design.__newname = new_name
        new_design.doc_type = original.doc_type
        new_design.html = original.html
        new_design.custom_format = 1
        new_design.invoicer = 1
        new_design.insert()
        frappe.db.commit()

        return {
            "success": True,
            "message": _("Print design duplicated successfully"),
            "name": new_design.name,
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to duplicate print design"))
        return {
            "success": False,
            "message": _("Failed to duplicate print design: {0}").format(str(e)),
        }


@frappe.whitelist()
def get_doctype_data(doctype, docname=None):
    """Get data for a specific document of the given doctype"""
    try:
        if not docname:
            # If no document name is provided, get the last created document of this doctype
            latest_docs = frappe.get_list(
                doctype, fields=["name"], order_by="creation desc", limit=1
            )
            if latest_docs:
                docname = latest_docs[0].name
            else:
                return {
                    "success": False,
                    "message": _("No documents found for {0}").format(doctype),
                }

        # Get the document
        doc = frappe.get_doc(doctype, docname)
        return {"success": True, "doc": doc.as_dict()}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to get document data"))
        return {
            "success": False,
            "message": _("Failed to get document data: {0}").format(str(e)),
        }


@frappe.whitelist()
def get_related_doctype_data(
    main_doctype, main_docname, related_doctype, link_fieldname=None
):
    """Get data for a document of a related doctype linked to the main document"""
    try:
        if not main_docname or not related_doctype or not main_doctype:
            return {
                "success": False,
                "message": _(
                    "Missing required parameters for fetching related document data"
                ),
            }

        # If we have a link fieldname, it means the main document has a link to the related doctype
        if link_fieldname:
            # Get the link value from the main document
            main_doc = frappe.get_doc(main_doctype, main_docname)
            link_value = main_doc.get(link_fieldname)

            if link_value:
                # Get the related document by this link value
                frappe.logger().debug(
                    f"Found link value: {link_value} for field {link_fieldname}"
                )
                related_doc = frappe.get_doc(related_doctype, link_value)
                return {"success": True, "doc": related_doc.as_dict()}
            else:
                # Add more debugging info
                frappe.logger().debug(
                    f"No link value found for {link_fieldname} in {main_doctype} {main_docname}"
                )
                return {
                    "success": False,
                    "message": _(
                        "No link found between {0} and {1} via field {2}"
                    ).format(main_doctype, related_doctype, link_fieldname),
                }
        else:
            # If no link fieldname, then the related doctype might have a link to the main doctype
            # Find documents of the related doctype that link to the main document
            fieldname = None

            # Find link fields in the related doctype that point to the main doctype
            related_meta = frappe.get_meta(related_doctype)
            for field in related_meta.fields:
                if field.fieldtype == "Link" and field.options == main_doctype:
                    fieldname = field.fieldname
                    break

            if fieldname:
                # Find related document with this link
                frappe.logger().debug(
                    f"Looking for {related_doctype} documents with {fieldname}={main_docname}"
                )
                related_docs = frappe.get_list(
                    related_doctype,
                    filters={fieldname: main_docname},
                    fields=["name"],
                    order_by="creation desc",
                    limit=1,
                )

                if related_docs:
                    frappe.logger().debug(
                        f"Found related document: {related_docs[0].name}"
                    )
                    related_doc = frappe.get_doc(related_doctype, related_docs[0].name)
                    return {"success": True, "doc": related_doc.as_dict()}
                else:
                    frappe.logger().debug(
                        f"No {related_doctype} documents found with {fieldname}={main_docname}"
                    )

            # If no direct link found, just return the latest document of the related doctype
            # as a fallback (keeping the original behavior)
            frappe.logger().debug(f"Falling back to latest {related_doctype} document")
            latest_docs = frappe.get_list(
                related_doctype, fields=["name"], order_by="creation desc", limit=1
            )
            if latest_docs:
                related_doc = frappe.get_doc(related_doctype, latest_docs[0].name)
                return {"success": True, "doc": related_doc.as_dict()}

            return {
                "success": False,
                "message": _("No related documents found for {0} linked to {1}").format(
                    related_doctype, main_docname
                ),
            }

    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(), _("Failed to get related document data")
        )
        return {
            "success": False,
            "message": _("Failed to get related document data: {0}").format(str(e)),
        }


@frappe.whitelist()
def get_related_field_value(
    main_doctype, main_docname, related_doctype, link_fieldname, field_name
):
    """Get a specific field value from a related document without fetching the entire document"""
    try:
        if not all([main_doctype, main_docname, related_doctype, field_name]):
            return {
                "success": False,
                "message": _(
                    "Missing required parameters for fetching related field value"
                ),
            }

        # Log the parameters for debugging
        frappe.logger().debug(
            f"Getting related field value with params: {main_doctype}, {main_docname}, {related_doctype}, {link_fieldname}, {field_name}"
        )

        # First, validate that the related doctype exists (case-insensitive check)
        all_doctypes = frappe.db.sql("SELECT name FROM `tabDocType`", as_dict=True)
        all_doctype_names = [d.name.lower() for d in all_doctypes]

        # Try to find the correct case for the doctype
        actual_related_doctype = related_doctype
        if related_doctype.lower() not in all_doctype_names:
            frappe.logger().debug(f"DocType '{related_doctype}' not found")
            return {
                "success": False,
                "message": _("DocType {0} not found").format(related_doctype),
            }
        else:
            # Find the correct case for the doctype
            for dt in all_doctypes:
                if dt.name.lower() == related_doctype.lower():
                    actual_related_doctype = dt.name
                    if actual_related_doctype != related_doctype:
                        frappe.logger().debug(
                            f"Using correct case for doctype: {actual_related_doctype}"
                        )
                    break

        # Verify the field exists in the related doctype
        meta = frappe.get_meta(actual_related_doctype)
        field_exists = False
        for field in meta.fields:
            if field.fieldname.lower() == field_name.lower():
                field_name = field.fieldname  # Use the correct case
                field_exists = True
                break

        if not field_exists:
            frappe.logger().debug(
                f"Field '{field_name}' not found in {actual_related_doctype}"
            )
            return {
                "success": False,
                "message": _("Field {0} not found in {1}").format(
                    field_name, actual_related_doctype
                ),
            }

        # If we have a link fieldname, it means the main document has a link to the related doctype
        if link_fieldname:
            # First get the linked document's name/ID from the main document
            linked_value = frappe.db.get_value(
                main_doctype, main_docname, link_fieldname
            )

            if linked_value:
                # Then get the specific field value from the related document
                field_value = frappe.db.get_value(
                    actual_related_doctype, linked_value, field_name
                )

                if field_value is not None:
                    return {
                        "success": True,
                        "value": field_value,
                        "docname": linked_value,
                    }
                else:
                    return {
                        "success": False,
                        "message": _("Field value for {0} is empty in {1}").format(
                            field_name, actual_related_doctype
                        ),
                    }
            else:
                return {
                    "success": False,
                    "message": _("No link found in {0} via field {1}").format(
                        main_doctype, link_fieldname
                    ),
                }
        else:
            # If no link fieldname, check if the related doctype has a link to the main doctype
            link_field = None

            for field in meta.fields:
                if (
                    field.fieldtype == "Link"
                    and field.options.lower() == main_doctype.lower()
                ):
                    link_field = field.fieldname
                    break

            if link_field:
                # Find related document with this link
                try:
                    related_doc = frappe.db.get_value(
                        actual_related_doctype,
                        {link_field: main_docname},
                        ["name", field_name],
                        as_dict=True,
                    )

                    if related_doc:
                        return {
                            "success": True,
                            "value": related_doc.get(field_name),
                            "docname": related_doc.name,
                        }
                except Exception as e:
                    frappe.logger().debug(f"Error finding related document: {str(e)}")
            else:
                frappe.logger().debug(
                    f"No link field from {actual_related_doctype} to {main_doctype} found"
                )

            # Fallback to the latest document as a last resort
            try:
                # Check if this doctype has any documents at all
                count = frappe.db.count(actual_related_doctype)
                if count == 0:
                    return {
                        "success": False,
                        "message": _("No documents exist for {0}").format(
                            actual_related_doctype
                        ),
                    }

                latest_doc = frappe.db.get_value(
                    actual_related_doctype,
                    filters={},
                    fieldname=["name", field_name],
                    order_by="creation desc",
                    as_dict=True,
                )

                if latest_doc and latest_doc.get(field_name) is not None:
                    return {
                        "success": True,
                        "value": latest_doc.get(field_name),
                        "docname": latest_doc.name,
                        "message": _("Using latest {0} document").format(
                            actual_related_doctype
                        ),
                    }
                else:
                    return {
                        "success": False,
                        "message": _(
                            "Field {0} not found in the latest {1} document"
                        ).format(field_name, actual_related_doctype),
                    }
            except Exception as e:
                frappe.log_error(f"Error getting latest document: {str(e)}")
                return {
                    "success": False,
                    "message": _("Error retrieving latest document: {0}").format(
                        str(e)
                    ),
                }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to get related field value"))
        return {
            "success": False,
            "message": _("Error retrieving field value: {0}").format(str(e)),
        }


@frappe.whitelist()
def get_design_thumbnail(design_name):
    """
    Generate a thumbnail preview for an invoice design

    Args:
        design_name (str): Name of the print design

    Returns:
        dict: Thumbnail data or error message
    """
    try:
        # Check if design exists
        if not frappe.db.exists("Print Format", design_name):
            return {"success": False, "message": f"Design {design_name} not found"}

        # Get the design
        design = frappe.get_doc("Print Format", design_name)

        if not design.html:
            return {"success": False, "message": "Design has no HTML content"}

        # Use the actual HTML content as the thumbnail
        # In a production system, you might want to generate an actual image
        # This would require headless browser rendering or other techniques
        return {"success": True, "thumbnail": design.html, "doctype": design.doc_type}
    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(), _("Failed to generate design thumbnail")
        )
        return {
            "success": False,
            "message": _("Failed to generate design thumbnail: {0}").format(str(e)),
        }


@frappe.whitelist(allow_guest=True)
def view_design(design_name=None):
    """
    Render a design directly in the browser

    Args:
        design_name (str): Name of the print design

    Returns:
        HTML: Complete HTML page for viewing the design
    """
    try:
        if not design_name:
            return _("No design specified")

        # Check if design exists
        if not frappe.db.exists("Print Format", design_name):
            return _("Design {0} not found").format(design_name)

        # Get the design
        design = frappe.get_doc("Print Format", design_name)

        if not design.html:
            return _("Design has no content")

        # Create a complete HTML document
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{design.name}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                @media print {{
                    @page {{
                        size: A4;
                        margin: 5mm;
                    }}
                    body {{
                        margin: 0;
                        padding: 0;
                    }}
                }}
                body {{
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f8f8f8;
                }}
                .container {{
                    background-color: #fff;
                    margin: 20px auto;
                    padding: 30px;
                    box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                    width: 210mm; /* A4 width */
                    min-height: 297mm; /* A4 height */
                }}
                .print-header {{
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 20px;
                    background-color: #f0f4f8;
                    border-bottom: 1px solid #e0e0e0;
                }}
                .print-actions {{
                    display: flex;
                    gap: 10px;
                }}
                .btn {{
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s;
                }}
                .btn-primary {{
                    background-color: #4273fa;
                    color: white;
                }}
                .btn-default {{
                    background-color: #f5f5f5;
                    border: 1px solid #ddd;
                }}
                .btn:hover {{
                    opacity: 0.9;
                }}
                @media print {{
                    .print-header {{
                        display: none;
                    }}
                    .container {{
                        box-shadow: none;
                        margin: 0;
                        width: 100%;
                        min-height: auto;
                    }}
                }}
                
                /* Common table styling */
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }}
                th, td {{
                    padding: 8px;
                    text-align: left;
                    border: 1px solid #ddd;
                }}
                th {{
                    background-color: #f8f8f8;
                    font-weight: bold;
                }}
            </style>
        </head>
        <body>
            <div class="print-header">
                <div class="title">
                    <h2>{design.name}</h2>
                </div>
                <div class="print-actions">
                    <button class="btn btn-default" onclick="window.close()">Close</button>
                    <button class="btn btn-primary" onclick="window.print()">Print</button>
                </div>
            </div>
            <div class="container">
                {design.html}
            </div>
            <script>
                // Add any additional JavaScript here if needed
                document.addEventListener('DOMContentLoaded', function() {{
                    // Auto-fit content if needed
                }});
            </script>
        </body>
        </html>
        """

        return html

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to view design"))
        return f"<p>Error: {str(e)}</p>"
