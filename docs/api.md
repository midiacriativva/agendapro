# API e segurança

O adaptador usa `fetch`, sem dependência de SDK. Autenticação nativa:

- Dono: `POST /api/collections/users/auth-with-password`.
- Administrador: `POST /api/collections/_superusers/auth-with-password`.
- Corpo: `{identity: email, password: senha}`. Não há senha pronta no código.
- Demais chamadas privadas: `Authorization: TOKEN` (token nativo PocketBase). Token guardado em sessionStorage da aba; logout o remove. Tokens já emitidos permanecem válidos até expirar; não há painel próprio de revogação global.

## Rotas próprias: prefixo `/api/agendapro`

| Método e caminho | Acesso e finalidade |
|---|---|
| GET `/policies/{scope}` | Público, scope owner/client; texto e versão ativa |
| POST `/register` | Público, cria usuário e negócio pending juntos, com aceite owner; corpo owner, business, city, branch(beauty/barber/clinic), email, password, consent:{accepted:true,version} |
| GET `/me` | Autenticado: identificação e necessidade de aceite |
| POST `/policy-acceptances` | Dono: accepted:true, version |
| GET `/admin/overview` | Superusuário: cadastros reais, decisões e visitas por dia/página |
| POST `/admin/businesses/{id}/decision` | Superusuário: corpo {decision:"approved"} ou {decision:"rejected"}; apenas pendências, com auditoria |
| GET/PUT `/owner/state` | Dono aprovado com aceite atual: projeção compatível com interface e gravação transacional com revision |
| GET `/owner/revenue?month=AAAA-MM` | Dono: totais confirmados verified/declared |
| GET `/owner/clients` | Dono: clientes do próprio negócio, id representado por uma reserva |
| DELETE `/owner/clients/{id}` | Dono: confirm:true; anonimiza nome/telefone das reservas correspondentes dentro do seu negócio |
| GET `/public/{slug}` | Público: configuração aprovada e profissionais/serviços, sem dados de reservas |
| GET `/public/{slug}/availability` | Público: consulta pro, service e date; retorna somente horários disponíveis |
| GET `/photos/{id}` | Público: arquivo protegido de profissional de negócio aprovado |
| POST `/demo/open` | Público: session(UUID), branch(beauty/barber/clinic), reset opcional |
| GET/PUT `/demo/state` | Público com UUID de demonstração; cópia temporária isolada no servidor |

Consulte `routes.js`/`backend.js` para o formato exato das projeções e parâmetros. A compatibilidade de state evita redesenhar as telas: apenas a persistência é substituída. O servidor não confia no JSON completo: verifica propriedade, revisão, relações, campos permitidos, valores e jornada. O cliente não pode injetar business_id para assumir outra conta.

## Reserva pública nativa

`POST /api/collections/bookings/records` sem login. Corpo de exemplo estrutural (substitua IDs por dados aprovados, nunca use literais como registros):

```json
{
  "business":"ID_DO_NEGOCIO",
  "professional":"ID_DO_PROFISSIONAL",
  "service":"ID_DO_SERVICO",
  "date":"AAAA-MM-DD",
  "start_time":"10:00",
  "client_name":"NOME_INFORMADO",
  "client_phone":"DDD_E_NUMERO",
  "consent_accepted":true,
  "consent_policy_version":"VERSAO_ATIVA"
}
```

`end_time`, preço, source e status são calculados/forçados pelo hook. Nome e telefone ficam somente no registro necessário ao agendamento. A resposta de criação corresponde à própria reserva; não autoriza listagem/leitura posterior de reservas de terceiros. Conflito retorna 409 com **Horário ocupado.**. Jornada, duração ou serviço inválidos retornam erro 400; aceite ausente/antigo, 428. Slots retornados não garantem reserva: a decisão final acontece atomicamente na gravação.

`POST /api/collections/visits/records`: page home/demo e anonymous_session UUID aleatório do navegador; visited_at sempre sobrescrito pelo servidor. Somente superusuário lista visitas.

## WhatsApp, corte de conferência e privacidade

O botão monta `https://wa.me/55` + número com DDD + `?text=` + `encodeURIComponent(mensagem)`. Só abre após clique; cliente ainda confirma envio no aplicativo. Sem WhatsApp cadastrado, botão oculto e aviso no painel do dono.

Status `scheduled` não é receita confirmada, mesmo após o corte. `attended` e `other_service` entram em verified ou declared conforme source; `no_show`/`cancelled` não entram. O front-end apresenta “não conferido” quando passa a data/hora limite e a reserva segue scheduled. Todo ajuste de conferência grava ator, instante e diferenças no servidor, inclusive ajuste manual de valor. Administrador aprova/recusa via transação e gera auditoria.

Travas SQL complementam os hooks (não apenas verificação no navegador). No JSVM, dependências são carregadas dentro dos handlers e `runInTransaction` usa exclusivamente a aplicação transacional. Chamadas diretas à API nativa também passam por validação e auditoria.
