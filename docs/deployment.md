# Publicação e variáveis

PocketBase 0.40.6 usa SQLite e precisa de **um processo e disco persistente**. Uma VM Linux com volume persistente é a opção mais simples. O software é gratuito; domínio, servidor e backups podem ter custo. Não use hospedagem estática, Workers ou funções efêmeras para executar esse backend. O pacote não provisiona servidor nem faz publicação automática.

## Variáveis

| Variável | Uso |
|---|---|
| `FRONTEND_ORIGIN` | Origem exata do site, com https em produção e sem barra final; também configura a allowlist CORS |
| `PB_HTTP` | Interface/porta de escuta; mantenha `127.0.0.1:8090` atrás do proxy |
| `PB_DATA_DIR` | Diretório persistente e privado do banco/arquivos |
| `PB_BIN` | Caminho opcional do executável oficial; padrão na raiz |
| `PB_URL` | URL usada pelo script seed para alcançar o servidor |
| `PB_ADMIN_EMAIL` | E-mail do superusuário definido por você; somente para executar seed |
| `PB_ADMIN_PASSWORD` | Senha definida por você; somente para seed, nunca no navegador/Git |
| `PB_ENCRYPTION_KEY` | Opcional, chave de 32 caracteres definida por você; criptografa configurações do PocketBase, **não** o banco inteiro |
| `VISIT_RETENTION_DAYS` | Retenção dos registros de visita, padrão 30 dias; limpeza horária |

`pb_public/config.js` contém somente `AGENDAPRO_API_BASE`, que é informação pública, não segredo. Padrão vazio: frontend e backend na mesma origem. Se separar hospedagens, defina a URL pública do PocketBase ali e a origem única do frontend em `FRONTEND_ORIGIN`. Não use `*`. Chamadas servidor-servidor sem Origin continuam possíveis; CORS não substitui autenticação/regras.

## VM Linux, HTTPS e serviço

1. Instale Node 24, curl, unzip e Caddy por fontes oficiais do sistema. Crie um usuário de serviço sem privilégios chamado `agendapro`; envie este projeto para `/opt/agendapro`, com propriedade desse usuário. Não envie dados de testes.
2. Execute `npm run download` na pasta. Copie `.env.example` para `.env`, escolha a origem HTTPS real e mantenha a escuta local. Restrinja permissões de `.env` e `pb_data` ao usuário do serviço. Abra somente SSH/HTTP/HTTPS no firewall.
3. Antes de expor o instalador, faça o primeiro início por SSH e acesse o instalador usando túnel local (`ssh -L 8090:127.0.0.1:8090 seu-servidor`). Durante essa configuração, use temporariamente a origem local em `.env`. Defina seu próprio superusuário na interface nativa. Pare e ajuste a origem HTTPS final.
4. Crie `/opt/agendapro/pb_data` com propriedade do usuário de serviço. Instale o serviço `deploy/agendapro.service` em `/etc/systemd/system/`, ajustando o caminho do Node se necessário. Habilite com `sudo systemctl enable --now agendapro`. A migração executa no primeiro início; se falhar, corrija antes de expor o site.
5. Configure o domínio real no Caddyfile entregue e aponte DNS para a VM. Reinicie/recarregue Caddy. Ele obtém HTTPS automaticamente quando DNS e portas estão corretos. Logs de acesso não são habilitados nesse exemplo.
6. Execute seed no servidor com suas credenciais definidas temporariamente no ambiente/`.env`. Retire-as depois. Teste em `https://SEU_DOMINIO` e `/admin` usando credenciais definidas por você. O próprio PocketBase também oferece a administração nativa em `/_/`; considere restringi-la por VPN/proxy e configurar MFA nativo.

O unit usa `node --env-file=.env scripts/start.mjs`. Não há nginx obrigatório nem container obrigatório. Não lance duas instâncias apontadas para a mesma base. Se precisar de escalabilidade horizontal, reavalie a arquitetura.

## Backups e operação

- Faça backups consistentes pelo recurso nativo do PocketBase, incluindo banco e arquivos; armazene cópia externa criptografada e teste restauração. Alternativamente pare o serviço antes de copiar `pb_data` inteiro.
- Guarde separadamente a chave opcional de criptografia. Sem ela, configurações criptografadas não serão recuperáveis.
- O rollback destrutivo dessa primeira migração é bloqueado deliberadamente: restaure um backup em outro diretório/instância.
- Atualize primeiro numa cópia de homologação. O projeto fixa 0.40.6; mudança de versão exige revisar APIs, hooks e testes. Não atualize binário de produção automaticamente.
- Logs operacionais de stdout/journal continuam existindo, mas o projeto não imprime senhas, cliente ou token. Revise retenção do journal, proxy, CDN e provedor. Log HTTP persistido nativo desativado, `logIP=false`.
- Anonimizar cliente na base ativa não apaga backups históricos: estabeleça prazo de retenção e restauração que reaplique exclusões antes de reabrir acesso.
- Rate limit: 8 tentativas de autenticação/15 minutos e 5 cadastros/15 minutos por chave do limiter nativo; limites adicionais nas APIs. Proxies devem transmitir IP real somente de redes confiáveis; não confie indiscriminadamente em cabeçalhos públicos. O IP não é gravado nas visitas.

## Verificação após publicar

Faça o roteiro de `tests.md`; confira CORS com origem divergente, acessos de dois donos, seed isolado, privacidade e retenção. Publique sua política final antes de aceitar dados reais. Não exponha `.env`, `pb_data` nem scripts ao servidor estático: somente `pb_public` é servido.
