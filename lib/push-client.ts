/**
 * Notifications côté navigateur : demander la permission, s'abonner, envoyer
 * l'abonnement au serveur. Rien n'est demandé sans un geste de l'utilisateur.
 */

export type EtatPush = "indisponible" | "refuse" | "inactif" | "actif";

export function pushDisponible(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

function cleEnOctets(base64: string): Uint8Array {
  const rembourrage = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + rembourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(b);
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

export async function etatPush(): Promise<EtatPush> {
  if (!pushDisponible()) return "indisponible";
  if (Notification.permission === "denied") return "refuse";
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "actif" : "inactif";
}

/** Active les notifications : permission, service worker, abonnement, envoi au serveur. */
export async function activerPush(): Promise<EtatPush> {
  if (!pushDisponible()) return "indisponible";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "refuse";
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string) as BufferSource }));
  const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ abonnement: sub.toJSON(), fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
  return res.ok ? "actif" : "inactif";
}

export async function desactiverPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe();
}
