# Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json


class InvoiceDesign(Document):
    def validate(self):
        # Ensure elements is a valid JSON
        if self.elements:
            try:
                json.loads(self.elements)
            except ValueError:
                frappe.throw("Elements must be a valid JSON")

        # If this design is set as default, unset other defaults
        if self.is_default:
            frappe.db.sql(
                """
                UPDATE `tabInvoice Design` 
                SET is_default = 0
                WHERE name != %s
            """,
                (self.name,),
            )
