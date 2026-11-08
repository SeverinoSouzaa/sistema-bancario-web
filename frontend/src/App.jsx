import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  RotateCw,
  Search,
  UserPlus,
  Trash2,
  Sparkles,
  RefreshCw,
  Terminal,
  Activity,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingDown
} from 'lucide-react';
import BinaryTreeVisualizer from './components/BinaryTreeVisualizer';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [showNil, setShowNil] = useState(true);
  const [highlightKey, setHighlightKey] = useState(null);
  const [notification, setNotification] = useState(null);

  // Operation Forms
  const [numeroConta, setNumeroConta] = useState('');
  const [titular, setTitular] = useState('');
  const [saldo, setSaldo] = useState('1500.00');
  const [tipoConta, setTipoConta] = useState('Corrente');
  const [chaveOperacao, setChaveOperacao] = useState('');

  // Diagnostic Logs
  const [logsRecentes, setLogsRecentes] = useState({ avl: [], rb: [] });
  const [tabLog, setTabLog] = useState('todos');

  const formatErrorMessage = (detail, fallback = 'Erro na operação') => {
    if (!detail) return fallback;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map(err => {
        const field = err.loc ? err.loc[err.loc.length - 1] : '';
        return field ? `Campo '${field}': ${err.msg}` : err.msg;
      }).join(' | ');
    }
    if (typeof detail === 'object') {
      return JSON.stringify(detail);
    }
    return String(detail);
  };

  const notify = (msg, isError = false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 5000);
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

  const handleInserir = async (e) => {
    e.preventDefault();
    if (!numeroConta) return notify('Informe o número da conta.', true);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/inserir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_conta: parseInt(numeroConta),
          titular: titular || `Cliente ${numeroConta}`,
          saldo: parseFloat(saldo) || 1000.0,
          tipo: tipoConta
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(json.detail, 'Erro ao inserir conta'));

      setData(json.dados);
      if (json.logs) {
        setLogsRecentes({
          avl: [...json.logs.avl, ...logsRecentes.avl].slice(0, 30),
          rb: [...json.logs.rb, ...logsRecentes.rb].slice(0, 30)
        });
      }
      setHighlightKey(parseInt(numeroConta));
      notify(json.mensagem);
      setNumeroConta('');
      setTitular('');
    } catch (err) {
      notify(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async () => {
    if (!chaveOperacao) return notify('Digite o número da conta a remover.', true);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/remover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_conta: parseInt(chaveOperacao) })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(json.detail, 'Erro ao remover conta'));

      setData(json.dados);
      if (json.logs) {
        setLogsRecentes({
          avl: [...json.logs.avl, ...logsRecentes.avl].slice(0, 30),
          rb: [...json.logs.rb, ...logsRecentes.rb].slice(0, 30)
        });
      }
      notify(json.mensagem);
      setChaveOperacao('');
      setHighlightKey(null);
    } catch (err) {
      notify(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscar = async () => {
    if (!chaveOperacao) return notify('Digite o número da conta a buscar.', true);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/buscar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_conta: parseInt(chaveOperacao) })
      });

      const json = await res.json();
      if (json.encontrada) {
        setHighlightKey(parseInt(chaveOperacao));
        notify(`Conta ${chaveOperacao} encontrada! Titular: ${json.conta.titular} | Saldo: R$ ${json.conta.saldo.toFixed(2)}`);
      } else {
        notify(json.mensagem, true);
      }
    } catch (err) {
      notify(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleLimpar = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/limpar`, { method: 'POST' });
      const json = await res.json();
      setData(json.dados);
      setLogsRecentes({ avl: [], rb: [] });
      setHighlightKey(null);
      notify('Árvores reiniciadas com sucesso.');
    } catch (err) {
      notify(err.message, true);
    }
  };

  const handlePreset = async (nome) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/preset/${nome}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(formatErrorMessage(json.detail, 'Falha ao carregar preset'));

      setData(json.dados);
      if (json.logs) {
        setLogsRecentes({
          avl: json.logs.avl,
          rb: json.logs.rb
        });
      }
      setHighlightKey(null);
      notify(json.mensagem);
    } catch (err) {
      notify(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const avl = data?.avl || {};
  const rb = data?.rubro_negra || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white m-0">SISTEMA BANCÁRIO</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  AED II • UFAM / ICET
                </span>
              </div>
              <p className="text-xs text-slate-400 m-0">
                Visualizador de Árvores Balanceadas (AVL vs Rubro-Negra)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Indicator */}
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300 font-medium">
                {backendOnline ? 'Python Engine Conectado' : 'Backend Desconectado'}
              </span>
            </div>

            <button
              onClick={handleLimpar}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Resetar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col gap-6">
        {/* Toast Notification */}
        {notification && (
          <div className={`p-3.5 rounded-xl text-sm flex items-center gap-2 border shadow-lg transition-all ${
            notification.isError
              ? 'bg-rose-950/80 text-rose-200 border-rose-700/60 shadow-rose-950/40'
              : 'bg-emerald-950/80 text-emerald-200 border-emerald-700/60 shadow-emerald-950/40'
          }`}>
            {notification.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{notification.msg}</span>
          </div>
        )}

        {/* Preset Demos Bar (Armas Secretas da Apresentação) */}
        <section className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-300 font-medium text-xs tracking-wide uppercase">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Cenários Demonstrativos para a Defesa:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handlePreset('pior_caso_abb')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Insere 6 contas ordenadas para forçar desbalanceamento contínuo"
            >
              1. Pior Caso ABB (10001..10006)
            </button>
            <button
              onClick={() => handlePreset('tio_vermelho')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Insere nós que acionam o Caso 1 do Cormen (recoloração pura)"
            >
              2. Caso 1 Cormen (Tio Vermelho)
            </button>
            <button
              onClick={() => handlePreset('rotacao_dupla')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Insere chaves em zigue-zague para demonstrar rotação dupla LR/RL"
            >
              3. Rotação Dupla (Zigue-Zague)
            </button>
            <button
              onClick={() => handlePreset('remocao_grau_2')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Monta subárvores e remove nó com 2 filhos para demonstrar sucessor em-ordem"
            >
              4. Remoção Grau 2 (Sucessor)
            </button>
          </div>
        </section>

        {/* Interactive Operation Forms */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cadastrar Conta */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-200 m-0">Cadastrar Nova Conta</h3>
            </div>
            <form onSubmit={handleInserir} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Número da conta (ex: 20)"
                  value={numeroConta}
                  onChange={(e) => setNumeroConta(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Nome do Titular (opcional)"
                  value={titular}
                  onChange={(e) => setTitular(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-600/20 transition disabled:opacity-50"
              >
                Inserir nas Duas Árvores
              </button>
            </form>
          </div>

          {/* Buscar / Remover Conta */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-200 m-0">Consultar ou Remover Conta</h3>
            </div>
            <div className="space-y-2.5">
              <input
                type="number"
                placeholder="Digite o número da conta..."
                value={chaveOperacao}
                onChange={(e) => setChaveOperacao(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleBuscar}
                  disabled={loading}
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 transition"
                >
                  Buscar Conta
                </button>
                <button
                  type="button"
                  onClick={handleRemover}
                  disabled={loading}
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition"
                >
                  Remover Conta
                </button>
              </div>
            </div>
          </div>

          {/* Opções de Visualização */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200 m-0">Configurações de Exibição</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showNil}
                  onChange={(e) => setShowNil(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                />
                <span>Exibir nós sentinela <strong>NIL</strong> na Árvore Rubro-Negra</span>
              </label>
              <p className="text-[11px] text-slate-500 mt-2">
                Dica de apresentação: nós com <strong>|FB| ≥ 2</strong> na AVL emitem aviso em amarelo antes do rebalanceamento.
              </p>
            </div>
          </div>
        </section>

        {/* Dual Split-Screen: AVL vs Rubro-Negra */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card Esquerdo: Árvore AVL */}
          <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80 shadow-xl flex flex-col gap-4">
            {/* Header AVL */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-md shadow-cyan-400/50" />
                <h2 className="text-base font-bold text-white m-0">Árvore AVL</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  |FB| ≤ 1
                </span>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                avl.valido ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {avl.valido ? 'Válida' : 'Desbalanceada'}
              </span>
            </div>

            {/* Métricas AVL */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Altura</span>
                <p className="text-xl font-bold text-cyan-400 m-0">{avl.altura ?? -1}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Nós Armazenados</span>
                <p className="text-xl font-bold text-slate-100 m-0">{avl.total_nos ?? 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Total Rotações</span>
                <p className="text-xl font-bold text-amber-400 m-0">{avl.rotacoes_total ?? 0}</p>
                <span className="text-[9px] text-slate-500">
                  Simples: {(avl.rot_simples_dir || 0) + (avl.rot_simples_esq || 0)} | Duplas: {(avl.rot_dupla_esq_dir || 0) + (avl.rot_dupla_dir_esq || 0)}
                </span>
              </div>
            </div>

            {/* Canvas AVL */}
            <BinaryTreeVisualizer
              root={avl.raiz}
              type="avl"
              highlightKey={highlightKey}
            />
          </div>

          {/* Card Direito: Árvore Rubro-Negra */}
          <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80 shadow-xl flex flex-col gap-4">
            {/* Header Rubro-Negra */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-rose-500 shadow-md shadow-rose-500/50" />
                <h2 className="text-base font-bold text-white m-0">Árvore Rubro-Negra</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  Cormen Cap. 13
                </span>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                rb.valido ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {rb.valido ? '5 Regras Atendidas' : 'Violação'}
              </span>
            </div>

            {/* Métricas Rubro-Negra */}
            <div className="grid grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Altura</span>
                <p className="text-xl font-bold text-rose-400 m-0">{rb.altura ?? -1}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Nós</span>
                <p className="text-xl font-bold text-slate-100 m-0">{rb.total_nos ?? 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Rotações</span>
                <p className="text-xl font-bold text-amber-400 m-0">{rb.rotacoes_total ?? 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="text-[10px] uppercase font-semibold text-purple-300">Recolorações</span>
                <p className="text-xl font-bold text-purple-400 m-0">{rb.recoloracoes ?? 0}</p>
              </div>
            </div>

            {/* Canvas Rubro-Negra */}
            <BinaryTreeVisualizer
              root={rb.raiz}
              type="rb"
              showNil={showNil}
              highlightKey={highlightKey}
            />
          </div>
        </section>

        {/* Console Explicativo em Tempo Real ("Flight Recorder") */}
        <section className="p-5 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white m-0">Diagnóstico e Histórico em Tempo Real (Logs do Algoritmo)</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setTabLog('todos')}
                className={`px-3 py-1 rounded-lg font-medium transition ${tabLog === 'todos' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Histórico Geral
              </button>
              <button
                onClick={() => setTabLog('avl')}
                className={`px-3 py-1 rounded-lg font-medium transition ${tabLog === 'avl' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Passos da AVL
              </button>
              <button
                onClick={() => setTabLog('rb')}
                className={`px-3 py-1 rounded-lg font-medium transition ${tabLog === 'rb' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Passos da Rubro-Negra
              </button>
            </div>
          </div>

          <div className="h-44 overflow-y-auto font-mono text-xs p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
            {tabLog === 'todos' && (
              data?.historico && data.historico.length > 0 ? (
                data.historico.map((h, i) => (
                  <div key={i} className="border-l-2 border-cyan-500 pl-2.5 py-0.5 text-slate-300">
                    <span className="text-cyan-400 font-bold">[{h.tipo}]</span> {h.detalhes}
                  </div>
                ))
              ) : (
                <p className="text-slate-600 m-0">Nenhuma operação executada ainda nesta sessão.</p>
              )
            )}

            {tabLog === 'avl' && (
              logsRecentes.avl.length > 0 ? (
                logsRecentes.avl.map((log, i) => (
                  <div key={i} className="text-cyan-300 whitespace-pre-wrap bg-cyan-950/20 p-2 rounded border border-cyan-900/40">
                    {log}
                  </div>
                ))
              ) : (
                <p className="text-slate-600 m-0">Nenhum log específico da AVL gerado recentemente.</p>
              )
            )}

            {tabLog === 'rb' && (
              logsRecentes.rb.length > 0 ? (
                logsRecentes.rb.map((log, i) => (
                  <div key={i} className="text-rose-300 whitespace-pre-wrap bg-rose-950/20 p-2 rounded border border-rose-900/40">
                    {log}
                  </div>
                ))
              ) : (
                <p className="text-slate-600 m-0">Nenhum log específico da Rubro-Negra gerado recentemente.</p>
              )
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-4 text-center text-xs text-slate-500">
        <p className="m-0">
          Trabalho Prático I — Árvores Balanceadas • Algoritmos e Estruturas de Dados II • Equipe: Fran Robson, Jenner Lucas, Raul Berger e Severino de Souza.
        </p>
      </footer>
    </div>
  );
}
