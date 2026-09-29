/* Kosta Daily browser push. Served from /chat-sw.js so the scope is the whole site. */

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = {};
    }
    event.waitUntil(showChatNotification(data));
});

self.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'show-chat-notification')
        return;
    event.waitUntil(showChatNotification(data, { fromPage: true }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss')
        return;
    const target = notificationUrl(event.notification.data);
    event.waitUntil(openChat(target));
});

function notificationUrl(data) {
    const path = data && typeof data.url === 'string' && data.url.startsWith('/')
        ? data.url
        : '/kosta-daily';
    return new URL(path, self.location.origin).href;
}

async function showChatNotification(data, opts) {
    const roomId = Number(data.roomId);
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Kosta Daily';
    const body = typeof data.body === 'string' && data.body.trim() ? data.body.trim() : 'Новое сообщение';
    const icon = new URL('/notification-icon.png', self.location.origin).href;
    const image = typeof data.image === 'string' && data.image.startsWith('https://') ? data.image : '';
    const url = typeof data.url === 'string' ? data.url : '/kosta-daily';
    if (opts && opts.fromPage) {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const pageInFront = windows.some((client) => client.focused && client.visibilityState === 'visible');
        if (pageInFront)
            return;
    }
    const options = {
        body,
        icon,
        badge: icon,
        tag: Number.isFinite(roomId) && roomId > 0 ? `chat-room-${roomId}` : 'chat-room',
        renotify: true,
        data: { url, roomId },
        actions: [
            { action: 'open', title: 'Открыть' },
            { action: 'dismiss', title: 'Закрыть' },
        ],
    };
    if (image)
        options.image = image;
    await self.registration.showNotification(title, options);
}

async function openChat(url) {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
        if (!('focus' in client))
            continue;
        if (!client.focused)
            await client.focus();
        client.postMessage({ type: 'chat-notification-open', url });
        return;
    }
    await self.clients.openWindow(url);
}
