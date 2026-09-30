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
    event.waitUntil(showChatNotification(data));
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

async function showChatNotification(data) {
    const roomId = Number(data.roomId);
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Kosta Daily';
    const body = typeof data.body === 'string' && data.body.trim() ? data.body.trim() : 'Новое сообщение';
    const icon = new URL('/notification-icon.png', self.location.origin).href;
    const image = typeof data.image === 'string' && data.image.startsWith('https://') ? data.image : '';
    const url = typeof data.url === 'string' ? data.url : '/kosta-daily';
    const tag = Number.isFinite(roomId) && roomId > 0 ? `chat-room-${roomId}` : 'chat-room';
    const payload = { url, roomId };
    const full = {
        body,
        icon,
        badge: icon,
        tag,
        renotify: true,
        data: payload,
        actions: [
            { action: 'open', title: 'Открыть' },
            { action: 'dismiss', title: 'Закрыть' },
        ],
    };
    if (image)
        full.image = image;
    const shown = await showOnce(title, full);
    if (shown)
        return;
    const plain = await showOnce(title, { body, tag, renotify: true, data: payload });
    if (plain)
        return;
    await showOnce(title, { body, tag, data: payload });
}

function showOnce(title, options) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => {
            if (settled)
                return;
            settled = true;
            resolve(ok);
        };
        const timer = setTimeout(() => finish(false), 1200);
        self.registration.showNotification(title, options).then(
            () => {
                clearTimeout(timer);
                finish(true);
            },
            () => {
                clearTimeout(timer);
                finish(false);
            },
        );
    });
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
