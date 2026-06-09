// ============================================================
// CIENTÍFICA AI — TESTES DE REGRESSÃO DAS MELHORIAS
// ============================================================
// Trava TODAS as melhorias determinísticas para que NUNCA regridam.
// Rode com:  npm test
// Qualquer mudança futura que quebre um destes comportamentos FALHA aqui,
// antes de ir para produção. NÃO remova testes — só adicione.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { removerTravessoes, validarCitacoesReais, removerPlaceholdersCitacaoResiduais } from '@/lib/ai/validar-citacoes'
import { corrigirCodigoR, corrigirCodigoPython } from '@/lib/ai/utils'
import { converterMathLatexParaTexto } from '@/lib/formatacao/latex'
import { markdownAcademicoParaHtml } from '@/lib/formatacao/documento-html'
import { ehSobrenomePlaceholder, ehTituloDescartavel, ehReferenciaUtilizavel } from '@/lib/referencias/qualidade'
import { separarReferenciasCitadas } from '@/lib/referencias/citadas'
import { posProcessarTextoGerado } from '@/lib/ai/pos-processar'
import { dedupDocumentosPorEtapa } from '@/lib/projeto/dedup-documentos'
import { auditarReferencias, removerCitacoesDaRef } from '@/lib/revisao/auditar-referencias'
import { correcoesParaEdicoes, aplicarCorrecoesNasSecoes } from '@/lib/revisao/aplicar-correcoes'
import { aplicarEdicoes, parseEdicoes, reescritaSegura } from '@/lib/ai/aplicar-edicoes'
import { extrairJsonObjeto, ReviewService } from '@/lib/ai/reviewService'
import type { ReviewParams, ReviewResult, ReviewOutcome } from '@/lib/ai/reviewService'
import { rankSecaoDocumento } from '@/lib/tipos/ordem-documento'
import { formatarReferencia } from '@/lib/referencias/formatar'

// ── 1. Travessões e vírgula decimal ──────────────────────────────────────────
test('removerTravessoes: troca travessão "—" por vírgula', () => {
  assert.equal(removerTravessoes('A causa — sepse — é grave.'), 'A causa, sepse, é grave.')
})
test('removerTravessoes: PRESERVA vírgula decimal (204,5)', () => {
  assert.equal(removerTravessoes('média 204,5 e desvio 38,3'), 'média 204,5 e desvio 38,3')
})
test('removerTravessoes: adiciona espaço após vírgula de lista', () => {
  assert.equal(removerTravessoes('Brasil,Alemanha,Japão'), 'Brasil, Alemanha, Japão')
})

// ── 2. Código R ──────────────────────────────────────────────────────────────
test('corrigirCodigoR: groups = "drop" → .groups = "drop"', () => {
  assert.equal(corrigirCodigoR('summarise(n=n(), groups = "drop")'), 'summarise(n=n(), .groups = "drop")')
})
test('corrigirCodigoR: não mexe em "subgroups" nem no já-correto', () => {
  assert.equal(corrigirCodigoR('os subgroups'), 'os subgroups')
  assert.equal(corrigirCodigoR('.groups = "drop"'), '.groups = "drop"')
})

// ── 3. Código Python ─────────────────────────────────────────────────────────
test('corrigirCodigoPython: instancia classe de poder do statsmodels', () => {
  assert.equal(corrigirCodigoPython('a = TTestIndPower'), 'a = TTestIndPower()')
})
test('corrigirCodigoPython: não mexe no import nem no já-instanciado', () => {
  assert.equal(corrigirCodigoPython('from statsmodels.stats.power import TTestIndPower'), 'from statsmodels.stats.power import TTestIndPower')
  assert.equal(corrigirCodigoPython('a = TTestIndPower()'), 'a = TTestIndPower()')
})

// ── 4. LaTeX matemático → texto legível ──────────────────────────────────────
test('converterMathLatex: fórmula com frac/times/grego/expoente', () => {
  const out = converterMathLatexParaTexto('n = 2 \\times \\left( \\frac{Z_{\\alpha/2} + Z_{\\beta}}{d} \\right)^2')
  assert.ok(out.includes('×'), 'tem ×')
  assert.ok(out.includes('α'), 'tem α')
  assert.ok(out.includes('²'), 'tem ²')
  assert.ok(!out.includes('\\'), 'sem barra invertida')
  assert.ok(!out.includes('frac'), 'sem frac')
})
test('converterMathLatex: PRESERVA blocos de código ```', () => {
  const codigo = 'texto ```r\nx <- gsub("\\\\.", "", y)\n``` fim'
  assert.ok(converterMathLatexParaTexto(codigo).includes('gsub("\\\\.", "", y)'))
})

// ── 5. Qualidade de referências ──────────────────────────────────────────────
test('qualidade: detecta sobrenome placeholder', () => {
  assert.equal(ehSobrenomePlaceholder('&NA;'), true)
  assert.equal(ehSobrenomePlaceholder('NA'), true)
  assert.equal(ehSobrenomePlaceholder('Anonymous'), true)
  assert.equal(ehSobrenomePlaceholder('Silva'), false)
})
test('qualidade: detecta registro não-original', () => {
  assert.equal(ehTituloDescartavel('Faculty Opinions recommendation of X'), true)
  assert.equal(ehTituloDescartavel('Erratum: Sepsis'), true)
  assert.equal(ehTituloDescartavel('Two decades of mortality trends'), false)
})
test('qualidade: ehReferenciaUtilizavel combina autor + título', () => {
  assert.equal(ehReferenciaUtilizavel({ titulo: 'X', autores: [{ nome: '', sobrenome: '&NA;' }] }), false)
  assert.equal(ehReferenciaUtilizavel({ titulo: 'Mortality trends', autores: [{ nome: 'E', sobrenome: 'Stevenson' }] }), true)
})

// ── 6. Referências citadas vs órfãs (lista final) ────────────────────────────
test('separarReferenciasCitadas: ano em contexto de citação mantém; sobrenome solto remove', () => {
  const refs = [
    { id: '1', titulo: 'A', ano: 2020, autores: [{ nome: 'J', sobrenome: 'Linares' }] },   // citada "(Linares, 2020)"
    { id: '2', titulo: 'B', ano: 2019, autores: [{ nome: 'M', sobrenome: 'Castro' }] },     // sobrenome aparece, mas sem citação
  ] as never[]
  const corpo = 'A taxa subiu (Linares, 2020). O bairro Castro fica longe e nada de 1999.'
  const { citadas, naoCitadas } = separarReferenciasCitadas(refs, corpo, 'abnt')
  assert.deepEqual(citadas.map(r => (r as { id: string }).id), ['1'])
  assert.deepEqual(naoCitadas.map(r => (r as { id: string }).id), ['2'])
})
test('separarReferenciasCitadas: citação narrativa "Sobrenome et al. (ANO)" conta como citada', () => {
  const refs = [{ id: '1', titulo: 'A', ano: 2021, autores: [{ nome: 'R', sobrenome: 'Mendes' }] }] as never[]
  const corpo = 'Mendes et al. (2021) demonstraram o efeito.'
  assert.equal(separarReferenciasCitadas(refs, corpo, 'abnt').citadas.length, 1)
})
test('formatarReferencia: capítulo de livro usa título do livro, não a editora', () => {
  const ref = {
    id: '1', trabalho_id: 't', tipo: 'capitulo_livro',
    titulo: 'O capítulo sobre sepse', journal: 'Manual de Medicina Intensiva', editora: 'Editora Atheneu',
    cidade: 'São Paulo', ano: 2019, paginas: '10-25',
    autores: [{ nome: 'J', sobrenome: 'Silva' }], dados_extras: {}, confiabilidade: 'alta', created_at: '',
    referencia_formatada_abnt: '', referencia_formatada_vancouver: '', referencia_formatada_apa: '',
  } as never
  const abnt = formatarReferencia(ref, 'abnt')
  assert.ok(abnt.includes('Manual de Medicina Intensiva'), `tem o título do livro: ${abnt}`)
  assert.ok(abnt.includes('In:'), 'tem "In:"')
})
test('separarReferenciasCitadas (ABNT): remove órfã, mantém citada', () => {
  const refs = [
    { id: '1', titulo: 'A', ano: 2020, autores: [{ nome: 'J', sobrenome: 'Linares' }] },
    { id: '2', titulo: 'B', ano: 1961, autores: [{ nome: 'P', sobrenome: 'Bulfin' }] },
  ] as never[]
  const corpo = 'Segundo Linares (2020), a taxa subiu.'
  const { citadas, naoCitadas } = separarReferenciasCitadas(refs, corpo, 'abnt')
  assert.equal(citadas.length, 1)
  assert.equal((citadas[0] as { id: string }).id, '1')
  assert.equal((naoCitadas[0] as { id: string }).id, '2')
})
test('separarReferenciasCitadas: exclui referência sem autor real da lista', () => {
  const refs = [{ id: '1', titulo: 'X', ano: 2012, autores: [{ nome: '', sobrenome: '&NA;' }] }] as never[]
  const { citadas } = separarReferenciasCitadas(refs, '(&NA;, 2012)', 'abnt')
  assert.equal(citadas.length, 0)
})

// ── 7. Resolução de citações (anti-fabricação + não comer palavras) ──────────
test('validarCitacoesReais: NÃO atribui referência a menção de software (R)', () => {
  const refs = [{ id: '1', titulo: 'Infant mortality', ano: 1984, autores: [{ nome: 'T', sobrenome: 'Yamada' }] }] as never[]
  const out = validarCitacoesReais('As análises foram feitas no software R (SOBRENOME, ANO).', refs, 'abnt')
  assert.ok(!out.includes('YAMADA'), 'não fabrica YAMADA para o R')
  assert.ok(!out.includes('SOBRENOME'), 'remove o placeholder do R')
})
test('validarCitacoesReais: sobrenome hifenizado não é fundido (Rangel-Frausto)', () => {
  const refs = [
    { id: '1', titulo: 'Natural history of the systemic inflammatory response syndrome', ano: 1995, autores: [{ nome: 'M', sobrenome: 'Rangel-Frausto' }] },
    { id: '2', titulo: 'Sepsis modeling', ano: 2019, autores: [{ nome: 'S', sobrenome: 'Lobo' }] },
  ] as never[]
  const out = validarCitacoesReais('Rangel-Frausto et al. (1995) descreveram a SIRS.', refs, 'abnt')
  assert.ok(!out.includes('Rangel-('), 'não funde "Rangel-(...)"')
  assert.ok(out.includes('Rangel-Frausto'), 'mantém o sobrenome hifenizado inteiro')
})
test('validarCitacoesReais: NÃO apaga palavra real antes do placeholder (Nordeste)', () => {
  const refs = [{ id: '1', titulo: 'Subnotificação no Norte e Nordeste', ano: 2020, autores: [{ nome: 'M', sobrenome: 'Linares' }] }] as never[]
  const out = validarCitacoesReais('Maior no Norte e Nordeste (SOBRENOME, ANO).', refs, 'abnt')
  assert.ok(out.includes('Nordeste'), 'preserva "Nordeste"')
})

// ── 8. Rede de segurança de placeholder ──────────────────────────────────────
test('removerPlaceholdersCitacaoResiduais: nenhum (SOBRENOME, ANO) visível', () => {
  assert.ok(!removerPlaceholdersCitacaoResiduais('A taxa subiu (SOBRENOME, ANO).').includes('SOBRENOME'))
})

// ── 9. HTML de impressão (markdown acadêmico) ────────────────────────────────
test('markdownAcademicoParaHtml: *itálico* vira <em> (sem asterisco)', () => {
  const html = markdownAcademicoParaHtml('*Nota prática:* importante')
  assert.ok(html.includes('<em>Nota prática:</em>'))
})
test('markdownAcademicoParaHtml: --- NÃO vira régua (ABNT sem hr no corpo)', () => {
  const html = markdownAcademicoParaHtml('Linha A\n\n---\n\nLinha B')
  assert.ok(!html.includes('<hr'), 'sem <hr>')
})
test('markdownAcademicoParaHtml: bloco ``` vira <pre> sem crases', () => {
  const html = markdownAcademicoParaHtml('```\nx <- 1\n```')
  assert.ok(html.includes('<pre'), 'tem <pre>')
  assert.ok(!html.includes('```'), 'sem crases literais')
})
test('markdownAcademicoParaHtml: tabela mantém TODAS as colunas (Valor-p)', () => {
  const html = markdownAcademicoParaHtml('| Var | Valor-p |\n|---|---|\n| idade | 0,03 |')
  assert.ok(html.includes('Valor-p'), 'cabeçalho Valor-p')
  assert.ok(html.includes('0,03'), 'valor da última coluna')
})

// ── 10. Dedup de documentos por etapa (nunca duas etapas o mesmo doc) ────────
test('dedupDocumentosPorEtapa: tipo de documento aparece em UMA só etapa', () => {
  const mapa = dedupDocumentosPorEtapa([
    { id: 'e1', docs: [{ tipo: 'instrumento_coleta' }, { tipo: 'calculo_amostral' }] },
    { id: 'e2', docs: [{ tipo: 'instrumento_coleta' }, { tipo: 'calculo_amostral' }, { tipo: 'guia_coleta' }] },
  ])
  assert.deepEqual((mapa.get('e1') ?? []).map(d => d.tipo), ['instrumento_coleta', 'calculo_amostral'])
  // e2 NÃO repete os que e1 já reivindicou — só sobra o novo (guia_coleta)
  assert.deepEqual((mapa.get('e2') ?? []).map(d => d.tipo), ['guia_coleta'])
})
test('dedupDocumentosPorEtapa: primeira etapa na ordem fica com o tipo', () => {
  const mapa = dedupDocumentosPorEtapa([
    { id: 'a', docs: [{ tipo: 'revisao_literatura' }] },
    { id: 'b', docs: [{ tipo: 'revisao_literatura' }] },
  ])
  assert.equal((mapa.get('a') ?? []).length, 1)
  assert.equal((mapa.get('b') ?? []).length, 0)
})

// ── 11. Revisor de Consistência (auditoria + remoção segura) ─────────────────
test('auditarReferencias: detecta órfã, sem-autor, não-original e ano recente', () => {
  const refs = [
    { id: '1', titulo: 'Sepse no Brasil', ano: 2020, autores: [{ nome: 'J', sobrenome: 'Linares' }] },           // citada, ok
    { id: '2', titulo: 'Hemodiálise', ano: 1994, autores: [{ nome: 'P', sobrenome: 'Lundin' }] },                 // órfã
    { id: '3', titulo: 'X', ano: 2012, autores: [{ nome: '', sobrenome: '&NA;' }] },                              // sem autor
    { id: '4', titulo: 'Erratum: algo', ano: 2018, autores: [{ nome: 'A', sobrenome: 'Costa' }] },               // não-original
    { id: '5', titulo: 'Estudo novo', ano: 2026, autores: [{ nome: 'B', sobrenome: 'Torres' }] },                // ano recente (citada)
  ] as never[]
  const corpo = 'Segundo Linares (2020), a taxa subiu. Conforme Torres (2026), há tendência.'
  const issues = auditarReferencias(refs, corpo, 'abnt', 2026)
  const porId = Object.fromEntries(issues.map(i => [i.referenciaId, i.tipo]))
  assert.equal(porId['2'], 'NAO_CITADA')
  assert.equal(porId['3'], 'SEM_AUTOR_REAL')
  assert.equal(porId['4'], 'REGISTRO_NAO_ORIGINAL')
  assert.equal(porId['5'], 'ANO_NAO_VERIFICAVEL')
  assert.equal(porId['1'], undefined, 'referência citada e válida não vira issue')
})
test('removerCitacoesDaRef: remove citação parentética solo sem quebrar a frase', () => {
  const ref = { id: '1', titulo: 'X', ano: 2019, autores: [{ nome: 'P', sobrenome: 'Bulfin' }] } as never
  const { texto, restaramManuais } = removerCitacoesDaRef('A taxa caiu no período (Bulfin, 2019). Fim.', ref, 'abnt')
  assert.equal(texto, 'A taxa caiu no período. Fim.')
  assert.equal(restaramManuais, false)
})
test('removerCitacoesDaRef: citação narrativa NÃO é removida (sinaliza manual)', () => {
  const ref = { id: '1', titulo: 'X', ano: 2019, autores: [{ nome: 'P', sobrenome: 'Bulfin' }] } as never
  const { texto, restaramManuais } = removerCitacoesDaRef('Bulfin (2019) demonstrou a queda.', ref, 'abnt')
  assert.ok(texto.includes('Bulfin (2019)'), 'não remove citação narrativa automaticamente')
  assert.equal(restaramManuais, true)
})

// ── 12. Ordem do documento + autor coletivo ──────────────────────────────────
test('rankSecaoDocumento: resultados_esperados vem ANTES de cronograma/orçamento', () => {
  assert.ok(rankSecaoDocumento('resultados_esperados') < rankSecaoDocumento('cronograma'))
  assert.ok(rankSecaoDocumento('resultados_esperados') < rankSecaoDocumento('orcamento'))
  assert.ok(rankSecaoDocumento('metodologia') < rankSecaoDocumento('resultados_esperados'), 'depois do miolo')
})
test('formatarReferencia: autor coletivo (WHO) não gera ", ." em APA/Vancouver', () => {
  const ref = {
    id: '1', trabalho_id: 't', tipo: 'artigo', titulo: 'Global report on sepsis',
    autores: [{ nome: '', sobrenome: 'World Health Organization' }], ano: 2020,
    dados_extras: {}, confiabilidade: 'alta', created_at: '',
    referencia_formatada_abnt: '', referencia_formatada_vancouver: '', referencia_formatada_apa: '',
  } as never
  const apa = formatarReferencia(ref, 'apa')
  const van = formatarReferencia(ref, 'vancouver', 1)
  assert.ok(!apa.includes(', .'), `APA sem ", .": ${apa}`)
  assert.ok(apa.includes('World Health Organization'), 'APA mantém o nome da entidade')
  assert.ok(!/World Health Organization\s+\./.test(van), `Vancouver sem nome+ponto solto: ${van}`)
})

// ── 13. Edições cirúrgicas do "Aplicar com IA" (match robusto) ───────────────
test('aplicarEdicoes: match exato substitui o trecho', () => {
  const { texto, aplicadas } = aplicarEdicoes('A taxa subiu muito no período.', [{ buscar: 'subiu muito', substituir: 'aumentou' }])
  assert.equal(aplicadas, 1)
  assert.equal(texto, 'A taxa aumentou no período.')
})
test('aplicarEdicoes: match TOLERANTE a espaços/quebras (o que antes falhava)', () => {
  // No texto a frase tem quebra de linha; o "buscar" do modelo vem com espaço.
  const texto = 'Os achados indicam\nalta mortalidade por sepse no Brasil.'
  const { texto: out, aplicadas } = aplicarEdicoes(texto, [
    { buscar: 'Os achados indicam alta mortalidade por sepse no Brasil.', substituir: 'A busca cobriu o período de 2010 a 2024.' },
  ])
  assert.equal(aplicadas, 1)
  assert.ok(out.includes('A busca cobriu o período'))
  assert.ok(!out.includes('mortalidade'))
})
test('aplicarEdicoes: remoção (substituir vazio) limpa pontuação', () => {
  const { texto, aplicadas } = aplicarEdicoes('Resultado importante. Nossa interpretação sugere algo. Fim.', [
    { buscar: 'Nossa interpretação sugere algo. ', substituir: '' },
  ])
  assert.equal(aplicadas, 1)
  assert.equal(texto, 'Resultado importante. Fim.')
})
test('aplicarEdicoes: NÃO mexe em linha de tabela', () => {
  const { aplicadas } = aplicarEdicoes('| col | valor |', [{ buscar: '| col | valor |', substituir: '| x | y |' }])
  assert.equal(aplicadas, 0)
})
test('parseEdicoes: lê JSON com cercas ```json', () => {
  const eds = parseEdicoes('```json\n{"edicoes":[{"buscar":"a","substituir":"b"}]}\n```')
  assert.equal(eds.length, 1)
  assert.equal(eds[0].buscar, 'a')
})
test('reescritaSegura: rejeita reescrita que PERDE citação (anti-piora)', () => {
  const orig = 'A taxa subiu (SILVA, 2020) e caiu (COSTA, 2019).'
  const ruim = 'A taxa variou ao longo do tempo conforme a literatura.'   // perdeu as 2 citações
  assert.equal(reescritaSegura(orig, ruim).ok, false)
})
test('reescritaSegura: rejeita texto idêntico ou vazio', () => {
  assert.equal(reescritaSegura('texto', 'texto').ok, false)
  assert.equal(reescritaSegura('texto', '   ').ok, false)
})
test('reescritaSegura: aceita correção que preserva citações', () => {
  const orig = 'A taxa subiu muito (SILVA, 2020).'
  const bom = 'A taxa aumentou de forma expressiva (SILVA, 2020).'
  assert.equal(reescritaSegura(orig, bom).ok, true)
})
test('reescritaSegura: aceita REMOÇÃO legítima (encolher sem perder citação)', () => {
  const orig = 'Resultado relevante. Nossa interpretação sugere algo. Fim (SILVA, 2020).'
  const bom = 'Resultado relevante. Fim (SILVA, 2020).'
  assert.equal(reescritaSegura(orig, bom).ok, true)
})

// ── 13b. Aplicação das correções da revisão nas seções ──────────────────────
test('aplicarCorrecoesNasSecoes: aplica trecho→correcao na seção certa e salva', () => {
  const secoes = [
    { chave_secao: 'introducao', conteudo: 'A sepse é grave. Texto solto demais aqui.' },
    { chave_secao: 'metodo', conteudo: 'Buscamos em bases (SILVA, 2020).' },
  ]
  const edicoes = correcoesParaEdicoes([
    { trecho: 'Texto solto demais aqui.', correcao: 'A mortalidade é elevada.' }, // intro
  ])
  const r = aplicarCorrecoesNasSecoes(secoes, edicoes)
  assert.equal(r.secoesAfetadas, 1)
  assert.equal(r.atualizacoes[0].chave_secao, 'introducao')
  assert.ok(r.atualizacoes[0].conteudo.includes('A mortalidade é elevada.'))
})
test('aplicarCorrecoesNasSecoes: NÃO aplica correção que perderia citação (anti-piora)', () => {
  const secoes = [{ chave_secao: 'm', conteudo: 'A taxa subiu (SILVA, 2020).' }]
  const edicoes = correcoesParaEdicoes([{ trecho: 'A taxa subiu (SILVA, 2020).', correcao: 'A taxa variou.' }]) // perde citação
  const r = aplicarCorrecoesNasSecoes(secoes, edicoes)
  assert.equal(r.secoesAfetadas, 0)
})
test('aplicarCorrecoesNasSecoes: NUNCA mexe na seção resumo (JSON) — abstract não some', () => {
  const resumoJson = JSON.stringify({ resumo: 'O estudo analisou a mortalidade.', abstract: 'The study analyzed mortality.', palavras_chave: [], keywords: [] })
  const secoes = [{ chave_secao: 'resumo', conteudo: resumoJson }]
  // tenta corrigir um trecho que existe DENTRO do JSON
  const edicoes = correcoesParaEdicoes([{ trecho: 'The study analyzed mortality.', correcao: 'The study assessed mortality.' }])
  const r = aplicarCorrecoesNasSecoes(secoes, edicoes)
  assert.equal(r.secoesAfetadas, 0)            // não tocou no resumo
})
test('correcoesParaEdicoes: ignora trecho curto/ausente (não auto-aplicável)', () => {
  const eds = correcoesParaEdicoes([{ trecho: '', correcao: 'x' }, { trecho: 'ab', correcao: 'y' }, { trecho: 'frase válida', correcao: 'z' }])
  assert.equal(eds.length, 1)
  assert.equal(eds[0].buscar, 'frase válida')
})

// ── 14. Revisor iterativo por IA (parsing + loop, sem chamar API) ────────────
test('extrairJsonObjeto: extrai JSON mesmo com ```json e texto ao redor', () => {
  const resp = 'Claro!\n```json\n{"nota_estimada": 85, "obj": {"a": "}"}}\n```\nfim'
  const j = extrairJsonObjeto(resp) as { nota_estimada: number; obj: { a: string } }
  assert.equal(j.nota_estimada, 85)
  assert.equal(j.obj.a, '}') // chave dentro de string não confunde o parser
})
test('extrairJsonObjeto: retorna null quando não há JSON', () => {
  assert.equal(extrairJsonObjeto('sem json aqui'), null)
})

function fakeResult(nota: number, versao: string): ReviewResult {
  return {
    nota_estimada: nota, status: nota >= 80 ? 'aprovado' : 'precisa_corrigir', resumo_geral: '',
    checklist: { coerencia_objetivos: true, linguagem_adequada: true, estrutura_completa: true, citacoes_com_suporte: true, referencias_verificadas: true, sem_contradicoes: true },
    problemas_encontrados: [], referencias_suspeitas: [], precisa_nova_iteracao: nota < 80, motivo_nova_iteracao: '', versao_corrigida: versao,
  }
}
// Subclasse que NÃO chama a API: devolve notas pré-definidas por chamada de analyze.
class FakeReview extends ReviewService {
  private idx = 0
  constructor(private notas: number[]) { super() }
  override analyze(): Promise<ReviewOutcome<ReviewResult>> {
    const nota = this.notas[Math.min(this.idx, this.notas.length - 1)]
    return Promise.resolve({ ok: true, data: fakeResult(nota, '') })
  }
  override analyzeAndCorrect(p: ReviewParams): Promise<ReviewOutcome<ReviewResult>> {
    this.idx++
    return Promise.resolve({ ok: true, data: fakeResult(70, `${p.trabalho} [v${this.idx}]`) })
  }
  // Não chama a API de humanização nos testes — apenas marca que foi aplicada.
  protected override humanizarVersaoFinal(t: string): Promise<string> {
    return Promise.resolve(`${t} [hum]`)
  }
}
const REVIEW_PARAMS: ReviewParams = { trabalho: 'orig', tipo: 'artigo', tema: 't', area: 'a', normas: 'ABNT', idioma: 'pt-BR' }

test('runIterativeReview: para na nota mínima (80) e re-humaniza a versão final', async () => {
  const out = await new FakeReview([60, 92]).runIterativeReview(REVIEW_PARAMS)
  assert.ok(out.ok)
  if (out.ok) {
    assert.equal(out.data.iteracoes, 1)                       // 1 correção aplicada
    assert.equal(out.data.versaoFinal, 'orig [v1] [hum]')     // corrigido E humanizado
  }
})
test('runIterativeReview: respeita o teto de iterações (3) se a nota nunca sobe', async () => {
  const out = await new FakeReview([50, 50, 50, 50, 50]).runIterativeReview(REVIEW_PARAMS)
  assert.ok(out.ok)
  if (out.ok) assert.equal(out.data.iteracoes, 3)     // não passa de REVIEW_MAX_ITERATIONS
})
test('runIterativeReview: correção sem mudança real NÃO conta iteração (nota baixa travada)', async () => {
  // Simula o caso reportado: modelo devolve versao_corrigida IGUAL ao texto.
  class FakeSemMudanca extends ReviewService {
    override analyze(): Promise<ReviewOutcome<ReviewResult>> {
      return Promise.resolve({ ok: true, data: fakeResult(25, '') })
    }
    override analyzeAndCorrect(p: ReviewParams): Promise<ReviewOutcome<ReviewResult>> {
      return Promise.resolve({ ok: true, data: fakeResult(25, p.trabalho) }) // corrigida === original
    }
    protected override humanizarVersaoFinal(t: string): Promise<string> { return Promise.resolve(`${t} [hum]`) }
  }
  const out = await new FakeSemMudanca().runIterativeReview(REVIEW_PARAMS)
  assert.ok(out.ok)
  if (out.ok) {
    assert.equal(out.data.iteracoes, 0)            // não fingiu iterações
    assert.equal(out.data.versaoFinal, 'orig')     // sem mudança, sem humanização
  }
})
test('runIterativeReview: nota alta de cara não corrige nada', async () => {
  const out = await new FakeReview([95]).runIterativeReview(REVIEW_PARAMS)
  assert.ok(out.ok)
  if (out.ok) { assert.equal(out.data.iteracoes, 0); assert.equal(out.data.versaoFinal, 'orig') }
})

// ── 14. Integração: pós-processamento completo ───────────────────────────────
test('posProcessarTextoGerado: aplica TODAS as camadas de uma vez', () => {
  const refs = [] as never[]
  const entrada = 'Resultado — média 204,5. summarise(groups = "drop"). a = TTestIndPower. \\(d^2\\). Falta (SOBRENOME, ANO).'
  const out = posProcessarTextoGerado(entrada, refs, 'abnt')
  assert.ok(!out.includes('—'), 'sem travessão')
  assert.ok(out.includes('204,5'), 'decimal preservado')
  assert.ok(out.includes('.groups = "drop"'), 'R corrigido')
  assert.ok(out.includes('TTestIndPower()'), 'Python corrigido')
  assert.ok(!out.includes('\\('), 'LaTeX convertido')
  assert.ok(!out.includes('SOBRENOME'), 'placeholder removido')
})
