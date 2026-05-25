import type { Trabalho } from '@/types'

interface SecaoConteudo {
  nome_secao: string
  conteudo: string
}

export function buildPrepararDefesaPrompt(
  trabalho: Trabalho,
  secoes: SecaoConteudo[]
): { system: string; user: string } {
  const system = `Você é um orientador sênior e membro experiente de bancas avaliativas de trabalhos acadêmicos brasileiros.
Sua função é dar um feedback técnico, honesto e construtivo — nunca elogioso por educação.
Você avalia com rigor, aponta problemas reais, faz perguntas difíceis como uma banca real faz, e atribui notas realistas baseadas em critérios acadêmicos objetivos.
Seja direto, sem rodeios. O pesquisador precisa saber a verdade para se preparar adequadamente.`

  // Monta o conteúdo das seções (truncado para não exceder contexto)
  const secoesTexto = secoes
    .filter(s => s.conteudo && s.conteudo.trim().length > 50)
    .map(s => `### ${s.nome_secao}\n${s.conteudo.trim().substring(0, 2000)}`)
    .join('\n\n')

  const tipoLabel: Record<string, string> = {
    tcc: 'TCC',
    artigo_original: 'Artigo Original',
    artigo_revisao: 'Artigo de Revisão',
    relato_caso: 'Relato de Caso',
    monografia: 'Monografia',
    dissertacao_mestrado: 'Dissertação de Mestrado',
    tese_doutorado: 'Tese de Doutorado',
    revisao_sistematica: 'Revisão Sistemática',
    projeto_pesquisa: 'Projeto de Pesquisa',
    relatorio_ic: 'Relatório de Iniciação Científica',
  }

  const user = `Analise este trabalho acadêmico e prepare o pesquisador para a defesa.

## DADOS DO TRABALHO
- Título: ${trabalho.titulo || 'Sem título definido'}
- Tipo: ${tipoLabel[trabalho.tipo_trabalho] ?? trabalho.tipo_trabalho}
- Área: ${trabalho.area_conhecimento ?? 'Não informada'}
- Formato de citação: ${trabalho.formato_citacao?.toUpperCase() ?? 'ABNT'}
- Seções concluídas: ${trabalho.fases_concluidas.length}

## CONTEÚDO DAS SEÇÕES
${secoesTexto || '⚠️ Nenhuma seção com conteúdo suficiente encontrada.'}

---

Com base no trabalho acima, responda em formato JSON estrito após a linha "===ANALISE_JSON===".

O JSON deve ter EXATAMENTE esta estrutura:

{
  "roteiro": {
    "introducao": "Como o pesquisador deve abrir a apresentação — o que falar nos primeiros 2 minutos, como contextualizar o problema (2-4 parágrafos práticos)",
    "desenvolvimento": "O que apresentar no corpo — quais pontos destacar da metodologia, resultados e discussão (3-5 parágrafos)",
    "encerramento": "Como fechar a apresentação — conclusão, limitações honestas, contribuições e próximos passos (1-2 parágrafos)",
    "dicas_postura": ["dica 1 de postura/comunicação", "dica 2", "dica 3"]
  },
  "perguntas_banca": [
    {
      "pergunta": "Pergunta exata que a banca pode fazer",
      "area": "metodologia|fundamentacao|resultados|etica|originalidade|geral",
      "dificuldade": "facil|media|dificil",
      "dica_resposta": "Como responder bem a essa pergunta — pontos-chave a mencionar"
    }
  ],
  "avaliacao": {
    "nota_geral": 7.2,
    "conceito": "Bom",
    "parecer_geral": "Avaliação honesta em 2-3 frases sobre o trabalho como um todo — mencione tanto qualidades quanto problemas reais",
    "pontos_fortes": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
    "pontos_fracos": ["problema real 1", "problema real 2", "problema real 3"],
    "risco_reprovacao": false,
    "criterios": [
      {
        "nome": "Clareza da questão de pesquisa",
        "pontuacao": 8.0,
        "max": 10.0,
        "peso": 15,
        "observacao": "Observação técnica específica sobre este critério"
      },
      {
        "nome": "Revisão de literatura",
        "pontuacao": 7.0,
        "max": 10.0,
        "peso": 20,
        "observacao": "Observação técnica específica"
      },
      {
        "nome": "Rigor metodológico",
        "pontuacao": 6.5,
        "max": 10.0,
        "peso": 25,
        "observacao": "Observação técnica específica"
      },
      {
        "nome": "Apresentação dos resultados",
        "pontuacao": 7.5,
        "max": 10.0,
        "peso": 20,
        "observacao": "Observação técnica específica"
      },
      {
        "nome": "Discussão e conclusões",
        "pontuacao": 7.0,
        "max": 10.0,
        "peso": 10,
        "observacao": "Observação técnica específica"
      },
      {
        "nome": "Normas ABNT / Formatação",
        "pontuacao": 8.0,
        "max": 10.0,
        "peso": 10,
        "observacao": "Observação técnica específica"
      }
    ]
  }
}

REGRAS OBRIGATÓRIAS:
1. A nota_geral deve ser calculada pela média ponderada real dos critérios (usando os pesos)
2. Seja HONESTO: se o trabalho tem problemas sérios, aponte-os. Não inflacione notas
3. Gere EXATAMENTE 10 perguntas_banca cobrindo áreas diferentes
4. As perguntas devem ser específicas ao conteúdo deste trabalho, não genéricas
5. Se não há conteúdo suficiente para avaliar, reduza a nota e aponte isso como problema crítico
6. risco_reprovacao = true se nota_geral < 5.0
7. O JSON deve ser válido — sem comentários, sem aspas simples, sem vírgulas finais`

  return { system, user }
}
