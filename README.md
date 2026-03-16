# CardFlip 🃏 v2.0
> Caça-Oportunidades de Cartas Colecionáveis no Brasil

Agrega **oferta** (vendedores) e **demanda** (compradores) de múltiplas fontes,
calcula um score de oportunidade automático e ranqueia os melhores negócios.

---

## Fontes de Dados

### OFERTA — onde estão vendendo
| Fonte | Integração | Status |
|---|---|---|
| Mercado Livre | API oficial (Client Credentials) | ✅ Pronto |
| MYP Cards | API pública (`api.mypcards.com`) | ✅ Pronto |
| OLX | Manus agent (sem API) | ✅ Pronto (requer MANUS_API_KEY) |

### DEMANDA — quem quer comprar
| Fonte | Integração | Status |
|---|---|---|
| MYP Cards (pastas virtuais) | API pública `/wishlists/public` | ✅ Pronto |
| Instagram (hashtags WTB) | Manus agent | ✅ Pronto (requer MANUS_API_KEY) |
| Facebook Grupos TCG | Manus agent | ✅ Pronto (requer MANUS_API_KEY) |

### PREÇO DE REFERÊNCIA
| Fonte | Uso |
|---|---|
| MYP Cards `/products/price` | Preço médio BR (prioridade) |
| TCGPlayer API | Preço USD → BRL (fallback) |
| Tabela local hardcoded | Fallback offline |

---

## Estrutura

```
cardflip/
├── backend/
│   ├── index.js                  ← API Express (rotas)
│   ├── services/
│   │   ├── mercadolivre.js       ← busca ML + token automático
│   │   ├── mypcards.js           ← listagens + wishlists MYP Cards
│   │   ├── manus.js              ← OLX + Instagram + Facebook via Manus
│   │   ├── demand.js             ← agrega todas as fontes de demanda
│   │   └── prices.js             ← preço de referência (MYP + TCGPlayer)
│   └── .env                      ← credenciais (já preenchidas)
└── frontend/
    └── src/
        ├── app/page.js           ← página principal
        ├── components/OpportunityCard.jsx
        └── lib/api.js            ← cliente HTTP
```

---

## Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/status` | Status de cada fonte |
| GET | `/api/opportunities?category=all&limit=20` | Oportunidades rankeadas |
| GET | `/api/opportunities?sources=MYP` | Filtrar por fonte |
| GET | `/api/demand?query=charizard` | Compradores ativos |
| GET | `/api/search?q=charizard&game=pokemon` | Busca específica |
| GET | `/callback?code=...` | OAuth callback ML |

---

## Rodando Localmente

```bash
# Terminal 1 — backend
cd cardflip/backend
npm install
npm run dev

# Saída esperada:
# 🃏 CardFlip API v2.0 rodando na porta 4000
#    ML:        ✅
#    MYP Cards: ✅ (pública)
#    Manus:     ✅ (OLX + Instagram + Facebook)

# Terminal 2 — frontend
cd cardflip/frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Deploy em Produção

### Backend → Render.com (gratuito)
1. Suba a pasta `backend/` no GitHub
2. Crie um **Web Service** no Render conectando o repo
3. Build command: `npm install` | Start: `npm start`
4. Adicione as variáveis de ambiente:

```
ML_CLIENT_ID=565440032675267
ML_CLIENT_SECRET=2LE7cO1JlAga3n52LNIazooArXsZut3y
ML_REDIRECT_URI=https://SEU-APP.vercel.app/callback
MANUS_API_KEY=sk-K9k8pvhv5Y17RS8IM2AC_4gP_6ghp9VUU6yNDS3yBsIAhDW_imTTJX1bLXqQ9OM4hJdrqnKljSDGPb-N5qPSPniqlfvn
PORT=4000
```

### Frontend → Vercel
1. Suba a pasta `frontend/` no GitHub  
2. Importe no Vercel
3. Adicione variável: `NEXT_PUBLIC_API_URL=https://SEU-BACKEND.onrender.com`
4. Deploy!

### Após deploy: atualizar URI no ML Devs
Troque `http://localhost:3000/callback` por `https://SEU-APP.vercel.app/callback`

---

## Próximos Passos

- [ ] Alertas por email/push quando score > 80 aparecer
- [ ] Cruzamento automático: encontrou oportunidade → notifica comprador compatível
- [ ] Histórico de preços por carta
- [ ] App mobile (React Native)

---

## Deploy no Hugging Face Spaces (Backend)

### Passo a passo

1. Acesse https://huggingface.co/new-space
2. Preencha:
   - **Space name:** `cardflip-api`
   - **SDK:** Docker  ← importante!
   - **Visibility:** Public
3. Após criar, vá em **Files** → faça upload de TODOS os arquivos da pasta `backend/`:
   - `Dockerfile`
   - `index.js`
   - `package.json`
   - `README.md`
   - pasta `services/` completa (5 arquivos .js)
   - ⚠️ NÃO suba o `.env` — use as variáveis de ambiente do HF (passo 4)

4. Vá em **Settings** → **Variables and secrets** → adicione:
   ```
   ML_CLIENT_ID          = 565440032675267
   ML_CLIENT_SECRET      = (sua chave secreta ML)
   ML_REDIRECT_URI       = https://SEU-USUARIO-cardflip-api.hf.space/callback
   MANUS_API_KEY         = (sua chave Manus)
   ```

5. O Space vai buildar automaticamente (~2 min). Quando ficar verde, sua API estará em:
   `https://SEU-USUARIO-cardflip-api.hf.space`

6. Atualize o frontend:
   - No Vercel, adicione a variável:
     `NEXT_PUBLIC_API_URL=https://SEU-USUARIO-cardflip-api.hf.space`

### Por que porta 7860?
O Hugging Face Spaces **exige** que a aplicação escute na porta 7860.
O `index.js` já está configurado para isso automaticamente.
