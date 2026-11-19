// =====================================================================
// 🌙 日地月 3D 實驗室 v12 ── 一個 3D 宇宙、三支攝影機（太空／站在台灣／望遠鏡）
// 理想模型：地軸與月球軌道不傾斜；太陽固定在 +X 方向（平行光）；
// 朔（新月）約在初一清晨，朔望月 29.53 天。
// =====================================================================
import * as THREE from './three.bundle.min.js';
const { OrbitControls } = THREE;

// ---------------- 常數 ----------------
const SYN = 29.530589;               // 朔望月（天）
const LAT = 23.5 * Math.PI / 180;    // 台灣緯度
const LON = 121 * Math.PI / 180;     // 台灣經度
const ORBIT = 7;                     // 太空畫面：月球軌道半徑（地球半徑 = 1）
const MOON_R = 0.44;                 // 太空畫面：月球半徑（放大）
const SKY_MOON_D = 800;              // 天空畫面：月亮距離
const SKY_MOON_R = SKY_MOON_D * Math.tan(3.0 * Math.PI / 180);  // 天空中月亮畫成約 6°（真實 0.5°，放大約 12 倍才看得清楚月相）
const SUN_DIR = new THREE.Vector3(1, 0, 0);
const NEW0 = 0.235;                  // 朔在初一 05:38 → 初八傍晚上弦、十五半夜滿月過正南、廿三清晨下弦（對齊課本）
const LUNAR = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const DIR8 = ['北','東北','東','東南','南','西南','西','西北'];
const MARIA = [ // 月海（緯度, 經度, 半徑°）— 古人把這些暗斑看成玉兔
  ['雨海', 32.8, -15.6, 9.5], ['澄海', 28.0, 17.5, 5.8], ['寧靜海', 8.5, 31.4, 7.5], ['危海', 17.0, 59.1, 4.6],
  ['豐富海', -7.8, 51.3, 6.5], ['神酒海', -15.2, 35.5, 3.6], ['雲海', -21.3, -16.6, 6.2], ['濕海', -24.4, -38.6, 3.6],
  ['風暴洋', 18.4, -57.4, 13], ['汽海', 13.3, 3.6, 2.8], ['冷海', 56.0, 1.4, 4]
];

// ---------------- 狀態 ----------------
const S = {
  D: 8, T: 18, level: 'e', play: null, speed: 1,
  look: { az: 180, alt: 30, fov: 80 }, followMoon: true, scopeZoom: 1,
  views: { main: 'space', a: 'ground', b: 'scope' },
  opt: { rays: true, orbit: true, horizon: true, sight: true, halves: false, lockPerson: false, grid: true, fist: true, path: true, ghosts: false, seeThrough: false, maria: false },
  flying: false, dirty: true
};
try {
  const lv = localStorage.getItem('MOON_LEVEL'); if (lv === 'j' || lv === 'e') S.level = lv;
} catch (e) {}

// ---------------- 天文幾何（理想模型） ----------------
const tDays = (D, T) => (D - 1) + T / 24;
const elong = (D, T) => ((((tDays(D, T) - NEW0) / SYN) % 1 + 1) % 1) * Math.PI * 2;      // 月亮在太陽東邊幾度（弧度）
const obsAngle = T => Math.PI + T * Math.PI / 12;                      // 小人所在經線的方向角
const dirAt = a => new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));    // 軌道面上的方向（從北極看逆時針）
function basis(T) {
  const a = obsAngle(T), cp = Math.cos(LAT), sp = Math.sin(LAT);
  return {
    up: new THREE.Vector3(cp * Math.cos(a), sp, -cp * Math.sin(a)),
    east: new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)),
    north: new THREE.Vector3(-sp * Math.cos(a), cp, sp * Math.sin(a))
  };
}
function horiz(d, B) {
  const alt = Math.asin(THREE.MathUtils.clamp(d.dot(B.up), -1, 1)) * 180 / Math.PI;
  let az = Math.atan2(d.dot(B.east), d.dot(B.north)) * 180 / Math.PI; if (az < 0) az += 360;
  return { alt, az };
}
function fromHoriz(az, alt, B) {
  const A = az * Math.PI / 180, H = alt * Math.PI / 180;
  return new THREE.Vector3().addScaledVector(B.north, Math.cos(H) * Math.cos(A)).addScaledVector(B.east, Math.cos(H) * Math.sin(A)).addScaledVector(B.up, Math.sin(H)).normalize();
}
const moonDir = (D, T) => dirAt(elong(D, T));
function dir8(az) { return DIR8[Math.round(az / 45) % 8]; }
function phaseOf(eRad) {
  const e = (eRad * 180 / Math.PI + 360) % 360;
  if (e < 8 || e > 352) return { name: '新月（朔）', short: '新月', emoji: '🌑' };
  if (e < 82) return { name: '眉月', short: '眉月', emoji: '🌒' };
  if (e <= 98) return { name: '上弦月', short: '上弦月', emoji: '🌓' };
  if (e < 172) return { name: '盈凸月', short: '盈凸月', emoji: '🌔' };
  if (e <= 188) return { name: '滿月（望）', short: '滿月', emoji: '🌕' };
  if (e < 262) return { name: '虧凸月', short: '虧凸月', emoji: '🌖' };
  if (e <= 278) return { name: '下弦月', short: '下弦月', emoji: '🌗' };
  return { name: '殘月', short: '殘月', emoji: '🌘' };
}
function fmtT(T) { if (T >= 23.995 && T < 24.01) return '24:00'; const m = Math.round(T * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function partOfDay(T) { const h = T % 24; return h < 4.5 ? '半夜' : h < 6.5 ? '清晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 17 ? '下午' : h < 19 ? '傍晚' : '晚上'; }
// 這一天的月出、月沒（掃描 0–24 時）
function riseSet(D) {
  let prev = null, rise = null, set = null;
  for (let i = 0; i <= 48 * 30; i++) {
    const T = i / 30, alt = horiz(moonDir(D, T), basis(T)).alt;
    if (prev !== null) {
      const tc = T - (alt / (alt - prev)) / 30;
      if (prev < 0 && alt >= 0 && rise === null && tc < 24) rise = tc;
      if (prev >= 0 && alt < 0 && rise !== null && set === null && tc > rise) set = tc;
    }
    prev = alt;
    if (i >= 24 * 30 && rise === null) break;
    if (set !== null) break;
  }
  if (rise === null) { // 這一天沒有月出：找當天的月沒與隔天的月出
    let p2 = null;
    for (let i = 0; i <= 48 * 30; i++) {
      const T = i / 30, alt = horiz(moonDir(D, T), basis(T)).alt;
      if (p2 !== null) { const tc = T - (alt / (alt - p2)) / 30;
        if (p2 >= 0 && alt < 0 && set === null && tc < 24) set = tc;
        if (p2 < 0 && alt >= 0 && tc >= 24) return { rise: null, set, nextRise: tc }; }
      p2 = alt;
    }
  }
  return { rise, set };
}

// ---------------- 渲染器 ----------------
const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('ld-text').textContent = '⚠️ 這台裝置的瀏覽器不支援 3D（WebGL），請改用 Chrome、Edge 或 Safari 新版本。';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setScissorTest(true);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

// ---------------- 載入材質 ----------------
const manager = new THREE.LoadingManager();
const ldBar = document.getElementById('ld-bar'), ldText = document.getElementById('ld-text');
manager.onProgress = (u, a, b) => { ldBar.style.width = Math.round(a / b * 100) + '%'; };
manager.onLoad = () => finishLoading();
manager.onError = () => { ldText.textContent = '部分圖片載入失敗，改用簡化畫面…'; };
const loader = new THREE.TextureLoader(manager);
function tex(url) { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; }
const T_MOON = tex('assets/moon_2k.jpg');
const T_EARTH = tex('assets/earth_2k.jpg');
const T_NIGHT = tex('assets/earth_night_2k.jpg');
let loaded = false;
function finishLoading() {
  if (loaded) return; loaded = true;
  document.getElementById('loading').classList.add('done');
  S.dirty = true;
  try { if (!localStorage.getItem('MOON_HELP_SEEN_V12')) openHelp(); } catch (e) { openHelp(); }
}
setTimeout(finishLoading, 15000);

// 小工具：光暈貼圖
function glowTexture(inner = 'rgba(255,248,220,1)', mid = 'rgba(255,200,80,.55)', size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, inner); r.addColorStop(0.18, inner); r.addColorStop(0.35, mid); r.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 月海標示貼圖（等距圓柱投影，中心經度 0 = 正對地球）
function mariaTexture() {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.lineWidth = 5; g.setLineDash([16, 10]); g.strokeStyle = 'rgba(255,240,180,.95)';
  g.font = '900 34px "PingFang TC","Microsoft JhengHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  MARIA.forEach(([name, lat, lon, r]) => {
    const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H;
    const ry = r / 180 * H, rx = r / 360 * W / Math.max(0.35, Math.cos(lat * Math.PI / 180));
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    g.save(); g.setLineDash([]); g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(name, x, y); g.fillStyle = '#fff7cc'; g.fillText(name, x, y); g.restore();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
}
const T_MARIA = mariaTexture();
function starPoints(n, R, size) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([R * s * Math.cos(th), R * u, R * s * Math.sin(th)], i * 3);
    const b = 0.55 + Math.random() * 0.45, tint = Math.random();
    col.set([b * (tint > .8 ? 1 : .9), b * .95, b * (tint < .2 ? 1 : .92)], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 1, depthWrite: false }));
}

// =====================================================================
// 🌍 太空場景
// =====================================================================
const space = new THREE.Scene();
space.background = new THREE.Color(0x02040b);
space.add(starPoints(1600, 400, 1.6));
space.add(new THREE.AmbientLight(0xffffff, 0.05));
const sunLight = new THREE.DirectionalLight(0xffffff, 3.3); sunLight.position.set(60, 0, 0); space.add(sunLight);

// 太陽
const sunGroup = new THREE.Group(); sunGroup.position.set(55, 0, 0); space.add(sunGroup);
sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(3.2, 48, 32), new THREE.MeshBasicMaterial({ color: 0xfff1b8 })));
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
sunGlow.scale.set(26, 26, 1); sunGroup.add(sunGlow);

// 陽光（平行光箭頭，會流動）
const rayGroup = new THREE.Group(); space.add(rayGroup);
const rayMat = new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 0.9, gapSize: 0.7, transparent: true, opacity: 0.5 });
const rayHeadGeo = new THREE.ConeGeometry(0.22, 0.6, 12); rayHeadGeo.rotateZ(Math.PI / 2);
const rayHeadMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
for (const z of [-6, -2.2, 2.2, 6]) for (const y of [0]) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(40, y, z), new THREE.Vector3(-10, y, z)]);
  const l = new THREE.Line(g, rayMat); l.computeLineDistances(); rayGroup.add(l);
  for (const x of [11]) { const h = new THREE.Mesh(rayHeadGeo, rayHeadMat); h.position.set(x, y, z); h.rotation.z = Math.PI; rayGroup.add(h); }
}

// 地球（日夜分界 + 夜晚城市燈光 + 大氣）
const earthGroup = new THREE.Group(); space.add(earthGroup);
const earthMat = new THREE.ShaderMaterial({
  uniforms: { dayMap: { value: T_EARTH }, nightMap: { value: T_NIGHT }, sunDir: { value: SUN_DIR.clone() } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vec3 n = normalize(vN); vec3 d = texture2D(dayMap, vUv).rgb; vec3 nl = texture2D(nightMap, vUv).rgb;
      float l = dot(n, sunDir); float m = smoothstep(-0.10, 0.16, l);
      vec3 dayc = d * (0.20 + 1.15 * max(l, 0.0)); vec3 nightc = d * 0.05 + nl * vec3(1.0, 0.82, 0.5) * 0.9;
      vec3 c = mix(nightc, dayc, m); float f = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.4); c += vec3(0.25, 0.55, 1.0) * f * (0.18 + 0.65 * m);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`
});
const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), earthMat); earthGroup.add(earthMesh);
// 地軸
const axisLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.55, 0), new THREE.Vector3(0, 1.75, 0)]), new THREE.LineBasicMaterial({ color: 0xfde68a, transparent: true, opacity: .8 }));
space.add(axisLine);
const spinArrow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 48, Math.PI * 1.6), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
spinArrow.rotation.x = -Math.PI / 2; spinArrow.position.y = 1.55; space.add(spinArrow);
const spinHead = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 12), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
spinHead.position.set(0.42 * Math.cos(Math.PI * 1.6), 1.55, -0.42 * Math.sin(Math.PI * 1.6)); spinHead.rotation.set(0, Math.PI * 1.6, Math.PI / 2); space.add(spinHead);

// 台灣的小人（跟著地球轉）
const person = new THREE.Group(); earthGroup.add(person);
{
  const cp = Math.cos(LAT), sp = Math.sin(LAT);
  const up = new THREE.Vector3(cp * Math.cos(LON), sp, -cp * Math.sin(LON));
  const east = new THREE.Vector3(-Math.sin(LON), 0, -Math.cos(LON));
  const north = new THREE.Vector3(-sp * Math.cos(LON), cp, sp * Math.sin(LON));
  person.position.copy(up);
  person.setRotationFromMatrix(new THREE.Matrix4().makeBasis(east, up, north.clone().negate())); // X=東 Y=上 Z=南
}
const figure = new THREE.Group(); person.add(figure);
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.11, 6, 12), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: .6, emissive: 0x1d4ed8, emissiveIntensity: .35 }));
  body.position.y = 0.1; figure.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: .6, emissive: 0xb45309, emissiveIntensity: .35 }));
  head.position.y = 0.23; figure.add(head);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 10), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0.23, -0.065); figure.add(nose);
}
const hzDisk = new THREE.Mesh(new THREE.CircleGeometry(1.7, 72), new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false }));
hzDisk.rotation.x = -Math.PI / 2; hzDisk.position.y = 0.004; person.add(hzDisk);
const hzRing = new THREE.Mesh(new THREE.RingGeometry(1.66, 1.71, 96), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }));
hzRing.rotation.x = -Math.PI / 2; hzRing.position.y = 0.005; person.add(hzRing);
const meRing = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32), new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide, transparent: true }));
meRing.rotation.x = -Math.PI / 2; meRing.position.y = 0.008; person.add(meRing);

// 月球（潮汐鎖定：正面永遠朝地球）
const moonGroup = new THREE.Group(); space.add(moonGroup);
const moonMat = new THREE.MeshStandardMaterial({ map: T_MOON, roughness: 1, metalness: 0 });
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 96, 64), moonMat); moonGroup.add(moonMesh);
const mariaMat = new THREE.MeshBasicMaterial({ map: T_MARIA, transparent: true, depthWrite: false, opacity: .95 });
const moonMaria = new THREE.Mesh(new THREE.SphereGeometry(MOON_R * 1.006, 64, 48), mariaMat); moonMesh.add(moonMaria);
// 照亮的一半／朝向地球的一半
const halfLit = new THREE.Mesh(new THREE.TorusGeometry(MOON_R * 1.08, 0.016, 8, 96), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
halfLit.rotation.y = Math.PI / 2; moonGroup.add(halfLit);
const halfSeen = new THREE.Mesh(new THREE.TorusGeometry(MOON_R * 1.16, 0.016, 8, 96), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
moonGroup.add(halfSeen);
// 軌道與公轉方向
const orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 200 }, (_, i) => dirAt(i / 200 * Math.PI * 2).multiplyScalar(ORBIT))), new THREE.LineDashedMaterial({ color: 0xcbd5e1, dashSize: .35, gapSize: .25, transparent: true, opacity: .55 }));
orbitLine.computeLineDistances(); space.add(orbitLine);
const orbitArrows = new THREE.Group(); space.add(orbitArrows);
for (let k = 0; k < 8; k++) {
  const a = (k + 0.5) / 8 * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 10), new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: .7 }));
  c.position.copy(dirAt(a).multiplyScalar(ORBIT));
  const tan = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan); orbitArrows.add(c);
}
// 視線
const sightGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const sightLine = new THREE.Line(sightGeo, new THREE.LineDashedMaterial({ color: 0xfde047, dashSize: .25, gapSize: .15, transparent: true, opacity: .95 }));
space.add(sightLine);

const spaceCam = new THREE.PerspectiveCamera(42, 1, 0.01, 3000);
spaceCam.position.set(1.6, 6.4, 12.2);
const SPACE_HOME = spaceCam.position.clone();
let controls = null;

// =====================================================================
// 🧍 天空場景（站在台灣看出去）
// =====================================================================
const sky = new THREE.Scene();
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { upW: { value: new THREE.Vector3(0, 1, 0) }, sunDir: { value: SUN_DIR.clone() } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 upW; uniform vec3 sunDir; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float h = dot(d, upW); float s = dot(sunDir, upW);
      float day = smoothstep(-0.12, 0.30, s); float tw = exp(-pow((s + 0.03) * 6.0, 2.0));
      float t = pow(clamp(h, 0.0, 1.0), 0.5);
      vec3 dayC = mix(vec3(0.58, 0.78, 0.96), vec3(0.10, 0.36, 0.78), t);
      vec3 nightC = mix(vec3(0.035, 0.06, 0.13), vec3(0.008, 0.012, 0.035), t);
      vec3 c = mix(nightC, dayC, day);
      float sp = max(dot(d, sunDir), 0.0);
      c += tw * vec3(1.0, 0.42, 0.12) * (0.25 + 0.75 * pow(sp, 3.0)) * (1.0 - t) * 0.95;
      c += day * vec3(1.0, 0.96, 0.85) * pow(sp, 60.0) * 0.6;
      if (h < 0.0) c = mix(c, vec3(0.02, 0.03, 0.05), 0.55);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 40), skyMat); skyDome.renderOrder = -10; sky.add(skyDome);
const skyStars = starPoints(1800, 1400, 1.7); skyStars.renderOrder = -9; sky.add(skyStars);
sky.add(new THREE.AmbientLight(0xffffff, 0.07));
const skySunLight = new THREE.DirectionalLight(0xffffff, 3.3); skySunLight.position.copy(SUN_DIR).multiplyScalar(1000); sky.add(skySunLight);
const skySun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
skySun.scale.set(150, 150, 1); skySun.position.copy(SUN_DIR).multiplyScalar(900); sky.add(skySun);
const skySunCore = new THREE.Mesh(new THREE.SphereGeometry(900 * Math.tan(0.012), 24, 16), new THREE.MeshBasicMaterial({ color: 0xfffbe8 }));
skySunCore.position.copy(skySun.position); sky.add(skySunCore);
const darkAlpha = { value: 0.9 };
function skyMoonMaterial(extraOpacity = 1) {
  const m = new THREE.MeshStandardMaterial({ map: T_MOON, roughness: 1, metalness: 0, transparent: true, opacity: extraOpacity });
  m.onBeforeCompile = sh => {
    sh.uniforms.darkAlpha = darkAlpha;
    sh.vertexShader = 'varying vec3 vWN;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform float darkAlpha;\nvarying vec3 vWN;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      '#include <dithering_fragment>\n gl_FragColor.rgb = min(gl_FragColor.rgb * 2.1, vec3(1.0));\n float litM = smoothstep(-0.03, 0.08, dot(normalize(vWN), vec3(1.0, 0.0, 0.0)));\n gl_FragColor.a = max(litM, darkAlpha) * opacity;');
  };
  return m;
}
const skyMoon = new THREE.Mesh(new THREE.SphereGeometry(SKY_MOON_R, 96, 64), skyMoonMaterial()); sky.add(skyMoon);
const skyMoonMaria = new THREE.Mesh(new THREE.SphereGeometry(SKY_MOON_R * 1.006, 64, 48), mariaMat); skyMoon.add(skyMoonMaria);
// 每天同一時間的殘影
const ghostMat = skyMoonMaterial(.6);
const ghosts = Array.from({ length: 6 }, () => { const g = new THREE.Mesh(new THREE.SphereGeometry(SKY_MOON_R * .78, 48, 32), ghostMat); g.visible = false; sky.add(g); return g; });
// 今日軌跡
const PATH_N = 289;
const moonPathGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(PATH_N * 3), 3));
const moonPath = new THREE.Line(moonPathGeo, new THREE.LineDashedMaterial({ color: 0xfde047, dashSize: 14, gapSize: 10, transparent: true, opacity: .85 }));
sky.add(moonPath);
const sunPathGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(PATH_N * 3), 3));
const sunPath = new THREE.Line(sunPathGeo, new THREE.LineDashedMaterial({ color: 0xfb923c, dashSize: 10, gapSize: 12, transparent: true, opacity: .55 }));
sky.add(sunPath);

// 地面、遠方景物、方位格線（放在「當地座標」群組：X=東 Y=上 Z=南）
const local = new THREE.Group(); sky.add(local);
const groundMat = new THREE.MeshBasicMaterial({ color: 0x24452b, transparent: true, opacity: 1 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 96), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; local.add(ground);
function silhouetteTexture() {
  const W = 4096, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#fff';
  const hill = x => 40 + 26 * Math.sin(x * 0.0031) + 18 * Math.sin(x * 0.0113 + 1.7) + 9 * Math.sin(x * 0.041 + .4);
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, H - hill(x)); g.lineTo(W, H); g.closePath(); g.fill();
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 70; i++) { // 樹
    const x = rnd() * W, h = 30 + rnd() * 70, w = 18 + rnd() * 26, base = H - hill(x) + 6;
    g.fillRect(x - 2, base - h * .45, 4, h * .45);
    g.beginPath(); g.ellipse(x, base - h * .62, w, h * .42, 0, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 9; i++) { // 房子
    const x = rnd() * W, w = 60 + rnd() * 120, h = 40 + rnd() * 70, base = H - hill(x) + 10;
    g.fillRect(x, base - h, w, h);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
const silMat = new THREE.MeshBasicMaterial({ color: 0x0b1610, alphaMap: silhouetteTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false });
const SIL_R = 2200, SIL_H = SIL_R * Math.tan(5.2 * Math.PI / 180);
const sil = new THREE.Mesh(new THREE.CylinderGeometry(SIL_R, SIL_R, SIL_H, 160, 1, true), silMat);
sil.position.y = SIL_H / 2 - 0.6; local.add(sil);
const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .2, depthWrite: false });
const gridGroup = new THREE.Group(); local.add(gridGroup);
{
  const R = 1300;
  for (let a = 10; a <= 80; a += 10) {
    const pts = []; const h = a * Math.PI / 180;
    for (let i = 0; i <= 144; i++) { const t = i / 144 * Math.PI * 2; pts.push(new THREE.Vector3(R * Math.cos(h) * Math.sin(t), R * Math.sin(h), R * Math.cos(h) * Math.cos(t))); }
    gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), a % 30 === 0 ? new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .32, depthWrite: false }) : gridMat));
  }
  for (let az = 0; az < 360; az += 45) {
    const pts = []; const A = az * Math.PI / 180;
    for (let i = 0; i <= 45; i++) { const h = i / 45 * Math.PI / 2; pts.push(new THREE.Vector3(R * Math.cos(h) * Math.sin(A), R * Math.sin(h), -R * Math.cos(h) * Math.cos(A))); }
    gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }
}
const hzLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 180 }, (_, i) => { const t = i / 180 * Math.PI * 2; return new THREE.Vector3(1290 * Math.sin(t), 0, 1290 * Math.cos(t)); })), new THREE.LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: .9 }));
local.add(hzLine);
local.traverse(o => o.layers.set(1));
[moonPath, sunPath, ...ghosts].forEach(o => o.layers.set(2)); // 只在地面視角出現，望遠鏡不會看到

const groundCam = new THREE.PerspectiveCamera(72, 1, 0.3, 6000); groundCam.layers.enable(1); groundCam.layers.enable(2);
const scopeCam = new THREE.PerspectiveCamera(4, 1, 0.3, 6000);

// =====================================================================
// 更新場景
// =====================================================================
const tmpV = new THREE.Vector3();
let cur = null; // 目前時刻的計算結果
function computeNow() {
  const e = elong(S.D, S.T), B = basis(S.T), md = dirAt(e);
  const mh = horiz(md, B), sh = horiz(SUN_DIR, B);
  return { e, B, md, mh, sh, ph: phaseOf(e), illum: (1 - Math.cos(e)) / 2 };
}
let lastObs = obsAngle(S.T);
function updateScene() {
  cur = computeNow();
  const { e, B, md } = cur;
  // 太空
  const a = obsAngle(S.T);
  earthGroup.rotation.y = a - LON;
  if (S.opt.lockPerson && controls && !S.flying) { // 鏡頭跟著小人轉
    let d = a - lastObs; spaceCam.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), d); controls.update();
  }
  lastObs = a;
  moonGroup.position.copy(md).multiplyScalar(ORBIT);
  moonMesh.rotation.y = e + Math.PI;
  halfSeen.rotation.set(0, e + Math.PI + Math.PI / 2, 0);
  figure.rotation.y = -S.look.az * Math.PI / 180;
  space.updateMatrixWorld(true);
  const head = person.localToWorld(tmpV.set(0, 0.23, 0)).clone();
  const mpos = moonGroup.position;
  const p = sightGeo.attributes.position; p.setXYZ(0, head.x, head.y, head.z); p.setXYZ(1, mpos.x, mpos.y, mpos.z); p.needsUpdate = true; sightLine.computeLineDistances();
  sightLine.material.color.set(cur.mh.alt > 0 ? 0xfde047 : 0xf87171); sightLine.material.opacity = cur.mh.alt > 0 ? .95 : .45;
  rayGroup.visible = S.opt.rays; orbitLine.visible = orbitArrows.visible = S.opt.orbit; hzDisk.visible = hzRing.visible = S.opt.horizon;
  sightLine.visible = S.opt.sight; halfLit.visible = halfSeen.visible = S.opt.halves;
  moonMaria.visible = skyMoonMaria.visible = S.opt.maria;
  // 天空
  skyMat.uniforms.upW.value.copy(B.up);
  local.setRotationFromMatrix(new THREE.Matrix4().makeBasis(B.east, B.up, B.north.clone().negate()));
  skyMoon.position.copy(md).multiplyScalar(SKY_MOON_D); skyMoon.rotation.y = e + Math.PI;
  const day = THREE.MathUtils.smoothstep(cur.sh.alt, -12, 4);
  skyStars.material.opacity = 1 - day;
  darkAlpha.value = THREE.MathUtils.lerp(0.88, 0.0, THREE.MathUtils.smoothstep(cur.sh.alt, -10, 2));
  groundMat.color.setRGB(THREE.MathUtils.lerp(0.035, 0.16, day), THREE.MathUtils.lerp(0.07, 0.30, day), THREE.MathUtils.lerp(0.05, 0.16, day));
  silMat.color.setRGB(THREE.MathUtils.lerp(0.01, 0.05, day), THREE.MathUtils.lerp(0.02, 0.11, day), THREE.MathUtils.lerp(0.02, 0.06, day));
  groundMat.opacity = S.opt.seeThrough ? 0.3 : 1; groundMat.depthWrite = !S.opt.seeThrough; silMat.opacity = S.opt.seeThrough ? 0.35 : 1;
  gridGroup.visible = S.opt.grid;
  // 今日軌跡（月亮與太陽）
  moonPath.visible = sunPath.visible = S.opt.path;
  if (S.opt.path) {
    const mp = moonPathGeo.attributes.position, sp = sunPathGeo.attributes.position;
    for (let i = 0; i < PATH_N; i++) {
      const T = i / (PATH_N - 1) * 24, Bt = basis(T);
      const h1 = horiz(dirAt(elong(S.D, T)), Bt), v1 = fromHoriz(h1.az, h1.alt, B).multiplyScalar(SKY_MOON_D - 5);
      mp.setXYZ(i, v1.x, v1.y, v1.z);
      const h2 = horiz(SUN_DIR, Bt), v2 = fromHoriz(h2.az, h2.alt, B).multiplyScalar(890);
      sp.setXYZ(i, v2.x, v2.y, v2.z);
    }
    mp.needsUpdate = sp.needsUpdate = true; moonPath.computeLineDistances(); sunPath.computeLineDistances();
  }
  // 殘影：前幾天的同一時間（換算到「今天這個時刻」的天空座標）
  ghosts.forEach((g, i) => {
    const D = S.D - (i + 1); g.visible = S.opt.ghosts && D >= 1;
    if (!g.visible) return;
    const eg = elong(D, S.T), hg = horiz(dirAt(eg), B);
    g.position.copy(fromHoriz(hg.az, hg.alt, B)).multiplyScalar(SKY_MOON_D + 20);
    // 讓殘影保持「當天」的月相：把月球擺成那天的朝向，並把整組轉到今天的天空位置
    const q = new THREE.Quaternion().setFromUnitVectors(dirAt(eg), g.position.clone().normalize());
    g.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), eg + Math.PI));
    g.userData = { D, alt: hg.alt };
  });
  // 地面相機
  S.dirty = true;
}
// 殘影的光照要是「當天」的月相：用自己的光源方向
// （簡化做法：同一盞太陽光，月相由月球朝向與太陽方向決定；上面已把殘影轉到正確朝向）

function aimGround(cam) {
  const B = cur.B, L = fromHoriz(S.look.az, S.look.alt, B);
  cam.position.set(0, 0, 0); cam.up.copy(B.up); cam.lookAt(L); cam.fov = S.look.fov; cam.updateProjectionMatrix();
}
function aimScope(cam, aspect) {
  const target = skyMoon.position;
  cam.position.set(0, 0, 0); cam.up.copy(cur.B.up); cam.lookAt(target);
  const ang = 2 * SKY_MOON_R / SKY_MOON_D * 180 / Math.PI; // 月亮張角
  const need = ang * 1.55 / S.scopeZoom;
  cam.fov = aspect < 1 ? need / aspect : need; cam.updateProjectionMatrix();
}

// =====================================================================
// 視窗配置與標籤
// =====================================================================
const SLOTS = { main: document.getElementById('slot-main'), a: document.getElementById('slot-a'), b: document.getElementById('slot-b') };
const VIEW_META = {
  space: { title: '🌍 太空看日地月', sub: '用手指轉動、捏合縮放' },
  ground: { title: '🧍 站在台灣看天空', sub: '左右滑動轉身、上下看天空' },
  scope: { title: '🔭 望遠鏡看月亮', sub: '亮的一邊＝陽光照來的方向' }
};
const labelPools = new Map();
function pool(slot) { if (!labelPools.has(slot)) labelPools.set(slot, { map: new Map(), used: new Set() }); return labelPools.get(slot); }
function putLabel(slot, key, text, cls, x, y) {
  const P = pool(slot); let el = P.map.get(key);
  if (!el) { el = document.createElement('div'); el.className = 'lb'; slot.querySelector('.labels').appendChild(el); P.map.set(key, el); }
  if (el._t !== text) { el.textContent = text; el._t = text; }
  const c = 'lb ' + cls; if (el._c !== c) { el.className = c; el._c = c; }
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.display = '';
  P.used.add(key);
}
function project(v, cam, w, h) { const p = v.clone().project(cam); if (p.z > 1 || p.z < -1) return null; return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, ndc: p }; }
function labelAt(slot, key, text, cls, world, cam, w, h, dy = 0, clampIn = false) {
  let p = project(world, cam, w, h); if (!p) return false;
  if (clampIn) { p.x = THREE.MathUtils.clamp(p.x, 40, w - 40); p.y = THREE.MathUtils.clamp(p.y, 20, h - 20); }
  else if (p.x < -60 || p.x > w + 60 || p.y < -30 || p.y > h + 30) return false;
  putLabel(slot, key, text, cls, p.x, p.y + dy); return true;
}
function endLabels(slot) { const P = pool(slot); for (const [k, el] of P.map) if (!P.used.has(k)) el.style.display = 'none'; P.used.clear(); }

function lunarName(D) { return LUNAR[Math.min(30, Math.max(1, Math.round(D))) - 1]; }

function spaceLabels(slot, cam, w, h, mini) {
  const nm = lunarName(S.D);
  labelAt(slot, 'sun', '☀️ 太陽', 'sun', sunGroup.position.clone().add(new THREE.Vector3(0, 5.2, 0)), cam, w, h, 0, true);
  if (!mini && S.opt.rays) labelAt(slot, 'ray', '陽光（平行光）→ 照亮地球和月球的同一邊', 'ray', new THREE.Vector3(14, 0, 9.4), cam, w, h);
  labelAt(slot, 'earth', '🌍 地球', '', new THREE.Vector3(0, -1.35, 0), cam, w, h);
  labelAt(slot, 'moon', `🌙 ${nm}${mini ? '' : ' · ' + cur.ph.short}`, 'moon', moonGroup.position.clone().add(new THREE.Vector3(0, MOON_R + .5, 0)), cam, w, h);
  const me = person.localToWorld(new THREE.Vector3(0, 0.42, 0));
  labelAt(slot, 'me', '🧍 我在台灣', 'me', me, cam, w, h);
  if (!mini) {
    if (S.opt.horizon) {
      [['東', [1.9, 0, 0]], ['南', [0, 0, 1.9]], ['西', [-1.9, 0, 0]], ['北', [0, 0, -1.9]]].forEach(([t, v]) =>
        labelAt(slot, 'hz' + t, t, 'dir tiny', person.localToWorld(new THREE.Vector3(...v)), cam, w, h));
    }
    if (S.opt.halves) {
      labelAt(slot, 'hl', '黃圈：被太陽照亮的一半', 'sun', moonGroup.position, cam, w, h, 38);
      labelAt(slot, 'hs', '藍圈：朝向地球、看得到的一半', 'hint', moonGroup.position, cam, w, h, 66);
    }
    if (S.opt.orbit) labelAt(slot, 'orb', '月球公轉 ↺ 約 29.5 天', 'alt', dirAt(Math.PI).multiplyScalar(ORBIT + 0.4), cam, w, h);
  }
}
function groundLabels(slot, cam, w, h, mini) {
  const B = cur.B;
  for (let i = 0; i < 8; i++) labelAt(slot, 'd' + i, DIR8[i], i % 2 ? 'dir small' : 'dir', fromHoriz(i * 45, 1.5, B).multiplyScalar(1000), cam, w, h);
  if (!mini && S.opt.grid) for (const a of [30, 60]) { const pp = project(fromHoriz(S.look.az, a, B).multiplyScalar(1000), cam, w, h); if (pp && pp.y > 96 && pp.y < h - 130) putLabel(slot, 'g' + a, `高度角 ${a}°`, 'alt', pp.x + 46, pp.y); }
  const mh = cur.mh, sh = cur.sh;
  const mText = `🌙 ${lunarName(S.D)} ${cur.ph.short}${mh.alt < 0 ? '（地平線下）' : ''}`;
  if (!mini) {
    const v = skyMoon.position.clone().applyMatrix4(cam.matrixWorldInverse), p = skyMoon.position.clone().project(cam);
    const off = v.z > 0 || Math.abs(p.x) > 0.92 || Math.abs(p.y) > 0.92;
    if (off) {
      let ax = v.z > 0 ? -v.x : v.x, ay = v.z > 0 ? -v.y : v.y; const L = Math.hypot(ax, ay) || 1; ax /= L; ay /= L;
      const ang = Math.atan2(ay, ax), arrows = ['➡', '⬈', '⬆', '⬉', '⬅', '⬋', '⬇', '⬊'];
      const arrow = arrows[Math.round(((ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
      const k = Math.min((w / 2 - 110) / Math.max(Math.abs(ax), 1e-3), (h / 2 - 70) / Math.max(Math.abs(ay), 1e-3));
      putLabel(slot, 'moonedge', `${arrow} 🌙 月亮在這邊`, 'hint', w / 2 + ax * k, h / 2 - ay * k);
    }
  }
  labelAt(slot, 'moon', mText, 'moon' + (mh.alt < 0 ? ' below' : ''), skyMoon.position.clone().addScaledVector(B.up, SKY_MOON_R * 1.25), cam, w, h, -14);
  labelAt(slot, 'sun', sh.alt < 0 ? '☀️ 太陽（地平線下）' : '☀️ 太陽', 'sun' + (sh.alt < 0 ? ' below' : ''), SUN_DIR.clone().multiplyScalar(900).addScaledVector(B.up, 60), cam, w, h);
  if (mini) return;
  if (mh.alt <= 0) putLabel(slot, 'altread', `🌙 月亮在地平線下（${dir8(mh.az)}方），現在看不到`, 'altread hud below', w / 2, h - 100);
  if (mh.alt > 0) {
    putLabel(slot, 'altread', `🌙 月亮在${dir8(mh.az)}方・高度角 ${Math.round(mh.alt)}°${S.opt.fist ? `（約 ${(mh.alt / 10).toFixed(1)} 個拳頭）` : ''}`, 'altread hud', w / 2, h - 100);
    if (S.opt.fist) for (let k = 0; k * 10 + 5 < mh.alt - 5; k++) labelAt(slot, 'f' + k, '✊', 'fist', fromHoriz(mh.az, k * 10 + 5, B).multiplyScalar(1000), cam, w, h);
  }
  if (S.opt.path) {
    for (let H = 0; H < 24; H += 2) {
      const dT = Math.abs(((H - S.T) + 36) % 24 - 12); if (dT < 1.3) continue;
      const hh = horiz(dirAt(elong(S.D, H)), basis(H)); if (hh.alt < 3) continue;
      const pp = project(fromHoriz(hh.az, hh.alt, B).multiplyScalar(1000).addScaledVector(B.up, -38), cam, w, h);
      if (pp && pp.y > 96 && pp.y < h - 130 && pp.x > 30 && pp.x < w - 30) putLabel(slot, 'h' + H, `${H}時`, 'hour', pp.x, pp.y);
    }
  }
  ghosts.forEach((g, i) => { if (g.visible) labelAt(slot, 'gh' + i, lunarName(g.userData.D), 'ghost', g.position.clone().addScaledVector(B.up, SKY_MOON_R * 1.05), cam, w, h, -10); });
}
function scopeLabels(slot, cam, w, h, mini) {
  // 陽光方向箭頭：太陽方向投影到畫面上
  const sv = SUN_DIR.clone().transformDirection(cam.matrixWorldInverse);
  const len = Math.hypot(sv.x, sv.y);
  if (len > 1e-4 && cur.illum > 0.01) {
    const ux = sv.x / len, uy = -sv.y / len, r = Math.min(w, h) * 0.42;
    putLabel(slot, 'sunarrow', mini ? '☀️' : '☀️ 陽光從這邊照過來', 'sun', w / 2 + ux * r, h / 2 + uy * r);
  }
  if (!mini) putLabel(slot, 'pct', `照亮 ${Math.round(cur.illum * 100)}%　${cur.ph.name}`, 'moon', w / 2, h - 66);
  if (cur.mh.alt < 0) putLabel(slot, 'below', '月亮在地平線下：現在看不到（透視中）', 'hint', w / 2, mini ? h - 18 : 64);
  else if (cur.sh.alt > 0 && !mini) putLabel(slot, 'daytime', '白天也看得到月亮喔！', 'hint', w / 2, 64);
}

// ---------------- 工具列 ----------------
const TOOLS = {
  space: () => [`
    <div class="tool-group">
      ${chip('rays', '☀️ 陽光')}${chip('orbit', '⭕ 軌道')}${chip('horizon', '🟢 小人的地平面')}${chip('sight', '👁 視線')}${chip('halves', '🌓 兩個「一半」')}${chip('maria', '🗺 月海')}${chip('lockPerson', '🔒 鏡頭跟著小人')}
    </div>`, `
    <button type="button" class="chip go" id="btn-fly-in">🚀 飛進小人的眼睛</button>
    <div class="tool-group"><button type="button" class="chip" data-cam="tilt">斜看</button><button type="button" class="chip" data-cam="top">北極往下看</button><button type="button" class="chip" data-cam="side">側面看</button></div>`],
  ground: () => [`
    <div class="tool-group">
      ${chip('grid', '🧭 方位格線')}${chip('fist', '✊ 拳頭量高度')}${chip('path', '〰️ 今天的軌跡')}${chip('ghosts', '👣 每天同一時間')}${chip('seeThrough', '🫥 透視地面')}
    </div>`, `
    <div class="tool-group act-row"><button type="button" class="chip ${S.followMoon ? 'on' : ''}" id="btn-follow">🎯 跟著月亮</button><button type="button" class="chip go back" id="btn-fly-out">🛸 飛回太空</button></div>
    <div class="tool-group face-group"><span class="face-lbl">面向</span>
      <button type="button" class="chip" data-face="90">東</button><button type="button" class="chip" data-face="180">南</button><button type="button" class="chip" data-face="270">西</button><button type="button" class="chip" data-face="0">北</button>
    </div>`],
  scope: () => [`
    <div class="tool-group">${chip('maria', '🗺 月海標示（古人看成玉兔）')}</div>`, `
    <div class="tool-group"><button type="button" class="chip" data-zoom="-1">－ 縮小</button><button type="button" class="chip" data-zoom="1">＋ 放大</button></div>`]
};
function chip(k, text) { return `<button type="button" class="chip ${S.opt[k] ? 'on' : ''}" data-opt="${k}">${text}</button>`; }
function renderTools() {
  const [bottom, top] = TOOLS[S.views.main]();
  SLOTS.main.querySelector('.view-tools').innerHTML = bottom;
  SLOTS.main.querySelector('.view-actions').innerHTML = top;
  for (const [slotKey, el] of Object.entries(SLOTS)) {
    const v = S.views[slotKey];
    el.querySelector('.slot-title').textContent = VIEW_META[v].title;
    el.querySelector('.slot-sub').textContent = slotKey === 'main' ? VIEW_META[v].sub : '點一下放大';
    el.dataset.view = v;
  }
}
for (const box of SLOTS.main.querySelectorAll('.view-tools, .view-actions')) {
['pointerdown', 'wheel', 'touchstart'].forEach(t => box.addEventListener(t, e => e.stopPropagation(), { passive: true }));
box.addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.opt) {
    const k = b.dataset.opt; S.opt[k] = !S.opt[k]; b.classList.toggle('on', S.opt[k]);
    if (k === 'ghosts' && S.opt.ghosts) toast('👣 黃色淡淡的月亮＝前幾天「同一時間」的位置');
    if (k === 'lockPerson') lastObs = obsAngle(S.T);
    syncDuplicateChips(k); updateScene(); return;
  }
  if (b.dataset.face) { S.followMoon = false; animateLook(+b.dataset.face, 28); renderTools(); return; }
  if (b.dataset.cam) { setSpaceCam(b.dataset.cam); return; }
  if (b.dataset.zoom) { S.scopeZoom = THREE.MathUtils.clamp(S.scopeZoom * (b.dataset.zoom > 0 ? 1.5 : 1 / 1.5), 0.6, 5); S.dirty = true; return; }
  if (b.id === 'btn-follow') { S.followMoon = !S.followMoon; b.classList.toggle('on', S.followMoon); updateScene(); return; }
  if (b.id === 'btn-fly-in') { flyIn(); return; }
  if (b.id === 'btn-fly-out') { flyOut(); return; }
});
}
function syncDuplicateChips(k) { document.querySelectorAll(`[data-opt="${k}"]`).forEach(x => x.classList.toggle('on', S.opt[k])); }

// ---------------- 太空相機控制 ----------------
function attachControls() {
  if (controls) { controls.dispose(); controls = null; }
  if (S.views.main !== 'space') return;
  controls = new OrbitControls(spaceCam, SLOTS.main);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
  controls.minDistance = 2.2; controls.maxDistance = 70; controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.9;
  controls.target.set(0, 0, 0); controls.addEventListener('change', () => { S.dirty = true; });
  controls.update();
}
function setSpaceCam(kind) {
  const to = kind === 'top' ? new THREE.Vector3(0.01, 24, 0.6) : kind === 'side' ? new THREE.Vector3(0, 1.2, 21) : SPACE_HOME.clone();
  tween(800, t => { spaceCam.position.lerpVectors(spaceCam.position.clone(), to, t); spaceCam.lookAt(0, 0, 0); if (controls) controls.update(); S.dirty = true; });
}

// ---------------- 地面視角拖曳 ----------------
const gesture = { pts: new Map(), lastDist: 0, moved: 0 };
SLOTS.main.addEventListener('pointerdown', ev => {
  if (S.views.main === 'space') return;
  SLOTS.main.setPointerCapture(ev.pointerId); gesture.pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); gesture.moved = 0;
  if (gesture.pts.size === 2) { const [a, b] = [...gesture.pts.values()]; gesture.lastDist = Math.hypot(a.x - b.x, a.y - b.y); }
});
SLOTS.main.addEventListener('pointermove', ev => {
  if (S.views.main === 'space' || !gesture.pts.has(ev.pointerId)) return;
  const p = gesture.pts.get(ev.pointerId), dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
  if (gesture.pts.size === 2) {
    const [a, b] = [...gesture.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (gesture.lastDist) zoomBy(gesture.lastDist / d); gesture.lastDist = d; return;
  }
  if (S.views.main !== 'ground') return;
  const k = S.look.fov / SLOTS.main.clientHeight;
  S.look.az = (S.look.az - dx * k * 1.1 + 360) % 360; S.look.alt = THREE.MathUtils.clamp(S.look.alt + dy * k, -25, 88);
  if (Math.abs(dx) + Math.abs(dy) > 2 && S.followMoon) { S.followMoon = false; const fb = document.getElementById('btn-follow'); if (fb) fb.classList.remove('on'); }
  updateScene();
});
const endPtr = ev => { gesture.pts.delete(ev.pointerId); if (gesture.pts.size < 2) gesture.lastDist = 0; };
SLOTS.main.addEventListener('pointerup', endPtr); SLOTS.main.addEventListener('pointercancel', endPtr);
SLOTS.main.addEventListener('wheel', ev => { if (S.views.main === 'space') return; ev.preventDefault(); zoomBy(ev.deltaY > 0 ? 1.08 : 1 / 1.08); }, { passive: false });
function zoomBy(f) {
  if (S.views.main === 'ground') S.look.fov = THREE.MathUtils.clamp(S.look.fov * f, 28, 100);
  else if (S.views.main === 'scope') S.scopeZoom = THREE.MathUtils.clamp(S.scopeZoom / f, 0.6, 5);
  S.dirty = true;
}
function animateLook(az, alt) {
  const a0 = S.look.az, l0 = S.look.alt; let d = ((az - a0 + 540) % 360) - 180;
  tween(600, t => { S.look.az = (a0 + d * t + 360) % 360; S.look.alt = l0 + (alt - l0) * t; updateScene(); });
}

// ---------------- 小畫面點一下換成大畫面 ----------------
for (const k of ['a', 'b']) {
  let down = null;
  SLOTS[k].addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY }; });
  SLOTS[k].addEventListener('pointerup', ev => {
    if (!down || S.flying) return; if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 12) return;
    swapMain(k);
  });
}
function swapMain(k) {
  const m = S.views.main; S.views.main = S.views[k]; S.views[k] = m;
  renderTools(); attachControls(); clearLabels(); S.dirty = true;
}
function setMain(view) {
  if (S.views.main === view) return;
  const k = S.views.a === view ? 'a' : 'b'; swapMain(k);
}
function clearLabels() { for (const P of labelPools.values()) { for (const el of P.map.values()) el.remove(); P.map.clear(); } }

// ---------------- 補間動畫 ----------------
const tweens = [];
function tween(ms, fn, done) { tweens.push({ t0: performance.now(), ms, fn, done }); }
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------------- 🚀 飛進小人的眼睛 / 🛸 飛回太空 ----------------
const flyFade = SLOTS.main.querySelector('.fly-fade');
const flyCap = document.createElement('div'); flyCap.className = 'fly-caption'; SLOTS.main.appendChild(flyCap);
function caption(t) { flyCap.textContent = t; flyCap.classList.toggle('on', !!t); }
let savedSpacePose = null;
function flyIn() {
  if (S.flying) return; stopPlay(); S.flying = true;
  if (cur.mh.alt > 3) { S.look.az = cur.mh.az; S.look.alt = THREE.MathUtils.clamp(cur.mh.alt, 10, 70); } else { S.look.az = 180; S.look.alt = 28; }
  updateScene();
  savedSpacePose = spaceCam.position.clone();
  if (controls) controls.enabled = false;
  const P0 = spaceCam.position.clone();
  const pw = person.localToWorld(new THREE.Vector3(0, 0, 0));
  const up = pw.clone().normalize();
  const A = pw.clone().addScaledVector(up, 2.6).add(P0.clone().sub(pw).setLength(1.6));
  const H = person.localToWorld(new THREE.Vector3(0, 0.23, 0));
  const L = fromHoriz(S.look.az, S.look.alt, cur.B);
  caption('🚀 飛向台灣的小人…');
  const tmpT = new THREE.Vector3();
  tween(2600, t => {
    const k = ease(t);
    if (k < 0.55) { const u = ease(k / 0.55); spaceCam.position.lerpVectors(P0, A, u); spaceCam.up.set(0, 1, 0); spaceCam.lookAt(pw); }
    else {
      const u = ease((k - 0.55) / 0.45);
      spaceCam.position.lerpVectors(A, H, u);
      spaceCam.up.copy(new THREE.Vector3(0, 1, 0).lerp(up, u).normalize());
      tmpT.copy(pw).lerp(H.clone().addScaledVector(L, 10), u); spaceCam.lookAt(tmpT);
      figure.visible = u < 0.85;
      if (u > 0.55) caption('👀 抬頭看天空！');
    }
    if (t > 0.86) flyFade.classList.add('on');
    S.dirty = true;
  }, () => {
    setMain('ground');
    figure.visible = true;
    spaceCam.up.set(0, 1, 0); spaceCam.position.copy(savedSpacePose); spaceCam.lookAt(0, 0, 0);
    setTimeout(() => { flyFade.classList.remove('on'); caption(''); S.flying = false; S.dirty = true; }, 120);
    setTimeout(() => toast(`你現在站在台灣，面向${dir8(S.look.az)}方。左右滑動就能轉身！`), 400);
  });
}
function flyOut() {
  if (S.flying) return; stopPlay(); S.flying = true;
  flyFade.classList.add('on'); caption('🛸 飛回太空看全局…');
  setTimeout(() => {
    setMain('space');
    if (controls) controls.enabled = false;
    const H = person.localToWorld(new THREE.Vector3(0, 0.23, 0)), pw = person.localToWorld(new THREE.Vector3());
    const up = pw.clone().normalize(), L = fromHoriz(S.look.az, S.look.alt, cur.B);
    const P1 = (savedSpacePose || SPACE_HOME).clone();
    const A = pw.clone().addScaledVector(up, 2.6).add(P1.clone().sub(pw).setLength(1.6));
    figure.visible = false; spaceCam.position.copy(H); spaceCam.up.copy(up); spaceCam.lookAt(H.clone().addScaledVector(L, 10));
    flyFade.classList.remove('on');
    const tmpT = new THREE.Vector3();
    tween(2400, t => {
      const k = ease(t);
      if (k < 0.45) { const u = ease(k / 0.45); spaceCam.position.lerpVectors(H, A, u); spaceCam.up.copy(up.clone().lerp(new THREE.Vector3(0, 1, 0), u).normalize()); tmpT.copy(H).addScaledVector(L, 10).lerp(pw, u); spaceCam.lookAt(tmpT); figure.visible = u > 0.25; }
      else { const u = ease((k - 0.45) / 0.55); spaceCam.position.lerpVectors(A, P1, u); spaceCam.up.set(0, 1, 0); tmpT.copy(pw).lerp(new THREE.Vector3(), u); spaceCam.lookAt(tmpT); }
      S.dirty = true;
    }, () => { figure.visible = true; spaceCam.up.set(0, 1, 0); attachControls(); caption(''); S.flying = false; S.dirty = true; });
  }, 380);
}

// =====================================================================
// 介面：日期、時間、播放、預設、資訊卡
// =====================================================================
const rngDay = document.getElementById('rng-day'), rngTime = document.getElementById('rng-time'), rngSpeed = document.getElementById('rng-speed');
const lblDay = document.getElementById('lbl-day'), lblTime = document.getElementById('lbl-time'), lblSpeed = document.getElementById('lbl-speed');
{
  const ticks = document.getElementById('day-ticks');
  [[1, '🌑'], [4, '🌒'], [8, '🌓'], [11, '🌔'], [15, '🌕'], [19, '🌖'], [22, '🌗'], [26, '🌘']].forEach(([d, e]) => {
    const s = document.createElement('span'); s.textContent = e; s.style.left = ((d - 1) / 29 * 100) + '%'; ticks.appendChild(s);
  });
}
function setDay(D, opts = {}) { S.D = ((Math.round(D) - 1 + 30) % 30) + 1; if (!opts.silent) tick(); onStateChange(); }
function setTime(T) { S.T = (T >= 24 && T < 24.001) ? 24 : ((T % 24) + 24) % 24; onStateChange(); }
rngDay.addEventListener('input', () => setDay(+rngDay.value));
rngTime.addEventListener('input', () => setTime(+rngTime.value));
document.getElementById('day-prev').addEventListener('click', () => { stopPlay(); setDay(S.D - 1); });
document.getElementById('day-next').addEventListener('click', () => { stopPlay(); setDay(S.D + 1); });
document.getElementById('time-prev').addEventListener('click', () => { stopPlay(); setTime(Math.round(S.T) - 1); });
document.getElementById('time-next').addEventListener('click', () => { stopPlay(); setTime(Math.round(S.T) + 1); });
rngSpeed.addEventListener('input', () => { S.speed = +rngSpeed.value; lblSpeed.textContent = S.speed + '×'; });
document.querySelectorAll('.play').forEach(b => b.addEventListener('click', () => {
  const m = b.dataset.play; if (S.play === m) { stopPlay(); return; }
  S.play = m; acc = 0;
  if (m === 'day') { S.opt.ghosts = true; syncDuplicateChips('ghosts'); if (S.views.main === 'space' && cur.mh.alt < 0) toast('💡 換到「站在台灣看天空」更容易看出月亮每天往東移！'); }
  syncPlayUI(); updateScene();
}));
function stopPlay() { S.play = null; syncPlayUI(); }
function syncPlayUI() {
  document.querySelectorAll('.play').forEach(b => { const on = b.dataset.play === S.play; b.classList.toggle('on', on); b.querySelector('.pi').textContent = on ? '⏸' : '▶'; });
}
document.querySelectorAll('.pre').forEach(b => b.addEventListener('click', () => {
  stopPlay(); S.D = +b.dataset.d; setTime(+b.dataset.t);
  if (S.views.main === 'ground') { S.followMoon = true; renderTools(); }
}));
function onStateChange() {
  rngDay.value = S.D; rngTime.value = S.T;
  lblDay.textContent = `${lunarName(S.D)}（第 ${S.D} 天）`; lblTime.textContent = `${fmtT(S.T)} ${partOfDay(S.T)}`;
  updateScene(); renderInfo();
}

// ---------------- 音效 ----------------
let actx = null;
function tick() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime;
    o.type = 'triangle'; o.frequency.setValueAtTime(660, n); o.frequency.exponentialRampToValueAtTime(330, n + .05);
    g.gain.setValueAtTime(.06, n); g.gain.exponentialRampToValueAtTime(.001, n + .06); o.connect(g); g.connect(actx.destination); o.start(n); o.stop(n + .07);
  } catch (e) {}
}

// ---------------- 資訊卡 ----------------
const info = document.getElementById('info-card');
const phaseIcon = document.createElement('canvas'); phaseIcon.width = phaseIcon.height = 108;
function drawPhaseIcon(e) { // 北半球肉眼看到的樣子（西邊在右）
  const g = phaseIcon.getContext('2d'), r = 46, c = 54; g.clearRect(0, 0, 108, 108);
  g.fillStyle = '#1e293b'; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
  const k = Math.cos(e), waxing = Math.sin(e) >= 0;
  g.fillStyle = '#fde68a'; g.beginPath();
  g.arc(c, c, r, -Math.PI / 2, Math.PI / 2, !waxing);
  g.ellipse(c, c, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, waxing ? k > 0 : k < 0);
  g.fill(); g.strokeStyle = 'rgba(253,230,138,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke();
}
function fmtRS(T) { return T === null ? '—' : (T >= 24 ? '隔天 ' + fmtT(T - 24) : fmtT(T)); }
let infoKey = '';
function renderInfo() {
  if (!cur) return;
  const { e, mh, sh, ph, illum } = cur, eDeg = Math.round(e * 180 / Math.PI) % 360;
  const key = [S.D, Math.round(S.T * 12), S.level].join('|'); if (key === infoKey) return; infoKey = key;
  const rs = riseSet(S.D), rsPrev = riseSet(S.D === 1 ? 30 : S.D - 1);
  let delay = (rs.rise !== null && rsPrev.rise !== null) ? Math.round(((rs.rise - rsPrev.rise + 24) % 24) * 60) : null;
  const mVis = mh.alt > 0;
  const why = explain(eDeg, mh, sh);
  info.innerHTML = `
    <div class="ic-phase"><div id="ic-icon"></div><div><div class="ic-name">${ph.emoji} 農曆${lunarName(S.D)}・${ph.name}</div>
      <div class="ic-sub">${fmtT(S.T)}（${partOfDay(S.T)}）・照亮 ${Math.round(illum * 100)}%</div></div></div>
    <div class="ic-row"><span>🌙</span><span>月亮在 <b>${dir8(mh.az)}方</b>，高度角 <b>${Math.round(mh.alt)}°</b>
      ${mVis ? `<span class="ok">✅ 看得到</span>` : `<span class="no">⛔ 在地平線下</span>`}</span></div>
    <div class="ic-row"><span>☀️</span><span>太陽在 <b>${dir8(sh.az)}方</b>，高度角 <b>${Math.round(sh.alt)}°</b>${Math.abs(sh.alt) < 1.5 ? (S.T < 12 ? '（日出）' : '（日落）') : sh.alt > 0 ? '（白天）' : '（夜晚）'}</span></div>
    <div class="ic-row"><span>⏰</span><span>${rs.rise === null ? `今天<b>沒有月出</b>！月沒 <b>${fmtRS(rs.set)}</b>，下次月出在 <b>${fmtRS(rs.nextRise)}</b>（月亮每天晚約 50 分鐘升起，剛好跳過了這一天）` : `月出 <b>${fmtRS(rs.rise)}</b>・月沒 <b>${fmtRS(rs.set)}</b>`}${delay !== null ? `<br>比昨天晚了約 <b>${delay} 分鐘</b>升起` : ''}</span></div>
    <div class="ic-row only-j"><span>📐</span><span>月日夾角：月亮在太陽<b>東邊 ${eDeg}°</b>（每天約增加 12°）</span></div>
    <div class="ic-why">💡 ${why}</div>`;
  drawPhaseIcon(e); document.getElementById('ic-icon').appendChild(phaseIcon);
}
function explain(eDeg, mh, sh) {
  const J = S.level === 'j';
  let s;
  if (eDeg < 8 || eDeg > 352) s = '月亮和太陽在地球的同一邊，被照亮的那一半背對著我們，所以看不到月亮（朔）。';
  else if (eDeg > 172 && eDeg < 188) s = '月亮和太陽分別在地球的兩邊，被照亮的那一半整個朝向我們，所以是滿月；太陽下山時它剛好從東邊升起，整夜都看得到。';
  else if (eDeg < 180) s = `月亮在太陽的東邊${J ? ` ${eDeg}°` : ''}，所以亮的是<b>右邊</b>（朝向西邊的太陽）。日子一天天過去，亮的部分會越來越大。`;
  else s = `月亮在太陽的西邊${J ? ` ${360 - eDeg}°` : ''}，所以亮的是<b>左邊</b>（朝向東邊的太陽）。日子一天天過去，亮的部分會越來越小。`;
  if (mh.alt <= 0) s += ' 現在月亮在地平線下，被地球擋住了，看不到。';
  else if (sh.alt > 0) s += ' 現在是白天，月亮也在天上，白天也看得到月亮喔！';
  if (J) s += ' 月相只由「太陽—地球—月亮」的相對位置決定，跟地球的影子無關（那是月食）。';
  return s;
}

// ---------------- 程度切換 ----------------
function setLevel(lv) {
  S.level = lv; document.body.classList.toggle('lv-e', lv === 'e'); document.body.classList.toggle('lv-j', lv === 'j');
  document.querySelectorAll('#level-seg button').forEach(b => b.classList.toggle('on', b.dataset.lv === lv));
  S.opt.halves = lv === 'j'; syncDuplicateChips('halves');
  try { localStorage.setItem('MOON_LEVEL', lv); } catch (e) {}
  infoKey = ''; updateScene(); renderInfo();
}
document.querySelectorAll('#level-seg button').forEach(b => b.addEventListener('click', () => { setLevel(b.dataset.lv); toast(b.dataset.lv === 'j' ? '📐 國中模式：顯示月日夾角與「兩個一半」' : '🎒 國小模式：方位、高度角、拳頭量高度'); }));

// ---------------- 說明、全螢幕、提示 ----------------
const help = document.getElementById('help');
function openHelp() { help.classList.add('show'); }
document.getElementById('btn-help').addEventListener('click', openHelp);
document.getElementById('help-ok').addEventListener('click', () => { help.classList.remove('show'); try { localStorage.setItem('MOON_HELP_SEEN_V12', '1'); } catch (e) {} });
const fsBtn = document.getElementById('btn-fs');
fsBtn.addEventListener('click', () => {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) { toast('這台裝置不支援全螢幕；iPhone 可用「分享 → 加入主畫面」'); return; }
  try { const r = req.call(el); if (r && r.catch) r.catch(() => toast('無法進入全螢幕')); } catch (e) {}
});
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => {
  fsBtn.textContent = (document.fullscreenElement || document.webkitFullscreenElement) ? '✕ 離開全螢幕' : '⛶ 全螢幕';
  fsBtn.classList.toggle('gold', !(document.fullscreenElement || document.webkitFullscreenElement));
}));
let toastTimer = 0;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.style.display = 'none', 3200); }

// =====================================================================
// 主迴圈
// =====================================================================
let acc = 0, last = performance.now();
let CV = { x: 0, y: 0, w: 1, h: 1 };
function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left - CV.x, y: r.top - CV.y, w: r.width, h: r.height }; }
function resize() {
  const r = canvas.getBoundingClientRect();
  CV = { x: r.left, y: r.top, w: Math.max(1, r.width), h: Math.max(1, r.height) };
  renderer.setSize(CV.w, CV.h, false);
  S.dirty = true;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();
new ResizeObserver(() => resize()).observe(document.body);
new ResizeObserver(() => { S.dirty = true; }).observe(document.getElementById('stage'));
window.addEventListener('scroll', () => { window.scrollTo(0, 0); resize(); }, { passive: true });

function renderAll() {
  const cr = canvas.getBoundingClientRect();
  if (Math.abs(cr.width - CV.w) > 0.5 || Math.abs(cr.height - CV.h) > 0.5 || Math.abs(cr.top - CV.y) > 0.5) resize();
  const H = CV.h;
  renderer.setScissorTest(false); renderer.setClearColor(0x040814); renderer.clear(); renderer.setScissorTest(true);
  for (const [slotKey, el] of Object.entries(SLOTS)) {
    const r = rectOf(el); if (r.w < 4 || r.h < 4) continue;
    const view = S.views[slotKey], mini = slotKey !== 'main';
    renderer.setViewport(r.x, H - r.y - r.h, r.w, r.h); renderer.setScissor(r.x, H - r.y - r.h, r.w, r.h);
    let cam;
    if (view === 'space') { cam = spaceCam; cam.aspect = r.w / r.h; cam.updateProjectionMatrix(); renderer.render(space, cam); }
    else if (view === 'ground') { cam = groundCam; cam.aspect = r.w / r.h; aimGround(cam); if (mini) { cam.fov = Math.max(cam.fov, 80); cam.updateProjectionMatrix(); } renderer.render(sky, cam); }
    else { cam = scopeCam; cam.aspect = r.w / r.h; aimScope(cam, cam.aspect); if (mini) { cam.fov *= 1.35; cam.setViewOffset(r.w, r.h, 0, -Math.min(22, r.h * 0.1), r.w, r.h); } else cam.clearViewOffset(); cam.updateProjectionMatrix(); renderer.render(sky, cam); }
    cam.updateMatrixWorld();
    if (view === 'space') spaceLabels(el, cam, r.w, r.h, mini);
    else if (view === 'ground') groundLabels(el, cam, r.w, r.h, mini);
    else scopeLabels(el, cam, r.w, r.h, mini);
    endLabels(el);
  }
}

function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // 動畫
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i], t = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(t);
    if (t >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
  }
  if (S.play && !S.flying) {
    if (S.play === 'time') setTime((S.T >= 24 ? 0 : S.T) + dt * 2.4 * S.speed);
    else if (S.play === 'sync') { let T = (S.T >= 24 ? 0 : S.T) + dt * 3.6 * S.speed; if (T >= 24) { T -= 24; S.D = S.D % 30 + 1; } setTime(T); }
    else if (S.play === 'day') { acc += dt * S.speed; if (acc >= 0.85) { acc = 0; setDay(S.D + 1); } }
  }
  if (S.opt.rays) { rayMat.dashOffset -= dt * 2.2; S.dirty = S.dirty || S.views.main === 'space'; }
  if (controls) controls.update();
  if (S.followMoon && cur && !S.flying) {
    const half = S.look.fov / 2, tgtAz = cur.mh.alt > -3 ? cur.mh.az : S.look.az;
    const tgtAlt = THREE.MathUtils.clamp(cur.mh.alt - S.look.fov * 0.22, 22, Math.max(22, half - 7));
    const dAz = ((tgtAz - S.look.az + 540) % 360) - 180, dAlt = tgtAlt - S.look.alt;
    if (Math.abs(dAz) > 0.05 || Math.abs(dAlt) > 0.05) {
      const k = Math.min(1, dt * 5); S.look.az = (S.look.az + dAz * k + 360) % 360; S.look.alt += dAlt * k; S.dirty = true;
    }
  }
  meRing.scale.setScalar(1 + 0.25 * Math.sin(now / 300));
  if (S.dirty || tweens.length || S.play) { renderAll(); S.dirty = false; }
  requestAnimationFrame(loop);
}

// 啟動
setLevel(S.level);
renderTools(); attachControls();
onStateChange();
requestAnimationFrame(loop);
window.__moon = { S, setDay, setTime, setMain, flyIn, flyOut, computeNow, riseSet, horiz, basis, moonDir, swapMain, setLevel, cur: () => cur };
