/* Service worker de SoutenanceCoach : notifications push uniquement.
   Aucun cache de pages — on ne veut jamais servir une ancienne version. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let donnees = { titre: "SoutenanceCoach", corps: "Ta question du jour t'attend.", url: "/app" };
  try {
    if (event.data) donnees = { ...donnees, ...event.data.json() };
  } catch {
    /* charge utile non JSON : on garde le défaut */
  }
  event.waitUntil(
    self.registration.showNotification(donnees.titre, {
      body: donnees.corps,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: donnees.url },
      tag: donnees.tag || "soutenance-coach",
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ("focus" in f) {
          f.navigate(url);
          return f.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
