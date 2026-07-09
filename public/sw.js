// Minimal service worker — no offline caching, just enables
// registration.showNotification() with action buttons so reminders can show
// a real OS-level notification (with "Mark done" / "Snooze" actions) instead
// of only an in-page alert. This does NOT enable push-while-app-is-closed;
// that would need a server-side push service (VAPID + a scheduled trigger).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  const action = event.action; // "done" | "snooze" | "" (body click)
  const tag = event.notification.tag;
  event.notification.close();

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = allClients[0];
      if (client) {
        client.postMessage({ type: "reminder-action", action, tag });
        client.focus();
      } else {
        await self.clients.openWindow("/");
      }
    })(),
  );
});