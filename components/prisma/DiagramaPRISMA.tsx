'use client'

interface PrismaNumeros {
  identificados: number
  duplicados: number
  apos_remocao: number
  excluidos_titulo: number
  textos_avaliados: number
  textos_excluidos: number
  estudos_incluidos: number
}

interface Props {
  numeros: PrismaNumeros
}

function Caixa({ label, valor, destaque = false, cor = 'bg-blue-50 border-blue-200' }: {
  label: string; valor: number; destaque?: boolean; cor?: string
}) {
  return (
    <div className={`rounded-lg border-2 px-4 py-3 text-center min-w-[160px] ${cor}`}>
      <p className={`text-2xl font-bold ${destaque ? 'text-primary' : 'text-gray-900'}`}>{valor}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </div>
  )
}

function Seta({ horizontal = false }: { horizontal?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${horizontal ? 'flex-row' : 'flex-col'}`}>
      <div className={`bg-gray-400 ${horizontal ? 'h-0.5 w-8' : 'w-0.5 h-6'}`} />
      {horizontal ? (
        <div className="border-l-4 border-l-gray-400 border-y-4 border-y-transparent h-0 w-0" />
      ) : (
        <div className="border-t-4 border-t-gray-400 border-x-4 border-x-transparent w-0 h-0" />
      )}
    </div>
  )
}

export function DiagramaPRISMA({ numeros }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px] flex flex-col items-center gap-0 py-4">

        {/* IDENTIFICAÇÃO */}
        <div className="w-full flex flex-col items-center">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Identificação</div>
          <div className="flex items-center gap-6">
            <Caixa label="Registros identificados nas bases" valor={numeros.identificados} cor="bg-blue-50 border-blue-300" />
            <div className="flex flex-col items-center gap-1">
              <Seta horizontal />
              <Caixa label="Registros duplicados removidos" valor={numeros.duplicados} cor="bg-gray-50 border-gray-300" />
            </div>
          </div>
        </div>

        <Seta />

        {/* TRIAGEM */}
        <div className="w-full flex flex-col items-center">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Triagem</div>
          <div className="flex items-center gap-6">
            <Caixa label="Registros após remoção de duplicatas" valor={numeros.apos_remocao} cor="bg-blue-50 border-blue-300" />
            <div className="flex flex-col items-center gap-1">
              <Seta horizontal />
              <Caixa label="Excluídos por título/resumo" valor={numeros.excluidos_titulo} cor="bg-red-50 border-red-200" />
            </div>
          </div>
        </div>

        <Seta />

        {/* ELEGIBILIDADE */}
        <div className="w-full flex flex-col items-center">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Elegibilidade</div>
          <div className="flex items-center gap-6">
            <Caixa label="Textos completos avaliados" valor={numeros.textos_avaliados} cor="bg-blue-50 border-blue-300" />
            <div className="flex flex-col items-center gap-1">
              <Seta horizontal />
              <Caixa label="Textos excluídos (com motivo)" valor={numeros.textos_excluidos} cor="bg-red-50 border-red-200" />
            </div>
          </div>
        </div>

        <Seta />

        {/* INCLUSÃO */}
        <div className="w-full flex flex-col items-center">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Inclusão</div>
          <Caixa
            label="Estudos incluídos na revisão"
            valor={numeros.estudos_incluidos}
            destaque
            cor="bg-green-50 border-green-400"
          />
        </div>

      </div>
    </div>
  )
}
