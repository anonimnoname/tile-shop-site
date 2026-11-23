// Service worker админки: показывает push-уведомления о новых заказах,
// даже когда вкладка с админкой закрыта (браузер должен быть запущен).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Новый заказ', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Новый заказ', {
    body: d.body || '', tag: d.tag || 'order', renotify: true, requireInteraction: true,
    data: { url: d.url || '/' }, icon: 'favicon.svg', badge: 'favicon.svg'
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(url) && 'focus' in c) { c.postMessage('refresh-orders'); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
