// src/app/api/trip-notifications/route.ts
// ---------------------------------------------------------------
// GET   → fetch unread notifications for a student
// POST  → driver action → creates DB notification per student
//         AND triggers push notification to each parent
// PATCH → parent dismisses notification (marks as read)
// ---------------------------------------------------------------

import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/trip-notifications?student_id=xxx&is_read=false
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const student_id = searchParams.get("student_id");
  const is_read    = searchParams.get("is_read");

  if (!student_id) {
    return NextResponse.json({ error: "student_id is required." }, { status: 400 });
  }

  let query = supabase
    .from("trip_notifications")
    .select(`*, profiles:driver_id (full_name, vehicle_plate, route_group)`)
    .eq("student_id", student_id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (is_read === "false") query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/trip-notifications
// Body: { trip_id, driver_id, driver_name, student_ids[], type, message }
// Creates one DB notification row per student AND sends push to each parent
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { trip_id, driver_id, driver_name, student_ids, type, message } = body;

  if (!trip_id || !driver_id || !student_ids?.length || !message) {
    return NextResponse.json(
      { error: "trip_id, driver_id, student_ids, and message are required." },
      { status: 400 }
    );
  }

  // Build one DB notification row per student
  const rows = student_ids.map((student_id: string) => ({
    trip_id,
    driver_id,
    student_id,
    type:    type || "arrived_at_school",
    message,
    is_read: false,
  }));

  const { data, error } = await supabase
    .from("trip_notifications")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Determine push title based on notification type
  const pushTitleMap: Record<string, string> = {
    trip_started:       "🚌 Shuttle Trip Started",
    student_boarded:    "🛫 Child Boarded the Bus",
    arrived_at_school:  "🏫 Child Arrived at School",
    delivered_home:     "🏠 Child Reached Home Safely",
    student_delivered:  "🏠 Child Delivered Home",
  };

  const pushTitle = pushTitleMap[type] || "Community Shuttle Update";

  // Send push notification to each parent in the background
  // We don't await this so it doesn't block the response
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${baseUrl}/api/push/send`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      student_ids,
      title: pushTitle,
      body:  message,
      tag:   type,
    }),
  }).catch(() => { /* silent — push failure should not affect DB notification */ });

  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/trip-notifications — mark notification as read
// Body: { id: string }
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("trip_notifications")
    .update({ is_read: true })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}