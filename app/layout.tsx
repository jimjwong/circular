import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Commune — Community OS",
  description: "The operating system for modern membership communities.",
};

// Some mobile browsers (in-app AI/proxy renderers in particular) inject their own
// tracking attributes — seen so far as __gcrremoteframetoken on <html> and __gcruniqueid
// on every <form> and <input> — before React hydrates. The server-rendered HTML never
// has them, so every page with a form surfaces a hydration-mismatch error, one page at a
// time, as each is first hit. Rather than sprinkle suppressHydrationWarning across every
// form in the app, this strips any such attribute the instant it appears, so hydration
// never sees a mismatch in the first place. beforeInteractive runs this before Next's own
// hydration, and the MutationObserver keeps catching attributes added afterward.
const STRIP_INJECTED_ATTRIBUTES_SCRIPT = `
(function () {
  var PREFIX = "__gcr";
  function strip(el) {
    for (var i = el.attributes.length - 1; i >= 0; i--) {
      var name = el.attributes[i].name;
      if (name.indexOf(PREFIX) === 0) el.removeAttribute(name);
    }
  }
  strip(document.documentElement);
  if (typeof MutationObserver === "undefined") return;
  new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === "attributes" && m.attributeName && m.attributeName.indexOf(PREFIX) === 0) {
        m.target.removeAttribute(m.attributeName);
      }
    }
  }).observe(document.documentElement, { attributes: true, subtree: true });
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${manrope.variable}`}>
        {children}
        <Script id="strip-injected-attributes" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: STRIP_INJECTED_ATTRIBUTES_SCRIPT }} />
      </body>
    </html>
  );
}
