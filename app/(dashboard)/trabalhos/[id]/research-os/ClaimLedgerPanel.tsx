import { AlertTriangle, CheckCircle2, FileSearch, FlaskConical, LibraryBig, ShieldAlert } from 'lucide-react'
import type { ClaimLedgerSummary } from '@/lib/research-os/claim-ledger'

function badgeClass(status: 'ok' | 'alerta' | 'bloqueado') {
  if (status === 'ok') return 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
  if (status === 'alerta') return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
  return 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100'
}

function sourceLabel(source: 'resultado_proprio' | 'evidencia_externa' | 'nao_suportado') {
  if (source === 'resultado_proprio') return 'Resultado próprio'
  if (source === 'evidencia_externa') return 'Evidência externa'
  return 'Sem suporte'
}

export function ClaimLedgerPanel({ ledger }: { ledger: ClaimLedgerSummary }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FileSearch className="h-5 w-5" /> Claim Ledger / Provenance</h2>
          <p className="mt-1 text-sm text-muted-foreground">Auditoria do manuscrito por afirmação: cada claim material precisa apontar para um resultado próprio aprovado ou para evidência externa confirmada.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${ledger.ready ? badgeClass('ok') : ledger.totalClaims ? badgeClass('bloqueado') : ''}`}>
          {ledger.ready ? 'Trilha íntegra' : ledger.totalClaims ? 'Requer revisão' : 'Aguardando Discussão/Conclusão'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Claims auditados</div><div className="mt-1 text-2xl font-semibold">{ledger.totalClaims}</div></div>
        <div className="rounded-lg border p-3"><div className="flex items-center gap-1 text-xs text-muted-foreground"><FlaskConical className="h-3.5 w-3.5" /> Resultados próprios</div><div className="mt-1 text-2xl font-semibold">{ledger.ownResults}</div></div>
        <div className="rounded-lg border p-3"><div className="flex items-center gap-1 text-xs text-muted-foreground"><LibraryBig className="h-3.5 w-3.5" /> Evidência externa</div><div className="mt-1 text-2xl font-semibold">{ledger.externalEvidence}</div></div>
        <div className="rounded-lg border p-3"><div className="flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Sem suporte</div><div className="mt-1 text-2xl font-semibold">{ledger.unsupported}</div></div>
        <div className="rounded-lg border p-3"><div className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" /> Violações</div><div className="mt-1 text-2xl font-semibold">{ledger.violations}</div></div>
      </div>

      {ledger.entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Quando Discussão ou Conclusão forem geradas, a trilha de provenance aparecerá aqui automaticamente.</div>
      ) : (
        <div className="space-y-3">
          {ledger.entries.map((entry, index) => (
            <article key={`${entry.sectionKey}-${index}`} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold">{entry.sectionName}</span>
                <span className={`rounded-full border px-2 py-0.5 ${badgeClass(entry.status)}`}>{entry.status === 'ok' ? 'OK' : entry.status === 'alerta' ? 'Alerta' : 'Bloqueado'}</span>
                <span className="rounded-full border px-2 py-0.5">{sourceLabel(entry.source)}</span>
                {entry.sourceId && <span className="font-mono text-muted-foreground">{entry.sourceId}</span>}
              </div>
              <p className="mt-2 text-sm leading-relaxed">{entry.sentence}</p>
              {entry.message && <div className={`mt-3 rounded-md border p-2 text-sm ${badgeClass('bloqueado')}`}>{entry.message}</div>}
            </article>
          ))}
        </div>
      )}

      {ledger.ready && ledger.totalClaims > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"><CheckCircle2 className="h-4 w-4" /> Nenhum claim material sem origem ou com aumento de força foi detectado nas seções auditadas.</div>
      )}
    </section>
  )
}
