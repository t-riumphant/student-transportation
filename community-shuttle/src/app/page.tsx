// src/app/page.tsx
// ROOT LANDING PAGE — Community Shuttle Tanzania
// Shown when anyone opens the app link

"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = [
    {
      icon: "🗺️",
      title: "Live GPS Tracking",
      desc: "Parents track the school bus in real time on Google Maps. Always know exactly where the shuttle is.",
    },
    {
      icon: "🔔",
      title: "Instant Notifications",
      desc: "Get push alerts the moment your child boards, arrives at school, or is safely delivered home.",
    },
    {
      icon: "💳",
      title: "Digital Payments",
      desc: "Submit M-Pesa, Tigo Pesa, or Airtel Money receipts digitally. No more lost paper receipts.",
    },
    {
      icon: "📅",
      title: "Absence Reporting",
      desc: "Report your child's absence directly from the app. The driver and admin are notified instantly.",
    },
    {
      icon: "🚨",
      title: "Emergency Alerts",
      desc: "Send an emergency alert to the supervisor and driver with one tap in any urgent situation.",
    },
    {
      icon: "🗂️",
      title: "Admin Console",
      desc: "Supervisors manage approvals, payments, drivers, students, and absences from one tabbed dashboard.",
    },
  ];

  const portals = [
    {
      role:    "Supervisor",
      icon:    "🛡️",
      desc:    "Manage drivers, parents, payments, and student records from the admin console.",
      action:  "Access Console",
      route:   "/admin",
      bg:      "bg-[#0F172A]",
      border:  "border-cyan-500",
      text:    "text-cyan-400",
      btnBg:   "bg-cyan-500 hover:bg-cyan-400 text-[#0F172A]",
    },
    {
      role:    "Parent",
      icon:    "👨‍👩‍👧",
      desc:    "Track your child's bus, receive notifications, report absences, and manage payments.",
      action:  "Parent Portal",
      route:   "/parent/Register",
      bg:      "bg-white",
      border:  "border-cyan-600",
      text:    "text-cyan-700",
      btnBg:   "bg-cyan-600 hover:bg-cyan-500 text-white",
    },
    {
      role:    "Driver",
      icon:    "🚌",
      desc:    "Access your route manifest, start trips, mark boarding and delivery, and stream your GPS.",
      action:  "Driver Console",
      route:   "/driver/Register",
      bg:      "bg-white",
      border:  "border-cyan-600",
      text:    "text-cyan-700",
      btnBg:   "bg-cyan-600 hover:bg-cyan-500 text-white",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans">

      {/* ── STICKY NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#0F172A]/95 backdrop-blur shadow-lg" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-500 rounded-xl flex items-center justify-center">
              <span className="text-[#0F172A] font-black text-sm">CS</span>
            </div>
            <div>
              <p className="text-white font-black text-sm leading-none">Community Shuttle</p>
              <p className="text-slate-400 text-[10px]">Tanzania</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/parent/Register")}
              className="text-slate-300 hover:text-white text-xs font-bold px-3 py-2 rounded-xl transition">
              Parent
            </button>
            <button onClick={() => router.push("/driver/Register")}
              className="text-slate-300 hover:text-white text-xs font-bold px-3 py-2 rounded-xl transition">
              Driver
            </button>
            <button onClick={() => router.push("/admin")}
              className="bg-cyan-500 hover:bg-cyan-400 text-[#0F172A] text-xs font-black px-4 py-2 rounded-xl transition">
              Admin Login
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="bg-[#0F172A] min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 relative overflow-hidden">

        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black px-4 py-2 rounded-full mb-8 uppercase tracking-widest">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse inline-block" />
            Tanzania School Transport Platform
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-6">
            Safe. Connected.<br />
            <span className="text-cyan-400">School Transport</span><br />
            Made Simple.
          </h1>

          {/* Subheadline */}
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
            Community Shuttle connects parents, drivers, and school administrators
            on one platform — with live GPS tracking, instant notifications, and
            digital payment management.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button onClick={() => router.push("/parent/Register")}
              className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-[#0F172A] font-black px-8 py-4 rounded-2xl text-sm transition shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2">
              👨‍👩‍👧 Register as Parent
            </button>
            <button onClick={() => router.push("/driver/Register")}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black px-8 py-4 rounded-2xl text-sm transition flex items-center justify-center gap-2">
              🚌 Register as Driver
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[
              { value: "2",       label: "Active Routes" },
              { value: "Live",    label: "GPS Tracking" },
              { value: "3",       label: "User Portals" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-cyan-400">{value}</p>
                <p className="text-slate-500 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <p className="text-slate-600 text-[10px] uppercase tracking-widest">Scroll to explore</p>
          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Built for Everyone in the Journey</h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm leading-relaxed">
              Three dedicated portals, one connected platform. Every user gets exactly the tools they need.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "🛡️",
                role: "Supervisor",
                color: "bg-[#0F172A]",
                textColor: "text-cyan-400",
                steps: [
                  "Review and approve parent & driver accounts",
                  "Verify payment receipts from parents",
                  "Monitor daily absences and trip records",
                  "Manage student and driver ledgers",
                ],
              },
              {
                icon: "👨‍👩‍👧",
                role: "Parent",
                color: "bg-cyan-600",
                textColor: "text-white",
                steps: [
                  "Register and submit payment receipt",
                  "Track the bus live on Google Maps",
                  "Receive push alerts for every trip event",
                  "Report absences and send emergency alerts",
                ],
              },
              {
                icon: "🚌",
                role: "Driver",
                color: "bg-slate-700",
                textColor: "text-cyan-400",
                steps: [
                  "Log in and view your route manifest",
                  "Start morning or evening trip",
                  "Mark each student as boarded or delivered",
                  "End trip to notify all parents automatically",
                ],
              },
            ].map(({ icon, role, color, textColor, steps }) => (
              <div key={role} className={`${color} rounded-3xl p-6 text-white`}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl">{icon}</span>
                  <p className={`font-black text-lg ${textColor}`}>{role}</p>
                </div>
                <ul className="space-y-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                      <span className={`shrink-0 w-5 h-5 rounded-full ${textColor} bg-white/10 flex items-center justify-center text-[10px] font-black mt-0.5`}>
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section className="py-20 px-6 bg-[#F1F5F9]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-3">Platform Features</p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Everything You Need, In One Place</h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm leading-relaxed">
              Designed specifically for school transportation management in Tanzania.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                <div className="w-12 h-12 bg-cyan-50 border border-cyan-100 rounded-2xl flex items-center justify-center text-2xl mb-4">
                  {icon}
                </div>
                <h3 className="font-black text-slate-900 text-sm mb-2">{title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROUTES SECTION ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-3">Active Routes</p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Serving Two Routes in Dar es Salaam</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              {
                name: "Kinondoni Route",
                stations: ["Makumbusho", "Kinondoni", "Magomeni"],
                color: "border-cyan-500",
                bg: "bg-cyan-50",
                badge: "bg-cyan-100 text-cyan-800",
              },
              {
                name: "Ilala Route",
                stations: ["Gerezani", "Mnazi Mmoja", "Machinga Complex"],
                color: "border-violet-500",
                bg: "bg-violet-50",
                badge: "bg-violet-100 text-violet-800",
              },
            ].map(({ name, stations, color, bg, badge }) => (
              <div key={name} className={`rounded-2xl border-2 ${color} ${bg} p-6`}>
                <p className="font-black text-slate-900 text-sm mb-4">🚌 {name}</p>
                <div className="space-y-2">
                  {stations.map((station, i) => (
                    <div key={station} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full ${badge} text-[10px] font-black flex items-center justify-center shrink-0`}>
                        {i + 1}
                      </span>
                      <span className="text-slate-700 text-sm font-medium">📍 {station}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PORTAL SELECTION ── */}
      <section className="py-20 px-6 bg-[#0F172A]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-3">Get Started</p>
            <h2 className="text-3xl font-black text-white tracking-tight">Choose Your Portal</h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto text-sm leading-relaxed">
              Select your role to register or log in to your dedicated portal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {portals.map(({ role, icon, desc, action, route, bg, border, text, btnBg }) => (
              <div key={role}
                className={`${bg} rounded-3xl border-2 ${border} p-7 flex flex-col gap-5 shadow-lg`}>
                <div>
                  <div className="text-4xl mb-4">{icon}</div>
                  <p className={`font-black text-lg ${text}`}>{role}</p>
                  <p className="text-slate-500 text-sm mt-2 leading-relaxed">{desc}</p>
                </div>
                <button onClick={() => router.push(route)}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm transition shadow-sm ${btnBg}`}>
                  {action} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0F172A] border-t border-slate-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded-xl flex items-center justify-center">
              <span className="text-[#0F172A] font-black text-xs">CS</span>
            </div>
            <div>
              <p className="text-white font-black text-xs">Community Shuttle</p>
              <p className="text-slate-500 text-[10px]">Tanzania · School Transport Platform</p>
            </div>
          </div>
          <p className="text-slate-600 text-[11px]">
            © {new Date().getFullYear()} Community Shuttle Tanzania. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
            <button onClick={() => router.push("/admin")} className="hover:text-cyan-400 transition">Admin</button>
            <button onClick={() => router.push("/parent/Register")} className="hover:text-cyan-400 transition">Parent</button>
            <button onClick={() => router.push("/driver/Register")} className="hover:text-cyan-400 transition">Driver</button>
          </div>
        </div>
      </footer>

    </div>
  );
}