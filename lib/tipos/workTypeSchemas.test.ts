import {
  getSchemaByWorkType,
  shouldShowField,
  shouldShowEditorSection,
} from './workTypeSchemas'
import type { TipoTrabalho } from '@/types'

describe('getSchemaByWorkType', () => {
  it('retorna o schema correto para um tipo mapeado', () => {
    const schema = getSchemaByWorkType('artigo_original')
    expect(schema.tipoTrabalho).toBe('artigo_original')
    expect(schema.editorSections).toContain('metodos_coleta')
    expect(schema.envolveSeresHumanos).toBe(true)
  })

  it('retorna fallback seguro + console.warn para tipo não mapeado', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const schema = getSchemaByWorkType('tipo_inexistente' as TipoTrabalho)
    expect(schema.envolveSeresHumanos).toBe(false)
    expect(schema.editorSections).toHaveLength(0)
    expect(schema.projectFields).toContain('titulo')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('shouldShowField', () => {
  it('oculta campos éticos para artigo de revisão', () => {
    expect(shouldShowField('artigo_revisao', 'precisa_cep')).toBe(false)
    expect(shouldShowField('artigo_revisao', 'tcle')).toBe(false)
  })

  it('oculta campos éticos para revisão sistemática (dados secundários)', () => {
    expect(shouldShowField('revisao_sistematica', 'precisa_cep')).toBe(false)
  })

  it('mostra campos éticos para tipos com seres humanos (TCC, artigo original)', () => {
    expect(shouldShowField('tcc', 'precisa_cep')).toBe(true)
    expect(shouldShowField('artigo_original', 'riscos_participantes')).toBe(true)
  })

  it('sempre mostra campos básicos', () => {
    expect(shouldShowField('revisao_sistematica', 'titulo')).toBe(true)
    expect(shouldShowField('artigo_revisao', 'objetivo_geral')).toBe(true)
  })
})

describe('shouldShowEditorSection', () => {
  it('mostra seções que pertencem ao fluxo do tipo', () => {
    expect(shouldShowEditorSection('artigo_revisao', 'introducao')).toBe(true)
    expect(shouldShowEditorSection('relato_caso', 'apresentacao_caso')).toBe(true)
  })

  it('oculta seções que NÃO pertencem ao fluxo do tipo', () => {
    expect(shouldShowEditorSection('artigo_revisao', 'aspectos_eticos')).toBe(false)
    expect(shouldShowEditorSection('artigo_revisao', 'metodos_coleta')).toBe(false)
  })
})

describe('envolveSeresHumanos por tipo', () => {
  it('é false para revisões e true para pesquisa com participantes/pacientes', () => {
    expect(getSchemaByWorkType('revisao_sistematica').envolveSeresHumanos).toBe(false)
    expect(getSchemaByWorkType('artigo_revisao').envolveSeresHumanos).toBe(false)
    expect(getSchemaByWorkType('relato_caso').envolveSeresHumanos).toBe(true)
  })
})
