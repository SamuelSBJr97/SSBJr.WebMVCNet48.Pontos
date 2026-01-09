using System.Web;
using System.Web.Optimization;

namespace Pontos
{
    public class BundleConfig
    {
        // Para obter mais informações sobre o agrupamento, visite https://go.microsoft.com/fwlink/?LinkId=301862
        public static void RegisterBundles(BundleCollection bundles)
        {
            bundles.Add(new ScriptBundle("~/bundles/jquery").Include(
                        "~/Scripts/jquery-{version}.js"));

            bundles.Add(new ScriptBundle("~/bundles/jqueryval").Include(
                        "~/Scripts/jquery.validate*"));

            // Use a versão em desenvolvimento do Modernizr para desenvolver e aprender com ela. Após isso, quando você estiver
            // pronto para a produção, utilize a ferramenta de build em https://modernizr.com para escolher somente os testes que precisa.
            bundles.Add(new ScriptBundle("~/bundles/modernizr").Include(
                        "~/Scripts/modernizr-*"));

            bundles.Add(new ScriptBundle("~/bundles/popper").Include(
                        "~/Scripts/popper.min.js"));

            bundles.Add(new Bundle("~/bundles/bootstrap").Include(
                      "~/Scripts/bootstrap.js"));

            // Bundle 'Pontos' agora carrega apenas plugins que não são responsáveis por prover jQuery/Bootstrap
            bundles.Add(new Bundle("~/bundles/pontos").Include(
                        "~/Scripts/moment.2.29.4.min.js",
                        "~/Scripts/daterangepicker.min.js",
                        "~/Scripts/jquery.dataTables.1.13.6.min.js",
                        "~/Scripts/datetime-moment.js",
                        "~/Scripts/dataTables.buttons.2.4.2.min.js",
                        "~/Scripts/buttons.bootstrap5.2.4.2.min.js",
                        "~/Scripts/buttons.html5.2.4.2.min.js",
                        "~/Scripts/bootstrap-select.1.13.18.min.js",
                        "~/Scripts/bootstrap-select-i18n-pt_BR.min.js",
                        "~/Scripts/sweetalert2.11.min.js",
                        "~/Scripts/View/Pontos/index.js"));

            bundles.Add(new Bundle("~/bundles/empdiv").Include(
                        "~/Scripts/View/EmpDiv/index.js"));

            bundles.Add(new StyleBundle("~/Content/css").Include(
                      "~/Content/bootstrap.css",
                      "~/Content/site.css"));
        }
    }
}
