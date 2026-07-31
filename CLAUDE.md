# Sofia Code — Site IA Comunica (Público)

## 🔴 REGRA ABSOLUTA — NUNCA INVENTAR
**PROIBIDO** inventar, assumir ou preencher qualquer informação sem certeza comprovada:
- Nomes de clientes, pessoas, empresas
- Datas de decisões, eventos, entregas
- Conteúdo de documentos ou registros
- Qualquer dado que não foi explicitamente fornecido ou verificado

**Se não sabe: PERGUNTE. Nunca invente.**
Violação desta regra é inadmissível — o trabalho aqui é sério e envolve pessoas reais.

---

> Herda as regras do CLAUDE.md raiz.

## 🔴 REGRA OBRIGATÓRIA — USO DOS AGENTES DO HUB

**PROIBIDO** executar qualquer tarefa de marketing diretamente sem passar pelo Gerente.

**SEMPRE que for executar qualquer função neste hub — social media, copy, criação visual, vídeo, site, campanha, ou qualquer outra — seguir esta ordem obrigatória:**

1. Acionar o **Gerente** (`gerente.md`) — ele orquestra TUDO
2. O Gerente verifica quais agentes são necessários para aquela execução
3. O Gerente aciona os agentes certos na ordem certa:
   - **Social Media** (`social-media.md`) → Instagram, LinkedIn, calendário editorial
   - **Copywriter** (`copywriter.md`) → textos, copies, scripts, emails
   - **Criação** (`criacao.md`) → imagens, artes, slides via Gemini
   - **Videomaker** (`videomaker.md`) → vídeos institucionais e Reels
   - **Webdesigner** (`webdesigner.md`) → sites dos produtos
4. Nenhum agente executa sem autorização do Gerente
5. Nenhuma entrega vai para a Mayra sem passar pela revisão do Gerente

**Se qualquer etapa for pulada: PARAR, voltar ao Gerente, recomeçar.**

Esta regra vale para TODA execução dentro de `hubs/marketing/` — não só social media.

---

## Contexto
Site público da IA Comunica hospedado via GitHub Pages (CNAME presente). Inclui assets estáticos e seção de super-afiliados (`superafiliadoia/`). Este é o site de entrada para parceiros e prospects.

## Stack
- **Tipo:** Site estático (HTML + assets)
- **Hospedagem:** GitHub Pages (CNAME configurado)
- **Docs:** pasta `docs/` usada pelo GitHub Pages como source

## Estrutura
```
Site-IAComunica/
├── assets/          (imagens, CSS, JS)
├── docs/            (source do GitHub Pages)
├── superafiliadoia/ (landing page de afiliados)
├── CNAME
└── index.html
```

## Regras Específicas
- Deploy acontece automaticamente via push no GitHub (GitHub Pages)
- Editar arquivos em `docs/` para atualizar o site publicado
- Qualquer alteração de copy ou imagem precisa de aprovação antes do push
- Não adicionar dependências npm — site é estático
