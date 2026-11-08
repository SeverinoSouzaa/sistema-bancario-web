import uvicorn
import webbrowser
import threading
import time
import os
import sys

from backend.server import app

def abrir_navegador():
    time.sleep(1.2)
    dist_path = os.path.join(os.path.dirname(__file__), "frontend", "dist", "index.html")
    if os.path.exists(dist_path):
        webbrowser.open("http://localhost:8000")
    else:
        print("\n[Aviso] Modo de Desenvolvimento Detectado:")
        print("  - Backend FastAPI rodando em: http://localhost:8000")
        print("  - Frontend Vite rodando em   : http://localhost:5173\n")
        webbrowser.open("http://localhost:5173")

if __name__ == "__main__":
    porta = int(os.environ.get("PORT", 8000))
    print("=" * 70)
    print("  🏦 SISTEMA BANCÁRIO - VISUALIZADOR DE ÁRVORES BALANCEADAS (AED II)")
    print(f"  Inicializando servidor de alta fidelidade na porta {porta}...")
    print("=" * 70)

    # Inicia abertura do navegador em background
    threading.Thread(target=abrir_navegador, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=porta)
