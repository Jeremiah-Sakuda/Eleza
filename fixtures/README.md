# Synthetic fixtures

All fixtures in this directory are original, synthetic examples created for Eleza's test and judge flows. They do not contain real student work or identify a real institution.

## Code inventory tracker

`code-inventory-tracker.py` is an introductory Python assignment that loads, edits, reports, and saves inventory records.

The deliberate weak spot is the `Inventory` class's name-keyed dictionary, anchored by the graph node `design_decision_name_key`. `Inventory.add` stores each item under `item.name.lower()`. It works when names are unique, but a later product with the same display name and a different SKU silently replaces the earlier product. The scripted weak defense must produce exactly one `cannot_reconstruct` or `mechanism_gap` finding on that node's source span; the well-defended decisions must produce none.

## Photosynthesis lab report

`lab-photosynthesis-report.txt` reports a small aquatic-plant investigation. Its deliberate weak spot is `conclusion_sole_factor`: the first conclusion sentence claims light intensity is the sole control under all environmental conditions, although the experiment changed only lamp distance, used one cutting per condition, and treated bubble count as a proxy. The scripted weak defense must produce exactly one `mechanism_gap` on that conclusion span and none on the supported hypothesis, method, or narrower interpretation.

## Expansion case analysis

`case-expansion-memo.txt` recommends a reversible second pickup site for a tool-lending cooperative. Its deliberate weak spot is `assumption_staff_capacity`: the proposed three-afternoon schedule and zero-recruitment budget implicitly require spare volunteer capacity, but the memo never states or supports that dependency. The graph anchors the assumption to the scheduling sentence that implies it. The scripted weak defense must produce exactly one `cannot_reconstruct` on that feasibility-assumption span and none on the defended recommendation, tradeoff, or rejected alternatives.
