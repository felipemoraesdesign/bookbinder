# Bookbinder

Imposição de páginas para encadernação. Você envia um PDF, escolhe o formato e baixa o arquivo pronto para imprimir, dobrar e costurar. Tudo roda no seu computador: o PDF não é enviado a nenhum servidor.

Este é um fork do [bookbinder-js](https://github.com/momijizukamori/bookbinder-js), com a interface redesenhada, em português e inglês, e um app nativo para Mac.

> **English:** a Portuguese-first fork of [bookbinder-js](https://github.com/momijizukamori/bookbinder-js) with a redesigned interface and a native macOS app. The app itself is available in English.

## Usar

- **No navegador:** [felipemoraesdesign.github.io/bookbinder](https://felipemoraesdesign.github.io/bookbinder/)
- **No Mac:** gere o app com as instruções em [App para Mac](#app-para-mac).

Para escolher o tamanho do papel de acordo com o formato, veja o [guia de tamanhos](https://docs.google.com/spreadsheets/d/1Qi9Qlbd4QBj6lErnFaRe8rdBsrX0tD7cWf0iOW1V0Vs/edit#gid=0) feito pela comunidade do projeto original.

## Estrutura do repositório

O site e o app para Mac ficam no mesmo branch, em pastas separadas. O app para Mac é uma janela nativa que carrega o mesmo app web, então qualquer correção no site também chega ao app.

```
index.html     página principal do app web
src/           app web: imposição (book.js), interface (html/), traduções (locales/)
public/        ícones e imagens servidos como estão
macos/         app nativo para Mac, em Swift
docs/          PDFs de exemplo para testar as imposições
pdf-test/      testes que comparam os PDFs gerados com versões de referência
```

## Desenvolvimento

Precisa do [Node.js](https://nodejs.org).

```bash
npm install
npm run dev
```

O app abre em http://localhost:5173/bookbinder/ e recarrega sozinho a cada mudança.

| Comando                | O que faz                                                 |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento                               |
| `npm run build`        | Gera o site na pasta `dist`                               |
| `npm run preview`      | Serve a pasta `dist` em http://localhost:4173/bookbinder/ |
| `npm run test`         | Todos os testes, refeitos a cada mudança                  |
| `npm run test:unit`    | Só os testes rápidos, de `src`                            |
| `npm run test:pdf`     | Só os testes de PDF, mais lentos                          |
| `npm run lint`         | Confere o estilo do código com o ESLint                   |
| `npm run lint:fix`     | Corrige o que o ESLint consegue corrigir sozinho          |
| `npm run prettier`     | Confere a formatação com o Prettier                       |
| `npm run prettier:fix` | Formata os arquivos com o Prettier                        |

Para sair dos comandos que continuam rodando (`dev`, `preview` e `test`), digite `q` e Enter.

Na pasta [`docs`](docs) há PDFs de exemplo para conferir as imposições. O [`example_page_numbers.pdf`](docs/example_page_numbers.pdf) tem os números de 1 a 120 em tamanho grande e ajuda a conferir a ordem das páginas. Os outros têm proporções de [paisagem](docs/example_50cm_wide_10cm_tall.pdf), [retrato](docs/example_15cm_wide_40cm_tall.pdf) e [quadrado](docs/example_20cm_square.pdf), para conferir o posicionamento.

## App para Mac

Precisa do Node.js e das ferramentas de linha de comando do Xcode (`xcode-select --install`).

```bash
sh macos/build.sh
```

O app fica em `macos/build/Bookbinder.app`. Ele tem cerca de 3 MB, roda em Macs com Apple silicon e Intel e pede macOS 12 ou mais novo.

Para testar o app de ponta a ponta (enviar um PDF, gerar a imposição e baixar o arquivo):

```bash
macos/build/Bookbinder.app/Contents/MacOS/Bookbinder --self-test docs/example_page_numbers.pdf
```

O app gerado tem uma assinatura local e abre só no Mac em que foi gerado. Para distribuir para outras pessoas, ele precisa ser assinado com um certificado Developer ID e notarizado pela Apple.

## Branches e versões

- **`main`**: sempre igual ao que está publicado.
- **Um branch curto para cada mudança** (`feat/…`, `fix/…`), apagado depois de entrar no `main`.
- **`gh-pages`**: o site gerado. Não edite à mão.

O site e o app para Mac usam a mesma versão, a do `package.json`. Cada versão publicada ganha uma tag `vX.Y.Z` e uma Release no GitHub com o app compactado em anexo:

```bash
ditto -c -k --keepParent macos/build/Bookbinder.app Bookbinder-mac.zip
```

## Publicar o site

O workflow [`pages.yml`](.github/workflows/pages.yml) publica o site no `gh-pages` a cada push no `main`, desde que as Actions estejam ativadas no repositório.

Para publicar à mão:

```bash
npm run build
git worktree add ../bookbinder-pages gh-pages
cd ../bookbinder-pages && git rm -rq . && cp -R ../bookbinder/dist/. . && touch .nojekyll
git add -A && git commit -m "Publica o site" && git push origin gh-pages
cd ../bookbinder && git worktree remove ../bookbinder-pages
```

## Docker

O [`compose.yaml`](compose.yaml) gera o site e o serve com nginx, sem abrir portas: ele espera um servidor na frente. Para abrir uma porta, crie um `compose.override.yaml`:

```yaml
services:
  bookbinder-nginx:
    ports:
      - '80:80'
```

## Créditos e licença

A lógica de imposição é do [bookbinder-js](https://github.com/momijizukamori/bookbinder-js), de momijizukamori e [colaboradores](https://github.com/momijizukamori/bookbinder-js/graphs/contributors), que por sua vez reescreveu o [Bookbinder](http://quantumelephant.co.uk/bookbinder/bookbinder.html) original usando a biblioteca [pdf-lib](https://pdf-lib.js.org).

Como o projeto original, este fork usa a [Mozilla Public License 2.0](LICENSE).
