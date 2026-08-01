"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────────────────────
// FILE: src/app/parent/dashboard/page.jsx
// ROUTE: /parent/dashboard
// ─────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const router   = useRouter();
  const supabase = createClient();

  // Auth
  const [authReady,      setAuthReady]      = useState(false);
  const [userId,         setUserId]         = useState(null);
  const [regStatus,      setRegStatus]      = useState("pending");
  const [parentName,     setParentName]     = useState("");
  const [studentName,    setStudentName]    = useState("");
  const [myChildStation, setMyChildStation] = useState("Mkwajuni Station");

  // Payment
  const [paymentStatus,  setPaymentStatus]  = useState("none");

  // Tracker
  const [shuttleStatus,  setShuttleStatus]  = useState("Stationary");
  const [currentStation, setCurrentStation] = useState("Depot Terminal");
  const [boardingStatus, setBoardingStatus] = useState("none");
  const [tripActive,     setTripActive]     = useState(false);
  const [driverLat,      setDriverLat]      = useState(null);
  const [driverLng,      setDriverLng]      = useState(null);
  const [tripJustEnded,  setTripJustEnded]  = useState(false);
  const [lastBoardStatus,setLastBoardStatus]= useState("none");
  // FIX 1 — tracks route type of the trip that just ended
  // so the correct notification (school vs home) is shown
  const [lastRouteType,  setLastRouteType]  = useState("morning");

  // UI
  // tabs: "tracker" | "absence" | "emergency" | "payment"
  const [activeTab, setActiveTab] = useState("tracker");
  const [checkingStatus,     setCheckingStatus]     = useState(false);

  // Absence form
  const [absenceDate,    setAbsenceDate]    = useState("");
  const [absenceReason,  setAbsenceReason]  = useState("Sick");
  const [absenceNotes,   setAbsenceNotes]   = useState("");
  const [absenceLoading, setAbsenceLoading] = useState(false);

  // Emergency
  const [emergencyTitle,    setEmergencyTitle]    = useState("");
  const [emergencyText,     setEmergencyText]     = useState("");
  const [emergencySeverity, setEmergencySeverity] = useState("high");
  const [emergencyLoading,  setEmergencyLoading]  = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // Push notification subscription state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushGranted,   setPushGranted]   = useState(false);

  // ── FETCH PAYMENT STATUS ──────────────────────
  const fetchPaymentStatus = useCallback(async (parentUserId) => {
    const { data, error } = await supabase.from("payments").select("status, payment_type")
      .eq("parent_id", parentUserId).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !data) { setPaymentStatus("none"); return "none"; }
    setPaymentStatus(data.status); return data.status;
  }, [supabase]);

  // ── AUTH GUARD ────────────────────────────────
  useEffect(() => {
    const verifySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/parent/register"); return; }
      const { data: profileData, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (error || !profileData || profileData.role !== "parent") {
        await supabase.auth.signOut(); router.replace("/parent/register"); return;
      }
      const uid = session.user.id;
      setUserId(uid); setRegStatus(profileData.status);
      setParentName(profileData.full_name);
      setMyChildStation(profileData.pickup_station || profileData.route_group || "Mkwajuni Station");
      const { data: studentData } = await supabase.from("students").select("full_name").eq("parent_id", uid).eq("is_active", true).maybeSingle();
      if (studentData) setStudentName(studentData.full_name);
      if (profileData.status === "approved") await fetchPaymentStatus(uid);
      setAuthReady(true);
    };
    verifySession();
  }, []);

  // ── PUSH NOTIFICATION SETUP ──────────────────
  // Registers the service worker and subscribes the parent
  // to push notifications so they receive alerts when the
  // app is closed or in the background.
  useEffect(() => {
    if (!authReady || !userId || regStatus !== "approved" || paymentStatus !== "approved") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const setupPush = async () => {
      try {
        setPushSupported(true);
        console.log("[Push] Starting push setup...");

        // Register service worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("[Push] Service worker registered:", registration);

        // Check current permission
        const permission = await Notification.requestPermission();
        console.log("[Push] Notification permission:", permission);
        if (permission !== "granted") {
          console.warn("[Push] Permission not granted, aborting.");
          return;
        }
        setPushGranted(true);

        // Subscribe to push
        const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        console.log("[Push] VAPID public key:", VAPID_PUBLIC_KEY ? "found" : "MISSING");
        if (!VAPID_PUBLIC_KEY) {
          console.error("[Push] VAPID key is missing from environment variables.");
          return;
        }

        const urlBase64ToUint8Array = (base64String) => {
          const padding  = "=".repeat((4 - (base64String.length % 4)) % 4);
          const base64   = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
          const rawData  = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        // Check if already subscribed
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          console.log("[Push] Already subscribed, saving existing subscription...");
          const res = await fetch("/api/push/subscribe", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ parent_id: userId, subscription: existingSub }),
          });
          console.log("[Push] Subscribe response:", res.status);
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        console.log("[Push] New subscription created:", subscription.endpoint);

        // Save subscription to database
        const res = await fetch("/api/push/subscribe", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ parent_id: userId, subscription }),
        });
        console.log("[Push] Subscription saved, status:", res.status);
        const resData = await res.json();
        console.log("[Push] Subscribe response data:", resData);

      } catch (err) {
        console.error("[Push] Push notification setup failed:", err);
      }
    };

    setupPush();
  }, [authReady, userId, regStatus, paymentStatus]);

  // ── CHECK APPROVAL STATUS ─────────────────────
  const handleCheckApprovalStatus = useCallback(async (silent = false) => {
    if (!silent) setCheckingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profileData, error } = await supabase.from("profiles").select("status").eq("id", session.user.id).single();
      if (error) { if (!silent) showToast("Could not reach server. Please try again.", "error"); return; }
      if (profileData?.status === "approved") {
        setRegStatus("approved");
        await fetchPaymentStatus(session.user.id);
        showToast("✅ Your account has been approved!");
      } else { if (!silent) showToast("Still pending. A supervisor will review your profile soon.", "error"); }
    } catch { if (!silent) showToast("Network error. Please try again.", "error"); }
    finally { if (!silent) setCheckingStatus(false); }
  }, [supabase, fetchPaymentStatus]);

  // ── CHECK PAYMENT STATUS ──────────────────────
  const handleCheckPaymentStatus = useCallback(async (silent = false) => {
    if (!silent) setCheckingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const status = await fetchPaymentStatus(session.user.id);
      if (status === "approved" && !silent) showToast("✅ Payment approved! Welcome to your dashboard.");
      else if (status === "rejected" && !silent) showToast("❌ Payment was rejected. Please resubmit.", "error");
      else if (status === "pending" && !silent) showToast("Still waiting for admin to approve your payment.", "error");
    } catch { if (!silent) showToast("Network error.", "error"); }
    finally { if (!silent) setCheckingStatus(false); }
  }, [supabase, fetchPaymentStatus]);

  // Auto-poll approval
  useEffect(() => {
    if (!authReady || regStatus !== "pending") return;
    const interval = setInterval(() => handleCheckApprovalStatus(true), 5000);
    return () => clearInterval(interval);
  }, [authReady, regStatus, handleCheckApprovalStatus]);

  // Auto-poll payment
  useEffect(() => {
    if (!authReady || regStatus !== "approved" || paymentStatus !== "pending") return;
    const interval = setInterval(() => handleCheckPaymentStatus(true), 5000);
    return () => clearInterval(interval);
  }, [authReady, regStatus, paymentStatus, handleCheckPaymentStatus]);

  // ── LIVE TRACKER POLLING ──────────────────────
  useEffect(() => {
    if (!authReady || regStatus !== "approved" || paymentStatus !== "approved") return;
    const pollTrip = async () => {
      try {
        const res = await fetch("/api/trips?status=active");
        if (!res.ok) return;
        const trips = await res.json();
        if (trips && trips.length > 0) {
          const latest = trips[0];
          setShuttleStatus(latest.shuttle_status || "En-Route");
          setCurrentStation(latest.current_station || "Depot Terminal");
          // FIX 2 — capture route_type from the active trip so we
          // know which notification to show when the trip ends
          setLastRouteType(latest.route_type || "morning");
          setTripActive(true);
          if (latest.current_lat && latest.current_lng) {
            setDriverLat(parseFloat(latest.current_lat));
            setDriverLng(parseFloat(latest.current_lng));
          }
          if (latest.id && userId) {
            try {
              const attRes = await fetch(`/api/attendance?trip_id=${latest.id}`);
              if (attRes.ok) {
                const attData = await attRes.json();
                const { data: studentData } = await supabase.from("students").select("id").eq("parent_id", userId).eq("is_active", true);
                if (studentData?.length > 0) {
                  const myStudentId = studentData[0].id;
                  const myRecord = attData.find(a => a.student_id === myStudentId);
                  if (myRecord) {
                    if (myRecord.checked_out) { setBoardingStatus("delivered"); setLastBoardStatus("delivered"); }
                    else if (myRecord.checked_in) { setBoardingStatus("boarded"); setLastBoardStatus("boarded"); }
                    else { setBoardingStatus("none"); }
                    setTripJustEnded(false);
                  }
                }
              }
            } catch { /* silent */ }
          }
        } else {
          // FIX 3 — when trip disappears, set tripJustEnded so the
          // correct banner fires based on lastRouteType captured above
          setTripActive(prev => {
            if (prev === true) setTripJustEnded(true);
            return false;
          });
          setShuttleStatus("Stationary"); setCurrentStation("Depot Terminal");
          setDriverLat(null); setDriverLng(null);
          // Do NOT reset lastBoardStatus or lastRouteType here —
          // they need to stay set so the banner can display
        }
      } catch { /* silent */ }
    };
    pollTrip();
    const interval = setInterval(pollTrip, 5000);
    return () => clearInterval(interval);
  }, [authReady, regStatus, paymentStatus, userId]);

  // ── HANDLERS ──────────────────────────────────
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/parent/Register"; };

  const handleReportAbsence = async (e) => {
    e.preventDefault();
    if (!absenceDate || !userId) return;
    setAbsenceLoading(true);
    const { data: studentData, error: studentError } = await supabase.from("students").select("id").eq("parent_id", userId).eq("is_active", true).maybeSingle();
    if (studentError || !studentData) { showToast("No active student found. Ask the admin to register your child.", "error"); setAbsenceLoading(false); return; }
    const todayStr = new Date().toISOString().split("T")[0];
    const isLateNotice = absenceDate === todayStr && new Date().getHours() >= 6;
    try {
      const res = await fetch("/api/absences", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentData.id, submitted_by: userId, absence_date: absenceDate, reason_category: absenceReason, notes: absenceNotes || null, late_notice: isLateNotice }),
      });
      if (!res.ok) { const err = await res.json(); showToast(err.error || "Failed.", "error"); setAbsenceLoading(false); return; }
      showToast(isLateNotice ? "⚠️ Late notice sent. Driver alerted." : "✅ Absence reported.");
      setAbsenceDate(""); setAbsenceNotes(""); setActiveTab("tracker");
    } catch { showToast("Network error.", "error"); }
    finally { setAbsenceLoading(false); }
  };

  const handleSendEmergency = async (e) => {
    e.preventDefault();
    if (!emergencyText.trim() || !userId) return;
    setEmergencyLoading(true);
    try {
      const res = await fetch("/api/emergencies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sent_by: userId, title: emergencyTitle.trim() || "Emergency Alert", message: emergencyText, severity: emergencySeverity }),
      });
      if (!res.ok) { const err = await res.json(); showToast(err.error || "Failed.", "error"); setEmergencyLoading(false); return; }
      showToast("🚨 Emergency alert transmitted.");
      setEmergencyTitle(""); setEmergencyText(""); setEmergencySeverity("high"); setShowEmergencyModal(false);
    } catch { showToast("Network error.", "error"); }
    finally { setEmergencyLoading(false); }
  };

  const isApproachingMyStation = shuttleStatus === "Approaching Station" && currentStation === myChildStation;

  // Dismiss helper — resets all end-trip notification state
  const dismissEndTripNotification = () => {
    setTripJustEnded(false);
    setLastBoardStatus("none");
    setLastRouteType("morning");
    setBoardingStatus("none");
  };

  // ── AUTH LOADING ──────────────────────────────
  if (!authReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ── GATE VIEWS ────────────────────────────────
  const GateWrapper = ({ children }) => (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] flex items-center justify-center p-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold ${
          toast.type === "success" ? "bg-[#0F172A] text-white border border-cyan-500/30" : "bg-red-600 text-white"
        }`}>{toast.msg}</div>
      )}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-cyan-500 to-cyan-700" />
        {children}
      </div>
    </div>
  );

  // VIEW 1 — PENDING
  if (regStatus === "pending") {
    return (
      <GateWrapper>
        <div className="p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border-2 border-amber-200">
            <span className="text-3xl animate-pulse">⏳</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Step 1 of 3</p>
            <h2 className="text-xl font-black text-slate-900 mt-1">Profile Under Review</h2>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Hello <strong className="text-slate-700">{parentName}</strong>, your registration is being reviewed by a supervisor.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse shrink-0" />
            <p className="text-[11px] text-slate-500 font-medium text-left">Checking automatically every 5 seconds...</p>
          </div>
          <button onClick={() => handleCheckApprovalStatus(false)} disabled={checkingStatus}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl text-sm transition flex items-center justify-center gap-2">
            {checkingStatus ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Checking...</> : "Check Status Now"}
          </button>
          <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600 transition">Log out</button>
        </div>
      </GateWrapper>
    );
  }

  // VIEW 2A — NO PAYMENT
  if (regStatus === "approved" && paymentStatus === "none") {
    return (
      <GateWrapper>
        <div className="p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-cyan-50 rounded-2xl flex items-center justify-center mx-auto border-2 border-cyan-200">
            <span className="text-3xl">💳</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">Step 2 of 3</p>
            <h2 className="text-xl font-black text-slate-900 mt-1">Activate Your Account</h2>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Profile approved! Submit your activation payment to unlock live tracking.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <span className="text-emerald-500">✓</span>
            <p className="text-[11px] text-emerald-700 font-bold text-left">Profile approved by supervisor</p>
          </div>
          <Link href="/parent/payments"
            className="block w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3.5 rounded-xl text-sm transition text-center shadow-md shadow-cyan-600/20">
            Go to Payment Center →
          </Link>
          <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600 transition">Log out</button>
        </div>
      </GateWrapper>
    );
  }

  // VIEW 2B — PAYMENT PENDING
  if (regStatus === "approved" && paymentStatus === "pending") {
    return (
      <GateWrapper>
        <div className="p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border-2 border-amber-200">
            <span className="text-3xl animate-pulse">🧾</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Step 2 of 3</p>
            <h2 className="text-xl font-black text-slate-900 mt-1">Payment Under Review</h2>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Your receipt has been submitted. A supervisor is verifying it now.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse shrink-0" />
            <p className="text-[11px] text-slate-500 font-medium text-left">Checking automatically every 5 seconds...</p>
          </div>
          <button onClick={() => handleCheckPaymentStatus(false)} disabled={checkingStatus}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl text-sm transition flex items-center justify-center gap-2">
            {checkingStatus ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Checking...</> : "Check Payment Status"}
          </button>
          <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600 transition">Log out</button>
        </div>
      </GateWrapper>
    );
  }

  // VIEW 2C — PAYMENT REJECTED
  if (regStatus === "approved" && paymentStatus === "rejected") {
    return (
      <GateWrapper>
        <div className="p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto border-2 border-red-200">
            <span className="text-3xl">❌</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Payment Rejected</h2>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Your receipt was rejected. Please resubmit a valid payment receipt.
            </p>
          </div>
          <Link href="/parent/payments"
            className="block w-full bg-red-600 hover:bg-red-500 text-white font-black py-3.5 rounded-xl text-sm transition text-center">
            Resubmit Payment →
          </Link>
          <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600 transition">Log out</button>
        </div>
      </GateWrapper>
    );
  }

  // ════════════════════════════════════════
  // VIEW 4 — FULL DASHBOARD
  // ════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-800 flex flex-col">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold max-w-sm ${
          toast.type === "success" ? "bg-[#0F172A] text-white border border-cyan-500/30" : "bg-red-600 text-white"
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <header className="bg-[#0F172A] border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-[#0F172A] font-black text-xs">CS</span>
              </div>
              <div>
                <p className="text-white font-black text-sm leading-none">Parent Dashboard</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{parentName}</p>
              </div>
            </div>
            {tripActive && (
              <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />Live
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main layout — sidebar + content */}
      <div className="flex flex-1">

        {/* Left Sidebar Nav */}
        <aside className="w-56 shrink-0 bg-[#0F172A] border-r border-slate-800 flex flex-col py-6 px-3 justify-between min-h-full">
          <div className="flex flex-col gap-1">
            {[
              { id: "tracker",   label: "🗺️ Tracker",   activeColor: "bg-cyan-500 text-[#0F172A]" },
              { id: "absence",   label: "📅 Absence Reporting",   activeColor: "bg-amber-500 text-white" },
              { id: "emergency", label: "🚨 Emergency Alert",        activeColor: "bg-red-600 text-white" },
              { id: "payment",   label: "💳 Manage Payment",   activeColor: "bg-violet-600 text-white" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all text-left w-full ${
                  activeTab === tab.id
                    ? tab.activeColor
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-4 border-t border-slate-800">
            <div className="px-3 py-2">
              <p className="text-white text-xs font-black">{parentName}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">Parent</p>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-slate-800 transition">
              🚪 Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-[#F1F5F9] overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

            {/* STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">Live Shuttle</p>
                <p className="mt-3 font-black text-slate-900 text-xl">{tripActive ? "En Route" : "No Active Trip"}</p>
                <p className="text-sm text-slate-500 mt-2">{tripActive ? shuttleStatus : "Awaiting next departure"}</p>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">Current Stop</p>
                <p className="mt-3 font-black text-slate-900 text-xl">{currentStation}</p>
                <p className="text-sm text-slate-500 mt-2">My child: {myChildStation}</p>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">Child Status</p>
                <p className="mt-3 font-black text-slate-900 text-xl">{boardingStatus === "none" ? "Awaiting Bus" : boardingStatus === "boarded" ? "Boarded" : "Delivered"}</p>
                <p className="text-sm text-slate-500 mt-2">{boardingStatus === "boarded" ? `${studentName} is on the bus` : boardingStatus === "delivered" ? `${studentName} has been delivered` : "Waiting for boarding update"}</p>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">Payment</p>
                <p className={`mt-3 font-black text-xl ${
                  paymentStatus === "approved" ? "text-emerald-600" :
                  paymentStatus === "pending"  ? "text-amber-600" :
                  paymentStatus === "rejected" ? "text-red-600" : "text-slate-800"
                }`}>
                  {paymentStatus === "none" ? "Not Submitted" : paymentStatus}
                </p>
                <p className="text-sm text-slate-500 mt-2">{paymentStatus === "approved" ? "Live tracking enabled" : "Submit receipt to activate"}</p>
              </div>
            </div>

            {/* ── TRACKER TAB ── */}
            {activeTab === "tracker" && (
              <div className="grid gap-6 lg:grid-cols-[1.75fr_1fr]">
                <div className="space-y-6">

                  {/* MORNING end trip notification */}
                  {tripJustEnded && lastBoardStatus === "boarded" && lastRouteType === "morning" && (
                    <div className="rounded-3xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-1" />
                      <div className="p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="rounded-3xl bg-emerald-50 border border-emerald-200 w-12 h-12 flex items-center justify-center">
                            <span className="text-xl">🏫</span>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-600 font-black">Safe Arrival — School</p>
                            <h3 className="mt-2 font-black text-slate-900">Your child arrived at school</h3>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 rounded-2xl border border-slate-200 p-4">
                          The driver has confirmed that <strong>{studentName}</strong> arrived at school safely.
                        </p>
                        <button onClick={dismissEndTripNotification}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-2xl transition">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* EVENING end trip notification */}
                  {tripJustEnded && lastBoardStatus === "boarded" && lastRouteType === "evening" && (
                    <div className="rounded-3xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-1" />
                      <div className="p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="rounded-3xl bg-emerald-50 border border-emerald-200 w-12 h-12 flex items-center justify-center">
                            <span className="text-xl">🏠</span>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-600 font-black">Safe Arrival — Home</p>
                            <h3 className="mt-2 font-black text-slate-900">Your child has reached home safely</h3>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 rounded-2xl border border-slate-200 p-4">
                          The driver has confirmed that <strong>{studentName}</strong> has been delivered home safely.
                        </p>
                        <button onClick={dismissEndTripNotification}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-2xl transition">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delivered notification */}
                  {tripJustEnded && lastBoardStatus === "delivered" && (
                    <div className="rounded-3xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-1" />
                      <div className="p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="rounded-3xl bg-emerald-50 border border-emerald-200 w-12 h-12 flex items-center justify-center">
                            <span className="text-xl">🏠</span>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-600 font-black">Home Delivery Confirmed</p>
                            <h3 className="mt-2 font-black text-slate-900">Your child is home safely</h3>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 rounded-2xl border border-slate-200 p-4">
                          The driver has confirmed that <strong>{studentName}</strong> has been delivered home safely.
                        </p>
                        <button onClick={dismissEndTripNotification}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-2xl transition">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Boarding notification */}
                  {boardingStatus === "boarded" && !tripJustEnded && (
                    <div className="rounded-3xl border border-cyan-200 bg-white shadow-sm p-4 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-3xl bg-cyan-50 border border-cyan-200 flex items-center justify-center">
                        <span className="text-2xl">🛫</span>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-600 font-black">Boarding</p>
                        <p className="mt-2 font-black text-slate-900">Your child is on the bus</p>
                        <p className="text-sm text-slate-500 mt-1">Driver is en route to school.</p>
                      </div>
                    </div>
                  )}

                  {/* Approaching station alert */}
                  {isApproachingMyStation && (
                    <div className="rounded-3xl border border-red-200 bg-white shadow-sm p-4 flex items-center gap-4 animate-pulse">
                      <div className="w-14 h-14 rounded-3xl bg-red-50 border border-red-200 flex items-center justify-center">
                        <span className="text-2xl">⚠️</span>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-red-600 font-black">Approaching Stop</p>
                        <p className="mt-2 font-black text-slate-900">Bus is arriving at {myChildStation}</p>
                        <p className="text-sm text-slate-500 mt-1">Please prepare your child at the stop.</p>
                      </div>
                    </div>
                  )}

                  {/* Live map */}
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 font-black">Live Bus Location</p>
                        <h3 className="mt-2 font-black text-slate-900">Real-time route map</h3>
                      </div>
                      <span className="rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1 border border-emerald-100">
                        {tripActive ? "Live" : "Idle"}
                      </span>
                    </div>
                    <div className="relative">
                      {tripActive && driverLat && driverLng ? (
                        <iframe
                          key={`${driverLat.toFixed(4)}-${driverLng.toFixed(4)}`}
                          title="Live Bus Location" width="100%" height="280"
                          src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBiuyPWtUpEzy7gt3-ufPAiVakhJgnf3OE&q=${driverLat},${driverLng}&center=${driverLat},${driverLng}&zoom=16&maptype=roadmap`}
                          style={{ border: 0 }} loading="lazy" allowFullScreen
                        />
                      ) : (
                        <div className="h-72 grid place-items-center text-slate-500 text-sm">
                          {tripActive ? "Waiting for GPS data..." : "No active trip. Map will show when the bus is in motion."}
                        </div>
                      )}
                      <div className="absolute bottom-4 left-4 right-4 bg-[#0F172A]/85 backdrop-blur-sm text-white text-xs font-bold px-4 py-3 rounded-3xl flex flex-wrap gap-3 justify-between">
                        <span>📍 {currentStation}</span>
                        <span className="text-slate-300">{shuttleStatus}</span>
                      </div>
                    </div>
                    <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] text-slate-500">Your stop: <strong className="text-slate-700">{myChildStation}</strong></p>
                    </div>
                  </div>
                </div>

                {/* Right aside — student profile */}
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-5 border-b border-slate-100">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-black">Student Profile</p>
                      <h3 className="mt-3 font-black text-slate-900 text-xl">{studentName || "No student linked yet"}</h3>
                      <p className="text-sm text-slate-500 mt-1">Stop: <strong>{myChildStation}</strong></p>
                    </div>
                    <div className="p-5 grid gap-3">
                      <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black">Shuttle Status</p>
                        <p className={`mt-2 font-black text-sm ${
                          shuttleStatus === "Stationary" ? "text-slate-500" :
                          isApproachingMyStation ? "text-red-600" : "text-emerald-600"
                        }`}>{shuttleStatus}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black">Current Route</p>
                        <p className="mt-2 font-black text-sm">{currentStation}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black">Boarding</p>
                        <p className="mt-2 font-black text-sm">{boardingStatus === "none" ? "Pending" : boardingStatus}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ABSENCE TAB ── */}
            {activeTab === "absence" && (
              <div className="max-w-lg">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">📅</div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Absence Report</p>
                        <h2 className="text-lg font-black text-white mt-0.5">Report Student Absence</h2>
                        <p className="text-amber-100 text-xs mt-1">Notify driver and update admin manifest instantly</p>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleReportAbsence} className="p-6 space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Absence Date</label>
                      <input type="date" required value={absenceDate} onChange={e => setAbsenceDate(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-amber-400 bg-slate-50 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reason</label>
                      <select value={absenceReason} onChange={e => setAbsenceReason(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-amber-400 bg-slate-50 transition">
                        <option value="Sick">Sick / Medical Leave</option>
                        <option value="Personal Leave">Personal Leave / Family Matter</option>
                        <option value="Emergency">Unforeseen Emergency</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes <span className="text-slate-300 normal-case">(optional)</span></label>
                      <textarea value={absenceNotes} onChange={e => setAbsenceNotes(e.target.value)}
                        placeholder="Any extra context for the driver or admin..."
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-amber-400 bg-slate-50 h-28 resize-none transition"
                      />
                    </div>
                    {absenceDate === new Date().toISOString().split("T")[0] && new Date().getHours() >= 6 && (
                      <div className="rounded-2xl bg-amber-50 border-l-4 border-amber-400 px-4 py-3 text-amber-700 text-sm">
                        ⚠️ Late notice — submitted after 6:00 AM. Driver will be alerted immediately.
                      </div>
                    )}
                    <button type="submit" disabled={absenceLoading}
                      className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-black py-4 rounded-2xl text-sm transition flex items-center justify-center gap-2">
                      {absenceLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</> : "Submit Absence Report →"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ── EMERGENCY TAB ── */}
            {activeTab === "emergency" && (
              <div className="max-w-lg">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🚨</div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Emergency Dispatch</p>
                        <h2 className="text-lg font-black text-white mt-0.5">SOS Emergency Alert</h2>
                        <p className="text-red-200 text-xs mt-1">Alert is sent instantly to the supervisor and driver</p>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleSendEmergency} className="p-6 space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Alert Title</label>
                      <input type="text" placeholder="e.g. Child missed the bus"
                        value={emergencyTitle} onChange={e => setEmergencyTitle(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-red-400 bg-slate-50 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Severity Level</label>
                      <div className="grid grid-cols-4 gap-2">
                        {["low","medium","high","critical"].map(s => (
                          <button key={s} type="button" onClick={() => setEmergencySeverity(s)}
                            className={`py-3 rounded-2xl text-[10px] font-black uppercase transition border-2 ${
                              emergencySeverity === s
                                ? s === "critical" ? "bg-red-600 text-white border-red-600"
                                : s === "high"     ? "bg-orange-500 text-white border-orange-500"
                                : s === "medium"   ? "bg-amber-500 text-white border-amber-500"
                                :                    "bg-cyan-500 text-white border-cyan-500"
                                : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
                            }`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Emergency Message</label>
                      <textarea required value={emergencyText} onChange={e => setEmergencyText(e.target.value)}
                        placeholder="Describe the emergency in detail..."
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-red-400 bg-slate-50 h-32 resize-none transition"
                      />
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex gap-2">
                      <span className="text-red-500 shrink-0">⚠️</span>
                      <p className="text-xs text-red-700 leading-relaxed">
                        Only use this for genuine emergencies. Your alert will be transmitted immediately to the supervisor and driver.
                      </p>
                    </div>
                    <button type="submit" disabled={emergencyLoading}
                      className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl text-sm transition flex items-center justify-center gap-2">
                      {emergencyLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Transmitting...</> : "Transmit Emergency Alert 🚨"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ── PAYMENT TAB ── */}
            {activeTab === "payment" && (
              <div className="max-w-lg">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-600 to-violet-800 px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">💳</div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Transport Payment</p>
                        <h2 className="text-lg font-black text-white mt-0.5">Manage Payment</h2>
                        <p className="text-violet-200 text-xs mt-1">Submit or track your transport payment status</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 divide-y divide-slate-200">
                      <div className="flex justify-between items-center px-4 py-3 text-sm">
                        <span className="text-slate-400 font-medium">Payment Status</span>
                        <span className={`font-black px-3 py-1 rounded-full text-xs ${
                          paymentStatus === "approved" ? "bg-emerald-100 text-emerald-700" :
                          paymentStatus === "pending"  ? "bg-amber-100 text-amber-700" :
                          paymentStatus === "rejected" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {paymentStatus === "none" ? "Not Submitted" : paymentStatus.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 text-sm">
                        <span className="text-slate-400 font-medium">Dashboard Access</span>
                        <span className={`font-black text-xs ${paymentStatus === "approved" ? "text-emerald-600" : "text-red-500"}`}>
                          {paymentStatus === "approved" ? "✓ Active" : "✕ Locked"}
                        </span>
                      </div>
                    </div>
                    {paymentStatus === "approved" && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex gap-2">
                        <span className="text-emerald-500 shrink-0">✓</span>
                        <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                          Your payment is approved and your dashboard is fully active.
                        </p>
                      </div>
                    )}
                    {paymentStatus === "rejected" && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex gap-2">
                        <span className="text-red-500 shrink-0">✕</span>
                        <p className="text-xs text-red-700 leading-relaxed font-medium">
                          Your payment was rejected. Please resubmit a valid receipt.
                        </p>
                      </div>
                    )}
                    <Link href="/parent/payments"
                      className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm bg-violet-600 hover:bg-violet-500 text-white transition shadow-md shadow-violet-600/20">
                      {paymentStatus === "approved" ? "Submit Monthly Payment →" : "Go to Payment Center →"}
                    </Link>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}