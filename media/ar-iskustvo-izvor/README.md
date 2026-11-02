# Izvorni materijal za AR animaciju

Renderi stvarnog modela `pizza.glb` (model-viewer), koriste se kao referentne slike za Higgsfield generaciju.
Ne koriste se na sajtu.

## Montaža
- AI kadar: Higgsfield, Seedance 2.5 (`omni_reference`, 1080p, 9:16, 10 s, bez zvuka), generacija `a7c2d2c2-5169-4044-8676-5436cabfdd0c`, 160 kredita.
- `ui-ar.png`: pravi ekran `ar.html?jelo=pizza` (telefon 360×780, sa dugmetom „Dodirni ekran za AR“).
- `ov-*.png`: overlay grafike (okvir skeniranja, link posle skeniranja, tap, oznaka AR · 1:1), pravi ih `overlays.py`.
- `compose.sh ai.mp4 izlaz/`: pravi `ar-iskustvo.mp4`, `.webm` i poster (540×1170, 9:19,5).
