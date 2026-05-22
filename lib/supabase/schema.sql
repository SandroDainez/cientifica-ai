-- ============================================================
-- CIENTÍFICA AI — Schema do Banco de Dados
-- Execute no Supabase > SQL Editor
-- ============================================================

-- PERFIS DE USUÁRIO
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  instituicao TEXT,
  nivel_academico TEXT, -- graduacao, especializacao, mestrado, doutorado, professor
  area_conhecimento TEXT,
  orientador_nome TEXT,
  orientador_email TEXT,
  lattes TEXT,
  orcid TEXT,
  nivel_experiencia TEXT DEFAULT 'iniciante', -- iniciante, intermediario, avancado
  formato_citacao_padrao TEXT DEFAULT 'abnt',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRABALHOS CIENTÍFICOS
CREATE TABLE trabalhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  titulo TEXT,
  tipo_trabalho TEXT NOT NULL,
  -- tcc | artigo_original | artigo_revisao | relato_caso | monografia
  -- dissertacao_mestrado | tese_doutorado | revisao_sistematica
  -- projeto_pesquisa | relatorio_ic
  area_conhecimento TEXT,
  subarea TEXT,
  formato_citacao TEXT DEFAULT 'abnt', -- abnt | vancouver | apa
  instituicao_destino TEXT,
  tem_orientador BOOLEAN DEFAULT FALSE,
  orientador TEXT,
  nivel_experiencia TEXT DEFAULT 'iniciante',
  status TEXT DEFAULT 'em_andamento', -- em_andamento | concluido | arquivado
  fase_atual TEXT DEFAULT 'configuracao',
  fases_concluidas JSONB DEFAULT '[]',
  dados_trabalho JSONB DEFAULT '{}',
  metadados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEÇÕES DO TRABALHO
CREATE TABLE secoes_trabalho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id UUID REFERENCES trabalhos(id) ON DELETE CASCADE NOT NULL,
  nome_secao TEXT NOT NULL,
  chave_secao TEXT NOT NULL, -- ex: 'tema', 'objetivos', 'metodologia'
  ordem INTEGER NOT NULL,
  conteudo TEXT,
  conteudo_ia TEXT,
  conteudo_usuario TEXT,
  status TEXT DEFAULT 'pendente', -- pendente | gerando | gerado | editado | aprovado
  sugestoes_ia JSONB DEFAULT '[]',
  metadados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REFERÊNCIAS BIBLIOGRÁFICAS
CREATE TABLE referencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id UUID REFERENCES trabalhos(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL, -- artigo | livro | capitulo_livro | site | tese | dissertacao | lei | norma | anais
  titulo TEXT NOT NULL,
  autores JSONB,
  ano INTEGER,
  journal TEXT,
  volume TEXT,
  numero TEXT,
  paginas TEXT,
  doi TEXT,
  pmid TEXT,
  url TEXT,
  isbn TEXT,
  issn TEXT,
  editora TEXT,
  cidade TEXT,
  dados_extras JSONB DEFAULT '{}',
  referencia_formatada_abnt TEXT,
  referencia_formatada_vancouver TEXT,
  referencia_formatada_apa TEXT,
  confiabilidade TEXT DEFAULT 'alta', -- alta | media | baixa
  fonte_tipo TEXT, -- pubmed | crossref | openalex | manual
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMITÊ DE ÉTICA
CREATE TABLE comite_etica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id UUID REFERENCES trabalhos(id) ON DELETE CASCADE NOT NULL UNIQUE,
  envolve_seres_humanos BOOLEAN DEFAULT FALSE,
  envolve_animais BOOLEAN DEFAULT FALSE,
  tipo_pesquisa TEXT,
  titulo_projeto TEXT,
  pesquisador_responsavel TEXT,
  instituicao_proponente TEXT,
  patrocinador TEXT,
  pais_recrutamento TEXT DEFAULT 'Brasil',
  areas_tematicas JSONB DEFAULT '[]',
  resumo_projeto TEXT,
  objetivo_primario TEXT,
  justificativa TEXT,
  metodologia TEXT,
  criterios_inclusao TEXT,
  criterios_exclusao TEXT,
  tamanho_amostra INTEGER,
  procedimentos TEXT,
  riscos TEXT,
  beneficios TEXT,
  termo_consentimento TEXT,
  dados_plataforma_brasil JSONB DEFAULT '{}',
  numero_caae TEXT,
  status_cep TEXT DEFAULT 'pendente', -- pendente | submetido | aprovado | necessita_revisao
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DADOS PRISMA (Revisão Sistemática)
CREATE TABLE prisma_dados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id UUID REFERENCES trabalhos(id) ON DELETE CASCADE NOT NULL UNIQUE,
  bases_pesquisadas JSONB DEFAULT '[]',
  registros_identificados INTEGER DEFAULT 0,
  registros_duplicados INTEGER DEFAULT 0,
  registros_triagem INTEGER DEFAULT 0,
  registros_excluidos_titulo INTEGER DEFAULT 0,
  textos_completos_avaliados INTEGER DEFAULT 0,
  textos_excluidos INTEGER DEFAULT 0,
  motivos_exclusao JSONB DEFAULT '[]',
  estudos_incluidos INTEGER DEFAULT 0,
  criterios_inclusao TEXT,
  criterios_exclusao TEXT,
  estrategia_busca TEXT,
  data_busca DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COLETA DE DADOS
CREATE TABLE coleta_dados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id UUID REFERENCES trabalhos(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- questionario | formulario_coleta | planilha | checklist
  descricao TEXT,
  campos JSONB DEFAULT '[]',
  arquivo_gerado_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHAT COM IA
CREATE TABLE chat_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabalho_id UUID REFERENCES trabalhos(id) ON DELETE CASCADE NOT NULL,
  secao TEXT,
  mensagens JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS — updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_trabalhos_updated_at BEFORE UPDATE ON trabalhos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_secoes_updated_at BEFORE UPDATE ON secoes_trabalho FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_comite_updated_at BEFORE UPDATE ON comite_etica FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_prisma_updated_at BEFORE UPDATE ON prisma_dados FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_chat_updated_at BEFORE UPDATE ON chat_ia FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabalhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE secoes_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE comite_etica ENABLE ROW LEVEL SECURITY;
ALTER TABLE prisma_dados ENABLE ROW LEVEL SECURITY;
ALTER TABLE coleta_dados ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_ia ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "perfil_proprio" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "trabalhos_proprios" ON trabalhos FOR ALL USING (auth.uid() = usuario_id);
CREATE POLICY "secoes_proprias" ON secoes_trabalho FOR ALL USING (
  trabalho_id IN (SELECT id FROM trabalhos WHERE usuario_id = auth.uid())
);
CREATE POLICY "referencias_proprias" ON referencias FOR ALL USING (
  trabalho_id IN (SELECT id FROM trabalhos WHERE usuario_id = auth.uid())
);
CREATE POLICY "etica_propria" ON comite_etica FOR ALL USING (
  trabalho_id IN (SELECT id FROM trabalhos WHERE usuario_id = auth.uid())
);
CREATE POLICY "prisma_proprio" ON prisma_dados FOR ALL USING (
  trabalho_id IN (SELECT id FROM trabalhos WHERE usuario_id = auth.uid())
);
CREATE POLICY "coleta_propria" ON coleta_dados FOR ALL USING (
  trabalho_id IN (SELECT id FROM trabalhos WHERE usuario_id = auth.uid())
);
CREATE POLICY "chat_proprio" ON chat_ia FOR ALL USING (
  trabalho_id IN (SELECT id FROM trabalhos WHERE usuario_id = auth.uid())
);

-- ============================================================
-- FUNÇÃO: criar perfil automaticamente ao cadastrar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
