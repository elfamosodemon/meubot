// ==================================================================================
//          CÓDIGO COMPLETO E FINAL (v9) - CORREÇÃO DO ID "NULL" DA KIRVANO
// ==================================================================================

const express = require('express');
const bodyParser = require('body-parser');
const venom = require('venom-bot');
const { OpenAI } = require('openai');
const schedule = require('node-schedule');
const config = require('./config.js');
const fs = require('fs').promises;
const path = require('path');
const xlsx = require('xlsx');

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
const timersRecuperacao = {};
let campanhaJaIniciada = false;
let checkoutsIniciadosHoje = 0;
let checkoutsContadosHoje = new Set(); 

(async () => {
    try {
        if (!config.SESSION_FOLDER_PATH) {
            console.error("ERRO: SESSION_FOLDER_PATH não está definido no config.js.");
            process.exit(1);
        }
        await fs.access(config.SESSION_FOLDER_PATH);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(config.SESSION_FOLDER_PATH, { recursive: true });
        } else {
            console.error('Erro ao verificar/criar pasta de sessão:', error);
        }
    }
})();

function formatarNumero(numero) {
    if (!numero) return null;
    let numeroLimpo = String(numero).replace(/\D/g, '');
    if (numeroLimpo.length < 12 && !numeroLimpo.startsWith('55')) {
        numeroLimpo = '55' + numeroLimpo;
    }
    if (numeroLimpo.length === 12) {
        const ddd = numeroLimpo.substring(2, 4);
        if (parseInt(ddd, 10) >= 11) {
            numeroLimpo = `${numeroLimpo.substring(0, 4)}9${numeroLimpo.substring(4)}`;
        }
    }
    return numeroLimpo.length === 13 ? `${numeroLimpo}@c.us` : null;
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function getDelayAleatorio() {
    const min = config.DELAY_MINIMO_MS || 5000;
    const max = config.DELAY_MAXIMO_MS || 15000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function enviarCampanhaExcel(client, remetente) {
    if (campanhaJaIniciada) {
        await client.sendText(remetente, 'A campanha para a lista do Excel já foi iniciada ou concluída nesta sessão.');
        return;
    }
    console.log('\n[Campanha Excel] Comando recebido! Iniciando processo de envio em massa.');
    campanhaJaIniciada = true;
    try {
        const workbook = xlsx.readFile(config.CAMINHO_EXCEL);
        const sheetName = config.NOME_PLANILHA || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            await client.sendText(remetente, `ERRO: A planilha "${sheetName}" não foi encontrada no arquivo Excel.`);
            return;
        }
        const contatos = xlsx.utils.sheet_to_json(worksheet);
        await client.sendText(remetente, `✅ Campanha iniciada! Enviando para ${contatos.length} contatos.`);
        for (const [index, contato] of contatos.entries()) {
            const nome = contato.nome;
            const telefone = contato.telefone;
            if (!nome || !telefone) continue;
            const numeroWhatsApp = formatarNumero(telefone);
            if (numeroWhatsApp) {
                const primeiroNome = nome.split(' ')[0];
                const mensagem = config.MENSAGEM_CAMPANHA.replace(/{nome}/g, primeiroNome);
                try {
                    await client.sendText(numeroWhatsApp, mensagem);
                    console.log(`(${index + 1}/${contatos.length}) Mensagem enviada para ${nome}`);
                } catch (error) {
                    console.error(`(${index + 1}/${contatos.length}) FALHA ao enviar para ${nome}:`, error.text || error.message);
                }
                const tempoDeEspera = getDelayAleatorio();
                console.log(`   └─ Pausando por ${Math.round(tempoDeEspera / 1000)} segundos...`);
                await delay(tempoDeEspera);
            }
        }
        await client.sendText(remetente, '🚀 Campanha finalizada! Todos os contatos da lista foram processados.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            await client.sendText(remetente, `ERRO: Não encontrei o arquivo Excel em "${config.CAMINHO_EXCEL}".`);
        } else {
            await client.sendText(remetente, 'Ocorreu um erro crítico ao processar a campanha. Veja o terminal para mais detalhes.');
        }
    }
}

function setupCampaignTrigger(client) {
    client.onMessage(async (message) => {
        if (message.body === '!iniciar-campanha' && message.isGroupMsg === false) {
            enviarCampanhaExcel(client, message.from);
        }
    });
}

function setupWebhookServer(client) {
    const app = express();
    app.use(bodyParser.json());

    app.use((req, res, next) => {
        console.log('\n\n======================================================');
        console.log('>>> NOVA REQUISIÇÃO DETECTADA PELO ESPIÃO <<<');
        console.log(`> Horário: ${new Date().toISOString()}`);
        console.log(`> Método HTTP: ${req.method}`);
        console.log(`> Caminho (URL): ${req.originalUrl}`);
        console.log('> Cabeçalhos (Headers):');
        console.log(JSON.stringify(req.headers, null, 2));
        console.log('======================================================\n');
        next();
    });
    
    app.get('/teste-conexao', (req, res) => {
        console.log('\n✅✅✅ CONEXÃO RECEBIDA COM SUCESSO! A rota /teste-conexao foi acessada. ✅✅✅\n');
        res.status(200).send('<h1>Parabens! A conexao com o bot esta funcionando!</h1>');
    });

    app.post('/webhook/abandono', async (req, res) => {
        console.log('\n[ROTA /webhook/abandono] O corpo da requisição é:');
        console.log(JSON.stringify(req.body, null, 2));

        // ADAPTADOR INTELIGENTE (v3)
        let dadosNormalizados = {};
        if (req.body.data) {
            // Formato Cakto
            console.log("[Adaptador] Formato 'Cakto' detectado.");
            const caktoData = req.body.data;
            dadosNormalizados = {
                id: caktoData.id || caktoData.checkoutUrl,
                status: caktoData.status,
                evento: req.body.event || '',
                nomeCliente: caktoData.customer?.name || caktoData.customerName,
                telefoneCliente: caktoData.customer?.phone || caktoData.customerCellphone,
                linkCheckout: caktoData.checkoutUrl,
            };
        } else if (req.body.customer?.phone_number) {
            // Formato Kirvano
            console.log("[Adaptador] Formato 'Kirvano' detectado.");
            
            let kirvanoId = req.body.checkout_id || req.body.sale_id;
            if (!kirvanoId || kirvanoId === 'null') {
                if (req.body.checkout_url && req.body.checkout_url.includes('/')) {
                    const urlParts = req.body.checkout_url.split('/');
                    const potentialId = urlParts[urlParts.length - 1];
                    if (potentialId) {
                        kirvanoId = potentialId;
                        console.log(`[Adaptador] ID principal é nulo. Usando ID da checkout_url: ${kirvanoId}`);
                    }
                }
            }

            dadosNormalizados = {
                id: kirvanoId,
                status: req.body.status,
                evento: req.body.event || '',
                nomeCliente: req.body.customer?.name,
                telefoneCliente: req.body.customer?.phone_number,
                linkCheckout: req.body.checkout_url,
            };
        } else {
            // Formato Direto/Genérico
            console.log("[Adaptador] Formato 'Direto/Genérico' detectado.");
            dadosNormalizados = {
                id: req.body.checkout_id || req.body.id || req.body.transaction_id,
                status: req.body.status,
                evento: req.body.event || '',
                nomeCliente: req.body.customer?.name,
                telefoneCliente: req.body.customer?.phone,
                linkCheckout: req.body.checkout_url || req.body.abandoned_checkout_url,
            };
        }
        
        const statusLowerCase = dadosNormalizados.status ? String(dadosNormalizados.status).toLowerCase() : '';
        const { id, evento, nomeCliente, telefoneCliente, linkCheckout } = dadosNormalizados;
        
        console.log(`> Processando notificação para o ID [${id || 'ID ausente'}] com status [${dadosNormalizados.status || 'Status ausente'}].`);

        if (id && id !== 'null' && !checkoutsContadosHoje.has(id)) {
            checkoutsContadosHoje.add(id);
            checkoutsIniciadosHoje++;
            
            console.log('--------------------------------------------------');
            console.log('🚀 [NOVO CHECKOUT INICIADO DETECTADO] 🚀');
            console.log(`> ID da Transação: ${id}`);
            console.log(`> Total de checkouts iniciados hoje: ${checkoutsIniciadosHoje}`);
            console.log('--------------------------------------------------');
        }

        if (!id || id === 'null') {
            console.error('[Erro Webhook] Nenhum ID válido foi encontrado no webhook após todas as verificações.');
            return res.status(400).send({ error: 'ID da transação ausente ou inválido.' });
        }

        const statusDeCancelamento = ['approved', 'paid', 'charge_back', 'refunded', 'canceled'];
        if (statusDeCancelamento.includes(statusLowerCase)) {
            if (timersRecuperacao[id]) {
                clearTimeout(timersRecuperacao[id]);
                delete timersRecuperacao[id];
                console.log(`[Agendamento Cancelado] A recuperação para ${id} foi cancelada. Status: "${statusLowerCase}".`);
            } else {
                console.log(`[Info] Recebido status "${statusLowerCase}" para ${id}, mas não havia recuperação em andamento.`);
            }
            return res.status(200).send({ status: 'Evento de cancelamento processado.' });
        }
        
        const statusDeRecuperacao = ['abandoned_cart', 'pending', 'waiting_payment'];
        if (statusDeRecuperacao.includes(statusLowerCase) || evento.includes('pix_gerado') || evento.includes('abandoned')) {
            if (timersRecuperacao[id]) {
                console.log(`[Info] Timer de recuperação para ${id} já está ativo.`);
                return res.status(200).send({ status: 'Timer de recuperação já ativo.' });
            }

            const nomeFinal = nomeCliente || 'guerreira(o)';
            const linkFinal = linkCheckout || config.LINK_PRINCIPAL;

            if (!telefoneCliente) {
                console.log(`[Info] Checkout ${id} contado, mas sem telefone. Recuperação não agendada.`);
                return res.status(200).send({ status: 'Checkout contado, sem telefone para recuperação.' });
            }
            
            const numeroWhatsApp = formatarNumero(telefoneCliente);
            if (!numeroWhatsApp) { 
                console.log(`[Info] Número de telefone "${telefoneCliente}" de ${id} é inválido.`);
                return res.status(200).send({ status: 'Número de telefone inválido.' });
            }

            const delayPrimeiraRecuperacao = config.DELAY_PRIMEIRA_RECUPERACAO_MINUTOS * 60 * 1000;
            console.log(`[Agendamento] Recuperação para ${id} de ${nomeFinal} agendada para daqui a ${config.DELAY_PRIMEIRA_RECUPERACAO_MINUTOS} minutos.`);

            const timerId_1 = setTimeout(async () => {
                try {
                    console.log(`\n[Envio 1] Enviando 1ª sequência para ${nomeFinal} (ID: ${id}).`);
                    await client.sendText(numeroWhatsApp, config.MENSAGEM_1_RECUPERACAO.replace(/{nome}/g, nomeFinal.split(' ')[0]));
                    await delay(2000);
                    await client.sendText(numeroWhatsApp, config.MENSAGEM_2_RECUPERACAO);
                    await delay(2500);
                    await client.sendImage(numeroWhatsApp, config.CAMINHO_IMAGEM_1, 'comentario-1.jpg', '');
                    await delay(2000);
                    await client.sendImage(numeroWhatsApp, config.CAMINHO_IMAGEM_2, 'comentario-2.png', '');
                    await delay(3000);
                    await client.sendText(numeroWhatsApp, `Se quiser finalizar sua compra com segurança, o link é este aqui:\n\n👉 ${linkFinal}`);
                    console.log(`✅ 1ª sequência enviada para ${nomeFinal}!`);
                    
                    const delaySegundaRecuperacao = config.DELAY_DOWNSELL_MINUTOS_APOS_RECUPERACAO * 60 * 1000;
                    console.log(`[Agendamento] Downsell para ${nomeFinal} agendado para daqui a ${config.DELAY_DOWNSELL_MINUTOS_APOS_RECUPERACAO} minutos.`);
                    
                    const timerId_2 = setTimeout(async () => {
                        try {
                            const mensagemDownsell = config.MENSAGEM_DOWNSELL_ESTAGIO_2.replace(/{nome}/g, nomeFinal.split(' ')[0]).replace(/{link_downsell}/g, config.LINK_DOWNSELL);
                            await client.sendText(numeroWhatsApp, mensagemDownsell);
                            console.log(`✅ Mensagem de downsell enviada para ${nomeFinal}!`);
                        } catch (error) { 
                            console.error(`❌ Erro ao enviar downsell para ${id}:`, error);
                        } finally { 
                            delete timersRecuperacao[id]; 
                        }
                    }, delaySegundaRecuperacao);
                    
                    timersRecuperacao[id] = timerId_2;
                } catch (error) {
                    console.error(`❌ Erro ao enviar a 1ª sequência para ${id}:`, error);
                    delete timersRecuperacao[id];
                }
            }, delayPrimeiraRecuperacao);

            timersRecuperacao[id] = timerId_1;
            return res.status(200).send({ status: `Recuperação agendada para ${id}.` });
        }
        
        console.log(`[Info] Evento com status '${dadosNormalizados.status}' para ${id} recebido e ignorado.`);
        res.status(200).send({ status: `Evento '${dadosNormalizados.status}' recebido e ignorado.` });
    });

    app.listen(config.PORT, () => {
        console.log(`🚀 Servidor de webhooks rodando na porta ${config.PORT}`);
    });
}

function setupDailyScheduler(client) {
    console.log(`[Agendador] Mensagem motivacional diária configurada para as 07:00.`);
    schedule.scheduleJob('0 7 * * *', async () => {
        try {
            if (!config.MOTIVATIONAL_GROUP_ID || !config.MOTIVATIONAL_GROUP_ID.includes('@g.us')) {
                return;
            }
            const prompt = "Crie uma frase motivacional curta e poderosa sobre emagrecimento...";
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.9,
            });
            await client.sendText(config.MOTIVATIONAL_GROUP_ID, completion.choices[0].message.content);
        } catch (error) {
            console.error("❌ Erro ao enviar mensagem motivacional:", error);
        }
    });
}

function setupDailyCounterReset() {
    console.log('[Agendador] Reset diário da contagem de checkouts configurado para meia-noite.');
    schedule.scheduleJob('0 0 * * *', () => {
        console.log('--------------------------------------------------');
        console.log('🌙 [CONTADOR ZERADO] Meia-noite! Zerando a contagem de checkouts do dia.');
        console.log(`> Total de checkouts no dia anterior: ${checkoutsIniciadosHoje}`);
        checkoutsIniciadosHoje = 0;
        checkoutsContadosHoje.clear();
        console.log('--------------------------------------------------');
    });
}

function start(client) {
    setupWebhookServer(client);
    setupDailyScheduler(client);
    setupCampaignTrigger(client); 
    setupDailyCounterReset();
    
    console.log('✅ Bot Multifuncional está pronto e operando!');
    console.log('🤫 Aguardando comando "!iniciar-campanha" para começar os envios da lista...');
}

console.log('Iniciando Bot Multifuncional...');
venom.create({
    session: config.SESSION_NAME,
    headless: 'new',
    executablePath: config.CHROME_EXECUTABLE_PATH,
    tokenStore: {
        type: 'file',
        config: { sessionPath: config.SESSION_FOLDER_PATH, fileName: config.SESSION_NAME }
    },
    catchQR: (base64Qr, asciiQR, attempts) => {
        console.log(`--- TENTATIVA NÚMERO ${attempts} ---\n`, asciiQR);
    },
    statusFind: (statusSession, session) => {
        console.log('Status da Sessão:', statusSession);
        if (statusSession === 'isLogged' || statusSession === 'inChat') {
            console.log('✅ Login automático realizado com sucesso!');
        }
    }
})
.then(start)
.catch((error) => {
    console.error('Erro CRÍTICO ao criar cliente Venom:', error);
});