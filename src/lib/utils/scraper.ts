import * as cheerio from 'cheerio'

/**
 * Scrape a URL using Jina AI Reader (handles JS-rendered pages).
 * Falls back to direct Cheerio fetch for sites that block Jina.
 */
export async function scrapeWebsite(url: string): Promise<{ title: string; content: string }> {
  // Try Jina AI Reader first — handles JS-rendered SPAs, returns clean markdown
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (res.ok) {
      const text = await res.text()
      const content = text.replace(/\s+/g, ' ').trim()
      if (content.length > 100) {
        // Jina prepends "Title: ..." on the first line
        const titleMatch = content.match(/^Title:\s*(.+?)(?:\n|URL:)/i)
        const title = titleMatch ? titleMatch[1].trim() : url
        return { title, content }
      }
    }
  } catch {
    // Jina unavailable — fall through to direct fetch
  }

  // Fallback: direct fetch + Cheerio
  return scrapeDirect(url)
}

async function scrapeDirect(url: string): Promise<{ title: string; content: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Solomon/1.0; requirements-research)',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  $('script, style, nav, footer, header, aside, iframe, noscript, [aria-hidden="true"]').remove()
  $('[class*="cookie"], [class*="banner"], [class*="popup"], [id*="cookie"]').remove()

  const title = $('title').text().trim() || $('h1').first().text().trim() || url

  const candidates = ['main', 'article', '[role="main"]', '.content', '#content', '#main', 'body']
  let content = ''

  for (const selector of candidates) {
    const text = $(selector).first().text().replace(/\s+/g, ' ').trim()
    if (text.length > 100) {
      content = text
      break
    }
  }

  if (!content) {
    content = $('body').text().replace(/\s+/g, ' ').trim()
  }

  if (!content) {
    throw new Error('No readable content found. The page may require JavaScript to load.')
  }

  return { title, content }
}
