import sys
import os
from typing import Optional, List, Dict, Any
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


class TreeStore:
    def __init__(self):
        self.reset()

    def reset(self):
        self.avl = ArvoreAVL(modo_detalhado=True)
        self.rb = ArvoreRubroNegra(modo_detalhado=True)
        self.historico_operacoes: List[Dict[str, Any]] = []
        self.avl_log_cursor: int = 0
        self.rb_log_cursor: int = 0

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


def obter_estado_completo() -> Dict[str, Any]:
    valido_avl, msg_avl = store.avl.validar_propriedades()
    valido_rb, msg_rb = store.rb.validar_propriedades()

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
            "mensagem_validacao": msg_avl
        },
        "rubro_negra": {
            "raiz": serializar_no_rb(store.rb.raiz, store.rb.NIL),
            "altura": store.rb.altura,
            "total_nos": store.rb.quantidade_nos,
            "rotacoes_total": store.rb.estatisticas.total_rotacoes,
            "recoloracoes": store.rb.estatisticas.recoloracoes,
            "valido": valido_rb,
            "mensagem_validacao": msg_rb
        },
        "historico": store.historico_operacoes[-15:]
    }


class InserirContaRequest(BaseModel):
    numero_conta: int = Field(..., ge=10001, le=999999, description="Chave única de 5 a 6 dígitos")
    titular: str = Field(..., min_length=2, max_length=50)
    saldo: float = Field(default=1000.0, ge=0.0)
    tipo: str = Field(default="Corrente")


class OperacaoChaveRequest(BaseModel):
    numero_conta: int = Field(..., ge=10001, le=999999)


@app.get("/api/estado")
def rota_obter_estado():
    return {
        "sucesso": True,
        "dados": obter_estado_completo()
    }


@app.post("/api/inserir")
def rota_inserir_conta(req: InserirContaRequest):
    conta = ContaBancaria(
        numero_conta=req.numero_conta,
        titular=req.titular,
        agencia="0001",
        tipo=req.tipo,
        saldo=req.saldo
    )

    sucesso_avl = store.avl.inserir(conta)
    sucesso_rb = store.rb.inserir(conta)

    novos_logs = store.capturar_novos_logs()

    if not sucesso_avl and not sucesso_rb:
        raise HTTPException(
            status_code=400,
            detail=f"Conta {req.numero_conta} já existe no sistema. Operação rejeitada conforme Seção 8 do Edital."
        )

    registro_op = {
        "tipo": "INSERCAO",
        "chave": req.numero_conta,
        "titular": req.titular,
        "detalhes": f"Conta {req.numero_conta} cadastrada com sucesso.",
        "logs": novos_logs
    }
    store.historico_operacoes.append(registro_op)

    return {
        "sucesso": True,
        "mensagem": f"Conta {req.numero_conta} inserida com sucesso em ambas as árvores.",
        "logs": novos_logs,
        "dados": obter_estado_completo()
    }


@app.post("/api/remover")
def rota_remover_conta(req: OperacaoChaveRequest):
    rem_avl = store.avl.remover(req.numero_conta)
    rem_rb = store.rb.remover(req.numero_conta)

    novos_logs = store.capturar_novos_logs()

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
        "logs": novos_logs
    }
    store.historico_operacoes.append(registro_op)

    return {
        "sucesso": True,
        "mensagem": f"Conta {req.numero_conta} ({titular}) encerrada com sucesso.",
        "logs": novos_logs,
        "dados": obter_estado_completo()
    }


@app.post("/api/buscar")
def rota_buscar_conta(req: OperacaoChaveRequest):
    res_avl = store.avl.buscar(req.numero_conta)
    res_rb = store.rb.buscar(req.numero_conta)

    encontrada = (res_avl is not None or res_rb is not None)
    conta_info = None
    if encontrada:
        c = res_avl or res_rb
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
        conta = ContaBancaria(
            numero_conta=chave,
            titular=titular,
            agencia="0001",
            tipo="Corrente",
            saldo=saldo
        )
        store.avl.inserir(conta)
        store.rb.inserir(conta)

    novos_logs = store.capturar_novos_logs()

    store.historico_operacoes.append({
        "tipo": "PRESET",
        "chave": nome_preset,
        "titular": f"Cenário Demonstrativo: {nome_preset}",
        "detalhes": f"Carregadas {len(itens)} contas estrategicamente.",
        "logs": novos_logs
    })

    return {
        "sucesso": True,
        "mensagem": f"Cenário demonstrativo '{nome_preset}' carregado com sucesso.",
        "logs": novos_logs,
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

