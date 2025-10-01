// src/components/LipstickAR.jsx
import React, { useEffect, useRef, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";

/* ---------------- Lip landmark indices (MediaPipe) ---------------- */
/* Single outer ring that surrounds both lips */
/* ---------------- Lip landmark indices (MediaPipe) ---------------- */
/* A more detailed outline of the full vermilion border of both lips */
const LIP_OUTER_RING = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84,
  181, 91, 146,
];
/* A complete inner ring for the entire mouth opening */
const LIP_INNER_RING = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87,
  178, 88, 95,
];

/* ---------------- Presets ---------------- */
const PRESETS = [
  { name: "Classic Red", val: "#D22B2B" },
  { name: "Soft Pink",   val: "#D46A8F" },
  { name: "True Nude",   val: "#C99B86" },
  { name: "Berry",       val: "#6B214A" },
  { name: "Coral",       val: "#FF6F4D" },
  { name: "Violet",      val: "#7B4B9B" },
];

const QUALITY = {
  saver:    { w: 640,  h: 360,  fps: 24 },
  balanced: { w: 960,  h: 540,  fps: 24 },
  high:     { w: 1280, h: 720,  fps: 30 },
  ultra:    { w: 1920, h: 1080, fps: 30 }, // careful on mobiles
};

export default function LipstickAR() {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const meshRef   = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const smoothRef = useRef(null); // smoothed landmarks

  /* Core state */
  const [started, setStarted]   = useState(false);
  const [running, setRunning]   = useState(true);
  const [mirror,  setMirror]    = useState(true);
  const [err,     setErr]       = useState("");

  /* Visuals */
  const [shade,     setShade]     = useState(PRESETS[0].val);
  const [opacity,   setOpacity]   = useState(0.85);
  const [finish,    setFinish]    = useState("satin"); // matte | satin | gloss
  const [edgeSoft,  setEdgeSoft]  = useState(0.6);     // px blur for soft edge
  const [maskGrow,  setMaskGrow]  = useState(2);       // px outward dilation
  const [innerTite, setInnerTite] = useState(0.12);    // 0..0.35 shrink inner hole
  const [smoothA,   setSmoothA]   = useState(0.65);    // EMA smoothing (0..0.95)
  const [debug,     setDebug]     = useState(false);

  /* Camera */
  const [quality, setQuality] = useState("high");
  const [facing,  setFacing]  = useState("user");
  const [devices, setDevices] = useState([]);
  const [deviceId,setDeviceId]= useState("");

  /* Scan UX */
  const [scan, setScan] = useState(0);
  const [calibrated, setCalibrated] = useState(false);

  const dims = QUALITY[quality] || QUALITY.balanced;

  /* ---------------- Init FaceMesh & devices ---------------- */
  useEffect(() => {
    const fm = new FaceMesh({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });
    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    meshRef.current = fm;

    navigator.mediaDevices?.enumerateDevices?.()
      .then(all => {
        const cams = all.filter(d => d.kind === "videoinput");
        setDevices(cams);
        if (!deviceId && cams[0]) setDeviceId(cams[0].deviceId || "");
      })
      .catch(()=>{});

    return () => {
      stopLoop();
      stopStream();
      try { fm.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- React to param changes ---------------- */
  useEffect(() => { if (started) startLoop(); },
    [started, running, mirror, opacity, shade, finish, edgeSoft, maskGrow, innerTite, smoothA, debug]);
  useEffect(() => { if (started) startCamera(); }, [deviceId, quality, facing]);

  /* ---------------- Camera helpers ---------------- */
  const stopStream = () => {
    try { streamRef.current?.getTracks?.().forEach(t => t.stop()); } catch {}
    streamRef.current = null;
  };
  const stopLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };
  const buildConstraints = () => {
    const v = {
      width: { ideal: dims.w }, height: { ideal: dims.h },
      frameRate: { ideal: dims.fps, max: dims.fps },
      facingMode: facing,
    };
    if (deviceId) v.deviceId = { exact: deviceId };
    return { video: v, audio: false };
  };

  async function startCamera() {
    setErr(""); setCalibrated(false); setScan(0); smoothRef.current = null;
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia(buildConstraints());
      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream; await v.play();
      setStarted(true); setRunning(true);
      // refresh labels post-permission
      navigator.mediaDevices.enumerateDevices()
        .then(all => setDevices(all.filter(d => d.kind === "videoinput")));
    } catch (e) {
      console.error(e);
      setErr("Camera permission blocked or no camera found.");
      setStarted(false);
    }
  }

  /* ---------------- Geometry helpers ---------------- */
  const toPx = (lm, idx, vw, vh) => {
    const p = lm[idx]; if (!p) return null;
    const x = (mirror ? (1 - p.x) : p.x) * vw;
    const y = p.y * vh;
    return { x, y };
  };

  const polygonCenter = (pts) => {
    if (!pts.length) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    for (const p of pts) { sx += p.x; sy += p.y; }
    return { x: sx / pts.length, y: sy / pts.length };
  };

  // Shrink/expand polygon around its centroid (factor < 1 shrinks)
  const scalePolygon = (pts, factor) => {
    const c = polygonCenter(pts);
    return pts.map(p => ({ x: c.x + (p.x - c.x) * factor, y: c.y + (p.y - c.y) * factor }));
  };

  // Build a smooth closed path using midpoint quadratic curves (simple, stable)
  const buildSmoothClosedPath = (pts) => {
    const n = pts.length;
    const path = new Path2D();
    if (n < 2) return path;
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const p0 = pts[0];
    const p1 = pts[1 % n];
    let m0 = mid(p0, p1);

    path.moveTo(m0.x, m0.y);
    for (let i = 1; i <= n; i++) {
      const pA = pts[i % n];
      const pB = pts[(i + 1) % n];
      const mA = mid(pA, pB);
      path.quadraticCurveTo(pA.x, pA.y, mA.x, mA.y);
    }
    path.closePath();
    return path;
  };

  // Combined ring path (outer then inner) to use with even-odd rule
  const buildRingEvenOdd = (outerPts, innerPts) => {
    const ring = new Path2D();
    if (outerPts.length) ring.addPath?.(buildSmoothClosedPath(outerPts)) || (() => {
      const p = buildSmoothClosedPath(outerPts);
      // Fallback for older browsers without addPath
      const tmp = document.createElement("canvas").getContext("2d");
      tmp?.fill(p);
    })();
    if (innerPts.length) ring.addPath?.(buildSmoothClosedPath(innerPts)) || (() => {
      const p = buildSmoothClosedPath(innerPts);
      const tmp = document.createElement("canvas").getContext("2d");
      tmp?.fill(p);
    })();
    return ring;
  };

  /* ---------------- Drawing loop ---------------- */
  const startLoop = () => {
    const v = videoRef.current, c = canvasRef.current, ctx = c.getContext("2d");

    const onResults = (res) => {
      const vw = v.videoWidth || dims.w, vh = v.videoHeight || dims.h;
      if (c.width !== vw) c.width = vw;
      if (c.height !== vh) c.height = vh;

      ctx.clearRect(0,0,vw,vh);
      ctx.save();
      if (mirror) { ctx.translate(vw,0); ctx.scale(-1,1); }
      ctx.drawImage(v,0,0,vw,vh);
      ctx.restore();

      const faces = res.multiFaceLandmarks || [];
      if (!faces.length) { setScan(s => Math.max(0, s-1)); return; }

      // --- Smooth landmarks (EMA) ---
      const raw = faces[0];
      const prev = smoothRef.current;
      const a = smoothA;
      const sm = new Array(raw.length);
      if (!prev) {
        for (let i=0;i<raw.length;i++) sm[i] = { x: raw[i].x, y: raw[i].y };
      } else {
        for (let i=0;i<raw.length;i++) sm[i] = {
          x: prev[i].x*a + raw[i].x*(1-a),
          y: prev[i].y*a + raw[i].y*(1-a),
        };
      }
      smoothRef.current = sm;

      if (!calibrated) {
        setScan(s => Math.min(25, s+1));
        if (scan >= 18) setCalibrated(true);
      }

      // --- Build lip rings (in pixels) ---
      const outerPts = LIP_OUTER_RING.map(i => toPx(sm, i, vw, vh)).filter(Boolean);
      let innerPts   = LIP_INNER_RING.map(i => toPx(sm, i, vw, vh)).filter(Boolean);

      // Tighten inner hole so it never removes upper lip
      const innerScale = Math.max(0.55, 1 - innerTite); // clamp
      innerPts = scalePolygon(innerPts, innerScale);

      // Main mask (outer minus inner) using even-odd rule + smooth curves
      const ring = buildRingEvenOdd(outerPts, innerPts);

      // Draw lipstick
      ctx.save();
      ctx.filter = `blur(${edgeSoft}px)`;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = shade;
      ctx.globalCompositeOperation = (finish === "satin") ? "multiply" : "source-over";
      ctx.fill(ring, "evenodd");

      // Optional dilation: expand outward a few px to cover thin gaps/cupid bow
      if (maskGrow > 0.01) {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.strokeStyle = shade;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = maskGrow * 2; // stroke grows equally in/out
        // stroke ONLY outer to expand exterior boundary
        const outerSmooth = buildSmoothClosedPath(outerPts);
        ctx.stroke(outerSmooth);

        // punch inner again to keep mouth opening clean
        ctx.globalCompositeOperation = "destination-out";
        const innerSmooth = buildSmoothClosedPath(innerPts);
        ctx.lineWidth = maskGrow * 2;
        ctx.stroke(innerSmooth);

        // restore normal comp for any next ops
        ctx.globalCompositeOperation = "source-over";
      }

      // Gloss highlight
      if (finish === "gloss" || finish === "satin") {
        ctx.globalAlpha = Math.min(1, opacity * 0.22);
        ctx.fillStyle = "#fff";
        // across upper central lip (between 61 and 291 via 14)
        const pL = toPx(sm, 61, vw, vh);
        const pC = toPx(sm, 14, vw, vh);   // philtrum area
        const pR = toPx(sm, 291, vw, vh);
        if (pL && pC && pR) {
          const hi = new Path2D();
          hi.moveTo(pL.x, pL.y);
          hi.quadraticCurveTo(pC.x, pC.y - 2, pR.x, pR.y);
          hi.closePath();
          ctx.fill(hi);
        }
      }

      // Debug overlay
      if (debug) {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,200,255,0.9)";
        ctx.stroke(buildSmoothClosedPath(outerPts));
        ctx.strokeStyle = "rgba(255,0,120,0.9)";
        ctx.stroke(buildSmoothClosedPath(innerPts));
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        for (const p of outerPts) {
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();

      // Scan overlay while calibrating
      if (!calibrated) {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(0,0,vw,vh);
        const pct = Math.round((scan/25)*100);
        const w = Math.max(60, vw*0.4), h = 10, x = (vw-w)/2, y = vh*0.85;
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(x,y,w,h);
        ctx.fillStyle = "#fff"; ctx.fillRect(x,y,(w*pct)/100,h);
        ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto";
        ctx.fillStyle = "#111"; ctx.fillText("Align face — scanning…", x, y-8);
        ctx.restore();
      }
    };

    meshRef.current.onResults(onResults);

    const tick = async () => {
      if (running && videoRef.current?.readyState >= 2) {
        try { await meshRef.current.send({ image: videoRef.current }); } catch {}
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    stopLoop(); tick();
  };

  /* ---------------- Actions ---------------- */
  const takeShot = () => {
    try {
      const url = canvasRef.current.toDataURL("image/png");
      const a = document.createElement("a"); a.href = url; a.download = "lipstick-ar.png"; a.click();
    } catch {}
  };
  const start = () => startCamera();
  const stop  = () => { setStarted(false); stopLoop(); stopStream(); };

  /* ---------------- UI ---------------- */
  return (
    <div className="w-full bg-white rounded-xl shadow border p-4">
      {/* Video & Canvas */}
      <div className="relative w-full max-w-4xl mx-auto">
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="w-full h-auto rounded-lg" />

        {!started && !err && (
          <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-gray-700">
                Allow camera to try lipstick shades. Processing stays on your device.
              </p>
              <button onClick={start} className="px-4 py-2 rounded-lg border shadow-sm bg-white">
                Start Lipstick Test
              </button>
            </div>
          </div>
        )}
        {err && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">{err}</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Shades */}
        <div>
          <label className="block text-sm font-medium mb-2">Preset shades</label>
          <div className="grid grid-cols-6 gap-2">
            {PRESETS.map(s => (
              <button key={s.val} title={s.name} onClick={()=>setShade(s.val)}
                style={{ background: s.val }}
                className={`h-10 rounded-md border ${shade===s.val?"ring-2 ring-offset-1":""}`} />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input type="color" value={shade} onChange={(e)=>setShade(e.target.value)}
                   className="w-12 h-10 p-0 border rounded" />
            <input type="text" value={shade} onChange={(e)=>setShade(e.target.value)}
                   className="flex-1 px-3 py-2 border rounded text-sm" placeholder="#D22B2B" />
          </div>

          <label className="block text-sm font-medium mt-4">Opacity</label>
          <input type="range" min="0.1" max="1" step="0.05" value={opacity}
                 onChange={(e)=>setOpacity(Number(e.target.value))} className="w-full" />
          <div className="text-sm text-gray-600 mt-1">{Math.round(opacity*100)}%</div>
        </div>

        {/* Finish & mask behaviour */}
        <div>
          <label className="block text-sm font-medium mb-2">Finish</label>
          <select value={finish} onChange={(e)=>setFinish(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
            <option value="matte">Matte</option>
            <option value="satin">Satin</option>
            <option value="gloss">Gloss</option>
          </select>

          <label className="block text-sm font-medium mt-4">Edge softness</label>
          <input type="range" min="0" max="3" step="0.1" value={edgeSoft}
                 onChange={(e)=>setEdgeSoft(Number(e.target.value))} className="w-full" />
          <div className="text-sm text-gray-600 mt-1">{edgeSoft.toFixed(1)} px</div>

          <label className="block text-sm font-medium mt-4">Mask grow (dilate)</label>
          <input type="range" min="0" max="6" step="0.5" value={maskGrow}
                 onChange={(e)=>setMaskGrow(Number(e.target.value))} className="w-full" />
          <div className="text-sm text-gray-600 mt-1">{maskGrow.toFixed(1)} px</div>

          <label className="block text-sm font-medium mt-4">Inner cut (tighten)</label>
          <input type="range" min="0" max="0.35" step="0.01" value={innerTite}
                 onChange={(e)=>setInnerTite(Number(e.target.value))} className="w-full" />
          <div className="text-sm text-gray-600 mt-1">{Math.round(innerTite*100)}% tighter</div>
        </div>

        {/* Smoothing & toggles */}
        <div>
          <label className="block text-sm font-medium mb-2">Stability (smoothing)</label>
          <input type="range" min="0" max="0.95" step="0.05" value={smoothA}
                 onChange={(e)=>setSmoothA(Number(e.target.value))} className="w-full" />
          <div className="text-sm text-gray-600 mt-1">{smoothA.toFixed(2)} (higher = steadier)</div>

          <div className="flex gap-2 mt-4">
            <button onClick={()=>setMirror(m=>!m)} className="px-3 py-2 border rounded text-sm">
              {mirror ? "Mirror: On" : "Mirror: Off"}
            </button>
            <button onClick={()=>setRunning(r=>!r)} className={`px-3 py-2 border rounded text-sm ${running?"bg-red-50":"bg-green-50"}`}>
              {running ? "Pause" : "Resume"}
            </button>
            <button onClick={()=>setDebug(d=>!d)} className={`px-3 py-2 border rounded text-sm ${debug?"bg-gray-100":""}`}>
              Debug
            </button>
          </div>
        </div>

        {/* Camera & actions */}
        <div>
          <label className="block text-sm font-medium mb-2">Quality</label>
          <select value={quality} onChange={(e)=>setQuality(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
            <option value="saver">Battery Saver (640p)</option>
            <option value="balanced">Balanced (540p)</option>
            <option value="high">High (720p)</option>
            <option value="ultra">Ultra (1080p)</option>
          </select>

          <label className="block text-sm font-medium mt-4">Facing</label>
          <div className="flex gap-2">
            <button onClick={()=>setFacing("user")} className={`px-3 py-2 border rounded text-sm ${facing==="user"?"bg-gray-100":""}`}>Front</button>
            <button onClick={()=>setFacing("environment")} className={`px-3 py-2 border rounded text-sm ${facing==="environment"?"bg-gray-100":""}`}>Back</button>
          </div>

          <label className="block text-sm font-medium mt-4">Camera</label>
          <select value={deviceId} onChange={(e)=>setDeviceId(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
            {devices.length===0 && <option value="">Default</option>}
            {devices.map((d,i)=>(<option key={d.deviceId||i} value={d.deviceId}>{d.label||`Camera ${i+1}`}</option>))}
          </select>

          <div className="flex flex-wrap gap-2 mt-4">
            {!started ? (
              <button onClick={start} className="px-3 py-2 border rounded text-sm">Start</button>
            ) : (
              <button onClick={()=>{ setStarted(false); stopLoop(); stopStream(); }} className="px-3 py-2 border rounded text-sm">Stop</button>
            )}
            <button onClick={takeShot} className="px-3 py-2 border rounded text-sm">Save Snapshot</button>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Tip: even lighting helps. We don’t store or send video anywhere.
          </p>
        </div>
      </div>
    </div>
  );
}
