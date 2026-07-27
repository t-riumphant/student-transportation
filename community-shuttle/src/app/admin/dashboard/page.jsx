/* eslint-disable react/no-unescaped-entities, @typescript-eslint/no-unused-vars, @next/next/no-img-element */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

// ─────────────────────────────────────────────────────────────
// FILE: src/app/admin/dashboard/page.jsx
// ROUTE: /admin/dashboard
// ─────────────────────────────────────────────────────────────

const SEVERITY = {
  low:      { label: "Low",      bar: "bg-cyan-500",   dot: "bg-cyan-400" },
  medium:   { label: "Medium",   bar: "bg-amber-500",  dot: "bg-amber-400" },
  high:     { label: "High",     bar: "bg-orange-500", dot: "bg-orange-400" },
  critical: { label: "Critical", bar: "bg-red-600",    dot: "bg-red-500" },
};

function SectionCard({ children, accent = "border-cyan-500", className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 border-l-4 ${accent} overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function StatTile({ label, value, color, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-xl shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const router   = useRouter();
  const supabase = createClient();

  // ── Auth ──────────────────────────────────────
  const [supervisor, setSupervisor] = useState(null);
  const [authReady,  setAuthReady]  = useState(false);

  // ── Active tab ────────────────────────────────
  const [activeTab, setActiveTab] = useState("overview");

  // ── View (register form) ──────────────────────
  const [viewMode, setViewMode] = useState("dashboard");

  // ── Data ──────────────────────────────────────
  const [pendingProfiles,   setPendingProfiles]   = useState([]);
  const [pendingPayments,   setPendingPayments]   = useState([]);
  const [approvedPayments,  setApprovedPayments]  = useState([]);
  const [students,          setStudents]          = useState([]);
  const [drivers,           setDrivers]           = useState([]);
  const [absenceLogs,       setAbsenceLogs]       = useState([]);
  const [allAbsenceLogs,    setAllAbsenceLogs]    = useState([]);
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [dataLoading,       setDataLoading]       = useState(true);
  const [pendingStudentMap, setPendingStudentMap] = useState({});

  const ROUTE_STATIONS = {
    "Kinondoni Route": ["Makumbusho", "Kinondoni", "Magomeni"],
    "Ilala Route":     ["Gerezani", "Mnazi Mmoja", "Machinga Complex"],
  };

  const [regName,  setRegName]  = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regRole,  setRegRole]  = useState("driver");
  const [regRoute, setRegRoute] = useState("");

  const [simParent,  setSimParent]  = useState("");
  const [simStudent, setSimStudent] = useState("");
  const [simGrade,   setSimGrade]   = useState("Grade 1");
  const [simRoute,   setSimRoute]   = useState("Kinondoni Route");
  const [simStation, setSimStation] = useState("Makumbusho");

  const [toast,        setToast]        = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const deleteRecord = async (endpoint, id, label) => {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleteTarget(id);
    try {
      const res = await fetch(`/api/${endpoint}?id=${id}`, { method: "DELETE" });
      let payload = {};
      const text = await res.text();
      if (text) { try { payload = JSON.parse(text); } catch (err) { /* ignore */ } }
      if (!res.ok) throw new Error(payload.error || payload.message || res.statusText || `Unable to delete ${label}`);
      showToast(`${label} deleted.`);
      fetchDashboardData();
    } catch {
      console.error("Failed to load dashboard data");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDeleteStudent = async (student) => deleteRecord("students", student.id, student.full_name || "student");
  const handleDeleteDriver  = async (driver)  => deleteRecord("profiles", driver.id, driver.full_name || "driver");
  const handleDeleteAbsence = async (absence) => deleteRecord("absences", absence.id, "absence report");
  const handleDeletePayment = async (payment) => deleteRecord("payments", payment.id, `payment by ${payment.profiles?.full_name || "parent"}`);

  // ── AUTH GUARD ────────────────────────────────
  useEffect(() => {
    const verifySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/admin"); return; }
      const { data: profile, error } = await supabase.from("profiles").select("full_name, role").eq("id", session.user.id).single();
      if (error || !profile || profile.role !== "supervisor") { await supabase.auth.signOut(); router.replace("/admin"); return; }
      setSupervisor({ email: session.user.email, name: profile.full_name });
      setAuthReady(true);
    };
    verifySession();
  }, [router, supabase]);

  // ── FETCH DATA ────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [profilesRes, paymentsRes, approvedPaymentsRes, studentsRes, todayAbsencesRes, allAbsencesRes, emergenciesRes, driversRes] = await Promise.all([
        fetch("/api/profiles?status=pending&exclude_role=supervisor"),
        fetch("/api/payments?status=pending"),
        fetch("/api/payments?status=approved"),
        fetch("/api/students?active=true"),
        fetch(`/api/absences?date=${today}`),
        fetch("/api/absences"),
        fetch("/api/emergencies?resolved=false"),
        fetch("/api/profiles?status=approved&role=driver"),
      ]);
      if (profilesRes.ok)         setPendingProfiles(await profilesRes.json());
      if (paymentsRes.ok)         setPendingPayments(await paymentsRes.json());
      if (approvedPaymentsRes.ok) setApprovedPayments(await approvedPaymentsRes.json());
      if (studentsRes.ok)         setStudents(await studentsRes.json());
      if (todayAbsencesRes.ok)    setAbsenceLogs(await todayAbsencesRes.json());
      if (allAbsencesRes.ok)      setAllAbsenceLogs(await allAbsenceLogsRes.json());
      if (emergenciesRes.ok)      setActiveEmergencies(await emergenciesRes.json());
      if (driversRes.ok)          setDrivers(await driversRes.json());
      const pendingStudentsRes = await fetch("/api/students?active=false");
      if (pendingStudentsRes.ok) {
        const ps = await pendingStudentsRes.json();
        const map = {};
        ps.forEach(s => { map[s.parent_id] = s.full_name; });
        setPendingStudentMap(map);
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [authReady, fetchDashboardData]);

  // ── HANDLERS ──────────────────────────────────
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/admin"; };

  const handleAddToQueue = async (e) => {
    e.preventDefault();
    if (!regName.trim()) return;
    try {
      const res = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full_name: regName, phone: regPhone || null, role: regRole, route_group: regRoute || null }) });
      if (!res.ok) { const err = await res.json(); showToast(err.error || "Failed.", "error"); return; }
      showToast(`${regRole.toUpperCase()} added to approval queue.`);
      setRegName(""); setRegPhone(""); setRegRoute("");
      fetchDashboardData();
    } catch { showToast("Network error.", "error"); }
  };

  const handleApproveProfile = async (id, name, role) => {
    try {
      const res = await fetch("/api/profiles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "approved" }) });
      if (!res.ok) { showToast("Approval failed.", "error"); return; }
      if (role === "parent") {
        const { data: studentRow } = await supabase.from("students").select("id").eq("parent_id", id).maybeSingle();
        if (studentRow) {
          await supabase.from("students").update({ is_active: true }).eq("id", studentRow.id);
        } else {
          const studentFullName = pendingStudentMap[id] || name + "'s Child";
          await supabase.from("students").insert([{ parent_id: id, full_name: studentFullName, is_active: true }]);
        }
      }
      showToast(`✓ ${name} approved.`);
      setPendingProfiles(prev => prev.filter(p => p.id !== id));
      fetchDashboardData();
    } catch { showToast("Network error.", "error"); }
  };

  const handleApprovePayment = async (payment) => {
    try {
      const res = await fetch("/api/payments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: payment.id, status: "approved", parent_id: payment.parent_id, student_id: payment.student_id }) });
      if (!res.ok) { showToast("Payment approval failed.", "error"); return; }
      showToast(`✓ Payment approved for ${payment.profiles?.full_name}.`);
      setPendingPayments(prev => prev.filter(p => p.id !== payment.id));
      fetchDashboardData();
    } catch { showToast("Network error.", "error"); }
  };

  const handleRejectPayment = async (payment) => {
    try {
      const res = await fetch("/api/payments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: payment.id, status: "rejected" }) });
      if (!res.ok) { showToast("Rejection failed.", "error"); return; }
      showToast(`Payment rejected for ${payment.profiles?.full_name}.`, "error");
      setPendingPayments(prev => prev.filter(p => p.id !== payment.id));
    } catch { showToast("Network error.", "error"); }
  };

  const handleRegisterStudent = async (e) => {
    e.preventDefault();
    if (!simParent.trim() || !simStudent.trim()) return;
    try {
      const parentRes = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full_name: simParent, role: "parent", route_group: simRoute, pickup_station: simStation }) });
      if (!parentRes.ok) { showToast("Failed to create parent profile.", "error"); return; }
      const parentData = await parentRes.json();
      const studentRes = await fetch("/api/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parent_id: parentData.id, full_name: simStudent, grade: simGrade }) });
      if (!studentRes.ok) { showToast("Parent created but student registration failed.", "error"); return; }
      showToast(`"${simStudent}" registered successfully.`);
      setSimParent(""); setSimStudent(""); setViewMode("dashboard");
      fetchDashboardData();
    } catch { showToast("Network error.", "error"); }
  };

  const handleResolveAlert = async (id) => {
    try {
      const res = await fetch("/api/emergencies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_resolved: true }) });
      if (!res.ok) { showToast("Could not resolve alert.", "error"); return; }
      showToast("Alert acknowledged and resolved.");
      setActiveEmergencies(prev => prev.filter(e => e.id !== id));
    } catch { showToast("Network error.", "error"); }
  };

  // ── AUTH LOADING ──────────────────────────────
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  // ── TAB CONFIG ────────────────────────────────
  const tabs = [
    { id: "overview",  label: "Overview",  icon: "📊", badge: activeEmergencies.length > 0 ? activeEmergencies.length : null, badgeColor: "bg-red-500" },
    { id: "approvals", label: "Approvals", icon: "✅", badge: pendingProfiles.length + pendingPayments.length || null, badgeColor: "bg-amber-500" },
    { id: "ledgers",   label: "Ledgers",   icon: "🗂️", badge: null },
    { id: "absences",  label: "Absences",  icon: "📅", badge: absenceLogs.length > 0 ? absenceLogs.length : null, badgeColor: "bg-orange-500" },
    { id: "payments",  label: "Payments",  icon: "💳", badge: approvedPayments.length > 0 ? approvedPayments.length : null, badgeColor: "bg-violet-500" },
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-800 flex flex-col">

      {/* ── TOAST ── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold transition-all ${
          toast.type === "success" ? "bg-[#0F172A] text-white border border-cyan-500/30" : "bg-red-600 text-white"
        }`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}

      {/* ════ HEADER ════ */}
      <header className="bg-[#0F172A] border-b border-slate-800 sticky top-0 z-40">
        <div className="px-4 md:px-6">
          <div className="flex items-center h-16 gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="relative">
                <div className="w-9 h-9 bg-cyan-500 rounded-xl flex items-center justify-center">
                  <span className="text-[#0F172A] font-black text-sm">CS</span>
                </div>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0F172A]" />
              </div>
              <div>
                <p className="text-white font-black text-sm leading-none tracking-tight">Community Shuttle</p>
                <p className="text-slate-500 text-[10px] font-medium mt-0.5">Supervisor Console</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ════ REGISTER STUDENT FORM ════ */}
      {viewMode === "register_student" && (
        <main className="max-w-xl mx-auto px-4 py-8">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#0F172A] px-6 py-5">
              <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest">Admin Action</p>
              <h2 className="text-xl font-black text-white mt-1">Register Student</h2>
              <p className="text-slate-400 text-xs mt-1">Creates a parent profile and student transit node.</p>
            </div>
            <form onSubmit={handleRegisterStudent} className="p-6 space-y-4">
              {[
                { label: "Parent Full Name", value: simParent, set: setSimParent, placeholder: "e.g. Frank Mapunda" },
                { label: "Student Full Name", value: simStudent, set: setSimStudent, placeholder: "e.g. Juma Hamisi" },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
                  <input type="text" required placeholder={placeholder} value={value} onChange={e => set(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-400 transition bg-slate-50 focus:bg-white"/>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grade</label>
                  <select value={simGrade} onChange={e => setSimGrade(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-400 transition bg-slate-50">
                    {["Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Form 1","Form 2","Form 3","Form 4"].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Route</label>
                  <select value={simRoute} onChange={e => { setSimRoute(e.target.value); setSimStation(ROUTE_STATIONS[e.target.value][0]); }}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-400 transition bg-slate-50">
                    {Object.keys(ROUTE_STATIONS).map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Pickup Station</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROUTE_STATIONS[simRoute]?.map(station => (
                    <button key={station} type="button" onClick={() => setSimStation(station)}
                      className={`py-2.5 rounded-xl text-xs font-bold border-2 transition ${simStation === station ? "border-cyan-400 bg-cyan-50 text-cyan-800" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                      {station}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setViewMode("dashboard")}
                  className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition">
                  ← Back
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-[#0F172A] font-black rounded-xl text-sm transition shadow-sm">
                  Register Student →
                </button>
              </div>
            </form>
          </div>
        </main>
      )}

      {/* ════ DASHBOARD TABS ════ */}
      {viewMode === "dashboard" && (
        <div className="flex flex-1 w-full">

          {/* ── VERTICAL SIDEBAR NAV ── */}
          <aside className="shrink-0 bg-[#0F172A] border-r border-slate-800 flex flex-col py-6 px-2 gap-1 min-h-full justify-between">
            {/* Nav tabs */}
            <div className="flex flex-col gap-1">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black transition-all text-left whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-cyan-500 text-[#0F172A]"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}>
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge !== null && (
                    <span className={`${activeTab === tab.id ? "bg-[#0F172A]/20 text-[#0F172A]" : tab.badgeColor + " text-white"} text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shrink-0`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Supervisor info + logout at bottom */}
            <div className="flex flex-col gap-2 pt-4 border-t border-slate-800">
              <div className="px-3 py-2">
                <p className="text-white text-xs font-black whitespace-nowrap">{supervisor?.name}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Supervisor</p>
              </div>
              <button onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-slate-800 transition whitespace-nowrap">
                <span>🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </aside>

          {/* ── MAIN CONTENT AREA ── */}
        <main className="flex-1 px-6 py-6 overflow-auto min-w-0 bg-[#F1F5F9]">

          {dataLoading && (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400 text-sm">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-cyan-500 rounded-full animate-spin" />
              Loading dashboard...
            </div>
          )}

          {/* ══════════════════════════════════════
              TAB 1 — OVERVIEW
          ══════════════════════════════════════ */}
          {activeTab === "overview" && !dataLoading && (
            <div className="space-y-6">
              {/* Emergency alerts */}
              {activeEmergencies.map(alert => (
                <div key={alert.id} className="rounded-2xl overflow-hidden shadow-lg">
                  <div className={`h-1.5 w-full ${SEVERITY[alert.severity]?.bar ?? "bg-red-600"}`} />
                  <div className="bg-[#0F172A] p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${SEVERITY[alert.severity]?.dot ?? "bg-red-500"} animate-pulse`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Emergency · {SEVERITY[alert.severity]?.label ?? alert.severity}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-500">{new Date(alert.created_at).toLocaleTimeString()}</span>
                    </div>
                    <h2 className="text-xl font-black text-white mb-3">{alert.title}</h2>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[{ label: "From", val: alert.profiles?.full_name ?? "Unknown" }, { label: "Contact", val: alert.profiles?.phone ?? "—" }, { label: "Route", val: alert.profiles?.route_group ?? "—" }].map(({ label, val }) => (
                        <div key={label} className="bg-slate-800 rounded-xl px-3 py-2.5">
                          <p className="text-[10px] text-slate-500 font-medium">{label}</p>
                          <p className="text-white text-xs font-bold mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-800 rounded-xl p-3 mb-4 border-l-4 border-red-500">
                      <p className="text-slate-200 text-sm leading-relaxed">{alert.message}</p>
                    </div>
                    <div className="flex gap-2">
                      {alert.profiles?.phone && (
                        <a href={`tel:${alert.profiles.phone}`} className="flex-1 text-center py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition">📞 Call Now</a>
                      )}
                      <button onClick={() => handleResolveAlert(alert.id)}
                        className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#0F172A] text-xs font-black rounded-xl transition">
                        Acknowledge & Resolve ✓
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Stat tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile label="Pending Approvals"  value={pendingProfiles.length}  color="bg-amber-100"   icon="⏳" />
                <StatTile label="Pending Payments"   value={pendingPayments.length}  color="bg-rose-100"    icon="💳" />
                <StatTile label="Active Students"    value={students.length}         color="bg-cyan-100"    icon="🎒" />
                <StatTile label="Active Drivers"     value={drivers.length}          color="bg-emerald-100" icon="🚌" />
              </div>

              {/* Quick navigation cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { tab: "approvals", title: "Approvals", desc: `${pendingProfiles.length} profiles · ${pendingPayments.length} payments pending`, icon: "✅", color: "border-amber-400", badge: pendingProfiles.length + pendingPayments.length },
                  { tab: "ledgers",   title: "Ledgers",   desc: `${students.length} students · ${drivers.length} drivers registered`, icon: "🗂️", color: "border-cyan-500", badge: null },
                  { tab: "absences",  title: "Absences",  desc: `${absenceLogs.length} today · ${allAbsenceLogs.length} total records`, icon: "📅", color: "border-orange-400", badge: absenceLogs.length },
                  { tab: "payments",  title: "Payments",  desc: `${approvedPayments.length} approved payments on record`, icon: "💳", color: "border-violet-500", badge: approvedPayments.length },
                ].map(({ tab, title, desc, icon, color, badge }) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${color} p-5 text-left hover:shadow-md transition-all group`}>
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl">{icon}</span>
                      {badge > 0 && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full">{badge}</span>
                      )}
                    </div>
                    <p className="font-black text-slate-900 text-sm">{title}</p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{desc}</p>
                    <p className="text-[10px] text-cyan-600 font-black mt-3 group-hover:underline">View →</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════
              TAB 2 — APPROVALS
          ══════════════════════════════════════ */}
          {activeTab === "approvals" && !dataLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Profile Approvals */}
              <SectionCard accent="border-amber-400">
                <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Profile Approvals</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Drivers & parents awaiting verification</p>
                  </div>
                  {pendingProfiles.length > 0 && (
                    <span className="bg-amber-400 text-[#0F172A] text-[10px] font-black px-2.5 py-0.5 rounded-full">{pendingProfiles.length}</span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <details className="rounded-xl border border-slate-200 text-xs overflow-hidden">
                    <summary className="px-3 py-2.5 font-bold text-slate-600 cursor-pointer bg-slate-50 select-none hover:bg-slate-100 transition">
                      ⚙️ Manual Registration Tool
                    </summary>
                    <form onSubmit={handleAddToQueue} className="px-3 pb-3 pt-3 space-y-2.5 border-t border-slate-200">
                      <input type="text" required placeholder="Full name" value={regName} onChange={e => setRegName(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-cyan-400"/>
                      <input type="text" placeholder="Phone number" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-cyan-400"/>
                      <input type="text" placeholder="Route group" value={regRoute} onChange={e => setRegRoute(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-cyan-400"/>
                      <div className="flex gap-3">
                        {["driver","parent"].map(r => (
                          <label key={r} className="flex items-center gap-1.5 font-bold cursor-pointer capitalize text-slate-600">
                            <input type="radio" checked={regRole === r} onChange={() => setRegRole(r)} className="accent-cyan-500"/> {r}
                          </label>
                        ))}
                      </div>
                      <button type="submit" className="w-full bg-[#0F172A] text-white font-bold py-2 rounded-lg hover:bg-slate-800 transition">Add to Queue →</button>
                    </form>
                  </details>

                  {pendingProfiles.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 text-xs font-bold">Queue is clear</p>
                      <p className="text-slate-300 text-[11px] mt-0.5">No pending profiles</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingProfiles.map(p => (
                        <div key={p.id} className="p-3.5 rounded-xl border-2 border-slate-200 hover:border-amber-200 transition space-y-2.5 bg-slate-50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 text-sm truncate">{p.full_name}</p>
                              {p.phone && <p className="text-[11px] text-slate-500 mt-0.5">{p.phone}</p>}
                              {p.route_group && <p className="text-[11px] text-slate-400">📍 {p.route_group}</p>}
                              {p.role === "parent" && pendingStudentMap[p.id] && (
                                <p className="text-[11px] mt-1 bg-cyan-50 border border-cyan-200 text-cyan-800 font-bold px-2 py-0.5 rounded-lg inline-block">🎒 {pendingStudentMap[p.id]}</p>
                              )}
                              {p.role === "parent" && p.pickup_station && <p className="text-[11px] text-slate-400 mt-0.5">Stop: {p.pickup_station}</p>}
                              {p.role === "driver" && p.vehicle_plate && (
                                <p className="text-[11px] mt-1 bg-amber-50 border border-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-lg inline-block font-mono">🚌 {p.vehicle_plate}</p>
                              )}
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide ${p.role === "driver" ? "bg-amber-100 text-amber-800" : "bg-cyan-100 text-cyan-800"}`}>{p.role}</span>
                          </div>
                          <button onClick={() => handleApproveProfile(p.id, p.full_name, p.role)}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs py-2.5 rounded-xl transition">
                            {p.role === "driver" ? "Verify & Approve Driver ✓" : "Approve Parent Account ✓"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Payment Audit */}
              <SectionCard accent="border-rose-400">
                <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Payment Audit</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Receipts awaiting review</p>
                  </div>
                  {pendingPayments.length > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">{pendingPayments.length}</span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {pendingPayments.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 text-xs font-bold">All receipts reviewed</p>
                    </div>
                  ) : (
                    pendingPayments.map(payment => (
                      <div key={payment.id} className="p-3.5 rounded-xl border-2 border-slate-200 space-y-3 bg-slate-50 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-black text-slate-900 text-sm">{payment.profiles?.full_name}</p>
                            <p className="text-slate-500 mt-0.5">Student: <strong>{payment.students?.full_name ?? "—"}</strong></p>
                            <p className="text-slate-500">Route: <strong>{payment.profiles?.route_group ?? "—"}</strong></p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${payment.payment_type === "initial" ? "bg-cyan-100 text-cyan-800" : "bg-purple-100 text-purple-800"}`}>
                            {payment.payment_type === "initial" ? "Activation" : "Monthly"}
                          </span>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                          {[{ l: "Gateway", v: `📱 ${payment.gateway}` }, { l: "Ref Code", v: payment.transaction_code }, { l: "Amount", v: `${payment.amount} TZS` }].map(({ l, v }) => (
                            <div key={l} className="flex justify-between px-3 py-2">
                              <span className="text-slate-400">{l}</span>
                              <strong className="font-mono text-slate-800">{v}</strong>
                            </div>
                          ))}
                        </div>
                        {payment.receipt_image && (
                          <div className="rounded-xl overflow-hidden border border-slate-200 h-36 bg-slate-900">
                            <img src={payment.receipt_image} alt="Receipt" className="w-full h-full object-contain"/>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => handleRejectPayment(payment)} className="py-2.5 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:border-red-300 hover:text-red-600 transition">✕ Reject</button>
                          <button onClick={() => handleApprovePayment(payment)} className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-xl transition">✓ Approve</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ══════════════════════════════════════
              TAB 3 — LEDGERS
          ══════════════════════════════════════ */}
          {activeTab === "ledgers" && !dataLoading && (
            <div className="space-y-6">

              {/* Student Ledger */}
              <SectionCard accent="border-cyan-500">
                <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Student Registration Ledger</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Active transit nodes</p>
                  </div>
                  <button onClick={() => setViewMode("register_student")}
                    className="bg-cyan-500 hover:bg-cyan-400 text-[#0F172A] text-xs font-black px-3.5 py-1.5 rounded-xl transition">
                    + Register
                  </button>
                </div>
                <div className="overflow-x-auto">
                  {students.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-medium">No active students yet</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-5 py-3.5">Student</th>
                          <th className="px-5 py-3.5">Grade</th>
                          <th className="px-5 py-3.5">Parent</th>
                          <th className="px-5 py-3.5">Route & Stop</th>
                          <th className="px-5 py-3.5">Status</th>
                          <th className="px-5 py-3.5">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map(student => (
                          <tr key={student.id} className="hover:bg-slate-50 transition">
                            <td className="px-5 py-3.5 font-black text-slate-900">{student.full_name}</td>
                            <td className="px-5 py-3.5 text-slate-500">{student.grade ?? "—"}</td>
                            <td className="px-5 py-3.5 text-slate-600">{student.profiles?.full_name}</td>
                            <td className="px-5 py-3.5">
                              <span className="text-slate-600">{student.profiles?.route_group ?? "—"}</span>
                              {student.profiles?.pickup_station && <span className="block text-[10px] text-slate-400 mt-0.5">📍 {student.profiles.pickup_station}</span>}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${student.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                {student.is_active ? "● Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <button type="button" onClick={() => handleDeleteStudent(student)} disabled={deleteTarget === student.id}
                                className="px-3 py-2 rounded-2xl bg-red-600 text-white text-[10px] font-black disabled:opacity-50">
                                {deleteTarget === student.id ? "Deleting..." : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </SectionCard>

              {/* Drivers Ledger */}
              <SectionCard accent="border-emerald-500">
                <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Registered Drivers Ledger</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Approved drivers on active routes</p>
                  </div>
                  {drivers.length > 0 && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200">{drivers.length} Active</span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  {drivers.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-medium">No approved drivers yet</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-5 py-3.5">Driver</th>
                          <th className="px-5 py-3.5">Phone</th>
                          <th className="px-5 py-3.5">Plate</th>
                          <th className="px-5 py-3.5">Route</th>
                          <th className="px-5 py-3.5">Status</th>
                          <th className="px-5 py-3.5">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {drivers.map(driver => (
                          <tr key={driver.id} className="hover:bg-slate-50 transition">
                            <td className="px-5 py-3.5 font-black text-slate-900">{driver.full_name}</td>
                            <td className="px-5 py-3.5 text-slate-600">{driver.phone ?? "—"}</td>
                            <td className="px-5 py-3.5 text-slate-600">{driver.vehicle_plate ?? "—"}</td>
                            <td className="px-5 py-3.5 text-slate-600">{driver.route_group ?? "—"}</td>
                            <td className="px-5 py-3.5">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">Active</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <button type="button" onClick={() => handleDeleteDriver(driver)} disabled={deleteTarget === driver.id}
                                className="px-3 py-2 rounded-2xl bg-red-600 text-white text-[10px] font-black disabled:opacity-50">
                                {deleteTarget === driver.id ? "Deleting..." : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ══════════════════════════════════════
              TAB 4 — ABSENCES
          ══════════════════════════════════════ */}
          {activeTab === "absences" && !dataLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Today's Absences */}
              <SectionCard accent="border-orange-400">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-black text-slate-900">Today's Absences</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
                </div>
                <div className="p-4 space-y-2">
                  {absenceLogs.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 text-xs font-bold">No absences today</p>
                      <p className="text-slate-300 text-[11px] mt-0.5">All students expected</p>
                    </div>
                  ) : (
                    absenceLogs.map(log => (
                      <div key={log.id} className="p-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <p className="font-black text-slate-900 text-sm">{log.students?.full_name}</p>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${log.late_notice ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {log.late_notice ? "⚠ Late" : "✓ On Time"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Parent: <strong className="text-slate-700">{log.students?.profiles?.full_name}</strong></p>
                        <p className="text-xs text-slate-500">Reason: <strong className="text-slate-700">{log.reason_category}</strong></p>
                        {log.notes && <p className="text-[11px] italic text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">"{log.notes}"</p>}
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              {/* Centralized Absence Manifest */}
              <SectionCard accent="border-slate-400">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-black text-slate-900">Centralized Absence Manifest</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Full log of all reported student absences</p>
                </div>
                <div className="overflow-x-auto">
                  {allAbsenceLogs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-medium">No absence records found</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-5 py-3.5">Student</th>
                          <th className="px-5 py-3.5">Parent</th>
                          <th className="px-5 py-3.5">Reason</th>
                          <th className="px-5 py-3.5">Date</th>
                          <th className="px-5 py-3.5">Notice</th>
                          <th className="px-5 py-3.5">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allAbsenceLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50 transition">
                            <td className="px-5 py-3.5 font-black text-slate-900">{log.students?.full_name}</td>
                            <td className="px-5 py-3.5 text-slate-600">{log.students?.profiles?.full_name}</td>
                            <td className="px-5 py-3.5 text-slate-600">{log.reason_category}</td>
                            <td className="px-5 py-3.5 text-slate-500 font-mono">{log.absence_date}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${log.late_notice ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {log.late_notice ? "⚠ Late" : "✓ On Time"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <button type="button" onClick={() => handleDeleteAbsence(log)} disabled={deleteTarget === log.id}
                                className="px-3 py-2 rounded-2xl bg-red-600 text-white text-[10px] font-black disabled:opacity-50">
                                {deleteTarget === log.id ? "Deleting..." : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ══════════════════════════════════════
              TAB 5 — PAYMENTS
          ══════════════════════════════════════ */}
          {activeTab === "payments" && !dataLoading && (
            <SectionCard accent="border-violet-500">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Monthly Payment Records</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">All approved transport payments by month</p>
                </div>
                {approvedPayments.length > 0 && (
                  <span className="bg-violet-100 text-violet-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-violet-200">
                    {approvedPayments.length} Paid
                  </span>
                )}
              </div>
              <div className="p-4 space-y-4">
                {approvedPayments.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs font-medium">No approved payments yet</div>
                ) : (() => {
                  const grouped = {};
                  approvedPayments.forEach(p => {
                    const month = p.payment_month || "Unspecified";
                    if (!grouped[month]) grouped[month] = [];
                    grouped[month].push(p);
                  });
                  const sortedMonths = Object.keys(grouped).sort((a, b) => {
                    if (a === "Unspecified") return 1;
                    if (b === "Unspecified") return -1;
                    return b.localeCompare(a);
                  });
                  return sortedMonths.map(month => (
                    <div key={month} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">📅</span>
                          <p className="text-xs font-black text-slate-800">
                            {month === "Unspecified" ? "No Month Specified" : (() => {
                              try {
                                const [yr, mo] = month.split("-");
                                return new Date(parseInt(yr), parseInt(mo) - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
                              } catch { return month; }
                            })()}
                          </p>
                        </div>
                        <span className="bg-violet-100 text-violet-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {grouped[month].length} parent{grouped[month].length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-white border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-4 py-2.5">Parent</th>
                            <th className="px-4 py-2.5">Student</th>
                            <th className="px-4 py-2.5">Gateway</th>
                            <th className="px-4 py-2.5">Amount</th>
                            <th className="px-4 py-2.5">Ref Code</th>
                            <th className="px-4 py-2.5">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {grouped[month].map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3 font-black text-slate-900">{p.profiles?.full_name ?? "—"}</td>
                              <td className="px-4 py-3 text-slate-600">{p.students?.full_name ?? "—"}</td>
                              <td className="px-4 py-3 text-slate-600">{p.gateway ?? "—"}</td>
                              <td className="px-4 py-3 font-black text-slate-900">{p.amount ? `${p.amount} TZS` : "—"}</td>
                              <td className="px-4 py-3 font-mono text-slate-600">{p.transaction_code ?? "—"}</td>
                              <td className="px-4 py-3">
                                <button type="button" onClick={() => handleDeletePayment(p)} disabled={deleteTarget === p.id}
                                  className="px-3 py-2 rounded-2xl bg-red-600 text-white text-[10px] font-black disabled:opacity-50">
                                  {deleteTarget === p.id ? "Deleting..." : "Delete"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ));
                })()}
              </div>
            </SectionCard>
          )}

        </main>
        </div>
      )}
    </div>
  );
}