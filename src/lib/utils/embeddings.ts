const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3'

interface VoyageResponse {
  data: { embedding: number[]; index: number }[]
}

export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  // Voyage has an 8192 token limit — truncate to ~32k chars to stay safe
  const input = text.slice(0, 32000)

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `Voyage error: ${res.status}`)
  }

  const data: VoyageResponse = await res.json()
  return data.data[0].embedding
}
