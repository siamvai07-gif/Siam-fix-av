/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getDatabase, ref, onValue, get, set, update, remove 
} from 'firebase/database';
import { 
  Shield, Users, Wallet, TrendingUp, Clock, Plane, Receipt, Sliders, 
  Mail, Wrench, LogOut, Plus, Minus, Check, Trash2, Ban, 
  Unlock, Copy, ExternalLink, Play, AlertCircle, CheckCircle2, Globe, Cloud, Download, Settings, RefreshCw,
  Smartphone, Eye, Send, ArrowRight, X
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyAUzefLXQPVDu4yjDld0VASWqqs9MbtnB8",
  authDomain: "nagad-17cbb.firebaseapp.com",
  databaseURL: "https://nagad-17cbb-default-rtdb.firebaseio.com",
  projectId: "nagad-17cbb",
  storageBucket: "nagad-17cbb.firebasestorage.app",
  messagingSenderId: "728810825239",
  appId: "1:728810825239:web:5d19ab354464e33e87de52",
  measurementId: "G-RX4CZ26WT1"
};

const ADMIN_KEY = "SIAMVIP";
const appInstance = initializeApp(firebaseConfig);
const db = getDatabase(appInstance);

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => localStorage.getItem("rx_admin_authed") === "true");
  const [keyInput, setKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<string>("admin"); // admin | settings | simulator | docs

  // Admin state
  const [users, setUsers] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    gateways: {
      bkash: { enabled: true, url: "", logo_url: "", instructions: "", pick_mode: "random", active_number: "", numbers: [] },
      nagad: { enabled: true, url: "", logo_url: "", instructions: "", pick_mode: "random", active_number: "", numbers: [] }
    }
  });
  const [liveCount, setLiveCount] = useState<number>(0);
  const [connected, setConnected] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Balance tab state
  const [targetPid, setTargetPid] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceMsg, setBalanceMsg] = useState({ text: "", type: "" });

  // Create user state
  const [newPid, setNewPid] = useState("");
  const [newBal, setNewBal] = useState("");
  const [userMsg, setUserMsg] = useState({ text: "", type: "" });

  // Toast
  const [toast, setToast] = useState({ show: false, text: "", type: "ok" });

  // Gateway test & preview state
  const liveOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-n3jhxqdebubcsw2xdhssvs-51941593759.asia-east1.run.app';
  const [testPid, setTestPid] = useState("n74920158");
  const [testAmount, setTestAmount] = useState(1000);
  const [previewModal, setPreviewModal] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: "",
    title: ""
  });

  // Simulator state
  const [simPid] = useState<string>(() => {
    let p = localStorage.getItem("rx_sim_pid");
    if (!p) {
      p = "n" + Math.floor(10000000 + Math.random() * 89999999);
      localStorage.setItem("rx_sim_pid", p);
    }
    return p;
  });
  const [simBalance, setSimBalance] = useState<number>(0);
  const [simBet, setSimBet] = useState<number>(1000);
  const [simPlaying, setSimPlaying] = useState<boolean>(false);
  const [simMultiplier, setSimMultiplier] = useState<number>(1.00);
  const [simCrashed, setSimCrashed] = useState<boolean>(false);
  const [simWon, setSimWon] = useState<number | null>(null);

  const showToast = (text: string, type = "ok") => {
    setToast({ show: true, text, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3200);
  };

  const copyToClipboard = (text: string, label: string = "কপি হয়েছে") => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      showToast(label);
    } else {
      const el = document.createElement("input");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      showToast(label);
    }
  };

  const callAdminApi = async (action: string, payload: any = {}) => {
    try {
      let res = await fetch("/api/admin/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": ADMIN_KEY
        },
        body: JSON.stringify({ action, ...payload })
      });
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await fetch("/.netlify/functions/admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": ADMIN_KEY
          },
          body: JSON.stringify({ action, ...payload })
        });
      }
      return await res.json();
    } catch (e) {
      console.warn("Backend API error:", e);
      return { ok: false, error: String(e) };
    }
  };

  const handleCreateTestDeposit = async (method: 'bkash' | 'nagad', amt: number) => {
    try {
      const testTxId = "TRX_" + Math.random().toString(36).substring(2, 9).toUpperCase();
      const tRef = ref(db, "transactions/" + testTxId);
      const chosenWallet = method === 'bkash' ? '01854529933' : '01700000000';
      await set(tRef, {
        txId: testTxId,
        wallet: chosenWallet,
        method,
        amount: amt,
        currency: 'BDT',
        pid: testPid || simPid,
        timestamp: Date.now(),
        status: 'pending',
        userAgent: (navigator.userAgent || '').slice(0, 100)
      });
      showToast(`সফল! টেস্ট ${method.toUpperCase()} ডিপোজিট (${testTxId}) তৈরি হয়েছে`);
    } catch (e: any) {
      showToast("টেস্ট ডিপোজিট তৈরিতে সমস্যা: " + e.message, "err");
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyInput === ADMIN_KEY) {
      localStorage.setItem("rx_admin_authed", "true");
      setAuthed(true);
      showToast("সফলভাবে লগইন হয়েছে");
    } else {
      setLoginError("ভুল Admin key");
      setTimeout(() => setLoginError(""), 3000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("rx_admin_authed");
    setAuthed(false);
  };

  // RTDB Listeners
  useEffect(() => {
    if (!authed) return;

    const uRef = ref(db, "users");
    const unsubUsers = onValue(uRef, (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([pid, u]) => {
        const user = u as any;
        return {
          pid,
          balance: Number(user?.balance) || 0,
          total_deposit: Number(user?.total_deposit) || 0,
          lastSeen: user?.lastSeen || 0,
          createdAt: user?.createdAt || 0,
          status: user?.status || "active",
          blockedReason: user?.blockedReason || ""
        };
      });
      list.sort((a, b) => b.lastSeen - a.lastSeen);
      setUsers(list);
    });

    const sRef = ref(db, "settings/global");
    const unsubSettings = onValue(sRef, (snap) => {
      const val = snap.val();
      if (val) {
        setSettings(val);
      }
    });

    const lRef = ref(db, "live/rounds");
    const unsubLive = onValue(lRef, (snap) => {
      setLiveCount(snap.exists() ? Object.keys(snap.val()).length : 0);
    });

    const mRef = ref(db, "messages");
    const unsubMsg = onValue(mRef, (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([k, m]) => {
        const msg = m as any;
        return {
          _k: k,
          ...(typeof msg === 'object' && msg ? msg : { text: String(msg) })
        };
      });
      list.sort((a: any, b: any) => (b.timestamp || b.ts || 0) - (a.timestamp || a.ts || 0));
      setMessages(list);
    });

    const cRef = ref(db, ".info/connected");
    const unsubConn = onValue(cRef, (snap) => {
      setConnected(!!snap.val());
    });

    const tRef = ref(db, "transactions");
    const unsubTx = onValue(tRef, (snap) => {
      const val = snap.val() || {};
      const list: any[] = [];
      Object.entries(val).forEach(([k, t]) => {
        const tx = t as any;
        if (tx && typeof tx === 'object' && ('status' in tx || 'trxId' in tx)) {
          list.push({ txId: k, ...tx });
        } else if (tx && typeof tx === 'object') {
          Object.entries(tx).forEach(([sk, sv]) => {
            const subTx = sv as any;
            if (subTx && typeof subTx === 'object') {
              list.push({ txId: k + "_" + sk, ...subTx });
            }
          });
        }
      });
      const pending = list.filter(t => (t.status || "pending") === "pending");
      pending.sort((a, b) => (b.timestamp || b.ts || 0) - (a.timestamp || a.ts || 0));
      setDeposits(pending);
    });

    return () => {
      unsubUsers();
      unsubSettings();
      unsubLive();
      unsubMsg();
      unsubConn();
      unsubTx();
    };
  }, [authed]);

  // Simulator user sync
  useEffect(() => {
    const simRef = ref(db, "users/" + simPid);
    get(simRef).then(snap => {
      if (!snap.exists()) {
        set(simRef, {
          pid: simPid,
          balance: 5000,
          total_deposit: 5000,
          createdAt: Date.now(),
          lastSeen: Date.now(),
          status: "active"
        });
        setSimBalance(5000);
      } else {
        const u = snap.val();
        setSimBalance(Number(u.balance) || 0);
      }
    });

    const unsub = onValue(simRef, snap => {
      if (snap.exists()) {
        const u = snap.val();
        if (typeof u.balance === "number") setSimBalance(u.balance);
      }
    });

    return () => unsub();
  }, [simPid]);

  const totalUsers = users.length;
  const totalBalance = users.reduce((acc, u) => acc + u.balance, 0);
  const totalDeposit = users.reduce((acc, u) => acc + u.total_deposit, 0);
  const dayAgo = Date.now() - 86400000;
  const active24h = users.filter(u => u.lastSeen > dayAgo).length;

  const handleApplyBalance = async () => {
    if (!targetPid) {
      setBalanceMsg({ text: "Player ID দিন", type: "err" });
      return;
    }
    const amt = Number(balanceAmount);
    if (isNaN(amt) || amt === 0) {
      setBalanceMsg({ text: "সঠিক পরিমাণ দিন", type: "err" });
      return;
    }

    try {
      const uRef = ref(db, "users/" + targetPid);
      const snap = await get(uRef);
      const cur = snap.val();
      const curBal = cur ? Number(cur.balance) || 0 : 0;
      const newBal = Math.max(0, curBal + amt);
      const curDep = cur ? Number(cur.total_deposit) || 0 : 0;
      const newDep = Math.max(0, curDep + (amt > 0 ? amt : 0));

      await set(uRef, {
        pid: targetPid,
        balance: newBal,
        total_deposit: newDep,
        createdAt: cur?.createdAt || Date.now(),
        lastSeen: cur?.lastSeen || Date.now(),
        lastAdjusted: Date.now(),
        status: cur?.status || "active",
        blockedReason: cur?.blockedReason || ""
      });

      setBalanceMsg({ text: `সফল! নতুন ব্যালেন্স ৳${newBal}`, type: "ok" });
      showToast(`ব্যালেন্স আপডেট: ৳${newBal}`);
      setBalanceAmount("");
    } catch (e: any) {
      setBalanceMsg({ text: "ত্রুটি: " + e.message, type: "err" });
    }
  };

  const handleCreateUser = async () => {
    if (!newPid) {
      setUserMsg({ text: "Player ID দিন", type: "err" });
      return;
    }
    const bal = Math.max(0, Number(newBal) || 0);
    try {
      const uRef = ref(db, "users/" + newPid);
      const snap = await get(uRef);
      if (snap.exists()) {
        setUserMsg({ text: "এই Player ID আগেই আছে", type: "err" });
        return;
      }
      await set(uRef, {
        pid: newPid,
        balance: bal,
        total_deposit: bal,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        lastAdjusted: Date.now(),
        status: "active",
        blockedReason: ""
      });
      setUserMsg({ text: "ইউজার সফলভাবে তৈরি হয়েছে", type: "ok" });
      showToast("ইউজার তৈরি: " + newPid);
      setNewPid("");
      setNewBal("");
    } catch (e: any) {
      setUserMsg({ text: "ত্রুটি: " + e.message, type: "err" });
    }
  };

  const handleApproveDeposit = async (tx: any) => {
    const pid = tx.pid || tx.wallet;
    const amt = Number(tx.amount) || 0;
    if (!pid || amt <= 0) {
      showToast("ডিপোজিট ডেটায় PID বা amount নেই", "err");
      return;
    }
    if (tx.status && tx.status !== "pending") {
      showToast("এই ডিপোজিট ইতিমধ্যে " + tx.status + " হয়েছে!", "err");
      return;
    }
    try {
      let approved = false;
      try {
        const apiRes = await callAdminApi("deposits.approve", { txId: tx.txId, pid, amount: amt });
        if (apiRes && apiRes.ok) approved = true;
      } catch (err) {
        console.warn("Backend API approve fallback to client:", err);
      }

      if (!approved) {
        const uRef = ref(db, "users/" + pid);
        const snap = await get(uRef);
        const cur = snap.val() || { balance: 0, total_deposit: 0 };
        const newBal = (Number(cur.balance) || 0) + amt;
        const newDep = (Number(cur.total_deposit) || 0) + amt;

        await update(uRef, {
          balance: newBal,
          total_deposit: newDep,
          lastAdjusted: Date.now()
        });

        const tRef = ref(db, "transactions/" + tx.txId);
        await update(tRef, { status: "approved", approvedAt: Date.now() });
      }

      showToast(`ডিপোজিট অ্যাপ্রুভড! ৳${amt} ক্রেডিট হয়েছে`);
    } catch (e: any) {
      showToast("ত্রুটি: " + e.message, "err");
    }
  };

  const handleRejectDeposit = async (txId: string) => {
    try {
      let rejected = false;
      try {
        const apiRes = await callAdminApi("deposits.reject", { txId });
        if (apiRes && apiRes.ok) rejected = true;
      } catch (err) {
        console.warn("Backend API reject fallback to client:", err);
      }

      if (!rejected) {
        const tRef = ref(db, "transactions/" + txId);
        await update(tRef, { status: "rejected", rejectedAt: Date.now() });
      }
      showToast("ডিপোজিট রিজেক্ট করা হয়েছে");
    } catch (e: any) {
      showToast("ত্রুটি: " + e.message, "err");
    }
  };

  const toggleBlockUser = async (u: any) => {
    const nextStatus = u.status === "blocked" ? "active" : "blocked";
    try {
      await update(ref(db, "users/" + u.pid), { status: nextStatus, lastAdjusted: Date.now() });
      showToast(nextStatus === "blocked" ? "ইউজার ব্লক করা হয়েছে" : "ইউজার আনব্লক করা হয়েছে");
    } catch (e: any) {
      showToast("ত্রুটি: " + e.message, "err");
    }
  };

  const handleDeleteUser = async (pid: string) => {
    if (!confirm(`${pid} ডিলিট করতে চান?`)) return;
    try {
      let deleted = false;
      try {
        const apiRes = await callAdminApi("users.delete", { pid });
        if (apiRes && apiRes.ok) deleted = true;
      } catch (err) {
        console.warn("Backend API delete user fallback:", err);
      }

      if (!deleted) {
        await remove(ref(db, "users/" + pid));
      }
      showToast("ইউজার মুছে ফেলা হয়েছে");
    } catch (e: any) {
      showToast("ত্রুটি: " + e.message, "err");
    }
  };

  // Save Settings handler
  const handleSaveSettings = async () => {
    try {
      let saved = false;
      try {
        const apiRes = await callAdminApi("settings.save", { settings });
        if (apiRes && apiRes.ok) saved = true;
      } catch (err) {
        console.warn("Backend API save settings fallback:", err);
      }

      if (!saved) {
        const sRef = ref(db, "settings/global");
        await set(sRef, {
          ...settings,
          updatedAt: Date.now()
        });
      }

      // Mirror to settings/bkash and settings/nagad for complete compatibility
      try {
        if (settings?.gateways?.bkash) {
          const bkRef = ref(db, "settings/bkash");
          await update(bkRef, {
            walletNumber: settings.gateways.bkash.active_number || (settings.gateways.bkash.numbers?.[0]?.number) || "01854529933",
            instruction: settings.gateways.bkash.instructions || "",
            logoUrl: settings.gateways.bkash.logo_url || "",
            numbers: settings.gateways.bkash.numbers || []
          }).catch(() => {});
        }
        if (settings?.gateways?.nagad) {
          const ngRef = ref(db, "settings/nagad");
          await update(ngRef, {
            walletNumber: settings.gateways.nagad.active_number || (settings.gateways.nagad.numbers?.[0]?.number) || "01700000000",
            instruction: settings.gateways.nagad.instructions || "",
            logoUrl: settings.gateways.nagad.logo_url || "",
            numbers: settings.gateways.nagad.numbers || []
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Mirror settings write:", err);
      }

      showToast("সেটিংস সফলভাবে সেভ হয়েছে!");
    } catch (e: any) {
      showToast("সেটিংস সেভ করতে সমস্যা: " + e.message, "err");
    }
  };

  const updateGatewayField = (method: string, field: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      gateways: {
        ...prev.gateways,
        [method]: {
          ...prev.gateways[method],
          [field]: value
        }
      }
    }));
  };

  const addReceiverNumber = (method: string) => {
    setSettings((prev: any) => {
      const gw = prev.gateways[method] || { numbers: [] };
      const nums = gw.numbers || [];
      if (nums.length >= 5) {
        showToast("সর্বোচ্চ ৫টি নম্বর যোগ করা যাবে", "err");
        return prev;
      }
      const newNum = { id: "n" + Date.now(), label: "Agent " + (nums.length + 1), number: "01700000000", active: true };
      return {
        ...prev,
        gateways: {
          ...prev.gateways,
          [method]: {
            ...gw,
            numbers: [...nums, newNum]
          }
        }
      };
    });
  };

  const updateReceiverNumber = (method: string, index: number, field: string, value: any) => {
    setSettings((prev: any) => {
      const gw = prev.gateways[method];
      const nums = [...(gw.numbers || [])];
      nums[index] = { ...nums[index], [field]: value };
      return {
        ...prev,
        gateways: {
          ...prev.gateways,
          [method]: {
            ...gw,
            numbers: nums
          }
        }
      };
    });
  };

  const deleteReceiverNumber = (method: string, index: number) => {
    setSettings((prev: any) => {
      const gw = prev.gateways[method];
      const nums = [...(gw.numbers || [])];
      nums.splice(index, 1);
      return {
        ...prev,
        gateways: {
          ...prev.gateways,
          [method]: {
            ...gw,
            numbers: nums
          }
        }
      };
    });
  };

  const handleSimBet = async () => {
    if (simBalance < simBet) {
      showToast("অপর্যাপ্ত ব্যালেন্স!", "err");
      return;
    }
    const newBal = simBalance - simBet;
    await update(ref(db, "users/" + simPid), { balance: newBal, lastAdjusted: Date.now() });
    setSimBalance(newBal);
    setSimPlaying(true);
    setSimMultiplier(1.00);
    setSimCrashed(false);
    setSimWon(null);

    let currentM = 1.00;
    const crashAt = 1.1 + Math.random() * 4.5;
    const timer = setInterval(() => {
      currentM += 0.08;
      if (currentM >= crashAt) {
        clearInterval(timer);
        setSimCrashed(true);
        setSimPlaying(false);
      } else {
        setSimMultiplier(Number(currentM.toFixed(2)));
      }
    }, 200);
  };

  const handleSimCashout = async () => {
    if (!simPlaying) return;
    const payout = Math.round(simBet * simMultiplier);
    const newBal = simBalance + payout;
    await update(ref(db, "users/" + simPid), { balance: newBal, lastAdjusted: Date.now() });
    setSimBalance(newBal);
    setSimWon(payout);
    setSimPlaying(false);
    showToast(`উইনিং ৳${payout} (${simMultiplier}x)!`);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0a0b0e] text-[#e8eaee] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#13151a] border border-[#23262c] rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-tr from-[#28a909] to-[#0dcc24] flex items-center justify-center text-3xl text-white shadow-lg">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold mb-1">RX Admin Panel</h1>
          <p className="text-xs text-[#8a8e97] mb-6">প্রবেশ করতে Admin key দিন (ডিফল্ট: SIAMVIP)</p>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              value={keyInput} 
              onChange={e => setKeyInput(e.target.value)} 
              placeholder="• • • • • • •" 
              className="w-full px-4 py-3 rounded-xl bg-[#0e1013] border border-[#23262c] text-center font-bold tracking-widest text-white focus:border-[#28a909] outline-none mb-4"
            />
            <button type="submit" className="w-full py-3 rounded-xl bg-[#28a909] hover:bg-[#1f8806] font-bold text-white transition flex items-center justify-center gap-2">
              <span>লগইন</span>
            </button>
          </form>
          {loginError && <p className="text-xs text-[#e5322d] mt-3 font-bold">{loginError}</p>}
          <p className="text-[10px] text-[#8a8e97] mt-6 leading-relaxed">সম্পূর্ণ সিস্টেম ফায়ারবেস রিয়েলটাইম ডাটাবেস দিয়ে সুরক্ষিত এবং সিঙ্ককৃত।</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-[#e8eaee] p-4 pb-24 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#28a909] to-[#0dcc24] flex items-center justify-center text-white shadow-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold flex items-center gap-2">
              RX Admin System 
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#28a909]' : 'bg-[#e5322d]'}`} title={connected ? "Connected" : "Disconnected"}></span>
            </h1>
            <span className="text-xs text-[#8a8e97]">Firebase Realtime DB · nagad-17cbb</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setTab("admin")} className={`px-3 py-2 rounded-xl text-xs font-bold transition ${tab === 'admin' ? 'bg-[#28a909] text-white' : 'bg-[#1a1d23] text-[#8a8e97]'}`}>Admin Panel</button>
          <button onClick={() => setTab("settings")} className={`px-3 py-2 rounded-xl text-xs font-bold transition ${tab === 'settings' ? 'bg-[#28a909] text-white' : 'bg-[#1a1d23] text-[#8a8e97]'}`}>Gateway Settings</button>
          <button onClick={() => setTab("simulator")} className={`px-3 py-2 rounded-xl text-xs font-bold transition ${tab === 'simulator' ? 'bg-[#28a909] text-white' : 'bg-[#1a1d23] text-[#8a8e97]'}`}>Aviator Simulator</button>
          <button onClick={() => setTab("docs")} className={`px-3 py-2 rounded-xl text-xs font-bold transition ${tab === 'docs' ? 'bg-[#28a909] text-white' : 'bg-[#1a1d23] text-[#8a8e97]'}`}>Gateways & Extension</button>
          <button onClick={handleLogout} className="px-3 py-2 rounded-xl bg-[#1a1d23] border border-[#23262c] text-[#8a8e97] hover:text-[#e5322d] hover:border-[#e5322d] text-xs font-bold flex items-center gap-1.5 transition">
            <LogOut className="w-4 h-4" /> লগআউট
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-4">
          <div className="w-8 h-8 rounded-lg bg-[rgba(40,169,9,0.12)] text-[#28a909] flex items-center justify-center mb-2"><Users className="w-4 h-4" /></div>
          <span className="text-[10px] uppercase font-bold text-[#8a8e97]">মোট ইউজার</span>
          <b className="text-xl font-ext500">{totalUsers}</b>
        </div>
        <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-4">
          <div className="w-8 h-8 rounded-lg bg-[rgba(62,166,255,0.12)] text-[#3ea6ff] flex items-center justify-center mb-2"><Wallet className="w-4 h-4" /></div>
          <span className="text-[10px] uppercase font-bold text-[#8a8e97]">মোট ব্যালেন্স</span>
          <b className="text-xl font-ext500">৳{totalBalance.toLocaleString()}</b>
        </div>
        <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-4">
          <div className="w-8 h-8 rounded-lg bg-[rgba(255,184,46,0.12)] text-[#ffb82e] flex items-center justify-center mb-2"><TrendingUp className="w-4 h-4" /></div>
          <span className="text-[10px] uppercase font-bold text-[#8a8e97]">মোট ডিপোজিট</span>
          <b className="text-xl font-ext500">৳{totalDeposit.toLocaleString()}</b>
        </div>
        <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-4">
          <div className="w-8 h-8 rounded-lg bg-[rgba(229,50,45,0.12)] text-[#e5322d] flex items-center justify-center mb-2"><Clock className="w-4 h-4" /></div>
          <span className="text-[10px] uppercase font-bold text-[#8a8e97]">২৪ঘ অ্যাক্টিভ</span>
          <b className="text-xl font-ext500">{active24h}</b>
        </div>
        <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-4">
          <div className="w-8 h-8 rounded-lg bg-[rgba(62,166,255,0.12)] text-[#3ea6ff] flex items-center justify-center mb-2"><Plane className="w-4 h-4" /></div>
          <span className="text-[10px] uppercase font-bold text-[#8a8e97]">লাইভ রাউন্ড</span>
          <b className="text-xl font-ext500">{liveCount}</b>
        </div>
        <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-4">
          <div className="w-8 h-8 rounded-lg bg-[rgba(255,184,46,0.12)] text-[#ffb82e] flex items-center justify-center mb-2"><Receipt className="w-4 h-4" /></div>
          <span className="text-[10px] uppercase font-bold text-[#8a8e97]">পেন্ডিং ডিপোজিট</span>
          <b className="text-xl font-ext500">{deposits.length}</b>
        </div>
      </div>

      {tab === 'admin' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-[#28a909]" /> ইউজার ম্যানেজমেন্ট</h3>
                
                <div className="flex gap-2 mb-4">
                  <input 
                    type="search" 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="🔍 Player ID দিয়ে খুঁজুন..." 
                    className="flex-1 bg-[#0e1013] border border-[#23262c] rounded-xl px-4 py-2 text-sm text-white focus:border-[#28a909] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-[#1a1d23] border border-dashed border-[#23262c] rounded-xl mb-4">
                  <input 
                    type="text" 
                    value={newPid} 
                    onChange={e => setNewPid(e.target.value)}
                    placeholder="নতুন Player ID" 
                    className="bg-[#0e1013] border border-[#23262c] rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <input 
                    type="number" 
                    value={newBal} 
                    onChange={e => setNewBal(e.target.value)}
                    placeholder="প্রাথমিক ব্যালেন্স ৳" 
                    className="bg-[#0e1013] border border-[#23262c] rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <button onClick={handleCreateUser} className="bg-[#28a909] hover:bg-[#1f8806] text-white rounded-lg text-xs font-bold py-2 flex items-center justify-center gap-1.5 transition">
                    <Plus className="w-3.5 h-3.5" /> তৈরি করুন
                  </button>
                </div>
                {userMsg.text && <p className={`text-xs font-bold mb-3 ${userMsg.type === 'err' ? 'text-[#e5322d]' : 'text-[#28a909]'}`}>{userMsg.text}</p>}

                <div className="overflow-x-auto max-h-[350px] overflow-y-auto rounded-xl border border-[#23262c]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1a1d23] text-[#8a8e97] uppercase font-bold sticky top-0">
                      <tr>
                        <th className="p-3">Player ID</th>
                        <th className="p-3">ব্যালেন্স</th>
                        <th className="p-3">ডিপোজিট</th>
                        <th className="p-3">স্ট্যাটাস</th>
                        <th className="p-3 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23262c]">
                      {users.filter(u => u.pid.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                        <tr key={u.pid} className="hover:bg-[#1a1d23]/50">
                          <td className="p-3 font-mono font-bold text-[#3ea6ff] flex items-center gap-2">
                            {u.pid}
                            {u.status === 'blocked' && <span className="text-[9px] bg-[rgba(229,50,45,0.15)] text-[#e5322d] px-1.5 py-0.5 rounded">ব্লকড</span>}
                          </td>
                          <td className="p-3 font-bold text-[#28a909]">৳{u.balance.toLocaleString()}</td>
                          <td className="p-3 text-[#8a8e97]">৳{u.total_deposit.toLocaleString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${u.status === 'blocked' ? 'bg-[rgba(229,50,45,0.15)] text-[#e5322d]' : 'bg-[rgba(40,169,9,0.15)] text-[#28a909]'}`}>
                              {u.status || 'active'}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1">
                            <button onClick={() => setTargetPid(u.pid)} title="ব্যালেন্স এডিট" className="p-1.5 bg-[#1a1d23] hover:bg-[#23262c] rounded text-[#8a8e97] hover:text-white"><Sliders className="w-3.5 h-3.5" /></button>
                            <button onClick={() => toggleBlockUser(u)} title={u.status === 'blocked' ? "আনব্লক" : "ব্লক"} className="p-1.5 bg-[#1a1d23] hover:bg-[#23262c] rounded text-[#8a8e97] hover:text-[#ffb82e]">
                              {u.status === 'blocked' ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => handleDeleteUser(u.pid)} title="ডিলিট" className="p-1.5 bg-[#1a1d23] hover:bg-[#23262c] rounded text-[#8a8e97] hover:text-[#e5322d]"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4"><Wallet className="w-4 h-4 text-[#3ea6ff]" /> ব্যালেন্স অ্যাড / কমানো</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#8a8e97] block mb-1">Player ID</label>
                    <input 
                      type="text" 
                      value={targetPid} 
                      onChange={e => setTargetPid(e.target.value)} 
                      placeholder="12345678" 
                      className="w-full bg-[#0e1013] border border-[#23262c] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#28a909]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#8a8e97] block mb-1">পরিমাণ (৳) — ঋণাত্মক দিলে কমবে</label>
                    <input 
                      type="number" 
                      value={balanceAmount} 
                      onChange={e => setBalanceAmount(e.target.value)} 
                      placeholder="500" 
                      className="w-full bg-[#0e1013] border border-[#23262c] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#28a909]"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setBalanceAmount("100")} className="px-3 py-1.5 bg-[#1a1d23] border border-[#23262c] hover:border-[#28a909] rounded-lg text-xs font-bold">+100</button>
                  <button onClick={() => setBalanceAmount("500")} className="px-3 py-1.5 bg-[#1a1d23] border border-[#23262c] hover:border-[#28a909] rounded-lg text-xs font-bold">+500</button>
                  <button onClick={() => setBalanceAmount("1000")} className="px-3 py-1.5 bg-[#1a1d23] border border-[#23262c] hover:border-[#28a909] rounded-lg text-xs font-bold">+1,000</button>
                  <button onClick={() => setBalanceAmount("5000")} className="px-3 py-1.5 bg-[#1a1d23] border border-[#23262c] hover:border-[#28a909] rounded-lg text-xs font-bold">+5,000</button>
                  <button onClick={() => setBalanceAmount("-500")} className="px-3 py-1.5 bg-[#1a1d23] border border-[#23262c] hover:border-[#e5322d] rounded-lg text-xs font-bold text-[#e5322d]">-500</button>
                </div>
                <button onClick={handleApplyBalance} className="w-full py-3 bg-[#28a909] hover:bg-[#1f8806] text-white font-bold rounded-xl transition flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> প্রয়োগ করুন
                </button>
                {balanceMsg.text && <p className={`text-xs font-bold mt-2 ${balanceMsg.type === 'err' ? 'text-[#e5322d]' : 'text-[#28a909]'}`}>{balanceMsg.text}</p>}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4"><Receipt className="w-4 h-4 text-[#ffb82e]" /> পেন্ডিং ডিপোজিট ({deposits.length})</h3>
                <div className="space-y-3 max-h-[420px] overflow-y-auto">
                  {deposits.length === 0 ? (
                    <div className="text-center py-8 text-[#8a8e97] text-xs">কোনো পেন্ডিং ডিপোজিট নেই</div>
                  ) : (
                    deposits.map(d => (
                      <div key={d.txId} className="bg-[#0e1013] border border-[#23262c] rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-[#3ea6ff]">{d.trxId || d.txId}</span>
                          <span className="px-2 py-0.5 rounded bg-[rgba(255,184,46,0.15)] text-[#ffb82e] font-bold uppercase text-[9px]">{d.method || 'bkash'}</span>
                        </div>
                        <div className="text-xs text-[#8a8e97] space-y-1">
                          <p>PID: <strong className="text-white">{d.pid || d.wallet || '—'}</strong></p>
                          <p>পরিমাণ: <strong className="text-[#28a909] text-sm font-extrabold">৳{Number(d.amount || 0).toLocaleString()}</strong></p>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => handleApproveDeposit(d)} className="flex-1 py-1.5 bg-[#28a909] hover:bg-[#1f8806] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                            <Check className="w-3.5 h-3.5" /> অ্যাপ্রুভ
                          </button>
                          <button onClick={() => handleRejectDeposit(d.txId)} className="flex-1 py-1.5 bg-[#e5322d] hover:bg-[#c22a25] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                            <Ban className="w-3.5 h-3.5" /> রিজেক্ট
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4"><Mail className="w-4 h-4 text-[#3ea6ff]" /> মেসেজ লগ ({messages.length})</h3>
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto text-xs">
                  {messages.length === 0 ? (
                    <div className="text-center py-6 text-[#8a8e97]">কোনো মেসেজ নেই</div>
                  ) : (
                    messages.slice(0, 30).map((m: any, i: number) => (
                      <div key={i} className="bg-[#0e1013] border border-[#23262c] rounded-xl p-3">
                        <div className="flex justify-between text-[#8a8e97] text-[10px] mb-1">
                          <span className="font-mono text-[#3ea6ff]">{m.pid || m.from || "system"}</span>
                          <span>{m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ""}</span>
                        </div>
                        <p className="text-[#e8eaee] leading-relaxed">{m.text || m.message || JSON.stringify(m)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <Settings className="w-6 h-6 text-[#28a909]" /> bKash & Nagad Gateway Settings
            </h2>
            <button onClick={handleSaveSettings} className="px-5 py-2.5 bg-[#28a909] hover:bg-[#1f8806] text-white font-extrabold rounded-xl text-sm transition flex items-center gap-2 shadow-lg">
              <Check className="w-4 h-4" /> সমস্ত সেটিংস সেভ করুন
            </button>
          </div>

          {(['bkash', 'nagad'] as const).map(method => {
            const gw = settings.gateways?.[method] || { enabled: true, url: "", logo_url: "", instructions: "", pick_mode: "random", numbers: [] };
            const isBkash = method === 'bkash';
            return (
              <div key={method} className="bg-[#13151a] border border-[#23262c] rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#23262c]">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${isBkash ? 'bg-[#b30068]' : 'bg-[#e74738]'}`}>
                      {isBkash ? 'bK' : 'NG'}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base capitalize">{method} Gateway</h3>
                      <span className="text-xs text-[#8a8e97]">Manage receiver numbers (3–5 numbers), URLs & instructions</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-[#8a8e97]">{gw.enabled ? 'চালু' : 'বন্ধ'}</span>
                    <input 
                      type="checkbox" 
                      checked={gw.enabled !== false} 
                      onChange={e => updateGatewayField(method, 'enabled', e.target.checked)}
                      className="w-5 h-5 accent-[#28a909]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#8a8e97] block mb-1">গেটওয়ে URL</label>
                    <input 
                      type="url" 
                      value={gw.url || ""} 
                      onChange={e => updateGatewayField(method, 'url', e.target.value)}
                      placeholder={`https://${method}-paybd.netlify.app/`}
                      className="w-full bg-[#0e1013] border border-[#23262c] rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#28a909]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#8a8e97] block mb-1">ওয়ালেট লোগো URL</label>
                    <input 
                      type="url" 
                      value={gw.logo_url || ""} 
                      onChange={e => updateGatewayField(method, 'logo_url', e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full bg-[#0e1013] border border-[#23262c] rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#28a909]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#8a8e97] block mb-1">নম্বর সিলেকশন মোড</label>
                    <select 
                      value={gw.pick_mode || 'random'} 
                      onChange={e => updateGatewayField(method, 'pick_mode', e.target.value)}
                      className="w-full bg-[#0e1013] border border-[#23262c] rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#28a909]"
                    >
                      <option value="random">🎲 Random (প্রতিবার এলোমেলো)</option>
                      <option value="round_robin">🔄 Round Robin (পর্যায়ক্রমে rotation)</option>
                      <option value="fixed">📌 Fixed (একটি নির্দিষ্ট নম্বর)</option>
                    </select>
                  </div>
                  {gw.pick_mode === 'fixed' && (
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#8a8e97] block mb-1">Active Number (Fixed মোড)</label>
                      <select 
                        value={gw.active_number || ""} 
                        onChange={e => updateGatewayField(method, 'active_number', e.target.value)}
                        className="w-full bg-[#0e1013] border border-[#23262c] rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#28a909]"
                      >
                        <option value="">— নম্বর নির্বাচন করুন —</option>
                        {(gw.numbers || []).map((n: any) => (
                          <option key={n.id} value={n.id}>{n.label || 'Agent'} — {n.number}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#8a8e97] block mb-1">ডিপোজিট ইন্সট্রাকশন / নির্দেশাবলী</label>
                  <textarea 
                    value={gw.instructions || ""} 
                    onChange={e => updateGatewayField(method, 'instructions', e.target.value)}
                    placeholder="১) নিচের নম্বরে Send Money করুন..."
                    className="w-full bg-[#0e1013] border border-[#23262c] rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#28a909] h-20"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-[#8a8e97]">রিসিভার নম্বরসমূহ (৩–৫টি recommended)</label>
                    <button onClick={() => addReceiverNumber(method)} className="px-3 py-1.5 bg-[#1a1d23] hover:bg-[#23262c] text-[#28a909] border border-[#23262c] rounded-lg text-xs font-bold flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> নম্বর যোগ করুন
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(!gw.numbers || gw.numbers.length === 0) ? (
                      <div className="text-xs text-[#8a8e97] p-4 bg-[#0e1013] border border-[#23262c] rounded-xl text-center">কোনো নম্বর যোগ করা হয়নি। উপরে নম্বর যোগ করুন।</div>
                    ) : (
                      gw.numbers.map((n: any, idx: number) => (
                        <div key={n.id || idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-[#0e1013] border border-[#23262c] rounded-xl p-3">
                          <div className="md:col-span-3">
                            <input 
                              type="text" 
                              value={n.label || ""} 
                              onChange={e => updateReceiverNumber(method, idx, 'label', e.target.value)}
                              placeholder="লেবেল (যেমন Agent 1)" 
                              className="w-full bg-[#1a1d23] border border-[#23262c] rounded-lg px-3 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="md:col-span-5">
                            <input 
                              type="text" 
                              value={n.number || ""} 
                              onChange={e => updateReceiverNumber(method, idx, 'number', e.target.value)}
                              placeholder="01700000000" 
                              className="w-full bg-[#1a1d23] border border-[#23262c] rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold text-[#3ea6ff]"
                            />
                          </div>
                          <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#8a8e97]">
                              <span>Active</span>
                              <input 
                                type="checkbox" 
                                checked={n.active !== false} 
                                onChange={e => updateReceiverNumber(method, idx, 'active', e.target.checked)}
                                className="w-4 h-4 accent-[#28a909]"
                              />
                            </label>
                            <button onClick={() => deleteReceiverNumber(method, idx)} className="p-1.5 bg-[#1a1d23] hover:bg-[rgba(229,50,45,0.2)] text-[#e5322d] rounded-lg transition" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'simulator' && (
        <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-6 max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-extrabold flex items-center justify-center gap-2">
              <Plane className="w-6 h-6 text-[#28a909]" /> Aviator & Extension Simulator
            </h2>
            <p className="text-xs text-[#8a8e97]">আপনার ইউজার ID ({simPid}) দিয়ে রিয়েলটাইম ব্যালেন্স সিঙ্ক এবং ডিপোজিট গেটওয়ে পরীক্ষা করুন।</p>
          </div>

          <div className="bg-[#0e1013] border border-[#23262c] rounded-2xl p-6 text-center space-y-4">
            <span className="text-xs text-[#8a8e97] uppercase font-bold">রিয়েলটাইম ব্যালেন্স (Firebase RTDB)</span>
            <div className="text-4xl font-extrabold text-[#28a909]">৳{simBalance.toLocaleString()}</div>
            <div className="flex justify-center gap-3">
              <button onClick={() => {
                const amount = 1000;
                window.location.href = `/bkash?amount=${amount}&rx_pid=${simPid}`;
              }} className="px-4 py-2.5 rounded-xl bg-[#b30068] hover:bg-[#900052] text-white text-xs font-bold flex items-center gap-2 transition">
                <span>bKash ৳1,000 ডিপোজিট</span>
              </button>
              <button onClick={() => {
                const amount = 500;
                window.location.href = `/nagad?amount=${amount}&rx_pid=${simPid}`;
              }} className="px-4 py-2.5 rounded-xl bg-[#e74738] hover:bg-[#c2372a] text-white text-xs font-bold flex items-center gap-2 transition">
                <span>Nagad ৳500 ডিপোজিট</span>
              </button>
            </div>
          </div>

          <div className="bg-[#000] border border-[#23262c] rounded-2xl p-6 text-center relative overflow-hidden space-y-6 min-h-[280px] flex flex-col justify-center items-center">
            <div className="absolute top-4 left-4 text-xs font-bold text-[#8a8e97]">DEMO AVIATOR ROUND</div>
            {simPlaying && (
              <div className="text-6xl font-black text-white animate-pulse">{simMultiplier.toFixed(2)}x</div>
            )}
            {simCrashed && (
              <div className="text-2xl font-extrabold text-[#e5322d]">FLEW AWAY! ({simMultiplier.toFixed(2)}x)</div>
            )}
            {simWon !== null && (
              <div className="text-xl font-extrabold text-[#28a909]">ক্যাশ আউট সফল! জিতেছেন ৳{simWon.toLocaleString()}</div>
            )}
            {!simPlaying && !simCrashed && simWon === null && (
              <div className="text-xl font-bold text-[#8a8e97]">রাউন্ড শুরু হওয়ার অপেক্ষায়...</div>
            )}

            <div className="flex items-center gap-3 w-full max-w-sm">
              <input 
                type="number" 
                value={simBet} 
                onChange={e => setSimBet(Number(e.target.value))} 
                className="w-1/2 bg-[#1a1d23] border border-[#23262c] rounded-xl px-4 py-3 text-center font-bold text-white"
              />
              {!simPlaying ? (
                <button onClick={handleSimBet} className="w-1/2 py-3 bg-[#28a909] hover:bg-[#1f8806] text-white font-extrabold rounded-xl transition">
                  বেট ধরুন (৳{simBet})
                </button>
              ) : (
                <button onClick={handleSimCashout} className="w-1/2 py-3 bg-[#ffb82e] hover:bg-[#e09e1e] text-black font-extrabold rounded-xl transition animate-bounce">
                  ক্যাশ আউট
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'docs' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-extrabold flex items-center gap-2">
                  <Globe className="w-6 h-6 text-[#3ea6ff]" /> লাইভ হোস্ট এবং গেটওয়ে লিংক হাব
                </h2>
                <p className="text-xs text-[#8a8e97] mt-1">প্রজেক্টের সমস্ত লাইভ URL, টেস্ট গেটওয়ে লিংক এবং এক্সটেনশন স্ক্রিপ্ট সম্পূর্ণ সক্রিয় ও সিঙ্কড।</p>
              </div>
              <div className="flex items-center gap-2 bg-[#0e1013] border border-[#23262c] px-3 py-1.5 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-[#28a909] animate-pulse"></span>
                <span className="text-xs font-bold text-[#28a909]">সিস্টেম লাইভ ও সক্রিয়</span>
              </div>
            </div>
          </div>

          {/* Live URLs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Admin Panel Card */}
            <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[rgba(40,169,9,0.15)] text-[#28a909] flex items-center justify-center font-bold">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Admin Panel (অ্যাডমিন প্যানেল)</h3>
                    <span className="text-[10px] text-[#8a8e97]">Admin Key: <strong className="text-[#ffb82e]">SIAMVIP</strong></span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[rgba(40,169,9,0.2)] text-[#28a909]">Live</span>
              </div>

              <div className="bg-[#0e1013] border border-[#23262c] rounded-xl p-2.5 flex items-center justify-between gap-2">
                <code className="text-xs text-[#3ea6ff] font-mono truncate">{liveOrigin}/</code>
                <button 
                  onClick={() => copyToClipboard(`${liveOrigin}/`, "Admin URL কপি হয়েছে!")}
                  className="p-1.5 bg-[#1a1d23] hover:bg-[#23262c] text-white rounded-lg transition"
                  title="Copy Admin URL"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <a 
                  href={`${liveOrigin}/`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 py-2 rounded-xl bg-[#28a909] hover:bg-[#1f8806] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> প্যানেল খুলুন
                </a>
              </div>
            </div>

            {/* bKash Gateway Card */}
            <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#b30068] text-white flex items-center justify-center font-bold text-xs">
                    bK
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">bKash Gateway (বিকাশ গেটওয়ে)</h3>
                    <span className="text-[10px] text-[#8a8e97]">ক্যাশ আউট ও TrxID স্বয়ংক্রিয় যাচাই</span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[rgba(179,0,104,0.2)] text-[#e83e8c]">Live</span>
              </div>

              <div className="bg-[#0e1013] border border-[#23262c] rounded-xl p-2.5 flex items-center justify-between gap-2">
                <code className="text-xs text-[#e83e8c] font-mono truncate">{`${liveOrigin}/bkash?amount=${testAmount}&rx_pid=${testPid}`}</code>
                <button 
                  onClick={() => copyToClipboard(`${liveOrigin}/bkash?amount=${testAmount}&rx_pid=${testPid}`, "bKash URL কপি হয়েছে!")}
                  className="p-1.5 bg-[#1a1d23] hover:bg-[#23262c] text-white rounded-lg transition"
                  title="Copy bKash URL"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => setPreviewModal({ open: true, url: `/bkash?amount=${testAmount}&rx_pid=${testPid}`, title: "bKash Payment Gateway" })}
                  className="flex-1 py-2 rounded-xl bg-[#1a1d23] hover:bg-[#23262c] border border-[#23262c] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Smartphone className="w-3.5 h-3.5 text-[#e83e8c]" /> লাইভ প্রিভিউ
                </button>
                <a 
                  href={`${liveOrigin}/bkash?amount=${testAmount}&rx_pid=${testPid}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 py-2 rounded-xl bg-[#b30068] hover:bg-[#900052] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> গেটওয়ে খুলুন
                </a>
              </div>
            </div>

            {/* Nagad Gateway Card */}
            <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e74738] text-white flex items-center justify-center font-bold text-xs">
                    NG
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Nagad Gateway (নগদ গেটওয়ে)</h3>
                    <span className="text-[10px] text-[#8a8e97]">এজেন্ট ক্যাশ আউট ও ইনস্ট্যান্ট পোস্ট</span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[rgba(231,71,56,0.2)] text-[#e74738]">Live</span>
              </div>

              <div className="bg-[#0e1013] border border-[#23262c] rounded-xl p-2.5 flex items-center justify-between gap-2">
                <code className="text-xs text-[#ff7666] font-mono truncate">{`${liveOrigin}/nagad?amount=${testAmount}&rx_pid=${testPid}`}</code>
                <button 
                  onClick={() => copyToClipboard(`${liveOrigin}/nagad?amount=${testAmount}&rx_pid=${testPid}`, "Nagad URL কপি হয়েছে!")}
                  className="p-1.5 bg-[#1a1d23] hover:bg-[#23262c] text-white rounded-lg transition"
                  title="Copy Nagad URL"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => setPreviewModal({ open: true, url: `/nagad?amount=${testAmount}&rx_pid=${testPid}`, title: "Nagad Payment Gateway" })}
                  className="flex-1 py-2 rounded-xl bg-[#1a1d23] hover:bg-[#23262c] border border-[#23262c] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Smartphone className="w-3.5 h-3.5 text-[#e74738]" /> লাইভ প্রিভিউ
                </button>
                <a 
                  href={`${liveOrigin}/nagad?amount=${testAmount}&rx_pid=${testPid}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 py-2 rounded-xl bg-[#e74738] hover:bg-[#c2372a] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> গেটওয়ে খুলুন
                </a>
              </div>
            </div>

            {/* Browser Extension Card */}
            <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[rgba(62,166,255,0.15)] text-[#3ea6ff] flex items-center justify-center font-bold">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Browser Extension (SX PRO)</h3>
                    <span className="text-[10px] text-[#8a8e97]">স্বয়ংক্রিয় ব্যালেন্স সিঙ্ক ও গেটওয়ে রাউটার</span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[rgba(62,166,255,0.2)] text-[#3ea6ff]">v2.4.0</span>
              </div>

              <div className="bg-[#0e1013] border border-[#23262c] rounded-xl p-2.5 flex items-center justify-between gap-2">
                <code className="text-xs text-[#3ea6ff] font-mono truncate">{`${liveOrigin}/extension.js`}</code>
                <button 
                  onClick={() => copyToClipboard(`${liveOrigin}/extension.js`, "Extension URL কপি হয়েছে!")}
                  className="p-1.5 bg-[#1a1d23] hover:bg-[#23262c] text-white rounded-lg transition"
                  title="Copy Extension Script URL"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <a 
                  href="/extension.js" 
                  download="SX_PRO.user.js" 
                  className="flex-1 py-2 rounded-xl bg-[#3ea6ff] hover:bg-[#2b92e6] text-black text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> extension.js ডাউনলোড
                </a>
                <a 
                  href="/extension.js" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="px-4 py-2 rounded-xl bg-[#1a1d23] hover:bg-[#23262c] border border-[#23262c] text-white text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5" /> কোড দেখুন
                </a>
              </div>
            </div>
          </div>

          {/* Interactive URL Generator & Quick Tester */}
          <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#ffb82e]" /> গেটওয়ে টেস্ট প্যারামিটার ও তাত্ক্ষণিক পরীক্ষা
              </h3>
              <span className="text-xs text-[#8a8e97]">Player ID এবং পরিমাণ পরিবর্তন করে লাইভ গেটওয়ে পরীক্ষা করুন</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0e1013] border border-[#23262c] rounded-xl p-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#8a8e97] block mb-1.5">Player ID (PID)</label>
                <input 
                  type="text" 
                  value={testPid} 
                  onChange={e => setTestPid(e.target.value)} 
                  placeholder="n12345678" 
                  className="w-full bg-[#1a1d23] border border-[#23262c] rounded-xl px-4 py-2 text-xs text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-[#8a8e97] block mb-1.5">ডিপোজিট পরিমাণ (টাকা / BDT)</label>
                <input 
                  type="number" 
                  value={testAmount} 
                  onChange={e => setTestAmount(Math.max(10, Number(e.target.value)))} 
                  placeholder="1000" 
                  className="w-full bg-[#1a1d23] border border-[#23262c] rounded-xl px-4 py-2 text-xs text-white font-bold"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-[#8a8e97] block">এক ক্লিকে টেস্ট ট্রানজেকশন তৈরি (অ্যাডমিন প্যানেল ভেরিফিকেশনের জন্য):</span>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => handleCreateTestDeposit('bkash', testAmount)}
                  className="px-4 py-2.5 rounded-xl bg-[#b30068] hover:bg-[#900052] text-white text-xs font-bold flex items-center gap-2 transition shadow-md"
                >
                  <Send className="w-3.5 h-3.5" /> bKash ৳{testAmount} টেস্ট ডিপোজিট পাঠান
                </button>
                <button 
                  onClick={() => handleCreateTestDeposit('nagad', testAmount)}
                  className="px-4 py-2.5 rounded-xl bg-[#e74738] hover:bg-[#c2372a] text-white text-xs font-bold flex items-center gap-2 transition shadow-md"
                >
                  <Send className="w-3.5 h-3.5" /> Nagad ৳{testAmount} টেস্ট ডিপোজিট পাঠান
                </button>
                <button 
                  onClick={() => setTab('admin')}
                  className="px-4 py-2.5 rounded-xl bg-[#1a1d23] hover:bg-[#23262c] border border-[#23262c] text-white text-xs font-bold flex items-center gap-2 transition"
                >
                  <span>পেন্ডিং ডিপোজিট তালিকায় যান</span> <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="bg-[#13151a] border border-[#23262c] rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-extrabold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#28a909]" /> ডিপ্লয়মেন্ট ও ইন্টিগ্রেশন নির্দেশাবলী
            </h3>
            <div className="space-y-3 text-xs text-[#c9ccd1] leading-relaxed">
              <div className="p-3 bg-[#0e1013] border border-[#23262c] rounded-xl flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#28a909] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">1</span>
                <div>
                  <strong className="text-white block font-bold mb-0.5">অ্যাডমিন অ্যাক্সেস:</strong>
                  প্যানেলে লগইন করার সিকিউরিটি কি হলো <code className="bg-[#1a1d23] px-1.5 py-0.5 rounded text-[#ffb82e] font-mono font-bold">SIAMVIP</code>। লগইন করার পর রিয়েলটাইম ইউজার ব্যালেন্স, ডিপোজিট অনুমোদন এবং সেটিংস পরিবর্তন করা যাবে।
                </div>
              </div>
              <div className="p-3 bg-[#0e1013] border border-[#23262c] rounded-xl flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#3ea6ff] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">2</span>
                <div>
                  <strong className="text-white block font-bold mb-0.5">গেটওয়ে লিংক ব্যবহার:</strong>
                  যেকোনো ওয়েবসাইটে বা গেমে ডিপোজিট বোতামে লিংক দিন: <br />
                  <code className="bg-[#1a1d23] px-1.5 py-0.5 rounded text-[#3ea6ff] font-mono text-[11px] inline-block mt-1">{liveOrigin}/bkash?amount=1000&rx_pid=[USER_PID]</code>
                </div>
              </div>
              <div className="p-3 bg-[#0e1013] border border-[#23262c] rounded-xl flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#e83e8c] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">3</span>
                <div>
                  <strong className="text-white block font-bold mb-0.5">রিসিভার নম্বর কনফিগারেশন:</strong>
                  Gateway Settings ট্যাবে গিয়ে বিকাশ এবং নগদের জন্য ৩-৫টি নম্বর যোগ করুন। নম্বর সিলেকশন মোড হিসেবে Random, Round Robin বা Fixed নির্বাচন করতে পারেন।
                </div>
              </div>
            </div>

            {/* Netlify GitHub Hosting Details */}
            <div className="bg-[#0e1013] border border-[#23262c] rounded-xl p-4 space-y-3 mt-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#3ea6ff]" /> Netlify & GitHub ডিপ্লয়মেন্ট সেটিংস
              </h4>
              <p className="text-[11px] text-[#8a8e97] leading-relaxed">
                এই প্রজেক্টটি GitHub রিপোজিটরিতে পুশ করে Netlify-এ কানেক্ট করলে সম্পূর্ণ স্বয়ংক্রিয়ভাবে ডিপ্লয় হবে। Netlify-এর জন্য <code className="text-[#3ea6ff]">netlify.toml</code>, <code className="text-[#3ea6ff]">public/_redirects</code> এবং <code className="text-[#3ea6ff]">netlify/functions/admin.ts</code> সম্পূর্ণ কনফিগার করা আছে।
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="bg-[#1a1d23] border border-[#23262c] rounded-lg p-2.5">
                  <span className="text-[9px] uppercase font-bold text-[#8a8e97] block mb-0.5">Build Command</span>
                  <code className="text-[#28a909] font-mono font-bold">npm run build</code>
                </div>
                <div className="bg-[#1a1d23] border border-[#23262c] rounded-lg p-2.5">
                  <span className="text-[9px] uppercase font-bold text-[#8a8e97] block mb-0.5">Publish Directory</span>
                  <code className="text-[#3ea6ff] font-mono font-bold">dist</code>
                </div>
                <div className="bg-[#1a1d23] border border-[#23262c] rounded-lg p-2.5">
                  <span className="text-[9px] uppercase font-bold text-[#8a8e97] block mb-0.5">Netlify Functions</span>
                  <code className="text-[#ffb82e] font-mono font-bold">netlify/functions</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gateway Live Preview Modal */}
      {previewModal.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13151a] border border-[#23262c] rounded-3xl w-full max-w-md h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#23262c] flex items-center justify-between bg-[#0e1013]">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#28a909]" />
                <span className="font-extrabold text-sm text-white">{previewModal.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={previewModal.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="p-1.5 bg-[#1a1d23] hover:bg-[#23262c] text-[#8a8e97] hover:text-white rounded-lg transition" 
                  title="Open in new window"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button 
                  onClick={() => setPreviewModal({ open: false, url: "", title: "" })}
                  className="p-1.5 bg-[#1a1d23] hover:bg-[rgba(229,50,45,0.2)] text-[#8a8e97] hover:text-[#e5322d] rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body / Iframe */}
            <div className="flex-1 bg-white relative">
              <iframe 
                src={previewModal.url} 
                className="w-full h-full border-0" 
                title={previewModal.title}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#0e1013] border-t border-[#23262c] flex items-center justify-between text-[11px] text-[#8a8e97]">
              <span>রিয়েলটাইম মোবাইল প্রিভিউ</span>
              <button 
                onClick={() => setPreviewModal({ open: false, url: "", title: "" })}
                className="px-3 py-1 bg-[#1a1d23] hover:bg-[#23262c] text-white rounded-lg font-bold"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#13151a] border border-[#23262c] text-white px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 text-sm font-bold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-[#28a909]" />
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
