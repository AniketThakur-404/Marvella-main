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
const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
};
const polygonBBox = (pts) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    w: Math.ceil(maxX - minX),
    h: Math.ceil(maxY - minY),
  };
};

/* ----------------------- COMPONENT ----------------------- */
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

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [selectedShade, setSelectedShade] = useState(LIPSTICK_SHADES[0]);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  const selectedColorRef = useRef(selectedShade.color);
  useEffect(() => { selectedColorRef.current = selectedShade.color; }, [selectedShade]);

  useEffect(() => {
    const { style } = document.body;
    const prev = style.overflow;
    style.overflow = "hidden";
    return () => { style.overflow = prev; };
  }, []);

  /* Load MediaPipe */
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

  /* Camera */
  const stopCamera = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    if (!scriptLoaded) { setError("Resources are still loading, please try again in a moment."); return; }
    setError(""); setStarted(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await new Promise((r) => { video.onloadedmetadata = () => { video.play(); r(); }; });

      // DPR-correct canvas
      const canvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.round(video.videoWidth  * dpr);
      canvas.height = Math.round(video.videoHeight * dpr);
      canvas.style.width  = `${video.videoWidth}px`;
      canvas.style.height = `${video.videoHeight}px`;

      startProcessing();
    } catch (e) {
      console.error(e);
      setError("Camera access is required. Please allow camera permissions and refresh.");
      setStarted(false);
    }
  };

  /* Processing Loop */
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
      const vw = video.videoWidth, vh = video.videoHeight;
      const dpr = window.devicePixelRatio || 1;

      // clear & draw camera (mirrored)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, vw, vh);

      // smoothing
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
        drawLipstickExactHex(ctx, landmarks, vw, vh, {
          color: selectedColorRef.current,
          dpr,
          EDGE_FEATHER_PX: 1.2, // soft edge; bump to 1.6 if needed
          SHINE: 0.0,           // keep 0 for *identical* look to swatch
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

  const getLipPoints = (landmarks, indices, w, h) =>
    indices.map((i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));

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

  /* -------- EXACT HEX RENDERER (1:1 with bullet) -------- */
  const drawLipstickExactHex = (ctx, landmarks, w, h, opts) => {
    const hex = (opts.color || "").toLowerCase();
    if (hex === "transparent") return;

    // Geometry in CSS px
    const upO = getLipPoints(landmarks, UPPER_LIP_OUTER, w, h);
    const loO = getLipPoints(landmarks, LOWER_LIP_OUTER, w, h);
    const upI = getLipPoints(landmarks, UPPER_LIP_INNER, w, h);
    const loI = getLipPoints(landmarks, LOWER_LIP_INNER, w, h);

    // Guard tiny lips (prevents frame recolor)
    const outline = [...upO, ...loO.slice().reverse()];
    const lipArea = calculatePolygonArea(outline);
    const areaRatio = lipArea / (w * h || 1);
    if (!Number.isFinite(areaRatio) || areaRatio < MIN_LIP_AREA_RATIO) return;

    // Build even-odd path
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

    // 1) Solid fill with the exact hex
    const solid = document.createElement("canvas");
    solid.width = bbox.w; solid.height = bbox.h;
    const solx = solid.getContext("2d");
    solx.fillStyle = hex;
    solx.fillRect(0, 0, bbox.w, bbox.h);

    // 2) Feathered mask off-screen (avoid halo/overlap)
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

    // 3) Apply mask to the solid color
    solx.save();
    solx.globalCompositeOperation = "destination-in";
    solx.drawImage(blurred, 0, 0);
    solx.restore();

    // 4) Composite once onto the main canvas
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(solid, bbox.x, bbox.y);
    ctx.restore();

    // Optional micro-shine (keep 0 for perfect equality to the bullet)
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
    <div className="fixed inset-0 bg-gray-900 font-sans flex items-center justify-center">
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <video ref={videoRef} className="hidden" playsInline muted />
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
              className="px-6 py-3 text-base sm:px-8 sm:py-4 sm:text-lg bg-white text-black rounded-full font-semibold transform hover:scale-105 transition-transform"
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
                      style={{ backgroundColor: shade.color === "transparent" ? "#4a4a4a" : shade.color }}
                      title={shade.name}
                    >
                      {shade.id === 0 && <div className="w-full h-0.5 bg-red-500 transform rotate-45"></div>}
                    </button>
                    <div
                      className={`absolute -bottom-2 h-1 w-1 rounded-full bg-red-500 transition-opacity ${
                        selectedShade.id === shade.id ? "opacity-100" : "opacity-0"
                      }`}
                    ></div>
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
                <button
                  onClick={takeSnapshot}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white p-1.5 shadow-lg active:scale-95 transition-transform"
                >
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
