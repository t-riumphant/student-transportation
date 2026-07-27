// src/app/api/absences/route.ts
// ---------------------------------------------------------------
// Handles all Absence log operations.
// GET  → fetch absences (optionally filter by date for daily manifest)
// POST → submit a new absence report from the Parent Dashboard
// ---------------------------------------------------------------

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/absences?date=2025-01-15
// Fetches absence logs joined with student name for the Admin manifest table
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date"); // Filter by specific date e.g. today

  // Join students table to get student name and parent info
  let query = supabase
    .from("absences")
    .select(`
      *,
      students:student_id (
        full_name,
        grade,
        profiles:parent_id (
          full_name,
          phone
        )
      )
    `)
    .order("submitted_at", { ascending: false });

  // Filter by absence date if provided (used by Admin daily manifest)
  if (date) query = query.eq("absence_date", date);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/absences — log a new student absence from Parent Dashboard
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { student_id, submitted_by, absence_date, reason_category, notes, late_notice } = body;

  // Validate required fields
  if (!student_id || !submitted_by || !absence_date || !reason_category) {
    return NextResponse.json(
      { error: "student_id, submitted_by, absence_date, and reason_category are all required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("absences")
    .insert([{
      student_id,
      submitted_by,
      absence_date,
      reason_category,
      notes: notes || null,
      late_notice: late_notice || false,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/absences?id=xxx — permanently delete an absence record
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Absence id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("absences")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_id: id });
}