import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  BookOpen,
  ArrowRightLeft,
  X,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Building,
  CreditCard,
  User,
  Sliders,
  Maximize2,
  UserPlus,
  CircleDot,
  Zap,
  Activity,
  Play
} from 'lucide-react';
import BinaryTreeVisualizer from './components/BinaryTreeVisualizer';
import DetailedExecutionInspector from './components/DetailedExecutionInspector';
import ExperimentsDashboard from './components/ExperimentsDashboard';

const API_BASE = 'http://localhost:8000';

export default function App() {
  // Tree State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [showNil, setShowNil] = useState(true);
  const [highlightKey, setHighlightKey] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // View Mode: 'split' (Lado a Lado), 'avl' (Foco na AVL), 'rb' (Foco na Rubro-Negra), 'traversals' (Caminhamentos e Extremos), 'experiments' (Experimentos Automáticos)
  const [viewMode, setViewMode] = useState('split');

  // Step-by-step Interactive Tree State (for Focus Views)
  const [stepTreeAVL, setStepTreeAVL] = useState(null);
  const [stepTreeRB, setStepTreeRB] = useState(null);
  const [stepFocusKey, setStepFocusKey] = useState(null);

  // Experimentos Automáticos (Item 9 do Terminal)
  const [experimentMode, setExperimentMode] = useState('padrao'); // 'padrao' | 'rapida' | 'custom'
  const [experimentCustomN, setExperimentCustomN] = useState('500');
  const [experimentRunKey, setExperimentRunKey] = useState(0);
  const [showCustomNInput, setShowCustomNInput] = useState(false);

  // Accordion state for Operações de Conta in the sidebar
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [consultarOpen, setConsultarOpen] = useState(false);

  // Confirmation Modal for running experiments
  const [confirmExperimentModal, setConfirmExperimentModal] = useState(null);

  const handleDispararExperimento = (modo, customVal = '500') => {
    setExperimentMode(modo);
    if (modo === 'custom') {
      setExperimentCustomN(customVal);
    }
    setExperimentRunKey((prev) => prev + 1);
    setViewMode('experiments');
    setStepTreeAVL(null);
    setStepTreeRB(null);
    setStepFocusKey(null);
  };

  const solicitarExecucaoExperimento = (modo, customVal = '500') => {
    let label = 'Bateria Completa (N = 100, 1.000 e 10.000)';
    let desc = 'Executa as simulações para os 3 tamanhos sob seed determinística (seed = 42), abrangendo inserções, buscas e 3 bateladas de remoção (10%, 30% e 50%), com trava de segurança interativa para inspeção.';

    if (modo === 'rapida') {
      label = 'Validação Rápida (N = 100)';
      desc = 'Executa a bateria de testes completa para N = 100 contas. A execução é quase instantânea (~13ms) para conferência imediata de todas as métricas estruturais.';
    } else if (modo === 'custom') {
      const parsed = parseInt(customVal) || 500;
      label = `Teste Personalizado (N = ${parsed.toLocaleString()})`;
      desc = `Executa as baterias comparativas para exatamente ${parsed.toLocaleString()} contas bancárias sob a semente determinística seed = 42.`;
    }

    setConfirmExperimentModal({
      modo,
      customVal,
      label,
      desc
    });
  };

  // Drawers & Modals
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showConsoleDrawer, setShowConsoleDrawer] = useState(false);

  // Operation Form States (used by Modals)
  const [numeroConta, setNumeroConta] = useState('');
  const [titular, setTitular] = useState('');
  const [saldo, setSaldo] = useState('1500.00');
  const [tipoConta, setTipoConta] = useState('Corrente');
  const [chaveOperacao, setChaveOperacao] = useState('');
  const [searchResult, setSearchResult] = useState(null);

  // Notifications
  const [notification, setNotification] = useState(null);

  // Logs
  const [logsRecentes, setLogsRecentes] = useState({ avl: [], rb: [] });
  const [logFilter, setLogFilter] = useState('todos'); // 'todos' | 'avl' | 'rb'

  const notify = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const formatErrorMessage = (detail, fallback = 'Erro na operação') => {
    if (!detail) return fallback;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map(err => {
        const field = err.loc ? err.loc[err.loc.length - 1] : '';
        return field ? `Campo '${field}': ${err.msg}` : err.msg;
      }).join(' | ');
    }
    if (typeof detail === 'object') return JSON.stringify(detail);
    return String(detail);
  };

  const fetchEstado = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/estado`);
      if (!res.ok) throw new Error('Falha ao comunicar com o backend');
      const json = await res.json();
      setData(json.dados);
      setBackendOnline(true);
    } catch (err) {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchEstado();
    const interval = setInterval(fetchEstado, 4000);
    return () => clearInterval(interval);
  }, [fetchEstado]);

  // Operations
  const handleInserir = async (e) => {
    e.preventDefault();
    const num = parseInt(numeroConta);
    if (isNaN(num) || num <= 0) {
      return notify('Informe um número de conta inteiro e positivo.', 'error');
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/inserir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_conta: num,
          titular: titular.trim() || `Conta ${num}`,
          saldo: parseFloat(saldo) || 1000.0,
          tipo: tipoConta
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(json.detail, 'Erro ao inserir conta'));

      setData(json.dados);
      if (json.logs) setLogsRecentes(json.logs);
      setHighlightKey(num);
      notify(`Conta ${num} cadastrada com sucesso nas duas árvores!`, 'success');
      setNumeroConta('');
      setTitular('');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBuscar = async (e) => {
    e.preventDefault();
    const num = parseInt(chaveOperacao);
    if (isNaN(num) || num <= 0) {
      return notify('Informe o número da conta para consulta.', 'error');
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/buscar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_conta: num })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(json.detail, 'Erro na busca'));

      if (json.encontrada) {
        setSearchResult(json.conta);
        setHighlightKey(num);
        notify(`Conta ${num} encontrada!`, 'success');
      } else {
        setSearchResult(null);
        notify(`Conta ${num} não consta no cadastro bancário.`, 'warning');
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (e) => {
    e.preventDefault();
    const num = parseInt(chaveOperacao);
    if (isNaN(num) || num <= 0) {
      return notify('Informe o número da conta para encerramento.', 'error');
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/remover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_conta: num })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(json.detail, 'Erro ao remover conta'));

      setData(json.dados);
      if (json.logs) setLogsRecentes(json.logs);
      setSearchResult(null);
      setHighlightKey(null);
      notify(`Conta ${num} encerrada com sucesso.`, 'success');
      setChaveOperacao('');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/limpar`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(json.detail, 'Erro ao limpar árvores'));

      setData(json.dados);
      setLogsRecentes({ avl: [], rb: [] });
      setHighlightKey(null);
      setSearchResult(null);
      setSelectedNode(null);
      notify('Ambas as árvores foram resetadas com sucesso.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCarregarPreset = async (presetId, nomeLegivel) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/preset/${presetId}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(json.detail, 'Erro ao carregar cenário'));

      setData(json.dados);
      if (json.logs) setLogsRecentes(json.logs);
      setHighlightKey(null);
      notify(`Cenário "${nomeLegivel}" carregado!`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased">
      {/* -------------------- LEFT SIDEBAR (RevenuePulseAI Minimalist Style) -------------------- */}
      <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 select-none z-10">
        {/* Workspace Brand / Header */}
        <div className="h-14 border-b border-slate-200 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              B
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-900 leading-tight">Sistema Bancário</h1>
              <p className="text-[11px] text-slate-500 font-medium">Árvores Balanceadas</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
            v1.0
          </span>
        </div>

        {/* Sidebar Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
          {/* Section: OPERAÇÕES DE CONTA (Topo das Opções) */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-2">
              Operações de Conta
            </span>
            <div className="space-y-1">
              {/* Item: Cadastrar Conta */}
              <button
                type="button"
                onClick={() => setCadastrarOpen(!cadastrarOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                  cadastrarOpen ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserPlus className="w-4 h-4 text-slate-400" />
                  <span>Cadastrar Conta</span>
                </div>
                <ChevronRight
                  className="w-3.5 h-3.5 text-slate-400 transition-transform duration-200"
                  style={{ transform: cadastrarOpen ? 'rotate(90deg)' : 'none' }}
                />
              </button>

              {/* Subsection: Cadastrar Form Inline */}
              {cadastrarOpen && (
                <form
                  onSubmit={handleInserir}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 my-1.5 animate-in fade-in duration-150"
                >
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Número da Conta <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ex: 20"
                      value={numeroConta}
                      onChange={(e) => setNumeroConta(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-mono transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nome do Titular <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Silva"
                      value={titular}
                      onChange={(e) => setTitular(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Saldo (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={saldo}
                        onChange={(e) => setSaldo(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tipo</label>
                      <select
                        value={tipoConta}
                        onChange={(e) => setTipoConta(e.target.value)}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="Corrente">Corrente</option>
                        <option value="Poupanca">Poupança</option>
                        <option value="Salario">Salário</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-1 text-xs font-semibold py-2 px-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{loading ? 'Cadastrando...' : 'Inserir nas Duas Árvores'}</span>
                  </button>
                </form>
              )}

              {/* Item: Consultar / Excluir */}
              <button
                type="button"
                onClick={() => setConsultarOpen(!consultarOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                  consultarOpen ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Search className="w-4 h-4 text-slate-400" />
                  <span>Consultar / Excluir</span>
                </div>
                <ChevronRight
                  className="w-3.5 h-3.5 text-slate-400 transition-transform duration-200"
                  style={{ transform: consultarOpen ? 'rotate(90deg)' : 'none' }}
                />
              </button>

              {/* Subsection: Consultar Form Inline */}
              {consultarOpen && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 my-1.5 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Número da Conta <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Digite o número da conta..."
                      value={chaveOperacao}
                      onChange={(e) => setChaveOperacao(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleBuscar}
                      disabled={loading || !chaveOperacao}
                      className="text-xs font-semibold py-1.5 px-2 rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Search className="w-3.5 h-3.5 text-slate-500" />
                      <span>Localizar</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemover}
                      disabled={loading || !chaveOperacao}
                      className="text-xs font-semibold py-1.5 px-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Encerrar</span>
                    </button>
                  </div>

                  {/* Search Result Card */}
                  {searchResult && (
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1.5 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-900">Conta #{searchResult.numero_conta}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                          Ativa
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">Titular: <span className="font-medium text-slate-800">{searchResult.titular}</span></p>
                      <p className="text-[11px] text-slate-600">Saldo: <span className="font-mono font-semibold text-slate-800">R$ {searchResult.saldo.toFixed(2)}</span></p>
                      <p className="text-[11px] text-slate-600">Tipo: <span className="font-medium text-slate-800">{searchResult.tipo}</span></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section: VISUALIZAÇÃO DE ÁRVORES */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-2">
              Visualização de Árvores
            </span>
            <div className="space-y-1">
              {[
                { id: 'split', label: 'Lado a Lado (Comparativo)', icon: ArrowRightLeft },
                { id: 'avl', label: 'Foco na AVL', icon: Layers },
                { id: 'rb', label: 'Foco na Rubro-Negra', icon: CircleDot },
                { id: 'traversals', label: 'Caminhamentos & Extremos', icon: TrendingUp }
              ].map((item) => {
                const IconComponent = item.icon;
                const isActive = viewMode === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setViewMode(item.id);
                      setStepTreeAVL(null);
                      setStepTreeRB(null);
                      setStepFocusKey(null);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: EXPERIMENTOS AUTOMÁTICOS */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-2">
              Experimentos Automáticos
            </span>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => solicitarExecucaoExperimento('padrao')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                  viewMode === 'experiments' && experimentMode === 'padrao'
                    ? 'bg-indigo-50 text-indigo-900 font-semibold border border-indigo-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>Bateria Completa (100, 1k, 10k)</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-mono font-medium">
                  Auto
                </span>
              </button>

              <button
                type="button"
                onClick={() => solicitarExecucaoExperimento('rapida')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                  viewMode === 'experiments' && experimentMode === 'rapida'
                    ? 'bg-indigo-50 text-indigo-900 font-semibold border border-indigo-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Validação Rápida (N = 100)</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 font-mono font-medium">
                  13ms
                </span>
              </button>

              {/* Custom N Collapsible */}
              <div
                className={`rounded-xl transition-all overflow-hidden ${
                  viewMode === 'experiments' && experimentMode === 'custom'
                    ? 'bg-indigo-50/50 border border-indigo-200'
                    : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setShowCustomNInput(!showCustomNInput)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 text-slate-400" />
                    <span>Tamanho Personalizado</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      showCustomNInput ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                {showCustomNInput && (
                  <div className="px-3 pb-2.5 pt-1 flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      placeholder="N livre (ex: 500)"
                      value={experimentCustomN}
                      onChange={(e) => setExperimentCustomN(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => solicitarExecucaoExperimento('custom', experimentCustomN)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors shrink-0 shadow-2xs cursor-pointer"
                    >
                      Rodar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: CONFIGURAÇÕES & EXIBIÇÃO */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block mb-2">
              Configurações & Exibição
            </span>
            <div className="space-y-1.5 px-1">
              <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={showNil}
                  onChange={(e) => setShowNil(e.target.checked)}
                  className="w-3.5 h-3.5 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Sentinelas NIL na Rubro-Negra</span>
              </label>

              <button
                type="button"
                onClick={() => setShowConsoleDrawer(!showConsoleDrawer)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
              >
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                <span>Console de Rotações</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer (Profile / Info Card) */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs shadow-2xs">
              UF
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-slate-800 text-xs">Equipe AED II</p>
              <p className="text-[11px] text-slate-500">Ciência da Computação</p>
            </div>
          </div>
          <button
            onClick={() => setShowGuideModal(true)}
            title="Guia Teórico das Estruturas"
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* -------------------- MAIN WORKSPACE AREA -------------------- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header Bar - Clean view title only */}
        <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-xs font-semibold text-slate-800 tracking-tight">
              {viewMode === 'split' && 'Visualização: Lado a Lado (Comparativo AVL vs Rubro-Negra)'}
              {viewMode === 'avl' && 'Visualização: Foco na Árvore AVL'}
              {viewMode === 'rb' && 'Visualização: Foco na Árvore Rubro-Negra'}
              {viewMode === 'traversals' && 'Visualização: Caminhamentos & Extremos'}
              {viewMode === 'experiments' && 'Laboratório de Experimentos Automáticos'}
            </span>
          </div>

          {/* Right Header Status & Actions */}
          <div className="flex items-center gap-3">
            {/* Backend Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                backendOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{backendOnline ? 'Python Engine Ativo' : 'Engine Offline'}</span>
            </div>

            {/* Execution Console Toggle */}
            <button
              onClick={() => setShowConsoleDrawer(!showConsoleDrawer)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>Console de Rotações</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={() => setShowResetConfirm(true)}
              title="Resetar ambas as árvores"
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resetar</span>
            </button>
          </div>
        </header>

        {/* Global Notification Banner */}
        {notification && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center justify-between border-b ${
              notification.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : notification.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <span>{notification.msg}</span>
            <button onClick={() => setNotification(null)} className="p-0.5 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {viewMode === 'experiments' ? (
            /* ================= VIEW: EXPERIMENTOS CIENTÍFICOS (Item 9 do Terminal) ================= */
            <ExperimentsDashboard
              apiBase={API_BASE}
              onBackToTrees={() => setViewMode('split')}
              onNotify={notify}
              initialMode={experimentMode}
              initialN={experimentCustomN}
              runTrigger={experimentRunKey}
              key={experimentRunKey}
            />
          ) : viewMode === 'traversals' ? (
            /* ================= VIEW: CAMINHAMENTOS & EXTREMOS (Paridade com main.py Opção 5) ================= */
            <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Estatísticas, Caminhamentos & Extremos</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualização detalhada dos percursos em árvore e chaves extremas (reprodução fidedigna da Opção 5 do main.py).
                </p>
              </div>

              {/* Side-by-side traversal cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card AVL */}
                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border border-slate-900 bg-white" />
                      <h3 className="font-semibold text-sm text-slate-900">Árvore AVL</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                      Válida (|FB| ≤ 1)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-medium">Altura</p>
                      <p className="text-base font-bold text-slate-800">{data?.avl?.altura ?? -1}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-medium">Nós</p>
                      <p className="text-base font-bold text-slate-800">{data?.avl?.total_nos ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-medium">Rotações</p>
                      <p className="text-base font-bold text-slate-800">{data?.avl?.rotacoes_total ?? 0}</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Caminhamento Em-Ordem (Ordenado):</p>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800 break-words">
                        {data?.avl?.caminhamentos?.em?.length > 0
                          ? data.avl.caminhamentos.em.join('  ➜  ')
                          : 'Árvore vazia'}
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Caminhamento Pré-Ordem (Raiz-Esq-Dir):</p>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800 break-words">
                        {data?.avl?.caminhamentos?.pre?.length > 0
                          ? data.avl.caminhamentos.pre.join('  ➜  ')
                          : 'Árvore vazia'}
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Caminhamento Pós-Ordem (Esq-Dir-Raiz):</p>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800 break-words">
                        {data?.avl?.caminhamentos?.pos?.length > 0
                          ? data.avl.caminhamentos.pos.join('  ➜  ')
                          : 'Árvore vazia'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <p className="text-[11px] text-slate-500">Menor Conta:</p>
                        <p className="font-semibold text-slate-800">
                          {data?.avl?.menor ? `#${data.avl.menor.numero_conta} (${data.avl.menor.titular})` : 'Nenhuma'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Maior Conta:</p>
                        <p className="font-semibold text-slate-800">
                          {data?.avl?.maior ? `#${data.avl.maior.numero_conta} (${data.avl.maior.titular})` : 'Nenhuma'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Rubro-Negra */}
                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-900" />
                      <h3 className="font-semibold text-sm text-slate-900">Árvore Rubro-Negra</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                      Válida (Cormen Cap. 13)
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-medium">Altura</p>
                      <p className="text-base font-bold text-slate-800">{data?.rubro_negra?.altura ?? -1}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-medium">Nós</p>
                      <p className="text-base font-bold text-slate-800">{data?.rubro_negra?.total_nos ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-medium">Rotações</p>
                      <p className="text-base font-bold text-slate-800">{data?.rubro_negra?.rotacoes_total ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-medium">Recolorações</p>
                      <p className="text-base font-bold text-slate-800">{data?.rubro_negra?.recoloracoes ?? 0}</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Caminhamento Em-Ordem (Ordenado):</p>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800 break-words">
                        {data?.rubro_negra?.caminhamentos?.em?.length > 0
                          ? data.rubro_negra.caminhamentos.em.join('  ➜  ')
                          : 'Árvore vazia'}
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Caminhamento Pré-Ordem (Raiz-Esq-Dir):</p>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800 break-words">
                        {data?.rubro_negra?.caminhamentos?.pre?.length > 0
                          ? data.rubro_negra.caminhamentos.pre.join('  ➜  ')
                          : 'Árvore vazia'}
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Caminhamento Pós-Ordem (Esq-Dir-Raiz):</p>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800 break-words">
                        {data?.rubro_negra?.caminhamentos?.pos?.length > 0
                          ? data.rubro_negra.caminhamentos.pos.join('  ➜  ')
                          : 'Árvore vazia'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <p className="text-[11px] text-slate-500">Menor Conta:</p>
                        <p className="font-semibold text-slate-800">
                          {data?.rubro_negra?.menor ? `#${data.rubro_negra.menor.numero_conta} (${data.rubro_negra.menor.titular})` : 'Nenhuma'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Maior Conta:</p>
                        <p className="font-semibold text-slate-800">
                          {data?.rubro_negra?.maior ? `#${data.rubro_negra.maior.numero_conta} (${data.rubro_negra.maior.titular})` : 'Nenhuma'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= VIEW: CANVAS DE VISUALIZAÇÃO GRÁFICA ================= */
            <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
              {/* Quick Rebalance Alert Banner in Split View */}
              {viewMode === 'split' && (data?.ultimo_diagnostico?.avl?.houve_rebalanceamento || data?.ultimo_diagnostico?.rubro_negra?.houve_rebalanceamento) && (
                <div className="mb-3 px-3.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs text-indigo-950 shrink-0 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="font-medium">
                      <b>Rebalanceamento executado:</b>{' '}
                      {data.ultimo_diagnostico.avl.houve_rebalanceamento ? `[AVL: ${data.ultimo_diagnostico.avl.caso}]` : ''}
                      {data.ultimo_diagnostico.avl.houve_rebalanceamento && data.ultimo_diagnostico.rubro_negra.houve_rebalanceamento ? ' ' : ''}
                      {data.ultimo_diagnostico.rubro_negra.houve_rebalanceamento ? `[RN: ${data.ultimo_diagnostico.rubro_negra.caso}]` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.ultimo_diagnostico.avl.houve_rebalanceamento && (
                      <button
                        onClick={() => {
                          setViewMode('avl');
                          setStepTreeAVL(null);
                          setStepFocusKey(null);
                        }}
                        className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-800 text-[11px] font-semibold hover:bg-indigo-50 transition-colors shadow-2xs"
                      >
                        Inspecionar na AVL ➜
                      </button>
                    )}
                    {data.ultimo_diagnostico.rubro_negra.houve_rebalanceamento && (
                      <button
                        onClick={() => {
                          setViewMode('rb');
                          setStepTreeRB(null);
                          setStepFocusKey(null);
                        }}
                        className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-800 text-[11px] font-semibold hover:bg-indigo-50 transition-colors shadow-2xs"
                      >
                        Inspecionar na Rubro-Negra ➜
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Metrics Bar on top of Canvas */}
              <div className={`grid gap-4 mb-3 shrink-0 ${viewMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {/* AVL Header Card */}
                {(viewMode === 'split' || viewMode === 'avl') && (
                  <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full border border-slate-900 bg-white" />
                      <span className="text-xs font-semibold text-slate-800">
                        Árvore AVL
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">|FB| ≤ 1</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                      <span>Altura: <b className="text-slate-900">{data?.avl?.altura ?? -1}</b></span>
                      <span>Nós: <b className="text-slate-900">{data?.avl?.total_nos ?? 0}</b></span>
                      <span>Rotações: <b className="text-slate-900">{data?.avl?.rotacoes_total ?? 0}</b></span>
                    </div>
                  </div>
                )}

                {/* Rubro-Negra Header Card */}
                {(viewMode === 'split' || viewMode === 'rb') && (
                  <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                      <span className="text-xs font-semibold text-slate-800">
                        Árvore Rubro-Negra
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Cormen Cap. 13</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                      <span>Altura: <b className="text-slate-900">{data?.rubro_negra?.altura ?? -1}</b></span>
                      <span>Nós: <b className="text-slate-900">{data?.rubro_negra?.total_nos ?? 0}</b></span>
                      <span>Rotações: <b className="text-slate-900">{data?.rubro_negra?.rotacoes_total ?? 0}</b></span>
                      <span>Recolorações: <b className="text-slate-900">{data?.rubro_negra?.recoloracoes ?? 0}</b></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Viewports: Split vs Focus with Step-by-Step Inspector */}
              {viewMode === 'split' && (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden relative">
                  <div className="h-full flex flex-col min-h-0">
                    <BinaryTreeVisualizer
                      root={data?.avl?.raiz}
                      type="avl"
                      highlightKey={highlightKey}
                      onSelectNode={(node) => setSelectedNode({ ...node, treeType: 'AVL' })}
                    />
                  </div>
                  <div className="h-full flex flex-col min-h-0">
                    <BinaryTreeVisualizer
                      root={data?.rubro_negra?.raiz}
                      type="rb"
                      showNil={showNil}
                      highlightKey={highlightKey}
                      onSelectNode={(node) => setSelectedNode({ ...node, treeType: 'Rubro-Negra' })}
                    />
                  </div>
                </div>
              )}

              {viewMode === 'avl' && (
                <div className="flex-1 flex gap-4 overflow-hidden relative">
                  <div className="flex-1 h-full min-h-0">
                    <BinaryTreeVisualizer
                      root={stepTreeAVL || data?.avl?.raiz}
                      type="avl"
                      highlightKey={stepFocusKey || highlightKey}
                      onSelectNode={(node) => setSelectedNode({ ...node, treeType: 'AVL' })}
                    />
                  </div>
                  <DetailedExecutionInspector
                    diagnostic={data?.ultimo_diagnostico}
                    treeType="avl"
                    onSelectStep={(step) => {
                      setStepTreeAVL(step?.arvore || null);
                      setStepFocusKey(step?.no_foco || null);
                    }}
                  />
                </div>
              )}

              {viewMode === 'rb' && (
                <div className="flex-1 flex gap-4 overflow-hidden relative">
                  <div className="flex-1 h-full min-h-0">
                    <BinaryTreeVisualizer
                      root={stepTreeRB || data?.rubro_negra?.raiz}
                      type="rb"
                      showNil={showNil}
                      highlightKey={stepFocusKey || highlightKey}
                      onSelectNode={(node) => setSelectedNode({ ...node, treeType: 'Rubro-Negra' })}
                    />
                  </div>
                  <DetailedExecutionInspector
                    diagnostic={data?.ultimo_diagnostico}
                    treeType="rb"
                    onSelectStep={(step) => {
                      setStepTreeRB(step?.arvore || null);
                      setStepFocusKey(step?.no_foco || null);
                    }}
                  />
                </div>
              )}

              {/* Floating Bottom Legend (Twinize style: clean horizontal pill) */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-full px-4 py-1.5 shadow-sm flex items-center gap-4 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                  <span>Nó Negro</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  <span>Nó Rubro</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-2.5 rounded-xs bg-slate-100 border border-dashed border-slate-300 inline-block" />
                  <span>Sentinela NIL</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-900" />
                  <span>AVL Balanceada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-100 border border-amber-500" />
                  <span>Risco |FB| ≥ 2</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* -------------------- COLLAPSIBLE FLIGHT RECORDER DRAWER -------------------- */}
        {showConsoleDrawer && (
          <div className="h-64 border-t border-slate-200 bg-white flex flex-col shrink-0 z-30 shadow-lg">
            <div className="h-10 border-b border-slate-200 px-4 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Terminal className="w-3.5 h-3.5 text-slate-600" />
                  <span>Console Diagnóstico de Rotações & Balanceamento</span>
                </div>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200 text-[11px]">
                  <button
                    onClick={() => setLogFilter('todos')}
                    className={`px-2 py-0.5 rounded-sm font-medium ${
                      logFilter === 'todos' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Geral
                  </button>
                  <button
                    onClick={() => setLogFilter('avl')}
                    className={`px-2 py-0.5 rounded-sm font-medium ${
                      logFilter === 'avl' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    AVL
                  </button>
                  <button
                    onClick={() => setLogFilter('rb')}
                    className={`px-2 py-0.5 rounded-sm font-medium ${
                      logFilter === 'rb' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Rubro-Negra
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowConsoleDrawer(false)}
                className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-slate-700 space-y-1 bg-slate-50/50">
              {logsRecentes.avl.length === 0 && logsRecentes.rb.length === 0 ? (
                <p className="text-slate-400 italic">Nenhum evento registrado nesta sessão ainda. Realize uma operação para ver o rastreamento.</p>
              ) : (
                <>
                  {(logFilter === 'todos' || logFilter === 'avl') &&
                    logsRecentes.avl.map((line, idx) => (
                      <div key={`avl-log-${idx}`} className="flex items-start gap-2">
                        <span className="text-sky-600 shrink-0 font-bold">[AVL]</span>
                        <span className="text-slate-800">{line}</span>
                      </div>
                    ))}
                  {(logFilter === 'todos' || logFilter === 'rb') &&
                    logsRecentes.rb.map((line, idx) => (
                      <div key={`rb-log-${idx}`} className="flex items-start gap-2">
                        <span className="text-rose-600 shrink-0 font-bold">[RB]</span>
                        <span className="text-slate-800">{line}</span>
                      </div>
                    ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* -------------------- NODE DETAIL MODAL -------------------- */}
        {selectedNode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-2xs p-4">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    #
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">Conta #{selectedNode.chave}</h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <p><b>Titular:</b> <span className="text-slate-900 font-medium">{selectedNode.titular}</span></p>
                <p><b>Saldo Bancário:</b> <span className="font-mono text-slate-900 font-medium">R$ {selectedNode.saldo?.toFixed(2) ?? '0.00'}</span></p>
                <p><b>Agência / Tipo:</b> <span className="text-slate-900">{selectedNode.agencia || '0001'} · {selectedNode.tipo || 'Corrente'}</span></p>

                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-700">Métricas Estruturais:</p>
                  {selectedNode.fb !== undefined && (
                    <p>Fator de Balanceamento (FB): <b className="font-mono text-slate-900">{selectedNode.fb}</b></p>
                  )}
                  {selectedNode.altura !== undefined && (
                    <p>Altura na Subárvore: <b className="font-mono text-slate-900">{selectedNode.altura}</b></p>
                  )}
                  {selectedNode.cor && (
                    <p>Cor na Árvore Rubro-Negra: <b className="font-mono text-slate-900">{selectedNode.cor}</b></p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="w-full mt-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        )}

        {/* -------------------- RESET CONFIRMATION MODAL (Nielsen #3 & #5) -------------------- */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-2xs p-4">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-semibold text-slate-900 text-sm">Confirmar Redefinição</h3>
              </div>
              <p className="text-xs text-slate-600">
                Tem certeza que deseja resetar ambas as árvores? Todas as contas cadastradas nesta sessão serão removidas.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs"
                >
                  Sim, Resetar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- THEORETICAL GUIDE MODAL (Nielsen #10) -------------------- */}
        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-2xs p-4">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-slate-900" />
                  <h3 className="font-semibold text-slate-900 text-base">Guia Teórico de AED II · Árvores Balanceadas</h3>
                </div>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">1. Árvore AVL (Adelson-Velsky & Landis)</h4>
                  <p>
                    Estrutura estritamente balanceada por altura. Para todo nó, a diferença entre a altura da subárvore esquerda e direita deve satisfazer:
                  </p>
                  <div className="my-2 p-2 rounded-md bg-slate-50 border border-slate-200 font-mono text-center font-bold text-slate-800">
                    FB(u) = h(esq) - h(dir)  onde  |FB(u)| ≤ 1
                  </div>
                  <p>
                    Quando ocorre inserção ou remoção e |FB| atinge 2, executa-se rotação simples (esquerda ou direita) ou rotação dupla (esquerda-direita ou direita-esquerda).
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">2. Árvore Rubro-Negra (Cormen et al., Cap. 13)</h4>
                  <p>
                    Árvore de busca binária aproximada onde cada nó carrega um bit de cor (Rubro ou Negro) satisfazendo rigorosamente as 5 propriedades:
                  </p>
                  <ul className="list-decimal pl-5 space-y-1 mt-1">
                    <li>Todo nó é <b>Rubro</b> ou <b>Negro</b>.</li>
                    <li>A raiz é sempre <b>Negra</b>.</li>
                    <li>Todas as folhas (sentinelas <b>NIL</b>) são <b>Negras</b>.</li>
                    <li>Se um nó é <b>Rubro</b>, ambos os seus filhos são obrigatoriamente <b>Negros</b> (nunca há nós rubros adjacentes).</li>
                    <li>Para cada nó, todos os caminhos simples dele até suas folhas descendentes contêm o mesmo número de nós negros (mesma <b>Altura Negra - bh</b>).</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">3. Comportamentos Fundamentais de Balanceamento</h4>
                  <p>
                    Propriedades essenciais avaliadas pelo sistema:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-600">
                    <li><b>Pior Caso ABB:</b> Inserção estritamente crescente que tornaria uma ABB comum em lista encadeada (O(n)), mas AVL e RB mantêm altura O(log n).</li>
                    <li><b>Tio Vermelho:</b> Caso em que apenas recolorações ocorrem, sem custo de rotação de ponteiros.</li>
                    <li><b>Rotação Dupla:</b> Caso zigue-zague onde uma rotação simples é insuficiente para restaurar as propriedades.</li>
                    <li><b>Remoção Grau 2:</b> Demonstra a substituição da conta excluída pelo seu sucessor em ordem (menor da subárvore direita).</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: CONFIRMAR EXECUÇÃO DE EXPERIMENTO ================= */}
        {confirmExperimentModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Confirmar Execução de Testes</h3>
                    <p className="text-xs text-slate-500">Laboratório de Experimentos Automáticos</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmExperimentModal(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      {confirmExperimentModal.label}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold font-mono">
                      seed = 42
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {confirmExperimentModal.desc}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg border border-slate-100 bg-white">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold block">Estruturas</span>
                    <span className="font-semibold text-slate-800 text-[11px]">AVL vs RN</span>
                  </div>
                  <div className="p-2 rounded-lg border border-slate-100 bg-white">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold block">Cenários</span>
                    <span className="font-semibold text-slate-800 text-[11px]">Aleatório & Crescente</span>
                  </div>
                  <div className="p-2 rounded-lg border border-slate-100 bg-white">
                    <span className="text-[10px] uppercase text-slate-400 font-semibold block">Remoções</span>
                    <span className="font-semibold text-slate-800 text-[11px]">10%, 30% e 50%</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  Ao confirmar, os cálculos serão gerados dinamicamente pelo algoritmo em tempo real, com total reprodutibilidade dos resultados.
                </p>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConfirmExperimentModal(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const { modo, customVal } = confirmExperimentModal;
                      setConfirmExperimentModal(null);
                      handleDispararExperimento(modo, customVal);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Confirmar e Executar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
