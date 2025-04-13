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
        is_default (int, optional): Whether this design should be set as default. Defaults to 0.

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

            # Then handle simple field placeholders
            pattern = r"{{([^{}.\n]+)}}"

            def replace_field(match):
                field_name = match.group(1).strip()
                if field_name in field_names:
                    return "{{doc." + field_name + "}}"
                return match.group(0)  # Return unchanged if not a valid field

            html_content = re.sub(pattern, replace_field, html_content)

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

        # Get the design
        design_doc = frappe.get_doc("Print Format", design_name)

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
            "is_default": design_doc.is_default or 0,
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
        # Load DocType metadata
        meta = frappe.get_meta(doctype)
        fields = []
        prefix = ""

        # Add prefix for linked fields to distinguish them
        if parent_doctype and parent_doctype != doctype and link_fieldname:
            prefix = f"{link_fieldname}."

        # Process fields
        for field in meta.fields:
            # Skip only layout and structure field types
            if field.fieldtype in [
                "Section Break",
                "Column Break",
                "Tab Break",
                "Fold",
                "Page Break",
            ]:
                continue

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
        new_design.is_default = 0  # Don't set as default
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
def get_last_doc(doctype):
    """Get the last print design"""
    try:
        # Get the design
        return frappe.get_last_doc(doctype)
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), _("Failed to get last print design"))
