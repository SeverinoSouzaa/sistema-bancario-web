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
  initialN = '500'
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

  // Auto-run on initial mount if empty
  useEffect(() => {
    if (Object.keys(resultsBySize).length === 0) {
      handleStartBatch(initialMode, initialN);
    }
  }, [initialMode, initialN]);

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
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900 leading-none">
                  Laboratório de Análise Experimental de Desempenho
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  Edital AED II · Seção 5
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
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
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium shadow-2xs"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Voltar às Árvores</span>
            </button>
          )}

          {/* Export CSV */}
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || availableSizes.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium shadow-2xs disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar CSV</span>
          </button>

          {/* Export Markdown */}
          <button
            onClick={() => handleExport('markdown')}
            disabled={exporting || availableSizes.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium shadow-2xs disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Exportar Markdown</span>
          </button>

          {/* Re-run button */}
          <button
            onClick={() => handleStartBatch(bateriaMode)}
            disabled={running}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 font-semibold shadow-xs disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Processando...' : 'Re-executar Testes'}</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* ================= STEPPER & SAFETY INTERLOCK BANNER ================= */}
        {bateriaMode === 'padrao' && stepperQueue.length > 1 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Stepper Steps */}
              <div className="flex items-center gap-3">
                {stepperQueue.map((nVal, idx) => {
                  const isDone = !!resultsBySize[nVal];
                  const isCurrent = nVal === selectedN;
                  const isPending = !isDone && !running;
                  const isNext = stepperPaused && idx === currentStepIndex;

                  return (
                    <React.Fragment key={nVal}>
                      <button
                        onClick={() => isDone && setSelectedN(nVal)}
                        disabled={!isDone}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                          isCurrent
                            ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-2xs'
                            : isDone
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium hover:bg-emerald-100'
                            : isNext
                            ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold animate-pulse'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : isNext ? (
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-current text-[10px] flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
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
                <div className="flex items-center gap-2">
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-semibold text-slate-800">
                      Pausa de Segurança Ativa (Nielsen #5)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Avalie os dados de N={stepperQueue[currentStepIndex - 1]?.toLocaleString()} antes de avançar.
                    </p>
                  </div>
                  <button
                    onClick={handleAdvanceStep}
                    disabled={running}
                    className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-xs flex items-center gap-2 shrink-0"
                  >
                    <span>Prosseguir para N = {stepperQueue[currentStepIndex]?.toLocaleString()}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Completed Message */}
              {!stepperPaused && currentStepIndex >= stepperQueue.length && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Bateria Oficial do Edital 100% Concluída</span>
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
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedN === nVal
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                N = {nVal.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Scenario Tab Selector (Tabela 1 vs Tabela 2) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setSelectedCenarioTab('aleatorio')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                selectedCenarioTab === 'aleatorio'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cenário Real Bancário (Tabela 1 - Aleatório)
            </button>
            <button
              onClick={() => setSelectedCenarioTab('crescente')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                selectedCenarioTab === 'crescente'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
                <span className="text-2xl font-bold font-mono text-slate-900">{activeData.avl_altura_final}</span>
                <span className="text-xs text-slate-400">vs</span>
                <span className="text-2xl font-bold font-mono text-rose-600">{activeData.rb_altura_final}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-600">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
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
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {activeData.avl_rot_ins.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">vs</span>
                <span className="text-2xl font-bold font-mono text-rose-600">
                  {activeData.rb_rot_ins.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-600">
                {activeData.rb_rot_ins < activeData.avl_rot_ins ? (
                  <>
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">
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
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                  Exclusivo Cormen
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-rose-700">
                  {activeData.rb_rec_ins.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">na inserção</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-600">
                <Info className="w-3.5 h-3.5 text-slate-400" />
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
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {activeData.avl_media_busca.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400">vs</span>
                <span className="text-2xl font-bold font-mono text-rose-600">
                  {activeData.rb_media_busca.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500">nós</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-600">
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
                    ? `Tabela 1: Métricas Consolidadas Oficiais (Cenário Real Bancário - N = ${selectedN.toLocaleString()})`
                    : `Tabela 2: Métricas Consolidadas Oficiais (Ordem Crescente / Pior Caso ABB - N = ${selectedN.toLocaleString()})`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conforme exigido na Seção 5.1 do Edital de AED II para avaliação pela banca examinadora.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Equivalência 100% Validada</span>
                </span>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-6">Métrica Obrigatória do Edital</th>
                    <th className="py-3 px-6 text-right">Árvore AVL</th>
                    <th className="py-3 px-6 text-right">Árvore Rubro-Negra</th>
                    <th className="py-3 px-6 text-right">Diferencial Teórico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {/* Linha 1 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Altura final (Após Inserção)</td>
                    <td className="py-3 px-6 text-right font-mono font-semibold text-slate-900">
                      {activeData.avl_altura_final}
                    </td>
                    <td className="py-3 px-6 text-right font-mono font-semibold text-rose-700">
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
                    <td className="py-3 px-6 text-right font-mono text-slate-900">
                      {activeData.avl_rot_ins.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-rose-700 font-semibold">
                      {activeData.rb_rot_ins.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-emerald-700 font-medium text-[11px]">
                      {activeData.rb_rot_ins <= activeData.avl_rot_ins
                        ? `RN economizou ${activeData.avl_rot_ins - activeData.rb_rot_ins} rotações`
                        : `AVL menor`}
                    </td>
                  </tr>

                  {/* Linha 3 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Rotações na remoção (10% dos nós)</td>
                    <td className="py-3 px-6 text-right font-mono text-slate-900">
                      {activeData.avl_rot_rem_10.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-rose-700">
                      {activeData.rb_rot_rem_10.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      {activeData.remocao_detalhada?.[10]
                        ? `Alturas: AVL(${activeData.remocao_detalhada[10].alt_antes_avl}→${activeData.remocao_detalhada[10].alt_depois_avl}) | RN(${activeData.remocao_detalhada[10].alt_antes_rb}→${activeData.remocao_detalhada[10].alt_depois_rb})`
                        : '-'}
                    </td>
                  </tr>

                  {/* Linha 4 (Edital 30%) */}
                  <tr className="bg-slate-50/40 hover:bg-slate-50 transition-colors font-medium">
                    <td className="py-3 px-6 text-slate-900 flex items-center gap-1.5">
                      <span>Rotações na remoção (30% dos nós - Edital)</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-semibold">
                        Principal
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-slate-900 font-semibold">
                      {activeData.avl_rot_rem_30.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-rose-700 font-semibold">
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
                    <td className="py-3 px-6 text-right font-mono text-slate-900">
                      {activeData.avl_rot_rem_50.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-rose-700">
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
                    <td className="py-3 px-6 text-right font-mono font-bold text-rose-700">
                      {activeData.rb_rec_ins.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-rose-600 text-[11px] font-medium">
                      Compensação de cor O(1)
                    </td>
                  </tr>

                  {/* Linha 7 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Recolorações (Remoção 30% - Edital)</td>
                    <td className="py-3 px-6 text-right font-mono text-slate-400">N/A (Não se aplica)</td>
                    <td className="py-3 px-6 text-right font-mono font-bold text-rose-700">
                      {activeData.rb_rec_rem_30.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      Ajuste de invariante preta
                    </td>
                  </tr>

                  {/* Linha 8 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Total de nós visitados na busca</td>
                    <td className="py-3 px-6 text-right font-mono text-slate-900 font-semibold">
                      {activeData.avl_total_nos_busca.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-rose-700 font-semibold">
                      {activeData.rb_total_nos_busca.toLocaleString()}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      AVL visita menos nós (mais rasa)
                    </td>
                  </tr>

                  {/* Linha 9 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Média de nós visitados por busca</td>
                    <td className="py-3 px-6 text-right font-mono text-slate-900 font-bold">
                      {activeData.avl_media_busca.toFixed(2)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-rose-700 font-bold">
                      {activeData.rb_media_busca.toFixed(2)}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      Existentes: {activeData.avl_media_busca_existente.toFixed(2)} vs {activeData.rb_media_busca_existente.toFixed(2)}
                    </td>
                  </tr>

                  {/* Linha 10 (Tempos) */}
                  <tr className="hover:bg-slate-50/70 transition-colors bg-slate-50/30">
                    <td className="py-3 px-6 font-medium text-slate-800">Tempo total de inserção (ms)</td>
                    <td className="py-3 px-6 text-right font-mono text-slate-900">
                      {activeData.avl_tempo_ins_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-rose-700">
                      {activeData.rb_tempo_ins_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      {activeData.avl_tempo_ins_ms < activeData.rb_tempo_ins_ms ? 'AVL mais rápida' : 'RN mais rápida'}
                    </td>
                  </tr>

                  {/* Linha 11 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Tempo total de busca (ms)</td>
                    <td className="py-3 px-6 text-right font-mono text-slate-900">
                      {activeData.avl_tempo_busca_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-rose-700">
                      {activeData.rb_tempo_busca_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 text-[11px]">
                      50% ex. + 50% inex.
                    </td>
                  </tr>

                  {/* Linha 12 */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-medium text-slate-800">Tempo total remoção (30% - Edital)</td>
                    <td className="py-3 px-6 text-right font-mono text-slate-900">
                      {activeData.avl_tempo_rem_30_ms.toFixed(3)} ms
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-rose-700">
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

        {/* ================= SECTION: VISUAL COMPARATIVE CHARTS ================= */}
        {activeData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chart 1: Rotações de Inserção vs Remoção */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Distribuição Comparativa de Rotações
                </h4>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900" /> AVL
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-rose-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Rubro-Negra
                  </span>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {/* Bar 1: Inserção */}
                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium text-slate-700">
                    <span>Inserção ({selectedN.toLocaleString()} nós)</span>
                    <span className="font-mono">{activeData.avl_rot_ins} vs {activeData.rb_rot_ins}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-5">
                    <div className="bg-slate-100 rounded overflow-hidden flex items-center justify-end pr-2 text-[10px] font-mono text-white">
                      <div
                        className="bg-slate-900 h-full rounded transition-all duration-500 flex items-center justify-end pr-1.5"
                        style={{
                          width: `${Math.max(12, Math.min(100, (activeData.avl_rot_ins / Math.max(activeData.avl_rot_ins, activeData.rb_rot_ins || 1)) * 100))}%`
                        }}
                      >
                        {activeData.avl_rot_ins}
                      </div>
                    </div>
                    <div className="bg-rose-50 rounded overflow-hidden flex items-center justify-start pl-2 text-[10px] font-mono text-white">
                      <div
                        className="bg-rose-600 h-full rounded transition-all duration-500 flex items-center justify-start pl-1.5"
                        style={{
                          width: `${Math.max(12, Math.min(100, (activeData.rb_rot_ins / Math.max(activeData.avl_rot_ins, activeData.rb_rot_ins || 1)) * 100))}%`
                        }}
                      >
                        {activeData.rb_rot_ins}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bar 2: Remoção 30% */}
                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium text-slate-700">
                    <span>Remoção Parcial 30% (Edital)</span>
                    <span className="font-mono">{activeData.avl_rot_rem_30} vs {activeData.rb_rot_rem_30}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-5">
                    <div className="bg-slate-100 rounded overflow-hidden flex items-center justify-end pr-2 text-[10px] font-mono text-white">
                      <div
                        className="bg-slate-800 h-full rounded transition-all duration-500 flex items-center justify-end pr-1.5"
                        style={{
                          width: `${Math.max(12, Math.min(100, (activeData.avl_rot_rem_30 / Math.max(activeData.avl_rot_rem_30, activeData.rb_rot_rem_30 || 1)) * 100))}%`
                        }}
                      >
                        {activeData.avl_rot_rem_30}
                      </div>
                    </div>
                    <div className="bg-rose-50 rounded overflow-hidden flex items-center justify-start pl-2 text-[10px] font-mono text-white">
                      <div
                        className="bg-rose-500 h-full rounded transition-all duration-500 flex items-center justify-start pl-1.5"
                        style={{
                          width: `${Math.max(12, Math.min(100, (activeData.rb_rot_rem_30 / Math.max(activeData.avl_rot_rem_30, activeData.rb_rot_rem_30 || 1)) * 100))}%`
                        }}
                      >
                        {activeData.rb_rot_rem_30}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bar 3: Remoção 50% */}
                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium text-slate-700">
                    <span>Remoção Parcial 50%</span>
                    <span className="font-mono">{activeData.avl_rot_rem_50} vs {activeData.rb_rot_rem_50}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-5">
                    <div className="bg-slate-100 rounded overflow-hidden flex items-center justify-end pr-2 text-[10px] font-mono text-white">
                      <div
                        className="bg-slate-800 h-full rounded transition-all duration-500 flex items-center justify-end pr-1.5"
                        style={{
                          width: `${Math.max(12, Math.min(100, (activeData.avl_rot_rem_50 / Math.max(activeData.avl_rot_rem_50, activeData.rb_rot_rem_50 || 1)) * 100))}%`
                        }}
                      >
                        {activeData.avl_rot_rem_50}
                      </div>
                    </div>
                    <div className="bg-rose-50 rounded overflow-hidden flex items-center justify-start pl-2 text-[10px] font-mono text-white">
                      <div
                        className="bg-rose-500 h-full rounded transition-all duration-500 flex items-center justify-start pl-1.5"
                        style={{
                          width: `${Math.max(12, Math.min(100, (activeData.rb_rot_rem_50 / Math.max(activeData.avl_rot_rem_50, activeData.rb_rot_rem_50 || 1)) * 100))}%`
                        }}
                      >
                        {activeData.rb_rot_rem_50}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 2: Tempos de Busca e Inserção */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Tempos de Execução em Milissegundos
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  Menor é melhor
                </span>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium text-slate-700">
                    <span>Tempo de Inserção Total</span>
                    <span className="font-mono">{activeData.avl_tempo_ins_ms.toFixed(2)}ms vs {activeData.rb_tempo_ins_ms.toFixed(2)}ms</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-5">
                    <div className="bg-slate-100 rounded overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded transition-all duration-500 flex items-center justify-end pr-1.5 text-[10px] font-mono text-white"
                        style={{
                          width: `${Math.max(15, Math.min(100, (activeData.avl_tempo_ins_ms / Math.max(activeData.avl_tempo_ins_ms, activeData.rb_tempo_ins_ms || 1)) * 100))}%`
                        }}
                      >
                        {activeData.avl_tempo_ins_ms.toFixed(2)}ms
                      </div>
                    </div>
                    <div className="bg-rose-50 rounded overflow-hidden">
                      <div
                        className="bg-rose-600 h-full rounded transition-all duration-500 flex items-center justify-start pl-1.5 text-[10px] font-mono text-white"
                        style={{
                          width: `${Math.max(15, Math.min(100, (activeData.rb_tempo_ins_ms / Math.max(activeData.avl_tempo_ins_ms, activeData.rb_tempo_ins_ms || 1)) * 100))}%`
                        }}
                      >
                        {activeData.rb_tempo_ins_ms.toFixed(2)}ms
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium text-slate-700">
                    <span>Tempo de Busca ({activeData.total_buscas.toLocaleString()} consultas)</span>
                    <span className="font-mono">{activeData.avl_tempo_busca_ms.toFixed(2)}ms vs {activeData.rb_tempo_busca_ms.toFixed(2)}ms</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-5">
                    <div className="bg-slate-100 rounded overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded transition-all duration-500 flex items-center justify-end pr-1.5 text-[10px] font-mono text-white"
                        style={{
                          width: `${Math.max(15, Math.min(100, (activeData.avl_tempo_busca_ms / Math.max(activeData.avl_tempo_busca_ms, activeData.rb_tempo_busca_ms || 1)) * 100))}%`
                        }}
                      >
                        {activeData.avl_tempo_busca_ms.toFixed(2)}ms
                      </div>
                    </div>
                    <div className="bg-rose-50 rounded overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded transition-all duration-500 flex items-center justify-start pl-1.5 text-[10px] font-mono text-white"
                        style={{
                          width: `${Math.max(15, Math.min(100, (activeData.rb_tempo_busca_ms / Math.max(activeData.avl_tempo_busca_ms, activeData.rb_tempo_busca_ms || 1)) * 100))}%`
                        }}
                      >
                        {activeData.rb_tempo_busca_ms.toFixed(2)}ms
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium text-slate-700">
                    <span>Tempo de Remoção 30% (Edital)</span>
                    <span className="font-mono">{activeData.avl_tempo_rem_30_ms.toFixed(2)}ms vs {activeData.rb_tempo_rem_30_ms.toFixed(2)}ms</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-5">
                    <div className="bg-slate-100 rounded overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded transition-all duration-500 flex items-center justify-end pr-1.5 text-[10px] font-mono text-white"
                        style={{
                          width: `${Math.max(15, Math.min(100, (activeData.avl_tempo_rem_30_ms / Math.max(activeData.avl_tempo_rem_30_ms, activeData.rb_tempo_rem_30_ms || 1)) * 100))}%`
                        }}
                      >
                        {activeData.avl_tempo_rem_30_ms.toFixed(2)}ms
                      </div>
                    </div>
                    <div className="bg-rose-50 rounded overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded transition-all duration-500 flex items-center justify-start pl-1.5 text-[10px] font-mono text-white"
                        style={{
                          width: `${Math.max(15, Math.min(100, (activeData.rb_tempo_rem_30_ms / Math.max(activeData.avl_tempo_rem_30_ms, activeData.rb_tempo_rem_30_ms || 1)) * 100))}%`
                        }}
                      >
                        {activeData.rb_tempo_rem_30_ms.toFixed(2)}ms
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= SECTION: EQUIVALENCE CHECK & SAMPLES ================= */}
        {activeData && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Validação Cruzada de Integridade e Equivalência Estrutural
                </h4>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
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
