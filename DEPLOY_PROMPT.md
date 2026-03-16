# CardFlip — Prompt de Deploy para o Agente Antigravity

## CONTEXTO DO PROJETO

Você vai fazer o deploy completo de um app chamado **CardFlip**.
O projeto já está 100% codado. **Não altere o código.**

---

## ESTRUTURA DO PROJETO

```
cardflip/
├── backend/           ← vai pro Hugging Face Spaces (Docker)
│   ├── Dockerfile
│   ├── README.md      ← YAML front matter obrigatório do HF (já correto)
│   ├── index.js
│   ├── package.json
│   └── services/
│       ├── mercadolivre.js
│       ├── mypcards.js
│       ├── manus.js
│       ├── demand.js
│       └── prices.js
└── frontend/          ← vai pro Vercel (Next.js 14)
    ├── next.config.mjs
    ├── package.json
    └── src/
        ├── app/
        ├── components/
        └── lib/
```

---

## PASSO 1 — DOIS REPOSITÓRIOS NO GITHUB

### Repo 1: `cardflip-backend`
- Visibilidade: Public
- Suba todos os arquivos de `cardflip/backend/`
- Crie `.gitignore`:
  ```
  .env
  node_modules/
  ```
- ⚠️ NÃO commite `.env`

### Repo 2: `cardflip-frontend`
- Visibilidade: Public
- Suba todos os arquivos de `cardflip/frontend/`
- Crie `.gitignore`:
  ```
  .env.local
  .next/
  node_modules/
  ```

---

## PASSO 2 — BACKEND NO HUGGING FACE SPACES

### Como o HF funciona com este projeto:
- Detecta o `Dockerfile` na raiz do repo
- Builda a imagem Docker automaticamente com Node.js LTS Alpine
- O `README.md` já contém o YAML front matter correto:
  ```yaml
  ---
  title: CardFlip API
  emoji: 🃏
  colorFrom: purple
  colorTo: pink
  sdk: docker
  app_port: 7860
  license: mit
  ---
  ```
- O app escuta em `0.0.0.0:7860` (já configurado)
- URL final: `https://SEU-USUARIO-cardflip-backend.hf.space`

### Passos:
1. Acesse https://huggingface.co/new-space
2. Preencha:
   - **Space name:** `cardflip-backend`
   - **SDK:** `Docker` ← OBRIGATÓRIO
   - **Visibility:** Public
3. Conecte ao GitHub repo `cardflip-backend`
4. O HF vai buildar automaticamente (~3 min)

### Variáveis — Settings → Variables and secrets:

| Nome | Valor | Tipo |
|------|-------|------|
| `ML_CLIENT_ID` | `565440032675267` | Variable |
| `ML_CLIENT_SECRET` | `2LE7cO1JlAga3n52LNIazooArXsZut3y` | **Secret** |
| `ML_REDIRECT_URI` | `https://SEU-USUARIO-cardflip-backend.hf.space/callback` | Variable |
| `MANUS_API_KEY` | `sk-K9k8pvhv5Y17RS8IM2AC_4gP_6ghp9VUU6yNDS3yBsIAhDW_imTTJX1bLXqQ9OM4hJdrqnKljSDGPb-N5qPSPniqlfvn` | **Secret** |
| `PORT` | `7860` | Variable |

### Verificar se subiu:
`GET https://SEU-USUARIO-cardflip-backend.hf.space/api/status`
Deve retornar `{"sources":{"mercadolivre":true,"mypcards":true,...}}`

---

## PASSO 3 — FRONTEND NO VERCEL

1. Acesse https://vercel.com/new → Import `cardflip-frontend`
2. Vercel detecta Next.js automaticamente
3. Antes de deployar, adicione a variável:
   - `NEXT_PUBLIC_API_URL` = `https://SEU-USUARIO-cardflip-backend.hf.space`
4. Deploy (~2 min)

---

## PASSO 4 — ATUALIZAR REDIRECT URI NO MERCADO LIVRE

1. https://developers.mercadolivre.com.br → editar app
2. Trocar URI de redirect para: `https://SEU-FRONTEND.vercel.app/callback`

---

## O QUE NÃO PRECISA ALTERAR

- ✅ `Dockerfile` — padrão oficial HF Node.js LTS Alpine com `nodejs` entrypoint
- ✅ `README.md` — YAML front matter com `sdk: docker` e `app_port: 7860`
- ✅ Porta 7860 e host `0.0.0.0` já configurados no `index.js`
- ✅ Token ML obtido automaticamente (Client Credentials)
- ✅ CORS habilitado para qualquer origem

---

## TROUBLESHOOTING

| Problema | Solução |
|----------|---------|
| Build falha no HF | Confirmar que `Dockerfile` está na raiz do repo, não em subpasta |
| `nodejs: not found` no HF | Não alterar o `ENTRYPOINT` — `nodejs` é o binário correto no Alpine |
| Badge amarelo no frontend | URL errada em `NEXT_PUBLIC_API_URL` ou backend ainda buildando |
| Erro 401 ML | Verificar `ML_CLIENT_ID` e `ML_CLIENT_SECRET` nas secrets do HF |
| CORS error | Confirmar que `NEXT_PUBLIC_API_URL` aponta para `.hf.space`, não localhost |
