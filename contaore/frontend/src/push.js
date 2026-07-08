import { apiFetch, API_URL } from "./api";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// iOS/iPadOS supporta le web push solo se la PWA è installata da Home
// (navigator.standalone === true). In Safari "normale" va prima installata.
export function isIosSafariNotStandalone() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIos && window.navigator.standalone !== true;
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch((e) => console.error("SW register:", e));
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Ritorna { ok, error } invece di lanciare/ingoiare in silenzio: un fallimento qui
// (rete, VAPID non configurata, subscribe rifiutata da Apple/Google) va mostrato
// all'utente, altrimenti sembra tutto "abilitato" ma non arriva mai nulla.
export async function subscribeToPush() {
  if (!isPushSupported()) return { ok: false, error: "UNSUPPORTED" };

  try {
    const registration = await navigator.serviceWorker.ready;

    const keyRes = await fetch(API_URL + "/api/push/vapid-public-key");
    const keyData = await keyRes.json();
    if (!keyData.success) return { ok: false, error: keyData.error || "NO_VAPID_KEY" };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });

    const json = subscription.toJSON();
    const res = await apiFetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });

    if (!res.success) return { ok: false, error: res.error || "SUBSCRIBE_SAVE_FAILED" };
    return { ok: true };
  } catch (e) {
    console.error("subscribeToPush:", e);
    return { ok: false, error: e.message };
  }
}

export async function requestPushPermission() {
  if (!isPushSupported()) return { permission: "unsupported", subscribed: false };
  const permission = await Notification.requestPermission();
  let subscribeResult = { ok: false };
  if (permission === "granted") {
    subscribeResult = await subscribeToPush();
  }
  return { permission, subscribed: subscribeResult.ok, error: subscribeResult.error };
}
