import unittest

import pandas as pd

from src.modules.participant_analytics.compute_correctness import compute_correctness_columns


class ComputeCodeCorrectnessTest(unittest.TestCase):
    def test_maps_persisted_code_correctness(self):
        instances = pd.DataFrame(
            [
                {
                    "elementInstanceId": 42,
                    "type": "CODE",
                    "options": {},
                }
            ]
        )

        for correctness, expected in [
            (1, "CORRECT"),
            (0.5, "PARTIAL"),
            (0, "INCORRECT"),
        ]:
            with self.subTest(correctness=correctness):
                row = pd.Series(
                    {
                        "elementInstanceId": 42,
                        "response": {
                            "code": "def solve():\n    return 1",
                            "correctness": correctness,
                        },
                    }
                )
                self.assertEqual(
                    compute_correctness_columns(instances, row),
                    expected,
                )

    def test_rejects_missing_code_correctness(self):
        instances = pd.DataFrame(
            [
                {
                    "elementInstanceId": 42,
                    "type": "CODE",
                    "options": {},
                }
            ]
        )
        row = pd.Series(
            {
                "elementInstanceId": 42,
                "response": {"code": "def solve():\n    return 1"},
            }
        )

        with self.assertRaisesRegex(ValueError, "Invalid CODE correctness"):
            compute_correctness_columns(instances, row)


if __name__ == "__main__":
    unittest.main()
