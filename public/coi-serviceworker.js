/*! coi-serviceworker - disabled to keep PayPal SDK & Google Sign-In popups unblocked */
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      self.registration
        .unregister()
        .then(() => self.clients.matchAll())
        .then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        })
    );
  });
} else if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      if (reg.active && reg.active.scriptURL.includes('coi-serviceworker.js')) {
        void reg.unregister();
      }
    }
  });
}
