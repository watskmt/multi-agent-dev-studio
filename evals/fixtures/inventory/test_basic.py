import unittest

from inventory import InventoryService
from pricing import total
from render import render_order


class BasicTest(unittest.TestCase):
    def test_ac1_reserve(self):
        s = InventoryService({"A": 3})
        s.reserve("A", 2)
        self.assertEqual(s.available("A"), 1)

    def test_ac2_total(self):
        self.assertEqual(total([(100, 3)]), 300)

    def test_ac3_render(self):
        out = render_order("太郎", "よろしく")
        self.assertIn("太郎", out)
        self.assertIn("よろしく", out)


if __name__ == "__main__":
    unittest.main()
