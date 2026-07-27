// src/app/api/profiles/route.ts
// ---------------------------------------------------------------
// Handles all Profile operations for the Admin Dashboard.
// GET   → fetch profiles (filter by status, role, exclude_role)
// POST  → create a new profile (driver/parent registration)
// PATCH → update profile status (approve / reject)
// ---------------------------------------------------------------

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/profiles?status=pending&exclude_role=supervisor
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const status       = searchParams.get("status");        // e.g. "pending"
  const role         = searchParams.get("role");          // e.g. "driver" | "parent"
  const excludeRole  = searchParams.get("exclude_role");  // e.g. "supervisor"

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (status)      query = query.eq("status", status);
  if (role)        query = query.eq("role", role);

  // exclude_role: used by admin dashboard to hide supervisors
  // from the pending approvals queue
  if (excludeRole) query = query.neq("role", excludeRole);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/profiles — create a new profile
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { full_name, phone, role, route_group } = body;

  if (!full_name || !role) {
    return NextResponse.json(
      { error: "full_name and role are required fields." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert([{ full_name, phone, role, route_group }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/profiles — approve or reject a profile by ID
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json(
      { error: "Profile id and status are required." },
      { status: 400 }
    );
  }

  if (!["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be: approved | rejected | pending" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/profiles?id=xxx — permanently delete a profile
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Profile id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_id: id });
}