// 🔗 LINK DO GOOGLE APPS SCRIPT
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZDmfd6MxTjM80s-5Ojmcrr_-ckT_zYKtVPxI--AUeW_RiOfEEJugtyQp_8sEF1g/exec";

let veiculosLocais = [];
let cardSendoArrastadoId = null;
let intervaloAtualizacao = null;

document.addEventListener("DOMContentLoaded", async () => {
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            fazerLogin();
        });
    }

    const dataElem = document.getElementById('data_agendamento');
    if (dataElem) dataElem.value = getHojeLocal();
    configurarNavegacaoEnter();

    // Se houver Supabase configurado para autenticação de login, mantém o fluxo
    if (typeof _supabase !== 'undefined') {
        try {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session) {
                exibirPainel(session.user);
            } else {
                ocultarPainel();
            }

            _supabase.auth.onAuthStateChange((event, session) => {
                if (session) {
                    exibirPainel(session.user);
                } else {
                    ocultarPainel();
                }
            });
        } catch (e) {
            console.warn("Supabase Auth não inicializado. Abrindo painel direto.", e);
            exibirPainel();
        }
    } else {
        exibirPainel();
    }
});

// 🟢 AUTENTICAÇÃO E SESSÃO
async function fazerLogin() {
    const elUsuario = document.getElementById('login-usuario');
    const elSenha = document.getElementById('login-senha');
    const btn = document.getElementById('btn-login');

    if (!elUsuario || !elSenha) {
        exibirPainel();
        return;
    }

    let usuarioInput = elUsuario.value.trim().toLowerCase();
    const password = elSenha.value;

    if (!usuarioInput.includes('@')) {
        usuarioInput = `${usuarioInput}@oficina.local`;
    }

    if (btn) {
        btn.innerText = "Entrando...";
        btn.disabled = true;
    }

    try {
        if (typeof _supabase !== 'undefined') {
            const { error } = await _supabase.auth.signInWithPassword({ 
                email: usuarioInput, 
                password: password 
            });

            if (error) throw error;
        } else {
            exibirPainel();
        }
    } catch (err) {
        console.error("Erro no Auth:", err);
        alert("Falha no login: " + (err.message === "Invalid login credentials" ? "Usuário ou senha incorretos." : err.message));
    } finally {
        if (btn) {
            btn.innerText = "Entrar no Sistema";
            btn.disabled = false;
        }
    }
}

async function fazerLogout() {
    if (intervaloAtualizacao) clearInterval(intervaloAtualizacao);
    
    if (typeof _supabase !== 'undefined') {
        try {
            const canais = _supabase.getChannels();
            canais.forEach(canal => _supabase.removeChannel(canal));
            await _supabase.auth.signOut();
        } catch (e) {
            console.warn("Aviso ao limpar canais no logout:", e);
        }
    }
    window.location.reload();
}

function exibirPainel(user = null) {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');
    const userDisplay = document.getElementById('user-display');

    if (loginScreen) loginScreen.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
    
    if (userDisplay) {
        const nomeExibicao = (user && user.email) ? user.email.replace('@oficina.local', '').toUpperCase() : 'MECÂNICO';
        userDisplay.innerText = `👤 Usuário: ${nomeExibicao}`;
    }
    
    // Busca inicial de veículos
    buscarVeiculos();

    // 🔄 Atualização automática a cada 15 segundos da planilha
    if (!intervaloAtualizacao) {
        intervaloAtualizacao = setInterval(buscarVeiculos, 15000);
    }
}

function ocultarPainel() {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');

    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContent) appContent.style.display = 'none';
}

// 🟢 AUXILIARES
function getHojeLocal() {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function deveExibirRetirado(updatedAt) {
    if (!updatedAt) return true;

    const agora = new Date();
    const dataAtualizacao = new Date(updatedAt);

    const ehHoje = agora.toDateString() === dataAtualizacao.toDateString();

    if (agora.getHours() >= 18) {
        return false;
    }

    return ehHoje;
}

function configurarNavegacaoEnter() {
    const campos = Array.from(document.querySelectorAll('#form-veiculo input, #form-veiculo select, #form-veiculo textarea'));

    campos.forEach((campo, index) => {
        campo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();

                if (campo.id === 'placa') {
                    buscarPorPlaca(campo.value);
                }

                const proximoCampo = campos[index + 1];
                if (proximoCampo) {
                    proximoCampo.focus();
                } else {
                    salvarVeiculo();
                }
            }
        });
    });
}

// 🟢 DRAG & DROP
function dragStart(ev, id) {
    cardSendoArrastadoId = id;
    ev.dataTransfer.setData("text/plain", id);
    ev.dataTransfer.effectAllowed = "move";
}

function allowDrop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.add('drag-over');
}

function dragLeave(ev) {
    ev.currentTarget.classList.remove('drag-over');
}

async function drop(ev, novoStatus) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('drag-over');
    
    const id = ev.dataTransfer.getData("text/plain") || cardSendoArrastadoId;
    if (!id) return;

    await atualizarStatusNoSupabase(id, novoStatus);
}

// 🟢 NAVEGAÇÃO DE ABAS
function focarColuna(status, btnElement) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    const coluna = document.getElementById(`col-${status}`);
    if (coluna) {
        coluna.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

// 🟢 BUSCA DE DADOS (INTEGRADA COM GOOGLE SHEETS)
async function buscarVeiculos() {
    if (GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes("SUA_URL_DO_APPS_SCRIPT_AQUI")) {
        try {
            const resposta = await fetch(GOOGLE_SCRIPT_URL);
            const dadosPlanilha = await resposta.json();

            // Mapeia os dados vindo do Google Sheets para a estrutura exata do sistema
            veiculosLocais = dadosPlanilha.map((item, index) => {
                let statusTratado = (item['Status / Finalizado'] || item['Status'] || item['STATUS'] || 'AGENDADO').toString().toUpperCase().trim();
                if (!['AGENDADO', 'ENTRADA', 'EXECUÇÃO', 'FINALIZADO', 'RETIRADO'].includes(statusTratado)) {
                    statusTratado = 'AGENDADO';
                }

                let obsText = item['Relato do Cliente'] || item['Observações'] || '';
                if (item['Luz no Painel']) {
                    obsText = `[Luz Painel: ${item['Luz no Painel']}] ` + obsText;
                }

                return {
                    id: String(item['id'] || item['Placa'] || index),
                    os_or: item['OS'] || item['OR'] || item['OS/OR'] || item['os_or'] || '',
                    cliente: (item['Nome do Cliente'] || item['Cliente'] || item['cliente'] || '').toString().trim(),
                    telefone: item['Telefone'] || item['telefone'] || '',
                    placa: (item['Placa'] || item['placa'] || '').toString().trim(),
                    mecanico: item['Mecânico'] || item['MECANICO'] || item['mecanico'] || '',
                    alinhador: item['Alinhador'] || item['alinhador'] || '',
                    tipo_veiculo: item['Tipo'] || item['tipo_veiculo'] || 'CARRO',
                    data_agendamento: item['Data'] || item['data_agendamento'] || getHojeLocal(),
                    status: statusTratado,
                    observacoes: obsText,
                    chk_orcamento_pendente: !!item['chk_orcamento_pendente'],
                    chk_aguardando_aprovacao: !!item['chk_aguardando_aprovacao'],
                    chk_orcamento_aprovado: !!item['chk_orcamento_aprovado'],
                    chk_aguardando_pecas: !!item['chk_aguardando_pecas'],
                    fornecedor: item['fornecedor'] || '',
                    codigo_peca: item['codigo_peca'] || '',
                    updated_at: item['updated_at'] || new Date().toISOString()
                };
            });

            renderizarPainel();
            return;
        } catch (err) {
            console.error("Erro ao buscar dados do Google Sheets:", err);
        }
    }

    // Fallback: busca via Supabase caso a URL da planilha não esteja preenchida
    if (typeof _supabase !== 'undefined') {
        try {
            const { data, error } = await _supabase.from('veiculos').select('*');
            if (error) throw error;
            veiculosLocais = data || [];
            renderizarPainel();
        } catch (err) {
            console.error("Erro ao buscar veículos via Supabase:", err);
        }
    }
}

function renderizarPainel(filtroDigitado = null) {
    if (filtroDigitado === null) {
        filtroDigitado = document.getElementById('busca-placa')?.value || '';
    }

    const colunas = ['AGENDADO', 'ENTRADA', 'EXECUÇÃO', 'FINALIZADO', 'RETIRADO'];
    const contadores = { AGENDADO: 0, ENTRADA: 0, EXECUÇÃO: 0, FINALIZADO: 0, RETIRADO: 0 };

    colunas.forEach(col => {
        const container = document.getElementById(`container-${col}`);
        if (container) container.innerHTML = '';
    });

    const filtro = filtroDigitado.toLowerCase().trim();

    veiculosLocais.forEach(v => {
        const placaStr = (v.placa || '').toLowerCase();
        const clienteStr = (v.cliente || '').toLowerCase();
        const osOrStr = (v.os_or || '').toLowerCase();

        if (filtro && !placaStr.includes(filtro) && !clienteStr.includes(filtro) && !osOrStr.includes(filtro)) {
            return;
        }

        if (v.status === 'RETIRADO' && !filtro) {
            if (!deveExibirRetirado(v.updated_at)) {
                return;
            }
        }

        if (contadores[v.status] !== undefined) {
            contadores[v.status]++;
        }

        const container = document.getElementById(`container-${v.status}`);
        if (container) {
            const card = document.createElement('div');
            card.className = 'card';
            card.draggable = true;
            card.setAttribute('ondragstart', `dragStart(event, '${v.id}')`);

            const osOrHtml = v.os_or ? `<span class="card-os" style="display: block;">OS/OR: ${v.os_or}</span>` : '';
            const dataHtml = v.data_agendamento ? `<div style="font-size:11px; color:#666; margin-top: 2px; font-weight: 500; white-space: nowrap; text-align: right;">📅 ${v.data_agendamento}</div>` : '';

            // 🏷️ Tag de Tipo de Veículo (Carro ou Van)
            let tipoVeiculoHtml = '';
            if (v.tipo_veiculo === 'VAN') {
                tipoVeiculoHtml = `<span style="background:#e0f7fa; color:#006064; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">🚐 Van</span>`;
            } else if (v.tipo_veiculo === 'CARRO') {
                tipoVeiculoHtml = `<span style="background:#eceff1; color:#37474f; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">🚗 Carro</span>`;
            }

            // 🏷️ Construção das Tags no Card
            let tagsHtml = tipoVeiculoHtml;
            if (v.chk_orcamento_pendente) tagsHtml += `<span style="background:#fff3e0; color:#e65100; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">⏳ Aguard. Orçamento</span>`;
            if (v.chk_aguardando_aprovacao) tagsHtml += `<span style="background:#fef3c7; color:#d97706; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">⏳ Ag. Aprovação</span>`;
            if (v.chk_orcamento_aprovado) tagsHtml += `<span style="background:#e8f5e9; color:#2e7d32; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">✅ Orç. Aprovado</span>`;
            
            if (v.chk_aguardando_pecas) {
                let infoPeca = '📦 Aguard. Peças';
                if (v.fornecedor || v.codigo_peca) {
                    infoPeca += ` (${[v.fornecedor, v.codigo_peca].filter(Boolean).join(' - ')})`;
                }
                tagsHtml += `<span style="background:#f3e5f5; color:#7b1fa2; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px; display:inline-block; margin-top:2px;">${infoPeca}</span>`;
            }

            const containerTags = tagsHtml ? `<div style="margin: 6px 0;">${tagsHtml}</div>` : '';
            const alinhadorHtml = v.alinhador ? `<p style="margin: 4px 0; font-size: 12px; color: #444;"><strong>Alinhador:</strong> ${v.alinhador}</p>` : '';

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-cliente-wrapper">
                        <h4 class="card-cliente">${v.cliente || 'CLIENTE SEM NOME'}</h4>
                    </div>
                    <div class="card-meta-wrapper" style="display: flex; flex-direction: column; align-items: flex-end;">
                        ${osOrHtml}
                        ${dataHtml}
                    </div>
                </div>
                <div>
                    <span class="card-placa">🚘 ${v.placa || '-'}</span>
                </div>
                ${containerTags}
                <p style="margin: 4px 0; font-size: 13px;"><strong>Mecânico:</strong> ${v.mecanico || 'NÃO ATRIBUÍDO'}</p>
                ${alinhadorHtml}
                <p style="margin: 4px 0;"><em>${v.observacoes || ''}</em></p>

                <div class="fast-move">
                    <span style="font-size: 10px; font-weight: bold; color: #666;">Status:</span>
                    <select onchange="atualizarStatusNoSupabase('${v.id}', this.value)">
                        <option value="AGENDADO" ${v.status === 'AGENDADO' ? 'selected' : ''}>AGENDADO</option>
                        <option value="ENTRADA" ${v.status === 'ENTRADA' ? 'selected' : ''}>ENTRADA</option>
                        <option value="EXECUÇÃO" ${v.status === 'EXECUÇÃO' ? 'selected' : ''}>EXECUÇÃO</option>
                        <option value="FINALIZADO" ${v.status === 'FINALIZADO' ? 'selected' : ''}>FINALIZADO</option>
                        <option value="RETIRADO" ${v.status === 'RETIRADO' ? 'selected' : ''}>RETIRADO</option>
                    </select>
                </div>

                <div class="card-actions">
                    <button style="background: #3498db;" onclick="carregarParaEdicao('${v.id}')">✏️ Editar</button>
                    <button style="background: #25D366;" onclick="notificarWhatsApp('${v.id}')">📱 Whats</button>
                    <button style="background: #e74c3c;" onclick="excluirVeiculo('${v.id}')">🗑️ Excluir</button>
                </div>
            `;

            adicionarSuporteTouch(card, v.id);
            container.appendChild(card);
        }
    });

    const atualizarTitulo = (id, emoji, texto, cont) => {
        const el = document.querySelector(`#col-${id} h3`);
        if (el) el.innerText = `${emoji} ${texto} (${cont})`;
    };

    atualizarTitulo('AGENDADO', '📅', 'AGENDADO', contadores.AGENDADO);
    atualizarTitulo('ENTRADA', '🚗', 'ENTRADA', contadores.ENTRADA);
    atualizarTitulo('EXECUÇÃO', '🛠️', 'EXECUÇÃO', contadores.EXECUÇÃO);
    atualizarTitulo('FINALIZADO', '✅', 'FINALIZADO', contadores.FINALIZADO);
    atualizarTitulo('RETIRADO', '🏁', 'RETIRADO', contadores.RETIRADO);
}

function adicionarSuporteTouch(card, id) {
    card.addEventListener('touchstart', () => {
        cardSendoArrastadoId = id;
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
        const touch = e.changedTouches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (targetElement) {
            const containerDestino = targetElement.closest('.cards-container');
            if (containerDestino) {
                const novoStatus = containerDestino.parentElement.getAttribute('data-status');
                if (novoStatus) {
                    atualizarStatusNoSupabase(id, novoStatus);
                }
            }
        }
    }, { passive: true });
}

async function atualizarStatusNoSupabase(id, novoStatus) {
    const v = veiculosLocais.find(item => item.id === id);
    if (v) {
        v.status = novoStatus;
        v.updated_at = new Date().toISOString();

        // 🔄 Atualiza o status diretamente na Planilha do Google
        if (GOOGLE_SCRIPT_URL) {
            try {
                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        acao: 'atualizar_status',
                        dados: { placa: v.placa, novoStatus: novoStatus }
                    })
                });
            } catch (e) {
                console.error("Erro ao enviar novo status para a planilha:", e);
            }
        }
    }

    if (typeof _supabase !== 'undefined') {
        try {
            const agoraIso = new Date().toISOString();
            let { error } = await _supabase
                .from('veiculos')
                .update({ status: novoStatus, updated_at: agoraIso })
                .eq('id', id);

            if (error) {
                await _supabase.from('veiculos').update({ status: novoStatus }).eq('id', id);
            }
        } catch (err) {
            console.warn("Aviso ao atualizar via Supabase:", err);
        }
    }

    renderizarPainel();
}

async function buscarPorPlaca(placaDigitada) {
    if (!placaDigitada || placaDigitada.length < 3) return;

    const placaLimpa = placaDigitada.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    let veiculoEncontrado = veiculosLocais.find(v => 
        (v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === placaLimpa
    );

    if (veiculoEncontrado) {
        document.getElementById('cliente').value = veiculoEncontrado.cliente || '';
        document.getElementById('telefone').value = veiculoEncontrado.telefone || '';
        document.getElementById('placa').value = veiculoEncontrado.placa || '';
        
        if (document.getElementById('tipo_veiculo') && veiculoEncontrado.tipo_veiculo) {
            document.getElementById('tipo_veiculo').value = veiculoEncontrado.tipo_veiculo;
        }
        
        document.getElementById('veiculo-id').value = veiculoEncontrado.id;
        document.getElementById('mecanico')?.focus();
    }
}

async function salvarVeiculo() {
    const id = document.getElementById('veiculo-id').value;
    const dataCampo = document.getElementById('data_agendamento').value;
    
    const dados = {
        os_or: document.getElementById('os_or').value.trim().toUpperCase(),
        cliente: document.getElementById('cliente').value.trim().toUpperCase(),
        telefone: document.getElementById('telefone').value.trim(),
        placa: document.getElementById('placa').value.trim().toUpperCase(),
        mecanico: document.getElementById('mecanico').value.trim().toUpperCase(),
        alinhador: document.getElementById('alinhador')?.value.trim().toUpperCase() || '',
        tipo_veiculo: document.getElementById('tipo_veiculo')?.value || 'CARRO',
        data_agendamento: dataCampo ? dataCampo : null,
        status: document.getElementById('status').value,
        observacoes: document.getElementById('observacoes').value.trim().toUpperCase(),
        
        // 📋 Caixas de marcação e extras
        chk_orcamento_pendente: document.getElementById('chk_orcamento_pendente')?.checked || false,
        chk_aguardando_aprovacao: document.getElementById('chk_aguardando_aprovacao')?.checked || false,
        chk_orcamento_aprovado: document.getElementById('chk_orcamento_aprovado')?.checked || false,
        chk_aguardando_pecas: document.getElementById('chk_aguardando_pecas')?.checked || false,
        fornecedor: document.getElementById('fornecedor')?.value.trim().toUpperCase() || '',
        codigo_peca: document.getElementById('codigo_peca')?.value.trim().toUpperCase() || '',

        updated_at: new Date().toISOString()
    };

    if (!dados.cliente || !dados.placa) {
        alert("Por favor, preencha os campos obrigatórios: Cliente e Placa!");
        return;
    }

    // 💾 Salva o novo veículo diretamente na Planilha do Google
    if (GOOGLE_SCRIPT_URL) {
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    acao: 'salvar',
                    dados: dados
                })
            });
        } catch (e) {
            console.error("Erro ao salvar dados na planilha:", e);
        }
    }

    if (typeof _supabase !== 'undefined') {
        try {
            if (id) {
                const { error } = await _supabase.from('veiculos').update(dados).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await _supabase.from('veiculos').insert([dados]);
                if (error) throw error;
            }
        } catch (err) {
            console.error("Erro no Supabase ao salvar:", err);
        }
    }

    limparFormulario();
    setTimeout(buscarVeiculos, 1200);
}

function carregarParaEdicao(id) {
    const v = veiculosLocais.find(item => item.id === id);
    if (!v) return;

    document.getElementById('veiculo-id').value = v.id;
    document.getElementById('os_or').value = v.os_or || '';
    document.getElementById('cliente').value = v.cliente || '';
    document.getElementById('telefone').value = v.telefone || '';
    document.getElementById('placa').value = v.placa || '';
    document.getElementById('mecanico').value = v.mecanico || '';
    if (document.getElementById('alinhador')) document.getElementById('alinhador').value = v.alinhador || '';
    if (document.getElementById('tipo_veiculo')) document.getElementById('tipo_veiculo').value = v.tipo_veiculo || 'CARRO';
    document.getElementById('data_agendamento').value = v.data_agendamento || '';
    document.getElementById('status').value = v.status;
    document.getElementById('observacoes').value = v.observacoes || '';

    // Checkboxes e inputs extras
    if (document.getElementById('chk_orcamento_pendente')) document.getElementById('chk_orcamento_pendente').checked = !!v.chk_orcamento_pendente;
    if (document.getElementById('chk_aguardando_aprovacao')) document.getElementById('chk_aguardando_aprovacao').checked = !!v.chk_aguardando_aprovacao;
    if (document.getElementById('chk_orcamento_aprovado')) document.getElementById('chk_orcamento_aprovado').checked = !!v.chk_orcamento_aprovado;
    if (document.getElementById('chk_aguardando_pecas')) document.getElementById('chk_aguardando_pecas').checked = !!v.chk_aguardando_pecas;
    
    if (document.getElementById('fornecedor')) document.getElementById('fornecedor').value = v.fornecedor || '';
    if (document.getElementById('codigo_peca')) document.getElementById('codigo_peca').value = v.codigo_peca || '';

    document.getElementById('form-title').innerText = "Editar Cadastro do Veículo";
    document.getElementById('btn-salvar').innerText = "Salvar Alterações";
    document.getElementById('btn-cancelar').style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirVeiculo(id) {
    const v = veiculosLocais.find(item => item.id === id);
    if (!v) return;

    if (confirm(`Tem certeza que deseja excluir o veículo de ${v.cliente} (Placa: ${v.placa})?`)) {
        if (typeof _supabase !== 'undefined') {
            try {
                const { error } = await _supabase.from('veiculos').delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error("Erro ao excluir no Supabase:", err);
            }
        }
        await buscarVeiculos();
    }
}

function limparFormulario() {
    document.getElementById('veiculo-id').value = '';
    document.getElementById('os_or').value = '';
    document.getElementById('cliente').value = '';
    document.getElementById('telefone').value = '';
    document.getElementById('placa').value = '';
    document.getElementById('mecanico').value = '';
    if (document.getElementById('alinhador')) document.getElementById('alinhador').value = '';
    if (document.getElementById('tipo_veiculo')) document.getElementById('tipo_veiculo').value = 'CARRO';
    document.getElementById('data_agendamento').value = getHojeLocal();
    document.getElementById('status').value = 'AGENDADO';
    document.getElementById('observacoes').value = '';

    if (document.getElementById('chk_orcamento_pendente')) document.getElementById('chk_orcamento_pendente').checked = false;
    if (document.getElementById('chk_aguardando_aprovacao')) document.getElementById('chk_aguardando_aprovacao').checked = false;
    if (document.getElementById('chk_orcamento_aprovado')) document.getElementById('chk_orcamento_aprovado').checked = false;
    if (document.getElementById('chk_aguardando_pecas')) document.getElementById('chk_aguardando_pecas').checked = false;
    
    if (document.getElementById('fornecedor')) document.getElementById('fornecedor').value = '';
    if (document.getElementById('codigo_peca')) document.getElementById('codigo_peca').value = '';

    document.getElementById('form-title').innerText = "Cadastrar Novo Veículo";
    document.getElementById('btn-salvar').innerText = "Adicionar Veículo";
    document.getElementById('btn-cancelar').style.display = "none";
}

function notificarWhatsApp(id) {
    const v = veiculosLocais.find(item => item.id === id);
    if (!v || !v.telefone) {
        alert("Número de telefone não cadastrado.");
        return;
    }

    let num = v.telefone.replace(/\D/g, '');

    if (num.length >= 10 && !num.startsWith('55')) {
        num = '55' + num;
    }

    let mensagemCustomizada = `Olá ${v.cliente}! Seu veículo (Placa *${v.placa}*) está no status: *${v.status}*.`;
    
    switch (v.status) {
        case 'EXECUÇÃO':
            mensagemCustomizada = `Olá ${v.cliente}! Seu veículo (*${v.placa}*) já está em manutenção/execução.`;
            break;
        case 'FINALIZADO':
            mensagemCustomizada = `Olá ${v.cliente}! O serviço no seu veículo (*${v.placa}*) foi finalizado! Já pode vir retirar.`;
            break;
        case 'RETIRADO':
            mensagemCustomizada = `Olá ${v.cliente}! Obrigado por escolher nossos serviços. Seu veículo (*${v.placa}*) foi entregue!`;
            break;
    }

    const txt = encodeURIComponent(mensagemCustomizada);
    const urlCompleta = `https://api.whatsapp.com/send?phone=${num}&text=${txt}`;
    
    window.open(urlCompleta, '_blank');
}

// 🌐 EXPORTAÇÃO GLOBAL
window.fazerLogin = fazerLogin;
window.fazerLogout = fazerLogout;
window.dragStart = dragStart;
window.allowDrop = allowDrop;
window.dragLeave = dragLeave;
window.drop = drop;
window.focarColuna = focarColuna;
window.atualizarStatusNoSupabase = atualizarStatusNoSupabase;
window.buscarPorPlaca = buscarPorPlaca;
window.salvarVeiculo = salvarVeiculo;
window.carregarParaEdicao = carregarParaEdicao;
window.excluirVeiculo = excluirVeiculo;
window.limparFormulario = limparFormulario;
window.notificarWhatsApp = notificarWhatsApp;
window.renderizarPainel = renderizarPainel;
