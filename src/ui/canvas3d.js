import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLANETARY_GEOGRAPHY } from "../map.js";

export function spherePoint(longitude, latitude, radius = 1) {
  const horizontal = Math.cos(latitude) * radius;
  return new THREE.Vector3(horizontal * Math.sin(longitude), Math.sin(latitude) * radius, horizontal * Math.cos(longitude));
}

function strip(lonStart, lonEnd, latStart, latEnd, columns, rows, color) {
  const vertices = [];
  const indices = [];
  for (let row = 0; row <= rows; row++) {
    const latitude = latStart + (latEnd - latStart) * row / rows;
    for (let column = 0; column <= columns; column++) {
      const longitude = lonStart + (lonEnd - lonStart) * column / columns;
      vertices.push(...spherePoint(longitude, latitude, 1.004).toArray());
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
}

export function createPlanetRenderer() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.domElement.id = "planet-map";
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.set(0, 0, 4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false;
  controls.target.set(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const light = new THREE.DirectionalLight(0xe4f6e8, 2);
  light.position.set(-3, 4, 5);
  scene.add(light);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshLambertMaterial({ color: 0x31666b }));
  scene.add(planet);
  for (const latitude of PLANETARY_GEOGRAPHY.calmBelts) {
    scene.add(strip(-Math.PI, Math.PI, latitude - 0.055, latitude + 0.055, 96, 3, 0x7d9280));
  }
  scene.add(strip(-Math.PI, Math.PI, -0.07, 0.07, 96, 3, 0x68a99a));
  for (const longitude of PLANETARY_GEOGRAPHY.redLineMeridians) {
    scene.add(strip(longitude - 0.105, longitude + 0.105, -Math.PI / 2, Math.PI / 2, 5, 64, 0x914a38));
  }
  const cloudGeometry = new THREE.SphereGeometry(1.018, 48, 32);
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xe7f5ee, transparent: true, opacity: 0.055, depthWrite: false });
  const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
  scene.add(clouds);
  let canvasWidth = 0;
  let canvasHeight = 0;

  return {
    element: renderer.domElement,
    draw({ width, height, radius, longitude, latitude, now }) {
      if (width !== canvasWidth || height !== canvasHeight) {
        renderer.setSize(width, height, false);
        canvasWidth = width;
        canvasHeight = height;
      }
      const halfHeight = height / (2 * radius);
      camera.left = -width / (2 * radius);
      camera.right = width / (2 * radius);
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      camera.position.copy(spherePoint(longitude, latitude, 4));
      controls.update();
      clouds.rotation.y = now / 90000;
      renderer.render(scene, camera);
    },
    dispose() {
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) object.material.dispose();
      });
      renderer.dispose();
    }
  };
}
