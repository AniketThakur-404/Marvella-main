import React, { useEffect, useRef, useState } from "react";

// --- (No changes to LIPSTICK_SHADES or landmark indices) ---
const LIPSTICK_SHADES = [
  { id: 0, name: "N/A", color: "transparent" },
  { id: 1, name: "405 - New Dimension", color: "#8E1A2D" },
  { id: 2, name: "410 - Passion Red", color: "#C41E3A" },
  { id: 3, name: "415 - Fiery Kiss", color: "#D93B3B" },
  { id: 4, name: "420 - Deep Ruby", color: "#6B1F2E" },
  { id: 5, name: "115 - Crimson Pop", color: "#D4457A" },
  { id: 6, name: "501 - Fuchsia Flash", color: "#E52B8A" },
  { id: 7, name: "425 - Merlot Kiss", color: "#722F37" },
  { id: 8, name: "430 - Black Cherry", color: "#5F021F" },
  { id: 9, name: "301 - Nude Kiss", color: "#C9917D" },
  { id: 10, name: "305 - Soft Petal", color: "#D89B92" },
  { id: 11, name: "310 - Mauve Memoir", color: "#9C6B6B" },
  { id: 12, name: "312 - Rosewood", color: "#A0654E" },
  { id: 13, name: "315 - Dusty Rose", color: "#B4828E" },
  { id: 14, name: "605 - Espresso Shot", color: "#4E342E" },
  { id: 15, name: "101 - Coral Dream", color: "#E8715E" },
  { id: 16, name: "108 - Peach Tantra", color: "#F5B5A8" },
  { id: 17, name: "118 - Tangerine Tango", color: "#F28500" },
  { id: 18, name: "308 - Peachy Keen", color: "#E6A895" },
  { id: 19, name: "610 - Terracotta Tease", color: "#C46243" },
  { id: 20, name: "205 - Berry Amour", color: "#8B4A3A" },
  { id: 21, name: "210 - Plum Fantasy", color: "#5C2F31" },
  { id: 22, name: "220 - Royal Orchid", color: "#8A4F7D" },
  { id: 23, name: "225 - Velvet Violet", color: "#5B396B" },
];
const UPPER_LIP_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LOWER_LIP_OUTER = [146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
const UPPER_LIP_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_LIP_INNER = [95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

// --- MODIFIED: Increased factor for more responsiveness ---
const SMOOTHING_FACTOR = 0.65;

export default function VirtualTryOn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const lastGoodLandmarksRef = useRef(null);
  const smoothedLandmarksRef = useRef(null);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [selectedShade, setSelectedShade] = useState(LIPSTICK_SHADES[0]);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  const selectedColorRef = useRef(selectedShade.color);

  useEffect(() => {
    selectedColorRef.current = selectedShade.color;
  }, [selectedShade]);

  // --- (No changes to useEffect for script loading and FaceMesh setup) ---
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
    script.crossOrigin = "anonymous";
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);

    return () => {
      const scripts = Array.from(document.head.getElementsByTagName("script"));
      const thisScript = scripts.find((s) => s.src === script.src);
      if (thisScript) document.head.removeChild(thisScript);
    };
  }, []);

  useEffect(() => {
    if (!scriptLoaded) return;

    const faceMesh = new window.FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
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
      if (faceMeshRef.current && typeof faceMeshRef.current.close === "function") {
        faceMeshRef.current.close();
      }
    };
  }, [scriptLoaded]);

  // --- (No changes to stopCamera or startCamera) ---
  const stopCamera = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    if (!scriptLoaded) {
      setError("Resources are still loading, please try again in a moment.");
      return;
    }
    setError("");
    setStarted(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      startProcessing();
    } catch (e) {
      console.error(e);
      setError(
        "Camera access is required. Please allow camera permissions and refresh."
      );
      setStarted(false);
    }
  };

  const startProcessing = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;

    faceMeshRef.current.onResults((results) => {
      latestLandmarksRef.current = results;
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        lastGoodLandmarksRef.current = results.multiFaceLandmarks[0];
      }
    });

    const processFrame = async () => {
      if (!videoRef.current) return;

      if (video.readyState >= 4) {
        await faceMeshRef.current.send({ image: video });
      }

      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);

      // --- MODIFIED: Added logic to reset smoothing when face is lost/re-found ---
      const rawLandmarks = latestLandmarksRef.current?.multiFaceLandmarks?.[0];

      if (rawLandmarks) {
        // If we have raw landmarks but no smoothed ones (i.e., first frame or after losing tracking),
        // initialize the smoothed landmarks directly to prevent a "sliding" effect.
        if (!smoothedLandmarksRef.current) {
          smoothedLandmarksRef.current = JSON.parse(JSON.stringify(rawLandmarks));
        } else {
          // Apply Exponential Moving Average (EMA) smoothing
          for (let i = 0; i < rawLandmarks.length; i++) {
            const smoothed = smoothedLandmarksRef.current[i];
            const current = rawLandmarks[i];
            smoothed.x += (current.x - smoothed.x) * SMOOTHING_FACTOR;
            smoothed.y += (current.y - smoothed.y) * SMOOTHING_FACTOR;
            // z-smoothing can be less aggressive if needed
            smoothed.z += (current.z - smoothed.z) * SMOOTHING_FACTOR * 0.5;
          }
        }
      } else {
        // If we lose tracking, reset the smoothed landmarks.
        smoothedLandmarksRef.current = null;
      }

      // Use smoothed landmarks if available, otherwise fall back to the last good raw landmarks
      const landmarksToDraw = smoothedLandmarksRef.current || lastGoodLandmarksRef.current;

      if (landmarksToDraw) {
        drawLipstick(ctx, landmarksToDraw, width, height);
      }
      
      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  // --- (No changes to takeSnapshot, getLipPoints, or drawLipstick) ---
  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      setSnapshot(dataUrl);
    }
  };

  const getLipPoints = (landmarks, indices, w, h) => {
    return indices.map((i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
  };

  const drawLipstick = (ctx, landmarks, w, h) => {
    if (selectedColorRef.current === "transparent") return;

    const upperOuterPts = getLipPoints(landmarks, UPPER_LIP_OUTER, w, h);
    const upperInnerPts = getLipPoints(landmarks, UPPER_LIP_INNER, w, h);
    const lowerOuterPts = getLipPoints(landmarks, LOWER_LIP_OUTER, w, h);
    const lowerInnerPts = getLipPoints(landmarks, LOWER_LIP_INNER, w, h);

    const lipShape = new Path2D();
    lipShape.moveTo(upperOuterPts[0].x, upperOuterPts[0].y);
    for (let i = 1; i < upperOuterPts.length; i++)
      lipShape.lineTo(upperOuterPts[i].x, upperOuterPts[i].y);
    for (let i = lowerOuterPts.length - 1; i >= 0; i--)
      lipShape.lineTo(lowerOuterPts[i].x, lowerOuterPts[i].y);
    lipShape.closePath();

    const mouthOpening = new Path2D();
    mouthOpening.moveTo(upperInnerPts[0].x, upperInnerPts[0].y);
    for (let i = 1; i < upperInnerPts.length; i++)
      mouthOpening.lineTo(upperInnerPts[i].x, upperInnerPts[i].y);
    for (let i = lowerInnerPts.length - 1; i >= 0; i--)
      mouthOpening.lineTo(lowerInnerPts[i].x, lowerInnerPts[i].y);
    mouthOpening.closePath();

    lipShape.addPath(mouthOpening);

    ctx.save();
    ctx.fillStyle = selectedColorRef.current;

    ctx.shadowColor = selectedColorRef.current;
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.7;
    ctx.fill(lipShape, "evenodd");
    
    ctx.shadowBlur = 0;

    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.4;
    ctx.fill(lipShape, "evenodd");

    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.5;
    ctx.fill(lipShape, "evenodd");
    
    ctx.restore();
  };

  // --- (No changes to the JSX return) ---
  return (
    <div className="fixed inset-0 bg-gray-900 font-sans flex items-center justify-center ">
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
                        ${selectedShade.id === shade.id ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-black/50" : "hover:scale-110"}`
                      }
                      style={{ backgroundColor: shade.color === 'transparent' ? '#4a4a4a' : shade.color }}
                      title={shade.name}
                    >
                      {shade.id === 0 && (
                          <div className="w-full h-0.5 bg-red-500 transform rotate-45"></div>
                      )}
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