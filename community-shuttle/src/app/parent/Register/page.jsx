"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────────────────────
// FILE: src/app/parent/register/page.jsx
// ROUTE: /parent/register
// ─────────────────────────────────────────────────────────────

function EyeOpen() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
  );
}
function EyeOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.223-3.592M6.53 6.533A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.973 9.973 0 01-4.073 5.27M15 12a3 3 0 00-3-3m0 0a3 3 0 00-2.121.879M3 3l18 18"/>
    </svg>
  );
}

export default function ParentAuth() {
  const router   = useRouter();
  const supabase = createClient();

  const ROUTE_STATIONS = {
    "Kinondoni Route": ["Makumbusho", "Kinondoni", "Magomeni"],
    "Ilala Route":     ["Gerezani", "Mnazi Mmoja", "Machinga Complex"],
  };

  const [activeTab, setActiveTab] = useState("login");

  // Shared
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);

  // Register only
  const [parentName,     setParentName]     = useState("");
  const [parentPhone,    setParentPhone]    = useState("");
  const [childGender,    setChildGender]    = useState("Male");
  const [studentName,    setStudentName]    = useState("");
  const [homeAddress,    setHomeAddress]    = useState("");
  const [selectedRoute,  setSelectedRoute]  = useState("Kinondoni Route");
  const [myChildStation, setMyChildStation] = useState("Makumbusho");

  // Feedback
  const [errorMsg,   setErrorMsg]   = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading,    setLoading]    = useState(false);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setErrorMsg(""); setSuccessMsg("");
    setEmail(""); setPassword(""); setShowPw(false);
    setParentName(""); setParentPhone(""); setStudentName(""); setHomeAddress("");
    setSelectedRoute("Kinondoni Route"); setMyChildStation("Makumbusho");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg(""); setSuccessMsg(""); setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(), password,
        options: {
          data: {
            full_name: parentName, phone: parentPhone, student_name: studentName,
            route_group: selectedRoute, pickup_station: myChildStation,
            child_gender: childGender, home_address: homeAddress,
          },
        },
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
        id: authData.user.id, full_name: parentName, phone: parentPhone,
        role: "parent", status: "pending", route_group: selectedRoute, pickup_station: myChildStation,
      }]);
      if (profileError) {
        if (profileError.code === "23505") { setSuccessMsg("Account already registered. Please login."); }
        else { setErrorMsg("Account created but profile setup failed: " + profileError.message); setLoading(false); return; }
      } else {
        const { data: existingStudent } = await supabase.from("students").select("id").eq("parent_id", authData.user.id).maybeSingle();
        if (!existingStudent) {
          const { error: studentError } = await supabase.from("students").insert([{
            parent_id: authData.user.id, full_name: studentName, is_active: false,
          }]);
          if (studentError) {
            setErrorMsg("Account created but student registration failed: " + studentError.message);
            setLoading(false); return;
          }
        }
        setSuccessMsg("Registration submitted! Pending supervisor approval. You can login now.");
      }
      setTimeout(() => switchTab("login"), 2500);
    } catch { setErrorMsg("Unexpected error. Please try again."); }
    finally { setLoading(false); }
  };

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
        setErrorMsg("No parent profile found. Please register first.");
        await supabase.auth.signOut(); setLoading(false); return;
      }
      if (profile.role !== "parent") {
        setErrorMsg("This login is for parents only.");
        await supabase.auth.signOut(); setLoading(false); return;
      }
      router.push("/parent/dashboard");
    } catch { setErrorMsg("Unexpected error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex gap-0 rounded-3xl overflow-hidden shadow-2xl">

        {/* ── LEFT BRAND PANEL ── */}
        <div className="hidden lg:flex flex-col justify-between w-[360px] shrink-0 bg-gradient-to-b from-cyan-600 to-cyan-800 p-8">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <span className="text-white font-black text-sm">CS</span>
              </div>
              <div>
                <p className="text-white font-black text-sm tracking-tight">Community Shuttle</p>
                <p className="text-cyan-200 text-[10px]">Tanzania</p>
              </div>
            </div>

            <h1 className="text-3xl font-black text-white leading-tight tracking-tight">
              Your Child's<br />
              <span className="text-cyan-200">Safe Journey</span><br />
              Starts Here
            </h1>
            <p className="text-cyan-100 text-sm mt-4 leading-relaxed opacity-90">
              Track your child's bus in real time, report absences, and stay connected with your driver — all from one place.
            </p>
          </div>

          {/* Feature cards */}
          <div className="space-y-3">
            {[
              { icon: "🗺️", title: "Live Bus Tracking",    desc: "See exactly where the bus is" },
              { icon: "📅", title: "Absence Reports",      desc: "Notify the driver instantly" },
              { icon: "🔔", title: "Boarding Alerts",      desc: "Know when your child boards" },
              { icon: "🚨", title: "Emergency Dispatch",   desc: "Reach drivers in seconds" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <span className="text-xl shrink-0">{icon}</span>
                <div>
                  <p className="text-white text-xs font-bold">{title}</p>
                  <p className="text-cyan-200 text-[11px]">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-cyan-300 text-[10px] opacity-70">Community Shuttle Tanzania · Parent Portal</p>
        </div>

        {/* ── RIGHT FORM PANEL ── */}
        <div className="flex-1 bg-white flex flex-col">
          {/* Top gradient strip */}
          <div className="h-1.5 bg-gradient-to-r from-cyan-500 to-cyan-700" />

          <div className="flex-1 p-8 flex flex-col justify-center">

            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-6 lg:hidden">
              <div className="w-9 h-9 bg-cyan-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-black text-xs">CS</span>
              </div>
              <p className="font-black text-slate-900 text-sm">Community Shuttle</p>
            </div>

            {/* Tab switcher */}
            <div className="flex bg-slate-100 rounded-2xl p-1 gap-1 mb-7">
              {[
                { id: "login",    label: "🔑 Login" },
                { id: "register", label: "📝 Register" },
              ].map(tab => (
                <button key={tab.id} type="button" onClick={() => switchTab(tab.id)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                    activeTab === tab.id
                      ? "bg-cyan-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-700"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {activeTab === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {activeTab === "login" ? "Sign in to track your child's journey" : "Register to get started"}
              </p>
            </div>

            {/* Feedback */}
            {errorMsg && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl font-medium leading-relaxed">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-4 rounded-xl font-medium leading-relaxed">
                {successMsg}
              </div>
            )}

            {/* ════ LOGIN FORM ════ */}
            {activeTab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                  <input type="email" required placeholder="your@email.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} required placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-3.5 pr-12 border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {showPw ? <EyeOff /> : <EyeOpen />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl transition shadow-md shadow-cyan-600/20 text-sm flex items-center justify-center gap-2 mt-2">
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
                  ) : "Login →"}
                </button>
                <p className="text-center text-xs text-slate-400">
                  No account?{" "}
                  <button type="button" onClick={() => switchTab("register")} className="text-cyan-600 hover:text-cyan-500 font-bold transition">
                    Register here
                  </button>
                </p>
              </form>
            )}

            {/* ════ REGISTER FORM ════ */}
            {activeTab === "register" && (
              <form onSubmit={handleRegister} className="space-y-3.5">

                {/* Parent name + phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Parent Name</label>
                    <input type="text" required placeholder="e.g. Frank Mapunda"
                      value={parentName} onChange={e => setParentName(e.target.value)}
                      className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Phone</label>
                    <input type="text" required placeholder="+255 7XX XXX XXX"
                      value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                      className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                  <input type="email" required placeholder="your@email.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} required minLength={6} placeholder="Minimum 6 characters"
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {showPw ? <EyeOff /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

                {/* Student name + gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Student Name</label>
                    <input type="text" required placeholder="e.g. Juma Hamisi"
                      value={studentName} onChange={e => setStudentName(e.target.value)}
                      className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Gender</label>
                    <select value={childGender} onChange={e => setChildGender(e.target.value)}
                      className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-cyan-500 bg-slate-50 transition">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                {/* Home address */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Home Address</label>
                  <input type="text" required placeholder="e.g. House No. 45, Upanga East"
                    value={homeAddress} onChange={e => setHomeAddress(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>

                {/* Route selection */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Shuttle Route</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {Object.keys(ROUTE_STATIONS).map(route => (
                      <button key={route} type="button"
                        onClick={() => { setSelectedRoute(route); setMyChildStation(ROUTE_STATIONS[route][0]); }}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black border-2 transition ${
                          selectedRoute === route
                            ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                            : "border-slate-200 text-slate-500 hover:border-slate-300 bg-slate-50"
                        }`}>
                        🚌 {route}
                      </button>
                    ))}
                  </div>

                  {/* Station pills */}
                  <div className="space-y-1.5">
                    {ROUTE_STATIONS[selectedRoute]?.map(station => (
                      <button key={station} type="button" onClick={() => setMyChildStation(station)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border-2 transition text-left flex items-center gap-2 ${
                          myChildStation === station
                            ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                            : "border-slate-200 text-slate-500 bg-slate-50 hover:border-slate-300"
                        }`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${myChildStation === station ? "bg-cyan-500" : "bg-slate-300"}`} />
                        📍 {station}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl transition shadow-md shadow-cyan-600/20 text-sm flex items-center justify-center gap-2 mt-1">
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Registering...</>
                  ) : "Create Account 🚀"}
                </button>

                <p className="text-center text-xs text-slate-400">
                  Already registered?{" "}
                  <button type="button" onClick={() => switchTab("login")} className="text-cyan-600 hover:text-cyan-500 font-bold transition">
                    Login here
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}