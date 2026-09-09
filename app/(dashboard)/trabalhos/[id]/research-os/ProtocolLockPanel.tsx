'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, LockKeyhole, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { ProtocolLockRecord, ProtocolReadiness } from '@/lib/research-os/protocol-lock'

interface Props {
  trabalhoId: string
  initialLock: ProtocolLockRecord | null
}

interface ApiResponse {
  ok?: boolean
  error?: string
  protocolLock?: ProtocolLockRecord | null
  readiness?: ProtocolReadiness
}

export function ProtocolLockPanel({ trabalhoId, initialLock }: Props) {
  const [protocolLock, setProtocolLock] = useState<ProtocolLockRecord | null>(initialLock)
  const [readiness, setReadiness] = useState<ProtocolReadiness | null>(null)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')

  const altered = readiness?.status === 'alterado_apos_congelamento'
  const statusLabel = useMemo(() => {
    if (altered) return 'Mudanças detectadas após congelamento'
    if (protocolLock) return `Protocolo congelado — v${protocolLock.snapshot.version}`
    if (readiness?.status === 'pronto_para_congelar') return 'Pronto para congelar'
    return 'Ainda não pronto para congelar'
  }, [altered, protocolLock, readiness])

  async function call(action: 'status' | 'freeze' | 'amend') {
    setLoading(true)
    try {
      const response = await fetch(`/api/trabalhos/${trabalhoId}/research-os/protocol-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'amend' ? reason.trim() : undefined }),
      })
      const data = await response.json() as ApiResponse
      if (data.readiness) setReadiness(data.readiness)
      if (data.protocolLock !== undefined) setProtocolLock(data.protocolLock ?? null)
      if (!response.ok) throw new Error(data.error ?? 'Falha no Protocol Lock')

      if (action === 'status') toast.success('Status do protocolo atualizado')
      if (action === 'freeze') toast.success('Protocolo congelado com trilha auditável')
      if (action === 'amend') {
        setReason('')
        toast.success('Amendment registrado e nova versão congelada')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no Protocol Lock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><LockKeyhole className="h-5 w-5" /> Protocol Lock</h2>
          <p className="mt-1 text-sm text-muted-foreground">Congela pergunta, desfecho, SAP, tamanho amostral e decisões metodológicas. Mudanças posteriores viram amendment, não sobrescrita silenciosa.</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold">{statusLabel}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => call('status')} disabled={loading} className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50">
          {loading ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}Verificar prontidão
        </button>
        {!protocolLock && (
          <button onClick={() => call('freeze')} disabled={loading || readiness?.canFreeze === false} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <ShieldCheck className="h-4 w-4" /> Congelar protocolo
          </button>
        )}
      </div>

      {readiness?.blockers && readiness.blockers.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Pendências antes do lock</div>
          <ul className="mt-2 space-y-1">{readiness.blockers.map((item, i) => <li key={i}>• {item}</li>)}</ul>
        </div>
      )}

      {readiness?.warnings && readiness.warnings.length > 0 && (
        <div className="rounded-lg border p-3 text-sm">
          <div className="font-medium">Avisos metodológicos</div>
          <ul className="mt-2 space-y-1 text-muted-foreground">{readiness.warnings.map((item, i) => <li key={i}>• {item}</li>)}</ul>
        </div>
      )}

      {protocolLock && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Versão</p><p className="mt-1 font-semibold">v{protocolLock.snapshot.version}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Congelado em</p><p className="mt-1 text-sm">{new Date(protocolLock.snapshot.frozenAt).toLocaleString('pt-BR')}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Fingerprint</p><p className="mt-1 font-mono text-xs">{protocolLock.snapshot.fingerprint}</p></div>
        </div>
      )}

      {altered && (
        <div className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
          <div className="font-semibold">O projeto atual difere do protocolo congelado</div>
          <ul className="space-y-1 text-sm">{readiness?.changes.map((change, i) => <li key={i}>• {change.field}</li>)}</ul>
          <label className="block text-xs">Justificativa obrigatória para amendment
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Ex.: alteração aprovada antes do recrutamento após revisão do protocolo..." className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" />
          </label>
          <button onClick={() => call('amend')} disabled={loading || reason.trim().length < 10} className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50">
            Registrar amendment e congelar nova versão
          </button>
        </div>
      )}

      {protocolLock && protocolLock.amendments.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Histórico de amendments</h3>
          <div className="mt-3 space-y-3">
            {protocolLock.amendments.map((item, i) => (
              <div key={i} className="rounded-md bg-muted/50 p-3 text-sm">
                <div className="font-medium">v{item.fromVersion} → v{item.toVersion}</div>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(item.changedAt).toLocaleString('pt-BR')}</div>
                <p className="mt-2">{item.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">Campos alterados: {item.changes.map(v => v.field).join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
