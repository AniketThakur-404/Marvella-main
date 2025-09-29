import React from "react";
import image from '@/assets/images/image.webp'


const HeroSection = ({
  label = "EXCLUSIVE PREORDER",
  title = "Marvellè Beautè Travels With Grace Coddington",
  ctaText = "Discover the Collection",
  ctaHref = "#",
}) => {
  return (
    <section className="relative isolate w-full overflow-hidden bg-black">
      {/* Background image */}
      <div className="relative h-[72vh] min-h-[420px] w-full md:h-[100vh]">
        <img
          src={image}
          alt="Campaign"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />

        {/* Subtle bottom gradient for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(0,0,0,0.55)_85%)]" />

        {/* Copy block */}
        <div className="absolute inset-x-0 bottom-12 mx-auto flex max-w-screen-xl flex-col items-center px-4 text-center text-white md:bottom-16">
          {label ? (
            <p className="mb-3 text-[10px] tracking-[0.3em] text-white/80 md:text-xs">
              {label}
            </p>
          ) : null}

          <h1 className="mb-4 max-w-5xl text-balance text-[22px] font-semibold leading-tight tracking-wide sm:text-[26px] md:mb-6 md:text-[34px] lg:text-[42px]">
            {title}
          </h1>

          <a
            href={ctaHref}
            className="rounded-full bg-white/90 px-5 py-3 text-[13px] font-medium text-neutral-900 hover:bg-white"
            aria-label={ctaText}
          >
            {ctaText}
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
