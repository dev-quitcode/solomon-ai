import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scrapeWebsite } from '@/lib/utils/scraper'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeResponse(html: string, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    text: async () => html,
  }
}

/**
 * Make Jina AI fail so scrapeWebsite falls through to scrapeDirect,
 * which uses the provided HTML response for the direct URL.
 */
function setupMockFetch(html: string, ok = true, status = 200) {
  mockFetch.mockImplementation((url: string) => {
    if (String(url).includes('jina.ai')) {
      return Promise.reject(new Error('Jina unavailable'))
    }
    return Promise.resolve(makeResponse(html, ok, status))
  })
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('scrapeWebsite', () => {
  it('extracts title and body content from a simple page', async () => {
    setupMockFetch(`
      <html>
        <head><title>Solomon Test Page</title></head>
        <body>
          <main>This is the main content of the page.</main>
        </body>
      </html>
    `)

    const result = await scrapeWebsite('https://example.com')
    expect(result.title).toBe('Solomon Test Page')
    expect(result.content).toContain('main content')
  })

  it('falls back to h1 when title tag is empty', async () => {
    setupMockFetch(`
      <html>
        <head><title></title></head>
        <body>
          <h1>Page Heading</h1>
          <main>Some content here.</main>
        </body>
      </html>
    `)

    const result = await scrapeWebsite('https://example.com')
    expect(result.title).toBe('Page Heading')
  })

  it('falls back to URL when both title and h1 are empty', async () => {
    setupMockFetch(`
      <html>
        <head></head>
        <body><main>Content here.</main></body>
      </html>
    `)

    const result = await scrapeWebsite('https://example.com/page')
    expect(result.title).toBe('https://example.com/page')
  })

  it('removes script and style tags from content', async () => {
    setupMockFetch(`
      <html>
        <head><title>Test</title></head>
        <body>
          <main>
            <script>alert("malicious")</script>
            <style>.foo { color: red; }</style>
            Actual readable content.
          </main>
        </body>
      </html>
    `)

    const result = await scrapeWebsite('https://example.com')
    expect(result.content).not.toContain('alert')
    expect(result.content).not.toContain('color: red')
    expect(result.content).toContain('Actual readable content')
  })

  it('removes nav, footer, and header elements', async () => {
    setupMockFetch(`
      <html>
        <head><title>Test</title></head>
        <body>
          <header>Site Header</header>
          <nav>Navigation Menu</nav>
          <main>The real content.</main>
          <footer>Site Footer</footer>
        </body>
      </html>
    `)

    const result = await scrapeWebsite('https://example.com')
    expect(result.content).not.toContain('Site Header')
    expect(result.content).not.toContain('Navigation Menu')
    expect(result.content).not.toContain('Site Footer')
    expect(result.content).toContain('The real content')
  })

  it('throws when the HTTP response is not ok', async () => {
    setupMockFetch('', false, 404)

    await expect(scrapeWebsite('https://example.com/missing'))
      .rejects.toThrow('Failed to fetch URL: 404')
  })

  it('throws when no readable content is found', async () => {
    setupMockFetch(`
      <html>
        <head><title>Empty</title></head>
        <body>
          <script>let x = 1;</script>
        </body>
      </html>
    `)

    await expect(scrapeWebsite('https://example.com'))
      .rejects.toThrow('No readable content found')
  })

  it('collapses multiple whitespace characters into single spaces', async () => {
    setupMockFetch(`
      <html>
        <head><title>Test</title></head>
        <body>
          <main>   Word1   Word2    Word3   </main>
        </body>
      </html>
    `)

    const result = await scrapeWebsite('https://example.com')
    expect(result.content).toBe('Word1 Word2 Word3')
  })

  it('prefers <article> over <body> for content extraction', async () => {
    setupMockFetch(`
      <html>
        <head><title>Blog Post</title></head>
        <body>
          <aside>Sidebar content</aside>
          <article>Main article content here.</article>
        </body>
      </html>
    `)

    const result = await scrapeWebsite('https://example.com')
    expect(result.content).toContain('Main article content')
  })

  it('sends the correct User-Agent header', async () => {
    setupMockFetch('<html><head><title>T</title></head><body><main>C</main></body></html>')

    await scrapeWebsite('https://example.com')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      headers: expect.objectContaining({
        'User-Agent': expect.stringContaining('Solomon'),
      }),
    }))
  })
})
