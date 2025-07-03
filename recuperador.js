// ==================================================================================
//          CÓDIGO COMPLETO E FINAL (v12) - COM RESPOSTAS POR IA
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
// Armazena o link de checkout e o ID por número de telefone para a resposta padrão
const linksPorUsuario = {};

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

async function handleObjectionsAI(perguntaCliente) {
    console.log(`[IA] Recebida pergunta do cliente: "${perguntaCliente}"`);
    const prompt = `
        Você é um assistente de vendas virtual, amigável, prestativo e direto ao ponto.
        Você está vendendo um guia digital de emagrecimento chamado "Mounjaro de Pobre".
        O produto NÃO é um remédio, mas sim um e-book com receitas e um método de acompanhamento.
        O acesso é imediato por e-mail após a confirmação do pagamento e também inclui acesso a um grupo de suporte no WhatsApp.

        Use as informações abaixo para responder às perguntas dos clientes. Responda de forma curta e natural, como se estivesse em uma conversa de WhatsApp.

        --- Base de Conhecimento (Respostas para Objeções) ---

        1.  Pergunta: É golpe? É seguro?
            Resposta: Entendo totalmente sua preocupação! Pode ficar 100% tranquila. A compra é processada por uma plataforma de pagamentos segura e, assim que o pagamento é confirmado, você recebe o acesso no seu e-mail na hora. É tudo automático e seguro.

        2.  Pergunta: Funciona mesmo?
            Resposta: Sim! Centenas de alunas já estão tendo resultados incríveis. O método é baseado em receitas simples e eficazes que ajudam a acelerar o metabolismo. Se você seguir o passo a passo, é muito provável que veja resultados.

        3.  Pergunta: Como é a entrega?
            Resposta: A entrega é imediata! Assim que o pagamento for aprovado, o guia completo em PDF é enviado para o seu e-mail. Você também recebe o link para entrar no nosso grupo VIP de suporte no WhatsApp.

        4.  Pergunta: É um remédio? Precisa de receita? Tem contraindicação?
            Resposta: Ótima pergunta! Não é um remédio, viu? É um guia digital (e-book) com receitas e um método. Por ser um material 100% natural, baseado em alimentação, não precisa de receita e não tem contraindicações.

        5.  Pergunta: O que eu vou receber? É um livro?
            Resposta: Você vai receber um e-book completo em PDF direto no seu e-mail, com todas as receitas e o passo a passo do método. Além disso, ganha acesso ao nosso grupo exclusivo de alunas no WhatsApp para tirar dúvidas e ter suporte.

        6.  Pergunta: Qual o valor? É muito caro?
            Resposta: O valor é super acessível! O acesso completo está com um preço especial. Qual foi a última oferta que você recebeu? Posso ver se consigo o mesmo link de desconto pra você.

        7.  Pergunta: Demora muito pra ver resultado?
            Resposta: Muitas das nossas alunas relatam sentir diferença já na primeira semana, principalmente na disposição e desinchaço. Os resultados de perda de peso mais significativos costumam aparecer com algumas semanas de consistência. Depende muito do seu corpo e dedicação!

        8.  Pergunta: E se não funcionar pra mim? Tem garantia?
            Resposta: Sim! Sua compra é 100% segura. Você tem uma garantia de 7 dias. Se por qualquer motivo você não gostar ou não se adaptar, é só pedir o reembolso dentro desse prazo que devolvemos todo o seu dinheiro, sem perguntas. O risco é todo nosso.

        9.  Pergunta: É difícil de seguir? Tenho pouco tempo.
            Resposta: O método foi pensado justamente para quem tem uma rotina corrida! As receitas são práticas, com ingredientes fáceis de encontrar, e não exigem horas na cozinha.

        10. Pergunta: Vou ter ajuda? Tem suporte?
            Resposta: Com certeza! Além do guia completo, você terá acesso ao nosso grupo VIP de suporte no WhatsApp, onde você pode tirar dúvidas, pegar dicas e se motivar com outras alunas. Você não estará sozinha!

        11. Pergunta: Quais as formas de pagamento?
            Resposta: A plataforma aceita PIX, cartão de crédito e boleto. O acesso é mais rápido no PIX e no cartão, pois a confirmação é na hora.

        12. Pergunta: Isso parece bom demais pra ser verdade.
            Resposta: Eu entendo o ceticismo! Mas o nosso método é baseado em reeducação alimentar com receitas focadas em ingredientes de baixo custo, por isso conseguimos oferecer um valor tão acessível. O objetivo é ajudar o máximo de pessoas possível.

        13. Pergunta: Funciona para homens / para a minha idade?
            Resposta: Sim, funciona para todos! O método é baseado em princípios de nutrição e metabolismo que se aplicam a qualquer pessoa, independente de gênero ou idade, que queira perder peso de forma saudável.

        --- Fim da Base de Conhecimento ---

        Pergunta do cliente: "${perguntaCliente}"

        Sua resposta:
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 150,
        });
        const respostaAI = completion.choices[0].message.content.trim();
        console.log(`[IA] Resposta gerada: "${respostaAI}"`);
        return respostaAI;
    } catch (error) {
        console.error("❌ Erro ao chamar a API da OpenAI:", error);
        return "Desculpe, estou com uma instabilidade no meu sistema de inteligência artificial. Poderia repetir sua pergunta em um instante?";
    }
}

function setupCampaignTrigger(client) {
    client.onMessage(async (message) => {
        // Ignora mensagens de status ou de grupos
        if (message.isStatus || message.isGroupMsg) return;

        const textoLimpo = message.body.toLowerCase().trim();

        // Gatilho para campanha de Excel
        if (textoLimpo === '!iniciar-campanha') {
            enviarCampanhaExcel(client, message.from);
            return;
        }

        // Resposta padrão para interesse direto
        if (textoLimpo === 'sim' || textoLimpo === 'quero') {
            console.log(`[Resposta Padrão] Usuário ${message.from} respondeu positivamente.`);
            const linkCheckoutUsuario = linksPorUsuario[message.from];
            if (linkCheckoutUsuario) {
                const resposta = config.NOVA_RESPOSTA_PADRAO.replace('{link_checkout}', linkCheckoutUsuario.link);
                await client.sendText(message.from, resposta);
                
                // Cancela futuros agendamentos para este usuário
                if (timersRecuperacao[linkCheckoutUsuario.id]) {
                    clearTimeout(timersRecuperacao[linkCheckoutUsuario.id].timer);
                    delete timersRecuperacao[linkCheckoutUsuario.id];
                }
                delete linksPorUsuario[message.from];
            } else {
                console.log(`[Info] Usuário ${message.from} respondeu 'sim', mas não há link de checkout ativo para ele.`);
            }
            return;
        }

        // LÓGICA DE IA PARA QUEBRAR OBJEÇÕES
        // Só responde se o usuário estiver em um fluxo de recuperação ativo
        if (linksPorUsuario[message.from]) {
            // Cancela os próximos envios automáticos, pois o usuário engajou
            const { id } = linksPorUsuario[message.from];
            if (timersRecuperacao[id]) {
                clearTimeout(timersRecuperacao[id].timer);
                delete timersRecuperacao[id];
                console.log(`[Engajamento] Usuário ${message.from} interagiu. Cancelando próximos agendamentos automáticos.`);
            }

            const respostaAI = await handleObjectionsAI(message.body);
            await client.sendText(message.from, respostaAI);
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

        // ADAPTADOR INTELIGENTE
        let dadosNormalizados = {};
        if (req.body.data) {
            console.log("[Adaptador] Formato 'Cakto' detectado.");
            const caktoData = req.body.data;
            dadosNormalizados = { id: caktoData.id || caktoData.checkoutUrl, status: caktoData.status, evento: req.body.event || '', nomeCliente: caktoData.customer?.name || caktoData.customerName, telefoneCliente: caktoData.customer?.phone || caktoData.customerCellphone, linkCheckout: caktoData.checkoutUrl };
        } else if (req.body.customer?.phone_number) {
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
            dadosNormalizados = { id: kirvanoId, status: req.body.status, evento: req.body.event || '', nomeCliente: req.body.customer?.name, telefoneCliente: req.body.customer?.phone_number, linkCheckout: req.body.checkout_url };
        } else {
            console.log("[Adaptador] Formato 'Direto/Genérico' detectado.");
            dadosNormalizados = { id: req.body.checkout_id || req.body.id || req.body.transaction_id, status: req.body.status, evento: req.body.event || '', nomeCliente: req.body.customer?.name, telefoneCliente: req.body.customer?.phone, linkCheckout: req.body.checkout_url || req.body.abandoned_checkout_url };
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
            return res.status(400).send({ error: 'ID da transação ausente ou inválido.' });
        }

        const statusDeCancelamento = ['approved', 'paid', 'charge_back', 'refunded', 'canceled'];
        if (statusDeCancelamento.includes(statusLowerCase)) {
            if (timersRecuperacao[id]) {
                clearTimeout(timersRecuperacao[id].timer);
                delete timersRecuperacao[id];
            }
            const numeroWhatsApp = formatarNumero(telefoneCliente);
            if (numeroWhatsApp && linksPorUsuario[numeroWhatsApp]) {
                delete linksPorUsuario[numeroWhatsApp];
            }
            console.log(`[Agendamento Cancelado] A recuperação para ${id} foi cancelada. Status: "${statusLowerCase}".`);
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
                return res.status(200).send({ status: 'Checkout contado, sem telefone para recuperação.' });
            }
            
            const numeroWhatsApp = formatarNumero(telefoneCliente);
            if (!numeroWhatsApp) { 
                return res.status(200).send({ status: 'Número de telefone inválido.' });
            }

            linksPorUsuario[numeroWhatsApp] = { link: linkFinal, id: id };

            const delay1 = (config.NOVO_DELAY_1_MINUTOS || 10) * 60 * 1000;
            console.log(`[Agendamento 1] Mensagem 1 para ${id} agendada para daqui a ${config.NOVO_DELAY_1_MINUTOS} minutos.`);
            const timer1 = setTimeout(async () => {
                try {
                    await client.sendText(numeroWhatsApp, config.NOVA_MSG_1.replace(/{nome}/g, nomeFinal.split(' ')[0]));
                    console.log(`✅ Mensagem 1 enviada para ${id}`);

                    const delay2 = (config.NOVO_DELAY_2_MINUTOS || 20) * 60 * 1000;
                    console.log(`[Agendamento 2] Mensagem 2 para ${id} agendada para daqui a ${config.NOVO_DELAY_2_MINUTOS} minutos.`);
                    const timer2 = setTimeout(async () => {
                        try {
                            await client.sendText(numeroWhatsApp, config.NOVA_MSG_2);
                            console.log(`✅ Mensagem 2 enviada para ${id}`);

                            const delay3 = (config.NOVO_DELAY_3_MINUTOS || 60) * 60 * 1000;
                            console.log(`[Agendamento 3] Mensagem 3 para ${id} agendada para daqui a ${config.NOVO_DELAY_3_MINUTOS} minutos.`);
                            const timer3 = setTimeout(async () => {
                                try {
                                    await client.sendText(numeroWhatsApp, config.NOVA_MSG_3);
                                    console.log(`✅ Mensagem 3 enviada para ${id}`);
                                } catch (e) { 
                                    console.error(`❌ Erro ao enviar Msg 3 para ${id}:`, e);
                                } finally {
                                    delete timersRecuperacao[id];
                                    delete linksPorUsuario[numeroWhatsApp];
                                }
                            }, delay3);
                            timersRecuperacao[id] = { timer: timer3 };

                        } catch (e) {
                            console.error(`❌ Erro ao enviar Msg 2 para ${id}:`, e);
                            delete timersRecuperacao[id];
                        }
                    }, delay2);
                    timersRecuperacao[id] = { timer: timer2 };

                } catch (e) {
                    console.error(`❌ Erro ao enviar Msg 1 para ${id}:`, e);
                    delete timersRecuperacao[id];
                }
            }, delay1);
            
            timersRecuperacao[id] = { timer: timer1 };
            return res.status(200).send({ status: `Recuperação de 3 estágios agendada para ${id}.` });
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