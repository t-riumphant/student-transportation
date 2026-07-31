// src/app/api/push/route.ts
// ---------------------------------------------------------------
// POST /api/push/subscribe   — save a parent's push subscription
// POST /api/push/send        — send a push notification to a parent
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// POST /api/push/subscribe
// Body: { parent_id, subscription: PushSubscription JSON }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { parent_id, subscription } = body;

  if (!parent_id || !subscription) {
    return NextResponse.json(
      { error: "parent_id and subscription are required." },
      { status: 400 }
    );
  }

  // Store the push subscription in the profiles table
  const { error } = await supabase
    .from("profiles")
    .update({ push_subscription: JSON.stringify(subscription) })
    .eq("id", parent_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}