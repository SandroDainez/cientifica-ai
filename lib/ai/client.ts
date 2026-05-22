import OpenAI from 'openai'

type AIProvider = 'deepseek' | 'anthropic' | 'openai'

const provider = (process.env.AI_PROVIDER || 'deepseek') as AIProvider

function createClient(): OpenAI {
  if (provider === 'deepseek') {
    return new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    })
  }

  if (provider === 'anthropic') {
    // Anthropic tem compatibilidade com OpenAI SDK via proxy — ou troque pelo SDK nativo
    return new OpenAI({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      baseURL: 'https://api.anthropic.com/v1',
    })
  }

  // openai (padrão)
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  })
}

export const aiClient = createClient()

// Modelos por provider
export const AI_MODELS: Record<AIProvider, { fast: string; smart: string }> = {
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
