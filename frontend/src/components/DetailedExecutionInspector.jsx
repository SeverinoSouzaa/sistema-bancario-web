import React, { useState } from 'react';
import {
  GitCommit,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronLeft,
  RotateCw,
  Sliders,
  Code,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function DetailedExecutionInspector({
  diagnostic,
  treeType = 'avl', // 'avl' or 'rb'
  onHighlightKey = null
}) {
  const [activeTabSubtree, setActiveTabSubtree] = useState('depois'); // 'antes' | 'depois'
  const [activeStepIndex, setActiveStepIndex] = useState(null);

  const diag = treeType === 'avl' ? diagnostic?.avl : diagnostic?.rubro_negra;
  const op = diagnostic?.operacao;

  if (!diag) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-white border-l border-slate-200">
        <Sliders className="w-8 h-8 mb-2 text-slate-300" />
        <p className="text-xs font-semibold text-slate-600">Nenhuma operação analisada</p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
          Realize uma inserção ou remoção para inspecionar os passos de rebalanceamento da árvore.
        </p>
      </div>
    );
  }

  const passos = diag.passos || [];
  const selectedStep = activeStepIndex !== null && passos[activeStepIndex]
    ? passos[activeStepIndex]
    : passos[passos.length - 1];

  return (
    <aside className="w-96 border-l border-slate-200 bg-white flex flex-col h-full shrink-0 select-none overflow-hidden shadow-xs z-10">
      {/* Inspector Header */}
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {treeType === 'avl' ? 'AVL' : 'RN'}
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 leading-tight">
              Inspetor de Execução Detalhada
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              Edital AED II · Seção 2.4 Passo a Passo
            </p>
          </div>
        </div>

        {/* Rebalance Status Pill */}
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
            diag.houve_rebalanceamento
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {diag.houve_rebalanceamento ? 'Rebalanceada' : 'Equilibrada'}
        </span>
      </div>

      {/* Inspector Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Card: Operação Recente */}
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Última Ação
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {op?.timestamp || '--:--:--'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {op?.tipo === 'INSERCAO'
                  ? `Inserção de Conta #${op.chave}`
                  : op?.tipo === 'REMOCAO'
                  ? `Remoção de Conta #${op.chave}`
                  : 'Cenário Pré-definido'}
              </span>
            </div>
            {op?.chave > 0 && onHighlightKey && (
              <button
                type="button"
                onClick={() => onHighlightKey(op.chave)}
                className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium transition-colors"
              >
                Focar Nó
              </button>
            )}
          </div>
        </div>

        {/* Card: Diagnóstico do Caso Teórico */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              Caso Identificado
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {diag.caso}
            </span>
          </div>

          {treeType === 'avl' ? (
            /* Detalhes AVL */
            <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Nó Desbalanceado:</span>
                <b className="font-mono text-slate-900">
                  {diag.no_desbalanceado ? `Conta #${diag.no_desbalanceado}` : 'Nenhum'}
                </b>
              </div>
              <div className="flex justify-between">
                <span>Fator de Balanceamento:</span>
                <b className="font-mono text-slate-900">
                  {diag.fb_detectado !== null ? `FB = ${diag.fb_detectado}` : 'Normal (|FB| ≤ 1)'}
                </b>
              </div>
              <div className="flex justify-between">
                <span>Tipo de Rotação:</span>
                <span className="font-medium text-slate-800 text-right">
                  {diag.tipo_rotacao}
                </span>
              </div>
              {diag.no_promovido && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Nova Raiz Local:</span>
                  <span className="font-mono font-bold">Conta #{diag.no_promovido}</span>
                </div>
              )}
            </div>
          ) : (
            /* Detalhes Rubro-Negra */
            <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
              {diag.no_conflito && (
                <div className="flex justify-between">
                  <span>Conflito Vermelho:</span>
                  <span className="font-mono font-bold text-rose-600">
                    Nó #{diag.no_conflito} & Pai #{diag.pai}
                  </span>
                </div>
              )}
              {diag.tio && (
                <div className="flex justify-between">
                  <span>Cor do Tio (#{diag.tio}):</span>
                  <b className={`font-mono ${diag.cor_tio === 'VERMELHO' ? 'text-rose-600' : 'text-slate-800'}`}>
                    {diag.cor_tio}
                  </b>
                </div>
              )}
              <div className="flex justify-between">
                <span>Estratégia Aplicada:</span>
                <span className="font-medium text-slate-800 text-right">
                  {diag.tipo_acao}
                </span>
              </div>

              {/* Tabela de Recolorações */}
              {diag.recoloracoes && diag.recoloracoes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                    Recolorações Efetuadas:
                  </p>
                  <div className="space-y-1">
                    {diag.recoloracoes.map((rec, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-[11px] p-1.5 rounded-md bg-slate-50 border border-slate-200"
                      >
                        <span className="font-medium text-slate-700">
                          {rec.papel} #{rec.chave}
                        </span>
                        <div className="flex items-center gap-1.5 font-bold font-mono">
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              rec.nova_cor === 'VERMELHO'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-slate-900 text-white'
                            }`}
                          >
                            {rec.nova_cor}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card: Stepper Interativo de Passos */}
        {passos.length > 0 && (
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Sequência de Passos
              </span>
              <span className="text-[10px] font-medium text-slate-400">
                {passos.length} etapa{passos.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Stepper Navigation Pills */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {passos.map((p, idx) => {
                const isSelected = activeStepIndex === idx || (activeStepIndex === null && idx === passos.length - 1);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveStepIndex(idx)}
                    className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    P{p.ordem}
                  </button>
                );
              })}
            </div>

            {/* Step Detail Card */}
            {selectedStep && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 transition-all">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">
                    {selectedStep.ordem}
                  </span>
                  <span>{selectedStep.titulo}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pl-5">
                  {selectedStep.descricao}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Card: Subárvore Antes x Depois (Código Original) */}
        {(diag.subarvore_antes || diag.subarvore_depois) && (
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Estrutura Local Afetada
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200 text-[10px] font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTabSubtree('antes')}
                  className={`px-2 py-0.5 rounded-sm transition-all ${
                    activeTabSubtree === 'antes' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500'
                  }`}
                >
                  Antes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabSubtree('depois')}
                  className={`px-2 py-0.5 rounded-sm transition-all ${
                    activeTabSubtree === 'depois' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500'
                  }`}
                >
                  Depois
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-[10px] overflow-x-auto whitespace-pre leading-tight shadow-inner">
              {activeTabSubtree === 'antes'
                ? diag.subarvore_antes || '(Subárvore pré-operação não registrada)'
                : diag.subarvore_depois || '(Subárvore pós-operação não registrada)'}
            </div>
            <p className="text-[10px] text-slate-400 italic">
              Renderizado diretamente pelo algoritmo congelado do backend_original.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
