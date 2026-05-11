import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('scene');
const loadingScreen = document.getElementById('loadingScreen');
const loadingText = document.getElementById('loadingText');
const progressBar = document.getElementById('progressBar');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const rotateNotice = document.getElementById('rotateNotice');
const hud = document.getElementById('hud');
const moveBase = document.getElementById('moveBase');
const moveStick = document.getElementById('moveStick');
const jumpButton = document.getElementById('jumpButton');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfeff7);
scene.fog = new THREE.Fog(0xdfeff7, 10, 32);

const camera = new THREE.PerspectiveCamera(72, 1, 0.01, 200);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xffffff, 0x90a4ae, 2.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(4, 8, 3);
scene.add(dirLight);

const loader = new GLTFLoader();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const downRayOrigin = new THREE.Vector3();
const groundDir = new THREE.Vector3(0, -1, 0);

let world = null;
let worldMeshes = [];
let bounds = null;
let movementEnabled = false;
let sceneScale = 1;
let eyeOffset = 0.5;
let moveSpeed = 1.25;
let gravity = 7.5;
let jumpStrength = 2.8;
let velocityY = 0;
let onGround = false;
let lastGroundY = null;

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
  el.classList.toggle('hidden', !show);
  el.classList.toggle('visible', show);
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

function updateRotateNotice() {
  const portrait = window.innerHeight > window.innerWidth;
  setVisible(rotateNotice, portrait && movementEnabled);
}

function setCameraTransform() {
  camera.rotation.order = 'YXZ';
  camera.position.copy(player.position);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function clampPitch() {
  player.pitch = Math.max(-0.48, Math.min(0.32, player.pitch));
}

function sampleGround(x, z) {
  if (!worldMeshes.length || !bounds) return null;
  downRayOrigin.set(x, bounds.max.y + 5 * sceneScale, z);
  raycaster.set(downRayOrigin, groundDir);
  raycaster.far = (bounds.max.y - bounds.min.y) + 12 * sceneScale;
  const hits = raycaster.intersectObjects(worldMeshes, true);
  const hit = hits.find((item) => item.face && Math.abs(item.face.normal.y) > 0.2);
  return hit ? hit.point.y : null;
}

function tryMove(delta) {
  if (!bounds) return;

  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const desired = new THREE.Vector3()
    .addScaledVector(forward, -input.moveY)
    .addScaledVector(right, input.moveX);

  if (desired.lengthSq() < 0.0001) return;
  desired.normalize().multiplyScalar(moveSpeed * delta);

  const nextX = player.position.x + desired.x;
  const nextZ = player.position.z + desired.z;

  const margin = Math.max(0.12 * sceneScale, 0.12);
  if (nextX < bounds.min.x + margin || nextX > bounds.max.x - margin) return;
  if (nextZ < bounds.min.z + margin || nextZ > bounds.max.z - margin) return;

  const groundY = sampleGround(nextX, nextZ);
  if (groundY == null) return;

  const currentFeetY = player.position.y - eyeOffset;
  const step = groundY - currentFeetY;

  if (step > 0.48 * sceneScale) return;

  player.position.x = nextX;
  player.position.z = nextZ;

  if (onGround) {
    player.position.y = groundY + eyeOffset;
    lastGroundY = groundY;
  }
}

function updateVertical(delta) {
  if (!bounds) return;
  velocityY -= gravity * delta;
  player.position.y += velocityY * delta;

  const groundY = sampleGround(player.position.x, player.position.z);
  if (groundY != null) {
    const feetY = player.position.y - eyeOffset;
    if (feetY <= groundY) {
      onGround = true;
      velocityY = 0;
      player.position.y = groundY + eyeOffset;
      lastGroundY = groundY;
    } else {
      onGround = false;
    }
  } else if (lastGroundY != null && player.position.y < lastGroundY + eyeOffset - 3 * sceneScale) {
    player.position.set(bounds.min.x + (bounds.max.x - bounds.min.x) * 0.18, lastGroundY + eyeOffset, bounds.max.z - (bounds.max.z - bounds.min.z) * 0.18);
    velocityY = 0;
    onGround = true;
  }
}

function jump() {
  if (!movementEnabled || !onGround) return;
  velocityY = jumpStrength;
  onGround = false;
}

jumpButton.addEventListener('click', jump);

function setupMoveJoystick() {
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
    if (event.target.closest('.left-zone') || event.target.closest('.jump-btn') || event.target.closest('.panel')) return;
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

startButton.addEventListener('click', startExperience);
setupMoveJoystick();
setupLookControls();
resize();

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

    const bbox = new THREE.Box3().setFromObject(world);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    bounds = {
      min: bbox.min.clone(),
      max: bbox.max.clone(),
      size: size.clone(),
    };

    sceneScale = Math.max(size.x, size.y, size.z) / 8;
    eyeOffset = Math.max(size.y * 0.22, 0.23);
    moveSpeed = Math.max(size.z * 0.18, 0.95);
    gravity = Math.max(size.y * 3.2, 5.8);
    jumpStrength = Math.max(size.y * 0.9, 2.2);

    world.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        worldMeshes.push(child);
      }
    });

    const startX = bbox.min.x + size.x * 0.18;
    const startZ = bbox.max.z - size.z * 0.18;
    const startGround = sampleGround(startX, startZ) ?? bbox.min.y;
    player.position.set(startX, startGround + eyeOffset, startZ);
    lastGroundY = startGround;
    onGround = true;
    setCameraTransform();

    setVisible(loadingScreen, false);
    setVisible(startScreen, true);
    loadingText.textContent = '読み込み完了';
  },
  (event) => {
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
    loadingText.textContent = '読み込みに失敗しました。GLB配置をご確認ください。';
  }
);
