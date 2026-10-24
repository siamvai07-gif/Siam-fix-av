// ==UserScript==
// @name         aviator
// @namespace    rx-aviator
// @version      2.4.0
// @description  RX Aviator market + smart deposit + Firebase RTDB balance sync + advanced deposit router
// @author       RX
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

/* ============================================================================
   FIREBASE RTDB CONFIG — same as admin panel (nagad-17cbb project)
   ============================================================================ */
var RX_FB = {
  apiKey: "AIzaSyAUzefLXQPVDu4yjDld0VASWqqs9MbtnB8",
  authDomain: "nagad-17cbb.firebaseapp.com",
  databaseURL: "https://nagad-17cbb-default-rtdb.firebaseio.com",
  projectId: "nagad-17cbb",
  storageBucket: "nagad-17cbb.firebasestorage.app",
  messagingSenderId: "728810825239",
  appId: "1:728810825239:web:5d19ab354464e33e87de52",
  measurementId: "G-RX4CZ26WT1"
};
var RTDB_BASE = RX_FB.databaseURL;

/* ============================================================================
   RX GLOBAL CONFIG — gateway URLs configurable via settings/global in RTDB
   ============================================================================ */
var RX_AVIATOR_URL  = "https://meek-blini-39d40d.netlify.app/";
var RX_PAY_GATEWAYS = {
  bkash: "https://ais-pre-n3jhxqdebubcsw2xdhssvs-51941593759.asia-east1.run.app/bkash",
  nagad: "https://ais-pre-n3jhxqdebubcsw2xdhssvs-51941593759.asia-east1.run.app/nagad"
};

/* ============================================================================
   IIFE 1 — Durable per-site store (UNCHANGED)
   ============================================================================ */
(function () {
  try {
    if (location.hostname.indexOf("ppgg9.") < 0 && navigator.serviceWorker) {
      var swc = navigator.serviceWorker;
      try { swc.register = function () { return Promise.reject(new Error("sw off")); }; } catch (e) {}
      if (swc.getRegistrations) swc.getRegistrations().then(function (rs) {
        rs.forEach(function (r) { try { r.unregister(); } catch (e) {} });
      }).catch(function () {});
      if (window.caches && caches.keys) caches.keys().then(function (ks) {
        ks.forEach(function (k) { caches.delete(k); });
      }).catch(function () {});
    }
  } catch (e) {}
  var hasGM = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  function ck(k) { return "rxs_" + k.replace(/[^a-z0-9_]/gi, "_"); }
  function cget(k) {
    try { var m = document.cookie.match(new RegExp("(?:^|; )" + ck(k) + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; }
    catch (e) { return null; }
  }
  window.__rxStore = {
    get: function (k) {
      var raw = null;
      try { raw = localStorage.getItem(k); } catch (e) {}
      if (raw == null && hasGM) { try { raw = GM_getValue(k, null); } catch (e) {} }
      if (raw == null) raw = cget(k);
      if (raw == null) return undefined;
      try { localStorage.setItem(k, raw); } catch (e) {}
      try { return JSON.parse(raw); } catch (e) { return undefined; }
    },
    set: function (k, v) {
      var raw = JSON.stringify(v);
      try { localStorage.setItem(k, raw); } catch (e) {}
      if (hasGM) { try { GM_setValue(k, raw); } catch (e) {} }
      try { document.cookie = ck(k) + "=" + encodeURIComponent(raw) + ";path=/;max-age=315360000;SameSite=Lax"; } catch (e) {}
    }
  };
})();

/* ============================================================================
   IIFE 2 — RX Market Overlay (UNCHANGED)
   ============================================================================ */
(function () {
  if (window.__rxYaminUS) return; window.__rxYaminUS = true;
  if (location.hostname.endsWith("ppgg9.org")) return;
  if (window.name === "rx-my-aviator" || window.name === "rx-gateway-frame") return;

  var _timers = [];
  var _intervals = [];
  function T(fn, ms) { var id = setTimeout(fn, ms); _timers.push(id); return id; }
  function I(fn, ms) { var id = setInterval(fn, ms); _intervals.push(id); return id; }
  window.__rxClearTimers = function () {
    _timers.forEach(clearTimeout); _intervals.forEach(clearInterval);
    _timers = []; _intervals = [];
  };

  var css = "#rx-market, #rx-market * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, \"Segoe UI\", Roboto, Arial, sans-serif; }\n#rx-market {\n  position: fixed; inset: 0; z-index: 2147483647;\n  background: #0d0e10; color: #fff; overflow-y: auto; overflow-x: hidden;\n  -webkit-overflow-scrolling: touch;\n}\n#rx-market .rx-head { display: flex; align-items: center; gap: 10px; padding: 10px 12px 8px; background: #0d0e10; position: sticky; top: 0; z-index: 5; }\n#rx-market .rx-logo { font-family: \"Brush Script MT\", \"Segoe Script\", cursive; font-size: 34px; font-weight: 800; font-style: italic; color: #e50539; text-shadow: 0 0 14px rgba(229,5,57,.45); transform: skewX(-2deg); }\n#rx-market .rx-tab-pill { width: 54px; height: 20px; background: #1a1b1e; border-radius: 0 0 9px 9px; color: #9ea0a3; font-size: 11px; text-align: center; line-height: 18px; margin-left: 12px; }\n#rx-market .rx-bal { font-size: 17px; font-weight: 700; color: #28a909; }\n#rx-market .rx-bal small { color: #9ea0a3; font-size: 12px; font-weight: 600; margin-left: 4px; }\n#rx-market .rx-ico { color: #9ea0a3; font-size: 19px; padding: 0 3px; background: none; border: 0; cursor: pointer; line-height: 1; }\n#rx-market .rx-histwrap { display: flex; align-items: center; gap: 8px; padding: 2px 12px 8px; background: #0d0e10; }\n#rx-market .rx-hist { display: flex; gap: 10px; overflow-x: auto; flex: 1; scrollbar-width: none; }\n#rx-market .rx-hist::-webkit-scrollbar { display: none; }\n#rx-market .rx-chip { font-size: 13px; font-weight: 700; white-space: nowrap; }\n#rx-market .rx-blue { color: #34b3f1; } #rx-market .rx-pur { color: #913ef8; } #rx-market .rx-pink { color: #c017b4; }\n#rx-market .rx-more { background: #1f2023; color: #9ea0a3; border: 0; border-radius: 14px; padding: 3px 9px; font-size: 13px; cursor: pointer; }\n#rx-market .rx-history { position: fixed; top: 78px; left: 8px; right: 8px; z-index: 8; display: none; max-height: min(38vh, 280px); overflow-y: auto; background: #17181b; border: 1px solid #303237; border-radius: 10px; padding: 8px; box-shadow: 0 16px 40px #000c; }\n#rx-market .rx-history.open { display: block; }\n#rx-market .rx-history-head { display: flex; align-items: center; justify-content: space-between; color: #9ea0a3; font-size: 11px; letter-spacing: 1px; margin-bottom: 9px; }\n#rx-market .rx-history-head button { border: 0; background: none; color: #9ea0a3; font-size: 22px; line-height: 1; cursor: pointer; }\n#rx-market .rx-history-grid { display: flex; flex-wrap: wrap; align-items: baseline; gap: 9px 13px; }\n#rx-market .rx-history-chip { min-width: 0; padding: 0; text-align: left; font-size: 13px; font-weight: 500; white-space: nowrap; }\n#rx-market .rx-history-chip.rx-history-small { font-size: 12px; }\n#rx-market .rx-history-chip.rx-history-big { font-size: 15px; font-weight: 600; }\n#rx-market .rx-body { padding: 0 8px 8px; display: flex; flex-direction: column; gap: 8px; }\n#rx-market .rx-stage { position: relative; height: clamp(205px, 35vh, 245px); border-radius: 14px; overflow: hidden; background: #000; border: 1px solid #1e2023; }\n#rx-market .rx-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; }\n#rx-market .rx-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }\n#rx-market .rx-state { font-size: 24px; letter-spacing: .5px; color: #fff; margin-bottom: 2px; display: none; }\n#rx-market .rx-mult { font-size: 58px; font-weight: 800; color: #fff; text-shadow: 0 4px 26px rgba(0,0,0,.7); }\n#rx-market .rx-mult.rx-bust { color: #e50539; }\n#rx-market .rx-winpops { position: absolute; top: 5px; left: 50%; z-index: 4; display: flex; width: min(620px, 94%); transform: translateX(-50%); gap: 5px; pointer-events: none; }\n#rx-market .rx-winpop { display: grid; width: 100%; height: 54px; min-width: 0; transform: translateY(-22px); flex: 1 1 0; grid-template-columns: minmax(0, 1.25fr) minmax(88px, .9fr) 27px; align-items: stretch; overflow: hidden; border: 1px solid rgba(110, 200, 130, .4); border-radius: 28px; background: rgba(24, 82, 36, .92); color: #fff; opacity: 0; pointer-events: none; transition: opacity .22s ease, transform .22s ease; box-shadow: 0 0 10px rgba(52, 168, 83, .45), inset 0 0 14px rgba(180, 255, 200, .1); animation: rxWinShimmer 1.1s ease-in-out infinite alternate; }\n#rx-market .rx-winpop.on { transform: translateY(0); opacity: 1; }\n#rx-market .rx-win-copy { display: flex; min-width: 0; flex-direction: column; align-items: center; justify-content: center; padding: 3px 8px 2px 14px; }\n#rx-market .rx-win-copy span { overflow: hidden; max-width: 100%; color: #d8f5e0; font-size: 11px; font-weight: 700; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }\n#rx-market .rx-win-copy strong { margin-top: 2px; font-size: 19px; line-height: 1; }\n#rx-market .rx-win-value { position: relative; display: flex; min-width: 0; flex-direction: column; align-items: center; justify-content: center; margin: 4px 0 4px 2px; border-radius: 24px; background: #2f9e4f; }\n#rx-market .rx-win-value::before, #rx-market .rx-win-value::after { position: absolute; top: 50%; color: rgba(255, 255, 255, .8); font-size: 13px; content: \"✦\"; transform: translateY(-50%); }\n#rx-market .rx-win-value::before { left: 6px; }\n#rx-market .rx-win-value::after { right: 6px; }\n#rx-market .rx-win-value span { color: #eaffef; font-size: 10px; font-weight: 800; line-height: 1; }\n#rx-market .rx-win-value strong { overflow: hidden; max-width: 100%; margin-top: 3px; font-size: 18px; line-height: 1; text-overflow: ellipsis; white-space: nowrap; }\n#rx-market .rx-winpop > i { display: grid; place-items: center; color: #eaffef; font-size: 25px; font-style: normal; font-weight: 300; }\n@keyframes rxWinShimmer { from { filter: brightness(.94); } to { filter: brightness(1.18); } }\n@media (max-width: 560px) {\n  #rx-market .rx-winpop { grid-template-columns: minmax(0, 1.2fr) minmax(62px, .85fr) 22px; }\n  #rx-market .rx-win-copy { padding-left: 8px; padding-right: 5px; }\n  #rx-market .rx-win-copy span { font-size: 9px; }\n  #rx-market .rx-win-copy strong, #rx-market .rx-win-value strong { font-size: 14px; }\n  #rx-market .rx-win-value span { font-size: 8px; }\n  #rx-market .rx-winpop > i { font-size: 20px; }\n}\n@media (prefers-reduced-motion: reduce) { #rx-market .rx-winpop { animation: none; } }\n#rx-market .rx-idle { position: absolute; inset: 0; z-index: 2; display: none; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; overflow: hidden; background: #030303; }\n#rx-market .rx-idle::before { content: \"\"; position: absolute; inset: -35%; z-index: -1; background: repeating-linear-gradient(142deg, transparent 0 58px, rgba(255,255,255,.025) 58px 95px, transparent 95px 153px); }\n#rx-market .rx-idle.on { display: flex; }\n#rx-market .rx-idle-plane { position: absolute; left: 2px; bottom: 3px; width: 72px; height: auto; transform: rotate(10deg); }\n#rx-market .rx-partners { display: flex; align-items: center; justify-content: center; gap: 12px; }\n#rx-market .rx-ufc { display: block; width: 104px; height: 37px; flex: 0 0 104px; color: #e50539; }\n#rx-market .rx-vline { width: 2px; height: 60px; background: #d7d7d7; }\n#rx-market .rx-idle-brand { display: flex; width: 94px; flex: 0 0 94px; flex-direction: column; align-items: center; justify-content: center; gap: 0; }\n#rx-market .rx-idle-brand img { display: block; width: 76px; height: 44px; object-fit: contain; }\n#rx-market .rx-avlogo { display: inline-block; font-family: Georgia, \"Times New Roman\", serif; font-size: 23px; font-weight: 900; font-style: italic; line-height: 1; color: #e50539; letter-spacing: 0; text-shadow: 0 2px 7px rgba(229,5,57,.32); -webkit-text-stroke: .7px currentColor; transform: skewX(-5deg); }\n#rx-market .rx-head-brand { display: flex; flex-direction: column; align-items: flex-end; margin-left: auto; gap: 1px; }\n#rx-market .rx-head-logo { font-size: 24px; }\n#rx-market .rx-idle-brand .rx-avlogo { margin-top: 0; font-size: 24px; }\n#rx-market .rx-oftxt { font-size: 12px; font-weight: 900; letter-spacing: 0; color: #fff; margin-top: 4px; line-height: 1; }\n#rx-market .rx-barwrap { width: 190px; max-width: calc(100% - 36px); height: 5px; background: #1b1d25; border-radius: 999px; margin-top: 10px; overflow: hidden; }\n#rx-market .rx-bar { height: 100%; width: 100%; background: #e50539; border-radius: 999px; transition: width .08s linear; }\n#rx-market .rx-spribe { margin-top: 8px; width: 170px; border: 2px solid #4f8d35; border-radius: 18px; padding: 7px 13px 6px; background: linear-gradient(180deg,#20371b,#132312); text-align: center; box-shadow: inset 0 0 14px rgba(85,168,51,.12); color: #fff; }\n#rx-market .rx-spribe-top { display: flex; height: 32px; align-items: center; justify-content: center; gap: 9px; }\n#rx-market .rx-spribe-top b { font-size: 18px; font-weight: 900; letter-spacing: 0; line-height: 1; }\n#rx-market .rx-smark { display: grid; width: 26px; height: 26px; flex: 0 0 26px; place-items: center; border: 1px solid #d9e7d4; border-radius: 50%; color: transparent; font-family: \"Arial Black\", Impact, sans-serif; font-size: 20px; font-weight: 900; line-height: 1; -webkit-text-stroke: .2px #d9e7d4; background-image: radial-gradient(circle, #fff 0 .85px, transparent 1px); background-size: 3px 3px; background-clip: text; -webkit-background-clip: text; }\n#rx-market .rx-official-game { display: flex; align-items: center; justify-content: space-between; height: 28px; margin-top: 5px; padding: 0 5px 0 9px; border: 1.5px solid #3faf27; border-radius: 9px; color: #52aa39; font-size: 14px; line-height: 1; }\n#rx-market .rx-official-game i { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: #0dcc24; color: #fff; font-size: 14px; font-style: normal; font-weight: 900; }\n#rx-market .rx-since { margin-top: 5px; color: #fff; font-size: 13px; line-height: 1; }\n#rx-market .rx-live { position: absolute; right: 8px; bottom: 8px; display: flex; align-items: center; gap: 6px; background: #000000aa; border-radius: 20px; padding: 3px 10px 3px 4px; font-size: 12px; color: #ddd; }\n#rx-market #rx-livecount { display: inline-block; min-width: 5ch; text-align: right; font-variant-numeric: tabular-nums; }\n#rx-market .rx-avs { display: flex; }\n#rx-market .rx-av { position: relative; display: inline-grid; place-items: center; flex: 0 0 auto; overflow: hidden; width: 20px; height: 20px; border-radius: 50%; border: 1px solid #000; margin-right: -7px; background: #25272b; }\n#rx-market .rx-av img { width: 100%; height: 100%; object-fit: cover; }\n#rx-market .rx-panel { background: #1b1c1d; border: 1px solid #2a2c2e; border-radius: 14px; padding: 6px; }\n#rx-market .rx-segrow { display: flex; align-items: center; justify-content: center; position: relative; margin-bottom: 7px; }\n#rx-market .rx-seg { display: flex; background: #141516; border-radius: 18px; padding: 2px; width: 154px; }\n#rx-market .rx-seg button { flex: 1; border: 0; background: none; color: #9ea0a3; font-size: 12px; padding: 4px 0; border-radius: 16px; cursor: pointer; }\n#rx-market .rx-seg button.on { background: #2c2d30; color: #fff; }\n#rx-market .rx-segrow .rx-mini { position: absolute; right: 0; background: #141516; border: 1px solid #2c2d30; border-radius: 5px; color: #9ea0a3; width: 23px; height: 19px; cursor: pointer; font-size: 11px; }\n#rx-market .rx-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 8px; align-items: stretch; }\n#rx-market .rx-stakebox { min-width: 0; }\n#rx-market .rx-stepper { display: flex; align-items: center; justify-content: space-between; background: #141516; border: 1px solid #2c2d30; border-radius: 18px; padding: 3px 6px; }\n#rx-market .rx-stepper button { width: 22px; height: 22px; border-radius: 50%; background: #2c2d30; color: #9ea0a3; border: 0; font-size: 13px; cursor: pointer; }\n#rx-market .rx-stepper b { font-size: 16px; font-weight: 800; }\n#rx-market .rx-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 5px; }\n#rx-market .rx-quick button { min-height: 25px; background: #141516; border: 1px solid #2c2d30; border-radius: 14px; color: #9ea0a3; font-size: 12px; padding: 4px 0; cursor: pointer; transform: none; transition: none; animation: none; }\n#rx-market .rx-amtin { background: none; border: 0; outline: 0; color: #fff; font-size: 15px; font-weight: 800; width: min(78px, 55%); min-width: 0; text-align: center; font-family: inherit; font-variant-numeric: tabular-nums; }\n#rx-market .rx-betbtn { min-width: 0; min-height: 64px; border-radius: 14px; border: 2px solid #b2f2a0; background: radial-gradient(circle at 50% 20%, #33c40c, #218a08); color: #fff; font-size: 15px; line-height: 1.15; cursor: pointer; padding: 6px; box-shadow: 0 4px 12px rgba(40,169,9,.22); animation: none; transition: none; }\n#rx-market .rx-betbtn small { display: block; font-size: 18px; font-weight: 700; opacity: .97; margin-top: 2px; font-variant-numeric: tabular-nums; white-space: nowrap; }\n#rx-market .rx-betbtn.cancel { background: radial-gradient(circle at 50% 20%, #e0473d, #b32a22); border-color: #ffb3ae; }\n#rx-market .rx-betbtn.cash { background: radial-gradient(circle at 50% 20%, #ffb92e, #e08e00); border-color: #ffd98a; }\n#rx-market .rx-auto { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px; color: #9ea0a3; }\n#rx-market .rx-auto label { display: flex; align-items: center; gap: 6px; }\n#rx-market .rx-sw { width: 30px; height: 16px; border-radius: 9px; background: #2c2d30; position: relative; cursor: pointer; }\n#rx-market .rx-sw::after { content: \"\"; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #6b6e73; transition: .15s; }\n#rx-market .rx-sw.on { background: #28a909; } #rx-market .rx-sw.on::after { left: 16px; background: #fff; }\n#rx-market .rx-market-tabs { display: flex; align-items: center; padding: 0 2px 8px; }\n#rx-market .rx-market-tabs button { flex: 1; border: 0; border-radius: 14px; padding: 6px 4px; background: transparent; color: #9ea0a3; font-size: 12px; cursor: pointer; }\n#rx-market .rx-market-tabs button.on { background: #2c2d30; color: #fff; }\n#rx-market .rx-stat-controls { display: none; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 0 2px 9px; background: #141516; border-radius: 7px; }\n#rx-market .rx-stat-controls button { min-height: 34px; border: 0; border-radius: 13px; padding: 5px 2px; background: transparent; color: #a3a5aa; font-size: 11px; cursor: pointer; }\n#rx-market .rx-stat-controls button.on { background: #303237; color: #fff; }\n#rx-market .rx-stats-view { display: none; min-height: 270px; max-height: 420px; overflow-y: auto; }\n#rx-market .rx-stat-head, #rx-market .rx-stat-row { display: grid; grid-template-columns: 1.35fr .95fr 1fr; gap: 7px; align-items: center; }\n#rx-market .rx-stat-head { position: sticky; top: 0; z-index: 1; padding: 6px 8px; background: #1b1c1d; color: #777a80; font-size: 10px; }\n#rx-market .rx-stat-head span:not(:first-child), #rx-market .rx-stat-row > span:not(:first-child), #rx-market .rx-stat-row strong { text-align: right; }\n#rx-market .rx-stat-row { min-height: 44px; padding: 5px 8px; border-top: 1px solid #292b2e; color: #b8bbc0; font-size: 11px; font-variant-numeric: tabular-nums; }\n#rx-market .rx-stat-row strong { color: #bf24c7; font-size: 11px; }\n#rx-market .rx-stat-row strong.rx-round-score { color: #34b3f1; }\n#rx-market .rx-stat-row .rx-player-avatar { width: 29px; height: 29px; }\n#rx-market .rx-prev-head, #rx-market .rx-prev-row { grid-template-columns: 1fr 1fr; }\n#rx-market .rx-prev-row b { text-align: left; font-size: 18px; }\n#rx-market .rx-prev-row strong { text-align: right; color: #d8d9dc; }\n#rx-market .rx-top-card { padding: 9px 8px; border-top: 5px solid #1b1c1d; border-radius: 12px; background: #101113; color: #a7a9ae; font-size: 11px; font-variant-numeric: tabular-nums; }\n#rx-market .rx-top-user, #rx-market .rx-top-data, #rx-market .rx-top-data span { display: flex; align-items: center; }\n#rx-market .rx-top-user { justify-content: space-between; margin-bottom: 7px; }\n#rx-market .rx-top-user .rx-player b { display: flex; flex-direction: column; color: #d6d7da; }\n#rx-market .rx-top-user .rx-player small { margin-top: 2px; color: #898c92; font-size: 10px; }\n#rx-market .rx-top-icons { display: flex; gap: 7px; }\n#rx-market .rx-top-icons i, #rx-market .rx-round-row i { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 50%; background: #292b2f; color: #aeb2b8; font-style: normal; }\n#rx-market .rx-top-data { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 16px; }\n#rx-market .rx-top-data span { justify-content: space-between; gap: 6px; }\n#rx-market .rx-top-data strong { color: #d1d3d7; font-size: 11px; }\n#rx-market .rx-top-data span:nth-child(even) strong { color: #bf24c7; }\n#rx-market .rx-round-head, #rx-market .rx-round-row { display: grid; grid-template-columns: 1.35fr 1fr 31px; align-items: center; gap: 7px; }\n#rx-market .rx-round-head { padding: 6px 8px; color: #777a80; font-size: 10px; }\n#rx-market .rx-round-row { min-height: 42px; margin-bottom: 4px; padding: 5px 8px; border-radius: 18px; background: #101113; color: #b8bbc0; font-size: 11px; font-variant-numeric: tabular-nums; }\n#rx-market .rx-round-row strong { color: #bf24c7; text-align: right; }\n#rx-market .rx-round-row i { width: 25px; height: 25px; justify-self: end; }\n#rx-market .rx-tabs3 { display: flex; background: #141516; border-radius: 22px; padding: 4px; }\n#rx-market .rx-tabs3 button { flex: 1; border: 0; background: none; color: #9ea0a3; padding: 8px; border-radius: 20px; font-size: 14px; cursor: pointer; }\n#rx-market .rx-tabs3 button.on { background: #2c2d30; color: #fff; }\n#rx-market .rx-betboard { background: #1b1c1d; border: 1px solid #282a2d; border-radius: 7px; padding: 10px 8px 8px; }\n#rx-market .rx-betsum { display: flex; justify-content: space-between; align-items: center; padding: 0 4px 8px; }\n#rx-market .rx-crowd { display: flex; flex-direction: column; gap: 4px; color: #d8d9dc; font-size: 13px; }\n#rx-market #rx-bets-total { display: inline-block; min-width: 11ch; font-variant-numeric: tabular-nums; }\n#rx-market .rx-crowd-avatars { display: flex; height: 27px; padding-left: 2px; }\n#rx-market .rx-crowd-avatar { width: 27px; height: 27px; margin-left: -5px; }\n#rx-market .rx-totalwin { display: flex; flex-direction: column; align-items: flex-end; color: #8f9197; font-size: 12px; }\n#rx-market .rx-totalwin b { color: #ececef; font-size: 22px; line-height: 1.1; }\n#rx-market #rx-total-win { display: inline-block; min-width: 12ch; text-align: right; font-variant-numeric: tabular-nums; }\n#rx-market .rx-bet-progress { height: 8px; overflow: hidden; border-radius: 5px; background: #101113; margin: 0 4px 10px; }\n#rx-market .rx-bet-progress i { display: block; width: 0; height: 100%; background: #31343a; transition: width .16s linear; }\n#rx-market .rx-thead, #rx-market .rx-trow { display: grid; grid-template-columns: 1.4fr 1fr .7fr 1fr; gap: 6px; align-items: center; }\n#rx-market .rx-thead { color: #8f9197; font-size: 11px; padding: 5px 9px 7px; }\n#rx-market .rx-thead span:nth-child(3), #rx-market .rx-thead span:nth-child(4) { text-align: center; }\n#rx-market .rx-betlist { max-height: 300px; overflow-x: hidden; overflow-y: auto; position: relative; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y; scrollbar-width: thin; }\n#rx-market .rx-betlist.rx-scroll { animation: none; }\n#rx-market .rx-trow { min-height: 47px; background: #101113; border: 1px solid transparent; border-radius: 22px; padding: 6px 9px; font-size: 13px; margin-bottom: 5px; }\n#rx-market .rx-trow.won { background: #10240f; border-color: #2fbf5f55; }\n#rx-market .rx-trow .rx-x { color: #913ef8; text-align: center; }\n#rx-market .rx-trow .rx-w { color: #9bd648; text-align: right; }\n#rx-market .rx-trow .rx-b, #rx-market .rx-trow .rx-w { text-align: right; font-variant-numeric: tabular-nums; }\n#rx-market .rx-player { display: flex; min-width: 0; align-items: center; gap: 8px; color: #c9cacf; }\n#rx-market .rx-player b { overflow: hidden; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }\n#rx-market .rx-player-avatar, #rx-market .rx-crowd-avatar { position: relative; display: inline-grid; flex: 0 0 auto; place-items: center; overflow: hidden; border: 1px solid #55585e; border-radius: 50%; background: #25272b; }\n#rx-market .rx-player-avatar { width: 35px; height: 35px; }\n#rx-market .rx-player-avatar img, #rx-market .rx-crowd-avatar img { width: 100%; height: 100%; object-fit: cover; }\n#rx-market .rx-avatar-fallback::before, #rx-market .rx-avatar-fallback::after, #rx-market .rx-avatar-fallback i { content: \"\"; position: absolute; border-radius: 50%; }\n#rx-market .rx-avatar-fallback::before { width: 42%; height: 42%; top: 13%; background: #f1d59f; }\n#rx-market .rx-avatar-fallback::after { width: 74%; height: 42%; left: 13%; bottom: -5%; background: #d8dce4; }\n#rx-market .rx-avatar-fallback i { inset: 4px; border: 2px solid rgba(255,255,255,.35); }\n#rx-market .rx-avatar-1 { background: #bf391d; } #rx-market .rx-avatar-2 { background: #286da3; }\n#rx-market .rx-avatar-3 { background: #d99b17; } #rx-market .rx-avatar-4 { background: #556d45; }\n#rx-market .rx-avatar-5 { background: #754989; } #rx-market .rx-avatar-6 { background: #a95363; }\n#rx-market .rx-avatar-7 { background: #347c73; } #rx-market .rx-avatar-8 { background: #815c34; }\n#rx-market .rx-foot { display: flex; justify-content: space-between; padding: 12px 6px 30px; color: #9ea0a3; font-size: 12px; }\n#rx-market .rx-foot b { color: #fff; }\n#rx-market .rx-sheet { position: fixed; inset: 0; z-index: 10; background: #0009; display: none; align-items: flex-start; justify-content: center; }\n#rx-market .rx-sheet.open { display: flex; }\n#rx-market .rx-sheet-in { width: 100%; background: transparent; padding: 56px 34px 14px; max-height: 92vh; overflow-y: auto; }\n#rx-market .rx-sheet-h { display: none; }\n#rx-market .rx-close { background: none; border: 0; color: #9ea0a3; font-size: 22px; cursor: pointer; }\n#rx-market .rx-menu-card { width: 100%; max-width: 420px; margin: 0 auto; background: #232427; border-radius: 14px; padding: 14px 16px 10px; box-shadow: 0 10px 34px #000c; }\n#rx-market .rx-mtop { display: flex; align-items: center; gap: 10px; padding: 4px 0 12px; }\n#rx-market .rx-mavatar { width: 42px; height: 42px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #c98a4b, #6b3f1d); flex: none; }\n#rx-market .rx-mname { color: #fff; font-size: 17px; font-weight: 700; flex: 1; }\n#rx-market .rx-mchange { border: 1px solid #3a3b3f; background: #2c2d30; color: #dfe1e4; border-radius: 16px; padding: 8px 12px; font-size: 12px; cursor: pointer; }\n#rx-market .rx-mline { height: 6px; margin: 4px -16px; background: #16171a; }\n#rx-market .rx-mrow { display: flex; justify-content: space-between; align-items: center; padding: 13px 2px; border-bottom: 1px solid #2c2d30; font-size: 15px; color: #c9ccd1; }\n#rx-market .rx-mrow:last-child { border-bottom: 0; }\n#rx-market .rx-mrow b { color: #fff; }\n#rx-market .rx-msw { width: 36px; height: 20px; border-radius: 12px; background: #3a3b3f; position: relative; display: inline-block; }\n#rx-market .rx-msw::after { content: \"\"; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #9ea0a3; }\n#rx-market .rx-alert { position: absolute; left: 50%; top: 8px; transform: translate(-50%, -14px); z-index: 60; max-width: 92%; padding: 8px 14px; border-radius: 10px; background: #d40e2c; color: #fff; font-size: 12px; font-weight: 800; box-shadow: 0 6px 18px rgba(0,0,0,.45); opacity: 0; pointer-events: none; transition: transform .18s ease, opacity .18s ease; text-align: center; }\n#rx-market .rx-alert.on { transform: translate(-50%, 0); opacity: 1; }\n";

  function addCss() {
    if (document.getElementById("rx-market-css")) return;
    var s = document.createElement("style"); s.id = "rx-market-css"; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.documentElement) addCss(); else document.addEventListener("DOMContentLoaded", addCss);

  var chrome = (function () {
    var sfx = "@" + location.hostname.replace(/^www\./, ""), ls = [];
    function rd(k) { return window.__rxStore.get(k + sfx); }
    function wr(k, v) { window.__rxStore.set(k + sfx, v); }
    var last = rd("rx_balance");
    I(function () {
      var b = rd("rx_balance");
      if (b !== last) {
        var o = last; last = b;
        ls.forEach(function (f) { try { f({ rx_balance: { oldValue: o, newValue: b } }, "local"); } catch (e) {} });
      }
    }, 1000);
    return {
      runtime: {},
      storage: {
        local: {
          get: function (keys, cb) { var r = {}; [].concat(keys).forEach(function (k) { var v = rd(k); if (v !== undefined) r[k] = v; }); cb && cb(r); },
          set: function (o, cb) { for (var k in o) { wr(k, o[k]); if (k === "rx_balance") last = o[k]; } cb && cb(); }
        },
        onChanged: { addListener: function (f) { ls.push(f); } }
      }
    };
  })();

  /* ---------- Signal engine (UNCHANGED) ---------- */
  (function () {
    const ROUND_MS = 20000, BET_MS = 5000, BUST_MS = 2500, DAY_MS = 86400000;
    function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
    function rng(seed) { let s = seed || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
    function roundIndex(n) { return Math.floor((n || Date.now()) / ROUND_MS); }
    function roundStart(i) { return i * ROUND_MS; }
    function multiplierFor(game, index) {
      const r = rng(hash(game + ":" + index));
      const bust = r();
      if (rng(hash("big:" + game + ":" + index))() < 0.06) return Math.floor((15 + Math.pow(r(), 2) * 185) * 100) / 100;
      if (bust < 0.03) return 1.0;
      if (r() < 0.08) return Math.floor((4 + r() * 4) * 100) / 100;
      const u = r();
      const raw = 0.99 / Math.max(1 - u, 0.00001);
      const capped = raw > 2.5 ? 1.02 + (raw % 1.6) : raw;
      return Math.floor(capped * 100) / 100;
    }
    function signalFor(game, index) {
      const target = multiplierFor(game, index);
      const r = rng(hash("meta:" + game + ":" + index));
      const safe = Number(Math.max(1.05, Math.min(target * 0.62, target - 0.1)).toFixed(2));
      const margin = target <= 1.01 ? 0 : Math.min(1, (target - safe) / target);
      const confidence = Math.round(72 + margin * 24 + r() * 4);
      return { target: target, safe: safe, confidence: confidence, round: 100000 + (index % 900000) };
    }
    function liveMultiplier(ms) { const s = Math.max(0, ms) / 1000; return Math.max(1, Math.floor(Math.pow(Math.E, 0.06 * s) * 100) / 100); }
    function flightDuration(target) { return target <= 1 ? 0 : (Math.log(target) / 0.06) * 1000; }
    function globalIndex(n, step) { return Math.floor(n / DAY_MS) * 100000 + step; }
    function durationFor(index) { return BET_MS + flightDuration(multiplierFor("aviator", index)) + BUST_MS; }
    var cache = null;
    function roundSchedule(nowTs) {
      var n = typeof nowTs === "number" ? nowTs : now();
      var day = Math.floor(n / DAY_MS) * DAY_MS;
      if (!cache || cache.day !== day || cache.start > n) cache = { day: day, step: 0, start: day };
      var step = cache.step, start = cache.start;
      for (var g = 0; g < 200000; g++) {
        var next = start + durationFor(globalIndex(n, step));
        if (next > n) break;
        start = next; step += 1;
      }
      cache = { day: day, step: step, start: start };
      var index = globalIndex(n, step);
      var target = multiplierFor("aviator", index);
      var flightMs = flightDuration(target);
      var takeOff = start + BET_MS, crashAt = takeOff + flightMs;
      return { index: index, start: start, takeOff: takeOff, crashAt: crashAt, end: crashAt + BUST_MS, target: target, flightMs: flightMs };
    }
    var offset = 0;
    function now() { return Date.now() + offset; }
    function sync() {
      try {
        var t0 = Date.now();
        fetch("https://ppgg9.org/api/public/signal?game=aviator", { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d && typeof d.serverTime === "number" && d.serverTime > 0) {
              offset = d.serverTime + (Date.now() - t0) / 2 - Date.now();
            }
          }).catch(function () {});
      } catch (e) {}
    }
    sync(); I(sync, 30000);
    window.RXEngine = { ROUND_MS, BET_MS, BUST_MS, roundIndex, roundStart, roundSchedule, multiplierFor, signalFor, liveMultiplier, flightDuration, now };
  })();

  var E = window.RXEngine;
  if (!E || typeof E.roundSchedule !== "function") return;
  var EMBED = !!window.__rxEmbed;
  var dead = false;
  var BET_MS = 5000;
  var GAME = "aviator";
  var SITE = (window.__rxEmbed && window.location) ? window.location.origin : "https://ppgg9.org";
  var lightSpin = 0, lightTick = Date.now();

  var balance = 0, bet = [1000, 1000], stake = [null, null];
  var editingAmt = [false, false], depositTrx = "";
  var lastAccountBalance = null;

  function store(obj) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(obj, function () { if (chrome.runtime) void chrome.runtime.lastError; });
      }
    } catch (e) {}
    try { localStorage.setItem("rx_wallet", JSON.stringify({ balance: balance, trx: depositTrx })); } catch (e) {}
  }
  function restore(cb) {
    if (typeof window.__rxServerBalance === "number" && !isNaN(window.__rxServerBalance)) {
      balance = window.__rxServerBalance;
      cb();
      return;
    }
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) throw new Error("no chrome");
      chrome.storage.local.get(["rx_balance", "rx_trx"], function (v) {
        if (chrome.runtime && chrome.runtime.lastError) { cb(); return; }
        if (v && typeof v.rx_balance === "number") balance = v.rx_balance;
        if (v && v.rx_trx) depositTrx = v.rx_trx;
        cb();
      });
      return;
    } catch (e) {}
    try {
      var w = JSON.parse(localStorage.getItem("rx_wallet") || "{}");
      if (typeof w.balance === "number") balance = w.balance;
      if (w.trx) depositTrx = w.trx;
    } catch (e) {}
    cb();
  }

  var root = document.createElement("div");
  root.id = "rx-market";
  root.innerHTML =
    '<div class="rx-head"><div class="rx-avlogo rx-head-logo">Aviator</div><div class="rx-head-brand"><div class="rx-bal"><span id="rx-bal">0.00</span><small>BDT</small></div></div><button class="rx-ico" id="rx-menu">&#9776;</button></div>' +
    '<div class="rx-histwrap"><div class="rx-hist" id="rx-hist"></div><button class="rx-more" id="rx-more" aria-label="Round history">&#8943;</button></div>' +
    '<div class="rx-history" id="rx-history"><div class="rx-history-head"><b>ROUND HISTORY</b><button id="rx-history-x" aria-label="Close history">&times;</button></div><div class="rx-history-grid" id="rx-history-grid"></div></div>' +
    '<div class="rx-body"><div class="rx-stage"><canvas id="rx-cv"></canvas><div class="rx-winpops" id="rx-winpops"></div>' +
      '<div class="rx-idle" id="rx-idle"><img class="rx-idle-plane" id="rx-idle-plane" alt="">' +
        '<div class="rx-partners"><svg class="rx-ufc" viewBox="0 0 328 115" role="img" aria-label="UFC" xmlns="http://www.w3.org/2000/svg"><path d="M31 6H70L51 78Q49 87 59 87H71Q78 87 81 77L99 6H138L118 81Q108 114 73 114H41Q-2 114 9 75Z" fill="currentColor"/><path d="M145 6H242L234 34H137Z M133 44H230L222 71H165L152 113H113Z" fill="currentColor"/><path d="M252 6H300L293 34H271Q256 34 252 49L245 73Q241 86 256 86H281L274 114H238Q194 114 207 73L218 37Q227 6 252 6Z" transform="translate(28 0)" fill="currentColor"/></svg><span class="rx-vline"></span>' +
        '<span class="rx-idle-brand"><img src="https://ppgg9.org/__l5e/assets-v1/48a6b6ec-4a48-4cc8-908b-7ef3ccd75246/rx-plane-2.png" alt=""><span class="rx-avlogo">Aviator</span></span></div>' +
        '<div class="rx-oftxt">OFFICIAL PARTNERS</div><div class="rx-barwrap"><div class="rx-bar" id="rx-bar"></div></div>' +
        '<div class="rx-spribe"><div class="rx-spribe-top"><span class="rx-smark" aria-hidden="true">S</span><b>SPRIBE</b></div><div class="rx-official-game"><span>Official Game</span><i aria-hidden="true">&#10003;</i></div><div class="rx-since">Since 2019</div></div></div>' +
      '<div class="rx-center"><div class="rx-state" id="rx-state">FLEW AWAY!</div><div class="rx-mult" id="rx-mult">1.00x</div></div>' +
      '<div class="rx-live"><span class="rx-avs" id="rx-avs"></span><span id="rx-livecount">349</span></div></div>' +
      '<div class="rx-panel" data-i="0"></div><div class="rx-panel" data-i="1"></div>' +
      '<section class="rx-betboard"><div class="rx-market-tabs" role="tablist"><button class="on" data-view="all">All Bets</button><button data-view="previous">Previous</button><button data-view="top">Top</button></div>' +
        '<div class="rx-stat-controls" id="rx-stat-controls"><button data-metric="x">X</button><button class="on" data-metric="win">Win</button><button data-metric="rounds">Rounds</button><button class="on" data-period="day">Day</button><button data-period="month">Month</button><button data-period="year">Year</button></div>' +
        '<div class="rx-stats-view" id="rx-stats-view"></div>' +
        '<div class="rx-all-view" id="rx-all-view"><div class="rx-betsum"><div class="rx-crowd"><span class="rx-crowd-avatars" id="rx-crowd-avatars"></span><span><b id="rx-bets-total">0/0</b> Bets</span></div><div class="rx-totalwin"><b id="rx-total-win">0.00</b><span>Total win BDT</span></div></div>' +
        '<div class="rx-bet-progress"><i id="rx-bet-progress"></i></div><div class="rx-thead"><span>Player</span><span>Bet BDT</span><span>X</span><span>Win BDT</span></div><div class="rx-betlist" id="rx-betlist"></div></div></section>' +
      '<div class="rx-foot"><span>&#10004; Provably Fair Game</span><span>Powered by <b>SPRIBE</b></span></div></div>' +
    '<div class="rx-sheet" id="rx-sheet"><div class="rx-sheet-in"><div class="rx-menu-card"><div class="rx-mtop"><span class="rx-mavatar" id="rx-mavatar"></span><b class="rx-mname">Player</b><button class="rx-mchange" type="button">&#128100; Change Avatar</button></div>' +
      '<div class="rx-mrow"><span>&#128266; Sound</span><span class="rx-msw"></span></div><div class="rx-mrow"><span>&#127925; Music</span><span class="rx-msw"></span></div><div class="rx-mrow"><span>&#128744;&#65039; Animation</span><span class="rx-msw"></span></div><div class="rx-mline"></div>' +
      '<div class="rx-mrow"><span>&#11088; Free Bets</span><span></span></div><div class="rx-mrow"><span>&#128337; My Bet History</span><span></span></div><div class="rx-mrow"><span>&#128184; Game Limits</span><span></span></div><div class="rx-mrow"><span>&#10067; How To Play</span><span></span></div><div class="rx-mrow"><span>&#128196; Game Rules</span><span></span></div><div class="rx-mrow"><span>&#10004;&#65039; Provably Fair Settings</span><span></span></div></div></div></div>';

  function panelHTML(i) {
    return '<div class="rx-segrow"><div class="rx-seg"><button class="on">Bet</button><button>Auto</button></div>' + (i === 1 ? '<button class="rx-mini">&#9636;</button>' : '') + '</div>' +
      '<div class="rx-row"><div class="rx-stakebox"><div class="rx-stepper"><button data-d="-1">&#8722;</button><input class="rx-amtin" id="rx-amt-' + i + '" inputmode="decimal" autocomplete="off" value="1,000.00" aria-label="Bet amount"><button data-d="1">+</button></div>' +
      '<div class="rx-quick"><button data-q="100">100</button><button data-q="500">500</button><button data-q="1000">1,000</button><button data-q="10000">10,000</button></div></div>' +
      '<button class="rx-betbtn" id="rx-bet-' + i + '">Bet<small>1000.00 BDT</small></button></div>' +
      (i === 0 ? '<div class="rx-auto"><label>Auto bet <span class="rx-sw"></span></label><label>Auto Cash Out <span class="rx-sw"></span> <b style="color:#dfe1e4">1.10</b></label></div>' : '');
  }

  var MAX_BET = 10000, MIN_BET = 10;
  function clampBet(v) { if (isNaN(v) || v == null) return MIN_BET; return Math.max(MIN_BET, Math.min(MAX_BET, Math.round(v))); }
  function money(v) { return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var winTimers = {};
  function showWin(amount, multiplier, total, slot) {
    var stack = root.querySelector("#rx-winpops"); if (!stack) return;
    var key = String(slot || 1);
    var pop = stack.querySelector('[data-slot="' + key + '"]');
    if (!pop) { pop = document.createElement("div"); pop.className = "rx-winpop"; pop.setAttribute("data-slot", key); stack.appendChild(pop); }
    pop.innerHTML = '<div class="rx-win-copy"><span>You have cashed out!</span><strong>' + multiplier.toFixed(2) + 'x</strong></div><div class="rx-win-value"><span>Win BDT</span><strong>' + money(total) + '</strong></div><i aria-hidden="true">&times;</i>';
    pop.classList.remove("on"); void pop.offsetWidth; pop.classList.add("on");
    clearTimeout(winTimers[key]);
    winTimers[key] = T(function () {
      pop.classList.remove("on");
      T(function () { if (pop.parentNode) pop.parentNode.removeChild(pop); }, 240);
    }, 3200);
  }

  var alertTimer = 0;
  function showAlert(text) {
    if (!root) return;
    var el = root.querySelector("#rx-alert");
    if (!el) { el = document.createElement("div"); el.id = "rx-alert"; el.className = "rx-alert"; root.appendChild(el); }
    el.textContent = text;
    el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    clearTimeout(alertTimer);
    alertTimer = T(function () { el.classList.remove("on"); }, 2600);
  }

  function openSheet(id) { var s = root.querySelector(id); if (s) s.classList.add("open"); }
  function closeSheet(id) { var s = root.querySelector(id); if (s) s.classList.remove("open"); }

  function start() {
    if (window.__rxMarket) return;
    window.__rxMarket = true;
    if (EMBED) { balance = typeof window.__rxBalance === "number" ? window.__rxBalance : 0; mount(); return; }
    restore(mount);
  }

  var renderedAvatarRound = -1;
  function hashSeed(n) {
    n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }
  function seeded(idx, salt) { return hashSeed(idx * 7919 + salt * 104729 + 17); }

  var playerLogos = [], planeLogos = [];
  var betRows = [], renderedBetRound = -1, drawnRound = -1;
  var maskedStarts = ["0", "1", "3", "5", "7", "8", "9", "a", "b", "d", "i", "k", "m", "p", "r", "s", "t", "y"];

  function avatarMarkup(row, cls) {
    if (row.logo) return '<span class="' + cls + '"><img src="' + String(row.logo).replace(/"/g, "&quot;") + '" alt=""></span>';
    return '<span class="' + cls + ' rx-avatar-fallback rx-avatar-' + row.skin + '"><i></i></span>';
  }

  function avatars(el, seed) {
    if (seed === renderedAvatarRound) return;
    renderedAvatarRound = seed;
    if (planeLogos.length) {
      var pool = planeLogos.slice();
      for (var s = pool.length - 1; s > 0; s--) {
        var j = Math.floor(hashSeed(seed * 7919 + s * 6151 + 77) * (s + 1));
        var tmp = pool[s]; pool[s] = pool[j]; pool[j] = tmp;
      }
      el.innerHTML = pool.slice(0, 3).map(function (src, i) { return avatarMarkup({ logo: src, skin: 1 + (i % 8) }, "rx-av"); }).join("");
      return;
    }
    buildBetRows(seed);
    if (betRows.length) {
      el.innerHTML = betRows.slice(0, 3).map(function (row) { return avatarMarkup(row, "rx-av"); }).join("");
      return;
    }
    var cols = ["#c9a227", "#4a8fd6", "#c0504d", "#7a5230", "#4f8a4f"];
    var h = "";
    for (var i = 0; i < 3; i++) h += '<span class="rx-av" style="background:' + cols[(seed + i) % cols.length] + '"></span>';
    el.innerHTML = h;
  }

  function buildBetRows(idx) {
    if (idx === renderedBetRound) return;
    renderedBetRound = idx;
    betRows = [];

    var live = (window.__rxLiveBets && window.__rxLiveBets[idx]) || {};
    var liveKeys = Object.keys(live);
    for (var r = 0; r < liveKeys.length; r++) {
      var lb = live[liveKeys[r]];
      if (!lb || !lb.amount) continue;
      betRows.push({
        name: lb.name || ("User" + String(lb.pid || r).slice(-4)),
        amount: Number(lb.amount) || 0,
        cashAt: lb.cashAt != null ? Number(lb.cashAt) : (1.03 + seeded(idx, r + 71) * 5.8),
        logo: "",
        skin: 1 + Math.floor(seeded(idx, r + 311) * 8),
        real: true,
        pid: lb.pid || r,
        win: lb.win != null ? Number(lb.win) : null
      });
    }

    var count = 24 + Math.floor(seeded(idx, 2) * 18);
    for (var i = 0; i < count; i++) {
      var raw = 1500 + Math.pow(seeded(idx, i + 7), 1.9) * 5400;
      var amount = Math.round(raw / 50) * 50;
      if (i < 3 && seeded(idx, i + 911) < 0.75) amount = (7 + Math.floor(seeded(idx, i + 951) * 4)) * 1000;
      var cashAt = 1.03 + seeded(idx, i + 71) * 5.8;
      var prefix = maskedStarts[Math.floor(seeded(idx, i + 131) * maskedStarts.length)];
      var suffix = Math.floor(seeded(idx, i + 191) * 10);
      betRows.push({ name: prefix + "***" + suffix, amount: amount, cashAt: cashAt, logo: "", skin: 1 + Math.floor(seeded(idx, i + 311) * 8) });
    }
    betRows.sort(function (a, b) { return b.amount - a.amount; });
    var pool = playerLogos.slice();
    for (var s = pool.length - 1; s > 0; s--) {
      var j = Math.floor(seeded(idx, s + 401) * (s + 1));
      var tmp = pool[s]; pool[s] = pool[j]; pool[j] = tmp;
    }
    if (pool.length) for (var k = 0; k < betRows.length; k++) if (!betRows[k].real) betRows[k].logo = pool[k % pool.length];
  }

  function totalBetMoney(idx, totalBets) {
    return 3000000 + Math.round(seeded(idx, 593) * 900000) + Math.round(totalBets * (40 + seeded(idx, 597) * 30));
  }
  function targetTotalWin(p, totalBets) {
    if (p.mode === "wait") return 0;
    var multiplier = p.mode === "fly" ? Math.min(E.liveMultiplier(p.t), p.crash) : p.crash;
    var roundStake = totalBetMoney(p.idx, totalBets);
    var winAtTwo = Math.max(1200000, Math.round(roundStake * 0.24));
    return Math.round(winAtTwo * (multiplier < 2 ? 0.84 + 0.16 * (multiplier - 1) : multiplier / 2));
  }
  function rowHTML(row, didWin) {
    var win = didWin ? row.amount * row.cashAt : 0;
    return '<div class="rx-trow' + (didWin ? ' won' : '') + '"><span class="rx-player">' + avatarMarkup(row, "rx-player-avatar") + '<b>' + row.name + '</b></span><span class="rx-b">' + money(row.amount) + '</span><span class="rx-x">' + (didWin ? row.cashAt.toFixed(2) + 'x' : '') + '</span><span class="rx-w">' + (didWin ? money(win) : '') + '</span></div>';
  }

  var marketView = "all", statMetric = "win", statPeriod = "day", renderedStatsKey = "";
  function statDate(idx, offset) {
    var d = new Date((idx - offset) * E.ROUND_MS);
    return String(d.getUTCDate()).padStart(2, "0") + "." + String(d.getUTCMonth() + 1).padStart(2, "0") + "." + String(d.getUTCFullYear()).slice(-2) + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  }
  function renderMarketView(idx) {
    var all = root.querySelector("#rx-all-view"), stats = root.querySelector("#rx-stats-view"), controls = root.querySelector("#rx-stat-controls");
    if (!all || !stats || !controls) return;
    all.style.display = marketView === "all" ? "block" : "none";
    stats.style.display = marketView === "all" ? "none" : "block";
    controls.style.display = marketView === "top" ? "grid" : "none";
    if (marketView === "all") return;
    var key = [marketView, statMetric, statPeriod, idx].join(":");
    if (key === renderedStatsKey) return;
    renderedStatsKey = key;
    var html = "";
    if (marketView === "previous") {
      var result = E.multiplierFor(GAME, idx);
      var previousBets = allBetTarget(idx);
      html = '<div class="rx-stat-head rx-prev-head"><span>Previous round</span><span>Bets</span></div>' +
        '<div class="rx-stat-row rx-prev-row"><b class="' + chipClass(result) + '">' + result.toFixed(2) + 'x</b><strong>' + previousBets.toLocaleString("en-US") + '</strong></div>';
    } else {
      var periodScale = statPeriod === "year" ? 365 : statPeriod === "month" ? 30 : 1;
      if (statMetric === "rounds") {
        html = '<div class="rx-round-head"><span>Date &amp; Time</span><span>X</span><span></span></div>';
        for (var j = 0; j < 14; j++) {
          var roundX = 80 + seeded(idx, j + 901) * (statPeriod === "year" ? 420000 : statPeriod === "month" ? 22000 : 850);
          html += '<div class="rx-round-row"><span>' + statDate(idx, j * periodScale) + '</span><strong>' + money(roundX) + 'x</strong><i aria-hidden="true">✓</i></div>';
        }
      } else {
        for (var j2 = 0; j2 < 14; j2++) {
          var amount = Math.max(1, Math.round((1 + seeded(idx, j2 + 801) * 9999) * (statPeriod === "day" ? 1 : 1.3)));
          var res = statMetric === "x" ? 1200 + seeded(idx, j2 + 951) * 420000 : 1.05 + seeded(idx, j2 + 951) * 99;
          var roundMax = res * (1.08 + seeded(idx, j2 + 967) * 4.2);
          var winTotal = statMetric === "x" ? Math.min(1000000, amount * res) : amount * res;
          var row = { name: maskedStarts[Math.floor(seeded(idx, j2 + 991) * maskedStarts.length)] + "***" + Math.floor(seeded(idx, j2 + 997) * 10), amount: amount, logo: playerLogos.length ? playerLogos[j2 % playerLogos.length] : "", skin: 1 + (j2 % 8) };
          html += '<div class="rx-top-card"><div class="rx-top-user"><span class="rx-player">' + avatarMarkup(row, "rx-player-avatar") + '<b>' + row.name + '<small>' + statDate(idx, j2 * periodScale).split(" ")[0] + '</small></b></span><span class="rx-top-icons"><i>◯</i><i>✓</i></span></div><div class="rx-top-data"><span>Bet BDT<strong>' + money(amount) + '</strong></span><span>Result<strong>' + money(res) + 'x</strong></span><span>Win BDT<strong>' + money(winTotal) + '</strong></span><span>Round max.<strong>' + money(roundMax) + 'x</strong></span></div></div>';
        }
      }
    }
    stats.innerHTML = html;
  }

  function allBetTarget(idx) {
    var dh = new Date(Date.now() + 6 * 3600 * 1000).getUTCHours();
    var lo, hi;
    if (dh >= 4 && dh < 8) { lo = 2000; hi = 2500; }
    else if (dh >= 8 && dh < 15) { lo = 5500; hi = 6500; }
    else if (dh >= 15 && dh < 22) { lo = 8000; hi = 12000; }
    else { lo = 2500; hi = 4000; }
    var r = Math.pow(hashSeed(idx * 7919 + 13), 1.8);
    return Math.round(lo + r * (hi - lo));
  }

  var lastFlyCount = 0, lastCounterFrame = 0;
  function drawBetRows(p, shown, totalBets) {
    buildBetRows(p.idx);
    var liveM = p.mode === "fly" ? Math.min(E.liveMultiplier(p.t), p.crash) : 1;
    var list = root.querySelector("#rx-betlist");
    var totalWinDisplay = targetTotalWin(p, totalBets);
    if (drawnRound !== p.idx) {
      drawnRound = p.idx;
      var html = "";
      for (var i = 0; i < betRows.length; i++) html += rowHTML(betRows[i], false);
      list.innerHTML = html;
      list.classList.add("rx-scroll");
    }
    var rows = list.querySelectorAll(".rx-trow");
    var wonCount = 0;
    for (var i = 0; i < betRows.length; i++) {
      var r = betRows[i];
      if (p.mode === "fly" && liveM >= r.cashAt && r.cashAt < p.crash) wonCount++;
    }
    for (var i = 0; i < rows.length; i++) {
      var ri = i % betRows.length;
      var row = betRows[ri];
      var didWin = p.mode === "fly" && liveM >= row.cashAt && row.cashAt < p.crash;
      if (row.real && row.win != null) didWin = true;
      var win = didWin ? (row.win != null ? row.win : row.amount * row.cashAt) : 0;
      var el = rows[i];
      if (el.classList.contains("won") === didWin) continue;
      el.classList.toggle("won", didWin);
      el.querySelector(".rx-x").textContent = didWin ? row.cashAt.toFixed(2) + "x" : "";
      el.querySelector(".rx-w").textContent = didWin ? money(win) : "";
    }
    root.querySelector("#rx-bets-total").textContent = totalBets.toLocaleString("en-US") + "/" + shown.toLocaleString("en-US");
    root.querySelector("#rx-total-win").textContent = money(totalWinDisplay);
    root.querySelector("#rx-bet-progress").style.width = (p.mode === "wait" ? Math.max(4, 100 - p.left / BET_MS * 100) : Math.max(5, 100 - wonCount / Math.max(1, betRows.length) * 100)) + "%";
    root.querySelector("#rx-crowd-avatars").innerHTML = betRows.slice(0, 3).map(function (row) { return avatarMarkup(row, "rx-crowd-avatar"); }).join("");
  }
  function drawAllBet(p, now) {
    if (p.idx === drawnRound && now - lastCounterFrame < 120) return;
    lastCounterFrame = now;
    var tgt = allBetTarget(p.idx), shown;
    if (p.mode === "wait") {
      var prog = Math.max(0, Math.min(1, 1 - p.left / BET_MS));
      shown = Math.round(10 + (tgt - 10) * Math.pow(prog, 0.65));
      lastFlyCount = shown;
    } else if (p.mode === "fly") {
      var flightMs = Math.max(1, E.flightDuration(p.crash));
      var prog2 = Math.max(0, Math.min(1, p.t / flightMs));
      var floor = p.crash >= 500 ? 4 : Math.round(tgt * Math.max(0.12, 0.45 - Math.log10(Math.max(1, p.crash)) * 0.12));
      shown = Math.round(floor + (tgt - floor) * Math.pow(1 - prog2, 1.6));
      lastFlyCount = shown;
    } else shown = lastFlyCount || tgt;
    shown = Math.max(0, shown);
    var privateCount = Math.round(shown * 2 / 3);
    root.querySelector("#rx-livecount").textContent = Math.max(2, privateCount).toLocaleString("en-US");
    drawBetRows(p, shown, p.mode === "wait" ? shown : tgt);
  }

  function chipClass(m) { return m < 2 ? "rx-blue" : m < 10 ? "rx-pur" : "rx-pink"; }

  var lastHist = -1;
  function drawHistory(idx) {
    if (idx === lastHist) return; lastHist = idx;
    var h = "", all = "";
    for (var k = 0; k < 12; k++) { var m = E.multiplierFor(GAME, idx - k); h += '<span class="rx-chip ' + chipClass(m) + '">' + m.toFixed(2) + 'x</span>'; }
    for (var j = 0; j < 60; j++) {
      var full = E.multiplierFor(GAME, idx - j);
      all += '<span class="rx-history-chip ' + chipClass(full) + (full >= 10 ? ' rx-history-big' : full < 2 ? ' rx-history-small' : '') + '">' + full.toFixed(2) + 'x</span>';
    }
    root.querySelector("#rx-hist").innerHTML = h;
    root.querySelector("#rx-history-grid").innerHTML = all;
  }

  var PLANE_IMG = new Image();
  try { PLANE_IMG.src = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL("img/rx-plane.png") : "https://ppgg9.org/rx-plane.png"; }
  catch (e) { PLANE_IMG.src = "https://ppgg9.org/rx-plane.png"; }
  PLANE_IMG.onerror = function () { PLANE_IMG.src = "https://ppgg9.org/rx-plane.png"; };
  var idlePlane = root.querySelector("#rx-idle-plane"); if (idlePlane) idlePlane.src = PLANE_IMG.src;

  function plane(c, x, y, size, angle, floating) {
    c.save(); c.translate(x, y); if (angle) c.rotate(angle);
    if (PLANE_IMG.complete && PLANE_IMG.naturalWidth) {
      var hgt = size || 42, wdt = hgt * (PLANE_IMG.naturalWidth / PLANE_IMG.naturalHeight);
      if (floating) { c.shadowColor = "rgba(0,0,0,.55)"; c.shadowBlur = 10; c.shadowOffsetY = 7; }
      c.drawImage(PLANE_IMG, -wdt * 0.06, -hgt / 2, wdt, hgt);
    }
    c.restore();
  }
  function rays(c, w, h, moving) {
    var now = Date.now(), elapsed = Math.min(80, now - lightTick); lightTick = now;
    if (moving) lightSpin += (elapsed / 1000) * 0.16;
    var bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "rgba(3,12,17,.92)"); bg.addColorStop(0.55, "rgba(4,15,21,.68)"); bg.addColorStop(1, "rgba(0,0,0,.94)");
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.save(); c.globalCompositeOperation = "screen"; c.translate(-w * 0.18, h * 1.22);
    var count = 22, span = Math.PI * 0.62, step = span / count, spin = lightSpin % (step * 2), reach = Math.hypot(w, h) * 2.4;
    for (var r = 0; r < count; r++) {
      var a = -Math.PI * 0.86 + spin + r * step * 2;
      c.beginPath(); c.moveTo(0, 0);
      c.lineTo(Math.cos(a - step * 0.5) * reach, Math.sin(a - step * 0.5) * reach);
      c.lineTo(Math.cos(a + step * 0.5) * reach, Math.sin(a + step * 0.5) * reach);
      c.closePath();
      var rg = c.createRadialGradient(0, 0, 0, 0, 0, reach);
      rg.addColorStop(0, "rgba(198,120,255,.20)"); rg.addColorStop(0.5, "rgba(150,60,245,.15)"); rg.addColorStop(1, "rgba(71,18,139,0)");
      c.fillStyle = rg; c.fill();
    }
    c.restore();
  }

  function curve(p) {
    var cv = root.querySelector("#rx-cv");
    var w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    var c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
    rays(c, w, h, p.mode !== "bust");
    var planeSize = Math.max(46, Math.min(54, h * 0.23));
    var planeWidth = planeSize * (PLANE_IMG.naturalWidth && PLANE_IMG.naturalHeight ? PLANE_IMG.naturalWidth / PLANE_IMG.naturalHeight : 1.59);
    var x0 = 2, y0 = h - planeSize * 0.32;
    var x1 = Math.max(x0, w - planeWidth - 10), y1 = Math.max(planeSize * 0.58, h * 0.22);
    if (p.mode === "wait") { plane(c, x0, y0, 54, 0.17); return; }
    if (p.mode === "bust") {
      var escapeT = Math.max(0, p.bustT || 0), dashT = escapeT / 1000;
      var dash = 9000 * dashT + 7000 * dashT * dashT;
      var escapeX = x1 + dash, escapeY = y1 - dash * 0.28;
      var noseUp = Math.max(0.08, 0.20 - dashT * 0.32);
      if (escapeX < w + planeWidth && escapeY > -planeSize) plane(c, escapeX, escapeY, planeSize, noseUp);
      return;
    }
    var travelMs = 7200, prog = Math.min(1, p.t / travelMs);
    function point(t) { var bx = x0 + (x1 - x0) * t, easedRise = t * t * (3 - 2 * t), by = y0 - (y0 - y1) * easedRise; return { x: bx, y: by }; }
    var pos = point(prog), atEdge = prog >= 1;
    var floatRange = p.crash >= 10 ? Math.min(36, h * 0.162) : Math.min(19.8, h * 0.09);
    var edgeT = Math.max(0, p.t - travelMs);
    var sway = atEdge ? Math.sin(edgeT / 1800) * floatRange : 0;
    var px = pos.x, py = pos.y + sway, ang = 0.19;
    var tailLocalX = planeSize * 0.26, tailLocalY = planeSize * 0.39;
    var attach = { x: px + tailLocalX * Math.cos(ang) - tailLocalY * Math.sin(ang), y: py + tailLocalX * Math.sin(ang) + tailLocalY * Math.cos(ang) };
    var cxq = attach.x * 0.46, cyq = h - (h - attach.y) * 0.10;
    c.beginPath(); c.moveTo(0, h); c.quadraticCurveTo(cxq, cyq, attach.x, attach.y); c.lineTo(attach.x, h); c.closePath();
    var wash = c.createLinearGradient(0, attach.y, 0, h);
    wash.addColorStop(0, "rgba(223,23,51,.84)"); wash.addColorStop(0.55, "rgba(223,23,51,.63)"); wash.addColorStop(1, "rgba(150,3,36,.42)");
    c.fillStyle = wash; c.fill();
    plane(c, px, py, planeSize, ang, atEdge);
    c.save(); c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.beginPath(); c.moveTo(0, h); c.quadraticCurveTo(cxq, cyq, attach.x, attach.y);
    c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = "rgb(223,23,51)"; c.lineWidth = 3.24; c.stroke();
    c.restore();
  }

  function phase(now) {
    var s = E.roundSchedule(now);
    var dur = s.flightMs;
    if (now < s.takeOff) return { idx: s.index, mode: "wait", left: s.takeOff - now, target: s.target, dur: dur, crash: s.target };
    if (now < s.crashAt) return { idx: s.index, mode: "fly", t: now - s.takeOff, target: s.target, dur: dur, crash: s.target };
    return { idx: s.index, mode: "bust", t: dur, bustT: now - s.crashAt, target: s.target, dur: dur, crash: s.target };
  }

  async function action(i) {
    var p = phase(E.now());
    if (stake[i] == null) {
      if (p.mode !== "wait") { showAlert("Next Round — রাউন্ড চলছে, আপনার বাজি পরের রাউন্ডে ধরা হবে"); return; }
      bet[i] = clampBet(bet[i]);
      if (bet[i] > balance) { showAlert("Balance নাই — ৳" + money(bet[i]) + " প্রয়োজন, ডিপোজিট করুন"); return; }
      var amount = bet[i], prevBalance = balance;
      stake[i] = { amount: amount, round: p.idx };
      balance -= amount;

      if (typeof window.__rxCommitBalance === "function") {
        window.__rxCommitBalance(-amount, { type: "bet", round: p.idx }).then(function (res) {
          if (!res || !res.ok) {
            stake[i] = null; balance = prevBalance;
            showAlert(res && res.reason === "insufficient" ? "Balance নাই — ডিপোজিট করুন" : "বাজি নেওয়া যায়নি, আবার চেষ্টা করুন");
            return;
          }
          if (typeof res.balance === "number") balance = res.balance;
          if (typeof window.__rxBroadcastBet === "function") { try { window.__rxBroadcastBet(p.idx, amount, i); } catch (e) {} }
        });
      } else if (EMBED && typeof window.__rxPlaceBet === "function") {
        window.__rxPlaceBet(amount, i + 1).then(function (placed) {
          if (!placed || !placed.ok) {
            stake[i] = null; balance = prevBalance;
            showAlert(placed && placed.reason === "balance" ? "Balance নাই — ডিপোজিট করুন" : "বাজি নেওয়া যায়নি, আবার চেষ্টা করুন");
            return;
          }
          balance = Number(placed.balance);
        }).catch(function () { stake[i] = null; balance = prevBalance; showAlert("বাজি নেওয়া যায়নি, আবার চেষ্টা করুন"); });
      } else store({ rx_balance: balance, rx_trx: depositTrx });
    } else if (p.mode === "fly" && stake[i].round === p.idx) {
      var m = Math.min(E.liveMultiplier(p.t), p.crash), wonAmount = stake[i].amount, wonTotal = wonAmount * m;
      stake[i] = null;
      showWin(wonAmount, m, wonTotal, i + 1);
      if (typeof window.__rxCommitBalance === "function") {
        window.__rxCommitBalance(wonTotal, { type: "cashout", round: p.idx, stake: wonAmount, mult: m }).then(function (res) {
          if (res && res.ok && typeof res.balance === "number") balance = res.balance;
        });
        if (typeof window.__rxBroadcastCashout === "function") { try { window.__rxBroadcastCashout(p.idx, m, wonTotal); } catch (e) {} }
      } else if (EMBED && typeof window.__rxCashout === "function") {
        balance += wonTotal;
        window.__rxCashout(i + 1).then(function (cashed) {
          if (!cashed || !cashed.ok) { balance -= wonTotal; showAlert(cashed && cashed.reason === "crashed" ? "বিমান উড়ে গেছে" : "ক্যাশ আউট হয়নি"); return; }
          balance = Number(cashed.balance);
          showWin(wonAmount, Number(cashed.multiplier), Number(cashed.payout), i + 1);
        }).catch(function () { balance -= wonTotal; showAlert("ক্যাশ আউট হয়নি"); });
      } else {
        balance += wonTotal;
        store({ rx_balance: balance, rx_trx: depositTrx });
      }
    } else if (p.mode === "wait") {
      var back = stake[i].amount;
      stake[i] = null;
      if (typeof window.__rxCommitBalance === "function") {
        window.__rxCommitBalance(back, { type: "refund", round: p.idx }).then(function (res) {
          if (res && res.ok && typeof res.balance === "number") balance = res.balance;
        });
      } else if (EMBED && typeof window.__rxCancelBet === "function") {
        balance += back;
        window.__rxCancelBet(i + 1).then(function (cancelled) { if (cancelled && cancelled.ok) balance = Number(cancelled.balance); }).catch(function () {});
      } else {
        balance += back;
        store({ rx_balance: balance, rx_trx: depositTrx });
      }
    }
  }

  var previousOverflow = "";
  function mount() {
    if (!document.body) return setTimeout(mount, 200);
    if (!EMBED) { previousOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden"; }
    var host = EMBED ? document.getElementById("rx-mount") : null;
    (host || document.body).appendChild(root);

    root.querySelectorAll(".rx-panel").forEach(function (p) {
      var i = +p.dataset.i;
      p.innerHTML = panelHTML(i);
      p.querySelectorAll(".rx-seg button").forEach(function (b) {
        b.onclick = function () { p.querySelectorAll(".rx-seg button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); };
      });
      p.querySelectorAll(".rx-sw").forEach(function (s) { s.onclick = function () { s.classList.toggle("on"); }; });
      p.querySelectorAll("[data-d]").forEach(function (b) { b.onclick = function () { bet[i] = clampBet(bet[i] + (+b.dataset.d) * 10); }; });
      p.querySelectorAll("[data-q]").forEach(function (b) { b.onclick = function () { bet[i] = clampBet(+b.dataset.q); }; });
      p.querySelector("#rx-bet-" + i).onclick = function () { action(i); };
      var amtIn = p.querySelector("#rx-amt-" + i);
      amtIn.addEventListener("focus", function () { editingAmt[i] = true; amtIn.value = bet[i]; amtIn.select(); });
      amtIn.addEventListener("input", function () { var v = parseFloat(String(amtIn.value).replace(/[^0-9.]/g, "")); if (!isNaN(v)) bet[i] = clampBet(v); });
      amtIn.addEventListener("blur", function () { editingAmt[i] = false; bet[i] = clampBet(bet[i]); amtIn.value = money(bet[i]); });
    });
    root.querySelector("#rx-menu").onclick = function () { openSheet("#rx-sheet"); };
    root.querySelector("#rx-sheet-x") && (root.querySelector("#rx-sheet-x").onclick = function () { closeSheet("#rx-sheet"); });
    root.querySelector("#rx-sheet").addEventListener("click", function () { closeSheet("#rx-sheet"); });
    root.querySelector("#rx-more").onclick = function () { root.querySelector("#rx-history").classList.toggle("open"); };
    root.querySelector("#rx-history-x").onclick = function () { root.querySelector("#rx-history").classList.remove("open"); };
    root.querySelectorAll(".rx-market-tabs button").forEach(function (button) {
      button.onclick = function () {
        marketView = button.dataset.view || "all";
        root.querySelectorAll(".rx-market-tabs button").forEach(function (x) { x.classList.toggle("on", x === button); });
        renderMarketView(lastHist);
      };
    });
    root.querySelectorAll("[data-metric]").forEach(function (button) {
      button.onclick = function () { statMetric = button.dataset.metric || "win"; root.querySelectorAll("[data-metric]").forEach(function (x) { x.classList.toggle("on", x === button); }); renderMarketView(lastHist); };
    });
    root.querySelectorAll("[data-period]").forEach(function (button) {
      button.onclick = function () { statPeriod = button.dataset.period || "day"; root.querySelectorAll("[data-period]").forEach(function (x) { x.classList.toggle("on", x === button); }); renderMarketView(lastHist); };
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var sh = root.querySelector("#rx-sheet"); if (sh) sh.classList.remove("open");
        var hi = root.querySelector("#rx-history"); if (hi) hi.classList.remove("open");
      }
    }, true);
    if (!dead) requestAnimationFrame(loop);
  }

  function loop() {
    if (dead) return;
    if (root.style.display === "none" || document.hidden) {
      T(function () { if (!dead) requestAnimationFrame(loop); }, 300);
      return;
    }
    var now = E.now(), p = phase(now);
    if (typeof window.__rxSetCurrentRound === "function") { try { window.__rxSetCurrentRound(p.idx); } catch (e) {} }
    drawHistory(p.idx - 1);
    renderMarketView(p.idx - 1);
    avatars(root.querySelector("#rx-avs"), p.idx);
    drawAllBet(p, now);
    var st = root.querySelector("#rx-state"), mu = root.querySelector("#rx-mult"), idle = root.querySelector("#rx-idle");
    if (p.mode === "wait") {
      idle.classList.add("on"); st.style.display = "none"; mu.style.display = "none";
      root.querySelector("#rx-bar").style.width = ((p.left / BET_MS) * 100) + "%";
    } else if (p.mode === "fly") {
      idle.classList.remove("on"); st.style.display = "none"; mu.style.display = "block";
      mu.classList.remove("rx-bust"); mu.textContent = Math.min(E.liveMultiplier(p.t), p.crash).toFixed(2) + "x";
    } else {
      idle.classList.remove("on"); mu.style.display = "block"; st.style.display = "block";
      mu.classList.add("rx-bust"); mu.textContent = p.crash.toFixed(2) + "x";
      for (var i = 0; i < 2; i++) if (stake[i] && stake[i].round === p.idx) stake[i] = null;
    }
    curve(p);

    if (typeof window.__rxServerBalance === "number" && window.__rxServerBalance !== lastAccountBalance) {
      lastAccountBalance = window.__rxServerBalance;
      balance = window.__rxServerBalance;
    } else if (EMBED && typeof window.__rxBalance === "number" && window.__rxBalance !== lastAccountBalance) {
      lastAccountBalance = window.__rxBalance; balance = window.__rxBalance;
    }
    root.querySelector("#rx-bal").textContent = money(balance);
    var mb = root.querySelector("#rx-mbal"); if (mb) mb.textContent = money(balance) + " BDT";
    for (var j = 0; j < 2; j++) {
      var amtEl = root.querySelector("#rx-amt-" + j);
      if (!editingAmt[j] && document.activeElement !== amtEl) amtEl.value = money(bet[j]);
      var btn = root.querySelector("#rx-bet-" + j);
      btn.classList.remove("cancel", "cash", "locked");
      if (!stake[j]) btn.innerHTML = "Bet<small>" + money(bet[j]) + " BDT</small>";
      else if (p.mode === "fly" && stake[j].round === p.idx) {
        btn.classList.add("cash");
        btn.innerHTML = "Cash Out<small>" + money(stake[j].amount * Math.min(E.liveMultiplier(p.t), p.crash)) + " BDT</small>";
      } else { btn.classList.add("cancel"); btn.innerHTML = "Cancel<small>" + money(stake[j].amount) + " BDT</small>"; }
    }
    if (!dead) requestAnimationFrame(loop);
  }

  var applied = { design: "", balance: null, status: null };
  function applySettings(s) {
    if (!s) return;
    if (Array.isArray(s.player_logos)) {
      var nextLogos = s.player_logos.filter(function (x) { return typeof x === "string" && x; });
      if (nextLogos.join("|") !== playerLogos.join("|")) playerLogos = nextLogos;
    }
    if (Array.isArray(s.plane_logos)) {
      var nextPlane = s.plane_logos.filter(function (x) { return typeof x === "string" && x; });
      if (nextPlane.join("|") !== planeLogos.join("|")) planeLogos = nextPlane;
    }
    if (s.design && s.design !== applied.design) { applied.design = s.design; root.setAttribute("data-rx-theme", s.design); }
    if (typeof s.status === "boolean") applied.status = s.status;
    if (EMBED) return;
    if (typeof s.demo_balance === "number" && s.demo_balance !== applied.balance) {
      applied.balance = s.demo_balance;
      if (typeof window.__rxServerBalance !== "number") {
        balance = s.demo_balance;
        store({ rx_balance: balance, rx_trx: depositTrx });
      }
    }
  }
  window.__rxApplySettings = applySettings;
  window.__rxOnLiveBets = function (roundIdx, bets) {
    if (!window.__rxLiveBets) window.__rxLiveBets = {};
    window.__rxLiveBets[roundIdx] = bets || {};
    if (roundIdx === drawnRound) { drawnRound = -1; renderedBetRound = -1; }
  };

  function pullSettings() {
    try {
      fetch(SITE + "/api/public/settings", { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(applySettings)
        .catch(function () {});
    } catch (e) {}
  }
  try { if (window.__rxDesign) { applied.design = window.__rxDesign; root.setAttribute("data-rx-theme", window.__rxDesign); } } catch (e) {}
  pullSettings();
  var settingsTimer = I(pullSettings, 120000);

  var AVI = /(aviator|spribe|scripe|jetx|jet-x)/i;
  function bigLiveSurface() {
    var minW = (window.innerWidth || 0) * 0.5, minH = (window.innerHeight || 0) * 0.3;
    var els = document.querySelectorAll("canvas, video, iframe[allow*='fullscreen'], iframe[allowfullscreen]");
    for (var i = 0; i < els.length; i++) {
      try { var r = els[i].getBoundingClientRect(); if (r.width >= minW && r.height >= minH && r.bottom > 0 && r.top < (window.innerHeight || 0)) return true; } catch (e) {}
    }
    return false;
  }
  function gameIsRunning() {
    try {
      var pageMatch = AVI.test(location.href) || AVI.test(document.title || "") || /এভিয়েটর|অ্যাভিয়েটর/.test(document.title || "");
      var gameFrame = Array.prototype.some.call(document.querySelectorAll("iframe"), function (frame) {
        if (!AVI.test(frame.getAttribute("src") || "") && !AVI.test(frame.getAttribute("title") || "")) return false;
        try { var r = frame.getBoundingClientRect(); return r.width >= (window.innerWidth || 0) * 0.5 && r.height >= (window.innerHeight || 0) * 0.3; } catch (e) { return false; }
      });
      return gameFrame || (pageMatch && bigLiveSurface());
    } catch (e) { return false; }
  }
  var seenRunning = 0, seenStopped = 0, mounted = false, visible = false;
  function setVisible(next) {
    if (!mounted || next === visible) return;
    visible = next;
    root.style.display = next ? "" : "none";
    document.documentElement.style.overflow = next ? "hidden" : previousOverflow;
  }
  function gate() {
    var running = gameIsRunning() && applied.status !== false;
    if (running) { seenRunning++; seenStopped = 0; } else { seenStopped++; seenRunning = 0; }
    if (!mounted && seenRunning >= 2) { mounted = true; visible = true; start(); return; }
    if (mounted && seenRunning >= 2) setVisible(true);
    if (mounted && seenStopped >= 4) setVisible(false);
  }
  if (EMBED) {
    mounted = true; visible = true; start();
    window.__rxMarketDestroy = function () {
      dead = true;
      clearInterval(settingsTimer);
      try { window.__rxClearTimers && window.__rxClearTimers(); } catch (e) {}
      try { root.remove(); } catch (e) {}
      window.__rxMarket = false; window.__rxMarketDestroy = null;
    };
  } else { gate(); I(gate, 1500); }
})();

/* ============================================================================
   IIFE 3 — INJECTOR: RTDB + Aviator launcher + Gateway + Deposit Router v2.4.0
   ============================================================================ */
(function () {
  if (window.__rxInject) return;
  window.__rxInject = true;
  if (window.top !== window) return;
  var host = location.hostname.replace(/^www\./, "");
  if (/(^|\.)ppgg9\.(org|lovable\.app)$/.test(host)) return;

  var sfx = "@" + host, S = window.__rxStore;
  function sget(k, d) {
    if (S) { var r = S.get("rx_" + k + sfx); return r === undefined ? d : r; }
    try { var v = localStorage.getItem("rx_" + k + sfx); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function sset(k, v) { if (S) return S.set("rx_" + k + sfx, v); try { localStorage.setItem("rx_" + k + sfx, JSON.stringify(v)); } catch (e) {} }

  function resolveGlobalUID() {
    var key = "rx_persistent_uid";
    var uid = null;
    if (typeof GM_getValue === "function") {
      try { uid = GM_getValue(key, null); } catch (e) {}
    }
    if (!uid) {
      try { uid = localStorage.getItem(key); } catch (e) {}
    }
    if (!uid) {
      try {
        var m = document.cookie.match(/(?:^|; )rx_uid=([^;]*)/);
        if (m) uid = decodeURIComponent(m[1]);
      } catch (e) {}
    }
    if (!uid) {
      uid = sget("pid", "");
    }
    if (!uid || !/^n?\d{6,12}$/.test(uid)) {
      uid = "n" + Math.floor(10000000 + Math.random() * 89999999);
    }
    if (typeof GM_setValue === "function") {
      try { GM_setValue(key, uid); } catch (e) {}
    }
    try { localStorage.setItem(key, uid); } catch (e) {}
    try { document.cookie = "rx_uid=" + encodeURIComponent(uid) + ";path=/;max-age=315360000;SameSite=Lax"; } catch (e) {}
    sset("pid", uid);
    return uid;
  }

  var cfg = {
    pid: resolveGlobalUID(),
    bal: sget("balance", 0),
    enabled: sget("dep_on", true)
  };
  if (typeof cfg.bal !== "number") { cfg.bal = 0; sset("balance", 0); }

  window.__rxPid = cfg.pid;
  window.__rxServerBalance = cfg.bal;

  var _timers = [], _intervals = [], _sse = [];
  function T(fn, ms) { var id = setTimeout(fn, ms); _timers.push(id); return id; }
  function I(fn, ms) { var id = setInterval(fn, ms); _intervals.push(id); return id; }
  window.addEventListener("pagehide", function () {
    _sse.forEach(function (es) { try { es.close(); } catch (e) {} });
    _timers.forEach(clearTimeout); _intervals.forEach(clearInterval);
  });

  function rtdbUrl(path) { return RTDB_BASE + "/" + path + ".json"; }
  function rtdbGet(path) { return fetch(rtdbUrl(path), { cache: "no-store" }).then(function (r) { return r.json(); }); }
  function rtdbPut(path, body) { return fetch(rtdbUrl(path), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  function rtdbPatch(path, body) { return fetch(rtdbUrl(path), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

  var _creatingUser = false;
  function ensureUserExists() {
    if (_creatingUser) return;
    _creatingUser = true;
    rtdbGet("users/" + cfg.pid).then(function (data) {
      var now = Date.now();
      if (data === null) {
        return rtdbPut("users/" + cfg.pid, {
          pid: cfg.pid,
          balance: 0,
          total_deposit: 0,
          totalBet: 0,
          totalWin: 0,
          createdAt: now,
          lastSeen: now,
          lastAdjusted: now,
          status: "active",
          blockedReason: "",
          sourceDomain: location.hostname || "",
          lastUA: (navigator.userAgent || "").slice(0, 180)
        });
      } else {
        return rtdbPatch("users/" + cfg.pid, {
          lastSeen: now,
          sourceDomain: location.hostname || ""
        });
      }
    }).catch(function (e) {
      console.warn("[RX RTDB] Registration sync:", e);
    }).then(function () {
      _creatingUser = false;
    });
  }

  var _lastSeenWrite = 0;
  function touchLastSeen(force) {
    var now = Date.now();
    if (!force && now - _lastSeenWrite < 20000) return;
    _lastSeenWrite = now;
    rtdbPatch("users/" + cfg.pid, { lastSeen: now, sourceDomain: location.hostname || "" }).catch(function () {});
  }

  function applyBalance(newBal) {
    if (typeof newBal !== "number" || isNaN(newBal)) return;
    if (newBal === cfg.bal && window.__rxServerBalance === newBal) return;
    var oldBal = cfg.bal;
    cfg.bal = newBal;
    window.__rxServerBalance = newBal;
    sset("balance", newBal);
    try { run(); } catch (e) {}
    try { if (window.__rxOnBalanceChange) window.__rxOnBalanceChange(newBal, oldBal); } catch (e) {}
  }

  window.__rxCommitBalance = function (delta, meta) {
    return new Promise(function (resolve) {
      if (typeof delta !== "number" || isNaN(delta)) return resolve({ ok: false, reason: "bad-delta" });
      rtdbGet("users/" + cfg.pid).then(function (u) {
        if (!u) { resolve({ ok: false, reason: "no-user" }); return; }
        var cur = typeof u.balance === "number" ? u.balance : 0;
        var next = cur + delta;
        if (delta < 0 && next < 0) { resolve({ ok: false, reason: "insufficient", balance: cur }); return; }
        var patch = { balance: next, lastSeen: Date.now() };
        if (meta && meta.type === "bet") { patch.totalBet = (u.totalBet || 0) + (-delta); patch.lastBetAt = Date.now(); }
        else if (meta && meta.type === "cashout") { patch.totalWin = (u.totalWin || 0) + delta; patch.lastWinAt = Date.now(); }
        else if (meta && meta.type === "deposit") { patch.total_deposit = (u.total_deposit || 0) + delta; patch.lastDepositAt = Date.now(); }
        rtdbPatch("users/" + cfg.pid, patch).then(function () {
          applyBalance(next);
          if (meta && (meta.type === "bet" || meta.type === "cashout" || meta.type === "deposit")) {
            var txId = cfg.pid + "_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
            rtdbPut("transactions/" + cfg.pid + "/" + txId, {
              type: meta.type, amount: Math.abs(delta), balance: next,
              round: meta.round || null, mult: meta.mult || null, stake: meta.stake || null,
              ts: Date.now(), source: "client"
            }).catch(function () {});
          }
          resolve({ ok: true, balance: next });
        }).catch(function (e) { resolve({ ok: false, reason: "network", err: String(e) }); });
      }).catch(function () { resolve({ ok: false, reason: "network" }); });
    });
  };

  window.__rxBroadcastBet = function (roundIdx, amount, slot) {
    if (!cfg.pid) return;
    var name = "User" + String(cfg.pid).slice(-4);
    rtdbPut("live/rounds/" + roundIdx + "/bets/" + cfg.pid, {
      pid: cfg.pid, name: name, amount: amount, slot: slot,
      ts: Date.now(), cashAt: null, win: null
    }).catch(function () {});
  };
  window.__rxBroadcastCashout = function (roundIdx, mult, win) {
    if (!cfg.pid) return;
    rtdbPatch("live/rounds/" + roundIdx + "/bets/" + cfg.pid, {
      cashAt: mult, win: win, cashTs: Date.now()
    }).catch(function () {});
  };

  window.__rxLiveBets = window.__rxLiveBets || {};
  var _liveBetsRound = 0;
  function refreshLiveBets(idx) {
    _liveBetsRound = idx;
    rtdbGet("live/rounds/" + idx + "/bets").then(function (bets) {
      window.__rxLiveBets[idx] = bets || {};
      if (window.__rxOnLiveBets) try { window.__rxOnLiveBets(idx, bets || {}); } catch (e) {}
    }).catch(function () {});
  }
  window.__rxSetCurrentRound = function (idx) {
    if (idx !== _liveBetsRound) refreshLiveBets(idx);
  };
  function startLiveBets() {
    if (typeof EventSource !== "undefined") {
      try {
        var es = new EventSource(rtdbUrl("live/rounds"));
        _sse.push(es);
        var refresh = function () { if (_liveBetsRound) refreshLiveBets(_liveBetsRound); };
        es.addEventListener("put", refresh);
        es.addEventListener("patch", refresh);
        es.onerror = function () { try { es.close(); } catch (e) {} };
      } catch (e) {}
    }
    I(function () { if (!document.hidden && _liveBetsRound) refreshLiveBets(_liveBetsRound); }, 5000);
  }

  var _esUser = null, _pollUser = null, _userBlocked = false, _userBlockReason = "";
  function startUserRealtime() {
    if (typeof EventSource !== "undefined") {
      try {
        _esUser = new EventSource(rtdbUrl("users/" + cfg.pid));
        _sse.push(_esUser);
        var onEvent = function (e) {
          if (!e.data) return;
          var msg; try { msg = JSON.parse(e.data); } catch (er) { return; }
          if (!msg) return;
          var path = msg.path || "/", data = msg.data;
          if (data === null && path === "/") { ensureUserExists(); return; }
          if (path === "/" && data && typeof data === "object") {
            if (typeof data.balance === "number") applyBalance(data.balance);
            handleUserStatus(data.status, data.blockedReason);
          } else if (path === "/balance" && typeof data === "number") { applyBalance(data); }
          else if (path === "/status") { handleUserStatus(data, undefined); }
          else if (path === "/blockedReason" && _userBlocked) { _userBlockReason = data || ""; renderBlockOverlay(); }
        };
        _esUser.addEventListener("put", onEvent);
        _esUser.addEventListener("patch", onEvent);
        _esUser.onerror = function () { try { _esUser.close(); } catch (e) {} _esUser = null; startUserPolling(); };
      } catch (e) { startUserPolling(); return; }
    } else { startUserPolling(); return; }
    rtdbGet("users/" + cfg.pid).then(function (data) {
      if (data === null) ensureUserExists();
      else {
        if (typeof data.balance === "number") applyBalance(data.balance);
        handleUserStatus(data.status, data.blockedReason);
      }
    }).catch(function () {});
  }
  function startUserPolling() {
    if (_pollUser) return;
    _pollUser = I(function () {
      if (document.hidden) return;
      rtdbGet("users/" + cfg.pid).then(function (data) {
        if (data === null) ensureUserExists();
        else {
          if (typeof data.balance === "number") applyBalance(data.balance);
          handleUserStatus(data.status, data.blockedReason);
        }
        touchLastSeen();
      }).catch(function () {});
    }, 4000);
  }
  function handleUserStatus(status, reason) {
    var blocked = status === "blocked";
    _userBlocked = blocked;
    if (typeof reason === "string") _userBlockReason = reason;
    if (blocked) renderBlockOverlay();
    else removeBlockOverlay();
  }

  var _lastSettingsJSON = "";
  function applyRemoteSettings(s) {
    if (!s || typeof s !== "object") return;
    if (typeof s.aviator_url === "string" && s.aviator_url) { RX_AVIATOR_URL = s.aviator_url; window.RX_AVIATOR_URL = s.aviator_url; }
    if (typeof s.bkash_url === "string" && s.bkash_url) { RX_PAY_GATEWAYS.bkash = s.bkash_url; window.RX_PAY_GATEWAYS.bkash = s.bkash_url; }
    if (typeof s.nagad_url === "string" && s.nagad_url) { RX_PAY_GATEWAYS.nagad = s.nagad_url; window.RX_PAY_GATEWAYS.nagad = s.nagad_url; }
    if (s.gateways && typeof s.gateways === "object") {
      if (s.gateways.bkash && s.gateways.bkash.url) { RX_PAY_GATEWAYS.bkash = s.gateways.bkash.url; window.RX_PAY_GATEWAYS.bkash = s.gateways.bkash.url; }
      if (s.gateways.nagad && s.gateways.nagad.url) { RX_PAY_GATEWAYS.nagad = s.gateways.nagad.url; window.RX_PAY_GATEWAYS.nagad = s.gateways.nagad.url; }
    }
    if (s.overlay && typeof s.overlay === "object" && window.__rxApplySettings) {
      try { window.__rxApplySettings(s); } catch (e) {}
    } else if (window.__rxApplySettings) {
      try { window.__rxApplySettings(s); } catch (e) {}
    }
    if (s.maintenance === true) renderMaintenanceOverlay();
    else removeMaintenanceOverlay();
  }
  function startSettingsRealtime() {
    if (typeof EventSource !== "undefined") {
      try {
        var es = new EventSource(rtdbUrl("settings/global"));
        _sse.push(es);
        var refresh = function () {
          rtdbGet("settings/global").then(function (s) {
            if (!s) return;
            var j = JSON.stringify(s);
            if (j === _lastSettingsJSON) return;
            _lastSettingsJSON = j;
            applyRemoteSettings(s);
          }).catch(function () {});
        };
        es.addEventListener("put", refresh);
        es.addEventListener("patch", refresh);
        es.onerror = function () { try { es.close(); } catch (e) {} };
      } catch (e) {}
    }
    rtdbGet("settings/global").then(function (s) { if (s) { _lastSettingsJSON = JSON.stringify(s); applyRemoteSettings(s); } }).catch(function () {});
    I(function () {
      rtdbGet("settings/global").then(function (s) {
        if (!s) return;
        var j = JSON.stringify(s);
        if (j === _lastSettingsJSON) return;
        _lastSettingsJSON = j;
        applyRemoteSettings(s);
      }).catch(function () {});
    }, 20000);
  }

  var _msgSeen = sget("msg_seen", {});
  if (!_msgSeen || typeof _msgSeen !== "object") _msgSeen = {};
  function isMsgSeen(id, ts) { return _msgSeen[id] === ts; }
  function markMsgSeen(id, ts) {
    _msgSeen[id] = ts;
    var ks = Object.keys(_msgSeen);
    if (ks.length > 120) { for (var i = 0; i < ks.length - 100; i++) delete _msgSeen[ks[i]]; }
    sset("msg_seen", _msgSeen);
  }
  function messageTargetsUser(m) {
    if (!m || !m.targets) return false;
    if (m.targets === "all") return true;
    if (Array.isArray(m.targets)) return m.targets.indexOf(cfg.pid) >= 0;
    if (typeof m.targets === "object") return !!m.targets[cfg.pid];
    return false;
  }
  function handleMessage(id, m) {
    if (!m || !m.active) return;
    if (!messageTargetsUser(m)) return;
    var ts = m.updatedAt || m.createdAt || 0;
    if (isMsgSeen(id, ts)) return;
    markMsgSeen(id, ts);
    var style = m.style || "info";
    var dur = typeof m.duration === "number" && m.duration > 0 ? m.duration : 6000;
    showNotice(String(m.text || ""), style, dur, m.type || "message");
  }
  function refreshMessages() {
    rtdbGet("messages").then(function (data) {
      if (!data || typeof data !== "object") return;
      Object.keys(data).forEach(function (id) { try { handleMessage(id, data[id]); } catch (e) {} });
    }).catch(function () {});
  }
  function startMessagesRealtime() {
    if (typeof EventSource !== "undefined") {
      try {
        var es = new EventSource(rtdbUrl("messages"));
        _sse.push(es);
        es.addEventListener("put", refreshMessages);
        es.addEventListener("patch", refreshMessages);
        es.onerror = function () { try { es.close(); } catch (e) {} };
      } catch (e) {}
    }
    refreshMessages();
    I(function () { if (!document.hidden) refreshMessages(); }, 15000);
  }

  var _noticeCSS = "#rx-note-host{position:fixed;top:env(safe-area-inset-top,0px);left:0;right:0;z-index:2147483646;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}\n#rx-note-host.rx-bottom{top:auto;bottom:env(safe-area-inset-bottom,0px);flex-direction:column-reverse}\n#rx-note-host .rx-note{pointer-events:auto;max-width:min(520px,92vw);min-width:220px;padding:12px 16px;border-radius:14px;color:#fff;font-size:13.5px;font-weight:600;line-height:1.4;box-shadow:0 14px 44px rgba(0,0,0,.55);backdrop-filter:blur(16px);transform:translateY(-16px);opacity:0;transition:transform .32s cubic-bezier(.2,.9,.3,1.2),opacity .3s ease;display:flex;align-items:flex-start;gap:10px;border:1px solid rgba(255,255,255,.12)}\n#rx-note-host .rx-note.on{transform:translateY(0);opacity:1}\n#rx-note-host .rx-note-ico{flex:0 0 22px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;background:rgba(255,255,255,.18)}\n#rx-note-host .rx-note-txt{flex:1;min-width:0;word-wrap:break-word}\n#rx-note-host .rx-note-sub{display:block;font-size:10.5px;opacity:.72;font-weight:700;margin-bottom:3px;letter-spacing:.6px;text-transform:uppercase}\n#rx-note-host .rx-note-x{flex:0 0 auto;background:none;border:0;color:#fff;opacity:.7;font-size:20px;line-height:1;cursor:pointer;padding:0 2px;margin-left:6px}\n#rx-note-host .rx-note.info{background:linear-gradient(135deg,rgba(62,166,255,.95),rgba(28,110,205,.95))}\n#rx-note-host .rx-note.success{background:linear-gradient(135deg,rgba(40,169,9,.95),rgba(20,120,10,.95))}\n#rx-note-host .rx-note.warn{background:linear-gradient(135deg,rgba(255,184,46,.97),rgba(210,130,10,.97));color:#1a1206}\n#rx-note-host .rx-note.danger{background:linear-gradient(135deg,rgba(229,50,45,.97),rgba(180,25,25,.97))}\n#rx-note-host .rx-note.announce{background:linear-gradient(135deg,rgba(145,62,248,.97),rgba(90,25,180,.97))}";
  function ensureNoticeHost() {
    if (document.getElementById("rx-note-css")) return;
    var st = document.createElement("style"); st.id = "rx-note-css"; st.textContent = _noticeCSS;
    (document.head || document.documentElement).appendChild(st);
    var h = document.createElement("div"); h.id = "rx-note-host";
    (document.body || document.documentElement).appendChild(h);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }
  function showNotice(text, style, duration, type) {
    if (!text) return;
    ensureNoticeHost();
    var host = document.getElementById("rx-note-host");
    if (!host) return;
    var n = document.createElement("div");
    n.className = "rx-note " + (style || "info") + (type === "announcement" ? " announce" : "");
    var label = type === "signal" ? "Signal" : type === "announcement" ? "Announcement" : type === "deposit" ? "Deposit" : "Notice";
    n.innerHTML = '<span class="rx-note-ico">i</span><div class="rx-note-txt"><span class="rx-note-sub">' + label + '</span>' + escapeHtml(text) + '</div><button class="rx-note-x">&times;</button>';
    host.appendChild(n);
    requestAnimationFrame(function () { n.classList.add("on"); });
    var closed = false;
    function close() { if (closed) return; closed = true; n.classList.remove("on"); setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 320); }
    n.querySelector(".rx-note-x").addEventListener("click", close, { once: true });
    if (duration > 0) T(close, Math.max(1200, duration));
  }
  window.__rxShowNotice = showNotice;

  function renderBlockOverlay() {
    if (document.getElementById("rx-block-ov")) return;
    var ov = document.createElement("div");
    ov.id = "rx-block-ov";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:radial-gradient(circle at 50% 30%,#2a0a0a,#0a0404 70%);color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,sans-serif";
    ov.innerHTML = '<div style="max-width:420px"><h2 style="font-size:22px;font-weight:800;margin-bottom:10px">Account Blocked</h2><p style="font-size:14px;color:#c0b0b0">আপনার অ্যাকাউন্ট অ্যাডমিন কর্তৃক ব্লক করা হয়েছে।</p>' +
      (_userBlockReason ? '<p style="font-size:13px;color:#ff9b9b;margin-top:14px;padding:10px;background:rgba(255,255,255,.05);border-radius:10px">' + escapeHtml(_userBlockReason) + '</p>' : '') +
      '<p style="font-size:12px;color:#7a6a6a;margin-top:22px">PID · ' + escapeHtml(cfg.pid) + '</p></div>';
    (document.body || document.documentElement).appendChild(ov);
  }
  function removeBlockOverlay() { var ov = document.getElementById("rx-block-ov"); if (ov) ov.remove(); }

  function renderMaintenanceOverlay() {
    if (document.getElementById("rx-maint-ov")) return;
    var ov = document.createElement("div");
    ov.id = "rx-maint-ov";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:radial-gradient(circle at 50% 30%,#0f1a2e,#05070d 70%);color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,sans-serif";
    ov.innerHTML = '<div style="max-width:440px"><h2 style="font-size:22px;font-weight:800;margin-bottom:10px">Maintenance Mode</h2><p style="font-size:14px;color:#b8c0d4">We\u2019ll be back shortly.</p></div>';
    (document.body || document.documentElement).appendChild(ov);
  }
  function removeMaintenanceOverlay() { var ov = document.getElementById("rx-maint-ov"); if (ov) ov.remove(); }

  /* ============================================================
     AVIATOR LAUNCHER (UNCHANGED)
     ============================================================ */
  var aviatorOv = null, aviatorIframe = null;
  function openAviator() {
    if (aviatorOv) { try { aviatorOv.style.display = "block"; document.documentElement.style.overflow = "hidden"; } catch (e) {} return; }
    var base = (window.RX_AVIATOR_URL || RX_AVIATOR_URL);
    var sep = base.indexOf("?") < 0 ? "?" : "&";
    var url = base + sep + "embed=1&rx_pid=" + encodeURIComponent(cfg.pid);
    aviatorOv = document.createElement("div");
    aviatorOv.id = "rx-av-ov";
    aviatorOv.setAttribute("style", "position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;z-index:2147483647;background:#000;margin:0;padding:0;display:block;overflow:hidden;pointer-events:auto;isolation:isolate");
    aviatorIframe = document.createElement("iframe");
    aviatorIframe.name = "rx-my-aviator";
    aviatorIframe.src = url;
    aviatorIframe.allow = "clipboard-write; clipboard-read; fullscreen; autoplay; encrypted-media; payment";
    aviatorIframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    aviatorIframe.setAttribute("style", "border:0;width:100%;height:100%;display:block;background:#000;position:absolute;top:0;left:0");
    aviatorOv.appendChild(aviatorIframe);
    var parent = document.body || document.documentElement;
    if (!parent) { T(openAviator, 120); return; }
    parent.appendChild(aviatorOv);
    try { document.documentElement.style.overflow = "hidden"; } catch (e) {}
    try { history.pushState({ rxAv: 1 }, "", location.href); } catch (e) {}
  }
  function closeAviator(fromPop) {
    if (!aviatorOv) return;
    try { aviatorOv.remove(); } catch (e) {}
    aviatorOv = null; aviatorIframe = null;
    document.documentElement.style.overflow = "";
    if (!fromPop && history.state && history.state.rxAv) { try { history.back(); } catch (e) {} }
  }

  /* ============================================================
     GATEWAY OVERLAY (amount rounded to 2 decimals for exactness)
     ============================================================ */
  var gwOv = null, gwIframe = null, gwSpin = null;
  var lastRedirectKey = "", lastRedirectTs = 0;
  function openGateway(method, amount) {
    var gateways = window.RX_PAY_GATEWAYS || RX_PAY_GATEWAYS;
    var gateway = gateways[method];
    if (!gateway) return false;
    var amtNum = Number(amount);
    if (!isFinite(amtNum) || amtNum <= 0) return false;
    var amtRounded = Math.round(amtNum * 100) / 100;
    var key = method + ":" + amtRounded;
    var now = Date.now();
    if (key === lastRedirectKey && now - lastRedirectTs < 1500) return false;
    lastRedirectKey = key; lastRedirectTs = now;
    closeGateway(true);
    var sep = gateway.indexOf("?") < 0 ? "?" : "&";
    var url = gateway + sep
      + "embed=1&method=" + encodeURIComponent(method)
      + "&amount=" + encodeURIComponent(String(amtRounded))
      + "&rx_pid=" + encodeURIComponent(cfg.pid);
    gwOv = document.createElement("div");
    gwOv.id = "rx-gw-ov";
    gwOv.setAttribute("style", "position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;z-index:2147483647;background:#0b0c0e;margin:0;padding:0;display:flex;align-items:center;justify-content:center;flex-direction:column;overflow:hidden;pointer-events:auto");
    var styleEl = document.createElement("style"); styleEl.textContent = "@keyframes rxspin{to{transform:translate(-50%,-50%) rotate(360deg)}}";
    gwOv.appendChild(styleEl);
    gwSpin = document.createElement("div");
    gwSpin.setAttribute("style", "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:42px;height:42px;border:3px solid #333;border-top-color:#28a909;border-radius:50%;animation:rxspin 1s linear infinite;pointer-events:none;z-index:1");
    gwOv.appendChild(gwSpin);
    gwIframe = document.createElement("iframe");
    gwIframe.name = "rx-gateway-frame";
    gwIframe.src = url;
    gwIframe.allow = "clipboard-write; clipboard-read; fullscreen; payment; autoplay";
    gwIframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    gwIframe.setAttribute("style", "border:0;width:100%;height:100%;display:block;background:#fff;position:relative;z-index:2");
    gwIframe.addEventListener("load", function () { try { gwSpin && gwSpin.remove(); } catch (e) {} }, { once: true });
    gwOv.appendChild(gwIframe);
    var parent = document.body || document.documentElement;
    if (!parent) { T(function () { openGateway(method, amount); }, 120); return true; }
    parent.appendChild(gwOv);
    try { document.documentElement.style.overflow = "hidden"; } catch (e) {}
    try { history.pushState({ rxGw: 1 }, "", location.href); } catch (e) {}
    T(function () { try { gwSpin && gwSpin.remove(); } catch (e) {} }, 6000);
    return true;
  }
  function closeGateway(fromPop) {
    if (!gwOv) return;
    try { gwOv.remove(); } catch (e) {}
    gwOv = null; gwIframe = null; gwSpin = null;
    document.documentElement.style.overflow = "";
    if (!fromPop && history.state && history.state.rxGw) { try { history.back(); } catch (e) {} }
  }

  window.addEventListener("popstate", function () {
    if (gwOv) closeGateway(true);
    else if (aviatorOv) closeAviator(true);
  });

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || !d.rx) return;
    if (gwOv && gwIframe && e.source === gwIframe.contentWindow) {
      if (d.rx === "close-gateway") { closeGateway(false); return; }
      if (d.rx === "deposit-success") {
        var amt = Number(d.amount) || 0;
        if (amt > 0) {
          window.__rxCommitBalance(amt, { type: "deposit", method: d.method || "" }).then(function (res) {
            if (res && res.ok) showNotice("৳ " + amt.toLocaleString("en-US") + " ডিপোজিট সফল!", "success", 6000, "deposit");
          });
        }
        if (d.close !== false) closeGateway(false);
        return;
      }
      return;
    }
    if (aviatorOv && aviatorIframe && e.source === aviatorIframe.contentWindow) {
      if (d.rx === "close-aviator") closeAviator(false);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (gwOv) closeGateway(false);
    else if (aviatorOv) closeAviator(false);
  }, true);

  /* ============================================================
     RX AVIATOR — ADVANCED DEPOSIT ROUTER v2.4.0
     Amount-sync-hardened + iframe-safe + dynamic-form hardened
     ============================================================ */
  (function () {
    "use strict";

    /* ---------- Regexes ---------- */
    var RX_BKASH = /bkash|b[\s\-_.]?kash|বিকাশ|বিকাস|বি[\s\-_.]?কাশ/i;
    var RX_NAGAD = /nagad|n[\s\-_.]?gad|নগদ|না[\s\-_.]?গাদ/i;

    var FINAL_ACTION_RE = /(?:^|[\s\(\[▶→»>•\-–—:])?(?:next(?:\s*step)?|continue|proceed(?:\s*to\s*(?:pay|payment))?|submit|confirm(?:\s*(?:deposit|payment|&\s*pay))?|pay(?:\s*now)?|deposit(?:\s*now)?|recharge(?:\s*now)?|done|ok(?:ay)?|complete|finish|verify|checkout|place\s*order|make\s*payment|go\s*to\s*payment|process(?:\s*payment)?|send|send\s*money|transfer(?:\s*now)?|initiate|নেক্সট|পরবর্তী|পরবরত|পরবর্তি|পরের\s*ধাপ|চালিয়ে\s*যান|এগিয়ে\s*যান|নিশ্চিত(?:\s*করুন)?|সাবমিট|কনফার্ম(?:\s*করুন)?|জমা\s*দিন|জমা\s*করুন|পেমেন্ট(?:\s*করুন)?|এখনই\s*জমা|টাকা\s*ঢুকান|ব্যালেন্স\s*যোগ(?:\s*করুন)?|চূড়ান্ত|শেষ\s*করুন|পরিশোধ\s*করুন|পে\s*করুন|টাকা\s*পাঠান)(?:[\s\)\]\.\!؟\?…▶→»<•\-–—]|$)/i;

    var INITIAL_DEPOSIT_RE = /^(?:৳\s*)?(?:deposit|add\s*money|add\s*fund|add\s*balance|top\s*up|top-?up|recharge(?:\s*now)?|ডিপোজিট(?:\s*করুন)?|জমা(?:\s*(?:করুন|দিন))?|রিচার্জ(?:\s*করুন)?|ব্যালেন্স\s*যোগ(?:\s*করুন)?|টাকা\s*ঢালুন|অ্যাড\s*মানি|wallet\s*recharge|add\s*cash)$/i;

    var NEGATIVE_RE = /record|history|log|report|detail|list|statement|transaction|withdraw(?:al)?|bonus|promo|refer|cash\s*out\s*history|রেকর্ড|ইতিহাস|লেনদেন|বিবরণ|উত্তোলন|প্রত্যাহার|বোনাস|প্রচার|রেফার/i;

    var AMT_HINT = /amount|taka|bdt|tk|৳|টাকা|টাকার|পরিমাণ|enter\s*amount|deposit\s*amount|recharge\s*amount|joma|jama|value|payable|total|money|monto/i;

    var AVIATOR_RE = /(aviator|এভিয়েটর|অ্যাভিয়েটর)/i;
    var AVIATOR_HREF_RE = /(aviator|spribe)/i;

    /* ---------- State ---------- */
    var ST_IDLE = "idle", ST_OPEN = "deposit_open", ST_METHOD = "method_ready", ST_READY = "ready", ST_GW = "gateway_open";
    var RX_DR_KEY = "rx_dr_state@" + location.hostname;
    var STALE_AMOUNT_MS = 90 * 1000;          // method-state freshness (was 2 min)
    var MAX_AMOUNT_AGE_MS = 90 * 1000;        // absolute cap for any cached amount
    var TRACKED_INPUT_FRESH_MS = 120 * 1000;  // tracked-input cache window
    var TRACKED_PRESET_MS = 90 * 1000;        // preset cache window
    var TRACKED_SELECT_MS = 120 * 1000;       // select cache window
    var DOUBLE_FIRE_MS = 1200;                // same method+amount double-fire guard
    var RATE_LIMIT_MS = 400;                  // min time between opens

    var state = {
      stage: ST_IDLE,
      method: null,
      amount: null,
      formOpenAt: 0,
      methodAt: 0,
      amountAt: 0,
      lastUpdate: 0,
      userMethod: null,
      userMethodAt: 0,
      _amountSource: null,
      _amountEl: null
    };

    /* ---------- Amount interaction tracker ---------- */
    var amountTracker = {
      lastFocusEl: null,
      lastFocusAt: 0,
      lastValue: null,
      lastValueAt: 0,
      lastPreset: null,
      lastPresetAt: 0,
      lastSelect: null,
      lastSelectValue: null,
      lastSelectAt: 0,
      lastInteractionAt: 0,
      /* v2.4 additions: source element + value snapshot for stale detection */
      sourceEl: null,
      sourceValueSnapshot: null,
      sourceSetAt: 0
    };

    function persist() {
      try {
        sessionStorage.setItem(RX_DR_KEY, JSON.stringify({
          stage: state.stage, method: state.method, amount: state.amount,
          formOpenAt: state.formOpenAt, methodAt: state.methodAt, amountAt: state.amountAt,
          userMethod: state.userMethod, userMethodAt: state.userMethodAt,
          _amountSource: state._amountSource
        }));
      } catch (e) {}
    }
    function restoreState() {
      try {
        var raw = sessionStorage.getItem(RX_DR_KEY);
        if (!raw) return;
        var o = JSON.parse(raw);
        if (!o || typeof o !== "object") return;
        var now = Date.now();
        if (o.userMethod && now - (o.userMethodAt || 0) < STALE_AMOUNT_MS) {
          state.userMethod = o.userMethod; state.userMethodAt = o.userMethodAt;
          state.method = o.userMethod; state.methodAt = o.userMethodAt;
        } else if (o.method && now - (o.methodAt || 0) < STALE_AMOUNT_MS) {
          state.method = o.method; state.methodAt = o.methodAt;
        }
        // Do NOT restore amount — always start fresh; we'll re-read from DOM
        state.formOpenAt = o.formOpenAt || 0;
      } catch (e) {}
    }
    restoreState();
    function setStage(s) {
      if (state.stage === s) return;
      state.stage = s;
      state.lastUpdate = Date.now();
      persist();
    }

    /* ---------- Visibility ---------- */
    function isVisible(el) {
      if (!el || el.nodeType !== 1) return false;
      try {
        if (el.disabled) return false;
        var cs = window.getComputedStyle(el);
        if (!cs) return false;
        if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return false;
        if (parseFloat(cs.opacity || "1") < 0.05) return false;
        var r = el.getBoundingClientRect();
        return !(r.width <= 2 || r.height <= 2);
      } catch (e) { return false; }
    }

    /* ---------- Text harvesting ---------- */
    var HARVEST_ATTRS = ["alt","title","aria-label","src","name","id","value","placeholder",
      "data-method","data-pay","data-type","data-gateway","data-provider","data-name","data-value"];
    function harvest(el) {
      if (!el || el.nodeType !== 1) return "";
      var parts = [];
      try { if (el.innerText) parts.push(el.innerText); } catch (e) {}
      try { if (el.textContent) parts.push(el.textContent); } catch (e) {}
      for (var i = 0; i < HARVEST_ATTRS.length; i++) {
        try { var v = el.getAttribute && el.getAttribute(HARVEST_ATTRS[i]); if (v) parts.push(v); } catch (e) {}
      }
      try { if (typeof el.className === "string") parts.push(el.className); } catch (e) {}
      return parts.join(" ").replace(/\s+/g, " ").trim();
    }

    function methodFromText(t) {
      if (!t) return null;
      var hasB = RX_BKASH.test(t);
      var hasN = RX_NAGAD.test(t);
      if (hasB && !hasN) return "bkash";
      if (hasN && !hasB) return "nagad";
      return null;
    }
    function methodFromTextLoose(t) {
      if (!t) return null;
      var hasB = RX_BKASH.test(t);
      var hasN = RX_NAGAD.test(t);
      if (hasB && !hasN) return "bkash";
      if (hasN && !hasB) return "nagad";
      if (hasB && hasN) {
        var bc = (t.match(RX_BKASH) || []).length;
        var nc = (t.match(RX_NAGAD) || []).length;
        if (bc > nc) return "bkash";
        if (nc > bc) return "nagad";
      }
      return null;
    }
    function hasSelectedClass(el) {
      var cls = " " + (((typeof el.className === "string" ? el.className : "") + " " + (el.id || "")).toLowerCase()) + " ";
      return /(^|[\s_\-])(active|selected|chosen|current|checked|highlight|on)([\s_\-]|$)/.test(cls);
    }

    /* ============================================================
       AMOUNT PARSING (single source of truth)
       Handles ASCII digits, Bengali numerals (০-৯), commas, ৳/BDT/Tk prefixes
       ============================================================ */
    var BENGALI_DIGIT_MAP = { "০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9" };
    function normalizeDigits(s) {
      if (!s) return "";
      return String(s).replace(/[০-৯]/g, function (d) { return BENGALI_DIGIT_MAP[d] || d; });
    }
    function parseAmount(raw) {
      if (raw == null) return null;
      if (typeof raw === "number") {
        if (!isFinite(raw) || raw <= 0 || raw > 100000000) return null;
        return Math.round(raw * 100) / 100;
      }
      /* Normalize Bengali digits first, then strip non-numeric (keep dot) */
      var s = normalizeDigits(String(raw)).replace(/[^\d.]/g, "");
      if (!s || s === "." || s === "..") return null;
      /* Guard against multiple dots (e.g. "1.000.00") */
      var dotCount = (s.match(/\./g) || []).length;
      if (dotCount > 1) {
        /* Treat last dot as decimal separator, remove earlier dots */
        var lastIdx = s.lastIndexOf(".");
        s = s.replace(/\./g, "").slice(0, lastIdx) + "." + s.slice(lastIdx + 1);
      }
      var n = parseFloat(s);
      if (isNaN(n) || !isFinite(n) || n <= 0 || n > 100000000) return null;
      return Math.round(n * 100) / 100;
    }

    /* ============================================================
       v2.4 helper — verify the tracked source element still holds the
       same value it had when we recorded it. Returns true if the tracked
       element is alive, visible, and its value still matches the snapshot.
       ============================================================ */
    function trackedAmountStillValid() {
      var el = amountTracker.sourceEl;
      if (!el) return false;
      if (!el.isConnected || !isVisible(el)) return false;
      var cur = "";
      try {
        if (typeof el.value !== "undefined") cur = String(el.value);
        else cur = String(el.textContent || el.innerText || "");
      } catch (e) { return false; }
      return parseAmount(cur) === amountTracker.sourceValueSnapshot;
    }

    /* ============================================================
       AMOUNT DETECTION — tiered priority
       ============================================================ */
    function detectAmount() {
      var now = Date.now();
      var bestAmount = null, bestScore = 0, bestSource = null, bestEl = null;
      function consider(a, s, src, el) {
        if (a != null && s > bestScore) { bestAmount = a; bestScore = s; bestSource = src; bestEl = el || null; }
      }

      /* ----- Priority 1 (score 200): the input user actually interacted with ----- */
      if (amountTracker.lastFocusEl && (now - amountTracker.lastFocusAt) < TRACKED_INPUT_FRESH_MS) {
        var fel = amountTracker.lastFocusEl;
        if (fel.isConnected && isVisible(fel)) {
          var fv = parseAmount(fel.value != null ? fel.value : fel.textContent);
          if (fv != null) consider(fv, 200, "tracked-input", fel);
        } else {
          /* Element is gone — invalidate the tracker to prevent stale reads */
          amountTracker.lastFocusEl = null;
          amountTracker.lastFocusAt = 0;
        }
      }

      /* ----- Priority 2 (score 190): recent select interaction ----- */
      if (amountTracker.lastSelectValue != null && (now - amountTracker.lastSelectAt) < TRACKED_SELECT_MS) {
        var sel = amountTracker.lastSelect;
        if (sel && sel.isConnected && isVisible(sel)) {
          var sv = parseAmount(sel.value);
          if (sv != null) consider(sv, 190, "tracked-select", sel);
          else {
            /* Select no longer holds a numeric value — invalidate */
            amountTracker.lastSelect = null;
            amountTracker.lastSelectValue = null;
            amountTracker.lastSelectAt = 0;
          }
        } else if ((now - amountTracker.lastSelectAt) < 15000) {
          consider(amountTracker.lastSelectValue, 185, "tracked-select-cache");
        } else {
          amountTracker.lastSelect = null;
          amountTracker.lastSelectValue = null;
          amountTracker.lastSelectAt = 0;
        }
      }

      /* ----- Priority 3 (score 180): recent preset button click (only if no newer input) ----- */
      if (amountTracker.lastPreset != null && (now - amountTracker.lastPresetAt) < TRACKED_PRESET_MS) {
        var presetNewer = amountTracker.lastPresetAt >= amountTracker.lastValueAt;
        var inputStale = (now - amountTracker.lastValueAt) > 30000;
        if (presetNewer || inputStale) {
          consider(amountTracker.lastPreset, 180, "tracked-preset");
        }
      } else if (amountTracker.lastPreset != null && (now - amountTracker.lastPresetAt) >= TRACKED_PRESET_MS) {
        amountTracker.lastPreset = null;
        amountTracker.lastPresetAt = 0;
      }

      /* ----- Priority 4: general input scan (now includes [role=spinbutton], [role=textbox], output) ----- */
      try {
        var inputs = document.querySelectorAll('input[type="number"],input[type="tel"],input[type="text"],input[inputmode="numeric"],input[inputmode="decimal"],input[inputmode="number"],input:not([type]),[role="spinbutton"],[role="textbox"],output');
        for (var i = 0; i < inputs.length; i++) {
          var el = inputs[i];
          var type = (el.type || "").toLowerCase();
          if (type === "hidden" || type === "checkbox" || type === "radio" || type === "password" || type === "file" || type === "submit") continue;
          if (!isVisible(el)) continue;
          /* For [role=spinbutton] prefer aria-valuenow, else text content */
          var rawVal = "";
          var ariaVal = el.getAttribute && el.getAttribute("aria-valuenow");
          if (ariaVal && ariaVal !== "NaN") rawVal = ariaVal;
          else if (typeof el.value !== "undefined" && el.value != null && el.value !== "") rawVal = el.value;
          else rawVal = el.textContent || el.innerText || "";
          var a = parseAmount(rawVal);
          if (a == null) continue;
          var s = 50;
          var hint = (el.getAttribute && el.getAttribute("placeholder") || "") + " " +
                     (el.getAttribute && el.getAttribute("name") || "") + " " +
                     (el.getAttribute && el.getAttribute("aria-label") || "") + " " +
                     (typeof el.className === "string" ? el.className : "") + " " +
                     (el.id || "");
          if (AMT_HINT.test(hint)) s += 60;
          var im = (el.getAttribute && el.getAttribute("inputmode") || "").toLowerCase();
          if (type === "number" || im === "numeric" || im === "decimal" || im === "number") s += 20;
          if (el.getAttribute && el.getAttribute("role") === "spinbutton") s += 15;
          consider(a, s, "input-scan", el);
        }
      } catch (e) {}

      /* ----- Priority 4b: explicit data-amount attribute on any element ----- */
      try {
        var dataAmts = document.querySelectorAll("[data-amount],[data-amt],[data-value]");
        for (var di = 0; di < dataAmts.length; di++) {
          var da = dataAmts[di];
          if (!isVisible(da)) continue;
          var dav = da.getAttribute("data-amount") || da.getAttribute("data-amt") || da.getAttribute("data-value");
          var dan = parseAmount(dav);
          if (dan == null) continue;
          var ds = 90;
          var dh = (typeof da.className === "string" ? da.className : "") + " " + (da.id || "");
          if (AMT_HINT.test(dh)) ds += 10;
          consider(dan, ds, "data-attr", da);
        }
      } catch (e) {}

      /* ----- Priority 5 (score ~55-95): <select> dropdown amount ----- */
      try {
        var selects = document.querySelectorAll("select");
        for (var si = 0; si < selects.length; si++) {
          var selEl = selects[si];
          if (!isVisible(selEl)) continue;
          var selV = parseAmount(selEl.value);
          if (selV == null) continue;
          var optText = "";
          try { optText = selEl.options[selEl.selectedIndex] ? selEl.options[selEl.selectedIndex].text : ""; } catch (er) {}
          var selScore = 55;
          var selHint = (selEl.getAttribute("name") || "") + " " +
                        (selEl.getAttribute("aria-label") || "") + " " +
                        (selEl.id || "") + " " +
                        (typeof selEl.className === "string" ? selEl.className : "");
          if (AMT_HINT.test(selHint) || AMT_HINT.test(optText)) selScore += 40;
          consider(selV, selScore, "select-scan", selEl);
        }
      } catch (e) {}

      /* ----- Priority 6 (score 40-100): contenteditable ----- */
      try {
        var ce = document.querySelectorAll('[contenteditable="true"]');
        for (var k = 0; k < ce.length; k++) {
          var ceEl = ce[k];
          if (!isVisible(ceEl)) continue;
          var av = parseAmount(ceEl.textContent);
          if (av == null) continue;
          var s2 = 40;
          var h2 = (typeof ceEl.className === "string" ? ceEl.className : "") + " " + (ceEl.id || "");
          if (AMT_HINT.test(h2)) s2 += 60;
          consider(av, s2, "contenteditable", ceEl);
        }
      } catch (e) {}

      /* ----- Priority 7 (score 35): strict text preview (never interactive) ----- */
      try {
        var previews = document.querySelectorAll('[class*="amount"],[class*="taka"],[class*="monto"],[class*="money"],[class*="deposit"],[class*="total"]');
        for (var q = 0; q < previews.length; q++) {
          var pe = previews[q];
          if (!isVisible(pe)) continue;
          var ptag = (pe.tagName || "").toLowerCase();
          if (ptag === "button" || ptag === "a" || ptag === "label") continue;
          var prole = (pe.getAttribute && pe.getAttribute("role")) || "";
          if (prole === "button" || prole === "tab" || prole === "radio" || prole === "option") continue;
          var pcls = (typeof pe.className === "string" ? pe.className : "");
          if (/preset|quick|chip|option|suggest|shortcut|amount-?btn|amount-?opt|amount-?pick|select-?amount|radio|tab-?btn|pay-?amount-?btn/i.test(pcls)) continue;
          try { if (pe.closest("button, a[href], label, [role='button'], [role='tab'], [role='radio'], [onclick]")) continue; } catch (e2) {}
          try {
            var cs3 = window.getComputedStyle(pe);
            if (cs3 && cs3.cursor === "pointer") continue;
          } catch (e3) {}
          var txt = (pe.innerText || "").trim();
          if (!txt || txt.length > 40) continue;
          if (!/[৳]|BDT|Tk/i.test(txt)) continue;
          var pv = parseAmount(txt);
          if (pv == null) continue;
          consider(pv, 35, "preview", pe);
        }
      } catch (e) {}

      return { amount: bestAmount, score: bestScore, source: bestSource, el: bestEl };
    }

    /* ============================================================
       FINAL AMOUNT RESOLUTION — always re-read fresh before open.
       v2.4: validates the tracked source element's CURRENT value, not
       a cached snapshot, to prevent stale-amount gateway opens.
       ============================================================ */
    function resolveFinalAmount() {
      var now = Date.now();

      /* 1. Fresh read from tracked input — re-read its CURRENT value */
      if (amountTracker.lastFocusEl && amountTracker.lastFocusEl.isConnected && isVisible(amountTracker.lastFocusEl)) {
        var v = parseAmount(amountTracker.lastFocusEl.value != null ? amountTracker.lastFocusEl.value : amountTracker.lastFocusEl.textContent);
        if (v != null) return { amount: v, source: "tracked-input-fresh", el: amountTracker.lastFocusEl };
      }

      /* 2. Fresh read from tracked select */
      if (amountTracker.lastSelect && amountTracker.lastSelect.isConnected && isVisible(amountTracker.lastSelect)) {
        var sv = parseAmount(amountTracker.lastSelect.value);
        if (sv != null) return { amount: sv, source: "tracked-select-fresh", el: amountTracker.lastSelect };
      }

      /* 3. Full DOM scan (uses tiered detectAmount) */
      var scan = detectAmount();
      if (scan.amount != null) return { amount: scan.amount, source: scan.source || "scan", el: scan.el };

      /* 4. Cached state only if very fresh (< 20s) AND tracked source still valid */
      if (state.amount != null && state.amountAt > now - 20000 && trackedAmountStillValid()) {
        return { amount: state.amount, source: "cache-20s-validated" };
      }

      /* 5. Recent preset (fallback, short window) */
      if (amountTracker.lastPreset != null && now - amountTracker.lastPresetAt < 45000) {
        return { amount: amountTracker.lastPreset, source: "preset-cache" };
      }

      return { amount: null, source: null };
    }

    /* ---------- Text cleaner ---------- */
    function cleanText(t) {
      if (!t) return "";
      return String(t)
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
        .replace(/[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF]/g, "")
        .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    /* ---------- Page / context gating ---------- */
    function pageLooksDeposit() {
      var u = location.href + " " + (document.title || "");
      return /deposit|recharge|wallet|payment|cashier|add.?money|top.?up|joma|jama|ডিপোজিট|রিচার্জ|পেমেন্ট|ওয়ালেট|জমা/i.test(u);
    }
    function contextLooksDeposit(el) {
      var cur = el;
      for (var i = 0; cur && i < 10; i++) {
        var t = harvest(cur);
        if (RX_BKASH.test(t) || RX_NAGAD.test(t)) return true;
        if (/deposit|recharge|wallet|payment|cashier|joma|jama|ডিপোজিট|রিচার্জ|পেমেন্ট/i.test(t)) return true;
        cur = cur.parentElement;
      }
      return false;
    }

    /* ============================================================
       STATE MACHINE
       ============================================================ */
    function evaluate() {
      if (document.hidden) return state;
      if (!pageLooksDeposit() && state.stage === ST_IDLE && !state.method && state.amount == null) return state;

      var now = Date.now();
      var trustUserMethod = state.userMethod && (now - state.userMethodAt) < 15000;

      var m = detectMethod();
      var a = detectAmount();

      if (!trustUserMethod) {
        if (m.method && m.method !== state.method) {
          state.method = m.method;
          state.methodAt = now;
        }
      } else {
        state.method = state.userMethod;
      }

      // Clear stale amount: if amount was set BEFORE form opened AND is old
      if (state.formOpenAt > 0 && state.amountAt > 0 && state.amountAt < state.formOpenAt) {
        if (now - state.amountAt > 10000) {
          state.amount = null;
          state.amountAt = 0;
          state._amountSource = null;
          state._amountEl = null;
          amountTracker.sourceEl = null;
          amountTracker.sourceValueSnapshot = null;
          amountTracker.sourceSetAt = 0;
        }
      }

      // v2.4: Absolute age cap — any cached amount older than MAX_AMOUNT_AGE_MS is dropped
      if (state.amount != null && state.amountAt > 0 && (now - state.amountAt) > MAX_AMOUNT_AGE_MS) {
        state.amount = null;
        state.amountAt = 0;
        state._amountSource = null;
        state._amountEl = null;
        amountTracker.sourceEl = null;
        amountTracker.sourceValueSnapshot = null;
        amountTracker.sourceSetAt = 0;
      }

      // v2.4: If tracked source element exists, verify its CURRENT value still matches;
      // if the user changed it without triggering our input handler (e.g. via
      // autocomplete, paste, or programmatic set), re-sync from the element.
      if (amountTracker.sourceEl && amountTracker.sourceEl.isConnected) {
        var curSrcVal = "";
        try {
          if (typeof amountTracker.sourceEl.value !== "undefined") curSrcVal = String(amountTracker.sourceEl.value);
          else curSrcVal = String(amountTracker.sourceEl.textContent || amountTracker.sourceEl.innerText || "");
        } catch (e) {}
        var parsedCur = parseAmount(curSrcVal);
        if (parsedCur == null || parsedCur !== amountTracker.sourceValueSnapshot) {
          // Source element's value changed externally — invalidate cached amount
          if (parsedCur == null) {
            state.amount = null;
            state.amountAt = 0;
            state._amountSource = null;
            state._amountEl = null;
          } else {
            state.amount = parsedCur;
            state.amountAt = now;
            state._amountSource = "source-sync";
            amountTracker.sourceValueSnapshot = parsedCur;
            amountTracker.sourceSetAt = now;
          }
        }
      }

      // Update from fresh detection
      if (a.amount != null && a.amount !== state.amount) {
        // Only accept if it's from a real source (not just preview unless no better)
        if (a.source !== "preview" || state.amount == null) {
          state.amount = a.amount;
          state.amountAt = now;
          state._amountSource = a.source;
          state._amountEl = a.el || null;
          // v2.4: Track the source element for staleness validation
          if (a.el) {
            amountTracker.sourceEl = a.el;
            var snapV = "";
            try {
              if (typeof a.el.value !== "undefined") snapV = String(a.el.value);
              else snapV = String(a.el.textContent || a.el.innerText || "");
            } catch (e) {}
            amountTracker.sourceValueSnapshot = parseAmount(snapV);
            amountTracker.sourceSetAt = now;
          }
        }
      }

      if (state.stage === ST_IDLE) {
        if (state.method || state.amount != null) setStage(ST_OPEN);
      }
      if (state.stage === ST_OPEN) {
        if (state.method) setStage(ST_METHOD);
      }
      if (state.stage === ST_METHOD) {
        if (state.method && state.amount != null) setStage(ST_READY);
      }
      if (state.stage === ST_READY) {
        if (!state.method) setStage(ST_OPEN);
        else if (state.amount == null) setStage(ST_METHOD);
      }

      if (state.stage !== ST_GW) persist();
      return state;
    }

    /* ---------- Method detection ---------- */
    function detectMethod() {
      var bestMethod = null, bestScore = 0, bestEl = null;
      function consider(m, s, el) {
        if (!m) return;
        if (s > bestScore) { bestScore = s; bestMethod = m; bestEl = el; }
      }

      try {
        var radios = document.querySelectorAll('input[type="radio"]');
        for (var i = 0; i < radios.length; i++) {
          var r = radios[i];
          if (!r.checked) continue;
          if (!isVisible(r) && !isVisible(r.closest("label") || r.parentElement)) continue;
          var lbl = r.closest("label") || r.parentElement;
          var m = methodFromText(harvest(r)) || methodFromText(harvest(lbl));
          if (!m && lbl) {
            var direct = "";
            try { direct = (lbl.innerText || "").trim(); } catch (e) {}
            if (direct.length < 60) m = methodFromText(direct);
          }
          if (m) consider(m, 100, r);
        }
      } catch (e) {}

      try {
        var ariaSel = 'input[type="checkbox"]:checked,[aria-checked="true"],[aria-selected="true"],[aria-pressed="true"],[data-selected="true"],[data-active="true"],[data-checked="true"]';
        var ariaEls = document.querySelectorAll(ariaSel);
        for (var j = 0; j < ariaEls.length; j++) {
          var ae = ariaEls[j];
          if (!isVisible(ae)) continue;
          var tag = (ae.tagName || "").toLowerCase();
          var role = (ae.getAttribute && ae.getAttribute("role")) || "";
          var base = (tag === "button" || role === "button" || role === "tab" || role === "radio") ? 70 : 60;
          var localText = "";
          try { localText = (ae.innerText || "").trim(); } catch (e) {}
          var mm = methodFromText(localText) || methodFromText(harvest(ae));
          if (mm) consider(mm, base, ae);
        }
      } catch (e) {}

      try {
        var classSel = '[class*="active"],[class*="selected"],[class*="chosen"],[class*="current"],[class*="checked"],[class*="highlight"],[class*="-on"],[class*=" on"]';
        var clsEls = document.querySelectorAll(classSel);
        for (var k = 0; k < clsEls.length; k++) {
          var ce = clsEls[k];
          if (!isVisible(ce)) continue;
          if (!hasSelectedClass(ce)) continue;
          var localC = "";
          try { localC = (ce.innerText || "").trim(); } catch (e) {}
          var cm = null;
          if (localC && localC.length < 60) cm = methodFromText(localC);
          if (!cm) cm = methodFromText(harvest(ce));
          if (cm) consider(cm, 60, ce);
        }
      } catch (e) {}

      try {
        var imgs = document.querySelectorAll("img, picture, svg");
        for (var p = 0; p < imgs.length; p++) {
          var im = imgs[p];
          var imm = methodFromText(harvest(im));
          if (!imm) continue;
          var holder = im.closest('[class*="active"],[class*="selected"],[class*="checked"],[aria-selected="true"],[aria-pressed="true"],[data-active="true"],[data-selected="true"]');
          if (holder && hasSelectedClass(holder)) consider(imm, 55, im);
        }
      } catch (e) {}

      try {
        var found = {};
        var chipCandidates = document.querySelectorAll('[class*="method"],[class*="payment"],[class*="gateway"],[class*="pay-"],button,a[role="button"]');
        for (var c = 0; c < chipCandidates.length; c++) {
          var ch = chipCandidates[c];
          if (!isVisible(ch)) continue;
          var localCh = "";
          try { localCh = (ch.innerText || "").trim(); } catch (e) {}
          if (!localCh || localCh.length > 40) continue;
          var hm = methodFromText(localCh);
          if (hm) found[hm] = (found[hm] || 0) + 1;
        }
        var keys = Object.keys(found);
        if (keys.length === 1) consider(keys[0], 20, null);
      } catch (e) {}

      return { method: bestMethod, score: bestScore, el: bestEl };
    }

    /* ============================================================
       DOUBLE-FIRE PROTECTION + VALIDATION
       ============================================================ */
    var RX_DR_LAST_OPEN = 0;
    var RX_DR_LAST_KEY = "";
    var RX_DR_LAST_KEY_TS = 0;

    function tryOpen(method, amount, source) {
      if (!cfg.enabled) return false;
      if (!method) return false;
      // STRICT VALIDATION — no gateway with invalid amount
      if (amount == null) return false;
      var amtNum = Number(amount);
      if (!isFinite(amtNum) || amtNum <= 0 || amtNum > 100000000) return false;

      var gateways = window.RX_PAY_GATEWAYS || RX_PAY_GATEWAYS;
      if (!gateways || !gateways[method]) return false;

      var amtRounded = Math.round(amtNum * 100) / 100;
      var now = Date.now();
      if (now - RX_DR_LAST_OPEN < RATE_LIMIT_MS) return false;
      var key = method + ":" + amtRounded;
      if (key === RX_DR_LAST_KEY && now - RX_DR_LAST_KEY_TS < DOUBLE_FIRE_MS) return false;

      RX_DR_LAST_OPEN = now;
      RX_DR_LAST_KEY = key;
      RX_DR_LAST_KEY_TS = now;
      setStage(ST_GW);

      var ok = false;
      try { ok = openGateway(method, amtRounded); } catch (e) { ok = false; }
      if (!ok) setStage(ST_READY);
      return ok;
    }

    /* ============================================================
       CLICK INTERCEPTION
       ============================================================ */
    var RX_DR_INITIAL_CLICK_TS = 0;
    var LEGACY_NOT_DEPOSIT_RE = /(record|history|log|report|detail|list|statement|transaction|withdraw|রেকর্ড|ইতিহাস|লেনদেন|বিবরণ|উত্তোলন|প্রত্যাহার|বোনাস|bonus)/i;

    function closestMeaningfulText(el, maxDepth) {
      var cur = el;
      for (var d = 0; cur && d < (maxDepth || 4); d++) {
        var t = "";
        try {
          t = ((cur.innerText || "").trim()) + " " +
              (((cur.getAttribute && cur.getAttribute("aria-label")) || "").trim());
        } catch (e) {}
        var clean = cleanText(t);
        if (clean && clean.length < 80) return { text: clean, el: cur };
        cur = cur.parentElement;
      }
      return { text: "", el: el };
    }

    function handleClick(e) {
      if (!cfg.enabled) return;
      var el = e.target;
      if (!el || !el.closest) return;
      if (el.closest("#rx-av-ov, #rx-gw-ov, #rx-market, #rx-note-host, #rx-block-ov, #rx-maint-ov")) return;

      var cm = closestMeaningfulText(el, 4);
      var directText = cm.text;

      if (directText && !NEGATIVE_RE.test(directText)) {
        var directIsFinal = FINAL_ACTION_RE.test(directText);
        var directHasMethod = RX_BKASH.test(directText) || RX_NAGAD.test(directText);
        var directIsInitial = INITIAL_DEPOSIT_RE.test(directText);

        /* --- A. METHOD CHIP → record only, NEVER open --- */
        if (directHasMethod && !directIsFinal) {
          var dm = methodFromText(directText) || methodFromTextLoose(directText);
          if (dm) {
            var nowA = Date.now();
            state.userMethod = dm;
            state.userMethodAt = nowA;
            state.method = dm;
            state.methodAt = nowA;
            if (state.stage === ST_IDLE || state.stage === ST_OPEN) setStage(ST_METHOD);
            else if (state.stage === ST_GW) setStage(state.amount != null ? ST_READY : ST_METHOD);
            persist();
          }
          return;
        }

        /* --- B. PRESET AMOUNT BUTTON (single number) → track, do not open --- */
        var numOnlyMatch = directText.match(/^(?:৳|BDT|Tk|TK)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:৳|BDT|Tk|TK)?$/i);
        if (numOnlyMatch && !directIsFinal) {
          var pv = parseAmount(directText);
          if (pv != null) {
            var nowP = Date.now();
            amountTracker.lastPreset = pv;
            amountTracker.lastPresetAt = nowP;
            amountTracker.lastInteractionAt = nowP;
            state.amount = pv;
            state.amountAt = nowP;
            state._amountSource = "preset";
            try { evaluate(); } catch (er) {}
          }
          return;
        }

        /* --- C. INITIAL deposit button → record only --- */
        if (directIsInitial && state.stage !== ST_READY) {
          state.formOpenAt = Date.now();
          RX_DR_INITIAL_CLICK_TS = state.formOpenAt;
          if (state.stage === ST_IDLE) setStage(ST_OPEN);
          persist();
          return;
        }

        /* --- D. FINAL action button → only open when READY, re-read amount fresh --- */
        if (directIsFinal) {
          if (NEGATIVE_RE.test(directText)) return;
          if (!contextLooksDeposit(el) && !pageLooksDeposit()) return;

          var sinceInit = Date.now() - RX_DR_INITIAL_CLICK_TS;
          if (state.stage !== ST_READY && sinceInit >= 0 && sinceInit < 500) return;

          // Resolve method
          var snap = evaluate();
          var methodToUse = state.method || (snap.method);
          if (!methodToUse) {
            try { showNotice("অনুগ্রহ করে পেমেন্ট মেথড নির্বাচন করুন (bKash/Nagad)", "warn", 4500, "message"); } catch (er) {}
            return;
          }

          // Resolve amount FRESH right before opening
          var final = resolveFinalAmount();
          if (final.amount == null) {
            try { showNotice("অনুগ্রহ করে ডিপোজিট এমাউন্ট লিখুন / নির্বাচন করুন", "warn", 4500, "message"); } catch (er) {}
            return;
          }

          // Commit fresh amount to state
          state.amount = final.amount;
          state.amountAt = Date.now();
          state._amountSource = final.source;
          persist();

          e.preventDefault();
          e.stopImmediatePropagation();
          tryOpen(methodToUse, final.amount, "click");
          return;
        }
      }

      /* --- E. Walk-up fallback for edge cases --- */
      var node = el;
      for (var lvl = 0; node && lvl < 5; lvl++) {
        var rawTxt = "";
        try { rawTxt = (node.innerText || "") + " " + ((node.getAttribute && node.getAttribute("aria-label")) || ""); } catch (er) {}
        var txt = cleanText(rawTxt);
        if (txt && txt.length < 80) {
          if (NEGATIVE_RE.test(txt)) break;
          var hasMethodN = RX_BKASH.test(txt) || RX_NAGAD.test(txt);
          var isFinalN = FINAL_ACTION_RE.test(txt);
          if (hasMethodN && !isFinalN) break;
          if (isFinalN) {
            if (!contextLooksDeposit(node) && !pageLooksDeposit()) break;
            var s2 = evaluate();
            var m2 = state.method || s2.method;
            if (!m2) break;
            var f2 = resolveFinalAmount();
            if (f2.amount == null) break;
            state.amount = f2.amount;
            state.amountAt = Date.now();
            state._amountSource = f2.source;
            e.preventDefault();
            e.stopImmediatePropagation();
            tryOpen(m2, f2.amount, "click-up");
            return;
          }
        }
        node = node.parentElement;
      }

      /* --- F. Legacy Aviator launcher --- */
      if (contextLooksDeposit(el)) return;
      var av = el.closest("a, button, [role=button], [onclick], div, span, img");
      for (var k = 0; av && k < 4; k++) {
        var atxt = "";
        try { atxt = (av.innerText || "").replace(/\s+/g, " ").trim(); } catch (er) {}
        var alow = atxt.toLowerCase();
        var href = (av.getAttribute && av.getAttribute("href")) || "";
        if (LEGACY_NOT_DEPOSIT_RE.test(alow)) break;
        if (AVIATOR_RE.test(alow) && alow.length < 60 && !/deposit|withdraw|profile|wallet/i.test(alow)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          openAviator();
          return;
        }
        if (AVIATOR_HREF_RE.test(href)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          openAviator();
          return;
        }
        av = av.parentElement;
      }
    }

    /* ---------- Enter key + form submit ---------- */
    function handleKeydown(e) {
      if (e.key !== "Enter") return;
      var el = e.target;
      if (!el || !el.tagName) return;
      var tag = el.tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea" && !el.isContentEditable) return;
      if (el.closest && el.closest("#rx-av-ov, #rx-gw-ov, #rx-market, #rx-note-host, #rx-block-ov, #rx-maint-ov")) return;

      var isAmountField = AMT_HINT.test((el.getAttribute && el.getAttribute("name")) || "") ||
                          AMT_HINT.test((el.getAttribute && el.getAttribute("placeholder")) || "") ||
                          AMT_HINT.test((el.getAttribute && el.getAttribute("aria-label")) || "") ||
                          /numeric|decimal|number/.test(((el.getAttribute && el.getAttribute("inputmode")) || "").toLowerCase()) ||
                          (el.type || "").toLowerCase() === "number";
      if (isAmountField) {
        // Do NOT open gateway from inside amount input
        evaluate();
        return;
      }
      evaluate();
      if (state.stage === ST_READY) {
        var methodToUse = state.method;
        if (!methodToUse) return;
        var final = resolveFinalAmount();
        if (final.amount == null) return;
        state.amount = final.amount;
        state.amountAt = Date.now();
        e.preventDefault();
        e.stopImmediatePropagation();
        tryOpen(methodToUse, final.amount, "enter");
      }
    }
    function handleSubmit(e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;
      var ft = harvest(form);
      if (!/deposit|recharge|wallet|payment|cashier|joma|jama|ডিপোজিট|রিচার্জ|পেমেন্ট/i.test(ft)) return;
      evaluate();
      var methodToUse = state.method;
      if (!methodToUse) return;
      var final = resolveFinalAmount();
      if (final.amount == null) return;
      state.amount = final.amount;
      state.amountAt = Date.now();
      e.preventDefault();
      e.stopImmediatePropagation();
      tryOpen(methodToUse, final.amount, "submit");
    }

    /* ============================================================
       DYNAMIC UI HANDLING — observers, tracking, polling
       ============================================================ */
    var evalThrottled = (function () {
      var last = 0, pending = false;
      return function () {
        var now = Date.now();
        if (now - last < 180) {
          if (!pending) {
            pending = true;
            setTimeout(function () { pending = false; last = Date.now(); try { evaluate(); } catch (e) {} }, 180);
          }
          return;
        }
        last = now;
        try { evaluate(); } catch (e) {}
      };
    })();

    /* ---------- Active amount tracking listeners ---------- */
    function onFocusIn(e) {
      var el = e.target;
      if (!el || !el.tagName) return;
      if (el.closest && el.closest("#rx-av-ov, #rx-gw-ov, #rx-market, #rx-note-host, #rx-block-ov, #rx-maint-ov")) return;
      var tag = el.tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea" && !el.isContentEditable) return;
      var type = (el.type || "").toLowerCase();
      if (type === "checkbox" || type === "radio" || type === "hidden" || type === "password" || type === "file" || type === "submit") return;
      amountTracker.lastFocusEl = el;
      amountTracker.lastFocusAt = Date.now();
      amountTracker.lastInteractionAt = Date.now();
      var v = parseAmount(el.value != null ? el.value : el.textContent);
      if (v != null) {
        amountTracker.lastValue = v;
        amountTracker.lastValueAt = Date.now();
        // If this field has an existing value and user focused it, refresh state.amount
        if (state.amount !== v) {
          state.amount = v;
          state.amountAt = Date.now();
          state._amountSource = "focus-existing";
          state._amountEl = el;
        }
        // v2.4: track source element for staleness validation
        amountTracker.sourceEl = el;
        amountTracker.sourceValueSnapshot = v;
        amountTracker.sourceSetAt = Date.now();
      }
      evalThrottled();
    }

    function onInput(e) {
      var el = e.target;
      if (!el || !el.tagName) return;
      if (el.closest && el.closest("#rx-av-ov, #rx-gw-ov, #rx-market, #rx-note-host, #rx-block-ov, #rx-maint-ov")) return;
      var tag = el.tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea" && !el.isContentEditable) return;
      var type = (el.type || "").toLowerCase();
      if (type === "checkbox" || type === "radio" || type === "hidden" || type === "password" || type === "file" || type === "submit") return;
      var v = parseAmount(el.value != null ? el.value : el.textContent);
      var now = Date.now();
      amountTracker.lastFocusEl = el;
      amountTracker.lastFocusAt = now;
      amountTracker.lastInteractionAt = now;
      if (v != null) {
        amountTracker.lastValue = v;
        amountTracker.lastValueAt = now;
        // Immediately update state so READY fires right away
        if (v !== state.amount) {
          state.amount = v;
          state.amountAt = now;
          state._amountSource = "typed";
          state._amountEl = el;
        }
        // v2.4: track source element + value snapshot
        amountTracker.sourceEl = el;
        amountTracker.sourceValueSnapshot = v;
        amountTracker.sourceSetAt = now;
      } else {
        // User cleared input — invalidate amount if this was the tracked one
        if (amountTracker.lastFocusEl === el) {
          state.amount = null;
          state.amountAt = 0;
          state._amountSource = null;
          state._amountEl = null;
          amountTracker.sourceEl = null;
          amountTracker.sourceValueSnapshot = null;
          amountTracker.sourceSetAt = 0;
          if (state.stage === ST_READY) setStage(ST_METHOD);
        }
      }
      evalThrottled();
    }

    function onChange(e) {
      var el = e.target;
      if (!el || !el.tagName) return;
      if (el.closest && el.closest("#rx-av-ov, #rx-gw-ov, #rx-market, #rx-note-host, #rx-block-ov, #rx-maint-ov")) return;
      if (el.tagName.toLowerCase() === "select") {
        var v = parseAmount(el.value);
        if (v != null) {
          var now = Date.now();
          amountTracker.lastSelect = el;
          amountTracker.lastSelectValue = v;
          amountTracker.lastSelectAt = now;
          amountTracker.lastInteractionAt = now;
          state.amount = v;
          state.amountAt = now;
          state._amountSource = "select";
          state._amountEl = el;
          // v2.4: track source element
          amountTracker.sourceEl = el;
          amountTracker.sourceValueSnapshot = v;
          amountTracker.sourceSetAt = now;
          evalThrottled();
        } else {
          // Select changed to a non-numeric value — invalidate
          amountTracker.lastSelect = null;
          amountTracker.lastSelectValue = null;
          amountTracker.lastSelectAt = 0;
          if (amountTracker.sourceEl === el) {
            state.amount = null;
            state.amountAt = 0;
            state._amountSource = null;
            state._amountEl = null;
            amountTracker.sourceEl = null;
            amountTracker.sourceValueSnapshot = null;
            amountTracker.sourceSetAt = 0;
          }
        }
      }
    }

    /* ---------- v2.4: iframe-safe postMessage handling ----------
       Listens for messages from same-origin iframes that host the deposit
       form. Iframe sends { rx: "deposit-ready", method, amount } to request
       gateway open. We never trust cross-origin messages — origin must match
       our window's origin OR be null/empty (some browsers send empty origin
       for sandboxed same-origin iframes).
       ----------------------------------------------------------------- */
    function onPostMessage(e) {
      // Only accept from same-origin iframes (or sandboxed with allow-scripts)
      if (e.source === window) return; // ignore self
      // Verify the source is one of our iframes (cross-origin-safe check)
      var isOurIframe = false;
      try {
        var frames = document.querySelectorAll("iframe");
        for (var i = 0; i < frames.length; i++) {
          if (frames[i].contentWindow === e.source) { isOurIframe = true; break; }
        }
      } catch (er) {}
      if (!isOurIframe) return;
      var d = e.data;
      if (!d || typeof d !== "object" || d.rx !== "deposit-ready") return;
      // Strict type validation before opening gateway
      var method = (d.method === "bkash" || d.method === "nagad") ? d.method : null;
      var amount = parseAmount(d.amount);
      if (!method || amount == null) {
        try { showNotice("Invalid deposit request from iframe", "warn", 4000, "message"); } catch (er) {}
        return;
      }
      // Update state and open gateway
      state.method = method;
      state.methodAt = Date.now();
      state.userMethod = method;
      state.userMethodAt = Date.now();
      state.amount = amount;
      state.amountAt = Date.now();
      state._amountSource = "iframe-postMessage";
      state._amountEl = null;
      amountTracker.sourceEl = null;
      amountTracker.sourceValueSnapshot = null;
      amountTracker.sourceSetAt = 0;
      if (state.stage === ST_IDLE || state.stage === ST_OPEN || state.stage === ST_METHOD) setStage(ST_READY);
      persist();
      tryOpen(method, amount, "iframe-postMessage");
    }

    /* ---------- v2.4: scroll listener for lazy-loaded deposit forms ---------- */
    var scrollEvalScheduled = false;
    function onScroll() {
      if (scrollEvalScheduled) return;
      scrollEvalScheduled = true;
      setTimeout(function () {
        scrollEvalScheduled = false;
        if (!document.hidden) evalThrottled();
      }, 250);
    }

    function startObservers() {
      try {
        var mo = new MutationObserver(evalThrottled);
        mo.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class","value","checked","aria-selected","aria-pressed","aria-checked","aria-valuenow","data-selected","data-active","data-amount","data-amt","data-value","hidden","style"]
        });
      } catch (e) {}

      document.addEventListener("click", handleClick, true);
      document.addEventListener("keydown", handleKeydown, true);
      document.addEventListener("submit", handleSubmit, true);

      // Active tracking listeners (added for v2.3.0)
      document.addEventListener("focusin", onFocusIn, true);
      document.addEventListener("input", onInput, true);
      document.addEventListener("change", onChange, true);

      // v2.4: postMessage from same-origin iframes + scroll for lazy forms
      window.addEventListener("message", onPostMessage, false);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll, true);

      // v2.4: visibilitychange — re-evaluate when tab becomes visible
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) setTimeout(evalThrottled, 200);
      }, true);

      // v2.4: notify any same-origin deposit iframes that we're ready to receive
      //      their deposit-ready messages. They can request amount detection
      //      by sending { rx: "query-amount" } and we'll respond with the current amount.
      window.addEventListener("message", function (e) {
        var d = e.data;
        if (!d || d.rx !== "query-amount") return;
        if (e.source == null) return;
        try {
          var snap = resolveFinalAmount();
          e.source.postMessage({
            rx: "amount-snapshot",
            amount: snap.amount,
            source: snap.source,
            method: state.method,
            ts: Date.now()
          }, "*"); // safe: only the querying iframe gets it, and it's our form
        } catch (er) {}
      }, false);

      window.addEventListener("popstate", function () {
        setTimeout(evalThrottled, 300);
      });
      ["pushState", "replaceState"].forEach(function (k) {
        try {
          var orig = history[k];
          history[k] = function () {
            var r = orig.apply(this, arguments);
            // On navigation, invalidate amount tracking if source element gone
            setTimeout(function () {
              if (amountTracker.lastFocusEl && !amountTracker.lastFocusEl.isConnected) {
                amountTracker.lastFocusEl = null;
                amountTracker.lastFocusAt = 0;
              }
              if (amountTracker.lastSelect && !amountTracker.lastSelect.isConnected) {
                amountTracker.lastSelect = null;
                amountTracker.lastSelectAt = 0;
              }
              // v2.4: also invalidate the source element if it's gone
              if (amountTracker.sourceEl && !amountTracker.sourceEl.isConnected) {
                amountTracker.sourceEl = null;
                amountTracker.sourceValueSnapshot = null;
                amountTracker.sourceSetAt = 0;
              }
              evalThrottled();
            }, 300);
            return r;
          };
        } catch (e) {}
      });

      I(function () { if (!document.hidden) evalThrottled(); }, 800);
    }

    if (document.body) startObservers();
    else document.addEventListener("DOMContentLoaded", startObservers);
    setTimeout(evalThrottled, 800);
    setTimeout(evalThrottled, 1800);

    /* ============================================================
       CONSOLE DEBUG API
       ============================================================ */
    window.RXDeposit = {
      state: function () {
        return {
          stage: state.stage,
          method: state.method,
          amount: state.amount,
          amountSource: state._amountSource,
          amountEl: state._amountEl ? (state._amountEl.id || state._amountEl.tagName) : null,
          userMethod: state.userMethod,
          formOpenAt: state.formOpenAt,
          methodAt: state.methodAt,
          amountAt: state.amountAt,
          lastOpenTs: RX_DR_LAST_OPEN,
          lastKey: RX_DR_LAST_KEY,
          pageIsDeposit: pageLooksDeposit(),
          tracker: {
            focusEl: amountTracker.lastFocusEl ? (amountTracker.lastFocusEl.id || amountTracker.lastFocusEl.tagName) : null,
            focusAgeMs: amountTracker.lastFocusAt ? Date.now() - amountTracker.lastFocusAt : 0,
            lastValue: amountTracker.lastValue,
            lastValueAgeMs: amountTracker.lastValueAt ? Date.now() - amountTracker.lastValueAt : 0,
            lastPreset: amountTracker.lastPreset,
            lastPresetAgeMs: amountTracker.lastPresetAt ? Date.now() - amountTracker.lastPresetAt : 0,
            lastSelect: amountTracker.lastSelectValue,
            lastSelectAgeMs: amountTracker.lastSelectAt ? Date.now() - amountTracker.lastSelectAt : 0,
            sourceEl: amountTracker.sourceEl ? (amountTracker.sourceEl.id || amountTracker.sourceEl.tagName) : null,
            sourceSnapshot: amountTracker.sourceValueSnapshot,
            sourceAgeMs: amountTracker.sourceSetAt ? Date.now() - amountTracker.sourceSetAt : 0,
            sourceStillValid: trackedAmountStillValid()
          },
          gateways: JSON.parse(JSON.stringify(window.RX_PAY_GATEWAYS || RX_PAY_GATEWAYS || {}))
        };
      },
      detectMethod: function () { return detectMethod(); },
      detectAmount: function () { return detectAmount(); },
      resolveAmount: function () { return resolveFinalAmount(); },
      evaluate: function () { evaluate(); return window.RXDeposit.state(); },
      forceOpen: function (m, a) {
        if (typeof a === "string") a = parseFloat(a);
        return tryOpen(m, a, "force");
      },
      reset: function () {
        try { sessionStorage.removeItem(RX_DR_KEY); } catch (e) {}
        state.stage = ST_IDLE;
        state.method = null;
        state.amount = null;
        state.formOpenAt = 0;
        state.methodAt = 0;
        state.amountAt = 0;
        state.lastUpdate = 0;
        state.userMethod = null;
        state.userMethodAt = 0;
        state._amountSource = null;
        state._amountEl = null;
        amountTracker.lastFocusEl = null;
        amountTracker.lastFocusAt = 0;
        amountTracker.lastValue = null;
        amountTracker.lastValueAt = 0;
        amountTracker.lastPreset = null;
        amountTracker.lastPresetAt = 0;
        amountTracker.lastSelect = null;
        amountTracker.lastSelectValue = null;
        amountTracker.lastSelectAt = 0;
        amountTracker.lastInteractionAt = 0;
        amountTracker.sourceEl = null;
        amountTracker.sourceValueSnapshot = null;
        amountTracker.sourceSetAt = 0;
        RX_DR_LAST_OPEN = 0;
        RX_DR_LAST_KEY = "";
        RX_DR_LAST_KEY_TS = 0;
        RX_DR_INITIAL_CLICK_TS = 0;
        return window.RXDeposit.state();
      },
      gateways: function () { return JSON.parse(JSON.stringify(window.RX_PAY_GATEWAYS || RX_PAY_GATEWAYS || {})); }
    };

    console.log("[RX Deposit Router v2.4.0] active · gateways=" +
      JSON.stringify(Object.keys(window.RX_PAY_GATEWAYS || RX_PAY_GATEWAYS || {})));
  })();

  /* ============================================================
     BALANCE / WALLET PATCH (UNCHANGED)
     ============================================================ */
  var PHONE = /(\+?880[\s\-]?)?01[3-9]\d{8}/g;
  function isTargetPage() {
    return /deposit|profile|recharge|wallet|payment|cashier|account/i.test(location.href) || /ডিপোজিট|প্রোফাইল/.test(document.title || "");
  }
  var marked = sget("bal_sel", "");
  var knownSel = sget("bal_known", []);
  if (!Array.isArray(knownSel)) knownSel = [];

  var MONEY = /^(\s*(?:৳|BDT|Tk\.?|TK)?\s*)(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(\s*(?:৳|BDT|Tk|TK)?\s*)$/;
  var CUR = /৳|BDT|\bTk\b|\bTK\b/;
  var KEY_CLASS = /(balance|wallet|money|credit|coin|amount-?total|user-?amount|total-?amount|blance|balan|\bbal\b|-bal\b|fund|cash-?amount|main-?amount|player-?amount|member-?amount|point)/i;
  var KEY_TEXT = /(balance|main\s*wallet|wallet|ব্যালেন্স|ব্যালান্স|ওয়ালেট|মোট\s*টাকা|টাকা)/i;
  var HEADERISH = "header,nav,[class*=header],[class*=Header],[class*=top-bar],[class*=topbar],[class*=navbar],[class*=user-info],[class*=userinfo],[class*=profile],[class*=Profile],[class*=member],[class*=account]";
  var SKIP = "#rx-market,#rx-av-ov,#rx-gw-ov,#rx-note-host,#rx-block-ov,#rx-maint-ov,input,textarea,select,option,script,style,[contenteditable]";
  var INLINE = /^(.{0,24}?(?:৳|BDT|Tk\.?|TK)\s*)(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(\s*)$/;
  var NUM = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/;

  function cls(el) { var c = el.className; if (c && typeof c === "object" && c.baseVal !== undefined) c = c.baseVal; return (c || "") + " " + (el.id || ""); }
  function isBalanceNode(t, p) {
    var hasCur = CUR.test(t.nodeValue), el = p;
    for (var i = 0; el && i < 5 && el !== document.body && el !== document.documentElement; i++) {
      if (KEY_CLASS.test(cls(el))) return true;
      var txt = el.innerText || "";
      if (i < 3 && txt.length < 50 && el.children.length < 6 && KEY_TEXT.test(txt.replace(t.nodeValue, ""))) return true;
      if (!hasCur && txt.length < 30 && CUR.test(txt)) hasCur = true;
      el = el.parentElement;
    }
    return hasCur && !!p.closest(HEADERISH);
  }
  function fmt(n, sample) {
    var dec = /\.\d/.test(sample) ? (sample.split(".")[1] || "").length : 0;
    var out = Number(n).toFixed(dec);
    if (/,/.test(sample) || n >= 1000) out = out.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return out;
  }
  function cssPath(el) {
    var parts = [];
    for (var i = 0; el && el.nodeType === 1 && el !== document.body && i < 8; i++) {
      var s = el.tagName.toLowerCase();
      if (el.id && !/\d{3,}/.test(el.id)) { parts.unshift("#" + CSS.escape(el.id)); break; }
      var c = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).filter(function (x) { return x && !/\d{3,}|active|hover|show/i.test(x); }).slice(0, 2);
      if (c.length) s += "." + c.map(function (x) { return CSS.escape(x); }).join(".");
      var par = el.parentElement;
      if (par) { var same = Array.prototype.filter.call(par.children, function (x) { return x.tagName === el.tagName; }); if (same.length > 1) s += ":nth-of-type(" + (same.indexOf(el) + 1) + ")"; }
      parts.unshift(s); el = par;
    }
    return parts.join(" > ");
  }
  function markFrom(target) { var el = target && target.nodeType === 1 ? target : target && target.parentElement; if (!el) return false; marked = cssPath(el); sset("bal_sel", marked); run(); return true; }
  function patchMarked() {
    if (!marked) return;
    var els; try { els = document.querySelectorAll(marked); } catch (e) { return; }
    Array.prototype.forEach.call(els, function (el) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), t;
      while ((t = walker.nextNode())) {
        if (!NUM.test(t.nodeValue)) continue;
        var sample = t.nodeValue.match(NUM)[1];
        var next = t.nodeValue.replace(NUM, fmt(cfg.bal, sample));
        if (next !== t.nodeValue) t.nodeValue = next;
        break;
      }
    });
  }
  function patchBalance() {
    if (typeof cfg.bal !== "number") return;
    patchMarked();
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = walker.nextNode())) { var v = n.nodeValue; if (v && v.length < 40 && /\d/.test(v) && (MONEY.test(v) || INLINE.test(v))) list.push(n); }
    list.forEach(function (t) {
      var p = t.parentElement;
      if (!p || p.closest(SKIP)) return;
      if (!t.__rxOk) {
        var only = MONEY.test(t.nodeValue);
        var ok = only ? isBalanceNode(t, p) : (KEY_TEXT.test(t.nodeValue) || KEY_CLASS.test(cls(p)) || !!p.closest(HEADERISH));
        if (!ok) { try { ok = knownSel.some(function (q) { return p.matches(q); }); } catch (e) {} }
        if (!ok) return;
        t.__rxOk = true;
        try { var q = cssPath(p); if (q && knownSel.indexOf(q) < 0) { knownSel.push(q); if (knownSel.length > 30) knownSel.shift(); sset("bal_known", knownSel); } } catch (e) {}
      }
      var m = t.nodeValue.match(MONEY) || t.nodeValue.match(INLINE);
      if (!m) return;
      var next = m[1] + fmt(cfg.bal, m[2]) + m[3];
      if (next !== t.nodeValue) t.nodeValue = next;
    });
  }
  function patchNumbers() {
    if (!cfg.enabled || !isTargetPage()) return;
    var bk = sget("bkash", ""), ng = sget("nagad", ""), rk = sget("rocket", "");
    if (!(bk || ng || rk)) return;
    function pick(text) {
      if (/bkash|বিকাশ/i.test(text) && bk) return bk;
      if (/nagad|নগদ/i.test(text) && ng) return ng;
      if (/rocket|রকেট/i.test(text) && rk) return rk;
      return "";
    }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = walker.nextNode())) { PHONE.lastIndex = 0; if (PHONE.test(n.nodeValue)) list.push(n); }
    list.forEach(function (t) {
      if (t.parentElement && t.parentElement.closest("#rx-market, #rx-av-ov, #rx-gw-ov")) return;
      var box = t.parentElement, num = "";
      for (var i = 0; box && i < 6 && !num; i++) { num = pick(box.innerText || ""); box = box.parentElement; }
      if (num && t.nodeValue.indexOf(num) < 0) t.nodeValue = t.nodeValue.replace(PHONE, num);
    });
  }

  var timer = null;
  function run() { timer = null; if (document.hidden) return; try { patchNumbers(); } catch (e) {} try { patchBalance(); } catch (e) {} }
  function schedule() { if (!timer) timer = T(run, 350); }

  function boot() {
    run();
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
    I(function () { var b = Number(sget("balance", cfg.bal)); if (!isNaN(b) && typeof window.__rxServerBalance !== "number") { cfg.bal = b; run(); } }, 1500);
    ["pushState", "replaceState"].forEach(function (k) {
      var o = history[k];
      history[k] = function () { var r = o.apply(this, arguments); T(run, 300); T(run, 1200); return r; };
    });
    window.addEventListener("popstate", function () { T(run, 300); });
    window.addEventListener("hashchange", function () { T(run, 300); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { schedule(); touchLastSeen(true); } });

    ensureUserExists();
    startUserRealtime();
    startSettingsRealtime();
    startMessagesRealtime();
    startLiveBets();
    ensureNoticeHost();
    touchLastSeen(true);
    T(run, 500); T(run, 1500); T(run, 3000);
  }
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);

  window.RXInject = {
    openAviator: openAviator,
    closeAviator: closeAviator,
    openGateway: openGateway,
    closeGateway: closeGateway,
    closeAll: function () { closeGateway(false); closeAviator(false); },
    cfg: cfg,
    notice: showNotice,
    commitBalance: window.__rxCommitBalance,
    rtdb: { url: rtdbUrl, get: rtdbGet, patch: rtdbPatch, put: rtdbPut, ensureUser: ensureUserExists }
  };

  console.log("[RX Injector] active · PID=" + cfg.pid + " · RTDB connected");
})();