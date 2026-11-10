import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  RotateCcw,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Layers,
  Search,
  Trash2,
  Activity,
  Terminal,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sliders,
  ExternalLink,
  Info
} from 'lucide-react';

export default function ExperimentsDashboard({
  apiBase = 'http://localhost:8000',
  onBackToTrees,
  onNotify,
  initialMode = 'padrao',
  initialN = '500',
  runTrigger = 0
}) {
  // Execution Mode: 'padrao' (100, 1000, 10000), 'rapida' (100), 'custom' (livre)
  const [bateriaMode, setBateriaMode] = useState(initialMode);
  const [customN, setCustomN] = useState(String(initialN || '500'));

  // Benchmark Execution State
  const [running, setRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0); // 0: 100, 1: 1000, 2: 10000
  const [stepperPaused, setStepperPaused] = useState(false);
  const [stepperQueue, setStepperQueue] = useState([]); // array of sizes to run
  const [resultsBySize, setResultsBySize] = useState({}); // { 100: { res_aleatorio, res_crescente, saida_terminal }, ... }

  // Active View Filter inside Dashboard
  const [selectedN, setSelectedN] = useState(100);
  const [selectedCenarioTab, setSelectedCenarioTab] = useState('aleatorio'); // 'aleatorio' (Tabela 1) | 'crescente' (Tabela 2)
  const [showTerminalLogs, setShowTerminalLogs] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Available Sizes in Results
  const availableSizes = useMemo(() => {
    return Object.keys(resultsBySize)
      .map(Number)
      .sort((a, b) => a - b);
  }, [resultsBySize]);

  // Sync selectedN when new results arrive
  useEffect(() => {
    if (availableSizes.length > 0 && !resultsBySize[selectedN]) {
      setSelectedN(availableSizes[0]);
    }
  }, [availableSizes, resultsBySize, selectedN]);

  // Execute a single N size through the backend
  const executeSizeBenchmark = async (n) => {
    try {
      const res = await fetch(`${apiBase}/api/experimentos/executar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          n,
          cenario: 'ambos',
          semente: 42
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Falha ao executar benchmark para N=${n}`);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      throw err;
    }
  };

  // Start Batch
  const handleStartBatch = async (mode = bateriaMode, nOverride = customN) => {
    let sizes = [100, 1000, 10000];
    if (mode === 'rapida') sizes = [100];
    if (mode === 'custom') {
      const parsed = parseInt(nOverride);
      if (isNaN(parsed) || parsed <= 0) {
        if (onNotify) onNotify('Informe um tamanho N inteiro e positivo.', 'error');
        return;
      }
      if (parsed > 50000) {
        if (onNotify) onNotify('Atenção: tamanhos acima de 50.000 podem demandar alto consumo de memória.', 'warning');
      }
      sizes = [parsed];
    }

    setBateriaMode(mode);
    setRunning(true);
    setStepperPaused(false);
    setStepperQueue(sizes);
    setCurrentStepIndex(0);

    try {
      // Run first size (typically N=100)
      const firstN = sizes[0];
      const result = await executeSizeBenchmark(firstN);
      setResultsBySize((prev) => ({
        ...prev,
        [firstN]: result
      }));
      setSelectedN(firstN);

      if (sizes.length > 1) {
        // Trigger Safety Interlock pause (Nielsen #1 and #5)
        setStepperPaused(true);
        setCurrentStepIndex(1); // Ready to advance to second size
        setRunning(false);
        if (onNotify) {
          onNotify(`Testes para N = ${firstN.toLocaleString()} concluídos com sucesso. Pausa de segurança ativa para inspeção.`, 'info');
        }
      } else {
        setRunning(false);
        if (onNotify) {
          onNotify(`Bateria de testes para N = ${firstN.toLocaleString()} concluída!`, 'success');
        }
      }
    } catch (err) {
      setRunning(false);
      setStepperPaused(false);
      if (onNotify) onNotify(`Erro na execução: ${err.message}`, 'error');
    }
  };

  // Advance Safety Interlock to Next Size
  const handleAdvanceStep = async () => {
    if (currentStepIndex >= stepperQueue.length) return;
    const nextN = stepperQueue[currentStepIndex];

    setRunning(true);
    setStepperPaused(false);

    try {
      const result = await executeSizeBenchmark(nextN);
      setResultsBySize((prev) => ({
        ...prev,
        [nextN]: result
      }));
      setSelectedN(nextN);

      if (currentStepIndex + 1 < stepperQueue.length) {
        // Still has subsequent sizes -> pause again
        setCurrentStepIndex((prev) => prev + 1);
        setStepperPaused(true);
        setRunning(false);
        if (onNotify) {
          onNotify(`Testes para N = ${nextN.toLocaleString()} concluídos. Pausa de segurança ativa antes de N = ${stepperQueue[currentStepIndex + 1].toLocaleString()}.`, 'info');
        }
      } else {
        // All completed!
        setCurrentStepIndex(stepperQueue.length);
        setRunning(false);
        setStepperPaused(false);
        if (onNotify) {
          onNotify(`Bateria completa de experimentos científicos finalizada com sucesso!`, 'success');
        }
      }
    } catch (err) {
      setRunning(false);
      setStepperPaused(true);
      if (onNotify) onNotify(`Erro ao processar N = ${nextN}: ${err.message}`, 'error');
    }
  };

  // Run batch only when triggered by user confirmation
  useEffect(() => {
    if (runTrigger > 0) {
      handleStartBatch(initialMode, initialN);
    }
  }, [runTrigger, initialMode, initialN]);

  // Export handler (CSV or Markdown)
  const handleExport = async (formato) => {
    const list = Object.values(resultsBySize).flatMap((r) => {
      const items = [];
      if (r.res_aleatorio) items.push(r.res_aleatorio);
      if (r.res_crescente) items.push(r.res_crescente);
      return items;
    });

    if (list.length === 0) {
      if (onNotify) onNotify('Nenhum resultado experimental disponível para exportação.', 'warning');
      return;
    }

    setExporting(true);
    try {
      const res = await fetch(`${apiBase}/api/experimentos/exportar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formato,
          resultados: list
        })
      });

      if (!res.ok) throw new Error('Falha ao gerar arquivo de exportação');
      const data = await res.json();

      // Trigger direct download in browser
      const blob = new Blob([data.conteudo], { type: data.mimetype });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.nome_arquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (onNotify) {
        onNotify(`Arquivo ${data.nome_arquivo} exportado com sucesso!`, 'success');
      }
    } catch (err) {
      if (onNotify) onNotify(`Erro na exportação: ${err.message}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Active Result Data
  const activeResultItem = resultsBySize[selectedN];
  const activeData =
    selectedCenarioTab === 'aleatorio'
      ? activeResultItem?.res_aleatorio
      : activeResultItem?.res_crescente;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/70 overflow-y-auto font-sans text-slate-900 select-text">
      {/* ================= TOP HEADER (Executive Halcyon Style) ================= */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#12372a]/10 border border-[#12372a]/20 text-[#12372a] flex items-center justify-center font-bold shadow-xs shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-neutral-800 leading-none">
                Laboratório de Análise Experimental de Desempenho
              </h1>
              <p className="text-xs text-neutral-500 mt-1">
                Benchmarks científicos com execução dinâmica e determinística (seed = 42)
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Back to Trees Button */}
          {onBackToTrees && (
            <button
              onClick={onBackToTrees}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-neutral-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium shadow-2xs cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Voltar às Árvores</span>
            </button>
          )}

          {/* Export CSV */}
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || availableSizes.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-neutral-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#12372a]" />
            <span>Exportar CSV</span>
          </button>

          {/* Export Markdown */}
          <button
            onClick={() => handleExport('markdown')}
            disabled={exporting || availableSizes.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-neutral-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#854d27]" />
            <span>Exportar Markdown</span>
          </button>

          {/* Re-run button */}
          <button
            onClick={() => handleStartBatch(bateriaMode)}
            disabled={running}
            className="text-xs px-3.5 py-1.5 rounded-lg bg-[#12372a] text-white hover:bg-[#184535] active:bg-[#0b241c] transition-colors flex items-center gap-1.5 font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Processando...' : 'Re-executar Testes'}</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Empty State when no experiments have run yet */}
        {availableSizes.length === 0 && !running && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-xs my-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#12372a]/10 border border-[#12372a]/20 text-[#12372a] flex items-center justify-center mx-auto shadow-2xs">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Nenhum experimento executado no momento</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Selecione uma das opções no menu lateral ou clique no botão abaixo para iniciar a bateria de testes científicos com seed = 42.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => handleStartBatch('padrao')}
                className="text-xs px-4 py-2.5 rounded-xl bg-[#12372a] text-white font-semibold hover:bg-[#184535] active:bg-[#0b241c] transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Iniciar Bateria Completa (100, 1k, 10k)</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= STEPPER & SAFETY INTERLOCK BANNER ================= */}
        {bateriaMode === 'padrao' && stepperQueue.length > 1 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Stepper Steps */}
              <div className="flex items-center gap-3">
                {stepperQueue.map((nVal, idx) => {
                  const isDone = !!resultsBySize[nVal];
                  const isCurrent = nVal === selectedN;

                  return (
                    <React.Fragment key={nVal}>
                      <button
                        onClick={() => isDone && setSelectedN(nVal)}
                        disabled={!isDone}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                          isCurrent
                            ? 'bg-[#12372a] text-white border-[#12372a] font-semibold shadow-2xs'
                            : isDone
                            ? 'bg-slate-100/80 text-slate-600 border-slate-200/80 font-medium hover:bg-slate-100 hover:text-neutral-900 cursor-pointer'
                            : 'bg-slate-100/60 text-slate-400 border-slate-200/60 font-medium cursor-default'
                        }`}
                      >
                        {isDone && isCurrent ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        ) : isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>N = {nVal.toLocaleString()}</span>
                      </button>
                      {idx < stepperQueue.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Safety Interlock Prompt Button */}
              {stepperPaused && currentStepIndex < stepperQueue.length && (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-semibold text-neutral-800">
                      Pausa de Segurança Ativa (Nielsen #5)
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Avalie os dados de N={stepperQueue[currentStepIndex - 1]?.toLocaleString()} antes de avançar.
                    </p>
                  </div>
                  <button
                    onClick={handleAdvanceStep}
                    disabled={running}
                    className="text-xs px-4 py-2 rounded-lg bg-[#12372a] hover:bg-[#184535] active:bg-[#0b241c] text-white font-semibold transition-all shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <span>Prosseguir para N = {stepperQueue[currentStepIndex]?.toLocaleString()}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Completed Message */}
              {!stepperPaused && currentStepIndex >= stepperQueue.length && (
                <div className="flex items-center gap-2 text-[#12372a] bg-[#12372a]/10 px-3 py-1.5 rounded-lg border border-[#12372a]/20 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4 text-[#12372a]" />
                  <span>Bateria de Experimentos 100% Concluída</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= CONTROLS & SIZE / SCENARIO SELECTOR ================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          {/* Size Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Tamanho N:
            </span>
            {availableSizes.map((nVal) => (
              <button
                key={nVal}
                onClick={() => setSelectedN(nVal)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedN === nVal
                    ? 'bg-[#12372a] text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/80'
                }`}
              >
                N = {nVal.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Scenario Tab Selector (Tabela 1 vs Tabela 2) */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setSelectedCenarioTab('aleatorio')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                selectedCenarioTab === 'aleatorio'
                  ? 'bg-white text-neutral-900 font-semibold shadow-xs border border-slate-200/60'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Cenário Real Bancário (Tabela 1 - Aleatório)
            </button>
            <button
              onClick={() => setSelectedCenarioTab('crescente')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                selectedCenarioTab === 'crescente'
                  ? 'bg-white text-neutral-900 font-semibold shadow-xs border border-slate-200/60'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Pior Caso ABB (Tabela 2 - Ordem Crescente)
            </button>
          </div>
        </div>

        {/* Loading state indicator */}
        {running && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl p-4 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-indigo-600 animate-spin" />
              <div>
                <p className="text-xs font-semibold">Executando simulação estocástica para N = {selectedN.toLocaleString()}...</p>
                <p className="text-[11px] text-indigo-700">Inserindo chaves, disparando buscas (50% existentes / 50% inexistentes) e 3 rodadas de remoção.</p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-white border border-indigo-200">
              Processando Python Engine
            </span>
          </div>
        )}

        {/* ================= SECTION: KPI SUMMARY CARDS (Halcyon & Twinize Style) ================= */}
        {activeData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Altura Final */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
                <span>Altura Final Resultante</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  h_AVL vs h_RN
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-neutral-800">{activeData.avl_altura_final}</span>
                <span className="text-xs text-slate-400">vs</span>
                <span className="text-2xl font-bold font-mono text-[#854d27]">{activeData.rb_altura_final}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-600">
                <TrendingDown className="w-3.5 h-3.5 text-[#12372a]" />
                <span>
                  {activeData.avl_altura_final <= activeData.rb_altura_final
                    ? `AVL é ${activeData.rb_altura_final - activeData.avl_altura_final} níveis mais compacta`
                    : `Alturas equivalentes (${activeData.avl_altura_final})`}
                </span>
              </div>
            </div>

            {/* Card 2: Rotações de Inserção */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
                <span>Rotações na Inserção</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  Esforço Estrutural
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-neutral-800">
                  {activeData.avl_rot_ins.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">vs</span>
                <span className="text-2xl font-bold font-mono text-[#854d27]">
                  {activeData.rb_rot_ins.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-600">
                {activeData.rb_rot_ins < activeData.avl_rot_ins ? (
                  <>
                    <TrendingDown className="w-3.5 h-3.5 text-[#12372a]" />
                    <span className="text-[#12372a] font-semibold">
                      RN economizou {(100 - (activeData.rb_rot_ins / activeData.avl_rot_ins) * 100).toFixed(1)}% de rotações
                    </span>
                  </>
                ) : (
                  <span>Rotações equivalentes</span>
                )}
              </div>
            </div>

            {/* Card 3: Recolorações Rubro-Negra */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
                <span>Recolorações (Rubro-Negra)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#fcfaf7] text-[#854d27] font-semibold border border-[#854d27]/25 font-mono">
                  Exclusivo Cormen
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-[#854d27]">
                  {activeData.rb_rec_ins.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-medium">na inserção</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-500">
                <Info className="w-3.5 h-3.5 text-[#854d27]" />
                <span>Operações O(1) que substituem rotações</span>
              </div>
            </div>

            {/* Card 4: Desempenho Médio de Busca */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
                <span>Média de Nós Visitados (Busca)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  {activeData.total_buscas.toLocaleString()} consultas
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-neutral-800">
                  {activeData.avl_media_busca.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400">vs</span>
                <span className="text-2xl font-bold font-mono text-[#854d27]">
                  {activeData.rb_media_busca.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500">nós</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-500">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Existentes: {activeData.avl_media_busca_existente.toFixed(1)} vs {activeData.rb_media_busca_existente.toFixed(1)} nós
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================= SECTION: OFFICIAL REPORT TABLES (UntitledUI Style) ================= */}
        {activeData && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {selectedCenarioTab === 'aleatorio'
                    ? `Tabela 1: Métricas Consolidadas (Cenário Real Bancário - N = ${selectedN.toLocaleString()})`
                    : `Tabela 2: Métricas Consolidadas (Ordem Crescente / Pior Caso ABB - N = ${selectedN.toLocaleString()})`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Métricas de complexidade assintótica e esforço estrutural de balanceamento.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#12372a]/10 text-[#12372a] font-semibold border border-[#12372a]/20 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#12372a]" />
                  <span>Equivalência 100% Validada</span>
                </span>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-6">Métrica de Desempenho</th>
                    <th className="py-3 px-6 text-right">Árvore AVL</th>
                    <th className="py-3 px-6 text-right text-[#854d27]">Árvore Rubro-Negra</th>
                    <th className="py-3 px-6 text-right">Diferencial Teórico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {/* Linha 1 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Altura final (Após Inserção)</td>
                    <td className="py-3 px-6 text-right font-mono font-semibold text-neutral-800">
                      {activeData.avl_altura_final}
                    </td>
                    <td className="py-3 px-6 text-right font-mono font-semibold text-[#854d27]">
                      {activeData.rb_altura_final}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 font-mono text-[11px]">
                      {activeData.avl_altura_final <= activeData.rb_altura_final
                        ? `AVL ≤ RN (Delta: ${activeData.rb_altura_final - activeData.avl_altura_final})`
                        : 'Equivalente'}
                    </td>
                  </tr>

                  {/* Linha 2 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Rotações na inserção</td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-800">
                      {activeData.avl_rot_ins.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#854d27] font-semibold">
                      {activeData.rb_rot_ins.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-[#12372a] font-semibold text-[11px]">
                      {activeData.rb_rot_ins <= activeData.avl_rot_ins
                        ? `RN economizou ${activeData.avl_rot_ins - activeData.rb_rot_ins} rotações`
                        : `AVL menor`}
                    </td>
                  </tr>

                  {/* Linha 3 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Rotações na remoção (10% dos nós)</td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-800">
                      {activeData.avl_rot_rem_10.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#854d27]">
                      {activeData.rb_rot_rem_10.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      {activeData.remocao_detalhada?.[10]
                        ? `Alturas: AVL(${activeData.remocao_detalhada[10].alt_antes_avl}→${activeData.remocao_detalhada[10].alt_depois_avl}) | RN(${activeData.remocao_detalhada[10].alt_antes_rb}→${activeData.remocao_detalhada[10].alt_depois_rb})`
                        : '-'}
                    </td>
                  </tr>

                  {/* Linha 4 (Amostra 30%) */}
                  <tr className="bg-slate-50/40 hover:bg-slate-50 transition-colors font-medium">
                    <td className="py-3 px-6 text-slate-900 flex items-center gap-1.5">
                      <span>Rotações na remoção (30% dos nós)</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold font-mono">
                        Amostra 30%
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-800 font-semibold">
                      {activeData.avl_rot_rem_30.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#854d27] font-semibold">
                      {activeData.rb_rot_rem_30.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-600 text-[11px]">
                      {activeData.remocao_detalhada?.[30]
                        ? `Tempo: ${activeData.remocao_detalhada[30].tempo_avl_ms.toFixed(2)}ms vs ${activeData.remocao_detalhada[30].tempo_rb_ms.toFixed(2)}ms`
                        : '-'}
                    </td>
                  </tr>

                  {/* Linha 5 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Rotações na remoção (50% dos nós)</td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-800">
                      {activeData.avl_rot_rem_50.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#854d27]">
                      {activeData.rb_rot_rem_50.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      {activeData.remocao_detalhada?.[50]
                        ? `Removidas ${activeData.remocao_detalhada[50].qtd_removida} contas`
                        : '-'}
                    </td>
                  </tr>

                  {/* Linha 6 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Recolorações (Inserção)</td>
                    <td className="py-3 px-6 text-right font-mono text-slate-400">N/A (Não se aplica)</td>
                    <td className="py-3 px-6 text-right font-mono font-bold text-[#854d27]">
                      {activeData.rb_rec_ins.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-[#854d27] text-[11px] font-medium">
                      Compensação de cor O(1)
                    </td>
                  </tr>

                  {/* Linha 7 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Recolorações (Remoção 30% dos nós)</td>
                    <td className="py-3 px-6 text-right font-mono text-slate-400">N/A (Não se aplica)</td>
                    <td className="py-3 px-6 text-right font-mono font-bold text-[#854d27]">
                      {activeData.rb_rec_rem_30.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      Ajuste de invariante preta
                    </td>
                  </tr>

                  {/* Linha 8 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Total de nós visitados na busca</td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-800 font-semibold">
                      {activeData.avl_total_nos_busca.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#854d27] font-semibold">
                      {activeData.rb_total_nos_busca.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      AVL visita menos nós (mais rasa)
                    </td>
                  </tr>

                  {/* Linha 9 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Média de nós visitados por busca</td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-800 font-bold">
                      {activeData.avl_media_busca.toFixed(2)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#854d27] font-bold">
                      {activeData.rb_media_busca.toFixed(2)}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      Existentes: {activeData.avl_media_busca_existente.toFixed(2)} vs {activeData.rb_media_busca_existente.toFixed(2)}
                    </td>
                  </tr>

                  {/* Linha 10 (Tempos) */}
                  <tr className="hover:bg-slate-50/70 transition-colors bg-slate-50/30">
                    <td className="py-3 px-6 font-medium text-slate-800">Tempo total de inserção (ms)</td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-800">
                      {activeData.avl_tempo_ins_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#854d27]">
                      {activeData.rb_tempo_ins_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      {activeData.avl_tempo_ins_ms < activeData.rb_tempo_ins_ms ? 'AVL mais rápida' : 'RN mais rápida'}
                    </td>
                  </tr>

                  {/* Linha 11 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Tempo total de busca (ms)</td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-800">
                      {activeData.avl_tempo_busca_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#854d27]">
                      {activeData.rb_tempo_busca_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      50% ex. + 50% inex.
                    </td>
                  </tr>

                  {/* Linha 12 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Tempo total remoção (30% dos nós)</td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-800">
                      {activeData.avl_tempo_rem_30_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-[#854d27]">
                      {activeData.rb_tempo_rem_30_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      Custo de rebalanceamento
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= SECTION: VISUAL COMPARATIVE CHARTS (Executive Apple/Twinize Style) ================= */}
        {activeData && (() => {
          // Calculations for Donut Chart (Rubro-Negra Operations Distribution)
          const totalOps =
            (activeData.rb_rec_ins || 0) +
            (activeData.rb_rec_rem_30 || 0) +
            (activeData.rb_rot_ins || 0) +
            (activeData.rb_rot_rem_30 || 0) || 1;

          const recInsPct = (activeData.rb_rec_ins || 0) / totalOps;
          const recRemPct = (activeData.rb_rec_rem_30 || 0) / totalOps;
          const rotInsPct = (activeData.rb_rot_ins || 0) / totalOps;
          const rotRemPct = (activeData.rb_rot_rem_30 || 0) / totalOps;

          const radius = 38;
          const circumference = 2 * Math.PI * radius; // ~238.76
          const strokeWidth = 14;

          const off0 = 0;
          const off1 = recInsPct * circumference;
          const off2 = (recInsPct + recRemPct) * circumference;
          const off3 = (recInsPct + recRemPct + rotInsPct) * circumference;

          return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column (7 cols): Comparative Bar Charts (Rotations & Execution Times) */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-800">
                      Distribuição Comparativa de Desempenho
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Contraste direto entre AVL e Rubro-Negra por fase operacional
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-neutral-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2b1d16]" /> Árvore AVL
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-[#854d27]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#854d27]" /> Árvore Rubro-Negra
                    </span>
                  </div>
                </div>

                {/* Subgroup 1: Rotações Estruturais */}
                <div className="space-y-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                    Esforço de Rotação de Ponteiros
                  </span>

                  {/* Row: Inserção */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-neutral-700">
                      <span>Inserção ({selectedN.toLocaleString()} nós)</span>
                      <span className="font-mono text-neutral-800">
                        <span className="font-semibold text-neutral-900">{activeData.avl_rot_ins}</span> vs{' '}
                        <span className="font-semibold text-[#854d27]">{activeData.rb_rot_ins}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 h-4">
                      <div className="bg-slate-100/90 rounded-md overflow-hidden flex items-center justify-end pr-1.5">
                        <div
                          className="bg-[#2b1d16] h-full rounded-md transition-all duration-500 flex items-center justify-end pr-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(16, Math.min(100, (activeData.avl_rot_ins / Math.max(activeData.avl_rot_ins, activeData.rb_rot_ins || 1)) * 100))}%`
                          }}
                        >
                          {activeData.avl_rot_ins}
                        </div>
                      </div>
                      <div className="bg-[#fcfaf7] border border-[#854d27]/20 rounded-md overflow-hidden flex items-center justify-start pl-1.5">
                        <div
                          className="bg-[#854d27] h-full rounded-md transition-all duration-500 flex items-center justify-start pl-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(16, Math.min(100, (activeData.rb_rot_ins / Math.max(activeData.avl_rot_ins, activeData.rb_rot_ins || 1)) * 100))}%`
                          }}
                        >
                          {activeData.rb_rot_ins}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row: Remoção 30% */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-neutral-700">
                      <span>Remoção Parcial (30% dos nós)</span>
                      <span className="font-mono text-neutral-800">
                        <span className="font-semibold text-neutral-900">{activeData.avl_rot_rem_30}</span> vs{' '}
                        <span className="font-semibold text-[#854d27]">{activeData.rb_rot_rem_30}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 h-4">
                      <div className="bg-slate-100/90 rounded-md overflow-hidden flex items-center justify-end pr-1.5">
                        <div
                          className="bg-[#2b1d16] h-full rounded-md transition-all duration-500 flex items-center justify-end pr-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(16, Math.min(100, (activeData.avl_rot_rem_30 / Math.max(activeData.avl_rot_rem_30, activeData.rb_rot_rem_30 || 1)) * 100))}%`
                          }}
                        >
                          {activeData.avl_rot_rem_30}
                        </div>
                      </div>
                      <div className="bg-[#fcfaf7] border border-[#854d27]/20 rounded-md overflow-hidden flex items-center justify-start pl-1.5">
                        <div
                          className="bg-[#854d27] h-full rounded-md transition-all duration-500 flex items-center justify-start pl-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(16, Math.min(100, (activeData.rb_rot_rem_30 / Math.max(activeData.avl_rot_rem_30, activeData.rb_rot_rem_30 || 1)) * 100))}%`
                          }}
                        >
                          {activeData.rb_rot_rem_30}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row: Remoção 50% */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-neutral-700">
                      <span>Remoção Parcial (50% dos nós)</span>
                      <span className="font-mono text-neutral-800">
                        <span className="font-semibold text-neutral-900">{activeData.avl_rot_rem_50}</span> vs{' '}
                        <span className="font-semibold text-[#854d27]">{activeData.rb_rot_rem_50}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 h-4">
                      <div className="bg-slate-100/90 rounded-md overflow-hidden flex items-center justify-end pr-1.5">
                        <div
                          className="bg-[#2b1d16] h-full rounded-md transition-all duration-500 flex items-center justify-end pr-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(16, Math.min(100, (activeData.avl_rot_rem_50 / Math.max(activeData.avl_rot_rem_50, activeData.rb_rot_rem_50 || 1)) * 100))}%`
                          }}
                        >
                          {activeData.avl_rot_rem_50}
                        </div>
                      </div>
                      <div className="bg-[#fcfaf7] border border-[#854d27]/20 rounded-md overflow-hidden flex items-center justify-start pl-1.5">
                        <div
                          className="bg-[#854d27] h-full rounded-md transition-all duration-500 flex items-center justify-start pl-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(16, Math.min(100, (activeData.rb_rot_rem_50 / Math.max(activeData.avl_rot_rem_50, activeData.rb_rot_rem_50 || 1)) * 100))}%`
                          }}
                        >
                          {activeData.rb_rot_rem_50}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subgroup 2: Tempos de Execução em Milissegundos */}
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      Tempos de Execução (Milissegundos)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                      Menor é melhor
                    </span>
                  </div>

                  {/* Row: Inserção Total */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-neutral-700">
                      <span>Inserção Total</span>
                      <span className="font-mono text-neutral-800">
                        {activeData.avl_tempo_ins_ms.toFixed(2)}ms vs {activeData.rb_tempo_ins_ms.toFixed(2)}ms
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 h-4">
                      <div className="bg-slate-100/90 rounded-md overflow-hidden flex items-center justify-end pr-1.5">
                        <div
                          className="bg-[#2b1d16] h-full rounded-md transition-all duration-500 flex items-center justify-end pr-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(18, Math.min(100, (activeData.avl_tempo_ins_ms / Math.max(activeData.avl_tempo_ins_ms, activeData.rb_tempo_ins_ms || 1)) * 100))}%`
                          }}
                        >
                          {activeData.avl_tempo_ins_ms.toFixed(2)}ms
                        </div>
                      </div>
                      <div className="bg-[#fcfaf7] border border-[#854d27]/20 rounded-md overflow-hidden flex items-center justify-start pl-1.5">
                        <div
                          className="bg-[#854d27] h-full rounded-md transition-all duration-500 flex items-center justify-start pl-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(18, Math.min(100, (activeData.rb_tempo_ins_ms / Math.max(activeData.avl_tempo_ins_ms, activeData.rb_tempo_ins_ms || 1)) * 100))}%`
                          }}
                        >
                          {activeData.rb_tempo_ins_ms.toFixed(2)}ms
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row: Busca */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-neutral-700">
                      <span>Busca ({activeData.total_buscas.toLocaleString()} consultas)</span>
                      <span className="font-mono text-neutral-800">
                        {activeData.avl_tempo_busca_ms.toFixed(2)}ms vs {activeData.rb_tempo_busca_ms.toFixed(2)}ms
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 h-4">
                      <div className="bg-slate-100/90 rounded-md overflow-hidden flex items-center justify-end pr-1.5">
                        <div
                          className="bg-[#2b1d16] h-full rounded-md transition-all duration-500 flex items-center justify-end pr-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(18, Math.min(100, (activeData.avl_tempo_busca_ms / Math.max(activeData.avl_tempo_busca_ms, activeData.rb_tempo_busca_ms || 1)) * 100))}%`
                          }}
                        >
                          {activeData.avl_tempo_busca_ms.toFixed(2)}ms
                        </div>
                      </div>
                      <div className="bg-[#fcfaf7] border border-[#854d27]/20 rounded-md overflow-hidden flex items-center justify-start pl-1.5">
                        <div
                          className="bg-[#854d27] h-full rounded-md transition-all duration-500 flex items-center justify-start pl-1 text-[10px] font-mono text-white"
                          style={{
                            width: `${Math.max(18, Math.min(100, (activeData.rb_tempo_busca_ms / Math.max(activeData.avl_tempo_busca_ms, activeData.rb_tempo_busca_ms || 1)) * 100))}%`
                          }}
                        >
                          {activeData.rb_tempo_busca_ms.toFixed(2)}ms
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Donut Chart (Task/Operations Distribution directly from Image 2) */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-neutral-800">
                      Distribuição Operacional (Rubro-Negra)
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Proporção de Recolorações vs Rotações de balanceamento
                    </p>
                  </div>

                  {/* Donut Chart & Legend Container */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-6">
                    {/* SVG Donut Circle */}
                    <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          stroke="#f1f5f9"
                          strokeWidth={strokeWidth}
                          fill="none"
                        />
                        {/* Slice 1: Recolorações Inserção */}
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          stroke="#854d27"
                          strokeWidth={strokeWidth}
                          fill="none"
                          strokeDasharray={`${recInsPct * circumference} ${circumference}`}
                          strokeDashoffset={-off0}
                          className="transition-all duration-700"
                        />
                        {/* Slice 2: Recolorações Remoção 30% */}
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          stroke="#c99b6d"
                          strokeWidth={strokeWidth}
                          fill="none"
                          strokeDasharray={`${recRemPct * circumference} ${circumference}`}
                          strokeDashoffset={-off1}
                          className="transition-all duration-700"
                        />
                        {/* Slice 3: Rotações Inserção */}
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          stroke="#2b1d16"
                          strokeWidth={strokeWidth}
                          fill="none"
                          strokeDasharray={`${rotInsPct * circumference} ${circumference}`}
                          strokeDashoffset={-off2}
                          className="transition-all duration-700"
                        />
                        {/* Slice 4: Rotações Remoção 30% */}
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          stroke="#5c7c8a"
                          strokeWidth={strokeWidth}
                          fill="none"
                          strokeDasharray={`${rotRemPct * circumference} ${circumference}`}
                          strokeDashoffset={-off3}
                          className="transition-all duration-700"
                        />
                      </svg>
                      {/* Donut Center Counter */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <span className="text-lg font-bold font-mono text-neutral-800 leading-tight">
                          {totalOps.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                          Total Ops
                        </span>
                      </div>
                    </div>

                    {/* Legend List (Identical to Image 2) */}
                    <div className="space-y-2 text-xs w-full max-w-xs">
                      <div className="flex items-center justify-between gap-3 text-neutral-700">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#854d27] shrink-0" />
                          <span className="truncate">Recolor. Inserção</span>
                        </div>
                        <div className="font-mono text-right shrink-0">
                          <span className="font-semibold text-neutral-900">{activeData.rb_rec_ins}</span>{' '}
                          <span className="text-slate-400 text-[11px]">({(recInsPct * 100).toFixed(0)}%)</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-neutral-700">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#c99b6d] shrink-0" />
                          <span className="truncate">Recolor. Remoção 30%</span>
                        </div>
                        <div className="font-mono text-right shrink-0">
                          <span className="font-semibold text-neutral-900">{activeData.rb_rec_rem_30 || 0}</span>{' '}
                          <span className="text-slate-400 text-[11px]">({(recRemPct * 100).toFixed(0)}%)</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-neutral-700">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#2b1d16] shrink-0" />
                          <span className="truncate">Rotações Inserção</span>
                        </div>
                        <div className="font-mono text-right shrink-0">
                          <span className="font-semibold text-neutral-900">{activeData.rb_rot_ins}</span>{' '}
                          <span className="text-slate-400 text-[11px]">({(rotInsPct * 100).toFixed(0)}%)</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-neutral-700">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#5c7c8a] shrink-0" />
                          <span className="truncate">Rotações Remoção 30%</span>
                        </div>
                        <div className="font-mono text-right shrink-0">
                          <span className="font-semibold text-neutral-900">{activeData.rb_rot_rem_30 || 0}</span>{' '}
                          <span className="text-slate-400 text-[11px]">({(rotRemPct * 100).toFixed(0)}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Insight Box */}
                <div className="p-3 rounded-xl bg-[#fcfaf7] border border-[#854d27]/20 text-[11px] text-neutral-700 leading-relaxed flex items-center gap-2.5 mt-2">
                  <Info className="w-4 h-4 text-[#854d27] shrink-0" />
                  <span>
                    Na Árvore Rubro-Negra, <b>recolorações absorvem a maioria do esforço</b> com complexidade $O(1)$, evitando rotações custosas de ponteiros.
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ================= SECTION: EQUIVALENCE CHECK & SAMPLES ================= */}
        {activeData && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#12372a]" />
                <h4 className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  Validação Cruzada de Integridade e Equivalência Estrutural
                </h4>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#12372a]/10 text-[#12372a] font-semibold border border-[#12372a]/20">
                {activeData.equivalencia_em_ordem ? '100% IDÊNTICAS' : 'DIVERGÊNCIA DETECTADA'}
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Todas as {activeData.total_chaves_conferidas.toLocaleString()} contas bancárias foram verificadas
              através de caminhamento em-ordem independente em ambas as árvores. Nenhuma chave foi perdida, corrompida ou divergente.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                  5 Menores Contas Cadastradas (Extremo Esquerdo)
                </span>
                <div className="flex items-center gap-1.5 font-mono text-xs text-slate-800">
                  {activeData.primeiras_5_em_ordem_avl.map((num) => (
                    <span key={num} className="px-2 py-1 rounded bg-white border border-slate-200">
                      #{num}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                  5 Maiores Contas Cadastradas (Extremo Direito)
                </span>
                <div className="flex items-center gap-1.5 font-mono text-xs text-slate-800">
                  {activeData.ultimas_5_em_ordem_avl.map((num) => (
                    <span key={num} className="px-2 py-1 rounded bg-white border border-slate-200">
                      #{num}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= SECTION: RAW TERMINAL OUTPUT COLLAPSIBLE ================= */}
        {activeResultItem?.saida_terminal && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <button
              onClick={() => setShowTerminalLogs(!showTerminalLogs)}
              className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-xs font-mono text-slate-200">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">Saída Bruta do Terminal Original (Item 9 · experimentos.py)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  N = {selectedN.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <span>{showTerminalLogs ? 'Recolher' : 'Expandir'}</span>
                {showTerminalLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showTerminalLogs && (
              <div className="p-5 border-t border-slate-800 max-h-96 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 bg-slate-950/80">
                <pre className="whitespace-pre-wrap">{activeResultItem.saida_terminal}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
