// bot.js

const express = require('express');
const bodyParser = require('body-parser');
const venom = require('venom-bot');
const { OpenAI } = require('openai');
const schedule = require('node-schedule');
const config = require('./config.js');
const fs = require('fs').promises;
const path = require('path');

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
const timersRecuperacao = {};

// Garante que a pasta de sessão exista
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

function setupWebhookServer(client) {
    const app = express();
    app.use(bodyParser.json());

    app.post('/webhook/abandono', async (req, res) => {
        console.log('\n[Webhook Recebido] Nova notificação recebida.');
        console.log('[Payload Completo]:', JSON.stringify(req.body, null, 2));
        
        const dados = req.body.data || req.body; 
        const evento = req.body.event || '';
        const status = dados.status;
        const transactionId = dados.id;

        if (!transactionId) {
            return res.status(400).send({ error: 'ID da transação ausente.' });
        }

        if (status === 'paid' || status === 'approved') {
            if (timersRecuperacao[transactionId]) {
                clearTimeout(timersRecuperacao[transactionId]);
                delete timersRecuperacao[transactionId];
                console.log(`[Agendamento Cancelado] Recuperação para a transação ${transactionId} foi cancelada com sucesso.`);
            }
            return res.status(200).send({ status: 'Pagamento confirmado.' });
        }
        
        if (evento.includes('pix_gerado') || status === 'waiting_payment' || evento.includes('abandoned')) {
            if (timersRecuperacao[transactionId]) {
                return res.status(200).send({ status: 'Timer de recuperação já ativo.' });
            }

            const nomeCliente = dados.customer?.name;
            const telefoneCliente = dados.customer?.phone;
            let linkCheckout = dados.checkoutUrl || config.LINK_CHECKOUT_FALLBACK;
            if (linkCheckout.includes('?')) {
                linkCheckout = linkCheckout.split('?')[0];
            }

            if (!nomeCliente || !telefoneCliente || !linkCheckout) {
                return res.status(400).send({ error: 'Dados insuficientes para agendamento.' });
            }
            
            const delayPrimeiraRecuperacao = config.DELAY_PRIMEIRA_RECUPERACAO_MINUTOS * 60 * 1000;
            console.log(`[Agendamento 1] Sequência para ${nomeCliente} agendada para daqui a ${config.DELAY_PRIMEIRA_RECUPERACAO_MINUTOS} minutos.`);

            const timerId_1 = setTimeout(async () => {
                try {
                    console.log(`\n[Envio 1] TEMPO ESGOTADO! Enviando primeira sequência para ${nomeCliente}.`);
                    const numeroWhatsApp = formatarNumero(telefoneCliente);
                    if (!numeroWhatsApp) { delete timersRecuperacao[transactionId]; return; }
                    
                    await client.sendText(numeroWhatsApp, config.MENSAGEM_1_RECUPERACAO.replace(/{nome}/g, nomeCliente.split(' ')[0]));
                    await delay(2000);
                    await client.sendText(numeroWhatsApp, config.MENSAGEM_2_RECUPERACAO);
                    await delay(2500);
                    await client.sendImage(numeroWhatsApp, config.CAMINHO_IMAGEM_1, 'comentario-1.jpg', '');
                    await delay(2000);
                    await client.sendImage(numeroWhatsApp, config.CAMINHO_IMAGEM_2, 'comentario-2.png', '');
                    await delay(3000);
                    await client.sendText(numeroWhatsApp, `Se quiser finalizar sua compra com segurança, o link é este aqui:\n\n👉 ${linkCheckout}`);
                    console.log(`✅ Primeira sequência enviada para ${nomeCliente}!`);
                    
                    const delaySegundaRecuperacao = config.DELAY_DOWNSELL_MINUTOS_APOS_RECUPERACAO * 60 * 1000;
                    console.log(`[Agendamento 2] Downsell para ${nomeCliente} agendado para daqui a ${config.DELAY_DOWNSELL_MINUTOS_APOS_RECUPERACAO} minutos.`);
                    
                    const timerId_2 = setTimeout(async () => {
                        try {
                            const mensagemDownsell = config.MENSAGEM_DOWNSELL.replace(/{nome}/g, nomeCliente.split(' ')[0]).replace(/{link_downsell}/g, config.LINK_DOWNSELL);
                            await client.sendText(numeroWhatsApp, mensagemDownsell);
                            console.log(`✅ Mensagem de downsell enviada para ${nomeCliente}!`);
                        } catch (error) { console.error(`❌ Erro ao enviar downsell:`, error);
                        } finally { delete timersRecuperacao[transactionId]; }
                    }, delaySegundaRecuperacao);

                    timersRecuperacao[transactionId] = timerId_2;

                } catch (error) {
                    console.error(`❌ Erro ao enviar a primeira sequência:`, error);
                    delete timersRecuperacao[transactionId];
                }
            }, delayPrimeiraRecuperacao);
            timersRecuperacao[transactionId] = timerId_1;
            return res.status(200).send({ status: `Recuperação de 2 estágios agendada.` });
        }
        res.status(200).send({ status: `Evento '${evento}' ignorado.` });
    });

    app.listen(config.PORT, () => {
        console.log(`🚀 Servidor de webhooks rodando na porta ${config.PORT}`);
        console.log(`Aguardando notificações em http://localhost:${config.PORT}/webhook/abandono`);
    });
}

function setupDailyScheduler(client) {
    console.log(`[Agendador] Mensagem motivacional diária configurada para as 07:00.`);
    schedule.scheduleJob('0 7 * * *', async () => {
        console.log(`\n[Agendador] EXECUTANDO! Enviando mensagem motivacional... [${new Date().toLocaleTimeString('pt-BR')}]`);
        try {
            if (!config.MOTIVATIONAL_GROUP_ID || !config.MOTIVATIONAL_GROUP_ID.includes('@g.us')) {
                console.warn('[Agendador] ID do grupo não configurado corretamente. Pulando envio.');
                return;
            }
            const prompt = "Crie uma frase motivacional curta, poderosa e inspiradora sobre emagrecimento e superação. O tom deve ser positivo, como uma amiga dando força para começar o dia.";
            
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.9,
            });
            const motivationalMessage = completion.choices[0].message.content;
            await client.sendText(config.MOTIVATIONAL_GROUP_ID, motivationalMessage);
            console.log(`✅ Mensagem motivacional enviada para o grupo!`);
        } catch (error) {
            console.error("❌ Erro ao enviar mensagem motivacional:", error);
        }
    });
}

async function start(client) {
    // Inicia os diferentes módulos do bot
    setupWebhookServer(client);
    setupDailyScheduler(client);
    
    // Este bot não responderá a mensagens diretas, apenas aos webhooks e ao agendador.
    // O client.onMessage foi removido para focar nas tarefas automatizadas.

    console.log('✅ Bot Multifuncional (Recuperador + Agendador) está pronto e operando!');
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