"""Master Closed-Loop Simulation Engine (100 Hz)
SIH 2026 | PS SIH26113 | Team: BERSERK TECHIES | Team ID: TEAM-147
"""

import math
import time
import threading
from typing import Dict, Any, Optional

from backend.config import DEFAULT_SIM, DEFAULT_SAFETY, SCIENTIFIC_DISCLAIMER
from backend.models.anthropometry import AnthropometricModel
from backend.models.biomechanics import BiomechanicalKneeModel
from backend.models.user_model import UserModel
from backend.sensors.imu import VirtualIMU
from backend.sensors.foot_pressure import FootPressureSensorArray
from backend.sensors.encoder import OpticalJointEncoder
from backend.sensors.emg import VirtualsEMG
from backend.controllers.gait_fsm import GaitPhaseStateMachine
from backend.controllers.deficit import AssistanceDeficitCalculator
from backend.controllers.adaptive_aan import AdaptiveAANController
from backend.controllers.actuator import VirtualBLDCActuator
from backend.safety.supervisor import SafetySupervisor, SafetyMode
from backend.simulation.demo_runner import AutomatedDemoRunner, DemoPhase
from backend.simulation.recorder import TrialRecorder
from backend.models.reporter import ClinicalReportGenerator


class SimulationEngine:
    """Orchestrates the entire closed-loop rehabilitation exoskeleton simulation:

    
    Sense -> Estimate -> Deficit -> Adapt -> Safety -> Actuate -> Kinematics -> Telemetry
    """

    def __init__(self, dt: float = DEFAULT_SIM.dt):
        self.dt = dt
        self.time_elapsed = 0.0
        self.step_count = 0
        self.lock = threading.Lock()

        # Core Models & Subsystems
        self.anthro = AnthropometricModel()
        self.biomech = BiomechanicalKneeModel(self.anthro, dt=self.dt)
        self.user = UserModel(base_strength=0.35)

        # Virtual Sensors
        self.thigh_imu = VirtualIMU(name="IMU_THIGH")
        self.shank_imu = VirtualIMU(name="IMU_SHANK")
        self.foot_pressure = FootPressureSensorArray(patient_mass_kg=self.anthro.mass_kg)
        self.encoder = OpticalJointEncoder(dt=self.dt)
        self.emg = VirtualsEMG()

        # Controllers & Safety
        self.gait_fsm = GaitPhaseStateMachine(cycle_period_s=2.0)
        self.deficit_calc = AssistanceDeficitCalculator()
        self.aan = AdaptiveAANController()
        self.actuator = VirtualBLDCActuator(dt=self.dt)
        self.safety = SafetySupervisor(dt=self.dt)
        self.demo = AutomatedDemoRunner()
        self.recorder = TrialRecorder()

        # Kinematic state & Exercise Modes
        self.kinematic_mode: str = "WALK"  # "WALK", "SIT_STAND", "RUN", "STANDBY", "MANUAL_JOG"
        self.manual_jog_angle_deg: float = 0.0
        self.cumulative_energy_joules: float = 0.0
        self.peak_power_watts: float = 0.0

        self.theta_knee_deg = 0.0
        self.omega_knee_deg_s = 0.0
        self.alpha_knee_deg_s2 = 0.0
        self.theta_thigh_deg = 0.0
        self.gait_sim_time = 0.0

        # Latest telemetry snapshot
        self.latest_telemetry: Dict[str, Any] = {}
        self._is_running = False
        self._sim_thread: Optional[threading.Thread] = None

    def set_kinematic_mode(self, mode: str, jog_angle_deg: float = 0.0) -> None:
        """Sets active kinematic exercise movement mode (WALK, SIT_STAND, RUN, STANDBY, MANUAL_JOG)."""
        with self.lock:
            mode_upper = mode.upper().replace("-", "_")
            if mode_upper in ("WALK", "SIT_STAND", "RUN", "STANDBY", "MANUAL_JOG"):
                self.kinematic_mode = mode_upper
            if mode_upper == "MANUAL_JOG":
                self.manual_jog_angle_deg = max(0.0, min(115.0, float(jog_angle_deg)))


    def update_anthropometrics(self, height_m: float, mass_kg: float) -> None:
        with self.lock:
            self.anthro.update_profile(height_m, mass_kg)
            self.foot_pressure.update_mass(self.anthro.mass_kg)

    def start_calibration(self) -> None:
        with self.lock:
            self.anthro.start_calibration()

    def set_user_parameters(self, strength: Optional[float] = None,
                            fatigue: Optional[float] = None) -> None:
        with self.lock:
            if strength is not None:
                self.user.set_base_strength(strength)
            if fatigue is not None:
                self.user.set_fatigue(fatigue)

    def trigger_estop(self) -> None:
        with self.lock:
            self.safety.trigger_estop()

    def trigger_controlled_soft_stop(self, duration_s: float = 90.0,
                                     reason: str = "MANUAL_CONTROLLED_SOFT_STOP",
                                     seriousness: str = "NORMAL") -> None:
        """Triggers anti-fall controlled soft E-stop with 30s to 2 min progressive deceleration."""
        with self.lock:
            self.safety.trigger_controlled_soft_stop(duration_s=duration_s, reason=reason, seriousness=seriousness)

    def update_soft_stop_duration(self, duration_s: float, reason: str = "MANUAL_TIMER_UPDATE") -> None:
        """Dynamically updates running soft-stop countdown duration (e.g. 30s rapid anti-buckle)."""
        with self.lock:
            self.safety.update_soft_stop_duration(new_duration_s=duration_s, reason=reason)

    def reset_soft_stop(self) -> None:
        with self.lock:
            self.safety.reset_soft_stop()

    def reset_estop(self) -> bool:
        with self.lock:
            return self.safety.reset_estop()

    def inject_sensor_fault(self, sensor_type: str = "ALL") -> None:
        with self.lock:
            if sensor_type in ("ALL", "IMU"):
                self.shank_imu.inject_fault("DROPOUT")
            if sensor_type in ("ALL", "FSR"):
                self.foot_pressure.inject_fault("DISCONNECTED")
            if sensor_type in ("ALL", "ENCODER"):
                self.encoder.inject_fault("SIGNAL_LOSS")

    def clear_sensor_faults(self) -> None:
        with self.lock:
            self.thigh_imu.clear_fault()
            self.shank_imu.clear_fault()
            self.foot_pressure.clear_fault()
            self.encoder.clear_fault()
            self.emg.clear_fault()

    def start_demo(self) -> None:
        with self.lock:
            self.recorder.start_recording()
            self.demo.start()

    def stop_demo(self) -> None:
        with self.lock:
            self.demo.stop()
            self.recorder.stop_recording()
            self.user.trigger_spasm(False)

    def step(self) -> Dict[str, Any]:
        """Performs a single 100 Hz simulation step."""
        with self.lock:
            self.step_count += 1
            self.time_elapsed += self.dt

            # 1. Advance auto-calibration (if active)
            cal_state, cal_progress = self.anthro.step_calibration(self.dt)

            # 2. Advance automated demonstration (if active)
            demo_phase, demo_info = self.demo.step(self.dt)
            if demo_info["active"]:
                self.user.set_base_strength(demo_info["target_strength"])
                self.user.set_fatigue(demo_info["target_fatigue"])
                self.user.trigger_spasm(demo_info["spasm_active"])

            # 3. Kinematic movement trajectory generation based on active exercise mode
            vel_scale = 1.0
            if self.safety.soft_stop_active:
                p_soft = min(1.0, self.safety.soft_stop_elapsed_s / self.safety.soft_stop_duration_s)
                vel_scale = max(0.0, 1.0 - (p_soft ** 1.4))
            elif self.safety.e_stop_latched:
                vel_scale = 0.0

            if self.kinematic_mode == "MANUAL_JOG":
                # Clinician interactive manual jog dial/slider (0 to 115 deg)
                target_knee_angle = self.manual_jog_angle_deg
                target_thigh_angle = min(22.0, self.manual_jog_angle_deg * 0.20)
                p = 0.0
                is_stance_phase = True
            elif self.kinematic_mode == "STANDBY":
                # Neutral standing balance posture
                target_knee_angle = 10.0
                target_thigh_angle = 0.0
                p = 0.0
                is_stance_phase = True
            elif self.kinematic_mode == "SIT_STAND":
                # Sit-to-Stand transfer training cycle (4.0s period)
                sit_stand_period = 4.0
                self.gait_fsm.set_cycle_period(sit_stand_period)
                self.gait_sim_time += self.dt * vel_scale
                cycle_time = self.gait_sim_time % sit_stand_period
                p = (cycle_time / sit_stand_period) * 100.0

                # 0-25%: Seated posture forward trunk lean preparation
                # 25-50%: Seat-off transition & extension ascent (85 -> 8 deg)
                # 50-70%: Standing upright holding
                # 70-90%: Controlled sitting descent (8 -> 85 deg)
                # 90-100%: Seated resting pause
                if p < 25.0:
                    sub = p / 25.0
                    target_knee_angle = 85.0 - 5.0 * math.sin(sub * math.pi)
                    target_thigh_angle = 75.0 - 15.0 * math.sin(sub * math.pi)
                    is_stance_phase = sub > 0.6
                elif p < 50.0:
                    sub = (p - 25.0) / 25.0
                    blend = 0.5 * (1.0 - math.cos(sub * math.pi))
                    target_knee_angle = (1.0 - blend) * 85.0 + blend * 8.0
                    target_thigh_angle = (1.0 - blend) * 60.0 + blend * 2.0
                    is_stance_phase = True
                elif p < 70.0:
                    target_knee_angle = 8.0
                    target_thigh_angle = 2.0
                    is_stance_phase = True
                elif p < 90.0:
                    sub = (p - 70.0) / 20.0
                    blend = 0.5 * (1.0 - math.cos(sub * math.pi))
                    target_knee_angle = (1.0 - blend) * 8.0 + blend * 85.0
                    target_thigh_angle = (1.0 - blend) * 2.0 + blend * 75.0
                    is_stance_phase = True
                else:
                    target_knee_angle = 85.0
                    target_thigh_angle = 75.0
                    is_stance_phase = False
            elif self.kinematic_mode == "RUN":
                # Athletic running cadence (0.85s stride period, ~141 steps/min, true running flight/stance phase)
                run_period = 0.85
                self.gait_fsm.set_cycle_period(run_period)
                self.gait_sim_time += self.dt * vel_scale
                cycle_time = self.gait_sim_time % run_period
                p = (cycle_time / run_period) * 100.0

                # Human physiological running profile
                # Stance phase (0-38%): shock absorption and elastic rebound
                if p < 20.0:
                    sub = p / 20.0
                    target_knee_angle = 12.0 + 16.0 * math.sin(sub * (math.pi / 2.0))
                elif p < 38.0:
                    sub = (p - 20.0) / 18.0
                    target_knee_angle = 28.0 - 18.0 * sub
                # Swing phase (38-100%): natural posterior knee flexion for clearance, then terminal extension to foot-flat
                elif p < 68.0:
                    sub = (p - 38.0) / 30.0
                    target_knee_angle = 10.0 + 58.0 * math.sin(sub * (math.pi / 2.0))
                else:
                    sub = (p - 68.0) / 32.0
                    blend = 0.5 * (1.0 + math.cos(sub * math.pi))
                    target_knee_angle = 12.0 + 56.0 * blend

                # Human running hip angle (peaks at forward heel strike p=0%, extends back at toe-off p=38%)
                target_thigh_angle = 5.0 + 24.0 * math.cos(2.0 * math.pi * (p / 100.0))
                is_stance_phase = p < 38.0
            else:
                # Default "WALK": Clinical human gait profile (Winter's biomechanics, 2.0s period, 60 steps/min)
                walk_period = 2.0
                self.gait_fsm.set_cycle_period(walk_period)
                self.gait_sim_time += self.dt * vel_scale
                cycle_time = self.gait_sim_time % walk_period
                p = (cycle_time / walk_period) * 100.0

                # 0-15%: Loading response (shock absorption 4 -> 16 deg)
                # 15-40%: Midstance support (straight leg column 16 -> 4 deg)
                # 40-60%: Terminal stance & push-off (4 -> 32 deg)
                # 60-73%: Initial swing clearance (32 -> 58 deg)
                # 73-100%: Terminal swing forward extension (knee reaches forward 58 -> 4 deg)
                if p < 15.0:
                    sub = p / 15.0
                    target_knee_angle = 4.0 + 12.0 * math.sin(sub * (math.pi / 2.0))
                elif p < 40.0:
                    sub = (p - 15.0) / 25.0
                    target_knee_angle = 16.0 - 12.0 * sub
                elif p < 60.0:
                    sub = (p - 40.0) / 20.0
                    target_knee_angle = 4.0 + 28.0 * math.sin(sub * (math.pi / 2.0))
                elif p < 73.0:
                    sub = (p - 60.0) / 13.0
                    target_knee_angle = 32.0 + 26.0 * math.sin(sub * (math.pi / 2.0))
                else:
                    sub = (p - 73.0) / 27.0
                    blend = 0.5 * (1.0 + math.cos(sub * math.pi))
                    target_knee_angle = 4.0 + 54.0 * blend

                # Human walking hip angle (peaks at forward heel strike p=0%, extends back at toe-off p=50%)
                target_thigh_angle = 4.0 + 18.0 * math.cos(2.0 * math.pi * (p / 100.0)) + 2.5 * math.cos(4.0 * math.pi * (p / 100.0))
                is_stance_phase = p < 60.0

            # If Controlled Soft Stop is active, smoothly settle into anti-collapse upright stance posture (12 deg knee)
            if vel_scale < 1.0:
                blend_stop = 1.0 - vel_scale
                target_knee_angle = (1.0 - blend_stop) * target_knee_angle + blend_stop * 12.0
                target_thigh_angle = (1.0 - blend_stop) * target_thigh_angle + blend_stop * 2.0

            # Enforce strict anatomical knee range of motion limits (0° to safety max ROM limit, zero hyperextension/recurvatum)
            target_knee_angle = max(0.0, min(self.safety.max_rom, float(target_knee_angle)))

            # Numerical velocity
            prev_knee = self.theta_knee_deg
            self.theta_knee_deg = target_knee_angle
            self.theta_thigh_deg = target_thigh_angle
            self.omega_knee_deg_s = (self.theta_knee_deg - prev_knee) / self.dt

            # 4. Sensor simulation
            # Thigh & Shank IMUs
            thigh_rad = math.radians(self.theta_thigh_deg)
            shank_rad = math.radians(self.theta_thigh_deg - self.theta_knee_deg)
            omega_shank_rad_s = math.radians(self.omega_knee_deg_s)
            
            imu_thigh_data = self.thigh_imu.update(thigh_rad, 0.0, 0.0)
            imu_shank_data = self.shank_imu.update(shank_rad, omega_shank_rad_s, 0.0)

            # Foot pressure FSRs
            fsr_data = self.foot_pressure.update(p, is_stance_phase)

            # Optical Joint Encoder
            encoder_data = self.encoder.update(self.theta_knee_deg)

            # Gait State Machine transition (time scale synchronized with kinematic movement)
            fsm_dt = self.dt * vel_scale if self.kinematic_mode in ("WALK", "RUN", "SIT_STAND") else 0.0
            fsm_data = self.gait_fsm.step(
                fsm_dt,
                fsr_data["heel_n"],
                fsr_data["metatarsal_n"],
                fsr_data["toe_n"],
                self.theta_knee_deg,
                self.omega_knee_deg_s
            )

            # 5. Biomechanical knee torque estimation
            vgrf = fsr_data["total_grf_n"] if fsr_data["is_stance"] else 0.0
            # Ground reaction introduces external extension/flexion moment
            biomech_data = self.biomech.step(
                theta_deg=self.theta_knee_deg,
                external_force_n=vgrf * 0.08,
                thigh_angle_deg=self.theta_thigh_deg
            )
            tau_required = biomech_data["tau_required"]

            # 6. User voluntary torque model
            user_data = self.user.step(
                self.dt,
                tau_required=tau_required,
                knee_angle_deg=self.theta_knee_deg,
                gait_phase=fsm_data["phase"],
                is_active_swing=fsm_data["is_swing"]
            )
            tau_user_est = user_data["tau_user_estimated"]

            # Simulated sEMG
            emg_data = self.emg.update(
                voluntary_activation=user_data["emg_envelope"],
                fatigue_index=user_data["fatigue_index"]
            )

            # 7. Assistance Deficit calculation
            deficit_data = self.deficit_calc.compute(tau_required, tau_user_est)
            tau_deficit = deficit_data["tau_deficit"]

            # 8. Adaptive AAN Controller
            # Fast Loop (100 Hz)
            aan_fast = self.aan.fast_loop_step(
                tau_deficit=tau_deficit,
                omega_deg_s=self.omega_knee_deg_s,
                tau_user=tau_user_est,
                tau_req=tau_required
            )
            tau_cmd_unclamped = aan_fast["tau_cmd_unclamped"]

            # Slow Loop (decimated to ~2 Hz)
            if self.step_count % DEFAULT_SIM.slow_loop_decimation == 0:
                self.aan.slow_loop_step(
                    fatigue_index=user_data["fatigue_index"],
                    user_effective_strength=user_data["effective_strength"]
                )

            # 9. Safety Supervisor
            sensors_healthy = (
                imu_shank_data["healthy"] and
                fsr_data["healthy"] and
                encoder_data["healthy"]
            )
            spasm_detected = user_data["spasm_active"]

            # Dynamic Muscle Fatigue Imminent Fall Detection & Adaptive Deceleration:
            # - When muscle fatigue indicates imminent fall risk, trigger Controlled Soft Stop.
            # - If fatigue is extremely high (acute immediate collapse danger, e.g. >= 95%),
            #   or seriousness escalates while already in soft stop, dynamically update the timer
            #   down to 30s (Rapid Anti-Buckle) so the anti-collapse lock engages safely in time!
            if user_data.get("imminent_fall_risk", False) and not self.safety.e_stop_latched:
                rec_duration = user_data.get("recommended_stop_duration_s", 90.0)
                seriousness = user_data.get("fall_seriousness", "ELEVATED")
                fatigue_pct = round(user_data.get("fatigue_index", 0.0) * 100)

                if not self.safety.soft_stop_active:
                    self.safety.trigger_controlled_soft_stop(
                        duration_s=rec_duration,
                        reason=f"MUSCLE_FATIGUE_{seriousness} ({fatigue_pct}%)",
                        seriousness=seriousness
                    )
                else:
                    # Dynamically update timer if seriousness escalated (e.g. from 90s -> 30s)
                    if rec_duration < self.safety.soft_stop_duration_s:
                        self.safety.update_soft_stop_duration(
                            new_duration_s=rec_duration,
                            reason=f"FALL_URGENCY_ESCALATION ({fatigue_pct}%)",
                            seriousness=seriousness
                        )

            safety_data = self.safety.process(
                raw_cmd_torque=tau_cmd_unclamped,
                knee_angle_deg=self.theta_knee_deg,
                knee_vel_deg_s=self.omega_knee_deg_s,
                sensors_healthy=sensors_healthy,
                spasm_detected=spasm_detected
            )
            safe_torque_cmd = safety_data["safe_torque_nm"]

            # 10. Virtual BLDC Actuator dynamics
            actuator_data = self.actuator.step(
                commanded_torque_nm=safe_torque_cmd,
                knee_velocity_deg_s=self.omega_knee_deg_s
            )

            # 11. Robotic Actuator Power & Strength Distribution Metrics
            omega_rad_s = math.radians(self.omega_knee_deg_s)
            p_mech = abs(safe_torque_cmd * omega_rad_s)  # Mechanical power (Watts)
            if p_mech > self.peak_power_watts:
                self.peak_power_watts = p_mech
            self.cumulative_energy_joules += p_mech * self.dt

            # BLDC Electrical power estimation (incorporates motor copper & switching losses)
            copper_loss = 0.5 * ((abs(safe_torque_cmd) / 35.0) ** 2) * 35.0
            p_elec = (p_mech / 0.82) + copper_loss + 6.5

            # Human Strength vs Exoskeleton Strength Utilization (%)
            total_strength_sum = abs(tau_user_est) + abs(safe_torque_cmd)
            if total_strength_sum > 0.1:
                human_strength_pct = min(100.0, (abs(tau_user_est) / total_strength_sum) * 100.0)
                exo_strength_pct = min(100.0, (abs(safe_torque_cmd) / total_strength_sum) * 100.0)
            else:
                human_strength_pct = round(user_data["effective_strength"] * 100.0, 1)
                exo_strength_pct = round(100.0 - human_strength_pct, 1)

            # 12. Compile comprehensive telemetry frame
            telemetry = {
                "timestamp_s": round(self.time_elapsed, 3),
                "step": self.step_count,
                "disclaimer": SCIENTIFIC_DISCLAIMER,
                "kinematics": {
                    "mode": self.kinematic_mode,
                    "jog_angle_deg": round(self.manual_jog_angle_deg, 1),
                    "knee_angle_deg": round(self.theta_knee_deg, 2),
                    "thigh_angle_deg": round(self.theta_thigh_deg, 2),
                    "shank_angle_deg": round(self.theta_thigh_deg - self.theta_knee_deg, 2),
                    "knee_velocity_deg_s": round(self.omega_knee_deg_s, 2),
                },
                "power": {
                    "mechanical_watts": round(p_mech, 2),
                    "electrical_watts": round(p_elec, 2),
                    "peak_watts": round(self.peak_power_watts, 2),
                    "cumulative_kj": round(self.cumulative_energy_joules / 1000.0, 3),
                    "actuator_load_pct": round(min(100.0, (abs(safe_torque_cmd) / 35.0) * 100.0), 1),
                    "human_strength_used_pct": round(human_strength_pct, 1),
                    "exo_strength_used_pct": round(exo_strength_pct, 1),
                    "human_torque_nm": round(tau_user_est, 2),
                    "exo_torque_nm": round(safe_torque_cmd, 2),
                },
                "torques": {
                    "required_nm": round(tau_required, 2),
                    "gravity_nm": round(biomech_data["tau_gravity"], 2),
                    "inertial_nm": round(biomech_data["tau_inertial"], 2),
                    "external_nm": round(biomech_data["tau_external"], 2),
                    "user_estimated_nm": round(tau_user_est, 2),
                    "deficit_nm": round(tau_deficit, 2),
                    "commanded_nm": round(safe_torque_cmd, 2),
                    "actuator_output_nm": round(actuator_data["actual_torque_nm"], 2),
                },
                "aan": {
                    "k_aan": aan_fast["k_aan"],
                    "assistance_percent": aan_fast["assistance_percent"],
                    "user_percent": aan_fast["user_percent"],
                    "fatigue_index": round(user_data["fatigue_index"], 3),
                    "user_strength": round(user_data["effective_strength"], 3),
                },
                "gait": {
                    "phase": fsm_data["phase"],
                    "cycle_percent": round(p, 1),
                    "stride_count": fsm_data["stride_count"],
                    "is_stance": bool(is_stance_phase),
                    "stride_period_s": round(0.85 if self.kinematic_mode == "RUN" else (4.0 if self.kinematic_mode == "SIT_STAND" else (0.0 if self.kinematic_mode in ("STANDBY", "MANUAL_JOG") else 2.0)), 2),
                    "cadence_spm": round(120.0 / (0.85 if self.kinematic_mode == "RUN" else (4.0 if self.kinematic_mode == "SIT_STAND" else 2.0)), 1) if self.kinematic_mode in ("WALK", "RUN", "SIT_STAND") else 0.0,
                },
                "user": {
                    "effective_strength": round(user_data["effective_strength"], 3),
                    "fatigue_index": round(user_data["fatigue_index"], 3),
                    "spasm_active": user_data.get("spasm_active", False),
                },
                "sensors": {
                    "imu_thigh": imu_thigh_data,
                    "imu_shank": imu_shank_data,
                    "foot_pressure": fsr_data,
                    "encoder": encoder_data,
                    "emg": emg_data,
                    "all_healthy": sensors_healthy,
                },
                "safety": {
                    "mode": safety_data["mode"],
                    "e_stop_latched": safety_data["e_stop_latched"],
                    "alerts": safety_data["alerts"],
                    "controlled_soft_stop": safety_data.get("controlled_soft_stop", {"active": False}),
                    "imminent_fall_risk": user_data.get("imminent_fall_risk", False),
                    "fall_risk_severity": user_data.get("fall_risk_severity", 0.0),
                    "fall_seriousness": user_data.get("fall_seriousness", "NORMAL"),
                    "recommended_stop_duration_s": user_data.get("recommended_stop_duration_s", 90.0)
                },
                "actuator": {
                    "motor_temp_c": actuator_data["motor_temp_c"],
                },
                "simulation": {
                    "running": self._is_running,
                    "frequency_hz": 100.0,
                    "dt": self.dt,
                    "step_count": self.step_count,
                    "time_elapsed_s": round(self.time_elapsed, 2)
                },
                "demo": demo_info,
                "anthropometry": self.anthro.get_summary(),
                "report_status": self.recorder.get_status()
            }

            # Record telemetry step
            self.recorder.record_step(telemetry)

            # If demo just completed, stop recording
            if not demo_info["active"] and self.recorder.is_recording:
                self.recorder.stop_recording()

            self.latest_telemetry = telemetry
            return telemetry

    def generate_excel_report(self) -> bytes:
        """Compiles recorded clinical demonstration data into an Excel (.xlsx) workbook."""
        with self.lock:
            records = self.recorder.get_records_for_report()
            anthro_info = self.anthro.get_summary()
        return ClinicalReportGenerator.generate_excel(records, anthro_info)

    def generate_csv_report(self) -> str:
        """Compiles recorded clinical demonstration data into CSV format."""
        with self.lock:
            records = self.recorder.get_records_for_report()
        return ClinicalReportGenerator.generate_csv(records)

    def start_background_loop(self) -> None:
        """Starts real-time simulation thread at ~100 Hz."""
        if self._is_running:
            return
        self._is_running = True

        def _loop():
            target_dt = self.dt
            while self._is_running:
                t0 = time.perf_counter()
                self.step()
                elapsed = time.perf_counter() - t0
                sleep_time = target_dt - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

        self._sim_thread = threading.Thread(target=_loop, daemon=True)
        self._sim_thread.start()

    def stop_background_loop(self) -> None:
        self._is_running = False
        if self._sim_thread:
            self._sim_thread.join(timeout=1.0)
            self._sim_thread = None
