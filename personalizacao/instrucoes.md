# Preparar o presente da Leh

Abra **https://atoa-leh.gbbraga-dev.workers.dev**. A carta, os bilhetes, os três gatos, as 12 fotos e o mural inicial são preparados automaticamente no primeiro acesso. **Não é necessário importar JSON para abrir o presente no telefone.**

Guilherme autorizou publicar esse conjunto inicial, incluindo as fotos que já estavam públicas no Instagram. Ele está no asset `public/presente/inicial.json` e pode ser obtido por quem acessa o aplicativo. Novas palavras, fotos e criações acrescentadas depois ficam no aparelho, sem upload.

`presente.private.json`, nesta pasta, é o arquivo de edição local e permanece no `.gitignore`. O lançador **ABRIR-PRESENTE.cmd** mantém o conteúdo já guardado; usa esse arquivo como preparação local quando ainda não há palavras no perfil. Editar esse arquivo não muda automaticamente a versão pública nem sobrescreve uma carta já importada.

## Importação manual

Para mudar a carta neste aparelho, abra **Preferências → Escrever ou editar**. O rascunho é preservado ao fechar, reabrir e recarregar; **Guardar as palavras** confirma a versão. Também é possível escolher **Importar carta e bilhetes** com um arquivo pessoal neste formato:

```json
{
  "version": 1,
  "letter": "Escreva aqui a sua carta real.",
  "notes": [
    "Escreva aqui um bilhete real seu.",
    "E outro, se quiser."
  ]
}
```

Esse bloco mostra a estrutura. Os textos do presente são escritos pelo Guilherme, sem inventar lembranças do casal. A carta deve ter de 1 a 16.000 caracteres; cabem até 200 bilhetes, com 1 a 3.000 caracteres cada. Bilhetes opcionais podem ser representados por `"notes": []`. Quebras de linha em uma string JSON são escritas como `\n`.

`exemplo.json` é uma demonstração: copie-o para um arquivo terminado em `.private.json`, substitua os textos e remova `"demo": true`. O aplicativo recusa o arquivo de exemplo enquanto esse marcador existir.

O presente também pode levar até três perfis no campo opcional `cats`, dentro desse mesmo JSON. Cada perfil tem `name` e `coat`: `orange` para laranjinha, `cow` para branco e cinza, `siamese` para siamês. Os perfis do conjunto inicial foram autorizados para publicação; mudanças importadas depois ficam locais.

## As fotos

Em Preferências, escolha uma ou várias fotos JPG, PNG ou WEBP de até 15 MB cada. Elas são preparadas localmente em JPEG, com lado maior de até 1600 pixels, e ficam como quadros junto da carta. O **Mural de recortes** também oferece câmera e seletor da galeria, além de molduras, fundos, giro, tamanho e enquadramento. HEIC não está entre os formatos aceitos: escolha uma cópia JPG, PNG ou WebP.

O lançador usa as imagens `foto-01.jpeg` até `foto-12.jpeg` que estão em `.local/referencias`. Se já existe alguma foto guardada no perfil do presente, ele mantém a seleção atual. Para adicionar ou mudar fotos mais tarde, use os controles do próprio aplicativo.

O asset inicial é público por autorização expressa; endereço difícil de adivinhar não oferece proteção. Para acrescentar novos conteúdos apenas neste aparelho, use os controles locais, sem copiá-los aos assets públicos. O seletor de arquivos não envia essas importações a um backend. Os arquivos privados, backups e o perfil `.local/lehs-browser` continuam fora do Git.

## Passar para o iPhone

Abra o link no Safari e adicione à Tela de Início pelo menu Compartilhar. O conjunto inicial já vem pronto. Um backup é **opcional** para levar criações ou alterações feitas no computador: exporte a cópia, leve o JSON ao app **Arquivos** do iPhone e importe em Preferências do À toa aberto pelo ícone.

Na exportação, o aplicativo tenta compartilhar o arquivo JSON quando o navegador aceita; caso contrário, prepara o download. Escolha onde guardar. Cancelar não significa que uma cópia foi salva. O painel nativo, a câmera e a instalação real ainda não foram testados em um iPhone físico.

O perfil do PC, o Safari e a PWA podem ter armazenamentos separados. Se criar no Safari antes de instalar, exporte e importe pelo ícone para preservar essas obras. Depois do preparo inicial, verifique o modo avião no aparelho; os testes offline existentes são de navegadores com iPhone emulado.

O backup contém conteúdo pessoal, por isso guarde uma cópia em um lugar escolhido por vocês. Ele também é o caminho para preservar as obras antes de limpar o navegador ou trocar de aparelho. A restauração reúne os registros importados com os que já estão no destino.
