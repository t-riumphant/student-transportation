/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────────────────────
// FILE: src/app/parent/payments/page.jsx
// ROUTE: /parent/payments
// ─────────────────────────────────────────────────────────────

export default function ParentPayments() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Auth
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [parentName, setParentName] = useState("");
  const [studentId, setStudentId] = useState(null);

  // Payment state
  const [isInitialPayment, setIsInitialPayment] = useState(true);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Form fields
  const [studentNameInput, setStudentNameInput] = useState("");
  const [transactionCode, setTransactionCode] = useState("");
  const [amount, setAmount] = useState("");
  const [gateway, setGateway] = useState("M-Pesa");
  const [, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [, setPaymentId] = useState(null);
  const [paymentMonth, setPaymentMonth] = useState("");

  // Auth guard + hydration
  useEffect(() => {
    const verifySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/parent/register");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .single();

      if (!profile || profile.role !== "parent") {
        router.replace("/parent/register");
        return;
      }

      setUserId(session.user.id);
      setParentName(profile.full_name);

      const { data: student } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("parent_id", session.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (student) {
        setStudentNameInput(student.full_name);
        setStudentId(student.id);
      }

      const { data: lastPayment } = await supabase
        .from("payments")
        .select("status, payment_type")
        .eq("parent_id", session.user.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastPayment?.status === "approved" && lastPayment?.payment_type === "initial") {
        setIsInitialPayment(false);
      } else {
        setIsInitialPayment(true);
      }

      setAuthReady(true);
    };

    verifySession();
  }, [router, supabase]);

  // File preview
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setReceiptFile(file);

    const reader = new FileReader();
    reader.onloadend = () => setReceiptPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Image compression
  const compressImage = (base64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = base64;
    });
  };

  // Submit payment
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!transactionCode.trim() || !userId) return;

    // Month is required
    if (!paymentMonth) {
      alert("Please select the month you are paying for.");
      return;
    }

    // FIX — receipt image is required. Block submission if not attached.
    if (!receiptPreview) {
      alert("Please attach a screenshot of your transaction receipt before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      let compressedImage = null;
      if (receiptPreview) compressedImage = await compressImage(receiptPreview);

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_id: userId,
          student_id: studentId || null,
          transaction_code: transactionCode,
          amount,
          gateway,
          receipt_image: compressedImage || null,
          payment_type: isInitialPayment ? "initial" : "monthly",
          payment_month: paymentMonth || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert("Submission failed: " + (err.error || "Unknown error"));
        setSubmitting(false);
        return;
      }

      const newPayment = await res.json();
      setPaymentId(newPayment.id);
      setFormSubmitted(true);
    } catch (err) {
      console.error("Payment submit error:", err);
      alert("Submission failed. Try removing the receipt image and resubmit.");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading
  if (!authReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Loading payment center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-12">
      {/* Header */}
      <header className="bg-[#0F172A] border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/parent/dashboard"
                className="w-8 h-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition text-xs font-bold"
              >
                ←
              </Link>
              <div>
                <p className="text-white font-black text-sm leading-none">Payment Center</p>
                <p className="text-slate-500 text-[10px] mt-0.5">
                  {isInitialPayment ? "Account Activation" : "Monthly Renewal"}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
              {parentName}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* ════ SUCCESS STATE ════ */}
        {formSubmitted ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600" />
            <div className="p-8 text-center space-y-5">
              <div className="w-20 h-20 bg-emerald-50 border-2 border-emerald-200 rounded-3xl flex items-center justify-center mx-auto">
                <span className="text-4xl">✓</span>
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Submitted</p>
                <h2 className="text-2xl font-black text-slate-900 mt-1">Receipt Received</h2>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  Your payment is pending supervisor verification. You'll gain dashboard access once approved.
                </p>
              </div>

              {/* Payment summary */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 divide-y divide-slate-200 text-left">
                {[
                  { label: "Month", value: paymentMonth, mono: false },
                  { label: "Transaction Code", value: transactionCode, mono: true },
                  { label: "Gateway", value: gateway, mono: false },
                  { label: "Amount", value: `${amount} TZS`, mono: false },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between items-center px-4 py-3 text-xs">
                    <span className="text-slate-400">{label}</span>
                    <strong className={`text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</strong>
                  </div>
                ))}
              </div>

              <Link
                href="/parent/dashboard"
                className="block w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3.5 rounded-2xl text-sm transition shadow-md shadow-cyan-600/20"
              >
                Return to Dashboard →
              </Link>
            </div>
          </div>
        ) : (
          /* ════ PAYMENT FORM ════ */
          <div className="space-y-4">
            {/* Form header card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div
                className={`p-6 ${
                  isInitialPayment ? "bg-gradient-to-r from-cyan-600 to-cyan-800" : "bg-gradient-to-r from-[#0F172A] to-slate-800"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl shrink-0">
                    {isInitialPayment ? "💳" : "🔄"}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                      {isInitialPayment ? "One-time Fee" : "Monthly Renewal"}
                    </span>
                    <h2 className="text-lg font-black text-white mt-0.5">
                      {isInitialPayment ? "Account Activation Payment" : "Submit Monthly Payment"}
                    </h2>
                    <p className={`text-xs mt-1 ${isInitialPayment ? "text-cyan-200" : "text-slate-400"}`}>
                      {isInitialPayment
                        ? "Required to unlock your live tracking dashboard"
                        : "Submit your receipt to renew monthly access"}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Student name */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Student Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juma Hamisi"
                    value={studentNameInput}
                    onChange={(e) => setStudentNameInput(e.target.value)}
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>

                {/* Gateway selector */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Payment Gateway
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["M-Pesa", "Tigo Pesa", "Airtel Money"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGateway(g)}
                        className={`py-3 rounded-xl text-xs font-black border-2 transition ${
                          gateway === g
                            ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                            : "border-slate-200 text-slate-500 bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {g === "M-Pesa" ? "📱" : g === "Tigo Pesa" ? "📲" : "📳"}
                        <br />
                        <span className="text-[10px]">{g}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment month */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Month Paying For <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    required
                    value={paymentMonth}
                    onChange={(e) => setPaymentMonth(e.target.value)}
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500 bg-slate-50 focus:bg-white transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">Select the month this payment covers.</p>
                </div>

                {/* Transaction code + amount */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Reference Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SLC783"
                      value={transactionCode}
                      onChange={(e) => setTransactionCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-3.5 border-2 border-slate-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:border-cyan-500 bg-slate-50 transition tracking-widest"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Amount (TZS)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">TZS</span>
                      <input
                        type="number"
                        required
                        placeholder="50000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-11 pr-3 py-3.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500 bg-slate-50 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Receipt upload — now required */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Receipt Screenshot <span className="text-red-500">*</span>
                  </label>
                  {receiptPreview ? (
                    <div
                      className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-200"
                      style={{ height: "160px" }}
                    >
                      <img src={receiptPreview} alt="Receipt" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptFile(null);
                          setReceiptPreview(null);
                        }}
                        className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl hover:bg-red-500 transition"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-red-200 hover:border-cyan-400 rounded-2xl p-8 cursor-pointer transition-all hover:bg-cyan-50 text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                        <span className="text-2xl">📸</span>
                      </div>
                      <p className="text-xs font-black text-slate-500">Tap to upload receipt</p>
                      <p className="text-[11px] text-red-400 font-bold mt-1">Required — cannot submit without a receipt image</p>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                  )}
                </div>

                {/* Info notice */}
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <span className="text-blue-500 shrink-0 mt-0.5 text-sm">ℹ️</span>
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Your receipt will be reviewed by a supervisor before your dashboard is activated. You'll be notified
                    automatically once approved.
                  </p>
                </div>

                {/* Submit — disabled until image is attached */}
                <button
                  type="submit"
                  disabled={submitting || !receiptPreview || !paymentMonth}
                  className={`w-full text-white font-black py-4 rounded-2xl text-sm transition shadow-lg flex items-center justify-center gap-2 ${
                    isInitialPayment
                      ? "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20 disabled:opacity-50"
                      : "bg-[#0F172A] hover:bg-slate-800 shadow-slate-900/20 disabled:opacity-50"
                  } disabled:cursor-not-allowed`}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : !paymentMonth ? (
                    "Select Payment Month to Continue"
                  ) : !receiptPreview ? (
                    "Attach Receipt to Continue"
                  ) : (
                    "Submit Payment Receipt →"
                  )}
                </button>
              </form>
            </div>

            {/* Security note */}
            <div className="flex items-center justify-center gap-2 text-slate-400 text-[11px]">
              <span>🔒</span>
              <span>Your payment information is handled securely</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}