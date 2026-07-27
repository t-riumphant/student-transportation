"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────────────────────
// FILE: src/app/driver/register/page.jsx
// ROUTE: /driver/register
// PURPOSE: Driver Register + Login (tab switcher)
// ─────────────────────────────────────────────────────────────

function EyeOpen() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.223-3.592M6.53 6.533A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.973 9.973 0 01-4.073 5.27M15 12a3 3 0 00-3-3m0 0a3 3 0 00-2.121.879M3 3l18 18" />
    </svg>
  );
}

export default function DriverAuth() {
  const router   = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState("login");

  // ── Shared ────────────────────────────────────
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);

  // ── Register only ─────────────────────────────
  const [driverName,    setDriverName]    = useState("");
  const [driverPhone,   setDriverPhone]   = useState("");
  const [vehiclePlate,  setVehiclePlate]  = useState("");
  const [assignedRoute, setAssignedRoute] = useState("Kinondoni Route");

  // ── Feedback ──────────────────────────────────
  const [errorMsg,   setErrorMsg]   = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading,    setLoading]    = useState(false);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setErrorMsg(""); setSuccessMsg("");
    setEmail(""); setPassword(""); setShowPw(false);
    setDriverName(""); setDriverPhone(""); setVehiclePlate("");
  };

  // ── REGISTER ──────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg(""); setSuccessMsg(""); setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(), password,
        options: { data: { full_name: driverName, phone: driverPhone, vehicle_plate: vehiclePlate } },
      });
      if (authError) {
        if (authError.message.toLowerCase().includes("already registered") || authError.message.toLowerCase().includes("already exists")) {
          setErrorMsg("An account with this email already exists. Please login instead.");
        } else if (authError.message.toLowerCase().includes("rate limit")) {
          setErrorMsg("Email rate limit reached. Go to Supabase → Authentication → Settings → turn OFF 'Enable email confirmations'.");
        } else { setErrorMsg(authError.message); }
        setLoading(false); return;
      }
      const { error: profileError } = await supabase.from("profiles").insert([{
        id:            authData.user.id,
        full_name:     driverName,
        phone:         driverPhone,
        role:          "driver",
        status:        "pending",
        route_group:   assignedRoute,
        vehicle_plate: vehiclePlate.toUpperCase(),
      }]);
      if (profileError) {
        if (profileError.code === "23505") { setSuccessMsg("Account already registered. Please login."); }
        else { setErrorMsg("Account created but profile setup failed: " + profileError.message); setLoading(false); return; }
      } else {
        setSuccessMsg("Registration submitted! Awaiting supervisor approval. You may now login.");
      }
      setTimeout(() => switchTab("login"), 2500);
    } catch { setErrorMsg("Unexpected error. Please try again."); }
    finally { setLoading(false); }
  };

  // ── LOGIN ─────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(""); setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(), password,
      });
      if (authError) {
        if (authError.message.toLowerCase().includes("email not confirmed")) {
          setErrorMsg("Email not confirmed. Disable email confirmation in Supabase Authentication settings.");
        } else {
          setErrorMsg("No account found with this email, or the password is incorrect.");
        }
        setLoading(false); return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role, status, full_name").eq("id", authData.user.id).single();
      if (profileError || !profile) {
        setErrorMsg("No driver profile found. Please register first.");
        await supabase.auth.signOut(); setLoading(false); return;
      }
      if (profile.role !== "driver") {
        setErrorMsg("This portal is for drivers only.");
        await supabase.auth.signOut(); setLoading(false); return;
      }
      if (profile.status === "pending") {
        setErrorMsg("Your account is pending supervisor approval. Please check back soon.");
        await supabase.auth.signOut(); setLoading(false); return;
      }
      if (profile.status === "rejected") {
        setErrorMsg("Your account has been rejected. Contact a supervisor for assistance.");
        await supabase.auth.signOut(); setLoading(false); return;
      }
      router.push("/driver/dashboard");
    } catch { setErrorMsg("Unexpected error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex">

      {/* ── LEFT BRAND PANEL ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 border-r border-slate-800">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center">
              <span className="text-[#0F172A] font-black text-sm">CS</span>
            </div>
            <div>
              <p className="text-white font-black text-sm tracking-tight">Community Shuttle</p>
              <p className="text-slate-500 text-[10px]">Tanzania</p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
            Driver<br />
            <span className="text-cyan-400">Operations</span><br />
            Portal
          </h1>
          <p className="text-slate-400 text-sm mt-4 leading-relaxed">
            Your command station for managing student pickups, live GPS tracking, and daily route operations.
          </p>
        </div>

        {/* Route info */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Available Routes</p>
          {[
            { route: "Kinondoni Route", stations: ["Makumbusho", "Kinondoni", "Magomeni"], color: "border-cyan-500" },
            { route: "Ilala Route",     stations: ["Gerezani", "Mnazi Mmoja", "Machinga Complex"], color: "border-purple-500" },
          ].map(({ route, stations, color }) => (
            <div key={route} className={`border-l-2 ${color} pl-4 py-1`}>
              <p className="text-white text-xs font-black">{route}</p>
              <p className="text-slate-500 text-[11px] mt-0.5">{stations.join(" · ")}</p>
            </div>
          ))}
        </div>

        <p className="text-slate-600 text-[10px]">Community Shuttle Tanzania · Driver Access</p>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center">
              <span className="text-[#0F172A] font-black text-sm">CS</span>
            </div>
            <div>
              <p className="text-white font-black text-sm">Community Shuttle</p>
              <p className="text-slate-500 text-[10px]">Driver Portal</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-slate-800/60 rounded-2xl p-1 gap-1 mb-8 border border-slate-700">
            {[
              { id: "login",    label: "🔑 Login" },
              { id: "register", label: "📝 Register" },
            ].map(tab => (
              <button key={tab.id} type="button" onClick={() => switchTab(tab.id)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                  activeTab === tab.id
                    ? "bg-cyan-500 text-[#0F172A]"
                    : "text-slate-400 hover:text-white"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {activeTab === "login" ? "Welcome back" : "Join as driver"}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {activeTab === "login"
                ? "Sign in to your driver console"
                : "Register to start operating a route"}
            </p>
          </div>

          {/* Feedback */}
          {errorMsg && (
            <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-xl font-medium leading-relaxed">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-4 rounded-xl font-medium leading-relaxed">
              {successMsg}
            </div>
          )}

          {/* ════ LOGIN FORM ════ */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                <input type="email" required placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} required placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-12 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPw(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                    {showPw ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#0F172A] font-black py-3.5 rounded-xl transition shadow-lg shadow-cyan-500/20 text-sm flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-[#0F172A]/30 border-t-[#0F172A] rounded-full animate-spin" />Signing in...</>
                ) : "Login →"}
              </button>
              <p className="text-center text-xs text-slate-600">
                New driver?{" "}
                <button type="button" onClick={() => switchTab("register")} className="text-cyan-400 hover:text-cyan-300 font-bold transition">
                  Register here
                </button>
              </p>
            </form>
          )}

          {/* ════ REGISTER FORM ════ */}
          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">

              {/* Full name */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Full Name</label>
                <input type="text" required placeholder="e.g. Hamisi Juma"
                  value={driverName} onChange={e => setDriverName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
                <input type="email" required placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              {/* Phone + Plate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Phone</label>
                  <input type="text" required placeholder="+255 7XX XXX XXX"
                    value={driverPhone} onChange={e => setDriverPhone(e.target.value)}
                    className="w-full px-3 py-3.5 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Vehicle Plate</label>
                  <input type="text" required placeholder="T 412 DIT"
                    value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value.toUpperCase())}
                    className="w-full px-3 py-3.5 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition font-mono uppercase"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} required minLength={6} placeholder="Minimum 6 characters"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-12 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPw(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                    {showPw ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>

              {/* Route selection */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Assigned Route
                </label>
                <p className="text-[11px] text-slate-600 mb-2.5">
                  Choose the route you will operate. You will only see students assigned to this route.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {["Kinondoni Route", "Ilala Route"].map(route => (
                    <button key={route} type="button" onClick={() => setAssignedRoute(route)}
                      className={`py-3 rounded-xl text-xs font-black border-2 transition text-left px-3 ${
                        assignedRoute === route
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                          : "border-slate-700 text-slate-500 hover:border-slate-500"
                      }`}>
                      <span className="block text-lg mb-0.5">🚌</span>
                      {route}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info notice */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex gap-2.5">
                <span className="text-amber-400 shrink-0 text-sm mt-0.5">ℹ️</span>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Your account will be reviewed by a supervisor before you can access the driver console.
                </p>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#0F172A] font-black py-3.5 rounded-xl transition shadow-lg shadow-cyan-500/20 text-sm flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-[#0F172A]/30 border-t-[#0F172A] rounded-full animate-spin" />Submitting...</>
                ) : "Submit Registration →"}
              </button>

              <p className="text-center text-xs text-slate-600">
                Already registered?{" "}
                <button type="button" onClick={() => switchTab("login")} className="text-cyan-400 hover:text-cyan-300 font-bold transition">
                  Login here
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}