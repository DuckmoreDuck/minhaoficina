// Configuração do Supabase com as suas credenciais
const SUPABASE_URL = "https://bwrbduzlcbfbsrrnowam.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cmJkdXpsY2JmYnNycm5vd2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NjYwMDgsImV4cCI6MjEwMTM0MjAwOH0.APLWUjOFPUFoqZ-_DMfjpFlo0xCw2W_drBjA_8EDrQw";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let veiculosLocais = [];

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
    buscarVeiculos();
    escutarAlteracoes();
    document.getElementById('data_agendamento').valueAsDate = new Date();
});

// Buscar dados iniciais
async function buscarVeiculos() {
    const { data, error } = await supabase.from('veiculos').select('*');
    if (error) console.error("Erro ao buscar dados:", error);
    else {
        veiculosLocais = data;
        renderizarPainel();
    }
}

// Atualização Automática Realtime (Multi-dispositivos)
function escutarAlteracoes() {
    supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, (payload) => {
        buscarVeiculos(); // Recarrega do banco quando houver qualquer mudança externa
    })
    .subscribe();
}

// Renderizar os Cards na Tela
function renderizarPainel() {
    const colunas = ['AGENDADO', 'ENTRADA', 'EXECUÇÃO', 'FINALIZADO', 'RETIRADO'];
    colunas.forEach(col => {
        document.querySelector(`#col-${col} .cards-container`).innerHTML = '';
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

// Funções de Arrastar e Soltar (Drag and Drop)
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev, id) { ev.dataTransfer.setData("text", id); }
async function drop(ev, novoStatus) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text");
    
    // Atualiza localmente para resposta rápida
    const veiculo = veiculosLocais.find(v => v.id === id);
    if(veiculo) veiculo.status = novoStatus;
    renderizarPainel();

    // Salva no banco de dados
    const { error } = await supabase.from('veiculos').update({ status: novoStatus }).eq('id', id);
    if (error) console.error("Erro ao atualizar status:", error);
}

// Adicionar ou Atualizar Cadastro
async function salvarVeiculo() {
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
        alert("Preencha Cliente, Telefone e Placa!");
        return;
    }

    if (id) {
        // Modo Edição
        const { error } = await supabase.from('veiculos').update(dados).eq('id', id);
        if (error) alert("Erro ao atualizar!");
    } else {
        // Novo Cadastro
        const { error } = await supabase.from('veiculos').insert([dados]);
        if (error) alert("Erro ao inserir!");
    }
    limparFormulario();
    buscarVeiculos();
}

// Carregar dados no formulário para editar
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

// Enviar Mensagem para o WhatsApp
function notificarWhatsApp(id) {
    const v = veiculosLocais.find(item => item.id === id);
    if (!v || !v.telefone) {
        alert("Número de telefone não encontrado para este cliente.");
        return;
    }

    // Limpa caracteres especiais do telefone deixando apenas números
    const numeroLimpo = v.telefone.replace(/\D/g, '');

    // Define a mensagem dinâmica dependendo do status atual
    let mensagem = `Olá ${v.cliente}! Passando para informar que o seu veículo de placa *${v.placa}* mudou de status na oficina para: *${v.status}*.`;
    
    if (v.status === 'FINALIZADO') {
        mensagem += ` 🎉 O serviço já está concluído e pronto!`;
    }

    // Cria o link do WhatsApp Web/App API
    const urlWhatsapp = `https://whatsapp.com{numeroLimpo}&text=${encodeURIComponent(mensagem)}`;
    
    // Abre em uma nova aba
    window.open(urlWhatsapp, '_blank');
}
