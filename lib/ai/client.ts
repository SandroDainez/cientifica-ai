import OpenAI from 'openai'

export type AIProvider = 'grok' | 'deepseek' | 'anthropic' | 'openai'

// Default = deepseek: é o provedor de GERAÇÃO usado no app (a revisão final é
// separada, no Sonnet via REVIEW_AI_MODEL/REVIEW_ANTHROPIC_API_KEY). Se AI_PROVIDER
// ficar vazio, cai em deepseek — não num provedor que não usamos.
const provider = (process.env.AI_PROVIDER || 'deepseek') as AIProvider

function createClient(): OpenAI {
  switch (provider) {
    case 'grok':
      return new OpenAI({
        apiKey: process.env.GROK_API_KEY || 'placeholder',
        baseURL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
      })
    case 'deepseek':
      return new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY || 'placeholder',
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      })
    case 'anthropic':
      return new OpenAI({
        apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder',
        baseURL: 'https://api.anthropic.com/v1',
      })
    case 'openai':
    default:
      return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'placeholder',
      })
  }
}

// ── Lazy singleton — instanciado na primeira chamada (não no build) ───────────
let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) _client = createClient()
  return _client
}

// Proxy transparente: mantém a API surface de OpenAI sem instanciar no boot
export const aiClient = new Proxy({} as OpenAI, {
  get(_, prop: string | symbol) {
    return getClient()[prop as keyof OpenAI]
  },
})

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
