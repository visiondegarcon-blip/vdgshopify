"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/* Shopify-Live-View-style globe: pale blue sphere, hex-grid land dots that
   pick up a teal tint near the lit top, soft green rim glow, and the actual
   Shopify visitor pin (purple disc in a cyan hexagon) as marker sprites.
   Natural drag physics: 1:1 drag, fling momentum with friction, idle spin
   eases back in after 2s of no interaction. */

export type GlobeMarker = { location: [number, number]; size: number; kind?: "visitor" | "order" };

// 256x128 equirectangular land mask (white = land) — extracted from cobe's embedded map
const LAND_MASK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAACAAQAAAADMzoqnAAAECklEQVR42u3VsW4jRRzH8d94gzfF4Q0VQaC4vBLTRTp0mze4ggfAPAE5XQEFsGNAVIjwBrmW7h7gJE+giKjyABTZE4g06LKJETdRJvtD65kdz6yduKABiW+TVfzRf2bXYxtcE/59YJCz6YdbgQF6ACSRrwYKYImmh5PbwOewlV3wlQNbAN6SEExjUOO+BU0aCSnxReHABUlK4YFQeJeUT3da8IIkZ6NGoSnFY5KsMoVzMKfECUnqxgPYRArarmUCndHwzIEaQEpg5xVdBXROl8mpAQx5dUgPiHoYAAkg5w3JABR06byGAVgcRGAz5bznj6phBQNRFwyqgdxebH6gshJAesWoFhgYpApAFoG8BIZ/fEhSox5jDjQXmV0Ar5XJfAIrALi3URVs09gHIL4XJCkLC5LH9JWiArABFCSrQjdgkBzRJ0WJeUOSNyQAfJJwUSWUBRlJQ8oGHATACGlBynnzy2kEYLNjrxouigD8BZcgOeVPqh12RtufaCN5wCPVDpvQ9lsIrqndsJtDcWqBCpf4hWN7OdWHBw58FwIaNOU/n1TpMW2DFaD48cmr4185T8NHkpUFX749pQPVdgRKC/DGoQPVeAEKv+WHvY8OOWNTPRp5kHuwSf8wzXtVBKR7YwEH9H3lQUaypUfSATOALyVNu5vZJW31Bnx98nkLfDUWJaz6ixvm+RIQRdl3kmRxxiaDoGnZW4CpPfkaQadlcPim1xOSvETQo7Lv75enVAXJ3xGUlony4KQBBWUM1NiDc6qhyS8RgQs18OCMMtPDaAUIyg0PZkRWDqs+wnKJBTDI1Js6BolegOsKmUxNDBAAKqQyMQmidhegBlLZ+wwKYdv5M/8x1khkb1cgKqP2H+MKyV5vS+whrE8DQDgAlUAoRBX056EElJCjJVACeJBZgNfVp+iCCm4RBWCgKsRxASSA9KgDhDtCiTuMyfHsKXzhC6wNAIjjWb8LKAOA2ctk3FmCOlgKFy8f1N0JJtgsxinYnVAHt4t3gPzZXSCTyCWCQmBT91QE3B5yarSN40dNHYPka4TlDhTUI8zLvl0JSL3vZn6DsCFZOeB2yROEpR68sECQQA++xIGCR2X7DwlEoLRgUrZrqlUg50S1uy43YqDcN6UFBVkhAjWiCV2Q0jgQPdplMKxvBXodcOfAwJYvgdL+1etA1YJJfBcZlQV7sO1i2gHoNiyxtQ5sBsCgWyoxCHiFFd2L5nUTCqMAqGUgsQ9f5kCcCiZgRYkMgMTd5WsB1rTzj0Em14BE4r+QxN1lCEsVur2PoF5Wbg8RJXR4djgvBgauhLywoEZQrt1KKRdVS4CdlJ8qafyP+9KIj/nE/d7kKwH9jgS72e9DV+kvfTWgct4ZyP8Byb8BPG7MaaIIkAQAAAAASUVORK5CYII=";

// Shopify GlobeVisitor pin (saved asset GlobeVisitor-9eb3af69d7c1.svg), upscaled for crispness
const PIN_SVG = `<svg width="160" height="160" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M7.125 3.63332C6.54444 3.63332 6.00799 3.94305 5.71771 4.44582L2.96771 9.20896C2.67743 9.71174 2.67743 10.3312 2.96771 10.834L5.71771 15.5971C6.00799 16.0999 6.54444 16.4096 7.125 16.4096L12.625 16.4096C13.2056 16.4096 13.742 16.0999 14.0323 15.5971L16.7823 10.834C17.0726 10.3312 17.0726 9.71174 16.7823 9.20896L14.0323 4.44582C13.742 3.94304 13.2056 3.63332 12.625 3.63332L7.125 3.63332Z" stroke="#2EB9F5" stroke-opacity="0.15" stroke-width="3.25" stroke-linejoin="round"/>
<path d="M7.125 5.25832L12.625 5.25832L15.375 10.0215L12.625 14.7846L7.125 14.7846L4.375 10.0215L7.125 5.25832Z" fill="#2EB9F5"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M10 14C12.2091 14 14 12.2091 14 10C14 7.79086 12.2091 6 10 6C7.79086 6 6 7.79086 6 10C6 12.2091 7.79086 14 10 14Z" fill="#7334E8"/>
</svg>`;

// Order marker — the purple teardrop pin Shopify drops where a sale happened
const ORDER_SVG = `<svg width="160" height="160" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M10 1.75C6.82436 1.75 4.25 4.32436 4.25 7.5C4.25 11.0312 8.13906 16.4453 9.36328 18.0625C9.68438 18.4867 10.3156 18.4867 10.6367 18.0625C11.8609 16.4453 15.75 11.0312 15.75 7.5C15.75 4.32436 13.1756 1.75 10 1.75Z" fill="#7334E8" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round"/>
<circle cx="10" cy="7.5" r="2.15" fill="#ffffff"/>
</svg>`;

const R = 1; // sphere radius

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 90) * Math.PI) / 180; // +90 so lng 0 faces camera at rotation.y 0
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    -r * Math.sin(phi) * Math.sin(theta)
  );
}

/* Build land dot positions: latitude rings with equal arc spacing and
   alternating half-step offsets (hex-grid feel), masked by the land bitmap. */
function buildLandDots(mask: ImageData): Float32Array {
  const pts: number[] = [];
  const ROWS = 130;
  const { width: mw, height: mh, data } = mask;
  const isLand = (lat: number, lng: number) => {
    const x = Math.min(mw - 1, Math.max(0, Math.floor(((lng + 180) / 360) * mw)));
    const y = Math.min(mh - 1, Math.max(0, Math.floor(((90 - lat) / 180) * mh)));
    return data[(y * mw + x) * 4] > 120;
  };
  for (let i = 0; i < ROWS; i++) {
    const lat = -90 + ((i + 0.5) / ROWS) * 180;
    const circ = Math.cos((lat * Math.PI) / 180);
    const n = Math.max(1, Math.round(ROWS * 2 * circ));
    const offset = (i % 2) * 0.5;
    for (let j = 0; j < n; j++) {
      const lng = -180 + ((j + offset) / n) * 360;
      if (!isLand(lat, lng)) continue;
      const v = latLngToVec3(lat, lng, R * 1.001);
      pts.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(pts);
}

export default function Globe3D({
  markersRef,
  zoom = 1,
  focus,
  className,
  style,
}: {
  markersRef: React.RefObject<GlobeMarker[]>;
  /** 1 = default framing; higher pulls the camera in. */
  zoom?: number;
  /** [lat, lng] to spin to the front, e.g. from the location search. */
  focus?: [number, number] | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [grabbing, setGrabbing] = useState(false);
  // read inside the frame loop without re-creating the whole scene
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const focusRef = useRef<[number, number] | null>(null);
  const focusSeq = useRef(0);
  useEffect(() => {
    // null is a meaningful value here — it's "reset view", which resumes the
    // idle spin a search had pinned
    focusRef.current = focus ?? null;
    focusSeq.current++;
  }, [focus]);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    let disposed = false;
    let raf = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    (canvas.style as CSSStyleDeclaration).touchAction = "none";
    holder.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
    camera.position.set(0, 0, 5.2);

    const globe = new THREE.Group();
    scene.add(globe);

    /* --- base sphere: very pale blue, lighter toward the lit top, subtle
           deeper blue at the limb --- */
    const sphereMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
          float lit = max(dot(vN, normalize(vec3(0.15, 0.75, 0.65))), 0.0);
          // Shopify's sphere reads as a definite pale blue, not near-white:
          // lighter toward the lit top, deepening a touch toward the bottom
          vec3 base = mix(vec3(0.780, 0.885, 0.960), vec3(0.870, 0.940, 0.990), lit);
          base = mix(base, vec3(0.700, 0.830, 0.925), fres * 0.85);   // bluish limb
          base = mix(base, vec3(0.72, 0.93, 0.83), fres * lit * 0.9); // green tint on lit rim
          gl_FragColor = vec4(base, 1.0);
        }`,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), sphereMat);
    globe.add(sphere);

    /* --- soft green rim glow (backside halo shell, screen-space normals) --- */
    const glowMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec3 vN;
        void main() {
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vN;
        void main() {
          // visible halo ring fragments (backside) have normal.z in [-0.55, 0]:
          // brightest against the sphere edge, fading outward
          float d = dot(normalize(vN), vec3(0.0, 0.0, 1.0));
          float i = pow(clamp(-d * 1.9, 0.0, 1.0), 1.6);
          gl_FragColor = vec4(vec3(0.47, 0.85, 0.62), i * 0.75);
        }`,
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 64, 64), glowMat);
    scene.add(glow); // outside globe group so it never rotates/wobbles

    /* --- land dots (built async once the mask decodes) --- */
    const dotMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uScale: { value: 1 } },
      vertexShader: `
        uniform float uScale;
        varying float vTint; varying float vFade; varying float vPolar;
        void main() {
          vec3 n = normalize(position);
          vec3 wn = normalize(mat3(modelMatrix) * n);
          vTint = smoothstep(0.45, 1.0, dot(wn, normalize(vec3(0.05, 0.9, 0.45))));
          // Antarctica reads noticeably more indigo than the rest of the land
          vPolar = smoothstep(-0.78, -0.95, n.y);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 vn = normalize(normalMatrix * n);
          vFade = smoothstep(-0.15, 0.25, vn.z); // fade dots as they wrap the limb
          gl_PointSize = uScale * (32.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vTint; varying float vFade; varying float vPolar;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          float a = (1.0 - smoothstep(0.40, 0.5, r)) * vFade;
          if (a < 0.02) discard;
          vec3 blue = vec3(0.470, 0.680, 0.885);
          vec3 teal = vec3(0.345, 0.815, 0.660);
          vec3 polar = vec3(0.545, 0.600, 0.855);
          vec3 c = mix(blue, teal, vTint);
          gl_FragColor = vec4(mix(c, polar, vPolar), a * 0.95);
        }`,
    });
    let dotPoints: THREE.Points | null = null;
    const maskImg = new Image();
    maskImg.onload = () => {
      if (disposed) return;
      const c = document.createElement("canvas");
      c.width = maskImg.width;
      c.height = maskImg.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(maskImg, 0, 0);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(buildLandDots(ctx.getImageData(0, 0, c.width, c.height)), 3)
      );
      dotPoints = new THREE.Points(geo, dotMat);
      globe.add(dotPoints);
    };
    maskImg.src = LAND_MASK;

    /* --- marker sprites: cyan hexagon for live visitors (Shopify's
           GlobeVisitor asset), purple teardrop for orders --- */
    const makeTex = (svg: string) => {
      const tex = new THREE.Texture();
      const im = new Image();
      im.onload = () => { tex.image = im; tex.needsUpdate = true; };
      im.src = "data:image/svg+xml;base64," + btoa(svg);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const pinTex = makeTex(PIN_SVG);
    const orderTex = makeTex(ORDER_SVG);
    const pinGroup = new THREE.Group();
    globe.add(pinGroup);
    const sprites: THREE.Sprite[] = [];
    let markersKey = "";
    const syncMarkers = () => {
      // __globeTestMarkers: dev/test override for visually verifying pins
      const override =
        typeof window !== "undefined"
          ? (window as unknown as { __globeTestMarkers?: GlobeMarker[] }).__globeTestMarkers
          : undefined;
      const markers = override ?? markersRef.current ?? [];
      const key = JSON.stringify(markers);
      if (key === markersKey) return;
      markersKey = key;
      while (sprites.length > markers.length) {
        const s = sprites.pop()!;
        pinGroup.remove(s);
        s.material.dispose();
      }
      while (sprites.length < markers.length) {
        const mat = new THREE.SpriteMaterial({ map: pinTex, depthTest: true, transparent: true });
        const s = new THREE.Sprite(mat);
        pinGroup.add(s);
        sprites.push(s);
      }
      markers.forEach((m, i) => {
        const s = sprites[i];
        s.position.copy(latLngToVec3(m.location[0], m.location[1], R * 1.03));
        s.userData.size = m.size;
        s.userData.order = m.kind === "order";
        const want = s.userData.order ? orderTex : pinTex;
        if (s.material.map !== want) {
          s.material.map = want;
          s.material.needsUpdate = true;
        }
      });
    };

    /* --- physics state --- */
    const rot = { phi: 0.8, theta: 0.25 }; // start roughly over Australia (phi = (-180 - lng)deg)
    let phiVel = 0; // rad/frame momentum
    let dragging = false;
    let spinPaused = false; // set by a search fly-to, cleared on the next grab
    let lastInteraction = -1e9;
    const IDLE_SPIN = 0.0016; // rad/frame
    const FRICTION = 0.95;
    const MAX_THETA = 0.85;
    let radPerPx = 0.005;
    const drag = {
      startX: 0,
      startY: 0,
      basePhi: 0,
      baseTheta: 0,
      lastPhi: 0,
      samples: [] as { t: number; phi: number }[],
    };

    const down = (e: PointerEvent) => {
      dragging = true;
      spinPaused = false;
      setGrabbing(true);
      canvas.setPointerCapture(e.pointerId);
      // capture current rotation as base — no snap when grabbing mid-spin
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.basePhi = rot.phi;
      drag.baseTheta = rot.theta;
      drag.lastPhi = rot.phi;
      drag.samples = [{ t: performance.now(), phi: rot.phi }];
      phiVel = 0;
      lastInteraction = performance.now();
      // 1:1 feel: dragging across the sphere's screen radius rotates ~1 rad
      const rect = canvas.getBoundingClientRect();
      const sphereScreenR = (rect.height / 2) * 0.78; // sphere fills ~78% of frame half-height
      radPerPx = 1 / sphereScreenR;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      rot.phi = drag.basePhi + (e.clientX - drag.startX) * radPerPx;
      rot.theta = Math.min(
        MAX_THETA,
        Math.max(-MAX_THETA, drag.baseTheta + (e.clientY - drag.startY) * radPerPx)
      );
      const now = performance.now();
      drag.samples.push({ t: now, phi: rot.phi });
      while (drag.samples.length > 2 && now - drag.samples[0].t > 90) drag.samples.shift();
      lastInteraction = now;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      setGrabbing(false);
      lastInteraction = performance.now();
      // fling: convert recent pointer motion to angular velocity (rad/frame @60fps)
      const s = drag.samples;
      if (s.length >= 2) {
        const a = s[0];
        const b = s[s.length - 1];
        const dt = Math.max(1, b.t - a.t);
        phiVel = ((b.phi - a.phi) / dt) * (1000 / 60);
        const MAX_V = 0.25;
        phiVel = Math.min(MAX_V, Math.max(-MAX_V, phiVel));
      }
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    /* --- resize --- */
    const resize = () => {
      const w = holder.clientWidth;
      const h = holder.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dotMat.uniforms.uScale.value = (h / 640) * renderer.getPixelRatio();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(holder);
    resize();

    /* --- frame loop --- */
    let pulse = 0;
    let seenFocus = 0;
    let flyTo: { phi: number; theta: number } | null = null;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      pulse += 0.05;

      // camera distance follows the zoom prop, eased so +/- taps feel smooth
      const targetZ = 5.2 / Math.max(0.5, Math.min(3, zoomRef.current));
      camera.position.z += (targetZ - camera.position.z) * 0.12;

      // a new search result queues a fly-to; it counts as an interaction so
      // idle spin doesn't immediately drag the target back off-centre
      if (focusSeq.current !== seenFocus) {
        seenFocus = focusSeq.current;
        if (!focusRef.current) {
          spinPaused = false; // reset view
          flyTo = null;
        } else {
        const [lat, lng] = focusRef.current;
        // a point's azimuth works out to (lng + 180), so this rotation puts it
        // dead centre — same relation as the initial Australia framing below
        let want = (-180 - lng) * (Math.PI / 180);
        // take the shortest way round rather than unwinding several turns
        want += Math.round((rot.phi - want) / (Math.PI * 2)) * Math.PI * 2;
        flyTo = { phi: want, theta: Math.max(-MAX_THETA, Math.min(MAX_THETA, (lat * Math.PI) / 180)) };
        phiVel = 0;
        // hold still on the searched location — drifting it back off-screen a
        // couple of seconds later defeats the point of searching for it
        spinPaused = true;
        lastInteraction = performance.now();
        }
      }
      if (flyTo) {
        rot.phi += (flyTo.phi - rot.phi) * 0.08;
        rot.theta += (flyTo.theta - rot.theta) * 0.08;
        lastInteraction = performance.now();
        if (Math.abs(flyTo.phi - rot.phi) < 0.002 && Math.abs(flyTo.theta - rot.theta) < 0.002) flyTo = null;
      }
      if (dragging) flyTo = null; // grabbing the globe cancels the animation

      if (!dragging && !flyTo) {
        rot.phi += phiVel;
        phiVel *= FRICTION;
        // idle spin eases back in after 2s without interaction
        if (!spinPaused && performance.now() - lastInteraction > 2000) {
          phiVel += (IDLE_SPIN - phiVel) * 0.015;
        }
      }
      globe.rotation.set(rot.theta, rot.phi, 0, "XYZ");
      syncMarkers();
      const beat = 1 + 0.12 * Math.sin(pulse);
      const camDir = new THREE.Vector3();
      camera.getWorldPosition(camDir).normalize();
      const wp = new THREE.Vector3();
      for (const s of sprites) {
        const base = 0.075 + s.userData.size * 0.4;
        // only live visitors pulse — an order pin marks a fixed past event
        s.scale.setScalar(s.userData.order ? base * 1.05 : base * beat);
        // hide pins that have rotated to the far side
        s.getWorldPosition(wp).normalize();
        s.visible = wp.dot(camDir) > 0.08;
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      sphere.geometry.dispose();
      sphereMat.dispose();
      glow.geometry.dispose();
      glowMat.dispose();
      dotPoints?.geometry.dispose();
      dotMat.dispose();
      for (const s of sprites) s.material.dispose();
      pinTex.dispose();
      orderTex.dispose();
      renderer.dispose();
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={holderRef}
      className={className}
      style={{ cursor: grabbing ? "grabbing" : "grab", ...style }}
    />
  );
}
