using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Web;
using System.Xml;

namespace SSBJr.WebMVCNet48.Pontos.Helper
{
    /// <summary>
    /// Utilitário para exportar dados para Excel (.xlsx) otimizado para aplicações web no IIS
    /// Não requer dependências externas (apenas System.IO.Compression incluído no .NET Framework)
    /// Não requer WindowsBase - totalmente seguro para ambiente web
    /// Streaming real com delegates compilados para máxima performance
    /// Thread-safe e otimizado para alta concorrência
    /// </summary>
    public static class ExcelWebExportHelper
    {
        // Limites de segurança para ambiente de produção IIS
        private const int MAX_ROWS_DEFAULT = 500000; // Máximo de linhas padrão
        private const int MAX_COLUMNS = 256; // Limite Excel compatibilidade
        private const int MAX_CELL_LENGTH = 32767; // Limite Excel por célula
        private const int BUFFER_SIZE = 81920; // 80KB - otimizado para IIS

        // Configuração de SharedStrings - Política híbrida
        private const int MAX_SHARED_STRINGS = 10000; // Limite para evitar crescimento descontrolado
        private const int SHARED_STRINGS_SAMPLE_SIZE = 500; // Amostra para construir cache inicial

        /// <summary>
        /// Limite configurável de linhas (ajuste no Application_Start para suas necessidades)
        /// </summary>
        public static int MaxRowsLimit { get; set; } = MAX_ROWS_DEFAULT;

        /// <summary>
        /// Habilita diagnóstico de performance (desabilitado por padrão em produção)
        /// </summary>
        public static bool DiagnosticsEnabled { get; set; } = false;

        /// <summary>
        /// Accessor otimizado com delegate compilado para acesso rápido a propriedades
        /// </summary>
        private class PropertyAccessor
        {
            public System.Reflection.PropertyInfo Property { get; set; }
            public Func<object, object> Getter { get; set; }
            public string DisplayName { get; set; }
            public Type PropertyType { get; set; }
            public bool IsNumeric { get; set; }
            public bool IsDateTime { get; set; }
            public bool IsBoolean { get; set; }
            public double EstimatedWidth { get; set; }
        }
        /// <summary>
        /// Cria PropertyAccessors otimizados com delegates compilados (sem reflexão no hot path)
        /// </summary>
        private static List<PropertyAccessor> CreatePropertyAccessors(Type type)
        {
            var accessors = new List<PropertyAccessor>();
            var properties = type.GetProperties()
                .Where(p => p.CanRead && IsSimpleType(p.PropertyType));

            foreach (var property in properties)
            {
                // Compilar delegate para acesso rápido sem reflexão
                var parameter = System.Linq.Expressions.Expression.Parameter(typeof(object), "obj");
                var castObj = System.Linq.Expressions.Expression.Convert(parameter, type);
                var propertyAccess = System.Linq.Expressions.Expression.Property(castObj, property);
                var castResult = System.Linq.Expressions.Expression.Convert(propertyAccess, typeof(object));
                var lambda = System.Linq.Expressions.Expression.Lambda<Func<object, object>>(castResult, parameter);
                var compiledGetter = lambda.Compile();

                var accessor = new PropertyAccessor
                {
                    Property = property,
                    Getter = compiledGetter,
                    DisplayName = GetDisplayName(property),
                    PropertyType = property.PropertyType,
                    IsNumeric = IsNumericType(property.PropertyType),
                    IsDateTime = property.PropertyType == typeof(DateTime) || property.PropertyType == typeof(DateTime?),
                    IsBoolean = property.PropertyType == typeof(bool) || property.PropertyType == typeof(bool?),
                    EstimatedWidth = Math.Min(Math.Max(GetDisplayName(property).Length + 2, 10), 50)
                };

                accessors.Add(accessor);
            }

            return accessors;
        }

        /// <summary>
        /// Exporta dados para um arquivo Excel (.xlsx) escrevendo diretamente no stream de saída (Response.OutputStream)
        /// Ideal para uso direto com HttpResponse para evitar buffering em memória
        /// STREAMING REAL: Não materializa IEnumerable, processa em até 2 passagens
        /// </summary>
        /// <exception cref="ArgumentNullException">Quando outputStream ou data são nulos</exception>
        /// <exception cref="ArgumentException">Quando stream não permite escrita ou dados excedem limites</exception>
        /// <exception cref="InvalidOperationException">Quando há erro na geração do arquivo</exception>
        public static void ExportToExcel<T>(Stream outputStream, IEnumerable<T> data, string sheetName = "Sheet1")
        {
            // Validações críticas para produção
            if (outputStream == null)
                throw new ArgumentNullException(nameof(outputStream), "Stream de saída não pode ser nulo");

            if (data == null)
                throw new ArgumentNullException(nameof(data), "Dados não podem ser nulos");

            if (!outputStream.CanWrite)
                throw new ArgumentException("Stream de saída deve permitir escrita", nameof(outputStream));

            // Sanitizar nome da planilha
            sheetName = SanitizeSheetName(sheetName);

            var stopwatch = DiagnosticsEnabled ? Stopwatch.StartNew() : null;

            try
            {
                using (var archive = new ZipArchive(outputStream, ZipArchiveMode.Create, leaveOpen: true))
                {
                    // Criar PropertyAccessors otimizados (delegates compilados)
                    var accessors = CreatePropertyAccessors(typeof(T));

                    if (accessors.Count == 0)
                    {
                        throw new InvalidOperationException(
                            $"Tipo {typeof(T).Name} não possui propriedades públicas exportáveis");
                    }

                    if (accessors.Count > MAX_COLUMNS)
                    {
                        throw new ArgumentException(
                            $"Número de colunas ({accessors.Count}) excede o limite ({MAX_COLUMNS})",
                            nameof(data));
                    }

                    // Criar estrutura Office Open XML
                    CreateContentTypes(archive);
                    CreateRels(archive);
                    CreateWorkbook(archive, sheetName);
                    CreateWorkbookRels(archive);
                    CreateStyles(archive);

                    // Criar worksheet com streaming real (sem materialização completa)
                    CreateWorksheetStreaming(archive, data, accessors);
                }

                if (stopwatch != null)
                {
                    stopwatch.Stop();
                    Trace.WriteLine($"ExcelWebExportHelper: Exportação concluída em {stopwatch.ElapsedMilliseconds}ms");
                }
            }
            catch (Exception ex)
            {
                // Log para diagnóstico em produção
                Trace.WriteLine($"ExcelWebExportHelper ERROR: {ex.Message}");
                Trace.WriteLine($"StackTrace: {ex.StackTrace}");

                throw new InvalidOperationException(
                    $"Erro ao gerar arquivo Excel: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Sobrecarga para compatibilidade com List
        /// </summary>
        public static void ExportToExcel<T>(Stream outputStream, List<T> data, string sheetName = "Sheet1")
        {
            ExportToExcel(outputStream, (IEnumerable<T>)data, sheetName);
        }

        /// <summary>
        /// Exporta dados para um arquivo Excel (.xlsx) retornando byte array
        /// AVISO: Para grandes volumes (>10000 registros), prefira a sobrecarga que escreve diretamente no stream
        /// </summary>
        /// <exception cref="ArgumentNullException">Quando data é nulo</exception>
        /// <exception cref="OutOfMemoryException">Quando dados são muito grandes para memória</exception>
        public static byte[] ExportToExcel<T>(IEnumerable<T> data, string sheetName = "Sheet1")
        {
            if (data == null)
                throw new ArgumentNullException(nameof(data));

            // Estimar tamanho inicial (evita realocações)
            // Usa capacidade conservadora para evitar LOH (>85KB)
            var estimatedSize = 4096; // 4KB inicial

            using (var memoryStream = new MemoryStream(estimatedSize))
            {
                ExportToExcel(memoryStream, data, sheetName);
                return memoryStream.ToArray();
            }
        }

        /// <summary>
        /// Sobrecarga byte[] para compatibilidade com List
        /// </summary>
        public static byte[] ExportToExcel<T>(List<T> data, string sheetName = "Sheet1")
        {
            return ExportToExcel((IEnumerable<T>)data, sheetName);
        }

        private static void CreateContentTypes(ZipArchive archive)
        {
            var entry = archive.CreateEntry("[Content_Types].xml", CompressionLevel.Fastest);
            using (var writer = new StreamWriter(entry.Open(), Encoding.UTF8))
            {
                writer.Write(@"<?xml version=""1.0"" encoding=""UTF-8"" standalone=""yes""?>
<Types xmlns=""http://schemas.openxmlformats.org/package/2006/content-types"">
    <Default Extension=""rels"" ContentType=""application/vnd.openxmlformats-package.relationships+xml""/>
    <Default Extension=""xml"" ContentType=""application/xml""/>
    <Override PartName=""/xl/workbook.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml""/>
    <Override PartName=""/xl/worksheets/sheet1.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml""/>
    <Override PartName=""/xl/styles.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml""/>
    <Override PartName=""/xl/sharedStrings.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml""/>
</Types>");
            }
        }

        private static void CreateRels(ZipArchive archive)
        {
            var entry = archive.CreateEntry("_rels/.rels", CompressionLevel.Fastest);
            using (var writer = new StreamWriter(entry.Open(), Encoding.UTF8))
            {
                writer.Write(@"<?xml version=""1.0"" encoding=""UTF-8"" standalone=""yes""?>
<Relationships xmlns=""http://schemas.openxmlformats.org/package/2006/relationships"">
    <Relationship Id=""rId1"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"" Target=""xl/workbook.xml""/>
</Relationships>");
            }
        }

        private static void CreateWorkbook(ZipArchive archive, string sheetName)
        {
            var entry = archive.CreateEntry("xl/workbook.xml", CompressionLevel.Fastest);
            using (var writer = new StreamWriter(entry.Open(), Encoding.UTF8))
            {
                var escapedSheetName = EscapeXml(sheetName);
                writer.Write("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
                writer.Write("<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">");
                writer.Write("<fileVersion appName=\"xl\" lastEdited=\"6\" lowestEdited=\"6\" rupBuild=\"14420\"/>");
                writer.Write("<workbookPr defaultThemeVersion=\"164011\"/>");
                writer.Write("<bookViews>");
                writer.Write("<workbookView xWindow=\"0\" yWindow=\"0\" windowWidth=\"20000\" windowHeight=\"10000\"/>");
                writer.Write("</bookViews>");
                writer.Write("<sheets>");
                writer.Write("<sheet name=\"");
                writer.Write(escapedSheetName);
                writer.Write("\" sheetId=\"1\" r:id=\"rId1\"/>");
                writer.Write("</sheets>");
                writer.Write("<calcPr calcId=\"171027\"/>");
                writer.Write("</workbook>");
            }
        }

        private static void CreateWorkbookRels(ZipArchive archive)
        {
            var entry = archive.CreateEntry("xl/_rels/workbook.xml.rels", CompressionLevel.Fastest);
            using (var writer = new StreamWriter(entry.Open(), Encoding.UTF8))
            {
                writer.Write(@"<?xml version=""1.0"" encoding=""UTF-8"" standalone=""yes""?>
<Relationships xmlns=""http://schemas.openxmlformats.org/package/2006/relationships"">
    <Relationship Id=""rId1"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"" Target=""worksheets/sheet1.xml""/>
    <Relationship Id=""rId2"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"" Target=""styles.xml""/>
    <Relationship Id=""rId3"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings"" Target=""sharedStrings.xml""/>
</Relationships>");
            }
        }

        private static void CreateStyles(ZipArchive archive)
        {
            var entry = archive.CreateEntry("xl/styles.xml", CompressionLevel.Fastest);
            using (var writer = new StreamWriter(entry.Open(), Encoding.UTF8))
            {
                writer.Write("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
                writer.Write("<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\" mc:Ignorable=\"x14ac x16r2 xr\" xmlns:x14ac=\"http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac\" xmlns:x16r2=\"http://schemas.microsoft.com/office/spreadsheetml/2015/02/main\" xmlns:xr=\"http://schemas.microsoft.com/office/spreadsheetml/2014/revision\">");
                writer.Write("<numFmts count=\"1\">");
                writer.Write("<numFmt numFmtId=\"14\" formatCode=\"dd/mm/yyyy\"/>");
                writer.Write("</numFmts>");
                writer.Write("<fonts count=\"2\">");
                writer.Write("<font><sz val=\"11\"/><name val=\"Calibri\"/><family val=\"2\"/><scheme val=\"minor\"/></font>");
                writer.Write("<font><b/><sz val=\"11\"/><name val=\"Calibri\"/><family val=\"2\"/><scheme val=\"minor\"/></font>");
                writer.Write("</fonts>");
                writer.Write("<fills count=\"2\">");
                writer.Write("<fill><patternFill patternType=\"none\"/></fill>");
                writer.Write("<fill><patternFill patternType=\"gray125\"/></fill>");
                writer.Write("</fills>");
                writer.Write("<borders count=\"1\">");
                writer.Write("<border><left/><right/><top/><bottom/><diagonal/></border>");
                writer.Write("</borders>");
                writer.Write("<cellStyleXfs count=\"1\">");
                writer.Write("<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/>");
                writer.Write("</cellStyleXfs>");
                writer.Write("<cellXfs count=\"3\">");
                writer.Write("<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>");
                writer.Write("<xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>");
                writer.Write("<xf numFmtId=\"14\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>");
                writer.Write("</cellXfs>");
                writer.Write("<cellStyles count=\"1\">");
                writer.Write("<cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/>");
                writer.Write("</cellStyles>");
                writer.Write("<dxfs count=\"0\"/>");
                writer.Write("<tableStyles count=\"0\" defaultTableStyle=\"TableStyleMedium2\" defaultPivotStyle=\"PivotStyleLight16\"/>");
                writer.Write("</styleSheet>");
            }
        }

        /// <summary>
        /// Cria worksheet com STREAMING REAL - sem materialização completa
        /// Política híbrida de SharedStrings: cache limitado + inline strings
        /// </summary>
        private static void CreateWorksheetStreaming<T>(ZipArchive archive, IEnumerable<T> data, List<PropertyAccessor> accessors)
        {
            var rowCount = 0;
            var stopwatch = DiagnosticsEnabled ? Stopwatch.StartNew() : null;

            // Política de SharedStrings: Cache limitado para evitar crescimento descontrolado
            var sharedStrings = new Dictionary<string, int>(StringComparer.Ordinal);
            var sharedStringsList = new List<string>();

            // Adicionar cabeçalhos ao SharedStrings
            foreach (var accessor in accessors)
            {
                if (!sharedStrings.ContainsKey(accessor.DisplayName))
                {
                    sharedStrings[accessor.DisplayName] = sharedStringsList.Count;
                    sharedStringsList.Add(accessor.DisplayName);
                }
            }

            // Primeira passagem (opcional, limitada): Coletar strings mais comuns
            // Usa amostra pequena para construir cache sem materializar tudo
            var sampleCount = 0;
            var enumerator = data.GetEnumerator();
            var sampleList = new List<T>(SHARED_STRINGS_SAMPLE_SIZE);

            try
            {
                while (enumerator.MoveNext() && sampleCount < SHARED_STRINGS_SAMPLE_SIZE)
                {
                    var item = enumerator.Current;
                    if (item != null)
                    {
                        sampleList.Add(item);
                        sampleCount++;

                        // Coletar strings para SharedStrings (apenas não-numéricos)
                        foreach (var accessor in accessors)
                        {
                            if (!accessor.IsNumeric && !accessor.IsDateTime && !accessor.IsBoolean)
                            {
                                try
                                {
                                    var value = accessor.Getter(item);
                                    if (value != null)
                                    {
                                        var stringValue = value.ToString();
                                        if (!string.IsNullOrEmpty(stringValue) &&
                                            stringValue.Length <= 32767 && // Limite Excel
                                            !sharedStrings.ContainsKey(stringValue) &&
                                            sharedStringsList.Count < MAX_SHARED_STRINGS)
                                        {
                                            sharedStrings[stringValue] = sharedStringsList.Count;
                                            sharedStringsList.Add(stringValue);
                                        }
                                    }
                                }
                                catch { /* Ignora erros de acesso */ }
                            }
                        }
                    }
                }
            }
            finally
            {
                // Não dispose do enumerator ainda - pode ser re-enumeração
            }

            // Criar SharedStrings antes do worksheet
            CreateSharedStrings(archive, sharedStringsList);

            // Criar Worksheet com streaming
            var worksheetEntry = archive.CreateEntry("xl/worksheets/sheet1.xml", CompressionLevel.Optimal);
            using (var stream = worksheetEntry.Open())
            {
                var settings = new XmlWriterSettings
                {
                    Encoding = Encoding.UTF8,
                    Indent = false
                };

                using (var writer = XmlWriter.Create(stream, settings))
                {
                    writer.WriteStartDocument();
                    writer.WriteStartElement("worksheet", "http://schemas.openxmlformats.org/spreadsheetml/2006/main");
                    writer.WriteAttributeString("xmlns", "mc", null, "http://schemas.openxmlformats.org/markup-compatibility/2006");
                    writer.WriteAttributeString("mc", "Ignorable", "http://schemas.openxmlformats.org/markup-compatibility/2006", "x14ac xr xr2 xr3");
                    writer.WriteAttributeString("xmlns", "x14ac", null, "http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac");
                    writer.WriteAttributeString("xmlns", "xr", null, "http://schemas.microsoft.com/office/spreadsheetml/2014/revision");
                    writer.WriteAttributeString("xmlns", "xr2", null, "http://schemas.microsoft.com/office/spreadsheetml/2015/revision2");
                    writer.WriteAttributeString("xmlns", "xr3", null, "http://schemas.microsoft.com/office/spreadsheetml/2016/revision3");

                    // sheetViews
                    writer.WriteStartElement("sheetViews");
                    writer.WriteStartElement("sheetView");
                    writer.WriteAttributeString("workbookViewId", "0");
                    writer.WriteAttributeString("tabSelected", "1");
                    writer.WriteEndElement(); // sheetView
                    writer.WriteEndElement(); // sheetViews

                    // sheetFormatPr
                    writer.WriteStartElement("sheetFormatPr");
                    writer.WriteAttributeString("defaultRowHeight", "15");
                    writer.WriteAttributeString("baseColWidth", "10");
                    writer.WriteEndElement(); // sheetFormatPr

                    // Larguras de colunas baseadas em estimativas (sem re-enumeração)
                    if (accessors.Count > 0)
                    {
                        writer.WriteStartElement("cols");
                        for (int i = 0; i < accessors.Count; i++)
                        {
                            writer.WriteStartElement("col");
                            writer.WriteAttributeString("min", (i + 1).ToString());
                            writer.WriteAttributeString("max", (i + 1).ToString());
                            writer.WriteAttributeString("width", accessors[i].EstimatedWidth.ToString("F2", System.Globalization.CultureInfo.InvariantCulture));
                            writer.WriteAttributeString("customWidth", "1");
                            writer.WriteEndElement();
                        }
                        writer.WriteEndElement();
                    }

                    writer.WriteStartElement("sheetData");

                    // Cabeçalho
                    writer.WriteStartElement("row");
                    writer.WriteAttributeString("r", "1");

                    for (int colIndex = 0; colIndex < accessors.Count; colIndex++)
                    {
                        var stringIndex = sharedStrings[accessors[colIndex].DisplayName];

                        writer.WriteStartElement("c");
                        writer.WriteAttributeString("r", GetCellReference(1, colIndex));
                        writer.WriteAttributeString("t", "s"); // shared string
                        writer.WriteAttributeString("s", "1"); // estilo negrito

                        writer.WriteStartElement("v");
                        writer.WriteString(stringIndex.ToString());
                        writer.WriteEndElement(); // v

                        writer.WriteEndElement(); // c
                    }

                    writer.WriteEndElement(); // row

                    // Dados - STREAMING REAL (sem ToList, sem materialização completa)
                    int rowIndex = 2;

                    // Primeiro processar amostra coletada
                    foreach (var item in sampleList)
                    {
                        if (++rowCount > MaxRowsLimit)
                        {
                            throw new InvalidOperationException(
                                $"Número de linhas ({rowCount}) excede o limite de segurança ({MaxRowsLimit}). " +
                                $"Ajuste ExcelWebExportHelper.MaxRowsLimit se necessário.");
                        }
                        WriteDataRow(writer, rowIndex++, item, accessors, sharedStrings);
                    }

                    // Continuar com resto do enumerável (se ainda houver dados)
                    // Tenta continuar com mesmo enumerator ou re-enumera
                    try
                    {
                        // Continuar do enumerator existente
                        while (enumerator.MoveNext())
                        {
                            if (++rowCount > MaxRowsLimit)
                            {
                                throw new InvalidOperationException(
                                    $"Número de linhas ({rowCount}) excede o limite de segurança ({MaxRowsLimit}). " +
                                    $"Ajuste ExcelWebExportHelper.MaxRowsLimit se necessário.");
                            }

                            var item = enumerator.Current;
                            if (item != null)
                            {
                                WriteDataRow(writer, rowIndex++, item, accessors, sharedStrings);
                            }
                        }
                    }
                    catch
                    {
                        // Se falhar, tentar re-enumerar (para IEnumerable re-enumeráveis)
                        try
                        {
                            var count = 0;
                            foreach (var item in data)
                            {
                                // Pular os que já processamos
                                if (count++ < sampleList.Count) continue;

                                if (item != null)
                                {
                                    WriteDataRow(writer, rowIndex++, item, accessors, sharedStrings);
                                }
                            }
                        }
                        catch { /* Se não for re-enumerável, já processamos o que pudemos */ }
                    }
                    finally
                    {
                        enumerator?.Dispose();
                    }

                    writer.WriteEndElement(); // sheetData
                    writer.WriteEndElement(); // worksheet
                    writer.WriteEndDocument();

                    if (stopwatch != null)
                    {
                        stopwatch.Stop();
                        Trace.WriteLine($"ExcelWebExportHelper: Worksheet criado com {rowCount} linhas em {stopwatch.ElapsedMilliseconds}ms");
                    }
                }
            }
        }

        private static void CreateSharedStrings(ZipArchive archive, List<string> strings)
        {
            var entry = archive.CreateEntry("xl/sharedStrings.xml", CompressionLevel.Optimal);
            using (var stream = entry.Open())
            {
                var settings = new XmlWriterSettings
                {
                    Encoding = Encoding.UTF8,
                    Indent = false
                };

                using (var writer = XmlWriter.Create(stream, settings))
                {
                    writer.WriteStartDocument();
                    writer.WriteStartElement("sst", "http://schemas.openxmlformats.org/spreadsheetml/2006/main");
                    writer.WriteAttributeString("count", strings.Count.ToString());
                    writer.WriteAttributeString("uniqueCount", strings.Count.ToString());

                    foreach (var str in strings)
                    {
                        writer.WriteStartElement("si");
                        writer.WriteStartElement("t");
                        writer.WriteString(str);
                        writer.WriteEndElement(); // t
                        writer.WriteEndElement(); // si
                    }

                    writer.WriteEndElement(); // sst
                    writer.WriteEndDocument();
                }
            }
        }

        /// <summary>
        /// Escreve linha de dados usando delegates compilados (sem reflexão)
        /// </summary>
        private static void WriteDataRow<T>(XmlWriter writer, int rowIndex, T item, List<PropertyAccessor> accessors, Dictionary<string, int> sharedStrings)
        {
            writer.WriteStartElement("row");
            writer.WriteAttributeString("r", rowIndex.ToString());

            for (int colIndex = 0; colIndex < accessors.Count; colIndex++)
            {
                var accessor = accessors[colIndex];
                try
                {
                    var value = accessor.Getter(item);
                    WriteCellOptimized(writer, rowIndex, colIndex, value, accessor, sharedStrings);
                }
                catch
                {
                    // Célula vazia em caso de erro
                    writer.WriteStartElement("c");
                    writer.WriteAttributeString("r", GetCellReference(rowIndex, colIndex));
                    writer.WriteEndElement();
                }
            }

            writer.WriteEndElement(); // row

            // Flush periódico para grandes datasets
            if (rowIndex % 1000 == 0)
            {
                writer.Flush();
            }
        }

        /// <summary>
        /// Escreve célula otimizada com PropertyAccessor
        /// </summary>
        private static void WriteCellOptimized(XmlWriter writer, int rowIndex, int colIndex, object value, PropertyAccessor accessor, Dictionary<string, int> sharedStrings)
        {
            writer.WriteStartElement("c");
            writer.WriteAttributeString("r", GetCellReference(rowIndex, colIndex));

            if (value == null)
            {
                writer.WriteEndElement(); // c (célula vazia)
                return;
            }

            // Usar flags pré-computadas do accessor (sem reflexão no hot path)
            if (accessor.IsNumeric)
            {
                writer.WriteStartElement("v");
                writer.WriteString(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture));
                writer.WriteEndElement(); // v
            }
            else if (accessor.IsBoolean)
            {
                writer.WriteAttributeString("t", "b");
                writer.WriteStartElement("v");
                writer.WriteString((bool)value ? "1" : "0");
                writer.WriteEndElement(); // v
            }
            else if (accessor.IsDateTime)
            {
                var dateValue = (DateTime)value;
                writer.WriteAttributeString("s", "2"); // estilo de data
                writer.WriteStartElement("v");
                writer.WriteString(dateValue.ToOADate().ToString(System.Globalization.CultureInfo.InvariantCulture));
                writer.WriteEndElement(); // v
            }
            // Strings - Política híbrida: SharedString se no cache, senão inline
            else
            {
                var stringValue = value.ToString();

                // Validação de limite Excel (segurança)
                if (stringValue.Length > MAX_CELL_LENGTH)
                {
                    stringValue = stringValue.Substring(0, MAX_CELL_LENGTH - 3) + "...";
                    if (DiagnosticsEnabled)
                    {
                        Trace.WriteLine($"ExcelWebExportHelper: Célula truncada em [{rowIndex},{colIndex}] (original: {value.ToString().Length} chars)");
                    }
                }

                // Tentar usar SharedString do cache
                if (sharedStrings.TryGetValue(stringValue, out int stringIndex))
                {
                    writer.WriteAttributeString("t", "s");
                    writer.WriteStartElement("v");
                    writer.WriteString(stringIndex.ToString());
                    writer.WriteEndElement(); // v
                }
                else
                {
                    // Inline string (strings não encontradas no cache limitado)
                    // Evita crescimento descontrolado do SharedStrings
                    writer.WriteAttributeString("t", "inlineStr");
                    writer.WriteStartElement("is");
                    writer.WriteStartElement("t");
                    writer.WriteString(stringValue);
                    writer.WriteEndElement(); // t
                    writer.WriteEndElement(); // is
                }
            }

            writer.WriteEndElement(); // c
        }

        private static string GetCellReference(int row, int col)
        {
            return GetColumnLetter(col) + row.ToString();
        }

        private static string GetColumnLetter(int colIndex)
        {
            var letter = "";
            while (colIndex >= 0)
            {
                letter = (char)('A' + (colIndex % 26)) + letter;
                colIndex = (colIndex / 26) - 1;
            }
            return letter;
        }

        private static string GetDisplayName(System.Reflection.PropertyInfo property)
        {
            var displayAttr = property.GetCustomAttributes(typeof(DisplayAttribute), false)
                .FirstOrDefault() as DisplayAttribute;

            if (displayAttr != null)
            {
                return displayAttr.Name ?? displayAttr.Description ?? property.Name;
            }

            return property.Name;
        }



        private static bool IsSimpleType(Type type)
        {
            return type.IsPrimitive ||
                   type == typeof(string) ||
                   type == typeof(decimal) ||
                   type == typeof(DateTime) ||
                   type == typeof(TimeSpan) ||
                   type == typeof(Guid) ||
                   (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Nullable<>) &&
                    IsSimpleType(Nullable.GetUnderlyingType(type)));
        }

        private static bool IsNumericType(Type type)
        {
            return type == typeof(int) ||
                   type == typeof(long) ||
                   type == typeof(double) ||
                   type == typeof(float) ||
                   type == typeof(decimal) ||
                   type == typeof(short) ||
                   type == typeof(byte) ||
                   type == typeof(uint) ||
                   type == typeof(ulong) ||
                   type == typeof(ushort) ||
                   type == typeof(sbyte) ||
                   type == typeof(int?) ||
                   type == typeof(long?) ||
                   type == typeof(double?) ||
                   type == typeof(float?) ||
                   type == typeof(decimal?) ||
                   type == typeof(short?) ||
                   type == typeof(byte?) ||
                   type == typeof(uint?) ||
                   type == typeof(ulong?) ||
                   type == typeof(ushort?) ||
                   type == typeof(sbyte?);
        }

        private static string EscapeXml(string text)
        {
            if (string.IsNullOrEmpty(text))
                return text;

            return text
                .Replace("&", "&amp;")
                .Replace("<", "&lt;")
                .Replace(">", "&gt;")
                .Replace("\"", "&quot;")
                .Replace("'", "&apos;");
        }

        /// <summary>
        /// Sanitiza nome da planilha para conformidade com Excel
        /// </summary>
        private static string SanitizeSheetName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                return "Sheet1";

            // Remover caracteres inválidos: \\ / ? * [ ]
            var sanitized = name
                .Replace("\\", "")
                .Replace("/", "")
                .Replace("?", "")
                .Replace("*", "")
                .Replace("[", "")
                .Replace("]", "")
                .Replace(":", ""); // Excel não permite : também

            // Limitar a 31 caracteres (limite Excel)
            if (sanitized.Length > 31)
                sanitized = sanitized.Substring(0, 31);

            return string.IsNullOrWhiteSpace(sanitized) ? "Sheet1" : sanitized;
        }
    }
}