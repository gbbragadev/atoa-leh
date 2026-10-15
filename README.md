# À toa, Leh

**Abrir o presente:** [atoa-leh.gbbraga-dev.workers.dev](https://atoa-leh.gbbraga-dev.workers.dev). A carta, os três gatos, as 12 fotos e o mural inicial já são preparados no primeiro acesso, sem importar JSON. O endereço de produção respondeu HTTP 200 após a publicação.

**Seu cantinho, sem pressa.** Um presente do Guilherme para a Letícia: pintar, decorar peças e guardar as invenções numa prateleira. Gatos, plantas, cerâmica, crochê e pequenos cotidianos dão o tom. Sem anúncios, compras, metas, contadores de ausência ou tarefas de cuidado.

O núcleo é um ateliê de pintura por regiões, com paletas, cor livre, desfazer/refazer e zoom. A cerâmica ilustrada continua disponível para cores, carimbos e uma planta decorativa. A expansão acrescenta um torno 3D, mais cenas e materiais de pintura, um jardim ampliado e um mural de fotos. Desenhos e peças entram no cantinho com a imagem personalizada, mesmo incompletos. Caça-palavras em português e outras brincadeiras ficam a um toque da entrada.

React, TypeScript e Vite foram preservados; Three.js desenha a cerâmica 3D no próprio dispositivo. O build prepara uma PWA; há também configuração Capacitor para iOS. Novas obras, rascunhos, prateleira, partidas, ajustes e importações ficam no IndexedDB do dispositivo. Não há conta, backend, analytics, serviço de IA no aplicativo ou sincronização entre aparelhos.

Guilherme autorizou publicar o presente inicial: carta, bilhetes, nomes dos gatos e 12 fotos. Esse conjunto está em `public/presente/inicial.json` e é um **asset público**, preparado automaticamente no primeiro acesso. As criações e fotos que ela acrescentar depois continuam locais e não são enviadas ao site.

## O que dá para inventar

| Mesa | Opções |
| --- | --- |
| Pintar | 16 cenas em quatro categorias: Bigodes, Plantinhas, Cantinhos e Feito à mão; no desenho livre, caneta, giz e aquarela |
| Decorar uma peça | Cerâmica 2D com vasinho, pratinho e gatinho; cores, carimbos e planta opcional |
| Moldar com as mãos | Nove formatos iniciais no torno 3D; alargar, afinar, alisar ou ondular; nove padrões, quatro carimbos, acabamento fosco ou brilhante e desfazer/refazer |
| Jardim de janela | 14 plantas e pequenos elementos, seis modelos de vasos, cores livres, duplicar, girar e mudar tamanho; três composições iniciais editáveis |
| Mural de recortes | Fotografar ou escolher imagens locais; três molduras e três fundos; arrastar, girar, dimensionar, preencher a moldura ou ver a foto inteira, desfazer e guardar a composição |

A cerâmica 3D é uma peça de torno: o dedo altera faixas de um perfil radial com 32 amostras. Ela não simula toda a física da argila nem permite esculpir formas arbitrárias. O PNG de 1000 × 1000 guardado na prateleira vem do render da peça personalizada. A textura admite até 120 carimbos por peça; o app avisa quando esse espaço termina e permite desfazer ou tirar os carimbos. Se WebGL não estiver disponível, o aplicativo explica a limitação e dá acesso à cerâmica ilustrada.

O mural reproduz o cotidiano **por fotos**. Não reconstrói objetos em 3D, não faz fotogrametria e não usa LiDAR. A opção atual mantém imagens e composições no aparelho, sem enviá-las para uma API.

## Abrir o presente no Windows

Requer Node.js 24 e npm. Na primeira preparação:

~~~powershell
cd C:\Projects\cantinho-leticia
npm.cmd install
npx.cmd playwright install chromium
npm.cmd run build
npm.cmd run presente
~~~

Nas próximas vezes, dê dois cliques em **ABRIR-PRESENTE.cmd**. O lançador abre uma janela visível com perfil exclusivo em `.local/lehs-browser`, preservando os dados entre aberturas. Ele usa o build existente, inicia o preview se necessário e mantém o servidor rodando quando a janela fecha. Depois de alterar código, rode `npm.cmd run build` novamente: o lançador não recompila um `dist` que já existe.

O primeiro acesso já prepara o conteúdo inicial autorizado. O lançador também pode importar `personalizacao/presente.private.json` e fotos de `.local/referencias` pelos controles do aplicativo quando esses conteúdos ainda não existem no perfil. Se já houver textos ou fotos, preserva a seleção atual. O perfil e os arquivos de personalização continuam fora do Git; o conjunto inicial autorizado tem sua cópia pública própria.

**Presente e testes de produção:** http://127.0.0.1:5188. Abrir esse endereço em outro perfil de navegador cria outro armazenamento. Para retomar o presente preparado, use o lançador.

## Repositório e alterações pelo ChatGPT

Repositório público: **https://github.com/gbbragadev/atoa-leh**, branch principal `main`.

Para disponibilizar o código no ChatGPT, abra **Configurações → Plugins → GitHub** e autorize o acesso ao repositório `gbbragadev/atoa-leh`. Repositórios novos podem demorar alguns minutos para aparecer. Consulte as [instruções oficiais da OpenAI](https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt).

O conector GitHub comum do ChatGPT permite leitura e análise, não gravação de código. Para editar e enviar alterações ao GitHub, use Codex com acesso ao repositório. No DOTS, confirme quais ferramentas e permissões estão disponíveis antes de pedir alterações; publicar o repositório não configura essas permissões.

Alterar o repositório não publica automaticamente uma nova versão do site. A publicação continua separada, por Cloudflare Workers. Perfis de navegador, personalização privada, backups, evidências e credenciais locais ficam fora do Git.

## Acompanhar e desenvolver

A prévia de desenvolvimento fica no portal Maestri **“À toa, Leh — ao vivo”**, em **http://127.0.0.1:5189**. Ela acompanha alterações de código pelo Vite:

~~~powershell
npm.cmd run dev -- --port 5189
~~~

O comando `npm.cmd run dev` sem essa opção usa 5188. Para acompanhar o desenvolvimento enquanto o build de produção é testado, mantenha as portas separadas. Cada origem — inclusive portas diferentes — tem seus próprios dados locais.

| Ação | Comando |
| --- | --- |
| TypeScript e build de produção | `npm.cmd run build` |
| Servir o build em 5188 | `npm.cmd run preview` |
| Testes de lógica, grades e validação de backup | `npm.cmd test` |
| Pintura, cerâmica e gestos de toque | `node tests/painting.mjs` |
| Fluxos no Chromium | `node tests/e2e.mjs --browser chromium` |
| Fluxos no WebKit | `node tests/e2e.mjs --browser webkit --output evidence/word-e2e-webkit-results.json` |
| Persistência, falhas, migração, backup e offline nos dois engines | `node tests/persistence.mjs` |
| Cenas, pincéis, cerâmica 3D, PNG e backup em produção | `node tests/expansion.mjs --base-url http://127.0.0.1:5188 --output evidence/expansion-results.json` |
| Jardim ampliado, composições e offline dos novos módulos | `node tests/garden-expansion.mjs` |
| Mural, importação local, touch, PNG e backup em produção | `node tests/photo-wall.mjs --base-url http://127.0.0.1:5188 --output evidence/photo-wall-production.json` |
| Primeiro acesso, presente inicial, preservação e offline na URL publicada | `node tests/delivery.mjs --base-url https://atoa-leh.gbbraga-dev.workers.dev --output evidence/delivery-results.json` |
| Correções finais de carta, backup, fotos e armazenamento na URL publicada | `node tests/review-fixes.mjs --base-url https://atoa-leh.gbbraga-dev.workers.dev` |

Para os testes de navegador, instale os engines com `npx.cmd playwright install chromium webkit` e mantenha o build servido em 5188. Os contextos de teste são separados do perfil do presente.

Conclua o build antes de iniciar os testes que usam o preview. Um build simultâneo pode esvaziar `dist/` enquanto o navegador carrega os arquivos; uma rodada WebKit encontrou esse caso e passou depois na URL publicada.

O E2E aceita `--base-url`, `--browser`, `--case`, `--output` e `--list`. Pintura usa `PAINTING_TEST_URL`. Persistência e jardim usam `PERSISTENCE_TEST_URL` e aceitam `--browser chromium`, `--browser webkit` ou `--case`; jardim também aceita `--list`. Expansão e mural usam 5189 por padrão: passe `--base-url` como acima para verificar o build de produção. Os arquivos de evidência ficam em `evidence/`, fora do Git. O resumo de resultados e limites está em [docs/VALIDACAO.md](docs/VALIDACAO.md).

## Personalizar carta, bilhetes, gatos e fotos

Os textos reais fornecidos por Guilherme estão em **personalizacao/presente.private.json**, junto dos perfis dos três gatos. Esse arquivo de edição está no `.gitignore`. A versão inicial autorizada desses conteúdos também está no asset público do presente. Para mudar somente neste aparelho, edite o arquivo de personalização e importe a nova versão em **Preferências → Importar carta e bilhetes**, ou use o editor do aplicativo. O lançador preserva textos já importados; editar um arquivo não sobrescreve automaticamente o que existe no navegador nem atualiza o conteúdo público.

Também é possível usar **Escrever ou editar** dentro do aplicativo. A carta e os bilhetes não dependem de jogar, concluir uma criação ou entrar em dias seguidos.

O editor guarda um rascunho enquanto você digita. Fechar, reabrir ou recarregar preserva esse texto; **Guardar as palavras** confirma a versão e limpa o rascunho. Isso continua sendo uma edição local.

Estrutura de um arquivo pessoal:

~~~json
{
  "version": 1,
  "letter": "Sua carta real, com quebras de linha escritas como \n.",
  "notes": ["Um bilhete seu."],
  "cats": [
    { "name": "Nome do gato", "coat": "orange" }
  ]
}
~~~

`cats` é opcional e aceita até três perfis: `orange` para laranjinha, `cow` para branco e cinza, `siamese` para siamês. Os nomes do conjunto inicial foram autorizados para publicação; alterações importadas depois ficam locais. A carta aceita até 16.000 caracteres; são permitidos até 200 bilhetes de 3.000 caracteres cada. `notes: []` é válido. O arquivo `personalizacao/exemplo.json` é marcado como demonstração e é recusado até que os textos sejam substituídos e `demo: true` seja removido.

Em **Importar fotos**, escolha JPG, PNG ou WEBP de até 15 MB cada. HEIC precisa de uma cópia JPG para esse fluxo. As fotos ficam no envelope e podem ser vistas como quadros locais. Veja [personalizacao/instrucoes.md](personalizacao/instrucoes.md) para detalhes.

No **Mural de recortes**, **Câmera** solicita uma foto pela câmera traseira quando o navegador oferece esse fluxo; **Galeria do iPhone** abre o seletor de imagens. O comportamento nativo depende do aparelho. Imagens aceitas são preparadas localmente em JPEG, com lado maior de até 1600 pixels, para economizar armazenamento. Há espaço para até 100 molduras no mural; retirar uma moldura preserva a foto na galeria. O preenchimento/recorte da moldura não altera a imagem guardada. A captura real da câmera e o seletor do iOS ainda precisam ser conferidos em um iPhone físico.

O conjunto inicial autorizado é público; endereço difícil de adivinhar não o torna privado. Novos textos, fotos e backups devem continuar em importação local, sem acrescentá-los aos assets públicos por conta própria. Não publique o perfil `.local/lehs-browser` nem backups pessoais. O aplicativo não envia o que for criado ou importado no aparelho para um servidor.

## Guardar uma cópia e trocar de aparelho

Em **Preferências**, use **Exportar backup** e guarde o JSON fora do navegador. Ele inclui pinturas, peças, fotos, rascunhos, prateleira, partidas, carta, perfis dos gatos e preferências, além do perfil e esmalte da cerâmica 3D e da posição/moldura das fotos no mural. Em outro aparelho ou perfil, use **Importar backup**.

Quando o navegador aceita compartilhar arquivos JSON, a exportação abre esse caminho para escolher onde guardar. Caso contrário, prepara o download. O arquivo usa JSON compacto; cancelar o compartilhamento não acusa erro nem confirma que o arquivo foi salvo. O painel nativo de compartilhamento do iPhone ainda precisa ser verificado no aparelho.

O formato atual é versão 2 e aceita a versão anterior. A restauração valida os dados antes de gravar, usa uma transação para estado e criações e preserva outras criações existentes no destino. Registros com o mesmo identificador ou a mesma chave são restaurados a partir da cópia.

Limites reais: backup de até **80 MB**, imagem de até **15 MB decodificados** e até **250.000 pontos de desenho por backup**. A capacidade total depende do navegador e do aparelho. Em falhas de gravação, o app mostra um aviso e oferece nova tentativa ou exportação; não confirma que salvou. Armazenamento local não é backup garantido: limpar os dados do site pode removê-lo.

## Usar no iPhone como PWA

O aplicativo está publicado por Cloudflare Workers com assets estáticos em **https://atoa-leh.gbbraga-dev.workers.dev**. A instalação e o preparo do cache offline usam esse endereço HTTPS. O HTTP do PC na rede pode mostrar a interface, mas não substitui essa instalação. Para uma publicação futura, o diretório servido é `dist/`.

No Safari do iPhone:

1. Abra o endereço HTTPS.
2. Toque em **Compartilhar**, eventualmente dentro do menu da página.
3. Escolha **Adicionar à Tela de Início**.
4. Ative **Abrir como App da Web**, quando a opção aparecer, e toque em **Adicionar**.
5. Abra pelo novo ícone e aguarde o preparo inicial com internet. Em Preferências, o aplicativo informa quando os arquivos estão preparados para uso sem conexão.
6. A carta, os gatos e as 12 fotos iniciais já são preparados no primeiro acesso. Importar backup é opcional: serve para levar também as criações ou alterações feitas em outro aparelho.

Esse caminho segue o [manual da Apple](https://support.apple.com/pt-br/guide/iphone/iphea86e5236/ios). Os jogos, fontes e imagens necessários são pré-carregados pelo service worker; não é necessário abrir cada jogo para prepará-lo. O núcleo foi verificado sem conexão em navegadores de desktop após o preparo inicial. A confirmação dos módulos novos e o método usado em cada engine estão no relatório de validação; offline no iOS ainda não foi demonstrado em aparelho físico. A cerâmica 3D exige WebGL mesmo sem internet. Sons começam desligados e só são ativados por uma ação explícita.

Para verificar no aparelho, prepare a PWA com internet, ative o modo avião e reabra pelo ícone. O armazenamento do iPhone é separado do PC. O conjunto inicial vem com o aplicativo; criações adicionais chegam por importação de backup, sem sincronização automática. A validação em iPhone físico permanece necessária e está separada dos testes em emulação no relatório.

O Safari e o aplicativo aberto pela Tela de Início podem usar armazenamentos diferentes conforme o iOS. Se criar algo no Safari antes de instalar, exporte uma cópia e importe no app pelo ícone para preservar essas criações.

## Aplicativo iOS nativo

`capacitor.config.ts` define `appId: com.guilherme.atoaleticia` e `webDir: dist`. No Mac, prepare a plataforma caso `ios/` ainda não exista:

~~~sh
npm ci
npx cap add ios
npm run ios:sync
npm run ios:open
~~~

Se a plataforma já estiver preparada, comece pela sincronização. Compilar, assinar e executar essa versão exige macOS e Xcode, conforme os [requisitos do Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup). Não há IPA compilado, assinatura, TestFlight ou App Store comprovados nesta entrega. A PWA usa o Safari e dispensa essa compilação.
