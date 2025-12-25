using System;
using System.Collections.Generic;
using System.Web.Mvc;

namespace Pontos
{
    public class SimpleDependencyResolver : IDependencyResolver
    {
        private readonly IDictionary<Type, Func<object>> _registrations;
        private readonly IDependencyResolver _fallbackResolver;

        public SimpleDependencyResolver(IDependencyResolver fallbackResolver)
        {
            _fallbackResolver = fallbackResolver;
            _registrations = new Dictionary<Type, Func<object>>();
        }

        public void Register<TService>(Func<TService> factory) where TService : class
        {
            if (factory == null)
            {
                throw new ArgumentNullException(nameof(factory));
            }

            _registrations[typeof(TService)] = () => factory();
        }

        public object GetService(Type serviceType)
        {
            if (_registrations.TryGetValue(serviceType, out var factory))
            {
                return factory();
            }

            return _fallbackResolver?.GetService(serviceType);
        }

        public IEnumerable<object> GetServices(Type serviceType)
        {
            var results = new List<object>();

            if (_registrations.TryGetValue(serviceType, out var factory))
            {
                results.Add(factory());
            }

            if (_fallbackResolver != null)
            {
                var fallbackServices = _fallbackResolver.GetServices(serviceType);
                if (fallbackServices != null)
                {
                    results.AddRange(fallbackServices);
                }
            }

            return results;
        }
    }
}
