import { config } from './config.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

async function fetchVapidPublicKey() {
  const response = await fetch(`${config.clipsApiUrl}/push/vapid-public-key`);
  if (!response.ok) throw new Error(`Unable to load push configuration (${response.status})`);
  const data = await response.json();
  if (!data.public_key) throw new Error('Push configuration is missing a public key');
  return data.public_key;
}

async function saveSubscription(subscription) {
  const response = await fetch(`${config.clipsApiUrl}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error(`Unable to register for notifications (${response.status})`);
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function subscribeToPushNotifications() {
  if (!isPushSupported()) throw new Error('Push notifications are not supported in this browser');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  const [registration, publicKey] = await Promise.all([
    navigator.serviceWorker.ready,
    fetchVapidPublicKey(),
  ]);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await saveSubscription(subscription);
  return subscription;
}

export async function syncPushSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const publicKey = await fetchVapidPublicKey();
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    await saveSubscription(subscription);
    return subscription;
  } catch (error) {
    console.warn('Unable to sync push subscription', error);
    return null;
  }
}
