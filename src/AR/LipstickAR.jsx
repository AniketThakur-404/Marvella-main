import React, { useEffect, useRef, useState } from "react";

/* ----------------------- SHADES ----------------------- */
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

/* ----------------------- LANDMARKS ----------------------- */
const UPPER_LIP_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LOWER_LIP_OUTER = [146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
const UPPER_LIP_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_LIP_INNER = [95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

/* ----------------------- SMOOTHING / GUARDS ----------------------- */
const SMOOTHING_FACTOR = 0.72;
const MIN_LIP_SMOOTHING = 0.4;
const MAX_LIP_SMOOTHING = 0.92;
const POSITION_SNAP_THRESHOLD = 0.006;
const MAX_LANDMARK_AGE_MS = 160;
const MIN_LIP_AREA_RATIO = 0.00006;

const LIP_LANDMARK_INDICES = new Set([
  ...UPPER_LIP_OUTER,
  ...LOWER_LIP_OUTER,
  ...UPPER_LIP_INNER,
  ...LOWER_LIP_INNER,
]);

/* ----------------------- HELPERS ----------------------- */
const polygonBBox = (pts) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: Math.floor(minX), y: Math.floor(minY), w: Math.ceil(maxX - minX), h: Math.ceil(maxY - minY) };
};

export default function LipstickAR() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  const latestLandmarksRef = useRef(null);
  const lastGoodLandmarksRef = useRef(null);
  const smoothedLandmarksRef = useRef(null);
  const lastLandmarkTimestampRef = useRef(0);

  // viewport + video sizing
  const viewRef = useRef({ vw: 0, vh: 0, scale: 1, ox: 0, oy: 0, dpr: 1 });

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [selectedShade, setSelectedShade] = useState(LIPSTICK_SHADES[0]);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  const selectedColorRef = useRef(selectedShade.color);
  useEffect(() => { selectedColorRef.current = selectedShade.color; }, [selectedShade]);

  // block body scroll behind the app
  useEffect(() => {
    const { style } = document.body;
    const prev = style.overflow;
    style.overflow = "hidden";
    return () => { style.overflow = prev; };
  }, []);

  // load MediaPipe
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
    script.crossOrigin = "anonymous";
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  useEffect(() => {
    if (!scriptLoaded) return;
    const faceMesh = new window.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMeshRef.current = faceMesh;
    return () => {
      stopCamera();
      if (faceMeshRef.current?.close) faceMeshRef.current.close();
    };
  }, [scriptLoaded]);

  const stopCamera = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const computeViewport = () => {
    // CSS pixels of the app area (minus safe areas handled by Tailwind padding)
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    // mobile performance cap for DPR
    const isMobile = cssW <= 768 || /Mobi|Android/i.test(navigator.userAgent);
    const dprCap = isMobile ? 1.5 : 2.0;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);

    const canvas = canvasRef.current;
    if (!canvas || !videoRef.current) return;

    // set canvas buffer size in device pixels, style size in CSS px
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    // if we know video size, compute cover scale & offsets
    const vw = videoRef.current.videoWidth || 1280;
    const vh = videoRef.current.videoHeight || 720;

    // cover: fill the screen, preserving aspect
    const scale = Math.max(cssW / vw, cssH / vh);
    const drawW = vw * scale;
    const drawH = vh * scale;
    // offsets BEFORE mirroring
    const ox = (cssW - drawW) / 2;
    const oy = (cssH - drawH) / 2;

    viewRef.current = { vw, vh, scale, ox, oy, dpr };
  };

  const startCamera = async () => {
    if (!scriptLoaded) { setError("Resources are still loading, please try again in a moment."); return; }
    setError(""); setStarted(true);
    try {
      stopCamera();
      const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          // modest defaults for mobile to keep FPS high
          width:  { ideal: isMobile ? 960 : 1920 },
          height: { ideal: isMobile ? 540 : 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await new Promise((r) => { video.onloadedmetadata = () => { video.play(); r(); }; });

      computeViewport();
      startProcessing();

      // keep layout responsive on rotation / resize
      window.addEventListener("resize", computeViewport, { passive: true });
      window.addEventListener("orientationchange", computeViewport, { passive: true });
    } catch (e) {
      console.error(e);
      setError("Camera access is required. Please allow camera permissions and refresh.");
      setStarted(false);
    }
  };

  const startProcessing = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    faceMeshRef.current.onResults((results) => {
      latestLandmarksRef.current = results;
      if (results.multiFaceLandmarks?.length) {
        const now = performance?.now?.() ?? Date.now();
        lastLandmarkTimestampRef.current = now;
        lastGoodLandmarksRef.current = results.multiFaceLandmarks[0].map(({ x, y, z }) => ({ x, y, z }));
      }
    });

    const processFrame = async () => {
      if (!videoRef.current) return;

      if (video.readyState >= 4) await faceMeshRef.current.send({ image: video });

      const now = performance?.now?.() ?? Date.now();
      const { vw, vh, scale, ox, oy, dpr } = viewRef.current;
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;

      // draw mirrored video with cover fit
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.save();
      ctx.scale(dpr, dpr);

      // mirror: translate to right edge, flip X
      ctx.translate(viewW, 0);
      ctx.scale(-1, 1);

      // when mirrored, X is from right, so x = viewW - ox - drawW
      const drawW = vw * scale;
      const drawH = vh * scale;
      const dx = viewW - ox - drawW;
      const dy = oy;

      ctx.drawImage(video, dx, dy, drawW, drawH);

      const raw = latestLandmarksRef.current?.multiFaceLandmarks?.[0];
      if (raw) {
        lastLandmarkTimestampRef.current = now;
        if (!smoothedLandmarksRef.current) {
          smoothedLandmarksRef.current = JSON.parse(JSON.stringify(raw));
        } else {
          for (let i = 0; i < raw.length; i++) {
            const s = smoothedLandmarksRef.current[i];
            const c = raw[i];
            let blend = SMOOTHING_FACTOR;
            if (LIP_LANDMARK_INDICES.has(i)) {
              const planar = Math.hypot(c.x - s.x, c.y - s.y);
              const ratio = Math.min(1, planar / POSITION_SNAP_THRESHOLD);
              blend = MIN_LIP_SMOOTHING + (MAX_LIP_SMOOTHING - MIN_LIP_SMOOTHING) * ratio;
            }
            s.x += (c.x - s.x) * blend;
            s.y += (c.y - s.y) * blend;
            s.z += (c.z - s.z) * blend * 0.5;
          }
        }
      } else if (now - lastLandmarkTimestampRef.current > MAX_LANDMARK_AGE_MS) {
        smoothedLandmarksRef.current = null;
        lastGoodLandmarksRef.current = null;
      }

      const isFresh = now - lastLandmarkTimestampRef.current <= MAX_LANDMARK_AGE_MS;
      const landmarks = isFresh ? smoothedLandmarksRef.current || lastGoodLandmarksRef.current : null;

      if (landmarks) {
        drawLipstickExactHex(ctx, landmarks, {
          vw, vh, scale, ox, oy, viewW, viewH,
          EDGE_FEATHER_PX: 1.2,
          SHINE: 0.0,
        });
      }

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    if (canvas) setSnapshot(canvas.toDataURL("image/png"));
  };

  // map normalized landmarks -> CSS px after cover fit + mirror
  const getLipPoints = (landmarks, indices, geom) => {
    const { vw, vh, scale, ox, oy, viewW } = geom;
    return indices.map((i) => {
      const nx = landmarks[i].x * vw * scale;          // non-mirrored scaled x
      const ny = landmarks[i].y * vh * scale;
      const x = viewW - ox - nx;                        // mirrored x
      const y = oy + ny;
      return { x, y };
    });
  };

  const calculatePolygonArea = (points) => {
    if (!points || points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) / 2;
  };

  /* -------- EXACT HEX RENDERER (1:1 with bullet), geometry-aware -------- */
  const drawLipstickExactHex = (ctx, landmarks, geom, opts) => {
    const hex = (selectedColorRef.current || "").toLowerCase();
    if (hex === "transparent") return;

    const upO = getLipPoints(landmarks, UPPER_LIP_OUTER, geom);
    const loO = getLipPoints(landmarks, LOWER_LIP_OUTER, geom);
    const upI = getLipPoints(landmarks, UPPER_LIP_INNER, geom);
    const loI = getLipPoints(landmarks, LOWER_LIP_INNER, geom);

    const outline = [...upO, ...loO.slice().reverse()];
    const lipArea = calculatePolygonArea(outline);
    const areaRatio = lipArea / (geom.viewW * geom.viewH || 1);
    if (!Number.isFinite(areaRatio) || areaRatio < MIN_LIP_AREA_RATIO) return;

    const path = new Path2D();
    path.moveTo(upO[0].x, upO[0].y);
    for (let i = 1; i < upO.length; i++) path.lineTo(upO[i].x, upO[i].y);
    for (let i = loO.length - 1; i >= 0; i--) path.lineTo(loO[i].x, loO[i].y);
    path.closePath();

    const mouth = new Path2D();
    mouth.moveTo(upI[0].x, upI[0].y);
    for (let i = 1; i < upI.length; i++) mouth.lineTo(upI[i].x, upI[i].y);
    for (let i = loI.length - 1; i >= 0; i--) mouth.lineTo(loI[i].x, loI[i].y);
    mouth.closePath();
    path.addPath(mouth);

    const bbox = polygonBBox([...upO, ...loO]);
    if (bbox.w <= 0 || bbox.h <= 0) return;

    // solid fill buffer
    const solid = document.createElement("canvas");
    solid.width = bbox.w; solid.height = bbox.h;
    const solx = solid.getContext("2d");
    solx.fillStyle = hex;
    solx.fillRect(0, 0, bbox.w, bbox.h);

    // feathered mask
    const mask = document.createElement("canvas");
    mask.width = bbox.w; mask.height = bbox.h;
    const mx = mask.getContext("2d");
    mx.translate(-bbox.x, -bbox.y);
    mx.fillStyle = "#fff";
    mx.fill(path, "evenodd");
    mx.setTransform(1, 0, 0, 1, 0, 0);

    mx.filter = `blur(${opts.EDGE_FEATHER_PX ?? 1.2}px)`;
    const blurred = document.createElement("canvas");
    blurred.width = bbox.w; blurred.height = bbox.h;
    const bx = blurred.getContext("2d");
    bx.drawImage(mask, 0, 0);

    // apply mask
    solx.save();
    solx.globalCompositeOperation = "destination-in";
    solx.drawImage(blurred, 0, 0);
    solx.restore();

    // composite once
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(solid, bbox.x, bbox.y);
    ctx.restore();

    // optional micro-shine (keep 0 for exact match)
    const SHINE = Math.max(0, Math.min(1, opts.SHINE ?? 0.0));
    if (SHINE > 0) {
      const midTop = upO[5], midBot = loO[4];
      const g = ctx.createLinearGradient(midTop.x, midTop.y, midBot.x, midBot.y + 10);
      g.addColorStop(0.0, `rgba(255,255,255,${0.04 * SHINE})`);
      g.addColorStop(0.4, `rgba(255,255,255,${0.025 * SHINE})`);
      g.addColorStop(1.0, "rgba(255,255,255,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = g;
      ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
      ctx.restore();
    }
  };

  /* ----------------------- UI ----------------------- */
  return (
    <div className="fixed inset-0 bg-black">
      <div className="relative w-full h-full">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="w-full h-full object-cover" />

        {/* Snapshot overlay */}
        {snapshot && (
          <div className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center p-4">
            <img
              src={snapshot}
              alt="Lipstick Try-On Snapshot"
              className="max-w-full max-h-[75%] rounded-lg shadow-2xl border-4 border-white"
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSnapshot(null)}
                className="px-5 py-2 bg-gray-700 text-white rounded-full font-semibold"
              >
                Back
              </button>
              <a
                href={snapshot}
                download="lipstick-try-on.png"
                className="px-5 py-2 bg-white text-black rounded-full font-semibold"
              >
                Download
              </a>
            </div>
          </div>
        )}

        {/* Start overlay */}
        {!started && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-20 p-safe pb-[calc(env(safe-area-inset-bottom,0)+24px)]">
            <button
              onClick={startCamera}
              className="px-6 py-4 text-lg bg-white text-black rounded-full font-semibold"
            >
              Start Virtual Try-On
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 z-20">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-center w-11/12 max-w-md">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          </div>
        )}

        {/* Controls */}
        {started && !snapshot && (
          <div className="absolute inset-x-0 bottom-0 z-10">
            {/* Shade row — horizontally scrollable, large touch targets, safe-area padding */}
            <div className="px-3 pb-[calc(env(safe-area-inset-bottom,0)+76px)] pt-3">
              <div className="mx-auto max-w-screen-md">
                <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory px-1"
                     style={{ WebkitOverflowScrolling: "touch" }}>
                  {LIPSTICK_SHADES.map((shade) => (
                    <button
                      key={shade.id}
                      onClick={() => setSelectedShade(shade)}
                      className={`min-w-11 min-h-11 w-11 h-11 md:w-12 md:h-12 rounded-full border border-white/40 flex-shrink-0 snap-start transition-transform
                        ${selectedShade.id === shade.id ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-black/40" : "active:scale-105"}`}
                      style={{ backgroundColor: shade.color === "transparent" ? "#4a4a4a" : shade.color }}
                      title={shade.name}
                    >
                      {shade.id === 0 && (
                        <div className="w-full h-0.5 bg-red-500 rotate-45" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent h-40" />
            <div className="absolute inset-x-0 bottom-0 pb-[calc(env(safe-area-inset-bottom,0)+16px)]">
              <div className="mx-auto max-w-screen-md flex items-center justify-around text-white px-6">
                <button className="p-3 rounded-full bg-white/10 backdrop-blur pointer-events-auto">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                </button>
                <button
                  onClick={takeSnapshot}
                  className="pointer-events-auto w-18 h-18 md:w-20 md:h-20 rounded-full bg-white p-1.5 shadow-lg active:scale-95"
                  aria-label="Take snapshot"
                >
                  <div className="w-full h-full rounded-full border-2 border-black" />
                </button>
                <button className="p-3 rounded-full bg-white/10 backdrop-blur pointer-events-auto">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
