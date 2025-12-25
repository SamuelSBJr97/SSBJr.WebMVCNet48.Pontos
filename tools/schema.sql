USE master;
GO

IF DB_ID('Relatorios') IS NULL
BEGIN
    CREATE DATABASE Relatorios;
END;
GO

IF DB_ID('Rastreamento') IS NULL
BEGIN
    CREATE DATABASE Rastreamento;
END;
GO

/* ===== Relatorios DB: tabela principal de pontos ===== */
USE Relatorios;
GO

IF OBJECT_ID('dbo.pontos', 'U') IS NOT NULL
    DROP TABLE dbo.pontos;
GO

CREATE TABLE dbo.pontos
(
    pto_id           INT IDENTITY(1,1) PRIMARY KEY,
    pto_empresa      NVARCHAR(150)   NOT NULL,
    pto_placa        NVARCHAR(20)    NOT NULL,
    pto_emissao      DATETIME2(0)    NOT NULL,
    pto_localizacao  NVARCHAR(255)   NULL,
    pto_cidade1      NVARCHAR(120)   NULL,
    pto_estado1      NVARCHAR(2)     NULL,
    pto_motorista    NVARCHAR(150)   NULL,
    pto_volt_bateria NVARCHAR(20)    NULL,
    pto_situacao     NVARCHAR(80)    NULL,
    pto_latitude     NVARCHAR(30)    NULL,
    pto_longitude    NVARCHAR(30)    NULL,
    pto_velocidade   NVARCHAR(20)    NULL
);

CREATE NONCLUSTERED INDEX IX_pontos_emissao ON dbo.pontos(pto_emissao DESC);
CREATE NONCLUSTERED INDEX IX_pontos_motorista ON dbo.pontos(pto_motorista);
CREATE NONCLUSTERED INDEX IX_pontos_placa ON dbo.pontos(pto_placa);
CREATE NONCLUSTERED INDEX IX_pontos_empresa ON dbo.pontos(pto_empresa);
GO

/* ===== Rastreamento DB: tabelas auxiliares ===== */
USE Rastreamento;
GO

IF OBJECT_ID('dbo.Empresas', 'U') IS NOT NULL
    DROP TABLE dbo.Empresas;
IF OBJECT_ID('dbo.Motoristas', 'U') IS NOT NULL
    DROP TABLE dbo.Motoristas;
IF OBJECT_ID('dbo.Veiculos', 'U') IS NOT NULL
    DROP TABLE dbo.Veiculos;
GO

CREATE TABLE dbo.Empresas
(
    empr_id      INT IDENTITY(1,1) PRIMARY KEY,
    empr_apelido NVARCHAR(150) NOT NULL UNIQUE,
    empr_cnpj    NVARCHAR(20)  NOT NULL UNIQUE
);

CREATE TABLE dbo.Motoristas
(
    mot_id            INT IDENTITY(1,1) PRIMARY KEY,
    mot_apelido       NVARCHAR(150) NOT NULL,
    mot_senha_correta NVARCHAR(150) NULL, -- RFID
    mot_matricula     NVARCHAR(50)  NULL,
    mot_cnpj_empresa  NVARCHAR(20)  NULL,
    CONSTRAINT FK_Motoristas_Empresas
        FOREIGN KEY (mot_cnpj_empresa) REFERENCES dbo.Empresas (empr_cnpj)
);

CREATE TABLE dbo.Veiculos
(
    vei_id      INT IDENTITY(1,1) PRIMARY KEY,
    vei_placa   NVARCHAR(20) NOT NULL UNIQUE,
    vei_empr_id INT          NOT NULL,
    CONSTRAINT FK_Veiculos_Empresas
        FOREIGN KEY (vei_empr_id) REFERENCES dbo.Empresas (empr_id)
);

CREATE NONCLUSTERED INDEX IX_Motoristas_Apelido ON dbo.Motoristas(mot_apelido);
CREATE NONCLUSTERED INDEX IX_Motoristas_Rfid ON dbo.Motoristas(mot_senha_correta);
CREATE NONCLUSTERED INDEX IX_Veiculos_Placa ON dbo.Veiculos(vei_placa);
GO