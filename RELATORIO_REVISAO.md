# Relatorio de revisao — API de Controle Financeiro

Data: 2026-11-18

## Resumo

O projeto foi revisado contra o enunciado anexado ao projeto final. A estrutura esta em conformidade com os requisitos principais: Express, rotas protegidas por JWT, mysql2, bcrypt, transacoes, modelo de dados, CRUDs, relatorios e parcelamento.

## Auditoria dos arquivos Markdown

Os arquivos Markdown versionados foram revisados:

- `README.md`: setup, variaveis de ambiente, credenciais de demonstracao, estrutura, rotas, regras de negocio, desafio e checklist.
- `docs/README.md`: instrucoes do frontend estatico, GitHub Pages e autenticacao no navegador.
- `testes/requisicoes.md`: roteiro curl das rotas publicas e protegidas, isolamento, validacoes e relatorios.
- `RELATORIO_REVISAO.md`: registro desta revisao.

Os textos de usuario, deploy e GitHub Pages que usam `<repo-url>` ou `SEU_USUARIO` sao substituicoes intencionais. Os CPFs usados no roteiro foram validados pela mesma utilidade `utils/cpf.js` utilizada pela API.

Foram corrigidos tres pontos encontrados durante a revisao:

1. `/auth/login` e `/auth/me` passaram a tratar falhas inesperadas de banco e impedir que rejeicoes assincromas se transformem em respostas inconsistentes.
2. `POST /lancamentos` passou a rejeitar parcelamento em lancamentos do tipo `entrada`. Compras parceladas sao permitidas apenas em saidas vinculadas a cartao de credito.
3. O relatorio de faturas passou a preencher fechamento e vencimento mesmo quando nao existem lancamentos naquela referencia e passou a calcular o limite utilizado com todas as parcelas cuja fatura ainda nao venceu, nao apenas com o intervalo de meses solicitado.

## Validacao automatizada

Comando executado:

```bash
npm test
```

Resultado:

- 108 testes aprovados
- 20 grupos de testes
- 0 falhas

Tambem foi criada uma suite de integracao que valida os 12 itens do checklist final contra a API e o MySQL em execucao:

```bash
npm run docker:up
set -a; source ./.env; set +a
npm run test:integration
```

Resultado da integracao executada:

- 12 testes aprovados
- 0 falhas

Os testes cobrem CPF, datas, deslocamento de meses, calculo de faturas, divisao de parcelas e indicadores de saude financeira.

## Checklist dos requisitos

| Area | Requisito | Situacao |
|---|---|---|
| Tecnologias | Node.js, NPM, Express, mysql2, JWT, express-jwt e bcrypt | Conforme |
| Configuracao | Scripts `start` e `dev`, dotenv, `.env.example` e `.gitignore` | Conforme |
| Banco | Schema MySQL com PK, FK, UNIQUE, CHECK, ENUM e indices | Conforme |
| Demonstracao | Seed com dois usuarios, tres meses e compra parcelada | Conforme |
| RF1 | Cadastro normalizado, CPF valido, senha forte, bcrypt e transacao | Conforme |
| RF2 | Login por e-mail com bcrypt, JWT de 1 hora e `/auth/me` protegido | Conforme |
| RF3 | Isolamento por `req.auth.id` e filtros por `usuario_id` nas consultas | Conforme |
| RF4 | CRUD completo de categorias e conflitos explicativos | Conforme |
| RF5 | CRUD completo de fontes/destinos e validacoes de cartao | Conforme |
| RF6 | CRUD de lancamentos, filtros, paginacao, resumo e parcelamento em centavos | Conforme |
| RF7 | Agregacoes por categoria com SQL, percentuais e periodo anterior | Conforme |
| RF8 | Agregacoes por fonte/destino e saldo de contas | Conforme |
| RF9 | Faturas por fechamento/vencimento, parcelas e limites | Conforme |
| Desafio | Rota de saude financeira com aviso, 11 indicadores (taxaPoupanca, comprometimentoCartoes, parcelasFuturas, distribuicao503020, mesesDeReserva, categoriasForaDaCurva, indiceEndividamento, runwayMeses, scoreSaude, concentracaoGastos, tendenciaGastos) + projecao 6 meses; correcoes: (a) categoriaVsMedia usa media MENSAL dos 3 meses anteriores completos (era AVG por linha); (b) janelas UTC via utils/datas.js (sem new Date()); (c) formula da projecao documentada (saidas = mediaSaidas + parcelasDoMes, aproximacao aceita) | Implementado |
| Respostas | Status HTTP 200/201/204/400/401/404/409/500 e JSON de erros | Conforme |

## Ajustes detalhados

### Autenticacao

- Senha nunca aparece nas respostas.
- Senha de cadastro e armazenada como hash bcrypt.
- Login busca o usuario pelo e-mail normalizado e usa `bcrypt.compare`.
- O JWT contem `id`, `nome` e `email` e expira em uma hora.
- Rotas privadas usam o middleware `express-jwt` com HS256.

### Integridade e isolamento

- E-mail e CPF possuem UNIQUE no banco.
- Cadastramento usa transacao para usuario, categorias padrao e conta corrente.
- Categorias e fontes/destinos sao filtradas pelo usuario autenticado.
- Lancamentos usam o id do token em criacao, consulta, atualizacao e exclusao.
- Categoria e fonte/destino sao confirmadas como pertencentes ao usuario antes da criacao ou atualizacao.

### Lancamentos

- Valores positivos sao validados na API e no banco.
- Categoria de entrada nao pode ser usada em saida, e vice-versa.
- Filtros opcionais possuem periodo mensal padrao e paginacao de 20 itens.
- Parcelas sao divididas em centavos com o arredondamento na primeira parcela.
- Cada parcela usa o mesmo UUID de grupo.
- Exclusao por grupo e suportada com `todasParcelas=true`.

### Relatorios

- Totais por categoria usam `SUM` e `GROUP BY` no MySQL.
- Valores DECIMAL sao convertidos para Number antes dos calculos percentuais.
- O periodo anterior preserva intervalos completos de mes ou desloca intervalos nao completos.
- Faturas consideram fechamento, vencimento, clamping de dias inexistentes e parcelas futuras.
- O limite utilizado considera todas as parcelas com vencimento ainda nao ocorrido.

### Configuracao

- Credenciais sensiveis nao ficam no codigo.
- O `.env` esta excluido pelo `.gitignore`.
- `.env.example` contem as variaveis necessarias.
- `node_modules` e arquivos de log estao excluidos.

## Observacoes de verificacao

A verificacao automatizada existente nao inicializa o MySQL nem realiza requisicoes HTTP end-to-end. Por isso, a validacao completa em ambiente Docker exige subir os servicos e executar o roteiro de [testes/requisicoes.md](testes/requisicoes.md).

Comandos recomendados:

```bash
npm run docker:up
curl -s http://localhost:3000/health
npm run db:reset
```
