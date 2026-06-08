import {
  isValidDOIFormat,
  extractCitations,
  validateCitations,
  validateReference,
  buildReferenceGuardrail,
  type ReferenceValidationResult,
} from './referenceValidator'
import type { Referencia } from '@/types'

const mockFetch = jest.fn()
global.fetch = mockFetch

function makeRef(overrides: Partial<Referencia> = {}): Referencia {
  return {
    id: 'ref_1', trabalho_id: 'trabalho_1', tipo: 'artigo',
    titulo: 'Sepsis mortality in Brazil',
    autores: [{ nome: 'João', sobrenome: 'Silva', iniciais: 'J.' }],
    ano: 2023, doi: '10.1016/j.bjid.2023.105016',
    confiabilidade: 'alta', dados_extras: {}, created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('isValidDOIFormat', () => {
  it('aceita DOI válido', () => { expect(isValidDOIFormat('10.1016/j.bjid.2023.105016')).toBe(true) })
  it('aceita DOI com subcampos', () => { expect(isValidDOIFormat('10.1093/bmb/ldz038')).toBe(true) })
  it('rejeita sem prefixo 10.', () => { expect(isValidDOIFormat('11.1016/j.bjid.2023')).toBe(false) })
  it('rejeita string vazia', () => { expect(isValidDOIFormat('')).toBe(false) })
  it('rejeita DOI sem barra', () => { expect(isValidDOIFormat('10.1016')).toBe(false) })
})

describe('extractCitations', () => {
  it('extrai [citation:ref_1]', () => { expect(extractCitations('[citation:ref_1]')).toContain('ref_1') })
  it('extrai múltiplos [citation:X]', () => {
    const r = extractCitations('[citation:ref_1] e [citation:ref_2]')
    expect(r).toContain('ref_1'); expect(r).toContain('ref_2')
  })
  it('extrai citação numérica [1]', () => { expect(extractCitations('texto [1]')).toContain('1') })
  it('extrai múltiplos numéricos [1,2,3]', () => {
    const r = extractCitations('[1,2,3]')
    expect(r).toContain('1'); expect(r).toContain('2'); expect(r).toContain('3')
  })
  it('retorna vazio sem citações', () => { expect(extractCitations('sem citações')).toHaveLength(0) })
})

describe('validateCitations', () => {
  const refs: Referencia[] = [makeRef({ id: 'ref_1' }), makeRef({ id: 'ref_2', titulo: 'Outro' })]
  it('não gera erro para [citation:ref_1] existente', () => { expect(validateCitations('[citation:ref_1]', refs, 'abnt')).toHaveLength(0) })
  it('gera CITATION_WITHOUT_REFERENCE para ID inexistente', () => {
    const errors = validateCitations('[citation:ref_99]', refs, 'abnt')
    expect(errors).toHaveLength(1); expect(errors[0].error).toBe('CITATION_WITHOUT_REFERENCE')
  })
  it('não gera erro para Vancouver dentro do range', () => { expect(validateCitations('[1]', refs, 'vancouver')).toHaveLength(0) })
  it('gera erro para Vancouver fora do range', () => {
    const errors = validateCitations('[5]', refs, 'vancouver')
    expect(errors).toHaveLength(1); expect(errors[0].error).toBe('CITATION_WITHOUT_REFERENCE')
  })
})

describe('validateReference — local', () => {
  beforeEach(() => mockFetch.mockReset())
  it('rejeita sem título', async () => {
    const r = await validateReference(makeRef({ titulo: '', doi: undefined }), { useExternalValidation: false })
    expect(r.status).toBe('REJECTED')
  })
  it('rejeita sem autores', async () => {
    const r = await validateReference(makeRef({ autores: [], doi: undefined }), { useExternalValidation: false })
    expect(r.errors).toContain('MISSING_REQUIRED_FIELDS')
  })
  it('rejeita DOI inválido', async () => {
    const r = await validateReference(makeRef({ doi: 'doi-invalido' }), { useExternalValidation: false })
    expect(r.status).toBe('REJECTED'); expect(r.errors).toContain('DOI_INVALID_FORMAT')
  })
  it('marca UNVERIFIED para ref válida sem DOI', async () => {
    const r = await validateReference(makeRef({ doi: undefined }), { useExternalValidation: false })
    expect(r.status).toBe('UNVERIFIED')
  })
})

describe('validateReference — Crossref', () => {
  beforeEach(() => mockFetch.mockReset())
  it('valida com DOI encontrado no Crossref', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ message: { DOI: '10.1016/j.bjid.2023.105016', title: ['Sepsis mortality in Brazil'], author: [{ family: 'Silva', given: 'João' }], published: { 'date-parts': [[2023]] } } }) })
    const r = await validateReference(makeRef(), { useExternalValidation: true })
    expect(r.status).toBe('VALIDATED')
  })
  it('rejeita com DOI_NOT_FOUND para 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const r = await validateReference(makeRef({ doi: '10.9999/nao-existe' }), { useExternalValidation: true })
    expect(r.status).toBe('REJECTED'); expect(r.errors).toContain('DOI_NOT_FOUND')
  })
  it('marca UNVERIFIED para erro de rede', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const r = await validateReference(makeRef(), { useExternalValidation: true })
    expect(r.status).toBe('UNVERIFIED')
  })
  it('marca PARTIALLY_VALIDATED para título divergente', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ message: { DOI: '10.1016/j.bjid.2023.105016', title: ['Completely different title'], author: [{ family: 'Silva', given: 'João' }], published: { 'date-parts': [[2023]] } } }) })
    const r = await validateReference(makeRef(), { useExternalValidation: true })
    expect(r.status).toBe('PARTIALLY_VALIDATED'); expect(r.warnings).toContain('TITLE_MISMATCH')
  })
})

describe('buildReferenceGuardrail', () => {
  const refs: Referencia[] = [makeRef({ id: 'ref_1' }), makeRef({ id: 'ref_2', titulo: 'Outro' }), makeRef({ id: 'ref_3', titulo: 'Rejeitado' })]
  const results: ReferenceValidationResult[] = [
    { referenceId: 'ref_1', status: 'VALIDATED', errors: [], warnings: [], checkedAt: '' },
    { referenceId: 'ref_2', status: 'PARTIALLY_VALIDATED', errors: [], warnings: [], checkedAt: '' },
    { referenceId: 'ref_3', status: 'REJECTED', errors: ['DOI_NOT_FOUND'], warnings: [], checkedAt: '' },
  ]
  it('exclui REJECTED em modo estrito', () => {
    const p = buildReferenceGuardrail(refs, results, true)
    expect(p).not.toContain('ref_3'); expect(p).toContain('ref_1')
  })
  it('contém instrução de não inventar referências', () => {
    expect(buildReferenceGuardrail(refs, results, false)).toContain('[REFERÊNCIA NECESSÁRIA]')
  })
})
