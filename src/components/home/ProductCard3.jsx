import React, { useState } from "react";
import { Heart, Video, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import image1 from "@/assets/images/product1.png";
import image2 from "@/assets/images/product2.png";
import image3 from "@/assets/images/product3.png";
import image4 from "@/assets/images/product4.png";
import image5 from "@/assets/images/product5.png";
import image6 from "@/assets/images/product6.png";
import image7 from "@/assets/images/product7.png";
import image8 from "@/assets/images/product8.png";
import image9 from "@/assets/images/product9.png";
import image10 from "@/assets/images/product10.png";
import image11 from "@/assets/images/product11.png";
import image12 from "@/assets/images/product12.png";
import bg from "@/assets/background/card-bg.svg";

const products = [
  { id: 1, image: image1, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 2, image: image2, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 3, image: image3, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 4, image: image4, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 5, image: image5, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 6, image: image6, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 7, image: image7, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 8, image: image8, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 9, image: image9, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 10, image: image10, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 11, image: image11, name: "Marvellè Beautè - Satin Lipstick" },
  { id: 12, image: image12, name: "Marvellè Beautè - Satin Lipstick" },
];

const INITIAL_VISIBLE = 4;

const ProductCard3 = () => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? products : products.slice(0, INITIAL_VISIBLE);
  const remaining = Math.max(products.length - INITIAL_VISIBLE, 0);

  return (
    <section className="w-full bg-white">
      {/* Product grid */}
      <div className="grid grid-cols-2 gap-0 md:grid-cols-3 lg:grid-cols-4">
        {visible.map((product) => (
          <div key={product.id} className="relative flex flex-col justify-between text-center">
            {/* Background behind everything */}
            <img
              src={bg}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Card content (wrapped with Link to details) */}
            <Link
              to={`/product/${product.id}`}
              state={{ product }}
              className="relative z-10 flex h-full flex-col"
            >
              {/* Top row */}
              <div className="absolute left-2 top-2 flex items-center gap-2 text-xs font-medium text-black">
                <span className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-full bg-white/70 backdrop-blur">
                  <Video className="h-4 w-4" />
                  Virtual Try On
                </span>
              </div>

              {/* Wishlist (kept as a separate button, not inside Link for a11y) */}
              <button
                type="button"
                aria-label="Add to wishlist"
                className="absolute right-2 top-2 z-20 p-1 rounded-full bg-white/80 backdrop-blur hover:bg-white"
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: handle wishlist here
                }}
              >
                <Heart className="h-4 w-4" />
              </button>

              {/* Image area */}
              <div className="relative flex flex-1 items-center justify-center px-4 pt-12 pb-2">
                {/* Stub arrows (no-op for now) */}
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/80 hover:bg-white"
                  onClick={(e) => e.preventDefault()}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <img
                  src={product.image}
                  alt={product.name}
                  className="max-h-[500px] w-full object-contain"
                />

                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/80 hover:bg-white"
                  onClick={(e) => e.preventDefault()}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Details */}
              <div className="mt-2 px-4 pb-6 text-sm text-left">
                <p className="text-[12px] leading-none text-neutral-500">New · Refillable</p>
                <div className="mt-1 flex items-center justify-between">
                  <h3 className="text-[14px] font-medium text-neutral-800">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#AD0F23]" />
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#BF4A57]" />
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#8E0F1E]" />
                    <span className="ml-2 text-[12px] leading-none text-neutral-600">+ 24</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* View more / less */}
      {products.length > INITIAL_VISIBLE && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className="rounded-full border border-neutral-400 px-8 py-2 text-sm font-medium hover:bg-neutral-100"
            aria-expanded={expanded}
          >
            {expanded ? "View Less" : remaining > 0 ? `View More (${remaining})` : "View More"}
          </button>
        </div>
      )}
    </section>
  );
};

export default ProductCard3;
