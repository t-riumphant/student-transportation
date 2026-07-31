// src/app/api/push/send/route.ts
// ---------------------------------------------------------------
// POST /api/push/send
// Body: { student_ids[], title, body, tag }
// Fetches each student's parent push subscription and sends
// a web push notification to each parent
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import webpush from "web-push";

// Set VAPID details from environment variables
webpush.setVapidDetails(
  "mailto:admin@communityshuttle.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { student_ids, title, body: notifBody, tag } = body;

  if (!student_ids?.length || !title || !notifBody) {
    return NextResponse.json(
      { error: "student_ids, title, and body are required." },
      { status: 400 }
    );
  }

  // For each student, fetch their parent's push subscription
  const results = await Promise.allSettled(
    student_ids.map(async (student_id: string) => {
      // Get parent_id from student
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("parent_id")
        .eq("id", student_id)
        .single();

      if (studentError || !student?.parent_id) return;

      // Get parent's push subscription
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("push_subscription")
        .eq("id", student.parent_id)
        .single();

      if (profileError || !profile?.push_subscription) return;

      let subscription;
      try {
        subscription = JSON.parse(profile.push_subscription);
      } catch { return; }

      // Send the push notification
      const payload = JSON.stringify({
        title,
        body:  notifBody,
        icon:  "/favicon.ico",
        badge: "/favicon.ico",
        tag:   tag || "community-shuttle",
      });

      await webpush.sendNotification(subscription, payload);
    })
  );

  const sent   = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;

  return NextResponse.json({ success: true, sent, failed });
}