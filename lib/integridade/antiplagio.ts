// ============================================================
// CIENTÍFICA AI — Antiplágio / Originalidade (PRONTO, mas DESLIGADO por padrão)
// ============================================================
// Toda a fiação está pronta. O serviço só LIGA quando as variáveis de ambiente
// forem preenchidas (chave de um provedor real: Turnitin, Copyleaks, PlagiarismCheck,
// iThenticate, etc.). Sem isso, devolve "indisponível" de forma graciosa — nada quebra.
//
// PARA LIGAR (quando for usar o app de verdade):
//   ANTIPLAGIO_ENABLED=true
//   ANTIPLAGIO_API_URL=https://api.do-provedor.com/v1/scan   (endpoint do provedor)
//   ANTIPLAGIO_API_KEY=...                                    (chave do provedor)
//   ANTIPLAGIO_PROVIDER=copyleaks                             (rótulo, opcional)
//
// O adaptador HTTP genérico abaixo faz POST { text } com Bearer e normaliza a
// resposta procurando os campos de similaridade mais comuns. Ao escolher o provedor
// definitivo, ajuste APENAS `chamarProvedor` ao formato exato da API dele.

export interface ConfigAntiplagio {
  habilitado: boolean
  url: string
  apiKey: string
  provider: string
}

export interface FontePlagio { url?: string; titulo?: string; similaridade: number }
export interface ResultadoPlagio {
  disponivel: boolean
  motivo?: string
  provider?: string
  /** Índice de similaridade 0–100 (quanto menor, mais original). */
  similaridade?: number
  fontes?: FontePlagio[]
}

export function lerConfigAntiplagio(): ConfigAntiplagio {
  return {
    habilitado: (process.env.ANTIPLAGIO_ENABLED ?? '').toLowerCase() === 'true',
    url: process.env.ANTIPLAGIO_API_URL ?? '',
    apiKey: process.env.ANTIPLAGIO_API_KEY ?? '',
    provider: process.env.ANTIPLAGIO_PROVIDER ?? 'externo',
  }
}

/** O serviço está LIGADO e configurado? (habilitado + url + chave) */
export function antiplagioConfigurado(cfg: ConfigAntiplagio = lerConfigAntiplagio()): boolean {
  return cfg.habilitado && !!cfg.url && !!cfg.apiKey
}

/** Normaliza um número solto para 0–100. Aceita fração (0–1) ou percentual. */
function normalizarSimilaridade(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : NaN
  if (!Number.isFinite(n)) return undefined
  return n <= 1 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10
}

/** Adaptador HTTP genérico — AJUSTE ao provedor escolhido na hora de ligar. */
async function chamarProvedor(texto: string, cfg: ConfigAntiplagio): Promise<ResultadoPlagio> {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ text: texto }),
  })
  if (!resp.ok) return { disponivel: false, motivo: `Provedor de antiplágio respondeu ${resp.status}`, provider: cfg.provider }
  const data = await resp.json() as Record<string, unknown>
  // Procura os campos de similaridade mais comuns entre provedores.
  const sim = normalizarSimilaridade(data.similarity ?? data.score ?? data.percent ?? data.plagiarismScore ?? data.totalScore)
  const fontesRaw = (data.sources ?? data.results ?? data.matches) as unknown
  const fontes: FontePlagio[] = Array.isArray(fontesRaw)
    ? fontesRaw.map((f) => {
        const o = (f ?? {}) as Record<string, unknown>
        return { url: typeof o.url === 'string' ? o.url : undefined, titulo: typeof o.title === 'string' ? o.title : undefined, similaridade: normalizarSimilaridade(o.similarity ?? o.score ?? o.percent) ?? 0 }
      }).slice(0, 20)
    : []
  return { disponivel: true, provider: cfg.provider, similaridade: sim, fontes }
}

/**
 * Verifica originalidade do texto. Se o serviço não estiver configurado, devolve
 * `disponivel:false` com o motivo — NUNCA lança. Quando configurado, chama o provedor.
 */
export async function verificarPlagio(texto: string, cfg: ConfigAntiplagio = lerConfigAntiplagio()): Promise<ResultadoPlagio> {
  if (!antiplagioConfigurado(cfg)) {
    return { disponivel: false, motivo: 'Antiplágio não configurado. Defina ANTIPLAGIO_ENABLED, ANTIPLAGIO_API_URL e ANTIPLAGIO_API_KEY para ativar.' }
  }
  if (!texto?.trim()) return { disponivel: false, motivo: 'Sem texto para verificar.', provider: cfg.provider }
  try {
    return await chamarProvedor(texto, cfg)
  } catch (e) {
    return { disponivel: false, motivo: e instanceof Error ? e.message : 'Falha ao consultar o provedor de antiplágio.', provider: cfg.provider }
  }
}
