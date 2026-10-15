# À toa, Leh — direção e entregas

## Direção do briefing de 30/09/2026

Preservar React, TypeScript, Vite, pintura SVG, peças 2D e jogos já escritos. Núcleo observável: **abrir → pintar/decorar → guardar na prateleira → sair → retomar**. Sem conta, retenção, obrigações de cuidado, diagnóstico ou acompanhamento do uso. Dados locais e ilustrações originais. A autorização posterior para publicação e conteúdo inicial está registrada abaixo.

## Estado lido antes do refinamento

| Área | Estado encontrado | Refinamento necessário |
| --- | --- | --- |
| Pintura | Regiões, pixels e desenho livre em código | Dar prioridade a regiões; zoom/mover; desfazer/refazer; persistência durante o uso |
| Cerâmica | Peça decorável em 2D | Planta opcional; toque preciso; imagem personalizada na prateleira |
| Jogos | Caça-palavras, palavras, memória, jardim, gatos, areia, crochê e tabuleiro | Validar lógica, gestos, retomada e acesso; preservar como extras |
| Dados | Galeria IndexedDB; preferências e rascunhos em localStorage | Modelo versionado; migração sem apagar; falhas recuperáveis; backup transacional |
| Interface | Componentes escritos, CSS global faltando | Entrada curta; área de criação protagonista; telas internas e navegação mobile |
| PWA | Configuração com atualização automática | Precache comprovado; atualização oferecida sem recarregar interação |
| Presente | Textos demonstrativos misturados à experiência | Conteúdo real importado localmente; fotos e gatos privados; sem falas inventadas |

Esses itens descrevem o ponto de partida, não uma validação de funcionamento. O build completo e os fluxos ainda não haviam sido executados nesse momento.

## Entregas conectadas

1. **Núcleo do ateliê.** Pintura por regiões, paletas e cor livre; zoom e mover; desfazer/refazer; rascunho automático. Peças 2D com carimbos, cores e planta opcional. Prateleira que guarda a imagem real e permite reorganizar e retirar. Estado em IndexedDB, versionado e migrado sem apagar dados antigos.
2. **Uso cotidiano.** Entrada com três escolhas e atividade imediata; retorno discreto ao que estava aberto; carta e bilhetes reais; importação privada de fotos e perfis de gatos. Caça-palavras com temas, dificuldade, dica, nova partida e retomada. Demais brincadeiras preservadas em uma tela própria.
3. **Entrega verificável.** Backup com validação e transação; falhas de quota e abort observadas na UI; cache offline; atualização por escolha. Testes de pintura, jogos e persistência, inspeção visual em navegador e registro das limitações de iOS.

## Critério de pronto

Os sete critérios de aceite precisam ser demonstrados por execução e evidência. Build isolado não basta. O relatório [VALIDACAO.md](VALIDACAO.md) separa testes automatizados, inspeção visual e itens que exigem iPhone físico ou Mac/Xcode.

No briefing inicial, modelagem livre de argila, casa 3D, novos jogos e simulação física de crochê ficavam como expansão. O crochê em grade já existente foi preservado como brincadeira adicional.

## Marco da etapa 1 e expansão solicitada

O núcleo passou por 22 testes de lógica, 13 de pintura, 22 de jogos nos dois engines e 18 de persistência, backup e offline. Os métodos e limites estão em [VALIDACAO.md](VALIDACAO.md). A configuração iOS não foi compilada nem testada em aparelho físico.

Após esse marco, Guilherme solicitou expansão de exploração e cerâmica moldável em 3D. Essa solicitação complementa a direção anterior: o núcleo validado continua acessível. A expansão acrescenta Three.js ao módulo de cerâmica, preservando React, TypeScript, Vite, IndexedDB e a cerâmica 2D. A aprovação da etapa 1 não aprova automaticamente os módulos novos; as rodadas próprias e de regressão estão em [VALIDACAO.md](VALIDACAO.md).

## Expansão implementada

| Área | O que mudou | Benefício e limite |
| --- | --- | --- |
| Pintura | 16 cenas em quatro categorias; caneta, giz e aquarela no modo livre | Mais escolhas consistentes, com rascunhos por cena e metadados dos traços preservados |
| Torno 3D | Nove formatos; perfil de 32 raios; alargar, afinar, alisar e ondular; nove padrões; quatro carimbos; acabamento; desfazer/refazer | A forma responde ao toque e vira PNG real de 1000 × 1000; modelagem radial de torno, não argila física irrestrita |
| Jardim | 14 plantas e pequenos elementos; seis vasos; cor, duplicar, girar e tamanho; três composições | Montar um jardim pessoal sem manutenção; trocar a composição pede confirmação e pode ser desfeito |
| Mural de recortes | Câmera e seletor local; três molduras e três fundos; posição, giro, tamanho, enquadramento, desfazer e PNG | Trazer fotos da vida real para o cantinho, sem upload; até 100 molduras e preparação JPEG de até 1600 pixels |
| Backup | Perfis e decoração 3D, materiais de pintura, vasos e composição do mural | Retomar no mesmo aparelho ou transferir por arquivo; continua local e versionado |

Guilherme escolheu manter a reprodução dos objetos reais **por fotografias locais**. O mural não reconstrói modelos 3D a partir das fotos, não utiliza LiDAR e não executa fotogrametria. Nenhuma integração externa de geração ou reconstrução foi acrescentada ao aplicativo.

Sem WebGL, a cerâmica 3D apresenta a limitação e leva à cerâmica ilustrada. Câmera, seletor e HEIC dependem do navegador e do sistema: o formato aceito é JPEG, PNG ou WebP; uma foto HEIC exige uma cópia em formato aceito. Esses fluxos ainda precisam de execução no iPhone físico.

## Identidade e privacidade

Papel, cerâmica, verde, terracota, tons creme e pequenos acentos solares. A van amarela e a janela para a mata são referências visuais sutis aos filmes preferidos; o cuidado aparece em pequenos detalhes. As ilustrações e personagens são originais. A referência artesanal e acolhedora não reproduz personagens de animações ou catálogo de outro aplicativo.

O briefing original determinava importação privada. Posteriormente, Guilherme **autorizou expressamente publicar o conjunto inicial**: carta, bilhetes, perfis dos gatos e 12 fotos que já estavam públicas no Instagram. Esse conjunto foi preparado em `public/presente/inicial.json` para chegar pronto no primeiro acesso, sem exigir importação no telefone. Ele é um asset público, não conteúdo protegido por um endereço.

O preparo inicial preserva criações, palavras e layouts existentes; os dados criados ou importados depois continuam no aparelho. Não há analytics, backend ou compartilhamento do uso. Uma exportação de backup contém conteúdo pessoal e deve ser guardada como as próprias fotos. Arquivos de edição privados e o perfil do navegador continuam excluídos do Git; não devem ser confundidos com a cópia inicial autorizada para publicação.

## Acompanhamento local

- Desenvolvimento no portal Maestri **“À toa, Leh — ao vivo”**: **http://127.0.0.1:5189**, com atualização do Vite.
- Presente e validação do build: **http://127.0.0.1:5188**.
- Lançador Windows: **ABRIR-PRESENTE.cmd**, perfil privado e persistente em .local/lehs-browser.

As duas portas têm armazenamentos separados. A prévia de desenvolvimento não substitui a validação do build de produção, do cache ou do aparelho físico.

## Publicação e revisão

A publicação autorizada foi realizada por **Cloudflare Workers com assets estáticos**: **https://atoa-leh.gbbraga-dev.workers.dev**, com resposta HTTP 200 confirmada. Versão final Wrangler: `f8a789bc-f2d6-484b-86b9-f6304cb1bc6a`, bundle `index-C6u8vvzN`. A permissão disponível para Cloudflare Pages bloqueou esse caminho; Workers passou pelo dry run e recebeu o build. O teste remoto de entrega passou seus quatro casos: primeiro acesso pronto, offline, preservação de presente pessoal existente e inclusão do presente sem apagar criação ou layout. Registro: `evidence/delivery-results.json`. Nenhuma instalação em iPhone físico foi demonstrada. O asset inicial autorizado contém conteúdo público do presente; criações posteriores não são enviadas.

A revisão assistida foi concluída pelo modelo real **`claude-opus-5-5`**, esforço xhigh. O relatório `.agent-loop/CLAUDE_REVIEW.md` é uma revisão por leitura de código e capturas, sem executar testes. Foram aplicadas correções de compressão de fotos em Preferências, rascunho persistente da carta, exportação de backup por compartilhamento JSON com fallback, remoção da cópia antiga no localStorage, JSON compacto e erro específico para backup grande. As cinco verificações dessas correções passaram na URL publicada. Achados médios restantes e limites estão em [VALIDACAO.md](VALIDACAO.md); não foi declarada ausência de problemas.

O envio do link por WhatsApp foi aceito pela API com **HTTP 201 às 23:59:59 de 30/09/2026**, identificador `3EB0EB36A00E34D77E087C`, status **PENDING**. Evidência: `evidence/whatsapp-send.json`. Isso registra envio solicitado e aceito, sem comprovar entrega ao telefone ou leitura. O backup separado é opcional: a primeira abertura já prepara o presente inicial.
