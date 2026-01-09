(function () {
    'use strict';
    function listenersEmpresaDivisao() {
        // Cache de seletores
        const $selectVeiculosEmp = $('#selectVeiculosEmp');
        const $selectVeiculosDiv = $('#selectVeiculosDiv');
        const $selectVeiculosEmpAssoci = $('#selectVeiculosEmpAssoci');
        const $selectVeiculosDivAssoci = $('#selectVeiculosDivAssoci');

        // Verificar se os elementos essenciais existem
        if (!$selectVeiculosEmp.length || !$selectVeiculosDiv.length ||
            !$selectVeiculosEmpAssoci.length || !$selectVeiculosDivAssoci.length) {
            return;
        }

        const $filselectVeiculosEmp = $('#filselectVeiculosEmp');
        const $filselectVeiculosDiv = $('#filselectVeiculosDiv');
        const $filselectVeiculosEmpAssoci = $('#filselectVeiculosEmpAssoci');
        const $filselectVeiculosDivAssoci = $('#filselectVeiculosDivAssoci');

        // Selects ocultos para submissão
        const $selectOcVeiculosEmpAssoci = $('#selectVeiculosEmpAssociHidden');
        const $selectOcVeiculosDivAssoci = $('#selectVeiculosDivAssociHidden');
        const $selectOcVeiculosEmpRem = $('#selectVeiculosEmpRemHidden');
        const $selectOcVeiculosDivRem = $('#selectVeiculosDivRemHidden');

        // Dados em memória
        let todasEmpresas = {};
        let todasDivisoes = {};
        let divisaoParaEmpresaMap = {};

        // Controle de loading
        let isLoading = false;
        let isSyncing = false;

        // ===== FUNÇÕES AUXILIARES =====

        function desabilitarTudo() {
            isLoading = true;
            $selectVeiculosEmp.prop('disabled', true);
            $selectVeiculosDiv.prop('disabled', true);
            $selectVeiculosEmpAssoci.prop('disabled', true);
            $selectVeiculosDivAssoci.prop('disabled', true);
            $filselectVeiculosEmp.prop('disabled', true);
            $filselectVeiculosDiv.prop('disabled', true);
            $filselectVeiculosEmpAssoci.prop('disabled', true);
            $filselectVeiculosDivAssoci.prop('disabled', true);
            $('button[id^="btnEmpresa"], button[id^="btnDivisao"]').prop('disabled', true);
        }

        function habilitarTudo() {
            isLoading = false;
            $selectVeiculosEmp.prop('disabled', false);
            $selectVeiculosDiv.prop('disabled', false);
            $selectVeiculosEmpAssoci.prop('disabled', false);
            $selectVeiculosDivAssoci.prop('disabled', false);
            $filselectVeiculosEmp.prop('disabled', false);
            $filselectVeiculosDiv.prop('disabled', false);
            $filselectVeiculosEmpAssoci.prop('disabled', false);
            $filselectVeiculosDivAssoci.prop('disabled', false);
            $('button[id^="btnEmpresa"], button[id^="btnDivisao"]').prop('disabled', false);
        }

        function debounce(func, wait) {
            let timeout;
            return function executedFunction() {
                const context = this;
                const args = arguments;
                clearTimeout(timeout);
                timeout = setTimeout(function () {
                    func.apply(context, args);
                }, wait);
            };
        }

        function sincronizarSelectsOcultos() {
            isSyncing = true;

            // Sincronizar Empresas Associadas
            $selectOcVeiculosEmpAssoci.empty();
            $selectVeiculosEmpAssoci.find('option').each(function () {
                $selectOcVeiculosEmpAssoci.append($(this).clone().prop('selected', true));
            });

            // Sincronizar Divisões Associadas
            $selectOcVeiculosDivAssoci.empty();
            $selectVeiculosDivAssoci.find('option').each(function () {
                $selectOcVeiculosDivAssoci.append($(this).clone().prop('selected', true));
            });

            // Garantir que todas as options de removidos estejam selecionadas
            $selectOcVeiculosEmpRem.find('option').prop('selected', true);
            $selectOcVeiculosDivRem.find('option').prop('selected', true);

            isSyncing = false;
        }

        function adicionarEmpresaRemovida(empresaId, nomeEmpresa) {
            // Verificar se já existe no select de removidos
            const existe = $selectOcVeiculosEmpRem.find('option[value="' + empresaId + '"]').length > 0;
            if (!existe) {
                const $option = $('<option></option>')
                    .val(empresaId)
                    .text(nomeEmpresa)
                    .prop('selected', true);
                $selectOcVeiculosEmpRem.append($option);
            }
        }

        function adicionarDivisaoRemovida(divisaoId, nomeDivisao) {
            // Verificar se já existe no select de removidos
            const existe = $selectOcVeiculosDivRem.find('option[value="' + divisaoId + '"]').length > 0;
            if (!existe) {
                const $option = $('<option></option>')
                    .val(divisaoId)
                    .text(nomeDivisao)
                    .prop('selected', true);
                $selectOcVeiculosDivRem.append($option);
            }
        }

        function ordenarEmpresasAssociadas() {
            const opcoes = $selectVeiculosEmpAssoci.find('option').get();
            opcoes.sort(function (a, b) {
                return $(a).text().localeCompare($(b).text());
            });
            $selectVeiculosEmpAssoci.empty().append(opcoes);
        }

        function ordenarDivisoesAssociadas() {
            const opcoes = $selectVeiculosDivAssoci.find('option').get();
            opcoes.sort(function (a, b) {
                return $(a).text().localeCompare($(b).text());
            });
            $selectVeiculosDivAssoci.empty().append(opcoes);
        }

        function atualizarQuantidadeEmpresa() {
            const quantidade = $selectVeiculosEmpAssoci.find('option').length;
            $('#quantidadeEmpAssociados').text(quantidade);
            ordenarEmpresasAssociadas();
            sincronizarSelectsOcultos();
        }

        function atualizarQuantidadeDivisao() {
            const quantidade = $selectVeiculosDivAssoci.find('option').length;
            $('#quantidadeDivAssociados').text(quantidade);
            ordenarDivisoesAssociadas();
            sincronizarSelectsOcultos();
        }

        function carregarEmpresas(empresasFiltradas) {
            $selectVeiculosEmp.empty();

            empresasFiltradas.forEach(function (empresaId) {
                const $option = $('<option></option>')
                    .val(empresaId)
                    .text(todasEmpresas[empresaId]);
                $selectVeiculosEmp.append($option);
            });
        }

        function carregarDivisoes(divisoesFiltradas) {
            $selectVeiculosDiv.empty();

            divisoesFiltradas.forEach(function (divisaoId) {
                const divisao = todasDivisoes[divisaoId];
                const $option = $('<option></option>')
                    .val(divisaoId)
                    .text(divisao.descricao)
                    .attr('data-empresa', divisao.empresaId);
                $selectVeiculosDiv.append($option);
            });
        }

        function filtrarEmpresas(filtroTexto, divisoesSelecionadas, empresasEspecificas) {
            const filtro = filtroTexto ? filtroTexto.toLowerCase() : '';
            const temDivisaoSelecionada = divisoesSelecionadas && divisoesSelecionadas.length > 0;
            const temEmpresasEspecificas = empresasEspecificas && empresasEspecificas.length > 0;

            // Criar set de empresas válidas baseado nas divisões selecionadas
            const empresasValidas = {};
            if (temDivisaoSelecionada) {
                divisoesSelecionadas.forEach(function (divId) {
                    const empresaId = divisaoParaEmpresaMap[divId];
                    if (empresaId) {
                        empresasValidas[empresaId] = true;
                    }
                });
            }

            // Se tiver empresas específicas, usar apenas essas
            const empresasPermitidas = {};
            if (temEmpresasEspecificas) {
                empresasEspecificas.forEach(function (empId) {
                    empresasPermitidas[empId] = true;
                });
            }

            // Filtrar empresas
            const empresasFiltradas = [];
            Object.keys(todasEmpresas).forEach(function (empresaId) {
                const nomeEmpresa = todasEmpresas[empresaId];
                const matchTexto = !filtro || nomeEmpresa.toLowerCase().indexOf(filtro) !== -1;
                const matchDivisao = !temDivisaoSelecionada || empresasValidas[empresaId];
                const matchEspecifica = !temEmpresasEspecificas || empresasPermitidas[empresaId];

                if (matchTexto && matchDivisao && matchEspecifica) {
                    empresasFiltradas.push(empresaId);
                }
            });

            // Ordenar alfabeticamente ANTES de carregar
            empresasFiltradas.sort(function (a, b) {
                return todasEmpresas[a].localeCompare(todasEmpresas[b]);
            });

            // Carregar todas as empresas
            carregarEmpresas(empresasFiltradas);
        }

        function filtrarDivisoes(filtroTexto, empresasSelecionadas) {
            const filtro = filtroTexto ? filtroTexto.toLowerCase() : '';
            const temEmpresaSelecionada = empresasSelecionadas && empresasSelecionadas.length > 0;

            // Criar set de empresas selecionadas
            const empresasSet = {};
            if (temEmpresaSelecionada) {
                empresasSelecionadas.forEach(function (empId) {
                    empresasSet[empId] = true;
                });
            }

            // Filtrar divisões
            const divisoesFiltradas = [];
            Object.keys(todasDivisoes).forEach(function (divisaoId) {
                const divisao = todasDivisoes[divisaoId];
                const matchTexto = !filtro || divisao.descricao.toLowerCase().indexOf(filtro) !== -1;
                const matchEmpresa = !temEmpresaSelecionada || empresasSet[divisao.empresaId.toString()];

                if (matchTexto && matchEmpresa) {
                    divisoesFiltradas.push(divisaoId);
                }
            });

            // Ordenar alfabeticamente ANTES de carregar
            divisoesFiltradas.sort(function (a, b) {
                return todasDivisoes[a].descricao.localeCompare(todasDivisoes[b].descricao);
            });

            // Carregar todas as divisões
            carregarDivisoes(divisoesFiltradas);
        }

        function filtrarEmpresasAssociadas(filtroTexto, divisoesSelecionadas) {
            const filtro = filtroTexto ? filtroTexto.toLowerCase() : '';
            const temDivisaoSelecionada = divisoesSelecionadas && divisoesSelecionadas.length > 0;

            // Criar set de empresas válidas baseado nas divisões selecionadas
            const empresasValidas = {};
            if (temDivisaoSelecionada) {
                $selectVeiculosDivAssoci.find('option').each(function () {
                    if (divisoesSelecionadas.indexOf($(this).val()) !== -1) {
                        const empresaId = $(this).attr('data-empresa');
                        if (empresaId) {
                            empresasValidas[empresaId] = true;
                        }
                    }
                });
            }

            $selectVeiculosEmpAssoci.find('option').each(function () {
                const $opt = $(this);
                const texto = $opt.text().toLowerCase();
                const empresaId = $opt.val();

                const matchTexto = !filtro || texto.indexOf(filtro) !== -1;
                const matchDivisao = !temDivisaoSelecionada || empresasValidas[empresaId];

                if (matchTexto && matchDivisao) {
                    $opt.show();
                } else {
                    $opt.hide().prop('selected', false);
                }
            });
        }

        function filtrarDivisoesAssociadas(filtroTexto, empresasSelecionadas) {
            const filtro = filtroTexto ? filtroTexto.toLowerCase() : '';
            const temEmpresaSelecionada = empresasSelecionadas && empresasSelecionadas.length > 0;

            const empresasSet = {};
            if (temEmpresaSelecionada) {
                empresasSelecionadas.forEach(function (empId) {
                    empresasSet[empId] = true;
                });
            }

            $selectVeiculosDivAssoci.find('option').each(function () {
                const $opt = $(this);
                const texto = $opt.text().toLowerCase();
                const empresaId = $opt.attr('data-empresa');

                const matchTexto = !filtro || texto.indexOf(filtro) !== -1;
                const matchEmpresa = !temEmpresaSelecionada || empresasSet[empresaId];

                if (matchTexto && matchEmpresa) {
                    $opt.show();
                } else {
                    $opt.hide().prop('selected', false);
                }
            });
        }

        function recarregarDados() {
            desabilitarTudo();

            $.ajax({
                url: root("Veiculo/LoadEmpresaDivisaoByUsuario"),
                type: 'GET',
                data: { usuario: $('#Id').val() }
            })
                .done(function (result) {
                    if (result) {
                        // Armazenar TODAS as empresas disponíveis
                        if (result.empresa) {
                            todasEmpresas = result.empresa;
                        }

                        // Armazenar TODAS as divisões disponíveis
                        if (result.divisoes) {
                            todasDivisoes = result.divisoes;

                            // Construir mapa de divisão -> empresa
                            divisaoParaEmpresaMap = {};
                            Object.keys(result.divisoes).forEach(function (divId) {
                                const divisao = result.divisoes[divId];
                                divisaoParaEmpresaMap[divId] = divisao.empresaId.toString();
                            });
                        }

                        // Limpar filtros
                        $filselectVeiculosEmp.val('');
                        $filselectVeiculosDiv.val('');

                        // Preencher selects de disponíveis inicialmente
                        filtrarEmpresas('', null);
                        filtrarDivisoes('', null);

                        // Limpar selects de associadas
                        $selectVeiculosEmpAssoci.empty();
                        $selectVeiculosDivAssoci.empty();

                        // Preencher selects de ASSOCIADAS ao login
                        if (result.login) {
                            // Adicionar empresas associadas ao usuário
                            if (result.login.empresa) {
                                Object.keys(result.login.empresa).forEach(function (empresaId) {
                                    const nomeEmpresa = result.login.empresa[empresaId];
                                    const $novaEmpresa = $('<option></option>')
                                        .val(empresaId)
                                        .text(nomeEmpresa);
                                    $selectVeiculosEmpAssoci.append($novaEmpresa);
                                });
                            }

                            // Adicionar divisões associadas ao usuário
                            if (result.login.divisoes) {
                                Object.keys(result.login.divisoes).forEach(function (divisaoId) {
                                    const divisaoData = result.login.divisoes[divisaoId];
                                    const $novaDivisao = $('<option></option>')
                                        .val(divisaoId)
                                        .text(divisaoData.descricao)
                                        .attr('data-empresa', divisaoData.idEmpresa);
                                    $selectVeiculosDivAssoci.append($novaDivisao);
                                });
                            }
                        }

                        atualizarQuantidadeEmpresa();
                        atualizarQuantidadeDivisao();

                        toastr.success('Dados recarregados com sucesso!');
                    }

                    habilitarTudo();
                })
                .fail(function () {
                    toastr.error('Erro ao recarregar empresas e divisões.');
                    habilitarTudo();
                });
        }

        // ===== CARREGAR TODOS OS DADOS =====

        // Desabilitar tudo durante o carregamento
        desabilitarTudo();

        $.ajax({
            url: root("Veiculo/LoadEmpresaDivisaoByUsuario"),
            type: 'GET',
            data: { usuario: $('#Id').val() }
        })
            .done(function (result) {
                if (result) {
                    // Armazenar TODAS as empresas disponíveis
                    if (result.empresa) {
                        todasEmpresas = result.empresa;
                    }

                    // Armazenar TODAS as divisões disponíveis
                    if (result.divisoes) {
                        todasDivisoes = result.divisoes;

                        // Construir mapa de divisão -> empresa
                        Object.keys(result.divisoes).forEach(function (divId) {
                            const divisao = result.divisoes[divId];
                            divisaoParaEmpresaMap[divId] = divisao.empresaId.toString();
                        });
                    }

                    // Preencher selects de disponíveis inicialmente
                    filtrarEmpresas('', null);
                    filtrarDivisoes('', null);

                    console.log('Carregados:', Object.keys(todasEmpresas).length, 'empresas e', Object.keys(todasDivisoes).length, 'divisões disponíveis');

                    // Preencher selects de ASSOCIADAS ao login
                    if (result.login) {
                        // Adicionar empresas associadas ao usuário
                        if (result.login.empresa) {
                            Object.keys(result.login.empresa).forEach(function (empresaId) {
                                const nomeEmpresa = result.login.empresa[empresaId];
                                const existeEmpresa = $selectVeiculosEmpAssoci.find('option[value="' + empresaId + '"]').length > 0;

                                if (!existeEmpresa) {
                                    const $novaEmpresa = $('<option></option>')
                                        .val(empresaId)
                                        .text(nomeEmpresa);
                                    $selectVeiculosEmpAssoci.append($novaEmpresa);
                                }
                            });
                        }

                        // Adicionar divisões associadas ao usuário
                        if (result.login.divisoes) {
                            Object.keys(result.login.divisoes).forEach(function (divisaoId) {
                                const divisaoData = result.login.divisoes[divisaoId];
                                const existeDivisao = $selectVeiculosDivAssoci.find('option[value="' + divisaoId + '"]').length > 0;

                                if (!existeDivisao) {
                                    const $novaDivisao = $('<option></option>')
                                        .val(divisaoId)
                                        .text(divisaoData.descricao)
                                        .attr('data-empresa', divisaoData.idEmpresa);
                                    $selectVeiculosDivAssoci.append($novaDivisao);
                                }
                            });
                        }

                        atualizarQuantidadeEmpresa();
                        atualizarQuantidadeDivisao();

                        console.log('Associadas:', Object.keys(result.login.empresa || {}).length, 'empresas e', Object.keys(result.login.divisoes || {}).length, 'divisões');
                    }
                }

                // Habilitar tudo após carregar
                habilitarTudo();
            })
            .fail(function () {
                toastr.error('Erro ao carregar empresas e divisões.');
                habilitarTudo(); // Habilitar mesmo em caso de erro
            });

        // ===== FILTROS TEXTUAIS - DISPONÍVEIS =====

        $filselectVeiculosEmp.on('input', debounce(function () {
            const filtro = $(this).val();
            const divisoesSelecionadas = $selectVeiculosDiv.val() || [];
            filtrarEmpresas(filtro, divisoesSelecionadas);
        }, 250));

        $filselectVeiculosDiv.on('input', debounce(function () {
            const filtro = $(this).val();
            const empresasSelecionadas = $selectVeiculosEmp.val() || [];
            filtrarDivisoes(filtro, empresasSelecionadas);
        }, 250));

        // ===== FILTROS TEXTUAIS - ASSOCIADOS =====

        $filselectVeiculosEmpAssoci.on('input', debounce(function () {
            const filtro = $(this).val();
            const divisoesSelecionadas = $selectVeiculosDivAssoci.val() || [];
            filtrarEmpresasAssociadas(filtro, divisoesSelecionadas);
        }, 250));

        $filselectVeiculosDivAssoci.on('input', debounce(function () {
            const filtro = $(this).val();
            const empresasSelecionadas = $selectVeiculosEmpAssoci.val() || [];
            filtrarDivisoesAssociadas(filtro, empresasSelecionadas);
        }, 250));

        // ===== SINCRONIZAÇÃO POR SELEÇÃO - DISPONÍVEIS =====

        $selectVeiculosEmp.on('change', function () {
            const filtroTexto = $filselectVeiculosDiv.val() || '';
            const empresasSelecionadas = $(this).val() || [];
            filtrarDivisoes(filtroTexto, empresasSelecionadas);
        });

        $selectVeiculosDiv.on('change', function () {
            const filtroTexto = $filselectVeiculosEmp.val() || '';
            const divisoesSelecionadas = $(this).val() || [];
            filtrarEmpresas(filtroTexto, divisoesSelecionadas);
        });

        // ===== SINCRONIZAÇÃO POR SELEÇÃO - ASSOCIADOS =====

        $selectVeiculosEmpAssoci.on('change', function () {
            const filtroTexto = $filselectVeiculosDivAssoci.val() || '';
            const empresasSelecionadas = $(this).val() || [];
            filtrarDivisoesAssociadas(filtroTexto, empresasSelecionadas);
        });

        $selectVeiculosDivAssoci.on('change', function () {
            const filtroTexto = $filselectVeiculosEmpAssoci.val() || '';
            const divisoesSelecionadas = $(this).val() || [];
            filtrarEmpresasAssociadas(filtroTexto, divisoesSelecionadas);
        });

        // ===== BOTÕES - EMPRESAS =====

        // Adicionar empresa selecionada (seta para direita)
        $('#btnEmpresaAdicionar').click(function () {
            const empresasSelecionadas = $selectVeiculosEmp.val() || [];

            if (empresasSelecionadas.length === 0) {
                toastr.warning('Nenhuma empresa selecionada!');
                return;
            }

            empresasSelecionadas.forEach(function (empresaId) {
                if (empresaId !== '') {
                    const existe = $selectVeiculosEmpAssoci.find('option[value="' + empresaId + '"]').length > 0;
                    if (!existe) {
                        const $option = $selectVeiculosEmp.find('option[value="' + empresaId + '"]').first();
                        if ($option.length > 0) {
                            const $novaOption = $('<option></option>')
                                .val(empresaId)
                                .text($option.text());
                            $selectVeiculosEmpAssoci.append($novaOption);
                        }
                    }
                }
            });

            $selectVeiculosEmp.val(null);
            atualizarQuantidadeEmpresa();
            toastr.success('Empresa(s) adicionada(s) com sucesso!');
        });

        // Adicionar todas as empresas visíveis
        $('#btnEmpresaAdicionarTodos').click(function () {
            let adicionadas = 0;

            $selectVeiculosEmp.find('option:visible').each(function () {
                const empresaId = $(this).val();
                if (empresaId !== '') {
                    const existe = $selectVeiculosEmpAssoci.find('option[value="' + empresaId + '"]').length > 0;
                    if (!existe) {
                        const $novaOption = $('<option></option>')
                            .val(empresaId)
                            .text($(this).text());
                        $selectVeiculosEmpAssoci.append($novaOption);
                        adicionadas++;
                    }
                }
            });

            $selectVeiculosEmp.val(null);
            atualizarQuantidadeEmpresa();

            if (adicionadas > 0) {
                toastr.success(adicionadas + ' empresa(s) adicionada(s) com sucesso!');
            } else {
                toastr.info('Nenhuma empresa nova para adicionar.');
            }
        });

        // Remover empresa selecionada (seta para esquerda)
        $('#btnEmpresaDesassociar').click(function () {
            const empresasSelecionadas = $selectVeiculosEmpAssoci.val() || [];

            if (empresasSelecionadas.length === 0) {
                toastr.warning('Nenhuma empresa selecionada!');
                return;
            }

            empresasSelecionadas.forEach(function (empresaId) {
                if (empresaId !== '') {
                    const $option = $selectVeiculosEmpAssoci.find('option[value="' + empresaId + '"]');
                    const nomeEmpresa = $option.text();

                    // Adicionar ao select de removidos
                    adicionarEmpresaRemovida(empresaId, nomeEmpresa);

                    $option.remove();
                }
            });

            atualizarQuantidadeEmpresa();
            toastr.success('Empresa(s) removida(s) com sucesso!');
        });

        // Remover todas as empresas
        $('#btnEmpresaDesassociarTodos').click(function () {
            // Adicionar todas as empresas ao select de removidos
            $selectVeiculosEmpAssoci.find('option').each(function () {
                adicionarEmpresaRemovida($(this).val(), $(this).text());
            });

            $selectVeiculosEmpAssoci.empty();
            atualizarQuantidadeEmpresa();
            toastr.success('Todas as empresas foram removidas!');
        });

        // Localizar empresas associadas selecionadas na listagem de disponíveis
        $('#btnEmpresaLocalizar').click(function () {
            const empresasSelecionadas = $selectVeiculosEmpAssoci.val() || [];

            if (empresasSelecionadas.length === 0) {
                toastr.warning('Nenhuma empresa selecionada!');
                return;
            }

            // Limpar ambos os filtros de texto
            $filselectVeiculosEmp.val('');
            $filselectVeiculosDiv.val('');

            // Filtrar para exibir apenas as empresas selecionadas
            filtrarEmpresas('', null, empresasSelecionadas);

            // Aguardar renderização e então selecionar
            setTimeout(function () {
                $selectVeiculosEmp.val(empresasSelecionadas);

                // Filtrar divisões sem filtro de texto, apenas baseado nas empresas selecionadas
                filtrarDivisoes('', empresasSelecionadas);

                toastr.success('Empresas localizadas: ' + empresasSelecionadas.length);
            }, 100);
        });

        // Limpar seleção de empresas
        $('#btnEmpresaLimparSelecao').click(function () {
            // Desselecionar nos selects de disponíveis
            $selectVeiculosEmp.val(null);
            $filselectVeiculosEmp.val('');

            // Desselecionar e resetar filtros nos associados
            $selectVeiculosEmpAssoci.val(null);
            $filselectVeiculosEmpAssoci.val('');
            $selectVeiculosEmpAssoci.find('option').show();
            $selectVeiculosDivAssoci.find('option').show();

            // Resetar filtros e exibir tudo nos disponíveis
            filtrarEmpresas('', null);
            filtrarDivisoes('', null);
        });

        // Recarregar dados de empresas
        $('#btnEmpresaRecarregar').click(function () {
            recarregarDados();
        });

        // ===== BOTÕES - DIVISÕES =====

        // Adicionar divisão selecionada (seta para direita)
        $('#btnDivisaoAdicionar').click(function () {
            const divisoesSelecionadas = $selectVeiculosDiv.val() || [];

            if (divisoesSelecionadas.length === 0) {
                toastr.warning('Nenhuma divisão selecionada!');
                return;
            }

            divisoesSelecionadas.forEach(function (divisaoId) {
                if (divisaoId !== '') {
                    const existeDivisao = $selectVeiculosDivAssoci.find('option[value="' + divisaoId + '"]').length > 0;
                    if (!existeDivisao) {
                        const $optDiv = $selectVeiculosDiv.find('option[value="' + divisaoId + '"]').first();
                        if ($optDiv.length > 0) {
                            const empresaId = $optDiv.attr('data-empresa');
                            const $novaOption = $('<option></option>')
                                .val(divisaoId)
                                .text($optDiv.text())
                                .attr('data-empresa', empresaId);
                            $selectVeiculosDivAssoci.append($novaOption);

                            // Adicionar empresa de referência se não existir
                            const existeEmpresa = $selectVeiculosEmpAssoci.find('option[value="' + empresaId + '"]').length > 0;
                            if (!existeEmpresa && empresaId) {
                                const $novaEmpresa = $('<option></option>')
                                    .val(empresaId)
                                    .text(todasEmpresas[empresaId])
                                    .attr('data-referencia', 'true');
                                $selectVeiculosEmpAssoci.append($novaEmpresa);
                            } else if (existeEmpresa) {
                                // Marcar empresa existente como referência
                                $selectVeiculosEmpAssoci.find('option[value="' + empresaId + '"]')
                                    .attr('data-referencia', 'true');
                            }
                        }
                    }
                }
            });

            $selectVeiculosDiv.val(null);
            atualizarQuantidadeEmpresa();
            atualizarQuantidadeDivisao();
            toastr.success('Divisão(ões) adicionada(s) com sucesso!');
        });

        // Adicionar todas as divisões visíveis
        $('#btnDivisaoAdicionarTodos').click(function () {
            let adicionadas = 0;

            $selectVeiculosDiv.find('option:visible').each(function () {
                const divisaoId = $(this).val();
                if (divisaoId !== '') {
                    const existeDivisao = $selectVeiculosDivAssoci.find('option[value="' + divisaoId + '"]').length > 0;
                    if (!existeDivisao) {
                        const empresaId = $(this).attr('data-empresa');
                        const $novaOption = $('<option></option>')
                            .val(divisaoId)
                            .text($(this).text())
                            .attr('data-empresa', empresaId);
                        $selectVeiculosDivAssoci.append($novaOption);
                        adicionadas++;
                    }
                }
            });

            $selectVeiculosDiv.val(null);
            atualizarQuantidadeDivisao();

            if (adicionadas > 0) {
                toastr.success(adicionadas + ' divisão(ões) adicionada(s) com sucesso!');
            } else {
                toastr.info('Nenhuma divisão nova para adicionar.');
            }
        });

        // Remover divisão selecionada (seta para esquerda)
        $('#btnDivisaoDesassociar').click(function () {
            const divisoesSelecionadas = $selectVeiculosDivAssoci.val() || [];

            if (divisoesSelecionadas.length === 0) {
                toastr.warning('Nenhuma divisão selecionada!');
                return;
            }

            divisoesSelecionadas.forEach(function (divisaoId) {
                if (divisaoId !== '') {
                    const $option = $selectVeiculosDivAssoci.find('option[value="' + divisaoId + '"]');
                    adicionarDivisaoRemovida(divisaoId, $option.text());
                    $option.remove();
                }
            });

            atualizarQuantidadeDivisao();
            toastr.success('Divisão(ões) removida(s) com sucesso!');
        });

        // Remover todas as divisões
        $('#btnDivisaoDesassociarTodos').click(function () {
            // Adicionar todas as divisões ao select de removidos
            $selectVeiculosDivAssoci.find('option').each(function () {
                adicionarDivisaoRemovida($(this).val(), $(this).text());
            });

            $selectVeiculosDivAssoci.empty();
            atualizarQuantidadeDivisao();
            toastr.success('Todas as divisões foram removidas!');
        });

        // Localizar empresas das divisões associadas selecionadas na listagem de disponíveis
        $('#btnDivisaoLocalizar').click(function () {
            const divisoesSelecionadas = $selectVeiculosDivAssoci.val() || [];

            if (divisoesSelecionadas.length === 0) {
                toastr.warning('Nenhuma divisão selecionada!');
                return;
            }

            // Coletar IDs das empresas das divisões selecionadas
            const empresasIds = [];
            divisoesSelecionadas.forEach(function (divisaoId) {
                const $divOption = $selectVeiculosDivAssoci.find('option[value="' + divisaoId + '"]');
                const empresaId = $divOption.attr('data-empresa');
                if (empresaId && empresasIds.indexOf(empresaId) === -1) {
                    empresasIds.push(empresaId);
                }
            });

            if (empresasIds.length === 0) {
                toastr.warning('Nenhuma empresa encontrada para as divisões selecionadas.');
                return;
            }

            // Limpar ambos os filtros de texto
            $filselectVeiculosEmp.val('');
            $filselectVeiculosDiv.val('');

            // Filtrar para exibir apenas as empresas das divisões selecionadas
            filtrarEmpresas('', null, empresasIds);

            // Aguardar renderização e então selecionar
            setTimeout(function () {
                $selectVeiculosEmp.val(empresasIds);

                // Filtrar divisões sem filtro de texto, apenas baseado nas empresas selecionadas
                filtrarDivisoes('', empresasIds);

                toastr.success('Empresas localizadas: ' + empresasIds.length);
            }, 100);
        });

        // Limpar seleção de divisões
        $('#btnDivisaoLimparSelecao').click(function () {
            // Desselecionar nos selects de disponíveis
            $selectVeiculosDiv.val(null);
            $filselectVeiculosDiv.val('');

            // Desselecionar e resetar filtros nos associados
            $selectVeiculosDivAssoci.val(null);
            $filselectVeiculosDivAssoci.val('');
            $selectVeiculosDivAssoci.find('option').show();
            $selectVeiculosEmpAssoci.find('option').show();

            // Resetar filtros e exibir tudo nos disponíveis
            filtrarEmpresas('', null);
            filtrarDivisoes('', null);
        });

        // Recarregar dados de divisões
        $('#btnDivisaoRecarregar').click(function () {
            recarregarDados();
        });

        // ===== SINCRONIZAÇÃO ANTES DO SUBMIT =====

        $('form').on('submit', function (e) {
            if (isLoading || isSyncing) {
                e.preventDefault();
                toastr.warning('Aguarde o carregamento dos dados antes de salvar.');
                return false;
            }
            sincronizarSelectsOcultos();
        });

        // Sincronização inicial
        sincronizarSelectsOcultos();
    }

    listenersEmpresaDivisao();
})();