# Mobiliza Brasil

Mural colaborativo para cadastrar e encontrar mobilizações em todo o país.
Site estático (HTML + CSS + JS puro) + banco de dados **Supabase** (PostgreSQL). Sem servidor para manter e com plano gratuito suficiente para começar.

## O que tem

| Recurso | Onde |
|---|---|
| Cadastro: título, descrição, local de encontro, cidade, UF, data, horário | `index.html` + `js/app.js` |
| Localização: **detectar automaticamente** ou **colar link do Google Maps** | `js/app.js` |
| Compartilhar cada ato (WhatsApp, Telegram, X, Facebook, e-mail, SMS, copiar para Instagram etc.) com mensagem pronta e link direto | `js/app.js` |
| Pedido de exclusão por qualquer visitante | cartão do ato → "Solicitar exclusão" |
| Painel de moderação (aprovar/recusar pedidos, remover/restaurar atos) | `admin.html` + `js/admin.js` |
| Tabelas, regras de segurança e função de moderação | `database/schema.sql` |

```
mobiliza-brasil/
├── index.html          # site público
├── admin.html          # painel de moderação (login)
├── css/style.css
├── js/
│   ├── config.js       # ← VOCÊ preenche (URL e chave do Supabase)
│   ├── api.js          # acesso ao banco (e modo demonstração)
│   ├── app.js          # lógica do site
│   ├── admin.js        # lógica do painel
│   └── utils.js
├── database/schema.sql # ← rodar no Supabase
└── README.md
```

## Testar no seu computador (modo demonstração)

Abra o `index.html` no navegador. Enquanto o `js/config.js` não estiver preenchido, o site funciona em **modo demonstração** (dados só no seu navegador, três atos de exemplo). O painel `admin.html` abre sem login nesse modo.

> A detecção de localização exige HTTPS ou `localhost`. Para testar local: `python3 -m http.server 8000` na pasta e acesse `http://localhost:8000`.

---

## Publicar na internet — passo a passo

### Passo 1 — Banco de dados (Supabase, grátis)

1. Crie conta em <https://supabase.com> → **New project** (escolha a região **South America (São Paulo)** e guarde a senha do banco).
2. No menu **SQL Editor → New query**, cole **todo** o conteúdo de `database/schema.sql` e clique **Run**.
3. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon public key**
4. Abra `js/config.js` e cole os dois valores.
   A chave *anon* pode ir para o GitHub (é pública por design; a proteção são as regras RLS do `schema.sql`). **Nunca** use a `service_role` no site.

### Passo 2 — Criar o primeiro moderador

1. Supabase → **Authentication → Users → Add user → Create new user** (seu e-mail + senha; marque *Auto Confirm*).
2. No **SQL Editor**, rode (trocando o e-mail):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'SEU-EMAIL@exemplo.com'
   on conflict do nothing;
   ```
3. Em **Authentication → Providers → Email**, desative **"Allow new users to sign up"** para ninguém mais criar conta.

Pronto: `seusite.com/admin.html` → login → você vê os pedidos de exclusão.

### Passo 3 — Subir o código no GitHub

Pelo navegador (sem instalar nada):
1. Em <https://github.com/new> crie um repositório (ex.: `mobiliza-brasil`).
2. **Add file → Upload files** → arraste **o conteúdo** da pasta (index.html, admin.html, css, js, database, README.md) → **Commit changes**.

Ou pelo terminal:
```bash
cd mobiliza-brasil
git init && git add . && git commit -m "Mobiliza Brasil"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/mobiliza-brasil.git
git push -u origin main
```

### Passo 4 — Colocar o site no ar (escolha UMA opção, todas grátis)

**A) Cloudflare Pages** (recomendado: rápido, banda ilimitada)
1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git** → escolha o repositório.
2. Framework: *None*. Build command: *(vazio)*. Output directory: `/`. **Save and Deploy**.
3. Link pronto em `https://mobiliza-brasil.pages.dev`.

**B) Netlify** — <https://app.netlify.com> → *Add new site → Import from Git* → repositório → deploy (sem build). Ou arraste a pasta em *Deploy manually*.

**C) Vercel** — <https://vercel.com/new> → importar repositório → *Framework: Other* → Deploy.

**D) GitHub Pages** — repositório → **Settings → Pages → Branch: main / (root) → Save**. Link: `https://SEU-USUARIO.github.io/mobiliza-brasil/`.

Todas atualizam sozinhas a cada `git push`.

### Passo 5 — Domínio próprio (opcional)

Registre em registro.br (`.com.br`) ou outro registrador. No serviço escolhido: **Custom domains → Add** e siga as instruções de DNS (HTTPS é automático).

### Passo 6 — Conferir

- [ ] Cadastrar um ato de teste no site
- [ ] Clicar em **Compartilhar** e abrir o link gerado (`?ato=...` destaca o ato)
- [ ] Pedir exclusão e aprovar em `/admin.html`
- [ ] Remover os atos de teste pelo painel

---

## Como funciona a moderação

1. Qualquer pessoa clica em **Solicitar exclusão** num ato e informa o motivo (contato opcional).
2. O pedido aparece em `admin.html` → **Pedidos de exclusão**.
3. **Aprovar** → o ato vira `removed` (some do site, continua no banco para auditoria). **Recusar** → o ato permanece.
4. Na aba **Todas as mobilizações** você pode remover ou restaurar qualquer ato diretamente.

## Segurança e boas práticas

- **Regras no banco (RLS):** visitantes só leem atos ativos, cadastram atos e abrem pedidos; só moderadores leem pedidos e alteram status.
- **Anti-spam básico:** campo-isca (honeypot) nos formulários e limites de tamanho no banco. Se houver abuso, ative **CAPTCHA** em Supabase → Authentication → Attack Protection, ou coloque o Cloudflare Turnstile na frente do formulário.
- **Aprovação prévia (opcional):** para só publicar depois de revisar, troque no `schema.sql` o `default 'active'` por `'pending'`, ajuste as policies (`status = 'pending'` no insert) e adicione uma aba de aprovação no painel.
- **Links de mapa:** só são aceitos links `https` do Google Maps.
- **LGPD:** o site não coleta dados pessoais obrigatórios. O contato no pedido de exclusão é opcional; evite pedir dados desnecessários e publique uma breve política de privacidade.
- **Limites do plano grátis do Supabase:** 500 MB de banco e projeto pausado após 7 dias sem uso; para um mural é bastante. Se o tráfego crescer, avalie o plano Pro.

## Personalizar

- Cores: variáveis no topo de `css/style.css` (`--brand`, `--accent`).
- Texto da mensagem de compartilhamento: função `shareText` em `js/app.js`.
- Estados/UF: lista em `js/utils.js`.
