// src/app/api/students/route.ts
// ---------------------------------------------------------------
// GET   → fetch students (filter by is_active, parent_id)
// POST  → register a new student node
// PATCH → update a student record (e.g. flip is_active on approval)
// ---------------------------------------------------------------

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/students?active=true  → only active (approved) students
// GET /api/students?active=false → only inactive (pending) students
// GET /api/students              → all students regardless of status
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const parent_id = searchParams.get("parent_id");
  const active    = searchParams.get("active"); // "true" | "false" | null

  // Join parent profile so the ledger can show parent name + route
  let query = supabase
    .from("students")
    .select(`
      *,
      profiles:parent_id (
        full_name,
        phone,
        route_group
      )
    `)
    .order("created_at", { ascending: false });

  // Filter by is_active if the caller specifies
  if (active === "true")  query = query.eq("is_active", true);
  if (active === "false") query = query.eq("is_active", false);

  // Optionally scope to one parent
  if (parent_id) query = query.eq("parent_id", parent_id);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/students — register a new student node
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { parent_id, full_name, grade, tracking_node } = body;

  if (!parent_id || !full_name) {
    return NextResponse.json(
      { error: "parent_id and full_name are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("students")
    .insert([{ parent_id, full_name, grade, tracking_node }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/students — update student fields
// Used by approval handler to flip is_active: false → true
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Student id is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("students")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/students?id=xxx — permanently delete a student record
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Student id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_id: id });
}