import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requiredRegulatoryEvidenceRoutes, type RegulatoryDocumentIntegrity } from '@/lib/research-os/regulatory-evidence'
import type { EthicsRoute, ResearchProjectState } from '@/lib/research-os/types'

const BUCKET = 'research-regulatory-documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg'])

function asState(value: unknown): ResearchProjectState | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<ResearchProjectState>
  return v.schemaVersion === 2 && typeof v.studyDesign === 'string' && Boolean(v.regulatory)
    ? value as ResearchProjectState
    : null
}

function safeFileName(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || 'documento'
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Formulário de upload inválido.' }, { status: 400 })
  const file = form.get('file')
  const route = form.get('route')
  if (!(file instanceof File) || typeof route !== 'string') {
    return NextResponse.json({ error: 'Arquivo e rota regulatória são obrigatórios.' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Formato não permitido. Envie PDF, PNG ou JPEG.' }, { status: 415 })
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'O documento precisa ter até 10 MB.' }, { status: 413 })
  }

  const { data: existing } = await supabase
    .from('trabalhos')
    .select('dados_trabalho')
    .eq('id', id)
    .eq('usuario_id', user.id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Trabalho não encontrado' }, { status: 404 })

  const current = (existing.dados_trabalho as Record<string, unknown>) ?? {}
  const researchOs = (current.research_os as Record<string, unknown>) ?? {}
  const state = asState(researchOs.project_state)
  if (!state) return NextResponse.json({ error: 'ResearchProjectState inválido ou ausente.' }, { status: 409 })

  const required = new Set(requiredRegulatoryEvidenceRoutes(state))
  if (!required.has(route as EthicsRoute)) {
    return NextResponse.json({ error: 'Esta rota regulatória não é exigida pelo projeto atual.' }, { status: 409 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const fileName = safeFileName(file.name)
  const storagePath = `${user.id}/${id}/${route}/${sha256}-${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    const alreadyExists = /already exists|duplicate/i.test(uploadError.message)
    if (!alreadyExists) {
      console.error('[research-os/regulatory-document] upload falhou:', uploadError)
      return NextResponse.json({ error: 'Falha ao armazenar documento regulatório em storage privado.' }, { status: 500 })
    }
  }

  const document: RegulatoryDocumentIntegrity = {
    bucket: BUCKET,
    path: storagePath,
    fileName,
    mimeType: file.type,
    size: file.size,
    sha256,
    uploadedAt: new Date().toISOString(),
  }

  return NextResponse.json({ ok: true, document })
}
