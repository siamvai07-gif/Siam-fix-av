/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin SDK
const DATABASE_URL = "https://nagad-17cbb-default-rtdb.firebaseio.com";
if (!((admin as any).apps && (admin as any).apps.length)) {
  try {
    admin.initializeApp({
      databaseURL: DATABASE_URL
    });
  } catch (e) {
    console.error("Firebase Admin initialization error:", e);
  }
}

// Ensure public static assets are present
try {
  const assetsDir = path.join(__dirname, 'public/assets/aistudio');
  const pubDir = path.join(__dirname, 'public');
  if (fs.existsSync(assetsDir)) {
    const extSrc = path.join(assetsDir, 'SX_PRO__1__f2b7b262.js');
    const extDest = path.join(pubDir, 'extension.js');
    if (fs.existsSync(extSrc) && !fs.existsSync(extDest)) {
      fs.copyFileSync(extSrc, extDest);
    }
  }
} catch (e) {
  console.warn("Asset copy warning:", e);
}

const db = getDatabase();
const ADMIN_KEY = process.env.ADMIN_KEY || "SIAMVIP";

const app = express();
app.use(express.json());

// Helper responses
const ok = (res: any, data: any) => res.json(Object.assign({ ok: true }, data || {}));
const fail = (res: any, code: number, msg: string) => res.status(code).json({ ok: false, error: msg });

function guard(req: any, res: any) {
  const key = req.get("x-admin-key") || (req.body && req.body.key);
  if (!key || key !== ADMIN_KEY) {
    fail(res, 401, "Unauthorized: invalid admin key");
    return false;
  }
  return true;
}

function normBD(raw: any) {
  const s = String((raw == null ? "" : raw)).replace(/[\s\-()]/g, "");
  const n = /^(\+?880)/.test(s) ? "0" + s.replace(/^\+?880/, "") : s;
  return /^01[3-9]\d{8}$/.test(n) ? n : null;
}

function sanitizeNumber(n: any) {
  if (!n) return null;
  const num = normBD(n.number);
  if (!num) return null;
  return {
    id: String(n.id || "n" + Date.now()),
    label: String(n.label || "").slice(0, 40),
    number: num,
    active: n.active !== false
  };
}

const isHttpUrl = (u: any) => typeof u === "string" && /^https:\/\//.test(u);

function sanitizeSettings(s: any) {
  if (!s || typeof s !== "object") return null;
  const out: any = {};
  out.status = s.status !== false;
  out.demo_balance = Math.max(0, Math.round(Number(s.demo_balance) || 0));
  out.player_logos = Array.isArray(s.player_logos) ? s.player_logos.filter(isHttpUrl).slice(0, 50) : [];
  out.plane_logos = Array.isArray(s.plane_logos) ? s.plane_logos.filter(isHttpUrl).slice(0, 50) : [];
  out.design = typeof s.design === "string" ? s.design.slice(0, 30) : "";
  out.aviator_url = isHttpUrl(s.aviator_url) ? s.aviator_url : "https://meek-blini-39d40d.netlify.app/";
  const gw: any = {};
  for (const m of ["bkash", "nagad"]) {
    const g = (s.gateways && s.gateways[m]) || {};
    const APP_BASE = process.env.APP_URL || "https://ais-pre-n3jhxqdebubcsw2xdhssvs-51941593759.asia-east1.run.app";
    const def = m === "bkash" ? `${APP_BASE}/bkash` : `${APP_BASE}/nagad`;
    const numbers = Array.isArray(g.numbers) ? g.numbers.map(sanitizeNumber).filter(Boolean).slice(0, 5) : [];
    gw[m] = {
      enabled: g.enabled !== false,
      url: isHttpUrl(g.url) ? g.url : def,
      logo_url: isHttpUrl(g.logo_url) ? g.logo_url : "",
      instructions: typeof g.instructions === "string" ? g.instructions.slice(0, 2000) : "",
      pick_mode: ["random", "round_robin", "fixed"].includes(g.pick_mode) ? g.pick_mode : "random",
      active_number: typeof g.active_number === "string" ? g.active_number : "",
      numbers
    };
  }
  out.gateways = gw;
  out.bkash_url = gw.bkash.url;
  out.nagad_url = gw.nagad.url;
  out.updatedAt = Date.now();
  return out;
}

// Admin API endpoints
app.post("/api/admin/action", async (req, res) => {
  try {
    if (!guard(req, res)) return;
    const b = req.body || {};
    const action = b.action;

    if (action === "ping") {
      return ok(res, { project: "nagad-17cbb", time: Date.now() });
    }

    if (action === "settings.save") {
      const clean = sanitizeSettings(b.settings);
      if (!clean) return fail(res, 400, "Invalid settings payload");
      await db.ref("settings/global").update(clean);
      return ok(res, { saved: true, updatedAt: clean.updatedAt });
    }

    if (action === "deposits.list") {
      const snap = await db.ref("transactions").get();
      const val = snap.val() || {};
      const want = b.status || "pending";
      const list: any[] = [];
      
      // Transactions could be flat { txId: {...} } or nested under users { pid: { txId: {...} } }
      Object.entries(val).forEach(([k, t]) => {
        if (t && typeof t === 'object' && ('status' in t || 'trxId' in t)) {
          list.push(Object.assign({ txId: k }, t));
        } else if (t && typeof t === 'object') {
          Object.entries(t as any).forEach(([txId, subT]) => {
            if (subT && typeof subT === 'object') {
              list.push(Object.assign({ txId: k + "_" + txId }, subT));
            }
          });
        }
      });

      const filtered = list
        .filter(t => (t.status || "pending") === want)
        .sort((a, b2) => (b2.timestamp || b2.ts || 0) - (a.timestamp || a.ts || 0))
        .slice(0, 200);
      return ok(res, { deposits: filtered });
    }

    if (action === "deposits.approve") {
      const txId = String(b.txId || "");
      if (!txId) return fail(res, 400, "txId required");
      
      // Find transaction reference
      let tref = db.ref("transactions/" + txId);
      let snap = await tref.get();
      let tx = snap.val();
      
      if (!tx) {
        // Try searching flat or nested
        const allSnap = await db.ref("transactions").get();
        const allVal = allSnap.val() || {};
        for (const [k, v] of Object.entries(allVal)) {
          if (k === txId) { tx = v; tref = db.ref("transactions/" + k); break; }
          if (v && typeof v === 'object' && !('status' in v)) {
            for (const [sk, sv] of Object.entries(v as any)) {
              if (k + "_" + sk === txId) { tx = sv; tref = db.ref("transactions/" + k + "/" + sk); break; }
            }
          }
        }
      }

      if (!tx) return fail(res, 404, "Transaction not found");
      if (tx.status && tx.status !== "pending") return fail(res, 409, "Already processed: " + tx.status);

      const pid = String(b.pid || tx.pid || tx.wallet || "").trim();
      const amt = Math.round(Number(b.amount != null ? b.amount : tx.amount));
      if (!/^[A-Za-z0-9_-]{3,24}$/.test(pid)) return fail(res, 400, "User PID not found or invalid");
      if (!isFinite(amt) || amt <= 0) return fail(res, 400, "Invalid amount");

      const balRef = db.ref("users/" + pid + "/balance");
      const r = await balRef.transaction((cur: any) => (Number(cur) || 0) + amt);
      if (!r.committed) return fail(res, 500, "Balance transaction failed");

      const userRef = db.ref("users/" + pid);
      await userRef.transaction((cur: any) => {
        if (!cur) cur = { balance: amt, total_deposit: amt, createdAt: Date.now() };
        cur.lastAdjusted = Date.now();
        cur.total_deposit = Math.max(0, (Number(cur.total_deposit) || 0) + amt);
        return cur;
      });

      await tref.update({ status: "approved", approvedAt: Date.now(), creditedPid: pid, creditedAmount: amt });
      return ok(res, { txId, pid, amount: amt, newBalance: r.snapshot.val() });
    }

    if (action === "deposits.reject") {
      const txId = String(b.txId || "");
      if (!txId) return fail(res, 400, "txId required");
      const tref = db.ref("transactions/" + txId);
      await tref.update({ status: "rejected", rejectedAt: Date.now(), reason: String(b.reason || "").slice(0, 300) });
      return ok(res, { txId, status: "rejected" });
    }

    if (action === "users.delete") {
      const pid = String(b.pid || "").trim();
      if (!/^[A-Za-z0-9_-]{3,24}$/.test(pid)) return fail(res, 400, "Invalid pid");
      await db.ref("users/" + pid).remove();
      return ok(res, { deleted: pid });
    }

    if (action === "users.setBalance") {
      const pid = String(b.pid || "").trim();
      const amt = Math.round(Number(b.amount));
      if (!/^[A-Za-z0-9_-]{3,24}$/.test(pid)) return fail(res, 400, "Invalid pid");
      if (!isFinite(amt) || amt < 0) return fail(res, 400, "Invalid amount");
      await db.ref("users/" + pid).update({ pid, balance: amt, lastAdjusted: Date.now() });
      return ok(res, { pid, balance: amt });
    }

    return fail(res, 400, "Unknown action: " + action);
  } catch (e: any) {
    console.error("Admin action error:", e);
    return fail(res, 500, e.message || "Server error");
  }
});

// Serve gateway HTML pages directly
const resolveFile = (relativePaths: string[]) => {
  for (const rel of relativePaths) {
    const full = path.join(__dirname, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
};

app.get(['/bkash', '/bkash.html'], (req, res) => {
  const filePath = resolveFile(['public/bkash.html', 'dist/bkash.html']);
  if (filePath) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('bKash gateway file not found');
  }
});

app.get(['/nagad', '/nagad.html'], (req, res) => {
  const filePath = resolveFile(['public/nagad.html', 'dist/nagad.html']);
  if (filePath) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Nagad gateway file not found');
  }
});

app.get(['/extension.js', '/SX_PRO.user.js'], (req, res) => {
  const filePath = resolveFile(['public/extension.js', 'dist/extension.js']);
  if (filePath) {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Extension script not found');
  }
});

app.get('/admin', (req, res) => {
  res.redirect('/');
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: Date.now() });
});

// Setup Vite middleware for React SPA in development
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false }
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
