"""Small command-line inventory tracker for a classroom assignment."""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import csv


@dataclass
class Item:
    sku: str
    name: str
    quantity: int
    unit_price: Decimal


class Inventory:
    def __init__(self) -> None:
        self.items: dict[str, Item] = {}

    def add(self, item: Item) -> None:
        self.items[item.name.lower()] = item

    def adjust(self, name: str, change: int) -> bool:
        key = name.lower()
        if key not in self.items:
            return False
        next_quantity = self.items[key].quantity + change
        if next_quantity < 0:
            return False
        self.items[key].quantity = next_quantity
        return True

    def remove(self, name: str) -> bool:
        return self.items.pop(name.lower(), None) is not None

    def low_stock(self, threshold: int = 5) -> list[Item]:
        return sorted(
            (item for item in self.items.values() if item.quantity <= threshold),
            key=lambda item: (item.quantity, item.name.lower()),
        )

    def total_value(self) -> Decimal:
        return sum(
            (item.unit_price * item.quantity for item in self.items.values()),
            start=Decimal("0.00"),
        )


def load_inventory(filename: str) -> Inventory:
    inventory = Inventory()
    with open(filename, newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            try:
                item = Item(
                    sku=row["sku"].strip(),
                    name=row["name"].strip(),
                    quantity=int(row["quantity"]),
                    unit_price=Decimal(row["unit_price"]),
                )
            except (KeyError, ValueError, InvalidOperation):
                continue
            inventory.add(item)
    return inventory


def save_inventory(filename: str, inventory: Inventory) -> None:
    fields = ["sku", "name", "quantity", "unit_price"]
    with open(filename, "w", newline="", encoding="utf-8") as destination:
        writer = csv.DictWriter(destination, fieldnames=fields)
        writer.writeheader()
        for item in sorted(inventory.items.values(), key=lambda entry: entry.sku):
            writer.writerow(
                {
                    "sku": item.sku,
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit_price": str(item.unit_price),
                }
            )


def print_summary(inventory: Inventory) -> None:
    print(f"Inventory value: ${inventory.total_value():.2f}")
    print("Low-stock items:")
    for item in inventory.low_stock():
        print(f"  {item.name} ({item.sku}): {item.quantity}")


if __name__ == "__main__":
    current = load_inventory("inventory.csv")
    print_summary(current)
    save_inventory("inventory.csv", current)
