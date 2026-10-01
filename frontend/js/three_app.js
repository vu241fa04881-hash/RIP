/**
 * MoveAssist 3D Virtual Human & Articulated Exoskeleton Digital Twin (Three.js)
 * SIH 2026 | PS SIH26113 | Team: BERSERK TECHIES | Team ID: TEAM-147
 * High-Fidelity Cyber-Medical Digital Twin with Unilateral Telemetry Precision
 */

class MoveAssist3DViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.width = this.container.clientWidth || 800;
    this.height = this.container.clientHeight || 480;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Component tracking
    this.humanGroup = null;
    this.exoGroup = null;
    this.sensorGroup = null;

    // Layer collections
    this.humanMeshes = [];
    this.exoMeshes = [];
    this.sensorMeshes = [];

    // Articulated joint references
    this.pelvis = null;
    this.torsoGroup = null;
    this.headMesh = null;

    // Right Leg (Instrumented side)
    this.rightHip = null;
    this.rightThigh = null;
    this.rightKnee = null;
    this.rightShank = null;
    this.rightAnkle = null;
    this.rightFoot = null;

    // Left Leg (Contralateral Grounded Stance Leg)
    this.leftHip = null;
    this.leftThigh = null;
    this.leftKnee = null;
    this.leftShank = null;
    this.leftAnkle = null;
    this.leftFoot = null;

    // Exoskeleton components
    this.waistHalo = null;
    this.actuatorCoreMesh = null;
    this.actuatorGlowLight = null;
    this.thighCuff = null;
    this.shankBrace = null;
    this.footPlate = null;
    this.torqueIndicatorGroup = null;
    this.torqueArcMat = null;
    this.torqueConeMat = null;

    // Virtual Sensors
    this.fsrHeelMesh = null;
    this.fsrMetaMesh = null;
    this.fsrToeMesh = null;
    this.emgPatchMesh = null;
    this.thighImuMesh = null;
    this.shankImuMesh = null;

    // Layer visibility
    this.showExo = true;
    this.showAnatomy = true;
    this.showSensors = true;

    // Custom 3D Model Pipeline (.GLB / .GLTF)
    this.customModel = null;
    this.customBones = {};
    this.hasCustomModel = false;
    this.customModelName = '';

    this.init();
  }

  init() {
    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070c18);
    this.scene.fog = new THREE.FogExp2(0x070c18, 0.05);

    // 2. Camera Setup (Elevated 3/4 Perspective matching reference image)
    this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 0.1, 50.0);
    this.camera.position.set(1.9, 1.35, 2.6);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.target.set(0, 0.88, 0);
      this.controls.maxPolarAngle = Math.PI / 2 + 0.05;
      this.controls.minDistance = 1.0;
      this.controls.maxDistance = 5.5;
    }

    // 5. Studio Lighting
    this.setupLighting();

    // 6. Clinical Platform & Concentric Radar Grid
    this.setupEnvironment();

    // 7. PBR Materials
    this.initMaterials();

    // 8. Build 3D Models
    this.buildVirtualHuman();
    this.buildExoskeleton();
    this.buildSensorMarkers();

    // 9. Custom GLTF Loading & Drag-and-Drop Pipeline
    this.setupGLTFPipeline();

    // Window resize
    window.addEventListener('resize', () => this.onResize());

    // Main render loop
    this.animate();
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0x0f172a, 1.0);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(3.2, 5.0, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const cyanRim = new THREE.DirectionalLight(0x00d2f0, 1.8);
    cyanRim.position.set(-3.2, 2.8, -2.4);
    this.scene.add(cyanRim);

    const fillLight = new THREE.PointLight(0x60a5fa, 0.6, 10);
    fillLight.position.set(0.5, 2.0, 2.8);
    this.scene.add(fillLight);

    const groundBounce = new THREE.PointLight(0x0284c7, 0.4, 6);
    groundBounce.position.set(0, 0.2, 0);
    this.scene.add(groundBounce);
  }

  setupEnvironment() {
    const floorGeo = new THREE.CircleGeometry(4.2, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x060a14,
      roughness: 0.55,
      metalness: 0.35
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.005;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(8, 20, 0x00b4d8, 0x132238);
    grid.position.y = 0.0;
    this.scene.add(grid);

    const ringRadii = [0.8, 1.6, 2.4, 3.2];
    ringRadii.forEach((r, idx) => {
      const ringGeo = new THREE.RingGeometry(r - 0.004, r + 0.004, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx === 1 ? 0x00e5ff : 0x0284c7,
        transparent: true,
        opacity: idx === 1 ? 0.65 : 0.35,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.001;
      this.scene.add(ringMesh);
    });
  }

  initMaterials() {
    // Sleek medical cyan mannequin aesthetic matching reference image
    this.skinMat = new THREE.MeshStandardMaterial({
      color: 0x8fe3f7,
      roughness: 0.32,
      metalness: 0.08
    });

    this.skinJointMat = new THREE.MeshStandardMaterial({
      color: 0x76d2e9,
      roughness: 0.36,
      metalness: 0.12
    });

    // Dark carbon/titanium structural frame
    this.exoFrameMat = new THREE.MeshStandardMaterial({
      color: 0x121722,
      roughness: 0.28,
      metalness: 0.88
    });

    this.exoMetalMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.20,
      metalness: 0.95
    });

    // Luminous electric cyan metallic rings
    this.exoCyanRingMat = new THREE.MeshStandardMaterial({
      color: 0x00d8f6,
      emissive: 0x0088aa,
      emissiveIntensity: 0.45,
      roughness: 0.15,
      metalness: 0.85
    });

    // Dynamic knee actuator core
    this.actuatorCoreMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.85,
      roughness: 0.22,
      metalness: 0.70
    });
  }

  registerHumanMesh(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.humanMeshes.push(mesh);
    return mesh;
  }

  registerExoMesh(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.exoMeshes.push(mesh);
    return mesh;
  }

  registerSensorMesh(mesh) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.sensorMeshes.push(mesh);
    return mesh;
  }

  buildVirtualHuman() {
    this.humanGroup = new THREE.Group();
    this.humanGroup.name = "Human_Anatomy";

    // 1. Pelvis Root Node (Hip center: y = 0.95m)
    this.pelvis = new THREE.Group();
    this.pelvis.position.set(0, 0.95, 0);

    // Anatomical Pelvic Saddle Block
    const pelvisGeo = new THREE.CylinderGeometry(0.125, 0.095, 0.15, 24);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.skinJointMat);
    pelvisMesh.position.y = 0.01;
    this.pelvis.add(this.registerHumanMesh(pelvisMesh));

    // Lateral Hip Sockets
    const hipSocketGeo = new THREE.SphereGeometry(0.052, 20, 20);
    const rightSocket = new THREE.Mesh(hipSocketGeo, this.skinJointMat);
    rightSocket.position.set(0.125, -0.03, 0);
    this.pelvis.add(this.registerHumanMesh(rightSocket));

    const leftSocket = new THREE.Mesh(hipSocketGeo, this.skinJointMat);
    leftSocket.position.set(-0.125, -0.03, 0);
    this.pelvis.add(this.registerHumanMesh(leftSocket));

    // 2. Torso & Head (Mannequin aesthetic from reference image)
    this.torsoGroup = new THREE.Group();

    // Abdomen / Lower Torso (tapered column)
    const lowerTorsoGeo = new THREE.CylinderGeometry(0.13, 0.115, 0.16, 24);
    const lowerTorso = new THREE.Mesh(lowerTorsoGeo, this.skinMat);
    lowerTorso.position.y = 0.15;
    this.torsoGroup.add(this.registerHumanMesh(lowerTorso));

    // Chest / Upper Torso (tapered trunk, widening gently to shoulders)
    const upperTorsoGeo = new THREE.CylinderGeometry(0.155, 0.13, 0.28, 28);
    const upperTorso = new THREE.Mesh(upperTorsoGeo, this.skinMat);
    upperTorso.position.y = 0.36;
    this.torsoGroup.add(this.registerHumanMesh(upperTorso));

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.045, 0.052, 0.08, 20);
    const neckMesh = new THREE.Mesh(neckGeo, this.skinJointMat);
    neckMesh.position.y = 0.53;
    this.torsoGroup.add(this.registerHumanMesh(neckMesh));

    // Head (Smooth spherical head from reference image)
    const headGeo = new THREE.SphereGeometry(0.115, 32, 32);
    this.headMesh = new THREE.Mesh(headGeo, this.skinMat);
    this.headMesh.position.y = 0.69;
    this.torsoGroup.add(this.registerHumanMesh(this.headMesh));

    this.pelvis.add(this.torsoGroup);

    // 3. Right Leg (Instrumented Exoskeleton Limb)
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.125, -0.04, 0);

    this.rightThigh = new THREE.Group();
    const thighGeo = new THREE.CylinderGeometry(0.062, 0.050, 0.42, 24);
    const rightThighMesh = new THREE.Mesh(thighGeo, this.skinMat);
    rightThighMesh.position.y = -0.21;
    this.rightThigh.add(this.registerHumanMesh(rightThighMesh));
    this.rightHip.add(this.rightThigh);

    this.rightKnee = new THREE.Group();
    this.rightKnee.position.set(0, -0.42, 0);
    const kneeJointMesh = new THREE.Mesh(new THREE.SphereGeometry(0.046, 24, 24), this.skinJointMat);
    this.rightKnee.add(this.registerHumanMesh(kneeJointMesh));
    this.rightThigh.add(this.rightKnee);

    this.rightShank = new THREE.Group();
    const shankGeo = new THREE.CylinderGeometry(0.048, 0.038, 0.42, 24);
    const rightShankMesh = new THREE.Mesh(shankGeo, this.skinMat);
    rightShankMesh.position.y = -0.21;
    this.rightShank.add(this.registerHumanMesh(rightShankMesh));
    this.rightKnee.add(this.rightShank);

    this.rightAnkle = new THREE.Group();
    this.rightAnkle.position.set(0, -0.42, 0);
    const rightAnkleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 20), this.skinJointMat);
    this.rightAnkle.add(this.registerHumanMesh(rightAnkleMesh));

    this.rightFoot = new THREE.Group();
    const footGeo = new THREE.BoxGeometry(0.082, 0.046, 0.22);
    const rightFootMesh = new THREE.Mesh(footGeo, this.skinJointMat);
    rightFootMesh.position.set(0, -0.024, 0.06);
    this.rightFoot.add(this.registerHumanMesh(rightFootMesh));
    this.rightAnkle.add(this.rightFoot);
    this.rightShank.add(this.rightAnkle);

    // 4. Left Leg (Contralateral Grounded Stance Leg)
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.125, -0.04, 0);

    this.leftThigh = new THREE.Group();
    const leftThighMesh = new THREE.Mesh(thighGeo, this.skinMat);
    leftThighMesh.position.y = -0.21;
    this.leftThigh.add(this.registerHumanMesh(leftThighMesh));
    this.leftHip.add(this.leftThigh);

    this.leftKnee = new THREE.Group();
    this.leftKnee.position.set(0, -0.42, 0);
    const leftKneeJointMesh = new THREE.Mesh(new THREE.SphereGeometry(0.046, 24, 24), this.skinJointMat);
    this.leftKnee.add(this.registerHumanMesh(leftKneeJointMesh));
    this.leftThigh.add(this.leftKnee);

    this.leftShank = new THREE.Group();
    const leftShankMesh = new THREE.Mesh(shankGeo, this.skinMat);
    leftShankMesh.position.y = -0.21;
    this.leftShank.add(this.registerHumanMesh(leftShankMesh));
    this.leftKnee.add(this.leftShank);

    this.leftAnkle = new THREE.Group();
    this.leftAnkle.position.set(0, -0.42, 0);
    const leftAnkleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 20), this.skinJointMat);
    this.leftAnkle.add(this.registerHumanMesh(leftAnkleMesh));

    this.leftFoot = new THREE.Group();
    const leftFootMesh = new THREE.Mesh(footGeo, this.skinJointMat);
    leftFootMesh.position.set(0, -0.024, 0.06);
    this.leftFoot.add(this.registerHumanMesh(leftFootMesh));
    this.leftAnkle.add(this.leftFoot);
    this.leftShank.add(this.leftAnkle);

    // Ground the left leg firmly into realistic upright stance
    this.leftHip.rotation.x = 0;
    this.leftKnee.rotation.x = THREE.MathUtils.degToRad(8.0);
    this.leftAnkle.rotation.x = -THREE.MathUtils.degToRad(8.0);

    this.pelvis.add(this.rightHip);
    this.pelvis.add(this.leftHip);
    this.humanGroup.add(this.pelvis);
    this.scene.add(this.humanGroup);
  }

  buildExoskeleton() {
    this.exoGroup = new THREE.Group();
    this.exoGroup.name = "Mechanical_Exoskeleton";

    // 1. Waist / Pelvic Harness ("Halo" Belt from reference image)
    this.waistHalo = new THREE.Group();
    this.waistHalo.position.set(0, 0.04, 0);

    const haloTorusGeo = new THREE.TorusGeometry(0.195, 0.016, 18, 48);
    const haloTorus = new THREE.Mesh(haloTorusGeo, this.exoCyanRingMat);
    haloTorus.rotation.x = Math.PI / 2;
    this.waistHalo.add(this.registerExoMesh(haloTorus));

    const lumbarGeo = new THREE.BoxGeometry(0.09, 0.18, 0.025);
    const lumbarMesh = new THREE.Mesh(lumbarGeo, this.exoFrameMat);
    lumbarMesh.position.set(0, 0.09, -0.19);
    this.waistHalo.add(this.registerExoMesh(lumbarMesh));

    const hipBracketGeo = new THREE.BoxGeometry(0.025, 0.08, 0.04);
    const rightHipBracket = new THREE.Mesh(hipBracketGeo, this.exoFrameMat);
    rightHipBracket.position.set(0.195, -0.02, 0);
    this.waistHalo.add(this.registerExoMesh(rightHipBracket));

    const leftHipBracket = new THREE.Mesh(hipBracketGeo, this.exoFrameMat);
    leftHipBracket.position.set(-0.195, -0.02, 0);
    this.waistHalo.add(this.registerExoMesh(leftHipBracket));

    this.pelvis.add(this.waistHalo);

    // 2. Right Leg Instrumented Exoskeleton
    // Lateral Thigh Strut
    this.thighCuff = new THREE.Group();
    const rightThighStrut = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.40, 0.032), this.exoFrameMat);
    rightThighStrut.position.set(0.088, -0.21, 0);
    this.thighCuff.add(this.registerExoMesh(rightThighStrut));

    // Upper Thigh Cyan Ring
    const upperCuff = new THREE.Mesh(new THREE.TorusGeometry(0.070, 0.009, 16, 36), this.exoCyanRingMat);
    upperCuff.rotation.x = Math.PI / 2;
    upperCuff.position.set(0, -0.09, 0);
    this.thighCuff.add(this.registerExoMesh(upperCuff));

    const upperClamp = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.022, 0.038), this.exoFrameMat);
    upperClamp.position.set(0.088, -0.09, 0);
    this.thighCuff.add(this.registerExoMesh(upperClamp));

    // Lower Thigh Cyan Ring
    const lowerCuff = new THREE.Mesh(new THREE.TorusGeometry(0.060, 0.009, 16, 36), this.exoCyanRingMat);
    lowerCuff.rotation.x = Math.PI / 2;
    lowerCuff.position.set(0, -0.33, 0);
    this.thighCuff.add(this.registerExoMesh(lowerCuff));

    const lowerClamp = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.022, 0.036), this.exoFrameMat);
    lowerClamp.position.set(0.088, -0.33, 0);
    this.thighCuff.add(this.registerExoMesh(lowerClamp));

    this.rightThigh.add(this.thighCuff);

    // Rotary Knee Actuator Assembly
    const actuatorGroup = new THREE.Group();
    actuatorGroup.position.set(0.092, 0, 0);
    actuatorGroup.rotation.y = Math.PI / 2;

    const rimGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.026, 32);
    const rimMesh = new THREE.Mesh(rimGeo, this.exoFrameMat);
    rimMesh.rotation.x = Math.PI / 2;
    actuatorGroup.add(this.registerExoMesh(rimMesh));

    // Concentric Luminous Electric Cyan Accent Ring (Knee ring from reference image)
    const accentRingGeo = new THREE.TorusGeometry(0.051, 0.0065, 16, 36);
    const accentRing = new THREE.Mesh(accentRingGeo, this.exoCyanRingMat);
    accentRing.position.set(0, 0, 0.014);
    actuatorGroup.add(this.registerExoMesh(accentRing));

    // Glowing Central Motor Core
    const coreGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.028, 24);
    this.actuatorCoreMesh = new THREE.Mesh(coreGeo, this.actuatorCoreMat.clone());
    this.actuatorCoreMesh.rotation.x = Math.PI / 2;
    this.actuatorCoreMesh.position.set(0, 0, 0.002);
    actuatorGroup.add(this.registerExoMesh(this.actuatorCoreMesh));

    const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.031, 20), this.exoMetalMat);
    capMesh.rotation.x = Math.PI / 2;
    actuatorGroup.add(this.registerExoMesh(capMesh));

    this.actuatorGlowLight = new THREE.PointLight(0x00e5ff, 1.6, 1.4);
    actuatorGroup.add(this.actuatorGlowLight);

    // 3D Rotational Torque Arc & Cone Indicator
    this.torqueIndicatorGroup = new THREE.Group();
    this.torqueIndicatorGroup.position.set(0, 0, 0.025);

    const arcGeo = new THREE.TorusGeometry(0.068, 0.0035, 8, 32, Math.PI * 0.7);
    this.torqueArcMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    this.torqueIndicatorGroup.add(this.registerExoMesh(new THREE.Mesh(arcGeo, this.torqueArcMat)));

    const coneGeo = new THREE.ConeGeometry(0.011, 0.024, 8);
    this.torqueConeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const coneMesh = new THREE.Mesh(coneGeo, this.torqueConeMat);
    coneMesh.position.set(0.068 * Math.cos(Math.PI * 0.7), 0.068 * Math.sin(Math.PI * 0.7), 0);
    coneMesh.rotation.z = Math.PI * 0.7 + Math.PI / 2;
    this.torqueIndicatorGroup.add(this.registerExoMesh(coneMesh));

    actuatorGroup.add(this.torqueIndicatorGroup);
    this.rightKnee.add(actuatorGroup);

    // Shank Exoskeleton
    this.shankBrace = new THREE.Group();
    const rightShankStrut = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.40, 0.028), this.exoFrameMat);
    rightShankStrut.position.set(0.088, -0.21, 0);
    this.shankBrace.add(this.registerExoMesh(rightShankStrut));

    const calfCuff = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 16, 36), this.exoCyanRingMat);
    calfCuff.rotation.x = Math.PI / 2;
    calfCuff.position.set(0, -0.20, 0);
    this.shankBrace.add(this.registerExoMesh(calfCuff));

    const calfClamp = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.020, 0.034), this.exoFrameMat);
    calfClamp.position.set(0.088, -0.20, 0);
    this.shankBrace.add(this.registerExoMesh(calfClamp));

    const ankleRing = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.007, 16, 32), this.exoCyanRingMat);
    ankleRing.rotation.x = Math.PI / 2;
    ankleRing.position.set(0, -0.38, 0);
    this.shankBrace.add(this.registerExoMesh(ankleRing));

    this.rightShank.add(this.shankBrace);

    // Articulated Footplate Orthosis
    this.footPlate = new THREE.Group();
    const plateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.014, 0.24), this.exoFrameMat);
    plateMesh.position.set(0, -0.052, 0.06);
    this.footPlate.add(this.registerExoMesh(plateMesh));

    const stirrupMesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.025), this.exoMetalMat);
    stirrupMesh.position.set(0.048, -0.022, 0);
    this.footPlate.add(this.registerExoMesh(stirrupMesh));

    this.rightFoot.add(this.footPlate);

    // 3. Contralateral Left Leg Support Brackets (Symmetrical Exoskeleton Alignment)
    const leftThighExo = new THREE.Group();
    const leftUpperCuff = new THREE.Mesh(new THREE.TorusGeometry(0.070, 0.009, 16, 36), this.exoCyanRingMat);
    leftUpperCuff.rotation.x = Math.PI / 2;
    leftUpperCuff.position.set(0, -0.09, 0);
    leftThighExo.add(this.registerExoMesh(leftUpperCuff));

    const leftLowerCuff = new THREE.Mesh(new THREE.TorusGeometry(0.060, 0.009, 16, 36), this.exoCyanRingMat);
    leftLowerCuff.rotation.x = Math.PI / 2;
    leftLowerCuff.position.set(0, -0.33, 0);
    leftThighExo.add(this.registerExoMesh(leftLowerCuff));

    const leftThighStrut = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.40, 0.032), this.exoFrameMat);
    leftThighStrut.position.set(-0.088, -0.21, 0);
    leftThighExo.add(this.registerExoMesh(leftThighStrut));
    this.leftThigh.add(leftThighExo);

    const leftKneeActuator = new THREE.Mesh(rimGeo, this.exoFrameMat);
    leftKneeActuator.position.set(-0.092, 0, 0);
    leftKneeActuator.rotation.y = -Math.PI / 2;
    this.leftKnee.add(this.registerExoMesh(leftKneeActuator));

    const leftCalfCuff = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 16, 36), this.exoCyanRingMat);
    leftCalfCuff.rotation.x = Math.PI / 2;
    leftCalfCuff.position.set(0, -0.20, 0);
    this.leftShank.add(this.registerExoMesh(leftCalfCuff));

    const leftFootPlate = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.014, 0.24), this.exoFrameMat);
    leftFootPlate.position.set(0, -0.052, 0.06);
    this.leftFoot.add(this.registerExoMesh(leftFootPlate));

    this.scene.add(this.exoGroup);
  }

  buildSensorMarkers() {
    this.sensorGroup = new THREE.Group();
    this.sensorGroup.name = "Virtual_Sensors";

    // 1. Thigh 6-Axis IMU
    const imuGeo = new THREE.BoxGeometry(0.022, 0.012, 0.022);
    const imuMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.20 });
    this.thighImuMesh = new THREE.Mesh(imuGeo, imuMat);
    this.thighImuMesh.position.set(0, -0.16, 0.065);
    this.rightThigh.add(this.registerSensorMesh(this.thighImuMesh));

    // 2. Shank 6-Axis IMU
    this.shankImuMesh = new THREE.Mesh(imuGeo, imuMat);
    this.shankImuMesh.position.set(0, -0.18, 0.052);
    this.rightShank.add(this.registerSensorMesh(this.shankImuMesh));

    // 3. Rectus Femoris sEMG Electrode Patch
    const emgGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.005, 20);
    const emgMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.6,
      roughness: 0.25
    });
    this.emgPatchMesh = new THREE.Mesh(emgGeo, emgMat);
    this.emgPatchMesh.rotation.x = Math.PI / 2;
    this.emgPatchMesh.position.set(0, -0.10, 0.065);
    this.rightThigh.add(this.registerSensorMesh(this.emgPatchMesh));

    // 4. Tri-Zone FSR Foot Pressure Discs
    const fsrGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.006, 20);
    const makeFsrMat = () => new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00b4d8,
      emissiveIntensity: 0.35,
      roughness: 0.3
    });

    this.fsrHeelMesh = new THREE.Mesh(fsrGeo, makeFsrMat());
    this.fsrHeelMesh.position.set(0, -0.062, -0.02);
    this.rightFoot.add(this.registerSensorMesh(this.fsrHeelMesh));

    this.fsrMetaMesh = new THREE.Mesh(fsrGeo, makeFsrMat());
    this.fsrMetaMesh.position.set(0, -0.062, 0.07);
    this.rightFoot.add(this.registerSensorMesh(this.fsrMetaMesh));

    this.fsrToeMesh = new THREE.Mesh(fsrGeo, makeFsrMat());
    this.fsrToeMesh.position.set(0, -0.062, 0.14);
    this.rightFoot.add(this.registerSensorMesh(this.fsrToeMesh));

    this.scene.add(this.sensorGroup);
  }

  updateTelemetry(telemetry) {
    if (!telemetry || !telemetry.kinematics) return;

    const k = telemetry.kinematics;
    const kneeRad = THREE.MathUtils.degToRad(k.knee_angle_deg || 0);
    const thighRad = THREE.MathUtils.degToRad(k.thigh_angle_deg || 0);
    const km = (k.mode || "WALK").toUpperCase().replace("-", "_");

    // =========================================================================
    // 1. Biomechanical Kinematic Articulation
    // Rectified:
    // A. SIT_STAND: Feet remain flat on ground at y=0, ZERO ground penetration.
    // B. WALK & RUN: True alternating bipedal locomotion (Right step -> Left step).
    // C. MANUAL_JOG: Right leg articulates with jog angle; Left leg provides stable support.
    // D. STANDBY: Balanced upright posture.
    // =========================================================================
    if (km === "SIT_STAND") {
      // Exact Forward Kinematics solver to guarantee feet NEVER penetrate the floor:
      // Y_pelvis = HipOffset + ThighLen * cos(thigh) + ShankLen * cos(knee - thigh) + FootHeight
      const computedPelvisY = 0.04 + 0.42 * Math.cos(thighRad) + 0.42 * Math.cos(kneeRad - thighRad) + 0.052;
      const sitRatio = Math.min(1.0, Math.max(0.0, (k.knee_angle_deg || 0) / 85.0));

      if (this.pelvis) {
        this.pelvis.position.y = Math.max(0.58, computedPelvisY);
        // Ergonomic posterior shift into chair
        this.pelvis.position.z = -(sitRatio * 0.14);
        this.pelvis.position.x = 0;
      }
      if (this.torsoGroup) {
        // Natural forward trunk lean during transfer
        this.torsoGroup.rotation.x = sitRatio * 0.20;
      }

      // Synchronous bilateral joint flexion
      if (this.rightHip) this.rightHip.rotation.x = -thighRad;
      if (this.rightKnee) this.rightKnee.rotation.x = kneeRad;
      if (this.leftHip) this.leftHip.rotation.x = -thighRad;
      if (this.leftKnee) this.leftKnee.rotation.x = kneeRad;

      // Ankle angles dynamically maintain the foot soles 100% flat on the floor
      const ankleGroundAlign = -(kneeRad - thighRad);
      if (this.rightAnkle) this.rightAnkle.rotation.x = ankleGroundAlign;
      if (this.leftAnkle) this.leftAnkle.rotation.x = ankleGroundAlign;

    } else if (km === "STANDBY") {
      // Upright locked stance on both limbs
      if (this.pelvis) this.pelvis.position.set(0, 0.95, 0);
      if (this.torsoGroup) this.torsoGroup.rotation.x = 0;

      const kneeLock = THREE.MathUtils.degToRad(10.0);
      if (this.rightHip) this.rightHip.rotation.x = 0;
      if (this.rightKnee) this.rightKnee.rotation.x = kneeLock;
      if (this.leftHip) this.leftHip.rotation.x = 0;
      if (this.leftKnee) this.leftKnee.rotation.x = kneeLock;

      if (this.rightAnkle) this.rightAnkle.rotation.x = -kneeLock * 0.5;
      if (this.leftAnkle) this.leftAnkle.rotation.x = -kneeLock * 0.5;

    } else if (km === "MANUAL_JOG") {
      // Manual Jog mode: Right leg tests actuator angle; Left leg provides stable support
      if (this.pelvis) this.pelvis.position.set(0, 0.95, 0);
      if (this.torsoGroup) this.torsoGroup.rotation.x = 0;

      if (this.rightHip) this.rightHip.rotation.x = -thighRad;
      if (this.rightKnee) this.rightKnee.rotation.x = kneeRad;
      if (this.rightAnkle) this.rightAnkle.rotation.x = (thighRad - kneeRad) * 0.5;

      if (this.leftHip) this.leftHip.rotation.x = 0;
      if (this.leftKnee) this.leftKnee.rotation.x = THREE.MathUtils.degToRad(8.0);
      if (this.leftAnkle) this.leftAnkle.rotation.x = -THREE.MathUtils.degToRad(8.0);

    } else {
      // =======================================================================
      // Alternating Bipedal Locomotion (WALK & RUN)
      // True Human Locomotion: Right step -> Left step with 50% alternating phase shift!
      // Forward swing lands heel-first, stance supports and rolls onto toes, zero backward donkey kicks!
      // =======================================================================
      const isRun = km === "RUN";
      const cyclePercent = telemetry.gait?.cycle_percent ?? 0.0;

      // Active Right Leg Kinematics (Human Gait Profile)
      const rightAngles = this.calculateGaitAngles(cyclePercent, isRun);
      const rightFootAngleDeg = this.computeFootWorldAngleDeg(cyclePercent, isRun);
      const rightFootWorldRad = THREE.MathUtils.degToRad(rightFootAngleDeg);

      // Enforce strict anatomical knee limits: 0° (full extension) to 120° (flexion), zero hyperextension/recurvatum
      const rightKneeSafe = Math.max(0.0, Math.min(THREE.MathUtils.degToRad(120.0), rightAngles.kneeRad));

      if (this.rightHip) this.rightHip.rotation.x = -rightAngles.thighRad;
      if (this.rightKnee) this.rightKnee.rotation.x = rightKneeSafe;
      
      // Ankle rotation keeps foot flat on ground during stance and level during swing
      const rightLegPitch = -rightAngles.thighRad + rightKneeSafe;
      let rightAnkleLocal = rightFootWorldRad - rightLegPitch;
      rightAnkleLocal = Math.max(-0.61, Math.min(0.44, rightAnkleLocal));
      if (this.rightAnkle) this.rightAnkle.rotation.x = rightAnkleLocal;

      // Alternate Movement for Left Leg (50% phase shift: 180° out-of-phase step)
      const leftCyclePercent = (cyclePercent + 50.0) % 100.0;
      const leftAngles = this.calculateGaitAngles(leftCyclePercent, isRun);
      const leftFootAngleDeg = this.computeFootWorldAngleDeg(leftCyclePercent, isRun);
      const leftFootWorldRad = THREE.MathUtils.degToRad(leftFootAngleDeg);

      const leftKneeSafe = Math.max(0.0, Math.min(THREE.MathUtils.degToRad(120.0), leftAngles.kneeRad));

      if (this.leftHip) this.leftHip.rotation.x = -leftAngles.thighRad;
      if (this.leftKnee) this.leftKnee.rotation.x = leftKneeSafe;
      
      const leftLegPitch = -leftAngles.thighRad + leftKneeSafe;
      let leftAnkleLocal = leftFootWorldRad - leftLegPitch;
      leftAnkleLocal = Math.max(-0.61, Math.min(0.44, leftAnkleLocal));
      if (this.leftAnkle) this.leftAnkle.rotation.x = leftAnkleLocal;

      // Pelvis natural sinusoidal vertical bounce & lateral weight shift
      // Minima at double-support (p=0%, 50%), maxima at single-support midstance (p=25%, 75%)
      if (this.pelvis) {
        const bounce = -Math.cos((cyclePercent / 100.0) * Math.PI * 4.0) * 0.014;
        const sway = Math.sin((cyclePercent / 100.0) * Math.PI * 2.0) * 0.012;
        this.pelvis.position.set(sway, 0.945 + bounce, 0);
      }
      if (this.torsoGroup) {
        // Natural slight forward posture and subtle counter-twist
        const twist = Math.sin((cyclePercent / 100.0) * Math.PI * 2.0) * 0.035;
        this.torsoGroup.rotation.set(0.044, -twist, 0);
      }
    }

    // Animate custom 3D model if active
    if (this.hasCustomModel && this.customBones) {
      if (km === "SIT_STAND") {
        if (this.customBones.pelvis) {
          const computedPelvisY = 0.04 + 0.42 * Math.cos(thighRad) + 0.42 * Math.cos(kneeRad - thighRad) + 0.052;
          this.customBones.pelvis.position.y = Math.max(0.58, computedPelvisY);
        }
        if (this.customBones.rightHip) this.customBones.rightHip.rotation.x = -thighRad;
        if (this.customBones.rightKnee) this.customBones.rightKnee.rotation.x = kneeRad;
        if (this.customBones.leftHip) this.customBones.leftHip.rotation.x = -thighRad;
        if (this.customBones.leftKnee) this.customBones.leftKnee.rotation.x = kneeRad;
        const sitAnkle = -(kneeRad - thighRad);
        if (this.customBones.rightAnkle) this.customBones.rightAnkle.rotation.x = sitAnkle;
        if (this.customBones.leftAnkle) this.customBones.leftAnkle.rotation.x = sitAnkle;
      } else if (km === "STANDBY" || km === "MANUAL_JOG") {
        const kRad = (km === "STANDBY") ? THREE.MathUtils.degToRad(10.0) : kneeRad;
        const tRad = (km === "STANDBY") ? 0 : thighRad;
        if (this.customBones.pelvis) {
          this.customBones.pelvis.position.y = this.customBones.pelvisBaseY || 0.95;
        }
        if (this.customBones.rightHip) this.customBones.rightHip.rotation.x = -tRad;
        if (this.customBones.rightKnee) this.customBones.rightKnee.rotation.x = kRad;
        if (this.customBones.leftHip) this.customBones.leftHip.rotation.x = 0;
        if (this.customBones.leftKnee) this.customBones.leftKnee.rotation.x = THREE.MathUtils.degToRad(8.0);
        const rAnk = (km === "STANDBY") ? -kRad * 0.5 : (tRad - kRad) * 0.5;
        const lAnk = (km === "STANDBY") ? -kRad * 0.5 : -THREE.MathUtils.degToRad(8.0);
        if (this.customBones.rightAnkle) this.customBones.rightAnkle.rotation.x = rAnk;
        if (this.customBones.leftAnkle) this.customBones.leftAnkle.rotation.x = lAnk;
      } else {
        const cyclePercent = telemetry.gait?.cycle_percent ?? 0.0;
        const isRun = km === "RUN";
        const rightAngles = this.calculateGaitAngles(cyclePercent, isRun);
        const rightFootAngleDeg = this.computeFootWorldAngleDeg(cyclePercent, isRun);
        const rightFootWorldRad = THREE.MathUtils.degToRad(rightFootAngleDeg);

        const leftCyclePercent = (cyclePercent + 50.0) % 100.0;
        const leftAngles = this.calculateGaitAngles(leftCyclePercent, isRun);
        const leftFootAngleDeg = this.computeFootWorldAngleDeg(leftCyclePercent, isRun);
        const leftFootWorldRad = THREE.MathUtils.degToRad(leftFootAngleDeg);

        const rightKneeSafe = Math.max(0.0, Math.min(THREE.MathUtils.degToRad(120.0), rightAngles.kneeRad));
        const leftKneeSafe = Math.max(0.0, Math.min(THREE.MathUtils.degToRad(120.0), leftAngles.kneeRad));

        const rightLegPitch = -rightAngles.thighRad + rightKneeSafe;
        let rightAnkleLocal = rightFootWorldRad - rightLegPitch;
        rightAnkleLocal = Math.max(-0.61, Math.min(0.44, rightAnkleLocal));

        const leftLegPitch = -leftAngles.thighRad + leftKneeSafe;
        let leftAnkleLocal = leftFootWorldRad - leftLegPitch;
        leftAnkleLocal = Math.max(-0.61, Math.min(0.44, leftAnkleLocal));

        if (this.customBones.rightHip) this.customBones.rightHip.rotation.x = -rightAngles.thighRad;
        if (this.customBones.rightKnee) this.customBones.rightKnee.rotation.x = rightKneeSafe;
        if (this.customBones.rightAnkle) this.customBones.rightAnkle.rotation.x = rightAnkleLocal;

        if (this.customBones.leftHip) this.customBones.leftHip.rotation.x = -leftAngles.thighRad;
        if (this.customBones.leftKnee) this.customBones.leftKnee.rotation.x = leftKneeSafe;
        if (this.customBones.leftAnkle) this.customBones.leftAnkle.rotation.x = leftAnkleLocal;

        if (this.customBones.pelvis) {
          const bounce = -Math.cos((cyclePercent / 100.0) * Math.PI * 4.0) * 0.014;
          this.customBones.pelvis.position.y = (this.customBones.pelvisBaseY || 0.95) + bounce;
        }
      }
    }

    // =========================================================================
    // 2. Actuator Dynamic Glow & Torque Arc Indicator
    // =========================================================================
    const torque = Math.abs(telemetry.torques?.commanded_nm || 0);
    const mode = telemetry.safety?.mode || "NORMAL_AAN";

    let glowColor = 0x00e5ff;
    let intensity = 0.5 + (torque / 35.0) * 1.8;

    if (mode === "EMERGENCY_STOP") {
      glowColor = 0xf43f5e;
      intensity = (Date.now() % 360 < 180) ? 2.8 : 0.2;
    } else if (mode === "PROTECTIVE_MODE") {
      glowColor = 0xa855f7;
      intensity = 2.0;
    } else if (mode === "CONTROLLED_SOFT_STOP") {
      glowColor = 0xf59e0b;
      intensity = 1.6 + 0.5 * Math.sin(Date.now() * 0.008);
    } else if (mode === "SAFE_FALLBACK") {
      glowColor = 0xf59e0b;
      intensity = 1.3;
    } else {
      if (torque < 8.0) {
        glowColor = 0x10b981;
      } else if (torque < 18.0) {
        glowColor = 0x00e5ff;
      } else if (torque < 28.0) {
        glowColor = 0xf59e0b;
      } else {
        glowColor = 0xf43f5e;
      }
    }

    if (this.actuatorCoreMesh) {
      this.actuatorCoreMesh.material.color.setHex(glowColor);
      this.actuatorCoreMesh.material.emissive.setHex(glowColor);
      this.actuatorCoreMesh.material.emissiveIntensity = intensity;
    }
    if (this.actuatorGlowLight) {
      this.actuatorGlowLight.color.setHex(glowColor);
      this.actuatorGlowLight.intensity = intensity * 1.8;
    }

    if (this.torqueIndicatorGroup) {
      const rawCmdTorque = telemetry.torques?.commanded_nm ?? 0.0;
      const absTorque = Math.abs(rawCmdTorque);
      if (absTorque < 0.25 || mode === "EMERGENCY_STOP") {
        this.torqueIndicatorGroup.visible = false;
      } else {
        this.torqueIndicatorGroup.visible = true;
        const isExtension = rawCmdTorque >= 0;
        const indColor = mode === "CONTROLLED_SOFT_STOP" ? 0xfbbf24 : (isExtension ? 0x10b981 : 0xa855f7);
        if (this.torqueArcMat) this.torqueArcMat.color.setHex(indColor);
        if (this.torqueConeMat) this.torqueConeMat.color.setHex(indColor);
        this.torqueIndicatorGroup.rotation.z = isExtension ? 0 : Math.PI;
        const scaleVal = Math.min(1.4, 0.85 + (absTorque / 35.0) * 0.55);
        this.torqueIndicatorGroup.scale.set(scaleVal, scaleVal, scaleVal);
      }
    }

    // =========================================================================
    // 3. FSR Foot Pressure Discs
    // =========================================================================
    const fsr = telemetry.sensors?.foot_pressure;
    if (fsr && this.fsrHeelMesh) {
      const hVal = fsr.heel_n || 0;
      const hScale = 1.0 + Math.min(1.5, hVal / 280.0);
      this.fsrHeelMesh.scale.set(hScale, 1.0, hScale);
      this.fsrHeelMesh.material.emissiveIntensity = 0.2 + Math.min(2.2, hVal / 160.0);

      const mVal = fsr.metatarsal_n || 0;
      const mScale = 1.0 + Math.min(1.5, mVal / 280.0);
      this.fsrMetaMesh.scale.set(mScale, 1.0, mScale);
      this.fsrMetaMesh.material.emissiveIntensity = 0.2 + Math.min(2.2, mVal / 160.0);

      const tVal = fsr.toe_n || 0;
      const tScale = 1.0 + Math.min(1.5, tVal / 280.0);
      this.fsrToeMesh.scale.set(tScale, 1.0, tScale);
      this.fsrToeMesh.material.emissiveIntensity = 0.2 + Math.min(2.2, tVal / 160.0);
    }

    // =========================================================================
    // 4. sEMG Envelope Glow
    // =========================================================================
    const emgEnv = telemetry.sensors?.emg?.envelope_norm || 0;
    if (this.emgPatchMesh) {
      this.emgPatchMesh.material.emissiveIntensity = 0.35 + (emgEnv * 2.2);
    }
  }

  toggleLayer(layerName, visible) {
    if (layerName === 'exo') {
      this.showExo = visible;
      this.exoMeshes.forEach(m => { m.visible = visible; });
      if (this.hasCustomModel && this.customModel) {
        this.customModel.visible = visible;
      }
      if (this.actuatorGlowLight) this.actuatorGlowLight.visible = visible;
      if (this.torqueIndicatorGroup) this.torqueIndicatorGroup.visible = visible;
    } else if (layerName === 'anatomy') {
      this.showAnatomy = visible;
      this.humanMeshes.forEach(m => { m.visible = visible; });
    } else if (layerName === 'sensors') {
      this.showSensors = visible;
      this.sensorMeshes.forEach(m => { m.visible = visible; });
    }
  }

  resetCamera() {
    if (this.camera && this.controls) {
      this.camera.position.set(1.9, 1.35, 2.6);
      this.controls.target.set(0, 0.88, 0);
      this.controls.update();
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    this.width = this.container.clientWidth || 800;
    this.height = this.container.clientHeight || 480;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // =========================================================================
  // Custom 3D Model Pipeline (.GLB / .GLTF)
  // =========================================================================
  setupGLTFPipeline() {
    if (this.container) {
      this.container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.container.style.outline = '2px dashed #00e5ff';
        this.container.style.outlineOffset = '-4px';
      });

      this.container.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.container.style.outline = 'none';
      });

      this.container.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.container.style.outline = 'none';
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf')) {
            this.loadGLTFFromFile(file);
          } else {
            this.showToast('Please drop a .glb or .gltf file', true);
          }
        }
      });
    }

    const btnLoad = document.getElementById('btn-load-glb');
    const inputLoad = document.getElementById('input-load-glb');
    if (btnLoad && inputLoad) {
      btnLoad.addEventListener('click', () => inputLoad.click());
      inputLoad.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.loadGLTFFromFile(e.target.files[0]);
        }
      });
    }

    this.checkAndLoadDefaultModel();
  }

  checkAndLoadDefaultModel() {
    const candidatePaths = [
      '/assets/models/exoskeleton.glb',
      '/assets/models/model.glb'
    ];
    const tryCandidate = (idx) => {
      if (idx >= candidatePaths.length) return;
      const path = candidatePaths[idx];
      fetch(path, { method: 'HEAD' })
        .then((res) => {
          if (res.ok && res.headers.get('content-type') !== 'text/html') {
            this.loadGLTFFromURL(path, path.split('/').pop());
          } else {
            tryCandidate(idx + 1);
          }
        })
        .catch(() => tryCandidate(idx + 1));
    };
    tryCandidate(0);
  }

  loadGLTFFromFile(file) {
    if (typeof THREE.GLTFLoader === 'undefined') {
      this.showToast('GLTFLoader not available', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target.result;
      const loader = new THREE.GLTFLoader();
      loader.parse(
        buffer,
        '',
        (gltf) => {
          this.mountCustomGLTF(gltf, file.name);
        },
        (err) => {
          console.error('[MoveAssist 3D] Failed to parse GLTF file:', err);
          this.showToast('Failed to parse 3D file: ' + err.message, true);
        }
      );
    };
    reader.readAsArrayBuffer(file);
  }

  loadGLTFFromURL(url, label) {
    if (typeof THREE.GLTFLoader === 'undefined') return;
    const loader = new THREE.GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        this.mountCustomGLTF(gltf, label || url.split('/').pop());
      },
      undefined,
      (err) => {
        console.info('[MoveAssist 3D] No custom model found at ' + url + '; procedural twin active.');
      }
    );
  }

  mountCustomGLTF(gltf, label) {
    if (this.customModel) {
      this.scene.remove(this.customModel);
      this.customModel = null;
    }

    const model = gltf.scene;
    model.name = "Custom_Exoskeleton_Model";

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim > 0) {
      const targetHeight = 1.75;
      const scaleFactor = targetHeight / (size.y > 0.1 ? size.y : maxDim);
      model.scale.set(scaleFactor, scaleFactor, scaleFactor);

      box.setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.x = -center.x;
      model.position.z = -center.z;
      model.position.y = -box.min.y;
    }

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.side = THREE.DoubleSide;
        }
      }
    });

    this.customBones = this.resolveBonesFuzzy(model);

    this.scene.add(model);
    this.customModel = model;
    this.hasCustomModel = true;
    this.customModelName = label || 'Custom Model';

    if (this.humanGroup) this.humanGroup.visible = false;
    if (this.exoGroup) this.exoGroup.visible = false;

    this.showToast(`✓ Custom 3D Model Loaded: ${this.customModelName}`);
    console.log(`[MoveAssist 3D] Mounted '${this.customModelName}' with bones:`, Object.keys(this.customBones));
  }

  resolveBonesFuzzy(rootNode) {
    const bones = {};
    rootNode.traverse((obj) => {
      const name = (obj.name || '').toLowerCase().replace(/[-_.]/g, '');
      if (!name) return;

      if (!bones.rightHip && (name.includes('righthip') || name.includes('rightthigh') || name.includes('rightfemur') || name.includes('thighr') || name.includes('upperlegr') || name.includes('uplegr') || name.includes('rightleg') || name.includes('femurr'))) {
        bones.rightHip = obj;
      } else if (!bones.rightKnee && (name.includes('rightknee') || name.includes('kneer') || name.includes('rightkneejoint') || name.includes('shankr') || name.includes('lowerlegr') || name.includes('rightshank') || name.includes('legr'))) {
        bones.rightKnee = obj;
      } else if (!bones.rightShank && (name.includes('rightshank') || name.includes('righttibia') || name.includes('shankr') || name.includes('lowerlegr') || name.includes('rightcalf'))) {
        bones.rightShank = obj;
      } else if (!bones.rightAnkle && (name.includes('rightankle') || name.includes('ankler') || name.includes('footr') || name.includes('rightfoot') || name.includes('footplater'))) {
        bones.rightAnkle = obj;
      } else if (!bones.rightFoot && (name.includes('rightfoot') || name.includes('footr'))) {
        bones.rightFoot = obj;
      } else if (!bones.leftHip && (name.includes('lefthip') || name.includes('leftthigh') || name.includes('leftfemur') || name.includes('thighl') || name.includes('upperlegl') || name.includes('uplegl') || name.includes('leftleg') || name.includes('femurl'))) {
        bones.leftHip = obj;
      } else if (!bones.leftKnee && (name.includes('leftknee') || name.includes('kneel') || name.includes('leftkneejoint') || name.includes('shankl') || name.includes('lowerlegl') || name.includes('leftshank') || name.includes('legl'))) {
        bones.leftKnee = obj;
      } else if (!bones.leftAnkle && (name.includes('leftankle') || name.includes('anklel') || name.includes('footl') || name.includes('leftfoot') || name.includes('footplatel'))) {
        bones.leftAnkle = obj;
      } else if (!bones.leftFoot && (name.includes('leftfoot') || name.includes('footl'))) {
        bones.leftFoot = obj;
      } else if (!bones.pelvis && (name.includes('pelvis') || name.includes('hips') || name.includes('root') || name.includes('hipcenter'))) {
        bones.pelvis = obj;
        bones.pelvisBaseY = obj.position.y;
      }
    });
    return bones;
  }

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
      thighRad: THREE.MathUtils.degToRad(thighDeg),
      kneeRad: THREE.MathUtils.degToRad(kneeDeg),
      ankleRad: THREE.MathUtils.degToRad(ankleDeg)
    };
  }

  /**
   * Calculates natural foot world orientation angle (relative to horizontal floor).
   * Ensures foot sole is flat during stance (0°) and level during swing (-4°), preventing toe over-stretching.
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
        // Terminal stance push-off: heel lifts, foot rotates up to +18°
        const sub = (p - 40.0) / 15.0;
        const blend = 0.5 * (1.0 - Math.cos(sub * Math.PI));
        return 18.0 * blend;
      } else if (p < 72.0) {
        // Initial swing: smoothly transitions from +18° to -5° for level ground clearance
        const sub = (p - 55.0) / 17.0;
        const blend = 0.5 * (1.0 - Math.cos(sub * Math.PI));
        return 18.0 * (1.0 - blend) - 5.0 * blend;
      } else if (p < 90.0) {
        // Mid-swing clearance: held stable at -5° (parallel to ground, zero over-stretching!)
        return -5.0;
      } else {
        // Terminal swing: prepares for heel strike, smooth descent from -5° to -8°
        const sub = (p - 90.0) / 10.0;
        return -5.0 - 3.0 * sub;
      }
    }
  }

  showToast(message, isError = false) {
    let toast = document.getElementById('three-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'three-toast';
      toast.style.cssText = `
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.94);
        color: #00e5ff;
        border: 1px solid rgba(6, 182, 212, 0.5);
        padding: 8px 16px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.3px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.6);
        pointer-events: none;
        transition: opacity 0.3s ease;
        z-index: 20;
      `;
      this.container.appendChild(toast);
    }
    toast.style.color = isError ? '#f43f5e' : '#00e5ff';
    toast.style.borderColor = isError ? 'rgba(244, 63, 94, 0.4)' : 'rgba(6, 182, 212, 0.4)';
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 3500);
  }
}

window.MoveAssist3DViewer = MoveAssist3DViewer;
