---
title: CardFlip API
emoji: 🃏
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
license: mit
short_description: API de oportunidades de cartas colecionáveis no Brasil
---

# CardFlip API

Backend do CardFlip — agrega oportunidades de compra de cartas (Pokémon, Magic, One Piece, Dragon Ball) do Mercado Livre, MYP Cards e OLX, cruzando com compradores ativos no Instagram e Facebook.

## Rotas

- `GET /` — status
- `GET /api/status` — fontes ativas
- `GET /api/opportunities?category=all&limit=20` — oportunidades rankeadas
- `GET /api/demand?query=charizard` — compradores ativos
- `GET /api/search?q=charizard&game=pokemon` — busca específica
