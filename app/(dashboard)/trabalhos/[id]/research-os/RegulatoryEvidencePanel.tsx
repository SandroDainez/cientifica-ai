'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, FileCheck2, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { EthicsRoute, ResearchProjectState } from '@/lib/research-os/types'
import type { RegulatoryEvidenceEntry, RegulatoryEvidenceRegistry } from '@/lib/research-os/regulatory-evidence'
import { requiredRegulatoryEvidenceRoutes, verifiedRegulatoryRoutes } from '@/lib/research-os/regulatory-evidence'

const LABELS: Partial<Record<EthicsRoute, string>> = {
  cep_conep_plataforma_brasil: 'CEP/Conep / Plataforma Brasil',
  ceua_concea: 'CEUA / CONCEA',
  registro_ensaio_clinico: 'Registro de ensaio clínico',
  consentimento_publicacao_caso: 'Consentimento para publicação',
}

function blank(route: EthicsRoute): Partial<RegulatoryEvidenceEntry> {
  return { route, status: 'registrado', identifier: '', issuer: '', documentReference: '', issuedAt: '', expiresAt: '', notes: '' }
}

export function RegulatoryEvidencePanel({
  trabalhoId,
  state,
  initialRegistry,
}: {
  trabalhoId: string
  state: ResearchProjectState | null
  initialRegistry: RegulatoryEvidenceRegistry | null
}) {
  const requiredRoutes = useMemo(() => state ? requiredRegulatoryEvidenceRoutes(state) : [], [state])
  const [registry, setRegistry] = useState<RegulatoryEvidenceRegistry | null>(initialRegistry)
  const [drafts, setDrafts] = useState<Record<string, Partial<RegulatoryEvidenceEntry>>>(() => Object.fromEntries(requiredRoutes.map(route => [route, blank(route)])))
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const verified = useMemo(() => state ? new Set(verifiedRegulatoryRoutes(registry, state)) : new Set<EthicsRoute>(), [registry, state])

  if (!state) return null

  async function save(route: EthicsRoute, markVerified: boolean) {
    setSaving(route)
    setError(null)
    const current = drafts[route] ?? blank(route)
    try {
      const response = await fetch(`/api/trabalhos/${trabalhoId}/research-os/regulatory-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', entry: { ...current, route, status: markVerified ? 'verificado' : 'registrado' } }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Falha ao salvar evidência regulatória.')
      setRegistry(data.registry)
      const saved = (data.registry?.entries ?? []).find((entry: RegulatoryEvidenceEntry) => entry.route === route)
      if (saved) setDrafts(prev => ({ ...prev, [route]: saved }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar evidência regulatória.')
    } finally {
      setSaving(null)
    }
  }

  if (requiredRoutes.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5" /> Regulatory Evidence</div>
        <p className="mt-2 text-sm text-muted-foreground">O projeto atual não exige uma das evidências regulatórias documentais mapeadas por este registro.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><FileCheck2 className="h-5 w-5" /> Regulatory Evidence Registry</h2>
        <p className="mt-1 text-sm text-muted-foreground">Registre apenas aprovações, registros e consentimentos reais. O Research OS não presume aprovação a partir da rota ética.</p>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100">{error}</div>}

      <div className="space-y-4">
        {requiredRoutes.map(route => {
          const existing = registry?.entries.find(entry => entry.route === route)
          const draft = drafts[route] ?? existing ?? blank(route)
          const isVerified = verified.has(route)
          return (
            <article key={route} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{LABELS[route] ?? route}</div>
                <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${isVerified ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'}`}>
                  {isVerified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                  {isVerified ? 'Verificado' : existing ? 'Registrado' : 'Pendente'}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-sm">Identificador real<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={draft.identifier ?? ''} onChange={e => setDrafts(prev => ({ ...prev, [route]: { ...draft, identifier: e.target.value } }))} placeholder="CAAE, parecer, registro, código..." /></label>
                <label className="text-sm">Órgão / emissor<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={draft.issuer ?? ''} onChange={e => setDrafts(prev => ({ ...prev, [route]: { ...draft, issuer: e.target.value } }))} placeholder="CEP, CEUA, ReBEC, ClinicalTrials.gov..." /></label>
                <label className="text-sm md:col-span-2">Referência documental<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={draft.documentReference ?? ''} onChange={e => setDrafts(prev => ({ ...prev, [route]: { ...draft, documentReference: e.target.value } }))} placeholder="nome/caminho/URL do documento ou comprovante" /></label>
                <label className="text-sm">Data de emissão<input type="date" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={draft.issuedAt ?? ''} onChange={e => setDrafts(prev => ({ ...prev, [route]: { ...draft, issuedAt: e.target.value } }))} /></label>
                <label className="text-sm">Validade, se houver<input type="date" className="mt-1 w-full rounded-md border bg-background px-3 py-2" value={draft.expiresAt ?? ''} onChange={e => setDrafts(prev => ({ ...prev, [route]: { ...draft, expiresAt: e.target.value } }))} /></label>
                <label className="text-sm md:col-span-2">Observações<textarea className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2" value={draft.notes ?? ''} onChange={e => setDrafts(prev => ({ ...prev, [route]: { ...draft, notes: e.target.value } }))} /></label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={saving === route} onClick={() => save(route, false)} className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50">Salvar registro</button>
                <button type="button" disabled={saving === route || !draft.identifier?.trim()} onClick={() => save(route, true)} className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50">Marcar como verificado</button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
