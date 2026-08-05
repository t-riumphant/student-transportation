"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────────────────────
// FILE: src/app/admin/page.jsx
// ROUTE: /admin
// PURPOSE: Admin Register + Login (tab switcher)
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

export default function AdminAuthPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState("login");
  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showLoginPw,    setShowLoginPw]    = useState(false);
  const [showRegisterPw, setShowRegisterPw] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading,    setLoading]    = useState(false);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setErrorMsg(""); setSuccessMsg("");
    setFullName(""); setEmail(""); setPassword("");
    setShowLoginPw(false); setShowRegisterPw(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg(""); setSuccessMsg(""); setLoading(true);
    if (!email.toLowerCase().endsWith("@gmail.com")) {
      setErrorMsg("Please use a Gmail address (e.g. yourname@gmail.com).");
      setLoading(false); return;
    }
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(), password,
        options: { data: { full_name: fullName } },
      });
      if (authError) {
        if (authError.message.toLowerCase().includes("already registered") || authError.message.toLowerCase().includes("already exists")) {
          setErrorMsg("An account with this email already exists. Please login instead.");
        } else if (authError.message.toLowerCase().includes("rate limit")) {
          setErrorMsg("Email rate limit reached. Go to Supabase → Authentication → Settings and turn OFF 'Enable email confirmations'.");
        } else { setErrorMsg(authError.message); }
        setLoading(false); return;
      }
      const { error: profileError } = await supabase.from("profiles").insert([{
        id: authData.user.id, full_name: fullName, role: "supervisor", status: "approved",
      }]);
      if (profileError) {
        if (profileError.code === "23505") { setSuccessMsg("Account already set up! Please login."); }
        else { setErrorMsg("Account created but profile setup failed: " + profileError.message); setLoading(false); return; }
      } else {
        setSuccessMsg("Account created successfully! Redirecting to login...");
      }
      setTimeout(() => switchTab("login"), 2000);
    } catch { setErrorMsg("Unexpected error. Please try again."); }
    finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(""); setLoading(true);
    if (!email.toLowerCase().endsWith("@gmail.com")) {
      setErrorMsg("Please enter your Gmail address (e.g. yourname@gmail.com).");
      setLoading(false); return;
    }
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(), password,
      });
      if (authError) {
        if (authError.message.toLowerCase().includes("email not confirmed")) {
          setErrorMsg("Your email is not confirmed. Go to Supabase → Authentication → Settings and turn OFF 'Enable email confirmations'.");
        } else if (authError.message.toLowerCase().includes("rate limit")) {
          setErrorMsg("Too many login attempts. Please wait a few minutes and try again.");
        } else {
          setErrorMsg("No account found with this email, or the password is incorrect.");
        }
        setLoading(false); return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role, status, full_name").eq("id", authData.user.id).single();
      if (profileError || !profile) {
        setErrorMsg("No admin profile found. Please register first.");
        await supabase.auth.signOut(); setLoading(false); return;
      }
      if (profile.role !== "supervisor") {
        setErrorMsg("Access denied. This portal is for supervisors only.");
        await supabase.auth.signOut(); setLoading(false); return;
      }
      router.push("/admin/dashboard");
    } catch { setErrorMsg("Unexpected error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex">

      {/* ── LEFT PANEL — brand identity ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 border-r border-slate-800">
        {/* Logo */}
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center">
              <span className="text-[#0F172A] font-black text-sm">CS</span>
            </div>
            <div>
              <p className="text-white font-black text-sm tracking-tight">Community Shuttle</p>
              <p className="text-slate-500 text-[10px] font-medium">Tanzania</p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
            Supervisor<br />
            <span className="text-cyan-400">Command</span><br />
            Portal
          </h1>
          <p className="text-slate-400 text-sm mt-4 leading-relaxed">
            Manage drivers, parents, students, payments and emergency alerts from a single operations console.
          </p>
        </div>

        {/* Feature list */}
        <div className="space-y-3">
          {[
            { icon: "🚌", text: "Driver approval & route management" },
            { icon: "👨‍👩‍👧", text: "Parent & student registration" },
            { icon: "💳", text: "Payment receipt audit desk" },
            { icon: "🚨", text: "Real-time emergency alert system" },
            { icon: "📋", text: "Daily absence manifest" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-sm shrink-0">
                {icon}
              </div>
              <p className="text-slate-400 text-xs">{text}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-slate-600 text-[10px]">Community Shuttle Tanzania · Supervisor Access Only</p>
      </div>

      {/* ── RIGHT PANEL — auth form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center">
              <span className="text-[#0F172A] font-black text-sm">CS</span>
            </div>
            <div>
              <p className="text-white font-black text-sm">Community Shuttle</p>
              <p className="text-slate-500 text-[10px]">Supervisor Portal</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-slate-800/60 rounded-2xl p-1 gap-1 mb-8 border border-slate-700">
            {["login", "register"].map(tab => (
              <button key={tab} type="button" onClick={() => switchTab(tab)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all capitalize ${
                  activeTab === tab
                    ? "bg-cyan-500 text-[#0F172A]"
                    : "text-slate-400 hover:text-white"
                }`}>
                {tab === "login" ? "🔒 Login" : "📝 Register"}
              </button>
            ))}
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {activeTab === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {activeTab === "login"
                ? "Sign in to your supervisor console"
                : "Set up a new supervisor account"}
            </p>
          </div>

          {/* Feedback */}
          {errorMsg && (
            <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-xl font-medium leading-relaxed">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-4 rounded-xl font-medium">
              {successMsg}
            </div>
          )}

          {/* ════ LOGIN FORM ════ */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Gmail Address
                </label>
                <input type="email" required placeholder="yourname@gmail.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Password
                </label>
                <div className="relative">
                  <input type={showLoginPw ? "text" : "password"} required placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-12 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowLoginPw(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                    {showLoginPw ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#0F172A] font-black py-3.5 rounded-xl transition shadow-lg shadow-cyan-500/20 text-sm flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-[#0F172A]/30 border-t-[#0F172A] rounded-full animate-spin" />Verifying...</>
                ) : "Login →"}
              </button>
              <p className="text-center text-xs text-slate-600">
                No account?{" "}
                <button type="button" onClick={() => switchTab("register")} className="text-cyan-400 hover:text-cyan-300 font-bold transition">
                  Register here
                </button>
              </p>
            </form>
          )}

          {/* ════ REGISTER FORM ════ */}
          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Full Name
                </label>
                <input type="text" required placeholder="e.g. Officer Juma Ally"
                  value={fullName} onChange={e => setFullName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Gmail Address
                </label>
                <input type="email" required placeholder="yourname@gmail.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Password
                </label>
                <div className="relative">
                  <input type={showRegisterPw ? "text" : "password"} required minLength={6}
                    placeholder="Minimum 6 characters"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-12 bg-slate-800/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowRegisterPw(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                    {showRegisterPw ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#0F172A] font-black py-3.5 rounded-xl transition shadow-lg shadow-cyan-500/20 text-sm flex items-center justify-center gap-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-[#0F172A]/30 border-t-[#0F172A] rounded-full animate-spin" />Creating Account...</>
                ) : "Create Supervisor Account ✓"}
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