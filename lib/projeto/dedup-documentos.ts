// ============================================================
// CIENTÍFICA AI — Dedup de documentos por etapa (rede de segurança)
// ============================================================
// Garante que um MESMO tipo de documento NUNCA seja gerado por duas etapas
// diferentes do roadmap — independentemente de heurísticas de título. A primeira
// etapa (na ordem do roadmap) que reivindica um tipo fica com ele; as seguintes
// não o repetem. Assim nunca há "dois cards gerando a mesma coisa".

export function dedupDocumentosPorEtapa<T extends { tipo: string }>(
  etapasComDocs: { id: string; docs: T[] }[],
): Map<string, T[]> {
  const vistos = new Set<string>()
  const mapa = new Map<string, T[]>()
  for (const { id, docs } of etapasComDocs) {
    const unicos = docs.filter(d => {
      if (vistos.has(d.tipo)) return false
      vistos.add(d.tipo)
      return true
    })
    mapa.set(id, unicos)
  }
  return mapa
}
