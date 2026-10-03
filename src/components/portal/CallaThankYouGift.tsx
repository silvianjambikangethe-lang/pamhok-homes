"use client";

import { useEffect, useRef } from "react";

// A small thank-you gift for 3.5-4.7 star reviews — the warmer ThankYouGift
// bouquet (envelope, platter, replay button) is reserved for 4.8+, so this
// is deliberately simple: a calla-lilies bouquet pops up, holds, then
// shrinks away on its own. No envelope, no platter, no replay. The Cormorant
// Garamond font is swapped for a Georgia fallback, since pulling the Google
// Fonts stylesheet at runtime would be blocked by this app's CSP (style-src
// 'self' only, see next.config.ts).
const STYLE = `
#ov{position:fixed;inset:0;z-index:60;visibility:hidden;pointer-events:none;overflow:hidden}
#ov.active{visibility:visible;pointer-events:auto}
#ov.hiding{opacity:0;transition:opacity .4s ease}
#veil{position:absolute;inset:0;background:rgba(28,18,14,0);-webkit-backdrop-filter:blur(0px);backdrop-filter:blur(0px);transition:background .6s ease,backdrop-filter .6s ease,-webkit-backdrop-filter .6s ease}
#ov.giftBlur #veil{background:rgba(28,18,14,.4);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
#card{position:absolute;left:50%;top:50%;width:min(360px,88vw);transform:translate(-50%,-50%) scale(.4);opacity:0;display:flex;flex-direction:column;align-items:center;text-align:center}
#scene{position:relative;width:100%}
#bq{display:block;width:100%;height:auto;overflow:visible}
#title{margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-weight:600;font-size:26px;line-height:1.25;text-wrap:balance;color:#F7EEDB;opacity:0}
.reveal{animation:fadeUp 1s ease-out .3s both}
.show{opacity:1!important}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.vase,.fl,.rise,.leaf{opacity:0}
.stem{stroke-dasharray:1;stroke-dashoffset:1}
.rise,.leaf{transform-box:fill-box;transform-origin:50% 100%;transform:scale(.2)}
#bq.go .vase{animation:vIn 1.1s ease-out forwards}
#bq.go .stem{animation:draw .9s ease-out forwards;animation-delay:var(--d)}
#bq.go .leaf,#bq.go .rise{animation:rise 1.5s cubic-bezier(.22,.8,.24,1) forwards;animation-delay:var(--d)}
#bq.go .sway{animation:sway 8s ease-in-out 3.6s infinite}
#bq.still .vase,#bq.still .rise,#bq.still .leaf{opacity:1;transform:none}
#bq.still .stem{stroke-dashoffset:0}
.sway{transform-box:view-box;transform-origin:180px 252px}
@keyframes vIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes rise{0%{opacity:0;transform:scale(.2)}50%{opacity:1}100%{opacity:1;transform:none}}
@keyframes sway{0%,100%{transform:rotate(-.5deg)}50%{transform:rotate(.6deg)}}
`;

// ---------------------------------------------------------------------------
// Builds a calla-lilies-only bouquet SVG, reusing the same vase/stem/leaf
// drawing approach as ThankYouGift's full bouquet.
// ---------------------------------------------------------------------------

function ruffle(): [number, number][] {
  const pts: [number, number][] = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = 100 + 160 * u;
    const y =
      248 +
      9 * Math.sin(Math.PI * u) +
      6 * Math.sin(u * Math.PI * 11 + 0.6) * (0.6 + 0.4 * Math.sin(u * Math.PI * 3.3 + 1));
    pts.push([x, y]);
  }
  return pts;
}

function ruffleLine(dy: number) {
  const p = ruffle();
  let d = "M" + p[0][0].toFixed(1) + " " + (p[0][1] + dy).toFixed(1);
  for (let i = 1; i < p.length; i++) {
    d += " L" + p[i][0].toFixed(1) + " " + (p[i][1] + dy).toFixed(1);
  }
  return d;
}

function backRing(): [string, string] {
  const p = ruffle();
  const N = p.length - 1;
  let d = "M";
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = p[i][0];
    const y = 243 - 5 * Math.sin(Math.PI * u) + 3.5 * Math.sin(u * Math.PI * 10 + 1.3);
    d += (i ? " L" : "") + x.toFixed(1) + " " + y.toFixed(1);
  }
  const line = d;
  for (let i = N; i >= 0; i--) {
    d += " L" + p[i][0].toFixed(1) + " " + p[i][1].toFixed(1);
  }
  return [line, d + "Z"];
}

function vasePath() {
  const p = ruffle();
  let d = ruffleLine(0);
  const e = p[p.length - 1];
  d +=
    " C246 " +
    (e[1] + 6).toFixed(1) +
    " 218 258 208 266 C210 286 248 298 248 332 C248 370 218 404 208 422 L152 422 C142 404 112 370 112 332 C112 298 150 286 152 266 C142 258 114 " +
    (p[0][1] + 6).toFixed(1) +
    " 100 " +
    p[0][1].toFixed(1) +
    "Z";
  return d;
}

const defs =
  '<defs>' +
  '<linearGradient id="vBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0B2A22"/><stop offset=".26" stop-color="#1F5A4A"/><stop offset=".42" stop-color="#3F866C"/><stop offset=".62" stop-color="#1B5042"/><stop offset="1" stop-color="#0A241E"/></linearGradient>' +
  '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A6A1F"/><stop offset=".3" stop-color="#EBD283"/><stop offset=".55" stop-color="#B8892B"/><stop offset=".8" stop-color="#F3E3A0"/><stop offset="1" stop-color="#8A6A1F"/></linearGradient>' +
  '<radialGradient id="cream" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#FBF3DD"/><stop offset="1" stop-color="#DCC99A"/></radialGradient>' +
  '<radialGradient id="floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
  '<pattern id="dam" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M9 2 L15 9 L9 16 L3 9Z" fill="none" stroke="#E8CE7A" stroke-opacity=".28" stroke-width=".7"/><circle cx="9" cy="9" r="1" fill="#E8CE7A" fill-opacity=".3"/></pattern>' +
  '<linearGradient id="cOut2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#FBF9F1"/><stop offset=".65" stop-color="#EFE9D6"/><stop offset="1" stop-color="#D9D0B4"/></linearGradient>' +
  '<linearGradient id="cIn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F1EDDD"/><stop offset="1" stop-color="#BFC8A3"/></linearGradient>' +
  '<linearGradient id="cSpad2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F6B25A"/><stop offset=".5" stop-color="#EC8F32"/><stop offset="1" stop-color="#C9631A"/></linearGradient>' +
  '<linearGradient id="cShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6B6240" stop-opacity="0"/><stop offset=".6" stop-color="#6B6240" stop-opacity="0"/><stop offset="1" stop-color="#6B6240" stop-opacity=".24"/></linearGradient>' +
  '<linearGradient id="cGreen" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#8DB36A" stop-opacity=".85"/><stop offset=".3" stop-color="#8DB36A" stop-opacity=".3"/><stop offset=".55" stop-color="#8DB36A" stop-opacity="0"/></linearGradient>' +
  '<linearGradient id="lg2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#143F31"/><stop offset=".55" stop-color="#23674F"/><stop offset="1" stop-color="#3B8A68"/></linearGradient>' +
  '<g id="lf2"><path d="M0 0 C-.5 -.12 -.62 -.5 -.1 -1 C0 -1.04 .06 -1.02 .1 -1 C.62 -.5 .5 -.12 0 0Z" fill="url(#lg2)" stroke="#0F3126" stroke-width=".7" stroke-opacity=".6" vector-effect="non-scaling-stroke"/><path d="M0 -.04 L0 -.93 M0 -.22 C-.18 -.27 -.32 -.36 -.42 -.5 M0 -.22 C.18 -.27 .32 -.36 .42 -.5 M0 -.42 C-.14 -.46 -.26 -.54 -.32 -.66 M0 -.42 C.14 -.46 .26 -.54 .32 -.66 M0 -.62 C-.08 -.66 -.15 -.72 -.19 -.8 M0 -.62 C.08 -.66 .15 -.72 .19 -.8" fill="none" stroke="#9FD1B0" stroke-opacity=".45" stroke-width=".6" vector-effect="non-scaling-stroke"/></g>' +
  '<linearGradient id="lg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1C4527"/><stop offset=".5" stop-color="#3F7B3E"/><stop offset="1" stop-color="#6BA853"/></linearGradient>' +
  '<g id="lf"><path d="M0 0 C-.34 -.22 -.36 -.74 0 -1 C.36 -.74 .34 -.22 0 0Z" fill="url(#lg)" stroke="#1B3F25" stroke-width=".7" stroke-opacity=".6" vector-effect="non-scaling-stroke"/><path d="M0 -.04 L0 -.9" fill="none" stroke="#B5D69B" stroke-opacity=".5" stroke-width=".7" vector-effect="non-scaling-stroke"/></g>' +
  '<g id="callaA">' +
  '<path d="M-34 -84 C-36 -108 -10 -126 22 -122 C38 -120 48 -108 50 -92 C51 -88 52 -86 54 -82 C48 -88 44 -80 40 -74 C24 -62 -16 -62 -34 -84Z" fill="url(#cIn2)" stroke="#D7CDB4" stroke-width=".8"/>' +
  '<path d="M-30 -86 C-28 -104 -8 -118 18 -116 C0 -110 -18 -98 -24 -80Z" fill="#9AA07A" fill-opacity=".16"/>' +
  '<path d="M-5 -66 C-6 -78 -3 -88 4 -96 C8 -88 8 -76 4 -66Z" fill="url(#cSpad2)" stroke="#B45F1A" stroke-width=".5"/>' +
  '<path d="M-1.5 -70 C-2 -78 0 -86 3 -92" fill="none" stroke="#FFD9A0" stroke-opacity=".7" stroke-width=".8" stroke-linecap="round"/>' +
  '<path d="M0 0 C-8 -10 -22 -30 -30 -56 C-33 -68 -34 -78 -34 -84 C-16 -62 24 -62 40 -74 C42 -54 24 -20 0 0Z" fill="url(#cOut2)" stroke="#D7CDB4" stroke-width=".8"/>' +
  '<path d="M0 0 C-8 -10 -22 -30 -30 -56 C-33 -68 -34 -78 -34 -84 C-16 -62 24 -62 40 -74 C42 -54 24 -20 0 0Z" fill="url(#cGreen)"/>' +
  '<path d="M0 0 C-8 -10 -22 -30 -30 -56 C-33 -68 -34 -78 -34 -84 C-16 -62 24 -62 40 -74 C42 -54 24 -20 0 0Z" fill="url(#cShade)"/>' +
  '<path d="M-20 -50 C-24 -64 -28 -74 -30 -82 M8 -16 C18 -34 30 -52 37 -68" fill="none" stroke="#CFC7AE" stroke-opacity=".55" stroke-width=".7"/>' +
  '<path d="M-34 -84 C-16 -62 24 -62 40 -74" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-opacity=".9"/>' +
  '<path d="M-28 -66 C-26 -48 -18 -28 -6 -10" fill="none" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="1.4" stroke-linecap="round"/>' +
  '</g>' +
  '<g id="callaBud">' +
  '<path d="M0 0 C-7 -12 -13 -34 -11 -62 C-9 -84 -2 -104 8 -120 C15 -100 18 -76 15 -52 C12 -30 6 -10 0 0Z" fill="url(#cOut2)" stroke="#D7CDB4" stroke-width=".8"/>' +
  '<path d="M0 0 C-7 -12 -13 -34 -11 -62 C-9 -84 -2 -104 8 -120 C15 -100 18 -76 15 -52 C12 -30 6 -10 0 0Z" fill="url(#cGreen)"/>' +
  '<path d="M-9 -56 C-2 -68 10 -86 8 -118" fill="none" stroke="#CFC7AE" stroke-width=".8"/>' +
  '<path d="M-8 -70 C-6 -88 -2 -102 6 -114" fill="none" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="1.2" stroke-linecap="round"/>' +
  '</g>';

function stem(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, d: number) {
  const p = "M" + x0 + " " + y0 + " Q " + cx + " " + cy + " " + x1 + " " + y1;
  return (
    '<path class="stem" pathLength="1" style="--d:' + d + 's" d="' + p + '" fill="none" stroke="#2F6A34" stroke-width="3.6" stroke-linecap="round"/>' +
    '<path class="stem" pathLength="1" style="--d:' + d + 's" d="' + p + '" fill="none" stroke="#6FA95A" stroke-opacity=".6" stroke-width="1.3" stroke-linecap="round"/>'
  );
}

function callaFlower(x: number, y: number, rot: number, scale: number, flip: 1 | -1, d: number) {
  return (
    '<g class="rise" style="--d:' + d + 's"><g transform="translate(' + x + " " + y + ") rotate(" + rot +
    ") scale(" + (flip * scale).toFixed(2) + " " + scale.toFixed(2) + ')"><use href="#callaA"/></g></g>'
  );
}

function build(bq: HTMLElement) {
  let sA = "";
  let L = "";
  let C = "";
  sA += stem(176, 251, 140, 215, 122, 160, 0.5);
  sA += stem(184, 251, 226, 222, 248, 176, 0.6);
  sA += stem(180, 251, 200, 214, 214, 148, 0.55);
  sA += stem(181, 251, 186, 190, 190, 116, 0.7);
  sA += stem(176, 251, 152, 226, 136, 188, 0.8);
  sA += stem(184, 251, 198, 228, 210, 196, 0.9);
  sA += stem(174, 251, 128, 214, 100, 172, 0.8);
  sA += stem(186, 251, 230, 226, 258, 206, 0.85);
  sA += stem(178, 251, 176, 210, 172, 162, 0.85);

  const big: [number, number, number, number, number, number][] = [
    [160, 254, -50, 32, 92, 1],
    [200, 254, 40, 40, 110, 1.1],
  ];
  big.forEach((l) => {
    L +=
      '<g class="leaf" style="--d:' + l[5] + 's"><g transform="translate(' + l[0] + " " + l[1] +
      ") rotate(" + l[2] + ") scale(" + l[3] + " " + l[4] + ')"><use href="#lf2"/></g></g>';
  });
  const leaves: [number, number, number, number, number, number][] = [
    [150, 252, -72, 26, 70, 0.9],
    [170, 250, -40, 20, 84, 1.1],
    [210, 252, 66, 24, 64, 0.95],
  ];
  leaves.forEach((l) => {
    L +=
      '<g class="leaf" style="--d:' + l[5] + 's"><g transform="translate(' + l[0] + " " + l[1] +
      ") rotate(" + l[2] + ") scale(" + l[3] + " " + l[4] + ')"><use href="#lf"/></g></g>';
  });

  // The dahlia/orchid positions are reused for calla stems (scaled up) so
  // the arrangement still fills out, instead of introducing new flower art.
  C += callaFlower(100, 172, -10, 0.85, 1, 1.7);
  C += callaFlower(258, 206, 16, 0.8, -1, 1.75);
  C += callaFlower(172, 162, 22, 0.66, 1, 1.9);
  C += callaFlower(190, 116, -14, 1.0, -1, 1.8);
  C += callaFlower(136, 188, 10, 0.86, 1, 2);
  C += callaFlower(210, 196, -22, 0.74, -1, 2.2);
  C += '<g class="rise" style="--d:1.15s"><g transform="translate(214 148) rotate(10) scale(.78)"><use href="#callaBud"/></g></g>';
  C += '<g class="rise" style="--d:1.25s"><g transform="translate(122 160) rotate(-8) scale(.7)"><use href="#callaBud"/></g></g>';

  const ruf = ruffleLine(0);
  const br = backRing();
  const vb =
    '<g class="vase"><path d="' + br[1] + '" fill="#0C2A22"/>' +
    '<path d="' + br[0] + '" fill="none" stroke="url(#gold)" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<ellipse cx="180" cy="251" rx="56" ry="8" fill="#07120E"/></g>';
  const vf =
    '<g class="vase">' +
    '<ellipse cx="180" cy="450" rx="92" ry="9" fill="url(#floor)"/>' +
    '<path d="M152 422 C150 428 142 430 140 434 L220 434 C218 430 210 428 208 422Z" fill="url(#vBody)"/>' +
    '<path d="M130 434 L230 434 L236 446 L124 446Z" fill="#0F3A30"/>' +
    '<path d="M130 434 L230 434 M124 446 L236 446" stroke="url(#gold)" stroke-width="2.5" fill="none"/>' +
    '<use href="#vbody" fill="url(#vBody)"/>' +
    '<g clip-path="url(#vclip)">' +
    '<rect x="100" y="268" width="160" height="160" fill="url(#dam)"/>' +
    '<path d="M146 284 C166 292 194 292 214 284" fill="none" stroke="url(#gold)" stroke-width="3"/>' +
    '<path d="M146 291 C166 299 194 299 214 291" fill="none" stroke="#E8CE7A" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0 6"/>' +
    '<path d="M112 306 C150 320 210 320 248 306" fill="none" stroke="url(#gold)" stroke-width="3"/>' +
    '<path d="M112 313 C150 327 210 327 248 313" fill="none" stroke="#E8CE7A" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0 6"/>' +
    '<path d="M134 398 C160 410 200 410 226 398" fill="none" stroke="url(#gold)" stroke-width="3"/>' +
    '<path d="M134 391 C160 403 200 403 226 391" fill="none" stroke="#E8CE7A" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0 6"/>' +
    '<path d="M126 318 C122 348 130 380 150 406" fill="none" stroke="#FFFFFF" stroke-opacity=".2" stroke-width="8" stroke-linecap="round"/>' +
    '<path d="M236 324 C240 348 232 374 216 394" fill="none" stroke="#FFFFFF" stroke-opacity=".1" stroke-width="4" stroke-linecap="round"/>' +
    "</g>" +
    '<ellipse cx="180" cy="348" rx="22" ry="27" fill="url(#cream)" stroke="url(#gold)" stroke-width="2.8"/>' +
    '<ellipse cx="180" cy="348" rx="17.5" ry="22" fill="none" stroke="#B8892B" stroke-width=".9"/>' +
    '<text x="180" y="358" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="600" font-size="27" fill="#7A5A16">PH</text>' +
    '<path d="M154 344 C144 330 130 334 132 346 C134 355 146 353 146 346 M206 344 C216 330 230 334 228 346 C226 355 214 353 214 346" fill="none" stroke="url(#gold)" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M160 382 C170 392 190 392 200 382 M168 322 C174 316 186 316 192 322" fill="none" stroke="url(#gold)" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M152 290 C138 292 132 304 140 310 C146 314 152 308 148 304 M208 290 C222 292 228 304 220 310 C214 314 208 308 212 304" fill="none" stroke="url(#gold)" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="' + ruf + '" fill="none" stroke="url(#gold)" stroke-width="2.6" stroke-linejoin="round"/>' +
    '<path d="' + ruffleLine(3) + '" fill="none" stroke="#8A6A1F" stroke-opacity=".7" stroke-width="1" stroke-linejoin="round"/>' +
    "</g>";

  bq.innerHTML =
    defs +
    '<path id="vbody" d="' + vasePath() + '"/>' +
    '<clipPath id="vclip"><use href="#vbody"/></clipPath>' +
    "</defs>" +
    vb +
    '<g class="sway">' + sA + "</g>" +
    vf +
    '<g class="sway">' + L + C + "</g>";
}

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

export default function CallaThankYouGift({ onFinished }: { onFinished?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const bqEl = root.querySelector<HTMLElement>("#bq")!;
    const ov = root.querySelector<HTMLElement>("#ov")!;
    const card = root.querySelector<HTMLElement>("#card")!;
    const veilEl = root.querySelector<HTMLElement>("#veil")!;
    const titleEl = root.querySelector<HTMLElement>("#title")!;

    build(bqEl);
    titleEl.textContent = "Thank you for staying with us";

    const timers: number[] = [];
    const anims: Animation[] = [];

    function at(ms: number, fn: () => void) {
      timers.push(window.setTimeout(fn, ms));
    }
    function anim(el: HTMLElement, frames: Keyframe[], dur: number, ease: string) {
      const a = el.animate(frames, { duration: dur, easing: ease, fill: "forwards" });
      anims.push(a);
      return a;
    }
    function clearAll() {
      timers.forEach(clearTimeout);
      timers.length = 0;
      anims.forEach((a) => a.cancel());
      anims.length = 0;
      bqEl.classList.remove("go");
      bqEl.classList.remove("still");
      card.style.opacity = "0";
      card.style.transform = "translate(-50%,-50%) scale(.4)";
      titleEl.classList.remove("reveal");
      titleEl.classList.remove("show");
    }
    function finish() {
      clearAll();
      ov.classList.remove("active");
      ov.classList.remove("hiding");
      ov.classList.remove("giftBlur");
      onFinishedRef.current?.();
    }
    function skip() {
      if (!ov.classList.contains("active") || ov.classList.contains("hiding")) return;
      timers.forEach(clearTimeout);
      timers.length = 0;
      ov.classList.add("hiding");
      ov.classList.remove("giftBlur");
      window.setTimeout(finish, 450);
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function play() {
      clearAll();
      ov.classList.remove("hiding");
      ov.classList.add("active");
      void ov.offsetWidth;
      ov.classList.add("giftBlur");
      if (reduce) {
        card.style.opacity = "1";
        card.style.transform = "translate(-50%,-50%) scale(1)";
        bqEl.classList.add("still");
        titleEl.classList.add("show");
        at(4500, skip);
        return;
      }
      bqEl.classList.add("go");
      titleEl.classList.add("reveal");
      anim(
        card,
        [
          { transform: "translate(-50%,-50%) scale(.4)", opacity: 0 },
          { transform: "translate(-50%,-50%) scale(1.04)", opacity: 1, offset: 0.7 },
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
        ],
        700,
        "cubic-bezier(.22,.8,.3,1.1)"
      );
      const HOLD = 4600;
      at(HOLD, () => {
        ov.classList.remove("giftBlur");
        anim(
          card,
          [
            { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
            { transform: "translate(-50%,-50%) scale(.5)", opacity: 0 },
          ],
          500,
          "cubic-bezier(.4,0,.2,1)"
        );
      });
      at(HOLD + 550, finish);
    }

    veilEl.addEventListener("click", skip);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") skip();
    }
    document.addEventListener("keydown", onKeyDown);

    const autoplayTimer = window.setTimeout(play, 500);

    return () => {
      window.clearTimeout(autoplayTimer);
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      veilEl.removeEventListener("click", skip);
      document.removeEventListener("keydown", onKeyDown);
    };
    // Runs once per mount: this overlay is created fresh each time a
    // 3.5-4.7 star review triggers it, so there's nothing to react to here.
  }, []);

  return (
    <div ref={rootRef}>
      <style>{STYLE}</style>
      <div id="ov" role="dialog" aria-modal="true" aria-label="A thank-you gift from Pamhok Homes">
        <div id="veil" />
        <div id="card">
          <div id="scene">
            <svg
              id="bq"
              viewBox="0 20 360 440"
              role="img"
              aria-label="A bouquet of calla lilies in an ornate Victorian vase"
            />
          </div>
          <p id="title" />
        </div>
      </div>
    </div>
  );
}
