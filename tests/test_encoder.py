"""Unit tests for OpticalJointEncoder
SIH 2026 | PS SIH26113 | Team: BERSERK TECHIES | Team ID: TEAM-147
"""

import unittest
import math
from backend.sensors.encoder import OpticalJointEncoder


class TestOpticalJointEncoder(unittest.TestCase):

    def setUp(self):
        self.encoder = OpticalJointEncoder(resolution_deg=0.088, dt=0.01)

    def test_first_sample_no_velocity_spike(self):
        """Encoder should report 0.0 velocity on the very first update rather than spiking from 0."""
        reading = self.encoder.update(15.0)
        self.assertTrue(reading["healthy"])
        self.assertEqual(reading["status"], "HEALTHY")
        self.assertAlmostEqual(reading["angle_deg"], 15.0, delta=0.1)
        self.assertEqual(reading["velocity_deg_s"], 0.0)

    def test_subsequent_velocity_computation(self):
        """Subsequent updates should compute realistic angular velocity."""
        self.encoder.update(10.0)
        # Advance by 1 deg in 0.01s => approx 100 deg/s
        reading2 = self.encoder.update(11.0)
        self.assertAlmostEqual(reading2["velocity_deg_s"], 100.0, delta=5.0)

    def test_nan_and_invalid_inputs(self):
        """Encoder should gracefully handle NaN, Inf, and None without throwing exceptions."""
        nan_reading = self.encoder.update(float("nan"))
        self.assertFalse(nan_reading["healthy"])
        self.assertEqual(nan_reading["status"], "FAULT_INVALID_INPUT")
        self.assertTrue(math.isnan(nan_reading["angle_deg"]))

        inf_reading = self.encoder.update(float("inf"))
        self.assertFalse(inf_reading["healthy"])
        self.assertEqual(inf_reading["status"], "FAULT_INVALID_INPUT")

    def test_fault_injection_and_recovery(self):
        """Fault injection and clearing should transition without spike."""
        self.encoder.update(20.0)
        self.encoder.inject_fault("SIGNAL_LOSS")
        fault_reading = self.encoder.update(20.0)
        self.assertFalse(fault_reading["healthy"])
        self.assertEqual(fault_reading["status"], "FAULT_SIGNAL_LOSS")

        self.encoder.clear_fault()
        cleared_reading = self.encoder.update(25.0)
        self.assertTrue(cleared_reading["healthy"])
        # Should NOT spike from old pre-fault position
        self.assertEqual(cleared_reading["velocity_deg_s"], 0.0)

    def test_reset(self):
        """Reset should reset internal state and fault status."""
        self.encoder.update(45.0)
        self.encoder.reset(initial_angle_deg=10.0)
        self.assertFalse(self.encoder.is_faulty)


if __name__ == "__main__":
    unittest.main()
