using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SSBJr.WebMVCNet48.Pontos.Models
{
    /// <summary>
    /// Modelo de filtro para consulta de placas por motorista
    /// </summary>
    public class MotoristaPlacaFilter
    {
        public string Motorista { get; set; }
        public string RFid { get; set; }
        public DateTime DataInicio { get; set; }
        public DateTime DataFim { get; set; }
        public string Empresa { get; set; }
        public string Placa { get; set; }
        public string SessionId { get; set; }

        // Propriedades de paginação do DataTable
        public int Draw { get; set; }
        public string Search { get; set; }
        public int Start { get; set; }
        public int Length { get; set; }

        // Propriedades de ordenação (suporta múltiplas colunas)
        public List<DataTableOrderColumn> Order { get; set; }
        public List<DataTableColumn> Columns { get; set; }
    }

    /// <summary>
    /// Representa um critério de ordenação do DataTable
    /// </summary>
    public class DataTableOrderColumn
    {
        public int Column { get; set; }
        public string Dir { get; set; }
    }

    /// <summary>
    /// Representa uma coluna do DataTable
    /// </summary>
    public class DataTableColumn
    {
        public string Data { get; set; }
        public string Name { get; set; }
        public bool Searchable { get; set; }
        public bool Orderable { get; set; }
    }

    /// <summary>
    /// Representa a busca global do DataTable
    /// </summary>
    public class DataTableSearch
    {
        public string Value { get; set; }
        public bool Regex { get; set; }
    }
}