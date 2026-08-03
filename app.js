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

// Renderizar os Cards na Tela nas colunas corretas
function renderizarPainel() {
    const colunas = ['AGENDADO', 'ENTRADA', 'EXECUÇÃO', 'FINALIZADO', 'RETIRADO'];
    colunas.forEach(col => {
        const container = document.querySelector(`#col-${col} .cards-container`);
        if (container) container.innerHTML = '';
    });

    veiculosLocais.forEach(v => {
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
                <div class="actions">
                    <button class="btn-edit" onclick="carregarParaEdicao('${v.id}')">Editar</button>
                    <button class="btn-whatsapp" onclick="notificarWhatsApp('${v.id}')">📱 Notificar</button>
                </div>
            `;
            container.appendChild(card);
        }
    });
}

// Funções para Arrastar e Soltar (Drag and Drop)
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev, id) { ev.dataTransfer.setData("text", id); }
function drop(ev, novoStatus) {
    ev.preventDefault();
    const id = ev.dataTransfer.setData("text");
    
    // Atualização visual rápida na tela
    const veiculo = veiculosLocais.find(v => v.id === id);
    if(veiculo) {
        veiculo.status = novoStatus;
        salvarNoLocalStorage();
        renderizarPainel();
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
        // Atualizar veículo existente
        const index = veiculosLocais.findIndex(item => item.id === id);
        if (index !== -1) {
            dados.id = id;
            veiculosLocais[index] = dados;
        }
    } else {
        // Inserir novo veículo gerando um ID único local
        dados.id = 'id_' + Math.random().toString(36).substr(2, 9);
        veiculosLocais.push(dados);
    }
    
    salvarNoLocalStorage();
    limparFormulario();
    buscarVeiculos();
}

// Preencher formulário para editar os dados cadastrais
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

// Disparar notificação para o WhatsApp do cliente (CORRIGIDO)
function notificarWhatsApp(id) {
    const v = veiculosLocais.find(item => item.id === id);
    if (!v || !v.telefone) {
        alert("Número de telefone não cadastrado para este cliente.");
        return;
    }

    const numeroLimpo = v.telefone.replace(/\D/g, '');
    
    // CORREÇÃO: Padronizado para usar apenas a variável 'textoMensagem'
    let textoMensagem = `Olá ${v.cliente}! Informamos que o veículo de placa *${v.placa}* avançou para o status: *${v.status}* na nossa oficina.`;
    
    if (v.status === 'FINALIZADO') {
        textoMensagem += ` 🎉 O serviço foi concluído com sucesso e já está pronto para retirada!`;
    }

    // Criando a URL limpa e válida usando a API padrão do WhatsApp
    const urlWhatsapp = "https://whatsapp.com" + numeroLimpo + "&text=" + encodeURIComponent(textoMensagem);
    
    // Abre a aba do WhatsApp
    window.open(urlWhatsapp, '_blank');
}

