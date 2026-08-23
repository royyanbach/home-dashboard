import { config } from './config.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = Uint8Array.from(rawData, (char) => char.charCodeAt(0));
  return outputArray.buffer.slice(
    outputArray.byteOffset,
    outputArray.byteOffset + outputArray.byteLength,
  );
}

async function waitForServiceWorker(timeoutMs = 10_000) {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not available in this browser.');
  }

  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => {
      window.setTimeout(
        () => reject(new Error('Service worker did not finish installing. Reload the app and try again.')),
        timeoutMs,
      );
    }),
  ]);

  if (!registration.active) {
    throw new Error('Service worker is not active yet. Reload the app and try again.');
  }

  return registration;
}

async function fetchVapidPublicKey() {
  const response = await fetch(`${config.clipsApiUrl}/push/vapid-public-key`);
  if (!response.ok) throw new Error(`Unable to load push configuration (${response.status})`);
  const data = await response.json();
  if (!data.public_key || data.public_key.startsWith('REPLACE_')) {
    throw new Error('Push notifications are not configured on the server yet.');
  }
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

export function getPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export function getPushStatusMessage() {
  const permission = getPushPermission();
  if (permission === 'unsupported') {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      return 'On iPhone, add this app to your Home Screen first, then open it from there to enable notifications.';
    }
    return 'Push notifications are not supported in this browser.';
  }
  if (permission === 'denied') {
    return 'Notifications are blocked. Allow them in your browser or OS settings, then reload this page.';
  }
  if (permission === 'granted') return null;
  return 'Turn on notifications to get alerts from your home automations.';
}

async function createPushSubscription(registration, publicKey) {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function subscribeToPushNotifications() {
  if (!isPushSupported()) throw new Error(getPushStatusMessage());

  if (Notification.permission === 'denied') {
    throw new Error(getPushStatusMessage());
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const [registration, publicKey] = await Promise.all([
    waitForServiceWorker(),
    fetchVapidPublicKey(),
  ]);

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await createPushSubscription(registration, publicKey);
  }

  await saveSubscription(subscription);
  return subscription;
}

export async function unsubscribeFromPushNotifications() {
  if (!isPushSupported()) return;

  const registration = await waitForServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}

export async function syncPushSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') return null;

  try {
    const [registration, publicKey] = await Promise.all([
      waitForServiceWorker(),
      fetchVapidPublicKey(),
    ]);
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await createPushSubscription(registration, publicKey);
    }
    await saveSubscription(subscription);
    return subscription;
  } catch (error) {
    console.warn('Unable to sync push subscription', error);
    return null;
  }
}
