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

// ── 11. Integração: pós-processamento completo ───────────────────────────────
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
