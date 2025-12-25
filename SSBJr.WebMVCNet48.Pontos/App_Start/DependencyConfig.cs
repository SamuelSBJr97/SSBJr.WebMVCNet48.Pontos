using System;
using System.Configuration;
using System.Web.Mvc;
using SSBJr.WebMVCNet48.Pontos.Repository;

namespace Pontos
{
    public static class DependencyConfig
    {
        public static void RegisterDependencies()
        {
            var defaultResolver = DependencyResolver.Current;
            var resolver = new SimpleDependencyResolver(defaultResolver);

            resolver.Register(() =>
            {
                var connectionString = ConfigurationManager.ConnectionStrings["RelatoriosDb"]?.ConnectionString;
                if (string.IsNullOrWhiteSpace(connectionString))
                {
                    throw new InvalidOperationException("Connection string 'RelatoriosDb' is not configured.");
                }

                return new HomeRepository(connectionString);
            });

            DependencyResolver.SetResolver(resolver);
        }
    }
}
