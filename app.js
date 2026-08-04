let veiculosLocais = [];

// Inicialização ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    buscarVeiculos();
    document.getElementById('data_agendamento').valueAsDate = new Date();
});

// Buscar dados guardados localmente no navegador
function buscarVeiculos() {
    const dadosSalvos = localStorage.getItem('oficina_veiculos');
    if (dadosSalvos) {
        veiculosLocais = JSON.parse(dadosSalvos);
    } else {
        veiculosLocais = [];
    }
    renderizarPainel();
}

// Salvar a lista atualizada de veículos no navegador
function salvarNoLocalStorage() {
    localStorage.setItem('oficina_veiculos', JSON.stringify(veiculosLocais));
}

// Renderizar os Cards na Tela nas colunas corretas (Ocultando os RETIRADOS por padrão)
function renderizarPainel(filtroPlaca = '') {
    const colunas = ['AGENDADO', 'ENTRADA', 'EXECUÇÃO', 'FINALIZADO', 'RETIRADO'];
    colunas.forEach(col => {
        const container = document.querySelector(`#col-${col} .cards-container`);
        if (container) container.innerHTML = '';
    });

    veiculosLocais.forEach(v => {
        // Se houver filtro de busca e a placa não bater, ignora
        if (filtroPlaca && !v.placa.toLowerCase().includes(filtroPlaca.toLowerCase())) {
            return;
        }

        // 🟢 Se for RETIRADO e NÃO estivermos buscando por placa, ignora (some do painel)
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
                <p><strong>Mecânico:</strong> ${v.mecanico || 'Não atribuído'}</p>
                <p><strong>Data:</strong> ${v.data_agendamento}</p>
                <p><em>${v.observacoes || ''}</em></p>
                <div class="actions" style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px;">
                    <button class="btn-edit" style="background: #3498db; color: white; padding: 4px 8px; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;" onclick="carregarParaEdicao('${v.id}')">Editar</button>
                    <button class="btn-whatsapp" style="background: #25D366; color: white; padding: 4px 8px; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;" onclick="notificarWhatsApp('${v.id}')">📱 Notificar</button>
                    <button class="btn-delete" style="background: #e74c3c; color: white; padding: 4px 8px; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;" onclick="excluirVeiculo('${v.id}')">🗑️ Excluir</button>
                </div>
            `;
            container.appendChild(card);
        }
    });
}

// Funções para Arrastar e Soltar
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

// 🟢 Buscar veículo existente ao digitar a placa no formulário
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

// Adicionar ou Editar Registro
function salvarVeiculo() {
    const id = document.getElementById('veiculo-id').value;
    const dados = {
        cliente: document.getElementById('cliente').value,
        telefone: document.getElementById('telefone').value,
        placa: document.getElementById('placa').value,
        mecanico: document.getElementById('mecanico').value,
        data_agendamento: document.getElementById('data_agendamento').value,
        status: document.getElementById('status').value,
        observacoes: document.getElementById('observacoes').value
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

// Preencher formulário para editar
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
    document.getElementById('btn-cancelar').style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Função para Excluir Veículo
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

// 🟢 Função do WhatsApp Corrigida e Dinâmica
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
