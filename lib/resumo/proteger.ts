// ============================================================
// CIENTÍFICA AI — Proteção da seção "resumo" (anti-sumiço)
// ============================================================
// A seção "resumo" é um JSON { resumo, abstract, palavras_chave, keywords }.
// Bug recorrente: outros fluxos (aplicar-sugestão, restaurar versão, remover
// referência, save genérico) gravavam TEXTO PURO por cima desse JSON → o editor
// não conseguia parsear, caía no fallback e abstract/palavras-chave/keywords
// SUMIAM. Esta é a trava no ÚNICO ponto de gravação (salvar-secao):
//   1) texto puro NUNCA substitui um resumo estruturado existente;
//   2) um save estruturado não zera campos que já estavam preenchidos.
// Determinístico e puro → travado por teste de regressão.

export interface ResumoEstruturado {
  resumo: string
  abstract: string
  palavras_chave: string[]
  keywords: string[]
}

/** Faz parse de um conteúdo de resumo SE ele for o objeto estruturado esperado. */
export function parseResumoEstruturado(conteudo: string | null | undefined): ResumoEstruturado | null {
  if (!conteudo) return null
  try {
    const o = JSON.parse(conteudo)
    if (o && typeof o === 'object' && !Array.isArray(o) && typeof o.resumo === 'string') {
      return {
        resumo: o.resumo ?? '',
        abstract: typeof o.abstract === 'string' ? o.abstract : '',
        palavras_chave: Array.isArray(o.palavras_chave) ? o.palavras_chave : [],
        keywords: Array.isArray(o.keywords) ? o.keywords : [],
      }
    }
  } catch { /* não é JSON estruturado */ }
  return null
}

/**
 * Decide o que REALMENTE gravar na seção resumo, dado o conteúdo recebido e o
 * que já está salvo. Retorna { conteudo, bloqueado }.
 *  - bloqueado=true → a gravação foi recusada (texto puro tentando apagar um
 *    resumo estruturado existente); o chamador NÃO deve sobrescrever.
 *  - senão → `conteudo` é a versão segura a persistir (com merge anti-zeragem).
 */
export function protegerConteudoResumo(
  recebido: string,
  existente: string | null | undefined,
): { conteudo: string; bloqueado: boolean } {
  const inc = parseResumoEstruturado(recebido)
  const ex = parseResumoEstruturado(existente)

  // Recebido NÃO é estruturado (texto puro / vazio)
  if (!inc) {
    // Há um resumo estruturado salvo → BLOQUEIA (não deixa o texto puro apagá-lo)
    if (ex) return { conteudo: existente as string, bloqueado: true }
    // Nada estruturado a proteger → deixa passar como veio
    return { conteudo: recebido, bloqueado: false }
  }

  // Recebido é estruturado e existe um anterior → merge anti-zeragem:
  // campo vazio no recebido não apaga um campo preenchido no existente.
  if (ex) {
    const merged: ResumoEstruturado = {
      resumo: inc.resumo.trim() ? inc.resumo : ex.resumo,
      abstract: inc.abstract.trim() ? inc.abstract : ex.abstract,
      palavras_chave: inc.palavras_chave.length ? inc.palavras_chave : ex.palavras_chave,
      keywords: inc.keywords.length ? inc.keywords : ex.keywords,
    }
    return { conteudo: JSON.stringify(merged), bloqueado: false }
  }

  // Estruturado e sem anterior → grava como veio
  return { conteudo: recebido, bloqueado: false }
}
