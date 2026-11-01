# Coleções, campos e acesso — 0.40.6

A migração é a fonte executável das regras. Todas as coleções têm `id` nativo e `created`/`updated` (autodate). Datas de eventos são UTC. Valores monetários são inteiros em centavos. Relações simples têm `maxSelect:1`; múltiplas, `maxSelect:100`.

| Coleção | Campos adicionais e tipos |
|---|---|
| `users` (auth) | `email`, `password` e recursos de autenticação nativos; `name` text; `business` relation→businesses |
| `_superusers` (auth nativa) | Identidade e senha nativas do administrador. Substitui a antiga nomenclatura de administradores, sem criar coleção `admins` |
| `businesses` | `name`, `city`, `slug`, `privacy_policy_version`, `cutoff` text; `branch` select(salao/barbearia/clinica_estetica); `status` select(pending/approved/rejected); `owner` relation→users; `approved_by` relation→_superusers; `approved_at`, `rejected_at` date; `palette` JSON; `is_demo` bool; `demo_branch`, `demo_owner`, `seed_anchor` text; `revision` integer |
| `professionals` | `business` relation; `name`, `whatsapp` text; `photo` protected file (PNG/JPEG/WebP, até 1 MiB); `working_hours` JSON; `illustration` select(avatar-1/2/3) |
| `services` | `business` relation; `name` text; `duration_minutes` integer(15–600); `price_cents` integer; `professional_ids` relation múltipla→professionals |
| `bookings` | `business`, `professional`, `service` relations; `date` text(AAAA-MM-DD); `start_time`, `end_time` text(HH:mm); `client_name`, `client_phone` text; `status` select(scheduled/attended/no_show/cancelled/other_service); `final_service` relation→services; `final_price_cents` integer; `consent_accepted_at` date; `consent_policy_version` text; `reviewed_by` relation→users; `reviewed_at` date; `source` select(verified/declared); `is_anonymized` bool; `duration_minutes` integer(snapshot da duração) |
| `audit_log` | `business` relation; `entity`, `entity_id`, `action`, `actor` text; `before`, `after` JSON; `created_at` date |
| `visits` | `page` select(home/demo); `visited_at` date; `anonymous_session` text(UUID). Sem campos de IP, nome, telefone ou e-mail |
| `schedule_blocks` | `business`, `professional` relations; `date`, `start_time`, `end_time`, `reason` text |
| `demo_sessions` | `business` relation; `session_hash` text(SHA-256); `state` JSON; `expires_at` date |
| `access_log` | `business`, `user` relations; `accessed_at` date. Acesso com senha do dono, sem confundir refresh com novo login |
| `policy_versions` | `version`, `title`, `body` text; `scope` select(owner/client); `active` bool |
| `policy_acceptances` | `business`, `user` relations; `policy_version` text; `accepted_at` date |

JSONs:

```json
{"primary":"#5b3fb5","accent":"#16624b","background":"#f5f3fa"}
```

`working_hours`: objeto com `start`/`end` em HH:mm e `days` com números de dias da semana (0=domingo). A jornada usada pelo seed e pelo adaptador preserva esse formato.

## Regras nativas

`null` bloqueia a operação para clientes comuns. `""` permite sem autenticação. Regras de listagem filtram registros: uma lista vazia pode representar acesso negado. Superusuários nativos têm bypass das regras de API, mas hooks adicionais ainda validam as operações.

Expressão **OWN**, usada nos registros de um estabelecimento:

```text
@request.auth.id != "" && @request.auth.collectionName = "users" && business.owner = @request.auth.id && business.status = "approved" && business.is_demo = false
```

| Coleção | Listar / ver | Criar | Alterar | Excluir |
|---|---|---|---|---|
| users | `id = @request.auth.id` | null; rota `/register` atômica | próprio id e business.status approved | null |
| businesses | `owner = @request.auth.id && @request.auth.id != ""` | null; rota `/register` | próprio owner, approved, is_demo=false | null |
| professionals, services | OWN | OWN | OWN | null |
| bookings | OWN | `business.status = "approved" && business.is_demo = false` | OWN | null |
| schedule_blocks | OWN | OWN | OWN | OWN |
| audit_log | OWN | null | null | null |
| visits | null | `""` | null | null |
| access_log, policy_acceptances | OWN | null | null | null |
| policy_versions | `active = true` | null | null | null |
| demo_sessions | null | null | null | null |

A API pública de estabelecimentos é uma projeção explícita das rotas próprias, sem acesso nativo anônimo a `businesses`/`professionals`/`services`. Nunca inclui dono, acesso ou reservas. Estabelecimento pendente/recusado não é publicado.

## Proteções adicionais nos hooks

- Dono não muda owner, business, status de aprovação, is_demo, identidade ou campos administrativos por payload forjado. Relações entre estabelecimentos são rejeitadas no servidor.
- Reserva anônima é forçada para scheduled/verified, preço da tabela, duração integral, consentimento atual e carimbo do servidor. Não aceita conferência ou preço arbitrários do cliente.
- Alteração de status/serviço/valor pelo dono recalcula `reviewed_by`/`reviewed_at`. Auditoria é gravada pelo servidor na mesma transação, com ator e antes/depois sem nome/telefone do cliente.
- Conflito: hook verifica profissional/data/intervalo e jornada; gatilhos SQLite também impedem sobreposição no momento da gravação, inclusive sob concorrência. Só cancelled libera o intervalo; no_show continua bloqueando conforme regra solicitada.
- Foto protegida: a rota de exibição libera somente profissionais de estabelecimento aprovado. Não há acesso público ao arquivo nativo protegido.
- Nenhum cliente altera audit_log/access_log/demo_sessions/policy_acceptances diretamente; hooks recusam até chamadas nativas de escrita desses registros feitas pelo superusuário. Código de servidor usa `app.save`.
- Campos reservados de demo são operados pelo seed e pelas rotas de demonstração. Demonstração não passa pelas APIs reais do dono.

## Evolução de política

Com backup e janela de manutenção, crie a nova versão em `policy_versions` pelo administrador nativo, desative a anterior do mesmo scope e mantenha **uma única versão ativa por scope**. Para política client, atualize `privacy_policy_version` dos negócios reais aprovados para a nova versão; os próximos agendamentos exigirão novo aceite. Reservas anteriores conservam a versão original. Política owner exige novo aceite no próximo acesso ao painel. Não edite texto de uma versão já aceita; publique outra versão.
