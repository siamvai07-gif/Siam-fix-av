/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DATABASE_URL = "https://nagad-17cbb-default-rtdb.firebaseio.com";
const ADMIN_KEY = process.env.ADMIN_KEY || "SIAMVIP";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function normBD(raw: any) {
  const s = String(raw == null ? "" : raw).replace(/[\s\-()]/g, "");
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

const isHttpUrl = (u: any) => typeof u === "string" && /^https?:\/\//i.test(u);

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
    const numbers = Array.isArray(g.numbers) ? g.numbers.map(sanitizeNumber).filter(Boolean).slice(0, 5) : [];
    gw[m] = {
      enabled: g.enabled !== false,
      url: typeof g.url === "string" ? g.url : "",
      logo_url: typeof g.logo_url === "string" ? g.logo_url : "",
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

export const handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: "Method Not Allowed" })
    };
  }

  try {
    let body: any = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid JSON" }) };
    }

    const key = event.headers["x-admin-key"] || event.headers["X-Admin-Key"] || body.key;
    if (!key || key !== ADMIN_KEY) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ ok: false, error: "Unauthorized: Invalid admin key" })
      };
    }

    const action = body.action;

    if (action === "ping") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, project: "nagad-17cbb", time: Date.now() })
      };
    }

    if (action === "settings.save") {
      const clean = sanitizeSettings(body.settings);
      if (!clean) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid settings payload" }) };
      }
      const res = await fetch(`${DATABASE_URL}/settings/global.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean)
      });
      if (!res.ok) {
        throw new Error(`Firebase returned ${res.status}`);
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, saved: true, updatedAt: clean.updatedAt })
      };
    }

    if (action === "deposits.list") {
      const res = await fetch(`${DATABASE_URL}/transactions.json`);
      const val = (await res.json()) || {};
      const want = body.status || "pending";
      const list: any[] = [];
      Object.entries(val).forEach(([k, t]: [string, any]) => {
        if (t && typeof t === "object" && ("status" in t || "trxId" in t)) {
          list.push({ txId: k, ...t });
        } else if (t && typeof t === "object") {
          Object.entries(t).forEach(([sk, sv]: [string, any]) => {
            if (sv && typeof sv === "object") {
              list.push({ txId: k + "_" + sk, ...sv });
            }
          });
        }
      });
      const filtered = list
        .filter(t => (t.status || "pending") === want)
        .sort((a, b) => (b.timestamp || b.ts || 0) - (a.timestamp || a.ts || 0))
        .slice(0, 200);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, deposits: filtered })
      };
    }

    if (action === "deposits.approve") {
      const txId = String(body.txId || "");
      if (!txId) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "txId required" }) };
      }

      // Check transaction existence & current status
      let path = `transactions/${txId}`;
      let txRes = await fetch(`${DATABASE_URL}/${path}.json`);
      let tx = await txRes.json();

      if (!tx) {
        // Try searching flat or nested
        const allRes = await fetch(`${DATABASE_URL}/transactions.json`);
        const allVal = (await allRes.json()) || {};
        for (const [k, v] of Object.entries(allVal)) {
          if (k === txId) {
            tx = v;
            path = `transactions/${k}`;
            break;
          }
          if (v && typeof v === "object" && !("status" in v)) {
            for (const [sk, sv] of Object.entries(v as any)) {
              if (k + "_" + sk === txId) {
                tx = sv;
                path = `transactions/${k}/${sk}`;
                break;
              }
            }
          }
        }
      }

      if (!tx) {
        return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: "Transaction not found" }) };
      }

      // Prevent duplicate approval & double balance credits
      if (tx.status && tx.status !== "pending") {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ ok: false, error: `Already processed with status: ${tx.status}` })
        };
      }

      const pid = String(body.pid || tx.pid || tx.wallet || "").trim();
      const amt = Math.round(Number(body.amount != null ? body.amount : tx.amount));
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(pid)) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "User PID invalid" }) };
      }
      if (!isFinite(amt) || amt <= 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid amount" }) };
      }

      // Read user current balance
      const userRes = await fetch(`${DATABASE_URL}/users/${pid}.json`);
      const user = (await userRes.json()) || { balance: 0, total_deposit: 0, createdAt: Date.now() };
      const newBal = (Number(user.balance) || 0) + amt;
      const newDep = (Number(user.total_deposit) || 0) + amt;

      // Update user
      await fetch(`${DATABASE_URL}/users/${pid}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid,
          balance: newBal,
          total_deposit: newDep,
          lastAdjusted: Date.now(),
          status: user.status || "active"
        })
      });

      // Mark transaction approved
      await fetch(`${DATABASE_URL}/${path}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          approvedAt: Date.now(),
          creditedPid: pid,
          creditedAmount: amt
        })
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, txId, pid, amount: amt, newBalance: newBal })
      };
    }

    if (action === "deposits.reject") {
      const txId = String(body.txId || "");
      if (!txId) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "txId required" }) };
      }
      await fetch(`${DATABASE_URL}/transactions/${txId}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          rejectedAt: Date.now(),
          reason: String(body.reason || "Rejected by admin").slice(0, 300)
        })
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, txId, status: "rejected" })
      };
    }

    if (action === "users.delete") {
      const pid = String(body.pid || "").trim();
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(pid)) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid pid" }) };
      }
      await fetch(`${DATABASE_URL}/users/${pid}.json`, { method: "DELETE" });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, deleted: pid }) };
    }

    if (action === "users.setBalance") {
      const pid = String(body.pid || "").trim();
      const amt = Math.round(Number(body.amount));
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(pid)) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid pid" }) };
      }
      if (!isFinite(amt) || amt < 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid amount" }) };
      }
      await fetch(`${DATABASE_URL}/users/${pid}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid, balance: amt, lastAdjusted: Date.now() })
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, pid, balance: amt }) };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, error: "Unknown action: " + action })
    };
  } catch (err: any) {
    console.error("Netlify function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message || "Internal server error" })
    };
  }
};
