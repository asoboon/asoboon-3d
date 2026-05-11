import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildHotspots } from './hotspots.js';
import { MeshBVH, acceleratedRaycast } from 'https://unpkg.com/three-mesh-bvh@0.8.3/build/index.module.js';

THREE.Mesh.prototype.raycast = acceleratedRaycast;

const canvas = document.getElementById('scene');
const loadingScreen = document.getElementById('loadingScreen');
const loadingText = document.getElementById('loadingText');
const progressBar = document.getElementById('progressBar');
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const rotateNotice = document.getElementById('rotateNotice');
const hud = document.getElementById('hud');
const popupCard = document.getElementById('popupCard');
const popupTitle = document.getElementById('popupTitle');
const popupDescription = document.getElementById('popupDescription');
const locationBadge = document.getElementById('locationBadge');
const closePopup = document.getElementById('closePopup');
const areasButton = document.getElementById('areasButton');
const nextButton = document.getElementById('nextButton');
const goNextFromPopup = document.getElementById('goNextFromPopup');
const areasPanel = document.getElementById('areasPanel');
const areasList = document.getElementById('areasList');
const closeAreas = document.getElementById('closeAreas');
const moveBase = document.getElementById('moveBase');
const moveStick = document.getElementById('moveStick');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfeff7);
scene.fog = new THREE.Fog(0xdfeff7, 6, 16);

const camera = new THREE.PerspectiveCamera(72, 1, 0.01, 200);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8fa3ad, 2.0);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
dirLight.position.set(3, 7, 2);
scene.add(dirLight);

const guideGroup = new THREE.Group();
scene.add(guideGroup);

const clock = new THREE.Clock();
const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const downRayOrigin = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const sideDirection = new THREE.Vector3();
const testOrigin = new THREE.Vector3();
const bbox = new THREE.Box3();
const bboxHelper = new THREE.Vector3();

let world;
let worldMeshes = [];
let hotspots = [];
let activeHotspot = null;
let boundsData = null;
let movementEnabled = false;
let currentAreaIndex = 0;
let eyeOffset = 0.5;
let moveSpeed = 1.5;
let sceneScale = 1;
let collisionDistance = 0.2;

const player = {
  position: new THREE.Vector3(0, 0.7, 0),
  yaw: 0,
  pitch: -0.08,
};

const input = {
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  lookPointerId: null,
  lookPrevX: 0,
  lookPrevY: 0,
};

function setVisible(el, show) {
  el.classList.toggle('hidden', !show);
  el.classList.toggle('visible', show);
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

function setCameraTransform() {
  camera.rotation.order = 'YXZ';
  camera.position.copy(player.position);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function clampPitch() {
  player.pitch = Math.max(-0.5, Math.min(0.35, player.pitch));
}

function updateLocationBadge() {
  locationBadge.textContent = activeHotspot
    ? `現在地：${activeHotspot.title}`
    : '現在地：探索中';
}

function clearPopup() {
  activeHotspot = null;
  updateLocationBadge();
  setVisible(popupCard, false);
}

function showHotspot(hotspot) {
  activeHotspot = hotspot;
  popupTitle.textContent = hotspot.title;
  popupDescription.textContent = hotspot.description;
  updateLocationBadge();
  setVisible(popupCard, true);
}

closePopup.addEventListener('click', clearPopup);
areasButton.addEventListener('click', () => setVisible(areasPanel, true));
closeAreas.addEventListener('click', () => setVisible(areasPanel, false));
nextButton.addEventListener('click', goToNextHotspot);
goNextFromPopup.addEventListener('click', () => {
  clearPopup();
  goToNextHotspot();
});

function goToNextHotspot() {
  if (!hotspots.length) return;
  currentAreaIndex = (currentAreaIndex + 1) % hotspots.length;
  jumpToHotspot(hotspots[currentAreaIndex]);
}

function jumpToHotspot(hotspot) {
  const point = new THREE.Vector3(hotspot.position.x, bbox.max.y + 2, hotspot.position.z);
  const hit = sampleGround(point.x, point.z);
  if (hit) {
    player.position.set(point.x, hit.y + eyeOffset, point.z);
    clearPopup();
    showHotspot(hotspot);
    setVisible(areasPanel, false);
  }
}

function buildAreasList() {
  areasList.innerHTML = '';
  hotspots.forEach((hotspot, index) => {
    const button = document.createElement('button');
    button.className = 'area-item';
    button.innerHTML = `<span class="area-index">${index + 1}</span><span class="area-copy"><strong>${hotspot.title}</strong><small>${hotspot.description}</small></span>`;
    button.addEventListener('click', () => {
      currentAreaIndex = index;
      jumpToHotspot(hotspot);
    });
    areasList.appendChild(button);
  });
}

function addHotspotMarkers() {
  guideGroup.clear();
  const markerGeo = new THREE.CylinderGeometry(0.04 * sceneScale, 0.04 * sceneScale, 0.16 * sceneScale, 16);
  const markerMat = new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0x5f2400, roughness: 0.4 });
  hotspots.forEach((hotspot) => {
    const marker = new THREE.Mesh(markerGeo, markerMat);
    const ground = sampleGround(hotspot.position.x, hotspot.position.z);
    marker.position.set(hotspot.position.x, (ground?.y ?? 0) + 0.08 * sceneScale, hotspot.position.z);
    marker.userData.hotspotId = hotspot.id;
    guideGroup.add(marker);
  });
}

function sampleGround(x, z) {
  if (!worldMeshes.length || !boundsData) return null;
  downRayOrigin.set(x, boundsData.max.y + 3 * sceneScale, z);
  raycaster.set(downRayOrigin, new THREE.Vector3(0, -1, 0));
  raycaster.far = (boundsData.max.y - boundsData.min.y) + 10 * sceneScale;
  const hits = raycaster.intersectObjects(worldMeshes, true);
  const hit = hits.find((item) => item.face && Math.abs(item.face.normal.y) > 0.2);
  return hit ? { y: hit.point.y } : null;
}

function tryMove(delta) {
  if (!boundsData) return;

  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  moveDirection.copy(forward).multiplyScalar(-input.moveY);
  sideDirection.copy(right).multiplyScalar(input.moveX);
  const desired = moveDirection.add(sideDirection);

  if (desired.lengthSq() < 0.0001) return;
  desired.normalize().multiplyScalar(moveSpeed * delta);

  const nextX = player.position.x + desired.x;
  const nextZ = player.position.z + desired.z;

  if (nextX < boundsData.min.x + 0.15 * sceneScale || nextX > boundsData.max.x - 0.15 * sceneScale) return;
  if (nextZ < boundsData.min.z + 0.15 * sceneScale || nextZ > boundsData.max.z - 0.15 * sceneScale) return;

  // Simple forward obstruction check.
  testOrigin.set(player.position.x, player.position.y - eyeOffset * 0.3, player.position.z);
  raycaster.set(testOrigin, new THREE.Vector3(desired.x, 0, desired.z).normalize());
  raycaster.far = collisionDistance + desired.length();
  const obstacleHits = raycaster.intersectObjects(worldMeshes, true);
  if (obstacleHits.length && obstacleHits[0].distance < collisionDistance) return;

  const ground = sampleGround(nextX, nextZ);
  if (!ground) return;

  const nextY = ground.y + eyeOffset;
  const yDelta = nextY - player.position.y;
  if (Math.abs(yDelta) > 0.55 * sceneScale) return;

  player.position.set(nextX, nextY, nextZ);
}

function updateHotspotDetection() {
  const nearest = hotspots
    .map((hotspot) => {
      const dx = hotspot.position.x - player.position.x;
      const dz = hotspot.position.z - player.position.z;
      return { hotspot, distance: Math.hypot(dx, dz) };
    })
    .sort((a, b) => a.distance - b.distance)[0];

  if (!nearest) return;

  currentAreaIndex = hotspots.findIndex((item) => item.id === nearest.hotspot.id);
  if (nearest.distance <= nearest.hotspot.radius) {
    if (!activeHotspot || activeHotspot.id !== nearest.hotspot.id) showHotspot(nearest.hotspot);
  } else if (activeHotspot && nearest.distance > nearest.hotspot.radius * 1.5) {
    clearPopup();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.033);

  if (movementEnabled) {
    player.yaw -= input.lookX * delta * 1.6;
    player.pitch -= input.lookY * delta * 1.1;
    input.lookX *= 0.88;
    input.lookY *= 0.88;
    clampPitch();
    tryMove(delta);
    updateHotspotDetection();
    setCameraTransform();
  }

  renderer.render(scene, camera);
}
animate();

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
    if (event.target.closest('.left-zone') || event.target.closest('.panel') || event.target.closest('.icon-btn') || event.target.closest('.popup') || event.target.closest('.side-panel')) {
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
    input.lookX = THREE.MathUtils.clamp(dx * 0.02, -0.08, 0.08);
    input.lookY = THREE.MathUtils.clamp(dy * 0.02, -0.06, 0.06);
  });

  const clearLook = (event) => {
    if (event.pointerId === input.lookPointerId) {
      input.lookPointerId = null;
      input.lookX = 0;
      input.lookY = 0;
    }
  };
  window.addEventListener('pointerup', clearLook);
  window.addEventListener('pointercancel', clearLook);
}

setupMoveJoystick();
setupLookControls();

function startExperience() {
  movementEnabled = true;
  setVisible(startScreen, false);
  setVisible(hud, true);
  updateRotateNotice();
}
startButton.addEventListener('click', startExperience);

function createFloorShadow(bounds) {
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 1.2, size.z * 1.2),
    new THREE.MeshBasicMaterial({ color: 0xc8dbe2, transparent: true, opacity: 0.35 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = bounds.min.y - 0.01 * sceneScale;
  scene.add(plane);
}

loader.load(
  './asoboon.glb',
  (gltf) => {
    world = gltf.scene;
    scene.add(world);
    bbox.setFromObject(world);

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);

    boundsData = {
      min: bbox.min.clone(),
      max: bbox.max.clone(),
      size,
      center,
    };

    sceneScale = Math.max(size.x, size.y, size.z) / 8;
    eyeOffset = Math.max(size.y * 0.22, 0.23);
    moveSpeed = Math.max(size.z * 0.22, 0.8);
    collisionDistance = Math.max(sceneScale * 0.18, 0.15);

    world.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        child.frustumCulled = false;
        if (child.geometry && !child.geometry.boundsTree) {
          child.geometry.boundsTree = new MeshBVH(child.geometry, { lazyGeneration: false });
        }
        worldMeshes.push(child);
      }
    });

    createFloorShadow(boundsData);

    hotspots = buildHotspots(boundsData);
    buildAreasList();

    const startX = bbox.min.x + size.x * 0.18;
    const startZ = bbox.max.z - size.z * 0.18;
    const startGround = sampleGround(startX, startZ);
    player.position.set(startX, (startGround?.y ?? bbox.min.y) + eyeOffset, startZ);

    player.yaw = THREE.MathUtils.degToRad(215);
    player.pitch = -0.08;
    setCameraTransform();

    addHotspotMarkers();

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
