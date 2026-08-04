"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────────────────────
// FILE: src/app/driver/dashboard/page.jsx
// ROUTE: /driver/dashboard
// ─────────────────────────────────────────────────────────────

const SCHOOL = { lat: -6.7950, lng: 39.2450 };

const CHECKPOINTS = [
  { name: "Depot Terminal",         lat: -6.8150, lng: 39.2800 },
  { name: "Makumbusho",             lat: -6.8000, lng: 39.2680 },
  { name: "Kinondoni",              lat: -6.8220, lng: 39.2830 },
  { name: "Magomeni",               lat: -6.8080, lng: 39.2550 },
  { name: "Gerezani",               lat: -6.7990, lng: 39.2600 },
  { name: "Mnazi Mmoja",            lat: -6.8010, lng: 39.2710 },
  { name: "Machinga Complex",       lat: -6.8100, lng: 39.2760 },
  { name: "School Campus",          lat: -6.7950, lng: 39.2450 },
];

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DriverDashboard() {
  const router   = useRouter();
  const supabase = createClient();

  // ── Auth ─────────────────────────────────────
  const [authReady,    setAuthReady]    = useState(false);
  const [driverId,     setDriverId]     = useState(null);
  const [driverName,   setDriverName]   = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [routeGroup,   setRouteGroup]   = useState("");

  // ── Trip ─────────────────────────────────────
  const [isTripActive,   setIsTripActive]   = useState(false);
  const [tripId,         setTripId]         = useState(null);
  const [routeType,      setRouteType]      = useState("morning");
  const [shuttleStatus,  setShuttleStatus]  = useState("Stationary");
  const [currentStation, setCurrentStation] = useState("Depot Terminal");
  const [tripLoading,    setTripLoading]    = useState(false);

  // ── GPS ──────────────────────────────────────
  const [gpsCoords,  setGpsCoords]  = useState({ lat: null, lng: null });
  const [gpsError,   setGpsError]   = useState(null);
  const [nearSchool, setNearSchool] = useState(false);
  const gpsWatchRef = useRef(null);

  // ── Dev mode ─────────────────────────────────
  const [devMode, setDevMode] = useState(false);

  // ── Students & attendance ─────────────────────
  const [students,        setStudents]        = useState([]);
  const [attendance,      setAttendance]      = useState({});
  const [manifestLoading, setManifestLoading] = useState(false);

  // ── Emergency ────────────────────────────────
  const [emergencyAlert, setEmergencyAlert] = useState(null);

  // ── Toast ─────────────────────────────────────
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── AUTH GUARD ────────────────────────────────
  useEffect(() => {
    const verifySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/driver/register"); return; }
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, role, status, route_group, vehicle_plate")
        .eq("id", session.user.id).single();
      if (error || !profile || profile.role !== "driver") {
        await supabase.auth.signOut(); router.replace("/driver/register"); return;
      }
      if (profile.status !== "approved") { router.replace("/driver/register"); return; }
      setDriverId(session.user.id);
      setDriverName(profile.full_name);
      setVehiclePlate(profile.vehicle_plate || "");
      setRouteGroup(profile.route_group || "");
      setAuthReady(true);
    };
    verifySession();
  }, []);

  // ── FETCH STUDENTS ────────────────────────────
  const fetchStudents = useCallback(async (currentRouteGroup) => {
    setManifestLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select(`id, full_name, grade, profiles:parent_id (full_name, phone, route_group, pickup_station)`)
        .eq("is_active", true);
      if (error) return;
      setStudents((data || []).filter(s => s.profiles?.route_group === currentRouteGroup));
    } catch (err) {
      console.error("fetchStudents error:", err);
    } finally {
      setManifestLoading(false);
    }
  }, [supabase]);

  // ── RESUME ACTIVE TRIP ────────────────────────
  const checkActiveTrip = useCallback(async (currentDriverId) => {
    try {
      const res = await fetch(`/api/trips?status=active&driver_id=${currentDriverId}`);
      if (!res.ok) return;
      const trip = await res.json();
      if (trip && trip.id) {
        setTripId(trip.id); setIsTripActive(true);
        setShuttleStatus(trip.shuttle_status || "En-Route");
        setCurrentStation(trip.current_station || "Depot Terminal");
        setRouteType(trip.route_type || "morning");
        const attRes = await fetch(`/api/attendance?trip_id=${trip.id}`);
        if (attRes.ok) {
          const attData = await attRes.json();
          const map = {};
          attData.forEach(a => { map[a.student_id] = { attendance_id: a.id, checked_in: a.checked_in, checked_out: a.checked_out }; });
          setAttendance(map);
        }
      }
    } catch (err) { console.error("checkActiveTrip error:", err); }
  }, []);

  // ── POLL EMERGENCIES ──────────────────────────
  const pollEmergencies = useCallback(async () => {
    try {
      const res = await fetch("/api/emergencies?resolved=false");
      if (!res.ok) return;
      const alerts = await res.json();
      setEmergencyAlert(alerts.length > 0 ? alerts[0] : null);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!authReady || !driverId || !routeGroup) return;
    fetchStudents(routeGroup);
    checkActiveTrip(driverId);
    pollEmergencies();
    const interval = setInterval(pollEmergencies, 10000);
    return () => clearInterval(interval);
  }, [authReady, driverId, routeGroup, fetchStudents, checkActiveTrip, pollEmergencies]);

  // ── GPS WATCHER ───────────────────────────────
  useEffect(() => {
    if (!isTripActive || !tripId) {
      if (gpsWatchRef.current) { navigator.geolocation.clearWatch(gpsWatchRef.current); gpsWatchRef.current = null; }
      return;
    }
    if (!navigator.geolocation) { setGpsError("GPS not available on this device."); return; }
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setGpsCoords({ lat, lng }); setGpsError(null);
        const distToSchool = getDistanceKm(lat, lng, SCHOOL.lat, SCHOOL.lng);
        setNearSchool(distToSchool < 0.5);
        let nearestStation = "In Transit"; let minDist = 0.4;
        CHECKPOINTS.forEach(cp => {
          const d = getDistanceKm(lat, lng, cp.lat, cp.lng);
          if (d < minDist) { minDist = d; nearestStation = cp.name; }
        });
        const newStatus  = nearestStation !== "In Transit" ? "Approaching Station" : "En-Route";
        const newStation = nearestStation !== "In Transit" ? nearestStation : "Between Stations";
        setShuttleStatus(newStatus); setCurrentStation(newStation);
        try {
          await fetch("/api/trips", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: tripId, current_lat: lat, current_lng: lng, current_station: newStation, shuttle_status: newStatus }),
          });
        } catch { /* silent */ }
      },
      (err) => {
        let msg = "⚠️ GPS unavailable.";
        if (err.code === 1) msg = "⚠️ Location permission denied. Allow location access in browser settings.";
        else if (err.code === 2) msg = "⚠️ GPS signal unavailable. Move outdoors or enable location services.";
        else if (err.code === 3) msg = "⚠️ GPS timed out. Move to an open area.";
        setGpsError(msg);
        console.warn("GPS error code:", err.code, "| message:", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
    return () => {
      if (gpsWatchRef.current) { navigator.geolocation.clearWatch(gpsWatchRef.current); gpsWatchRef.current = null; }
    };
  }, [isTripActive, tripId]);

  // ── HANDLERS ──────────────────────────────────

  // Start trip — no school gate for either route
  const handleStartTrip = async () => {
    if (!driverId) return;
    // Evening route school start gate removed.
    // Driver can start evening trip freely from any location.
    setTripLoading(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, route_type: routeType }),
      });
      if (!res.ok) { const err = await res.json(); showToast(err.error || "Failed to start trip.", "error"); return; }
      const trip = await res.json();
      setTripId(trip.id); setIsTripActive(true);
      setShuttleStatus("En-Route"); setCurrentStation("Depot Terminal");
      if (students.length > 0) {
        await fetch("/api/attendance", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trip_id: trip.id, student_ids: students.map(s => s.id) }),
        });
        const attRes = await fetch(`/api/attendance?trip_id=${trip.id}`);
        if (attRes.ok) {
          const attData = await attRes.json();
          const map = {};
          attData.forEach(a => { map[a.student_id] = { attendance_id: a.id, checked_in: a.checked_in, checked_out: a.checked_out }; });
          setAttendance(map);
        }
      }
      showToast(`🚀 ${routeType === "morning" ? "Morning" : "Evening"} trip started. GPS tracking active.`);

      // Push notification to all parents on route — trip has started
      const allStudentIds = students.map(s => s.id);
      const startTitle = routeType === "morning"
        ? "🚌 Morning Shuttle Started"
        : "🚌 Evening Shuttle Started";
      const startBody = routeType === "morning"
        ? `${driverName} has started the morning route. The bus is on its way to pick up students.`
        : `${driverName} has started the evening route. The bus is heading to school to pick up students.`;
      await sendPushToParents(allStudentIds, startTitle, startBody, "trip-started");

    } catch { showToast("Network error. Please try again.", "error"); }
    finally { setTripLoading(false); }
  };

  // End trip — no school gate (removed for dev)
  const handleEndTrip = async () => {
    if (!tripId) return;
    setTripLoading(true);
    try {
      const res = await fetch("/api/trips", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tripId, status: "completed" }),
      });
      if (!res.ok) { const err = await res.json(); showToast(err.error || "Failed to end trip.", "error"); return; }
      // Send end-trip notification to parents of all boarded students.
      // Morning → "arrived at school safely"
      // Evening → "reached home safely"
      // Uses checked_in (boarded) for morning since deliver is not tracked.
      // Uses checked_in for evening too — end trip means all are home.
      const boardedStudentIds = Object.entries(attendance)
        .filter(([, att]) => att.checked_in)
        .map(([sid]) => sid);

      if (boardedStudentIds.length > 0) {
        try {
          const notificationType = routeType === "morning" ? "arrived_at_school" : "delivered_home";
          const notificationMsg  = routeType === "morning"
            ? `${driverName} has confirmed that your child has arrived at school safely.`
            : `${driverName} has confirmed that your child has reached home safely.`;

          await fetch("/api/trip-notifications", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trip_id:     tripId,
              driver_id:   driverId,
              driver_name: driverName,
              student_ids: boardedStudentIds,
              type:        notificationType,
              message:     notificationMsg,
            }),
          });

          // Also send push notification to parents for end-trip
          const endPushTitle = routeType === "morning"
            ? "🏫 Child Arrived at School"
            : "🏠 Child Reached Home Safely";
          await sendPushToParents(
            boardedStudentIds,
            endPushTitle,
            notificationMsg,
            notificationType
          );
        } catch { /* silent — don't block trip completion */ }
      }
      if (gpsWatchRef.current) { navigator.geolocation.clearWatch(gpsWatchRef.current); gpsWatchRef.current = null; }
      setIsTripActive(false); setTripId(null); setNearSchool(false);
      setGpsCoords({ lat: null, lng: null }); setAttendance({});
      setShuttleStatus(routeType === "morning" ? "Arrived at School" : "Students Delivered");
      setCurrentStation("School Campus");
      showToast(routeType === "morning" ? "🏫 Morning trip complete. Parents notified." : "🏠 Evening trip complete. All students delivered.");
    } catch { showToast("Network error. Please try again.", "error"); }
    finally { setTripLoading(false); }
  };

  // Check in — board a student
  const handleCheckIn = async (studentId) => {
    const record = attendance[studentId];
    if (!record) return;
    const isCheckedIn = record.checked_in;
    setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], checked_in: !isCheckedIn } }));
    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.attendance_id, action: isCheckedIn ? "undo_check_in" : "check_in" }),
      });
      if (!res.ok) {
        setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], checked_in: isCheckedIn } }));
        showToast("Check-in failed.", "error");
      } else if (!isCheckedIn) {
        const studentName = students.find(s => s.id === studentId)?.full_name || "Your child";
        showToast(`✓ ${studentName} marked as boarded.`);
        // Push notification to parent — child has boarded (morning route)
        await sendPushToParents(
          [studentId],
          "🛫 Child Boarded the Bus",
          `${studentName} has boarded the shuttle. The bus is on the way to school.`,
          "student-boarded"
        );
      }
    } catch {
      setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], checked_in: isCheckedIn } }));
      showToast("Network error.", "error");
    }
  };

  // Check out — deliver a student (evening only)
  const handleCheckOut = async (studentId) => {
    const record = attendance[studentId];
    if (!record) return;
    const isCheckedOut = record.checked_out;
    setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], checked_out: !isCheckedOut } }));
    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.attendance_id, action: isCheckedOut ? "undo_check_out" : "check_out" }),
      });
      if (!res.ok) {
        setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], checked_out: isCheckedOut } }));
        showToast("Check-out failed.", "error");
      } else if (!isCheckedOut) {
        const studentName = students.find(s => s.id === studentId)?.full_name || "Your child";
        showToast(`✓ ${studentName} marked as delivered.`);
        // Push notification to parent — child delivered home (evening route)
        await sendPushToParents(
          [studentId],
          "🏠 Child Delivered Home",
          `${studentName} has been delivered home safely by ${driverName}.`,
          "student-delivered"
        );
      }
    } catch {
      setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], checked_out: isCheckedOut } }));
      showToast("Network error.", "error");
    }
  };

  const handleAcknowledgeEmergency = async () => {
    if (!emergencyAlert) return;
    try {
      await fetch("/api/emergencies", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emergencyAlert.id, is_resolved: true }),
      });
      setEmergencyAlert(null);
    } catch { /* silent */ }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/driver/Register"; };

  // ── PUSH NOTIFICATION HELPER ──────────────────────────────
  // Sends a push notification to parents of the given students
  const sendPushToParents = async (studentIds, title, body, tag) => {
    if (!studentIds || studentIds.length === 0) return;
    try {
      await fetch("/api/push/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: studentIds, title, body, tag }),
      });
    } catch { /* silent — push failure should not block trip actions */ }
  };

  const canEndTrip = isTripActive && !tripLoading;

  // ── AUTH LOADING ──────────────────────────────
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading driver console...</p>
        </div>
      </div>
    );
  }

  const boardedCount   = Object.values(attendance).filter(a => a.checked_in).length;
  const deliveredCount = Object.values(attendance).filter(a => a.checked_out).length;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-12">

      {/* ── TOAST ── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold max-w-sm ${
          toast.type === "success" ? "bg-[#0F172A] text-white border border-cyan-500/30" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="bg-[#0F172A] px-6 py-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center font-black text-[#0F172A] text-sm shadow">
              CS
            </div>
            {isTripActive && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0F172A] animate-pulse" />
            )}
          </div>
          <div>
            <p className="text-white font-black text-base leading-none">{driverName}</p>
            <p className="text-slate-400 text-xs font-mono mt-0.5">{vehiclePlate} · {routeGroup}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isTripActive && (
            <span className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />LIVE
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm font-bold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-1.5 rounded-xl transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── EMERGENCY ALERT ── */}
      {emergencyAlert && (
        <div className="mx-4 mt-4 rounded-2xl overflow-hidden shadow-lg border border-red-800">
          <div className="h-1 bg-red-500 w-full" />
          <div className="bg-[#0F172A] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />Parent Emergency
              </span>
              <span className="text-[10px] font-mono text-slate-500">{new Date(emergencyAlert.created_at).toLocaleTimeString()}</span>
            </div>
            <p className="text-white font-black text-sm">{emergencyAlert.title}</p>
            <p className="text-slate-300 text-xs bg-slate-800 px-3 py-2.5 rounded-xl border-l-2 border-red-500">{emergencyAlert.message}</p>
            <button onClick={handleAcknowledgeEmergency}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl transition">
              Acknowledge & Dismiss ✓
            </button>
          </div>
        </div>
      )}

      {/* ── GPS ERROR ── */}
      {gpsError && (
        <div className="mx-4 mt-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 text-xs font-medium p-4 rounded-xl">
          {gpsError}
        </div>
      )}

      {/* ── DEV MODE BANNER ── */}
      {devMode && (
        <div className="mx-4 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-400 space-y-1">
          <p className="font-black">🧪 Dev Mode ON</p>
          <p className="text-amber-300/80">✓ End Trip gate bypassed · ✓ Both routes start freely</p>
          <p className="text-amber-600 text-[10px]">Disable before production deployment</p>
        </div>
      )}

      {/* ── MAIN TWO-COLUMN LAYOUT ── */}
      <main className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">

        {/* ════ LEFT COLUMN — Status + Trip Engine ════ */}
        <div className="space-y-4">

          {/* Current Status Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Current Status</p>
              <p className={`text-2xl font-black mt-1 flex items-center gap-2 ${isTripActive ? "text-emerald-600" : "text-slate-500"}`}>
                {isTripActive ? "🛰️" : "⏸"} {isTripActive ? "Trip Active" : "Standby"}
              </p>
            </div>

            <div className="space-y-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route Status</p>
                <p className="text-sm font-black text-slate-800 mt-0.5">{shuttleStatus}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Station</p>
                <p className="text-sm font-black font-mono text-slate-800 mt-0.5">{currentStation}</p>
              </div>
            </div>

            {isTripActive && gpsCoords.lat && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <span className="text-emerald-500 text-xs">📡</span>
                <span className="text-[11px] font-mono text-emerald-700 font-bold">
                  {gpsCoords.lat?.toFixed(5)}, {gpsCoords.lng?.toFixed(5)}
                </span>
                <span className="ml-auto text-[10px] text-emerald-500 font-black">GPS LIVE</span>
              </div>
            )}
          </div>

          {/* Trip Engine Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Trip Engine</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                {isTripActive
                  ? `${routeType === "morning" ? "🌅 Morning" : "🌆 Evening"} route in progress`
                  : "Ready to Dispatch"}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Route type toggle — only when no trip active */}
              {!isTripActive && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Route Type</p>
                  <div className="grid grid-cols-2 gap-2">
                    {["morning", "evening"].map(type => (
                      <button key={type} onClick={() => setRouteType(type)}
                        className={`py-2.5 rounded-xl text-sm font-black border-2 transition flex items-center justify-center gap-1.5 ${
                          routeType === type
                            ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                        }`}>
                        {type === "morning" ? "🌅" : "🌆"} {type === "morning" ? "Morning" : "Evening"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trip description */}
              <p className="text-xs text-slate-500 leading-relaxed">
                {routeType === "morning"
                  ? "Pick up students from stations and deliver to school. Location shared with parents in real-time."
                  : "Pick up students from school and deliver to home stations. Location shared with parents in real-time."}
              </p>

              {/* Start / End */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={isTripActive || tripLoading}
                  onClick={handleStartTrip}
                  className={`py-3 rounded-xl text-sm font-black transition flex items-center justify-center gap-2 ${
                    isTripActive || tripLoading
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-slate-200"
                      : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-md"
                  }`}
                >
                  {tripLoading && !isTripActive ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Starting...</>
                  ) : "🚀 Start Trip"}
                </button>

                <button
                  disabled={!canEndTrip}
                  onClick={handleEndTrip}
                  className={`py-3 rounded-xl text-sm font-black transition flex items-center justify-center gap-2 ${
                    canEndTrip
                      ? "bg-red-600 hover:bg-red-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-slate-200"
                  }`}
                >
                  {tripLoading && isTripActive ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Ending...</>
                  ) : "🛑 End Trip"}
                </button>
              </div>

              {isTripActive && (
                <p className="text-[11px] text-slate-400 text-center">
                  Press End Trip once all students are at their destination
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ════ RIGHT COLUMN — Student Manifest ════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900">Student Manifest</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {routeGroup} · {students.length} student{students.length !== 1 ? "s" : ""}
              </p>
            </div>
            {isTripActive && students.length > 0 && (
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                {boardedCount}/{students.length} Boarded
              </span>
            )}
          </div>

          <div className="p-4">
            {manifestLoading ? (
              <div className="flex items-center justify-center py-12 gap-3 text-slate-400 text-xs">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-cyan-500 rounded-full animate-spin" />
                Loading students...
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 rounded-xl border-2 border-dashed border-slate-200">
                <p className="text-3xl mb-2">🎒</p>
                <p className="text-slate-400 text-sm font-bold">No students on your route</p>
                <p className="text-slate-300 text-xs mt-1">Students appear once approved by admin</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                {students.map(student => {
                  const att        = attendance[student.id];
                  const checkedIn  = att?.checked_in  ?? false;
                  const checkedOut = att?.checked_out ?? false;

                  return (
                    <div key={student.id}
                      className={`rounded-2xl border-2 p-4 transition ${
                        routeType === "evening" && checkedOut
                          ? "bg-emerald-50 border-emerald-200"
                          : routeType === "morning" && checkedIn
                            ? "bg-cyan-50 border-cyan-200"
                            : "bg-slate-50 border-slate-200"
                      }`}>

                      {/* Student info */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-black text-slate-900 text-sm">{student.full_name}</p>
                          {/* DELIVERED badge — evening only */}
                          {routeType === "evening" && checkedOut && (
                            <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">DELIVERED</span>
                          )}
                          {/* ON BUS badge — morning only */}
                          {routeType === "morning" && checkedIn && (
                            <span className="text-[9px] font-black bg-cyan-500 text-white px-2 py-0.5 rounded-full">ON BUS</span>
                          )}
                        </div>

                        <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-200 space-y-1">
                          <p className="text-xs text-slate-600 font-medium">{student.profiles?.full_name}</p>
                          {student.profiles?.phone && (
                            <a href={`tel:${student.profiles.phone}`}
                              className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                              📞 {student.profiles.phone}
                            </a>
                          )}
                          <p className="flex items-center gap-1.5 text-xs text-slate-500">
                            📍 {student.profiles?.pickup_station || student.profiles?.route_group}
                          </p>
                        </div>
                      </div>

                      {/* ── ACTION BUTTONS ──────────────────────────
                          MORNING: Board button only (full width).
                            Driver boards students at their stops.
                          EVENING: Deliver button only (full width).
                            Driver delivers students to home stops.
                      ─────────────────────────────────────────── */}
                      {isTripActive && att ? (
                        routeType === "morning" ? (
                          // MORNING — Board only, full width
                          <button onClick={() => handleCheckIn(student.id)}
                            className={`w-full py-2.5 rounded-xl font-black text-xs border-2 transition ${
                              checkedIn
                                ? "bg-cyan-500 text-white border-cyan-500"
                                : "bg-white text-slate-600 border-slate-300 hover:border-cyan-400 hover:text-cyan-700"
                            }`}>
                            {checkedIn ? "✓ Boarded" : "🛫 Mark Boarded"}
                          </button>
                        ) : (
                          // EVENING — Deliver only, full width
                          <button onClick={() => handleCheckOut(student.id)}
                            className={`w-full py-2.5 rounded-xl font-black text-xs border-2 transition ${
                              checkedOut
                                ? "bg-emerald-500 text-white border-emerald-500"
                                : "bg-white text-slate-600 border-slate-300 hover:border-emerald-400 hover:text-emerald-700"
                            }`}>
                            {checkedOut ? "✓ Delivered" : "🛬 Mark Delivered"}
                          </button>
                        )
                      ) : (
                        <p className="text-[10px] text-slate-400 italic text-center pt-1">
                          Start trip to enable check-in
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}