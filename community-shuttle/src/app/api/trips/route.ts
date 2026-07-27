// src/app/api/trips/route.ts
// ---------------------------------------------------------------
// GET   → fetch trips (filter by status, driver_id)
// POST  → create a new trip (driver pressed Start Trip)
// PATCH → update GPS/station OR end trip (status: "completed")
// ---------------------------------------------------------------

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/trips?status=active&driver_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const status    = searchParams.get("status");
  const driver_id = searchParams.get("driver_id");

  let query = supabase
    .from("trips")
    .select(`
      *,
      profiles:driver_id (
        full_name,
        route_group
      )
    `)
    .order("started_at", { ascending: false });

  if (status)    query = query.eq("status", status);
  if (driver_id) query = query.eq("driver_id", driver_id);

  // Single driver active trip lookup — return single object or null
  if (driver_id && status === "active") {
    const { data, error } = await query.limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data?.[0] ?? null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/trips — driver presses Start Trip
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { driver_id, route_type } = body;

  if (!driver_id) {
    return NextResponse.json({ error: "driver_id is required." }, { status: 400 });
  }

  // Prevent duplicate active trips for the same driver
  const { data: existing } = await supabase
    .from("trips")
    .select("id")
    .eq("driver_id", driver_id)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A trip is already active for this driver." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("trips")
    .insert([{
      driver_id,
      route_type:      route_type || "morning",
      status:          "active",
      current_station: "Depot Terminal",
      shuttle_status:  "En-Route",
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/trips — GPS update OR end trip
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id, status, current_lat, current_lng, current_station, shuttle_status } = body;

  if (!id) return NextResponse.json({ error: "Trip id is required." }, { status: 400 });

  const updates: Record<string, unknown> = {};

  if (status === "completed") {
    updates.status          = "completed";
    updates.ended_at        = new Date().toISOString();
    updates.shuttle_status  = "Arrived at School";
    updates.current_station = "School Campus";
  }

  if (current_lat !== undefined) updates.current_lat     = current_lat;
  if (current_lng !== undefined) updates.current_lng     = current_lng;
  if (current_station)           updates.current_station = current_station;
  if (shuttle_status)            updates.shuttle_status  = shuttle_status;

  const { data, error } = await supabase
    .from("trips")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}