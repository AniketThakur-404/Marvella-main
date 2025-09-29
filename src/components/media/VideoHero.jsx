import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

export default function VideoHero({
  src,
  poster,
  heightClass = "h-[60svh] md:h-[70svh]",
  overlayClass = "bg-[radial-gradient(80%_80%_at_0%_100%,rgba(0,0,0,0.55)_0%,transparent_60%)]",
  startMuted = true,
  loop = true,
  autoPauseOffscreen = true,
  showControls = true,
  className = "",
  children,
}) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(startMuted);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);

    // autoplay reliably
    (async () => {
      try {
        v.muted = true; // mobile autoplay requirement
        await v.play();
        setIsPlaying(!v.paused);
      } catch {
        setIsPlaying(false);
      }
    })();

    // auto-pause when offscreen
    let obs;
    if (autoPauseOffscreen && "IntersectionObserver" in window) {
      obs = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          if (entry.isIntersecting) {
            if (!v.paused && v.muted) return; // already playing
            (async () => { try { await v.play(); } catch {} })();
          } else {
            try { v.pause(); } catch {}
          }
        },
        { threshold: 0.25 }
      );
      obs.observe(v);
    }

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      obs?.disconnect();
    };
  }, [autoPauseOffscreen]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  return (
    <section className={`relative isolate w-full overflow-hidden rounded-2xl ${heightClass} ${className}`}>
      <video
        ref={videoRef}
        className="absolute inset-0 block h-full w-full object-cover"
        src={src}
        poster={poster}
        autoPlay
        loop={loop}
        muted={isMuted}
        playsInline
        preload="metadata"
      />
      <div className={`pointer-events-none absolute inset-0 ${overlayClass}`} />
      {children}

      {showControls && (
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-3 sm:bottom-6 sm:right-6">
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause video" : "Play video"}
            className="rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute video" : "Mute video"}
            className="rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/60"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      )}
    </section>
  );
}
