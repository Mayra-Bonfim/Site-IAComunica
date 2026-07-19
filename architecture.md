# Site Institucional IA Comunica — Arquitetura e Documentação Técnica

**URL:** https://iacomunica.com.br  
**GitHub:** https://github.com/Mayra-Bonfim/Site-IAComunica  
**Última atualização:** 2026-07-19  
**Responsável:** Mayra Madera + Sofia (IA Comunica)

---

## Stack

| Item | Tecnologia |
|------|-----------|
| Linguagem | HTML5 + CSS3 + JavaScript (ES6+) |
| Framework | Nenhum — site estático puro |
| Hospedagem | GitHub Pages |
| Templating (só Acervo) | Jekyll nativo do GitHub Pages (`_includes/`, sem `_config.yml`) — ver seção "Acervo — Dependência do Jekyll" |
| Domínio | iacomunica.com.br (CNAME no repo) |
| Fontes | Google Fonts (Space Grotesk, DM Sans, JetBrains Mono) |
| Agendamento | Cal.com embed |
| Vídeo | `<video autoplay loop muted playsinline>` |

---

## Estrutura de Arquivos

```
Site-IAComunica/
├── index.html                    ← Página principal (~35KB)
├── styles.css                    ← Toda a estilização (~40KB)
├── scripts.js                    ← JS: animações, Cal.com, menu (~8KB)
├── CNAME                         ← iacomunica.com.br
├── favicon-96x96.png
├── og-image.png
├── assets/
│   ├── logo-transparent.png      ← Logo IA Comunica sem fundo (13KB, PNG)
│   └── video/
│       └── nexus-institucional.mp4  ← Vídeo do Nexus (5.9MB)
├── docs/
│   └── nexusmed/index.html       ← Documentação Nexus (página separada)
├── acervo/                       ← Acervo: guias práticos de IA (12 páginas, processadas via Jekyll — ver seção dedicada abaixo)
│   ├── index.html                ← Hub principal do Acervo
│   ├── acervo-tokens.css / acervo.css / acervo.js
│   └── <slug>/index.html         ← 11 páginas de playbook
├── _includes/                    ← Partials Jekyll usados pelo Acervo (NÃO mover para dentro de acervo/)
│   ├── acervo-topbar.html
│   ├── acervo-footer.html
│   └── acervo-head-theme.html
└── superafiliadoia/              ← Landing page afiliados (separada)
    ├── index.html
    └── CNAME
```

**Backup do site antigo:** branch `backup-site-antigo` no mesmo repo.  
**Arquivos locais (não no repo):** `sites/institucional/` em `ecosistema-ia-comunica/setores/marketing/`

---

## ⚠️ Acervo — Dependência do Jekyll nativo do GitHub Pages (CRÍTICO)

O Acervo (`acervo/`, 12 páginas: `acervo/index.html` + 11 playbooks em `acervo/<slug>/index.html`) elimina a duplicação de topbar, footer institucional e script anti-FOUC de tema usando **includes do Jekyll** (`{% include %}`), processados pelo motor Jekyll que o GitHub Pages roda automaticamente em todo push — sem nenhuma configuração adicional (não há `_config.yml` no repo; o build usa os defaults do GitHub Pages).

**Como funciona:**
- Os 12 arquivos HTML do Acervo têm front matter Jekyll vazio no topo (`---` `---`) — é isso que ativa o processamento Liquid/Jekyll naquele arquivo específico. Sem essas duas linhas, o Jekyll trata o arquivo como asset estático e NÃO processa `{% include %}`.
- Os partials ficam em `_includes/` **na raiz do repositório** (não dentro de `acervo/`) — é onde o Jekyll procura por padrão:
  - `_includes/acervo-topbar.html`
  - `_includes/acervo-footer.html`
  - `_includes/acervo-head-theme.html`
- As tags de include nas páginas ficam **sem indentação própria** (`{% include acervo-topbar.html %}`, começando na coluna 0) porque os próprios arquivos de partial já carregam sua indentação original de 2 espaços na primeira linha. Se a tag também tivesse indentação, o resultado renderizado ficaria com a primeira linha do bloco duplamente indentada (inofensivo visualmente, mas sujo).
- Conteúdo que varia por página (breadcrumb com o nome do playbook, indicador de trilha) **fica fora** dos includes, na página, logo abaixo do `{% include acervo-topbar.html %}`.

**🔴 NUNCA adicionar um arquivo `.nojekyll` na raiz do repositório.** Isso é uma prática comum ao publicar SPAs (o app institucional Vite/React que vive na raiz do repo pode, no futuro, precisar de algo do tipo para evitar que o GitHub Pages tente processar pastas como `_includes`/`assets` como Jekyll). Se isso for feito, o Jekyll para de rodar em todo o repositório e:
- O `{% include ... %}` simplesmente **não é processado** — a tag aparece como texto literal na página publicada, ou
- Pior: a página é servida **sem topbar e sem footer** (o texto do `{% include %}` pode ser interpretado como conteúdo/HTML inválido dependendo de onde cai).

Isso quebraria silenciosamente as 12 páginas do Acervo em produção, sem erro de build — o GitHub Pages não avisa, só para de rodar Jekyll.

Se algum dia for necessário desativar o Jekyll para o app institucional (SPA), a solução correta é usar `_config.yml` com `exclude:`/`include:`, ou mover o SPA para hospedagem separada — nunca `.nojekyll` na raiz enquanto o Acervo depender de `_includes`.

**Verificação real de Jekyll — não feita nesta sessão.** Não havia Ruby/Jekyll instalados na máquina. Foi tentado `winget install RubyInstallerTeam.Ruby.3.3` (sucesso) seguido de `gem install jekyll bundler`, mas a instalação do gem `jekyll` falhou por falta do toolchain MSYS2 (necessário para compilar uma dependência nativa) — completar isso exigiria instalar o MSYS2 também, um footprint maior do que fazia sentido só para essa verificação pontual. O Ruby foi desinstalado (`winget uninstall`) para não deixar resíduo na máquina. Em vez disso, a verificação foi feita por simulação: um script Python reproduziu manualmente a substituição literal do Liquid (`{% include %}` → conteúdo do partial, front matter removido) para os 12 arquivos migrados e comparou byte a byte com o conteúdo original (pré-migração, via `git show HEAD:<arquivo>`) — resultado: os 12 arquivos reconstroem o HTML original exatamente. Isso dá confiança alta de que o Jekyll real vai renderizar certo (o comportamento do `{% include %}` é substituição textual simples, bem documentado, sem lógica condicional nos nossos partials), mas **não é o mesmo que rodar o build real do Jekyll**. Confirmar visualmente no primeiro deploy real (GitHub Pages) após o merge.

---

## Design Tokens

### Paleta de Cores

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-teal` | `#00C4B3` | Destaque, botões primários, ícones |
| `--color-night` | `#0F1629` | Fundo principal (dark) |
| `--color-primary` | `#004C7E` | Azul secundário |
| `--color-white` | `#FFFFFF` | Texto principal em fundos escuros |
| `--color-muted` | `rgba(255,255,255,0.45)` | Texto secundário, labels |
| `--color-border` | `rgba(255,255,255,0.08)` | Bordas sutis |
| `--color-surface` | `rgba(255,255,255,0.04)` | Cards em fundo escuro |

### Tipografia

| Fonte | Uso | Pesos |
|-------|-----|-------|
| Space Grotesk | Display, headings, logo, números | 400, 500, 600, 700, 800 |
| DM Sans | Corpo, UI, parágrafos | 400, 500, 600 |
| JetBrains Mono | Código, CNPJ, números técnicos | 400, 500 |

### Espaçamento e Radius

```css
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 20px
--radius-xl: 28px
--radius-full: 9999px   /* botões pill */
--nav-h: 64px           /* altura do nav sticky */
```

---

## Seções do Site (em ordem)

### 1. Nav (Cabeçalho)
- `position: sticky; top: 0; z-index: 100`
- Logo (PNG transparente) + nome "I.A Comunica"
- Links: **Nexus · Automações · Sobre**
- CTA: "Agendar diagnóstico →" (Cal.com embed)
- Mobile: hamburger com menu `visibility/opacity` (NÃO transform — causa bug de overlay)

### 2. Hero
- Headline: "Sua operação no piloto automático. Sua equipe no que importa."
- Subheadline: "Implantamos inteligência artificial em processos reais..."
- CTA: "Agendar diagnóstico gratuito" (Cal.com)
- Card animado (IntersectionObserver): 32h economizadas, 94 follow-ups, 18 documentos, 7 processos

### 3. Nossa Origem
- Eyebrow: "NOSSA ORIGEM"
- Contexto: Brasília como centro de decisões
- Fundadores: Mayra (técnica) + Emanuel (comercial)
- Valores: Integridade, Humanidade, Eficiência

### 4. Nexus (Destaque)
- Grid 5fr/7fr (conteúdo/vídeo)
- Tag: "Saúde"
- Vídeo: `assets/video/nexus-institucional.mp4` — autoplay, loop, muted, sem controles
- CTA: "Conhecer o Nexus →" (Cal.com)
- ID âncora: `#nexus`

### 5. Ecossistema
- Menção a CRM, Minutare e outros produtos
- CTA WhatsApp para produtos além do Nexus
- ID âncora: `#crm` (para compatibilidade)

### 6. Automações
- Eyebrow: "Automações sob medida"
- Pipeline animado: 5 etapas com dots viajando via CSS `@keyframes dot-travel`
  - Evento chega → IA interpreta → Fluxo ativa → Sistemas atualizados → Resultado entregue
- Cards antes/depois (3):
  - Relatório semanal: 4h → 0 minutos
  - Onboarding de cliente: 3 dias → 2 horas
  - Controladoria: 3 dias → Dia 1
- ID âncora: `#automacoes`

### 7. Metodologia
- "Do diagnóstico à operação — com método."
- 3 passos com linha de tempo vertical (mobile) / horizontal (desktop):
  1. Diagnóstico
  2. Implementação
  3. Operação
- **ATENÇÃO:** O `.passo--last` (passo 03) não tem `.passo__conector` no HTML — o CSS mobile deve usar `grid-template-columns: 80px 1fr` para este elemento.

### 8. Diferenciais
- "Por que a IA Comunica?"
- 3 cards: Integração real, Suporte contínuo, Sem dependência

### 9. CTA Final
- Background escuro com gradiente
- "Pronto para transformar sua operação?"
- Botão Cal.com

### 10. Rodapé
- Grid 2 colunas (desktop) / 1 coluna (mobile)
- Esquerda: Slogan completo (Space Grotesk bold)
  > "Tecnologia que humaniza. Estratégia que conecta. Transformando dados em decisões inteligentes para o seu negócio."
- Direita: Logo + endereço + email + CNPJ + ícones sociais
- Instagram: https://www.instagram.com/iacomunicaoficial
- LinkedIn: a confirmar (link pendente)
- CNPJ: 65.073.471/0001-75

---

## Integrações

### Cal.com (Agendamento)

```
Username:  comunica
Evento:    reuniao-apresentacao-alinhamento
Link:      comunica/reuniao-apresentacao-alinhamento
URL direta: https://cal.com/comunica/reuniao-apresentacao-alinhamento
```

**Configuração no `<head>`:**
```javascript
Cal("init", "reuniao-apresentacao-alinhamento", {origin:"https://app.cal.com"});
Cal.ns["reuniao-apresentacao-alinhamento"]("ui", {
  "theme": "dark",
  "cssVarsPerTheme": {"dark": {"cal-brand": "#00C2AE"}},
  "hideEventTypeDetails": false,
  "layout": "month_view"
});
```

**Em cada botão:**
```html
data-cal-link="comunica/reuniao-apresentacao-alinhamento"
data-cal-namespace="reuniao-apresentacao-alinhamento"
data-cal-config='{"layout":"month_view","theme":"dark"}'
```

> ⚠️ **CRÍTICO:** O `data-cal-link` DEVE incluir o username `comunica/` antes do slug. Sem ele, erro 404.

### WhatsApp

```
Número: +55 61 3142-5518
Link completo:
https://api.whatsapp.com/send/?phone=556131425518&text=Gostaria+de+conversar+estrategicamente+sobre+as+solu%C3%A7%C3%B5es+da+IA+Comunica.&type=phone_number&app_absent=0
```

---

## Responsividade

**Breakpoint principal:** `768px`

| Seção | Desktop | Mobile |
|-------|---------|--------|
| Nav | Links visíveis | Hamburger menu |
| Nav (mobile menu) | `display: none` | `visibility/opacity` toggle |
| Hero | 2 colunas | 1 coluna |
| Nexus | Grid 5fr/7fr | 1 coluna, vídeo embaixo |
| Pipeline | Flex row | Scroll horizontal (`overflow-x: auto`) |
| Cards antes/depois | Grid 3 colunas | 1 coluna |
| Metodologia | Flex row horizontal | Flex column com linha vertical |
| Footer | Grid 2 colunas | 1 coluna |

---

## Animações

### IntersectionObserver (scroll reveal)
- Elementos com `data-reveal` ganham classe `is-visible` ao entrar na viewport
- Configurado em `scripts.js`

### Pipeline (CSS puro)
```css
@keyframes dot-travel {
  0%   { left: -6px; opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { left: calc(100% - 4px); opacity: 0; }
}
```
- Duração: 2.4s, `ease-in-out`, `infinite`
- Ponto teal (`#00C4B3`) com `box-shadow: 0 0 8px rgba(0,196,179,0.8)`

---

## Como Fazer Deploy

### Fluxo padrão
```bash
# 1. Editar localmente
# Arquivos em: ecosistema-ia-comunica/setores/marketing/sites/institucional/

# 2. Copiar para o clone do repo
cp sites/institucional/index.html /tmp/site-deploy/index.html
cp sites/institucional/styles.css /tmp/site-deploy/styles.css
# (repetir para outros arquivos alterados)

# 3. Commit e push
cd /tmp/site-deploy
git add <arquivos>
git commit -m "descrição da mudança"
git push origin main

# 4. Aguardar ~2 min para GitHub Pages processar
# 5. Ctrl+Shift+R no browser para limpar cache
```

### Se o clone não existir
```bash
git clone https://github.com/Mayra-Bonfim/Site-IAComunica.git /tmp/site-deploy
```

---

## Bugs Conhecidos e Soluções

### 1. Menu mobile aparecendo no desktop (RESOLVIDO)
**Problema:** `nav__mobile` com `transform: translateY(-110%)` não escondia completamente  
**Causa:** transform percentual baseado na altura do elemento — se o menu é curto, não esconde o suficiente  
**Solução:** `visibility: hidden; opacity: 0; pointer-events: none` em estado fechado + `display: none` no breakpoint desktop (`min-width: 768px`)

### 2. Passo 03 da metodologia com texto quebrando (RESOLVIDO)
**Problema:** Texto "Operação" quebrando palavra por palavra no mobile  
**Causa:** `.passo--last` não tem `.passo__conector` no HTML, mas CSS usava `grid-template-columns: 80px 24px 1fr` — content caía na coluna de 24px  
**Solução:** `@media (max-width: 768px) { .passo--last { grid-template-columns: 80px 1fr; } }`

### 3. Cal.com erro 404 (RESOLVIDO)
**Problema:** Botões de agendamento retornavam 404  
**Causa:** `data-cal-link` tinha só o slug sem o username  
**Solução:** Usar `data-cal-link="comunica/reuniao-apresentacao-alinhamento"`

### 4. Logo com fundo branco (RESOLVIDO)
**Problema:** Logo PNG com fundo branco ficava feia no nav escuro  
**Solução:** Python + Pillow para remover fundo branco, converter elementos escuros para branco, recortar ao bounding box

### 5. Pipeline overflow mobile (RESOLVIDO)
**Solução:** `overflow-x: auto; -webkit-overflow-scrolling: touch` no `.fluxo-pipeline`

---

## Identidade

**Slogans oficiais:**
- "Tecnologia que humaniza. Estratégia que conecta."
- "Tecnologia que humaniza. Estratégia que conecta. Transformando dados em decisões inteligentes para o seu negócio." (versão completa)
- "Decisão antes da tecnologia." (alternativo)

> ⚠️ Nunca inventar outros descritores ou taglines para a empresa.

**Produtos:** CRM IA Comunica, Nexus, Minutare, Civitas, Polaris

---

## Contatos

| | |
|---|---|
| Email | contato@iacomunica.com.br |
| WhatsApp | +55 61 3142-5518 |
| Instagram | @iacomunicaoficial |
| Endereço | Brasília, DF — Brasil |
| CNPJ | 65.073.471/0001-75 |
