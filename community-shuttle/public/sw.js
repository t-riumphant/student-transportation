// public/sw.js
// Service Worker — handles background push notifications for Community Shuttle
// Place this file in your /public folder

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: "Community Shuttle",
      body: event.data.text(),
      icon: "/favicon.ico",
    };
  }

  const options = {
    body:    data.body  || "You have a new notification.",
    icon:    data.icon  || "/favicon.ico",
    badge:   data.badge || "/favicon.ico",
    tag:     data.tag   || "community-shuttle",
    data:    data.data  || {},
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Community Shuttle", options)
  );
});

// Handle notification click — open or focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const url = "/parent/dashboard";
      for (const client of clients) {
        if (client.url.includes("/parent") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});