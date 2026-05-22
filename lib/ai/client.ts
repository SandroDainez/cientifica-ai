import OpenAI from 'openai'

export type AIProvider = 'grok' | 'deepseek' | 'anthropic' | 'openai'

const provider = (process.env.AI_PROVIDER || 'grok') as AIProvider

function createClient(): OpenAI {
  switch (provider) {
    case 'grok':
      return new OpenAI({
        apiKey: process.env.GROK_API_KEY!,
        baseURL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
      })
    case 'deepseek':
      return new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY!,
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      })
    case 'anthropic':
      return new OpenAI({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        baseURL: 'https://api.anthropic.com/v1',
      })
    case 'openai':
    default:
      return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
}

export const aiClient = createClient()

// Modelos por provider — fast para respostas rápidas, smart para geração de seções
export const AI_MODELS: Record<AIProvider, { fast: string; smart: string }> = {
  grok: {
    fast: 'grok-3-mini',
    smart: 'grok-3',
  },
  deepseek: {
    fast: 'deepseek-chat',
    smart: 'deepseek-reasoner',
  },
  anthropic: {
    fast: 'claude-haiku-4-5-20251001',
    smart: 'claude-sonnet-4-6',
  },
  openai: {
    fast: 'gpt-4o-mini',
    smart: 'gpt-4o',
  },
}

export const currentModel = AI_MODELS[provider]
export const currentProvider = provider
