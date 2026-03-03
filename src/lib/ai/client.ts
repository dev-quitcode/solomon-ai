import Anthropic from '@anthropic-ai/sdk'

export function createAnthropicClient(apiKey: string) {
  return new Anthropic({ apiKey })
}

export const DEFAULT_MODEL = 'claude-sonnet-4-6'
