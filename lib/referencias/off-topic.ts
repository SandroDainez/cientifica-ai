// ============================================================
// CIENTÍFICA AI — Detector determinístico de referência de OUTRO ASSUNTO
// ============================================================
// Complementa (não substitui) o julgamento do LLM. Sinaliza, com CONSERVADORISMO,
// referências cujo TÍTULO é dominado por uma doença/campo que NÃO é o tema do
// trabalho (ex.: um estudo de CÂNCER num trabalho de sepse). Marca como "verificar"
// — NUNCA remove sozinho (remoção exige decisão do LLM/usuário). Bilíngue PT/EN.

import type { Referencia } from '@/types'

/** Tópicos (doença/campo) com formas PT/EN normalizadas (sem acento, minúsculas). */
const TOPICOS: { rotulo: string; termos: string[] }[] = [
  { rotulo: 'câncer/oncologia', termos: ['cancer', 'cancro', 'neoplasia', 'neoplasm', 'neoplasms', 'tumor', 'tumour', 'oncology', 'oncologia', 'carcinoma', 'leukemia', 'leucemia', 'lymphoma', 'linfoma'] },
  { rotulo: 'diabetes', termos: ['diabetes', 'diabetic', 'diabetico', 'diabetica'] },
  { rotulo: 'Alzheimer/demência', termos: ['alzheimer', 'dementia', 'demencia'] },
  { rotulo: 'HIV/AIDS', termos: ['hiv', 'aids'] },
  { rotulo: 'tuberculose', termos: ['tuberculose', 'tuberculosis'] },
  { rotulo: 'malária', termos: ['malaria'] },
  { rotulo: 'hepatite', termos: ['hepatite', 'hepatitis'] },
  { rotulo: 'COVID-19', termos: ['covid', 'sarscov', 'coronavirus'] },
  { rotulo: 'hanseníase', termos: ['hanseniase', 'leprosy'] },
  { rotulo: 'dengue', termos: ['dengue'] },
  { rotulo: 'AVC/derrame', termos: ['stroke', 'avc', 'derrame'] },
  { rotulo: 'asma', termos: ['asma', 'asthma'] },
  { rotulo: 'projeção demográfica/forecasting', termos: ['forecasting', 'forecast', 'demographic', 'demografica', 'demografico'] },
]

function normStr(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
function temPalavra(texto: string, termo: string): boolean {
  return new RegExp(`\\b${termo}\\b`).test(texto)
}

/** Citação curta "SOBRENOME, ANO" para exibir na suspeita. */
function rotuloRef(ref: Referencia): string {
  const sob = (ref.autores?.[0]?.sobrenome ?? '').trim().toUpperCase()
  const ano = ref.ano ?? 's.d.'
  return sob ? `${sob}, ${ano}` : (ref.titulo ?? '').slice(0, 40)
}

export interface SuspeitaOffTopic {
  referencia: string
  problema: string
  acao_recomendada: 'verificar'
}

/**
 * Sinaliza refs cujo TÍTULO é de outro assunto que o `tema` do trabalho não cobre.
 * Conservador: só dispara se o tópico está no título E o tema NÃO o menciona.
 */
export function detectarRefsOutroAssunto(refs: Referencia[], tema: string): SuspeitaOffTopic[] {
  const temaNorm = normStr(tema)
  const out: SuspeitaOffTopic[] = []
  for (const ref of refs) {
    const tituloNorm = normStr(ref.titulo ?? '')
    if (!tituloNorm) continue
    for (const t of TOPICOS) {
      const noTitulo = t.termos.some(term => temPalavra(tituloNorm, term))
      if (!noTitulo) continue
      const noTema = t.termos.some(term => temPalavra(temaNorm, term))   // o trabalho É sobre isso? então não é off-topic
      if (noTema) continue
      out.push({
        referencia: rotuloRef(ref),
        problema: `Fonte aparentemente sobre ${t.rotulo} — verifique se é pertinente ao tema do trabalho ou se deve ser substituída`,
        acao_recomendada: 'verificar',
      })
      break
    }
  }
  return out
}
