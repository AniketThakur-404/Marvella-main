import React from "react";
import logo from "@/assets/logos/logo.svg";

export default function Footer() {
  return (
    <footer className="bg-white text-neutral-900 border-t">
      <div className="mx-auto max-w-screen-2xl px-6 md:px-10 lg:px-14">
        {/* Top: 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 py-14">
          {/* HELP */}
          <div>
            <h6 className="text-[10px] tracking-[0.22em] uppercase text-neutral-500 mb-4">Help</h6>
            <p className="text-sm leading-7" style={{ fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}>
              You can{" "}
              <a href="#call" className="underline underline-offset-2 hover:no-underline">call</a>{" "}
              or{" "}
              <a href="#email" className="underline underline-offset-2 hover:no-underline">email us</a>.
            </p>
            <ul className="mt-6 space-y-3 text-sm" style={{ fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}>
              <li><a href="#faqs" className="hover:underline underline-offset-2">FAQ&apos;s</a></li>
              <li><a href="#care" className="hover:underline underline-offset-2">Product Care</a></li>
              <li><a href="#stores" className="hover:underline underline-offset-2">Stores</a></li>
            </ul>
          </div>

          {/* SERVICES */}
          <div>
            <h6 className="text-[10px] tracking-[0.22em] uppercase text-neutral-500 mb-4">Services</h6>
            <ul className="space-y-3 text-sm" style={{ fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}>
              <li><a href="#repairs" className="hover:underline underline-offset-2">Repairs</a></li>
              <li><a href="#personalization" className="hover:underline underline-offset-2">Personalization</a></li>
              <li><a href="#gifting" className="hover:underline underline-offset-2">Art of Gifting</a></li>
              <li><a href="#apps" className="hover:underline underline-offset-2">Download our Apps</a></li>
            </ul>
          </div>

          {/* ABOUT */}
          <div>
            <h6 className="text-[10px] tracking-[0.22em] uppercase text-neutral-500 mb-4">About Marvellè Beautè</h6>
            <ul className="space-y-3 text-sm" style={{ fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}>
              <li><a href="#shows" className="hover:underline underline-offset-2">Fashion Shows</a></li>
              <li><a href="#arts" className="hover:underline underline-offset-2">Arts & Culture</a></li>
              <li><a href="#maison" className="hover:underline underline-offset-2">La Maison</a></li>
              <li><a href="#sustainability" className="hover:underline underline-offset-2">Sustainability</a></li>
              <li><a href="#news" className="hover:underline underline-offset-2">Latest News</a></li>
              <li><a href="#careers" className="hover:underline underline-offset-2">Careers</a></li>
              <li><a href="#foundation" className="hover:underline underline-offset-2">Foundation Marvellè Beautè</a></li>
            </ul>
          </div>

          {/* EMAIL SIGN-UP */}
          <div>
            <h6 className="text-[10px] tracking-[0.22em] uppercase text-neutral-500 mb-4">Email sign-up</h6>
            <p className="text-sm leading-7" style={{ fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}>
              <a href="#signup" className="underline underline-offset-2 hover:no-underline">Sign up</a>{" "}
              for Marvellè Beautè emails and receive the latest news from the Maison, including exclusive online pre-launches and new collections
            </p>
            <a href="#follow" className="mt-6 inline-block text-sm hover:underline underline-offset-2" style={{ fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}>
              Follow Us
            </a>
          </div>
        </div>

        {/* Bottom: language • wordmark • legal */}
        <div className="flex flex-col gap-6 border-t pt-8 pb-10 md:flex-row md:items-center md:gap-4">
          {/* Language */}
          <div className="order-2 md:order-1 md:w-1/3">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm text-neutral-700 hover:text-black"
              style={{ fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}
              aria-label="Change language"
            >
              <GlobeIcon className="h-4 w-4" />
              International (English)
            </button>
          </div>

          {/* Wordmark */}
          <div className="order-1 md:order-2 md:w-1/3 flex justify-center">
            <div
              className="text-2xl md:text-3xl tracking-[0.35em] select-none"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, "Times New Roman", serif' }}
              aria-label="Louis Vuitton wordmark"
            >
            <img src={logo} alt="" className="h-5 w-auto lg:h-9" />
            </div>
          </div>

          {/* Legal */}
          <nav className="order-3 md:order-3 md:w-1/3 flex items-center justify-start md:justify-end gap-6 text-sm text-neutral-700"
               style={{ fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }}>
            <a href="#sitemap" className="hover:underline underline-offset-2">Sitemap</a>
            <a href="#legal" className="hover:underline underline-offset-2">Legal & privacy</a>
            <a href="#cookies" className="hover:underline underline-offset-2">Cookies</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function GlobeIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 12h18M12 3c2.5 2.8 3.75 6.2 3.75 9s-1.25 6.2-3.75 9c-2.5-2.8-3.75-6.2-3.75-9s1.25-6.2 3.75-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
