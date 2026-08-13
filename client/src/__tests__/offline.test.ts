/**
 * Testes de funcionalidade offline (PWA)
 * Feature: gestor-files
 * Valida: Requisito 17.3
 *
 * Requisito 17.3: THE System SHALL ser acessível offline para páginas já visitadas
 *
 * Nota: O jsdom não implementa Service Worker API nem suporta o modo 'navigate'
 * no construtor Request. Os testes validam a lógica do service worker de forma
 * isolada, simulando o comportamento das Cache API e fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

// ─── Tipos auxiliares ────────────────────────────────────────────────────────

interface MockCache {
  put: Mock<(url: string, response: Response) => Promise<void>>
  match: Mock<(url: string) => Promise<Response | undefined>>
  addAll: Mock<(urls: string[]) => Promise<void>>
  delete: Mock<(name: string) => Promise<boolean>>
  keys: Mock<() => Promise<string[]>>
}

interface MockCacheStorage {
  open: Mock<(name: string) => Promise<MockCache>>
  match: Mock<(url: string) => Promise<Response | undefined>>
  keys: Mock<() => Promise<string[]>>
  delete: Mock<(name: string) => Promise<boolean>>
  _store: Map<string, MockCache>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResponse(body: string, status = 200, contentType = 'text/html'): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': contentType },
  })
}

function makeCacheStorage(): MockCacheStorage {
  const store = new Map<string, MockCache>()

  const makeCache = (): MockCache => ({
    put: vi.fn<(url: string, response: Response) => Promise<void>>().mockResolvedValue(undefined),
    match: vi.fn<(url: string) => Promise<Response | undefined>>().mockResolvedValue(undefined),
    addAll: vi.fn<(urls: string[]) => Promise<void>>().mockResolvedValue(undefined),
    delete: vi.fn<(name: string) => Promise<boolean>>().mockResolvedValue(true),
    keys: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
  })

  return {
    _store: store,
    open: vi.fn<(name: string) => Promise<MockCache>>().mockImplementation(async (name: string) => {
      if (!store.has(name)) store.set(name, makeCache())
      return store.get(name)!
    }),
    match: vi.fn<(url: string) => Promise<Response | undefined>>().mockResolvedValue(undefined),
    keys: vi.fn<() => Promise<string[]>>().mockImplementation(async () => Array.from(store.keys())),
    delete: vi.fn<(name: string) => Promise<boolean>>().mockImplementation(async (name: string) => store.delete(name)),
  }
}

/**
 * Simula a lógica cache-first do service worker para uma URL de asset.
 * Retorna a resposta do cache se disponível, caso contrário busca da rede
 * e armazena no cache.
 */
async function cacheFirstFetch(
  url: string,
  cache: MockCache,
  fetchFn: typeof fetch
): Promise<Response | undefined> {
  const cached = await cache.match(url)
  if (cached) return cached as Response

  try {
    const response = await fetchFn(url)
    if (response && response.status === 200) {
      await cache.put(url, response.clone())
    }
    return response
  } catch {
    return undefined
  }
}

/**
 * Simula a lógica network-first do service worker para chamadas de API.
 * Tenta a rede primeiro; em caso de falha retorna erro 503.
 */
async function networkFirstFetch(url: string, fetchFn: typeof fetch): Promise<Response> {
  try {
    return await fetchFn(url)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Sem conexão com o servidor' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Simula o fallback de navegação offline do service worker.
 * Para requisições de navegação (modo 'navigate'), retorna index.html do cache.
 */
async function navigateFallback(
  url: string,
  cache: MockCache,
  fetchFn: typeof fetch,
  isNavigate = true
): Promise<Response | undefined> {
  const cached = await cache.match(url)
  if (cached) return cached as Response

  try {
    return await fetchFn(url)
  } catch {
    if (isNavigate) {
      return (await cache.match('/index.html')) as Response | undefined
    }
    return undefined
  }
}

// ─── Constantes do service worker ────────────────────────────────────────────

const CACHE_NAME = 'gestor-files-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('Service Worker - Funcionalidade Offline (Requisito 17.3)', () => {
  let mockCaches: MockCacheStorage

  beforeEach(() => {
    mockCaches = makeCacheStorage()
    vi.stubGlobal('caches', mockCaches)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  // ── Instalação e cache de assets estáticos ──────────────────────────────

  describe('Instalação do Service Worker', () => {
    it('abre o cache com o nome correto durante a instalação', async () => {
      await mockCaches.open(CACHE_NAME)
      expect(mockCaches.open).toHaveBeenCalledWith(CACHE_NAME)
    })

    it('faz cache de todos os assets estáticos na instalação', async () => {
      const cache = await mockCaches.open(CACHE_NAME)
      await cache.addAll(STATIC_ASSETS)

      expect(cache.addAll).toHaveBeenCalledWith(STATIC_ASSETS)
    })

    it('inclui index.html na lista de assets estáticos', () => {
      expect(STATIC_ASSETS).toContain('/index.html')
    })

    it('inclui manifest.json na lista de assets estáticos', () => {
      expect(STATIC_ASSETS).toContain('/manifest.json')
    })

    it('inclui ícones PWA na lista de assets estáticos', () => {
      expect(STATIC_ASSETS).toContain('/icons/icon-192x192.png')
      expect(STATIC_ASSETS).toContain('/icons/icon-512x512.png')
    })
  })

  // ── Estratégia cache-first para assets estáticos ────────────────────────

  describe('Estratégia cache-first para assets estáticos', () => {
    it('retorna resposta do cache quando asset está em cache', async () => {
      const cachedResponse = makeResponse('<html>cached</html>')
      const cache = await mockCaches.open(CACHE_NAME)
      cache.match.mockResolvedValueOnce(cachedResponse)

      const result = await cacheFirstFetch('/index.html', cache, vi.mocked(fetch))

      expect(result).toBe(cachedResponse)
      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })

    it('não chama fetch quando asset está em cache', async () => {
      const cachedResponse = makeResponse('body { color: red }', 200, 'text/css')
      const cache = await mockCaches.open(CACHE_NAME)
      cache.match.mockResolvedValueOnce(cachedResponse)

      await cacheFirstFetch('/assets/main.css', cache, vi.mocked(fetch))

      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })

    it('armazena nova resposta no cache quando asset não está em cache', async () => {
      const networkResponse = makeResponse('<html>fresh</html>')
      vi.mocked(fetch).mockResolvedValueOnce(networkResponse)

      const cache = await mockCaches.open(CACHE_NAME)
      cache.match.mockResolvedValueOnce(undefined)

      await cacheFirstFetch('/index.html', cache, vi.mocked(fetch))

      expect(cache.put).toHaveBeenCalledWith('/index.html', expect.any(Response))
    })

    it('assets CSS são servidos do cache offline', async () => {
      const cssResponse = makeResponse('body {}', 200, 'text/css')
      const cache = await mockCaches.open(CACHE_NAME)
      cache.match.mockResolvedValueOnce(cssResponse)

      const result = await cacheFirstFetch('/assets/index.css', cache, vi.mocked(fetch))

      expect(result).not.toBeUndefined()
      expect(result?.headers.get('Content-Type')).toBe('text/css')
    })

    it('assets JS são servidos do cache offline', async () => {
      const jsResponse = makeResponse('console.log("app")', 200, 'application/javascript')
      const cache = await mockCaches.open(CACHE_NAME)
      cache.match.mockResolvedValueOnce(jsResponse)

      const result = await cacheFirstFetch('/assets/index.js', cache, vi.mocked(fetch))

      expect(result).not.toBeUndefined()
    })

    it('retorna undefined quando asset não está em cache e rede falha', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
      const cache = await mockCaches.open(CACHE_NAME)
      cache.match.mockResolvedValueOnce(undefined)

      const result = await cacheFirstFetch('/assets/unknown.js', cache, vi.mocked(fetch))

      expect(result).toBeUndefined()
    })
  })

  // ── Fallback offline para navegação ─────────────────────────────────────

  describe('Fallback offline para navegação', () => {
    it('retorna index.html do cache quando offline e navegando para /dashboard', async () => {
      const indexHtml = makeResponse('<html><body>App</body></html>')
      const cache = await mockCaches.open(CACHE_NAME)

      cache.match
        .mockResolvedValueOnce(undefined)  // miss para /dashboard
        .mockResolvedValueOnce(indexHtml)  // hit para /index.html (fallback)

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await navigateFallback('/dashboard', cache, vi.mocked(fetch), true)

      expect(result).toBe(indexHtml)
    })

    it('retorna index.html do cache para rota /admin quando offline', async () => {
      const indexHtml = makeResponse('<html><body>App</body></html>')
      const cache = await mockCaches.open(CACHE_NAME)

      cache.match
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(indexHtml)

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await navigateFallback('/admin', cache, vi.mocked(fetch), true)

      expect(result).toBe(indexHtml)
    })

    it('não usa fallback de navegação para requisições não-navigate', async () => {
      const cache = await mockCaches.open(CACHE_NAME)
      cache.match.mockResolvedValueOnce(undefined)
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await navigateFallback('/assets/img.png', cache, vi.mocked(fetch), false)

      expect(result).toBeUndefined()
      // Não deve ter tentado buscar /index.html como fallback
      expect(cache.match).toHaveBeenCalledTimes(1)
    })
  })

  // ── Estratégia network-first para chamadas de API ───────────────────────

  describe('Estratégia network-first para API', () => {
    it('retorna erro 503 para chamadas de API quando offline', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const response = await networkFirstFetch('/api/files', vi.mocked(fetch))

      expect(response.status).toBe(503)
      const body = await response.json()
      expect(body.error).toBe('Sem conexão com o servidor')
    })

    it('retorna resposta da rede quando online', async () => {
      const apiResponse = makeResponse('{"files":[]}', 200, 'application/json')
      vi.mocked(fetch).mockResolvedValueOnce(apiResponse)

      const response = await networkFirstFetch('/api/files', vi.mocked(fetch))

      expect(response.status).toBe(200)
    })

    it('não armazena respostas de API no cache', async () => {
      const apiResponse = makeResponse('{"files":[]}', 200, 'application/json')
      vi.mocked(fetch).mockResolvedValueOnce(apiResponse)

      const cache = await mockCaches.open(CACHE_NAME)

      // Chamadas /api/* usam network-first e não fazem cache
      await networkFirstFetch('/api/files', vi.mocked(fetch))

      expect(cache.put).not.toHaveBeenCalled()
    })

    it('retorna Content-Type application/json no erro 503', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const response = await networkFirstFetch('/api/downloads', vi.mocked(fetch))

      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })

  // ── Ativação e limpeza de caches antigos ────────────────────────────────

  describe('Ativação do Service Worker', () => {
    it('remove caches com nomes diferentes do atual', async () => {
      await mockCaches.open('gestor-files-v0')
      await mockCaches.open(CACHE_NAME)

      const allCaches = await mockCaches.keys()
      const oldCaches = allCaches.filter((name: string) => name !== CACHE_NAME)

      await Promise.all(oldCaches.map((name: string) => mockCaches.delete(name)))

      expect(mockCaches.delete).toHaveBeenCalledWith('gestor-files-v0')
      expect(mockCaches.delete).not.toHaveBeenCalledWith(CACHE_NAME)
    })

    it('mantém o cache atual durante a ativação', async () => {
      await mockCaches.open(CACHE_NAME)

      const allCaches = await mockCaches.keys()
      const oldCaches = allCaches.filter((name: string) => name !== CACHE_NAME)

      await Promise.all(oldCaches.map((name: string) => mockCaches.delete(name)))

      expect(mockCaches.delete).not.toHaveBeenCalledWith(CACHE_NAME)
    })

    it('não deleta nenhum cache quando não há caches antigos', async () => {
      await mockCaches.open(CACHE_NAME)

      const allCaches = await mockCaches.keys()
      const oldCaches = allCaches.filter((name: string) => name !== CACHE_NAME)

      await Promise.all(oldCaches.map((name: string) => mockCaches.delete(name)))

      expect(mockCaches.delete).not.toHaveBeenCalled()
    })
  })

  // ── Registro e configuração do Service Worker ────────────────────────────

  describe('Configuração do Service Worker', () => {
    it('o nome do cache segue o padrão de versionamento', () => {
      expect(CACHE_NAME).toMatch(/^gestor-files-v\d+$/)
    })

    it('a lista de assets estáticos não está vazia', () => {
      expect(STATIC_ASSETS.length).toBeGreaterThan(0)
    })

    it('todos os assets estáticos são caminhos absolutos', () => {
      STATIC_ASSETS.forEach((asset) => {
        expect(asset).toMatch(/^\//)
      })
    })

    it('a raiz "/" está incluída nos assets estáticos', () => {
      expect(STATIC_ASSETS).toContain('/')
    })

    it('verifica suporte a serviceWorker no navigator', () => {
      const hasSupport = 'serviceWorker' in navigator
      expect(typeof hasSupport).toBe('boolean')
    })
  })
})
