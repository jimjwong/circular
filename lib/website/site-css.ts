// Baseline styles for rendered site content. The builder canvas and the published page
// both load this, so what an author sees while editing matches what visitors get.
export const SITE_RESET = `
.ws-site{background:#fff;color:#18251f;font-family:var(--font-inter),ui-sans-serif,system-ui,sans-serif}
.ws-site *,.ws-site *::before,.ws-site *::after{box-sizing:border-box}
.ws-site img{max-width:100%;height:auto;display:block}
.ws-site a{color:inherit}
.ws-site h1,.ws-site h2,.ws-site h3,.ws-site h4{font-family:var(--font-manrope),ui-sans-serif,system-ui,sans-serif;margin:0}
.ws-site p{margin:0}
.ws-site hr{border:0;border-top:1px solid #e0e7e2;margin:24px 0}
.ws-site form{display:flex;flex-direction:column;gap:12px}
.ws-site label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}
.ws-site input,.ws-site textarea{border:1px solid #dce5df;border-radius:10px;padding:10px 12px;font:inherit;font-weight:400}
.ws-site button[type=submit]{border:0;border-radius:12px;padding:13px 22px;background:#183f30;color:#fff;font-weight:700;cursor:pointer}
.ws-block-heading{font-size:26px;font-weight:700;margin:0 0 18px}
.ws-block-list{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.ws-block-item{border:1px solid #e3e9e5;border-radius:16px;padding:18px;display:grid;gap:6px}
.ws-block-title{font-size:16px}
.ws-block-meta{font-size:12px;color:#77867d;font-weight:600}
.ws-block-body{font-size:14px;line-height:1.6;color:#5f7066}
.ws-block-price{font-size:22px;font-weight:700}
.ws-block-empty{font-size:14px;color:#77867d}
.ws-block-cta{display:inline-block;padding:14px 26px;border-radius:12px;background:#183f30;color:#fff;font-weight:700;text-decoration:none}
.ws-collection-item{display:contents}
`;

/** Selection and drag affordances. Canvas only — never sent to a published page. */
export const CANVAS_CHROME = `
.ws-node{outline:1px solid transparent;transition:outline-color .1s ease}
.ws-node:hover{outline-color:#9fc9b4}
.ws-node-selected{outline:2px solid #2e7b5c !important;outline-offset:-2px}
.ws-node-dragging{opacity:.4}
.ws-drop-slot{list-style:none}
`;
