using Dapper;
using SSBJr.WebMVCNet48.Pontos.Models;
using SSBJr.WebNet48.Pontos.Models;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data.SqlClient;
using System.Linq;
using System.Web;

namespace SSBJr.WebMVCNet48.Pontos.Repository
{
    public class HomeRepository
    {
        public HomeRepository(string connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new ArgumentException("Connection string cannot be null or empty.", nameof(connectionString));
            }

            Server = connectionString;
        }

        public HomeRepository()
            : this(GetDefaultConnectionString())
        {
        }

        private static string GetDefaultConnectionString()
        {
            var config = ConfigurationManager.ConnectionStrings["RelatoriosDb"];
            if (config == null || string.IsNullOrWhiteSpace(config.ConnectionString))
            {
                throw new InvalidOperationException("Connection string 'RelatoriosDb' is not configured.");
            }

            return config.ConnectionString;
        }

        #region Placas por Motorista

        private const string SPECIAL_OPTION_ALL = "__all__";
        private const string SPECIAL_OPTION_NULL = "__null__";
        private const string SPECIAL_OPTION_ALL_LABEL = "Nenhum Filtro";
        private const string SPECIAL_OPTION_NULL_LABEL = "Nulo/Vazio";

        /// <summary>
        /// Retorna as opções especiais padrão para filtros de autocomplete
        /// </summary>
        private static List<KeyValuePair<string, string>> GetSpecialFilterOptions()
        {
            return new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>(SPECIAL_OPTION_ALL, SPECIAL_OPTION_ALL_LABEL),
                new KeyValuePair<string, string>(SPECIAL_OPTION_NULL, SPECIAL_OPTION_NULL_LABEL)
            };
        }

        /// <summary>
        /// Constrói condições de filtro dinâmicas para queries de autocomplete
        /// </summary>
        private (string whereClause, DynamicParameters parameters) BuildAutoCompleteConditions(
            string termo,
            string nullFilter,
            string columnName)
        {
            var conditions = new List<string>();
            var parameters = new DynamicParameters();

            // Filtro por termo
            if (!string.IsNullOrEmpty(termo))
            {
                conditions.Add($"CHARINDEX(@termo, {columnName}) > 0");
                parameters.Add("@termo", termo);
            }

            // Filtro de nulo/vazio
            if (nullFilter == SPECIAL_OPTION_NULL)
            {
                conditions.Add($"({columnName} IS NULL OR {columnName} = '')");
            }
            else if (nullFilter == SPECIAL_OPTION_ALL)
            {
                conditions.Add($"{columnName} IS NOT NULL AND {columnName} <> ''");
            }

            string whereClause = conditions.Count > 0 ? $"WHERE {string.Join(" AND ", conditions)}" : "";
            return (whereClause, parameters);
        }

        // Mapeamento de colunas do DataTable para colunas do banco de dados
        private Dictionary<string, string> ConsultaPlacaColumnMapping = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "Empresa", "pto_empresa" },
                    { "Placa", "pto_placa" },
                    { "Emissao", "pto_emissao" },
                    { "Localizacao", "pto_localizacao" },
                    { "Motorista", "pto_motorista" },
                    { "Voltagem", "pto_volt_bateria" },
                    { "Situacao", "pto_situacao" },
                    { "Latitude", "pto_latitude" },
                    { "Longitude", "pto_longitude" },
                    { "Velocidade", "pto_velocidade" }
                };

        public string Server { get; private set; }

        private (string whereClause, DynamicParameters parameters) BuildConsultaPlacaWhere(MotoristaPlacaFilter filter)
        {
            var conditions = new List<string>();
            var parameters = new DynamicParameters();

            conditions.Add("pto_emissao BETWEEN @dataInicio AND @dataFim");
            parameters.Add("@dataInicio", filter.DataInicio);
            parameters.Add("@dataFim", filter.DataFim);

            var hasMotoristaVal = !string.IsNullOrEmpty(filter.Motorista)
                                  && filter.Motorista != SPECIAL_OPTION_ALL
                                  && filter.Motorista != SPECIAL_OPTION_NULL;

            var hasRFidVal = !string.IsNullOrEmpty(filter.RFid)
                             && filter.RFid != SPECIAL_OPTION_ALL
                             && filter.RFid != SPECIAL_OPTION_NULL;

            if (hasMotoristaVal && hasRFidVal)
            {
                conditions.Add("pto_motorista IN (@motorista, @rfid)");
                parameters.Add("@motorista", filter.Motorista);
                parameters.Add("@rfid", filter.RFid);
            }
            else if (hasMotoristaVal)
            {
                conditions.Add("pto_motorista = @motorista");
                parameters.Add("@motorista", filter.Motorista);
            }
            else if (hasRFidVal)
            {
                conditions.Add("pto_motorista = @rfid");
                parameters.Add("@rfid", filter.RFid);
            }
            else if (filter.Motorista == SPECIAL_OPTION_NULL || filter.RFid == SPECIAL_OPTION_NULL)
            {
                conditions.Add("(pto_motorista IS NULL OR LTRIM(RTRIM(pto_motorista)) = '')");
            }

            if (!string.IsNullOrEmpty(filter.Placa))
            {
                if (filter.Placa == SPECIAL_OPTION_NULL)
                {
                    conditions.Add("(pto_placa IS NULL OR LTRIM(RTRIM(pto_placa)) = '')");
                }
                else if (filter.Placa != SPECIAL_OPTION_ALL)
                {
                    conditions.Add("pto_placa = @placa");
                    parameters.Add("@placa", filter.Placa);
                }
            }

            if (!string.IsNullOrEmpty(filter.Empresa))
            {
                if (filter.Empresa == SPECIAL_OPTION_NULL)
                {
                    conditions.Add("(pto_empresa IS NULL OR LTRIM(RTRIM(pto_empresa)) = '')");
                }
                else if (filter.Empresa != SPECIAL_OPTION_ALL)
                {
                    conditions.Add("pto_empresa = @empresa");
                    parameters.Add("@empresa", filter.Empresa);
                }
            }

            return (string.Join(" AND ", conditions), parameters);
        }

        private string BuildConsultaPlacaOrderBy(MotoristaPlacaFilter filter)
        {
            var orderByClauses = new List<string>();
            if (filter.Order != null && filter.Order.Count > 0 && filter.Columns != null)
            {
                foreach (var orderItem in filter.Order)
                {
                    if (orderItem.Column >= 0 && orderItem.Column < filter.Columns.Count)
                    {
                        var columnData = filter.Columns[orderItem.Column].Data;
                        if (!string.IsNullOrEmpty(columnData) && ConsultaPlacaColumnMapping.ContainsKey(columnData))
                        {
                            var dbColumn = ConsultaPlacaColumnMapping[columnData];
                            var direction = orderItem.Dir?.Equals("asc", StringComparison.OrdinalIgnoreCase) == true ? "ASC" : "DESC";
                            orderByClauses.Add($"{dbColumn} {direction}");
                        }
                    }
                }
            }
            return orderByClauses.Count > 0 ? string.Join(", ", orderByClauses) : "pto_emissao ASC";
        }

        private string BuildConsultaPlacaSelect(bool includeCount)
        {
            return $@"
                    SELECT
                        pto_empresa AS Empresa,
                        pto_placa AS Placa,
                        pto_emissao AS Emissao,
                        (pto_localizacao + ' ' + pto_cidade1 + ' ' + pto_Estado1) AS Localizacao,
                        pto_motorista AS Motorista,
                        pto_volt_bateria AS Voltagem,
                        pto_situacao AS Situacao,
                        pto_latitude AS Latitude,
                        pto_longitude AS Longitude,
                        pto_velocidade AS Velocidade
                    FROM relatorios.dbo.pontos WITH(NOLOCK)";
        }

        private string InterpolateDebugQuery(string query, DynamicParameters parameters)
        {
            var debugQuery = query;
            foreach (var param in parameters.ParameterNames)
            {
                var value = parameters.Get<object>(param);
                var valueStr = value == null ? "NULL" :
                               value is string ? $"'{value}'" :
                               value is DateTime ? $"'{((DateTime)value):yyyy-MM-dd HH:mm:ss}'" :
                               value.ToString();
                debugQuery = debugQuery.Replace($"@{param}", valueStr);
            }
            return debugQuery;
        }

        /// <summary>
        /// Busca dados de placas/pontos filtrados por motorista ou RFID com paginação
        /// </summary>
        public List<MotoristaPlacaResult> GetConsultaPlacaData(MotoristaPlacaFilter filter, out string outQuery)
        {
            try
            {
                var (whereClause, parameters) = BuildConsultaPlacaWhere(filter);
                var orderByClause = BuildConsultaPlacaOrderBy(filter);
                var select = BuildConsultaPlacaSelect(includeCount: true);
                string query = $@"
                    {select}
                    WHERE {whereClause}
                    ORDER BY {orderByClause}";

                outQuery = InterpolateDebugQuery(query, parameters);
                //System.Diagnostics.Debug.WriteLine("=== QUERY INTERPOLADA ===");
                //System.Diagnostics.Debug.WriteLine(debugQuery);
                //System.Diagnostics.Debug.WriteLine("=========================");

                using (var connection = new SqlConnection(Server))
                {
                    return connection.Query<MotoristaPlacaResult>(query, parameters, commandTimeout: 1200).ToList();
                }
            }
            catch (Exception ex)
            {
                throw ex;
            }
        }

        /// <summary>
        /// Retorna contagem total de registros para o filtro informado
        /// </summary>
        public int GetConsultaPlacaCount(MotoristaPlacaFilter filter)
        {
            var (whereClause, parameters) = BuildConsultaPlacaWhere(filter);
            string query = $@"SELECT COUNT(1) FROM relatorios.dbo.pontos WITH(NOLOCK) WHERE {whereClause}";
            using (var connection = new SqlConnection(Server))
            {
                return connection.ExecuteScalar<int>(query, parameters, commandTimeout: 1200);
            }
        }

        /// <summary>
        /// Busca página de dados diretamente do banco (sem materialização completa)
        /// </summary>
        public List<MotoristaPlacaResult> GetConsultaPlacaDataPaged(MotoristaPlacaFilter filter, int start, int length, out string outQuery)
        {
            var (whereClause, parameters) = BuildConsultaPlacaWhere(filter);
            var orderByClause = BuildConsultaPlacaOrderBy(filter);
            var select = BuildConsultaPlacaSelect(includeCount: false);
            string query = $@"
                {select}
                WHERE {whereClause}
                ORDER BY {orderByClause}
                OFFSET @start ROWS FETCH NEXT @length ROWS ONLY";

            parameters.Add("@start", start);
            parameters.Add("@length", length > 0 ? length : 50);

            outQuery = InterpolateDebugQuery(query, parameters);

            using (var connection = new SqlConnection(Server))
            {
                return connection.Query<MotoristaPlacaResult>(query, parameters, commandTimeout: 1200).ToList();
            }
        }

        /// <summary>
        /// Retorna IEnumerable para STREAMING direto no Excel (buffered:false)
        /// </summary>
        public IEnumerable<MotoristaPlacaResult> GetConsultaPlacaDataStream(MotoristaPlacaFilter filter, out string outQuery)
        {
            var (whereClause, parameters) = BuildConsultaPlacaWhere(filter);
            var orderByClause = BuildConsultaPlacaOrderBy(filter);
            var select = BuildConsultaPlacaSelect(includeCount: false);
            string query = $@"
                {select}
                WHERE {whereClause}
                ORDER BY {orderByClause}";

            outQuery = InterpolateDebugQuery(query, parameters);

            var connection = new SqlConnection(Server);
            // OBS: Não usar using para manter o streaming até o consumidor finalizar
            return connection.Query<MotoristaPlacaResult>(query, parameters, buffered: false, commandTimeout: 1200);
        }

        /// <summary>
        /// Busca todos os motoristas únicos para preenchimento de filtro com dados completos (motorista, RFID, matrícula, empresa)
        /// Opções especiais: __null__ para nulos/vazios, __all__ para sem filtro
        /// </summary>
        public List<MotoristaPlacaFilterMotoristaResult> GetConsultaPlacaMotoristas(string termoMotorista = "", string termoRfid = "", int skip = 0, int take = 50, string nullFilter = "", string empresa = "", string fieldType = "motorista")
        {
            try
            {
                // Determinar coluna de busca baseado no fieldType
                string searchColumn = fieldType == "rfid" ? "m.[mot_senha_correta]" : "m.[mot_apelido]";

                var conditions = new List<string>();
                var parameters = new DynamicParameters();

                string joinEmpresa = "";

                var hasTermoMotorista = !string.IsNullOrEmpty(termoMotorista);
                var hasTermoRfid = !string.IsNullOrEmpty(termoRfid);

                if (hasTermoMotorista || hasTermoRfid)
                {
                    // Filtros por termo separados (motorista e RFID)
                    if (hasTermoMotorista)
                    {
                        conditions.Add("CHARINDEX(@termoMotorista, m.[mot_apelido]) > 0");
                        parameters.Add("@termoMotorista", termoMotorista);
                    }
                    if (hasTermoRfid)
                    {
                        conditions.Add("CHARINDEX(@termoRfid, m.[mot_senha_correta]) > 0");
                        parameters.Add("@termoRfid", termoRfid);
                    }
                }
                else
                {
                    conditions.Add($"{searchColumn} IS NOT NULL AND {searchColumn} <> ''");
                }

                // Filtro por empresa
                if (!string.IsNullOrWhiteSpace(empresa) && empresa != SPECIAL_OPTION_ALL && empresa != SPECIAL_OPTION_NULL)
                {
                    joinEmpresa = "INNER JOIN [Rastreamento].[dbo].[Empresas] e WITH(NOLOCK) ON e.[empr_cnpj] = m.[mot_cnpj_empresa] AND e.[empr_apelido] = @empresa";
                    parameters.Add("@empresa", empresa);
                }

                string whereClause = conditions.Count > 0 ? $"WHERE {string.Join(" AND ", conditions)}" : "";

                string query = $@"
                    SELECT DISTINCT
                        m.[mot_id] AS MotoristaId,
                        m.[mot_apelido] AS MotoristaDescricao,
                        m.[mot_senha_correta] AS RfidDescricao,
                        m.[mot_senha_correta] AS RfidId,
                        m.[mot_matricula] AS Matricula
                    FROM [Rastreamento].[dbo].[Motoristas] m WITH(NOLOCK)
                    {joinEmpresa}
                    {whereClause}
                    ORDER BY {searchColumn}
                    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY";

                parameters.Add("@skip", skip);
                parameters.Add("@take", take);

                using (var connection = new SqlConnection(Server))
                {
                    return connection.Query<MotoristaPlacaFilterMotoristaResult>(query, parameters, commandTimeout: 300).ToList();
                }
            }
            catch (Exception ex)
            {
                throw ex;
            }
        }

        /// <summary>
        /// Busca todas as empresas únicas para preenchimento de filtro
        /// Opções especiais: __null__ para nulos/vazios, __all__ para sem filtro
        /// </summary>
        public List<KeyValuePair<string, string>> GetConsultaPlacaEmpresas(string termo = "", int skip = 0, int take = 50, string nullFilter = "")
        {
            try
            {
                var (whereClause, parameters) = BuildAutoCompleteConditions(termo, nullFilter, "[empr_apelido]");

                string query = $@"
                    SELECT DISTINCT
                        [empr_apelido] AS [Key],
                        [empr_apelido] AS [Value]
                    FROM [Rastreamento].[dbo].[Empresas] WITH(NOLOCK)
                    {whereClause}
                    ORDER BY [empr_apelido]
                    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY";

                parameters.Add("@skip", skip);
                parameters.Add("@take", take);

                using (var connection = new SqlConnection(Server))
                {
                    var result = connection.Query<KeyValuePair<string, string>>(query, parameters, commandTimeout: 300).ToList();

                    if (skip == 0)
                    {
                        result = GetSpecialFilterOptions().Concat(result).ToList();
                    }

                    return result;
                }
            }
            catch (Exception ex)
            {
                throw ex;
            }
        }

        /// <summary>
        /// Busca todas as empresas únicas para preenchimento de filtro
        /// Opções especiais: __null__ para nulos/vazios, __all__ para sem filtro
        /// </summary>
        public List<KeyValuePair<string, string>> GetConsultaPlacaPlacas(string termo = "", int skip = 0, int take = 50, string nullFilter = "", string empresa = "")
        {
            try
            {
                var (whereClause, parameters) = BuildAutoCompleteConditions(termo, nullFilter, "v.[vei_placa]");

                // Filtro por empresa selecionada (quando informado e não especial)
                var hasEmpresa = !string.IsNullOrWhiteSpace(empresa) && empresa != SPECIAL_OPTION_ALL && empresa != SPECIAL_OPTION_NULL;

                // Construir JOIN e WHERE
                string joinClause = string.Empty;
                if (hasEmpresa)
                {
                    joinClause = "INNER JOIN [Rastreamento].[dbo].[Empresas] e WITH(NOLOCK) ON e.[empr_id] = v.[vei_empr_id] AND e.[empr_apelido] = @empresa";
                    parameters.Add("@empresa", empresa);
                }

                string query = $@"
                    SELECT DISTINCT
                        v.[vei_placa] AS [Key],
                        v.[vei_placa] AS [Value]
                    FROM [Rastreamento].[dbo].[Veiculos] v WITH(NOLOCK)
                    {joinClause}
                    {whereClause}
                    ORDER BY v.[vei_placa]
                    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY";

                parameters.Add("@skip", skip);
                parameters.Add("@take", take);

                using (var connection = new SqlConnection(Server))
                {
                    var result = connection.Query<KeyValuePair<string, string>>(query, parameters, commandTimeout: 300).ToList();

                    if (skip == 0)
                    {
                        result = GetSpecialFilterOptions().Concat(result).ToList();
                    }

                    return result;
                }
            }
            catch (Exception ex)
            {
                throw ex;
            }
        }

        /// <summary>
        /// Busca todas as placas únicas para preenchimento de filtro
        /// Opções especiais: __null__ para nulos/vazios, __all__ para sem filtro
        /// </summary>
        public List<KeyValuePair<string, string>> GetConsultaPlacaPlacas(string termo = "", int skip = 0, int take = 50, string nullFilter = "")
        {
            try
            {
                var (whereClause, parameters) = BuildAutoCompleteConditions(termo, nullFilter, "[vei_placa]");

                string query = $@"
                    SELECT DISTINCT
                        [vei_placa] AS [Key],
                        [vei_placa] AS [Value]
                    FROM [Rastreamento].[dbo].[Veiculos] WITH(NOLOCK)
                    {whereClause}
                    ORDER BY [vei_placa]
                    OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY";

                parameters.Add("@skip", skip);
                parameters.Add("@take", take);

                using (var connection = new SqlConnection(Server))
                {
                    var result = connection.Query<KeyValuePair<string, string>>(query, parameters, commandTimeout: 300).ToList();

                    if (skip == 0)
                    {
                        result = GetSpecialFilterOptions().Concat(result).ToList();
                    }

                    return result;
                }
            }
            catch (Exception ex)
            {
                throw ex;
            }
        }
        #endregion Placas por Motorista
    }
}