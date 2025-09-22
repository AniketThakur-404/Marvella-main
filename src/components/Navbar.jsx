// "use client"
import React, { useEffect, useRef, useState } from "react";
import { Menu, Search, Heart, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import logo from "@/assets/logos/logo.svg";

const NAV_H_MOBILE = "h-16";   // 64px
const NAV_H_DESKTOP = "md:h-20"; // 80px

const Navbar= () => {
  const [solid, setSolid] = useState(false);
  const ticking = useRef(false);
  const THRESHOLD = 40;

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        setSolid(window.scrollY > THRESHOLD);
        ticking.current = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 w-full transition-[background-color,backdrop-filter,border-color,box-shadow] duration-300
        ${solid
          ? "bg-white/95 border-b border-neutral-200 backdrop-blur supports-[backdrop-filter]:bg-white shadow-sm"
          : "bg-transparent border-transparent"}`}
    >
      <div className={`mx-auto flex max-w-screen-2xl items-center justify-between px-3 md:px-6 ${NAV_H_MOBILE} ${NAV_H_DESKTOP}`}>
        {/* Left: Menu + Search */}
        <div className="flex items-center gap-4 md:gap-6">
          <Sheet>
            <SheetTrigger asChild>
              <button
                className={`group flex items-center gap-2 text-sm hover:opacity-80 transition-colors duration-300 ${
                  solid ? "text-neutral-800" : "text-white"
                }`}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
                <span className="hidden sm:inline">Menu</span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="p-6">
                <h3 className="mb-4 text-lg font-semibold tracking-wide">Menu</h3>
                <nav className="space-y-3 text-sm">
                  <a className="block hover:underline" href="#">New Arrivals</a>
                  <a className="block hover:underline" href="#">Women</a>
                  <a className="block hover:underline" href="#">Men</a>
                  <a className="block hover:underline" href="#">Bags</a>
                  <a className="block hover:underline" href="#">Perfumes</a>
                  <a className="block hover:underline" href="#">Gifts</a>
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          <button
            className={`group flex items-center gap-2 text-sm hover:opacity-80 transition-colors duration-300 ${
              solid ? "text-neutral-800" : "text-white"
            }`}
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>

        {/* Center brand */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">
          <img
            src={logo}
            alt="Brand"
            className={`h-5 w-auto lg:h-7 transition-[filter] duration-300 ${solid ? "" : "invert"}`}
          />
        </div>

        {/* Right: Call + icons */}
        <div className="flex items-center gap-4 md:gap-6">
          <a
            href="#"
            className={`text-sm hover:opacity-80 transition-colors duration-300 ${
              solid ? "text-neutral-800" : "text-white"
            }`}
            aria-label="Call Us"
          >
            Call Us
          </a>
          <Separator
            orientation="vertical"
            className={`h-4 transition-opacity duration-300 ${
              solid ? "opacity-100" : "opacity-0"
            }`}
          />
          <button
            className={`inline-flex items-center justify-center hover:opacity-80 transition-colors duration-300 ${
              solid ? "text-neutral-800" : "text-white"
            }`}
            aria-label="Wishlist"
          >
            <Heart className="h-5 w-5" />
          </button>
          <button
            className={`inline-flex items-center justify-center hover:opacity-80 transition-colors duration-300 ${
              solid ? "text-neutral-800" : "text-white"
            }`}
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
