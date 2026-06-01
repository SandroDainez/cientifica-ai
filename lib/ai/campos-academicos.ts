/**
 * Regras acadêmicas específicas por campo do conhecimento.
 *
 * Cobre as 9 Grande Áreas do conhecimento do sistema CAPES brasileiro,
 * com subdivisões para campos com particularidades metodológicas significativas.
 *
 * Referências normativas utilizadas:
 * - ABNT NBR 6023:2018 (referências) e 10520:2023 (citações)
 * - CAPES: tabela de áreas e normas de pós-graduação
 * - APA 7ª Ed. (psicologia, ciências comportamentais)
 * - Vancouver/ICMJE (ciências biomédicas)
 * - Chicago 17ª Ed. (história, humanidades)
 * - ISO 31-0, IUPAC, IUCN (nomenclaturas técnicas)
 * - Resoluções dos conselhos profissionais brasileiros (CFM, COFEN, CRM, CFO, CFF, CREFITO, etc.)
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

export type CampoAcademico =
  // Ciências da Saúde
  | 'saude'           // Medicina, Enfermagem, Saúde Coletiva
  | 'odontologia'     // Odontologia e subáreas
  | 'farmacia'        // Farmácia, Bioquímica, Farmacologia
  | 'fisioterapia'    // Fisioterapia, Fonoaudiologia, Terapia Ocupacional
  | 'nutricao'        // Nutrição, Ciências dos Alimentos, Dietética
  // Ciências Agrárias
  | 'agronomia'       // Agronomia, Fitotecnia, Solos, Fitopatologia
  | 'veterinaria'     // Medicina Veterinária, Zootecnia, Aquicultura
  | 'ciencias_florestais' // Engenharia Florestal, Silvicultura, Manejo Florestal
  // Ciências Exatas e da Terra
  | 'exatas'          // Matemática, Computação, Estatística, Sistemas de Informação
  | 'fisica'          // Física (experimental, teórica, aplicada)
  | 'quimica'         // Química (analítica, orgânica, inorgânica, ambiental)
  | 'geociencias'     // Geologia, Geotecnia, Oceanografia, Meteorologia, Geofísica
  // Engenharias
  | 'engenharia'      // Engenharias civil, mecânica, elétrica, química, produção
  | 'arquitetura'     // Arquitetura, Urbanismo, Design de Interiores, Paisagismo
  | 'design'          // Design gráfico, industrial, UX/UI, moda
  // Ciências Biológicas
  | 'biologia'        // Biologia, Ecologia, Genética, Botânica, Zoologia, Microbiologia
  | 'ciencias_ambientais' // Ciências Ambientais, Ecologia aplicada, Sustentabilidade
  // Ciências Humanas
  | 'educacao'        // Educação, Pedagogia, Licenciaturas
  | 'psicologia'      // Psicologia
  | 'humanas'         // Filosofia, Letras, Linguística, Literatura
  | 'historia'        // História, Arqueologia, Museologia
  | 'geografia'       // Geografia (física, humana, cartografia, SIG)
  | 'teologia'        // Teologia, Ciências da Religião
  // Ciências Sociais Aplicadas
  | 'direito'         // Direito
  | 'administracao'   // Administração, Contabilidade, Economia
  | 'comunicacao'     // Comunicação, Jornalismo, Publicidade, Relações Públicas, Cinema
  | 'servico_social'  // Serviço Social
  | 'turismo'         // Turismo, Hotelaria, Lazer, Eventos
  | 'ciencias_sociais' // Sociologia, Antropologia, Ciência Política, Relações Internacionais
  // Fallback
  | 'geral'

// ── Detecção de campo ────────────────────────────────────────────────────────

const PADROES_CAMPO: Array<[RegExp, CampoAcademico]> = [
  // ── Saúde — subáreas específicas PRIMEIRO (antes de 'saude' genérico) ───
  [/odontolog|cirurgi[aã]o.dent|endodonti|periodont|ortodonti|protodont|implante.*dental|bucal|dental/i, 'odontologia'],
  [/farmac[êe]utic|farmacolog|farmacogn|toxicolog|biofarmác|bioqu[ií]mica.*farmac|farmácia/i, 'farmacia'],
  [/fisioterapi|terapia ocupacional|fonoaudiologi|audiologi|reabilita[cç][aã]o funcional/i, 'fisioterapia'],
  [/nutri[cç][aã]o\b|dietética|ciências dos alimentos|tecnologia de alimentos|alimenta[cç][aã]o|bromatologi/i, 'nutricao'],
  // ── Agrárias — veterinária ANTES de saude (captura "medicina veterinária") ──
  [/veterin[aá]r|zootecni|aquicultura|piscicultura|produção animal|suinocultura|avicultura|bovinocultura/i, 'veterinaria'],
  [/ciências florestais|engenharia florestal|silvicultura|manejo florestal|dendrologia|ecologia florestal/i, 'ciencias_florestais'],
  // ── Saúde — geral ───────────────────────────────────────────────────────
  [/medicina\b|médic[ao]\b|enfermagem|saúde coletiva|saúde pública|epidemiologi|biologia médica|fisiologi|imunologi|patologi|oncologi|cardiologi|neurologi|pediatri|ginecolog|obstetríci|psiquiatri|cirurgi|anestesiologi|radiologi|dermatologi|ortoped|urologi|oftalmologi|otorrino|geriatri|emergência médica|saúde.*hum/i, 'saude'],
  [/agronomia|fitotecnia|fitopatologi|entomologi|solos.*agr|irriga[cç][aã]o|agropecuária|produção vegetal|ciências agrárias|agricultura\b|agric[ou]lt/i, 'agronomia'],
  // ── Exatas ───────────────────────────────────────────────────────────────
  [/física\b|f[íi]sica.*experimental|f[íi]sica.*te[oó]rica|astrof[íi]sica|f[íi]sica.*aplicada|mecânica quântica|eletromagneti/i, 'fisica'],
  [/qu[íi]mica\b|qu[íi]mica anal[íi]tica|qu[íi]mica org[aâ]nica|qu[íi]mica inorg[aâ]nica|qu[íi]mica ambiental|qu[íi]mica.*industr|qu[íi]mica.*farmac|materiais.*qu[íi]m|polímero|catálise/i, 'quimica'],
  [/geologi|geotecnia|oceanografi|meteorologi|geof[íi]sica|min[eé]rio|mineralogia|petrografi|hidrologi|geodésia|cartografi.*terrestr/i, 'geociencias'],
  [/matemática\b|estat[íi]stica\b|ciência da computação|sistemas de informa[cç][aã]o|tecnologia da informa[cç][aã]o|ci[eê]ncias exatas|análise matemática|álgebra|topologia|computação\b/i, 'exatas'],
  // ── Engenharia e Arquitetura ─────────────────────────────────────────────
  [/arquitetura\b|urbanismo\b|design de interiores|paisagismo|patrimônio arquitet|planejamento urbano|habitação\b|ambiente construído/i, 'arquitetura'],
  [/design\b.*(?:gráfico|industrial|produto|moda|ux|ui|comunicação visual|games)|design de serviços|ergonomia do produto|design thinking/i, 'design'],
  [/engenharia\b|engenharia civil|engenharia mecânica|engenharia elétrica|engenharia química|engenharia de produ[cç][aã]o|engenharia ambiental|engenharia de comp|engenharia de minas|engenharia nuclear|engenharia têxtil|engenharia de transportes|controle e automação/i, 'engenharia'],
  // ── Biológicas ────────────────────────────────────────────────────────────
  [/ciências ambientais|sustentabilidade\b|ecologia.*aplicada|gestão ambiental|avaliação de impacto ambiental|licenciamento ambiental|meio ambiente\b/i, 'ciencias_ambientais'],
  [/biologia\b|ecologia\b|genética\b|botânica|zoologia|microbiologia|parasitologia|micologia|virologia|fisiologia vegetal|anatomia vegetal|biologia marinha|biologia celular|limnologia/i, 'biologia'],
  // ── Humanas ──────────────────────────────────────────────────────────────
  [/teologia|ciências da religião|teol[oó]g|bíbli|sagrad[ao] escritura|pastoral|missiologia|religiã[oo]/i, 'teologia'],
  [/história\b|arqueologia|museologia|patrimônio histórico|historiografia|história.*art|história.*cultur/i, 'historia'],
  [/geografia\b|cartografia|SIG\b|sensoriamento remoto|geoprocessamento|planejamento regional|geografia física|geografia humana|geomorfologia/i, 'geografia'],
  [/filosofia\b|letras\b|linguística\b|literatura\b|filologia|semiótica|hermenêutica filosófica|estética\b/i, 'humanas'],
  [/educa[cç][aã]o\b|pedagogia\b|licenciatura|didática|docência|ensino.*escolar|currícul|alfabetiz|letramento|gestão escolar/i, 'educacao'],
  [/psicologia\b|psicanálise|psicoterapia|neuropsicolog|psicologia clínica|psicologia social|psicologia organizacional/i, 'psicologia'],
  // ── Sociais Aplicadas ─────────────────────────────────────────────────────
  [/turismo\b|hotelaria\b|lazer\b|eventos\b|hospitalidade|gestão de destinos|patrimônio turístico/i, 'turismo'],
  [/serviço social\b|assistência social|SUAS|CRAS|política social|vulnerabilidade social|proteção social/i, 'servico_social'],
  [/comunicação\b|jornalismo\b|publicidade\b|relações públicas\b|cinema\b|rádio\b|televisão\b|mídia\b|comunicação digital|marketing digital|audiovisual/i, 'comunicacao'],
  [/direito\b|ciências jurídicas|jurídi[ck]|advocaci|magistratura|jurisprudência/i, 'direito'],
  [/administra[cç][aã]o\b|gestão\b|contabilidade\b|economia\b|ciências contábeis|marketing\b|log[íi]stica|finanças\b|empreendedorism|secretariado|comércio exterior/i, 'administracao'],
  [/sociologia\b|antropologia\b|ciências sociais\b|ciência política|relações internacionais|estudos culturais/i, 'ciencias_sociais'],
]

export function detectarCampo(areaConhecimento: string): CampoAcademico {
  if (!areaConhecimento?.trim()) return 'geral'
  const texto = areaConhecimento.trim()
  for (const [padrao, campo] of PADROES_CAMPO) {
    if (padrao.test(texto)) return campo
  }
  return 'geral'
}

// ── Formato de citação recomendado por campo ──────────────────────────────────

export function getCitacaoRecomendadaPorCampo(campo: CampoAcademico): string {
  const apa: CampoAcademico[] = ['psicologia']
  const vancouver: CampoAcademico[] = ['saude', 'odontologia', 'farmacia', 'fisioterapia', 'nutricao', 'veterinaria', 'biologia']
  if (apa.includes(campo)) return 'apa'
  if (vancouver.includes(campo)) return 'vancouver'
  return 'abnt'
}

// ── Regras específicas por campo ──────────────────────────────────────────────

export function getRegrasCampoAcademico(
  campo: CampoAcademico,
  tipoTrabalho: string,
): string {

  const HEADER = (titulo: string) => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS ESPECÍFICAS — ${titulo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

  switch (campo) {

    // ══════════════════════════════════════════════════════════════════════════
    case 'saude':
      return HEADER('CIÊNCIAS DA SAÚDE — MEDICINA / ENFERMAGEM / SAÚDE COLETIVA') + `
ESTRUTURA OBRIGATÓRIA:
• Artigo original: IMRAD — Introdução / Métodos / Resultados / Discussão / Conclusão
• Revisão sistemática: PRISMA 2020 — registrar protocolo no PROSPERO antes de iniciar
• Relato de caso: CARE guidelines — título, resumo estruturado, apresentação, discussão, conclusão
• TCC/Dissertação: adaptação ABNT com seções IMRAD integradas

MÉTODOS (obrigatório):
• Declare delineamento na PRIMEIRA FRASE: "Trata-se de um estudo observacional transversal..."
• Cite checklist metodológico: CONSORT (ECR), STROBE (observacional), PRISMA (revisão), CARE (relato de caso)
• CEP/CONEP: número CAAE de 25 dígitos + número do parecer consubstanciado + data
• TCLE: declare que todos os participantes assinaram ANTES de qualquer procedimento
• Cálculo amostral: descrever fórmula, tamanho de efeito esperado, poder (≥80%), α (geralmente 0,05)

ESTATÍSTICA:
• Variáveis quantitativas: média ± DP (normal) ou mediana [IIQ] (não normal)
• Reportar: tamanho de efeito + IC 95% + valor-p em todos os desfechos
• Associações: regressão logística (desfecho binário) / regressão linear / Kaplan-Meier (sobrevida)
• Software: R, SPSS, Stata, SAS — citar versão

CITAÇÕES (Vancouver preferido para artigos; ABNT para TCCs):
• Medicamentos: SEMPRE nome genérico (DCI) — ex: "metformina 850 mg VO 2x/dia" — nunca marca comercial
• Escalas: nome completo + referência original — ex: "Escala de Sonolência de Epworth (ESS; JOHNS, 1991)"
• Diagnósticos: usar critérios definidos com referência — ex: "critérios Sepsis-3 (SINGER et al., 2016)"
• Citar: WHO, Ministério da Saúde (MS), CFM, Anvisa como autores institucionais — ex: (WHO, 2023)`

    // ──────────────────────────────────────────────────────────────────────────
    case 'odontologia':
      return HEADER('ODONTOLOGIA') + `
ESTRUTURA: IMRAD para artigos experimentais e clínicos; relato de caso segue CARE adaptado para odontologia.

ÉTICA E REGULAMENTAÇÃO:
• CEP obrigatório para pesquisa com humanos: CAAE + parecer do CEP
• Conselho Federal de Odontologia (CFO): citar Código de Ética Odontológica (CEO, 2012) em discussões éticas
• Resolução CFO nº 196/2019: uso de imagens de pacientes — consentimento específico para publicação

METODOLOGIA CLÍNICA ESPECÍFICA:
• Estudos clínicos odontológicos: seguir CONSORT para ECR; STROBE para observacionais
• Índice de placa, índice gengival, profundidade de sondagem (mm), recessão gengival (mm): sempre reportar com média ± DP
• Classificação periodontal: "Classificação de Periodontite Estágio III/IV, Grau B (TONETTI et al., 2018)"
• Cárie dental: ICDAS (International Caries Detection and Assessment System) como critério padrão
• Análise radiográfica: especificar tipo (periapical, panorâmica, tomografia cone beam — CBCT), software de análise, magnificação

MATERIAIS E EQUIPAMENTOS:
• Identificar fabricante, cidade e país: ex: "resina composta Filtek Z350 XT (3M ESPE, St. Paul, MN, USA)"
• Composição química dos materiais quando relevante para o estudo
• Parâmetros de polimerização: tempo (s), intensidade (mW/cm²), irradiância

CITAÇÕES: Vancouver ou ABNT segundo normas do periódico. Exemplos de periódicos referência: Journal of Dentistry, JADA, RGO, Pesquisa Brasileira em Odontopediatria.`

    // ──────────────────────────────────────────────────────────────────────────
    case 'farmacia':
      return HEADER('FARMÁCIA, FARMACOLOGIA E CIÊNCIAS FARMACÊUTICAS') + `
ESTRUTURA: IMRAD para estudos experimentais; revisões narrativas e sistemáticas comuns.

NOMENCLATURA E IDENTIFICAÇÃO QUÍMICA:
• Fármacos: usar DCI (Denominação Comum Internacional) — ex: "ácido acetilsalicílico" (não "Aspirina")
• Estrutura química: representar segundo IUPAC; registrar número CAS quando disponível
  Ex: "Ácido acetilsalicílico (CAS 50-78-2; IUPAC: 2-(acetiloxi)ácido benzoico)"
• Solventes e reagentes: grau de pureza e fabricante — ex: "metanol grau HPLC (J.T.Baker, USA)"

ANÁLISES FARMACÊUTICAS:
• Cromatografia: citar método validado (ICH Q2(R1)); reportar: coluna, fase móvel, detector, vazão, comprimento de onda
• Validação analítica: especificidade, linearidade (R² ≥ 0,999), LD, LQ, precisão (CV%), exatidão (%)
• Dissolução in vitro: aparato USP (I, II), RPM, meio, temperatura, comprimento de onda
• HPLC, LC-MS/MS, GC-MS, UV-Vis: citar equipamento + software de análise

FARMACOLOGIA EXPERIMENTAL:
• Estudos pré-clínicos com animais: aprovação CEUA obrigatória — número do protocolo
• Guias ICH para estudos de toxicidade: ICH S1, S2, S6 etc.
• Dose-resposta: CI50, IC50, CE50, DL50 com IC95%
• In vitro vs in vivo: distinguir claramente; limitações de extrapolação

LEGISLAÇÃO FARMACÊUTICA (citar quando relevante):
• RDC ANVISA: "conforme RDC nº XXX/AAAA (ANVISA, AAAA)"
• Farmacopeia Brasileira (FB 6ª edição): "(FB, 2019)"
• Farmacopeia Americana (USP), Europeia (Ph. Eur.): citar edição e artigo específico
• Lei nº 9.787/1999 (medicamentos genéricos) e Lei nº 10.742/2003 (CMED)`

    // ──────────────────────────────────────────────────────────────────────────
    case 'fisioterapia':
      return HEADER('FISIOTERAPIA, FONOAUDIOLOGIA E TERAPIA OCUPACIONAL') + `
ESTRUTURA: IMRAD para estudos clínicos e experimentais; relatos de caso seguem CARE adaptado.

ÉTICA E CONSELHOS PROFISSIONAIS:
• CEP: obrigatório para pesquisa com humanos; número CAAE e parecer no texto
• CREFITO (Conselho Regional de Fisioterapia e Terapia Ocupacional): citar Código de Ética quando relevante
• CFFa (Conselho Federal de Fonoaudiologia) e Resolução CFFa nº 380/2010 para estudos em fonoaudiologia

AVALIAÇÃO E MENSURAÇÃO:
• Escalas e instrumentos: citar referência original + adaptação ao português — ex: "Escala de Equilíbrio de Berg (BBS; BERG et al., 1989; adaptação: MIYAMOTO et al., 2004)"
• Sempre reportar: ICC (Coeficiente de Correlação Intraclasse) para confiabilidade intra e interavaliador
• Mínima Diferença Detectável (MDD) e Mínima Mudança Clinicamente Importante (MMCI) — reportar quando disponíveis
• Goniometria: ativo vs passivo; posição do paciente e referências anatômicas descritas
• Eletromiografia: frequência de amostragem (Hz), filtros, normalização (% CVIM)

FISIOTERAPIA RESPIRATÓRIA E INTENSIVA:
• Parâmetros ventilatórios: PaO2, PaCO2, SpO2, VT, FR, PEEP em valores absolutos + referência normal
• Índice de Tobin (f/VT): critério de desmame ≤ 105 (TOBIN et al., 1986)
• Teste de Caminhada de 6 Minutos (TC6M): protocolo ATS 2002 (ATS COMMITTEE, 2002)

FONOAUDIOLOGIA:
• Audiometria: citar limiares em dBNA por frequência; timpanometria; emissões otoacústicas (EOAE)
• Classificação de perda auditiva: "Classificação de Davis e Silverman (1970) adaptada"
• Linguagem: escalas ABFW (Andrade et al.), PPVT, Vineland
• Disfagia: escala FOIS (Functional Oral Intake Scale), protocolo ASHA NOMS`

    // ──────────────────────────────────────────────────────────────────────────
    case 'nutricao':
      return HEADER('NUTRIÇÃO E CIÊNCIAS DOS ALIMENTOS') + `
ESTRUTURA: IMRAD para estudos clínicos e experimentais; análise sensorial e análise laboratorial seguem protocolos específicos.

AVALIAÇÃO NUTRICIONAL:
• Antropometria: peso (kg), altura (m), IMC (kg/m²), circunferência da cintura (cm), % gordura corporal (DEXA preferível)
• Classificação IMC: OMS (2000) para adultos; WHO 2007 para crianças/adolescentes (IOTF para sobrepeso)
• Consumo alimentar: Recordatório 24h (R24h), Questionário de Frequência Alimentar (QFA) — citar versão e validação
• Software de análise nutricional: DietBox, DietSmart, NutriHome, TACO (Tabela Brasileira de Composição de Alimentos — NEPA-UNICAMP, 2011)
• Sempre verificar: Dietary Reference Intakes (DRI/IOM) para recomendações nutricionais

ANÁLISE DE ALIMENTOS (Ciência dos Alimentos):
• Métodos analíticos: referenciar métodos AOAC, AOCS, IAL (Instituto Adolfo Lutz, 2008), INMETRO
• Análise proximal: umidade (%), cinzas (%), proteínas (Kjeldahl; N × fator), lipídios (Soxhlet), carboidratos (por diferença), fibra alimentar (AOAC 991.43)
• Análise sensorial: escala hedônica (1–9), teste de aceitação, IDC (Índice de Aceitabilidade ≥ 70%)
• Atividade de água (Aw), pH, acidez titulável, sólidos solúveis (°Brix)
• Bioacessibilidade e biodisponibilidade: método in vitro de digestão simulada

LEGISLAÇÃO E REGULAMENTAÇÃO:
• ANVISA: RDC nº 216/2004 (alimentos), RDC nº 360/2003 (rotulagem nutricional), IN MAPA nº XXX
• Codex Alimentarius: CODEX STAN, Codex HACCP — citar número e ano
• CFN (Conselho Federal de Nutricionistas): Resolução CFN nº 600/2018 (atribuições do nutricionista)
• Tabela TACO: NEPA-UNICAMP, 2011 — sempre citar a versão usada

INQUÉRITOS NUTRICIONAIS NACIONAIS:
• POF (Pesquisa de Orçamentos Familiares): (IBGE, 2019) — para consumo alimentar
• VIGITEL (Vigilância de Fatores de Risco e Proteção para Doenças Crônicas): (MS, 2023)
• PNSN, PNS: especificar o ano da pesquisa`

    // ──────────────────────────────────────────────────────────────────────────
    case 'veterinaria':
      return HEADER('MEDICINA VETERINÁRIA E ZOOTECNIA') + `
ESTRUTURA: Artigos usam IMRAD ("Material e Métodos" para zootecnia). Relatos clínicos seguem CARE veterinário.

ÉTICA NO USO DE ANIMAIS (OBRIGATÓRIO):
• CEUA (Comitê de Ética no Uso de Animais): número do protocolo CEUA deve constar no trabalho
• Lei Federal nº 11.794/2008 (Lei Arouca) e Resolução CONCEA
• Bem-estar animal: "5 liberdades" — citar Farm Animal Welfare Council (FAWC, 1979)
• NÃO aceito descrever procedimentos sem mencionar aprovação do CEUA

DELINEAMENTO EXPERIMENTAL (ZOOTECNIA):
• Especificar: DIC, DBC, fatorial (NxK tratamentos × repetições)
• Espécie, raça/linhagem, sexo, idade, peso vivo inicial, status sanitário
• Instalações: dimensões do galpão/baias, densidade animal (m²/animal ou aves/m²)
• Dieta: composição calculada + análise bromatológica real; normas NRC (National Research Council)
• ANOVA + Tukey (p<0,05); software SISVAR, SAS, R

CLÍNICA VETERINÁRIA:
• Exames físicos: frequência cardíaca (bpm), frequência respiratória (mpm), temperatura retal (°C), TPC (seg), mucosas
• Valores de referência: por espécie (bovino, equino, canino, felino) — sempre citar o autor dos valores de referência
• Diagnóstico por imagem: ultrassonografia (MHz do transdutor), radiografia (kV, mAs, FFD), tomografia (slice, kV, mAs)
• Terapêutica: nome genérico + dose (mg/kg) + via + frequência + duração + referência farmacológica

PRODUÇÃO ANIMAL:
• Índices zootécnicos: GPD (g/dia), CA (conversão alimentar), consumo (g ou kg/dia), peso ao abate (kg), rendimento de carcaça (%)
• Qualidade da carne: pH (45min e 24h), cor (CIELab), maciez (força de cisalhamento — Warner-Bratzler)
• Sanidade: vacinação, vermifugação, ectoparasiticidas — referenciar programa sanitário adotado`

    // ──────────────────────────────────────────────────────────────────────────
    case 'ciencias_florestais':
      return HEADER('CIÊNCIAS FLORESTAIS E ENGENHARIA FLORESTAL') + `
ESTRUTURA: Artigos seguem IMRAD; TCCs e dissertações frequentemente incluem "Revisão de Literatura" + "Material e Métodos" + "Resultados e Discussão".

INVENTÁRIO FLORESTAL:
• Delinear parcelas: tamanho (ha), forma (circular, retangular), número, intensidade amostral (%)
• DAP (Diâmetro à Altura do Peito, 1,30m): medir com fita diamétrica; citar CAP se usado (CAP = DAP × π)
• Altura total vs. comercial: método de medição (hipsômetro, clinômetro, TruPulse) — citar
• Índice de sítio (IS): qualidade produtiva do sítio; curvas de índice de sítio por espécie

SILVICULTURA E MANEJO:
• Espaçamento: m × m; densidade de plantio (arv/ha); desbaste (% retirado por intervenção)
• IMA (Incremento Médio Anual) e ICA (Incremento Corrente Anual) em m³/ha/ano
• Turno de rotação: especificar espécie e finalidade; Pinus, Eucalyptus (E. grandis, E. urophylla × grandis): citar cultivar
• Equações de volume: citar autor e modelo (Schumacher-Hall, Spurr, Husch); critério de seleção (Syx%, R²adj)

LICENÇAS E REGULAMENTAÇÃO:
• SISBIO (ICMBio): licença para coleta de material em áreas federais — número da licença
• IBAMA: autorização para manejo de espécies reguladas
• SINAFLOR: documentação de procedência madeireira
• Código Florestal (Lei nº 12.651/2012): Área de Preservação Permanente (APP), Reserva Legal (RL)

QUALIDADE DA MADEIRA:
• Densidade básica (g/cm³), teor de umidade (%), contração volumétrica (%)
• Módulo de Elasticidade (MOE) e Módulo de Ruptura (MOR) em flexão estática
• Análise química: celulose, lignina, extrativos — métodos TAPPI/NBR ABNT
• Papel e celulose: rendimento depurado (%), número Kappa, viscosidade intrínseca`

    // ──────────────────────────────────────────────────────────────────────────
    case 'direito':
      return HEADER('CIÊNCIAS JURÍDICAS — DIREITO') + `
ESTRUTURA OBRIGATÓRIA (NÃO usar IMRAD em trabalhos jurídicos):
• TCC/Monografia: Introdução → Desenvolvimento (capítulos temáticos) → Considerações Finais → Referências
• Artigo jurídico: Introdução → Desenvolvimento (seções numeradas) → Conclusão → Referências
• NÃO existe "Material e Métodos", "Resultados" ou "Discussão" isolados em trabalhos jurídicos

FONTES DO DIREITO — hierarquia e como citar (ABNT):
• LEGISLAÇÃO:
  BRASIL. [Órgão]. Lei nº XXXX, de DD de mês de AAAA. [Ementa]. Diário Oficial [da União], Brasília, DF, DD mês AAAA.
  In-text: (BRASIL, 2018) ou "nos termos do art. 5º, X, da LGPD (BRASIL, 2018)"
• CONSTITUIÇÃO:
  BRASIL. [Constituição (1988)]. Constituição da República Federativa do Brasil. Brasília, DF: Senado Federal, 1988.
  In-text: (BRASIL, 1988) | cite artigo e inciso: "art. 37, caput, da CF (BRASIL, 1988)"
• JURISPRUDÊNCIA (acórdãos):
  STJ/STF/TJ[UF]. [Tipo de recurso] nº XXXX/[UF]. Relator: [Min./Des.] SOBRENOME, Nome. Data de julgamento. Órgão julgador.
  In-text: (STJ, 2023) | cite no texto: "...conforme entendimento do STJ (2023)"
• DOUTRINA: (SOBRENOME, ANO, p. X) para citação com página — OBRIGATÓRIO em citações diretas

LINGUAGEM JURÍDICA PRECISA:
• "consoante o disposto no" / "nos termos do" / "à luz de" / "em consonância com"
• "pacificado pela jurisprudência" / "controvertido na doutrina" / "posicionamento majoritário"
• Diferenciar: doutrina (autores acadêmicos) ≠ jurisprudência (decisões) ≠ legislação (normas)
• Nota de rodapé: use para citações diretas longas, posições doutrinárias alternativas, referências complementares`

    // ──────────────────────────────────────────────────────────────────────────
    case 'educacao':
      return HEADER('EDUCAÇÃO E PEDAGOGIA') + `
ESTRUTURA (variável):
• Pesquisa qualitativa: Introdução → Referencial Teórico → Metodologia → Análise e Discussão → Conclusão
• Pesquisa quantitativa: Introdução → Revisão de Literatura → Metodologia → Resultados → Discussão → Conclusão
• Pesquisa-ação: contextualização → diagnóstico → planejamento → ação → reflexão → conclusão

DOCUMENTOS LEGAIS — citar com precisão:
• BNCC: (BRASIL, 2017) = Ed. Básica | (BRASIL, 2018) = Ensino Médio — não confundir
• LDB: "Lei nº 9.394/1996 (BRASIL, 1996)" — Lei de Diretrizes e Bases da Educação Nacional
• PNE 2014-2024: (BRASIL, 2014) — metas e estratégias
• Resolução CNE/CP nº 2/2019: formação de professores (substituiu a de 2015)
• Estatuto da Criança e do Adolescente — ECA (BRASIL, 1990): pesquisa com menores

REFERENCIAIS TEÓRICOS (citar obras específicas):
• Paulo Freire: Pedagogia do Oprimido (FREIRE, 1987) ou Pedagogia da Autonomia (FREIRE, 1996)
• Vygotsky: A Formação Social da Mente (VYGOTSKY, 2007); Pensamento e Linguagem (VYGOTSKY, 2008)
• Piaget: A Equilibração das Estruturas Cognitivas (PIAGET, 1975)
• Bourdieu e Passeron: A Reprodução (BOURDIEU; PASSERON, 2014)
• Saviani: Pedagogia Histórico-Crítica (SAVIANI, 2012)
• Apple, Giroux: pedagogia crítica; Morin: pensamento complexo

ÉTICA COM MENORES (obrigatório):
• TCLE: consentimento do responsável legal
• Assentimento do menor (para crianças com capacidade de compreensão, ≥7 anos)
• Resolução CNS 466/2012 + Resolução CNS 510/2016 (pesquisas ciências humanas e sociais)

AVALIAÇÃO E INDICADORES:
• SAEB, SARESP, ENEM, IDEB, PISA: cite fonte e ano — ex: (INEP, 2023)
• Desempenho: escala de proficiência por componente e nível de ensino`

    // ──────────────────────────────────────────────────────────────────────────
    case 'agronomia':
      return HEADER('AGRONOMIA E CIÊNCIAS AGRÁRIAS') + `
ESTRUTURA PADRÃO:
Introdução → Material e Métodos → Resultados e Discussão → Conclusão(ões)
• "Material e Métodos" — não apenas "Métodos" (inclui materiais físicos e biológicos)
• "Resultados e Discussão" geralmente unidos nos periódicos agronômicos brasileiros

DELINEAMENTO EXPERIMENTAL:
• Especificar: DIC, DBC (mais comum), DQL, fatorial (AxB × repetições)
• Número mínimo de repetições: 4 para ensaios de campo; 5+ para experimentos em vasos
• Parcela experimental: m² de área total, área útil (excluindo bordaduras), plantas por parcela

ANÁLISE ESTATÍSTICA:
• ANOVA: reportar F calculado, F tabelado e significância (ns = não significativo; * p<0,05; ** p<0,01; *** p<0,001)
• Teste de médias: Tukey 5% (≤5 tratamentos) ou Scott-Knott (>5 tratamentos); Dunnet vs controle
• Regressão: para fatores quantitativos (doses, espaçamentos, concentrações)
• CV% obrigatório: < 10% excelente; 10–20% bom; 20–30% tolerável em campo; > 30% alto
• Software: SISVAR (FERREIRA, 2014) — citar; R + agricolae; SAS
• Letras nas tabelas: médias seguidas da MESMA letra não diferem estatisticamente

CULTIVARES E ESPÉCIES:
• Nome científico: itálico, autoridade na 1ª menção — ex: Glycine max (L.) Merr.
• Cultivar: aspas simples + registro MAPA/RNC — ex: 'BRS 505' (Registro MAPA nº XXXX; EMBRAPA, 2018)
• Nunca abreviar na 1ª ocorrência; depois: G. max (abreviação aceita)

DADOS AGROMETEOROLÓGICOS E DE SOLO:
• Temperatura (°C), precipitação (mm), ETP (mm), umidade relativa (%), insolação (h/dia)
• Fonte: estação INMET ou EMBRAPA mais próxima; código da estação
• Solo: classificação SiBCS — EMBRAPA (2018) — ex: "Latossolo Vermelho distroférrico"
• Análise química: pH CaCl2, MO (g/dm³), P, K, Ca, Mg, Al (mmolc/dm³ ou mg/dm³)

UNIDADES E EXPRESSÕES:
• Produtividade: kg/ha ou sc/ha (1 sc = 60 kg para soja, milho, trigo, café)
• Fertilizantes: kg/ha de N, P2O5, K2O (não do produto comercial — sempre do nutriente)
• Defensivos: g/ha de i.a. (ingrediente ativo) ou L/ha do produto comercial

CITAÇÕES INSTITUCIONAIS:
• Embrapa: (EMBRAPA, 2023); MAPA: (BRASIL. Ministério da Agricultura, 2023)
• CONAB: (CONAB, 2024) — dados de safra e área plantada
• IBGE: (IBGE, 2023) — Censo Agropecuário, PAM (Produção Agrícola Municipal)`

    // ──────────────────────────────────────────────────────────────────────────
    case 'engenharia':
      return HEADER('ENGENHARIA E CIÊNCIAS TECNOLÓGICAS') + `
ESTRUTURA:
• Artigo experimental: Introdução → Materiais e Métodos → Resultados e Discussão → Conclusão
• TCC de projeto: Introdução → Revisão Bibliográfica → Desenvolvimento → Resultados → Conclusão

NORMAS TÉCNICAS (SEMPRE citar ao referenciar requisitos ou limites):
• ABNT NBR: "conforme ABNT NBR 6118:2023"
  Referência: ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. ABNT NBR XXXX: Título. Rio de Janeiro: ABNT, Ano.
  In-text: (ABNT, 2023) ou (ABNT NBR 6118, 2023)
• ISO: "segundo ISO 9001:2015" → in-text: (ISO, 2015)
• IEEE, ASTM, DIN, BS: formato similar ao ABNT

EQUAÇÕES (rigor obrigatório):
• Numerar: (1), (2), (3) — referenciar no texto: "a Equação (1) mostra..."
• Definir TODAS as variáveis imediatamente após a equação com unidades SI
• Unidades SI obrigatórias; justificar uso de unidades alternativas

SOFTWARES (citar versão + desenvolvedor):
• ANSYS Mechanical (ANSYS Inc.) | MATLAB (MathWorks) | AutoCAD (Autodesk)
• SAP2000 (CSI) | COMSOL Multiphysics (COMSOL AB) | SolidWorks (Dassault)
• Python: citar bibliotecas com versão — ex: NumPy 1.24 (HARRIS et al., 2020)

MATERIAIS:
• Especificar grau/norma: "aço CA-50 (ABNT NBR 7480:2007)"
• Concreto: fck [MPa], fcd [MPa], módulo de elasticidade [GPa]
• Incerteza de medição: ± valor com IC definido; fator de cobertura k = 2 para IC 95%

ANÁLISE ESTATÍSTICA:
• DOE (Design of Experiments): fatorial, Plackett-Burman, Taguchi, superfície de resposta
• ANOVA: F-test, valor-p, CV; Métricas de qualidade: Cp, Cpk (Six Sigma)`

    // ──────────────────────────────────────────────────────────────────────────
    case 'arquitetura':
      return HEADER('ARQUITETURA, URBANISMO E DESIGN URBANO') + `
ESTRUTURA (diversa — depende da natureza do trabalho):
• TCC de projeto: memorial descritivo + justificativa técnica + projeto desenhado
• TCC de pesquisa: Introdução → Revisão → Metodologia → Análise → Conclusão
• Dissertação: pode incluir produto (projeto ou plano urbanístico) + dissertação textual

PRODUTO TÉCNICO COMO CONTRIBUIÇÃO:
• Projetos arquitetônicos e planos urbanísticos são contribuições acadêmicas equivalentes a artigos
• Memorial justificativo: explicar partido arquitetônico, programa de necessidades, zoneamento, circulação
• Documentação técnica: plantas (escala definida), cortes, elevações, perspectivas, maquetes (físicas ou 3D)
• Normas de representação: ABNT NBR 6492 (representação de projetos de arquitetura), NBR 8196 (tolerâncias)

NORMAS TÉCNICAS OBRIGATÓRIAS:
• NBR 9050:2020: acessibilidade — citar quando tratar de acessibilidade universal
• NBR 15575:2013: desempenho de edificações habitacionais — citar por parte (1 a 6)
• NBR 15220: desempenho térmico — zonas bioclimáticas
• NBR 5626, 5648, 7198: instalações prediais hidráulicas e sanitárias
• Código de Obras do município: citar número e data da lei municipal
• Plano Diretor: citar número e ano do município analisado

ANÁLISE URBANA E AMBIENTAL:
• Escala: definir escala de análise (metropolitana, municipal, bairro, lote)
• Mapas: indicar datum (SIRGAS 2000), escala, fonte dos dados (IBGE, INCRA, secretarias)
• Software SIG: QGIS (versão + CRS) ou ArcGIS — citar
• Levantamento fotográfico: data da visita de campo, coordenadas GPS
• Índice de aproveitamento, taxa de ocupação, gabarito: definir conforme legislação local

CITAÇÕES ESPECÍFICAS:
• Arquitetos e obras: "Corbusier (1923/2012)" quando citar texto; obra arquitetônica: ficha técnica (autor, ano, local)
• Vitruvius, Archdaily: literatura cinzenta — usar com critério; preferir periódicos arbitrados
• Periódicos de referência: Arquitetura Revista (UNISINOS), Pós (USP), ARQTEXTO (UFRGS)`

    // ──────────────────────────────────────────────────────────────────────────
    case 'design':
      return HEADER('DESIGN — GRÁFICO, INDUSTRIAL, PRODUTO, UX/UI, MODA') + `
ESTRUTURA:
• TCC de projeto: briefing → pesquisa → conceito → desenvolvimento → protótipo → testes → produto final
• TCC de pesquisa: Introdução → Fundamentação → Metodologia → Análise → Conclusão
• Relatório de projeto: memorial do processo criativo + documentação técnica do produto

METODOLOGIA EM DESIGN:
• Processo de design: citar modelo adotado — Double Diamond (Design Council, 2005), Design Thinking (Brown, 2008), Metodologia de Munari (MUNARI, 1998), processo de Archer (ARCHER, 1965)
• Human-Centered Design: ISO 9241-210:2019 (processo centrado no ser humano)
• Testes com usuários: protocolos de usabilidade (Nielsen Norman Group), Teste A/B, think-aloud protocol
• Pesquisa aplicada: autoetnografia, prática reflexiva (SCHÖN, 1983), pesquisa em poética

PRODUTO COMO CONTRIBUIÇÃO:
• O produto de design (logo, produto, interface, coleção) É contribuição acadêmica
• Documentar o processo: sketchbooks, wireframes, protótipos de baixa/alta fidelidade, testes de usabilidade
• Desenho técnico: ABNT NBR 10126 (cotas), NBR 10582 (apresentação de desenho)

USABILIDADE E UX (para Design Digital):
• Heurísticas de Nielsen (1994): citar na análise de interfaces
• SUS (System Usability Scale; BROOKE, 1996): escore > 68 = acima da média
• WCAG 2.1: acessibilidade digital — nível A, AA, AAA
• Métricas: tempo de tarefa, taxa de erros, taxa de conclusão, satisfação (SUS)

MATERIAIS E PROCESSOS PRODUTIVOS:
• Especificar material e normas: "ABNT NBR 14936 para tintas" ou "ISO 105 para solidez da cor em têxteis"
• Sustentabilidade: Life Cycle Assessment (LCA); Cradle to Cradle; Design para desmontagem
• Impressão: especificar perfis de cor (ICC profiles), resolução (dpi), suporte, acabamentos`

    // ──────────────────────────────────────────────────────────────────────────
    case 'psicologia':
      return HEADER('PSICOLOGIA') + `
FORMATO DE CITAÇÃO: APA 7ª Edição (OBRIGATÓRIO)
• 1 autor: (Sobrenome, Ano) | 2 autores: (Sobrenome & Sobrenome, Ano) | 3+: (Sobrenome et al., Ano)
• Citação direta: (Sobrenome, Ano, p. X) — página OBRIGATÓRIA
• Referência: Sobrenome, N. N. (Ano). Título em itálico. Editora. https://doi.org/xxx

ESTRUTURA (APA IMRAD): Introdução → Método → Resultados → Discussão → Conclusão
• Método: participantes + instrumentos + procedimento + análise de dados
• "Participantes" (não "sujeitos" — terminologia APA atual)

DIAGNÓSTICOS E CLASSIFICAÇÕES:
• DSM-5 (APA, 2013) e DSM-5-TR (APA, 2022) — cite código diagnóstico
• CID-11 (WHO, 2022) — ex: "TAG (F41.1; WHO, 2022)"
• Não diagnosticar com base em escalas de rastreio (PHQ-9, BAI, BDI) — são triagem, não diagnóstico

ÉTICA:
• CFP Resolução nº 016/2000: normas de pesquisa; CFP Resolução nº 010/2010: uso de tecnologias
• CEP obrigatório; sigilo profissional; dados identificados protegidos por senha
• Consentimento informado: TCLE + declaração do pesquisador

INSTRUMENTOS:
• Nome completo + referência original + adaptação ao português
  Ex: "BAI (Beck et al., 1988; adaptação brasileira: Cunha, 2001)"
• Parâmetros psicométricos: validade (evidências por conteúdo, critério, constructo) + confiabilidade (α ≥ 0,70)
• Verificar lista de instrumentos aprovados pelo CFP (Resolução 009/2018)

ESTATÍSTICA (além do p-value):
• d de Cohen: pequeno=0,2; médio=0,5; grande=0,8 — OBRIGATÓRIO
• η² (eta quadrado) para ANOVA; r para correlação; R² para regressão
• Potência estatística: mínimo 80% (1-β ≥ 0,80) — reportar
• Software: JASP (gratuito, recomendado para iniciantes), R, SPSS`

    // ──────────────────────────────────────────────────────────────────────────
    case 'administracao':
      return HEADER('ADMINISTRAÇÃO, CONTABILIDADE E ECONOMIA') + `
ESTRUTURA: Variável — estudo de caso (Yin, 2015), survey, bibliometria, pesquisa-ação, análise de conteúdo.

FRAMEWORKS E MODELOS (citar com rigor):
• Porter (1985): Vantagem Competitiva; Forças Competitivas — citar edição
• Kaplan & Norton (1992): BSC — Harvard Business Review, v.70, n.1, p.71-79
• Osterwalder & Pigneur (2011): Business Model Canvas — citar livro
• SWOT, PESTEL, cadeia de valor: mencionar origem teórica ao usar

FONTES DE DADOS:
• IBGE: PIA, Censo, PMC, PNAD — citar pesquisa específica + ano
• Banco Central: BACEN — taxas de juros, câmbio, relatórios de inflação (BACEN, Ano)
• CVM: dados de empresas de capital aberto — acessar via CVM.gov.br
• Receita Federal, ANS, ANAC, ANTT: dados regulatórios por setor

ANÁLISE FINANCEIRA:
• VPL, TIR, Payback simples e descontado: fórmulas + taxa de desconto justificada
• WACC: custo médio ponderado de capital — CAPM para custo do equity
• EVA, ROE, ROA, EBITDA: definir siglas na 1ª ocorrência

VALIDADE E CONFIABILIDADE (surveys):
• Alfa de Cronbach ≥ 0,70; AVE ≥ 0,50; CR ≥ 0,70
• PLS-SEM: referenciar Hair et al. (2022); CB-SEM: Hair et al. (2019)

LEGISLAÇÃO:
• CLT (BRASIL, 1943); Lei das S.A. (BRASIL, 1976); Código Civil (BRASIL, 2002)
• Normas CPC (Comitê de Pronunciamentos Contábeis): CPC 00 = estrutura conceitual, etc.
• IFRS: normas IASB — especificar número e versão`

    // ──────────────────────────────────────────────────────────────────────────
    case 'comunicacao':
      return HEADER('COMUNICAÇÃO, JORNALISMO, PUBLICIDADE E CINEMA') + `
ESTRUTURA: Variável por subárea e abordagem. Trabalhos práticos incluem produto + relatório/memorial.

PRODUTO COMUNICACIONAL COMO CONTRIBUIÇÃO:
• Peças publicitárias, reportagens, curtas-metragens, podcasts, sites, campanhas: são produtos acadêmicos
• Memorial: justificar escolhas editoriais, estéticas e éticas do produto
• Análise de recepção: grupo focal, entrevistas, análise de audiência

ANÁLISE DE CONTEÚDO E DISCURSO:
• Análise de conteúdo: protocolo de Bardin (2016) — pré-análise, exploração, inferência
• Análise do discurso: especificar corrente (Análise Crítica do Discurso — Fairclough; AD francesa — Orlandi)
• Análise fílmica: identificar objeto (narrativa, linguagem, montagem), método e referencial teórico
• Análise de redes sociais digitais: coletor (Twitter API, Netlytic), período, critério de seleção dos posts

ÉTICA EM JORNALISMO E PUBLICIDADE:
• Código de Ética dos Jornalistas Brasileiros (FENAJ, 2007)
• Código Brasileiro de Autorregulamentação Publicitária (CONAR, 1980)
• LGPD (BRASIL, 2018): uso de dados de audiência e redes sociais
• Fontes jornalísticas: proteger identidade quando necessário; citar anonimamente com justificativa

REFERÊNCIAS ESPECÍFICAS:
• Obras audiovisuais: DIRETOR, Nome. Título do filme. Produção: [empresa], Ano. Suporte (DVD, streaming).
• Programas de TV/rádio: identificar emissora, data, horário de veiculação
• Posts em redes sociais: NOME DO USUÁRIO. [post]. Plataforma, data. Disponível em: URL. Acesso: DD mês AAAA.
• Periódicos de referência: Brazilian Journalism Research, Conexão Comunicação e Cultura, Galáxia`

    // ──────────────────────────────────────────────────────────────────────────
    case 'servico_social':
      return HEADER('SERVIÇO SOCIAL') + `
ESTRUTURA: Geralmente qualitativa — Introdução → Referencial Teórico → Metodologia → Análise → Conclusão.

FUNDAMENTOS TEÓRICOS:
• Projeto ético-político do Serviço Social: referenciar Netto (1999), Iamamoto (2001), Yazbek (2004)
• Código de Ética do/a Assistente Social (CFESS, 2011/2012) — direitos e deveres profissionais
• Lei de Regulamentação da Profissão (Lei nº 8.662/1993) — competências e atribuições privativas

POLÍTICAS SOCIAIS (citações obrigatórias):
• SUAS (Sistema Único de Assistência Social): PNAS 2004 (BRASIL, 2004); SUAS (BRASIL, 2005)
• CRAS, CREAS, Centro-POP: Tipificação Nacional de Serviços Socioassistenciais (MDS, 2009)
• SUS: citar Lei nº 8.080/1990 e Lei nº 8.142/1990
• ECA: Lei nº 8.069/1990 (BRASIL, 1990) — para trabalho com crianças e adolescentes
• Estatuto do Idoso: Lei nº 10.741/2003 (BRASIL, 2003)
• BPC, Bolsa Família/CadÚnico: decretos específicos com número e ano

PESQUISA EM SERVIÇO SOCIAL:
• Abordagem crítico-dialética: referenciar Marx, Engels, Lukács, Gramsci
• Metodologia qualitativa predominante: entrevista em profundidade, observação participante
• Pesquisa documental: prontuários sociais, relatórios institucionais (com sigilo quando necessário)
• Ética com usuários vulneráveis: resolução CNS 466/2012 + 510/2016 (ciências humanas e sociais)
• Não usar linguagem capacitista, racista, classista, lgbtfóbica — revise o texto com lente interseccional`

    // ──────────────────────────────────────────────────────────────────────────
    case 'biologia':
      return HEADER('CIÊNCIAS BIOLÓGICAS — BIOLOGIA, ECOLOGIA, GENÉTICA, BOTÂNICA, ZOOLOGIA') + `
ESTRUTURA: IMRAD para artigos experimentais. Revisões seguem PRISMA ou revisão sistemática adaptada.

NOMENCLATURA CIENTÍFICA (obrigatório):
• ICN (International Code of Nomenclature) para plantas e fungos; ICZN para animais
• Primeira menção: nome científico completo em itálico + autoridade + ano
  Ex: Tyrannus melancholicus Vieillot, 1819 (ave); Bidens pilosa L. (planta)
• Subsequentes: gênero abreviado — ex: T. melancholicus
• Status taxonômico atual: verificar em ITIS, WoRMS (fauna marinha), Flora do Brasil 2020

ÉTICA E LICENÇAS (obrigatório para pesquisa de campo):
• SISBIO (ICMBio): licença para coleta em áreas federais — número da licença no artigo
• IBAMA: autorização para espécies reguladas (fauna silvestre)
• CEUA: aprovação para uso de animais em laboratório — número do protocolo
• Povos indígenas / quilombolas: CONEP + consulta prévia (Lei nº 12.343/2010)

BIODIVERSIDADE E ECOLOGIA:
• Riqueza (S), abundância (N), diversidade: índice de Shannon (H'), Simpson (D), Evenness de Pielou (J')
• Softwares: PAST (Hammer et al., 2001), EstimateS (Colwell, 2013), R + vegan
• Curva de rarefação: esforço amostral vs. riqueza observada
• Espécies ameaçadas: classificação IUCN + Portaria MMA 148/2022 (fauna) ou 443/2014 (flora)
• Registrar coordenadas GPS (datum SIRGAS 2000, formato decimal): lat/long com 4 decimais

GENÉTICA E BIOLOGIA MOLECULAR:
• Sequências depositadas no GenBank/NCBI: citar número de acesso (ex: GenBank MZ123456)
• Primers: sequência 5'→3', Tm (°C), concentração final (μM), referência ou origem
• PCR: produto amplificado (pb), temperatura de annealing, Taq (fabricante, U/reação)
• Análises filogenéticas: modelo de substituição (ModelTest), método (ML, Bayesiano — MrBayes), suporte (bootstrap ≥ 70 ou PP ≥ 0,95)

CITAÇÕES: Vancouver (periódicos como Nature, Science, PLoS ONE) ou ABNT (periódicos brasileiros). Verificar instrução do periódico.`

    // ──────────────────────────────────────────────────────────────────────────
    case 'ciencias_ambientais':
      return HEADER('CIÊNCIAS AMBIENTAIS, ECOLOGIA APLICADA E SUSTENTABILIDADE') + `
ESTRUTURA: Variável — IMRAD para estudos empíricos; relatórios técnicos para EIA/RIMA.

AVALIAÇÃO DE IMPACTO AMBIENTAL:
• EIA (Estudo de Impacto Ambiental): estrutura definida pela Resolução CONAMA nº 1/1986 e nº 237/1997
• RIMA (Relatório de Impacto ao Meio Ambiente): linguagem acessível; versão resumida do EIA
• Zoneamento Ambiental: Código Florestal (Lei nº 12.651/2012); APP, Reserva Legal, Área Rural Consolidada

LEGISLAÇÃO AMBIENTAL (citar rigorosamente):
• Política Nacional do Meio Ambiente: Lei nº 6.938/1981 (BRASIL, 1981)
• CONAMA: resolução específica com número e ano — ex: "CONAMA nº 357/2005: qualidade das águas"
• Política Nacional de Resíduos Sólidos: Lei nº 12.305/2010 (BRASIL, 2010)
• IBAMA, ICMBio, FUNAI: citar quando relevante ao licenciamento ou à pesquisa
• ODS (Objetivos de Desenvolvimento Sustentável): ONU (2015) — citar ODS específico (1 a 17)

MONITORAMENTO E QUALIDADE AMBIENTAL:
• Parâmetros de água: pH, OD (mg/L), DBO5 (mg/L), DQO (mg/L), turbidez (NTU), coliformes (UFC/100mL)
• Ar: PM2,5 e PM10 (μg/m³); NO₂, SO₂, CO, O₃ — limites CONAMA nº 491/2018
• Solo: textura, pH, matéria orgânica, metais pesados (mg/kg) — valores orientadores CONAMA nº 420/2009
• Ruído: dB(A); limites NBR 10151:2019 e NBR 10152:2017

ANÁLISE ESPACIAL E GEOPROCESSAMENTO:
• Software SIG: QGIS + sistema de referência (SIRGAS 2000) — sempre declarar
• Imagens de satélite: satélite, sensor, data, resolução espacial, fonte (INPE, USGS, ESA)
• Uso e cobertura da terra: classificação MapBiomas (versão + ano de referência)
• Serviços ecossistêmicos: referenciar TEEB (The Economics of Ecosystems and Biodiversity) ou InVEST (Natural Capital Project)`

    // ──────────────────────────────────────────────────────────────────────────
    case 'humanas':
      return HEADER('FILOSOFIA, LETRAS, LINGUÍSTICA E LITERATURA') + `
ESTRUTURA (temática/argumentativa — sem IMRAD):
Introdução (problema filosófico/literário, hipótese, estrutura) → Desenvolvimento (seções temáticas) → Conclusão

ANÁLISE FILOSÓFICA:
• Análise conceitual: definir todos os termos técnicos centrais com precisão na introdução
• Exegese: interpretação fiel; cite passagens com edição crítica + paginação
  Ex: KANT, I. Crítica da Razão Pura. Trad. Manuela Santos e Alexandre Morujão. Lisboa: Gulbenkian, 2001. A 51/B 75.
  In-text: (KANT, 1781/2001, A 51/B 75) — [ano original/tradução + paginação Akademie]
• Hermenêutica: princípio do círculo hermenêutico — parte → todo → parte
• Fenomenologia: epochê (suspensão do juízo), intencionalidade, correlato noético-noemático
• Termos em idioma estrangeiro: em itálico + tradução na 1ª ocorrência — ex: "o Dasein [ser-aí]"
• Máximas latinas: em itálico — ex: tabula rasa, a priori, cogito ergo sum

ANÁLISE LITERÁRIA:
• Teoria literária adotada: nomear corrente + autores — New Criticism, Estruturalismo, Pós-colonialismo, Feminismo
• Close reading: análise detalhada com justificativa da escolha das passagens analisadas
• Intertextualidade: KRISTEVA (1969); Palimpsestes — GENETTE (1982)
• Corpus: definir corpus textual analisado + critério de seleção
• Edições: citar tradução usada; para textos clássicos, preferir edição crítica reconhecida

LINGUÍSTICA:
• Corpus linguístico: tamanho em tokens, fonte, software (AntConc, Sketch Engine)
• Análise do discurso: especificar corrente — AD francesa (ORLANDI, 2015) ou CDA (FAIRCLOUGH, 2003)
• Fonética: IPA (International Phonetic Alphabet) para transcrições
• Gramática: especificar modelo — gerativa, funcionalista, cognitivista

NOTA DE RODAPÉ (uso específico em humanidades):
• Citações diretas longas que complementam sem interromper o argumento
• Debates interpretativos alternativos: "Para perspectiva divergente, cf. X (Ano, p.Y)"
• NÃO colocar conteúdo essencial ao argumento em notas`

    // ──────────────────────────────────────────────────────────────────────────
    case 'historia':
      return HEADER('HISTÓRIA, ARQUEOLOGIA E MUSEOLOGIA') + `
ESTRUTURA: Problematização → Fontes (primárias + secundárias) → Análise e interpretação → Conclusão.

FONTES PRIMÁRIAS (identificação obrigatória):
• Documentos de arquivo: fundo + caixa/maço + número do documento + local + data
  Ex: ARQUIVO NACIONAL. Fundo Ministério da Justiça. Caixa 145. Rio de Janeiro, 15 mar. 1922.
• Jornais e periódicos históricos: título + edição + data + página + acervo (Hemeroteca Digital BN, etc.)
• Fontes orais: pseudônimo do entrevistado + perfil (gênero, idade, ocupação, localidade, data)
  Ex: (ENTREVISTADA A, 67 anos, agricultora, Ouro Preto-MG, abr. 2024)
• Fotografias: fotógrafo (se conhecido), data, localização, acervo + número de catalogação
• Legislação histórica: identificar como fonte primária, distinguir de doutrina histórica

METODOLOGIA HISTÓRICA:
• Heurística: levantamento e localização das fontes
• Crítica externa (autenticidade) e interna (confiabilidade): aplicar às fontes primárias
• Hermenêutica histórica: contextualização do documento em seu tempo e lugar
• História oral: métodos de Bom Meihy (2005) ou Portelli (2010) — citar
• Periodização: justificar os marcos temporais escolhidos com base historiográfica

APORTES TEÓRICOS:
• Annales: Bloch, Febvre, Braudel — especificar obra
• Nova História Cultural: Chartier, Ginzburg, Le Goff — especificar obra e conceito
• História Social: Thompson (2004 — A formação da classe operária inglesa); Hobsbawm
• História das Mulheres e de Gênero: Perrot, Scott (1989 — Gênero como categoria de análise)
• Decolonialismo: Quijano, Mignolo, Mbembe — contextualizar o uso

ARQUEOLOGIA (especificidades):
• Licença IPHAN para escavações: portaria específica + número de processo
• Relatório de Arqueologia: obrigatório para empreendimentos com licenciamento ambiental (Portaria IPHAN 230/2002)
• Datação: 14C (C14), TL, OSL — reportar laboratório, amostra, resultado ± erro padrão`

    // ──────────────────────────────────────────────────────────────────────────
    case 'geografia':
      return HEADER('GEOGRAFIA — FÍSICA, HUMANA, CARTOGRAFIA E GEOPROCESSAMENTO') + `
ESTRUTURA: Variável — IMRAD para pesquisas empíricas; análise territorial ou ambiental para trabalhos de campo.

GEOPROCESSAMENTO E CARTOGRAFIA:
• Sistema de Referência Coordenadas (SRC): SIRGAS 2000 (padrão brasileiro) — sempre declarar
• Datum e projeção: UTM (zona) ou geográfica (lat/long decimal) — especificar
• Software SIG: QGIS 3.xx ou ArcGIS 10.x — citar versão
• Imagens de satélite: satélite + sensor + data + resolução espacial + fonte
  Ex: "Imagem Landsat-8, sensor OLI, de 15/06/2023, resolução 30m, USGS Earth Explorer"
• Dados IBGE: citar base cartográfica e ano — ex: "Malha municipal IBGE, 2022"
• MapBiomas: citar coleção e ano — ex: "MapBiomas Coleção 8, bioma Cerrado, 2022"

TRABALHO DE CAMPO:
• Registrar: data(s) da visita, coordenadas GPS dos pontos de coleta (SIRGAS 2000, decimal)
• Equipamentos: GPS (modelo + precisão em metros), estação total, drone (modelo + resolução)
• Observações in loco: descrever condições climáticas e sazonalidade

CLIMATOLOGIA E HIDROLOGIA:
• Dados climáticos: estação INMET mais próxima + código + série histórica (mín. 30 anos para normais climatológicas)
• Temperatura: anotar mínima, média e máxima (°C) | Precipitação: total mensal e anual (mm)
• Bacias hidrográficas: denominar segundo IBGE/ANA; Unidade de Gerenciamento de Recursos Hídricos (UGRHI) ou código Otto

GEOMORFOLOGIA E PEDOLOGIA:
• Relevo: denominar segundo Classificação do Relevo Brasileiro (IBGE, 2009)
• Declividade: % ou graus; classificação (plano < 3%, suave ondulado 3–8%, etc.)
• Solos: Sistema Brasileiro de Classificação de Solos — SiBCS (EMBRAPA, 2018)
• Processos erosivos: Equação Universal de Perda de Solo (USLE/RUSLE) — citar autores e parâmetros

CITAÇÕES EM GEOGRAFIA: ABNT predominante. Bases: Scopus, Web of Science, Periódicos CAPES, ANPEGE.`

    // ──────────────────────────────────────────────────────────────────────────
    case 'teologia':
      return HEADER('TEOLOGIA E CIÊNCIAS DA RELIGIÃO') + `
ESTRUTURA: Varia por tradição e abordagem — exegética, sistemática, histórica, pastoral, comparativa.

HERMENÊUTICA BÍBLICA (Teologia bíblica):
• Análise histórico-crítica: autoria, datação, contexto histórico, gênero literário
• Métodos exegéticos: análise gramatical, análise literária (estrutura, figuras de linguagem, intertextualidade)
• Texto bíblico: citar versão/tradução usada — ex: "A Bíblia. Trad. João Ferreira de Almeida. Edição Revista e Corrigida. SBB, 2015"
  No corpo: (Jo 3:16, ARC) ou (Rm 8:28, NVI) — [livro cap:versículo, sigla da versão]
• Línguas originais: hebraico (AT) e grego koiné (NT) — usar transliteração padrão SBL quando citar termos originais

TEOLOGIA SISTEMÁTICA:
• Dogmática: apresentar a posição teológica + referências aos credos e confissões históricas
  Ex: "conforme o Credo de Niceia (325 d.C.)" ou "Confissão de Augsburgo (1530)"
• Citar teólogos clássicos: Agostinho, Tomás de Aquino, Calvino, Lutero, Barth, Von Balthasar — com obras específicas
• Concílios e documentos magisteriais (para Teologia Católica): ex: GS (Gaudium et Spes), LG (Lumen Gentium)
• Encíclicas papais: ex: Laudato Si' (FRANCISCO, 2015); Fides et Ratio (JOÃO PAULO II, 1998)

CIÊNCIAS DA RELIGIÃO (abordagem fenomenológica/sociológica):
• Distinguir: Teologia (confessional, de dentro da tradição) ≠ Ciências da Religião (acadêmica, comparativa)
• Autores fundadores: Eliade (2010), Durkheim (2000), Weber (2004), van der Leeuw, Geertz
• Fenomenologia da religião: Rudolf Otto (O Sagrado, 1917/2007)
• Não impor julgamentos de valor sobre as tradições estudadas — objetividade acadêmica

CITAÇÕES: ABNT para periódicos brasileiros de Teologia (Horizonte, REVER, Teocomunicação). Chicago para periódicos internacionais.`

    // ──────────────────────────────────────────────────────────────────────────
    case 'ciencias_sociais':
      return HEADER('CIÊNCIAS SOCIAIS — SOCIOLOGIA, ANTROPOLOGIA, CIÊNCIA POLÍTICA E RELAÇÕES INTERNACIONAIS') + `
ESTRUTURA: Variável — sociologia quantitativa (IMRAD-like); sociologia qualitativa e antropologia (capítulos temáticos); ciência política (análise comparada ou estudos de caso).

CLÁSSICOS FUNDADORES (citar com rigor):
• MARX, K.; ENGELS, F. O Capital (1867/2013) | A Ideologia Alemã (1846/2007)
• DURKHEIM, É. As Regras do Método Sociológico (1895/2007) | O Suicídio (1897/2000)
• WEBER, M. A Ética Protestante e o Espírito do Capitalismo (1905/2004) | Economia e Sociedade (1921/2009)
• BOURDIEU, P. A Distinção (1979/2007) | Capital Cultural, Escola e Espaço Social (1996/2014)
• FOUCAULT, M. Vigiar e Punir (1975/2014) | A Ordem do Discurso (1971/2012)
• GIDDENS, A. A Constituição da Sociedade (1984/2009) | Modernidade e Identidade (1991/2002)
• HALL, S. A Identidade Cultural na Pós-modernidade (1992/2006)
• Para citações com obra específica: SOBRENOME (Ano original/Ano tradução usada, p. X)

FONTES PRIMÁRIAS (antropologia e sociologia qualitativa):
• Entrevistas: identificar com pseudônimo + perfil (gênero, idade, ocupação, localidade, data)
• Observação participante: período de campo (meses/anos), técnicas de registro, diário de campo
• Documentos: fundo de arquivo, data, catalogação — ex: "Arquivo Público do Estado de SP, Fundo DEOPS, pasta 142, fl. 3"
• Dados secundários: IBGE (PNAD, Censo, POF), IPEA, MDS — citar pesquisa + ano

ÉTICA NA PESQUISA:
• CNS Resolução 510/2016: pesquisas em ciências humanas e sociais — citar CONEP/CEP conforme exigência
• Povos indígenas: CONEP + consulta prévia, livre e informada (OIT Conv. 169; BRASIL, 2004)
• Quilombolas: consulta à comunidade e CONAQ ou INCRA
• Sigilo: dados identificados protegidos; LGPD (BRASIL, 2018) para dados pessoais digitais

CIÊNCIA POLÍTICA:
• Análise comparada: MSSD (Most Similar Systems) vs MDSD (Most Different Systems)
• Teoria da democracia: Dahl, Habermas, Rawls, Mouffe — citar obra específica
• Processo Tracing: métodos de Van Evera (1997) ou Beach & Pedersen (2013)
• Dados eleitorais: TSE (dados.tse.jus.br), Câmara dos Deputados, IDEA Internacional

RELAÇÕES INTERNACIONAIS:
• Teorias: Realismo (Waltz, Mearsheimer), Liberalismo institucional (Keohane, Nye), Construtivismo (Wendt), Escola Inglesa (Bull)
• Organizações: ONU, OEA, Mercosul — citar tratados e resoluções com número e ano
• Tratados: identificar como fonte primária do direito internacional`

    // ──────────────────────────────────────────────────────────────────────────
    case 'fisica':
      return HEADER('FÍSICA — EXPERIMENTAL, TEÓRICA E APLICADA') + `
ESTRUTURA: IMRAD para artigos experimentais. Artigos teóricos: Introdução → Desenvolvimento (com equações) → Conclusão.

RIGOR MATEMÁTICO E FORMAL:
• Equações: numeradas (1), (2)... — referenciar no texto como "Equação (1)" ou "Eq. (1)"
• Definir TODAS as variáveis imediatamente após a equação com unidades SI
• Teoremas e demonstrações formais (física teórica): marcar início e fim (□)
• Notação consistente: vetores em negrito ou com seta (→); matrizes em negrito maiúsculo

UNIDADES E MEDIÇÕES:
• Sistema Internacional (SI) obrigatório; se usar unidades CGS ou naturais, declarar explicitamente
• Propagação de incertezas: método quadrático (ISO/IEC GUM) — reportar como valor ± incerteza (k=2, IC 95%)
• Algarismos significativos: consistente com a incerteza da medição
• Constantes físicas: CODATA 2018 — citar source quando usar valores específicos

SOFTWARES E FERRAMENTAS:
• Python: NumPy, SciPy, Matplotlib, Astropy — citar versão e referência
• ROOT (CERN): para análise de física de partículas (BRUN; RADEMAKERS, 1997)
• COMSOL, ANSYS Fluent: simulação de campos (EM, fluídica)
• LabVIEW (NI): aquisição de dados — citar versão

FÍSICA DE PARTÍCULAS E ASTROFÍSICA:
• Valores de referência: Particle Data Group (PDG, 2022) — Phys. Rev. D
• Dados astronômicos: NASA/IPAC, ESA, SIMBAD, VizieR — citar catálogo + versão
• Observatórios: LIGO, Hubble, JWST, Gemini — identificar instrumento e programa de observação

CITAÇÕES: Physical Review Letters (PRL), PRL, Phys. Rev., Nature Physics, etc. usam numeral [1],[2] (estilo APS).`

    // ──────────────────────────────────────────────────────────────────────────
    case 'quimica':
      return HEADER('QUÍMICA — ANALÍTICA, ORGÂNICA, INORGÂNICA, FÍSICO-QUÍMICA') + `
ESTRUTURA: IMRAD para artigos experimentais. "Materiais e Métodos" — não apenas "Métodos".

NOMENCLATURA E IDENTIFICAÇÃO (IUPAC):
• Nome sistemático IUPAC + sigla/nome comum entre parênteses na 1ª menção
  Ex: "ácido acetilsalicílico (AAS; aspirin)" ou "cloreto de sódio (NaCl)"
• Número CAS: identificar quando relevante — ex: "etanol (CAS 64-17-5)"
• Reagentes: grau de pureza + fabricante + lote relevante para reprodutibilidade
  Ex: "metanol (99,9% pureza, J.T.Baker, Lote XXXX)"
• Solventes deuterados (RMN): especificar — CDCl₃, D₂O, DMSO-d₆

MÉTODOS ANALÍTICOS:
• Espectroscopia UV-Vis: comprimento de onda (nm), ε molar (L·mol⁻¹·cm⁻¹), solvente, instrumento
• RMN (¹H, ¹³C): frequência (MHz), solvente, referência interna (TMS, DSS), δ (ppm), multiplicidade (s, d, t, m), J (Hz)
• HPLC/UPLC: coluna (fabricante, dimensões, tamanho de partícula), fase móvel, gradiente, vazão, detector, λ
• GC-MS: coluna (tipo, comprimento), carrier gas, temperatura inicial/final, rampa (°C/min), ionização (EI, CI), m/z
• IR/FTIR: número de onda (cm⁻¹), ATR vs KBr, principais absorções

SÍNTESE E PREPARAÇÃO:
• Rendimento (%): obrigatório para sínteses
• Ponto de fusão (°C): para sólidos — confirmar pureza
• Rotação óptica: [α]²⁰D (c = X, solvente) para compostos quirais
• Purificação: recristalização (solvente/mistura) ou cromatografia (suporte, eluente, Rf)

ELETROQUÍMICA E MATERIAIS:
• Eletrodos: material de trabalho, referência (Ag/AgCl, ECS, NHE), contração (área geométrica, cm²)
• Voltametria cíclica: velocidade de varredura (mV/s), janela de potencial (V), eletrólito (mol/L)
• Caracterização: XRD (ângulo 2θ, radiação Cu Kα), BET (área superficial, m²/g), TEM/SEM (kV, magnificação)

CITAÇÕES: American Chemical Society (ACS) style para periódicos internacionais; ABNT para brasileiros.`

    // ──────────────────────────────────────────────────────────────────────────
    case 'geociencias':
      return HEADER('GEOCIÊNCIAS — GEOLOGIA, GEOTECNIA, OCEANOGRAFIA E METEOROLOGIA') + `
ESTRUTURA: IMRAD para artigos científicos; relatórios técnicos seguem estrutura da ABNT NBR 10719.

GEOLOGIA:
• Nomenclatura estratigráfica: Código Estratigráfico Norte-Americano (NACSN) ou Guia Estratigráfico Internacional
• Idades geológicas: IUGS International Chronostratigraphic Chart — citar versão/ano
• Amostras: identificar com número de campo, coordenadas GPS (SIRGAS 2000), datum, datum vertical
• Análises petrográficas: microscópio polarizante, objetiva, aspectos texturais e mineralógicos
• Geoquímica: ICP-OES, ICP-MS, XRF — especificar laboratório, limites de detecção, padrões usados

GEOTECNIA E MECÂNICA DOS SOLOS:
• Ensaios de campo: SPT (ABNT NBR 6484:2020), CPT (ABNT NBR 12069:1991), vane test
• Classificação de solos: ABNT NBR 6502:1995 + SUCS (Sistema Unificado) + ABNT NBR 7181/7180/6459
• Fundações: ABNT NBR 6122:2019; recalques e capacidade de carga: método(s) usados
• Ensaios de laboratório: granulometria, limites de Atterberg, compressão simples, triaxial

HIDROLOGIA E HIDROGEOLOGIA:
• Bacias hidrográficas: sistema de codificação ANA (Otto Pfafstetter) — código da bacia
• Outorga de água: número do processo SIGAM/ANA ou órgão estadual
• Dados fluviométricos: estação + código HIDROWEB/ANA; série histórica usada (início-fim)
• Aquíferos: SAG (Sistema Aquífero Guarani), Bauru, etc. — citar referência do mapa hidrogeológico

OCEANOGRAFIA E METEOROLOGIA:
• Dados oceanográficos: SECOS, Copernicus Marine Service (CMEMS), HYCOM, PO.DAAC (NASA)
• Dados meteorológicos: INMET (rede de estações), NOAA, ERA5 (Reanalysis)
• Modelo numérico: ROMS, RegCM, WRF — versão, configuração, parametrizações, fonte dos dados de contorno
• Correntes: OSCAR, drifters (NOAA/AOML); temperatura da superfície do mar (TSM): satélite + sensor + resolução`

    // ──────────────────────────────────────────────────────────────────────────
    case 'exatas':
      return HEADER('CIÊNCIAS EXATAS — MATEMÁTICA, COMPUTAÇÃO E ESTATÍSTICA') + `
ESTRUTURA:
• Matemática (pura): Definição → Lema → Proposição/Teorema → Demonstração → Corolário
• Computação: Introdução → Trabalhos Relacionados → Proposta → Experimentos → Resultados → Conclusão
• Estatística: Introdução → Referencial Metodológico → Aplicação → Discussão → Conclusão

RIGOR MATEMÁTICO (obrigatório):
• Definir TODA notação antes de usá-la: "Seja G = (V, E) um grafo simples não-direcionado..."
• Provas: marcar início (Demonstração: ou Prova:) e fim (□ ou ∎)
• Teoremas, Lemas, Proposições, Corolários: numerados sequencialmente
• Equações: numeradas (1), (2) — referenciar no texto

COMPUTAÇÃO — EXPERIMENTOS:
• Hardware: CPU, RAM, SO — para reprodutibilidade
• Seed de aleatoriedade: fixar e reportar
• Métricas de classificação: accuracy, precision, recall, F1-score, AUC-ROC, PR-AUC
• Métricas de regressão: RMSE, MAE, R², MAPE
• Múltiplas execuções: média ± desvio padrão com n execuções declarado
• Código: disponibilizar em repositório público (GitHub) com DOI via Zenodo

SOFTWARES E BIBLIOTECAS (sempre citar versão):
• Python 3.11 (VAN ROSSUM; DRAKE, 2023)
• NumPy 1.24 (HARRIS et al., 2020, Nature 585:357–362)
• Scikit-learn 1.3 (PEDREGOSA et al., 2011, JMLR 12:2825–2830)
• PyTorch 2.0 (PASZKE et al., 2019, NeurIPS)
• TensorFlow 2.13 (ABADI et al., 2015, arXiv:1603.04467)
• R 4.3.x (R CORE TEAM, Ano): especificar pacote + versão

COMPLEXIDADE ALGORÍTMICA:
• Big O notation: O(n), O(n log n), O(n²) — análise de pior caso
• Análise de complexidade de espaço quando relevante
• Comparar com algoritmos state-of-the-art da literatura

CITAÇÕES: IEEE (numeral [1]) para computação; AMS para matemática; ABNT para periódicos brasileiros.`

    // ──────────────────────────────────────────────────────────────────────────
    case 'turismo':
      return HEADER('TURISMO, HOTELARIA E GESTÃO DE EVENTOS') + `
ESTRUTURA: Variável — pesquisa de campo, estudo de caso, pesquisa documental, survey.

FUNDAMENTOS TEÓRICOS:
• Turismo: Jafari (1977), Krippendorf (2009), Urry (1990, Olhar do turista)
• Hospitalidade: Camargo (2004), Lashley & Morrison (2000)
• Sustentabilidade: OMT/UNWTO (Organização Mundial do Turismo) — citar publicação específica
• Planejamento turístico: MTur (Ministério do Turismo), Plano Nacional de Turismo

FONTES DE DADOS:
• MTur: Estudo da Demanda Turística Internacional (ano), Anuário Estatístico de Turismo
• IBGE: MUNIC, Pesquisa de Serviços de Hospedagem (PSH)
• EMBRATUR: dados de fluxo turístico internacional
• RAIS/MTE: emprego no setor de turismo e hotelaria
• TripAdvisor, Booking.com, Google Reviews: dados de avaliação online (pesquisa de satisfação)

METODOLOGIA:
• Pesquisa de satisfação: escala Likert (1–5 ou 1–7), NPS (Net Promoter Score), SERVQUAL (Parasuraman, 1988)
• Perfil do turista: procedência, motivação, meios de hospedagem, gasto médio (R$/dia)
• Carrying capacity: capacidade de carga turística (física, real, efetiva) — método Cifuentes (1992)
• Análise SWOT para destinos turísticos: referenciar Porter ou Wheelen & Hunger (2002)
• Observação participante: descrever período, técnicas, registro (diário de campo, fotografias)

TERMINOLOGIA TÉCNICA:
• Distinguir: atrativo turístico (natural, cultural, histórico) ≠ produto turístico (combinação de atrativos + infraestrutura + serviços)
• Receptivo vs. emissivo; turismo de massa vs. turismo alternativo/sustentável
• MTUR: Categorização dos meios de hospedagem — Portaria MTE nº 100/2011 (estrelas)
• Agência: full service, operadora, consolidadora — distinções legais (Lei nº 12.974/2014)`

    // ──────────────────────────────────────────════════════════════════════════
    case 'geral':
    default:
      return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS GERAIS DE ESCRITA CIENTÍFICA DE EXCELÊNCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ABNT NBR 6023:2018 para referências; NBR 10520:2023 para citações in-text
• Toda afirmação factual da literatura = citação imediata
• Estrutura: adaptar às convenções da área e tipo de trabalho
• Consulte as normas do periódico/instituição alvo antes de submeter`
  }
}
