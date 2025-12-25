using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SSBJr.WebNet48.Pontos.Models
{
    /// <summary>
    /// Modelo de resultado da consulta de placas por motorista
    /// </summary>
    public class MotoristaPlacaResult
    {
        public string Empresa { get; set; }
        public string Placa { get; set; }
        public string Emissao { get; set; }
        public string Localizacao { get; set; }
        public string Motorista { get; set; }
        public string Voltagem { get; set; }
        public string Situacao { get; set; }
        public string Latitude { get; set; }
        public string Longitude { get; set; }
        public string Velocidade { get; set; }
    }
}