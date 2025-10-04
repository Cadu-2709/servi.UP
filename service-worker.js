const CACHE_NAME = 'gestor-servicos-cache-v1';
// Lista de arquivos essenciais para o app funcionar offline
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Evento de Instalação: Salva os arquivos no cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Evento de Fetch: Intercepta as requisições
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se o arquivo existir no cache, retorna ele.
                if (response) {
                    return response;
                }
                // Se não, busca na rede.
                return fetch(event.request);
            })
    );
});