// src/components/pages/ProductDetails.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Star, StarHalf, Truck, ShieldCheck, Recycle, Sparkles,
  ShoppingCart, Heart, Share2, BadgeCheck, ChevronLeft, ChevronRight,
} from "lucide-react";
import productData from "@/data/sampleProduct.json";
import VideoHero from "@/components/media/VideoHero";
import introVideoFallback from "@/assets/video/intro1.mp4";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ---------- Asset resolvers (images) ---------- */
const IMG = import.meta.glob("/src/assets/images/**/*", { eager: true, as: "url" });
function resolveAsset(pth = "") {
  if (!pth) return "";
  let clean = String(pth).split("?")[0].split("#")[0].trim();
  if (clean.startsWith("/assets/")) clean = "/src" + clean;
  if (!clean.includes("/assets/images/")) clean = "/src/assets/images/" + clean.replace(/^\/+/, "");
  if (IMG[clean]) return IMG[clean];
  const fname = clean.split("/").pop();
  const kv = Object.entries(IMG).find(([k]) => k.endsWith("/" + fname));
  return kv ? kv[1] : pth;
}

/* ---------- Media resolver (videos) ---------- */
const MEDIA = import.meta.glob(
  "/src/assets/{video,videos}/**/*.{mp4,webm,ogg}",
  { eager: true, as: "url" }
);
function resolveMedia(pth = "") {
  if (!pth) return "";
  let clean = String(pth).trim().replace(/^@\/?/, "/src/");
  if (!clean.startsWith("/src/")) clean = "/src/assets/" + clean.replace(/^\/+/, "");
  if (MEDIA[clean]) return MEDIA[clean];
  const fname = clean.split("/").pop();
  const candidates = [
    `/src/assets/videos/${fname}`,
    `/src/assets/video/${fname}`,
  ];
  for (const k of candidates) if (MEDIA[k]) return MEDIA[k];
  const found = Object.entries(MEDIA).find(([k]) => k.endsWith("/" + fname));
  return found ? found[1] : "";
}

/* ---------- UI bits ---------- */
const RatingStars = ({ value = 0 }) => {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Rating ${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) =>
        i < full ? <Star key={i} className="h-4 w-4 fill-current" /> :
        i === full && half ? <StarHalf key={i} className="h-4 w-4 fill-current" /> :
        <Star key={i} className="h-4 w-4" />
      )}
    </div>
  );
};

const ShadeDot = ({ hex, img, active, onClick, label }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`h-7 w-7 rounded-full ring-offset-2 overflow-hidden transition-all ${
      active ? "ring-2 ring-black scale-[1.05]" : "ring-1 ring-neutral-300"
    }`}
    style={img ? undefined : { background: hex }}
  >
    {img && <img src={img} alt={label} className="h-full w-full object-cover" />}
  </button>
);

/* Ultra-smooth crossfade (images ignore pointer events so clicks reach the chip) */
function SmoothImage({ src, alt, className = "" }) {
  const [current, setCurrent] = useState(src || "");
  const [incoming, setIncoming] = useState("");
  const fadeMs = 420;

  useEffect(() => {
    if (!src || src === current) return;
    const img = new Image();
    img.onload = () => setIncoming(src);
    img.src = src;
  }, [src, current]);

  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => {
      setCurrent(incoming);
      setIncoming("");
    }, fadeMs);
    return () => clearTimeout(t);
  }, [incoming]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {current && (
        <img
          src={current}
          alt={alt}
          className="pointer-events-none block h-full w-full object-cover will-change-transform"
          style={{ transform: "translateZ(0)" }}
          draggable={false}
        />
      )}
      {incoming && (
        <img
          src={incoming}
          alt={alt}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0"
          style={{
            animation: `smoothFadeIn ${fadeMs}ms ease forwards`,
            willChange: "opacity",
            transform: "translateZ(0)",
          }}
          draggable={false}
        />
      )}
      <style>{`@keyframes smoothFadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}

/* Background cross-fader */
function BackgroundFader({ background, duration = 1100, easing = "cubic-bezier(0.16,1,0.3,1)" }) {
  const [base, setBase] = useState(background);
  const [overlay, setOverlay] = useState(background);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (background === base) return;
    setOverlay(background);
    const raf = requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => {
      setBase(background);
      setShow(false);
    }, duration);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [background, base, duration]);

  return (
    <>
      <div className="fixed inset-0 -z-20" style={{ background: base }} aria-hidden />
      <div
        className="fixed inset-0 -z-10 transition-opacity"
        style={{
          background: overlay,
          opacity: show ? 1 : 0,
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: easing,
        }}
        aria-hidden
      />
    </>
  );
}

/* ===== MAIN ===== */
export default function ProductDetails({ data }) {
  const p = data || productData;
  const crumbs = Array.isArray(p.categoryPath) ? p.categoryPath : p.category ? [p.category] : [];

  /* Tone & backgrounds */
  const defaultBg =
    p?.theme?.defaultBg ||
    "radial-gradient(80% 60% at 50% 0%, #faf7f2 0%, #f4efe9 45%, #efe9e2 100%)";
  const bgScenes = p?.theme?.bgScenes || {
    hero: p?.hero?.bg || defaultBg,
    features: "radial-gradient(80% 60% at 50% 10%, #f8f1ff 0%, #f3ecff 45%, #ece6ff 100%)",
    ingredients: "radial-gradient(80% 60% at 50% 10%, #f2fbff 0%, #e9f7ff 45%, #e6f4ff 100%)",
    video: "radial-gradient(80% 60% at 50% 10%, #0b0b0b 0%, #121212 65%, #171717 100%)",
    shades: "radial-gradient(80% 60% at 50% 10%, #fff8f1 0%, #fff2e5 45%, #ffecd9 100%)",
    reviews: "radial-gradient(80% 60% at 50% 10%, #f6f7ff 0%, #f0f2ff 45%, #eaecff 100%)",
  };
  const bgTone = p?.theme?.bgTone || {
    hero: "light", features: "light", ingredients: "light", video: "dark", shades: "light", reviews: "light"
  };
  const [tone, setTone] = useState(bgTone.hero || "light");
  const [pageBg, setPageBg] = useState(bgScenes.hero || defaultBg);
  const toneVars = useMemo(() => {
    const dark = tone === "dark";
    return {
      "--fg": dark ? "#ffffff" : "#0f0f0f",
      "--fg-muted": dark ? "rgba(255,255,255,0.76)" : "#545b63",
      "--divider": dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)",
      "--card-bg": dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.65)",
      "--chip-bg": dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
    };
  }, [tone]);

  /* Smooth scene picking */
  const pageRef = useRef(null);
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const secs = Array.from(root.querySelectorAll("[data-bg-key]"));

    let rafPending = false;
    let debounceId = null;
    let lastKey = null;

    const compute = () => {
      rafPending = false;
      const center = window.innerHeight / 2;
      let bestKey = null, bestDist = Infinity;
      secs.forEach((el) => {
        const r = el.getBoundingClientRect();
        const c = r.top + r.height / 2;
        const d = Math.abs(c - center);
        if (d < bestDist) { bestDist = d; bestKey = el.getAttribute("data-bg-key"); }
      });
      if (bestKey && bestKey !== lastKey) {
        clearTimeout(debounceId);
        debounceId = setTimeout(() => {
          lastKey = bestKey;
          setPageBg(bgScenes[bestKey] || defaultBg);
          setTone(bgTone?.[bestKey] || "light");
        }, 160);
      }
    };

    const onScroll = () => {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(compute);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearTimeout(debounceId);
    };
  }, [bgScenes, bgTone, defaultBg]);

  /* top progress */
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      const sc = total > 0 ? h.scrollTop / total : 0;
      setScrollProgress(sc);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* PDP images */
  const HERO = p.hero || {};
  const heroOverlay = HERO.overlay || "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.06) 100%)";
  const gallery = useMemo(() => (Array.isArray(p.gallery) ? p.gallery.map(resolveAsset) : []), [p.gallery]);
  const [activeImage, _setActiveImage] = useState(0);

  // Throttle image index updates to avoid jitter/overlap
  const changeRef = useRef(0);
  const setActiveImage = (next) => {
    const now = performance.now();
    if (now - changeRef.current < 140) return; // throttle
    changeRef.current = now;
    _setActiveImage((curr) => (next === curr ? curr : next));
  };

  useEffect(() => {
    gallery.forEach((src) => { const i = new Image(); i.src = src; });
  }, [gallery]);

  // drag / swipe / wheel — but ignore interactive children so links work on desktop too
  const heroRef = useRef(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    let startX = 0, startY = 0, dragging = false, startIdx = 0;

    const isInteractive = (t) =>
      !!(t && (t.closest?.("a,button,input,select,textarea,[role='button']")));

    const onPointerDown = (e) => {
      if (isInteractive(e.target)) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startIdx = activeImage;
      el.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > Math.abs(e.clientY - startY) && Math.abs(dx) > 28) {
        const step = Math.round(dx / -140);
        const next = Math.max(0, Math.min(gallery.length - 1, startIdx + step));
        setActiveImage(next);
      }
    };
    const onPointerUp = (e) => {
      dragging = false;
      el.releasePointerCapture?.(e.pointerId);
    };
    const onWheel = (e) => {
      if (isInteractive(e.target)) return;
      if (gallery.length < 2) return;
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      setActiveImage((i) => Math.max(0, Math.min(gallery.length - 1, i + (dir > 0 ? 1 : -1))));
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gallery.length, activeImage]);

  const heroSrc = gallery[activeImage] || (HERO.image ? resolveAsset(HERO.image) : "");

  /* price, badges, etc. */
  const [qty, setQty] = useState(1);
  const priceBlock = useMemo(() => {
    const save = Math.max(0, (p.mrp || 0) - (p.price || 0));
    return { save, hasSave: save > 0 };
  }, [p.mrp, p.price]);

  /* shades map + choose */
  const [activeShade, setActiveShade] = useState(p.shades?.[0]?.key || "");
  const shadeMap = useMemo(() =>
    (p.shades || []).reduce((acc, s) => {
      acc[s.key] = { ...s, img: s.thumb ? resolveAsset(s.thumb) : null };
      return acc;
    }, {}), [p.shades]
  );
  useEffect(() => {
    const shade = shadeMap[activeShade];
    if (shade?.img && gallery.length > 0) {
      const idx = gallery.findIndex((g) => g === shade.img);
      if (idx >= 0) setActiveImage(idx);
    }
  }, [activeShade, gallery, shadeMap]);

  /* reviews */
  const [sortOrder, setSortOrder] = useState("newest");
  const [filterRating, setFilterRating] = useState(0);
  const filteredAndSortedReviews = useMemo(() => {
    let reviews = [...(p.reviewsList || [])];
    if (filterRating > 0) reviews = reviews.filter((r) => r.rating === filterRating);
    switch (sortOrder) {
      case "newest": reviews.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
      case "oldest": reviews.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
      case "highest": reviews.sort((a, b) => b.rating - a.rating); break;
      case "lowest": reviews.sort((a, b) => a.rating - b.rating); break;
      default: break;
    }
    return reviews;
  }, [p.reviewsList, sortOrder, filterRating]);

  /* Explore Shades scroll-scrub */
  const [sectionImgIdx, setSectionImgIdx] = useState(0);
  const shadeRefs = useRef([]);
  shadeRefs.current = (p.shades || []).map((_, i) => shadeRefs.current[i] || React.createRef());

  useEffect(() => {
    const els = shadeRefs.current.map(r => r.current).filter(Boolean);
    if (els.length === 0) return;

    let raf = 0, last = -1;
    const tick = () => {
      const center = window.innerHeight / 2;
      let best = 0, bestDist = Infinity;
      for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        const c = r.top + r.height / 2;
        const d = Math.abs(c - center);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      if (best !== last) {
        last = best;
        setSectionImgIdx(best);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [p.shades]);

  useEffect(() => {
    if (!p.shades?.length) return;
    let id;
    let userTouched = false;
    const stop = () => { userTouched = true; clearInterval(id); };
    window.addEventListener("scroll", stop, { passive: true, once: true });
    window.addEventListener("pointerdown", stop, { once: true });
    id = setInterval(() => {
      if (userTouched) return;
      setSectionImgIdx((i) => (i + 1) % p.shades.length);
    }, 3000);
    return () => {
      clearInterval(id);
      window.removeEventListener("scroll", stop);
      window.removeEventListener("pointerdown", stop);
    };
  }, [p.shades?.length]);

  const getShadeImageByIndex = (i) => {
    const s = p.shades?.[i];
    return s?.thumb ? resolveAsset(s.thumb) : gallery[i] || heroSrc;
  };

  const videoSrc = useMemo(
    () => (p.videoUrl ? resolveMedia(p.videoUrl) : introVideoFallback),
    [p.videoUrl]
  );

  return (
    <div ref={pageRef} className="relative" style={toneVars}>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
      <BackgroundFader background={pageBg} />

      {/* top progress */}
      <div className="fixed left-0 right-0 top-0 h-0.5 bg-black/10 z-40" aria-hidden>
        <div className="h-full bg-black/50 transition-[width] duration-150" style={{ width: `${Math.round(scrollProgress * 100)}%` }} />
      </div>

      {/* ===== HERO SECTION ===== */}
      <div className="mx-auto w-full max-w-7xl mt-10 px-4 sm:px-6 lg:px-8 py-8 md:py-12" data-bg-key="hero">
        {/* breadcrumbs */}
        <nav className="text-xs mb-3 overflow-x-auto whitespace-nowrap text-[var(--fg-muted)]">
          {crumbs.length ? (
            <>Home / {crumbs.map((c, i) => <span key={c+i}>{c}{i<crumbs.length-1 ? " / " : " / "}</span>)}<span className="font-medium text-[var(--fg)]">{p.title}</span></>
          ) : <>Home / <span className="font-medium text-[var(--fg)]">{p.title}</span></>}
        </nav>

        {/* PDP grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
          {/* media */}
          <div className="self-start lg:sticky lg:top-20">
            <div className="grid grid-cols-12 gap-2 sm:gap-4 lg:gap-5 lg:h-full">
              {/* thumbs (desktop) */}
              {!!gallery.length && (
                <div className="hidden lg:flex pt-4 col-span-2 lg:flex-col gap-3 overflow-auto snap-y snap-mandatory pr-1">
                  {gallery.map((g, i) => (
                    <button
                      key={g + i}
                      onClick={() => setActiveImage(i)}
                      className={`rounded-xl overflow-hidden ring-1 snap-start ${i === activeImage ? "ring-black" : "ring-neutral-200"}`}
                      aria-label={`Thumbnail ${i + 1}`}
                    >
                      <img src={g} alt={`thumb ${i + 1}`} className="h-16 w-full object-cover mx-auto" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}

              {/* hero with ultra-smooth crossfade */}
              <div className={gallery.length > 1 ? "col-span-12 lg:col-span-10" : "col-span-12"}>
                <div
                  ref={heroRef}
                  className="relative w-full h-[320px] sm:h-[380px] md:h-[48svh] lg:h-[60svh] overflow-hidden rounded-2xl select-none touch-pan-y"
                  style={{ WebkitUserSelect: "none", userSelect: "none" }}
                >
                  {heroSrc && (
                    <SmoothImage
                      src={heroSrc}
                      alt={`${p.title} image`}
                      className="absolute inset-0 h-full w-full"
                    />
                  )}
                  {heroOverlay && <div className="absolute inset-0 pointer-events-none" style={{ background: heroOverlay }} />}

                  {/* bottom-right Try Virtually chip */}
                  <Link
                    to="/ar/lipstick"
                    onClickCapture={(e) => e.stopPropagation()}
                    className="absolute z-20 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-xs font-medium text-black shadow-sm backdrop-blur hover:bg-white focus:outline-none focus:ring-2 focus:ring-black/30"
                    style={{
                      right: "16px",
                      bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
                    }}
                    aria-label="Try virtually"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v4l3 3-1.5 1.5L11 12V7h2z"/>
                    </svg>
                    Try Virtually
                  </Link>

                  {/* dots — lifted to avoid chip overlap */}
                  {gallery.length > 1 && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-[var(--card-bg)] px-2 py-1 backdrop-blur-md"
                      style={{
                        bottom: "calc(env(safe-area-inset-bottom, 0px) + 52px)",
                      }}
                    >
                      {gallery.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImage(i)}
                          className={`h-1.5 w-4 rounded-full transition-all ${i === activeImage ? "bg-black w-6" : "bg-neutral-400"}`}
                          aria-label={`Go to image ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* thumbs (mobile/tablet) */}
                {gallery.length > 1 && (
                  <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 gap-2 lg:hidden">
                    {gallery.slice(0, 12).map((g, i) => (
                      <button
                        key={g + i}
                        onClick={() => setActiveImage(i)}
                        className={`aspect-square rounded-xl overflow-hidden ring-1 ${i === activeImage ? "ring-black" : "ring-neutral-200"}`}
                        aria-label={`Image ${i + 1}`}
                      >
                        <img src={g} alt={`thumb ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* info */}
          <div className="flex flex-col gap-6 md:h-auto lg:pr-2 justify-start">
            <header>
              <h1 className="text-[clamp(1.25rem,2vw,1.875rem)] font-semibold tracking-tight text-[var(--fg)]">
                {p.title}
              </h1>
              {p.subtitle && <p className="mt-1 text-[var(--fg-muted)]">{p.subtitle}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[var(--fg-muted)]">
                <RatingStars value={p.rating} />
                <span className="text-sm">({p.rating}) · {p.reviews} reviews</span>
                <Badge variant="outline" className="ml-1 bg-[var(--chip-bg)] border-transparent text-[var(--fg)]">
                  <BadgeCheck className="h-3.5 w-3.5 mr-1" /> Marvellè Verified
                </Badge>
              </div>
            </header>

            <div>
              <div className="flex items-end gap-3">
                <div className="text-[clamp(1.25rem,2vw,1.5rem)] font-bold text-[var(--fg)]">{p.currency}{p.price}</div>
                {p.mrp ? <div className="line-through text-[var(--fg-muted)]">{p.currency}{p.mrp}</div> : null}
                {priceBlock.hasSave && <div className="text-emerald-500 text-sm font-medium">{p.discountText}</div>}
              </div>
              <div className="text-xs text-[var(--fg-muted)]">Inclusive of all taxes</div>
            </div>

            {!!p.badges?.length && (
              <div className="flex flex-wrap gap-2">
                {p.badges.map((b) => (
                  <Badge key={b} variant="secondary" className="bg-[var(--chip-bg)] text-[var(--fg)] border-transparent">{b}</Badge>
                ))}
              </div>
            )}

            {!!p.shades?.length && (
              <section>
                <Label className="mb-2 block text-sm text-[var(--fg)]">Choose Shade</Label>
                <div className="flex flex-wrap items-center gap-3">
                  {p.shades.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <ShadeDot
                        img={s.thumb ? resolveAsset(s.thumb) : null}
                        hex={s.hex}
                        label={s.name}
                        active={activeShade === s.key}
                        onClick={() => setActiveShade(s.key)}
                      />
                      <span className={`text-sm ${activeShade === s.key ? "font-medium text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}>{s.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA block */}
            <section>
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center rounded-full border px-2 border-[var(--divider)]">
                    <button className="px-3 py-1 text-lg text-[var(--fg)]" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                    <input
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-10 text-center outline-none bg-transparent text-[var(--fg)]"
                      inputMode="numeric"
                    />
                    <button className="px-3 py-1 text-lg text-[var(--fg)]" onClick={() => setQty((q) => q + 1)}>+</button>
                  </div>

                  {/* Desktop/tablet inline buttons */}
                  <div className="hidden sm:flex items-center gap-3 ml-auto">
                    <Button className="rounded-full px-5 sm:px-6 min-h-10 sm:min-h-11">
                      <ShoppingCart className="h-4 w-4 mr-2" /> Add to Cart
                    </Button>
                    <Button variant="outline" className="rounded-full px-5 sm:px-6 min-h-10 sm:min-h-11">
                      Buy Now
                    </Button>
                  </div>
                </div>

                {/* Mobile buttons side-by-side */}
                <div className="grid grid-cols-2 gap-2 sm:hidden">
                  <Button className="rounded-full w-full min-h-11">
                    <ShoppingCart className="h-4 w-4 mr-2" /> Add to Cart
                  </Button>
                  <Button variant="outline" className="rounded-full w-full min-h-11">
                    Buy Now
                  </Button>
                </div>

                {/* Icons row */}
                <div className="flex items-center gap-2 justify-start sm:justify-end">
                  <button className="p-2 rounded-full border border-[var(--divider)] text-[var(--fg)]"><Heart className="h-4 w-4" /></button>
                  <button className="p-2 rounded-full border border-[var(--divider)] text-[var(--fg)]"><Share2 className="h-4 w-4" /></button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs mt-4">
              <div className="flex items-center gap-2 rounded-lg border p-2.5 border-[var(--divider)] text-[var(--fg)] bg-[var(--card-bg)]"><Truck className="h-4 w-4" /> {p.shipping}</div>
              <div className="flex items-center gap-2 rounded-lg border p-2.5 border-[var(--divider)] text-[var(--fg)] bg-[var(--card-bg)]"><ShieldCheck className="h-4 w-4" /> Secure payments</div>
              <div className="flex items-center gap-2 rounded-lg border p-2.5 border-[var(--divider)] text-[var(--fg)] bg-[var(--card-bg)]"><Recycle className="h-4 w-4" /> Easy Returns</div>
            </section>

            <Separator className="bg-[var(--divider)]" />

            <section className="grid md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-base sm:text-lg font-semibold mb-3 text-[var(--fg)]">Why you'll love it</h2>
                <ul className="list-disc pl-5 space-y-1 text-[var(--fg-muted)]">
                  {p.benefits?.map((b, i) => (<li key={i}>{b}</li>))}
                </ul>
              </div>
              <div className="rounded-2xl border p-4 border-[var(--divider)] bg-[var(--card-bg)]">
                <h3 className="font-medium mb-2 text-[var(--fg)]">Ingredient highlights</h3>
                <ul className="space-y-2 text-sm text-[var(--fg-muted)]">
                  {p.ingredients_highlight?.map((it, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 mt-0.5" />
                      <span><span className="font-medium text-[var(--fg)]">{it.name}</span> — {it.why}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section>
              <Tabs defaultValue="details">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="claims">Claims</TabsTrigger>
                  <TabsTrigger value="faqs">FAQs</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="mt-4 text-[var(--fg-muted)]">
                  <p className="text-[var(--fg)]">{p.subtitle}</p>
                  <p>Finish: soft-matte • Coverage: full-pigment • Fragrance-free.</p>
                </TabsContent>
                <TabsContent value="claims" className="mt-4 text-[var(--fg-muted)]">
                  <ul className="list-disc pl-5 space-y-1">{p.claims?.map((c, i) => (<li key={i}>{c}</li>))}</ul>
                  {p.disclaimer && <div className="text-xs opacity-70 mt-2">{p.disclaimer}</div>}
                </TabsContent>
                <TabsContent value="faqs" className="mt-4 text-[var(--fg-muted)]">
                  <Accordion type="single" collapsible className="w-full">
                    {p.faqs?.map((f, i) => (
                      <AccordionItem key={i} value={`faq-${i}`}>
                        <AccordionTrigger className="text-[var(--fg)]">{f.q}</AccordionTrigger>
                        <AccordionContent>{f.a}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </TabsContent>
              </Tabs>
            </section>
          </div>
        </section>
      </div>

      {/* ===== INGREDIENTS ===== */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row items-center gap-8 lg:gap-16" data-bg-key="ingredients">
        <div className="w-full lg:w-2/3">
          <div className="rounded-2xl border p-4 border-[var(--divider)] bg-[var(--card-bg)] backdrop-blur-sm">
            <h3 className="text-xl font-semibold mb-2 text-[var(--fg)]">Ingredient Highlights</h3>
            <ul className="space-y-6 text-sm py-4 text-[var(--fg-muted)]">
              {p.ingredients_highlight?.map((it, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Sparkles className="h-4 w-6 mt-0.5 flex-shrink-0" />
                  <span>
                    <span className="font-medium text-[var(--fg)]">{it.name}</span>
                    <span> — {it.why}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="w-full lg:w-1/3 flex justify-center">
          <img
            src={resolveAsset(p.hero?.image) || heroSrc}
            alt="Product Main"
            className="rounded-2xl w-full max-w-[360px] object-cover shadow-sm"
            loading="lazy"
          />
        </div>
      </section>

      {/* ===== VIDEO ===== */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8" data-bg-key="video">
        <h2 className="text-2xl md:text-3xl font-semibold mb-4 text-center text-[var(--fg)]">Watch In Action</h2>
        <VideoHero
          src={videoSrc}
          poster={resolveAsset(p.hero?.image) || heroSrc}
          heightClass="h-[52svh] md:h-[60svh] lg:h-[64svh]"
          overlayClass="bg-[radial-gradient(80%_80%_at_0%_100%,rgba(0,0,0,0.55)_0%,transparent_60%)]"
          startMuted
          loop
          autoPauseOffscreen
          showControls
        >
          <div className="pointer-events-none absolute bottom-6 sm:bottom-8 left-4 sm:left-6 z-10 max-w-xl text-white md:bottom-12">
            <h3 className="pointer-events-auto mb-2 sm:mb-3 text-xl sm:text-2xl md:text-4xl font-semibold tracking-wide">
              Marvellè Beautè
            </h3>
            <p className="pointer-events-auto max-w-lg text-xs sm:text-sm md:text-base leading-relaxed text-white/85">
              Velvet matte color and intense longwear adorn lips with immediate
              moisture and rich tones — in 28 irresistible shades.
            </p>
          </div>
        </VideoHero>
      </section>

      {/* ===== EXPLORE SHADES ===== */}
      {!!p.shades?.length && (
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16" data-bg-key="shades">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl md:text-3xl font-semibold text-[var(--fg)]">Explore Shades</h2>
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setSectionImgIdx((i) => Math.max(0, i - 1));
                  shadeRefs.current[Math.max(0, sectionImgIdx - 1)]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                aria-label="Previous shade"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setSectionImgIdx((i) => Math.min(p.shades.length - 1, i + 1));
                  shadeRefs.current[Math.min(p.shades.length - 1, sectionImgIdx + 1)]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                aria-label="Next shade"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Sticky preview */}
            <div className="lg:sticky lg:top-24 h-fit">
              <SmoothImage
                src={getShadeImageByIndex(sectionImgIdx)}
                alt={`Shade ${sectionImgIdx + 1}`}
                className="rounded-2xl w-full h-auto"
              />
              <div className="mt-3 flex items-center justify-center gap-1.5">
                {p.shades.map((_, i) => (
                  <span key={i} className={`h-1.5 w-4 rounded-full transition-all ${sectionImgIdx === i ? "bg-black w-6" : "bg-neutral-400"}`} />
                ))}
              </div>

              {/* Mobile chip rail */}
              <div className="mt-4 lg:hidden overflow-x-auto no-scrollbar">
                <div className="flex gap-2 snap-x snap-mandatory">
                  {p.shades.map((s, i) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        setSectionImgIdx(i);
                        shadeRefs.current[i]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className={`snap-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm ring-1 transition ${
                        sectionImgIdx === i ? "bg-black text-white ring-black" : "bg-[var(--chip-bg)] text-[var(--fg)] ring-[var(--divider)]"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable cards */}
            <div className="space-y-4">
              {p.shades.map((s, i) => (
                <div
                  key={s.key}
                  ref={shadeRefs.current[i]}
                  onClick={() => {
                    setSectionImgIdx(i);
                    shadeRefs.current[i]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${
                    sectionImgIdx === i ? "border-black bg-[var(--card-bg)]" : "border-[var(--divider)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-6 w-6 rounded-full ring-1 ring-black/10 overflow-hidden"
                      style={{ background: s.hex }}
                    >
                      {s.thumb && <img src={resolveAsset(s.thumb)} alt={s.name} className="h-full w-full object-cover rounded-full" />}
                    </span>
                    <h3 className="text-base font-semibold text-[var(--fg)]">{s.name}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text:[var(--fg-muted)]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== REVIEWS ===== */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8" data-bg-key="reviews">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
          <h2 className="text-2xl md:text-3xl font-semibold text-[var(--fg)]">Customer Reviews</h2>
          <div className="flex items-center gap-4">
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="highest">Highest Rating</SelectItem>
                <SelectItem value="lowest">Lowest Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-[var(--fg-muted)]">
          {filteredAndSortedReviews.map((r, i) => (
            <div key={i} className="border-b py-6 border-[var(--divider)]">
              <RatingStars value={r.rating} />
              <div className="text-lg font-medium mt-1 text-[var(--fg)]">{r.title}</div>
              <div>{r.comment}</div>
              <div className="text-xs opacity-75 mt-1">{r.author} · {r.date}</div>
            </div>
          ))}
          {!filteredAndSortedReviews.length && (
            <div className="mt-4 text-center py-8">
              {p.reviewsList?.length ? "No reviews match your current filters." : "No reviews yet — be the first to share your thoughts!"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
