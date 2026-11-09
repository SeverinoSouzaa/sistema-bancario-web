import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  FastForward,
  Rewind
} from 'lucide-react';

export default function DetailedExecutionInspector({
  diagnostic,
  treeType = 'avl', // 'avl' or 'rb'
  onSelectStep = null,
  onResetToFinal = null
}) {
  const diag = treeType === 'avl' ? diagnostic?.avl : diagnostic?.rubro_negra;
  const op = diagnostic?.operacao;
  const passos = diag?.passos || [];

  // Active step index (defaults to the last step, showing the final tree)
  const [activeStepIndex, setActiveStepIndex] = useState(passos.length > 0 ? passos.length - 1 : 0);

  // Signature of the operation currently inspected
  const currentOpSignature = `${op?.tipo || 'NONE'}_${op?.chave || 0}_${op?.timestamp || ''}_${treeType}`;
  const lastOpSignatureRef = useRef('');

  // Only reset to final step when a NEW operation occurs or treeType changes
  // Prevents background polling from resetting the user's manual step inspection
  useEffect(() => {
    if (passos.length > 0) {
      if (lastOpSignatureRef.current !== currentOpSignature) {
        lastOpSignatureRef.current = currentOpSignature;
        const finalIndex = passos.length - 1;
        setActiveStepIndex(finalIndex);
        if (onSelectStep) {
          onSelectStep(passos[finalIndex]);
        }
      }
    }
  }, [currentOpSignature, passos.length, onSelectStep]);

  const handleStepChange = (idx) => {
    if (idx < 0 || idx >= passos.length) return;
    setActiveStepIndex(idx);
    if (onSelectStep) {
      onSelectStep(passos[idx]);
    }
  };

  if (!diag) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-white border-l border-slate-200">
        <Info className="w-8 h-8 mb-2 text-slate-300" />
        <p className="text-xs font-semibold text-slate-600">Nenhuma operação analisada</p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
          Realize uma inserção ou encerramento de conta para inspecionar os passos de balanceamento.
        </p>
      </div>
    );
  }

  const currentStep = passos[activeStepIndex] || passos[passos.length - 1];

  return (
    <aside className="w-96 border-l border-slate-200 bg-white flex flex-col h-full shrink-0 select-none overflow-hidden shadow-xs z-10">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {treeType === 'avl' ? 'AVL' : 'RN'}
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 leading-tight">
              {treeType === 'avl' ? 'Inspetor de Rebalanceamento' : 'Inspetor de Casos & Cores'}
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              Passo a Passo Interativo da Operação
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
            diag.houve_rebalanceamento
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {diag.houve_rebalanceamento ? 'Rebalanceamento' : 'Equilibrada'}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Card: Ficha da Operação */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Operação Executada
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {op?.timestamp || '--:--:--'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              {op?.tipo === 'INSERCAO'
                ? `Inserção da Conta #${op.chave}`
                : op?.tipo === 'REMOCAO'
                ? `Encerramento da Conta #${op.chave}`
                : 'Cenário Pré-definido'}
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {diag.caso}
            </span>
          </div>

          {treeType === 'avl' ? (
            /* Detalhes Técnicos AVL */
            <div className="space-y-1 text-xs text-slate-600 pt-1.5 border-t border-slate-100">
              {diag.no_desbalanceado && (
                <div className="flex justify-between">
                  <span>Ponto Crítico:</span>
                  <b className="font-mono text-slate-900">
                    Nó #{diag.no_desbalanceado} (FB = {diag.fb_detectado})
                  </b>
                </div>
              )}
              <div className="flex justify-between">
                <span>Ação Aplicada:</span>
                <span className="font-medium text-slate-800 text-right">{diag.tipo_rotacao}</span>
              </div>
              {diag.no_promovido && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Nova Raiz Local:</span>
                  <b className="font-mono">Conta #{diag.no_promovido}</b>
                </div>
              )}
            </div>
          ) : (
            /* Detalhes Técnicos Rubro-Negra */
            <div className="space-y-1 text-xs text-slate-600 pt-1.5 border-t border-slate-100">
              {diag.no_conflito && (
                <div className="flex justify-between">
                  <span>Conflito Rubro:</span>
                  <span className="font-mono font-bold text-rose-600">
                    Nó #{diag.no_conflito} & Pai #{diag.pai}
                  </span>
                </div>
              )}
              {diag.tio && (
                <div className="flex justify-between">
                  <span>Tio (#{diag.tio}):</span>
                  <b className={diag.cor_tio === 'VERMELHO' ? 'text-rose-600' : 'text-slate-800'}>
                    Cor {diag.cor_tio}
                  </b>
                </div>
              )}
              <div className="flex justify-between">
                <span>Estratégia:</span>
                <span className="font-medium text-slate-800">{diag.tipo_acao}</span>
              </div>

              {/* Tabela de Recolorações */}
              {diag.recoloracoes && diag.recoloracoes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Recolorações Efetuadas:
                  </p>
                  <div className="space-y-1">
                    {diag.recoloracoes.map((rec, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-[11px] p-1 rounded-md bg-slate-50 border border-slate-200"
                      >
                        <span className="font-medium text-slate-700">
                          {rec.papel} #{rec.chave}
                        </span>
                        <div className="flex items-center gap-1 font-bold font-mono">
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

        {/* Card: Módulo de Controle Interativo do Passo a Passo */}
        {passos.length > 0 && (
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Controle do Passo a Passo Visual
              </span>
              <span className="text-[10px] font-mono font-medium text-slate-500">
                {activeStepIndex + 1} / {passos.length}
              </span>
            </div>

            {/* Stepper Navigation Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStepChange(0)}
                disabled={activeStepIndex === 0}
                title="Ir para o Início da Operação"
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <Rewind className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleStepChange(activeStepIndex - 1)}
                disabled={activeStepIndex === 0}
                className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <button
                type="button"
                onClick={() => handleStepChange(activeStepIndex + 1)}
                disabled={activeStepIndex === passos.length - 1}
                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-xs font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs"
              >
                <span>Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleStepChange(passos.length - 1)}
                disabled={activeStepIndex === passos.length - 1}
                title="Ir para o Estado Final Equilibrado"
                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Step Selection Chips */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {passos.map((p, idx) => {
                const isActive = activeStepIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleStepChange(idx)}
                    className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Passo {p.ordem}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Step Explanation Box */}
            {currentStep && (
              <div
                className={`p-3 rounded-lg border space-y-1.5 transition-all ${
                  currentStep.status === 'warning'
                    ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                    : currentStep.status === 'success'
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white ${
                      currentStep.status === 'warning'
                        ? 'bg-amber-600'
                        : currentStep.status === 'success'
                        ? 'bg-emerald-600'
                        : 'bg-slate-900'
                    }`}
                  >
                    {currentStep.ordem}
                  </span>
                  <span>{currentStep.titulo}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700 pl-5">
                  {currentStep.descricao}
                </p>
                {currentStep.no_foco && (
                  <div className="pl-5 pt-1 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                    <span>Foco no canvas:</span>
                    <span className="font-bold text-slate-900">Nó #{currentStep.no_foco}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
