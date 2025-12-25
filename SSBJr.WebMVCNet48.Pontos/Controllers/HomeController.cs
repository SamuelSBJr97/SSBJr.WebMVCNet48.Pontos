using SSBJr.WebMVCNet48.Pontos.Helper;
using SSBJr.WebMVCNet48.Pontos.Models;
using SSBJr.WebMVCNet48.Pontos.Repository;
using SSBJr.WebNet48.Pontos.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Web;
using System.Web.Mvc;

namespace SSBJr.WebMVCNet48.Pontos.Controllers
{
    public class HomeController : Controller
    {
        private readonly HomeRepository _repository;

        public HomeController()
            : this(DependencyResolver.Current.GetService<HomeRepository>())
        {
        }

        public HomeController(HomeRepository repository)
        {
            _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        }

        [HttpGet]
        public ActionResult Index()
        {
            return View();
        }

        #region Consulta Placas

        private const string CONSULTA_PLACA_CACHE_KEY_PREFIX = "ConsultaPlaca_";

        [HttpPost]
        public JsonResult GetConsultaPlacaData(MotoristaPlacaFilter filter)
        {
            try
            {
                // Validação antecipada: exigir ao menos um filtro válido (motorista ou RFID)
                var hasValidMotorista = !(string.IsNullOrWhiteSpace(filter.Motorista) || filter.Motorista == "__all__" || filter.Motorista == "__null__");
                var hasValidRfid = !(string.IsNullOrWhiteSpace(filter.RFid) || filter.RFid == "__all__" || filter.RFid == "__null__");

                if (!hasValidMotorista && !hasValidRfid)
                {
                    var invalidJson = Json(new
                    {
                        draw = filter.Draw,
                        recordsTotal = 0,
                        recordsFiltered = 0,
                        data = new List<MotoristaPlacaResult>(),
                        invalidFilters = true,
                        message = "Selecione um Motorista ou RFID válido (não nulo/vazio)."
                    });
                    invalidJson.MaxJsonLength = int.MaxValue;
                    return invalidJson;
                }

                string outQuery = "";

                // Decisão de alto volume baseada em dados em cache da sessão
                var cacheKey = CONSULTA_PLACA_CACHE_KEY_PREFIX;
                var sessionData = Session[cacheKey] as List<MotoristaPlacaResult>;
                var isHighVolume = sessionData != null && sessionData.Count > 250000;

                List<MotoristaPlacaResult> pagedData;
                int recordsFiltered;
                int recordsTotal;
                bool fromCache = false;

                if (isHighVolume)
                {
                    // Alto volume: buscar página diretamente do banco, sem busca textual e sem cache
                    pagedData = _repository.GetConsultaPlacaDataPaged(filter, filter.Start, filter.Length > 0 ? filter.Length : 50, out outQuery);
                    recordsFiltered = sessionData.Count; // usa tamanho do cache existente como total conhecido
                    recordsTotal = sessionData.Count;
                }
                else
                {
                    List<MotoristaPlacaResult> allData = null;

                    if (filter.Draw > 1 && sessionData != null)
                    {
                        allData = sessionData;
                        outQuery = "FROM CACHE";
                        fromCache = true;
                    }
                    else
                    {
                        // Buscar do banco
                        allData = _repository.GetConsultaPlacaData(filter, out outQuery);

                        // Se exceder 250k, não salvar na sessão e tratar como alto volume nas próximas requisições
                        if (allData != null && allData.Count > 250000)
                        {
                            Session[cacheKey] = null;
                        }
                        else
                        {
                            Session[cacheKey] = allData;
                        }
                    }

                    // Aplicar busca global do DataTable (apenas baixo volume)
                    var filteredData = allData.AsQueryable();
                    if (filter.Search != null && !string.IsNullOrEmpty(filter.Search))
                    {
                        var searchTerm = filter.Search;
                        var comparison = StringComparison.CurrentCultureIgnoreCase;

                        filteredData = filteredData.Where(x =>
                            (x.Empresa != null && x.Empresa.IndexOf(searchTerm, comparison) >= 0) ||
                            (x.Placa != null && x.Placa.IndexOf(searchTerm, comparison) >= 0) ||
                            (x.Motorista != null && x.Motorista.IndexOf(searchTerm, comparison) >= 0) ||
                            (x.Localizacao != null && x.Localizacao.IndexOf(searchTerm, comparison) >= 0) ||
                            (x.Situacao != null && x.Situacao.IndexOf(searchTerm, comparison) >= 0)
                        );
                    }

                    recordsFiltered = filteredData.Count();

                    // Aplicar ordenação
                    if (filter.Order != null && filter.Order.Count > 0 && filter.Columns != null)
                    {
                        foreach (var order in filter.Order)
                        {
                            if (order.Column >= 0 && order.Column < filter.Columns.Count)
                            {
                                var columnName = filter.Columns[order.Column].Data;
                                var ascending = order.Dir?.Equals("asc", StringComparison.OrdinalIgnoreCase) ?? false;
                                filteredData = ApplyOrdering(filteredData, columnName, ascending);
                            }
                        }
                    }

                    // Aplicar paginação
                    pagedData = filteredData
                        .Skip(filter.Start)
                        .Take(filter.Length > 0 ? filter.Length : 50)
                        .ToList();

                    recordsTotal = allData?.Count ?? 0;
                }

                var json = Json(new
                {
                    draw = filter.Draw,
                    recordsTotal = recordsTotal,
                    recordsFiltered = recordsFiltered,
                    data = pagedData,
                    query = outQuery,
                    cached = !isHighVolume && fromCache,
                    highVolume = isHighVolume
                });

                json.MaxJsonLength = int.MaxValue;

                return json;
            }
            catch (Exception ex)
            {
                Response.StatusCode = (int)HttpStatusCode.BadRequest;
                return Json(new { error = "Erro ao buscar dados: " + ex.Message });
            }
        }

        private IQueryable<MotoristaPlacaResult> ApplyOrdering(IQueryable<MotoristaPlacaResult> query, string columnName, bool ascending)
        {
            switch (columnName)
            {
                case "Empresa":
                    return ascending ? query.OrderBy(x => x.Empresa) : query.OrderByDescending(x => x.Empresa);
                case "Placa":
                    return ascending ? query.OrderBy(x => x.Placa) : query.OrderByDescending(x => x.Placa);
                case "Emissao":
                    return ascending ? query.OrderBy(x => x.Emissao) : query.OrderByDescending(x => x.Emissao);
                case "Localizacao":
                    return ascending ? query.OrderBy(x => x.Localizacao) : query.OrderByDescending(x => x.Localizacao);
                case "Motorista":
                    return ascending ? query.OrderBy(x => x.Motorista) : query.OrderByDescending(x => x.Motorista);
                case "Voltagem":
                    return ascending ? query.OrderBy(x => x.Voltagem) : query.OrderByDescending(x => x.Voltagem);
                case "Situacao":
                    return ascending ? query.OrderBy(x => x.Situacao) : query.OrderByDescending(x => x.Situacao);
                case "Latitude":
                    return ascending ? query.OrderBy(x => x.Latitude) : query.OrderByDescending(x => x.Latitude);
                case "Longitude":
                    return ascending ? query.OrderBy(x => x.Longitude) : query.OrderByDescending(x => x.Longitude);
                case "Velocidade":
                    return ascending ? query.OrderBy(x => x.Velocidade) : query.OrderByDescending(x => x.Velocidade);
                default:
                    return query;
            }
        }

        [HttpPost]
        public JsonResult GetConsultaPlacaMotoristaAutocomplete(string termoMotorista, string termoRfid, int skip = 0, int take = 50, string nullFilter = "", string empresa = "", string fieldType = "motorista")
        {
            try
            {
                var data = _repository.GetConsultaPlacaMotoristas(termoMotorista ?? "", termoRfid ?? "", skip, take, nullFilter ?? "", empresa ?? "", fieldType ?? "motorista");

                return Json(new
                {
                    items = data,
                    hasMore = data.Count >= take
                }, JsonRequestBehavior.AllowGet);
            }
            catch
            {
                Response.StatusCode = (int)HttpStatusCode.BadRequest;
                return Json(new { error = "Erro ao buscar motoristas" }, JsonRequestBehavior.AllowGet);
            }
        }

        [HttpPost]
        public JsonResult GetConsultaPlacaPlacasAutocomplete(string termo, int skip = 0, int take = 50, string nullFilter = "", string empresa = "")
        {
            try
            {
                var data = _repository.GetConsultaPlacaPlacas(termo ?? "", skip, take, nullFilter ?? "", empresa ?? "");

                return Json(new
                {
                    items = data
                }, JsonRequestBehavior.AllowGet);
            }
            catch
            {
                Response.StatusCode = (int)HttpStatusCode.BadRequest;
                return Json(new { error = "Erro ao buscar placas" }, JsonRequestBehavior.AllowGet);
            }
        }

        [HttpPost]
        public JsonResult GetConsultaPlacaEmpresas(string termo = "", int skip = 0, int take = 50, string nullFilter = "")
        {
            try
            {
                var empresas = _repository.GetConsultaPlacaEmpresas(termo, skip, take, nullFilter ?? "");

                return Json(new
                {
                    items = empresas
                }, JsonRequestBehavior.AllowGet);
            }
            catch
            {
                Response.StatusCode = (int)HttpStatusCode.BadRequest;
                return Json(new { error = "Erro ao buscar empresas" }, JsonRequestBehavior.AllowGet);
            }
        }

        [HttpPost]
        public void ExportConsultaPlacaExcel(string motorista, string rfid, DateTime dataInicio, DateTime dataFim, string empresa = "", string placa = "")
        {
            try
            {
                // Validação antecipada: exigir ao menos um filtro válido (motorista ou RFID)
                var hasValidMotorista = !(string.IsNullOrWhiteSpace(motorista) || motorista == "__all__" || motorista == "__null__");
                var hasValidRfid = !(string.IsNullOrWhiteSpace(rfid) || rfid == "__all__" || rfid == "__null__");

                if (!hasValidMotorista && !hasValidRfid)
                {
                    Response.StatusCode = (int)HttpStatusCode.BadRequest;
                    Response.ContentType = "application/json";
                    Response.Write("{\"error\":\"Selecione um Motorista ou RFID válido (não nulo/vazio).\"}");
                    return;
                }

                // Preparar filtro
                var filter = new MotoristaPlacaFilter
                {
                    Motorista = motorista,
                    RFid = rfid,
                    DataInicio = dataInicio,
                    DataFim = dataFim,
                    Empresa = empresa,
                    Placa = placa
                };

                // Gerar nome do arquivo
                var fileName = $"STI - Pontos por Motorista.xlsx";

                // Configurar Response
                Response.Clear();
                Response.ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                Response.AddHeader("Content-Disposition", $"attachment; filename=\"{fileName}\"");
                Response.BufferOutput = false;

                // Estratégia baseada em cache da sessão
                var cacheKey = CONSULTA_PLACA_CACHE_KEY_PREFIX;
                var sessionData = Session[cacheKey] as List<MotoristaPlacaResult>;

                if (sessionData != null && sessionData.Count > 250000)
                {
                    // Alto volume: streaming direto do banco, sem materializar lista
                    string outQuery;
                    var streamEnumerable = _repository.GetConsultaPlacaDataStream(filter, out outQuery);
                    ExcelWebExportHelper.ExportToExcel(Response.OutputStream, streamEnumerable, "Pontos por Motorista");
                }
                else
                {
                    // Baixo volume: usar cache se disponível; caso exceda, não salvar na sessão
                    List<MotoristaPlacaResult> allData = sessionData;
                    if (allData == null)
                    {
                        string outQuery;
                        allData = _repository.GetConsultaPlacaData(filter, out outQuery);
                        if (allData != null && allData.Count <= 250000)
                        {
                            Session[cacheKey] = allData;
                        }
                    }
                    ExcelWebExportHelper.ExportToExcel(Response.OutputStream, allData, "Pontos por Motorista");
                }

                Response.Flush();
                Response.End();
            }
            catch (Exception ex)
            {
                Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            }
        }

        #endregion Consulta Placas
    }
}