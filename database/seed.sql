-- Seed data for api-financas
-- Task 8: 2 users with real bcrypt hashes (cost 10), 9 categories each, 5 fontes each
-- Task 9: 3 months of lançamentos + 10x installment purchase

SET NAMES utf8mb4;
USE api_financas;

-- ============================================
-- USUÁRIOS (ids fixos: 1, 2)
-- ============================================
INSERT INTO usuarios (id, nome, email, cpf, senha_hash) VALUES
(1, 'Ana Souza', 'ana@email.com', '52998224725', '$2b$10$/BfuiV.eUVQQrHqbTMDq2O7MXm91JLI9QLTeL00A8f9sj7Ck2GUmS'),
(2, 'Bruno Lima', 'bruno@email.com', '11144477735', '$2b$10$czP..FB.sACtLPyb403fjOSN4h4qPUdLfPsfqRD6GvK.Azy8hOFhW');

-- ============================================
-- CATEGORIAS (ids fixos: 1-9 Ana, 10-18 Bruno)
-- tipo: entrada/saida, classificacao: necessidade/desejo/poupanca (NULL para entradas)
-- ============================================
-- Ana (usuario_id = 1)
INSERT INTO categorias (id, usuario_id, nome, tipo, classificacao) VALUES
(1, 1, 'Salário', 'entrada', NULL),
(2, 1, 'Outras entradas', 'entrada', NULL),
(3, 1, 'Alimentação', 'saida', 'necessidade'),
(4, 1, 'Moradia', 'saida', 'necessidade'),
(5, 1, 'Saúde', 'saida', 'necessidade'),
(6, 1, 'Mobilidade', 'saida', 'necessidade'),
(7, 1, 'Lazer', 'saida', 'desejo'),
(8, 1, 'Educação', 'saida', 'necessidade'),
(9, 1, 'Outras saídas', 'saida', 'desejo');

-- Bruno (usuario_id = 2)
INSERT INTO categorias (id, usuario_id, nome, tipo, classificacao) VALUES
(10, 2, 'Salário', 'entrada', NULL),
(11, 2, 'Outras entradas', 'entrada', NULL),
(12, 2, 'Alimentação', 'saida', 'necessidade'),
(13, 2, 'Moradia', 'saida', 'necessidade'),
(14, 2, 'Saúde', 'saida', 'necessidade'),
(15, 2, 'Mobilidade', 'saida', 'necessidade'),
(16, 2, 'Lazer', 'saida', 'desejo'),
(17, 2, 'Educação', 'saida', 'necessidade'),
(18, 2, 'Outras saídas', 'saida', 'desejo');

-- ============================================
-- FONTES/DESTINOS (ids fixos: 1-5 Ana, 6-10 Bruno)
-- tipo: renda/conta/cartao_credito
-- ============================================
-- Ana (usuario_id = 1)
INSERT INTO fontes_destinos (id, usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva) VALUES
(1, 1, 'Conta corrente', 'conta', NULL, NULL, NULL, 0),
(2, 1, 'Poupança', 'conta', NULL, NULL, NULL, 1),
(3, 1, 'Cartão Nubank', 'cartao_credito', 3, 10, 8000.00, 0),
(4, 1, 'Cartão Visa', 'cartao_credito', 25, 5, 12000.00, 0),
(5, 1, 'Salário', 'renda', NULL, NULL, NULL, 0);

-- Bruno (usuario_id = 2)
INSERT INTO fontes_destinos (id, usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva) VALUES
(6, 2, 'Conta corrente', 'conta', NULL, NULL, NULL, 0),
(7, 2, 'Poupança', 'conta', NULL, NULL, NULL, 1),
(8, 2, 'Cartão Nubank', 'cartao_credito', 3, 10, 8000.00, 0),
(9, 2, 'Cartão Visa', 'cartao_credito', 25, 5, 12000.00, 0),
(10, 2, 'Salário', 'renda', NULL, NULL, NULL, 0);

-- ============================================
-- LANÇAMENTOS (Task 9)
-- 3 meses relativos a CURDATE(): @m0 (mês corrente), @m1 (-1 mês), @m2 (-2 meses)
-- Nenhuma data futura: uso LEAST(DATE_ADD(@m0, INTERVAL k DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)) para @m0
-- Para @m1/@m2 uso DATE_ADD com k entre 1 e 25 (sempre passado)
-- Compra parcelada 10x: Notebook 3000.00 no Cartão Nubank, grupo fixo
-- ============================================

-- Variáveis de data (usadas via SET para MySQL)
SET @m0 = DATE_FORMAT(CURDATE(), '%Y-%m-01');
SET @m1 = DATE_SUB(@m0, INTERVAL 1 MONTH);
SET @m2 = DATE_SUB(@m0, INTERVAL 2 MONTH);

-- Função auxiliar para data segura no mês corrente (nunca futura)
-- Uso: LEAST(DATE_ADD(@m0, INTERVAL k DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY))
-- Para meses passados: DATE_ADD(@mX, INTERVAL k DAY) com k 1..25

-- ============================================
-- LANÇAMENTOS - ANA (usuario_id = 1)
-- ============================================

-- Mês @m0 (mês corrente) - Ana
-- Salário 5200.00 (entrada, cat 1, fonte 5)
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(1, 'entrada', 'Salário', 5200.00, LEAST(DATE_ADD(@m0, INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 1, 5);

-- Aluguel 1500.00 (saida, cat 4, fonte 1)
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(1, 'saida', 'Aluguel', 1500.00, LEAST(DATE_ADD(@m0, INTERVAL 3 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 4, 1);

-- Mercado 3x ~320 (saida, cat 3, fonte 1)
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(1, 'saida', 'Mercado', 320.00, LEAST(DATE_ADD(@m0, INTERVAL 7 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 3, 1),
(1, 'saida', 'Mercado', 320.00, LEAST(DATE_ADD(@m0, INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 3, 1),
(1, 'saida', 'Mercado', 320.00, LEAST(DATE_ADD(@m0, INTERVAL 21 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 3, 1);

-- Uber/combustível 230.00 (saida, cat 6, fonte 1)
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(1, 'saida', 'Uber/Combustível', 230.00, LEAST(DATE_ADD(@m0, INTERVAL 10 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 6, 1);

-- Farmácia 120.00 (saida, cat 5, fonte 1)
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(1, 'saida', 'Farmácia', 120.00, LEAST(DATE_ADD(@m0, INTERVAL 12 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 5, 1);

-- Lazer 180.00 (saida, cat 7, fonte 3 - Cartão Nubank)
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(1, 'saida', 'Lazer', 180.00, LEAST(DATE_ADD(@m0, INTERVAL 18 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 7, 3);

-- Curso 250.00 (saida, cat 8, fonte 1)
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(1, 'saida', 'Curso', 250.00, LEAST(DATE_ADD(@m0, INTERVAL 22 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 8, 1);

-- Mês @m1 (-1 mês) - Ana
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(1, 'entrada', 'Salário', 5200.00, DATE_ADD(@m1, INTERVAL 5 DAY), 1, 5),
(1, 'saida', 'Aluguel', 1500.00, DATE_ADD(@m1, INTERVAL 3 DAY), 4, 1),
(1, 'saida', 'Mercado', 320.00, DATE_ADD(@m1, INTERVAL 7 DAY), 3, 1),
(1, 'saida', 'Mercado', 320.00, DATE_ADD(@m1, INTERVAL 14 DAY), 3, 1),
(1, 'saida', 'Mercado', 320.00, DATE_ADD(@m1, INTERVAL 21 DAY), 3, 1),
(1, 'saida', 'Uber/Combustível', 230.00, DATE_ADD(@m1, INTERVAL 10 DAY), 6, 1),
(1, 'saida', 'Farmácia', 120.00, DATE_ADD(@m1, INTERVAL 12 DAY), 5, 1),
(1, 'saida', 'Lazer', 180.00, DATE_ADD(@m1, INTERVAL 18 DAY), 7, 3),
(1, 'saida', 'Curso', 250.00, DATE_ADD(@m1, INTERVAL 22 DAY), 8, 1);

-- Mês @m2 (-2 meses) - Ana
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(1, 'entrada', 'Salário', 5200.00, DATE_ADD(@m2, INTERVAL 5 DAY), 1, 5),
(1, 'saida', 'Aluguel', 1500.00, DATE_ADD(@m2, INTERVAL 3 DAY), 4, 1),
(1, 'saida', 'Mercado', 320.00, DATE_ADD(@m2, INTERVAL 7 DAY), 3, 1),
(1, 'saida', 'Mercado', 320.00, DATE_ADD(@m2, INTERVAL 14 DAY), 3, 1),
(1, 'saida', 'Mercado', 320.00, DATE_ADD(@m2, INTERVAL 21 DAY), 3, 1),
(1, 'saida', 'Uber/Combustível', 230.00, DATE_ADD(@m2, INTERVAL 10 DAY), 6, 1),
(1, 'saida', 'Farmácia', 120.00, DATE_ADD(@m2, INTERVAL 12 DAY), 5, 1),
(1, 'saida', 'Lazer', 180.00, DATE_ADD(@m2, INTERVAL 18 DAY), 7, 3),
(1, 'saida', 'Curso', 250.00, DATE_ADD(@m2, INTERVAL 22 DAY), 8, 1);

-- ============================================
-- LANÇAMENTOS - BRUNO (usuario_id = 2)
-- Pelo menos 1 entrada e 1 saída por mês
-- ============================================

-- Mês @m0 - Bruno
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(2, 'entrada', 'Salário', 4800.00, LEAST(DATE_ADD(@m0, INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 10, 10),
(2, 'saida', 'Aluguel', 1300.00, LEAST(DATE_ADD(@m0, INTERVAL 3 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 13, 6),
(2, 'saida', 'Mercado', 300.00, LEAST(DATE_ADD(@m0, INTERVAL 10 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 12, 6),
(2, 'saida', 'Transporte', 200.00, LEAST(DATE_ADD(@m0, INTERVAL 15 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY)), 15, 6);

-- Mês @m1 - Bruno
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(2, 'entrada', 'Salário', 4800.00, DATE_ADD(@m1, INTERVAL 5 DAY), 10, 10),
(2, 'saida', 'Aluguel', 1300.00, DATE_ADD(@m1, INTERVAL 3 DAY), 13, 6),
(2, 'saida', 'Mercado', 300.00, DATE_ADD(@m1, INTERVAL 10 DAY), 12, 6),
(2, 'saida', 'Transporte', 200.00, DATE_ADD(@m1, INTERVAL 15 DAY), 15, 6);

-- Mês @m2 - Bruno
INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id) VALUES
(2, 'entrada', 'Salário', 4800.00, DATE_ADD(@m2, INTERVAL 5 DAY), 10, 10),
(2, 'saida', 'Aluguel', 1300.00, DATE_ADD(@m2, INTERVAL 3 DAY), 13, 6),
(2, 'saida', 'Mercado', 300.00, DATE_ADD(@m2, INTERVAL 10 DAY), 12, 6),
(2, 'saida', 'Transporte', 200.00, DATE_ADD(@m2, INTERVAL 15 DAY), 15, 6);

-- ============================================
-- COMPRA PARCELADA 10x - Notebook 3000.00
-- Ana, Cartão Nubank (fonte_id = 3), categoria Lazer (cat 7) ou Outras saídas (cat 9)
-- Usando categoria 'Outras saídas' (id 9) que é saida/desejo
-- grupo_parcelamento fixo: '11111111-1111-4111-8111-111111111111'
-- data = LEAST(DATE_ADD(@m0, INTERVAL 19 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY))
-- 10 parcelas de 300.00 cada = 3000.00 total
-- ============================================

SET @data_parcelada = LEAST(DATE_ADD(@m0, INTERVAL 19 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY));
SET @grupo_uuid = '11111111-1111-4111-8111-111111111111';

INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id, parcela_atual, total_parcelas, grupo_parcelamento) VALUES
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 1, 10, @grupo_uuid),
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 2, 10, @grupo_uuid),
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 3, 10, @grupo_uuid),
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 4, 10, @grupo_uuid),
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 5, 10, @grupo_uuid),
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 6, 10, @grupo_uuid),
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 7, 10, @grupo_uuid),
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 8, 10, @grupo_uuid),
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 9, 10, @grupo_uuid),
(1, 'saida', 'Notebook', 300.00, @data_parcelada, 9, 3, 10, 10, @grupo_uuid);