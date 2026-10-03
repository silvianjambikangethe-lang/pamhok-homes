"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type ThankYouGiftHandle = {
  play: () => void;
};

// This overlay (markup, CSS and animation script) is embedded as close to
// verbatim as possible from the source artifact, rather than re-derived or
// translated into CSS Modules — an earlier CSS Modules port silently broke
// the petal/glitter animation (the module loader doesn't support a
// `@keyframes :global(name)` the way the JS-authored `animation: drift ...`
// inline strings need), so the markup keeps the artifact's own element ids
// and a single plain <style> tag instead. The only intentional deviations
// from the source: z-index raised from 50 to 60 so it sits above this app's
// own z-50 modals, and the Cormorant Garamond font swapped for a Georgia
// fallback, since pulling the Google Fonts stylesheet at runtime would be
// blocked by this app's CSP (style-src 'self' only, see next.config.ts).
const STYLE = `
#ov{position:fixed;inset:0;z-index:60;visibility:hidden;pointer-events:none;overflow:hidden}
#ov.active{visibility:visible;pointer-events:auto}
#ov.hiding{opacity:0;transition:opacity .4s ease}
#veil{position:absolute;inset:0;background:rgba(28,18,14,0);-webkit-backdrop-filter:blur(0px);backdrop-filter:blur(0px);transition:background 1.2s ease,backdrop-filter 1.2s ease,-webkit-backdrop-filter 1.2s ease}
#ov.giftBlur #veil{background:rgba(28,18,14,.4);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
#letter{position:absolute;left:50%;top:50%;width:560px;height:720px;z-index:2;padding:36px 20px 40px;display:flex;flex-direction:column;justify-content:center;text-align:center;color:#F4EAD2;border-radius:4px;opacity:0;transform:translate(-50%,-50%) scale(0);transform-origin:50% 50%;overflow:hidden;background:radial-gradient(ellipse 62% 36% at 50% 40%,rgba(255,214,150,.2),rgba(255,214,150,0) 70%),repeating-linear-gradient(45deg,rgba(201,162,75,.07) 0 1px,transparent 1px 26px),repeating-linear-gradient(-45deg,rgba(201,162,75,.07) 0 1px,transparent 1px 26px),#3A0F1E;box-shadow:0 24px 60px rgba(0,0,0,.5),inset 0 0 0 7px #3A0F1E,inset 0 0 0 8px #C9A24B,inset 0 0 0 12px #3A0F1E,inset 0 0 0 13px rgba(201,162,75,.5)}
#lc{position:relative;opacity:0;transition:opacity .7s ease}
#letter.open #lc{opacity:1}
.orn{display:block;margin:0 auto 6px}
#scene{position:relative;width:min(340px,86vw);margin:22px auto 0}
#bq{display:block;width:100%;height:auto;overflow:visible}
.envw{position:absolute;left:50%;top:50%;width:min(340px,70vw);aspect-ratio:300/340;transform:translate(-50%,-50%);opacity:0;pointer-events:none}
.envw svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible}
.envw.go{animation:envIn 1.8s forwards}
.tray{width:calc(min(340px,70vw)*1.34);aspect-ratio:1/1;filter:drop-shadow(0 16px 12px rgba(0,0,0,.4))}
@keyframes envIn{0%{opacity:0;transform:translate(calc(-50% + 100vw),calc(-50% + 34px)) perspective(900px) rotateX(58deg) rotateZ(11deg);animation-timing-function:cubic-bezier(.2,.8,.25,1)}12%{opacity:1}50%{opacity:1;transform:translate(calc(-50% - 14px),calc(-50% + 4px)) perspective(900px) rotateX(58deg) rotateZ(-3deg);animation-timing-function:ease-in-out}62%{opacity:1;transform:translate(-50%,-50%) perspective(900px) rotateX(58deg) rotateZ(.8deg);animation-timing-function:ease-in-out}69%{opacity:1;transform:translate(-50%,-50%) perspective(900px) rotateX(58deg) rotateZ(0deg);animation-timing-function:cubic-bezier(.45,0,.2,1)}100%{opacity:1;transform:translate(-50%,-50%) perspective(900px) rotateX(0deg) rotateZ(0deg)}}
@keyframes envAway{0%{opacity:1;transform:translate(-50%,-50%) perspective(900px) rotateX(0deg) rotateZ(0deg);animation-timing-function:cubic-bezier(.45,0,.2,1)}30%{opacity:1;transform:translate(-50%,-50%) perspective(900px) rotateX(58deg) rotateZ(0deg);animation-timing-function:cubic-bezier(.5,0,.8,.4)}100%{opacity:1;transform:translate(calc(-50% - 110vw),calc(-50% + 30px)) perspective(900px) rotateX(58deg) rotateZ(-10deg)}}
.seal{transform-box:fill-box;transform-origin:50% 50%}
.envw.go .seal{animation:sealBreak .6s ease-in 1.9s forwards}
@keyframes sealBreak{0%{transform:scale(1);opacity:1}35%{transform:scale(1.12);opacity:1}100%{transform:scale(.85);opacity:0}}
.cords{transform-box:fill-box;transform-origin:50% 0%}
.envw.go .cords{animation:cordsOff .7s ease-in 1.75s forwards}
@keyframes cordsOff{to{opacity:0;transform:translateY(-16px)}}
.flapOut{transform-box:fill-box;transform-origin:50% 0%}
.envw.go .flapOut{animation:flapA .5s ease-in 2.55s forwards}
@keyframes flapA{to{transform:scale(.95,0)}}
.flapIn{transform-box:fill-box;transform-origin:50% 100%;transform:scale(.95,0)}
.envw.go .flapIn{animation:flapB .55s ease-out 3.05s forwards}
@keyframes flapB{to{transform:scale(1,1)}}
.sprig{transform-box:fill-box;transform-origin:50% 100%;animation:sway2 5s ease-in-out infinite}
.sprigG{transform-box:fill-box;transform-origin:50% 100%}
.envw.go .sprigG{animation:sprigOff .7s ease-in 1.75s forwards}
@keyframes sprigOff{to{opacity:0;transform:translateY(-14px) scale(.96)}}
@keyframes sway2{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.4deg)}}
.envw.closing .flapIn{animation:flapBr .4s ease-in forwards}
.envw.closing .flapOut{animation:flapAr .4s ease-out .4s both}
.envw.closing .seal{animation:backScale .5s ease-out .85s both}
.envw.closing .cords,.envw.closing .sprigG{animation:backDrop .5s ease-out .85s both}
@keyframes flapBr{from{transform:scale(1,1)}to{transform:scale(.95,0)}}
@keyframes flapAr{from{transform:scale(.95,0)}to{transform:scale(1,1)}}
@keyframes backScale{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
@keyframes backDrop{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}
.envw.away{animation:envAway 1.5s forwards}
#title{margin:6px 0 8px;font-family:Georgia,'Times New Roman',serif;font-weight:600;font-size:32px;line-height:1.2;text-wrap:balance;color:#F7EEDB;opacity:0}
#sub{margin:0 auto;max-width:430px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:500;font-size:21px;line-height:1.5;color:#E3D4B2;text-wrap:pretty;opacity:0}
.reveal{animation:fadeUp 1.4s ease-out 2.4s both}
.show{opacity:1!important}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.vase,.fl,.rise,.leaf{opacity:0}
.stem{stroke-dasharray:1;stroke-dashoffset:1}
.fl{transform-box:fill-box;transform-origin:50% 50%;transform:scale(.3) rotate(-14deg)}
.rise,.leaf{transform-box:fill-box;transform-origin:50% 100%;transform:scale(.2)}
#bq.go .vase{animation:vIn 1.1s ease-out forwards}
#bq.go .stem{animation:draw .9s ease-out forwards;animation-delay:var(--d)}
#bq.go .leaf,#bq.go .rise{animation:rise 1.5s cubic-bezier(.22,.8,.24,1) forwards;animation-delay:var(--d)}
#bq.go .fl{animation:bloom 1.5s cubic-bezier(.22,.8,.24,1) forwards;animation-delay:var(--d)}
#bq.go .sway{animation:sway 8s ease-in-out 3.6s infinite}
#bq.still .vase,#bq.still .fl,#bq.still .rise,#bq.still .leaf{opacity:1;transform:none}
#bq.still .stem{stroke-dashoffset:0}
.sway{transform-box:view-box;transform-origin:180px 252px}
@keyframes vIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes rise{0%{opacity:0;transform:scale(.2)}50%{opacity:1}100%{opacity:1;transform:none}}
@keyframes bloom{0%{opacity:0;transform:scale(.3) rotate(-14deg)}55%{opacity:1}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes sway{0%,100%{transform:rotate(-.5deg)}50%{transform:rotate(.6deg)}}
.pt{position:absolute;top:0;width:12px;height:20px;clip-path:path('M6 0 C13 5 14 13 6 20 C-2 13 -1 5 6 0Z');opacity:0}
@keyframes drift{0%{transform:translate3d(0,-40px,0) rotate(0) rotateX(0) scale(var(--sc));opacity:0}8%{opacity:1}30%{transform:translate3d(var(--sw),230px,0) rotate(calc(var(--r)*.3)) rotateX(140deg) scale(var(--sc))}60%{transform:translate3d(calc(var(--sw)*-.7),480px,0) rotate(calc(var(--r)*.65)) rotateX(260deg) scale(var(--sc))}100%{transform:translate3d(calc(var(--sw)*.5),780px,0) rotate(var(--r)) rotateX(380deg) scale(var(--sc));opacity:0}}
.mote{position:absolute;width:4px;height:4px;border-radius:50%;background:#F3DE9A;box-shadow:0 0 6px 2px rgba(243,222,154,.55);opacity:0}
@keyframes mote{0%{opacity:0;transform:translateY(0)}30%{opacity:.9}100%{opacity:0;transform:translateY(-130px)}}
`;

// ---------------------------------------------------------------------------
// Everything below is the artifact's own script, transcribed as literally as
// possible into a function that runs once an overlay instance's DOM exists.
// It builds the hand-drawn bouquet/envelope/tray SVG art (randomized petal
// placement etc.) and drives the play/skip/finish timeline via setTimeout
// and Element.animate, exactly as the source did.
// ---------------------------------------------------------------------------

function f(n: number) {
  return (Math.round(n * 10) / 10).toString();
}

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
  '<radialGradient id="dCore" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1A020C" stop-opacity=".6"/><stop offset="1" stop-color="#1A020C" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="gA" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4A0820"/><stop offset=".5" stop-color="#9A1C42"/><stop offset="1" stop-color="#D2476B"/></linearGradient>' +
  '<linearGradient id="gB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2E0516"/><stop offset=".5" stop-color="#6F1232"/><stop offset="1" stop-color="#A82A52"/></linearGradient>' +
  '<linearGradient id="oSep" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E9A6C4"/><stop offset=".5" stop-color="#FBE6EF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>' +
  '<linearGradient id="oPet" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#E9A6C4"/><stop offset=".4" stop-color="#FBE6EF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>' +
  '<linearGradient id="oLip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D6336C"/><stop offset="1" stop-color="#7B1646"/></linearGradient>' +
  '<linearGradient id="cOut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#F8F4E8"/><stop offset=".75" stop-color="#E9E2CC"/><stop offset="1" stop-color="#D3C9AC"/></linearGradient>' +
  '<linearGradient id="cShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6B6240" stop-opacity="0"/><stop offset=".6" stop-color="#6B6240" stop-opacity="0"/><stop offset="1" stop-color="#6B6240" stop-opacity=".24"/></linearGradient>' +
  '<linearGradient id="cGreen" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#8DB36A" stop-opacity=".85"/><stop offset=".3" stop-color="#8DB36A" stop-opacity=".3"/><stop offset=".55" stop-color="#8DB36A" stop-opacity="0"/></linearGradient>' +
  '<linearGradient id="cIn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#B9C29B"/><stop offset=".45" stop-color="#EFEBD9"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>' +
  '<linearGradient id="cSpad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E9B93A"/><stop offset=".45" stop-color="#FADF70"/><stop offset="1" stop-color="#C79212"/></linearGradient>' +
  '<linearGradient id="lg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1C4527"/><stop offset=".5" stop-color="#3F7B3E"/><stop offset="1" stop-color="#6BA853"/></linearGradient>' +
  '<g id="ptA"><path d="M0 0 C-.62 -.22 -.66 -.72 -.1 -1 L0 -1.03 L.1 -1 C.66 -.72 .62 -.22 0 0Z" fill="url(#gA)" stroke="#3A0615" stroke-width=".7" stroke-opacity=".55" vector-effect="non-scaling-stroke"/><path d="M0 -.1 C.01 -.4 .01 -.7 0 -.92" fill="none" stroke="#F08AA3" stroke-opacity=".28" stroke-width=".8" vector-effect="non-scaling-stroke"/></g>' +
  '<g id="ptB"><path d="M0 0 C-.62 -.22 -.66 -.72 -.1 -1 L0 -1.03 L.1 -1 C.66 -.72 .62 -.22 0 0Z" fill="url(#gB)" stroke="#2A040F" stroke-width=".7" stroke-opacity=".6" vector-effect="non-scaling-stroke"/><path d="M0 -.1 C.01 -.4 .01 -.7 0 -.92" fill="none" stroke="#E0708F" stroke-opacity=".25" stroke-width=".8" vector-effect="non-scaling-stroke"/></g>' +
  '<g id="sep"><path d="M0 0 C-.32 -.2 -.34 -.72 0 -.98 C.34 -.72 .32 -.2 0 0Z" fill="url(#oSep)" stroke="#D99BB8" stroke-width=".6" stroke-opacity=".6" vector-effect="non-scaling-stroke"/><path d="M0 -.06 L0 -.82" fill="none" stroke="#D88CB0" stroke-opacity=".45" stroke-width=".6" vector-effect="non-scaling-stroke"/></g>' +
  '<g id="pet"><path d="M0 0 C-.2 -.5 -.55 -.62 -.86 -.4 C-1.04 -.2 -.92 .12 -.5 .16 C-.25 .18 -.05 .08 0 0Z" fill="url(#oPet)" stroke="#D99BB8" stroke-width=".6" stroke-opacity=".6" vector-effect="non-scaling-stroke"/><path d="M-.04 -.02 C-.3 -.12 -.6 -.16 -.86 -.3 M-.04 .02 C-.3 0 -.6 -.02 -.9 -.1 M-.06 -.06 C-.25 -.3 -.5 -.45 -.7 -.48" fill="none" stroke="#D88CB0" stroke-opacity=".45" stroke-width=".6" vector-effect="non-scaling-stroke"/></g>' +
  '<g id="lip"><path d="M-.1 .02 C-.3 .1 -.4 .36 -.2 .5 C-.1 .56 .1 .56 .2 .5 C.4 .36 .3 .1 .1 .02 C.05 -.04 -.05 -.04 -.1 .02Z" fill="url(#oLip)" stroke="#6A1239" stroke-width=".6" stroke-opacity=".6" vector-effect="non-scaling-stroke"/><path d="M0 .12 L0 .46 M-.08 .14 L-.12 .4 M.08 .14 L.12 .4" fill="none" stroke="#F2B5CF" stroke-opacity=".5" stroke-width=".6" vector-effect="non-scaling-stroke"/><ellipse cy=".06" rx=".075" ry=".055" fill="#F6C945"/><ellipse cy="-.03" rx=".06" ry=".07" fill="#FFFFFF" stroke="#E7B9CD" stroke-width=".6" vector-effect="non-scaling-stroke"/></g>' +
  '<g id="lf"><path d="M0 0 C-.34 -.22 -.36 -.74 0 -1 C.36 -.74 .34 -.22 0 0Z" fill="url(#lg)" stroke="#1B3F25" stroke-width=".7" stroke-opacity=".6" vector-effect="non-scaling-stroke"/><path d="M0 -.04 L0 -.9" fill="none" stroke="#B5D69B" stroke-opacity=".5" stroke-width=".7" vector-effect="non-scaling-stroke"/></g>' +
  '<linearGradient id="cOut2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#FBF9F1"/><stop offset=".65" stop-color="#EFE9D6"/><stop offset="1" stop-color="#D9D0B4"/></linearGradient>' +
  '<linearGradient id="cIn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F1EDDD"/><stop offset="1" stop-color="#BFC8A3"/></linearGradient>' +
  '<linearGradient id="cSpad2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F6B25A"/><stop offset=".5" stop-color="#EC8F32"/><stop offset="1" stop-color="#C9631A"/></linearGradient>' +
  '<linearGradient id="lg2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#143F31"/><stop offset=".55" stop-color="#23674F"/><stop offset="1" stop-color="#3B8A68"/></linearGradient>' +
  '<g id="lf2"><path d="M0 0 C-.5 -.12 -.62 -.5 -.1 -1 C0 -1.04 .06 -1.02 .1 -1 C.62 -.5 .5 -.12 0 0Z" fill="url(#lg2)" stroke="#0F3126" stroke-width=".7" stroke-opacity=".6" vector-effect="non-scaling-stroke"/><path d="M0 -.04 L0 -.93 M0 -.22 C-.18 -.27 -.32 -.36 -.42 -.5 M0 -.22 C.18 -.27 .32 -.36 .42 -.5 M0 -.42 C-.14 -.46 -.26 -.54 -.32 -.66 M0 -.42 C.14 -.46 .26 -.54 .32 -.66 M0 -.62 C-.08 -.66 -.15 -.72 -.19 -.8 M0 -.62 C.08 -.66 .15 -.72 .19 -.8" fill="none" stroke="#9FD1B0" stroke-opacity=".45" stroke-width=".6" vector-effect="non-scaling-stroke"/></g>' +
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
  '</g>' +
  '<linearGradient id="lg3" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2F7A62"/><stop offset="1" stop-color="#6DBB98"/></linearGradient>' +
  '<g id="lfG"><path d="M0 0 C-.5 -.12 -.62 -.5 -.1 -1 C0 -1.04 .06 -1.02 .1 -1 C.62 -.5 .5 -.12 0 0Z" fill="url(#lg3)" stroke="#E8CE7A" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M0 -.04 L0 -.9 M0 -.25 C-.16 -.3 -.3 -.4 -.38 -.52 M0 -.25 C.16 -.3 .3 -.4 .38 -.52 M0 -.5 C-.1 -.54 -.2 -.62 -.25 -.72 M0 -.5 C.1 -.54 .2 -.62 .25 -.72" fill="none" stroke="#F3E3A0" stroke-opacity=".55" stroke-width=".7" vector-effect="non-scaling-stroke"/></g>';

function stem(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, d: number) {
  const p = "M" + x0 + " " + y0 + " Q " + cx + " " + cy + " " + x1 + " " + y1;
  return (
    '<path class="stem" pathLength="1" style="--d:' + d + 's" d="' + p + '" fill="none" stroke="#2F6A34" stroke-width="3.6" stroke-linecap="round"/>' +
    '<path class="stem" pathLength="1" style="--d:' + d + 's" d="' + p + '" fill="none" stroke="#6FA95A" stroke-opacity=".6" stroke-width="1.3" stroke-linecap="round"/>'
  );
}

function dahlia(R: number) {
  const rings: [number, number, number, number, string][] = [
    [14, 1, 0.3, 0, "ptA"],
    [13, 0.82, 0.26, 13, "ptA"],
    [12, 0.64, 0.21, 7, "ptB"],
    [10, 0.46, 0.17, 18, "ptB"],
    [8, 0.3, 0.12, 0, "ptB"],
  ];
  let g = "";
  rings.forEach((r) => {
    for (let k = 0; k < r[0]; k++) {
      const jr = (Math.random() - 0.5) * 7;
      const jl = 1 + (Math.random() - 0.5) * 0.18;
      g +=
        '<use href="#' + r[4] + '" transform="rotate(' + f(r[3] + (k * 360) / r[0] + jr) + ') scale(' +
        (r[2] * R).toFixed(2) + " " + (r[1] * R * jl).toFixed(2) + ')"/>';
    }
  });
  g += '<circle r="' + f(0.4 * R) + '" fill="url(#dCore)"/><circle r="' + f(0.05 * R) + '" fill="#2A040F"/>';
  return g;
}

function orchid(R: number, sx: number) {
  return (
    '<g transform="scale(' + R * sx + " " + R + ')">' +
    '<use href="#sep" transform="rotate(130) scale(.9)"/><use href="#sep" transform="rotate(-130) scale(.9)"/>' +
    '<use href="#sep"/><use href="#pet"/><use href="#pet" transform="scale(-1 1)"/><use href="#lip"/></g>'
  );
}

function flower(inner: string, tr: string, d: number) {
  return '<g class="fl" style="--d:' + d + 's"><g transform="' + tr + '">' + inner + "</g></g>";
}

function bud(x: number, y: number, r: number) {
  return (
    '<ellipse cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + r * 1.3 + '" fill="#CFE0A8" stroke="#6FA95A" stroke-width=".8"/>' +
    '<ellipse cx="' + x + '" cy="' + (y - r * 0.5) + '" rx="' + r * 0.55 + '" ry="' + r * 0.7 + '" fill="#F3C9D8"/>'
  );
}

function build(bq: HTMLElement, variant: "full" | "calla") {
  let sA = "";
  let L = "";
  let O = "";
  let C = "";
  let D = "";
  sA += stem(176, 251, 140, 215, 122, 160, 0.5);
  sA += stem(184, 251, 226, 222, 248, 176, 0.6);
  sA += stem(180, 251, 200, 214, 214, 148, 0.55);
  sA += stem(181, 251, 186, 190, 190, 116, 0.7);
  sA += stem(176, 251, 152, 226, 136, 188, 0.8);
  sA += stem(184, 251, 198, 228, 210, 196, 0.9);
  sA += stem(174, 251, 128, 214, 100, 172, 0.8);
  sA += stem(186, 251, 230, 226, 258, 206, 0.85);
  sA += stem(178, 251, 176, 210, 172, 162, 0.85);
  const lpath = "M174 251 C124 232 50 214 52 134 C53 104 66 86 84 74";
  const rpath = "M186 251 C240 242 302 226 312 178 C318 150 306 128 290 116";
  sA +=
    '<path class="stem" pathLength="1" style="--d:.7s" d="' + lpath + '" fill="none" stroke="#2F6A34" stroke-width="3" stroke-linecap="round"/>' +
    '<path class="stem" pathLength="1" style="--d:.75s" d="' + rpath + '" fill="none" stroke="#2F6A34" stroke-width="2.6" stroke-linecap="round"/>';

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

  function rr() {
    return Math.round(Math.random() * 360);
  }

  if (variant === "calla") {
    // Calla-only bouquet: the dahlia/orchid positions are reused for extra
    // calla stems (scaled up) so the arrangement still fills out, instead of
    // introducing new flower art.
    const callas: [number, number, number, number, number][] = [
      [100, 172, -10, 0.85, 1.7],
      [258, 206, 16, 0.8, 1.75],
      [172, 162, 22, 0.66, 1.9],
      [190, 116, -14, 1.0, 1.8],
      [136, 188, 10, 0.86, 2],
      [210, 196, -22, 0.74, 2.2],
    ];
    callas.forEach((c, i) => {
      const flip = i % 2 === 0 ? 1 : -1;
      C += flower(
        '<use href="#callaA"/>',
        "translate(" + c[0] + " " + c[1] + ") rotate(" + c[2] + ") scale(" + (flip * c[3]).toFixed(2) + " " + c[3].toFixed(2) + ")",
        c[4]
      );
    });
    C += '<g class="rise" style="--d:1.15s"><g transform="translate(214 148) rotate(10) scale(.78)"><use href="#callaBud"/></g></g>';
    C += '<g class="rise" style="--d:1.25s"><g transform="translate(122 160) rotate(-8) scale(.7)"><use href="#callaBud"/></g></g>';
  } else {
    const ol: [number, number, number, number, number, number][] = [
      [56, 168, 26, -6, 1.4, 1],
      [56, 128, 23, 6, 1.55, 1],
      [76, 92, 19, 14, 1.7, -1],
      [309, 186, 24, 12, 1.5, -1],
      [304, 146, 21, -10, 1.65, 1],
    ];
    ol.forEach((o) => {
      O += flower(orchid(o[2], o[5]), "translate(" + o[0] + " " + o[1] + ") rotate(" + o[3] + ")", o[4]);
    });
    O +=
      '<g class="fl" style="--d:1.9s">' +
      bud(86, 70, 5) + bud(94, 60, 3.5) + bud(292, 114, 4.5) + bud(285, 104, 3) +
      "</g>";

    C += '<g class="rise" style="--d:1.15s"><g transform="translate(214 148) rotate(10) scale(.78)"><use href="#callaBud"/></g></g>';
    C += '<g class="rise" style="--d:1.2s"><g transform="translate(122 160) rotate(-8) scale(.78)"><use href="#callaA"/></g></g>';
    C += '<g class="rise" style="--d:1.35s"><g transform="translate(248 176) rotate(24) scale(-.64 .64)"><use href="#callaA"/></g></g>';

    D += flower(dahlia(24), "translate(100 172) rotate(" + rr() + ")", 1.7);
    D += flower(dahlia(21), "translate(258 206) rotate(" + rr() + ")", 1.75);
    D += flower(dahlia(16), "translate(172 162) rotate(" + rr() + ")", 1.9);
    D += flower(dahlia(46), "translate(190 116) rotate(" + rr() + ")", 1.8);
    D += flower(dahlia(34), "translate(136 188) rotate(" + rr() + ")", 2);
    D += flower(dahlia(29), "translate(210 196) rotate(" + rr() + ")", 2.2);
  }

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
    '<g class="sway">' + L + O + C + D + "</g>";
}

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function cluster(x: number, y: number) {
  let s = "";
  for (let j = 0; j < 6; j++) {
    const dx = x + rnd(-6, 6);
    const dy = y + rnd(-6, 6);
    s +=
      '<circle cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="' + rnd(1.8, 2.8).toFixed(1) + '" fill="#FFFFFF" stroke="#E2DED0" stroke-width=".4"/>' +
      '<circle cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r=".7" fill="#E8DAA6"/>';
  }
  return s;
}

function sprig() {
  let s = "";
  const tips: [number, number][] = [
    [-30, -72],
    [-10, -90],
    [12, -84],
    [34, -66],
    [4, -60],
    [-20, -46],
    [24, -44],
  ];
  tips.forEach((tp) => {
    s +=
      '<path d="M0 0 Q ' + (tp[0] * 0.3).toFixed(1) + " " + (tp[1] * 0.6).toFixed(1) + " " + tp[0] + " " + tp[1] +
      '" fill="none" stroke="#98A07C" stroke-width=".9" stroke-linecap="round"/>';
    for (let k = 0; k < 2; k++) {
      const bx = tp[0] + rnd(-12, 12);
      const by = tp[1] + rnd(-12, 8);
      s +=
        '<path d="M' + (tp[0] * 0.7).toFixed(1) + " " + (tp[1] * 0.7).toFixed(1) + " L" + bx.toFixed(1) + " " + by.toFixed(1) +
        '" fill="none" stroke="#98A07C" stroke-width=".7" stroke-linecap="round"/>' + cluster(bx, by);
    }
    s += cluster(tp[0], tp[1]);
  });
  return s;
}

function sealMarkup() {
  const pts: string[] = [];
  let leaves = "";
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2;
    const r = 27 + (i % 2 ? 1.1 : -0.4) + 1.1 * Math.sin(a * 6);
    pts.push((r * Math.sin(a)).toFixed(1) + " " + (-r * Math.cos(a)).toFixed(1));
  }
  for (let i = 0; i < 14; i++) {
    leaves +=
      '<ellipse cx="0" cy="-16.5" rx="2.4" ry="5" transform="rotate(' + (i * (360 / 14)).toFixed(1) + ')" fill="#D58B6E" stroke="#8F4A33" stroke-width=".6"/>';
  }
  return (
    '<g class="seal"><g transform="translate(150 168)">' +
    '<path d="M' + pts.join(" L") + 'Z" fill="url(#wax)" stroke="#7E3F2B" stroke-width=".8"/>' +
    '<circle r="23.5" fill="none" stroke="#F1C3A8" stroke-opacity=".5" stroke-width="1"/>' +
    '<circle r="21" fill="#B4684B" fill-opacity=".45"/>' +
    leaves +
    '<circle r="10.5" fill="none" stroke="#8F4A33" stroke-width=".7"/>' +
    '<text x=".7" y="5.6" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="600" font-size="15" fill="#8F4A33">PH</text>' +
    '<text x="0" y="5" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="600" font-size="15" fill="#F0C6AE">PH</text>' +
    '<path d="M-18 -12 C-10 -22 8 -24 17 -14" fill="none" stroke="#FFFFFF" stroke-opacity=".2" stroke-width="2" stroke-linecap="round"/>' +
    "</g></g>"
  );
}

function buildEnvelope(envBack: HTMLElement, envFront: HTMLElement) {
  const back =
    '<defs>' +
    '<radialGradient id="eShadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="eLiner" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#C6CCB9"/><stop offset="1" stop-color="#E6E9DC"/></linearGradient>' +
    '<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .55 0 0 0 0 .55 0 0 0 0 .55 0 0 0 .55 0" result="g"/><feBlend in="SourceGraphic" in2="g" mode="multiply" result="b"/><feComposite in="b" in2="SourceAlpha" operator="in"/></filter>' +
    "</defs>" +
    '<ellipse cx="150" cy="270" rx="150" ry="14" fill="url(#eShadow)"/>' +
    '<polygon class="flapIn" points="30,70 270,70 150,-34" fill="url(#eLiner)" filter="url(#grain)" stroke="#59664F" stroke-width=".8" stroke-linejoin="round"/>' +
    '<rect x="30" y="70" width="240" height="190" fill="#4F5B49"/>';
  const cordPaths = [
    "M132 56 C140 100 148 140 150 168 C150 196 140 240 134 282",
    "M150 52 C150 100 150 140 150 168 C150 204 152 252 152 288",
    "M168 56 C160 100 152 140 150 168 C150 196 160 240 166 282",
  ];
  const cords =
    '<g class="cords">' +
    cordPaths
      .map(
        (d) =>
          '<path d="' + d + '" fill="none" stroke="#B8915F" stroke-width="1.7" stroke-linecap="round"/>' +
          '<path d="' + d + '" fill="none" stroke="#E3CA9E" stroke-opacity=".6" stroke-width=".6" stroke-linecap="round" transform="translate(-.6 -.4)"/>'
      )
      .join("") +
    "</g>";
  const front =
    '<defs>' +
    '<linearGradient id="fL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#76846F"/><stop offset="1" stop-color="#66745F"/></linearGradient>' +
    '<linearGradient id="fR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#76846F"/><stop offset="1" stop-color="#66745F"/></linearGradient>' +
    '<linearGradient id="fB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#6A7863"/><stop offset="1" stop-color="#77856F"/></linearGradient>' +
    '<linearGradient id="fFlap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#80907A"/><stop offset="1" stop-color="#6F7D69"/></linearGradient>' +
    '<radialGradient id="wax" cx=".38" cy=".32" r=".85"><stop offset="0" stop-color="#E29C7E"/><stop offset=".55" stop-color="#C87A5B"/><stop offset="1" stop-color="#9A523B"/></radialGradient>' +
    "</defs>" +
    '<g filter="url(#grain)"><polygon points="30,70 150,168 30,260" fill="url(#fL)"/><polygon points="270,70 150,168 270,260" fill="url(#fR)"/><polygon points="30,260 150,150 270,260" fill="url(#fB)"/></g>' +
    '<path d="M30 70 L150 168 M270 70 L150 168 M30 260 L150 150 L270 260" fill="none" stroke="#3F4A3A" stroke-opacity=".35" stroke-width=".9" stroke-linejoin="round"/>' +
    '<path d="M31 72 L150 170 M269 72 L150 170 M31 258 L150 152 L269 258" fill="none" stroke="#FFFFFF" stroke-opacity=".12" stroke-width=".8" stroke-linejoin="round"/>' +
    '<path d="M30 70 L30 260 L270 260 L270 70" fill="none" stroke="#4A5644" stroke-opacity=".5" stroke-width="1" stroke-linejoin="round"/>' +
    '<g class="flapOut"><g filter="url(#grain)"><polygon points="30,70 270,70 150,172" fill="url(#fFlap)"/></g>' +
    '<path d="M30 70 L150 172 L270 70" fill="none" stroke="#3F4A3A" stroke-opacity=".4" stroke-width=".9" stroke-linejoin="round"/>' +
    '<path d="M34 72 L150 166 L266 72" fill="none" stroke="#FFFFFF" stroke-opacity=".14" stroke-width=".8" stroke-linejoin="round"/>' +
    "</g>" +
    '<g class="sprigG"><g transform="translate(150 150) rotate(10)"><g class="sprig">' + sprig() + "</g></g></g>" +
    cords +
    sealMarkup();
  envBack.innerHTML = back;
  envFront.innerHTML = front;
}

function buildTray(trayArt: HTMLElement) {
  const N = 240;
  const pts: string[] = [];
  let leaves = "";
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 186 + 6 * Math.abs(Math.sin(a * 12));
    pts.push((200 + r * Math.sin(a)).toFixed(1) + " " + (200 - r * Math.cos(a)).toFixed(1));
  }
  const edge = "M" + pts.join(" L") + "Z";
  for (let i = 0; i < 20; i++) {
    leaves +=
      '<ellipse cx="200" cy="72" rx="6" ry="13" transform="rotate(' + i * 18 + ' 200 200)" fill="none" stroke="#8A6A1F" stroke-width=".9" stroke-opacity=".7"/>';
  }
  trayArt.innerHTML =
    '<defs>' +
    '<linearGradient id="trRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7EBC2"/><stop offset=".35" stop-color="#D6B25A"/><stop offset=".7" stop-color="#9C7B2A"/><stop offset="1" stop-color="#E4C97C"/></linearGradient>' +
    '<linearGradient id="trStep" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F3E2A8"/><stop offset=".5" stop-color="#C9A24B"/><stop offset="1" stop-color="#8F6F22"/></linearGradient>' +
    '<radialGradient id="trDish" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#FBF1CF"/><stop offset=".6" stop-color="#E2C677"/><stop offset="1" stop-color="#BD9A3F"/></radialGradient>' +
    "</defs>" +
    '<path d="' + edge + '" transform="translate(0 11)" fill="#6E5217"/>' +
    '<path d="' + edge + '" fill="url(#trRim)" stroke="#7B5E1C" stroke-width="1"/>' +
    '<circle cx="200" cy="200" r="170" fill="url(#trStep)" stroke="#7B5E1C" stroke-width=".8"/>' +
    '<circle cx="200" cy="200" r="160" fill="none" stroke="#FBF1CF" stroke-opacity=".8" stroke-width="3" stroke-linecap="round" stroke-dasharray="0 9"/>' +
    '<circle cx="200" cy="200" r="148" fill="url(#trDish)" stroke="#8A6A1F" stroke-width="1.2"/>' +
    '<circle cx="200" cy="200" r="140" fill="none" stroke="#8A6A1F" stroke-opacity=".5" stroke-width=".8"/>' +
    leaves +
    '<circle cx="200" cy="200" r="110" fill="none" stroke="#8A6A1F" stroke-opacity=".35" stroke-width=".8"/>';
}

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

const ThankYouGift = forwardRef<
  ThankYouGiftHandle,
  { onFinished?: () => void; variant?: "full" | "calla" }
>(function ThankYouGift({ onFinished, variant = "full" }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const playFnRef = useRef<() => void>(() => {});
    const onFinishedRef = useRef(onFinished);
    onFinishedRef.current = onFinished;

    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;

      const bqEl = root.querySelector<HTMLElement>("#bq")!;
      const ov = root.querySelector<HTMLElement>("#ov")!;
      const letter = root.querySelector<HTMLElement>("#letter")!;
      const eb = root.querySelector<HTMLElement>("#eb")!;
      const ef = root.querySelector<HTMLElement>("#ef")!;
      const trEl = root.querySelector<HTMLElement>("#tray")!;
      const fx = root.querySelector<HTMLElement>("#fx")!;
      const titleEl = root.querySelector<HTMLElement>("#title")!;
      const subEl = root.querySelector<HTMLElement>("#sub")!;
      const veilEl = root.querySelector<HTMLElement>("#veil")!;
      const envBack = root.querySelector<HTMLElement>("#envBack")!;
      const envFront = root.querySelector<HTMLElement>("#envFront")!;
      const trayArt = root.querySelector<HTMLElement>("#trayArt")!;

      build(bqEl, variant);
      buildEnvelope(envBack, envFront);
      buildTray(trayArt);

      if (variant === "calla") {
        titleEl.textContent = "Thank you for your honest feedback";
        subEl.textContent =
          "Please accept this bouquet of calla lilies — a small thank-you from all of us at Pamhok Homes. We hope to do better next time.";
      } else {
        titleEl.textContent = "We're so happy you enjoyed your stay";
        subEl.textContent =
          "Please accept this virtual bouquet, a small present from all of us at Pamhok Homes. We hope to welcome you back soon.";
      }

      const timers: number[] = [];
      const anims: Animation[] = [];
      const pcols =
        variant === "calla"
          ? [
              ["#FFFFFF", "#EBD9C8"],
              ["#F7F2E2", "#D9D0B4"],
              ["#EFEBD9", "#BFC8A3"],
              ["#FADF70", "#C79212"],
            ]
          : [
              ["#C23B5E", "#7A1230"],
              ["#9A1C42", "#4A0820"],
              ["#F8DDE8", "#E7A3C3"],
              ["#FFFFFF", "#EBD9C8"],
              ["#D2476B", "#8E1B3A"],
            ];

      function petals() {
        for (let i = 0; i < 44; i++) {
          const c = pcols[i % pcols.length];
          const s = document.createElement("span");
          s.className = "pt";
          s.style.cssText =
            "left:" + (4 + Math.random() * 92) + "%;background:linear-gradient(to bottom," + c[0] + "," + c[1] + ");--sc:" +
            (0.7 + Math.random() * 0.7).toFixed(2) + ";--sw:" + Math.round(-80 + Math.random() * 160) + "px;--r:" +
            Math.round(200 + Math.random() * 320) + "deg;transform-origin:center;animation:drift " +
            (6 + Math.random() * 5) + "s " + (2.2 + Math.random() * 6.5) + "s ease-in-out forwards";
          fx.appendChild(s);
        }
      }
      function motes() {
        for (let i = 0; i < 16; i++) {
          const s = document.createElement("span");
          s.className = "mote";
          s.style.cssText =
            "left:" + (22 + Math.random() * 56) + "%;top:" + (14 + Math.random() * 40) + "%;animation:mote " +
            (4 + Math.random() * 3) + "s " + Math.random() * 4 + "s ease-in-out infinite";
          fx.appendChild(s);
        }
      }
      function allEnv(fn: (e: HTMLElement) => void) {
        [trEl, eb, ef].forEach(fn);
      }
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
        allEnv((e) => {
          e.classList.remove("go");
          e.classList.remove("closing");
          e.classList.remove("away");
        });
        letter.classList.remove("open");
        letter.style.opacity = "0";
        letter.style.transform = "translate(-50%,-50%) scale(0)";
        fx.innerHTML = "";
        fx.style.opacity = "1";
        titleEl.classList.remove("reveal");
        subEl.classList.remove("reveal");
        titleEl.classList.remove("show");
        subEl.classList.remove("show");
      }
      function metrics() {
        const k = eb.offsetWidth / 300;
        const W = letter.offsetWidth;
        const H = letter.offsetHeight;
        const scale = Math.min(1, (window.innerHeight * 0.94) / H, (window.innerWidth * 0.96) / W);
        const dy = 46 * k;
        const up = 165 * k;
        const sx = (150 * k) / W;
        const sy = (180 * k) / H;
        return {
          A: "translate(-50%,-50%) translate(0px," + dy + "px) scale(" + sx + "," + sy + ")",
          B: "translate(-50%,-50%) translate(0px," + (dy - up) + "px) scale(" + sx + "," + sy + ")",
          C: "translate(-50%,-50%) scale(" + scale + "," + scale + ")",
        };
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
        const m = metrics();
        if (reduce) {
          ov.classList.add("giftBlur");
          letter.style.zIndex = "5";
          letter.style.opacity = "1";
          letter.style.transform = m.C;
          letter.classList.add("open");
          bqEl.classList.add("still");
          titleEl.classList.add("show");
          subEl.classList.add("show");
          at(7000, skip);
          return;
        }
        letter.style.zIndex = "2";
        letter.style.opacity = "0";
        letter.style.transform = m.A;
        ov.classList.add("giftBlur");
        allEnv((e) => e.classList.add("go"));
        at(3350, () => {
          letter.style.opacity = "1";
          anim(letter, [{ transform: m.A }, { transform: m.B }], 950, "cubic-bezier(.3,.7,.2,1)");
        });
        at(4400, () => {
          letter.style.zIndex = "5";
          anim(letter, [{ transform: m.B }, { transform: m.C }], 1150, "cubic-bezier(.65,0,.25,1)");
          at(450, () => letter.classList.add("open"));
        });
        at(5200, () => {
          bqEl.classList.add("go");
          petals();
          motes();
          titleEl.classList.add("reveal");
          subEl.classList.add("reveal");
        });
        const T = 12500;
        at(T, () => {
          letter.classList.remove("open");
          fx.style.transition = "opacity .5s ease";
          fx.style.opacity = "0";
        });
        at(T + 250, () => {
          anim(letter, [{ transform: m.C }, { transform: m.B }], 900, "cubic-bezier(.5,0,.2,1)");
        });
        at(T + 1150, () => {
          letter.style.zIndex = "2";
          anim(letter, [{ transform: m.B }, { transform: m.A }], 600, "cubic-bezier(.4,0,.2,1)");
        });
        at(T + 1650, () => allEnv((e) => e.classList.add("closing")));
        at(T + 2500, () => {
          letter.style.opacity = "0";
        });
        at(T + 3100, () => {
          ov.classList.remove("giftBlur");
          allEnv((e) => e.classList.add("away"));
        });
        at(T + 4800, finish);
      }

      playFnRef.current = play;

      veilEl.addEventListener("click", skip);
      function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") skip();
      }
      document.addEventListener("keydown", onKeyDown);

      const autoplayTimer = window.setTimeout(play, 700);

      return () => {
        window.clearTimeout(autoplayTimer);
        timers.forEach(clearTimeout);
        anims.forEach((a) => a.cancel());
        veilEl.removeEventListener("click", skip);
        document.removeEventListener("keydown", onKeyDown);
      };
      // Runs once per mount: this overlay is created fresh each time a
      // review triggers it (variant fixed for that mount), so there's
      // nothing else to react to here.
    }, [variant]);

    useImperativeHandle(ref, () => ({
      play: () => playFnRef.current(),
    }));

    return (
      <div ref={rootRef}>
        <style>{STYLE}</style>
        <div id="ov" role="dialog" aria-modal="true" aria-label="A thank-you gift from Pamhok Homes">
          <div id="veil" />
          <div id="tray" className="envw tray" style={{ zIndex: 0 }}>
            <svg id="trayArt" viewBox="0 0 400 400" aria-hidden="true" />
          </div>
          <div id="eb" className="envw" style={{ zIndex: 1 }}>
            <svg id="envBack" viewBox="0 -50 300 340" aria-hidden="true" />
          </div>
          <div id="letter">
            <div id="lc">
              <svg className="orn" width="170" height="14" viewBox="0 0 170 14" aria-hidden="true">
                <path d="M2 7 H72 M98 7 H168" stroke="#C9A24B" strokeWidth="1" fill="none" />
                <path d="M85 1 L91 7 L85 13 L79 7Z" fill="#C9A24B" />
                <circle cx="74" cy="7" r="1.6" fill="#C9A24B" />
                <circle cx="96" cy="7" r="1.6" fill="#C9A24B" />
              </svg>
              <div id="scene">
                <svg
                  id="bq"
                  viewBox="0 20 360 440"
                  role="img"
                  aria-label={
                    variant === "calla"
                      ? "A bouquet of calla lilies in an ornate Victorian vase"
                      : "A bouquet of dahlias, calla lilies and orchids in an ornate Victorian vase"
                  }
                />
              </div>
              <div aria-live="polite">
                <p id="title" />
                <p id="sub" />
              </div>
            </div>
            <div id="fx" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
          </div>
          <div id="ef" className="envw" style={{ zIndex: 3 }}>
            <svg id="envFront" viewBox="0 -50 300 340" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }
);

export default ThankYouGift;
