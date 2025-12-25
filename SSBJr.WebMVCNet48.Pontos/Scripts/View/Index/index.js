(function () {
    'use strict';

    let Toast;
    let placarTable;
    let isTableInitialized = false;
    let shouldLoadData = false;
    let isLoadingData = false;
    let isLoadingDataServer = false;
    let loadNewDataServer = false;

    const PAGE_SIZE = 50;
    const DEBOUNCE_DELAY = 500;

    let motoristaRfidDataset = [];

    let currentFilter = {
        motorista: '',
        rfid: '',
        dataInicio: '',
        dataFim: '',
        empresa: '',
        placa: '',
        nullFilter: ''
    };

    $(document).ready(function () {
        Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        })

        initializeDatepickers();
        initializeSelects();
        initializeEvents();
        initializeDataTable();
        setDefaultDates();
    });

    function showLoading() {
        // Adicionar spinner aos elementos com a classe showSpinnerCarregando
        $('.showSpinnerCarregando').each(function () {
            const $element = $(this);

            // Verificar se é um botão ou elemento pai
            const $button = $element.is('button') ? $element : $element.closest('button');

            if ($button.length) {
                // Adicionar spinner se ainda não existe
                if (!$button.find('.loading-spinner').length) {
                    $button.append(' <i class="fas fa-spinner fa-spin loading-spinner"></i>');
                }
            } else {
                // Para elementos que não são botões, adicionar spinner ao lado
                if (!$element.next('.loading-spinner').length) {
                    $element.after(' <i class="fas fa-spinner fa-spin loading-spinner"></i>');
                }
            }
        });
    }

    function hideLoading() {
        // Remover spinner dos elementos com a classe showSpinnerCarregando
        $('.showSpinnerCarregando').each(function () {
            const $element = $(this);

            // Verificar se é um botão ou elemento pai
            const $button = $element.is('button') ? $element : $element.closest('button');

            if ($button.length) {
                // Remover spinner
                $button.find('.loading-spinner').remove();
            } else {
                // Para elementos que não são botões, remover spinner ao lado
                $element.next('.loading-spinner').remove();
            }
        });
    }

    function initializeDatepickers() {
        const startOfToday = moment().startOf('day'); // 00:00:00 de hoje
        const endOfToday = moment().endOf('day'); // 23:59:59 de hoje

        $('#field-periodoData').daterangepicker({
            startDate: startOfToday,
            endDate: endOfToday,
            opens: 'left',
            autoUpdateInput: true,
            timePicker: true,
            timePicker24Hour: true,
            drops: 'left',
            locale: {
                cancelLabel: 'Limpar',
                applyLabel: 'Aplicar',
                format: 'DD/MM/YYYY HH:mm',
                separator: ' - ',
                daysOfWeek: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
                monthNames: [
                    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
                    'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                ],
                firstDay: 1
            }
        }, function (start, end, label) {
            // Callback ao inicializar - define valor inicial
            $('#field-periodoData').val(start.format('DD/MM/YYYY HH:mm') + ' - ' + end.format('DD/MM/YYYY HH:mm'));
        });

        $('#field-periodoData').on('apply.daterangepicker', function (ev, picker) {
            $(this).val(picker.startDate.format('DD/MM/YYYY HH:mm') + ' - ' + picker.endDate.format('DD/MM/YYYY HH:mm')).removeClass('is-invalid');
        });

        $('#field-periodoData').on('cancel.daterangepicker', function () {
            $(this).val('');
        });
    }

    function setDefaultDates() {
        const startOfToday = moment().startOf('day'); // 00:00:00
        const endOfToday = moment().endOf('day'); // 23:59:59

        currentFilter.dataInicio = startOfToday.format('YYYY-MM-DD HH:mm:ss');
        currentFilter.dataFim = endOfToday.format('YYYY-MM-DD HH:mm:ss');
    }

    function formatDateToInput(date) {
        return moment(date).format('DD/MM/YYYY HH:mm');
    }

    function formatDateISO(date) {
        return moment(date).format('YYYY-MM-DD HH:mm:ss');
    }

    function parseDateFromPicker(dateString) {
        return moment(dateString, 'DD/MM/YYYY HH:mm');
    }

    function initializeSelects() {
        const selectConfig = {
            liveSearch: true,
            noneSelectedText: 'Selecione...',
            noneResultsText: 'Nenhum resultado encontrado para {0}',
            countSelectedText: function (numSelected, numTotal) {
                return (numSelected == 1) ? "{0} item selecionado" : "{0} itens selecionados";
            }
        };

        // Configurar selectpicker para motorista e rfid
        const motoristaConfig = {
            liveSearch: selectConfig.liveSearch,
            noneSelectedText: selectConfig.noneSelectedText,
            countSelectedText: selectConfig.countSelectedText,
            liveSearchPlaceholder: 'Pesquisar motoristas...',
            noneResultsText: 'Nenhum motorista encontrado'
        };
        const rfidConfig = {
            liveSearch: selectConfig.liveSearch,
            noneSelectedText: selectConfig.noneSelectedText,
            countSelectedText: selectConfig.countSelectedText,
            liveSearchPlaceholder: 'Pesquisar RFIDs...',
            noneResultsText: 'Nenhum RFID encontrado'
        };

        $('#motorista').selectpicker(motoristaConfig);
        $('#rfid').selectpicker(rfidConfig);

        // Carregar motorista e RFID de forma unificada
        carregarMotoristaRfidUnificado();

        // Configurar e inicializar outros selects
        const selects = [
            { id: 'placa', url: urlConsultaPlacaSettings.GetPlacasAutocomplete, placeholder: 'placas', notFound: 'placa', extraData: function () { return { empresa: $('#empresa').val() || '' }; } },
            { id: 'empresa', url: urlConsultaPlacaSettings.GetEmpresasAutocomplete, placeholder: 'empresas', notFound: 'empresa' }
        ];

        selects.forEach(function (select) {
            const $element = $('#' + select.id);
            const config = {
                liveSearch: selectConfig.liveSearch,
                noneSelectedText: selectConfig.noneSelectedText,
                countSelectedText: selectConfig.countSelectedText,
                liveSearchPlaceholder: 'Pesquisar ' + select.placeholder + '...',
                noneResultsText: 'Nenhum ' + select.notFound + ' encontrado'
            };

            $element.selectpicker(config);
            carregarSelectComPaginacao(select.url, $element[0], PAGE_SIZE, select.extraData, false, null);
        });

        // Quando a empresa mudar, recarregar o select de placas e motorista/RFID
        $('#empresa').on('changed.bs.select', function () {
            const $placaSelect = $('#placa');
            if ($placaSelect.data('resetSelectToDefault')) {
                $placaSelect.data('resetSelectToDefault')();
            }

            // Recarregar motorista e RFID com novo filtro de empresa
            const $motoristaSelect = $('#motorista');
            const $rfidSelect = $('#rfid');
            if ($motoristaSelect.data('resetSelectToDefault')) {
                $motoristaSelect.data('resetSelectToDefault')();
            }
            if ($rfidSelect.data('resetSelectToDefault')) {
                $rfidSelect.data('resetSelectToDefault')();
            }

            // Limpar matrícula
            $('#matricula').val('');
        });
    }

    function carregarMotoristaRfidUnificado() {
        const PAGE_SIZE_MOTORISTA = 50;
        const $motoristaSelect = $('#motorista');
        const $rfidSelect = $('#rfid');

        const state = {
            currentPage: 1,
            loading: false,
            hasMore: true,
            currentSearchMotorista: '', // Termo de busca específico para motorista
            currentSearchRfid: '', // Termo de busca específico para RFID
            debounceTimer: null,
            currentFieldType: '', // 'motorista' ou 'rfid' para indicar qual campo está sendo pesquisado
            currentNullFilter: '__all__' // Filtro inicial é __all__
        };

        function clearOptions() {
            $motoristaSelect.find('option').remove();
            $rfidSelect.find('option').remove();
            motoristaRfidDataset = [];

            // Adicionar opção padrão "Nenhum filtro"
            $motoristaSelect.append(new Option('Nenhum filtro', '__all__', false, false));
            $rfidSelect.append(new Option('Nenhum filtro', '__all__', false, false));
        }

        function appendMotoristaRfidItems(items) {
            const motoristaFragment = document.createDocumentFragment();
            const rfidFragment = document.createDocumentFragment();
            let hasNullMotorista = false;
            let hasNullRfid = false;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                if (item) {
                    // Armazenar dados completos no dataset
                    motoristaRfidDataset.push(item);

                    // Verificar se motorista é nulo/vazio
                    const motoristaDescricao = item.MotoristaDescricao;
                    const isMotoristaEmpty = !motoristaDescricao || motoristaDescricao.trim() === '';

                    if (isMotoristaEmpty) {
                        hasNullMotorista = true;
                    }

                    // Adicionar opção no select de motorista
                    const motoristaOption = document.createElement('option');
                    const motoristaText = isMotoristaEmpty ? 'Nulo/Vazio' : item.MotoristaDescricao;
                    motoristaOption.value = motoristaText; // value sempre a descrição
                    motoristaOption.textContent = motoristaText;
                    motoristaOption.setAttribute('data-motorista-id', item.MotoristaId != null ? String(item.MotoristaId) : '');
                    motoristaFragment.appendChild(motoristaOption);

                    // Verificar se RFID é nulo/vazio
                    const rfidDescricao = item.RfidDescricao;
                    const isRfidEmpty = !rfidDescricao || rfidDescricao.trim() === '';

                    if (isRfidEmpty) {
                        hasNullRfid = true;
                    }

                    // Adicionar opção no select de RFID
                    const rfidOption = document.createElement('option');
                    const rfidText = isRfidEmpty ? 'Nulo/Vazio' : item.RfidDescricao;
                    rfidOption.value = rfidText; // value sempre a descrição
                    rfidOption.textContent = rfidText;
                    rfidOption.setAttribute('data-motorista-id', item.MotoristaId != null ? String(item.MotoristaId) : '');
                    rfidFragment.appendChild(rfidOption);
                }
            }

            $motoristaSelect[0].appendChild(motoristaFragment);
            $rfidSelect[0].appendChild(rfidFragment);

            // Se encontrou itens nulos/vazios, garantir que a opção "Nulo/Vazio" existe (evitar duplicatas)
            if (hasNullMotorista) {
                // Verificar se já existe a opção "Nulo/Vazio" (além das que acabamos de adicionar)
                const existingNullOptions = $motoristaSelect.find('option[value="Nulo/Vazio"]');
                if (existingNullOptions.length > 1) {
                    // Remover duplicatas, mantendo apenas a primeira
                    existingNullOptions.slice(1).remove();
                }
            }

            if (hasNullRfid) {
                // Verificar se já existe a opção "Nulo/Vazio" (além das que acabamos de adicionar)
                const existingNullOptions = $rfidSelect.find('option[value="Nulo/Vazio"]');
                if (existingNullOptions.length > 1) {
                    // Remover duplicatas, mantendo apenas a primeira
                    existingNullOptions.slice(1).remove();
                }
            }

            $motoristaSelect.selectpicker('refresh');
            $rfidSelect.selectpicker('refresh');
        }

        function carregarPaginaMotoristaRfid(search, fieldType, nullFilter) {
            search = search || '';
            fieldType = fieldType || 'motorista'; // padrão é motorista
            nullFilter = nullFilter || '__all__'; // padrão é __all__

            // Verificar se mudou o termo de busca ou o tipo de campo
            const currentSearch = fieldType === 'motorista' ? state.currentSearchMotorista : state.currentSearchRfid;
            if (search !== currentSearch || fieldType !== state.currentFieldType) {
                // Atualizar o termo de busca específico do campo
                if (fieldType === 'motorista') {
                    state.currentSearchMotorista = search;
                    // Ao filtrar motorista (termo não vazio), limpar filtro de RFID
                    if (search) {
                        state.currentSearchRfid = '';
                    }
                } else {
                    state.currentSearchRfid = search;
                    // Ao filtrar RFID (termo não vazio), limpar filtro de motorista
                    if (search) {
                        state.currentSearchMotorista = '';
                    }
                }
                state.currentFieldType = fieldType;
                state.currentNullFilter = nullFilter;
                state.currentPage = 1;
                state.hasMore = true;
                clearOptions();
            }

            if (state.loading || !state.hasMore) return;

            state.loading = true;

            $motoristaSelect.prop('disabled', true);
            $rfidSelect.prop('disabled', true);
            const $motoristaFilter = $motoristaSelect.parent().find('.bs-searchbox input');
            const $rfidFilter = $rfidSelect.parent().find('.bs-searchbox input');
            $motoristaFilter.prop('readonly', true);
            $rfidFilter.prop('readonly', true);

            const $loadingMotorista = $('<div class="text-center p-2 select-loading"><small>Carregando...</small></div>');
            const $loadingRfid = $('<div class="text-center p-2 select-loading"><small>Carregando...</small></div>');
            $motoristaSelect.parent().find('.bs-searchbox').after($loadingMotorista);
            $rfidSelect.parent().find('.bs-searchbox').after($loadingRfid);

            const skip = (state.currentPage - 1) * PAGE_SIZE_MOTORISTA;

            $.ajax({
                url: urlConsultaPlacaSettings.GetMotoristaAutocomplete,
                type: 'POST',
                dataType: 'json',
                data: {
                    // Enviar termos separados para paginação cruzada
                    termoMotorista: state.currentSearchMotorista,
                    termoRfid: state.currentSearchRfid,
                    skip: skip,
                    take: PAGE_SIZE_MOTORISTA,
                    empresa: $('#empresa').val() || '',
                    fieldType: fieldType, // Envia 'motorista' ou 'rfid' para o backend saber como filtrar
                    nullFilter: nullFilter // Envia o filtro de nulos
                },
                success: function (data) {
                    if (data && data.items) {
                        appendMotoristaRfidItems(data.items);
                        state.hasMore = data.hasMore;
                        if (state.hasMore) {
                            state.currentPage++;
                        }
                    }
                },
                error: function () {
                    Toast.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: 'Não foi possível carregar os motoristas/RFIDs. Tente novamente.'
                    });
                },
                complete: function () {
                    state.loading = false;
                    $motoristaSelect.prop('disabled', false);
                    $rfidSelect.prop('disabled', false);
                    $motoristaFilter.prop('readonly', false);
                    $rfidFilter.prop('readonly', false);
                    $motoristaSelect.selectpicker('refresh');
                    $rfidSelect.selectpicker('refresh');
                    $loadingMotorista.remove();
                    $loadingRfid.remove();
                }
            });
        }

        function resetToDefault() {
            state.currentSearchMotorista = '';
            state.currentSearchRfid = '';
            state.currentPage = 1;
            state.hasMore = true;
            state.currentFieldType = '';
            state.currentNullFilter = '__all__';
            clearOptions();
            $motoristaSelect.val('__all__');
            $rfidSelect.val('__all__');
            $motoristaSelect.selectpicker('refresh');
            $rfidSelect.selectpicker('refresh');
        }

        // Adicionar opção padrão inicial "Nenhum filtro"
        $motoristaSelect.append(new Option('Nenhum filtro', '__all__', true, true));
        $rfidSelect.append(new Option('Nenhum filtro', '__all__', true, true));
        $motoristaSelect.selectpicker('refresh');
        $rfidSelect.selectpicker('refresh');

        // Event delegation para busca com debounce em motorista
        $motoristaSelect.parent().on('input', '.bs-searchbox input', function () {
            clearTimeout(state.debounceTimer);
            const value = this.value || '';
            // Ao digitar no motorista, limpar termo do RFID
            state.currentSearchRfid = '';
            state.debounceTimer = setTimeout(function () {
                carregarPaginaMotoristaRfid(value, 'motorista', '__all__'); // Indica que é busca por motorista com filtro __all__
            }, DEBOUNCE_DELAY);
        });

        // Event delegation para busca com debounce em RFID (compartilha o mesmo estado)
        $rfidSelect.parent().on('input', '.bs-searchbox input', function () {
            clearTimeout(state.debounceTimer);
            const value = this.value || '';
            // Ao digitar no RFID, limpar termo do motorista
            state.currentSearchMotorista = '';
            state.debounceTimer = setTimeout(function () {
                carregarPaginaMotoristaRfid(value, 'rfid', '__all__'); // Indica que é busca por RFID com filtro __all__
            }, DEBOUNCE_DELAY);
        });

        // Scroll para carregar mais - motorista
        $motoristaSelect.on('shown.bs.select', function () {
            // Ao abrir o filtro de motorista, limpar matrícula
            $('#matricula').val('');
            if (state.currentPage === 1 && $motoristaSelect.find('option').length === 1) {
                carregarPaginaMotoristaRfid('', 'motorista', '__all__');
            }

            const $menu = $(this).parent().find('.dropdown-menu .inner');
            $menu.off('scroll.pagination').on('scroll.pagination', function () {
                if (this.scrollTop + this.clientHeight >= this.scrollHeight - 50) {
                    // Usar o termo de busca específico do motorista
                    carregarPaginaMotoristaRfid(state.currentSearchMotorista, 'motorista', state.currentNullFilter || '__all__');
                }
            });
        });

        // Scroll para carregar mais - RFID
        $rfidSelect.on('shown.bs.select', function () {
            // Ao abrir o filtro de RFID, limpar matrícula
            $('#matricula').val('');
            if (state.currentPage === 1 && $rfidSelect.find('option').length === 1) {
                carregarPaginaMotoristaRfid('', 'rfid', '__all__');
            }

            const $menu = $(this).parent().find('.dropdown-menu .inner');
            $menu.off('scroll.pagination').on('scroll.pagination', function () {
                if (this.scrollTop + this.clientHeight >= this.scrollHeight - 50) {
                    // Usar o termo de busca específico do RFID
                    carregarPaginaMotoristaRfid(state.currentSearchRfid, 'rfid', state.currentNullFilter || '__all__');
                }
            });
        });

        // Armazenar função de reset
        $motoristaSelect.data('resetSelectToDefault', resetToDefault);
        $rfidSelect.data('resetSelectToDefault', resetToDefault);

        // Sincronizar seleção entre motorista e rfid
        $motoristaSelect.on('changed.bs.select', function () {
            syncMotoristaRfidSelection('motorista');
        });

        $rfidSelect.on('changed.bs.select', function () {
            syncMotoristaRfidSelection('rfid');
        });
    }

    function syncMotoristaRfidSelection(sourceField) {
        const sourceValue = $('#' + sourceField).val();
        const $selectedOpt = $('#' + sourceField + ' option:selected');
        const motoristaIdAttr = $selectedOpt.attr('data-motorista-id');
        const motoristaId = motoristaIdAttr && motoristaIdAttr.trim() !== '' ? motoristaIdAttr : null;

        // Se não selecionou nada ou selecionou "Nenhum filtro", limpar campos relacionados
        if (!sourceValue || sourceValue === '__all__') {
            if (sourceField === 'motorista') {
                $('#rfid').val('__all__').selectpicker('refresh');
            } else {
                $('#motorista').val('__all__').selectpicker('refresh');
            }
            $('#matricula').val('');
            return;
        }

        // Sincronização baseada em data-motorista-id como chave
        let record = null;
        if (motoristaId) {
            if (sourceField === 'motorista') {
                record = motoristaRfidDataset.find(function (item) {
                    const motText = item && item.MotoristaDescricao ? item.MotoristaDescricao : 'Nulo/Vazio';
                    return String(item.MotoristaId) === motoristaId && motText === sourceValue;
                });
            } else {
                record = motoristaRfidDataset.find(function (item) {
                    const rfidText = item && item.RfidDescricao ? item.RfidDescricao : 'Nulo/Vazio';
                    return String(item.MotoristaId) === motoristaId && rfidText === sourceValue;
                });
            }
        }

        if (motoristaId && record) {
            if (sourceField === 'motorista') {
                // Garantir que a opção de RFID exista; se não, adicionar
                const $rfid = $('#rfid');
                const rfidText = record && record.RfidDescricao ? record.RfidDescricao : 'Nulo/Vazio';
                if (!$rfid.find('option[value="' + rfidText.replace(/"/g, '\\"') + '"]').length) {
                    const opt = new Option(rfidText, rfidText, false, false);
                    opt.setAttribute('data-motorista-id', motoristaId);
                    $rfid.append(opt);
                    $rfid.selectpicker('refresh');
                }
                $rfid.val(rfidText).selectpicker('refresh');
            } else {
                // Selecionou RFID: garantir que a opção de motorista exista; se não, adicionar
                const $motorista = $('#motorista');
                const motText = record && record.MotoristaDescricao ? record.MotoristaDescricao : 'Nulo/Vazio';
                if (!$motorista.find('option[value="' + motText.replace(/"/g, '\\"') + '"]').length) {
                    const opt = new Option(motText, motText, false, false);
                    opt.setAttribute('data-motorista-id', motoristaId);
                    $motorista.append(opt);
                    $motorista.selectpicker('refresh');
                }
                $motorista.val(motText).selectpicker('refresh');
            }

            // Atualizar matrícula
            $('#matricula').val(record && record.Matricula ? record.Matricula : '-');
        } else {
            // Fallback: limpar outro filtro e matrícula
            if (sourceField === 'motorista') {
                $('#rfid').val('__all__').selectpicker('refresh');
            } else {
                $('#motorista').val('__all__').selectpicker('refresh');
            }
            $('#matricula').val('');
        }
    }

    // ========== SELECT COM PAGINAÇÃO ==========
    function carregarSelectComPaginacao(url, element, pageSize, extraDataFn, isMotoristaRfid, fieldType) {
        pageSize = pageSize || 50;
        const $select = $(element);
        extraDataFn = extraDataFn || null;
        fieldType = fieldType || null;

        const selectState = {
            currentPage: 1,
            loading: false,
            hasMore: true,
            currentSearch: '',
            debounceTimer: null,
            selectedValue: $select.val() || ''
        };

        function clearNonSelectedOptions() {
            // Limpar todas as opções exceto a primeira (vazia)
            $select.find('option').remove();
        }

        function appendItems(items) {
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                // Se for motorista ou rfid, armazenar no dataset e popular ambos os selects
                if (isMotoristaRfid && item.FullData) {
                    // Verificar se já existe no dataset
                    const existingIndex = motoristaRfidDataset.findIndex(function (d) {
                        return d.MotoristaId === item.FullData.MotoristaId && d.RfidId === item.FullData.RfidId;
                    });

                    if (existingIndex === -1) {
                        motoristaRfidDataset.push(item.FullData);
                    }

                    // Adicionar ao select atual
                    const key = fieldType === 'motorista' ? String(item.FullData.MotoristaId) : String(item.FullData.RfidId);
                    const value = fieldType === 'motorista' ? item.FullData.Motorista : item.FullData.Rfid;

                    if (!$select.find('option[value="' + key.replace(/"/g, '\\"') + '"]').length) {
                        const isSelected = String(selectState.selectedValue) === key;
                        const option = new Option(value, key, false, isSelected);
                        fragment.appendChild(option);
                    }

                    // Popular o select correspondente (motorista <-> rfid)
                    const $otherSelect = fieldType === 'motorista' ? $('#rfid') : $('#motorista');
                    const otherKey = fieldType === 'motorista' ? String(item.FullData.RfidId) : String(item.FullData.MotoristaId);
                    const otherValue = fieldType === 'motorista' ? item.FullData.Rfid : item.FullData.Motorista;

                    if ($otherSelect.length && !$otherSelect.find('option[value="' + otherKey.replace(/"/g, '\\"') + '"]').length) {
                        $otherSelect.append(new Option(otherValue, otherKey, false, false));
                        $otherSelect.selectpicker('refresh');
                    }
                } else {
                    // Para outros selects (não motorista/rfid)
                    const key = String(item.Key);
                    if (!$select.find('option[value="' + key.replace(/"/g, '\\"') + '"]').length) {
                        const isSelected = String(selectState.selectedValue) === key;
                        const option = new Option(item.Value, key, false, isSelected);
                        fragment.appendChild(option);
                    }
                }
            }

            element.appendChild(fragment);
            $select.selectpicker('refresh');
        }

        function carregarPagina(search) {
            search = search || '';

            if (search !== selectState.currentSearch) {
                selectState.currentSearch = search;
                selectState.currentPage = 1;
                selectState.hasMore = true;
                clearNonSelectedOptions();
            }

            if (selectState.loading || !selectState.hasMore) return;

            selectState.loading = true;

            $select.prop('disabled', true);
            const $filter = $select.parent().find('.bs-searchbox input');
            $filter.prop('readonly', true);
            $select.selectpicker('refresh');

            const $loading = $('<div class="text-center p-2 select-loading"><small>Carregando...</small></div>');
            $select.parent().find('.bs-searchbox').after($loading);

            const skip = (selectState.currentPage - 1) * pageSize;

            // Preparar dados base
            const ajaxData = {
                termo: search,
                skip: skip,
                take: pageSize,
                nullFilter: ''
            };

            // Adicionar dados extras se fornecidos
            if (extraDataFn && typeof extraDataFn === 'function') {
                const extraData = extraDataFn();
                if (extraData) {
                    Object.assign(ajaxData, extraData);
                }
            }

            $.ajax({
                url: url,
                type: 'POST',
                dataType: 'json',
                data: ajaxData,
                success: function (data) {
                    if (data && data.items) {
                        const itens = data.items.filter(function (i) {
                            return i.Key != null && String(i.Key).trim() !== '';
                        });
                        appendItems(itens);
                        selectState.hasMore = itens.length >= pageSize;
                        selectState.currentPage++;
                    }
                },
                error: function () {
                    Toast.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: 'Não foi possível carregar os dados. Tente novamente.'
                    });
                },
                complete: function () {
                    selectState.loading = false;
                    $select.prop('disabled', false);
                    $filter.prop('readonly', false);
                    $select.selectpicker('refresh');
                    $loading.remove();
                }
            });
        }

        function resetToDefault() {
            selectState.currentSearch = '';
            selectState.currentPage = 1;
            selectState.hasMore = true;
            selectState.selectedValue = '';

            // Limpar todas as opções
            $select.find('option').remove();

            // Adicionar opção padrão "Nenhum filtro"
            $select.append(new Option('Nenhum filtro', '', true, true));

            // Refresh do selectpicker
            $select.selectpicker('refresh');

            // Não carregar dados aqui - será carregado quando o select for aberto
        }

        // Adicionar opção padrão "Nenhum filtro" sem carregar dados
        $select.find('option').remove();
        $select.append(new Option('Nenhum filtro', '__all__', true, true));
        $select.selectpicker('refresh');

        // Event delegation para busca com debounce
        $select.parent().on('input', '.bs-searchbox input', function () {
            clearTimeout(selectState.debounceTimer);
            const value = this.value || '';
            selectState.debounceTimer = setTimeout(function () {
                carregarPagina(value);
            }, DEBOUNCE_DELAY);
        });

        // Evento de scroll para carregar mais itens
        $select.on('shown.bs.select', function () {
            // Buscar valor selecionado atual
            const currentValue = $select.val();

            // Se tem valor selecionado mas não há opções carregadas, carregar a primeira página
            if (currentValue && $select.find('option[value="' + currentValue + '"]').length === 0) {
                // Carregar opção selecionada
                selectState.selectedValue = currentValue;
                carregarPagina('');
            } else if (selectState.currentPage === 1 && $select.find('option').length === 1) {
                // Se só tem a opção "Nenhum filtro", carregar primeira página de dados
                carregarPagina('');
            }

            const $menu = $(this).parent().find('.dropdown-menu .inner');
            $menu.off('scroll.pagination').on('scroll.pagination', function () {
                if (this.scrollTop + this.clientHeight >= this.scrollHeight - 50) {
                    carregarPagina(selectState.currentSearch);
                }
            });
        });

        // Atualizar valor selecionado
        $select.on('changed.bs.select', function () {
            selectState.selectedValue = $select.val() || '';
        });

        // Armazenar função de reset no elemento
        $select.data('resetSelectToDefault', resetToDefault);
    }

    function initializeEvents() {
        $('#btnBuscar').on('click', function () {
            if (validarFiltrosObrigatorios()) {
                atualizarFiltrosGlobais();

                $('#btnBuscar').prop('disabled', true);
                $('#filtroModal').modal('hide');
                showLoading();

                shouldLoadData = false;

                // Limpar tabela antes de buscar
                placarTable.clear().draw();

                // Habilitar carregamento de dados e recarregar tabela
                shouldLoadData = true;

                // Resetar o estado do DataTable para forçar Draw = 1
                loadNewDataServer = true;

                // Forçar nova busca do banco resetando para página 1
                placarTable.ajax.reload(null, true);
            }
        });

        $('#btnLimpar').on('click', function () {
            limparFiltros();
        });

        // Ao abrir o modal, manter os valores selecionados
        $('#filtroModal').on('show.bs.modal', function () {
            // Restaurar valores dos filtros nos selects
            if (currentFilter.motorista) {
                $('#motorista').val(currentFilter.motorista).selectpicker('refresh');
            }
            if (currentFilter.rfid) {
                $('#rfid').val(currentFilter.rfid).selectpicker('refresh');
            }
            if (currentFilter.empresa) {
                $('#empresa').val(currentFilter.empresa).selectpicker('refresh');
            }
            if (currentFilter.placa) {
                $('#placa').val(currentFilter.placa).selectpicker('refresh');
            }
        });
    }

    function validarFiltrosObrigatorios() {
        const motorista = $('#motorista').val();
        const rfid = $('#rfid').val();
        const periodoData = $('#field-periodoData').val();

        // Validar que pelo menos um de Motorista ou RFID foi preenchido
        // Não aceitar "Nenhum filtro" como seleção válida
        // Aceitar value vazio ('') como válido (representa "Nulo/Vazio")
        const hasValidMotorista = (motorista !== null && motorista !== '__all__');
        const hasValidRFid = (rfid !== null && rfid !== '__all__');

        if (!hasValidMotorista && !hasValidRFid) {
            Toast.fire({
                icon: 'error',
                title: 'Campo obrigatório',
                text: 'Selecione um Motorista ou RFID'
            });
            return false;
        }

        if (!periodoData || periodoData.trim() === '') {
            Toast.fire({
                icon: 'error',
                title: 'Campo obrigatório',
                text: 'Informe o período (data inicial e final)'
            });
            return false;
        }

        // Validar se o daterangepicker foi inicializado e tem datas válidas
        try {
            const picker = $('#field-periodoData').data('daterangepicker');
            if (!picker || !picker.startDate || !picker.endDate) {
                Toast.fire({
                    icon: 'error',
                    title: 'Campo obrigatório',
                    text: 'Selecione um período válido'
                });
                return false;
            }

            if (picker.startDate.isAfter(picker.endDate)) {
                Toast.fire({
                    icon: 'error',
                    title: 'Período inválido',
                    text: 'A data inicial não pode ser maior que a data final'
                });
                return false;
            }
        } catch (e) {
            Toast.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Erro ao validar o período selecionado'
            });
            return false;
        }

        return true;
    }

    function atualizarFiltrosGlobais() {
        const picker = $('#field-periodoData').data('daterangepicker');

        currentFilter = {
            motorista: $('#motorista').val() || '',
            rfid: $('#rfid').val() || '',
            dataInicio: picker.startDate.format('YYYY-MM-DD HH:mm:ss'),
            dataFim: picker.endDate.format('YYYY-MM-DD HH:mm:ss'),
            empresa: $('#empresa').val() || '',
            placa: $('#placa').val() || ''
        };
    }

    function limparFiltros() {
        // Limpar e resetar cada select usando a função resetToDefault
        $('#motorista').data('resetSelectToDefault')();
        $('#rfid').data('resetSelectToDefault')();
        $('#placa').data('resetSelectToDefault')();
        $('#empresa').data('resetSelectToDefault')();

        // Limpar matrícula
        $('#matricula').val('');

        // Resetar as datas padrão no filtro global
        setDefaultDates();

        currentFilter = {
            motorista: '',
            rfid: '',
            dataInicio: '',
            dataFim: '',
            empresa: '',
            placa: ''
        };
    }

    function calculateTableHeight() {
        // Calcular altura disponível considerando header, filtros e footer
        const windowHeight = $(window).height();
        const tableOffset = $('#placarTable').offset();
        const footerHeight = 100; // Espaço para paginação e info
        const padding = 20; // Padding adicional

        if (tableOffset) {
            const availableHeight = windowHeight - tableOffset.top - footerHeight - padding;
            return Math.max(300, availableHeight) + 'px'; // Mínimo de 300px
        }
        return '500px'; // Fallback
    }

    function initializeDataTable() {
        if (isTableInitialized) {
            return;
        }

        placarTable = $('#placarTable').DataTable({
            destroy: true,
            processing: true,
            serverSide: true, // Habilitar server-side processing
            ajax: function (data, callback, settings) {
                // Se não deve carregar dados, retornar resultado vazio
                if (!shouldLoadData) {
                    callback({
                        draw: data.draw,
                        recordsTotal: 0,
                        recordsFiltered: 0,
                        data: []
                    });
                    return;
                }

                // Verificar se já há uma requisição em andamento
                if (isLoadingDataServer) {
                    Toast.fire({
                        icon: 'info',
                        title: 'Aguarde',
                        text: 'Há uma busca em andamento. Aguarde a conclusão.'
                    });
                    // Retornar sem fazer nova requisição
                    return;
                }

                isLoadingDataServer = true;

                if (loadNewDataServer) {
                    Toast.fire({
                        icon: 'info',
                        title: 'Buscando registros...'
                    });
                }

                $.ajax({
                    url: urlConsultaPlacaSettings.GetConsultaPlacaData,
                    type: 'POST',
                    data: {
                        motorista: currentFilter.motorista,
                        rfid: currentFilter.rfid,
                        dataInicio: currentFilter.dataInicio,
                        dataFim: currentFilter.dataFim,
                        empresa: currentFilter.empresa,
                        placa: currentFilter.placa,
                        draw: loadNewDataServer ? 1 : data.draw,
                        start: data.start,
                        length: data.length,
                        order: data.order,
                        columns: data.columns,
                        search: data.search.value,
                    },
                    success: function (json) {
                        if (!json.data || json.data.length === 0) {
                            Toast.fire({
                                icon: 'warning',
                                title: 'Nenhum resultado encontrado',
                                text: 'Não foram encontrados registros com os filtros aplicados.'
                            });
                        }

                        // Exibe informações de atualização
                        var debugInfo = new Date().toLocaleTimeString('pt-BR') +
                            ' - ' + json.recordsTotal.toLocaleString() + ' registros';

                        if (json.cached) {
                            debugInfo += ' [CACHE]';
                        }

                        if (json.query) {
                            debugInfo += ' [query]: ' + json.query;
                        }

                        $('#dataDadosAtualizados').text(debugInfo);

                        callback({
                            draw: data.draw,
                            recordsTotal: json.recordsTotal,
                            recordsFiltered: json.recordsFiltered,
                            data: json.data || []
                        });
                    },
                    error: function (xhr, error, thrown) {
                        Toast.fire({
                            icon: 'error',
                            title: 'Erro ao carregar dados',
                            text: 'Por favor, tente novamente.'
                        });
                        callback({
                            draw: data.draw,
                            recordsTotal: 0,
                            recordsFiltered: 0,
                            data: []
                        });
                    },
                    complete: function () {
                        isLoadingDataServer = false;
                        loadNewDataServer = false;
                    }
                });
            },
            columns: [
                {
                    data: 'Empresa',
                    render: function (data) {
                        return data || '';
                    }
                },
                {
                    data: 'Placa',
                    render: function (data) {
                        return data || '';
                    }
                },
                {
                    data: 'Emissao',
                    render: function (data) {
                        if (!data) return '';
                        const date = new Date(data);
                        return date.toLocaleString('pt-BR');
                    }
                },
                {
                    data: 'Localizacao',
                    render: function (data) {
                        return data || '';
                    }
                },
                {
                    data: 'Motorista',
                    render: function (data) {
                        return data || '';
                    }
                },
                {
                    data: 'Voltagem',
                    render: function (data) {
                        return data || '';
                    }
                },
                {
                    data: 'Situacao',
                    render: function (data) {
                        return data || '';
                    }
                },
                {
                    data: 'Latitude',
                    render: function (data) {
                        return data || '';
                    }
                },
                {
                    data: 'Longitude',
                    render: function (data) {
                        return data || '';
                    }
                },
                {
                    data: 'Velocidade',
                    render: function (data) {
                        return data || '';
                    }
                }
            ],
            language: {
                paginate: {
                    previous: 'Anterior',
                    next: 'Próximo',
                    first: 'Primeiro',
                    last: 'Último'
                },
                lengthMenu: 'Exibir _MENU_ resultados',
                info: '_START_ a _END_ de _TOTAL_',
                infoEmpty: '0 a 0 de 0',
                infoFiltered: '(filtrado de _MAX_ resultados)',
                processing: 'Carregando...',
                search: 'Pesquisar',
                zeroRecords: 'Nenhum registro encontrado',
                emptyTable: 'Preencha os filtros obrigatórios e clique em Aplicar Filtros para visualizar os dados.'
            },
            searching: true,
            paging: true,
            pageLength: 50,
            lengthMenu: [[50, 500, 5000, -1], [50, 500, 5000, 'Todos']],
            ordering: true,
            info: true,
            order: [[2, 'desc']],
            scrollY: calculateTableHeight(),
            scrollCollapse: true,
            dom:
                '<"row mb-2"<"col-sm-12 col-md-6 d-flex justify-content-md-start"f><"col-sm-12 col-md-6 d-flex justify-content-md-end"B>>' +
                't' +
                '<"row mt-2"<"col-sm-12 col-md-4"l><"col-sm-12 col-md-4 text-center"i><"col-sm-12 col-md-4"p>>',
            buttons: [
                {
                    text: '<i class="fas fa-file-excel"></i> Excel',
                    className: 'btn btn-success me-2',
                    action: function (e, dt, node, config) {
                        // Validar filtros obrigatórios
                        if (!shouldLoadData || !validarFiltrosObrigatorios()) {
                            Toast.fire({
                                icon: 'warning',
                                title: 'Filtros necessários',
                                text: 'Aplique os filtros obrigatórios antes de exportar.'
                            });
                            $('#filtroModal').modal('show');
                            return;
                        }

                        // Verificar se há uma busca em andamento
                        if (isLoadingData) {
                            Toast.fire({
                                icon: 'info',
                                title: 'Aguarde',
                                text: 'Aguarde a conclusão da busca atual antes de exportar.'
                            });
                            return;
                        }

                        Toast.fire({
                            icon: 'info',
                            title: 'Gerando arquivo Excel...'
                        });

                        // Criar formulário para enviar POST
                        var form = $('<form>', {
                            method: 'POST',
                            action: urlConsultaPlacaSettings.ExportConsultaPlacaXml,
                            target: '_blank'
                        });

                        // Adicionar campos do filtro
                        form.append($('<input>', { type: 'hidden', name: 'motorista', value: currentFilter.motorista }));
                        form.append($('<input>', { type: 'hidden', name: 'rfid', value: currentFilter.rfid }));
                        form.append($('<input>', { type: 'hidden', name: 'dataInicio', value: currentFilter.dataInicio }));
                        form.append($('<input>', { type: 'hidden', name: 'dataFim', value: currentFilter.dataFim }));
                        form.append($('<input>', { type: 'hidden', name: 'empresa', value: currentFilter.empresa }));
                        form.append($('<input>', { type: 'hidden', name: 'placa', value: currentFilter.placa }));

                        // Adicionar ao body, submeter e remover
                        $('body').append(form);
                        form.submit();
                        form.remove();

                        Toast.fire({
                            icon: 'success',
                            title: 'Download iniciado!'
                        });
                    }
                },
                {
                    text: '<i class="fas fa-filter showSpinnerCarregando"></i> Buscar',
                    className: 'btn btn-primary me-2',
                    action: function (e, dt, node, config) {
                        $('#filtroModal').modal('show');
                    }
                },
                {
                    text: '<i class="fas fa-sync-alt"></i>',
                    className: 'btn btn-primary',
                    action: function (e, dt, node, config) {
                        // Validar se há filtros obrigatórios aplicados
                        if (!shouldLoadData || !validarFiltrosObrigatorios()) {
                            Toast.fire({
                                icon: 'warning',
                                title: 'Filtros necessários',
                                text: 'Aplique os filtros obrigatórios antes de atualizar.'
                            });
                            $('#filtroModal').modal('show');
                            return;
                        }

                        // Verificar se há uma busca em andamento
                        if (isLoadingData) {
                            Toast.fire({
                                icon: 'info',
                                title: 'Aguarde',
                                text: 'Aguarde a conclusão da busca atual antes de atualizar.'
                            });
                            return;
                        }

                        // sem carregamento por enquanto
                        shouldLoadData = false;

                        // Limpar tabela antes de atualizar
                        placarTable.clear().draw();

                        // Forçar nova busca do banco (Draw == 1)
                        shouldLoadData = true;

                        // Resetar o estado do DataTable para forçar Draw = 1
                        loadNewDataServer = true;

                        placarTable.ajax.reload(null, true); // true = resetar para página 1
                    }
                },
            ],
            initComplete: function (settings, json) {
                isTableInitialized = true;
            }
        });

        // Adicionar debounce ao search do DataTable
        var searchDebounceTimer;
        $('.dataTables_filter input').off('keyup.DT search.DT input.DT paste.DT cut.DT')
            .on('keyup.DT search.DT input.DT paste.DT cut.DT', function (e) {
                var $input = $(this);
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(function () {
                    if (placarTable.search() !== $input.val()) {
                        placarTable.search($input.val()).draw();
                    }
                }, DEBOUNCE_DELAY);
            });

        // Desabilitar botão ao iniciar requisição
        placarTable.on('preXhr.dt', function () {
            isLoadingData = true;
            showLoading();
            $('#btnBuscar').prop('disabled', true);

            // Desabilitar campo de busca
            $('.dataTables_filter input').prop('disabled', true);

            // Desabilitar navegação da paginação
            $('#placarTable_wrapper .paginate_button').addClass('disabled').css('pointer-events', 'none');
            $('#placarTable_length select').prop('disabled', true);

            // Desabilitar ordenação
            $('#placarTable thead th').css('pointer-events', 'none').addClass('sorting-disabled');
        });

        // Reabilitar botão após carregar dados
        placarTable.on('xhr.dt', function () {
            isLoadingData = false;
            hideLoading();
            $('#btnBuscar').prop('disabled', false);

            // Reabilitar campo de busca
            $('.dataTables_filter input').prop('disabled', false);

            // Reabilitar navegação da paginação
            $('#placarTable_wrapper .paginate_button').removeClass('disabled').css('pointer-events', '');
            $('#placarTable_length select').prop('disabled', false);

            // Reabilitar ordenação
            $('#placarTable thead th').css('pointer-events', '').removeClass('sorting-disabled');
        });

        // Reabilitar botão em caso de erro
        placarTable.on('error.dt', function () {
            isLoadingData = false;
            hideLoading();
            $('#btnBuscar').prop('disabled', false);

            // Reabilitar campo de busca
            $('.dataTables_filter input').prop('disabled', false);

            // Reabilitar navegação da paginação
            $('#placarTable_wrapper .paginate_button').removeClass('disabled').css('pointer-events', '');
            $('#placarTable_length select').prop('disabled', false);

            // Reabilitar ordenação
            $('#placarTable thead th').css('pointer-events', '').removeClass('sorting-disabled');
        });
    }
})();