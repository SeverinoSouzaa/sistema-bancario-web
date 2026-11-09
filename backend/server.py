import sys
import os
import re
import time
import copy
from typing import Optional, List, Dict, Any, cast
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

SUBMODULE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend_original"))
if SUBMODULE_PATH not in sys.path:
    sys.path.insert(0, SUBMODULE_PATH)

try:
    from modelos import ContaBancaria, Cor, NoAVL, NoRB  # type: ignore
    from avl import ArvoreAVL  # type: ignore
    from rubro_negra import ArvoreRubroNegra  # type: ignore
except ImportError:
    from backend_original.modelos import ContaBancaria, Cor, NoAVL, NoRB  # type: ignore
    from backend_original.avl import ArvoreAVL  # type: ignore
    from backend_original.rubro_negra import ArvoreRubroNegra  # type: ignore

app = FastAPI(
    title="Visualizador de Árvores Balanceadas - Sistema Bancário",
    description="API RESTful de Alta Fidelidade que consome o submódulo original congelado para apresentação de AED II.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serializar_no_avl(no) -> Optional[Dict[str, Any]]:
    if no is None:
        return None
    return {
        "chave": no.chave,
        "titular": no.conta.titular,
        "agencia": no.conta.agencia,
        "tipo": no.conta.tipo,
        "saldo": float(no.conta.saldo),
        "altura": no.altura,
        "fb": no.fator_balanceamento,
        "esquerda": serializar_no_avl(no.esquerda),
        "direita": serializar_no_avl(no.direita)
    }


def serializar_no_rb(no, nil=None) -> Optional[Dict[str, Any]]:
    if no is None or (nil is not None and no == nil) or no.conta is None:
        return None
    return {
        "chave": no.chave,
        "titular": no.conta.titular if no.conta else "",
        "agencia": no.conta.agencia if no.conta else "",
        "tipo": no.conta.tipo if no.conta else "",
        "saldo": float(no.conta.saldo) if no.conta else 0.0,
        "cor": no.cor.value,
        "esquerda": serializar_no_rb(no.esquerda, nil),
        "direita": serializar_no_rb(no.direita, nil)
    }


def serializar_conta_resumida(c: Any) -> Optional[Dict[str, Any]]:
    if not c:
        return None
    return {
        "numero_conta": c.numero_conta,
        "titular": c.titular,
        "saldo": float(c.saldo),
        "tipo": c.tipo,
        "agencia": c.agencia
    }


def gerar_arvore_avl_desbalanceada(raiz_original: Any, conta: Any) -> Any:
    criar_no_avl: Any = NoAVL
    if raiz_original is None:
        return criar_no_avl(cast(Any, conta))  # type: ignore
    raiz_copia = copy.deepcopy(raiz_original)
    def _ins(no: Any) -> Any:
        if no is None:
            return criar_no_avl(cast(Any, conta))  # type: ignore
        if conta.numero_conta < no.chave:
            no.esquerda = _ins(no.esquerda)
        elif conta.numero_conta > no.chave:
            no.direita = _ins(no.direita)
        no.atualizar_altura()
        return no
    return _ins(raiz_copia)


def gerar_arvore_rb_sem_fixup(rb_store: Any, conta: Any) -> Any:
    criar_no_rb: Any = NoRB
    cor_v: Any = Cor.VERMELHO
    nil_store: Any = rb_store.NIL
    if rb_store.raiz == nil_store:
        return criar_no_rb(conta=conta, cor=cor_v, esquerda=nil_store, direita=nil_store, pai=nil_store)  # type: ignore
    rb_copia = copy.deepcopy(rb_store)
    nil_copia: Any = rb_copia.NIL
    z: Any = criar_no_rb(conta=conta, cor=cor_v, esquerda=nil_copia, direita=nil_copia, pai=nil_copia)  # type: ignore
    y: Any = nil_copia
    x: Any = rb_copia.raiz
    while x != nil_copia:
        y = x
        if z.chave < x.chave:
            x = x.esquerda
        else:
            x = x.direita
    z.pai = y
    if y == nil_copia:
        rb_copia.raiz = z
    elif z.chave < y.chave:
        y.esquerda = z
    else:
        y.direita = z
    return rb_copia.raiz


def extrair_diagnostico_rebalanceamento(
    logs_avl: List[str],
    logs_rb: List[str],
    tipo_op: str,
    chave: int,
    snapshots_avl: Optional[Dict[str, Any]] = None,
    snapshots_rb: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    # --- Diagnóstico AVL ---
    avl_diag: Dict[str, Any] = {
        "houve_rebalanceamento": False,
        "caso": "Árvore Equilibrada",
        "tipo_rotacao": "Nenhuma rotação necessária",
        "no_desbalanceado": None,
        "fb_detectado": None,
        "filho": None,
        "no_promovido": None,
        "passos": [],
        "logs": logs_avl
    }

    texto_avl = "\n\n".join(logs_avl)
    if "[REBALANCEAMENTO AVL" in texto_avl:
        avl_diag["houve_rebalanceamento"] = True

        m_caso = re.search(r"\[REBALANCEAMENTO AVL - (CASO [^\]]+)\]", texto_avl)
        if m_caso:
            avl_diag["caso"] = m_caso.group(1).strip()

        m_no = re.search(r"Desbalanceamento detectado no No \((\d+)\) com FB=([+-]?\d+)", texto_avl)
        if m_no:
            avl_diag["no_desbalanceado"] = int(m_no.group(1))
            avl_diag["fb_detectado"] = m_no.group(2)

        m_rot = re.search(r"Tipo de Rotacao:\s*([^\n]+)", texto_avl)
        if m_rot:
            avl_diag["tipo_rotacao"] = m_rot.group(1).strip()

        m_prom = re.search(r"Nova raiz local promovida:\s*No \((\d+)\)", texto_avl)
        if m_prom:
            avl_diag["no_promovido"] = int(m_prom.group(1))

        passos_avl: List[Dict[str, Any]] = []
        # Passo 1: Estado Inicial
        passos_avl.append({
            "ordem": 1,
            "titulo": "1. Árvore Inicial",
            "descricao": f"Estrutura da AVL estável antes da inserção da Conta #{chave}.",
            "arvore": snapshots_avl.get("antes") if snapshots_avl else None,
            "no_foco": None,
            "status": "info"
        })

        # Passo 2: Inserção do Nó e Desbalanceamento
        passos_avl.append({
            "ordem": 2,
            "titulo": "2. Inserção & Desbalanceamento",
            "descricao": f"Ao inserir a Conta #{chave}, o nó ancestral ({avl_diag['no_desbalanceado']}) atingiu FB={avl_diag['fb_detectado']} (|FB| ≥ 2). Configura-se o {avl_diag['caso']}, necessitando de {avl_diag['tipo_rotacao']}.",
            "arvore": snapshots_avl.get("desbalanceada") if snapshots_avl else None,
            "no_foco": avl_diag["no_desbalanceado"],
            "status": "warning"
        })

        # Passo 3: Rotação Aplicada
        passos_avl.append({
            "ordem": 3,
            "titulo": "3. Rebalanceamento por Rotação",
            "descricao": f"{avl_diag['tipo_rotacao']} executada. O nó ({avl_diag['no_promovido']}) assume a posição de nova raiz local, reduzindo a altura e equilibrando as subárvores.",
            "arvore": snapshots_avl.get("final") if snapshots_avl else None,
            "no_foco": avl_diag["no_promovido"],
            "status": "success"
        })

        # Passo 4: Árvore Resultante
        passos_avl.append({
            "ordem": 4,
            "titulo": "4. Árvore Resultante Equilibrada",
            "descricao": "Recálculo de alturas concluído. Todos os nós da árvore satisfazem rigorosamente a condição AVL (|FB| ≤ 1).",
            "arvore": snapshots_avl.get("final") if snapshots_avl else None,
            "no_foco": None,
            "status": "success"
        })
        avl_diag["passos"] = passos_avl

    elif "[REMOCAO AVL" in texto_avl:
        m_caso_rem = re.search(r"\[REMOCAO AVL - (CASO \d+:[^\]]+)\]", texto_avl)
        caso_desc = m_caso_rem.group(1).strip() if m_caso_rem else "Remoção em nó"
        avl_diag["caso"] = caso_desc
        avl_diag["passos"] = [
            {
                "ordem": 1,
                "titulo": "1. Estrutura Antes da Remoção",
                "descricao": f"Árvore AVL com a Conta #{chave} cadastrada.",
                "arvore": snapshots_avl.get("antes") if snapshots_avl else None,
                "no_foco": chave,
                "status": "info"
            },
            {
                "ordem": 2,
                "titulo": "2. Desconexão / Substituição",
                "descricao": f"Conta #{chave} encerrada: {caso_desc}.",
                "arvore": snapshots_avl.get("final") if snapshots_avl else None,
                "no_foco": None,
                "status": "warning"
            },
            {
                "ordem": 3,
                "titulo": "3. Árvore Resultante Equilibrada",
                "descricao": "Alturas e balanceamento recalculados após encerramento da conta.",
                "arvore": snapshots_avl.get("final") if snapshots_avl else None,
                "no_foco": None,
                "status": "success"
            }
        ]
    elif tipo_op == "REMOCAO" and chave > 0:
        avl_diag["caso"] = "Remoção Direta"
        avl_diag["passos"] = [
            {
                "ordem": 1,
                "titulo": "1. Estrutura Antes da Remoção",
                "descricao": f"Árvore AVL com a Conta #{chave} cadastrada.",
                "arvore": snapshots_avl.get("antes") if snapshots_avl else None,
                "no_foco": chave,
                "status": "info"
            },
            {
                "ordem": 2,
                "titulo": "2. Conta Encerrada",
                "descricao": f"Conta #{chave} removida. Os fatores de balanceamento mantiveram-se dentro do limite (|FB| ≤ 1).",
                "arvore": snapshots_avl.get("final") if snapshots_avl else None,
                "no_foco": None,
                "status": "success"
            }
        ]
    elif tipo_op == "INSERCAO" and chave > 0:
        avl_diag["passos"] = [
            {
                "ordem": 1,
                "titulo": "1. Árvore Inicial",
                "descricao": f"Estrutura da AVL antes da inserção da Conta #{chave}.",
                "arvore": snapshots_avl.get("antes") if snapshots_avl else None,
                "no_foco": None,
                "status": "info"
            },
            {
                "ordem": 2,
                "titulo": "2. Inserção Concluída",
                "descricao": f"Conta #{chave} inserida como nó folha. Os fatores de balanceamento permaneceram dentro da faixa permitida (|FB| ≤ 1), sem necessidade de rotação.",
                "arvore": snapshots_avl.get("final") if snapshots_avl else None,
                "no_foco": chave,
                "status": "success"
            }
        ]
    else:
        avl_diag["passos"] = [
            {
                "ordem": 1,
                "titulo": "Estado Atual",
                "descricao": "Árvore pronta para novas operações de cadastro ou consulta.",
                "arvore": snapshots_avl.get("final") if snapshots_avl else None,
                "no_foco": None,
                "status": "info"
            }
        ]

    # --- Diagnóstico Rubro-Negra ---
    rb_diag: Dict[str, Any] = {
        "houve_rebalanceamento": False,
        "caso": "Propriedades Preservadas",
        "tipo_acao": "Nenhum ajuste necessário",
        "no_conflito": None,
        "pai": None,
        "tio": None,
        "cor_tio": None,
        "recoloracoes": [],
        "passos": [],
        "logs": logs_rb
    }

    texto_rb = "\n\n".join(logs_rb)
    if "[REBALANCEAMENTO RUBRO-NEGRA" in texto_rb:
        rb_diag["houve_rebalanceamento"] = True

        m_caso_rb = re.search(r"\[REBALANCEAMENTO RUBRO-NEGRA - (CASO [^\]]+)\]", texto_rb)
        if m_caso_rb:
            rb_diag["caso"] = m_caso_rb.group(1).strip()

        m_conflito = re.search(r"Conflito[^:]*: No \((\d+)\) e Pai \((\d+)\)", texto_rb)
        if m_conflito:
            rb_diag["no_conflito"] = int(m_conflito.group(1))
            rb_diag["pai"] = int(m_conflito.group(2))

        m_tio = re.search(r"Tio \((\d+)\) e (VERMELHO|PRETO)", texto_rb)
        if m_tio:
            rb_diag["tio"] = int(m_tio.group(1))
            rb_diag["cor_tio"] = m_tio.group(2)

        recolores = re.findall(r"-\s*(Pai|Tio|Avo)\s*\((\d+)\)\s*passa a ser\s*(PRETO|VERMELHO)", texto_rb)
        for papel, k, nova_cor in recolores:
            rb_diag["recoloracoes"].append({
                "papel": papel,
                "chave": int(k),
                "nova_cor": nova_cor
            })

        if "CASO 1" in rb_diag["caso"]:
            rb_diag["tipo_acao"] = "Recoloração pura (sem rotação de ponteiros)"
        elif "CASO 2" in rb_diag["caso"]:
            rb_diag["tipo_acao"] = "Rotação Simples preparatória (Zigue-Zague)"
        elif "CASO 3" in rb_diag["caso"]:
            rb_diag["tipo_acao"] = "Rotação Simples + Recoloração (Linha Reta)"

        passos_rb: List[Dict[str, Any]] = []
        # Passo 1: Estado Inicial
        passos_rb.append({
            "ordem": 1,
            "titulo": "1. Árvore Antes da Operação",
            "descricao": f"Estrutura da árvore Rubro-Negra antes da inserção da Conta #{chave}.",
            "arvore": snapshots_rb.get("antes") if snapshots_rb else None,
            "no_foco": None,
            "status": "info"
        })

        # Passo 2: Inserção Rubra e Conflito
        passos_rb.append({
            "ordem": 2,
            "titulo": "2. Inserção Rubra & Violação",
            "descricao": f"Conta #{chave} inserida como nó VERMELHO. Ocorre violação da Regra 4 de Cormen: nó ({rb_diag['no_conflito'] or chave}) e pai ({rb_diag['pai']}) são ambos nós vermelhos.",
            "arvore": snapshots_rb.get("sem_fixup") if snapshots_rb else None,
            "no_foco": rb_diag["no_conflito"] or chave,
            "status": "warning"
        })

        # Passo 3: Rebalanceamento
        desc_rec = f" Recolorações efetuadas: {', '.join([r['papel'] + ' #' + str(r['chave']) + ' ➜ ' + r['nova_cor'] for r in rb_diag['recoloracoes']])}." if rb_diag['recoloracoes'] else ""
        passos_rb.append({
            "ordem": 3,
            "titulo": "3. Rebalanceamento Estrutural",
            "descricao": f"Aplicação do {rb_diag['caso']}: {rb_diag['tipo_acao']}.{desc_rec}",
            "arvore": snapshots_rb.get("final") if snapshots_rb else None,
            "no_foco": rb_diag["no_conflito"] or chave,
            "status": "success"
        })

        # Passo 4: Árvore Resultante Válida
        passos_rb.append({
            "ordem": 4,
            "titulo": "4. Árvore Resultante Válida",
            "descricao": "Ajuste concluído com sucesso. A raiz permanece preta e todos os caminhos até as folhas mantêm rigorosamente a mesma altura negra (bh).",
            "arvore": snapshots_rb.get("final") if snapshots_rb else None,
            "no_foco": None,
            "status": "success"
        })
        rb_diag["passos"] = passos_rb

    elif "[REMOCAO RUBRO-NEGRA" in texto_rb:
        m_caso_rem_rb = re.search(r"\[REMOCAO RUBRO-NEGRA - (CASO [^\]]+)\]", texto_rb)
        caso_desc_rb = m_caso_rem_rb.group(1).strip() if m_caso_rem_rb else "Rebalanceamento pós-remoção"
        rb_diag["caso"] = caso_desc_rb
        rb_diag["tipo_acao"] = "Ajuste de altura-negra pós-remoção"
        rb_diag["passos"] = [
            {
                "ordem": 1,
                "titulo": "1. Estrutura Antes da Remoção",
                "descricao": f"Árvore Rubro-Negra com a Conta #{chave} cadastrada.",
                "arvore": snapshots_rb.get("antes") if snapshots_rb else None,
                "no_foco": chave,
                "status": "info"
            },
            {
                "ordem": 2,
                "titulo": "2. Remoção do Nó",
                "descricao": f"Conta #{chave} removida da árvore: {caso_desc_rb}.",
                "arvore": snapshots_rb.get("final") if snapshots_rb else None,
                "no_foco": None,
                "status": "warning"
            },
            {
                "ordem": 3,
                "titulo": "3. Árvore Resultante Válida",
                "descricao": "Invariantes de altura-negra e coloração restabelecidas com sucesso.",
                "arvore": snapshots_rb.get("final") if snapshots_rb else None,
                "no_foco": None,
                "status": "success"
            }
        ]
    elif tipo_op == "REMOCAO" and chave > 0:
        rb_diag["caso"] = "Remoção Direta"
        rb_diag["passos"] = [
            {
                "ordem": 1,
                "titulo": "1. Estrutura Antes da Remoção",
                "descricao": f"Árvore Rubro-Negra com a Conta #{chave} cadastrada.",
                "arvore": snapshots_rb.get("antes") if snapshots_rb else None,
                "no_foco": chave,
                "status": "info"
            },
            {
                "ordem": 2,
                "titulo": "2. Conta Encerrada",
                "descricao": f"Conta #{chave} removida. Invariantes de coloração e altura-negra preservadas.",
                "arvore": snapshots_rb.get("final") if snapshots_rb else None,
                "no_foco": None,
                "status": "success"
            }
        ]
    elif tipo_op == "INSERCAO" and chave > 0:
        rb_diag["passos"] = [
            {
                "ordem": 1,
                "titulo": "1. Árvore Inicial",
                "descricao": f"Estrutura da Rubro-Negra antes da inserção da Conta #{chave}.",
                "arvore": snapshots_rb.get("antes") if snapshots_rb else None,
                "no_foco": None,
                "status": "info"
            },
            {
                "ordem": 2,
                "titulo": "2. Inserção Concluída",
                "descricao": f"Conta #{chave} inserida como nó folha. As 5 propriedades da árvore Rubro-Negra permaneceram válidas, sem conflitos.",
                "arvore": snapshots_rb.get("final") if snapshots_rb else None,
                "no_foco": chave,
                "status": "success"
            }
        ]
    else:
        rb_diag["passos"] = [
            {
                "ordem": 1,
                "titulo": "Estado Atual",
                "descricao": "Árvore pronta para novas operações de cadastro ou consulta.",
                "arvore": snapshots_rb.get("final") if snapshots_rb else None,
                "no_foco": None,
                "status": "info"
            }
        ]

    return {
        "operacao": {
            "tipo": tipo_op,
            "chave": chave,
            "timestamp": time.strftime("%H:%M:%S")
        },
        "avl": avl_diag,
        "rubro_negra": rb_diag
    }


class TreeStore:
    avl: Any
    rb: Any
    historico_operacoes: List[Dict[str, Any]]
    avl_log_cursor: int
    rb_log_cursor: int
    ultimo_diagnostico: Dict[str, Any]

    def __init__(self):
        self.reset()

    def reset(self):
        self.avl = ArvoreAVL(modo_detalhado=True)
        self.rb = ArvoreRubroNegra(modo_detalhado=True)
        self.historico_operacoes = []
        self.avl_log_cursor = 0
        self.rb_log_cursor = 0
        self.ultimo_diagnostico = extrair_diagnostico_rebalanceamento([], [], "INICIAL", 0)

    def capturar_novos_logs(self) -> Dict[str, List[str]]:
        novos_avl = self.avl.estatisticas.logs_detalhados[self.avl_log_cursor:]
        novos_rb = self.rb.estatisticas.logs_detalhados[self.rb_log_cursor:]
        self.avl_log_cursor = len(self.avl.estatisticas.logs_detalhados)
        self.rb_log_cursor = len(self.rb.estatisticas.logs_detalhados)
        return {
            "avl": novos_avl,
            "rb": novos_rb
        }


store = TreeStore()


def obter_estado_completo() -> Dict[str, Any]:
    valido_avl, msg_avl = store.avl.validar_propriedades()
    valido_rb, msg_rb = store.rb.validar_propriedades()

    avl_pre = [c.numero_conta for c in store.avl.caminhamento_pre_ordem()]
    avl_em = [c.numero_conta for c in store.avl.caminhamento_em_ordem()]
    avl_pos = [c.numero_conta for c in store.avl.caminhamento_pos_ordem()]

    rb_pre = [c.numero_conta for c in store.rb.caminhamento_pre_ordem()]
    rb_em = [c.numero_conta for c in store.rb.caminhamento_em_ordem()]
    rb_pos = [c.numero_conta for c in store.rb.caminhamento_pos_ordem()]

    return {
        "avl": {
            "raiz": serializar_no_avl(store.avl.raiz),
            "altura": store.avl.altura,
            "total_nos": store.avl.quantidade_nos,
            "rotacoes_total": store.avl.estatisticas.total_rotacoes,
            "rot_simples_dir": store.avl.estatisticas.rotacoes_simples_direita,
            "rot_simples_esq": store.avl.estatisticas.rotacoes_simples_esquerda,
            "rot_dupla_esq_dir": store.avl.estatisticas.rotacoes_duplas_esq_dir,
            "rot_dupla_dir_esq": store.avl.estatisticas.rotacoes_duplas_dir_esq,
            "valido": valido_avl,
            "mensagem_validacao": msg_avl,
            "caminhamentos": {
                "pre": avl_pre,
                "em": avl_em,
                "pos": avl_pos
            },
            "menor": serializar_conta_resumida(store.avl.obter_menor()),
            "maior": serializar_conta_resumida(store.avl.obter_maior())
        },
        "rubro_negra": {
            "raiz": serializar_no_rb(store.rb.raiz, store.rb.NIL),
            "altura": store.rb.altura,
            "total_nos": store.rb.quantidade_nos,
            "rotacoes_total": store.rb.estatisticas.total_rotacoes,
            "recoloracoes": store.rb.estatisticas.recoloracoes,
            "valido": valido_rb,
            "mensagem_validacao": msg_rb,
            "caminhamentos": {
                "pre": rb_pre,
                "em": rb_em,
                "pos": rb_pos
            },
            "menor": serializar_conta_resumida(store.rb.obter_menor()),
            "maior": serializar_conta_resumida(store.rb.obter_maior())
        },
        "historico": store.historico_operacoes[-15:],
        "ultimo_diagnostico": store.ultimo_diagnostico
    }


class InserirContaRequest(BaseModel):
    numero_conta: int = Field(..., ge=1, le=9999999, description="Número da conta (inteiro positivo)")
    titular: Optional[str] = Field(default="", max_length=100)
    saldo: float = Field(default=1000.0, ge=0.0)
    tipo: str = Field(default="Corrente")


class OperacaoChaveRequest(BaseModel):
    numero_conta: int = Field(..., ge=1, le=9999999, description="Número da conta (inteiro positivo)")


@app.get("/api/estado")
def rota_obter_estado():
    return {
        "sucesso": True,
        "dados": obter_estado_completo()
    }


@app.post("/api/inserir")
def rota_inserir_conta(req: InserirContaRequest):
    nome_titular = req.titular.strip() if req.titular and req.titular.strip() else f"Conta {req.numero_conta}"
    conta: Any = ContaBancaria(
        numero_conta=req.numero_conta,
        titular=nome_titular,
        agencia="0001",
        tipo=req.tipo,
        saldo=req.saldo
    )

    # Captura snapshots estruturais antes da alteração
    raiz_antes_avl = serializar_no_avl(store.avl.raiz)
    raiz_antes_rb = serializar_no_rb(store.rb.raiz, store.rb.NIL)

    # Gera estados intermediários (nó inserido antes da rotação/fixup)
    raiz_unrotated_avl = serializar_no_avl(gerar_arvore_avl_desbalanceada(store.avl.raiz, conta))
    raiz_unfixed_rb = serializar_no_rb(gerar_arvore_rb_sem_fixup(store.rb, conta), store.rb.NIL)

    sucesso_avl: bool = bool(store.avl.inserir(cast(Any, conta)))
    sucesso_rb: bool = bool(store.rb.inserir(cast(Any, conta)))

    raiz_final_avl = serializar_no_avl(store.avl.raiz)
    raiz_final_rb = serializar_no_rb(store.rb.raiz, store.rb.NIL)

    novos_logs = store.capturar_novos_logs()

    snapshots_avl = {
        "antes": raiz_antes_avl,
        "desbalanceada": raiz_unrotated_avl,
        "final": raiz_final_avl
    }
    snapshots_rb = {
        "antes": raiz_antes_rb,
        "sem_fixup": raiz_unfixed_rb,
        "final": raiz_final_rb
    }

    diag = extrair_diagnostico_rebalanceamento(
        novos_logs["avl"],
        novos_logs["rb"],
        "INSERCAO",
        req.numero_conta,
        snapshots_avl=snapshots_avl,
        snapshots_rb=snapshots_rb
    )
    store.ultimo_diagnostico = diag

    if not sucesso_avl and not sucesso_rb:
        raise HTTPException(
            status_code=400,
            detail=f"Conta {req.numero_conta} já existe no sistema. Operação rejeitada conforme Seção 8 do Edital."
        )

    registro_op = {
        "tipo": "INSERCAO",
        "chave": req.numero_conta,
        "titular": nome_titular,
        "detalhes": f"Conta {req.numero_conta} cadastrada com sucesso.",
        "logs": novos_logs,
        "diagnostico": diag
    }
    store.historico_operacoes.append(registro_op)

    return {
        "sucesso": True,
        "mensagem": f"Conta {req.numero_conta} inserida com sucesso em ambas as árvores.",
        "logs": novos_logs,
        "diagnostico": diag,
        "dados": obter_estado_completo()
    }


@app.post("/api/remover")
def rota_remover_conta(req: OperacaoChaveRequest):
    raiz_antes_avl = serializar_no_avl(store.avl.raiz)
    raiz_antes_rb = serializar_no_rb(store.rb.raiz, store.rb.NIL)

    rem_avl = store.avl.remover(req.numero_conta)
    rem_rb = store.rb.remover(req.numero_conta)

    raiz_final_avl = serializar_no_avl(store.avl.raiz)
    raiz_final_rb = serializar_no_rb(store.rb.raiz, store.rb.NIL)

    novos_logs = store.capturar_novos_logs()

    snapshots_avl = {
        "antes": raiz_antes_avl,
        "final": raiz_final_avl
    }
    snapshots_rb = {
        "antes": raiz_antes_rb,
        "final": raiz_final_rb
    }

    diag = extrair_diagnostico_rebalanceamento(
        novos_logs["avl"],
        novos_logs["rb"],
        "REMOCAO",
        req.numero_conta,
        snapshots_avl=snapshots_avl,
        snapshots_rb=snapshots_rb
    )
    store.ultimo_diagnostico = diag

    if rem_avl is None and rem_rb is None:
        raise HTTPException(
            status_code=404,
            detail=f"Conta {req.numero_conta} não encontrada para encerramento."
        )

    titular = rem_avl.titular if rem_avl else (rem_rb.titular if rem_rb else "Desconhecido")
    registro_op = {
        "tipo": "REMOCAO",
        "chave": req.numero_conta,
        "titular": titular,
        "detalhes": f"Conta {req.numero_conta} removida com sucesso.",
        "logs": novos_logs,
        "diagnostico": diag
    }
    store.historico_operacoes.append(registro_op)

    return {
        "sucesso": True,
        "mensagem": f"Conta {req.numero_conta} ({titular}) encerrada com sucesso.",
        "logs": novos_logs,
        "diagnostico": diag,
        "dados": obter_estado_completo()
    }


@app.post("/api/buscar")
def rota_buscar_conta(req: OperacaoChaveRequest):
    res_avl = store.avl.buscar(req.numero_conta)
    res_rb = store.rb.buscar(req.numero_conta)

    c = res_avl if res_avl is not None else res_rb
    encontrada = c is not None
    conta_info = None
    if c is not None:
        conta_info = {
            "numero_conta": c.numero_conta,
            "titular": c.titular,
            "agencia": c.agencia,
            "tipo": c.tipo,
            "saldo": float(c.saldo)
        }

    return {
        "sucesso": True,
        "encontrada": encontrada,
        "conta": conta_info,
        "mensagem": f"Conta {req.numero_conta} " + ("localizada com sucesso." if encontrada else "não consta no cadastro bancário.")
    }


@app.post("/api/limpar")
def rota_limpar_arvores():
    store.reset()
    return {
        "sucesso": True,
        "mensagem": "Ambas as árvores foram resetadas com sucesso.",
        "dados": obter_estado_completo()
    }


@app.post("/api/preset/{nome_preset}")
def rota_aplicar_preset(nome_preset: str):
    store.reset()

    presets_definidos = {
        "pior_caso_abb": [
            (10001, "Ana Souza", 1200.0),
            (10002, "Bruno Lima", 2500.0),
            (10003, "Carla Dias", 3100.0),
            (10004, "Daniel Alves", 1800.0),
            (10005, "Eduardo Silva", 4200.0),
            (10006, "Fernanda Cruz", 5000.0)
        ],
        "tio_vermelho": [
            (30000, "Raiz Preta", 5000.0),
            (20000, "Pai Vermelho", 3000.0),
            (40000, "Tio Vermelho", 4000.0),
            (10000, "Novo Conflito", 1500.0)
        ],
        "rotacao_dupla": [
            (50000, "No Base", 6000.0),
            (20000, "Filho Esquerdo", 2000.0),
            (35000, "Zigue-Zague", 3500.0)
        ],
        "remocao_grau_2": [
            (40000, "Raiz 40k", 4000.0),
            (20000, "Alvo 20k (Grau 2)", 2000.0),
            (60000, "Direito 60k", 6000.0),
            (10000, "Folha 10k", 1000.0),
            (30000, "Subarvore 30k", 3000.0),
            (25000, "Sucessor 25k", 2500.0)
        ]
    }

    if nome_preset not in presets_definidos:
        raise HTTPException(
            status_code=400,
            detail=f"Preset '{nome_preset}' não reconhecido. Opções: {list(presets_definidos.keys())}"
        )

    itens = presets_definidos[nome_preset]
    for chave, titular, saldo in itens:
        conta: Any = ContaBancaria(
            numero_conta=chave,
            titular=titular,
            agencia="0001",
            tipo="Corrente",
            saldo=saldo
        )
        store.avl.inserir(cast(Any, conta))
        store.rb.inserir(cast(Any, conta))

    novos_logs = store.capturar_novos_logs()
    raiz_final_avl = serializar_no_avl(store.avl.raiz)
    raiz_final_rb = serializar_no_rb(store.rb.raiz, store.rb.NIL)
    snapshots_avl = {"final": raiz_final_avl}
    snapshots_rb = {"final": raiz_final_rb}
    diag = extrair_diagnostico_rebalanceamento(
        novos_logs["avl"],
        novos_logs["rb"],
        "PRESET",
        0,
        snapshots_avl=snapshots_avl,
        snapshots_rb=snapshots_rb
    )
    store.ultimo_diagnostico = diag

    store.historico_operacoes.append({
        "tipo": "PRESET",
        "chave": nome_preset,
        "titular": f"Cenário Demonstrativo: {nome_preset}",
        "detalhes": f"Carregadas {len(itens)} contas estrategicamente.",
        "logs": novos_logs,
        "diagnostico": diag
    })

    return {
        "sucesso": True,
        "mensagem": f"Cenário demonstrativo '{nome_preset}' carregado com sucesso.",
        "logs": novos_logs,
        "diagnostico": diag,
        "dados": obter_estado_completo()
    }


DIST_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(DIST_PATH):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_PATH, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        index_file = os.path.join(DIST_PATH, "index.html")
        return FileResponse(index_file)

if __name__ == "__main__":
    import uvicorn
    porta = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=porta)

