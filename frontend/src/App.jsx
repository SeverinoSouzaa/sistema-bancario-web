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
  Maximize2
} from 'lucide-react';
import BinaryTreeVisualizer from './components/BinaryTreeVisualizer';
import DetailedExecutionInspector from './components/DetailedExecutionInspector';

const API_BASE = 'http://localhost:8000';

export default function App() {
  // Tree State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [showNil, setShowNil] = useState(true);
  const [highlightKey, setHighlightKey] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // View Mode: 'split' (Lado a Lado), 'avl' (Foco AVL), 'rb' (Foco Rubro-Negra), 'traversals' (Caminhamentos e Extremos)
  const [viewMode, setViewMode] = useState('split');
  const [modoDetalhado, setModoDetalhado] = useState(true);

  // Drawers & Modals
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showConsoleDrawer, setShowConsoleDrawer] = useState(false);

  // Operation Forms
  const [sidebarTab, setSidebarTab] = useState('inserir'); // 'inserir' | 'buscar'
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
      {/* -------------------- LEFT SIDEBAR (Helicon Style) -------------------- */}
      <aside className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0 select-none z-10">
        {/* Workspace Brand / Header */}
        <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              B
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 leading-tight">Sistema Bancário</h1>
              <p className="text-[11px] text-slate-500 font-medium">AED II · UFAM / ICET</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold border border-slate-200">
            v1.0
          </span>
        </div>

        {/* Sidebar Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Section: Operações Bancárias */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Operações de Conta
              </span>
            </div>

            {/* Segmented Control */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-medium mb-3 border border-slate-200">
              <button
                type="button"
                onClick={() => setSidebarTab('inserir')}
                className={`py-1.5 rounded-md transition-all ${
                  sidebarTab === 'inserir'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cadastrar
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('buscar')}
                className={`py-1.5 rounded-md transition-all ${
                  sidebarTab === 'buscar'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Consultar / Excluir
              </button>
            </div>

            {/* Tab: Inserir */}
            {sidebarTab === 'inserir' && (
              <form onSubmit={handleInserir} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Número da Conta <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 20"
                    value={numeroConta}
                    onChange={(e) => setNumeroConta(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome do Titular <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Silva"
                    value={titular}
                    onChange={(e) => setTitular(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Saldo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={saldo}
                      onChange={(e) => setSaldo(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
                    <select
                      value={tipoConta}
                      onChange={(e) => setTipoConta(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
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
                  className="w-full mt-2 text-xs font-semibold py-2 px-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Inserir nas Duas Árvores</span>
                </button>
              </form>
            )}

            {/* Tab: Buscar / Remover */}
            {sidebarTab === 'buscar' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Número da Conta <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Digite a conta..."
                    value={chaveOperacao}
                    onChange={(e) => setChaveOperacao(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleBuscar}
                    disabled={loading || !chaveOperacao}
                    className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Search className="w-3.5 h-3.5 text-slate-600" />
                    <span>Localizar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemover}
                    disabled={loading || !chaveOperacao}
                    className="text-xs font-medium py-2 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Encerrar</span>
                  </button>
                </div>

                {/* Search result card */}
                {searchResult && (
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/80 mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">Conta #{searchResult.numero_conta}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                        Ativa
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">Titular: <span className="font-medium text-slate-800">{searchResult.titular}</span></p>
                    <p className="text-xs text-slate-600">Saldo: <span className="font-mono font-medium text-slate-800">R$ {searchResult.saldo.toFixed(2)}</span></p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            {/* Section: Cenários Demonstrativos da Banca */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Cenários da Defesa (AED II)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Conjuntos de teste para demonstrar os casos do Edital à banca avaliadora:
            </p>

            <div className="space-y-1.5">
              {[
                { id: 'pior_caso_abb', label: '1. Pior Caso ABB', desc: 'Seq. ordenada 1..6 (Desbalanceamento)' },
                { id: 'tio_vermelho', label: '2. Tio Vermelho (Caso 1)', desc: 'Cormen Cap. 13 (Apenas recoloração)' },
                { id: 'rotacao_dupla', label: '3. Rotação Dupla', desc: 'Caso Zigue-Zague (AVL e RB)' },
                { id: 'remocao_grau_2', label: '4. Remoção Grau 2', desc: 'Encerramento de nó com 2 filhos' }
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCarregarPreset(c.id, c.label)}
                  disabled={loading}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-slate-950">
                      {c.label}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Settings */}
          <div className="border-t border-slate-200 pt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Exibição
            </span>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={showNil}
                onChange={(e) => setShowNil(e.target.checked)}
                className="w-3.5 h-3.5 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span>Exibir sentinelas NIL na Rubro-Negra</span>
            </label>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
              UF
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-slate-700 text-[11px]">Equipe AED II</p>
              <p className="text-[10px] text-slate-400">Ciência da Computação</p>
            </div>
          </div>
          <button
            onClick={() => setShowGuideModal(true)}
            title="Abrir Guia Teórico"
            className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* -------------------- MAIN WORKSPACE AREA -------------------- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header Bar (AWS Explorer & Twinize Style) */}
        <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0 z-10">
          {/* View Mode Navigation Tabs */}
          <div className="flex items-center gap-1">
            {[
              { id: 'split', label: 'Lado a Lado' },
              { id: 'avl', label: 'Foco AVL (Passo a Passo)' },
              { id: 'rb', label: 'Foco Rubro-Negra (Passo a Passo)' },
              { id: 'traversals', label: 'Caminhamentos & Extremos' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
                  viewMode === tab.id
                    ? 'bg-slate-100 text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Header Status & Actions */}
          <div className="flex items-center gap-3">
            {/* Modo Detalhado Toggle (Opção 1 do terminal / Edital Seção 2.4) */}
            <button
              type="button"
              onClick={() => setModoDetalhado(!modoDetalhado)}
              className={`text-xs px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition-colors font-medium ${
                modoDetalhado
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Alternar Modo Detalhado (Explicativo Passo a Passo) [ON/OFF] - Conforme Opção 1 do main.py e Seção 2.4 do Edital"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Modo Detalhado {modoDetalhado ? 'ON' : 'OFF'}</span>
            </button>

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
          {viewMode === 'traversals' ? (
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
              {/* Quick Rebalance Alert Banner in Split View (Heurística #1) */}
              {viewMode === 'split' && modoDetalhado && (data?.ultimo_diagnostico?.avl?.houve_rebalanceamento || data?.ultimo_diagnostico?.rubro_negra?.houve_rebalanceamento) && (
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
                        onClick={() => setViewMode('avl')}
                        className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-800 text-[11px] font-semibold hover:bg-indigo-50 transition-colors shadow-2xs"
                      >
                        Inspecionar AVL ➜
                      </button>
                    )}
                    {data.ultimo_diagnostico.rubro_negra.houve_rebalanceamento && (
                      <button
                        onClick={() => setViewMode('rb')}
                        className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-800 text-[11px] font-semibold hover:bg-indigo-50 transition-colors shadow-2xs"
                      >
                        Inspecionar Rubro-Negra ➜
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
                        Árvore AVL {viewMode === 'avl' ? '· Laboratório de Rebalanceamento Passo a Passo' : ''}
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
                        Árvore Rubro-Negra {viewMode === 'rb' ? '· Laboratório de Casos do Cormen' : ''}
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
                      root={data?.avl?.raiz}
                      type="avl"
                      highlightKey={highlightKey}
                      onSelectNode={(node) => setSelectedNode({ ...node, treeType: 'AVL' })}
                    />
                  </div>
                  {modoDetalhado && (
                    <DetailedExecutionInspector
                      diagnostic={data?.ultimo_diagnostico}
                      treeType="avl"
                      onHighlightKey={setHighlightKey}
                    />
                  )}
                </div>
              )}

              {viewMode === 'rb' && (
                <div className="flex-1 flex gap-4 overflow-hidden relative">
                  <div className="flex-1 h-full min-h-0">
                    <BinaryTreeVisualizer
                      root={data?.rubro_negra?.raiz}
                      type="rb"
                      showNil={showNil}
                      highlightKey={highlightKey}
                      onSelectNode={(node) => setSelectedNode({ ...node, treeType: 'Rubro-Negra' })}
                    />
                  </div>
                  {modoDetalhado && (
                    <DetailedExecutionInspector
                      diagnostic={data?.ultimo_diagnostico}
                      treeType="rb"
                      onHighlightKey={setHighlightKey}
                    />
                  )}
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
                  <h4 className="font-bold text-slate-900 text-sm mb-1">3. Cenários de Defesa na Apresentação</h4>
                  <p>
                    Use os botões na barra lateral para demonstrar diretamente à banca:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-600">
                    <li><b>Pior Caso ABB:</b> Inserção estritamente crescente (1..6) que tornaria uma ABB comum em lista encadeada (O(n)), mas AVL e RB mantêm altura O(log n).</li>
                    <li><b>Tio Vermelho:</b> Demonstra caso em que apenas recolorações ocorrem, sem custo de rotação de ponteiros.</li>
                    <li><b>Rotação Dupla:</b> Caso zigue-zague onde uma rotação simples é insuficiente para restaurar as propriedades.</li>
                    <li><b>Remoção Grau 2:</b> Demonstra a substituição da conta excluída pelo seu sucessor em ordem (menor da subárvore direita).</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
