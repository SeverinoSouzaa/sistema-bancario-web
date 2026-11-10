import sys
import os
import re
import time
import copy
import io
import contextlib
import tempfile
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
    from experimentos import (  # type: ignore
        gerar_contas_crescentes,
        gerar_contas_aleatorias,
        executar_experimento_crescente,
        executar_experimentos_completos,
        imprimir_tabela_1_formatada,
        imprimir_detalhes_cenario,
        imprimir_quadro_metricas,
        salvar_resultados_csv,
        salvar_relatorio_markdown,
    )
except ImportError:
    from backend_original.modelos import ContaBancaria, Cor, NoAVL, NoRB  # type: ignore
    from backend_original.avl import ArvoreAVL  # type: ignore
    from backend_original.rubro_negra import ArvoreRubroNegra  # type: ignore
    from backend_original.experimentos import (  # type: ignore
        gerar_contas_crescentes,
        gerar_contas_aleatorias,
        executar_experimento_crescente,
        executar_experimentos_completos,
        imprimir_tabela_1_formatada,
        imprimir_detalhes_cenario,
        imprimir_quadro_metricas,
        salvar_resultados_csv,
        salvar_relatorio_markdown,
    )

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


def simular_passos_completos_avl(avl_store: Any, conta: Any) -> Dict[str, Any]:
    """
    Simula com precisão cirúrgica a inserção AVL passo a passo para capturar:
    - antes: árvore original antes da operação
    - desbalanceada: árvore com o nó inserido via BST pura (com alturas/FB atualizados), revelando o ponto crítico
    - passo1: no caso de rotação dupla (LR ou RL), o estado intermediário após a rotação simples no filho (alinhamento em LL/RR)
    - final: árvore resultante após rotação final e rebalanceamento
    - caso: "CASO LL", "CASO RR", "CASO LR", "CASO RL" ou None
    - no_desbalanceado, fb_detectado, filho, no_promovido
    """
    criar_no_avl: Any = NoAVL
    if avl_store.raiz is None:
        novo = criar_no_avl(cast(Any, conta))
        snap = serializar_no_avl(novo)
        return {
            "antes": None,
            "desbalanceada": snap,
            "passo1": None,
            "final": snap,
            "caso": None,
            "no_desbalanceado": None,
            "fb_detectado": None,
            "filho": None,
            "no_promovido": None
        }

    def _recalcular_alturas(no: Any) -> int:
        if no is None:
            return -1
        _recalcular_alturas(no.esquerda)
        _recalcular_alturas(no.direita)
        no.atualizar_altura()
        return no.altura

    # 1. Inserção BST tradicional pura (sem rotações) para registrar a violação exata
    def _ins_bst(no: Any) -> Any:
        if no is None:
            return criar_no_avl(cast(Any, conta))
        if conta.numero_conta < no.chave:
            no.esquerda = _ins_bst(no.esquerda)
        elif conta.numero_conta > no.chave:
            no.direita = _ins_bst(no.direita)
        no.atualizar_altura()
        return no

    raiz_copia_desb = copy.deepcopy(avl_store.raiz)
    raiz_desb_obj = _ins_bst(raiz_copia_desb)
    _recalcular_alturas(raiz_desb_obj)
    desbalanceada_snap = serializar_no_avl(raiz_desb_obj)

    # 2. Simulação passo a passo capturando passo1 para rotações duplas (LR e RL)
    raiz_passo1_snap: Optional[Dict[str, Any]] = None
    caso_detectado: Optional[str] = None
    no_desb: Optional[int] = None
    fb_desb: Optional[int] = None
    no_prom: Optional[int] = None
    filho_info: Optional[Dict[str, Any]] = None

    tree_container = {"root": copy.deepcopy(raiz_desb_obj)}

    def _sim_rec(no: Any) -> Any:
        nonlocal raiz_passo1_snap, caso_detectado, no_desb, fb_desb, no_prom, filho_info
        if no is None:
            return None
        if conta.numero_conta < no.chave:
            no.esquerda = _sim_rec(no.esquerda)
        elif conta.numero_conta > no.chave:
            no.direita = _sim_rec(no.direita)

        no.atualizar_altura()
        fb = no.fator_balanceamento

        if fb > 1:
            no_desb = no.chave
            fb_desb = fb
            if no.esquerda is not None and no.esquerda.fator_balanceamento >= 0:
                caso_detectado = "CASO LL"
                k2 = no
                k1 = k2.esquerda
                no_prom = k1.chave
                k2.esquerda = k1.direita
                k1.direita = k2
                k2.atualizar_altura()
                k1.atualizar_altura()
                return k1
            else:
                caso_detectado = "CASO LR"
                k3 = no
                k1 = k3.esquerda
                k2 = k1.direita
                no_prom = k2.chave
                filho_info = {"lado": "Esquerdo", "chave": k1.chave, "fb": k1.fator_balanceamento}

                # Passo 1 da rotação dupla: rotação simples à esquerda no filho k1
                k1.direita = k2.esquerda
                k2.esquerda = k1
                k1.atualizar_altura()
                k2.atualizar_altura()
                k3.esquerda = k2
                k3.atualizar_altura()

                # Captura estado intermediário alinhado em LL
                _recalcular_alturas(tree_container["root"])
                raiz_passo1_snap = serializar_no_avl(tree_container["root"])

                # Passo 2 da rotação dupla: rotação simples à direita no ancestral k3
                k3.esquerda = k2.direita
                k2.direita = k3
                k3.atualizar_altura()
                k2.atualizar_altura()
                return k2
        elif fb < -1:
            no_desb = no.chave
            fb_desb = fb
            if no.direita is not None and no.direita.fator_balanceamento <= 0:
                caso_detectado = "CASO RR"
                k1 = no
                k2 = k1.direita
                no_prom = k2.chave
                k1.direita = k2.esquerda
                k2.esquerda = k1
                k1.atualizar_altura()
                k2.atualizar_altura()
                return k2
            else:
                caso_detectado = "CASO RL"
                k1 = no
                k3 = k1.direita
                k2 = k3.esquerda
                no_prom = k2.chave
                filho_info = {"lado": "Direito", "chave": k3.chave, "fb": k3.fator_balanceamento}

                # Passo 1 da rotação dupla: rotação simples à direita no filho k3
                k3.esquerda = k2.direita
                k2.direita = k3
                k3.atualizar_altura()
                k2.atualizar_altura()
                k1.direita = k2
                k1.atualizar_altura()

                # Captura estado intermediário alinhado em RR
                _recalcular_alturas(tree_container["root"])
                raiz_passo1_snap = serializar_no_avl(tree_container["root"])

                # Passo 2 da rotação dupla: rotação simples à esquerda no ancestral k1
                k1.direita = k2.esquerda
                k2.esquerda = k1
                k1.atualizar_altura()
                k2.atualizar_altura()
                return k2
        return no

    tree_container["root"] = _sim_rec(tree_container["root"])
    _recalcular_alturas(tree_container["root"])
    final_snap = serializar_no_avl(tree_container["root"])

    return {
        "antes": serializar_no_avl(avl_store.raiz),
        "desbalanceada": desbalanceada_snap,
        "passo1": raiz_passo1_snap,
        "final": final_snap,
        "caso": caso_detectado,
        "no_desbalanceado": no_desb,
        "fb_detectado": fb_desb,
        "filho": filho_info,
        "no_promovido": no_prom
    }


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
        elif "CASO LR" in avl_diag["caso"]:
            avl_diag["tipo_rotacao"] = "Rotação Dupla Esquerda-Direita (LR)"
        elif "CASO RL" in avl_diag["caso"]:
            avl_diag["tipo_rotacao"] = "Rotação Dupla Direita-Esquerda (RL)"

        m_prom = re.search(r"Nova raiz local promovida:\s*No \((\d+)\)", texto_avl)
        if m_prom:
            avl_diag["no_promovido"] = int(m_prom.group(1))
        else:
            m_prom_double = re.search(r"Promove No \((\d+)\)", texto_avl)
            if m_prom_double:
                avl_diag["no_promovido"] = int(m_prom_double.group(1))

        # Informações detalhadas do filho crítico
        m_filho = re.search(r"\*\s*Filho\s+(Esquerdo|Direito)\s+\((\d+)\)\s+com\s+FB=([+-]?\d+)", texto_avl)
        filho_lado = m_filho.group(1) if m_filho else None
        filho_chave = int(m_filho.group(2)) if m_filho else None
        filho_fb = m_filho.group(3) if m_filho else None
        if filho_chave is not None:
            avl_diag["filho"] = {
                "lado": filho_lado,
                "chave": filho_chave,
                "fb": filho_fb
            }

        # Fallbacks dos snapshots simulados se necessários
        if avl_diag["no_desbalanceado"] is None and snapshots_avl and snapshots_avl.get("no_desbalanceado"):
            avl_diag["no_desbalanceado"] = snapshots_avl["no_desbalanceado"]
            avl_diag["fb_detectado"] = str(snapshots_avl.get("fb_detectado") or "+2")
        if avl_diag["no_promovido"] is None and snapshots_avl and snapshots_avl.get("no_promovido"):
            avl_diag["no_promovido"] = snapshots_avl["no_promovido"]
        if avl_diag["filho"] is None and snapshots_avl and snapshots_avl.get("filho"):
            avl_diag["filho"] = snapshots_avl["filho"]
            if not filho_chave and avl_diag["filho"]:
                filho_chave = avl_diag["filho"].get("chave")
                filho_lado = avl_diag["filho"].get("lado")
                filho_fb = avl_diag["filho"].get("fb")

        passos_avl: List[Dict[str, Any]] = []
        is_dupla = "CASO LR" in avl_diag["caso"] or "CASO RL" in avl_diag["caso"]

        if is_dupla:
            # 5 Passos Didáticos para Rotação Dupla (LR / RL)
            # Passo 1: Estado Inicial
            passos_avl.append({
                "ordem": 1,
                "titulo": "1. Árvore Inicial",
                "descricao": f"Estrutura da AVL estável antes da inserção da Conta #{chave}.",
                "arvore": snapshots_avl.get("antes") if snapshots_avl else None,
                "no_foco": None,
                "status": "info"
            })

            # Passo 2: Inserção do Nó & Desbalanceamento Crítico
            lado_str = f"filho {filho_lado.lower()} #{filho_chave}" if (filho_lado and filho_chave) else "filho"
            fb_filho_str = f" com FB={filho_fb}" if filho_fb else ""
            desc_p2 = (
                f"Ao inserir a Conta #{chave}, o nó ancestral #{avl_diag['no_desbalanceado']} atingiu "
                f"FB={avl_diag['fb_detectado']} (|FB| ≥ 2) e seu {lado_str}{fb_filho_str} possui sinal oposto, "
                f"formando o zigue-zague característico do {avl_diag['caso']}. Necessita de rotação dupla em duas etapas."
            )
            passos_avl.append({
                "ordem": 2,
                "titulo": "2. Inserção & Desbalanceamento",
                "descricao": desc_p2,
                "arvore": snapshots_avl.get("desbalanceada") if snapshots_avl else None,
                "no_foco": avl_diag["no_desbalanceado"],
                "status": "warning"
            })

            # Passo 3: Rotação no Filho (Alinhamento em Linha Reta)
            if "CASO LR" in avl_diag["caso"]:
                desc_p3 = (
                    f"Passo 1 da Rotação Dupla: Rotação simples à esquerda no filho #{filho_chave}. "
                    f"A subárvore é alinhada da configuração zigue-zague (LR) para uma linha reta contínua (Caso LL), "
                    f"posicionando o nó #{avl_diag['no_promovido']} como filho esquerdo de #{avl_diag['no_desbalanceado']}."
                )
            else:
                desc_p3 = (
                    f"Passo 1 da Rotação Dupla: Rotação simples à direita no filho #{filho_chave}. "
                    f"A subárvore é alinhada da configuração zigue-zague (RL) para uma linha reta contínua (Caso RR), "
                    f"posicionando o nó #{avl_diag['no_promovido']} como filho direito de #{avl_diag['no_desbalanceado']}."
                )
            arv_p3 = snapshots_avl.get("passo1") if (snapshots_avl and snapshots_avl.get("passo1")) else (snapshots_avl.get("final") if snapshots_avl else None)
            passos_avl.append({
                "ordem": 3,
                "titulo": "3. Rotação no Filho (Alinhamento)",
                "descricao": desc_p3,
                "arvore": arv_p3,
                "no_foco": avl_diag["no_promovido"] or filho_chave,
                "status": "warning"
            })

            # Passo 4: Rotação no Ancestral (Balanceamento Definitivo)
            if "CASO LR" in avl_diag["caso"]:
                desc_p4 = (
                    f"Passo 2 da Rotação Dupla: Rotação simples à direita no nó ancestral #{avl_diag['no_desbalanceado']}. "
                    f"O nó #{avl_diag['no_promovido']} assume definitivamente a raiz local, equilibrando ambas as subárvores e reduzindo a altura."
                )
            else:
                desc_p4 = (
                    f"Passo 2 da Rotação Dupla: Rotação simples à esquerda no nó ancestral #{avl_diag['no_desbalanceado']}. "
                    f"O nó #{avl_diag['no_promovido']} assume definitivamente a raiz local, equilibrando ambas as subárvores e reduzindo a altura."
                )
            passos_avl.append({
                "ordem": 4,
                "titulo": "4. Rotação no Ancestral (Balanceamento)",
                "descricao": desc_p4,
                "arvore": snapshots_avl.get("final") if snapshots_avl else None,
                "no_foco": avl_diag["no_promovido"],
                "status": "success"
            })

            # Passo 5: Árvore Resultante Equilibrada
            passos_avl.append({
                "ordem": 5,
                "titulo": "5. Árvore Resultante Equilibrada",
                "descricao": "Recálculo de alturas concluído com sucesso. Todos os nós da árvore satisfazem rigorosamente a invariante AVL (|FB| ≤ 1).",
                "arvore": snapshots_avl.get("final") if snapshots_avl else None,
                "no_foco": None,
                "status": "success"
            })
        else:
            # 4 Passos para Rotação Simples (LL / RR)
            passos_avl.append({
                "ordem": 1,
                "titulo": "1. Árvore Inicial",
                "descricao": f"Estrutura da AVL estável antes da inserção da Conta #{chave}.",
                "arvore": snapshots_avl.get("antes") if snapshots_avl else None,
                "no_foco": None,
                "status": "info"
            })

            passos_avl.append({
                "ordem": 2,
                "titulo": "2. Inserção & Desbalanceamento",
                "descricao": f"Ao inserir a Conta #{chave}, o nó ancestral #{avl_diag['no_desbalanceado']} atingiu FB={avl_diag['fb_detectado']} (|FB| ≥ 2). Configura-se o {avl_diag['caso']}, necessitando de {avl_diag['tipo_rotacao']}.",
                "arvore": snapshots_avl.get("desbalanceada") if snapshots_avl else None,
                "no_foco": avl_diag["no_desbalanceado"],
                "status": "warning"
            })

            passos_avl.append({
                "ordem": 3,
                "titulo": "3. Rebalanceamento por Rotação",
                "descricao": f"{avl_diag['tipo_rotacao']} executada. O nó #{avl_diag['no_promovido']} assume a posição de nova raiz local, reduzindo a altura e equilibrando as subárvores.",
                "arvore": snapshots_avl.get("final") if snapshots_avl else None,
                "no_foco": avl_diag["no_promovido"],
                "status": "success"
            })

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
    # 1. Validação prévia de duplicidade: rejeita imediatamente sem alterar estados ou diagnósticos
    if store.avl.buscar(req.numero_conta) is not None or store.rb.buscar(req.numero_conta) is not None:
        raise HTTPException(
            status_code=400,
            detail=f"A Conta #{req.numero_conta} já existe no cadastro bancário. Não são permitidas contas com numeração duplicada."
        )

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

    # Simulações de passos detalhados para AVL e Rubro-Negra
    passos_simulados_avl = simular_passos_completos_avl(store.avl, conta)
    passos_simulados_rb = simular_passos_completos_rb(store.rb, conta)
    raiz_unfixed_rb = passos_simulados_rb[0]["arvore"] if passos_simulados_rb else None

    sucesso_avl: bool = bool(store.avl.inserir(cast(Any, conta)))
    sucesso_rb: bool = bool(store.rb.inserir(cast(Any, conta)))

    if not sucesso_avl and not sucesso_rb:
        raise HTTPException(
            status_code=400,
            detail=f"Não foi possível inserir a Conta #{req.numero_conta}."
        )

    raiz_final_avl = serializar_no_avl(store.avl.raiz)
    raiz_final_rb = serializar_no_rb(store.rb.raiz, store.rb.NIL)

    novos_logs = store.capturar_novos_logs()

    snapshots_avl = {
        "antes": raiz_antes_avl,
        "desbalanceada": passos_simulados_avl.get("desbalanceada"),
        "passo1": passos_simulados_avl.get("passo1"),
        "final": raiz_final_avl,
        "no_desbalanceado": passos_simulados_avl.get("no_desbalanceado"),
        "fb_detectado": passos_simulados_avl.get("fb_detectado"),
        "filho": passos_simulados_avl.get("filho"),
        "no_promovido": passos_simulados_avl.get("no_promovido")
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

    registro_op = {
        "tipo": "INSERCAO",
        "chave": req.numero_conta,
        "titular": nome_titular,
        "detalhes": f"Conta #{req.numero_conta} cadastrada com sucesso.",
        "logs": novos_logs,
        "diagnostico": diag
    }
    store.historico_operacoes.append(registro_op)

    return {
        "sucesso": True,
        "mensagem": f"Conta #{req.numero_conta} inserida com sucesso em ambas as árvores.",
        "logs": novos_logs,
        "diagnostico": diag,
        "dados": obter_estado_completo()
    }


@app.post("/api/remover")
def rota_remover_conta(req: OperacaoChaveRequest):
    # 1. Validação prévia de existência: rejeita imediatamente se a conta não existir
    conta_avl = store.avl.buscar(req.numero_conta)
    conta_rb = store.rb.buscar(req.numero_conta)

    if conta_avl is None and conta_rb is None:
        raise HTTPException(
            status_code=404,
            detail=f"A Conta #{req.numero_conta} não consta no cadastro bancário para encerramento."
        )

    # 2. Captura snapshots estruturais antes da alteração
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

    titular = rem_avl.titular if rem_avl else (rem_rb.titular if rem_rb else "Desconhecido")
    registro_op = {
        "tipo": "REMOCAO",
        "chave": req.numero_conta,
        "titular": titular,
        "detalhes": f"Conta #{req.numero_conta} removida com sucesso.",
        "logs": novos_logs,
        "diagnostico": diag
    }
    store.historico_operacoes.append(registro_op)

    return {
        "sucesso": True,
        "mensagem": f"Conta #{req.numero_conta} ({titular}) encerrada com sucesso.",
        "logs": novos_logs,
        "diagnostico": diag,
        "dados": obter_estado_completo()
    }


def rastrear_busca_avl(avl: ArvoreAVL, numero_conta: int) -> Dict[str, Any]:
    caminho: List[Dict[str, Any]] = []
    atual = avl.raiz
    passo = 1
    encontrado = False
    conta_encontrada: Optional[ContaBancaria] = None

    nos_antes = avl.estatisticas.nos_visitados
    comp_antes = avl.estatisticas.comparacoes

    while atual is not None:
        avl.estatisticas.comparacoes += 1
        avl.estatisticas.nos_visitados += 1

        fb = atual.fator_balanceamento
        alt = atual.altura
        chave_atual = atual.chave
        titular_atual = atual.conta.titular if atual.conta else f"Conta {chave_atual}"
        saldo_atual = float(atual.conta.saldo) if atual.conta else 0.0

        if numero_conta == chave_atual:
            encontrado = True
            conta_encontrada = atual.conta
            caminho.append({
                "passo": passo,
                "chave": chave_atual,
                "titular": titular_atual,
                "saldo": saldo_atual,
                "fb": fb,
                "altura_subarvore": alt,
                "direcao": "LOCALIZADO",
                "comparacao": f"Chave #{numero_conta} == #{chave_atual} (Registro localizado com sucesso)",
                "status": "sucesso"
            })
            break
        elif numero_conta < chave_atual:
            caminho.append({
                "passo": passo,
                "chave": chave_atual,
                "titular": titular_atual,
                "saldo": saldo_atual,
                "fb": fb,
                "altura_subarvore": alt,
                "direcao": "ESQUERDA",
                "comparacao": f"Chave #{numero_conta} < #{chave_atual} → Descer para Subárvore Esquerda",
                "status": "descendo"
            })
            atual = atual.esquerda
        else:
            caminho.append({
                "passo": passo,
                "chave": chave_atual,
                "titular": titular_atual,
                "saldo": saldo_atual,
                "fb": fb,
                "altura_subarvore": alt,
                "direcao": "DIREITA",
                "comparacao": f"Chave #{numero_conta} > #{chave_atual} → Descer para Subárvore Direita",
                "status": "descendo"
            })
            atual = atual.direita
        passo += 1

    if not encontrado:
        caminho.append({
            "passo": passo,
            "chave": "NULL",
            "titular": "Ponteiro Nulo",
            "saldo": 0.0,
            "fb": 0,
            "altura_subarvore": 0,
            "direcao": "FIM",
            "comparacao": f"Ponteiro nulo atingido → Chave #{numero_conta} inexiste na Árvore AVL",
            "status": "inexistente"
        })

    custo_nos = avl.estatisticas.nos_visitados - nos_antes
    custo_comp = avl.estatisticas.comparacoes - comp_antes

    return {
        "encontrado": encontrado,
        "conta": conta_encontrada,
        "custo_nos_visitados": custo_nos,
        "comparacoes": custo_comp,
        "profundidade": len(caminho) - (0 if encontrado else 1),
        "altura_arvore": avl.altura,
        "total_nos": avl.tamanho,
        "caminho": caminho
    }


def rastrear_busca_rb(rb: ArvoreRubroNegra, numero_conta: int) -> Dict[str, Any]:
    caminho: List[Dict[str, Any]] = []
    atual = rb.raiz
    passo = 1
    encontrado = False
    conta_encontrada: Optional[ContaBancaria] = None

    nos_antes = rb.estatisticas.nos_visitados
    comp_antes = rb.estatisticas.comparacoes

    while atual != rb.NIL and atual is not None:
        chave_atual = atual.chave
        if chave_atual is None:
            break

        rb.estatisticas.comparacoes += 1
        rb.estatisticas.nos_visitados += 1

        cor_nome = "PRETO" if atual.cor == Cor.PRETO else "VERMELHO"
        titular_atual = atual.conta.titular if atual.conta else f"Conta {chave_atual}"
        saldo_atual = float(atual.conta.saldo) if atual.conta else 0.0

        if numero_conta == chave_atual:
            encontrado = True
            conta_encontrada = atual.conta
            caminho.append({
                "passo": passo,
                "chave": chave_atual,
                "titular": titular_atual,
                "saldo": saldo_atual,
                "cor": cor_nome,
                "direcao": "LOCALIZADO",
                "comparacao": f"Chave #{numero_conta} == #{chave_atual} (Registro localizado com sucesso)",
                "status": "sucesso"
            })
            break
        elif numero_conta < chave_atual:
            caminho.append({
                "passo": passo,
                "chave": chave_atual,
                "titular": titular_atual,
                "saldo": saldo_atual,
                "cor": cor_nome,
                "direcao": "ESQUERDA",
                "comparacao": f"Chave #{numero_conta} < #{chave_atual} → Descer para Subárvore Esquerda",
                "status": "descendo"
            })
            atual = atual.esquerda
        else:
            caminho.append({
                "passo": passo,
                "chave": chave_atual,
                "titular": titular_atual,
                "saldo": saldo_atual,
                "cor": cor_nome,
                "direcao": "DIREITA",
                "comparacao": f"Chave #{numero_conta} > #{chave_atual} → Descer para Subárvore Direita",
                "status": "descendo"
            })
            atual = atual.direita
        passo += 1

    if not encontrado:
        caminho.append({
            "passo": passo,
            "chave": "NIL",
            "titular": "Sentinela NIL",
            "saldo": 0.0,
            "cor": "PRETO",
            "direcao": "FIM",
            "comparacao": f"Sentinela NIL atingido → Chave #{numero_conta} inexiste na Árvore Rubro-Negra",
            "status": "inexistente"
        })

    custo_nos = rb.estatisticas.nos_visitados - nos_antes
    custo_comp = rb.estatisticas.comparacoes - comp_antes

    return {
        "encontrado": encontrado,
        "conta": conta_encontrada,
        "custo_nos_visitados": custo_nos,
        "comparacoes": custo_comp,
        "profundidade": len(caminho) - (0 if encontrado else 1),
        "altura_arvore": rb.altura,
        "altura_negra": rb.calcular_altura_negra(),
        "total_nos": rb.tamanho,
        "caminho": caminho
    }


@app.post("/api/buscar")
def rota_buscar_conta(req: OperacaoChaveRequest):
    rastreio_avl = rastrear_busca_avl(store.avl, req.numero_conta)
    rastreio_rb = rastrear_busca_rb(store.rb, req.numero_conta)

    c = rastreio_avl["conta"] if rastreio_avl["conta"] is not None else rastreio_rb["conta"]
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

    custo_avl = rastreio_avl["custo_nos_visitados"]
    custo_rb = rastreio_rb["custo_nos_visitados"]
    dif = custo_avl - custo_rb

    if dif == 0:
        resumo_comp = f"Paridade de Custo: Ambas as árvores visitaram exatamente {custo_avl} nó(s) no trajeto."
    elif dif < 0:
        resumo_comp = f"Árvore AVL foi mais econômica: visitou {abs(dif)} nó(s) a menos devido à restrição rígida de altura (|FB| ≤ 1)."
    else:
        resumo_comp = f"Árvore Rubro-Negra visitou {dif} nó(s) a menos no trajeto desta consulta."

    return {
        "sucesso": True,
        "encontrada": encontrada,
        "numero_buscado": req.numero_conta,
        "conta": conta_info,
        "mensagem": f"Conta #{req.numero_conta} " + ("localizada com sucesso no sistema." if encontrada else "não consta no cadastro bancário."),
        "avl": {
            "encontrado": rastreio_avl["encontrado"],
            "custo_nos_visitados": rastreio_avl["custo_nos_visitados"],
            "comparacoes": rastreio_avl["comparacoes"],
            "profundidade": rastreio_avl["profundidade"],
            "altura_arvore": rastreio_avl["altura_arvore"],
            "total_nos": rastreio_avl["total_nos"],
            "caminho": rastreio_avl["caminho"]
        },
        "rubro_negra": {
            "encontrado": rastreio_rb["encontrado"],
            "custo_nos_visitados": rastreio_rb["custo_nos_visitados"],
            "comparacoes": rastreio_rb["comparacoes"],
            "profundidade": rastreio_rb["profundidade"],
            "altura_arvore": rastreio_rb["altura_arvore"],
            "altura_negra": rastreio_rb["altura_negra"],
            "total_nos": rastreio_rb["total_nos"],
            "caminho": rastreio_rb["caminho"]
        },
        "comparativo": {
            "diferenca_nos": dif,
            "mesmo_custo": dif == 0,
            "resumo": resumo_comp,
            "complexidade_teorica": "O(log n)"
        }
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
    passos_simulados_avl = simular_passos_completos_avl(store.avl, ult_conta)
    passos_simulados_rb = simular_passos_completos_rb(store.rb, ult_conta)

    store.avl.inserir(cast(Any, ult_conta))
    store.rb.inserir(cast(Any, ult_conta))

    novos_logs = store.capturar_novos_logs()
    raiz_final_avl = serializar_no_avl(store.avl.raiz)
    raiz_final_rb = serializar_no_rb(store.rb.raiz, store.rb.NIL)

    snapshots_avl = {
        "antes": raiz_antes_avl,
        "desbalanceada": passos_simulados_avl.get("desbalanceada"),
        "passo1": passos_simulados_avl.get("passo1"),
        "final": raiz_final_avl,
        "no_desbalanceado": passos_simulados_avl.get("no_desbalanceado"),
        "fb_detectado": passos_simulados_avl.get("fb_detectado"),
        "filho": passos_simulados_avl.get("filho"),
        "no_promovido": passos_simulados_avl.get("no_promovido")
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


class ExperimentoRequest(BaseModel):
    n: int = Field(..., gt=0, description="Tamanho N da amostra")
    cenario: str = Field("ambos", description="'ambos', 'aleatorio' ou 'crescente'")
    semente: int = Field(42, description="Semente determinística")


class ExportarExperimentoRequest(BaseModel):
    formato: str = Field("csv", description="'csv' ou 'markdown'")
    resultados: List[Dict[str, Any]] = Field(..., description="Lista de resultados das baterias")


@app.post("/api/experimentos/executar")
def api_executar_experimento(req: ExperimentoRequest):
    try:
        n = req.n
        semente = req.semente
        cenario = req.cenario.lower()

        res_crescente = None
        res_aleatorio = None

        if cenario in ("ambos", "crescente"):
            res_crescente = executar_experimento_crescente(n, semente=semente)
        if cenario in ("ambos", "aleatorio"):
            res_aleatorio = executar_experimentos_completos(n, semente=semente)

        # Captura da saída formatada do terminal idêntica à função de impressão oficial
        buf = io.StringIO()
        if res_aleatorio is not None and res_crescente is not None:
            with contextlib.redirect_stdout(buf):
                imprimir_tabela_1_formatada(res_aleatorio, res_crescente)
        elif res_aleatorio is not None:
            with contextlib.redirect_stdout(buf):
                imprimir_tabela_1_formatada(res_aleatorio, None)
        elif res_crescente is not None:
            with contextlib.redirect_stdout(buf):
                imprimir_detalhes_cenario(res_crescente, 1, "CENARIO EM ORDEM CRESCENTE (PIOR CASO ABB)", eh_crescente=True)
                imprimir_quadro_metricas(res_crescente, "TABELA 2: METRICAS CONSOLIDADAS (ORDEM CRESCENTE - PIOR CASO ABB)")

        saida_terminal = buf.getvalue()

        return {
            "sucesso": True,
            "n": n,
            "semente": semente,
            "res_crescente": res_crescente,
            "res_aleatorio": res_aleatorio,
            "saida_terminal": saida_terminal
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao executar benchmark para N={req.n}: {str(e)}")


@app.post("/api/experimentos/exportar")
def api_exportar_experimento(req: ExportarExperimentoRequest):
    try:
        formato = req.formato.lower()
        resultados = req.resultados

        if not resultados:
            raise HTTPException(status_code=400, detail="Nenhum resultado fornecido para exportação.")

        if formato == "csv":
            with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
                tmp_path = tmp.name
            try:
                salvar_resultados_csv(resultados, tmp_path)
                with open(tmp_path, "r", encoding="utf-8") as f:
                    conteudo = f.read()
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            nome_arquivo = "resultados_experimentos.csv"
            mimetype = "text/csv"

        elif formato in ("markdown", "md"):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".md") as tmp:
                tmp_path = tmp.name
            try:
                salvar_relatorio_markdown(resultados, tmp_path)
                with open(tmp_path, "r", encoding="utf-8") as f:
                    conteudo = f.read()
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            nome_arquivo = "resultados_experimentos.md"
            mimetype = "text/markdown"

        else:
            raise HTTPException(status_code=400, detail="Formato não suportado. Use 'csv' ou 'markdown'.")

        return {
            "sucesso": True,
            "formato": formato,
            "nome_arquivo": nome_arquivo,
            "mimetype": mimetype,
            "conteudo": conteudo
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao exportar resultados: {str(e)}")


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

