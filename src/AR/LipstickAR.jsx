import React, { useEffect, useRef, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";

/* Precise lip landmark indices for better coverage */
const UPPER_LIP_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409];
const LOWER_LIP_OUTER = [146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
const UPPER_LIP_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415];
const LOWER_LIP_INNER = [95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

// Face mesh tesselation for calibration animation
const FACEMESH_TESSELATION = [
  [127, 34], [34, 139], [139, 127], [11, 0], [0, 37], [37, 11], [232, 231], [231, 120], [120, 232],
  [72, 37], [37, 39], [39, 72], [128, 121], [121, 47], [47, 128], [232, 121], [121, 128], [128, 232],
  [104, 69], [69, 67], [67, 104], [175, 171], [171, 148], [148, 175], [118, 50], [50, 101], [101, 118],
  [73, 39], [39, 40], [40, 73], [9, 151], [151, 108], [108, 9], [48, 115], [115, 131], [131, 48],
  [194, 204], [204, 211], [211, 194], [74, 40], [40, 185], [185, 74], [80, 42], [42, 183], [183, 80],
  [40, 92], [92, 186], [186, 40], [230, 229], [229, 118], [118, 230], [202, 212], [212, 214], [214, 202],
  [83, 18], [18, 17], [17, 83], [76, 61], [61, 146], [146, 76], [160, 29], [29, 30], [30, 160],
  [56, 157], [157, 173], [173, 56], [106, 204], [204, 194], [194, 106], [135, 214], [214, 192], [192, 135],
  [203, 165], [165, 98], [98, 203], [21, 71], [71, 68], [68, 21], [51, 45], [45, 4], [4, 51],
  [144, 24], [24, 23], [23, 144], [77, 146], [146, 91], [91, 77], [205, 50], [50, 187], [187, 205],
  [201, 200], [200, 18], [18, 201], [91, 106], [106, 182], [182, 91], [90, 91], [91, 181], [181, 90],
  [85, 84], [84, 17], [17, 85], [206, 203], [203, 36], [36, 206], [148, 171], [171, 140], [140, 148],
  [92, 40], [40, 39], [39, 92], [193, 189], [189, 244], [244, 193], [159, 158], [158, 28], [28, 159],
  [247, 246], [246, 161], [161, 247], [236, 3], [3, 196], [196, 236], [54, 68], [68, 104], [104, 54],
  [193, 168], [168, 8], [8, 193], [117, 228], [228, 31], [31, 117], [189, 193], [193, 55], [55, 189],
  [98, 97], [97, 99], [99, 98], [126, 47], [47, 100], [100, 126], [166, 79], [79, 218], [218, 166],
  [155, 154], [154, 26], [26, 155], [209, 49], [49, 131], [131, 209], [135, 136], [136, 150], [150, 135],
  [47, 126], [126, 217], [217, 47], [223, 52], [52, 53], [53, 223], [45, 51], [51, 134], [134, 45],
  [211, 170], [170, 140], [140, 211], [67, 69], [69, 108], [108, 67], [43, 106], [106, 91], [91, 43],
  [230, 119], [119, 120], [120, 230], [226, 130], [130, 247], [247, 226], [63, 53], [53, 52], [52, 63],
  [238, 20], [20, 242], [242, 238], [46, 70], [70, 156], [156, 46], [78, 62], [62, 96], [96, 78],
  [46, 53], [53, 63], [63, 46], [143, 34], [34, 227], [227, 143], [123, 117], [117, 111], [111, 123],
  [44, 125], [125, 19], [19, 44], [236, 134], [134, 51], [51, 236], [216, 206], [206, 205], [205, 216],
  [154, 153], [153, 22], [22, 154], [39, 37], [37, 167], [167, 39], [200, 201], [201, 208], [208, 200],
  [36, 142], [142, 100], [100, 36], [57, 212], [212, 202], [202, 57], [20, 60], [60, 99], [99, 20],
  [28, 158], [158, 157], [157, 28], [35, 226], [226, 113], [113, 35], [160, 159], [159, 27], [27, 160],
  [204, 202], [202, 210], [210, 204], [113, 225], [225, 46], [46, 113], [43, 202], [202, 204], [204, 43],
  [62, 76], [76, 77], [77, 62], [137, 123], [123, 116], [116, 137], [41, 38], [38, 72], [72, 41],
  [203, 129], [129, 142], [142, 203], [64, 98], [98, 240], [240, 64]
];

const PRESETS = [
  { name: "Classic Red", val: "#DC143C" },
  { name: "Nude Rose", val: "#D4A5A5" },
  { name: "Berry Wine", val: "#722F37" },
  { name: "Coral Pink", val: "#FF6B6B" },
  { name: "Deep Plum", val: "#8B4789" },
  { name: "Soft Pink", val: "#FFB6C1" },
  { name: "Burgundy", val: "#800020" },
  { name: "Mauve", val: "#E0B0FF" },
  { name: "Orange", val: "#FF8C42" },
];

// Lip styles with different fullness and shapes
const LIP_STYLES = [
  { name: "Natural", scale: 1.0, innerScale: 0.85, description: "Your natural lip shape" },
  { name: "Full", scale: 1.08, innerScale: 0.80, description: "Fuller, plumper lips" },
  { name: "Defined", scale: 1.0, innerScale: 0.90, description: "Crisp, defined edges" },
  { name: "Overlined", scale: 1.12, innerScale: 0.78, description: "Slightly overdrawn" },
  { name: "Subtle", scale: 0.98, innerScale: 0.88, description: "Understated look" },
];

export default function LipstickAR() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const outputRef = useRef(null);
  const meshRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  
  const filterRef = useRef({ landmarks: null, velocity: null });
  const calibrationStartRef = useRef(0);
  const [calibrating, setCalibrating] = useState(false);
  
  const [started, setStarted] = useState(false);
  const [shade, setShade] = useState(PRESETS[0].val);
  const [intensity, setIntensity] = useState(0.75);
  const [lipStyle, setLipStyle] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const mesh = new FaceMesh({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });
    
    mesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75,
    });
    
    meshRef.current = mesh;
    
    return () => {
      stopCamera();
      try { mesh.close(); } catch {}
    };
  }, []);

  const stopCamera = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setError("");
    setReady(false);
    setCalibrating(true);
    calibrationStartRef.current = Date.now();
    filterRef.current = { landmarks: null, velocity: null };
    
    try {
      stopCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
          frameRate: { ideal: 30 }
        }
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
      const output = outputRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      output.width = video.videoWidth;
      output.height = video.videoHeight;
      
      startProcessing();
      
      setTimeout(() => {
        setReady(true);
        setCalibrating(false);
      }, 10000);
      
    } catch (e) {
      console.error(e);
      setError("Camera access denied. Please allow camera permissions.");
      setStarted(false);
    }
  };

  const applyKalmanFilter = (newLandmarks) => {
    if (!filterRef.current.landmarks) {
      filterRef.current.landmarks = newLandmarks;
      filterRef.current.velocity = newLandmarks.map(() => ({ x: 0, y: 0 }));
      return newLandmarks;
    }

    const filtered = [];
    const processNoise = 0.003;
    const measurementNoise = 0.15;
    const prev = filterRef.current.landmarks;
    const vel = filterRef.current.velocity;

    for (let i = 0; i < newLandmarks.length; i++) {
      const predictX = prev[i].x + vel[i].x;
      const predictY = prev[i].y + vel[i].y;
      
      const kg = measurementNoise / (measurementNoise + processNoise);
      
      const x = predictX + kg * (newLandmarks[i].x - predictX);
      const y = predictY + kg * (newLandmarks[i].y - predictY);
      
      filtered.push({ x, y, z: newLandmarks[i].z });
      
      vel[i].x = (x - prev[i].x) * 0.25 + vel[i].x * 0.75;
      vel[i].y = (y - prev[i].y) * 0.25 + vel[i].y * 0.75;
    }

    filterRef.current.landmarks = filtered;
    filterRef.current.velocity = vel;
    
    return filtered;
  };

  const startProcessing = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const output = outputRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    const outCtx = output.getContext("2d", { willReadFrequently: false });

    meshRef.current.onResults((results) => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();

      outCtx.clearRect(0, 0, w, h);
      outCtx.drawImage(canvas, 0, 0);

      if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) {
        return;
      }

      const rawLandmarks = results.multiFaceLandmarks[0];
      const landmarks = applyKalmanFilter(rawLandmarks);

      // Show calibration animation
      if (calibrating) {
        const elapsed = Date.now() - calibrationStartRef.current;
        const totalDuration = 10000; // 10 seconds
        const progress = Math.min(1, elapsed / totalDuration);
        
        // Calculate scanning line position (top to bottom, then bottom to top)
        let scanProgress;
        if (progress < 0.5) {
          // First 5 seconds: top to bottom
          scanProgress = (progress * 2);
        } else {
          // Next 5 seconds: bottom to top
          scanProgress = 1 - ((progress - 0.5) * 2);
        }
        
        // Draw semi-transparent overlay
        outCtx.save();
        outCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
        outCtx.fillRect(0, 0, w, h);
        
        // Draw face mesh skeleton structure
        outCtx.strokeStyle = "rgba(100, 200, 255, 0.6)";
        outCtx.lineWidth = 1;
        for (const conn of FACEMESH_TESSELATION) {
          const p1 = rawLandmarks[conn[0]];
          const p2 = rawLandmarks[conn[1]];
          if (p1 && p2) {
            const x1 = (1 - p1.x) * w;
            const y1 = p1.y * h;
            const x2 = (1 - p2.x) * w;
            const y2 = p2.y * h;
            outCtx.beginPath();
            outCtx.moveTo(x1, y1);
            outCtx.lineTo(x2, y2);
            outCtx.stroke();
          }
        }
        
        // Draw landmark points
        outCtx.fillStyle = "rgba(0, 255, 255, 0.4)";
        for (let i = 0; i < rawLandmarks.length; i++) {
          const lm = rawLandmarks[i];
          const x = (1 - lm.x) * w;
          const y = lm.y * h;
          outCtx.beginPath();
          outCtx.arc(x, y, 1.5, 0, Math.PI * 2);
          outCtx.fill();
        }
        
        // Draw scanning box with moving line
        const boxPadding = 40;
        const boxX = boxPadding;
        const boxY = boxPadding;
        const boxW = w - (boxPadding * 2);
        const boxH = h - (boxPadding * 2);
        
        // Draw box outline
        outCtx.strokeStyle = "rgba(0, 255, 255, 0.8)";
        outCtx.lineWidth = 2;
        outCtx.strokeRect(boxX, boxY, boxW, boxH);
        
        // Draw corner brackets
        const cornerSize = 30;
        outCtx.strokeStyle = "rgba(0, 255, 255, 1)";
        outCtx.lineWidth = 3;
        
        // Top-left
        outCtx.beginPath();
        outCtx.moveTo(boxX + cornerSize, boxY);
        outCtx.lineTo(boxX, boxY);
        outCtx.lineTo(boxX, boxY + cornerSize);
        outCtx.stroke();
        
        // Top-right
        outCtx.beginPath();
        outCtx.moveTo(boxX + boxW - cornerSize, boxY);
        outCtx.lineTo(boxX + boxW, boxY);
        outCtx.lineTo(boxX + boxW, boxY + cornerSize);
        outCtx.stroke();
        
        // Bottom-left
        outCtx.beginPath();
        outCtx.moveTo(boxX, boxY + boxH - cornerSize);
        outCtx.lineTo(boxX, boxY + boxH);
        outCtx.lineTo(boxX + cornerSize, boxY + boxH);
        outCtx.stroke();
        
        // Bottom-right
        outCtx.beginPath();
        outCtx.moveTo(boxX + boxW, boxY + boxH - cornerSize);
        outCtx.lineTo(boxX + boxW, boxY + boxH);
        outCtx.lineTo(boxX + boxW - cornerSize, boxY + boxH);
        outCtx.stroke();
        
        // Draw scanning line with glow effect
        const lineY = boxY + (boxH * scanProgress);
        
        // Glow effect
        outCtx.shadowColor = 'cyan';
        outCtx.shadowBlur = 30;
        outCtx.strokeStyle = 'rgba(0, 255, 255, 1)';
        outCtx.lineWidth = 3;
        outCtx.beginPath();
        outCtx.moveTo(boxX, lineY);
        outCtx.lineTo(boxX + boxW, lineY);
        outCtx.stroke();
        
        // Inner bright line
        outCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        outCtx.lineWidth = 1;
        outCtx.beginPath();
        outCtx.moveTo(boxX, lineY);
        outCtx.lineTo(boxX + boxW, lineY);
        outCtx.stroke();
        
        outCtx.shadowBlur = 0;
        
        // Draw progress bar
        const pct = Math.round(progress * 100);
        const barW = Math.max(250, w * 0.5);
        const barH = 10;
        const barX = (w - barW) / 2;
        const barY = h - 80;
        
        // Progress bar background
        outCtx.fillStyle = "rgba(255, 255, 255, 0.2)";
        outCtx.fillRect(barX, barY, barW, barH);
        
        // Progress bar fill with gradient
        const gradient = outCtx.createLinearGradient(barX, 0, barX + barW * progress, 0);
        gradient.addColorStop(0, "#00FFFF");
        gradient.addColorStop(1, "#34D399");
        outCtx.fillStyle = gradient;
        outCtx.fillRect(barX, barY, barW * progress, barH);
        
        // Progress bar border
        outCtx.strokeStyle = "rgba(0, 255, 255, 0.8)";
        outCtx.lineWidth = 2;
        outCtx.strokeRect(barX, barY, barW, barH);
        
        // Draw status text
        outCtx.font = "bold 20px system-ui, -apple-system, sans-serif";
        outCtx.fillStyle = "#00FFFF";
        outCtx.textAlign = "center";
        outCtx.shadowColor = 'rgba(0, 255, 255, 0.5)';
        outCtx.shadowBlur = 10;
        
        let statusText = "SCANNING FACIAL FEATURES...";
        if (progress > 0.3 && progress < 0.6) {
          statusText = "ANALYZING LIP STRUCTURE...";
        } else if (progress >= 0.6) {
          statusText = "CALIBRATING AR ENGINE...";
        }
        
        outCtx.fillText(statusText, w / 2, barY - 30);
        
        // Draw percentage
        outCtx.font = "bold 16px system-ui, -apple-system, sans-serif";
        outCtx.fillStyle = "#ffffff";
        outCtx.fillText(`${pct}%`, w / 2, barY + barH + 25);
        
        outCtx.shadowBlur = 0;
        outCtx.restore();
        return;
      }

      drawLipstick(outCtx, landmarks, w, h);
    });

    const processFrame = async () => {
      if (video.readyState === 4) {
        await meshRef.current.send({ image: video });
      }
      animRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  const getLipPoints = (landmarks, indices, w, h) => {
    return indices.map(i => {
      const lm = landmarks[i];
      return {
        x: (1 - lm.x) * w,
        y: lm.y * h
      };
    });
  };

  const scalePointsFromCenter = (points, scale) => {
    if (points.length === 0) return points;
    
    let sumX = 0, sumY = 0;
    points.forEach(p => { sumX += p.x; sumY += p.y; });
    const centerX = sumX / points.length;
    const centerY = sumY / points.length;
    
    return points.map(p => ({
      x: centerX + (p.x - centerX) * scale,
      y: centerY + (p.y - centerY) * scale
    }));
  };

  const createSmoothLipPath = (outerPoints, innerPoints) => {
    const path = new Path2D();
    
    if (outerPoints.length < 3) return path;
    
    // Draw outer contour
    path.moveTo(outerPoints[0].x, outerPoints[0].y);
    
    for (let i = 0; i < outerPoints.length - 1; i++) {
      const curr = outerPoints[i];
      const next = outerPoints[i + 1];
      const cp1x = curr.x + (next.x - curr.x) * 0.5;
      const cp1y = curr.y + (next.y - curr.y) * 0.5;
      path.quadraticCurveTo(curr.x, curr.y, cp1x, cp1y);
    }
    
    const lastOuter = outerPoints[outerPoints.length - 1];
    path.lineTo(lastOuter.x, lastOuter.y);
    
    // Draw inner contour (reverse direction to create hole)
    if (innerPoints.length > 2) {
      path.lineTo(innerPoints[innerPoints.length - 1].x, innerPoints[innerPoints.length - 1].y);
      
      for (let i = innerPoints.length - 1; i > 0; i--) {
        const curr = innerPoints[i];
        const next = innerPoints[i - 1];
        const cp1x = curr.x + (next.x - curr.x) * 0.5;
        const cp1y = curr.y + (next.y - curr.y) * 0.5;
        path.quadraticCurveTo(curr.x, curr.y, cp1x, cp1y);
      }
      
      path.lineTo(innerPoints[0].x, innerPoints[0].y);
    }
    
    path.closePath();
    return path;
  };

  const drawLipstick = (ctx, landmarks, w, h) => {
    const style = LIP_STYLES[lipStyle];
    
    // Get upper lip points
    const upperOuter = getLipPoints(landmarks, UPPER_LIP_OUTER, w, h);
    const upperInner = getLipPoints(landmarks, UPPER_LIP_INNER, w, h);
    
    // Get lower lip points
    const lowerOuter = getLipPoints(landmarks, LOWER_LIP_OUTER, w, h);
    const lowerInner = getLipPoints(landmarks, LOWER_LIP_INNER, w, h);
    
    // Scale based on lip style
    const scaledUpperOuter = scalePointsFromCenter(upperOuter, style.scale);
    const scaledUpperInner = scalePointsFromCenter(upperInner, style.innerScale);
    const scaledLowerOuter = scalePointsFromCenter(lowerOuter, style.scale);
    const scaledLowerInner = scalePointsFromCenter(lowerInner, style.innerScale);

    // Create paths for upper and lower lips separately for better coverage
    const upperLipPath = createSmoothLipPath(scaledUpperOuter, scaledUpperInner);
    const lowerLipPath = createSmoothLipPath(scaledLowerOuter, scaledLowerInner);

    ctx.save();
    
    // Use source-atop to only draw on existing lip pixels (removes white background)
    ctx.globalCompositeOperation = "source-atop";
    
    // Create a mask using the original lip area
    ctx.fillStyle = "rgba(0,0,0,0.01)";
    ctx.fill(upperLipPath);
    ctx.fill(lowerLipPath);
    
    // Now apply color with multiply blend for realistic look
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = intensity;
    ctx.fillStyle = shade;
    
    // Fill upper lip
    ctx.fill(upperLipPath);
    
    // Fill lower lip
    ctx.fill(lowerLipPath);
    
    // Add slight overlay for color boost
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = intensity * 0.35;
    ctx.fill(upperLipPath);
    ctx.fill(lowerLipPath);
    
    ctx.restore();
    
    // Edge definition with stroke
    ctx.save();
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1.0;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = intensity * 0.4;
    ctx.globalCompositeOperation = "multiply";
    ctx.stroke(upperLipPath);
    ctx.stroke(lowerLipPath);
    ctx.restore();
    
    // Add subtle highlight on upper lip center for dimension
    const upperCenter = getLipPoints(landmarks, [13], w, h)[0];
    const highlightGradient = ctx.createRadialGradient(
      upperCenter.x, upperCenter.y - h * 0.005, 0,
      upperCenter.x, upperCenter.y, w * 0.025
    );
    highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(upperCenter.x, upperCenter.y - h * 0.005, w * 0.025, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    if (started) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [started]);

  const takePhoto = () => {
    const canvas = outputRef.current;
    const link = document.createElement("a");
    link.download = `lipstick-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Virtual Lipstick Try-On
          </h1>
          <p className="text-gray-600">Find your perfect shade and style</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Camera View */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="relative aspect-video bg-gray-900">
                <video ref={videoRef} className="hidden" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                <canvas 
                  ref={outputRef} 
                  className="w-full h-full object-contain"
                />
                
                {!started && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-900/50 to-pink-900/50 backdrop-blur-sm">
                    <button
                      onClick={() => setStarted(true)}
                      className="px-8 py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full font-semibold text-lg shadow-2xl hover:shadow-pink-500/50 transform hover:scale-105 transition-all"
                    >
                      ✨ Start Try-On
                    </button>
                  </div>
                )}

                {started && !ready && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-white font-medium">Loading AR...</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <div className="bg-red-500 text-white px-6 py-4 rounded-lg max-w-md">
                      {error}
                    </div>
                  </div>
                )}
              </div>

              {started && ready && (
                <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 flex justify-between items-center">
                  <button
                    onClick={() => setStarted(false)}
                    className="px-4 py-2 bg-white rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    ✕ Stop Camera
                  </button>
                  <button
                    onClick={takePhoto}
                    className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    📸 Capture Photo
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Shade Selection */}
            <div className="bg-white rounded-2xl shadow-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-3 text-lg">💄 Lipstick Shades</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.val}
                    onClick={() => setShade(preset.val)}
                    className={`relative group transition-all ${
                      shade === preset.val ? "ring-2 ring-rose-500 ring-offset-2 scale-105" : ""
                    }`}
                    title={preset.name}
                  >
                    <div
                      className="aspect-square rounded-xl shadow-md group-hover:shadow-lg transition-all"
                      style={{ backgroundColor: preset.val }}
                    />
                    <p className="text-xs mt-1 text-gray-600 text-center font-medium">
                      {preset.name.split(' ')[0]}
                    </p>
                  </button>
                ))}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Custom Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={shade}
                    onChange={(e) => setShade(e.target.value)}
                    className="w-16 h-12 rounded-lg border-2 border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={shade}
                    onChange={(e) => setShade(e.target.value)}
                    className="flex-1 px-3 rounded-lg border-2 border-gray-200 font-mono text-sm"
                    placeholder="#DC143C"
                  />
                </div>
              </div>
            </div>

            {/* Lip Style Selection */}
            <div className="bg-white rounded-2xl shadow-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-3 text-lg">👄 Lip Style</h3>
              <div className="space-y-2">
                {LIP_STYLES.map((style, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLipStyle(idx)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                      lipStyle === idx
                        ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div className="font-medium">{style.name}</div>
                    <div className={`text-xs mt-1 ${lipStyle === idx ? "text-white/80" : "text-gray-500"}`}>
                      {style.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity */}
            <div className="bg-white rounded-2xl shadow-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-3 text-lg">
                ✨ Intensity: {Math.round(intensity * 100)}%
              </h3>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #fb7185 0%, #fb7185 ${intensity * 100}%, #e5e7eb ${intensity * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Sheer</span>
                <span>Full Coverage</span>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl shadow-lg p-5">
              <h3 className="font-semibold text-gray-800 mb-2">💡 Pro Tips</h3>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li>• Use natural lighting</li>
                <li>• Keep lips slightly parted</li>
                <li>• Face camera directly</li>
                <li>• Move slowly for best results</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}