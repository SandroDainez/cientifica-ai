/**
 * REGRAS DE FORMATAÇÃO DE DOCUMENTO ACADÊMICO (ABNT) — FONTE ÚNICA DE VERDADE
 * ===========================================================================
 * Converte o markdown gerado pela IA em HTML limpo para impressão / PDF.
 * QUALQUER ajuste de formatação de saída deve ser feito AQUI — nunca duplicado
 * em componentes. Isso evita que o mesmo defeito (—, ```, *, #, ---) reapareça
 * em um caminho diferente.
 *
 *   Markdown da IA          →  Saída no documento
 *   ---------------------------------------------------------------------------
 *   # / ## / ###            →  <h1>/<h2>/<h3>  (títulos de seção)
 *   **negrito**             →  <strong>
 *   *itálico*  _itálico_    →  <em>
 *   ***ambos***             →  <strong><em>
 *   `código`                →  <code>          (monoespaçado inline)
 *   ```bloco de código```   →  <pre>           (monoespaçado; SEM as crases)
 *   - / * / + item          →  <ul><li>        (lista com marcador)
 *   1. item                 →  <ol><li>        (lista numerada)
 *   | tabela |              →  <table>         (fios horizontais ABNT)
 *   > citação               →  <blockquote>    (citação recuada)
 *   ---  ***  ___           →  REMOVIDO. ABNT NÃO usa régua horizontal no corpo.
 *   —  travessão            →  tratado antes por removerTravessoes()
 *   linha em branco         →  separação por margem de parágrafo, NUNCA <br/>
 *
 * Observação: o travessão "—" já deve ter sido removido por removerTravessoes()
 * antes de chamar esta função. Aqui cuidamos apenas da estrutura markdown.
 */

import { converterMathLatexParaTexto } from './latex'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Converte markdown inline (negrito, itálico, código) de UMA linha já escapada. */
function inline(textoBruto: string): string {
  let s = escapeHtml(textoBruto)
  // código inline `x` primeiro (protege o conteúdo de outras regras)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  // negrito + itálico ***x***
  s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  // negrito **x**
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  // itálico *x*  (não captura ** já consumido)
  s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
  // itálico _x_  (só quando isolado por borda de palavra, p/ não quebrar nomes_com_underline)
  s = s.replace(/(^|[\s(])_([^_\n]+?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
  return s
}

/** Divide uma linha de tabela markdown em células SEM descartar a última coluna. */
function parseRowTabela(linha: string): string[] {
  let l = linha.trim()
  if (l.startsWith('|')) l = l.slice(1)
  if (l.endsWith('|')) l = l.slice(0, -1)
  return l.split('|').map(c => c.trim())
}

const ehSeparadorTabela = (l: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-')

/**
 * Converte o markdown completo de um documento em HTML para impressão.
 * Retorna apenas o corpo (sem <html>/<head>); o chamador injeta no template.
 */
export function markdownAcademicoParaHtml(texto: string): string {
  // Converte LaTeX matemático cru (\frac, \times, Z_{\alpha/2}…) em texto legível
  // antes de montar o HTML — vale para documentos já existentes na impressão.
  const linhas = converterMathLatexParaTexto(texto).split('\n')
  const out: string[] = []

  let i = 0
  let listaAberta: 'ul' | 'ol' | null = null
  const fecharLista = () => { if (listaAberta) { out.push(`</${listaAberta}>`); listaAberta = null } }

  while (i < linhas.length) {
    const l = linhas[i]

    // ── Bloco de código cercado por ``` ──────────────────────────────────────
    if (/^\s*`{3,}/.test(l)) {
      fecharLista()
      const buffer: string[] = []
      i++
      while (i < linhas.length && !/^\s*`{3,}/.test(linhas[i])) { buffer.push(linhas[i]); i++ }
      i++ // pula a cerca de fechamento
      out.push(`<pre class="code">${buffer.map(escapeHtml).join('\n')}</pre>`)
      continue
    }

    // ── Tabela markdown (linhas começando com |) ─────────────────────────────
    if (l.trim().startsWith('|')) {
      fecharLista()
      const linhasTab: string[] = []
      while (i < linhas.length && linhas[i].trim().startsWith('|')) { linhasTab.push(linhas[i]); i++ }
      const corpo = linhasTab.filter(x => !ehSeparadorTabela(x))
      if (corpo.length) {
        const [cab, ...resto] = corpo
        const thead = `<thead><tr>${parseRowTabela(cab).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
        const tbody = resto.length
          ? `<tbody>${resto.map(r => `<tr>${parseRowTabela(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
          : ''
        out.push(`<table>${thead}${tbody}</table>`)
      }
      continue
    }

    // ── Régua horizontal markdown (--- *** ___) → REMOVIDA (não há no corpo ABNT)
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { fecharLista(); i++; continue }

    // ── Títulos ──────────────────────────────────────────────────────────────
    if (/^\s*### /.test(l)) { fecharLista(); out.push(`<h3>${inline(l.replace(/^\s*### /, ''))}</h3>`); i++; continue }
    if (/^\s*## /.test(l))  { fecharLista(); out.push(`<h2>${inline(l.replace(/^\s*## /, ''))}</h2>`);  i++; continue }
    if (/^\s*# /.test(l))   { fecharLista(); out.push(`<h1>${inline(l.replace(/^\s*# /, ''))}</h1>`);   i++; continue }

    // ── Citação > ────────────────────────────────────────────────────────────
    if (/^\s*> /.test(l)) { fecharLista(); out.push(`<blockquote>${inline(l.replace(/^\s*> /, ''))}</blockquote>`); i++; continue }

    // ── Lista com marcador (- * +) ───────────────────────────────────────────
    if (/^\s*[-*+] /.test(l)) {
      if (listaAberta !== 'ul') { fecharLista(); out.push('<ul>'); listaAberta = 'ul' }
      out.push(`<li>${inline(l.replace(/^\s*[-*+] /, ''))}</li>`)
      i++; continue
    }
    // ── Lista numerada (1. 2. …) ─────────────────────────────────────────────
    if (/^\s*\d+\.\s/.test(l)) {
      if (listaAberta !== 'ol') { fecharLista(); out.push('<ol>'); listaAberta = 'ol' }
      out.push(`<li>${inline(l.replace(/^\s*\d+\.\s/, ''))}</li>`)
      i++; continue
    }

    // ── Linha em branco → separa parágrafos (sem <br/> extra) ────────────────
    if (l.trim() === '') { fecharLista(); i++; continue }

    // ── Parágrafo normal ─────────────────────────────────────────────────────
    fecharLista()
    out.push(`<p>${inline(l)}</p>`)
    i++
  }
  fecharLista()
  return out.join('\n')
}
