/**
 * MoveAssist 2D Biomechanical Kinematics & Actuator Engineering Schematic
 * SIH 2026 | PS SIH26113 | Team: BERSERK TECHIES | Team ID: TEAM-147
 * 
 * High-precision CAD / orthographic biomechanical canvas visualization
 * synchronized at 60 Hz in lockstep with the 3D Digital Twin and closed-loop telemetry.
 */

// Canvas roundRect polyfill for full browser compatibility
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
    if (!radii) radii = 0;
    const r = Array.isArray(radii) ? radii[0] : (typeof radii === 'number' ? radii : 0);
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
    return this;
  };
}

class MoveAssist2DSchematic {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    // Bilateral Joint Kinematics (100% frame-synchronized with 3D Digital Twin)
    this.right_knee_deg = 0.0;
    this.right_thigh_deg = 0.0;
    this.right_ankle_deg = 0.0;

    this.left_knee_deg = 0.0;
    this.left_thigh_deg = 0.0;
    this.left_ankle_deg = 0.0;

    this.thigh_pitch_deg = 0.0;
    this.shank_pitch_deg = 0.0;
    this.omega_knee_deg_s = 0.0;

    // Torques & Dynamics
    this.tau_cmd_nm = 0.0;
    this.tau_req_nm = 0.0;
    this.tau_user_nm = 0.0;

    // Ground forces & sensors
    this.vgrf_n = 0.0;
    this.fsr_heel = 0.0;
    this.fsr_meta = 0.0;
    this.fsr_toe = 0.0;
    this.emg_env = 0.05;

    // Gait FSM
    this.gait_phase = "STANCE";
    this.gait_pct = 0.0;

    // Safety supervisor
    this.soft_stop_active = false;
    this.soft_stop_rem_s = 0.0;
    this.soft_stop_seriousness = "NORMAL";
    this.safety_mode = "NORMAL_AAN";
    this.kin_mode = "WALK";

    // Layout metrics
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;

    this.onResize();
    window.addEventListener('resize', () => this.onResize());

    // 60 Hz Render loop
    this.render();
  }

  onResize() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width || 400;
    this.height = rect.height || 480;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /**
   * Winter's Clinical Human Locomotion Biomechanics
   * Exactly matches MoveAssist3DViewer.calculateGaitAngles for perfect 2D/3D lockstep.
   */
  calculateGaitAngles(p, isRun = false) {
    p = ((p % 100) + 100) % 100;
    let thighDeg = 0;
    let kneeDeg = 0;
    let ankleDeg = 0;

    if (isRun) {
      // Physiological running profile
      thighDeg = 5.0 + 24.0 * Math.cos(2.0 * Math.PI * (p / 100.0));

      if (p < 20.0) {
        const sub = p / 20.0;
        kneeDeg = 12.0 + 16.0 * Math.sin(sub * (Math.PI / 2.0));
      } else if (p < 38.0) {
        const sub = (p - 20.0) / 18.0;
        kneeDeg = 28.0 - 18.0 * sub;
      } else if (p < 68.0) {
        const sub = (p - 38.0) / 30.0;
        kneeDeg = 10.0 + 58.0 * Math.sin(sub * (Math.PI / 2.0));
      } else {
        const sub = (p - 68.0) / 32.0;
        const blend = 0.5 * (1.0 + Math.cos(sub * Math.PI));
        kneeDeg = 12.0 + 56.0 * blend;
      }

      if (p < 38.0) {
        const sub = p / 38.0;
        ankleDeg = -6.0 - 16.0 * sub;
      } else {
        const sub = (p - 38.0) / 62.0;
        ankleDeg = -22.0 + 30.0 * Math.sin(sub * (Math.PI / 2.0));
      }
    } else {
      // Winter's Clinical Human Walking Biomechanics
      // 1. Hip/Thigh flexion: Peaks in forward flexion (+24.5°) at heel strike (p=0%), extends to -11.5° at toe-off (p=50%)
      thighDeg = 4.0 + 18.0 * Math.cos(2.0 * Math.PI * (p / 100.0)) + 2.5 * Math.cos(4.0 * Math.PI * (p / 100.0));

      // 2. Knee flexion: Double wave
      // - Stance shock absorption: 4° -> 16° (p=0..15%) -> 4° (p=15..40%)
      // - Terminal push-off into swing: 4° -> 32° (p=40..60%) -> peak clearance 58° (p=60..73%)
      // - Terminal swing forward reach: Knee rapidly extends forward 58° -> 4° (p=73..100%) so foot lands heel-first
      if (p < 15.0) {
        const sub = p / 15.0;
        kneeDeg = 4.0 + 12.0 * Math.sin(sub * (Math.PI / 2.0));
      } else if (p < 40.0) {
        const sub = (p - 15.0) / 25.0;
        kneeDeg = 16.0 - 12.0 * sub;
      } else if (p < 60.0) {
        const sub = (p - 40.0) / 20.0;
        kneeDeg = 4.0 + 28.0 * Math.sin(sub * (Math.PI / 2.0));
      } else if (p < 73.0) {
        const sub = (p - 60.0) / 13.0;
        kneeDeg = 32.0 + 26.0 * Math.sin(sub * (Math.PI / 2.0));
      } else {
        const sub = (p - 73.0) / 27.0;
        const blend = 0.5 * (1.0 + Math.cos(sub * Math.PI));
        kneeDeg = 4.0 + 54.0 * blend;
      }

      // 3. Ankle dorsiflexion / plantarflexion:
      // - Heel strike (+6° dorsiflexed), foot flat (-2°), midstance (+8°), push-off (-16° plantarflexed), swing clearance (+6°)
      if (p < 10.0) {
        const sub = p / 10.0;
        ankleDeg = 6.0 - 8.0 * sub;
      } else if (p < 40.0) {
        const sub = (p - 10.0) / 30.0;
        ankleDeg = -2.0 + 10.0 * sub;
      } else if (p < 55.0) {
        const sub = (p - 40.0) / 15.0;
        const blend = 0.5 * (1.0 - Math.cos(sub * Math.PI));
        ankleDeg = 8.0 - 24.0 * blend;
      } else if (p < 75.0) {
        const sub = (p - 55.0) / 20.0;
        const blend = 0.5 * (1.0 - Math.cos(sub * Math.PI));
        ankleDeg = -16.0 + 22.0 * blend;
      } else {
        ankleDeg = 6.0;
      }
    }

    // Strict physiological range of motion clamping (0° full extension to 120° deep flexion)
    kneeDeg = Math.max(0.0, Math.min(120.0, kneeDeg));

    return {
      thighDeg,
      kneeDeg,
      ankleDeg,
      thighRad: (thighDeg * Math.PI) / 180.0,
      kneeRad: (kneeDeg * Math.PI) / 180.0,
      ankleRad: (ankleDeg * Math.PI) / 180.0
    };
  }

  /**
   * Calculates natural foot ground orientation angle (relative to horizontal floor).
   * Prevents abnormal hyperextension/over-stretching of the toes during swing.
   */
  computeFootWorldAngleDeg(p, isRun = false) {
    p = ((p % 100) + 100) % 100;
    if (isRun) {
      if (p < 18.0) {
        // Stance initial contact & foot-flat: planted flat on platform
        return 0.0;
      } else if (p < 38.0) {
        // Push-off: heel lifts, rolls onto ball of foot (plantarflexion up to +18°)
        const sub = (p - 18.0) / 20.0;
        return 18.0 * Math.sin(sub * (Math.PI / 2.0));
      } else if (p < 68.0) {
        // Flight / swing limb clearance: foot leveled parallel to floor (-4°)
        const sub = (p - 38.0) / 30.0;
        const blend = 0.5 * (1.0 - Math.cos(sub * Math.PI));
        return 18.0 * (1.0 - blend) - 4.0 * blend;
      } else {
        // Terminal swing: foot oriented level to land flat on platform
        return -4.0;
      }
    } else {
      if (p < 10.0) {
        // Heel strike landing: toes descend from -8° to flat (0°)
        const sub = p / 10.0;
        return -8.0 * (1.0 - sub);
      } else if (p < 40.0) {
        // Foot flat / midstance: strictly 0° level with floor
        return 0.0;
      } else if (p < 55.0) {
        // Terminal stance push-off: heel lifts, foot rotates up onto toes (+18°)
        const sub = (p - 40.0) / 15.0;
        const blend = 0.5 * (1.0 - Math.cos(sub * Math.PI));
        return 18.0 * blend;
      } else if (p < 72.0) {
        // Toe-off into initial swing: smoothly transitions from +18° to -5° for level ground clearance
        const sub = (p - 55.0) / 17.0;
        const blend = 0.5 * (1.0 - Math.cos(sub * Math.PI));
        return 18.0 * (1.0 - blend) - 5.0 * blend;
      } else if (p < 90.0) {
        // Mid-swing clearance: held stable at -5° (level with ground, zero over-stretching!)
        return -5.0;
      } else {
        // Terminal swing: prepares for heel strike, smooth descent from -5° to -8°
        const sub = (p - 90.0) / 10.0;
        return -5.0 - 3.0 * sub;
      }
    }
  }

  update(telemetry) {
    if (!telemetry) return;

    // Kinematics mode & telemetry speed
    const kin = telemetry.kinematics || {};
    this.kin_mode = (kin.mode || 'WALK').toUpperCase().replace('-', '_');
    this.omega_knee_deg_s = kin.knee_velocity_deg_s || 0.0;

    // Torques
    const torques = telemetry.torques || {};
    this.tau_req_nm = torques.required_nm || 0.0;
    this.tau_user_nm = torques.user_estimated_nm || 0.0;
    this.tau_cmd_nm = torques.commanded_nm ?? torques.actuator_cmd_nm ?? 0.0;

    // Sensors
    const sensors = telemetry.sensors || {};
    const fsr = sensors.foot_pressure || {};
    this.fsr_heel = fsr.heel_n || 0.0;
    this.fsr_meta = fsr.metatarsal_n || 0.0;
    this.fsr_toe = fsr.toe_n || 0.0;
    this.vgrf_n = fsr.total_grf_n || 0.0;
    this.emg_env = sensors.emg?.envelope_norm || 0.05;

    // Gait FSM from simulation loop
    this.gait_phase = telemetry.gait?.phase || (fsr.is_stance ? "STANCE" : "SWING");
    this.gait_pct = telemetry.gait?.cycle_percent ?? 0.0;

    // Safety & Soft Stop
    const safety = telemetry.safety || {};
    this.safety_mode = safety.mode || "NORMAL_AAN";
    const css = safety.controlled_soft_stop || {};
    this.soft_stop_active = !!css.active;
    this.soft_stop_rem_s = css.remaining_s || 0.0;
    this.soft_stop_seriousness = css.fall_seriousness || safety.fall_seriousness || "NORMAL";

    // Synchronize Joint Kinematics directly with 3D model equations (ZERO LAG)
    if (this.kin_mode === 'SIT_STAND') {
      const kneeDeg = kin.knee_angle_deg || 0.0;
      const thighDeg = kin.thigh_angle_deg || 0.0;
      const ankleDeg = -(kneeDeg - thighDeg); // Dynamically maintains foot 100% flat on floor

      this.right_knee_deg = kneeDeg;
      this.right_thigh_deg = thighDeg;
      this.right_ankle_deg = ankleDeg;
      this.right_foot_angle_deg = 0.0;

      this.left_knee_deg = kneeDeg;
      this.left_thigh_deg = thighDeg;
      this.left_ankle_deg = ankleDeg;
      this.left_foot_angle_deg = 0.0;
    } else if (this.kin_mode === 'STANDBY') {
      this.right_knee_deg = 10.0;
      this.right_thigh_deg = 0.0;
      this.right_ankle_deg = -5.0;
      this.right_foot_angle_deg = 0.0;

      this.left_knee_deg = 10.0;
      this.left_thigh_deg = 0.0;
      this.left_ankle_deg = -5.0;
      this.left_foot_angle_deg = 0.0;
    } else if (this.kin_mode === 'MANUAL_JOG') {
      const jogKnee = kin.jog_angle_deg ?? kin.knee_angle_deg ?? 0.0;
      const jogThigh = Math.min(22.0, jogKnee * 0.20);
      const jogAnkle = (jogThigh - jogKnee) * 0.5;

      this.right_knee_deg = jogKnee;
      this.right_thigh_deg = jogThigh;
      this.right_ankle_deg = jogAnkle;
      this.right_foot_angle_deg = Math.max(-10.0, Math.min(15.0, (jogThigh - jogKnee) * 0.4));

      this.left_knee_deg = 8.0;
      this.left_thigh_deg = 0.0;
      this.left_ankle_deg = -4.0;
      this.left_foot_angle_deg = 0.0;
    } else {
      // WALK / RUN: Alternating Bipedal Locomotion
      const isRun = this.kin_mode === 'RUN';
      const rightAngles = this.calculateGaitAngles(this.gait_pct, isRun);
      const leftAngles = this.calculateGaitAngles((this.gait_pct + 50.0) % 100.0, isRun);

      this.right_knee_deg = Math.max(0.0, Math.min(120.0, rightAngles.kneeDeg));
      this.right_thigh_deg = rightAngles.thighDeg;
      this.right_ankle_deg = rightAngles.ankleDeg;
      this.right_foot_angle_deg = this.computeFootWorldAngleDeg(this.gait_pct, isRun);

      this.left_knee_deg = Math.max(0.0, Math.min(120.0, leftAngles.kneeDeg));
      this.left_thigh_deg = leftAngles.thighDeg;
      this.left_ankle_deg = leftAngles.ankleDeg;
      this.left_foot_angle_deg = this.computeFootWorldAngleDeg((this.gait_pct + 50.0) % 100.0, isRun);
    }

    this.thigh_pitch_deg = sensors.imu_thigh?.pitch_deg || this.right_thigh_deg;
    this.shank_pitch_deg = sensors.imu_shank?.pitch_deg || (this.right_thigh_deg - this.right_knee_deg);
  }

  render() {
    requestAnimationFrame(() => this.render());

    if (!this.ctx || this.width === 0 || this.height === 0) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Blueprint Background & Grid
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Dark technical gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#070b14');
    bgGrad.addColorStop(1, '#0d1527');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Technical grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(30, 41, 69, 0.45)';
    const gridSize = 25;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Header Title Strip
    ctx.fillStyle = 'rgba(14, 23, 42, 0.85)';
    ctx.fillRect(0, 0, w, 28);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(w, 28);
    ctx.stroke();

    ctx.font = '600 9px "SF Pro", Inter, -apple-system, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('2D SAGITTAL KINEMATIC & ACTUATOR ENGINEERING SCHEMATIC', 12, 18);

    ctx.font = '500 8px monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText('SCALE: 1:4 • ISO 13482 COMPLIANT', w - 12, 18);
    ctx.textAlign = 'left';

    // 2. Kinematic Chain Setup (Sagittal Plane)
    // Synchronized in real time with 3D model, zero LERP delay
    const scale = Math.min(w / 380, h / 460);
    const groundY = h - 35;
    const thighLen = 120 * scale;
    const shankLen = 120 * scale;
    const footLen = 55 * scale;
    const footHeight = 12 * scale;

    let hipX = w * 0.44;
    let hipY = 88 * scale;

    // Radians for Right Leg (Instrumented Forefront)
    const rightThighRad = (this.right_thigh_deg * Math.PI) / 180.0;
    const rightKneeRad = (this.right_knee_deg * Math.PI) / 180.0;
    const rightShankRad = rightThighRad - rightKneeRad;
    const rightAnkleRad = (this.right_ankle_deg * Math.PI) / 180.0;
    // World orientation angle of footplate relative to floor (prevents toe over-stretching)
    const rightFootAngleRad = (this.right_foot_angle_deg * Math.PI) / 180.0;

    // Radians for Left Leg (Contralateral Background)
    const leftThighRad = (this.left_thigh_deg * Math.PI) / 180.0;
    const leftKneeRad = (this.left_knee_deg * Math.PI) / 180.0;
    const leftShankRad = leftThighRad - leftKneeRad;
    const leftAnkleRad = (this.left_ankle_deg * Math.PI) / 180.0;
    const leftFootAngleRad = (this.left_foot_angle_deg * Math.PI) / 180.0;

    if (this.kin_mode === 'SIT_STAND') {
      // Forward Kinematics so feet NEVER penetrate or float off the floor
      const legHeight = thighLen * Math.cos(rightThighRad) + shankLen * Math.cos(rightShankRad);
      hipY = groundY - footHeight - legHeight;

      const sitRatio = Math.min(1.0, Math.max(0.0, this.right_knee_deg / 85.0));
      hipX -= sitRatio * (22 * scale);
    } else {
      // Pelvis natural sinusoidal vertical bounce & lateral weight shift matching 3D
      const bounce = -Math.cos((this.gait_pct / 100.0) * Math.PI * 4.0) * (14.0 * scale);
      const sway = Math.sin((this.gait_pct / 100.0) * Math.PI * 2.0) * (10.0 * scale);
      hipY = 88 * scale + bounce;
      hipX = w * 0.44 + sway;
    }

    // Joint Centers for Right Leg
    const rightKneeX = hipX + thighLen * Math.sin(rightThighRad);
    const rightKneeY = hipY + thighLen * Math.cos(rightThighRad);

    const rightAnkleX = rightKneeX + shankLen * Math.sin(rightShankRad);
    const rightAnkleY = rightKneeY + shankLen * Math.cos(rightShankRad);

    // Joint Centers for Left Leg
    const leftKneeX = hipX + thighLen * Math.sin(leftThighRad);
    const leftKneeY = hipY + thighLen * Math.cos(leftThighRad);

    const leftAnkleX = leftKneeX + shankLen * Math.sin(leftShankRad);
    const leftAnkleY = leftKneeY + shankLen * Math.cos(leftShankRad);

    // 3. Draw Vertical Reference Plumb Line & Hip Arc
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY - 20);
    ctx.lineTo(hipX, groundY);
    ctx.stroke();

    // Hip Angle Arc
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const hipArcR = 28 * scale;
    const startAng = Math.PI / 2;
    const endAng = startAng - rightThighRad;
    ctx.arc(hipX, hipY, hipArcR, Math.min(startAng, endAng), Math.max(startAng, endAng));
    ctx.stroke();
    ctx.restore();

    // 4. Ground Contact Plane & Shadow
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(15, groundY);
    ctx.lineTo(w - 15, groundY);
    ctx.stroke();

    // Ground hatch lines
    ctx.strokeStyle = 'rgba(30, 41, 69, 0.6)';
    ctx.lineWidth = 1;
    for (let gx = 20; gx < w - 20; gx += 12) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.lineTo(gx - 8, groundY + 8);
      ctx.stroke();
    }

    // Rehab Chair Silhouette (Rendered in SIT_STAND mode matching 3D)
    if (this.kin_mode === 'SIT_STAND') {
      const chairSeatY = groundY - footHeight - (120 * Math.cos(85 * Math.PI / 180) + 120 * Math.cos(-5 * Math.PI / 180)) * scale + (12 * scale);
      const chairSeatX = w * 0.44 - (22 * scale);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // Backrest
      ctx.moveTo(chairSeatX - 35 * scale, chairSeatY - 70 * scale);
      ctx.lineTo(chairSeatX - 25 * scale, chairSeatY);
      // Seat Cushion
      ctx.lineTo(chairSeatX + 22 * scale, chairSeatY);
      ctx.stroke();

      // Chair Legs
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(chairSeatX - 25 * scale, chairSeatY);
      ctx.lineTo(chairSeatX - 25 * scale, groundY);
      ctx.moveTo(chairSeatX + 18 * scale, chairSeatY);
      ctx.lineTo(chairSeatX + 18 * scale, groundY);
      ctx.stroke();

      // Chair Label
      ctx.font = '500 7px monospace';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.fillText('REHAB CHAIR (45cm)', chairSeatX - 30 * scale, chairSeatY - 74 * scale);
    }
    ctx.restore();

    // =========================================================================
    // 5. Contralateral (Left) Leg - Background Sagittal View
    // Synchronized 180° out-of-phase with Right Leg in alternating bipedal motion
    // =========================================================================
    ctx.save();
    // Muted bone outline
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
    ctx.lineWidth = 8 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(leftKneeX, leftKneeY);
    ctx.lineTo(leftAnkleX, leftAnkleY);
    ctx.stroke();

    // Muted mechanical linkage
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
    ctx.lineWidth = 2 * scale;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(hipX - 3, hipY + 8);
    ctx.lineTo(leftKneeX - 3, leftKneeY);
    ctx.lineTo(leftAnkleX - 3, leftAnkleY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Left Knee joint pivot
    ctx.fillStyle = '#070f1e';
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(leftKneeX, leftKneeY, 8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Left Footplate rotated along leftFootAngleRad
    ctx.save();
    ctx.translate(leftAnkleX, leftAnkleY);
    ctx.rotate(leftFootAngleRad);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-18 * scale, 3 * scale, 64 * scale, 5 * scale, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // =========================================================================
    // 6. Biological Muscle Action Lines (Biolink overlay on Right Leg)
    // =========================================================================
    ctx.save();
    const emgAlpha = Math.min(1.0, 0.25 + this.emg_env * 1.5);
    const activeMuscleColor = this.soft_stop_active
      ? `rgba(251, 191, 36, ${emgAlpha})`
      : `rgba(244, 63, 94, ${emgAlpha})`;

    // Anterior: Quadriceps / Patellar Tendon line
    ctx.strokeStyle = activeMuscleColor;
    ctx.lineWidth = 2.5 + this.emg_env * 3.5;
    ctx.beginPath();
    ctx.moveTo(hipX + 12 * Math.cos(rightThighRad), hipY + 12 * Math.sin(rightThighRad));
    // Over anterior knee
    const patellaX = rightKneeX + 16 * Math.cos(rightThighRad - Math.PI / 2);
    const patellaY = rightKneeY + 16 * Math.sin(rightThighRad - Math.PI / 2);
    ctx.lineTo(patellaX, patellaY);
    ctx.lineTo(rightKneeX + 22 * Math.sin(rightShankRad), rightKneeY + 30 * Math.cos(rightShankRad));
    ctx.stroke();

    // Posterior: Hamstrings tendon line
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hipX - 10 * Math.cos(rightThighRad), hipY - 10 * Math.sin(rightThighRad));
    ctx.lineTo(rightKneeX - 14 * Math.cos(rightThighRad - Math.PI / 2), rightKneeY - 14 * Math.sin(rightThighRad - Math.PI / 2));
    ctx.lineTo(rightKneeX - 12 * Math.sin(rightShankRad), rightKneeY + 30 * Math.cos(rightShankRad));
    ctx.stroke();
    ctx.restore();

    // 7. Biological Bone Outlines (Right Femur & Tibia)
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
    ctx.lineWidth = 10 * scale;
    ctx.lineCap = 'round';
    // Femur
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(rightKneeX, rightKneeY);
    ctx.stroke();
    // Tibia
    ctx.beginPath();
    ctx.moveTo(rightKneeX, rightKneeY);
    ctx.lineTo(rightAnkleX, rightAnkleY);
    ctx.stroke();
    ctx.restore();

    // 8. Exoskeleton Mechanical Linkages (CAD Style on Right Leg)
    ctx.save();
    // Thigh Cuff & Robotic Strut
    ctx.lineWidth = 6 * scale;
    ctx.strokeStyle = '#1e293b';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX + 4, hipY + 10);
    ctx.lineTo(rightKneeX + 4, rightKneeY);
    ctx.stroke();

    // Thigh Titanium Linkage Accent
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(hipX + 4, hipY + 10);
    ctx.lineTo(rightKneeX + 4, rightKneeY);
    ctx.stroke();

    // Shank Brace & Telescopic Strut
    ctx.lineWidth = 6 * scale;
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(rightKneeX + 3, rightKneeY);
    ctx.lineTo(rightAnkleX + 3, rightAnkleY);
    ctx.stroke();

    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(rightKneeX + 3, rightKneeY);
    ctx.lineTo(rightAnkleX + 3, rightAnkleY);
    ctx.stroke();

    // Telescopic graduation ticks on shank
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    for (let t = 0.25; t <= 0.75; t += 0.1) {
      const tx = rightKneeX + (rightAnkleX - rightKneeX) * t;
      const ty = rightKneeY + (rightAnkleY - rightKneeY) * t;
      const perpX = Math.cos(rightShankRad);
      const perpY = -Math.sin(rightShankRad);
      ctx.beginPath();
      ctx.moveTo(tx - 3 * perpX, ty - 3 * perpY);
      ctx.lineTo(tx + 3 * perpX, ty + 3 * perpY);
      ctx.stroke();
    }
    ctx.restore();

    // 9. Pelvis & Hip Pivot Assembly
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hipX, hipY, 11 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(hipX, hipY, 4 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Pelvic Crest Bracket
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hipX - 18 * scale, hipY - 16 * scale);
    ctx.lineTo(hipX + 16 * scale, hipY - 16 * scale);
    ctx.lineTo(hipX, hipY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 10. ROTATING FOOTPLATE & ANKLE JOINT (Articulated with live ankle angle)
    ctx.save();
    // Rotate entire foot assembly around ankle pivot
    ctx.save();
    ctx.translate(rightAnkleX, rightAnkleY);
    ctx.rotate(rightFootAngleRad);

    // Carbon Footplate
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-20 * scale, 4 * scale, 68 * scale, 7 * scale, [2, 4, 4, 2]);
    ctx.fill();
    ctx.stroke();

    // Ankle Pivot Core
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    ctx.restore();

    // 11. Dynamic Ground Reaction Force (vGRF) Vectors & FSR Markers
    ctx.save();
    const isStance = this.kin_mode === 'SIT_STAND' || this.kin_mode === 'STANDBY' || (this.gait_pct < 55.0);
    const maxGrfH = 45 * scale;
    const cosFoot = Math.cos(rightFootAngleRad);
    const sinFoot = Math.sin(rightFootAngleRad);

    const heelSensorX = rightAnkleX + (-14 * scale) * cosFoot - (11 * scale) * sinFoot;
    const heelSensorY = rightAnkleY + (-14 * scale) * sinFoot + (11 * scale) * cosFoot;

    const metaSensorX = rightAnkleX + (16 * scale) * cosFoot - (11 * scale) * sinFoot;
    const metaSensorY = rightAnkleY + (16 * scale) * sinFoot + (11 * scale) * cosFoot;

    const toeSensorX = rightAnkleX + (42 * scale) * cosFoot - (11 * scale) * sinFoot;
    const toeSensorY = rightAnkleY + (42 * scale) * sinFoot + (11 * scale) * cosFoot;

    const drawGrfVector = (x, y, forceN, label, color) => {
      if (!isStance) return;
      const arrowH = Math.min(maxGrfH, (forceN / 400.0) * maxGrfH);
      if (arrowH > 3) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        // Vertical arrow pointing upwards
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - arrowH);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(x, y - arrowH - 3);
        ctx.lineTo(x - 3, y - arrowH + 2);
        ctx.lineTo(x + 3, y - arrowH + 2);
        ctx.closePath();
        ctx.fill();

        ctx.font = '600 7px monospace';
        ctx.fillText(`${Math.round(forceN)}N`, x - 8, y - arrowH - 6);
      }
      // FSR sensor dot on plate
      ctx.fillStyle = forceN > 15 ? color : '#334155';
      ctx.beginPath();
      ctx.arc(x, y, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    };

    drawGrfVector(heelSensorX, heelSensorY, this.fsr_heel, 'HEEL', '#10b981');
    drawGrfVector(metaSensorX, metaSensorY, this.fsr_meta, 'META', '#06b6d4');
    drawGrfVector(toeSensorX, toeSensorY, this.fsr_toe, 'TOE', '#38bdf8');
    ctx.restore();

    // 12. Center of Mass (COM) Crosshairs
    ctx.save();
    const drawComCrosshair = (x, y) => {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 4 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 5 * scale, y);
      ctx.lineTo(x + 5 * scale, y);
      ctx.moveTo(x, y - 5 * scale);
      ctx.lineTo(x, y + 5 * scale);
      ctx.stroke();
    };

    const comThighX = hipX + (rightKneeX - hipX) * 0.433;
    const comThighY = hipY + (rightKneeY - hipY) * 0.433;
    drawComCrosshair(comThighX, comThighY);

    const comShankX = rightKneeX + (rightAnkleX - rightKneeX) * 0.433;
    const comShankY = rightKneeY + (rightAnkleY - rightKneeY) * 0.433;
    drawComCrosshair(comShankX, comShankY);
    ctx.restore();

    // 13. ROTARY KNEE ACTUATOR (Detailed Engineering Module)
    ctx.save();
    const actR = 22 * scale;

    // Outer Gear Rim / Housing
    ctx.fillStyle = '#0b1329';
    ctx.strokeStyle = this.soft_stop_active ? '#fbbf24' : '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rightKneeX, rightKneeY, actR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Actuator Radial Bolt Circle (8 micro-dots)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 8; i++) {
      const bAng = (i * Math.PI) / 4;
      const bx = rightKneeX + (actR - 3.5) * Math.cos(bAng);
      const by = rightKneeY + (actR - 3.5) * Math.sin(bAng);
      ctx.beginPath();
      ctx.arc(bx, by, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stator Teeth & Encoder Ring
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rightKneeX, rightKneeY, actR - 7 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Knee Physiological ROM Sector (0 to 120 deg strict anatomical limit, zero recurvatum)
    const refExtAng = rightThighRad + Math.PI / 2;
    const maxFlexAng = refExtAng - (120 * Math.PI) / 180.0;

    // Shaded Safe ROM Sector
    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.beginPath();
    ctx.moveTo(rightKneeX, rightKneeY);
    ctx.arc(rightKneeX, rightKneeY, actR + 12 * scale, maxFlexAng, refExtAng);
    ctx.closePath();
    ctx.fill();

    // Active Flexion Wedge
    const curFlexAng = refExtAng - (this.right_knee_deg * Math.PI) / 180.0;
    ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.beginPath();
    ctx.moveTo(rightKneeX, rightKneeY);
    ctx.arc(rightKneeX, rightKneeY, actR + 12 * scale, curFlexAng, refExtAng);
    ctx.closePath();
    ctx.fill();

    // Active Wedge Outline Arc
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(rightKneeX, rightKneeY, actR + 12 * scale, curFlexAng, refExtAng);
    ctx.stroke();

    // Actuator Center Core & Shaft
    ctx.fillStyle = this.soft_stop_active ? '#fbbf24' : '#0284c7';
    ctx.beginPath();
    ctx.arc(rightKneeX, rightKneeY, 5 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Actuator Dynamic Torque Vector (Curved Rotational Arrow)
    const tauMag = Math.abs(this.tau_cmd_nm);
    if (tauMag > 0.3) {
      const torqueDir = this.tau_cmd_nm >= 0 ? 1 : -1; // +1 Extension, -1 Flexion
      const torqueColor = this.soft_stop_active ? '#fbbf24' : (torqueDir > 0 ? '#10b981' : '#a855f7');
      const arrowRadius = actR + 18 * scale;
      const sweepAng = Math.min(Math.PI * 0.75, 0.2 + (tauMag / 35.0) * Math.PI * 0.75);

      ctx.strokeStyle = torqueColor;
      ctx.lineWidth = Math.min(4, 1.5 + (tauMag / 35.0) * 2.5);
      ctx.beginPath();
      if (torqueDir > 0) {
        ctx.arc(rightKneeX, rightKneeY, arrowRadius, -Math.PI / 2, -Math.PI / 2 + sweepAng, false);
      } else {
        ctx.arc(rightKneeX, rightKneeY, arrowRadius, -Math.PI / 2, -Math.PI / 2 - sweepAng, true);
      }
      ctx.stroke();
    }
    ctx.restore();

    // =========================================================================
    // 14. ENGINEERING CALLOUT CHANNELS & LEADER LINES (Direct Telemetry Sync)
    // =========================================================================
    ctx.save();
    const leftW = Math.min(125, Math.max(95, w * 0.26));
    const rightW = Math.min(155, Math.max(120, w * 0.32));
    const rightX = w - rightW - 10;

    const drawCallout = (x, y, width, height, title, rows, targetX, targetY, isLeft) => {
      // Background box
      ctx.fillStyle = 'rgba(11, 19, 36, 0.92)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 4);
      ctx.fill();
      ctx.stroke();

      // Header bar
      ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
      ctx.fillRect(x, y, width, 14);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.beginPath();
      ctx.moveTo(x, y + 14);
      ctx.lineTo(x + width, y + 14);
      ctx.stroke();

      // Title
      ctx.font = '700 7.5px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(title, x + 5, y + 10);

      // Rows
      let rowY = y + 23;
      rows.forEach(r => {
        ctx.font = r.bold ? '700 7.5px monospace' : '500 7px monospace';
        ctx.fillStyle = r.color || '#94a3b8';
        ctx.fillText(r.text, x + 5, rowY);
        rowY += 10;
      });

      // Leader line
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();

      const startX = isLeft ? (x + width) : x;
      const startY = y + height * 0.5;
      const elbowX = isLeft ? (startX + 10) : (startX - 10);

      ctx.moveTo(startX, startY);
      ctx.lineTo(elbowX, startY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Anchor dot
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(targetX, targetY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };

    // Callout 1 (Top Left): Hip / Pelvis
    drawCallout(10, 34, leftW, 36, 'HIP / PELVIS', [
      { text: `θ_hip: ${(this.right_thigh_deg || 0).toFixed(1)}°`, color: '#38bdf8', bold: true },
      { text: `Phase: ${this.gait_pct.toFixed(0)}%`, color: '#64748b' }
    ], hipX, hipY, true);

    // Callout 2 (Mid-Upper Left): Thigh
    drawCallout(10, 78, leftW, 46, 'THIGH SEGMENT', [
      { text: 'COM: 4.4kg (43%)', color: '#fbbf24' },
      { text: `IMU: ${(this.thigh_pitch_deg || 0).toFixed(1)}° pitch`, color: '#38bdf8' },
      { text: 'Femur 42cm', color: '#64748b' }
    ], comThighX, comThighY, true);

    // Callout 3 (Mid-Lower Left): Shank
    drawCallout(10, 132, leftW, 46, 'SHANK SEGMENT', [
      { text: 'COM: 3.3kg (43%)', color: '#fbbf24' },
      { text: `IMU: ${(this.shank_pitch_deg || 0).toFixed(1)}° pitch`, color: '#38bdf8' },
      { text: 'Tibia 42cm', color: '#64748b' }
    ], comShankX, comShankY, true);

    // Callout 4 (Bottom Left): Dynamic Ankle & Footplate
    const pitchVal = (this.right_foot_angle_deg || 0).toFixed(1);
    const pitchSign = (this.right_foot_angle_deg || 0) >= 0 ? '+' : '';
    const ankleState = (this.kin_mode === 'SIT_STAND' || this.kin_mode === 'STANDBY')
      ? 'Level Grounded Stance'
      : (this.gait_pct >= 55.0 ? 'Level Swing Clearance' : (this.right_foot_angle_deg < -2.0 ? 'Heel Strike Landing' : (this.right_foot_angle_deg > 3.0 ? 'Toe Push-Off' : 'Foot Flat Stance')));

    drawCallout(10, 186, leftW, 36, 'ANKLE & FOOT', [
      { text: `Foot Pitch: ${pitchSign}${pitchVal}°`, color: '#38bdf8', bold: true },
      { text: ankleState, color: '#10b981' }
    ], rightAnkleX, rightAnkleY, true);

    // Callout 5 (Right Center): KNEE ACTUATOR & KINEMATICS (Exact 3D Twin Value)
    const kneeAngleSingleSource = (this.right_knee_deg || 0).toFixed(1);
    const torqueStr = `${(this.tau_cmd_nm || 0) >= 0 ? '+' : ''}${(this.tau_cmd_nm || 0).toFixed(1)} N·m`;
    const torqueColor = (this.tau_cmd_nm || 0) >= 0 ? '#10b981' : '#a855f7';

    drawCallout(rightX, 34, rightW, 76, 'KNEE ACTUATOR & JOINT', [
      { text: `Flexion: ${kneeAngleSingleSource}°`, color: '#38bdf8', bold: true },
      { text: `Velocity: ${(this.omega_knee_deg_s || 0).toFixed(1)}°/s`, color: '#94a3b8' },
      { text: `τ_exo: ${torqueStr}`, color: torqueColor, bold: true },
      { text: 'Encoder: 12-bit (0.088°)', color: '#06b6d4' },
      { text: 'Safe ROM: 0° - 120° (Strict Lock)', color: '#64748b' }
    ], rightKneeX, rightKneeY, false);

    // Callout 6 (Right Lower): sEMG Biological Drive
    drawCallout(rightX, 118, rightW, 46, 'BIOMECHANICAL DRIVE', [
      { text: `sEMG: ${(this.emg_env || 0).toFixed(2)} RMS`, color: '#10b981', bold: true },
      { text: 'Rectus Femoris', color: '#64748b' },
      { text: `Mode: ${this.kin_mode || 'WALK'}`, color: '#38bdf8' }
    ], patellaX, patellaY, false);

    // Anti-Fall Stance Lock Callout (if active)
    if (this.soft_stop_active) {
      drawCallout(rightX, 172, rightW, 36, 'ANTI-FALL LOCK', [
        { text: '+18.0 N·m STANCE HOLD', color: '#fbbf24', bold: true },
        { text: `${Math.round(this.soft_stop_rem_s)}s Decel Ramp`, color: '#fbbf24' }
      ], rightKneeX + 12 * scale, rightKneeY, false);
    }

    // Gait Status Pill at bottom right
    const pillX = w - 125;
    const pillY = h - 26;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, 115, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 7.5px monospace';
    ctx.fillStyle = this.gait_phase === 'SWING' ? '#a855f7' : '#10b981';
    ctx.fillText(`GAIT: ${this.gait_phase} (${this.gait_pct.toFixed(0)}%)`, pillX + 8, pillY + 12);
    ctx.restore();
    ctx.restore();
  }
}

window.MoveAssist2DSchematic = MoveAssist2DSchematic;
