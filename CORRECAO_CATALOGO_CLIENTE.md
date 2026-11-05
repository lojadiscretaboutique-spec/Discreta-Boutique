# Discreta Boutique — correção da pesquisa e do catálogo do cliente

Data da revisão: 05/11/2026

## Causas confirmadas no código original

1. Em `src/lib/ranking.ts`, a pesquisa comparava o termo com descrições extensas e campos de SEO/IA e aceitava substrings e qualquer palavra de uma pesquisa composta. Isso incluía resultados sem relação direta; `gel` podia coincidir com trechos de palavras ou marketing de outros produtos.
2. A busca de sugestões em `SearchBar.tsx` era diferente da busca da página de catálogo: pesquisava `searchTerms` via `array-contains`, limitado a 8 documentos e só mostrava 5.
3. Em `CatalogPage.tsx`, a consulta de contingência utilizava `limit(300)` sem buscar páginas seguintes, e a página tentava carregar os produtos novamente quando o parâmetro `q` mudava.
4. `catalogCacheService.ts` gravava todos os itens em um único documento Firestore, com risco de ultrapassar o limite de 1 MiB. O cache também não tinha conciliação de alterações recentes.
5. As movimentações comuns de estoque não agendavam atualização do cache público.
6. Produto inicialmente salvo sem foto podia manter `showInCatalog=false` ao adicionar a primeira foto.

## Mudanças aplicadas

- Novo motor de busca compartilhado `src/lib/customerCatalogSearch.ts` para catálogo e sugestões: normaliza acentos, compara palavras inteiras, exige todos os termos, ordena por nome/código/categoria e usa palavras-chave de forma controlada.
- Buscas de 2–3 letras, como `gel`, evitam campos de marketing de IA e descrições longas. A pesquisa não chama IA nem consulta Firestore a cada tecla.
- Elegibilidade comum: ativo, imagem HTTP(S), saldo disponível maior que zero; combos virtuais mantêm a regra operacional existente. A ocultação manual `showInCatalog=false` continua respeitada.
- Novo serviço compartilhado `src/services/customerCatalogDataService.ts`: lê o índice público em partes pequenas, concilia alterações recentes via `updatedAt`, evita `limit(300)` e compartilha chamadas de carregamento entre a barra superior e a página do catálogo.
- `CatalogPage.tsx`: separa busca/filtros do carregamento, aplica debounce de 160 ms e atualiza a lista ao focar a busca respeitando cache curto.
- `SearchBar.tsx`: sugestões com debounce de 120 ms, resultado limitado a 6 sugestões visuais, usando **o mesmo** motor e **o mesmo** conjunto de produtos da página principal. O catálogo exibe o restante paginado.
- `catalogCacheService.ts`: publica produtos em vários documentos de até aproximadamente 180 mil caracteres cada e só troca o manifesto após gravar todas as partes. A versão antiga é ignorada pelo novo serviço até a primeira reconstrução.
- `stockMovementService.ts`: também agenda a atualização do índice ao registrar ou estornar movimentações.
- `AdminProducts.tsx`: ao incluir a primeira foto, volta a marcar automaticamente `Exibir Catálogo`; ação manual de regeneração aguarda a conclusão e mostra erro ou sucesso real.

## Verificação e operação

**Executado:** testes unitários de busca com dados simulados (termo `gel`, múltiplas palavras, acentos, código, categoria e visibilidade), além de validação sintática dos arquivos TypeScript modificados.

**Não executado neste ambiente:** build completo com todas as dependências, Firestore Emulator e teste com dados reais da sua conta. O ZIP deve ser homologado em ambiente de teste antes do deploy na loja.

Após publicar a atualização, entre em **Admin > Produtos > Forçar Regeneração Cache** uma vez. Aguarde a confirmação de sucesso. Essa ação gera o novo índice de catálogo em partes; depois confira a pesquisa tanto na barra do cabeçalho quanto dentro da página `/catalogo`, preferencialmente em outro dispositivo. Use um produto recém-criado, outro que recebeu estoque e termos como `gel`, `lubrificante`, nome completo, SKU e GTIN.

Se ainda houver produtos ausentes, confira `active`, `images`, `stock` e **Exibir Catálogo** no registro. Produtos ocultados manualmente continuarão ocultos.

## Limitações e alertas

- O modo de contingência sem cache lê todos os produtos ativos da coleção; após a primeira regeneração o acesso passa a usar o índice leve e alterações recentes.
- A sincronização incremental depende de o campo `updatedAt` ser atualizado nos fluxos de cadastro e movimentação. No código analisado, esses fluxos gravam `updatedAt`.
- Dados previamente apagados fisicamente do Firestore podem permanecer por instantes no cache publicado até a próxima regeneração; use a ação manual após uma exclusão se necessário.
- Os documentos de versões antigas do índice não são eliminados automaticamente para evitar interromper clientes que ainda os estejam lendo. Planejar limpeza periódica com regra de retenção.
- **Segurança:** o arquivo `firestore.rules` já continha permissões `allow read, write: if true` em coleções sensíveis. **Não foram modificadas nesta correção para não interromper os fluxos existentes**; recomendamos uma revisão separada e urgente antes de qualquer deploy das regras.
