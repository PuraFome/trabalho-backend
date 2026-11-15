# Roteiro de Testes — API Finanças

> **Como executar**  
> 1. Banco limpo: `docker compose down -v && docker compose up -d --build`  
> 2. Aguardar `db` e `api` ficarem `healthy` (`docker compose ps`)  
> 3. `BASE=http://localhost:3000`  
> 4. Copiar e colar os blocos abaixo **em sequência** no terminal.  
> 5. O snippet a seguir captura o token automaticamente (requer `jq` ou `node`):  
>    ```bash
>    TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"email":"ana@email.com","senha":"Ana@1234"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token)}catch{}})")
>    ```

---

## A) Health check (público)

```bash
curl -s -w "\nHTTP %{http_code}" "$BASE/health"
# Esperado: 200 {"status":"ok","banco":"ok"}
```

---

## B) Cadastro de usuários de demonstração (201)

> Usamos e-mails/CPFs únicos com *timestamp* para evitar 409 em reexecuções.

```bash
TS=$(date +%s)
EMAIL1="demo1_${TS}@email.com"
CPF1="52998224725"   # CPF válido (Ana)
EMAIL2="demo2_${TS}@email.com"
CPF2="11144477735"   # CPF válido (Bruno)

curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/cadastro" \
  -H 'Content-Type: application/json' \
  -d "{\"nome\":\"Demo Um\",\"email\":\"$EMAIL1\",\"cpf\":\"$CPF1\",\"senha\":\"Demo@1234\"}"

curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/cadastro" \
  -H 'Content-Type: application/json' \
  -d "{\"nome\":\"Demo Dois\",\"email\":\"$EMAIL2\",\"cpf\":\"$CPF2\",\"senha\":\"Demo@1234\"}"
# Esperado: 201 com {id,nome,email}
```

---

## C) Duplicidade — e-mail/CPF (409)

```bash
# E-mail duplicado (case-insensitive)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/cadastro" \
  -H 'Content-Type: application/json' \
  -d "{\"nome\":\"Outro\",\"email\":\"${EMAIL1^^}\",\"cpf\":\"99999999999\",\"senha\":\"Demo@1234\"}"

# CPF duplicado (com pontuação)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/cadastro" \
  -H 'Content-Type: application/json' \
  -d "{\"nome\":\"Outro\",\"email\":\"outro@email.com\",\"cpf\":\"529.982.247-25\",\"senha\":\"Demo@1234\"}"
# Esperado: 409 com {erro:"Conflito.", campos:{email:...}} e {erro:"Conflito.", campos:{cpf:...}}
```

---

## D) Validações de cadastro (400)

```bash
# CPF inválido (dígitos verificadores errados)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/cadastro" \
  -H 'Content-Type: application/json' \
  -d '{"nome":"X","email":"x@x.com","cpf":"529.982.247-24","senha":"Demo@1234"}'

# Senha fraca (sem número)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/cadastro" \
  -H 'Content-Type: application/json' \
  -d '{"nome":"X","email":"y@y.com","cpf":"11144477735","senha":"SenhaFraca"}'

# Campos vazios
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/cadastro" \
  -H 'Content-Type: application/json' \
  -d '{}'
# Esperado: 400 com {erro:"Dados inválidos.", campos:{...}}
```

---

## E) Login, token, /me, expiração (200/401)

```bash
# Login correto (usuário seed Ana)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@email.com","senha":"Ana@1234"}'

# Captura token para uso nas seções seguintes
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@email.com","senha":"Ana@1234"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token)}catch{}})")

# Login senha errada
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@email.com","senha":"Errada@123"}'

# Login e-mail inexistente
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"naoexiste@email.com","senha":"Ana@1234"}'
# Esperado: 401 com {erro:"E-mail ou senha inválidos."} (mesma mensagem nos dois casos)

# GET /auth/me com token
curl -s -w "\nHTTP %{http_code}" "$BASE/auth/me" -H "Authorization: Bearer $TOKEN"
# Esperado: 200 sem senha_hash

# GET /auth/me sem token
curl -s -w "\nHTTP %{http_code}" "$BASE/auth/me"
# Esperado: 401

# Token expirado (gera token com -1s)
EXP_TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:1,nome:'x',email:'x@x.com'},process.env.JWT_SECRET,{expiresIn:'-1s'}))")
curl -s -w "\nHTTP %{http_code}" "$BASE/auth/me" -H "Authorization: Bearer $EXP_TOKEN"
# Esperado: 401 com {erro:"Token ausente, inválido ou expirado."}
```

---

## F) Categorias (CRUD + validações + conflitos)

```bash
# GET todas
curl -s -w "\nHTTP %{http_code}" "$BASE/categorias" -H "Authorization: Bearer $TOKEN"

# GET filtrado por tipo
curl -s -w "\nHTTP %{http_code}" "$BASE/categorias?tipo=saida" -H "Authorization: Bearer $TOKEN"

# GET tipo inválido
curl -s -w "\nHTTP %{http_code}" "$BASE/categorias?tipo=xxx" -H "Authorization: Bearer $TOKEN"
# Esperado: 400

# POST nova categoria
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/categorias" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Teste Categoria","tipo":"saida","classificacao":"desejo"}'
# Esperado: 201

# Captura ID da criada
CAT_ID=$(curl -s -X POST "$BASE/categorias" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Outra Categoria","tipo":"saida","classificacao":"necessidade"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).id)}catch{}})")

# POST duplicada (mesmo nome + tipo)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/categorias" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Teste Categoria","tipo":"saida"}'
# Esperado: 409

# PUT atualização parcial
curl -s -w "\nHTTP %{http_code}" -X PUT "$BASE/categorias/$CAT_ID" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Categoria Atualizada"}'
# Esperado: 200

# DELETE categoria sem lançamentos
curl -s -w "\nHTTP %{http_code}" -X DELETE "$BASE/categorias/$CAT_ID" -H "Authorization: Bearer $TOKEN"
# Esperado: 204 sem corpo

# DELETE categoria COM lançamentos (Alimentação id=3 do seed)
curl -s -w "\nHTTP %{http_code}" -X DELETE "$BASE/categorias/3" -H "Authorization: Bearer $TOKEN"
# Esperado: 409

# PUT mudar tipo de categoria com lançamentos → 409
curl -s -w "\nHTTP %{http_code}" -X PUT "$BASE/categorias/3" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"entrada"}'
# Esperado: 409
```

---

## G) Fontes/Destinos (CRUD + regras de cartão)

```bash
# GET todas
curl -s -w "\nHTTP %{http_code}" "$BASE/fontes-destinos" -H "Authorization: Bearer $TOKEN"

# GET filtrado por tipo
curl -s -w "\nHTTP %{http_code}" "$BASE/fontes-destinos?tipo=cartao_credito" -H "Authorization: Bearer $TOKEN"

# POST fonte normal (conta)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/fontes-destinos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Conta Teste","tipo":"conta"}'
# Esperado: 201

# POST cartão SEM os 3 campos obrigatórios
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/fontes-destinos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Cartão Incompleto","tipo":"cartao_credito"}'
# Esperado: 400 com campos dia_fechamento, dia_vencimento, limite

# POST cartão COM campos inválidos (dia 0, limite 0)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/fontes-destinos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Cartão Ruim","tipo":"cartao_credito","dia_fechamento":0,"dia_vencimento":32,"limite":0}'
# Esperado: 400 com os 3 campos

# POST cartão válido
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/fontes-destinos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Cartão Teste","tipo":"cartao_credito","dia_fechamento":20,"dia_vencimento":28,"limite":2500}'
# Esperado: 201

# Captura ID do cartão criado
CART_ID=$(curl -s -X POST "$BASE/fontes-destinos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Cartão Para PUT","tipo":"cartao_credito","dia_fechamento":15,"dia_vencimento":25,"limite":3000}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).id)}catch{}})")

# PUT atualizar limite
curl -s -w "\nHTTP %{http_code}" -X PUT "$BASE/fontes-destinos/$CART_ID" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"limite":3500}'
# Esperado: 200 com limite numérico 3500

# DELETE fonte com lançamentos (Conta corrente id=1 do seed)
curl -s -w "\nHTTP %{http_code}" -X DELETE "$BASE/fontes-destinos/1" -H "Authorization: Bearer $TOKEN"
# Esperado: 409

# DELETE fonte sem lançamentos
curl -s -w "\nHTTP %{http_code}" -X DELETE "$BASE/fontes-destinos/$CART_ID" -H "Authorization: Bearer $TOKEN"
# Esperado: 204
```

---

## H) Lançamentos (CRUD + parcelamento + filtros + resumo)

```bash
# IDs do seed (Ana): categoria Lazer=7, Cartão Nubank=3
# POST lançamento único
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/lancamentos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"saida","descricao":"Compra única","valor":150.50,"data":"2026-01-15","categoriaId":7,"fonteDestinoId":1}'
# Esperado: 201

# POST lançamento PARCELADO 10x no cartão (Nubank id=3, categoria Outras saídas id=9)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/lancamentos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"saida","descricao":"Notebook Parcelado","valor":3000,"data":"2026-01-20","categoriaId":9,"fonteDestinoId":3,"parcelas":10}'
# Esperado: 201 com {id, quantidade:10, grupo:"<uuid>"}

# Captura grupo do parcelamento
GRUPO=$(curl -s -X POST "$BASE/lancamentos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"saida","descricao":"Outro Parcelado","valor":1000,"data":"2026-01-25","categoriaId":9,"fonteDestinoId":3,"parcelas":5}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).grupo)}catch{}})")

# GET com filtros, paginação e resumo (mês corrente)
curl -s -w "\nHTTP %{http_code}" "$BASE/lancamentos" -H "Authorization: Bearer $TOKEN"
# Esperado: 200 com {periodo, resumo:{entradas,saidas,saldo}, pagina, totalPaginas, itens:[...{parcela:"k/N"}]}

# GET com período amplo (seed é relativo a CURDATE)
curl -s -w "\nHTTP %{http_code}" "$BASE/lancamentos?inicio=2000-01-01&fim=2099-12-31" -H "Authorization: Bearer $TOKEN"

# GET página 2
curl -s -w "\nHTTP %{http_code}" "$BASE/lancamentos?pagina=2" -H "Authorization: Bearer $TOKEN"
# Esperado: 200 (itens pode ser [])

# GET por ID
LANC_ID=$(curl -s "$BASE/lancamentos?inicio=2000-01-01&fim=2099-12-31" -H "Authorization: Bearer $TOKEN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).itens[0].id)}catch{}})")
curl -s -w "\nHTTP %{http_code}" "$BASE/lancamentos/$LANC_ID" -H "Authorization: Bearer $TOKEN"
# Esperado: 200 com item completo

# PUT atualizar lançamento
curl -s -w "\nHTTP %{http_code}" -X PUT "$BASE/lancamentos/$LANC_ID" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"descricao":"Atualizado","valor":200}'
# Esperado: 200

# DELETE parcela única
curl -s -w "\nHTTP %{http_code}" -X DELETE "$BASE/lancamentos/$LANC_ID" -H "Authorization: Bearer $TOKEN"
# Esperado: 204

# DELETE grupo inteiro (todasParcelas=true)
curl -s -w "\nHTTP %{http_code}" -X DELETE "$BASE/lancamentos/$LANC_ID?todasParcelas=true" -H "Authorization: Bearer $TOKEN"
# Esperado: 204 e grupo zerado no banco
```

---

## I) Validações de lançamento (400) + posse (404)

```bash
# Saída com categoria de entrada (Salário id=1)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/lancamentos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"saida","descricao":"Erro","valor":100,"data":"2026-01-10","categoriaId":1,"fonteDestinoId":1}'
# Esperado: 400 com mensagem "A categoria informada é de entrada, mas o lançamento é de saída."

# Valor <= 0
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/lancamentos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"saida","descricao":"Erro","valor":0,"data":"2026-01-10","categoriaId":7,"fonteDestinoId":1}'

# Data inválida
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/lancamentos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"saida","descricao":"Erro","valor":100,"data":"2026-02-30","categoriaId":7,"fonteDestinoId":1}'

# Parcelas em conta (não cartão)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/lancamentos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"saida","descricao":"Erro","valor":100,"data":"2026-01-10","categoriaId":7,"fonteDestinoId":1,"parcelas":3}'
# Esperado: 400 "Parcelamento só é permitido para fontes do tipo cartao_credito."

# Categoria de outro usuário (Bruno tem cat id=12)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/lancamentos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"saida","descricao":"Erro","valor":100,"data":"2026-01-10","categoriaId":12,"fonteDestinoId":3}'
# Esperado: 404

# Fonte de outro usuário (Bruno tem fonte id=8)
curl -s -w "\nHTTP %{http_code}" -X POST "$BASE/lancamentos" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"tipo":"saida","descricao":"Erro","valor":100,"data":"2026-01-10","categoriaId":7,"fonteDestinoId":8}'
# Esperado: 404
```

---

## J) Isolamento entre usuários (RF3) — 404 em cruzamento

> Precisa do token do **usuário 2 (Bruno)**.

```bash
# Login Bruno
TOKEN2=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"bruno@email.com","senha":"Bruno@1234"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token)}catch{}})")

# GET lançamento do usuário 1 com token do usuário 2
curl -s -w "\nHTTP %{http_code}" "$BASE/lancamentos/$LANC_ID" -H "Authorization: Bearer $TOKEN2"
# Esperado: 404

# PUT lançamento do usuário 1 com token do usuário 2
curl -s -w "\nHTTP %{http_code}" -X PUT "$BASE/lancamentos/$LANC_ID" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN2" \
  -d '{"descricao":"Tentativa"}'
# Esperado: 404

# DELETE lançamento do usuário 1 com token do usuário 2
curl -s -w "\nHTTP %{http_code}" -X DELETE "$BASE/lancamentos/$LANC_ID" -H "Authorization: Bearer $TOKEN2"
# Esperado: 404

# PUT categoria do usuário 1 (id=3 Alimentação) com token do usuário 2
curl -s -w "\nHTTP %{http_code}" -X PUT "$BASE/categorias/3" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN2" \
  -d '{"nome":"Hack"}'
# Esperado: 404

# DELETE categoria do usuário 1 com token do usuário 2
curl -s -w "\nHTTP %{http_code}" -X DELETE "$BASE/categorias/3" -H "Authorization: Bearer $TOKEN2"
# Esperado: 404

# PUT fonte do usuário 1 (id=1 Conta corrente) com token do usuário 2
curl -s -w "\nHTTP %{http_code}" -X PUT "$BASE/fontes-destinos/1" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN2" \
  -d '{"nome":"Hack"}'
# Esperado: 404

# DELETE fonte do usuário 1 com token do usuário 2
curl -s -w "\nHTTP %{http_code}" -X DELETE "$BASE/fontes-destinos/1" -H "Authorization: Bearer $TOKEN2"
# Esperado: 404

# GET /categorias com TOKEN2 não lista categorias do usuário 1
curl -s "$BASE/categorias" -H "Authorization: Bearer $TOKEN2" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d);console.log('Categorias user2:',a.length)}catch{}})"
```

---

## K) Relatórios

```bash
# Período: mês corrente (inicio/fim obrigatórios)
INICIO=$(date -u +%Y-%m-01)
FIM=$(date -u -d "$(date -u +%Y-%m-01) +1 month -1 day" +%Y-%m-%d 2>/dev/null || date -u -v+1m -v1d -v-1d +%Y-%m-%d)

# /relatorios/categorias
curl -s -w "\nHTTP %{http_code}" "$BASE/relatorios/categorias?inicio=$INICIO&fim=$FIM" -H "Authorization: Bearer $TOKEN"
# Esperado: 200 com periodo, periodoAnterior, saidas:{total,categorias[]}, entradas:{total,categorias[]}

# /relatorios/fontes-destinos
curl -s -w "\nHTTP %{http_code}" "$BASE/relatorios/fontes-destinos?inicio=$INICIO&fim=$FIM" -H "Authorization: Bearer $TOKEN"
# Esperado: 200 com periodo, entradas[], saidas[], contas[]

# /relatorios/faturas (default 3 meses) — mostra compra parcelada "k/10" em faturas distintas
curl -s -w "\nHTTP %{http_code}" "$BASE/relatorios/faturas" -H "Authorization: Bearer $TOKEN"
# Esperado: 200 com cartoes[].faturas[].lancamentos[].parcela="k/10" em 10 referências

# /relatorios/faturas?meses=12
curl -s -w "\nHTTP %{http_code}" "$BASE/relatorios/faturas?meses=12" -H "Authorization: Bearer $TOKEN"

# Validações 400
curl -s -w "\nHTTP %{http_code}" "$BASE/relatorios/categorias" -H "Authorization: Bearer $TOKEN"
curl -s -w "\nHTTP %{http_code}" "$BASE/relatorios/categorias?inicio=2026-02-30&fim=2026-02-28" -H "Authorization: Bearer $TOKEN"
curl -s -w "\nHTTP %{http_code}" "$BASE/relatorios/faturas?meses=0" -H "Authorization: Bearer $TOKEN"
curl -s -w "\nHTTP %{http_code}" "$BASE/relatorios/faturas?meses=13" -H "Authorization: Bearer $TOKEN"
```

---

## L) Saúde Financeira (desafio)

```bash
curl -s -w "\nHTTP %{http_code}" "$BASE/saude-financeira" -H "Authorization: Bearer $TOKEN"
# Esperado: 200 com
# {
#   "aviso":"Informações educativas; não constituem recomendação financeira profissional.",
#   "indicadores":{
#     "taxaPoupanca": <number>,
#     "comprometimentoCartoes": <number>,
#     "parcelasFuturas":[{"mes":"AAAA-MM","total":<number>}],
#     "distribuicao503020":{"necessidades":{...},"desejos":{...},"poupanca":{...},"naoClassificado":{...}},
#     "mesesDeReserva": <number>
#   },
#   "projecao":[{"mes":"AAAA-MM","entradas":<number>,"saidas":<number>,"saldoPrevisto":<number>}...],
#   "dicas":[<string>...]
# }

# Sem token
curl -s -w "\nHTTP %{http_code}" "$BASE/saude-financeira"
# Esperado: 401
```

---

## Evidência de execução (após rodar o roteiro completo)

> Anexe abaixo a saída real dos comandos (status HTTP + trecho JSON) para comprovação.

```
# Cole aqui a saída do terminal após executar o roteiro inteiro
```