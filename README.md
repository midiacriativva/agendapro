# AgendaPro — PocketBase 0.40.6

PocketBase reúne API, autenticação, arquivos e SQLite em um único executável gratuito e simples de operar.
O front-end continua em HTML, CSS e JavaScript; os dados compartilhados passam a ser gravados no servidor.

## Telas e fluxo
1. Início público → Ver demonstração ou Solicitar acesso; coluna no celular e apresentação ampla no desktop.
2. Solicitação → usuário e estabelecimento pendentes → administrador aprova ou recusa.
3. Dono → serviços, profissionais, identidade visual e agenda; menu móvel/retrátil ou lateral fixo.
4. Cliente → serviço, profissional, data, horário, dados e consentimento → resumo e WhatsApp opcional.
5. Conferência e faturamento → cards no celular; tabela, semana completa e relatórios no desktop.

## Começar localmente
Requisitos: Node.js 22.9+ (recomendado Node 24), curl e extrator ZIP; nenhuma dependência npm. Execute os comandos na pasta deste projeto.

```sh
cp .env.example .env
npm run download
npm start
```
No Windows, copie `.env.example` para `.env` pelo explorador. O download instala **0.40.6** da release oficial e verifica o SHA-256 publicado. Também é possível baixar manualmente o executável oficial e colocá-lo na raiz ou definir `PB_BIN`.

1. Abra http://127.0.0.1:8090. Use exatamente este host; `localhost` tem outra origem para CORS.
2. No primeiro início, abra **localmente** a URL de instalação indicada no terminal e defina seu próprio e-mail e senha de superusuário. Não compartilhe a URL temporária.
3. Defina localmente `PB_ADMIN_EMAIL` e `PB_ADMIN_PASSWORD` em `.env` para a carga inicial. Execute em outro terminal:

```sh
npm run seed
```

4. Entre em **Ver demonstração**. Para testar acesso real, use **Solicitar acesso**, escolha sua própria senha, depois entre em `/admin` com seu superusuário e aprove a solicitação. O dono entra em `/entrar`. Não há credenciais prontas.
5. Retire a senha administrativa de `.env` depois do seed; ela não é necessária para `npm start`. Nunca envie `.env`, `pb_data` ou tokens para Git.

As migrações executam automaticamente no início. Não importe coleções manualmente em paralelo. Use uma instalação nova; faça backup antes de aplicar a um PocketBase existente com coleções de mesmo nome. O seed é idempotente por ramo; não sobrescreve dados existentes. Reiniciar o serviço preserva o banco em `pb_data`.

## Código
- `pb_public/`: visual e telas originais, com adaptador de API em `backend.js`. `core.js`, `app.js` e `features.js` mantêm o comportamento de interface.
- `pb_migrations/1793010000_agendapro.js`: campos, relações, regras, configurações e gatilhos SQL.
- `pb_hooks/01_records.pb.js`: validação, isolamento, auditoria, origem e limpeza programada.
- `pb_hooks/02_routes.pb.js` e `pb_hooks/lib/`: rotas e regras de domínio.
- `scripts/seed.mjs`: dados fictícios dos três ramos; edite nomes, serviços, preços e jornadas aqui. Avatares ilustrados em `pb_public/assets/`.
- [Coleções, tipos e regras](docs/collections.md), [API e segurança](docs/api.md), [publicação e variáveis](docs/deployment.md), [roteiro de testes](docs/tests.md).

Não existe coleção `admins`: nesta versão os administradores nativos são **`_superusers`**. Não são donos comuns; têm poderes administrativos globais do PocketBase. O painel AgendaPro usa autenticação nativa separada nessa coleção. Senhas ficam sob responsabilidade do hash nativo do PocketBase; nenhum hash caseiro ou senha em texto é persistido pelo projeto.

## Dados e demonstração
Os três negócios `is_demo=true` são fixtures para salão, barbearia e clínica. O navegador recebe uma cópia isolada em `demo_sessions`, associada ao hash de um identificador aleatório, com validade de 24 horas. A edição da demonstração acontece no servidor e não altera fixtures, contas reais ou faturamento real. O seed não cria donos nem senhas de demonstração.

Não há armazenamento de dados do negócio em `localStorage`. `sessionStorage` contém somente o token de autenticação e identificadores aleatórios de sessão, necessários para retomar o acesso nessa aba. Reservas, conferências, fotos, acessos, políticas e auditorias ficam no PocketBase. Atualização entre aparelhos usa consulta a cada 15 segundos e recusa de gravação com revisão antiga; alterações concorrentes precisam ser refeitas após recarregar.

Visitas contêm página, instante do servidor e identificador aleatório; não contêm IP ou campos de identificação pessoal. Logs HTTP persistidos do PocketBase foram desativados. O rate limiter pode usar metadados de rede temporariamente em memória. Desative também logs de acesso em qualquer proxy/CDN se não quiser retenção externa de IP.

## O que está simplificado
- MVP com um dono por estabelecimento e jornada semanal simples (mesmos início/fim nos dias marcados), sem férias recorrentes, turnos partidos ou agendamentos que cruzem a meia-noite. Horário de negócio: America/Sao_Paulo; carimbos são UTC.
- Não há pagamentos, notas fiscais, integração contábil, envio automático de mensagens, notificações, recuperação de senha por interface própria ou integração SMTP pronta.
- “Verificado” significa reserva feita pela página pública e conferida; “declarado” significa atendimento avulso informado pelo dono e conferido. Não é comprovação fiscal nem validação independente.
- “Não conferido” é uma situação calculada quando o prazo passa e o status segue `scheduled`; não é um sexto valor persistido em `status`. Não entra no faturamento confirmado. Conferência tardia pode ser feita e fica auditada.
- Não inclui importação automática de antigos dados de localStorage: eles não estavam disponíveis como base de dados de produção. O seed é separado dos registros reais.
- Demonstração é ambiente fictício: telefone com DDD 00 permite mostrar o link sem indicar um número real; o WhatsApp pode recusar esse número. Substitua por número autorizado para validar entrega manual. O sistema nunca envia mensagem sozinho.
- Sem exclusão de contas por autosserviço. A anonimização de cliente preserva horários, serviços, valores e versão aceita, removendo nome/telefone da base ativa; backups antigos exigem política própria de expurgo.
- Fotos são recortadas circularmente no front-end e armazenadas como arquivo protegido; a rota pública só expõe fotos de profissionais de negócios aprovados. Não há antivírus nem serviço de processamento profissional de imagens.
- Política entregue é um modelo ilustrativo, não um texto jurídico final. Atualização de política deve seguir o procedimento da documentação.
- Listas do MVP têm limites internos (até 20 mil registros por leitura de estado e 50 mil visitas no resumo). Não há paginação avançada, exportação contábil ou operações distribuídas.
- PocketBase é anterior à versão 1.0: fixe versão, teste migrações e mantenha backups. A publicação real depende de servidor com disco persistente; este pacote não publica nem provisiona infraestrutura.

## Documentação oficial consultada
Versão atual verificada em 26/10/2026: **0.40.6**. Sintaxe validada executando o binário oficial, não apenas por inspeção.
- https://github.com/pocketbase/pocketbase/releases/tag/v0.40.6
- https://pocketbase.io/docs/js-migrations/
- https://pocketbase.io/docs/js-collections/
- https://pocketbase.io/docs/api-rules-and-filters/
- https://pocketbase.io/docs/js-overview/
- https://pocketbase.io/docs/js-database/
- https://pocketbase.io/docs/js-routing/
- https://pocketbase.io/docs/authentication/
- https://pocketbase.io/docs/going-to-production/
