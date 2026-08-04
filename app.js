let veiculosLocais = [];
let cardSendoArrastadoId = null;

document.addEventListener("DOMContentLoaded", async () => {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data_agendamento').value = hoje;

    configurarNavegacaoEnter();
    await buscarVeiculos();

    // Atualização em tempo real a cada 5 segundos
    setInterval(buscarVeiculos, 5000);
});

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

// 🟢 FUNÇÕES DRAG & DROP NATIVAS (DESKTOP E TOUCH)
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

// 🟢 NAVEGAÇÃO DE ABAS NO CELULAR
function focarColuna(status, btnElement) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    const coluna = document.getElementById(`col-${status}`);
    if (coluna) {
        coluna.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

// 🟢 BUSCAR VEÍCULOS DO SUPABASE
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

// 🟢 RENDERIZAR CARDS COM CONTADOR
function renderizarPainel(filtroPlaca = '') {
    const colunas = ['AGENDADO', 'ENTRADA', 'EXECUÇÃO', 'FINALIZADO', 'RETIRADO'];
    const contadores = { AGENDADO: 0, ENTRADA: 0, EXECUÇÃO: 0, FINALIZADO: 0, RETIRADO: 0 };

    colunas.forEach(col => {
        const container = document.getElementById(`container-${col}`);
        if (container) container.innerHTML = '';
    });

    veiculosLocais.forEach(v => {
        if (filtroPlaca && !v.placa.toLowerCase().includes(filtroPlaca.toLowerCase())) {
            return;
        }

        if (v.status === 'RETIRADO' && !filtroPlaca) {
            return;
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
            
            card.innerHTML = `
                <h4>${v.cliente}</h4>
                <p><strong>Placa:</strong> ${v.placa}</p>
                <p><strong>Mecânico:</strong> ${v.mecanico || 'NÃO ATRIBUÍDO'}</p>
                <p><strong>Data:</strong> ${v.data_agendamento || '-'}</p>
                <p><em>${v.observacoes || ''}</em></p>

                <!-- MOVER RÁPIDO NO PRÓPRIO CARD -->
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

    // Atualiza os títulos com as contagens
    document.querySelector('#col-AGENDADO h3').innerText = `📅 AGENDADO (${contadores.AGENDADO})`;
    document.querySelector('#col-ENTRADA h3').innerText = `🚗 ENTRADA (${contadores.ENTRADA})`;
    document.querySelector('#col-EXECUÇÃO h3').innerText = `🛠️ EXECUÇÃO (${contadores.EXECUÇÃO})`;
    document.querySelector('#col-FINALIZADO h3').innerText = `✅ FINALIZADO (${contadores.FINALIZADO})`;
    document.querySelector('#col-RETIRADO h3').innerText = `🏁 RETIRADO (${contadores.RETIRADO})`;
}

// 🟢 SUPORTE A TOUCH (CELULAR)
function adicionarSuporteTouch(card, id) {
    card.addEventListener('touchstart', (e) => {
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

// 🟢 ATUALIZAR STATUS NO SUPABASE
async function atualizarStatusNoSupabase(id, novoStatus) {
    try {
        const { error } = await _supabase
            .from('veiculos')
            .update({ status: novoStatus })
            .eq('id', id)
            .select();

        if (error) {
            console.error("Erro no Supabase:", error);
            alert("Erro ao atualizar o status no banco de dados.");
            return;
        }

        const v = veiculosLocais.find(item => item.id === id);
        if (v) v.status = novoStatus;

        renderizarPainel();
    } catch (err) {
        console.error("Erro inesperado ao mover veículo:", err);
    }
}

function buscarPorPlaca(placaDigitada) {
    if (!placaDigitada || placaDigitada.length < 3) return;

    const placaLimpa = placaDigitada.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const veiculoEncontrado = veiculosLocais.find(v => 
        v.placa.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === placaLimpa
    );

    if (veiculoEncontrado) {
        carregarParaEdicao(veiculoEncontrado.id);
    }
}

// 🟢 SALVAR OU EDITAR VEÍCULO
async function salvarVeiculo() {
    const id = document.getElementById('veiculo-id').value;
    const dataCampo = document.getElementById('data_agendamento').value;
    
    const dados = {
        cliente: document.getElementById('cliente').value.trim().toUpperCase(),
        telefone: document.getElementById('telefone').value.trim(),
        placa: document.getElementById('placa').value.trim().toUpperCase(),
        mecanico: document.getElementById('mecanico').value.trim().toUpperCase(),
        data_agendamento: dataCampo ? dataCampo : null,
        status: document.getElementById('status').value,
        observacoes: document.getElementById('observacoes').value.trim().toUpperCase()
    };

    if (!dados.cliente || !dados.placa || !dados.telefone) {
        alert("Por favor, preencha os campos obrigatórios: Cliente, Telefone e Placa!");
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
    document.getElementById('cliente').value = v.cliente;
    document.getElementById('telefone').value = v.telefone || '';
    document.getElementById('placa').value = v.placa;
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
    document.getElementById('cliente').value = '';
    document.getElementById('telefone').value = '';
    document.getElementById('placa').value = '';
    document.getElementById('mecanico').value = '';
    
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data_agendamento').value = hoje;
    
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
