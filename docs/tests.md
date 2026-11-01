# Roteiro de testes

## Teste automatizado com o servidor real

Depois de baixar o PocketBase 0.40.6:

```sh
npm test
```

Para usar outro caminho, defina `PB_BIN` no ambiente do terminal. O teste usa banco temporário separado, porta livre e credenciais aleatórias descartáveis de teste; não usa as contas da aplicação nem imprime a senha. O banco temporário é removido ao terminar. Não execute contra base de produção.

Valida migração real, aprovação/recusa, senha nativa, isolamento de dois donos, sincronização com revisão, proteção contra manipulação de preço/status/ator, consentimento, oito reservas simultâneas (apenas uma salva), conflitos de jornada, auditoria, visitas sem dados pessoais, CORS, foto protegida, anonimização, seed idempotente e limite de login.

## Roteiro manual

1. **Aprovar cadastro.** Abra `/solicitar-acesso`, preencha dados de teste, defina sua própria senha e aceite a política. Confirme que o usuário não entra antes da aprovação. No `/admin`, aprove; verifique data, ator e mudança pending→approved. Entre como dono. Faça outro pedido e recuse: ele não consegue entrar. Aprovar novamente pedido decidido deve retornar 409.
2. **Dois donos.** Cadastre e aprove negócios A e B com e-mails distintos. Faça login em navegadores/perfis separados. Crie profissionais e serviços diferentes. Cada painel só mostra os seus dados. Via cliente HTTP, tente ler/alterar ID de A com token de B: listagem filtra, leitura/alteração recusa. Tente relacionar serviço de B ao profissional de A: servidor rejeita.
3. **Reserva concorrente.** Na página pública aprovada, escolha serviço/profissional/horário futuro e aceite a política. Em dois navegadores, tente confirmar o mesmo intervalo. Um salva; o outro recebe “Horário ocupado.”. Também tente intervalos parcialmente sobrepostos, reservas fora da jornada e um serviço maior que o intervalo final da jornada. A decisão do servidor prevalece sobre a disponibilidade exibida anteriormente.
4. **Bloqueios.** Dono bloqueia um intervalo livre; ele desaparece da disponibilidade pública. Bloquear intervalo já ocupado é recusado. Cancelar reserva libera o período. Faltou não libera automaticamente, conforme regra de conflito.
5. **Privacidade pública.** Sem token, tente GET na coleção bookings e em ID conhecido: não consegue obter dados. Tente página pública de negócio pendente/recusado: indisponível. Reserva sem aceite ou versão antiga é recusada; aceite válido fica com instante do servidor.
6. **Conferência.** Marque compareceu, faltou, cancelou e outro serviço. Ajuste preço manualmente e salve. Confira `reviewed_by`, `reviewed_at` e audit_log com antes/depois. Não é possível editar diretamente audit_log. Reserva scheduled após limite aparece como não conferida e fora do total confirmado. Verificado e declarado são somados separadamente; demo não aparece nos totais reais.
7. **Visitas e acessos.** Abra início e demonstração, recarregue e veja no painel admin total por data/página. Verifique em visits somente page, visited_at, anonymous_session e metadados nativos, sem IP/e-mail. Login do dono gera access_log; refresh de token não gera acesso duplicado. Dono não lista visits.
8. **Sincronização e conflito de edição.** No celular, crie serviço; confira no computador com o mesmo login após até 15 segundos. Alterar estado com revisão antiga é recusado, evitando sobrescrever edição alheia. Não há sincronização offline.
9. **Demonstração.** Entre sem login, confira faixa em painel e página pública, altere paleta e salve. Recarregar mantém a cópia no servidor. Outro perfil anônimo mantém cópia separada. Troque entre os três ramos. Avatares são ilustrações; números são fictícios e não devem receber mensagem real.
10. **WhatsApp.** Com número autorizado em profissional real de teste, confira mensagem com serviço/data/horário/nome codificados na URL; envio depende do clique e da confirmação no WhatsApp. Sem número, botão oculto e aviso ao dono. Nenhuma mensagem automática é disparada.
11. **Foto e paleta.** Envie PNG/JPEG/WebP, use recorte e confira exibição circular. Teste iniciais sem foto. Paleta de baixo contraste gera aviso e recusa no servidor abaixo de 4,5:1 nas combinações usadas. Confirme prévia responsiva.
12. **Anonimização.** No painel do dono, exclua dados de um cliente de teste; confirme que nome/telefone saem das reservas correspondentes e os valores/serviços permanecem. Outro negócio não é afetado. Auditoria não preserva nome/telefone apagados.
13. **Responsividade.** Abra `responsive-test.html` ou DevTools e teste 360×800, 767, 768, 1024, 1025 e 1440px. Confira viewport, menu, tabela semanal, cards de conferência, botão confirmar tudo, foco de teclado e alvos de pelo menos 44px. A disponibilidade depende do servidor estar ativo também nos iframes.
14. **Segurança de publicação.** Teste Origin diferente (403), repetidas falhas de login (429), HTTPS, reinício com dados preservados e restauração de backup. Não envie senhas/tokens nas evidências.

## Evidências desta entrega

Executável oficial **0.40.6**: integração aprovada com 8 tentativas simultâneas e apenas 1 reserva salva. Front-end: demonstração aberta pelo navegador, nome alterado e persistência confirmada após recarregar. O teste automatizado cobre as APIs; não substitui validação com aparelhos físicos nem revisão independente de segurança/acessibilidade.
