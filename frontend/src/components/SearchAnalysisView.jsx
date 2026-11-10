import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Layers,
  CircleDot,
  ShieldCheck,
  CreditCard,
  Building,
  User,
  Info,
  Clock,
  Compass,
  CornerDownRight,
  ChevronRight,
  Check,
  XCircle,
  HelpCircle
} from 'lucide-react';

export default function SearchAnalysisView({
  searchData,
  onSearch,
  loading = false,
  currentTreesData = null
}) {
  const [quickInput, setQuickInput] = useState('');

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    onSearch(null, quickInput.trim());
    setQuickInput('');
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const avl = searchData?.avl;
  const rb = searchData?.rubro_negra;
  const conta = searchData?.conta;
  const encontrada = searchData?.encontrada;
  const comp = searchData?.comparativo;
  const numeroBuscado = searchData?.numero_buscado;

  return (
    <div className="space-y-6">
      {/* ================= HEADER SECTION ================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#12372a]/10 border border-[#12372a]/20 text-[#12372a] flex items-center justify-center font-bold shadow-xs shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-neutral-800 leading-none">
                Diagnóstico & Rastreamento de Busca
              </h1>
              <p className="text-xs text-neutral-500 mt-1">
                Rastreamento determinístico passo a passo de consultas em tempo real na Árvore AVL e na Árvore Rubro-Negra
              </p>
            </div>
          </div>

          {/* Quick Search Bar */}
          <form onSubmit={handleQuickSubmit} className="flex items-center gap-2 max-w-sm w-full md:w-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="1"
                placeholder="Consultar outra conta..."
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:border-[#854d27] focus:ring-1 focus:ring-[#854d27]/20 transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !quickInput.trim()}
              className="px-4 py-2 rounded-xl bg-[#12372a] hover:bg-[#184535] active:bg-[#0b241c] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{loading ? 'Buscando...' : 'Localizar'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* ================= EMPTY STATE ================= */}
      {!searchData && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-xs my-6 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#12372a]/10 border border-[#12372a]/20 text-[#12372a] flex items-center justify-center mx-auto shadow-2xs">
            <Compass className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-800">Nenhuma Busca Realizada Nesta Sessão</h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1 leading-relaxed">
              Digite o número de uma conta bancária no campo acima ou na barra lateral para gerar o diagnóstico comparativo em tempo real, auditando o caminho percorrido nó a nó em ambas as árvores.
            </p>
          </div>

          {currentTreesData?.avl?.tamanho > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <span className="text-[11px] text-neutral-500 font-medium block mb-2">
                Sugestões rápidas de contas existentes na árvore:
              </span>
              <div className="flex flex-wrap justify-center gap-1.5 font-mono text-xs">
                {currentTreesData.avl.caminhamentos?.em?.slice(0, 4).map((c) => (
                  <button
                    key={c}
                    onClick={() => onSearch(null, c)}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-neutral-700 hover:border-[#854d27] hover:text-[#854d27] transition-colors cursor-pointer"
                  >
                    #{c}
                  </button>
                ))}
                <button
                  onClick={() => onSearch(null, 999999)}
                  className="px-2.5 py-1 rounded-lg bg-amber-50/60 border border-amber-200/80 text-amber-800 hover:bg-amber-100/60 transition-colors cursor-pointer"
                  title="Testar chave inexistente para analisar parada em NIL / NULL"
                >
                  #999999 (Inexistente)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= SEARCH RESULTS DASHBOARD ================= */}
      {searchData && (
        <>
          {/* Status Alert Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all shadow-xs ${
              encontrada
                ? 'bg-[#12372a]/5 border-[#12372a]/20 text-[#12372a]'
                : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  encontrada
                    ? 'bg-[#12372a]/10 text-[#12372a]'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {encontrada ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {encontrada ? 'Registro Encontrado' : 'Registro Inexistente'}
                  </span>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-current">
                    Conta #{numeroBuscado}
                  </span>
                </div>
                <p className="text-xs mt-0.5 opacity-90">
                  {searchData.mensagem}
                </p>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-medium opacity-80 block">
                {encontrada ? 'Status Estrutural' : 'Resultado de Pesquisa'}
              </span>
              <span className="text-xs font-bold font-mono">
                {encontrada ? 'Preservado em Memória' : 'Chave não cadastrada'}
              </span>
            </div>
          </div>

          {/* ================= 4 KPI SUMMARY CARDS (Apple/Executive Earthy Style) ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Informações Gerais da Chave */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="font-medium">Chave Consultada</span>
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-neutral-900">#{numeroBuscado}</span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    encontrada ? 'bg-[#12372a]/10 text-[#12372a]' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {encontrada ? 'Existente' : 'Inexistente'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 truncate">
                {encontrada ? `Titular: ${conta?.titular}` : 'Nenhuma correspondência no índice'}
              </p>
            </div>

            {/* Card 2: Custo na Árvore AVL */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#2b1d16]" /> Custo Árvore AVL
                </span>
                <Layers className="w-4 h-4 text-neutral-700" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-neutral-900">
                  {avl?.custo_nos_visitados || 0}
                </span>
                <span className="text-xs text-neutral-500 font-medium">nós visitados</span>
              </div>
              <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                <span>Profundidade: <b>{avl?.profundidade || 0}</b></span>
                <span className="text-slate-300">•</span>
                <span>Altura da Árvore: <b>{avl?.altura_arvore ?? -1}</b></span>
              </p>
            </div>

            {/* Card 3: Custo na Árvore Rubro-Negra */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#854d27]" /> Custo Rubro-Negra
                </span>
                <CircleDot className="w-4 h-4 text-[#854d27]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-[#854d27]">
                  {rb?.custo_nos_visitados || 0}
                </span>
                <span className="text-xs text-neutral-500 font-medium">nós visitados</span>
              </div>
              <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                <span>Profundidade: <b>{rb?.profundidade || 0}</b></span>
                <span className="text-slate-300">•</span>
                <span>Altura Negra: <b>{rb?.altura_negra ?? 0}</b></span>
              </p>
            </div>

            {/* Card 4: Análise Comparativa */}
            <div className="bg-[#fcfaf7] border border-[#854d27]/20 rounded-2xl p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="font-medium">Paridade Operacional</span>
                <ShieldCheck className="w-4 h-4 text-[#854d27]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold font-mono text-neutral-900">
                  {comp?.mesmo_custo
                    ? '100% Paritário'
                    : `Δ = ${Math.abs(comp?.diferenca_nos || 0)} nó(s)`}
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 leading-tight">
                {comp?.resumo}
              </p>
            </div>
          </div>

          {/* ================= ACCOUNT DETAILS CARD (If Found) ================= */}
          {encontrada && conta && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#12372a]" />
                  <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    Dados Cadastrais da Conta Localizada
                  </h4>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#12372a]/10 text-[#12372a] font-semibold border border-[#12372a]/20">
                  Conta Ativa
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-semibold text-neutral-500 block mb-1">
                    Número da Conta
                  </span>
                  <span className="text-base font-bold font-mono text-neutral-900">
                    #{conta.numero_conta}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-semibold text-neutral-500 block mb-1">
                    Titular da Conta
                  </span>
                  <span className="text-base font-bold text-neutral-900 truncate block">
                    {conta.titular}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-semibold text-neutral-500 block mb-1">
                    Agência / Tipo
                  </span>
                  <span className="text-xs font-semibold text-neutral-800 block">
                    Agência {conta.agencia} • <span className="text-[#854d27]">{conta.tipo}</span>
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#12372a]/5 border border-[#12372a]/20">
                  <span className="text-[10px] uppercase font-semibold text-[#12372a] block mb-1">
                    Saldo Disponível
                  </span>
                  <span className="text-base font-bold font-mono text-[#12372a]">
                    {formatCurrency(conta.saldo)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP-BY-STEP SEARCH TRAJECTORY (SIDE-BY-SIDE) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Column 1: AVL Tree Trajectory */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2b1d16]" />
                  <h4 className="text-sm font-bold text-neutral-900">
                    Trajetória na Árvore AVL
                  </h4>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  {avl?.custo_nos_visitados || 0} nós percorridos
                </span>
              </div>

              <p className="text-xs text-neutral-500 leading-relaxed">
                Descida determinística pela regra de busca binária, inspecionando fatores de balanceamento e alturas a cada decisão de ramificação:
              </p>

              {/* Trajectory Timeline */}
              <div className="space-y-3 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {avl?.caminho?.map((step) => {
                  const isSuccess = step.status === 'sucesso';
                  const isNotFound = step.status === 'inexistente';

                  return (
                    <div key={step.passo} className="relative flex items-start gap-3 pl-1">
                      {/* Step Indicator Dot */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 z-10 border ${
                          isSuccess
                            ? 'bg-[#12372a] text-white border-[#12372a]'
                            : isNotFound
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-white text-neutral-700 border-slate-300 shadow-2xs'
                        }`}
                      >
                        {isSuccess ? <Check className="w-3.5 h-3.5" /> : isNotFound ? '✕' : step.passo}
                      </div>

                      {/* Step Content Card */}
                      <div
                        className={`flex-1 p-3.5 rounded-xl border text-xs transition-all ${
                          isSuccess
                            ? 'bg-[#12372a]/5 border-[#12372a]/30'
                            : isNotFound
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-slate-50/70 border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono font-bold text-neutral-900 text-xs flex items-center gap-1.5">
                            {step.chave === 'NULL' ? (
                              <span className="text-amber-700">Ponteiro Nulo (None)</span>
                            ) : (
                              <>
                                <span>Nó #{step.chave}</span>
                                <span className="font-normal text-slate-500">({step.titular})</span>
                              </>
                            )}
                          </span>

                          {step.chave !== 'NULL' && (
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                                Math.abs(step.fb) <= 1
                                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                                  : 'bg-rose-100 text-rose-800 border-rose-200'
                              }`}
                            >
                              FB: {step.fb > 0 ? `+${step.fb}` : step.fb} | h={step.altura_subarvore}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-neutral-600 mt-1 leading-relaxed flex items-center gap-1.5">
                          {isSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#12372a] shrink-0" />
                          ) : isNotFound ? (
                            <XCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          ) : (
                            <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span>{step.comparacao}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 2: Rubro-Negra Tree Trajectory */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#854d27]" />
                  <h4 className="text-sm font-bold text-neutral-900">
                    Trajetória na Árvore Rubro-Negra
                  </h4>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  {rb?.custo_nos_visitados || 0} nós percorridos
                </span>
              </div>

              <p className="text-xs text-neutral-500 leading-relaxed">
                Descida inspecionando cores dos nós e sentinela NIL compartilhado conforme as 5 propriedades fundamentais da Rubro-Negra:
              </p>

              {/* Trajectory Timeline */}
              <div className="space-y-3 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {rb?.caminho?.map((step) => {
                  const isSuccess = step.status === 'sucesso';
                  const isNotFound = step.status === 'inexistente';
                  const isPreto = step.cor === 'PRETO';

                  return (
                    <div key={step.passo} className="relative flex items-start gap-3 pl-1">
                      {/* Step Indicator Dot */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 z-10 border ${
                          isSuccess
                            ? 'bg-[#854d27] text-white border-[#854d27]'
                            : isNotFound
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-white text-neutral-700 border-slate-300 shadow-2xs'
                        }`}
                      >
                        {isSuccess ? <Check className="w-3.5 h-3.5" /> : isNotFound ? '✕' : step.passo}
                      </div>

                      {/* Step Content Card */}
                      <div
                        className={`flex-1 p-3.5 rounded-xl border text-xs transition-all ${
                          isSuccess
                            ? 'bg-[#854d27]/5 border-[#854d27]/30'
                            : isNotFound
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-slate-50/70 border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono font-bold text-neutral-900 text-xs flex items-center gap-1.5">
                            {step.chave === 'NIL' ? (
                              <span className="text-amber-700">Sentinela NIL (Folha)</span>
                            ) : (
                              <>
                                <span>Nó #{step.chave}</span>
                                <span className="font-normal text-slate-500">({step.titular})</span>
                              </>
                            )}
                          </span>

                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
                              isPreto
                                ? 'bg-slate-900 text-white border-slate-800'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isPreto ? 'bg-white' : 'bg-red-600'
                              }`}
                            />
                            {step.cor || 'PRETO'}
                          </span>
                        </div>

                        <div className="text-[11px] text-neutral-600 mt-1 leading-relaxed flex items-center gap-1.5">
                          {isSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#854d27] shrink-0" />
                          ) : isNotFound ? (
                            <XCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          ) : (
                            <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span>{step.comparacao}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ================= CONSOLIDATED COMPARISON TABLE ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-neutral-800">
                  Quadro Consolidado de Desempenho da Consulta
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Confronto direto de complexidade e profundidade para a chave #{numeroBuscado}
                </p>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                O(log n)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-neutral-600 font-semibold">
                    <th className="py-3 px-5">Métrica de Avaliação</th>
                    <th className="py-3 px-5 text-right font-bold text-neutral-800">Árvore AVL</th>
                    <th className="py-3 px-5 text-right font-bold text-[#854d27]">Árvore Rubro-Negra</th>
                    <th className="py-3 px-5 text-right">Interpretação Estrutural</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5 font-medium text-slate-800">Status do Registro</td>
                    <td className="py-3 px-5 text-right font-mono font-semibold text-neutral-900">
                      {avl?.encontrado ? 'Localizado' : 'Não Encontrado'}
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-semibold text-[#854d27]">
                      {rb?.encontrado ? 'Localizado' : 'Não Encontrado'}
                    </td>
                    <td className="py-3 px-5 text-right text-slate-500 text-[11px]">
                      {encontrada ? 'Registro ativo no minimundo' : 'Chave não existe no índice'}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition-colors bg-slate-50/30">
                    <td className="py-3 px-5 font-medium text-slate-800">Custo (Nós Visitados)</td>
                    <td className="py-3 px-5 text-right font-mono font-bold text-neutral-900">
                      {avl?.custo_nos_visitados || 0}
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-bold text-[#854d27]">
                      {rb?.custo_nos_visitados || 0}
                    </td>
                    <td className="py-3 px-5 text-right text-slate-500 text-[11px]">
                      {comp?.mesmo_custo
                        ? 'Mesmo número de acessos'
                        : avl?.custo_nos_visitados < rb?.custo_nos_visitados
                        ? 'AVL acessou menos nós'
                        : 'Rubro-Negra acessou menos nós'}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5 font-medium text-slate-800">Total de Comparações de Chave</td>
                    <td className="py-3 px-5 text-right font-mono text-neutral-900">
                      {avl?.comparacoes || 0}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[#854d27]">
                      {rb?.comparacoes || 0}
                    </td>
                    <td className="py-3 px-5 text-right text-slate-500 text-[11px]">
                      1 comparação por nó no percurso
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition-colors bg-slate-50/30">
                    <td className="py-3 px-5 font-medium text-slate-800">Profundidade Atingida no Percurso</td>
                    <td className="py-3 px-5 text-right font-mono text-neutral-900">
                      Nível {avl?.profundidade || 0}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[#854d27]">
                      Nível {rb?.profundidade || 0}
                    </td>
                    <td className="py-3 px-5 text-right text-slate-500 text-[11px]">
                      Distância a partir da raiz (nível 0)
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5 font-medium text-slate-800">Altura Geral da Árvore</td>
                    <td className="py-3 px-5 text-right font-mono text-neutral-900">
                      {avl?.altura_arvore ?? -1}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[#854d27]">
                      {rb?.altura_arvore ?? -1}
                    </td>
                    <td className="py-3 px-5 text-right text-slate-500 text-[11px]">
                      Altura máxima registrada no momento
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/60 transition-colors bg-slate-50/30">
                    <td className="py-3 px-5 font-medium text-slate-800">Limite Superior Teórico de Busca</td>
                    <td className="py-3 px-5 text-right font-mono text-neutral-900">
                      h ≤ 1.44 · log₂(n+2)
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[#854d27]">
                      h ≤ 2 · log₂(n+1)
                    </td>
                    <td className="py-3 px-5 text-right text-slate-500 text-[11px]">
                      Garantia assintótica O(log n)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ================= THEORETICAL INSIGHT CARD (Aulas 4 e 5 / Cormen) ================= */}
          <div className="bg-[#fcfaf7] border border-[#854d27]/20 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#854d27]" />
              <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Fundamentação Teórica: Por que a Busca se Comporta Desta Forma?
              </h4>
            </div>

            <div className="text-xs text-neutral-700 leading-relaxed space-y-2">
              <p>
                • <b>Propriedade de Busca Binária Pura:</b> Tanto na Árvore AVL quanto na Árvore Rubro-Negra, a operação de busca utiliza estritamente a relação de ordem de chave ($k &lt; \text{chave} \implies \text{esquerda}$, $k &gt; \text{chave} \implies \text{direita}$).
              </p>
              <p>
                • <b>O papel das cores na busca:</b> As cores na Árvore Rubro-Negra <i>não interferem</i> na tomada de decisão da busca. Sua função é puramente estrutural, garantindo que nenhum caminho da raiz até uma folha NIL seja mais do que duas vezes mais longo que qualquer outro ($h \le 2\log_2(n+1)$).
              </p>
              <p>
                • <b>Vantagem de Leitura da AVL:</b> Como a Árvore AVL impõe o critério estrito de diferença de altura $|FB| \le 1$, sua altura total tende a ser ligeiramente mais compacta do que a Rubro-Negra. Por isso, em sistemas com grande volume de consultas e raras modificações (<i>read-heavy</i>), a AVL costuma visitar nós com profundidades ligeiramente menores ou equivalentes.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
