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
| **Propostas legislativas** (PL, PEC, ideias): cadastro, filtros, botão "Votar no site oficial", compartilhar, pedir exclusão. **O site não registra votos.** | `propostas.html` + `js/propostas.js` |
| **Mapa interativo do Brasil** na página inicial: clique em um estado para filtrar (ele é destacado e o mapa dá zoom), pontos nas cidades com ato | `js/map.js` |
| **Dados oficiais** nos cartões de propostas: situação, autoria, votos Sim/Não dos deputados (Câmara) e apoios de ideias (e-Cidadania) | `netlify/functions/stats.js` + `js/oficial.js` |
| Painel de moderação (pedidos de exclusão de atos e propostas, remover/restaurar) | `admin.html` + `js/admin.js` |
| Tabelas, regras de segurança e função de moderação | `database/schema.sql` |
| Módulo de propostas no banco (rodar **depois** do schema.sql) | `database/propostas.sql` |
| Ponto da cidade no mapa (opcional, rodar por último) | `database/mapa.sql` |

```
mobiliza-brasil/
├── index.html          # site público (mobilizações)
├── propostas.html      # propostas legislativas (link para o site oficial)
├── admin.html          # painel de moderação (login)
├── css/style.css
├── js/
│   ├── config.js       # ← VOCÊ preenche (URL e chave do Supabase)
│   ├── api.js          # acesso ao banco (e modo demonstração)
│   ├── app.js          # lógica do site
│   ├── propostas.js    # lógica da página de propostas
│   ├── map.js          # mapa interativo do Brasil
│   ├── oficial.js      # mostra os dados oficiais nos cartões
│   ├── admin.js        # lógica do painel
│   └── utils.js
├── database/schema.sql    # ← rodar no Supabase (1º)
├── database/propostas.sql # ← rodar no Supabase (2º, depois do schema.sql)
├── database/mapa.sql      # ← rodar no Supabase (3º)
├── netlify/functions/stats.js  # lê dados oficiais (só funciona no Netlify)
├── netlify.toml
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
   Depois abra **outra** query, cole **todo** o `database/propostas.sql` e clique **Run** (ativa a página de Propostas).
   Por fim, rode também o `database/mapa.sql` (guarda o ponto da cidade para o mapa).
   O Supabase mostra "Success. No rows returned" nos três casos; isso é normal.
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

**B) Netlify** (necessário para os dados oficiais das propostas; use **deploy pelo GitHub**, porque arrastar a pasta não publica a função) — <https://app.netlify.com> → *Add new site → Import from Git* → repositório → deploy (sem build). Ou arraste a pasta em *Deploy manually*.

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

## Propostas legislativas (PL, PEC, ideias)

- Qualquer pessoa cadastra: título, tipo (PL, PEC, PLP, PDL, ideia legislativa, consulta pública, outro), número (opcional), resumo, **link oficial** e a sugestão de voto (a favor, contra ou apenas informativo).
- **O site não vota nem conta votos.** O botão "Votar no site oficial" abre o link cadastrado, e a pessoa vota lá.
- **Só são aceitos links `https` de domínios `.gov.br` e `.leg.br`** (Câmara, Senado, gov.br, assembleias, câmaras municipais). A regra existe no site e também no banco, então não dá para burlar pela API. Isso evita que o espaço seja usado para divulgar links falsos.
- A etiqueta "Sugerem votar a favor/contra" é a opinião de quem cadastrou, não do site.
- Compartilhar e "Solicitar exclusão" funcionam como nos atos. Os pedidos aparecem no mesmo painel, e há uma aba **Propostas** para remover ou restaurar.

## Mapa interativo

- O desenho dos estados vem da API pública do **IBGE**, carregada no navegador de quem visita e guardada em cache.
- Se o IBGE não responder, o site mostra automaticamente um **mapa de reserva** (grade com os 27 estados), que também é clicável e filtra a lista.
- Clicar em um estado destaca-o, dá zoom, filtra a lista e mostra só as cidades com ato naquele estado. Clicar em um ponto filtra pela cidade. Os filtros e o mapa andam juntos nos dois sentidos.
- As capitais aparecem na hora. Para as demais cidades, o site usa a localização informada no cadastro; se não houver, procura a cidade pelo nome (serviço gratuito do OpenStreetMap, 1 consulta por segundo) e guarda o ponto no cadastro novo (`map_lat`/`map_lng`). Esse ponto **não** muda o botão "Ver no mapa" do cartão.
- Sem rodar o `mapa.sql` tudo continua funcionando; as cidades só demoram um pouco mais para aparecer.

## Dados oficiais nas propostas (o que dá e o que não dá)

Ao colar o link oficial, o site pergunta à função `stats` (no Netlify) e mostra no cartão:

| Link cadastrado | O que aparece |
|---|---|
| Câmara dos Deputados (`camara.leg.br`, com `idProposicao=` ou `/propostas-legislativas/ID`) | situação, onde está, autoria, data de apresentação e, se houve votação nominal, **votos Sim e Não dos deputados** (última votação, de preferência no Plenário) |
| Senado e-Cidadania, Ideia Legislativa (`visualizacaoideia?id=`) | **número de apoios** e a meta de 20 mil |

Também preenche número e resumo do formulário quando o link é da Câmara.

**Limites importantes**
- Os votos Sim/Não mostrados são os **dos deputados em plenário**, não a enquete popular dos sites. Não encontrei API pública para os votos populares da Câmara nem para a consulta pública do Senado, então eles **não** são exibidos (o botão leva ao site oficial, onde a pessoa vota e vê o placar).
- Matérias do Senado (PL/PEC no `senado.leg.br`) ainda não têm leitura automática.
- Os dados aparecem com "Fonte" e horário de leitura, ficam em cache por cerca de 30 minutos e, se o site oficial estiver fora do ar, o cartão simplesmente não mostra números.
- A leitura foi escrita seguindo a documentação pública e testada com respostas simuladas, **não** contra os servidores reais. Para conferir depois de publicar, abra no navegador
  `https://SEU-SITE/.netlify/functions/stats?url=` seguido do link oficial codificado. Deve responder `{"ok":true,...}`. Se vier `{"ok":false,...}` com um link válido, me envie a resposta que eu ajusto.
- Fora do Netlify (ou abrindo o arquivo no computador) a função não existe: o site funciona normalmente, apenas sem esses números.

## Como funciona a moderação

1. Qualquer pessoa clica em **Solicitar exclusão** num ato e informa o motivo (contato opcional).
2. O pedido aparece em `admin.html` → **Pedidos de exclusão**.
3. **Aprovar** → o ato vira `removed` (some do site, continua no banco para auditoria). **Recusar** → o ato permanece.
4. Na aba **Todas as mobilizações** você pode remover ou restaurar qualquer ato diretamente.

## Segurança e boas práticas

- **Regras no banco (RLS):** visitantes só leem atos ativos, cadastram atos e abrem pedidos; só moderadores leem pedidos e alteram status.
- **Mapa e dados oficiais** só leem serviços públicos (IBGE, OpenStreetMap, Câmara, Senado); nenhuma chave secreta é usada.
- **Anti-spam básico:** campo-isca (honeypot) nos formulários e limites de tamanho no banco. Se houver abuso, ative **CAPTCHA** em Supabase → Authentication → Attack Protection, ou coloque o Cloudflare Turnstile na frente do formulário.
- **Aprovação prévia (opcional):** para só publicar depois de revisar, troque no `schema.sql` o `default 'active'` por `'pending'`, ajuste as policies (`status = 'pending'` no insert) e adicione uma aba de aprovação no painel.
- **Links de mapa:** só são aceitos links `https` do Google Maps.
- **LGPD:** o site não coleta dados pessoais obrigatórios. O contato no pedido de exclusão é opcional; evite pedir dados desnecessários e publique uma breve política de privacidade.
- **Limites do plano grátis do Supabase:** 500 MB de banco e projeto pausado após 7 dias sem uso; para um mural é bastante. Se o tráfego crescer, avalie o plano Pro.

## Personalizar

- Cores: variáveis no topo de `css/style.css` (`--brand`, `--accent`).
- Texto da mensagem de compartilhamento: função `shareText` em `js/app.js`.
- Estados/UF: lista em `js/utils.js`.

## Mapa
A geometria dos 27 estados está em `data/brasil-estados.geojson` (malha municipal do IBGE 2025, simplificada, ~70 KB). Carrega na hora, sem depender do IBGE. Se o arquivo faltar, o site tenta o IBGE e, por último, usa o mapa em blocos.

## Enquete da Câmara
Links `camara.leg.br/enquetes/{id}` (ou `/resultados`) mostram as 5 opções (concordo totalmente … discordo totalmente), lidas da página pública de resultados.
