# 🏦 Sistema Bancário — Visualizador Interativo de Árvores Balanceadas

Interface gráfica web de alta fidelidade desenvolvida para a **Defesa Prática do Trabalho Prático I** da disciplina de **Algoritmos e Estruturas de Dados II (AED II)** — UFAM / ICET (Prof. Alternei Brito).

---

## 🏛️ Integridade Acadêmica e Arquitetura Desacoplada

Este projeto implementa uma **Arquitetura Desacoplada** entre o motor algorítmico e a camada de apresentação visual:

* **Backend Original (Core Engine):** Utiliza um **Git Submodule** (`backend_original`) apontando estritamente para o commit congelado da entrega oficial do trabalho (`https://github.com/SeverinoSouzaa/sistema-bancario-arvores`). Nenhuma linha de algoritmo foi alterada pós-prazo.
* **Camada de Apresentação (API & Frontend):** 
  * **FastAPI:** Orquestra a execução síncrona das árvores AVL e Rubro-Negra, serializando as estruturas e capturando logs diagnósticos passo a passo em tempo real.
  * **React 19 + Tailwind CSS + Lucide Icons:** Renderizador vetorial SVG interativo com cálculo geométrico de coordenadas de árvores binárias.

---

## 👥 Equipe
* **Fran Robson de Souza**
* **Jenner Lucas Carneiro**
* **Raul Berger**
* **Severino de Souza**

---

## ⚡ Como Executar em 1 Passo (Zero Complicação)

O frontend React já está pré-compilado na pasta `frontend/dist`. Qualquer integrante da equipe ou o professor só precisa do Python instalado:

### 1. Clonar com os Submódulos
```bash
git clone --recursive https://github.com/SeverinoSouzaa/sistema-bancario-web.git
cd sistema-bancario-web
```
*(Se você clonou sem `--recursive`, execute: `git submodule update --init --recursive`)*

### 2. Instalar Dependências do Backend
```bash
pip install fastapi uvicorn
```

### 3. Iniciar a Aplicação
```bash
python app.py
```
> O sistema iniciará o servidor na porta `8000` e **abrirá automaticamente o navegador** em `http://localhost:8000` com a interface visual pronta para uso!

---

## 🎯 Armas Secretas para a Apresentação (Cenários Pré-Programados)

Na barra superior da interface, foram integrados **botões rápidos de cenários demonstrativos** para a defesa com a banca:

1. **Pior Caso ABB (10001..10006):** Demonstra como 6 contas inseridas em ordem crescente forçam rotações sucessivas na AVL e reestruturações com recolorações na Rubro-Negra.
2. **Caso 1 Cormen (Tio Vermelho):** Demonstra visualmente a resolução de conflito vermelho-vermelho via recoloração pura (sem nenhuma rotação).
3. **Rotação Dupla (Zigue-Zague):** Demonstra o desequilíbrio LR/RL e a rotação dupla de alinhamento.
4. **Remoção Grau 2 (Sucessor em-ordem):** Remove um nó interno e mostra a cópia do sucessor em-ordem para preservar a propriedade de busca.

---

## 🛠️ Modo de Desenvolvimento (Opcional)

Se desejar alterar os componentes React em tempo real com Hot Module Replacement (HMR):

```bash
# Terminal 1: Backend
python app.py

# Terminal 2: Frontend
cd frontend
npm run dev
```
Acesse `http://localhost:5173`.
