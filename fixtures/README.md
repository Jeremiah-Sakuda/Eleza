# Synthetic fixtures

All fixtures in this directory are original, synthetic examples created for Eleza's test and judge flows. They do not contain real student work or identify a real institution.

## Code inventory tracker

`code-inventory-tracker.py` is an introductory Python assignment that loads, edits, reports, and saves inventory records.

The deliberate weak spot is the `Inventory` class's name-keyed dictionary, anchored by the graph node `design_decision_name_key`. `Inventory.add` stores each item under `item.name.lower()`. It works when names are unique, but a later product with the same display name and a different SKU silently replaces the earlier product. The scripted weak defense must produce exactly one `cannot_reconstruct` or `mechanism_gap` finding on that node's source span; the well-defended decisions must produce none.
