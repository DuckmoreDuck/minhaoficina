let veiculosLocais = [];

// Inicialização ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    buscarVeiculos();
    document.getElementById('data_agendamento').valueAsDate = new Date();
    configurarNavegacaoEnter();
});

// Mudar de campo ao apertar "Enter" sequencialmente
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

// Buscar dados guardados localmente
function buscarVeiculos() {
    const dadosSalvos = localStorage.getItem('oficina_veiculos');
    if (dadosSalvos) {
        veiculosLocais = JSON.parse(dadosSalvos);
    } else {
        veiculosLocais = [];
    }
    renderizarPainel();
}

function salvarNoLocalStorage() {
    localStorage.setItem('oficina_veiculos', JSON.stringify(veiculosLocais));
}

// Renderizar Cards na Tela
function renderizarPainel(filtroPlaca = '') {
    const colunas = ['AGENDADO', 'ENTRADA', 'EXECUÇÃO', 'FINALIZADO', 'RETIRADO'];
    colunas.forEach(col => {
        const container = document.querySelector(`#col-${col} .cards-container`);
        if (container) container.innerHTML = '';
    });

    veiculosLocais.forEach(v => {
        if (filtroPlaca && !v.placa.toLowerCase().includes(filtroPlaca.toLowerCase())) {
            return;
        }

        if (v.status === 'RETIRADO' && !filtroPlaca) {
            return;
        }

        const container = document.querySelector(`#col-${v.status} .cards-container`);
        if (container) {
            const card = document.createElement('div');
            card.className = 'card';
            card.draggable = true;
            card.id = `card-${v.id}`;
            card.ondragstart = (e) => drag(e, v.id);
            
            card.innerHTML = `
                <h4>${v.cliente}</h4>
                <p><strong>Placa:</strong> ${v.placa}</p>
                <p><strong>Mecânico:</strong> ${v.mecanico || 'NÃO ATRIBUÍDO'}</p>
                <p><strong>Data:</strong> ${v.data_agendamento}</p>
                <p><em>${v.observacoes || ''}</em></p>
                <div class="card-actions">
                    <button style="background: #3498db;" onclick="carregarParaEdicao('${v.id}')">Editar</button>
                    <button style="background: #25D366;" onclick="notificarWhatsApp('${v.id}')">📱 Notificar</button>
                    <button style="background: #e74c3c;" onclick="excluirVeiculo('${v.id}')">🗑️ Excluir</button>
                </div>
            `;
            container.appendChild(card);
        }
    });
}

function allowDrop(ev) { 
    ev.preventDefault(); 
}

function drag(ev, id) { 
    ev.dataTransfer.setData("text/plain", id); 
}

function drop(ev, novoStatus) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text/plain");
    
    if (!id) return;

    const veiculo = veiculosLocais.find(v => v.id === id);
    if (veiculo) {
        veiculo.status = novoStatus;
        salvarNoLocalStorage();
        renderizarPainel();
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

function salvarVeiculo() {
    const id = document.getElementById('veiculo-id').value;
    
    const dados = {
        cliente: document.getElementById('cliente').value.trim().toUpperCase(),
        telefone: document.getElementById('telefone').value.trim(),
        placa: document.getElementById('placa').value.trim().toUpperCase(),
        mecanico: document.getElementById('mecanico').value.trim().toUpperCase(),
        data_agendamento: document.getElementById('data_agendamento').value,
        status: document.getElementById('status').value,
        observacoes: document.getElementById('observacoes').value.trim().toUpperCase()
    };

    if (!dados.cliente || !dados.placa || !dados.telefone) {
        alert("Por favor, preencha os campos obrigatórios: Cliente, Telefone e Placa!");
        return;
    }

    if (id) {
        const index = veiculosLocais.findIndex(item => item.id === id);
        if (index !== -1) {
            dados.id = id;
            veiculosLocais[index] = dados;
        }
    } else {
        dados.id = 'id_' + Math.random().toString(36).substr(2, 9);
        veiculosLocais.push(dados);
    }
    
    salvarNoLocalStorage();
    limparFormulario();
    buscarVeiculos();
}

function carregarParaEdicao(id) {
    const v = veiculosLocais.find(item => item.id === id);
    if (!v) return;

    document.getElementById('veiculo-id').value = v.id;
    document.getElementById('cliente').value = v.cliente;
    document.getElementById('telefone').value = v.telefone || '';
    document.getElementById('placa').value = v.placa;
    document.getElementById('mecanico').value = v.mecanico || '';
    document.getElementById('data_agendamento').value = v.data_agendamento;
    document.getElementById('status').value = v.status;
    document.getElementById('observacoes').value = v.observacoes || '';

    document.getElementById('form-title').innerText = "Editar Cadastro do Veículo";
    document.getElementById('btn-salvar').innerText = "Salvar Alterações";
    document.getElementById('btn-cancelar').style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function excluirVeiculo(id) {
    const v = veiculosLocais.find(item => item.id === id);
    if (!v) return;

    if (confirm(`Tem certeza que deseja excluir o veículo de ${v.cliente} (Placa: ${v.placa})?`)) {
        veiculosLocais = veiculosLocais.filter(item => item.id !== id);
        salvarNoLocalStorage();
        buscarVeiculos();
    }
}

function limparFormulario() {
    document.getElementById('veiculo-id').value = '';
    document.getElementById('cliente').value = '';
    document.getElementById('telefone').value = '';
    document.getElementById('placa').value = '';
    document.getElementById('mecanico').value = '';
    document.getElementById('data_agendamento').valueAsDate = new Date();
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
