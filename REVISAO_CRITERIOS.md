# Revisao dos criterios de avaliacao

Data: 2026-11-18

## Resumo

Os requisitos implementaveis — itens A a D — foram verificados no codigo, no banco Docker e em testes unitarios e de integracao.

Resultado estimado da revisao:

- A. Usuarios e autenticacao: 25/25
- B. Cadastros e lancamentos: 25/25
- C. Relatorios: 20/20
- D. Organizacao e qualidade: 15/15
- E. Apresentacao: parcialmente verificavel por artefatos; depende da apresentacao oral
- Desafio: implementado, com 5 indicadores, projecao e dicas
- Total implementado: 85/100, antes da avaliacao oral

## A. Usuarios e autenticacao — 25/25

| Criterio | Pontos | Verificacao |
|---|---:|---|
| Cadastro com validacoes, CPF, senha e transacao | 6/6 | Cadastro valida nome, e-mail, CPF e senha. O CPF usa os digitos verificadores. Usuario, categorias padrao e conta corrente sao criados na mesma transacao com rollback. |
| E-mail e CPF exclusivos com normalizacao | 6/6 | UNIQUE no banco e normalizacao antes do INSERT. E-mail maiusculo com espacos e CPF pontuado foram testados. Respostas duplicadas usam 409 e identificam o campo. |
| bcrypt e JWT | 7/7 | bcrypt com custo configuravel, login somente pelo e-mail e compare no Node. JWT HS256 com expiracao de 1 hora. Hash nao aparece nas respostas. |
| Middleware JWT e isolamento | 6/6 | express-jwt protege recursos privados. UnauthorizedError gera 401 JSON. Categorias, fontes e lancamentos usam req.auth.id; registros alheios retornam 404. |

## B. Cadastros e lancamentos — 25/25

| Criterio | Pontos | Verificacao |
|---|---:|---|
| CRUD de categorias e fontes/destinos | 8/8 | Todos os verbos foram implementados. Tipos, cartao, duplicidade, exclusao com vinculos e isolamento foram tratados. |
| CRUD e validacoes de lancamentos | 9/9 | Tipo, descricao, valor, data, categoria, fonte/destino e compatibilidade de categoria/tipo foram validados. |
| Filtros, paginacao e resumo | 4/4 | inicio, fim, tipo, categoriaId, fonteDestinoId e pagina estao implementados. Listagem possui periodo, resumo e total de paginas. |
| Parcelamento em centavos e exclusao completa | 4/4 | Divisao usa centavos e resto na primeira parcela. Grupo UUID e exclusao todasParcelas=true foram implementados. |

## C. Relatorios — 20/20

| Criterio | Pontos | Verificacao |
|---|---:|---|
| Relatorio por categoria | 7/7 | SQL usa SUM e GROUP BY. Percentual e comparacao com periodo anterior estao implementados. DECIMAL vira number. |
| Relatorio por fonte/destino | 5/5 | Entradas e saidas por fonte/destino e saldo das contas estao implementados com SQL agregado. |
| Previsao de faturas | 8/8 | Considera fechamento, vencimento, parcelas futuras, clamping de dia inexistente, limite utilizado e limite disponivel. |

## D. Organizacao e qualidade — 15/15

| Criterio | Pontos | Verificacao |
|---|---:|---|
| Estrutura e classes de modelo | 4/4 | CommonJS, express.Router por recurso e SQL concentrado nos models. |
| Verbos, status e respostas de erro | 4/4 | Verbos REST e status exigidos foram usados. Erros sao JSON. |
| Parametros, banco e tipos | 4/4 | Consultas usam ?. O schema possui FK, UNIQUE, CHECK e indice. Dinheiro usa DECIMAL. |
| Configuracao e entregaveis | 3/3 | package.json possui scripts, nodemon, dotenv, .env.example, .gitignore, schema, seed, README e testes. |

## E. Apresentacao — 15 pontos

Este bloco depende da apresentacao dos integrantes e nao pode ser confirmado apenas por testes automaticos.

| Criterio | Pontos possiveis | Situacao |
|---|---:|---|
| Explicacao do codigo por ambos os integrantes | 5 | Não verificavel neste momento. |
| Execucao por linha de comando | 5 | Verificavel e demonstrado com Docker Compose, npm test e npm run test:integration. |
| Demonstracao completa do roteiro no tempo | 5 | O roteiro A-L esta pronto; exige apresentacao ao vivo. |

Nota potencial deste bloco na avaliacao presencial: 15/15.

## Desafio de saude financeira

Implementacao adicional verificada:

- taxa de poupanca;
- comprometimento com cartoes;
- meses de reserva;
- distribuicao 50/30/20;
- parcelas futuras;
- projecao em seis meses;
- dicas geradas por regras;
- aviso educativo obrigatorio.

Pontuacao extra: ate 10/10.

## Validacao executada

Comandos:

```bash
npm test
npm run docker:up
set -a; source ./.env; set +a
npm run test:integration
```

Resultados:

- 108 testes unitarios aprovados;
- 12 testes do checklist de integracao aprovados;
- API e banco Docker saudaveis;
- `.env` nao versionado;
- `.env.example` versionado;
- hash do seed valido para Ana e Bruno.
