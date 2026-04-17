/**
 * FlipBook Viewer - Service Worker
 * Enables offline functionality via cache-first strategy
 */

const CACHE_NAME = '__CACHE_VERSION__';
const CACHE_FILES = '__CACHE_FILES__';

// Install: pre-cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching assets...');
                return cache.addAll(CACHE_FILES);
            })
            .then(() => self.skipWaiting())
            .catch((err) => {
                console.error('[SW] Pre-cache failed:', err);
            })
    );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: cache-first strategy
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((networkResponse) => {
                        // Cache new resources dynamically
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Offline fallback
                        if (event.request.destination === 'document') {
                            return caches.match('./index.html');
                        }
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Offline'
                        });
                    });
            })
    );
});
