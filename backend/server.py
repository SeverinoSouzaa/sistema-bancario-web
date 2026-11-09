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
    passos = simular_passos_completos_rb(rb_store, conta)
    if passos and passos[0].get("arvore"):
        return passos[0]["arvore"]
    return None


def simular_passos_completos_rb(rb_store: Any, conta: Any) -> List[Dict[str, Any]]:
    criar_no_rb: Any = NoRB
    cor_v: Any = Cor.VERMELHO
    cor_p: Any = Cor.PRETO

    nil_store: Any = rb_store.NIL
    if rb_store.raiz == nil_store:
        no_temp: Any = criar_no_rb(conta=conta, cor=cor_p, esquerda=nil_store, direita=nil_store, pai=nil_store)  # type: ignore
        return [{
            "fase": "final",
            "arvore": serializar_no_rb(no_temp, nil_store),
            "no_foco": conta.numero_conta,
            "titulo": "Árvore Resultante Válida",
            "descricao": f"Conta #{conta.numero_conta} inserida como raiz da árvore e colorida como PRETA (Propriedade 2 de Cormen).",
            "status": "success"
        }]

    rb_copia: Any = copy.deepcopy(rb_store)
    nil: Any = rb_copia.NIL

    # 1. Inserção BST tradicional como nó vermelho
    z: Any = criar_no_rb(conta=conta, cor=cor_v, esquerda=nil, direita=nil, pai=nil)  # type: ignore
    y: Any = nil
    x: Any = rb_copia.raiz
    while x != nil:
        y = x
        if z.chave < x.chave:
            x = x.esquerda
        else:
            x = x.direita
    z.pai = y
    if y == nil:
        rb_copia.raiz = z
    elif z.chave < y.chave:
        y.esquerda = z
    else:
        y.direita = z

    passos: List[Dict[str, Any]] = []

    # Passo: Inserção Rubra & Violação (antes de qualquer rebalanceamento)
    pai_chave = z.pai.chave if z.pai and z.pai != nil else None
    passos.append({
        "fase": "insercao",
        "arvore": serializar_no_rb(rb_copia.raiz, nil),
        "no_foco": z.chave,
        "titulo": "Inserção Rubra & Violação",
        "descricao": f"Conta #{conta.numero_conta} inserida como nó VERMELHO. Ocorre conflito entre o nó #{z.chave} e seu pai #{pai_chave} (ambos vermelhos), violando a Regra 4 de Cormen.",
        "status": "warning"
    })

    # Simulação do fixup passo a passo registrando rotações puras e recolorações
    while z.pai.cor.value == "VERMELHO":
        if z.pai == z.pai.pai.esquerda:
            u: Any = z.pai.pai.direita
            if u.cor.value == "VERMELHO":
                # Caso 1: Tio Vermelho -> Apenas recoloração pura
                p_k, t_k, a_k = z.pai.chave, u.chave, z.pai.pai.chave
                z.pai.cor = cor_p
                u.cor = cor_p
                z.pai.pai.cor = cor_v
                passos.append({
                    "fase": "recoloracao",
                    "arvore": serializar_no_rb(rb_copia.raiz, nil),
                    "no_foco": a_k,
                    "titulo": "Recoloração (Caso 1: Tio Vermelho)",
                    "descricao": f"Tio #{t_k} é VERMELHO. Solução por recoloração: Pai #{p_k} passa a ser PRETO, Tio #{t_k} passa a ser PRETO e Avô #{a_k} passa a ser VERMELHO.",
                    "status": "warning"
                })
                z = z.pai.pai
            else:
                if z == z.pai.direita:
                    # Caso 2: LR -> Rotação simples no pai para alinhar
                    p_lr_k = z.pai.chave
                    z = z.pai
                    rb_copia._rotacao_esquerda(z)
                    passos.append({
                        "fase": "rotacao_pai",
                        "arvore": serializar_no_rb(rb_copia.raiz, nil),
                        "no_foco": z.chave,
                        "titulo": "Rotação no Pai (Alinhamento em Linha Reta)",
                        "descricao": f"Caso 2 (Zigue-Zague LR): Rotação simples à esquerda no Pai #{p_lr_k} para transformar no Caso 3 (Linha Reta). Observação: as cores dos nós são mantidas intactas.",
                        "status": "warning"
                    })
                # Caso 3: LL -> Rotação no avô (cores mantidas temporariamente!)
                avo: Any = z.pai.pai
                pai: Any = z.pai
                rb_copia._rotacao_direita(avo)
                passos.append({
                    "fase": "rotacao_avo",
                    "arvore": serializar_no_rb(rb_copia.raiz, nil),
                    "no_foco": pai.chave,
                    "titulo": "Rotação Estrutural no Avô (Cores Mantidas)",
                    "descricao": f"Caso 3 (Linha Reta LL): Rotação simples à direita no Avô #{avo.chave}. O nó #{pai.chave} sobe para a raiz local. Observação didática: os nós mantêm suas cores originais antes do ajuste cromático.",
                    "status": "warning"
                })
                # Agora sim: Ajuste de cores de Cormen
                pai.cor = cor_p
                avo.cor = cor_v
                passos.append({
                    "fase": "recoloracao",
                    "arvore": serializar_no_rb(rb_copia.raiz, nil),
                    "no_foco": pai.chave,
                    "titulo": "Ajuste de Cores / Recoloração",
                    "descricao": f"Ajuste cromático de Cormen: Pai local #{pai.chave} passa a ser PRETO e antigo Avô #{avo.chave} passa a ser VERMELHO.",
                    "status": "success"
                })
        else:
            u = z.pai.pai.esquerda
            if u.cor.value == "VERMELHO":
                # Caso 1: Tio Vermelho
                p_k, t_k, a_k = z.pai.chave, u.chave, z.pai.pai.chave
                z.pai.cor = cor_p
                u.cor = cor_p
                z.pai.pai.cor = cor_v
                passos.append({
                    "fase": "recoloracao",
                    "arvore": serializar_no_rb(rb_copia.raiz, nil),
                    "no_foco": a_k,
                    "titulo": "Recoloração (Caso 1: Tio Vermelho)",
                    "descricao": f"Tio #{t_k} é VERMELHO. Solução por recoloração: Pai #{p_k} passa a ser PRETO, Tio #{t_k} passa a ser PRETO e Avô #{a_k} passa a ser VERMELHO.",
                    "status": "warning"
                })
                z = z.pai.pai
            else:
                if z == z.pai.esquerda:
                    # Caso 2: RL -> Rotação simples no pai
                    p_rl_k = z.pai.chave
                    z = z.pai
                    rb_copia._rotacao_direita(z)
                    passos.append({
                        "fase": "rotacao_pai",
                        "arvore": serializar_no_rb(rb_copia.raiz, nil),
                        "no_foco": z.chave,
                        "titulo": "Rotação no Pai (Alinhamento em Linha Reta)",
                        "descricao": f"Caso 2 (Zigue-Zague RL): Rotação simples à direita no Pai #{p_rl_k} para transformar no Caso 3 (Linha Reta). Observação: as cores dos nós são mantidas intactas.",
                        "status": "warning"
                    })
                # Caso 3: RR -> Rotação no avô (cores mantidas temporariamente!)
                avo = z.pai.pai
                pai = z.pai
                rb_copia._rotacao_esquerda(avo)
                passos.append({
                    "fase": "rotacao_avo",
                    "arvore": serializar_no_rb(rb_copia.raiz, nil),
                    "no_foco": pai.chave,
                    "titulo": "Rotação Estrutural no Avô (Cores Mantidas)",
                    "descricao": f"Caso 3 (Linha Reta RR): Rotação simples à esquerda no Avô #{avo.chave}. O nó #{pai.chave} sobe para a raiz local. Observação didática: os nós mantêm suas cores originais antes do ajuste cromático.",
                    "status": "warning"
                })
                # Agora sim: Ajuste de cores de Cormen
                pai.cor = cor_p
                avo.cor = cor_v
                passos.append({
                    "fase": "recoloracao",
                    "arvore": serializar_no_rb(rb_copia.raiz, nil),
                    "no_foco": pai.chave,
                    "titulo": "Ajuste de Cores / Recoloração",
                    "descricao": f"Ajuste cromático de Cormen: Pai local #{pai.chave} passa a ser PRETO e antigo Avô #{avo.chave} passa a ser VERMELHO.",
                    "status": "success"
                })

    if rb_copia.raiz.cor.value != "PRETO":
        rb_copia.raiz.cor = cor_p
        passos.append({
            "fase": "raiz_preta",
            "arvore": serializar_no_rb(rb_copia.raiz, nil),
            "no_foco": rb_copia.raiz.chave,
            "titulo": "Fixação da Raiz como Preta",
            "descricao": "Propriedade 2 de Cormen: a raiz da árvore Rubro-Negra deve ser estritamente PRETA.",
            "status": "success"
        })

    return passos


def simular_passos_remocao_rb(rb_store: Any, numero_conta: int) -> List[Dict[str, Any]]:
    rb: Any = copy.deepcopy(rb_store)
    nil: Any = rb.NIL
    cor_v: Any = Cor.VERMELHO
    cor_p: Any = Cor.PRETO

    z: Any = rb.raiz
    while z != nil and z.chave != numero_conta:
        if numero_conta < z.chave:
            z = z.esquerda
        else:
            z = z.direita

    if z == nil:
        return []

    passos: List[Dict[str, Any]] = []
    y: Any = z
    y_cor_original = y.cor
    z_cor_original = z.cor

    if z.esquerda == nil:
        x: Any = z.direita
        rb._transplant(z, z.direita)
        passos.append({
            "fase": "desconexao",
            "arvore": serializar_no_rb(rb.raiz, nil),
            "no_foco": x.chave if x != nil else None,
            "titulo": "Desconexão do Nó",
            "descricao": f"Conta #{numero_conta} desconectada da árvore. Filho direito assumiu a posição.",
            "status": "warning"
        })
    elif z.direita == nil:
        x = z.esquerda
        rb._transplant(z, z.esquerda)
        passos.append({
            "fase": "desconexao",
            "arvore": serializar_no_rb(rb.raiz, nil),
            "no_foco": x.chave if x != nil else None,
            "titulo": "Desconexão do Nó",
            "descricao": f"Conta #{numero_conta} desconectada da árvore. Filho esquerdo assumiu a posição.",
            "status": "warning"
        })
    else:
        # Grau 2: Substituição por Sucessor em-ordem
        y = rb._menor_no(z.direita)
        y_cor_original = y.cor
        x = y.direita
        sucessor_chave = y.chave

        if y.pai == z:
            x.pai = y
        else:
            rb._transplant(y, y.direita)
            y.direita = z.direita
            y.direita.pai = y

        rb._transplant(z, y)
        y.esquerda = z.esquerda
        y.esquerda.pai = y

        # 1. Sucessor assume a posição física mantendo a cor original
        passos.append({
            "fase": "substituicao_sucessor",
            "arvore": serializar_no_rb(rb.raiz, nil),
            "no_foco": sucessor_chave,
            "titulo": "Substituição pelo Sucessor em-ordem (Cores Mantidas)",
            "descricao": f"Conta #{numero_conta} possuía 2 filhos (grau 2). O sucessor em-ordem Conta #{sucessor_chave} assume a posição física de #{numero_conta}, mantendo temporariamente sua cor original {y_cor_original.value}.",
            "status": "warning"
        })

        # 2. Herança da cor do nó alvo excluído
        if y.cor.value != z_cor_original.value:
            y.cor = z_cor_original
            passos.append({
                "fase": "recoloracao_heranca",
                "arvore": serializar_no_rb(rb.raiz, nil),
                "no_foco": sucessor_chave,
                "titulo": "Recoloração por Herança da Cor",
                "descricao": f"O sucessor Conta #{sucessor_chave} é RECOLORIDO de {y_cor_original.value} para {z_cor_original.value}, herdando a cor do nó excluído (#{numero_conta}) para preservar a altura negra da subárvore.",
                "status": "success"
            })
        else:
            y.cor = z_cor_original

    # Fixup se o nó que desocupou a posição na base era PRETO
    if y_cor_original.value == "PRETO":
        while x != rb.raiz and x.cor.value == "PRETO":
            if x == x.pai.esquerda:
                w: Any = x.pai.direita
                if w.cor.value == "VERMELHO":
                    w.cor = cor_p
                    x.pai.cor = cor_v
                    rb._rotacao_esquerda(x.pai)
                    passos.append({
                        "fase": "fixup_caso1",
                        "arvore": serializar_no_rb(rb.raiz, nil),
                        "no_foco": w.chave if w != nil else None,
                        "titulo": "Fixup Caso 1: Rotação no Pai & Recoloração do Irmão",
                        "descricao": f"Irmão #{w.chave if w != nil else 'NIL'} era VERMELHO. Rotação à esquerda no Pai #{x.pai.chave} e inversão de cores para transformar em irmão preto.",
                        "status": "warning"
                    })
                    w = x.pai.direita

                if w.esquerda.cor.value == "PRETO" and w.direita.cor.value == "PRETO":
                    w.cor = cor_v
                    passos.append({
                        "fase": "fixup_caso2",
                        "arvore": serializar_no_rb(rb.raiz, nil),
                        "no_foco": w.chave if w != nil else None,
                        "titulo": "Fixup Caso 2: Recoloração do Irmão (Dupla-Preta Sobe)",
                        "descricao": f"Irmão #{w.chave if w != nil else 'NIL'} e ambos os filhos são PRETOS. Irmão é recolorido para VERMELHO e a dupla-preta sobe para o Pai #{x.pai.chave}.",
                        "status": "warning"
                    })
                    x = x.pai
                else:
                    if w.direita.cor.value == "PRETO":
                        w.esquerda.cor = cor_p
                        w.cor = cor_v
                        rb._rotacao_direita(w)
                        passos.append({
                            "fase": "fixup_caso3",
                            "arvore": serializar_no_rb(rb.raiz, nil),
                            "no_foco": w.chave if w != nil else None,
                            "titulo": "Fixup Caso 3: Rotação no Irmão (Zigue-Zague)",
                            "descricao": f"Filho direito do irmão é PRETO e esquerdo é VERMELHO. Rotação à direita no Irmão #{w.chave} para alinhar no Caso 4.",
                            "status": "warning"
                        })
                        w = x.pai.direita

                    pai_ref: Any = x.pai
                    pai_cor_orig = pai_ref.cor
                    rb._rotacao_esquerda(pai_ref)
                    w.cor = pai_cor_orig
                    pai_ref.cor = cor_p
                    w.direita.cor = cor_p
                    passos.append({
                        "fase": "fixup_caso4",
                        "arvore": serializar_no_rb(rb.raiz, nil),
                        "no_foco": w.chave if w != nil else None,
                        "titulo": "Fixup Caso 4: Rotação no Pai & Ajuste de Cores",
                        "descricao": f"Filho direito do irmão é VERMELHO. Rotação à esquerda no Pai #{pai_ref.chave} e absorção da dupla-preta.",
                        "status": "success"
                    })
                    x = rb.raiz
            else:
                w = x.pai.esquerda
                if w.cor.value == "VERMELHO":
                    w.cor = cor_p
                    x.pai.cor = cor_v
                    rb._rotacao_direita(x.pai)
                    passos.append({
                        "fase": "fixup_caso1",
                        "arvore": serializar_no_rb(rb.raiz, nil),
                        "no_foco": w.chave if w != nil else None,
                        "titulo": "Fixup Caso 1: Rotação no Pai & Recoloração do Irmão",
                        "descricao": f"Irmão #{w.chave if w != nil else 'NIL'} era VERMELHO. Rotação à direita no Pai #{x.pai.chave} e inversão de cores.",
                        "status": "warning"
                    })
                    w = x.pai.esquerda

                if w.direita.cor.value == "PRETO" and w.esquerda.cor.value == "PRETO":
                    w.cor = cor_v
                    passos.append({
                        "fase": "fixup_caso2",
                        "arvore": serializar_no_rb(rb.raiz, nil),
                        "no_foco": w.chave if w != nil else None,
                        "titulo": "Fixup Caso 2: Recoloração do Irmão (Dupla-Preta Sobe)",
                        "descricao": f"Irmão #{w.chave if w != nil else 'NIL'} e ambos os filhos são PRETOS. Irmão é recolorido para VERMELHO e a dupla-preta sobe para o Pai #{x.pai.chave}.",
                        "status": "warning"
                    })
                    x = x.pai
                else:
                    if w.esquerda.cor.value == "PRETO":
                        w.direita.cor = cor_p
                        w.cor = cor_v
                        rb._rotacao_esquerda(w)
                        passos.append({
                            "fase": "fixup_caso3",
                            "arvore": serializar_no_rb(rb.raiz, nil),
                            "no_foco": w.chave if w != nil else None,
                            "titulo": "Fixup Caso 3: Rotação no Irmão (Zigue-Zague)",
                            "descricao": f"Filho esquerdo do irmão é PRETO e direito é VERMELHO. Rotação à esquerda no Irmão #{w.chave} para alinhar no Caso 4.",
                            "status": "warning"
                        })
                        w = x.pai.esquerda

                    pai_ref = x.pai
                    pai_cor_orig = pai_ref.cor
                    rb._rotacao_direita(pai_ref)
                    w.cor = pai_cor_orig
                    pai_ref.cor = cor_p
                    w.esquerda.cor = cor_p
                    passos.append({
                        "fase": "fixup_caso4",
                        "arvore": serializar_no_rb(rb.raiz, nil),
                        "no_foco": w.chave if w != nil else None,
                        "titulo": "Fixup Caso 4: Rotação no Pai & Ajuste de Cores",
                        "descricao": f"Filho esquerdo do irmão é VERMELHO. Rotação à direita no Pai #{pai_ref.chave} e absorção da dupla-preta.",
                        "status": "success"
                    })
                    x = rb.raiz

        if x.cor.value != "PRETO":
            x.cor = cor_p
            passos.append({
                "fase": "fixup_final_cor",
                "arvore": serializar_no_rb(rb.raiz, nil),
                "no_foco": x.chave if x != nil else None,
                "titulo": "Fixação de Nó Preto",
                "descricao": "Nó x recolorido para PRETO para absorver a dupla-preta final.",
                "status": "success"
            })

    return passos


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

        m_conflito = re.search(r"Conflito[^\n]*?No \((\d+)\)[^\n]*?(?:e|com) Pai \((\d+)\)", texto_rb)
        if m_conflito:
            rb_diag["no_conflito"] = int(m_conflito.group(1))
            rb_diag["pai"] = int(m_conflito.group(2))
        else:
            m_alt = re.search(r"No \((\d+)\)[^\n]*?Pai \((\d+)\)", texto_rb)
            if m_alt:
                rb_diag["no_conflito"] = int(m_alt.group(1))
                rb_diag["pai"] = int(m_alt.group(2))

        m_tio = re.search(r"Tio\s*(?:\((\d+)\))?\s*e\s*(VERMELHO|PRETO)", texto_rb)
        if m_tio:
            rb_diag["tio"] = int(m_tio.group(1)) if m_tio.group(1) else None
            rb_diag["cor_tio"] = m_tio.group(2)

        recolores = re.findall(r"(Pai|Tio|Avo)\s*\((\d+)\)\s*(?:passa a ser|->)\s*(PRETO|VERMELHO)", texto_rb)
        for papel, k, nova_cor in recolores:
            if not any(r["chave"] == int(k) and r["nova_cor"] == nova_cor for r in rb_diag["recoloracoes"]):
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

        simulados = snapshots_rb.get("passos_simulados") if snapshots_rb else None
        if simulados:
            for s in simulados:
                passos_rb.append({
                    "ordem": len(passos_rb) + 1,
                    "titulo": f"{len(passos_rb) + 1}. {s['titulo']}",
                    "descricao": s["descricao"],
                    "arvore": s["arvore"],
                    "no_foco": s["no_foco"],
                    "status": s["status"]
                })
        else:
            pai_label = f"#{rb_diag['pai']}" if rb_diag['pai'] else "vermelho"
            passos_rb.append({
                "ordem": 2,
                "titulo": "2. Inserção Rubra & Violação",
                "descricao": f"Conta #{chave} inserida como nó VERMELHO. Ocorre conflito entre nó #{rb_diag['no_conflito'] or chave} e pai {pai_label} (ambos vermelhos), violando a Regra 4 de Cormen.",
                "arvore": snapshots_rb.get("sem_fixup") if snapshots_rb else None,
                "no_foco": rb_diag["no_conflito"] or chave,
                "status": "warning"
            })
            desc_rec = f" Recolorações efetuadas: {', '.join([r['papel'] + ' #' + str(r['chave']) + ' ➜ ' + r['nova_cor'] for r in rb_diag['recoloracoes']])}." if rb_diag['recoloracoes'] else ""
            passos_rb.append({
                "ordem": 3,
                "titulo": "3. Rebalanceamento Estrutural",
                "descricao": f"Aplicação do {rb_diag['caso']}: {rb_diag['tipo_acao']}.{desc_rec}",
                "arvore": snapshots_rb.get("final") if snapshots_rb else None,
                "no_foco": rb_diag["no_conflito"] or chave,
                "status": "success"
            })

        # Passo Final: Árvore Resultante Válida
        passos_rb.append({
            "ordem": len(passos_rb) + 1,
            "titulo": f"{len(passos_rb) + 1}. Árvore Resultante Válida",
            "descricao": "Ajuste concluído com sucesso. A raiz permanece estritamente PRETA e todos os caminhos até as folhas mantêm rigorosamente a mesma altura negra (bh), atendendo as 5 propriedades de Cormen.",
            "arvore": snapshots_rb.get("final") if snapshots_rb else None,
            "no_foco": None,
            "status": "success"
        })
        rb_diag["passos"] = passos_rb

    elif tipo_op == "REMOCAO" and chave > 0:
        simulados_rem = snapshots_rb.get("passos_simulados") if snapshots_rb else None
        tem_heranca = any(s.get("fase") == "recoloracao_heranca" for s in (simulados_rem or []))

        if "[REMOCAO RUBRO-NEGRA" in texto_rb:
            m_caso_rem_rb = re.search(r"\[REMOCAO RUBRO-NEGRA - (CASO [^\]]+)\]", texto_rb)
            rb_diag["caso"] = m_caso_rem_rb.group(1).strip() if m_caso_rem_rb else "Rebalanceamento pós-remoção"
            rb_diag["tipo_acao"] = "Ajuste de altura-negra pós-remoção (Cormen)"
            rb_diag["houve_rebalanceamento"] = True
        elif tem_heranca or "[RECOLORACAO NA RUBRO-NEGRA" in texto_rb:
            rb_diag["caso"] = "Substituição & Recoloração (Grau 2)"
            rb_diag["tipo_acao"] = "Sucessor em-ordem assume posição e herda cor do nó excluído"
            rb_diag["houve_rebalanceamento"] = True
        else:
            rb_diag["caso"] = "Remoção Direta"
            rb_diag["tipo_acao"] = "Nenhum ajuste necessário"

        recolores_rem = re.findall(r"(?:Conta\s*)?(\d+)\s*e\s*RECOLORIDA\s*de\s*(?:VERMELHO|PRETO)\s*para\s*(PRETO|VERMELHO)", texto_rb)
        for k, cor_para in recolores_rem:
            if not any(r["chave"] == int(k) and r["nova_cor"] == cor_para for r in rb_diag["recoloracoes"]):
                rb_diag["recoloracoes"].append({
                    "papel": "Sucessor",
                    "chave": int(k),
                    "nova_cor": cor_para
                })

        passos_rb = []
        passos_rb.append({
            "ordem": 1,
            "titulo": "1. Estrutura Antes da Remoção",
            "descricao": f"Árvore Rubro-Negra com a Conta #{chave} cadastrada.",
            "arvore": snapshots_rb.get("antes") if snapshots_rb else None,
            "no_foco": chave,
            "status": "info"
        })

        if simulados_rem:
            for s in simulados_rem:
                passos_rb.append({
                    "ordem": len(passos_rb) + 1,
                    "titulo": f"{len(passos_rb) + 1}. {s['titulo']}",
                    "descricao": s["descricao"],
                    "arvore": s["arvore"],
                    "no_foco": s["no_foco"],
                    "status": s["status"]
                })
        else:
            passos_rb.append({
                "ordem": 2,
                "titulo": "2. Conta Encerrada",
                "descricao": f"Conta #{chave} removida. Invariantes de coloração e altura-negra preservadas.",
                "arvore": snapshots_rb.get("final") if snapshots_rb else None,
                "no_foco": None,
                "status": "success"
            })

        passos_rb.append({
            "ordem": len(passos_rb) + 1,
            "titulo": f"{len(passos_rb) + 1}. Árvore Resultante Válida",
            "descricao": "Estrutura resultante após encerramento da conta. Todas as 5 propriedades de Cormen e alturas-negras preservadas.",
            "arvore": snapshots_rb.get("final") if snapshots_rb else None,
            "no_foco": None,
            "status": "success"
        })
        rb_diag["passos"] = passos_rb
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
    passos_simulados_rb = simular_passos_completos_rb(store.rb, conta)
    raiz_unfixed_rb = passos_simulados_rb[0]["arvore"] if passos_simulados_rb else None

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
        "passos_simulados": passos_simulados_rb,
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

    passos_simulados_rb = simular_passos_remocao_rb(store.rb, req.numero_conta)

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
        "passos_simulados": passos_simulados_rb,
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
    for chave, titular, saldo in itens[:-1]:
        conta_pre: Any = ContaBancaria(
            numero_conta=chave,
            titular=titular,
            agencia="0001",
            tipo="Corrente",
            saldo=saldo
        )
        store.avl.inserir(cast(Any, conta_pre))
        store.rb.inserir(cast(Any, conta_pre))

    _ = store.capturar_novos_logs()

    ult_chave, ult_titular, ult_saldo = itens[-1]
    ult_conta: Any = ContaBancaria(
        numero_conta=ult_chave,
        titular=ult_titular,
        agencia="0001",
        tipo="Corrente",
        saldo=ult_saldo
    )

    raiz_antes_avl = serializar_no_avl(store.avl.raiz)
    raiz_antes_rb = serializar_no_rb(store.rb.raiz, store.rb.NIL)
    raiz_unrotated_avl = serializar_no_avl(gerar_arvore_avl_desbalanceada(store.avl.raiz, ult_conta))
    passos_simulados_rb = simular_passos_completos_rb(store.rb, ult_conta)

    store.avl.inserir(cast(Any, ult_conta))
    store.rb.inserir(cast(Any, ult_conta))

    novos_logs = store.capturar_novos_logs()
    raiz_final_avl = serializar_no_avl(store.avl.raiz)
    raiz_final_rb = serializar_no_rb(store.rb.raiz, store.rb.NIL)

    snapshots_avl = {
        "antes": raiz_antes_avl,
        "desbalanceada": raiz_unrotated_avl,
        "final": raiz_final_avl
    }
    snapshots_rb = {
        "antes": raiz_antes_rb,
        "passos_simulados": passos_simulados_rb,
        "final": raiz_final_rb
    }
    diag = extrair_diagnostico_rebalanceamento(
        novos_logs["avl"],
        novos_logs["rb"],
        "PRESET",
        ult_chave,
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

