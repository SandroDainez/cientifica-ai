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
import { ehSobrenomePlaceholder, ehTituloDescartavel, ehReferenciaUtilizavel, ehFonteFraca } from '@/lib/referencias/qualidade'
import { separarReferenciasCitadas } from '@/lib/referencias/citadas'
import { posProcessarTextoGerado } from '@/lib/ai/pos-processar'
import { dedupDocumentosPorEtapa } from '@/lib/projeto/dedup-documentos'
import { auditarReferencias, removerCitacoesDaRef } from '@/lib/revisao/auditar-referencias'
import { correcoesParaEdicoes, aplicarCorrecoesNasSecoes } from '@/lib/revisao/aplicar-correcoes'
import { aplicarEdicoes, parseEdicoes, reescritaSegura, edicaoSeguraCirurgica, revisaoProfundaSegura } from '@/lib/ai/aplicar-edicoes'
import { extrairJsonObjeto, ReviewService, parseEdicoesRevisao, buildRevisaoProfundaPrompt, REVIEW_INPUT_CHAR_LIMIT } from '@/lib/ai/reviewService'
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from '@/lib/ai/reviewPrompt'
import { buildCoerenciaGlobalPrompt } from '@/lib/ai/reviewService'
import { ehSecaoEnquadramento, parseAjustesCoerencia } from '@/lib/revisao/coerencia'
import { acharRefPorCitacao, removerEntradaDeCitacoes, extrairSobrenomeAno, renumerarVancouverRemovendo } from '@/lib/revisao/sanear-refs'
import { compilarSecaoReferencias } from '@/lib/referencias/compilar-secao'
import { renumerarSubsecoes } from '@/lib/formatacao/subsecoes'
import { detectarRefsOutroAssunto } from '@/lib/referencias/off-topic'
import { verificarNumerosSemSuporte } from '@/lib/revisao/verificar-suporte'
import { filtrarApontamentos, ehFalsoPositivoFormatacaoReferencia, ehFalsoPositivoDataAtual, trechoExisteNoTexto, ehPreferenciaEstilo } from '@/lib/revisao/filtrar-apontamentos'
import { buildAlinharResumoPrompt } from '@/lib/ai/reviewService'
import { temNumeroFabricado, alinhamentoResumoSeguro } from '@/lib/resumo/alinhar'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { normalizarTermos, resumirAbstract, pontuarRelevancia, selecionarFontesRelevantes, montarFontesParaRevisao } from '@/lib/referencias/dossie'
import { formatarRefsParaPrompt, buildInstrucaoCitacaoReferencias, buildGerarSecaoPrompt, buildOutlineSecaoPrompt } from '@/lib/ai/prompts'
import { protegerConteudoResumo } from '@/lib/resumo/proteger'
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
test('CONTRATO resumo: alinhamento ao corpo é PURO e proíbe inventar', () => {
  const { sys, user } = buildAlinharResumoPrompt({ resumoPt: 'compara com Alemanha', abstractEn: 'compares with Germany', corpo: 'O trabalho compara o Brasil com a Inglaterra.', tipo: 'artigo', tema: 'sepse' })
  assert.match(sys, /NUNCA invente/i)
  assert.match(sys, /CORPO/)                       // o corpo é a verdade
  assert.match(user, /Inglaterra/)                 // injeta o corpo real
  assert.match(sys, /resumo.*portugu[eê]s|portugu[eê]s/i)
})
test('CONTRATO resumo: trava anti-fabricação e anti-colapso', () => {
  const corpo = 'Mortalidade média de 40%, chegando a 55% no Norte.'
  // número novo (90%) que não está no corpo → fabricado.
  assert.equal(temNumeroFabricado('A taxa é de 90%.', corpo), true)
  assert.equal(temNumeroFabricado('A taxa média é 40% e o pico 55%.', corpo), false)
  // colapso: candidato com menos de 50% do tamanho → reprova.
  assert.equal(alinhamentoResumoSeguro('a'.repeat(200), 'curto', corpo).aceitar, false)
  // vazio reprova.
  assert.equal(alinhamentoResumoSeguro('texto original longo aqui', '', corpo).aceitar, false)
  // ok: tamanho parecido, sem número novo.
  const orig = 'Estudo sobre mortalidade por sepse no Brasil, com média de 40%.'
  const cand = 'Estudo sobre mortalidade por sepse no Brasil, com média de 40% nacional.'
  assert.equal(alinhamentoResumoSeguro(orig, cand, `${orig}\n${corpo}`).aceitar, true)
})
test('CONTRATO apontamentos: descarta preferência de estilo (frase longa / troca de palavra) mas mantém erro real', () => {
  // PROIBIDO pela calibração: frase longa e troca de palavra por gosto.
  assert.equal(ehPreferenciaEstilo({ categoria: 'linguagem', problema: 'Período muito longo com múltiplas subordinadas, prejudicando a clareza', sugestao: 'Dividir em duas frases' }), true)
  assert.equal(ehPreferenciaEstilo({ categoria: 'linguagem', problema: "Uso impreciso de 'pontuais' - seria mais adequado 'específicas'", sugestao: 'Substituir por termo mais preciso' }), true)
  // Família "poderia ser mais específico/detalhado" disfarçada de genérica/vaga.
  assert.equal(ehPreferenciaEstilo({ categoria: 'linguagem', problema: 'Frase genérica que não adiciona informação específica', sugestao: 'Remover ou especificar melhor' }), true)
  assert.equal(ehPreferenciaEstilo({ categoria: 'linguagem', problema: "Afirmação muito genérica sobre 'literatura fragmentada'", sugestao: 'Ser mais específico sobre as lacunas' }), true)
  // Afirmação SEM SUPORTE é erro real (pede citação) → NÃO descarta.
  assert.equal(ehPreferenciaEstilo({ categoria: 'linguagem', problema: 'Afirmação genérica sem suporte de fonte', sugestao: 'Adicionar citação' }), false)
  // REAL: repetição, redundância, concordância, ortografia → NÃO descarta.
  assert.equal(ehPreferenciaEstilo({ categoria: 'linguagem', problema: "Repetição da expressão 'A literatura demonstra'", sugestao: 'Variar' }), false)
  assert.equal(ehPreferenciaEstilo({ categoria: 'linguagem', problema: 'Concordância verbal incorreta', sugestao: 'Corrigir' }), false)
  assert.equal(ehPreferenciaEstilo({ categoria: 'linguagem', problema: 'Erro de ortografia em "analise"', sugestao: 'acentuar' }), false)
  // Só categoria linguagem é afetada.
  assert.equal(ehPreferenciaEstilo({ categoria: 'citacao', problema: 'frase muito longa', sugestao: 'dividir' }), false)
})
test('CONTRATO apontamentos: descarta trecho que NÃO existe no texto (citação errada/alucinada do revisor)', () => {
  const texto = 'A mortalidade por sepse no Brasil mantém-se estagnada há décadas em patamares elevados. As regiões Norte e Nordeste concentram os piores indicadores.'
  // Revisor citou "as desigualdades... mantém-se estagnada" — NÃO existe (o texto diz "a mortalidade"): incorrigível.
  const fantasma = { categoria: 'linguagem', problema: 'Concordância verbal incorreta', trecho: 'as desigualdades na mortalidade por sepse no Brasil mantém-se estagnada', sugestao: 'corrigir' }
  assert.equal(trechoExisteNoTexto(fantasma.trecho, texto), false)
  // Trecho que EXISTE (tolerante a caixa/aspas) — mantém.
  const real = { categoria: 'linguagem', problema: 'Repetição', trecho: 'As regiões Norte e Nordeste concentram os piores indicadores', sugestao: 'variar' }
  assert.equal(trechoExisteNoTexto(real.trecho, texto), true)
  // O filtro com o texto descarta o fantasma e mantém o real.
  const filtrados = filtrarApontamentos([fantasma, real], texto)
  assert.equal(filtrados.length, 1)
  assert.equal(filtrados[0].problema, 'Repetição')
  // SEM o texto (compat.), não valida trecho — mantém os dois.
  assert.equal(filtrarApontamentos([fantasma, real]).length, 2)
})
test('CONTRATO apontamentos: descarta "data atual marcada como inconsistência" mas mantém mismatch real', () => {
  // FALSO-POSITIVO: trabalho cita a data atual e o revisor reclama "mas estamos em 2026".
  const fp = { categoria: 'coerencia', problema: 'Inconsistência temporal: o trabalho menciona busca em junho de 2026, mas estamos em 2026', trecho: 'A busca foi realizada em junho de 2026 nas bases PubMed.' }
  assert.equal(ehFalsoPositivoDataAtual(fp, 2026), true)
  // REAL: duas seções com datas diferentes — NÃO suprime (problema não diz "estamos em 2026").
  const real = { categoria: 'coerencia', problema: 'Inconsistência temporal: na metodologia afirma busca em 2026, no resumo em março de 2024', trecho: 'A busca foi realizada em março de 2024 nas bases PubMed.' }
  assert.equal(ehFalsoPositivoDataAtual(real, 2026), false)
  // REAL: data futura (posterior ao ano atual) — NÃO suprime.
  const futuro = { categoria: 'coerencia', problema: 'Inconsistência temporal: estudo conduzido em 2027, mas estamos em 2026', trecho: 'O estudo foi conduzido em 2027.' }
  assert.equal(ehFalsoPositivoDataAtual(futuro, 2026), false)
  // O filtro geral remove o falso-positivo e mantém o real.
  assert.equal(filtrarApontamentos([fp, real]).length, 1)
})
test('CONTRATO apontamentos: descarta falso-positivo de negrito na lista de referências', () => {
  // O título do periódico em negrito é destaque OBRIGATÓRIO da ABNT — não é erro.
  const refFmt = { categoria: 'formatacao', problema: 'Formatação inconsistente do título da revista (negrito desnecessário)', trecho: '**Critical Care**, v. 16, n. S3, 2012.', sugestao: 'Remover negrito do título da revista' }
  assert.equal(ehFalsoPositivoFormatacaoReferencia(refFmt), true)
  // Reclamação textual de negrito em revista, mesmo sem o trecho com **.
  assert.equal(ehFalsoPositivoFormatacaoReferencia({ categoria: 'formatacao', problema: 'negrito desnecessário no título da revista', trecho: 'IJID Regions, 2025.' }), true)
  // NÃO descarta erro de formatação real fora de referência.
  assert.equal(ehFalsoPositivoFormatacaoReferencia({ categoria: 'formatacao', problema: 'Espaço duplo antes do ponto', trecho: 'A sepse  é grave .' }), false)
  // NÃO mexe em problemas de outras categorias (citação/coerência continuam).
  assert.equal(ehFalsoPositivoFormatacaoReferencia({ categoria: 'citacao', problema: 'Afirmação sem suporte', trecho: 'A taxa é de 90%.' }), false)
  const lista = [refFmt, { categoria: 'citacao', problema: 'X', trecho: 'Y' }]
  assert.equal(filtrarApontamentos(lista).length, 1)
  assert.equal(filtrarApontamentos(lista)[0].categoria, 'citacao')
})
test('CONTRATO bibliografia: compilarSecaoReferencias com corpo lista SÓ as citadas (sem órfã "não citada no texto")', () => {
  const refs = [
    { id: '1', titulo: 'A', ano: 2020, autores: [{ nome: 'J', sobrenome: 'Linares' }] },  // citada
    { id: '2', titulo: 'B', ano: 2019, autores: [{ nome: 'M', sobrenome: 'Castro' }] },    // citação foi removida do corpo → órfã
  ] as never[]
  const corpo = 'Segundo Linares (2020), a taxa subiu.'   // só Linares é citado
  const bib = compilarSecaoReferencias(refs, 'abnt', corpo)
  assert.ok(bib.includes('LINARES') || bib.includes('Linares'), 'mantém a ref citada')
  assert.ok(!bib.toUpperCase().includes('CASTRO'), `NÃO lista a ref não citada: ${bib}`)
  // Rede de segurança: sem corpo, comporta-se como antes (lista todas as citáveis).
  const semCorpo = compilarSecaoReferencias(refs, 'abnt')
  assert.ok(semCorpo.toUpperCase().includes('CASTRO'), 'sem corpo, não filtra por citação')
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
test('aplicarCorrecoesNasSecoes: APLICA remoção de citação errada/repetida (correção legítima)', () => {
  // A revisão manda tirar CALENTE da citação. Remover é legítimo → DEVE aplicar.
  // (Antes a trava de seção revertia tudo por "perder citação" — era o bug.)
  const secoes = [{ chave_secao: 'm', conteudo: 'A sepse evolui para disfunção orgânica (CALENTE, 2025; HEDJAL, 2023). Segue o texto.' }]
  const edicoes = correcoesParaEdicoes([{ trecho: '(CALENTE, 2025; HEDJAL, 2023)', correcao: '(HEDJAL, 2023)' }])
  const r = aplicarCorrecoesNasSecoes(secoes, edicoes)
  assert.equal(r.secoesAfetadas, 1)
  assert.ok(r.atualizacoes[0].conteudo.includes('(HEDJAL, 2023)'))
  assert.ok(!r.atualizacoes[0].conteudo.includes('CALENTE'))
})
test('aplicarCorrecoesNasSecoes: BLOQUEIA correção que INVENTA citação (anti-fabricação)', () => {
  const secoes = [{ chave_secao: 'm', conteudo: 'A taxa variou bastante no período estudado.' }]
  const edicoes = correcoesParaEdicoes([{ trecho: 'A taxa variou bastante no período estudado.', correcao: 'A taxa variou bastante no período estudado (SILVA, 2021).' }])
  const r = aplicarCorrecoesNasSecoes(secoes, edicoes)
  assert.equal(r.secoesAfetadas, 0)   // introduzir citação inexistente é bloqueado
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

// ── 13b. Revisão avançada: parse das edições cirúrgicas (corrigir seção) ──────
test('parseEdicoesRevisao: extrai edições válidas de JSON com cercas ```json', () => {
  const conteudo = '```json\n{"edicoes":[{"buscar":"texto antigo","substituir":"texto novo"}]}\n```'
  const out = parseEdicoesRevisao(conteudo)
  assert.equal(out.length, 1)
  assert.equal(out[0].buscar, 'texto antigo')
  assert.equal(out[0].substituir, 'texto novo')
})
test('parseEdicoesRevisao: aceita "substituir" vazio (remoção de trecho)', () => {
  const out = parseEdicoesRevisao('{"edicoes":[{"buscar":"Faculty Opinions","substituir":""}]}')
  assert.equal(out.length, 1)
  assert.equal(out[0].substituir, '')
})
test('parseEdicoesRevisao: rejeita buscar curto (<3) e substituir idêntico', () => {
  const out = parseEdicoesRevisao('{"edicoes":[{"buscar":"ab","substituir":"xy"},{"buscar":"igual","substituir":"igual"}]}')
  assert.equal(out.length, 0)
})
test('parseEdicoesRevisao: tolera lixo / JSON inválido / campos errados sem quebrar', () => {
  assert.deepEqual(parseEdicoesRevisao(''), [])
  assert.deepEqual(parseEdicoesRevisao('sem json aqui'), [])
  assert.deepEqual(parseEdicoesRevisao('{"edicoes":"nao-array"}'), [])
  assert.deepEqual(parseEdicoesRevisao('{"edicoes":[{"buscar":123,"substituir":"x"}]}'), [])
})
test('parseEdicoesRevisao + aplicarEdicoes: edição segura aplica de fato', () => {
  const original = 'O resultado foi de média 204 segundo Faculty Opinions e colaboradores.'
  const edicoes = correcoesParaEdicoes(
    parseEdicoesRevisao('{"edicoes":[{"buscar":"segundo Faculty Opinions e colaboradores","substituir":"conforme os dados coletados"}]}')
      .map(e => ({ trecho: e.buscar, correcao: e.substituir }))
  )
  const { texto, aplicadas } = aplicarEdicoes(original, edicoes)
  assert.equal(aplicadas, 1)
  assert.ok(!texto.includes('Faculty Opinions'))
  assert.ok(reescritaSegura(original, texto).ok)
})

// ── 13c. Revisão avançada: trava anti-fabricação por edição (corrigir) ────────
test('edicaoSeguraCirurgica: PERMITE remover citação ruim (substituir vazio)', () => {
  // Caso real do bug: a correção certa é REMOVER "(Faculty Opinions, 2026)".
  const r = edicaoSeguraCirurgica(' segundo Faculty Opinions (2026)', '')
  assert.ok(r.ok, r.motivo)
})
test('edicaoSeguraCirurgica: PERMITE troca que reduz citação (reescritaSegura bloquearia)', () => {
  const buscar = 'conforme YAMADA (2026), os dados mostram'
  const substituir = 'os dados coletados mostram'
  assert.ok(edicaoSeguraCirurgica(buscar, substituir).ok)          // trava cirúrgica: ok
  assert.ok(!reescritaSegura(buscar, substituir).ok)               // trava de reescrita: bloquearia (perdeu ano)
})
test('edicaoSeguraCirurgica: BLOQUEIA introdução de ano/citação inexistente', () => {
  assert.ok(!edicaoSeguraCirurgica('os dados mostram aumento', 'os dados mostram aumento (SILVA, 2021)').ok)
  assert.ok(!edicaoSeguraCirurgica('houve melhora significativa', 'houve melhora significativa [12]').ok)
})
test('edicaoSeguraCirurgica: BLOQUEIA substituição que infla demais (invenção)', () => {
  const r = edicaoSeguraCirurgica('a amostra foi pequena', 'a amostra foi pequena ' + 'palavra '.repeat(30))
  assert.ok(!r.ok)
})
test('edicaoSeguraCirurgica: BLOQUEIA trecho curto e troca nula', () => {
  assert.ok(!edicaoSeguraCirurgica('ab', 'cd').ok)
  assert.ok(!edicaoSeguraCirurgica('texto igual', 'texto igual').ok)
})
test('edicaoSeguraCirurgica: PERMITE correção gramatical preservando o ano', () => {
  assert.ok(edicaoSeguraCirurgica('Segundo Silva (2020) o estudo', 'Segundo Silva (2020), o estudo demonstrou').ok)
})

// ── 13d. Geração ancorada na fonte: dossiê de fontes (lê → escreve → cita) ────
const fakeRef = (id: string, titulo: string, abstract?: string) =>
  ({ id, trabalho_id: 't', tipo: 'artigo', titulo, abstract, autores: [{ nome: 'A', sobrenome: 'Autor' }],
     ano: 2020, dados_extras: {}, confiabilidade: 'alta', created_at: '' }) as unknown as import('@/types').Referencia

test('normalizarTermos: tira acento, stopword e palavra curta', () => {
  const t = normalizarTermos('A avaliação do café NÃO médico em pacientes')
  assert.ok(t.includes('avaliacao'))
  assert.ok(t.includes('medico'))
  assert.ok(t.includes('pacientes'))
  assert.ok(!t.includes('nao'))   // stopword
  assert.ok(t.includes('cafe'))   // "cafe" tem 4 letras, entra
})
test('resumirAbstract: mantém curto e corta longo em fronteira de frase', () => {
  assert.equal(resumirAbstract('Resumo curto.', 480), 'Resumo curto.')
  const longo = 'Primeira frase com conteúdo relevante. ' + 'x'.repeat(600)
  const out = resumirAbstract(longo, 480)
  assert.ok(out.length <= 481)
  assert.ok(out.endsWith('.') || out.endsWith('…'))
})
test('pontuarRelevancia: título pesa mais que abstract', () => {
  const termos = new Set(normalizarTermos('burnout enfermagem'))
  const noTitulo = pontuarRelevancia({ titulo: 'Burnout em enfermagem hospitalar', abstract: '' }, termos)
  const noAbstract = pontuarRelevancia({ titulo: 'Estudo clínico', abstract: 'sobre burnout e enfermagem' }, termos)
  assert.ok(noTitulo > noAbstract)
})
test('selecionarFontesRelevantes: só fontes COM abstract, ordenadas por relevância', () => {
  const refs = [
    fakeRef('1', 'Inteligência artificial em radiologia', 'Aplicações de IA e deep learning no diagnóstico por imagem em radiologia clínica.'),
    fakeRef('2', 'Culinária italiana', 'Receitas tradicionais de massas e molhos da Itália.'),
    fakeRef('3', 'Sem abstract sobre radiologia', undefined),  // sem abstract → fora
  ]
  const out = selecionarFontesRelevantes(refs, 'Inteligência artificial em radiologia diagnóstico', 16)
  assert.equal(out[0].id, '1')                 // o mais relevante
  assert.ok(!out.some(r => r.id === '3'))      // sem abstract não entra
  assert.ok(!out.some(r => r.id === '2'))      // fora do tema (score 0) não entra
})
test('selecionarFontesRelevantes: sem nenhum abstract → vazio (degrada p/ título)', () => {
  const refs = [fakeRef('1', 'Tema X', undefined), fakeRef('2', 'Tema Y', '')]
  assert.deepEqual(selecionarFontesRelevantes(refs, 'tema', 16), [])
})
test('CONTRATO citações: instrução exige AMPLITUDE e NÃO proíbe citar refs reais por tema', () => {
  const refs = [fakeRef('1', 'A', 'resumo um com conteúdo suficiente para passar do limiar de oitenta caracteres exigido aqui.'), fakeRef('2', 'B', undefined), fakeRef('3', 'C', undefined)]
  const instr = buildInstrucaoCitacaoReferencias(refs, 'abnt')
  assert.match(instr, /AMPL|MUITAS|diversidade|distintas/i)            // amplitude obrigatória
  assert.ok(!/proibido citar uma fonte só porque o título/i.test(instr)) // NÃO regredir ao conservadorismo
  assert.match(instr, /inventar/i)                                      // anti-fabricação preservada
})
test('CONTRATO qualidade: detecta fonte fraca (newsletter/preprint/1 página) sem rejeitar fonte boa', () => {
  assert.equal(ehFonteFraca({ journal: 'Hospitalist News' }), true)        // newsletter
  assert.equal(ehFonteFraca({ journal: 'SSRN Electronic Journal' }), true) // preprint
  assert.equal(ehFonteFraca({ journal: 'medRxiv' }), true)
  assert.equal(ehFonteFraca({ journal: 'Critical Care', paginas: '18-18' }), true) // 1 página
  assert.equal(ehFonteFraca({ journal: 'Critical Care Medicine', paginas: '76-84' }), false) // boa
  assert.equal(ehFonteFraca({ journal: 'Revista Brasileira de Terapia Intensiva' }), false)
})
test('CONTRATO suporte: flagra percentual citado que NÃO consta no resumo da fonte; não acusa quando consta nem sem resumo', () => {
  const refComNumero = { id: '1', titulo: 'Sepsis mortality', ano: 2019, autores: [{ nome: 'O', sobrenome: 'Ranzani' }], abstract: 'In this cohort, sepsis lethality was reduced to 18% after the intervention across hospitals in the region.' } as never
  const refSemNumero = { id: '2', titulo: 'Sepsis in Brazil', ano: 2014, autores: [{ nome: 'L', sobrenome: 'Taniguchi' }], abstract: 'This study analyzed sepsis-related deaths using the national registry over several years.' } as never
  const refSemAbstract = { id: '3', titulo: 'Regional disparities', ano: 2020, autores: [{ nome: 'M', sobrenome: 'Lobo' }], abstract: '' } as never
  // Número 18% citado RANZANI e o resumo dele CONTÉM 18% → NÃO flagra.
  assert.equal(verificarNumerosSemSuporte('A letalidade caiu para 18% (RANZANI, 2019).', [refComNumero]).length, 0)
  // Número 55% citado TANIGUCHI cujo resumo NÃO contém 55% → flagra.
  const r = verificarNumerosSemSuporte('No Norte, a mortalidade ultrapassa 55% (TANIGUCHI, 2014).', [refSemNumero])
  assert.equal(r.length, 1)
  assert.match(r[0].problema, /55% n[ãa]o foi localizado/i)
  // Fonte SEM resumo → não dá para verificar → NÃO acusa.
  assert.equal(verificarNumerosSemSuporte('A taxa é de 40% (LOBO, 2020).', [refSemAbstract]).length, 0)
  // Percentual SEM citação → não acusa.
  assert.equal(verificarNumerosSemSuporte('A taxa nacional é de cerca de 40%.', [refComNumero]).length, 0)
})
test('CONTRATO off-topic: sinaliza ref de outra doença (câncer num trabalho de sepse) sem falso-positivo', () => {
  const tema = 'Sepse no Brasil: desigualdades regionais na mortalidade'
  const refCancer = { id: '1', titulo: 'Comparison of Cancer Morbidity and Mortality Between Developed Countries', ano: 2020, autores: [{ nome: 'Q', sobrenome: 'He' }] } as never
  const refSepse = { id: '2', titulo: 'Sepsis-related deaths in Brazil: national mortality registry', ano: 2014, autores: [{ nome: 'L', sobrenome: 'Taniguchi' }] } as never
  const out = detectarRefsOutroAssunto([refCancer, refSepse], tema)
  assert.equal(out.length, 1)
  assert.equal((out[0] as { referencia: string }).referencia, 'HE, 2020')
  assert.match((out[0] as { problema: string }).problema, /c[âa]ncer/i)
  assert.equal((out[0] as { acao_recomendada: string }).acao_recomendada, 'verificar')
  // Num trabalho de oncologia, a ref de câncer NÃO é off-topic.
  assert.equal(detectarRefsOutroAssunto([refCancer], 'Câncer de mama: rastreamento no Brasil').length, 0)
})
test('CONTRATO subseções: renumera "1.1" pela seção pai (4 → 4.1) sem tocar valores no texto', () => {
  const conteudo = 'Parágrafo de abertura da seção.\n\n1.1 Desigualdades regionais\n\nTexto. A razão foi de 2.5 vezes maior.\n\n1.2 Determinantes estruturais\n\nMais texto.'
  const out = renumerarSubsecoes(conteudo, 4)
  assert.match(out, /^4\.1 Desigualdades regionais$/m)
  assert.match(out, /^4\.2 Determinantes estruturais$/m)
  assert.ok(out.includes('2.5 vezes maior'), 'NÃO toca número no meio do texto (minúscula após)')
  // Subnível preserva o resto: "1.2.3 Algo" → "4.2.3 Algo".
  assert.match(renumerarSubsecoes('1.2.3 Subnível Profundo', 4), /^4\.2\.3 Subnível Profundo$/)
  // Já correto (4.1) permanece; seção inválida não altera.
  assert.match(renumerarSubsecoes('4.1 Já Correto', 4), /^4\.1 Já Correto$/)
  assert.equal(renumerarSubsecoes('1.1 Título', 0), '1.1 Título')
})
test('CONTRATO integridade: geração PROÍBE número sem fonte e uso de ref de outro assunto', () => {
  const refs = [fakeRef('1', 'A', 'resumo com conteúdo suficiente para passar do limiar de oitenta caracteres exigido aqui pelo dossiê.')]
  const instr = buildInstrucaoCitacaoReferencias(refs, 'abnt')
  // Número específico só com fonte; senão, qualitativo.
  assert.match(instr, /N[ÚU]MEROS E ESTAT[ÍI]STICAS/i)
  assert.match(instr, /QUALITATIVAMENTE|qualitativa/i)
  assert.match(instr, /FABRICA[ÇC][ÃA]O/i)
  // Fonte tem que ser do assunto (não usar câncer p/ sustentar outro tema).
  assert.match(instr, /ASSUNTO|outra doen[çc]a|c[âa]ncer/i)
  // Densidade: proíbe afirmação causal/promissória sem fonte (evidência, não ensaio).
  assert.match(instr, /EVID[ÊE]NCIA, N[ÃA]O ENSAIO|causal|promiss[óo]ria/i)
})
test('CONTRATO integridade: revisor caça número sem fonte e ref off-topic pelo ASSUNTO real', () => {
  assert.match(REVIEW_SYSTEM_PROMPT, /N[ÚU]MERO SEM FONTE/i)
  assert.match(REVIEW_SYSTEM_PROMPT, /ASSUNTO REAL/i)
  assert.match(REVIEW_SYSTEM_PROMPT, /c[âa]ncer|proje[çc][ãa]o demogr[áa]fica/i)   // exemplo de off-topic disfarçado
  assert.match(REVIEW_SYSTEM_PROMPT, /N[ÃA]O-PRIMÁRIA|newsletter|congresso/i)        // fonte fraca
  assert.match(REVIEW_SYSTEM_PROMPT, /NARRATIVA|SISTEM[ÁA]TICA/)                      // gênero metodológico
})
test('CONTRATO citações: instrução SEM refs ainda força marcador (SOBRENOME, ANO) e proíbe inventar', () => {
  const instr = buildInstrucaoCitacaoReferencias([], 'abnt')
  assert.match(instr, /\(SOBRENOME, ANO\)/)
  assert.match(instr, /PROIBIDO inventar/i)
})
test('CONTRATO geração: TODO tipo de trabalho recebe a lista de refs + instrução de citação', () => {
  const refs = [fakeRef('1', 'Estudo sobre sepse', 'resumo real com tamanho suficiente para entrar no dossiê de fontes do prompt de geração.')]
  // fase mínima (qualquer tipo de trabalho usa este builder)
  const fase = { id: 'introducao', chave_secao: 'introducao', nome: 'Introdução', instrucoes: 'x', elementos_obrigatorios: [], erros_comuns: [] } as unknown as import('@/types').FaseConfig
  const prompt = buildGerarSecaoPrompt(fase, { titulo: 'Sepse no Brasil', referencias: refs, formato_citacao: 'abnt' })
  assert.match(prompt, /REFERÊNCIAS REAIS DISPONÍVEIS/)
  assert.match(prompt, /Resumo da fonte/)   // ancoragem na fonte aplicada
})

test('CONTRATO geração: injeta a DATA ATUAL (âncora temporal) p/ a busca não sair no passado', () => {
  const fase = { id: 'metodologia', chave_secao: 'metodologia', nome: 'Metodologia', instrucoes: 'x', elementos_obrigatorios: [], erros_comuns: [] } as unknown as import('@/types').FaseConfig
  const prompt = buildGerarSecaoPrompt(fase, { titulo: 'Sepse no Brasil', formato_citacao: 'abnt' })
  const anoAtual = new Date().getFullYear()
  assert.match(prompt, /Data atual:/)
  assert.ok(prompt.includes(String(anoAtual)), 'injeta o ano atual no prompt')
  assert.match(prompt, /NUNCA uma data passada/i)
  assert.match(prompt, /per[ií]odo real/i)   // exceção: respeita período real informado
  // Esqueleto ancorado antes da prosa (planejar subtópicos + fontes → depois escrever).
  assert.match(prompt, /esqueleto ancorado|MÉTODO DE REDAÇÃO/i)
  assert.match(prompt, /subt[óo]picos/i)
})
test('CONTRATO esqueleto: outline pede plano em JSON; prosa RESPEITA outline aprovado', () => {
  const fase = { id: 'desenvolvimento', chave_secao: 'desenvolvimento', nome: 'Desenvolvimento', instrucoes: 'cobrir disparidades', elementos_obrigatorios: [], erros_comuns: [] } as unknown as import('@/types').FaseConfig
  const out = buildOutlineSecaoPrompt(fase, { titulo: 'Sepse no Brasil', formato_citacao: 'abnt' })
  assert.match(out, /subtopicos/)               // pede JSON com subtópicos
  assert.match(out, /N[ÃA]O escreva a prosa/i)              // só o plano, não a prosa
  assert.match(out, /n[ãa]o use fonte de outro assunto/i)   // não forçar fonte off-topic
  // A prosa, com outline aprovado, é obrigada a seguir a estrutura.
  const prosa = buildGerarSecaoPrompt(fase, { titulo: 'Sepse no Brasil', formato_citacao: 'abnt', outlineAprovado: '1. Disparidades regionais (TANIGUCHI, 2014)' })
  assert.match(prosa, /ESQUELETO APROVADO PELO USU[ÁA]RIO/i)
  assert.ok(prosa.includes('TANIGUCHI, 2014'))
})

test('formatarRefsParaPrompt: injeta "Resumo da fonte" só nas selecionadas', () => {
  const refs = [
    fakeRef('1', 'Fonte com resumo', 'Este estudo mostra que o tratamento reduz a mortalidade em 30%.'),
    fakeRef('2', 'Fonte sem resumo', undefined),
  ]
  const out = formatarRefsParaPrompt(refs, 'abnt', new Set(['1']))
  assert.ok(out.includes('Resumo da fonte: Este estudo mostra'))   // a selecionada expõe o resumo
  const linhasFonte2 = out.split('\n').filter(l => l.includes('Fonte sem resumo'))
  assert.ok(linhasFonte2.every(l => !l.includes('Resumo da fonte')))  // a não-selecionada não
})

// ── 13e. BLOCO E: revisão lê os resumos das fontes citadas ────────────────────
test('montarFontesParaRevisao: lista citação + título + resumo só das fontes com abstract', () => {
  const refs = [
    fakeRef('1', 'Mortalidade em UTI', 'Estudo de coorte prospectivo que avaliou a mortalidade em pacientes internados em UTI com diagnóstico de sepse grave e choque séptico ao longo de doze meses.'),
    fakeRef('2', 'Sem resumo', undefined),
  ]
  const out = montarFontesParaRevisao(refs, 'abnt', 18)
  assert.ok(out.includes('Mortalidade em UTI'))
  assert.ok(out.includes('coorte prospectivo que avaliou'))
  assert.ok(!out.includes('Sem resumo'))   // sem abstract → fora
})
test('montarFontesParaRevisao: vazio quando nenhuma fonte tem abstract', () => {
  assert.equal(montarFontesParaRevisao([fakeRef('1', 'X', undefined)], 'abnt'), '')
})

// ── 13f. Trava anti-sumiço do resumo (abstract/keywords não somem) ────────────
const resumoJson = (extra?: Partial<{ resumo: string; abstract: string; palavras_chave: string[]; keywords: string[] }>) =>
  JSON.stringify({ resumo: 'Resumo PT.', abstract: 'English abstract.', palavras_chave: ['saúde'], keywords: ['health'], ...extra })

test('protegerConteudoResumo: BLOQUEIA texto puro sobre resumo estruturado (não some)', () => {
  const r = protegerConteudoResumo('O método foi reescrito como prosa pela IA.', resumoJson())
  assert.equal(r.bloqueado, true)
  assert.equal(r.conteudo, resumoJson())          // preserva o JSON existente
  const o = JSON.parse(r.conteudo)
  assert.equal(o.abstract, 'English abstract.')   // abstract intacto
  assert.deepEqual(o.keywords, ['health'])
})
test('protegerConteudoResumo: save parcial NÃO zera campos preenchidos (merge)', () => {
  const recebido = resumoJson({ abstract: '', keywords: [], palavras_chave: [] }) // editor mandou só o resumo
  const r = protegerConteudoResumo(recebido, resumoJson())
  assert.equal(r.bloqueado, false)
  const o = JSON.parse(r.conteudo)
  assert.equal(o.abstract, 'English abstract.')   // preservado do existente
  assert.deepEqual(o.keywords, ['health'])
  assert.deepEqual(o.palavras_chave, ['saúde'])
})
test('protegerConteudoResumo: edição legítima do abstract é aplicada', () => {
  const recebido = resumoJson({ abstract: 'New improved abstract.' })
  const r = protegerConteudoResumo(recebido, resumoJson())
  assert.equal(JSON.parse(r.conteudo).abstract, 'New improved abstract.')
})
test('protegerConteudoResumo: sem resumo estruturado anterior, texto puro passa', () => {
  const r = protegerConteudoResumo('texto inicial', null)
  assert.equal(r.bloqueado, false)
  assert.equal(r.conteudo, 'texto inicial')
})

// ── 13g. Revisão profunda: trava de segurança da reescrita de seção ───────────
test('revisaoProfundaSegura: PERMITE crescer (aprofundar com fontes)', () => {
  const orig = Array.from({ length: 60 }, (_, i) => `palavra${i}`).join(' ')
  const novo = orig + ' ' + Array.from({ length: 80 }, (_, i) => `nova${i}`).join(' ') // ~2.3x
  assert.ok(revisaoProfundaSegura(orig, novo).ok)
})
test('revisaoProfundaSegura: BLOQUEIA encolher demais (perda de conteúdo)', () => {
  const orig = Array.from({ length: 100 }, (_, i) => `p${i}`).join(' ')
  const novo = Array.from({ length: 20 }, (_, i) => `p${i}`).join(' ') // 20% → barra
  assert.ok(!revisaoProfundaSegura(orig, novo).ok)
})
test('revisaoProfundaSegura: BLOQUEIA inchar demais (>3x) e vazio/idêntico', () => {
  const orig = Array.from({ length: 50 }, (_, i) => `p${i}`).join(' ')
  const inflado = Array.from({ length: 200 }, (_, i) => `q${i}`).join(' ') // 4x
  assert.ok(!revisaoProfundaSegura(orig, inflado).ok)
  assert.ok(!revisaoProfundaSegura(orig, '').ok)
  assert.ok(!revisaoProfundaSegura(orig, orig).ok)
})

// ── 13h. Revisão: prompt informa o ano atual (evita falso "data futura") ──────
test('CONTRATO revisão: prompt informa o ano atual e a regra de data futura', () => {
  const ano = new Date().getFullYear()
  const p = buildReviewUserPrompt({ trabalho: 'x', tipo: 't', tema: 't', area: 'a', normas: 'abnt', idioma: 'pt-BR', solicitarCorrecao: false })
  assert.ok(p.includes(String(ano)))           // sabe o ano atual
  assert.match(p, /data futura/i)               // tem a regra de não falso-flagar
})

// ── 13i. CONTRATO da Revisão Profunda (regras travadas p/ todo trabalho) ──────
const RP_BASE = { nomeSecao: 'Introdução', secaoTexto: 'Texto da seção com (SILVA, 2020).', problemas: [], fontesResumo: '', tipo: 'tcc', tema: 'Sepse no Brasil' }
test('CONTRATO revisão profunda: regras invioláveis (mudança mínima, anti-fabricação, manter lógica)', () => {
  const { sys } = buildRevisaoProfundaPrompt(RP_BASE)
  assert.match(sys, /NUNCA invente/i)
  assert.match(sys, /MUDAN[ÇC]A M[ÍI]NIMA|palavra por palavra/i)   // não regenera = sem esteira
  assert.match(sys, /MANTER A L[ÓO]GICA|buraco|sem sentido/i)       // remoção mantém coerência
  assert.match(sys, /contexto errado|n[ãa]o sustente|repeti[çc][ãa]o/i)  // sabe resolver os tipos
})
test('CONTRATO revisão profunda: lista "REFERÊNCIAS A ELIMINAR" entra quando há remover', () => {
  const { user } = buildRevisaoProfundaPrompt({ ...RP_BASE, remover: ['GALVÃO; SILVA, 2022 — sobre suicídio'] })
  assert.match(user, /REFERÊNCIAS A ELIMINAR/)
  assert.match(user, /citações em grupo/i)
  assert.ok(user.includes('GALVÃO; SILVA, 2022'))
})
test('CONTRATO revisão profunda: sem remover, NÃO injeta o bloco de eliminação', () => {
  const { user } = buildRevisaoProfundaPrompt(RP_BASE)
  assert.ok(!/REFERÊNCIAS A ELIMINAR/.test(user))
})
test('CONTRATO revisão: system prompt classifica remover (off-topic) vs corrigir_contexto', () => {
  assert.match(REVIEW_SYSTEM_PROMPT, /"remover"/)
  assert.match(REVIEW_SYSTEM_PROMPT, /NÃO pertence ao tema|outro assunto/i)
  assert.match(REVIEW_SYSTEM_PROMPT, /"corrigir_contexto"/)
})

test('CONTRATO revisão: limite de input alto o bastante p/ trabalho completo (≥400k chars)', () => {
  // 12k tokens (48k chars) era baixo demais e barrava a revisão. Piso seguro p/ Sonnet 4.
  assert.ok(REVIEW_INPUT_CHAR_LIMIT >= 400_000, `limite muito baixo: ${REVIEW_INPUT_CHAR_LIMIT}`)
})

// ── 13j. CONTRATO Coerência global (só ajusta enquadramento, nunca os fatos) ──
test('CONTRATO coerência: SÓ seções de enquadramento são editáveis (fatos protegidos)', () => {
  // editáveis (enquadramento/narrativa)
  for (const c of ['introducao', 'justificativa', 'discussao', 'conclusao', 'consideracoes_finais', 'revisao_literatura']) {
    assert.ok(ehSecaoEnquadramento(c), `deveria ser editável: ${c}`)
  }
  // NUNCA editáveis (fatos/estrutura)
  for (const c of ['metodologia', 'metodos_coleta', 'resultados', 'dados', 'titulo', 'resumo', 'referencias', 'objetivos', 'pico']) {
    assert.ok(!ehSecaoEnquadramento(c), `NÃO pode editar: ${c}`)
  }
})
test('CONTRATO coerência: prompt protege metodologia/resultados (ajusta enquadramento aos fatos)', () => {
  const { sys } = buildCoerenciaGlobalPrompt({ mapa: 'x', tipo: 'tcc', tema: 'sepse' })
  assert.match(sys, /METODOLOGIA e os RESULTADOS são a VERDADE FACTUAL e NÃO podem ser alterados/i)
  assert.match(sys, /NUNCA invente/i)
})
test('CONTRATO coerência: parseAjustesCoerencia valida (chave+buscar≥3+substituir≠buscar)', () => {
  const ok = parseAjustesCoerencia('{"ajustes":[{"chave_secao":"conclusao","buscar":"texto antigo","substituir":"texto novo"}]}')
  assert.equal(ok.length, 1)
  const bad = parseAjustesCoerencia('{"ajustes":[{"chave_secao":"","buscar":"x","substituir":"y"},{"chave_secao":"intro","buscar":"ab","substituir":"cd"},{"chave_secao":"intro","buscar":"igual","substituir":"igual"}]}')
  assert.equal(bad.length, 0)
})

// ── 13k. Saneamento DETERMINÍSTICO de referências off-topic ───────────────────
const refSanear = (id: string, sobrenome: string, ano: number) =>
  ({ id, trabalho_id: 't', tipo: 'artigo', titulo: 'x', autores: [{ nome: 'A', sobrenome }], ano,
     dados_extras: {}, confiabilidade: 'alta', created_at: '' }) as unknown as import('@/types').Referencia

test('acharRefPorCitacao: casa citação textual com a referência (sobrenome+ano)', () => {
  const refs = [refSanear('1', 'Galvão', 2022), refSanear('2', 'Santos', 2022), refSanear('3', 'Silva', 2020)]
  assert.equal(acharRefPorCitacao(refs, 'GALVÃO; SILVA, 2022')?.id, '1')   // 1º autor = Galvão
  assert.equal(acharRefPorCitacao(refs, 'SANTOS et al., 2022')?.id, '2')
  assert.equal(acharRefPorCitacao(refs, 'INEXISTENTE, 1999'), null)
})
test('removerEntradaDeCitacoes: remove de DENTRO de grupo, preservando as outras', () => {
  const txt = 'piores indicadores (GALVÃO; SILVA, 2022; SANTOS et al., 2022) no Brasil.'
  const r = removerEntradaDeCitacoes(txt, 'Galvão', 2022)
  assert.equal(r.removidas, 1)
  assert.ok(!r.texto.includes('GALVÃO'))
  assert.ok(r.texto.includes('SANTOS et al., 2022'))   // a outra fica
})
test('removerEntradaDeCitacoes: remove citação SOLO e limpa pontuação', () => {
  const r = removerEntradaDeCitacoes('estudo isolado (SANTOS et al., 2022). Fim.', 'Santos', 2022)
  assert.equal(r.removidas, 1)
  assert.ok(r.texto.includes('estudo isolado.'))
  assert.ok(!r.texto.includes('SANTOS'))
})
test('extrairSobrenomeAno: extrai 1º sobrenome + ano (p/ remover citação órfã sem ref no banco)', () => {
  assert.deepEqual(extrairSobrenomeAno('MANFROI; FACCIOLI JAPUR, 2021'), { sobrenome: 'MANFROI', ano: 2021 })
  assert.deepEqual(extrairSobrenomeAno('RAGAVAN, 2012 — citação órfã'), { sobrenome: 'RAGAVAN', ano: 2012 })
  assert.equal(extrairSobrenomeAno('sem ano aqui'), null)
})
test('removerEntradaDeCitacoes: remove citação órfã (sobrenome+ano sem referência) do texto', () => {
  const r = removerEntradaDeCitacoes('alguns autores (MANFROI; FACCIOLI JAPUR, 2021) sugerem isso.', 'MANFROI', 2021)
  assert.equal(r.removidas, 1)
  assert.ok(!r.texto.includes('MANFROI'))
})
test('removerEntradaDeCitacoes: NÃO remove ref de outro ano/sobrenome', () => {
  const r = removerEntradaDeCitacoes('texto (SILVA, 2020; COSTA, 2021) fim.', 'Galvão', 2022)
  assert.equal(r.removidas, 0)
  assert.equal(r.texto, 'texto (SILVA, 2020; COSTA, 2021) fim.')
})

// ── 13l. MANIFESTO: o pipeline de excelência da revisão NUNCA pode sair do app ─
test('MANIFESTO revisão de excelência: todas as peças do pipeline existem', () => {
  // Se qualquer rota/módulo do ciclo (detectar → remover → reescrever → coerência)
  // for apagada, este teste falha e o deploy não sai.
  const obrigatorios = [
    'app/api/review/analyze/route.ts',        // detectar
    'app/api/review/limpar-suspeitas/route.ts', // remover off-topic (determinístico)
    'app/api/review/corrigir/route.ts',       // correção cirúrgica
    'app/api/review/revisar/route.ts',        // reescrever/aprofundar + gap-filling
    'app/api/review/coerencia/route.ts',      // coerência global
    'lib/revisao/sanear-refs.ts',
    'lib/revisao/coerencia.ts',
    'lib/resumo/proteger.ts',
    'lib/referencias/dossie.ts',
  ]
  for (const p of obrigatorios) {
    assert.ok(existsSync(join(process.cwd(), p)), `peça do pipeline ausente: ${p}`)
  }
})

// ── 13m. Bibliografia derivada da TABELA (remove entrada órfã da seção) ───────
test('compilarSecaoReferencias: bibliografia vem da tabela; ref ausente não aparece', () => {
  const refPresente = { id: '1', trabalho_id: 't', tipo: 'artigo', titulo: 'Sepse no Brasil',
    autores: [{ nome: 'João', sobrenome: 'Silva' }], ano: 2021, dados_extras: {}, confiabilidade: 'alta',
    created_at: '', referencia_formatada_abnt: 'SILVA, João. Sepse no Brasil. 2021.' } as unknown as import('@/types').Referencia
  const out = compilarSecaoReferencias([refPresente], 'abnt')
  assert.match(out, /REFER[ÊE]NCIAS/i)
  assert.ok(out.includes('SILVA'))
  assert.ok(!out.includes('GALVÃO'))   // uma ref que NÃO está na tabela não entra na bibliografia
  assert.equal(compilarSecaoReferencias([], 'abnt'), '')   // sem refs → seção vazia
})

// ── 13n. ISOLAMENTO por trabalho: nenhuma revisão pode misturar trabalhos ──────
test('ISOLAMENTO: toda rota de revisão exige posse (usuario_id) + escopo (trabalho_id)', () => {
  // Garante que cada operação age SÓ no trabalho do dono — nunca mistura trabalhos.
  const rotas = ['analyze', 'revisar', 'coerencia', 'limpar-suspeitas', 'corrigir', 'aplicar', 'iterate']
  const { readFileSync, existsSync } = require('node:fs') as typeof import('node:fs')
  for (const r of rotas) {
    const p = join(process.cwd(), `app/api/review/${r}/route.ts`)
    if (!existsSync(p)) continue
    const src = readFileSync(p, 'utf8') as string
    assert.ok(/usuario_id['"]\s*,\s*user\.id/.test(src), `rota ${r}: falta checagem de posse (usuario_id)`)
    assert.ok(/trabalho_?[iI]d/.test(src), `rota ${r}: falta escopo por trabalho`)
  }
})

// ── 13o. Vancouver: remover ref renumera o resto (consistente com a lista) ────
test('renumerarVancouverRemovendo: remove [k] e decrementa os maiores', () => {
  // Remove a ref #2. Esperado: [2] some; [3]→[2], [4]→[3]; [1] fica.
  const r = renumerarVancouverRemovendo('Achado A [1]. Achado B [2]. Achado C [3] e D [4].', [2])
  assert.equal(r.removidas, 1)
  assert.ok(r.texto.includes('[1]'))
  assert.ok(!/\[4\]/.test(r.texto))        // não sobra o número antigo mais alto
  assert.ok(r.texto.includes('[3]'))       // [4] virou [3]
  assert.ok(!r.texto.includes('B .') && !r.texto.includes('B  '))  // limpou pontuação órfã
})
test('renumerarVancouverRemovendo: múltiplas remoções deslocam corretamente', () => {
  const r = renumerarVancouverRemovendo('[1] [2] [3] [4] [5] [6]', [2, 5])
  // [1]→[1], [2]rm, [3]→[2], [4]→[3], [5]rm, [6]→[4]
  assert.equal(r.texto.trim(), '[1] [2] [3] [4]')
  assert.equal(r.removidas, 2)
})
test('renumerarVancouverRemovendo: sem posições não muda nada', () => {
  const t = 'texto [1] e [2].'
  assert.equal(renumerarVancouverRemovendo(t, []).texto, t)
})

// ── 13p. Casamento de trecho tolerante a aspas curvas/retas (correção aplica) ─
test('aplicarEdicoes: casa trecho mesmo com aspas curvas vs retas', () => {
  // texto com aspas CURVAS; correção busca com aspas RETAS → deve casar e aplicar
  const texto = 'Como dito por “Crawford” (2012), houve avanço.'
  const { texto: out, aplicadas } = aplicarEdicoes(texto, [{ buscar: 'Como dito por "Crawford" (2012), houve avanço.', substituir: 'Houve avanço.' }])
  assert.equal(aplicadas, 1)
  assert.ok(out.includes('Houve avanço.'))
})
test('aplicarEdicoes: casa trecho com travessão diferente', () => {
  const texto = 'A sepse — grave — exige atenção.'
  const { aplicadas } = aplicarEdicoes(texto, [{ buscar: 'A sepse - grave - exige atenção.', substituir: 'A sepse exige atenção.' }])
  assert.equal(aplicadas, 1)
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
