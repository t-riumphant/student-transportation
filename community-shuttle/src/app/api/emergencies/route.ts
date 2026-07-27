// src/app/api/emergencies/route.ts
// ---------------------------------------------------------------
// Handles all Emergency Alert operations.
// GET  → fetch emergencies (optionally filter unresolved only)
// POST → broadcast a new emergency alert from Parent Dashboard
// PATCH → mark an alert as resolved (Admin acknowledge action)
// ---------------------------------------------------------------

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/emergencies?resolved=false
// Fetches emergency alerts joined with the sender's profile info
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const resolved = searchParams.get("resolved"); // "true" | "false"

  let query = supabase
    .from("emergencies")
    .select(`
      *,
      profiles:sent_by (
        full_name,
        phone,
        route_group
      )
    `)
    .order("created_at", { ascending: false });

  // Filter by resolved status — Admin banner only shows unresolved
  if (resolved === "false") query = query.eq("is_resolved", false);
  if (resolved === "true")  query = query.eq("is_resolved", true);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/emergencies — broadcast a new emergency alert
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { sent_by, title, message, severity } = body;

  // Validate required fields
  if (!title || !message) {
    return NextResponse.json(
      { error: "title and message are required fields." },
      { status: 400 }
    );
  }

  // Validate severity value if provided
  const validSeverities = ["low", "medium", "high", "critical"];
  if (severity && !validSeverities.includes(severity)) {
    return NextResponse.json(
      { error: "severity must be: low | medium | high | critical" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("emergencies")
    .insert([{
      sent_by: sent_by || null,
      title,
      message,
      severity: severity || "high",
      is_resolved: false,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/emergencies — resolve an emergency alert (Admin acknowledge)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { id, is_resolved } = body;

  if (!id) {
    return NextResponse.json({ error: "Emergency id is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("emergencies")
    .update({ is_resolved: is_resolved ?? true })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}