-- [Critério 2] UNIQUE (uq_usuarios_email/uq_usuarios_cpf) garante e-mail/CPF únicos.
-- [Critério 14] Integridade e tipos: FK, UNIQUE, CHECK e dinheiro em DECIMAL(12,2).
CREATE DATABASE IF NOT EXISTS api_financas;
USE api_financas;
SET NAMES utf8mb4;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL,
    cpf CHAR(11) NOT NULL,
    senha_hash VARCHAR(100) NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_usuarios_email UNIQUE (email),
    CONSTRAINT uq_usuarios_cpf UNIQUE (cpf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nome VARCHAR(60) NOT NULL,
    tipo ENUM('entrada','saida') NOT NULL,
    classificacao ENUM('necessidade','desejo','poupanca') NULL,
    CONSTRAINT uq_categorias_nome UNIQUE (usuario_id, nome, tipo),
    CONSTRAINT fk_categorias_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE fontes_destinos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nome VARCHAR(60) NOT NULL,
    tipo ENUM('renda','conta','cartao_credito') NOT NULL,
    dia_fechamento TINYINT NULL,
    dia_vencimento TINYINT NULL,
    limite DECIMAL(12,2) NULL,
    reserva TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT uq_fontes_nome UNIQUE (usuario_id, nome),
    CONSTRAINT ck_dias CHECK (
        (tipo <> 'cartao_credito' AND dia_fechamento IS NULL AND dia_vencimento IS NULL)
        OR (tipo = 'cartao_credito' AND dia_fechamento IS NOT NULL AND dia_vencimento IS NOT NULL
            AND dia_fechamento BETWEEN 1 AND 31 AND dia_vencimento BETWEEN 1 AND 31)
    ),
    CONSTRAINT ck_cartao CHECK (
        (tipo <> 'cartao_credito' AND limite IS NULL)
        OR (tipo = 'cartao_credito' AND limite IS NOT NULL AND limite > 0)
    ),
    CONSTRAINT fk_fontes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE lancamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo ENUM('entrada','saida') NOT NULL,
    descricao VARCHAR(120) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    data DATE NOT NULL,
    categoria_id INT NOT NULL,
    fonte_destino_id INT NOT NULL,
    parcela_atual TINYINT NOT NULL DEFAULT 1,
    total_parcelas TINYINT NOT NULL DEFAULT 1,
    grupo_parcelamento CHAR(36) NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_valor CHECK (valor > 0),
    CONSTRAINT ck_parcelas CHECK (
        total_parcelas BETWEEN 1 AND 48
        AND parcela_atual BETWEEN 1 AND total_parcelas
    ),
    CONSTRAINT fk_lancamentos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_lancamentos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT,
    CONSTRAINT fk_lancamentos_fonte FOREIGN KEY (fonte_destino_id) REFERENCES fontes_destinos(id) ON DELETE RESTRICT,
    INDEX idx_lancamentos_usuario_data (usuario_id, data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;