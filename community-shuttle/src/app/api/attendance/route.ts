// src/app/api/attendance/route.ts
// ---------------------------------------------------------------
// GET   → fetch attendance rows for a trip
// POST  → bulk-create attendance rows when a trip starts
//         (one row per student on the route)
// PATCH → driver checks in or checks out a student
// ---------------------------------------------------------------

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/attendance?trip_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const trip_id = searchParams.get("trip_id");

  if (!trip_id) {
    return NextResponse.json({ error: "trip_id is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("attendance")
    .select(`
      *,
      students:student_id (
        full_name,
        grade,
        profiles:parent_id (
          full_name,
          phone,
          route_group
        )
      )
    `)
    .eq("trip_id", trip_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/attendance — bulk create attendance rows for a trip
// Body: { trip_id: string, student_ids: string[] }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { trip_id, student_ids } = body;

  if (!trip_id || !student_ids?.length) {
    return NextResponse.json(
      { error: "trip_id and student_ids array are required." },
      { status: 400 }
    );
  }

  // Build one attendance row per student
  const rows = student_ids.map((student_id: string) => ({
    trip_id,
    student_id,
    checked_in:  false,
    checked_out: false,
  }));

  // upsert handles the case where rows already exist (trip resumed)
  const { data, error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "trip_id,student_id" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/attendance — check in or check out a student
// Body: { id: string, action: "check_in" | "undo_check_in" | "check_out" | "undo_check_out" }
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  let updates: Record<string, unknown> = {};

  switch (action) {
    case "check_in":
      updates = { checked_in: true, checked_in_at: now };
      break;
    case "undo_check_in":
      updates = { checked_in: false, checked_in_at: null };
      break;
    case "check_out":
      updates = { checked_out: true, checked_out_at: now };
      break;
    case "undo_check_out":
      updates = { checked_out: false, checked_out_at: null };
      break;
    default:
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("attendance")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}