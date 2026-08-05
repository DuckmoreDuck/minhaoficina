let veiculosLocais = [];
let cardSendoArrastadoId = null;

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

    if (typeof _supabase !== 'undefined') {
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
    }
});

// 🟢 AUTENTICAÇÃO E SESSÃO
async function fazerLogin() {
    const elUsuario = document.getElementById('login-usuario');
    const elSenha = document.getElementById('login-senha');
    const btn = document.getElementById('btn-login');

    if (!elUsuario || !elSenha) return;

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
        const { error } = await _supabase.auth.signInWithPassword({ 
            email: usuarioInput, 
            password: password 
        });

        if (error) throw error;

    } catch (err) {
        console.error("Erro no Supabase Auth:", err);
        alert("Falha no login: " + (err.message === "Invalid login credentials" ? "Usuário ou senha incorretos." : err.message));
    } finally {
        if (btn) {
            btn.innerText = "Entrar no Sistema";
            btn.disabled = false;
        }
    }
}

async function fazerLogout() {
    try {
        const canais = _supabase.getChannels();
        canais.forEach(canal => _supabase.removeChannel(canal));
    } catch (e) {
        console.warn("Aviso ao limpar canais no logout:", e);
    }
    
    await _supabase.auth.signOut();
    window.location.reload();
}

function exibirPainel(user) {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');
    const userDisplay = document.getElementById('user-display');

    if (loginScreen) loginScreen.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
    
    if (userDisplay) {
        const nomeExibicao = user.email ? user.email.replace('@oficina.local', '').toUpperCase() : 'MECÂNICO';
        userDisplay.innerText = `👤 Usuário: ${nomeExibicao}`;
    }
    
    buscarVeiculos();

    // Executa a assinatura do Realtime no próximo ciclo para isolar do evento de login
    setTimeout(() => {
        inscreverRealtimeSupabase();
    }, 0);
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

async function inscreverRealtimeSupabase() {
    try {
        // Limpa qualquer canal pré-existente registrado na instância do Supabase
        const canaisExistentes = _supabase.getChannels();
        for (const canal of canaisExistentes) {
            await _supabase.removeChannel(canal);
        }

        // Cria a nova escuta de forma segura
        _supabase
            .channel('mudancas-veiculos')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, () => {
                buscarVeiculos();
            })
            .subscribe();
    } catch (e) {
        console.warn("Sincronização Realtime offline ou redundante ignorada:", e);
    }
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

// 🟢 SUPABASE CRUD
async function buscarVeiculos() {
    try {
        const { data, error } = await _supabase
            .from('veiculos')
            .select('*');

        if (error) throw error;

        veiculosLocais = data || [];
        renderizarPainel();
    } catch (err) {
        console.error("Erro ao buscar veículos:", err);
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

            const osOrHtml = v.os_or ? `<span class="card-os">OS/OR: ${v.os_or}</span>` : '';
            
            card.innerHTML = `
                <div class="card-header">
                    <h4 class="card-cliente">${v.cliente || 'CLIENTE SEM NOME'}</h4>
                    ${osOrHtml}
                </div>
                <div>
                    <span class="card-placa">🚘 ${v.placa || '-'}</span>
                </div>
                <p><strong>Mecânico:</strong> ${v.mecanico || 'NÃO ATRIBUÍDO'}</p>
                <p><strong>Data:</strong> ${v.data_agendamento || '-'}</p>
                <p><em>${v.observacoes || ''}</em></p>

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
    try {
        const agoraIso = new Date().toISOString();
        
        let { error } = await _supabase
            .from('veiculos')
            .update({ 
                status: novoStatus,
                updated_at: agoraIso
            })
            .eq('id', id);

        if (error) {
            console.warn("Tentando fallback de atualização simples sem updated_at:", error.message);
            const resFallback = await _supabase
                .from('veiculos')
                .update({ status: novoStatus })
                .eq('id', id);

            if (resFallback.error) throw resFallback.error;
        }

        const v = veiculosLocais.find(item => item.id === id);
        if (v) {
            v.status = novoStatus;
            v.updated_at = agoraIso;
        }

        renderizarPainel();
    } catch (err) {
        console.error("Erro detalhado ao atualizar status:", err);
        alert("Erro ao atualizar o status no banco de dados: " + (err.message || JSON.stringify(err)));
    }
}

async function buscarPorPlaca(placaDigitada) {
    if (!placaDigitada || placaDigitada.length < 3) return;

    const placaLimpa = placaDigitada.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    let veiculoEncontrado = veiculosLocais.find(v => 
        (v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === placaLimpa
    );

    if (!veiculoEncontrado) {
        try {
            const { data, error } = await _supabase
                .from('veiculos')
                .select('*')
                .ilike('placa', `%${placaDigitada.trim()}%`)
                .limit(1);

            if (!error && data && data.length > 0) {
                veiculoEncontrado = data[0];
            }
        } catch (err) {
            console.error("Erro na busca remota por placa:", err);
        }
    }

    if (veiculoEncontrado) {
        carregarParaEdicao(veiculoEncontrado.id);
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
        data_agendamento: dataCampo ? dataCampo : null,
        status: document.getElementById('status').value,
        observacoes: document.getElementById('observacoes').value.trim().toUpperCase(),
        updated_at: new Date().toISOString()
    };

    if (!dados.cliente || !dados.placa) {
        alert("Por favor, preencha os campos obrigatórios: Cliente e Placa!");
        return;
    }

    try {
        if (id) {
            const { error } = await _supabase
                .from('veiculos')
                .update(dados)
                .eq('id', id);

            if (error) throw error;
        } else {
            const { error } = await _supabase
                .from('veiculos')
                .insert([dados]);

            if (error) throw error;
        }

        limparFormulario();
        await buscarVeiculos();
    } catch (err) {
        alert("Erro ao salvar veículo no banco de dados.");
        console.error("Erro detalhado:", err);
    }
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
    document.getElementById('data_agendamento').value = v.data_agendamento || '';
    document.getElementById('status').value = v.status;
    document.getElementById('observacoes').value = v.observacoes || '';

    document.getElementById('form-title').innerText = "Editar Cadastro do Veículo";
    document.getElementById('btn-salvar').innerText = "Salvar Alterações";
    document.getElementById('btn-cancelar').style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function excluirVeiculo(id) {
    const v = veiculosLocais.find(item => item.id === id);
    if (!v) return;

    if (confirm(`Tem certeza que deseja excluir o veículo de ${v.cliente} (Placa: ${v.placa})?`)) {
        try {
            const { error } = await _supabase
                .from('veiculos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await buscarVeiculos();
        } catch (err) {
            alert("Erro ao excluir veículo.");
            console.error("Erro detalhado:", err);
        }
    }
}

function limparFormulario() {
    document.getElementById('veiculo-id').value = '';
    document.getElementById('os_or').value = '';
    document.getElementById('cliente').value = '';
    document.getElementById('telefone').value = '';
    document.getElementById('placa').value = '';
    document.getElementById('mecanico').value = '';
    document.getElementById('data_agendamento').value = getHojeLocal();
    document.getElementById('status').value = 'AGENDADO';
    document.getElementById('observacoes').value = '';

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
