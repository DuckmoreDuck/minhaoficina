// 🔗 COLE O SEU LINK DO GOOGLE APPS SCRIPT AQUI ENTRE AS ASPAS:
const GOOGLE_SCRIPT_URL = "SUA_URL_DO_APPS_SCRIPT_AQUI";

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

    // Inicia o painel diretamente e começa a puxar os dados da planilha
    exibirPainel();
});

// 🟢 AUTENTICAÇÃO E SESSÃO (Simplicada para acesso direto ao painel)
function fazerLogin() {
    exibirPainel();
}

function fazerLogout() {
    if (intervaloAtualizacao) clearInterval(intervaloAtualizacao);
    window.location.reload();
}

function exibirPainel(user = null) {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');
    const userDisplay = document.getElementById('user-display');

    if (loginScreen) loginScreen.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
    
    if (userDisplay) {
        userDisplay.innerText = `👤 Painel da Oficina (Planilha Online)`;
    }
    
    // Busca inicial dos dados
    buscarVeiculos();

    // 🔄 ATUALIZAÇÃO AUTOMÁTICA: Busca novos dados da planilha a cada 15 segundos
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

    atualizarStatusLocal(id, novoStatus);
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

// 🟢 BUSCA DE DADOS NA PLANILHA GOOGLE
async function buscarVeiculos() {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("SUA_URL_DO_APPS_SCRIPT_AQUI")) {
        console.warn("URL do Google Apps Script não configurada no app.js");
        return;
    }

    try {
        const resposta = await fetch(GOOGLE_SCRIPT_URL);
        const dadosPlanilha = await resposta.json();

        // Mapeia e padroniza as colunas da planilha do Google para o formato do sistema
        veiculosLocais = dadosPlanilha.map((item, index) => {
            // Mapeamento de status da planilha (ex: "FINALIZADO", "EXECUÇÃO")
            let statusTratado = (item['Status / Finalizado'] || item['Status'] || item['STATUS'] || 'AGENDADO').toString().toUpperCase().trim();
            if (!['AGENDADO', 'ENTRADA', 'EXECUÇÃO', 'FINALIZADO', 'RETIRADO'].includes(statusTratado)) {
                statusTratado = 'AGENDADO';
            }

            // Junta relatos/observações da planilha se houver
            let obsText = item['Relato do Cliente'] || item['Observações'] || '';
            if (item['Luz no Painel']) {
                obsText = `[Painel: ${item['Luz no Painel']}] ` + obsText;
            }

            return {
                id: String(item['Placa'] || index),
                placa: (item['Placa'] || '').toString().trim(),
                cliente: (item['Nome do Cliente'] || item['Cliente'] || '').toString().trim(),
                os_or: item['OS'] || item['OR'] || item['OS/OR'] || '',
                mecanico: item['Mecânico'] || item['MECANICO'] || '',
                alinhador: item['Alinhador'] || '',
                tipo_veiculo: item['Tipo'] || 'CARRO',
                status: statusTratado,
                observacoes: obsText,
                telefone: item['Telefone'] || '',
                data_agendamento: item['Data'] || getHojeLocal()
            };
        });

        renderizarPainel();
    } catch (err) {
        console.error("Erro ao buscar dados da planilha:", err);
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

            // 🏷️ Tag de Tipo de Veículo
            let tipoVeiculoHtml = '';
            if (v.tipo_veiculo === 'VAN') {
                tipoVeiculoHtml = `<span style="background:#e0f7fa; color:#006064; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">🚐 Van</span>`;
            } else {
                tipoVeiculoHtml = `<span style="background:#eceff1; color:#37474f; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:4px;">🚗 Carro</span>`;
            }

            const containerTags = tipoVeiculoHtml ? `<div style="margin: 6px 0;">${tipoVeiculoHtml}</div>` : '';
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
                    <select onchange="atualizarStatusLocal('${v.id}', this.value)">
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
                    atualizarStatusLocal(id, novoStatus);
                }
            }
        }
    }, { passive: true });
}

function atualizarStatusLocal(id, novoStatus) {
    const v = veiculosLocais.find(item => item.id === id);
    if (v) {
        v.status = novoStatus;
        v.updated_at = new Date().toISOString();
        renderizarPainel();
    }
}

function buscarPorPlaca(placaDigitada) {
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

    document.getElementById('form-title').innerText = "Editar Cadastro do Veículo";
    document.getElementById('btn-salvar').innerText = "Salvar Alterações";
    document.getElementById('btn-cancelar').style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    document.getElementById('form-title').innerText = "Cadastrar Novo Veículo";
    document.getElementById('btn-salvar').innerText = "Adicionar Veículo";
    document.getElementById('btn-cancelar').style.display = "none";
}

function notificarWhatsApp(id) {
    const v = veiculosLocais.find(item => item.id === id);
    if (!v || !v.telefone) {
        alert("Número de telefone não cadastrado na planilha.");
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
window.atualizarStatusLocal = atualizarStatusLocal;
window.buscarPorPlaca = buscarPorPlaca;
window.carregarParaEdicao = carregarParaEdicao;
window.limparFormulario = limparFormulario;
window.notificarWhatsApp = notificarWhatsApp;
window.renderizarPainel = renderizarPainel;
