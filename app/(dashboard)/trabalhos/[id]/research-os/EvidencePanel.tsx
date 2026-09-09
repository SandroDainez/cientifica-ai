'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { EvidenceMapResult, ClaimCandidate } from '@/lib/research-os/evidence-engine'

interface Props {
  trabalhoId: string
  initialMap: EvidenceMapResult | null
}

function statusClass(status: string) {
  if (status === 'confirmado') return 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/30 dark:text-green-100'
  if (status === 'parcial') return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
  if (status === 'contraditorio') return 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100'
  return 'border-border bg-muted/40 text-muted-foreground'
}

export function EvidencePanel({ trabalhoId, initialMap }: Props) {
  const [map, setMap] = useState<EvidenceMapResult | null>(initialMap)
  const [claims, setClaims] = useState<ClaimCandidate[]>(initialMap?.claims ?? [])
  const [loading, setLoading] = useState(false)

  const covered = useMemo(() => {
    if (!map) return { confirmed: 0, totalHigh: 0 }
    const totalHigh = map.claims.filter(c => c.importance === 'alta').length
    const confirmedIds = new Set(map.links.filter(l => l.supportStatus === 'confirmado' && l.directness === 'direta').map(l => l.claimId))
    const confirmed = map.claims.filter(c => c.importance === 'alta' && confirmedIds.has(c.id)).length
    return { confirmed, totalHigh }
  }, [map])

  async function buildEvidenceMap() {
    setLoading(true)
    try {
      let candidateClaims = claims
      if (candidateClaims.length === 0) {
        const claimRes = await fetch('/api/ia/evidence-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trabalhoId }),
        })
        const claimData = await claimRes.json()
        if (!claimRes.ok) throw new Error(claimData.error ?? 'Falha ao propor claims')
        candidateClaims = claimData.claims as ClaimCandidate[]
        setClaims(candidateClaims)
      }

      const evidenceRes = await fetch('/api/ia/evidence-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trabalhoId, claims: candidateClaims }),
      })
      const evidenceData = await evidenceRes.json()
      if (!evidenceRes.ok) throw new Error(evidenceData.error ?? 'Falha ao auditar evidências')
      setMap(evidenceData as EvidenceMapResult)
      toast.success('Mapa de evidência atualizado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao construir mapa de evidência')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5" /> Evidence Map</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">O sistema propõe claims centrais do projeto e verifica se as referências cadastradas realmente os sustentam. Referência existente não é tratada automaticamente como evidência.</p>
        </div>
        <button onClick={buildEvidenceMap} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
          {loading ? 'Auditando...' : map ? 'Reauditar evidências' : 'Construir mapa de evidência'}
        </button>
      </div>

      {!map ? (
        <div className="mt-5 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          Nenhum mapa construído ainda. Salve primeiro o estado científico e então clique em “Construir mapa de evidência”.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Prontidão da evidência</div><div className="mt-1 text-lg font-semibold capitalize">{map.readiness}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Claims de alta importância cobertos</div><div className="mt-1 text-lg font-semibold">{covered.confirmed}/{covered.totalHigh}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Pendências críticas</div><div className="mt-1 text-lg font-semibold">{map.uncoveredClaims.length}</div></div>
          </div>

          {map.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Auditoria encontrou limitações</div>
              <ul className="mt-2 space-y-1">{map.warnings.map((w, i) => <li key={i}>• {w}</li>)}</ul>
            </div>
          )}

          <div className="space-y-3">
            {map.claims.map(claim => {
              const links = map.links.filter(link => link.claimId === claim.id)
              const strongest = links.find(link => link.supportStatus === 'confirmado' && link.directness === 'direta') ?? links[0]
              const uncovered = map.uncoveredClaims.includes(claim.id)
              return (
                <article key={claim.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{claim.id}</span><span>•</span><span>{claim.kind}</span><span>•</span><span>importância {claim.importance}</span></div>
                      <p className="mt-1 text-sm font-medium">{claim.text}</p>
                    </div>
                    {uncovered ? <XCircle className="h-5 w-5 shrink-0 text-red-500" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />}
                  </div>

                  {strongest ? (
                    <div className={`mt-3 rounded-md border p-3 text-xs ${statusClass(strongest.supportStatus)}`}>
                      <div className="font-medium">{strongest.supportStatus} · {strongest.directness}</div>
                      <div className="mt-1">{strongest.rationale}</div>
                      <div className="mt-2 opacity-80">População: {strongest.populationMatch} · Desfecho: {strongest.outcomeMatch} · Número: {strongest.numericSupport}</div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">Nenhuma ligação de evidência foi confirmada para este claim.</div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
