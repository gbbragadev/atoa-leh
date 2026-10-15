# Validação — À toa, Leh

## Escopo e ambiente

Registro da **etapa 1: núcleo do ateliê**, executada em 30/09/2026 no horário local, com conclusão das rodadas em 01/10 entre 02:21 e 02:23 UTC. Projeto Windows, Node.js 24, build React/TypeScript/Vite e navegadores reais executados pelo Playwright. Emulação móvel com toque e viewport de iPhone 13, **390 × 844 CSS pixels**. Chromium e WebKit de desktop não equivalem a um iPhone físico.

O núcleo passou pelas rodadas de produção abaixo. A expansão posterior tem um registro próprio nesta página. Resultados da etapa 1 não aprovam automaticamente alterações posteriores. Os arquivos de evidência usados por algumas suítes são atualizados a cada execução; o horário e o escopo de cada rodada devem ser considerados.

## Resultados da etapa 1

| Verificação | Resultado observado | Evidência |
| --- | --- | --- |
| TypeScript e build de produção | Build concluído e servido para as rodadas em 5188 | `npm.cmd run build`; `dist/` |
| Lógica de jogos e validação de backup | **22/22 passaram**; inclui grades e respostas geradas por milhares de sementes | `npm.cmd test`; `tests/*.test.ts` |
| Pintura, cerâmica e gestos em Chromium | **13/13 passaram**, incluindo confirmação após commit e ausência de erros de console | `evidence/painting-results.json`, término 02:22:08 UTC |
| Jogos e fluxos em produção | **11/11 Chromium + 11/11 WebKit passaram** | `evidence/word-production-chromium.json`; `evidence/word-production-webkit.json` |
| Persistência, migração, falhas, backup e offline | **9/9 Chromium + 9/9 WebKit passaram**, com limites de método abaixo | `evidence/persistence-results.json`, término 02:23:25 UTC |

As rodadas anteriores encontraram seleção deslocada pelo scroll e uma coordenada SVG inválida na planta. Esses defeitos foram corrigidos e as suítes acima repetidas contra o build de produção. Arquivos anteriores marcados como `FAIL` ou `INVALIDATED` não representam a aprovação desse marco.

O resultado é de **75 verificações automatizadas**: 22 de lógica, 13 de pintura, 22 de jogos e 18 de persistência. O WebKit indisponível para áudio foi verificado pelo aviso correto e silêncio; não conta como teste de áudio funcionando nesse engine. A inspeção visual e os limites físicos são descritos separadamente.

## Expansão: resultados observados

Atualização final em **01/10/2026, 00:03 local**. A expansão preserva o núcleo e acrescenta cerâmica 3D, cenas e pincéis, jardim ampliado e mural local. O preparo automático do presente inicial autorizado e as correções da revisão também passaram por verificação na URL publicada.

| Verificação | Resultado confirmado até esta atualização | Evidência |
| --- | --- | --- |
| Testes de lógica e validação | **30/30 passaram**, incluindo seis testes de cerâmica e dois novos de validação estrita de backup | `npm.cmd test`; `tests/ceramic3d.test.ts`; `tests/backup.test.ts` |
| Regressão de pintura e cerâmica 2D | **13/13 passaram** no novo build de produção | `evidence/painting-results.json`, término 02:40:00 UTC |
| Biblioteca, materiais, cerâmica 3D e backup | **5/5 passaram** em Chromium contra produção | `evidence/expansion-results.json`, término 02:42:35 UTC |
| Jardim ampliado e offline dos novos módulos | **4/4 Chromium + 4/4 WebKit passaram** após correções, com render WebGL real offline nos dois engines | `evidence/garden-expansion.json`, término 02:50:47 UTC |
| Persistência, falhas e offline do núcleo após expansão | **9/9 Chromium + 9/9 WebKit passaram** na nova rodada | `evidence/persistence-results.json`, término 02:49:45 UTC |
| Jogos e fluxos após expansão | **11/11 Chromium + 11/11 WebKit remoto passaram**; o WebKit foi repetido contra a URL publicada | `evidence/word-production-chromium.json`; `evidence/word-e2e-remote-webkit-results.json`, término 02:57:37 UTC |
| Repetição WebKit local anterior | Timeout histórico durante build que esvaziava `dist/` simultaneamente; não é uma aprovação. A repetição remota posterior passou | `evidence/word-production-webkit-final.json`, falha preservada para histórico |
| Mural de fotos | **4/4 passaram em produção**; a prévia também havia passado | `evidence/photo-wall-results.json`, base `http://127.0.0.1:5188`, término 02:49:22 UTC |
| Presente inicial automático na URL publicada | **4/4 passaram**: primeiro acesso, offline, preservação de conteúdo pessoal e inclusão sem apagar criação/layout existente | `evidence/delivery-results.json`, base HTTPS publicada, término 02:54:01 UTC |
| Correções finais da revisão | **5/5 passaram na URL publicada**: rascunho, backup compacto, compartilhar/cancelar, compressão e localStorage bloqueado | `evidence/review-fixes-results.json`, término 02:59:37 UTC |
| Revisão assistida Claude Opus 5.5 | Concluída pelo modelo real `claude-opus-5-5`, xhigh; leitura de código e capturas, sem testes próprios | `.agent-loop/CLAUDE_REVIEW.md` |

A suíte de expansão verificou os 16 desenhos, três materiais de desenho livre, nove formatos de cerâmica, edição efetiva do perfil 3D, padrões/carimbos, desfazer/refazer, retomada, PNG renderizado, backup e ausência de confirmação falsa em falha de gravação. O WebGL utilizado foi o do Chromium no Windows, não o Safari do iPhone.

O mural foi verificado com imagem de teste criada localmente a partir da ilustração pública do app, sem utilizar fotos privadas. A rodada importou a foto pela UI, moveu por toque real via CDP, testou os três fundos e molduras, giro, tamanho, enquadramento, desfazer e retomada. O PNG real de **1800 × 1400** foi decodificado, guardado, exibido na prateleira e baixado; backup restaurou composição e imagem. Não houve requisições para fora da origem nessa sessão. A câmera física não foi acionada.

O jardim confirmou 14 elementos, seis vasos, edição, duplicação, tamanho/giro, PNG, backup, composições com confirmar/cancelar/Escape/desfazer e compatibilidade de dados antigos. Após preparar somente a tela inicial, os 16 desenhos, três materiais, jardim ampliado e cerâmica 3D abriram offline; a peça 3D alterada foi renderizada e guardada nos dois engines. Os métodos de bloqueio de transporte do WebKit permanecem distintos de um iPhone em modo avião.

Revisão de código assistida, build e dry run de publicação são verificações diferentes. Nenhum deles comprova câmera, GPU, gestos ou retenção de dados no aparelho físico.

Há **109 verificações distintas aprovadas entre as rodadas**, contando 30 de lógica, 13 de pintura, 22 de jogos, 18 de persistência, cinco de expansão, oito de jardim/offline, quatro de mural, quatro de entrega remota e cinco de correções finais. Os 11 casos WebKit remotos substituem os anteriores nessa contagem; não são somados duas vezes. As rodadas têm escopos e horários diferentes, e nem todas foram repetidas após cada alteração. A revisão por leitura não conta como teste executado.

## Revisão e correções finais

O relatório Claude leu código e capturas, sem executar build, testes, navegador ou iPhone. Ele retrata os achados antes das correções. Foram corrigidos **A1, A2, A3, M1 e M7**: fotos de Preferências passam pela mesma preparação JPEG de até 1600 pixels do mural; o editor persiste o rascunho; backup usa `File` JSON e compartilhamento quando aceito, com download alternativo e mensagens sem afirmar salvamento; a cópia antiga de rascunho no localStorage foi retirada; JSON é compacto e importação acima de 80 MB recebe `BackupValidationError`.

As cinco verificações remotas conferiram esses fluxos. `navigator.canShare` e `navigator.share` foram interceptados para verificar os ramos e o arquivo real produzido; **não foi aberto o painel nativo do iPhone**. O teste de localStorage injeta `SecurityError` enquanto IndexedDB permanece nativo. A correção não equivale a comprovar o comportamento físico do iOS.

**Achados médios ainda registrados, sem afirmar revisão zerada:** M2, confirmação antes de limpar/trocar uma peça e histórico que só vive enquanto a tela fica aberta; M3, área de seleção e dica do modo mover no jardim; M4, distância do desfazer da cerâmica e mudanças de câmera no histórico; M5, desempenho do desenho livre com muitos traços; M6, separação potencial entre armazenamento Safari/PWA. A documentação orienta exportar/importar nessa transição, mas o aparelho físico permanece sem verificação. Outros achados de baixa gravidade e sugestões estão no relatório original.

Na URL publicada, um perfil novo recebeu a carta correspondente ao conteúdo aprovado, três bilhetes, três perfis de gatos, 12 imagens e o mural, sem importação manual. A rodada confirmou o asset inicial no precache, recarga offline com o mural, interação 3D WebGL e exportação de backup sem conexão. Também verificou que duas reaberturas preservam um presente pessoal existente e que um perfil com criação/layout anteriores recebe o conjunto inicial sem perder esses dados ou duplicar fotos. Não houve erros de página ou console; os textos pessoais não foram escritos na evidência, que usa hashes para comparações.

## Critérios de aceite e método

| Critério | Verificação real |
| --- | --- |
| Atividade em até dois toques após apresentação | E2E de entrada e navegação móvel, sem conta ou questionário |
| Pintar, desfazer, mudar de tela e reabrir preserva estado | Toques reais via CDP, leitura IndexedDB e fechamento/reabertura de página |
| Peça personalizada permanece no cantinho | PNG real com cores/carimbos/planta, transação concluída, inspeção de imagem e reabertura |
| Caça-palavras jogável e grades válidas | Validação por sementes; seleção direta, inversa, toque/arrasto e retomada nos dois engines |
| Offline e sons desligados | Build de produção com service worker, preparo só da tela inicial e transporte bloqueado; observação da criação de áudio |
| Backup restaura e falhas não confirmam save | Exportar/importar pela UI, conferir registros e bytes de imagem; quota e abort injetados no IndexedDB |
| Sem cobranças, falsos botões ou exposição | Inspeção de telas, execução dos controles, rastreamento de requisições e conferência do conteúdo do build |

## Limites dos testes

- **Offline Chromium:** o contexto Playwright pode ser colocado sem conexão, incluindo recarga e abertura dos módulos antes não visitados.
- **Offline WebKit no Windows:** `context.setOffline(true)` causa erro interno do driver durante recarga. A alternativa é bloquear o transporte HTTP do servidor de teste e conferir recarga, imagens, fontes e atividades a partir do cache. Nesse método, `navigator.onLine` continua `true`; não deve ser relatado como modo avião do iOS.
- **Áudio WebKit no Windows:** esse ambiente não disponibiliza `AudioContext`. A interface informa a indisponibilidade sem afirmar que o som foi ligado. O funcionamento do áudio é verificado no Chromium e ainda precisa ser conferido no Safari do aparelho.
- **Segundo plano:** `visibilitychange` e `pagehide` são simulados para observar salvamento e suspensão de áudio. Fechar e reabrir a página é uma ação real; suspensão ou descarte pelo iOS não foi reproduzido.
- **Quota e transações:** falhas são injetadas nos métodos nativos de IndexedDB. O teste observa o aviso, ausência de confirmação falsa, registros persistidos, rollback e recuperação. Isso não mede a quota física de um iPhone.
- **Atualização:** um servidor local de teste entrega o build e uma revisão do service worker para verificar que a página não recarrega durante interação. A publicação final autorizada foi verificada separadamente.
- **WebGL:** o torno 3D é validado somente quando o renderer abre e a peça modificada é renderizada. Uma mensagem de fallback correta não conta como modelagem 3D funcionando. A disponibilidade e desempenho no Safari físico ainda não foram verificados.
- **Câmera e fotos:** `capture="environment"` solicita a câmera traseira quando o navegador oferece esse fluxo. Uma seleção de arquivos automatizada verifica importação, não comprova câmera ou galeria nativa do iOS. HEIC é recusado com orientação para escolher JPEG, PNG ou WebP; conversão nativa pelo sistema não foi comprovada.
- **Mural:** composição local por imagens. Não há reconstrução 3D, fotogrametria, LiDAR ou upload para terceiros.

## Inspeção visual em navegador

Capturas do núcleo disponíveis em `evidence/desktop-home.png`, `evidence/mobile-home-final.png`, `evidence/mobile-paint-refined.png` e `evidence/mobile-clay-final.png`; a expansão acrescenta `evidence/atelier-expanded-mobile.png` e `evidence/ceramic-mobile.png`. A revisão das capturas de pintura e cerâmica observou hierarquia legível, área de criação em destaque e controles de zoom separados da seleção de cor. Revisar imagens de evidência não equivale a executar gestos no navegador.

A suíte executou rotação entre **390 × 844** e **844 × 390**, conferindo que a largura do documento e do corpo não ultrapassavam a tela, tanto na pintura quanto na prateleira. Os controles de zoom tiveram alvos de pelo menos **44 × 44 CSS pixels**. Uma captura isolada não prova gestos ou persistência.

## Não verificado em aparelho físico

**Não foi usado um iPhone físico.** Permanecem pendentes no aparelho: barras reais do Safari, áreas seguras em diferentes modelos, seletor de cores/arquivos, compartilhamento e download nativos, suspensão pelo sistema, permanência dos dados entre Safari e PWA instalada e retenção do armazenamento ao longo do tempo.

**Não há Mac/Xcode ou IPA compilado nesta validação.** Capacitor está configurado; assinatura, execução nativa, TestFlight e App Store não foram demonstrados. A instalação da PWA requer endereço HTTPS e verificação no Safari real. O servidor HTTP local no PC e o portal do Maestri são prévias.

Cloudflare Pages ficou bloqueado pela permissão disponível. Leitura de Workers e dry run de assets estáticos passaram. A publicação autorizada por Workers está disponível em **https://atoa-leh.gbbraga-dev.workers.dev**, com **HTTP 200 confirmado**, versão final `f8a789bc-f2d6-484b-86b9-f6304cb1bc6a`, bundle `index-C6u8vvzN`. O teste remoto de entrega passou **4/4**, as correções finais **5/5** e o WebKit remoto **11/11**, separados da simples resposta HTTP 200. Nenhuma instalação física de iPhone foi demonstrada.

O envio WhatsApp recebeu **HTTP 201 às 23:59:59 locais de 30/09/2026**, mensagem `3EB0EB36A00E34D77E087C`, status **PENDING**, conforme `evidence/whatsapp-send.json`. A API aceitou o envio; não há comprovante de entrega no aparelho nem de leitura.

Guilherme também autorizou o conjunto inicial público: carta, bilhetes, nomes dos gatos e 12 fotos, preparado em `public/presente/inicial.json`. Essa é uma mudança expressa em relação à importação privada do briefing inicial. O asset pode ser obtido por quem acessa o app. Novas criações, mensagens e importações continuam no IndexedDB, sem upload. O arquivo de backup oferecido separadamente é opcional para a primeira abertura do telefone, que já recebe o conjunto inicial.

## Reproduzir

~~~powershell
cd C:\Projects\cantinho-leticia
npm.cmd run build
npm.cmd test
npx.cmd playwright install chromium webkit
npm.cmd run preview
~~~

Em outro terminal, com a porta 5188 servindo o build:

~~~powershell
node tests/painting.mjs
node tests/e2e.mjs --browser chromium
node tests/e2e.mjs --browser webkit --output evidence/word-e2e-webkit-results.json
node tests/persistence.mjs
node tests/expansion.mjs --base-url http://127.0.0.1:5188 --output evidence/expansion-results.json
node tests/garden-expansion.mjs
node tests/photo-wall.mjs --base-url http://127.0.0.1:5188 --output evidence/photo-wall-production.json
node tests/delivery.mjs --base-url https://atoa-leh.gbbraga-dev.workers.dev --output evidence/delivery-results.json
node tests/review-fixes.mjs --base-url https://atoa-leh.gbbraga-dev.workers.dev
~~~

O lançador do presente usa um perfil separado; os testes não alteram essa carta, fotos ou criações. Evidências em evidence/ podem conter capturas e dados de teste e não são publicadas pelo build.
