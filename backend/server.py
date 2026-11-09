import sys
import os
import re
import time
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
    from modelos import ContaBancaria, Cor  # type: ignore
    from avl import ArvoreAVL  # type: ignore
    from rubro_negra import ArvoreRubroNegra  # type: ignore
except ImportError:
    from backend_original.modelos import ContaBancaria, Cor  # type: ignore
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


def extrair_diagnostico_rebalanceamento(
    logs_avl: List[str],
    logs_rb: List[str],
    tipo_op: str,
    chave: int
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
        "subarvore_antes": "",
        "subarvore_depois": "",
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

        m_antes = re.search(r">>> Subarvore ANTES[^\n]*:\n(.*?)(?=\n\s*>>>|\Z)", texto_avl, re.DOTALL)
        if m_antes:
            avl_diag["subarvore_antes"] = m_antes.group(1).strip()

        m_depois = re.search(r">>> Subarvore DEPOIS[^\n]*:\n(.*?)(?=\n\s*>>>|\Z)", texto_avl, re.DOTALL)
        if m_depois:
            avl_diag["subarvore_depois"] = m_depois.group(1).strip()

        passos_avl: List[Dict[str, Any]] = []
        if tipo_op == "INSERCAO":
            passos_avl.append({
                "ordem": 1,
                "titulo": "Inserção Inicial",
                "descricao": f"Conta #{chave} inserida na árvore como nó folha.",
                "tipo": "info"
            })
        elif tipo_op == "REMOCAO":
            passos_avl.append({
                "ordem": 1,
                "titulo": "Remoção de Registro",
                "descricao": f"Conta #{chave} removida da árvore.",
                "tipo": "info"
            })

        if avl_diag["no_desbalanceado"]:
            passos_avl.append({
                "ordem": 2,
                "titulo": "Detecção de Desequilíbrio",
                "descricao": f"Nó ({avl_diag['no_desbalanceado']}) violou o critério AVL com FB={avl_diag['fb_detectado']} (|FB| ≥ 2).",
                "tipo": "warning"
            })

        passos_avl.append({
            "ordem": 3,
            "titulo": "Rebalanceamento",
            "descricao": f"{avl_diag['tipo_rotacao']}. " + (f"Nó ({avl_diag['no_promovido']}) promovido a raiz local." if avl_diag['no_promovido'] else ""),
            "tipo": "success"
        })
        passos_avl.append({
            "ordem": 4,
            "titulo": "Equilíbrio Restaurado",
            "descricao": "Alturas e Fatores de Balanceamento recalculados (|FB| ≤ 1 para todos os nós).",
            "tipo": "success"
        })
        avl_diag["passos"] = passos_avl
    elif "[REMOCAO AVL" in texto_avl:
        m_caso_rem = re.search(r"\[REMOCAO AVL - (CASO \d+:[^\]]+)\]", texto_avl)
        if m_caso_rem:
            avl_diag["caso"] = m_caso_rem.group(1).strip()
            avl_diag["tipo_rotacao"] = "Remoção direta sem rotação"
            avl_diag["passos"] = [
                {"ordem": 1, "titulo": "Encerramento", "descricao": f"Conta #{chave} identificada para exclusão.", "tipo": "info"},
                {"ordem": 2, "titulo": "Ajuste de Ponteiros", "descricao": avl_diag["caso"], "tipo": "success"},
                {"ordem": 3, "titulo": "Equilíbrio", "descricao": "Propriedade AVL mantida sem necessidade de rotação.", "tipo": "success"}
            ]
    elif tipo_op == "INSERCAO" and chave > 0:
        avl_diag["passos"] = [
            {"ordem": 1, "titulo": "Inserção Direta", "descricao": f"Conta #{chave} inserida sem violar a condição AVL (|FB| ≤ 1).", "tipo": "success"}
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
        "subarvore_antes": "",
        "subarvore_depois": "",
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

        m_antes_rb = re.search(r">>> [^\n]*ANTES[^\n]*:\n(.*?)(?=\n\s*>>>|\Z)", texto_rb, re.DOTALL)
        if m_antes_rb:
            rb_diag["subarvore_antes"] = m_antes_rb.group(1).strip()

        m_depois_rb = re.search(r">>> [^\n]*(?:DEPOIS|Passo 2)[^\n]*:\n(.*?)(?=\n\s*>>>|\Z)", texto_rb, re.DOTALL)
        if m_depois_rb:
            rb_diag["subarvore_depois"] = m_depois_rb.group(1).strip()

        passos_rb: List[Dict[str, Any]] = []
        if tipo_op == "INSERCAO":
            passos_rb.append({
                "ordem": 1,
                "titulo": "Inserção Rubra",
                "descricao": f"Conta #{chave} inserida como nó VERMELHO (preservando altura-negra).",
                "tipo": "info"
            })
            if rb_diag["no_conflito"] and rb_diag["pai"]:
                passos_rb.append({
                    "ordem": 2,
                    "titulo": "Conflito Rubro-Rubro",
                    "descricao": f"Violação da Regra 4: Nó ({rb_diag['no_conflito']}) e Pai ({rb_diag['pai']}) ambos são nós vermelhos.",
                    "tipo": "warning"
                })

        if rb_diag["recoloracoes"]:
            detalhe_rec = ", ".join([f"{r['papel']} #{r['chave']} ➜ {r['nova_cor']}" for r in rb_diag["recoloracoes"]])
            passos_rb.append({
                "ordem": 3,
                "titulo": "Recoloração Efetuada",
                "descricao": f"Ajuste cromático: {detalhe_rec}.",
                "tipo": "success"
            })

        passos_rb.append({
            "ordem": len(passos_rb) + 1,
            "titulo": "Propriedades Restauradas",
            "descricao": "Raiz preta confirmada e invariantes de Cormen Cap. 13 restabelecidas.",
            "tipo": "success"
        })
        rb_diag["passos"] = passos_rb
    elif "[REMOCAO RUBRO-NEGRA" in texto_rb:
        m_caso_rem_rb = re.search(r"\[REMOCAO RUBRO-NEGRA - (CASO [^\]]+)\]", texto_rb)
        if m_caso_rem_rb:
            rb_diag["caso"] = m_caso_rem_rb.group(1).strip()
            rb_diag["tipo_acao"] = "Rebalanceamento pós-remoção (Cormen)"
            rb_diag["passos"] = [
                {"ordem": 1, "titulo": "Remoção", "descricao": f"Conta #{chave} removida da árvore.", "tipo": "info"},
                {"ordem": 2, "titulo": "Correção de Altura-Negra", "descricao": rb_diag["caso"], "tipo": "success"}
            ]
    elif tipo_op == "INSERCAO" and chave > 0:
        rb_diag["passos"] = [
            {"ordem": 1, "titulo": "Inserção Direta", "descricao": f"Conta #{chave} inserida sem conflito de cores (Propriedades do Cormen mantidas).", "tipo": "success"}
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


def serializar_no_rb(no, nil) -> Optional[Dict[str, Any]]:
    if no == nil:
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

    sucesso_avl: bool = bool(store.avl.inserir(cast(Any, conta)))
    sucesso_rb: bool = bool(store.rb.inserir(cast(Any, conta)))

    novos_logs = store.capturar_novos_logs()
    diag = extrair_diagnostico_rebalanceamento(novos_logs["avl"], novos_logs["rb"], "INSERCAO", req.numero_conta)
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
    rem_avl = store.avl.remover(req.numero_conta)
    rem_rb = store.rb.remover(req.numero_conta)

    novos_logs = store.capturar_novos_logs()
    diag = extrair_diagnostico_rebalanceamento(novos_logs["avl"], novos_logs["rb"], "REMOCAO", req.numero_conta)
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
    diag = extrair_diagnostico_rebalanceamento(novos_logs["avl"], novos_logs["rb"], "PRESET", 0)
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

