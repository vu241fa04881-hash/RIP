"""6-Stage Clinical Gait Phase Finite State Machine (FSM)
SIH 2026 | PS SIH26113 | Team: BERSERK TECHIES | Team ID: TEAM-147
"""

from enum import Enum
from typing import Dict, Any, Tuple


class GaitPhase(str, Enum):
    INITIAL_CONTACT = "INITIAL_CONTACT"      # 0% - 2% (Heel strike)
    LOADING_RESPONSE = "LOADING_RESPONSE"    # 2% - 12% (Weight acceptance & knee flexion)
    MID_STANCE = "MID_STANCE"                # 12% - 31% (Single limb support, roll-over)
    TERMINAL_STANCE = "TERMINAL_STANCE"      # 31% - 50% (Heel-off, forward progression)
    PRE_SWING = "PRE_SWING"                  # 50% - 62% (Weight transfer, rapid knee flexion)
    SWING_PHASE = "SWING_PHASE"              # 62% - 100% (Limb clearance & forward advancement)


class GaitPhaseStateMachine:
    """Classifies human gait into 6 standard clinical phases based on:

    - Heel, metatarsal, and toe FSR forces
    - Knee joint angle and velocity
    - Gait cycle temporal progression
    """

    def __init__(self, cycle_period_s: float = 2.0):
        self.cycle_period_s = cycle_period_s
        self.phase = GaitPhase.INITIAL_CONTACT
        self.cycle_time_s = 0.0
        self.gait_cycle_percent = 0.0
        self.stride_count = 0

    def set_cycle_period(self, period_s: float) -> None:
        """Dynamically adapts gait stride period (e.g. 2.0s for WALK, 0.85s for RUN)."""
        if period_s > 0.1 and abs(self.cycle_period_s - period_s) > 0.01:
            ratio = (self.cycle_time_s / self.cycle_period_s) if self.cycle_period_s > 0 else 0.0
            self.cycle_period_s = float(period_s)
            self.cycle_time_s = ratio * self.cycle_period_s

    def reset(self) -> None:
        self.phase = GaitPhase.INITIAL_CONTACT
        self.cycle_time_s = 0.0
        self.gait_cycle_percent = 0.0
        self.stride_count = 0

    def step(self, dt: float, heel_force_n: float, metatarsal_force_n: float,
             toe_force_n: float, knee_angle_deg: float, knee_vel_deg_s: float) -> Dict[str, Any]:
        """Advances gait phase machine given sensor readings."""
        # Enforce strict anatomical knee range of motion limits (0° to 120° flexion, zero hyperextension)
        knee_angle_deg = max(0.0, min(120.0, float(knee_angle_deg)))

        self.cycle_time_s += dt
        if self.cycle_time_s >= self.cycle_period_s:
            self.cycle_time_s -= self.cycle_period_s
            self.stride_count += 1

        self.gait_cycle_percent = (self.cycle_time_s / self.cycle_period_s) * 100.0
        p = self.gait_cycle_percent

        total_force = heel_force_n + metatarsal_force_n + toe_force_n
        is_stance = total_force > 30.0

        # Phase transition logic combining temporal gait percentage & ground forces
        if p < 3.0 or (is_stance and heel_force_n > 50.0 and metatarsal_force_n < 60.0 and p < 15.0):
            self.phase = GaitPhase.INITIAL_CONTACT
        elif 3.0 <= p < 14.0 or (is_stance and metatarsal_force_n > 40.0 and p < 20.0 and knee_angle_deg > 8.0):
            self.phase = GaitPhase.LOADING_RESPONSE
        elif 14.0 <= p < 32.0 or (is_stance and metatarsal_force_n > 100.0 and heel_force_n < 150.0 and p < 40.0):
            self.phase = GaitPhase.MID_STANCE
        elif 32.0 <= p < 52.0 or (is_stance and heel_force_n < 25.0 and metatarsal_force_n > 80.0):
            self.phase = GaitPhase.TERMINAL_STANCE
        elif 52.0 <= p < 62.0 or (is_stance and toe_force_n > 50.0 and metatarsal_force_n < 60.0):
            self.phase = GaitPhase.PRE_SWING
        else:
            self.phase = GaitPhase.SWING_PHASE

        is_swing = (self.phase == GaitPhase.SWING_PHASE)

        return {
            "phase": self.phase.value,
            "cycle_percent": round(self.gait_cycle_percent, 1),
            "stride_count": self.stride_count,
            "is_stance": not is_swing,
            "is_swing": is_swing
        }
