import { validateScientificRewrite, type SemanticLockResult } from './semantic-lock'

export interface SafeScientificRewriteResult {
  selectedText: string
  usedRewrite: boolean
  semanticLock: SemanticLockResult
}

/**
 * Seleciona a versão linguística apenas quando ela preserva o conteúdo científico.
 * Em qualquer violação do Semantic Lock, o rascunho técnico original vence.
 */
export function selectSafeScientificRewrite(
  originalDraft: string,
  rewrittenCandidate: string | null | undefined,
): SafeScientificRewriteResult {
  const candidate = rewrittenCandidate?.trim()

  if (!candidate) {
    const semanticLock = validateScientificRewrite(originalDraft, originalDraft)
    return {
      selectedText: originalDraft,
      usedRewrite: false,
      semanticLock: {
        ...semanticLock,
        reasons: ['Reescrita ausente ou vazia; rascunho científico original preservado.'],
      },
    }
  }

  const semanticLock = validateScientificRewrite(originalDraft, candidate)
  if (!semanticLock.ok) {
    return {
      selectedText: originalDraft,
      usedRewrite: false,
      semanticLock,
    }
  }

  return {
    selectedText: candidate,
    usedRewrite: true,
    semanticLock,
  }
}

export function semanticLockMetadata(result: SafeScientificRewriteResult) {
  return {
    applied: true,
    approved: result.semanticLock.ok && result.usedRewrite,
    rewrite_used: result.usedRewrite,
    reasons: result.semanticLock.reasons,
    metrics: result.semanticLock.metrics,
  }
}
