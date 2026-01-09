using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace Pontos.Controllers
{
    public class VeiculoController : Controller
    {
        [HttpGet]
        public ActionResult Index()
        {
            return View();
        }

        [HttpGet]
        public JsonResult LoadEmpresaDivisaoByUsuario(string usuario)
        {
            return Json(new { success = true, data = "Dados de Empresa e Divisão para o usuário: " + usuario }, JsonRequestBehavior.AllowGet);
        }

        [HttpGet]
        public JsonResult LoadEmpresaBySearch(string search)
        {
            return Json(new { success = true, data = "Lista de veículos para Divisão: " + search }, JsonRequestBehavior.AllowGet);
        }

        [HttpGet]
        public JsonResult LoadDivisaoByEmpresa(string empresa)
        {
            return Json(new { success = true, data = "Lista de veículos para Empresa: " + empresa }, JsonRequestBehavior.AllowGet);
        }
    }
}
