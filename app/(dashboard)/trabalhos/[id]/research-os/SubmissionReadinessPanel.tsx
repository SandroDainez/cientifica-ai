import { AlertTriangle, CheckCircle2, ClipboardCheck, ShieldAlert } from 'lucide-react'
import type { SubmissionReadinessResult } from '@/lib/research-os/submission-readiness'

function box(status: 'ok' | 'revisao' | 'bloqueado') {
  if (status === 'ok') return 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
  if (status === 'revisao') return 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
  return 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
}

function label(status: SubmissionReadinessResult['status']) {
  if (status === 'pronto') return 'Pronto para submissão'
  if (status === 'revisao_humana') return 'Revisão humana obrigatória'
  return 'Submissão bloqueada'
}

export function SubmissionReadinessPanel({ result }: { result: SubmissionReadinessResult }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardCheck className="h-5 w-5" /> Submission Readiness Gate</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Checklist final do Research OS. “Pronto” só aparece quando os bloqueios científicos foram resolvidos; aprovações regulatórias reais nunca são presumidas.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${result.status === 'pronto' ? box('ok') : result.status === 'revisao_humana' ? box('revisao') : box('bloqueado')}`}>
          {label(result.status)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Checks aprovados</div><div className="mt-1 text-2xl font-semibold">{result.passed}/{result.total}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Bloqueios</div><div className="mt-1 text-2xl font-semibold">{result.blockers.length}</div></div>
        <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Revisões humanas</div><div className="mt-1 text-2xl font-semibold">{result.humanReview.length}</div></div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {result.checks.map(item => (
          <div key={item.id} className={`rounded-lg border p-4 ${box(item.status)}`}>
            <div className="flex items-center gap-2 font-medium">
              {item.status === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : item.status === 'revisao' ? <AlertTriangle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
              {item.label}
            </div>
            <p className="mt-2 text-sm leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>

      {result.status === 'revisao_humana' && (
        <div className={`rounded-lg border p-4 text-sm ${box('revisao')}`}>
          <strong>Importante:</strong> o sistema considera a estrutura científica consistente, mas ainda há itens que exigem confirmação humana/documental. Isso não equivale a aprovação ética, regulatória ou editorial.
        </div>
      )}
      {result.status === 'pronto' && (
        <div className={`rounded-lg border p-4 text-sm ${box('ok')}`}>
          <strong>Gate liberado:</strong> os controles estruturados do Research OS não detectaram pendências críticas para submissão. A decisão final de submeter continua sendo do pesquisador e deve considerar as exigências específicas da instituição e do periódico.
        </div>
      )}
    </section>
  )
}
