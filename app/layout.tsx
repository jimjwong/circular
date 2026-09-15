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
// on every <form>, <input>, and <select> — before React hydrates. The server-rendered
// HTML never has them, so every page with a form surfaces a hydration-mismatch error,
// one page at a time, as each is first hit.
//
// The injection turned out to land on every descendant of <body> at once — likely the
// browser rewriting the response body itself before the page is parsed, rather than a
// content script mutating the live DOM afterward — so a first pass that only checked
// document.documentElement's own attributes missed every form field entirely. This
// sweeps every element already in the document, then keeps a MutationObserver running
// in case any browser instead adds these attributes as a later, live mutation.
// beforeInteractive guarantees this runs before Next's own hydration.
const STRIP_INJECTED_ATTRIBUTES_SCRIPT = `
(function () {
  var PREFIX = "__gcr";
  function stripOwn(el) {
    for (var i = el.attributes.length - 1; i >= 0; i--) {
      var name = el.attributes[i].name;
      if (name.indexOf(PREFIX) === 0) el.removeAttribute(name);
    }
  }
  function stripTree(root) {
    stripOwn(root);
    var all = root.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++) stripOwn(all[i]);
  }
  stripTree(document.documentElement);
  if (typeof MutationObserver === "undefined") return;
  new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === "attributes" && m.attributeName && m.attributeName.indexOf(PREFIX) === 0) {
        m.target.removeAttribute(m.attributeName);
      } else if (m.type === "childList") {
        for (var j = 0; j < m.addedNodes.length; j++) {
          if (m.addedNodes[j].nodeType === 1) stripTree(m.addedNodes[j]);
        }
      }
    }
  }).observe(document.documentElement, { attributes: true, subtree: true, childList: true });
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
