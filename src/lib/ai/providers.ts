import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface GenerateOptions {
  model: string
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  apiKeys: {
    anthropic?: string | null
    openai?: string | null
    gemini?: string | null
  }
}

export function parseModel(model: string): { provider: string; modelId: string } {
  const colonIdx = model.indexOf(':')
  if (colonIdx === -1) return { provider: 'anthropic', modelId: model }
  return { provider: model.slice(0, colonIdx), modelId: model.slice(colonIdx + 1) }
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const { provider, modelId } = parseModel(options.model)

  if (provider === 'anthropic') {
    const key = options.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY
    if (!key) {
      throw new Error('No API key configured for Anthropic. Add it in Settings.')
    }
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.create({
      model: modelId,
      max_tokens: options.maxTokens,
      ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
      messages: [{ role: 'user', content: options.userPrompt }],
    })
    return message.content[0].type === 'text' ? message.content[0].text : ''
  }

  if (provider === 'openai') {
    const key = options.apiKeys.openai || process.env.OPENAI_API_KEY
    if (!key) {
      throw new Error('No API key configured for OpenAI. Add it in Settings.')
    }
    const client = new OpenAI({ apiKey: key })
    const completion = await client.chat.completions.create({
      model: modelId,
      max_tokens: options.maxTokens,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user', content: options.userPrompt },
      ],
    })
    return completion.choices[0]?.message?.content ?? ''
  }

  if (provider === 'google') {
    const key = options.apiKeys.gemini || process.env.GEMINI_API_KEY
    if (!key) {
      throw new Error('No API key configured for Google Gemini. Add it in Settings.')
    }
    const genAI = new GoogleGenerativeAI(key)
    const geminiModel = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: options.systemPrompt || undefined,
    })
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
      generationConfig: { maxOutputTokens: options.maxTokens },
    })
    return result.response.text()
  }

  throw new Error(`Unknown AI provider: "${provider}". Expected anthropic, openai, or google.`)
}
