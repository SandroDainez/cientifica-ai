import fs from 'fs'
import path from 'path'

const SECOES_DIR = path.join(process.cwd(), 'lib/ai/prompts/secoes')

// Mapeamento (tipoTrabalho_chaveSecao) → nome do arquivo .md
const PROMPTS_MAP: Record<string, string> = {
  // ── TCC ──────────────────────────────────────────────────────
  'tcc_tema':                 'TCC_fase_1_1_tema.md',
  'tcc_problema':             'TCC_fase_1_2_problema.md',
  'tcc_objetivos':            'TCC_fase_1_3_objetivos.md',
  'tcc_justificativa':        'TCC_fase_1_4_justificativa.md',
  'tcc_revisao_literatura':   'TCC_fase_1_5_revisao_literatura.md',
  'tcc_referencial_teorico':  'TCC_fase_1_6_referencial_teorico.md',
  'tcc_metodologia':          'TCC_fase_1_7_metodologia.md',
  'tcc_resultados':           'TCC_fase_1_8_resultados.md',
  'tcc_discussao':            'TCC_fase_1_9_discussao.md',
  'tcc_conclusao':            'TCC_fase_1_10_conclusao.md',
  'tcc_resumo':               'TCC_fase_1_11_resumo_abstract.md',
  'tcc_introducao':           'TCC_fase_1_12_introducao.md',

  // ── Artigo Científico Original ────────────────────────────────
  'artigo_original_pico':                  'Artigo_Original_fase_2_1_pergunta_PICO.md',
  'artigo_original_pergunta_pico':         'Artigo_Original_fase_2_1_pergunta_PICO.md',
  'artigo_original_titulo':                'Artigo_Original_fase_2_2_titulo.md',
  'artigo_original_introducao':            'Artigo_Original_fase_2_3_introducao.md',
  'artigo_original_metodos_delineamento':  'Artigo_Original_fase_2_4_metodos_delineamento.md',
  'artigo_original_metodologia':           'Artigo_Original_fase_2_4_metodos_delineamento.md',
  'artigo_original_metodos_coleta':        'Artigo_Original_fase_2_5_metodos_coleta_analise.md',
  'artigo_original_resultados':       'Artigo_Original_fase_2_6_resultados.md',
  'artigo_original_discussao':        'Artigo_Original_fase_2_7_discussao.md',
  'artigo_original_conclusao':        'Artigo_Original_fase_2_8_conclusao.md',
  'artigo_original_resumo':           'Artigo_Original_fase_2_9_resumo_abstract.md',
  'artigo_original_carta_submissao':  'Artigo_Original_fase_2_10_carta_submissao.md',

  // ── Artigo de Revisão Narrativa ───────────────────────────────
  'artigo_revisao_escopo_pergunta':     'Revisao_Narrativa_fase_3_1_escopo_pergunta.md',
  'artigo_revisao_estrategia_busca':    'Revisao_Narrativa_fase_3_2_estrategia_busca.md',
  'artigo_revisao_introducao':          'Revisao_Narrativa_fase_3_3_introducao.md',
  'artigo_revisao_desenvolvimento':     'Revisao_Narrativa_fase_3_4_desenvolvimento_sintetica.md',
  'artigo_revisao_analise_critica':     'Revisao_Narrativa_fase_3_5_analise_critica.md',
  'artigo_revisao_lacunas':             'Revisao_Narrativa_fase_3_6_lacunas.md',
  'artigo_revisao_conclusao':           'Revisao_Narrativa_fase_3_7_conclusao.md',
  'artigo_revisao_resumo':              'Revisao_Narrativa_fase_3_8_resumo_abstract.md',
  // aliases para chaves genéricas usadas no fluxo
  'artigo_revisao_titulo':              'Artigo_Original_fase_2_2_titulo.md',
  'artigo_revisao_metodologia':         'Revisao_Narrativa_fase_3_2_estrategia_busca.md',
  'artigo_revisao_consideracoes_finais':'Revisao_Narrativa_fase_3_7_conclusao.md',

  // ── Revisão Sistemática ───────────────────────────────────────
  'revisao_sistematica_protocolo':          'Revisao_Sistematica_fase_4_1_protocolo_PROSPERO.md',
  'revisao_sistematica_pergunta_pico':      'Revisao_Sistematica_fase_4_2_pergunta_PICO.md',
  'revisao_sistematica_estrategia_busca':   'Cientifica_AI_Revisao_Sistematica_4.3_Estrategia_Busca.md',
  'revisao_sistematica_criterios':          'Revisao_Sistematica_fase_4_4_criterios_elegibilidade.md',
  'revisao_sistematica_triagem_prisma':      'Revisao_Sistematica_fase_4_5_triagem_PRISMA.md',
  'revisao_sistematica_triagem':            'Revisao_Sistematica_fase_4_5_triagem_PRISMA.md',
  'revisao_sistematica_extracao_dados':     'Revisao_Sistematica_fase_4_6_extracao_dados.md',
  'revisao_sistematica_extracao':           'Revisao_Sistematica_fase_4_6_extracao_dados.md',
  'revisao_sistematica_risco_vies':         'Revisao_Sistematica_fase_4_7_risco_vies.md',
  'revisao_sistematica_sintese':            'Revisao_Sistematica_fase_4_8_sintese_qualitativa.md',
  'revisao_sistematica_metanalise':         'Revisao_Sistematica_fase_4_9_metanalise.md',
  'revisao_sistematica_discussao':          'Revisao_Sistematica_fase_4_10_discussao_GRADE.md',
  'revisao_sistematica_conclusao':          'Revisao_Sistematica_fase_4_11_conclusao.md',
  'revisao_sistematica_resumo':             'Revisao_Sistematica_fase_4_12_resumo_abstract.md',
  // aliases genéricos
  'revisao_sistematica_introducao':         'Revisao_Sistematica_fase_4_1_protocolo_PROSPERO.md',
  'revisao_sistematica_metodologia':        'Cientifica_AI_Revisao_Sistematica_4.3_Estrategia_Busca.md',

  // ── Relato de Caso ────────────────────────────────────────────
  'relato_caso_justificativa':              'Relato_Caso_fase_4_1_justificativa.md',
  'relato_caso_introducao':                 'Relato_Caso_fase_4_2_introducao_revisao.md',
  'relato_caso_apresentacao_caso':          'Relato_Caso_fase_4_3_apresentacao_caso.md',
  'relato_caso_investigacao_diagnostica':   'Relato_Caso_fase_4_4_investigacao_diagnostica.md',
  'relato_caso_conduta_tratamento':         'Relato_Caso_fase_4_5_conduta_tratamento.md',
  'relato_caso_evolucao_desfecho':          'Relato_Caso_fase_4_6_evolucao_desfecho.md',
  'relato_caso_discussao':                  'Relato_Caso_fase_4_7_discussao.md',
  'relato_caso_conclusao':                  'Relato_Caso_fase_4_8_conclusao.md',
  'relato_caso_resumo':                     'Relato_Caso_fase_4_9_resumo_abstract.md',
  // alias para chave genérica do fluxo
  'relato_caso_titulo':                     'Artigo_Original_fase_2_2_titulo.md',

  // ── Monografia ────────────────────────────────────────────────
  'monografia_tema':                'Monografia_fase_5_1_tema_delimitacao.md',
  'monografia_problema_objetivos':  'Monografia_fase_5_2_problema_objetivos.md',
  'monografia_objetivos':           'Monografia_fase_5_2_problema_objetivos.md',
  'monografia_problema':            'Monografia_fase_5_2_problema_objetivos.md',
  'monografia_justificativa':       'Monografia_fase_5_3_justificativa.md',
  'monografia_revisao_literatura':  'Monografia_fase_5_4_revisao_literatura.md',
  'monografia_referencial_teorico': 'Monografia_fase_5_5_referencial_teorico.md',
  'monografia_metodologia':         'Monografia_fase_5_6_metodologia.md',
  'monografia_resultados':          'Monografia_fase_5_7_resultados_analise.md',
  'monografia_desenvolvimento':     'Monografia_fase_5_7_resultados_analise.md',
  'monografia_discussao':           'Monografia_fase_5_8_discussao.md',
  'monografia_conclusao':           'Monografia_fase_5_9_conclusao.md',
  'monografia_resumo':              'Monografia_fase_5_10_resumo_abstract.md',
  'monografia_introducao':          'Artigo_Original_fase_2_3_introducao.md',

  // ── Dissertação de Mestrado ───────────────────────────────────
  'dissertacao_mestrado_tema':                'Dissertacao_fase_6_1_tema_lacuna_originalidade.md',
  'dissertacao_mestrado_problema':            'Dissertacao_fase_6_2_problema_hipoteses.md',
  'dissertacao_mestrado_objetivos':           'Dissertacao_fase_7_3_objetivos.md',
  'dissertacao_mestrado_justificativa':       'Dissertacao_fase_7_4_justificativa.md',
  'dissertacao_mestrado_revisao_literatura':  'Dissertacao_fase_7_5_revisao_literatura.md',
  'dissertacao_mestrado_referencial_teorico': 'Dissertacao_fase_7_6_referencial_teorico.md',
  'dissertacao_mestrado_metodologia':         'Dissertacao_fase_7_7_metodologia.md',
  'dissertacao_mestrado_aspectos_eticos':     'Dissertacao_fase_7_8_aspectos_eticos.md',
  'dissertacao_mestrado_resultados':          'Dissertacao_fase_7_9_resultados.md',
  'dissertacao_mestrado_discussao':           'Dissertacao_fase_7_10_discussao.md',
  'dissertacao_mestrado_conclusao':           'Dissertacao_fase_7_11_conclusao.md',
  'dissertacao_mestrado_limitacoes':          'Dissertacao_fase_7_12_limitacoes.md',
  'dissertacao_mestrado_resumo':              'Dissertacao_fase_7_13_resumo_abstract.md',
  'dissertacao_mestrado_introducao':          'Artigo_Original_fase_2_3_introducao.md',

  // ── Tese de Doutorado ─────────────────────────────────────────
  'tese_doutorado_tema':                'Tese_fase_8_1_tema_lacuna_contribuicao.md',
  'tese_doutorado_problema':            'Tese_fase_8_2_problema_hipoteses.md',
  'tese_doutorado_objetivos':           'Tese_fase_8_3_objetivos.md',
  'tese_doutorado_justificativa':       'Tese_fase_8_4_justificativa_impacto.md',
  'tese_doutorado_revisao_literatura':  'Tese_fase_8_5_revisao_literatura.md',
  'tese_doutorado_referencial_teorico': 'Tese_fase_8_6_referencial_teorico.md',
  'tese_doutorado_metodologia':         'Tese_fase_8_7_metodologia.md',
  'tese_doutorado_resultados':          'Tese_fase_8_8_resultados.md',
  'tese_doutorado_discussao':           'Tese_fase_8_9_discussao.md',
  'tese_doutorado_conclusao':           'Tese_fase_8_10_conclusao.md',
  'tese_doutorado_limitacoes':          'Tese_fase_8_11_limitacoes_perspectivas.md',
  'tese_doutorado_aspectos_eticos':     'Tese_fase_8_12_aspectos_eticos.md',
  'tese_doutorado_resumo':              'Cientifica_AI_Tese_8.13_Resumo_Abstract_Palavras_Chave.md',
  'tese_doutorado_introducao':          'Cientifica_AI_Tese_8.14_Introducao.md',
  // aliases para chaves genéricas do fluxo
  'tese_doutorado_tema_originalidade':  'Tese_fase_8_1_tema_lacuna_contribuicao.md',
  'tese_doutorado_revisao_estado_arte': 'Tese_fase_8_5_revisao_literatura.md',
  'tese_doutorado_estado_arte':         'Tese_fase_8_5_revisao_literatura.md',

  // ── Projeto de Pesquisa ───────────────────────────────────────
  'projeto_pesquisa_tema':                  'Cientifica_AI_Projeto_Pesquisa_9.1_Tema_Problema.md',
  'projeto_pesquisa_problema':              'Cientifica_AI_Projeto_Pesquisa_9.1_Tema_Problema.md',
  'projeto_pesquisa_objetivos':             'Cientifica_AI_Projeto_Pesquisa_9.2_Objetivos_Hipoteses.md',
  'projeto_pesquisa_justificativa':         'Cientifica_AI_Projeto_Pesquisa_9.3_Justificativa_Relevancia.md',
  'projeto_pesquisa_revisao_literatura':    'Cientifica_AI_Projeto_Pesquisa_9.4_Revisao_Literatura.md',
  'projeto_pesquisa_metodologia':           'Cientifica_AI_Projeto_Pesquisa_9.5_Metodologia.md',
  'projeto_pesquisa_aspectos_eticos':       'Cientifica_AI_Projeto_Pesquisa_9.6_Aspectos_Eticos.md',
  'projeto_pesquisa_cronograma':            'Cientifica_AI_Projeto_Pesquisa_9.7_Cronograma.md',
  'projeto_pesquisa_orcamento':             'Cientifica_AI_Projeto_Pesquisa_9.8_Orcamento_Recursos.md',
  'projeto_pesquisa_resultados_esperados':  'Cientifica_AI_Projeto_Pesquisa_9.9_Resultados_Esperados_Impacto.md',
  'projeto_pesquisa_resumo':                'TCC_fase_1_11_resumo_abstract.md', // fallback — não há fase 'resumo' neste fluxo

  // ── Relatório de IC ───────────────────────────────────────────
  'relatorio_ic_resumo_atividades':  'Cientifica_AI_Relatorio_IC_10.1_Resumo_Atividades.md',
  'relatorio_ic_introducao':         'Cientifica_AI_Relatorio_IC_10.2_Introducao_Contextualizacao.md',
  'relatorio_ic_objetivos':          'Cientifica_AI_Relatorio_IC_10.3_Objetivos_Periodo.md',
  'relatorio_ic_metodologia':        'Cientifica_AI_Relatorio_IC_10.4_Metodologia_Utilizada.md',
  'relatorio_ic_resultados':         'Cientifica_AI_Relatorio_IC_10.5_Resultados_Obtidos.md',
  'relatorio_ic_dificuldades':       'Cientifica_AI_Relatorio_IC_10.6_Dificuldades_Solucoes.md',
  'relatorio_ic_formacao':           'Cientifica_AI_Relatorio_IC_10.7_Atividades_Formacao.md',
  'relatorio_ic_atividades_formacao':'Cientifica_AI_Relatorio_IC_10.7_Atividades_Formacao.md',
  'relatorio_ic_perspectivas':       'Cientifica_AI_Relatorio_IC_10.8_Perspectivas_Proximas_Etapas.md',
  'relatorio_ic_resumo':             'TCC_fase_1_11_resumo_abstract.md',
}

const TRANSVERSAL_MAP: Record<string, string> = {
  'T1': 'Cientifica_AI_T1_Gerador_Referencias_Reais.md',
  'T2': 'Cientifica_AI_T2_Validador_Coerencia.md',
  'T3': 'Cientifica_AI_T3_Gerador_Slides_Apresentacao.md',
  'T4': 'Cientifica_AI_T4_Assistente_CEP.md',
  'T5': 'Cientifica_AI_T5_Gerador_TCLE.md',
  'T6': 'Cientifica_AI_T6_Corretor_por_Secao.md',
  'T7': 'Cientifica_AI_T7_Gerador_Palavras_Chave.md',
  'T8': 'Cientifica_AI_T8_Formatador_Referencias.md',
}

function cleanMarkdownEscapes(text: string): string {
  return text
    .replace(/\\([`*_{}[\]()#+\-.!|])/g, '$1')
    .replace(/\\\\/g, '\\')
    .trim()
}

function extractSystemPrompt(content: string): string {
  const systemMarker = '### SYSTEM PROMPT'
  const userMarker = '### USER PROMPT'

  const systemStart = content.indexOf(systemMarker)
  if (systemStart !== -1) {
    const textStart = content.indexOf('\n', systemStart) + 1
    const userStart = content.indexOf(userMarker)
    const textEnd = userStart === -1 ? content.length : userStart
    return cleanMarkdownEscapes(content.substring(textStart, textEnd))
  }

  // Formato alternativo (Cientifica_AI_*): usa o arquivo inteiro como system prompt
  return cleanMarkdownEscapes(content)
}

export function getTransversalPrompt(codigo: string): string | null {
  const filename = TRANSVERSAL_MAP[codigo]
  if (!filename) return null
  try {
    const filePath = path.join(SECOES_DIR, filename)
    const content = fs.readFileSync(filePath, 'utf-8')
    return cleanMarkdownEscapes(content) || null
  } catch {
    return null
  }
}

export function getSystemPromptEspecializado(
  tipoTrabalho: string,
  chaveSecao: string
): string | null {
  const key = `${tipoTrabalho}_${chaveSecao}`
  const filename = PROMPTS_MAP[key]
  if (!filename) return null

  try {
    const filePath = path.join(SECOES_DIR, filename)
    const content = fs.readFileSync(filePath, 'utf-8')
    const extracted = extractSystemPrompt(content)
    return extracted || null
  } catch {
    return null
  }
}
