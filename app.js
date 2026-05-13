import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = (id) => document.getElementById(id);

const canvas = $('scene');
const loadingScreen = $('loadingScreen');
const loadingText = $('loadingText');
const progressBar = $('progressBar');
const startScreen = $('startScreen');
const startButton = $('startButton');
const rotateNotice = $('rotateNotice');
const hud = $('hud');
const moveBase = $('moveBase');
const moveStick = $('moveStick');

const locationBadge = $('locationBadge');
const areasButton = $('areasButton');
const nextButton = $('nextButton');
const popupCard = $('popupCard');
const areasPanel = $('areasPanel');
const hintBar = $('hintBar');

let jumpButton = $('jumpButton');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfeff7);
scene.fog = new THREE.Fog(0xdfeff7, 10, 36);

const camera = new THREE.PerspectiveCamera(72, 1, 0.01, 300);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8ea2ad, 2.1);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(4, 8, 3);
scene.add(dirLight);

const loader = new GLTFLoader();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

const downRayOrigin = new THREE.Vector3();
const downDir = new THREE.Vector3(0, -1, 0);
const tempNormal = new THREE.Vector3();
const tempForward = new THREE.Vector3();
const tempRight = new THREE.Vector3();
const tempMove = new THREE.Vector3();
const tempBox = new THREE.Box3();

let world = null;
let worldMeshes = [];
let bounds = null;
let movementEnabled = false;

let sceneScale = 1;
let eyeOffset = 0.9;
let moveSpeed = 1.4;
let gravity = 8.5;
let jumpStrength = 2.8;

let velocityY = 0;
let onGround = false;
let safetyFloorY = 0;

let spawnPoint = new THREE.Vector3(0, 1, 0);
let lastSafePosition = new THREE.Vector3(0, 1, 0);

const player = {
  position: new THREE.Vector3(0, 1, 0),
  yaw: THREE.MathUtils.degToRad(215),
  pitch: -0.08,
};

const input = {
  moveX: 0,
  moveY: 0,
  lookPointerId: null,
  lookPrevX: 0,
  lookPrevY: 0,
  lookDeltaX: 0,
  lookDeltaY: 0,
};

function setVisible(el, show) {
  if (!el) return;
  el.classList.toggle('hidden', !show);
  el.classList.toggle('visible', show);
}

function hideIfExists(el) {
  if (!el) return;
  el.classList.add('hidden');
  el.style.display = 'none';
}

function ensureJumpButton() {
  if (jumpButton) return jumpButton;

  jumpButton = document.createElement('button');
  jumpButton.id = 'jumpButton';
  jumpButton.textContent = 'JUMP';
  jumpButton.className = 'glass icon-btn jump-btn';

  jumpButton.style.position = 'fixed';
  jumpButton.style.right = 'max(18px, env(safe-area-inset-right))';
  jumpButton.style.bottom = 'max(20px, env(safe-area-inset-bottom))';
  jumpButton.style.zIndex = '12';
  jumpButton.style.pointerEvents = 'auto';
  jumpButton.style.padding = '16px 18px';
  jumpButton.style.borderRadius = '16px';
  jumpButton.style.fontWeight = '700';
  jumpButton.style.minWidth = '88px';

  (hud || document.body).appendChild(jumpButton);
  return jumpButton;
}

function simplifyUI() {
  hideIfExists(locationBadge);
  hideIfExists(areasButton);
  hideIfExists(nextButton);
  hideIfExists(popupCard);
  hideIfExists(areasPanel);

  if (hintBar) {
    hintBar.textContent = '左下で移動 / 右側スワイプで視点移動 / 右下でジャンプ';
  }
}

function updateRotateNotice() {
  const portrait = window.innerHeight > window.innerWidth;
  setVisible(rotateNotice, portrait && movementEnabled);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  updateRotateNotice();
}

window.addEventListener('resize', resize);
resize();
simplifyUI();
ensureJumpButton();

function setCameraTransform() {
  camera.rotation.order = 'YXZ';
  camera.position.copy(player.position);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function clampPitch() {
  player.pitch = Math.max(-0.48, Math.min(0.32, player.pitch));
}

function createSafetyFloor() {
  if (!bounds) return;

  const sizeX = bounds.max.x - bounds.min.x;
  const sizeZ = bounds.max.z - bounds.min.z;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(sizeX * 1.4, sizeZ * 1.4),
    new THREE.MeshBasicMaterial({
      color: 0xc6dbe2,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    })
  );

  floor.rotation.x = -Math.PI / 2;
  floor.position.set(
    (bounds.min.x + bounds.max.x) * 0.5,
    safetyFloorY - 0.01,
    (bounds.min.z + bounds.max.z) * 0.5
  );

  scene.add(floor);
}

function isWalkableHit(hit) {
  if (!hit.face) return false;
  tempNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  return tempNormal.y > 0.2;
}

function sampleGroundStrict(x, z) {
  if (!bounds || !worldMeshes.length) return null;

  downRayOrigin.set(x, bounds.max.y + Math.max(bounds.size.y, 1) + 6 * sceneScale, z);
  raycaster.set(downRayOrigin, downDir);
  raycaster.far = (bounds.max.y - bounds.min.y) + 20 * sceneScale;

  const hits = raycaster.intersectObjects(worldMeshes, true);

  for (const hit of hits) {
    if (isWalkableHit(hit)) {
      return hit.point.y;
    }
  }

  return null;
}

function sampleGround(x, z) {
  const strict = sampleGroundStrict(x, z);
  if (strict !== null) return strict;
  return safetyFloorY;
}

function findBestSpawnPoint() {
  if (!bounds) {
    return new THREE.Vector3(0, safetyFloorY + eyeOffset, 0);
  }

  const centerX = (bounds.min.x + bounds.max.x) * 0.5;
  const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
  const sizeX = bounds.max.x - bounds.min.x;
  const sizeZ = bounds.max.z - bounds.min.z;

  const offsets = [0, 0.08, -0.08, 0.16, -0.16, 0.24, -0.24, 0.32, -0.32];
  const candidates = [];

  for (const ox of offsets) {
    for (const oz of offsets) {
      candidates.push({
        x: centerX + sizeX * ox,
        z: centerZ + sizeZ * oz,
        d: Math.hypot(ox, oz),
      });
    }
  }

  candidates.sort((a, b) => a.d - b.d);

  for (const c of candidates) {
    const groundY = sampleGroundStrict(c.x, c.z);
    if (groundY !== null) {
      return new THREE.Vector3(c.x, groundY + eyeOffset, c.z);
    }
  }

  return new THREE.Vector3(centerX, safetyFloorY + eyeOffset, centerZ);
}

function rememberSafePosition() {
  const groundY = sampleGroundStrict(player.position.x, player.position.z);
  if (groundY === null) return;

  lastSafePosition.set(
    player.position.x,
    groundY + eyeOffset,
    player.position.z
  );
}

function tryMove(delta) {
  if (!bounds) return;

  tempForward.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  tempRight.set(tempForward.z, 0, -tempForward.x);

  tempMove
    .set(0, 0, 0)
    .addScaledVector(tempForward, input.moveY)
    .addScaledVector(tempRight, input.moveX);

  if (tempMove.lengthSq() < 0.0001) return;

  tempMove.normalize().multiplyScalar(moveSpeed * delta);

  const nextX = player.position.x + tempMove.x;
  const nextZ = player.position.z + tempMove.z;

  const margin = Math.max(0.12 * sceneScale, 0.12);
  if (nextX < bounds.min.x + margin || nextX > bounds.max.x - margin) return;
  if (nextZ < bounds.min.z + margin || nextZ > bounds.max.z - margin) return;

  const strictGround = sampleGroundStrict(nextX, nextZ);
  if (strictGround === null) {
    return;
  }

  const currentFeetY = player.position.y - eyeOffset;
  const step = strictGround - currentFeetY;

  if (step > 0.48 * sceneScale) return;

  player.position.x = nextX;
  player.position.z = nextZ;

  if (onGround) {
    player.position.y = strictGround + eyeOffset;
  }
}

function updateVertical(delta) {
  if (!bounds) return;

  velocityY -= gravity * delta;
  player.position.y += velocityY * delta;

  const groundY = sampleGround(player.position.x, player.position.z);
  const feetY = player.position.y - eyeOffset;

  if (feetY <= groundY) {
    onGround = true;
    velocityY = 0;
    player.position.y = groundY + eyeOffset;
    rememberSafePosition();
    return;
  }

  onGround = false;

  const minAllowedY = safetyFloorY + eyeOffset - 0.05;

  if (player.position.y < minAllowedY - 0.5 * sceneScale) {
    player.position.copy(lastSafePosition);
    velocityY = 0;
    onGround = true;
  }
}

function jump() {
  if (!movementEnabled || !onGround) return;
  velocityY = jumpStrength;
  onGround = false;
}

ensureJumpButton().addEventListener('click', jump);

function setupMoveJoystick() {
  if (!moveBase || !moveStick) return;

  const baseRect = () => moveBase.getBoundingClientRect();
  let activeId = null;

  const update = (clientX, clientY) => {
    const rect = baseRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const radius = rect.width * 0.35;
    const len = Math.hypot(dx, dy) || 1;
    const clampedLen = Math.min(len, radius);
    const nx = (dx / len) * clampedLen;
    const ny = (dy / len) * clampedLen;

    moveStick.style.transform = `translate(${nx}px, ${ny}px)`;
    input.moveX = nx / radius;
    input.moveY = ny / radius;
  };

  const reset = () => {
    activeId = null;
    moveStick.style.transform = 'translate(0px, 0px)';
    input.moveX = 0;
    input.moveY = 0;
  };

  moveBase.addEventListener('pointerdown', (event) => {
    activeId = event.pointerId;
    moveBase.setPointerCapture(activeId);
    update(event.clientX, event.clientY);
  });

  moveBase.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activeId) return;
    update(event.clientX, event.clientY);
  });

  moveBase.addEventListener('pointerup', (event) => {
    if (event.pointerId === activeId) reset();
  });

  moveBase.addEventListener('pointercancel', reset);
}

function setupLookControls() {
  window.addEventListener('pointerdown', (event) => {
    if (!movementEnabled) return;

    if (
      event.target.closest('#moveBase') ||
      event.target.closest('#jumpButton') ||
      event.target.closest('.left-zone') ||
      event.target.closest('.panel')
    ) {
      return;
    }

    input.lookPointerId = event.pointerId;
    input.lookPrevX = event.clientX;
    input.lookPrevY = event.clientY;
  });

  window.addEventListener('pointermove', (event) => {
    if (event.pointerId !== input.lookPointerId) return;

    const dx = event.clientX - input.lookPrevX;
    const dy = event.clientY - input.lookPrevY;

    input.lookPrevX = event.clientX;
    input.lookPrevY = event.clientY;

    input.lookDeltaX += dx;
    input.lookDeltaY += dy;
  });

  const clearLook = (event) => {
    if (event.pointerId === input.lookPointerId) {
      input.lookPointerId = null;
      input.lookDeltaX = 0;
      input.lookDeltaY = 0;
    }
  };

  window.addEventListener('pointerup', clearLook);
  window.addEventListener('pointercancel', clearLook);
}

function startExperience() {
  movementEnabled = true;
  setVisible(startScreen, false);
  setVisible(hud, true);
  updateRotateNotice();
}

if (startButton) {
  startButton.addEventListener('click', startExperience);
}

setupMoveJoystick();
setupLookControls();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);

  if (movementEnabled) {
    const lookFactorX = 0.0036;
    const lookFactorY = 0.0028;

    player.yaw -= input.lookDeltaX * lookFactorX;
    player.pitch -= input.lookDeltaY * lookFactorY;

    input.lookDeltaX *= 0.55;
    input.lookDeltaY *= 0.55;

    clampPitch();
    tryMove(delta);
    updateVertical(delta);
  }

  setCameraTransform();
  renderer.render(scene, camera);
}

animate();

loader.load(
  './asoboon.glb',
  (gltf) => {
    world = gltf.scene;
    scene.add(world);

    const bbox = tempBox.setFromObject(world);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    bbox.getSize(size);
    bbox.getCenter(center);

    bounds = {
      min: bbox.min.clone(),
      max: bbox.max.clone(),
      size: size.clone(),
      center: center.clone(),
    };

    const maxXZ = Math.max(size.x, size.z);
    const maxDim = Math.max(size.x, size.y, size.z);

    sceneScale = THREE.MathUtils.clamp(maxDim / 10, 0.5, 6);

    // 視点高さを従来の約1.5倍へ調整
    eyeOffset = THREE.MathUtils.clamp(size.y * 0.075, 0.68, 1.65);

    moveSpeed = THREE.MathUtils.clamp(maxXZ * 0.06, 1.0, 3.0);
    gravity = 8.5;
    jumpStrength = THREE.MathUtils.clamp(eyeOffset * 4.2, 2.2, 4.2);
    safetyFloorY = bbox.min.y + 0.02 * sceneScale;

    worldMeshes = [];
    world.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        child.frustumCulled = false;
        worldMeshes.push(child);
      }
    });

    createSafetyFloor();

    spawnPoint = findBestSpawnPoint();
    lastSafePosition.copy(spawnPoint);
    player.position.copy(spawnPoint);

    onGround = true;
    velocityY = 0;

    setCameraTransform();

    setVisible(loadingScreen, false);
    if (startScreen) {
      setVisible(startScreen, true);
    } else {
      movementEnabled = true;
      setVisible(hud, true);
    }

    if (loadingText) loadingText.textContent = '読み込み完了';
  },
  (event) => {
    if (!loadingText || !progressBar) return;

    if (!event.total) {
      loadingText.textContent = '3Dデータを読み込んでいます…';
      return;
    }

    const progress = Math.round((event.loaded / event.total) * 100);
    progressBar.style.width = `${progress}%`;
    loadingText.textContent = `3Dデータを読み込んでいます… ${progress}%`;
  },
  (error) => {
    console.error(error);
    if (loadingText) {
      loadingText.textContent = '読み込みに失敗しました。GLB配置をご確認ください。';
    }
  }
);
