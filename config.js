// config.js - VERSÃO ATUALIZADA

const path = require("path");

module.exports = {
  // Configs Gerais
  PORT: 3000,

  SESSION_NAME: "recuperador-de-carrinho",
  SESSION_FOLDER_PATH: path.join(__dirname, "tokens"),

  // --- NOVA ESTRATÉGIA DE RECUPERAÇÃO ---
  NOVO_DELAY_1_MINUTOS: 10,
  NOVA_MSG_1: `Oiê, {nome}! Tudo bem? Meu nome é Malu, vi que você gerou seu acesso do Mounjaro de Pobre, mas não finalizou 😢

Reservei sua vaga por alguns minutos…

Quer que eu te ajude a garantir com o bônus?`,

  NOVO_DELAY_2_MINUTOS: 20, // 20 minutos APÓS a mensagem 1
  NOVA_MSG_2: `O sistema tá liberando sua vaga pra outra pessoa…

Quer garantir agora e ainda receber o material de apoio no zap?`,
  
  NOVO_DELAY_3_MINUTOS: 60, // 60 minutos (1 hora) APÓS a mensagem 2
  NOVA_MSG_3: `Essa é a última mensagem, tá? A plataforma libera só por 24h…

Depois o conteúdo sai do ar. Se ainda quiser, só me responde aqui que eu te ajudo 💚`,

  // Resposta padrão para quem interage positivamente
  NOVA_RESPOSTA_PADRAO: `Perfeito! É só clicar aqui e finalizar o pagamento agora:

👉 {link_checkout}

Assim que confirmar, já recebo seu acesso por aqui mesmo 🥰`,

  // --- LINKS PRINCIPAIS ---
  LINK_PRINCIPAL: "https://pay.kirvano.com/5a90fdac-7afd-47c8-9d3b-1bc935581542",

  // --- Campanha de Excel (se ainda for usar) ---
  CAMINHO_EXCEL: './contatos.xlsx',
  NOME_PLANILHA: 'Contatos',
  MENSAGEM_CAMPANHA: `🚨 ÚLTIMA CHANCE! 🚨
Oi {nome}! Seu "Mounjaro de Pobre" te esperando no carrinho!
De R$29,90 por **APENAS R$17,90!** 🤩
🏃‍♀️ Corre: https://pay.kirvano.com/396f5922-2bb3-4bc0-9e60-5df60594f964`,

  // --- Mensagem Motivacional Diária ---
  MOTIVATIONAL_GROUP_ID: "203634005013210615@g.us",
};