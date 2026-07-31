// src/app/api/push/subscribe/route.ts
// ---------------------------------------------------------------
// POST /api/push/subscribe
// Body: { parent_id, subscription: PushSubscription JSON }
// Saves the parent's push subscription to the profiles table
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

  const { error } = await supabase
    .from("profiles")
    .update({ push_subscription: JSON.stringify(subscription) })
    .eq("id", parent_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}