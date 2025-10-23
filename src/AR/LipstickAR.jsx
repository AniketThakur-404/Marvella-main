import React, { useEffect, useRef, useState } from "react";

/* -------------------------- KEEP YOUR SHADE DATA -------------------------- */
const LIPSTICK_SHADES = [
  { id: 0, name: "N/A", color: "transparent" },
  { id: 1, name: "Scarlet Siren", color: "#B82229" },
  { id: 2, name: "Rouge Eternelle", color: "#8D1D27" },
  { id: 3, name: "Power Play", color: "#631820" },
  { id: 4, name: "Spiced Silk", color: "#A64D3E" },
  { id: 5, name: "Bare Bloom", color: "#D18A68" },
  { id: 6, name: "Peach Tantra", color: "#F2A36E" },
  { id: 7, name: "Rose Flame", color: "#C95A6C" },
  { id: 8, name: "Whisper Nude", color: "#C79082" },
  { id: 9, name: "Bloom Creme", color: "#D24E71" },
  { id: 10, name: "Berry Amour", color: "#8A3832" },
  { id: 11, name: "Cinnamon Saffron", color: "#B64A29" },
  { id: 12, name: "Oud Royale", color: "#431621" },
  { id: 13, name: "Velvet Crush", color: "#C22A2D" },
  { id: 14, name: "Spiced Ember", color: "#A03529" },
  { id: 15, name: "Creme Blush", color: "#CF5F4C" },
  { id: 16, name: "Caramel Eclair", color: "#C77444" },
  { id: 17, name: "Rose Fantasy", color: "#C25D6A" },
  { id: 18, name: "Mauve Memoir", color: "#A86267" },
  { id: 19, name: "Rouge Mistral", color: "#94373F" },
  { id: 20, name: "Flushed Fig", color: "#9A4140" },
  { id: 21, name: "Terracotta Dream", color: "#C5552F" },
  { id: 22, name: "Nude Myth", color: "#AF705A" },
  { id: 23, name: "Runway Rani", color: "#D13864" },
];

const UPPER_LIP_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LOWER_LIP_OUTER = [146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
const UPPER_LIP_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_LIP_INNER = [95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

/* -------------------------- TUNABLE EXPERIENCE --------------------------- */
const BASE_SMOOTHING = 0.70;
const MIN_LIP_SMOOTHING = 0.40;
const MAX_LIP_SMOOTHING = 0.92;
const POSITION_SNAP_THRESHOLD = 0.006;

// Visuals
const EDGE_FEATHER_PX = 0.9;
const BASE_OPACITY = 0.84;
const SHADOW_BOOST = 0.20;
const DPR_LIMIT = 2;

// Performance
const COLORIZE_EVERY_N_FRAMES = 1;
const MAX_BBOX_PAD = 8;

/* -------------------------- LIP VISIBILITY GATING ------------------------ */
const LIP_ON_FRAMES = 2;
const LIP_OFF_FRAMES = 2;      // faster hide fallback
const MIN_LIP_AREA_PCT = 0.0006;
const MAX_LIP_AREA_PCT = 0.12;
const MAX_LIP_ASPECT = 12;
const STICKY_HOLD_FRAMES = 4;  // shorter grace window

/* ------------------------- OCCLUSION HEURISTICS -------------------------- */
// If any trigger, hide instantly.
const AREA_EMA_ALPHA = 0.25;         // EMA smoothing for lip area
const OCCL_AREA_DROP = 0.35;         // >35% area drop vs EMA => occlusion
const OCCL_JITTER_THRESH = 0.03;     // centroid jump >3% of diag
const OCCL_Z_STD_THRESH = 0.012;     // depth noise high
// Hand overlap: if hand bbox overlaps >=10% of lip bbox area => occluded
const HAND_OVERLAP_RATIO = 0.10;
const HAND_BBOX_PAD_PX = 10;

/* -------------------------- UTILITY: COLOR SPACE ------------------------- */
function hexToRgb(hex) {
  if (hex === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16), a: 255 }
    : { r: 200, g: 0, b: 0, a: 255 };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb(h, s, l) {
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/* ---------------------------- GEOMETRY HELPERS --------------------------- */
const LIP_LANDMARK_INDICES = new Set([
  ...UPPER_LIP_OUTER, ...LOWER_LIP_OUTER, ...UPPER_LIP_INNER, ...LOWER_LIP_INNER,
]);

function smoothPolyline(points, iterations = 1) {
  let pts = points.slice();
  for (let k = 0; k < iterations; k++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      const Q = { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y };
      const R = { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y };
      out.push(Q, R);
    }
    pts = out;
  }
  return pts;
}
function makePathFromRings(outerPts, innerPts) {
  const path = new Path2D();
  path.moveTo(outerPts[0].x, outerPts[0].y);
  for (let i = 1; i < outerPts.length; i++) path.lineTo(outerPts[i].x, outerPts[i].y);
  path.closePath();
  if (innerPts && innerPts.length) {
    path.moveTo(innerPts[0].x, innerPts[0].y);
    for (let i = 1; i < innerPts.length; i++) path.lineTo(innerPts[i].x, innerPts[i].y);
    path.closePath();
  }
  return path;
}
function computeBBox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}
function rectFromPoints(points) {
  const b = computeBBox(points);
  return { x: b.x, y: b.y, w: b.w, h: b.h };
}
function rectPad(r, pad) {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}
function rectArea(r) { return Math.max(0, r.w) * Math.max(0, r.h); }
function rectIntersectArea(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  return w * h;
}

/* ------------------------------ NEW HELPERS ------------------------------ */
function polygonArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x * points[i].y) - (points[i].x * points[j].y);
  }
  return Math.abs(area) * 0.5;
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function lipsArePresent(outer_px, frameW, frameH) {
  if (!outer_px || outer_px.length < 8) return false;

  const bbox = computeBBox(outer_px);
  if (bbox.w < 4 || bbox.h < 4) return false;

  const bleed = 2;
  const inFrame = bbox.x >= -bleed && bbox.y >= -bleed &&
                  bbox.x + bbox.w <= frameW + bleed &&
                  bbox.y + bbox.h <= frameH + bleed;
  if (!inFrame) return false;

  const aspect = Math.max(bbox.w / bbox.h, bbox.h / bbox.w);
  if (aspect > MAX_LIP_ASPECT) return false;

  const polyArea = polygonArea(outer_px);
  const pct = polyArea / (frameW * frameH);
  if (pct < MIN_LIP_AREA_PCT || pct > MAX_LIP_AREA_PCT) return false;

  return true;
}
function computeCentroid(points) {
  let sx = 0, sy = 0;
  for (const p of points) { sx += p.x; sy += p.y; }
  return { x: sx / points.length, y: sy / points.length };
}
function stddev(arr) {
  if (!arr.length) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

/* ------------------------------ MOBILE HELPERS --------------------------- */
function isiOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

async function ensureVideoReady(video) {
  // Required on iOS to avoid fullscreen & autoplay blocks
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("muted", "");
  video.setAttribute("autoplay", "");
  video.muted = true;

  try { await video.play(); } catch (_) {}

  if (video.readyState >= 2) return;
  await new Promise((resolve) => {
    const onCanPlay = () => { video.removeEventListener("canplay", onCanPlay); resolve(); };
    video.addEventListener("canplay", onCanPlay, { once: true });
  });
}

async function tryOpenStream() {
  // Try a few constraint fallbacks for Android/iOS
  const tries = [
    { video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } }, audio: false },
    { video: { facingMode: "user" }, audio: false },
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: true, audio: false },
  ];
  let lastError = null;
  for (const c of tries) {
    try { return await navigator.mediaDevices.getUserMedia(c); } catch (e) { lastError = e; }
  }
  throw lastError || new Error("getUserMedia failed");
}

/* ------------------------------ COMPONENT -------------------------------- */
export default function VirtualTryOn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const backCanvasRef = useRef(null);

  const faceMeshRef = useRef(null);
  const handsRef = useRef(null);

  const streamRef = useRef(null);
  const afRef = useRef(null);

  const latestResultsRef = useRef(null);        // face landmarks
  const latestHandsRef = useRef(null);          // hands landmarks

  const sendingFaceRef = useRef(false);
  const sendingHandsRef = useRef(false);

  const lastGoodLandmarksRef = useRef(null);
  const smoothedLandmarksRef = useRef(null);
  const frameCountRef = useRef(0);

  const maskCanvasRef = useRef(null);
  const [fmLoaded, setFmLoaded] = useState(false);
  const [handsLoaded, setHandsLoaded] = useState(false);
  const allLoaded = fmLoaded && handsLoaded;

  const [started, setStarted] = useState(false);
  const [selectedShade, setSelectedShade] = useState(LIPSTICK_SHADES[0]);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  const selectedColorRef = useRef(selectedShade.color);
  useEffect(() => { selectedColorRef.current = selectedShade.color; }, [selectedShade]);

  const showMakeupRef = useRef(false);
  const goodStreakRef = useRef(0);
  const badStreakRef = useRef(0);
  const holdFramesRef = useRef(0);

  // Occlusion refs
  const occlAreaEmaRef = useRef(null);
  const occlCentroidEmaRef = useRef(null);
  const occlStreakRef = useRef(0);

  useEffect(() => {
    const { style } = document.body;
    const prev = style.overflow;
    style.overflow = "hidden";
    return () => { style.overflow = prev; };
  }, []);

  // Load FaceMesh
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
    script.crossOrigin = "anonymous";
    script.async = true;
    script.defer = true;
    script.onload = () => setFmLoaded(true);
    script.onerror = () => setError("Failed to load FaceMesh. Check network/HTTPS.");
    document.head.appendChild(script);
    return () => { if (script && script.parentNode) script.parentNode.removeChild(script); };
  }, []);

  // Load Hands
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
    script.crossOrigin = "anonymous";
    script.async = true;
    script.defer = true;
    script.onload = () => setHandsLoaded(true);
    script.onerror = () => setError("Failed to load Hands. Check network/HTTPS.");
    document.head.appendChild(script);
    return () => { if (script && script.parentNode) script.parentNode.removeChild(script); };
  }, []);

  // Init FaceMesh when loaded
  useEffect(() => {
    if (!fmLoaded || !window.FaceMesh) return;
    const faceMesh = new window.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
      selfieMode: false, // we handle mirroring ourselves
    });
    faceMesh.onResults((results) => {
      latestResultsRef.current = results;
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        lastGoodLandmarksRef.current = results.multiFaceLandmarks[0];
      }
    });
    faceMeshRef.current = faceMesh;
    return () => faceMeshRef.current?.close?.();
  }, [fmLoaded]);

  // Init Hands when loaded
  useEffect(() => {
    if (!handsLoaded || !window.Hands) return;
    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0, // mobile friendly
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
      selfieMode: false, // we handle mirroring ourselves
    });
    hands.onResults((results) => { latestHandsRef.current = results; });
    handsRef.current = hands;
    return () => handsRef.current?.close?.();
  }, [handsLoaded]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stopCamera();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  function stopCamera() {
    // Stop frame loop
    if (afRef.current) {
      if ("cancelVideoFrameCallback" in HTMLVideoElement.prototype && videoRef.current?.cancelVideoFrameCallback) {
        try { videoRef.current.cancelVideoFrameCallback(afRef.current); } catch {}
      } else {
        cancelAnimationFrame(afRef.current);
      }
      afRef.current = null;
    }

    // Stop tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    smoothedLandmarksRef.current = null;
    showMakeupRef.current = false;
    goodStreakRef.current = 0;
    badStreakRef.current = LIP_OFF_FRAMES;
    holdFramesRef.current = 0;

    // Reset occlusion state
    occlAreaEmaRef.current = null;
    occlCentroidEmaRef.current = null;
    occlStreakRef.current = 0;

    window.removeEventListener("resize", setupCanvas);
    window.removeEventListener("orientationchange", setupCanvas);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera not supported in this browser. Try Chrome/Edge on Android or Safari 15+ on iOS.");
      return;
    }
    if (!allLoaded) {
      setError("Models are loading—please try again in a moment.");
      return;
    }

    setError("");
    setStarted(true);

    try {
      stopCamera();

      // 1) Open stream with fallbacks (helps Android WebView & iOS)
      const stream = await tryOpenStream();
      streamRef.current = stream;

      // 2) Bind to video and make iOS happy
      const video = videoRef.current;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("muted", "");
      video.setAttribute("autoplay", "");
      video.muted = true;
      video.srcObject = stream;

      // 3) Ensure the video can play (iOS can delay metadata)
      await ensureVideoReady(video);

      setupCanvas();
      startProcessing();

      window.addEventListener("resize", setupCanvas);
      window.addEventListener("orientationchange", setupCanvas);
    } catch (e) {
      console.error(e);
      const msg = String(e?.name || e?.message || e);
      if (/NotAllowedError|Permission/i.test(msg)) {
        setError(
          isiOS()
            ? "Camera permission denied. Go to Settings > Safari > Camera and allow access, then reload."
            : "Camera permission denied. Allow camera permissions in your browser and reload."
        );
      } else if (/NotFoundError|DevicesNotFound/i.test(msg)) {
        setError("No camera device found.");
      } else if (/OverconstrainedError|Constraint/i.test(msg)) {
        setError("Camera constraints not supported. Trying a simpler setup might help.");
      } else {
        setError("Camera access failed. Ensure you're on HTTPS and using a supported mobile browser.");
      }
      setStarted(false);
      stopCamera();
    }
  }

  function setupCanvas() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const DPR = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.max(2, Math.floor(w * DPR));
    canvas.height = Math.max(2, Math.floor(h * DPR));

    // Use willReadFrequently to avoid iOS memory spikes when calling getImageData
    const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (!backCanvasRef.current) backCanvasRef.current = document.createElement("canvas");
    backCanvasRef.current.width = canvas.width;
    backCanvasRef.current.height = canvas.height;

    if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement("canvas");
  }

  function startProcessing() {
    const video = videoRef.current;
    const frontCanvas = canvasRef.current;
    const frontCtx = frontCanvas.getContext("2d", { willReadFrequently: true });
    const backCanvas = backCanvasRef.current;
    const backCtx = backCanvas.getContext("2d", { willReadFrequently: true });
    const DPR = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);

    const step = async () => {
      if (!video || !faceMeshRef.current || !handsRef.current) return;

      if (video.readyState >= 2 && !sendingFaceRef.current) {
        try { sendingFaceRef.current = true; await faceMeshRef.current.send({ image: video }); }
        finally { sendingFaceRef.current = false; }
      }
      if (video.readyState >= 2 && !sendingHandsRef.current) {
        try { sendingHandsRef.current = true; await handsRef.current.send({ image: video }); }
        finally { sendingHandsRef.current = false; }
      }

      const w = frontCanvas.width / DPR;
      const h = frontCanvas.height / DPR;

      backCtx.setTransform(1, 0, 0, 1, 0, 0);
      backCtx.clearRect(0, 0, backCanvas.width, backCanvas.height);
      // Mirror draw to match getLipPointsPx()
      backCtx.setTransform(-DPR, 0, 0, DPR, backCanvas.width, 0);
      backCtx.drawImage(video, 0, 0, w, h);

      const raw = latestResultsRef.current?.multiFaceLandmarks?.[0] || null;
      if (raw) {
        if (!smoothedLandmarksRef.current) {
          smoothedLandmarksRef.current = raw.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 }));
        } else {
          for (let i = 0; i < raw.length; i++) {
            const s = smoothedLandmarksRef.current[i];
            const c = raw[i];
            let blend = BASE_SMOOTHING;
            if (LIP_LANDMARK_INDICES.has(i)) {
              const dx = c.x - s.x, dy = c.y - s.y;
              const planar = Math.hypot(dx, dy);
              const ratio = Math.min(1, planar / POSITION_SNAP_THRESHOLD);
              blend = MIN_LIP_SMOOTHING + (MAX_LIP_SMOOTHING - MIN_LIP_SMOOTHING) * ratio;
            }
            s.x += (c.x - s.x) * blend;
            s.y += (c.y - s.y) * blend;
            s.z += (c.z - s.z) * (blend * 0.5);
          }
        }
      } else {
        smoothedLandmarksRef.current = null;
      }

      const drawLm = smoothedLandmarksRef.current || lastGoodLandmarksRef.current;
      if (drawLm) {
        const outerU = getLipPoints(drawLm, UPPER_LIP_OUTER, w, h);
        const outerL = getLipPoints(drawLm, LOWER_LIP_OUTER, w, h);
        const innerU = getLipPoints(drawLm, UPPER_LIP_INNER, w, h);
        const innerL = getLipPoints(drawLm, LOWER_LIP_INNER, w, h);

        const outerRing = smoothPolyline([...outerU, ...outerL.slice().reverse()], 1);
        const innerRing = smoothPolyline([...innerU, ...innerL.slice().reverse()], 1);

        const outerU_px = getLipPointsPx(drawLm, UPPER_LIP_OUTER, w, h);
        const outerL_px = getLipPointsPx(drawLm, LOWER_LIP_OUTER, w, h);
        const innerU_px = getLipPointsPx(drawLm, UPPER_LIP_INNER, w, h);
        const innerL_px = getLipPointsPx(drawLm, LOWER_LIP_INNER, w, h);

        const outer_px = smoothPolyline([...outerU_px, ...outerL_px.slice().reverse()], 1);
        const inner_px = smoothPolyline([...innerU_px, ...innerL_px.slice().reverse()], 1);

        const hasRaw = !!latestResultsRef.current?.multiFaceLandmarks?.[0];
        const lipsVisibleNow = hasRaw && lipsArePresent(outer_px, w, h);

        // Hand bboxes (mirrored to match video draw)
        const handBoxes = getHandBBoxesMirrored(latestHandsRef.current, w, h, HAND_BBOX_PAD_PX);
        const lipRect = rectFromPoints(outer_px);
        const lipArea = rectArea(lipRect);
        const handOverlapNow = handBoxes.some((hb) => {
          const ia = rectIntersectArea(hb, lipRect);
          return ia >= lipArea * HAND_OVERLAP_RATIO;
        });

        // -------------------- OCCLUSION DETECTION --------------------
        // 1) Area drop vs EMA
        const outerArea = polygonArea(outer_px); // px^2
        if (occlAreaEmaRef.current == null) occlAreaEmaRef.current = outerArea;
        occlAreaEmaRef.current =
          occlAreaEmaRef.current * (1 - AREA_EMA_ALPHA) + outerArea * AREA_EMA_ALPHA;
        const areaDrop = outerArea < occlAreaEmaRef.current * (1 - OCCL_AREA_DROP);

        // 2) Centroid jitter
        const cNow = computeCentroid(outer_px);
        const diag = Math.hypot(w, h);
        if (occlCentroidEmaRef.current == null) occlCentroidEmaRef.current = { ...cNow };
        occlCentroidEmaRef.current.x += (cNow.x - occlCentroidEmaRef.current.x) * 0.25;
        occlCentroidEmaRef.current.y += (cNow.y - occlCentroidEmaRef.current.y) * 0.25;
        const jitter =
          Math.hypot(cNow.x - occlCentroidEmaRef.current.x, cNow.y - occlCentroidEmaRef.current.y) / diag;
        const jitterSpike = jitter > OCCL_JITTER_THRESH;

        // 3) Depth noise
        const lipZ = Array.from(LIP_LANDMARK_INDICES).map((i) => (drawLm[i].z || 0));
        const zStd = stddev(lipZ);
        const zNoisy = zStd > OCCL_Z_STD_THRESH;

        const occludedNow = hasRaw && (handOverlapNow || areaDrop || jitterSpike || zNoisy);
        if (occludedNow || !lipsVisibleNow) occlStreakRef.current++;
        else occlStreakRef.current = 0;

        // Hand-over-mouth OR any occlusion signal => one-frame instant hide
        const HARD_OCCLUSION = handOverlapNow || occlStreakRef.current >= 1;
        // -------------------------------------------------------------

        if (lipsVisibleNow && !HARD_OCCLUSION) {
          goodStreakRef.current = Math.min(LIP_ON_FRAMES, goodStreakRef.current + 1);
          badStreakRef.current = 0;
          holdFramesRef.current = STICKY_HOLD_FRAMES; // only when not occluded
        } else {
          badStreakRef.current = Math.min(LIP_OFF_FRAMES, badStreakRef.current + 1);
          goodStreakRef.current = 0;
          if (holdFramesRef.current > 0) holdFramesRef.current--;
        }

        if (HARD_OCCLUSION) {
          holdFramesRef.current = 0;
          showMakeupRef.current = false; // INSTANT HIDE
        }

        const gatedVisible = (lipsVisibleNow && !HARD_OCCLUSION) || holdFramesRef.current > 0;

        if (!showMakeupRef.current && gatedVisible && goodStreakRef.current >= LIP_ON_FRAMES) {
          showMakeupRef.current = true;
        }
        if (showMakeupRef.current && !gatedVisible && badStreakRef.current >= LIP_OFF_FRAMES) {
          showMakeupRef.current = false;
        }

        if (selectedColorRef.current !== "transparent" && showMakeupRef.current) {
          const path = makePathFromRings(outerRing, innerRing);
          backCtx.globalCompositeOperation = "multiply";
          backCtx.globalAlpha = 0.28;
          backCtx.fillStyle = selectedColorRef.current;
          backCtx.filter = "none";
          backCtx.fill(path, "evenodd");
          backCtx.globalAlpha = 1;
          backCtx.globalCompositeOperation = "source-over";
        }

        if (selectedColorRef.current !== "transparent" && showMakeupRef.current) {
          if (frameCountRef.current % COLORIZE_EVERY_N_FRAMES === 0) {
            const bbox = computeBBox(outer_px);
            const pad = Math.min(MAX_BBOX_PAD, Math.max(2, Math.round(Math.max(bbox.w, bbox.h) * 0.04)));
            const bx = Math.max(0, Math.floor(bbox.x - pad));
            const by = Math.max(0, Math.floor(bbox.y - pad));
            const bw = Math.min(w - bx, Math.ceil(bbox.w + pad * 2));
            const bh = Math.min(h - by, Math.ceil(bbox.h + pad * 2));

            const sx = Math.floor(bx * DPR), sy = Math.floor(by * DPR);
            const sw = Math.max(1, Math.floor(bw * DPR)), sh = Math.max(1, Math.floor(bh * DPR));
            const frame = backCtx.getImageData(sx, sy, sw, sh);

            const mCanvas = maskCanvasRef.current;
            mCanvas.width = sw; mCanvas.height = sh;
            const mctx = mCanvas.getContext("2d", { willReadFrequently: true });
            mctx.setTransform(1, 0, 0, 1, 0, 0);
            mctx.clearRect(0, 0, sw, sh);
            mctx.save();
            const toDevice = (p) => ({ x: Math.round((p.x - bx) * DPR), y: Math.round((p.y - by) * DPR) });
            const outerD = outer_px.map(toDevice);
            const innerD = inner_px.map(toDevice);
            const maskPath = makePathFromRings(outerD, innerD);
            mctx.filter = `blur(${EDGE_FEATHER_PX * DPR}px)`;
            mctx.fillStyle = "#fff";
            mctx.fill(maskPath, "evenodd");
            mctx.restore();
            const mask = mctx.getImageData(0, 0, sw, sh);

            const { r: tr, g: tg, b: tb } = hexToRgb(selectedColorRef.current);
            const thsl = rgbToHsl(tr, tg, tb);
            const data = frame.data;
            const mdata = mask.data;
            for (let i = 0; i < data.length; i += 4) {
              const ma = mdata[i + 3] / 255;
              if (ma < 0.01) continue;
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const { l } = rgbToHsl(r, g, b);
              const a = clamp01(BASE_OPACITY + SHADOW_BOOST * (0.5 - l)) * ma;
              const nrgb = hslToRgb(thsl.h, thsl.s, l);
              data[i]   = Math.round(nrgb.r * a + r * (1 - a));
              data[i+1] = Math.round(nrgb.g * a + g * (1 - a));
              data[i+2] = Math.round(nrgb.b * a + b * (1 - a));
            }
            backCtx.setTransform(1, 0, 0, 1, 0, 0);
            backCtx.putImageData(frame, sx, sy);
          }
          frameCountRef.current++;
        }
      }

      frontCtx.setTransform(1, 0, 0, 1, 0, 0);
      frontCtx.clearRect(0, 0, frontCanvas.width, frontCanvas.height);
      frontCtx.drawImage(backCanvas, 0, 0);

      if ("requestVideoFrameCallback" in HTMLVideoElement.prototype && videoRef.current?.requestVideoFrameCallback) {
        afRef.current = videoRef.current.requestVideoFrameCallback(() => step());
      } else {
        afRef.current = requestAnimationFrame(step);
      }
    };

    step();
  }

  function getLipPoints(landmarks, indices, w, h) {
    return indices.map((i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
  }
  function getLipPointsPx(landmarks, indices, w, h) {
    // Mirror X to align with mirrored video draw
    return indices.map((i) => ({ x: (w - landmarks[i].x * w), y: landmarks[i].y * h }));
  }

  // Build hand bboxes in mirrored pixel space (to match getLipPointsPx & draw)
  function getHandBBoxesMirrored(handsResults, w, h, padPx = 0) {
    const boxes = [];
    if (!handsResults || !handsResults.multiHandLandmarks) return boxes;
    for (const lmArr of handsResults.multiHandLandmarks) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const lm of lmArr) {
        const x = w - (lm.x * w); // MIRROR
        const y = lm.y * h;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const r = { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
      boxes.push(rectPad(r, padPx));
    }
    return boxes;
  }

  function takeSnapshot() {
    const canvas = canvasRef.current;
    if (canvas) {
      const DPR = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
      const tmp = document.createElement("canvas");
      tmp.width = Math.floor(canvas.width / DPR);
      tmp.height = Math.floor(canvas.height / DPR);
      const tctx = tmp.getContext("2d");
      tctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
      setSnapshot(tmp.toDataURL("image/png"));
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900 font-sans flex items-center justify-center touch-manipulation select-none">
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <video ref={videoRef} className="hidden" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="max-w-full max-h-full object-cover rounded-lg" />

        {snapshot && (
          <div className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center p-4">
            <img
              src={snapshot}
              alt="Lipstick Try-On Snapshot"
              className="max-w-full max-h-[75%] rounded-lg shadow-2xl border-4 border-white"
            />
            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setSnapshot(null)}
                className="px-5 py-2 sm:px-6 bg-gray-700 text-white rounded-full font-semibold hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <a
                href={snapshot}
                download="lipstick-try-on.png"
                className="px-5 py-2 sm:px-6 bg-white text-black rounded-full font-semibold hover:bg-gray-200 transition-colors"
              >
                Download
              </a>
            </div>
          </div>
        )}

        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 p-4">
            <button
              onClick={startCamera}
              className="px-6 py-3 text-base sm:px-8 sm:py-4 sm:text-lg bg-white text-black rounded-full font-semibold transform hover:scale-105 active:scale-100 transition-transform"
            >
              Start Virtual Try-On
            </button>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 z-20">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 sm:px-6 sm:py-4 rounded-xl text-center w-11/12 max-w-md">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          </div>
        )}

        {started && !snapshot && (
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-black/30 z-10">
            <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 md:gap-5">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {LIPSTICK_SHADES.map((shade) => (
                  <div key={shade.id} className="relative flex flex-col items-center">
                    <button
                      onClick={() => setSelectedShade(shade)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-transform duration-200 ease-in-out border border-white/30 flex items-center justify-center overflow-hidden
                        ${selectedShade.id === shade.id ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-black/50" : "hover:scale-110"}`}
                      style={{ backgroundColor: shade.color === 'transparent' ? '#4a4a4a' : shade.color }}
                      title={shade.name}
                    >
                      {shade.id === 0 && <div className="w-full h-0.5 bg-red-500 transform rotate-45"></div>}
                    </button>
                    <div
                      className={`absolute -bottom-2 h-1 w-1 rounded-full bg-red-500 transition-opacity ${selectedShade.id === shade.id ? "opacity-100" : "opacity-0"}`}
                    />
                  </div>
                ))}
              </div>
              <div className="w-full max-w-md flex items-center justify-around text-white">
                <button className="p-2 md:p-3 hover:bg-white/10 rounded-full">
                  <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>
                </button>
                <button className="p-2 md:p-3 hover:bg-white/10 rounded-full">
                  <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 18a6 6 0 0 0 0-12v12z"></path></svg>
                </button>
                <button onClick={takeSnapshot} className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white p-1.5 shadow-lg active:scale-95 transition-transform">
                  <div className="w-full h-full rounded-full border-2 border-black"></div>
                </button>
                <button className="p-2 md:p-3 hover:bg-white/10 rounded-full">
                  <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>
                </button>
                <button className="p-2 md:p-3 hover:bg-white/10 rounded-full">
                  <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
