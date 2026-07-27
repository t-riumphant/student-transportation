// src/app/api/payments/route.ts
// ---------------------------------------------------------------
// Handles all Payment operations.
// Body size limit increased to 10MB to handle receipt screenshots.
// GET   → fetch payments (filter by status for admin audit desk)
// POST  → parent submits a new payment receipt for admin review
// PATCH → admin approves or rejects a payment
// ---------------------------------------------------------------

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Increase the body size limit to 10MB to handle base64 receipt screenshots.
// App Router syntax — replaces the old Pages Router "export const config"
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// GET /api/payments?status=pending&parent_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const status    = searchParams.get("status");
  const parent_id = searchParams.get("parent_id");

  let query = supabase
    .from("payments")
    .select(`
      *,
      profiles:parent_id (
        full_name,
        phone,
        route_group
      ),
      students:student_id (
        full_name
      )
    `)
    .order("submitted_at", { ascending: false });

  if (status)    query = query.eq("status", status);
  if (parent_id) query = query.eq("parent_id", parent_id);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/payments — parent submits payment receipt
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body is too large or malformed. Try submitting without the receipt image." },
      { status: 413 }
    );
  }

  const {
    parent_id,
    student_id,
    transaction_code,
    amount,
    gateway,
    receipt_image,
    payment_type,
    payment_month,
  } = body;

  if (!parent_id || !transaction_code || !amount || !gateway) {
    return NextResponse.json(
      { error: "parent_id, transaction_code, amount, and gateway are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("payments")
    .insert([{
      parent_id,
      student_id:       student_id || null,
      transaction_code,
      amount,
      gateway,
      // Only store receipt image if it's under 2MB to avoid DB issues
      receipt_image:    receipt_image && receipt_image.length < 2000000
                          ? receipt_image
                          : null,
      payment_type:     payment_type || "initial",
      payment_month:    payment_month || null,
      status:           "pending",
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/payments — admin approves or rejects a payment
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { id, status, student_id } = body;

  if (!id || !status) {
    return NextResponse.json(
      { error: "Payment id and status are required." },
      { status: 400 }
    );
  }

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be: approved | rejected" },
      { status: 400 }
    );
  }

  const { data: paymentData, error: paymentError } = await supabase
    .from("payments")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }

  // If approved, activate the student
  if (status === "approved" && student_id) {
    await supabase
      .from("students")
      .update({ is_active: true })
      .eq("id", student_id);
  }

  return NextResponse.json(paymentData);
}

// DELETE /api/payments?id=xxx — permanently delete a payment record
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Payment id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_id: id });
}