/* ===== Dados de exemplo opcionais ===== */
INSERT INTO Rastreamento.dbo.Empresas (empr_apelido, empr_cnpj)
VALUES ('Empresa A', '11111111000100'),
       ('Empresa B', '22222222000100');

INSERT INTO Rastreamento.dbo.Motoristas (mot_apelido, mot_senha_correta, mot_matricula, mot_cnpj_empresa)
VALUES ('João Silva', 'RFID123', 'MAT001', '11111111000100'),
       ('Maria Souza', 'RFID456', 'MAT002', '22222222000100');

INSERT INTO Rastreamento.dbo.Veiculos (vei_placa, vei_empr_id)
VALUES ('ABC1D23', 1),
       ('XYZ4E56', 2);

INSERT INTO Relatorios.dbo.pontos
(
    pto_empresa, pto_placa, pto_emissao, pto_localizacao,
    pto_cidade1, pto_estado1, pto_motorista, pto_volt_bateria,
    pto_situacao, pto_latitude, pto_longitude, pto_velocidade
)
VALUES
('Empresa A', 'ABC1D23', SYSDATETIME(), 'Rodovia BR-116 KM 12', 'São Paulo', 'SP', 'João Silva', '24V', 'Em andamento', '-23.5678', '-46.6488', '65'),
('Empresa B', 'XYZ4E56', DATEADD(HOUR,-2,SYSDATETIME()), 'Av. Paulista 1000', 'São Paulo', 'SP', 'Maria Souza', '24V', 'Parado', '-23.5610', '-46.6550', '0');
GO