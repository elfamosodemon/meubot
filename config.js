// config.js
const path = require('path');

module.exports = {
  // Porta em que o servidor de webhook irá rodar
  PORT: 3000, 
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  // Nome da sessão do WhatsApp
  SESSION_NAME: 'recuperador-de-carrinho',
  SESSION_FOLDER_PATH: path.join(__dirname, 'tokens'),
    // Caminho para a pasta onde os tokens serão salvos
  SESSION_FOLDER_PATH: path.join(__dirname, 'tokens'),

  // Tempo em minutos para esperar antes de enviar a mensagem após o abandono
  DELAY_EM_MINUTOS: 10,

  // --- MENSAGENS E ARQUIVOS ---
  MENSAGEM_1: "Oi, {nome}! Tudo bem? 😊\n\nNotei que você gerou um PIX para o nosso *Mounjaro de Pobre* mas ainda não finalizou. Aconteceu alguma coisa ou ficou com alguma dúvida?",
  MENSAGEM_2: "Muitas pessoas ficam na dúvida, mas olha só o que algumas das nossas clientes estão comentando sobre os resultados! 👇",
  CAMINHO_IMAGEM_1: './prova01.png', // Coloque o nome exato do seu arquivo de imagem
  CAMINHO_IMAGEM_2: './prova02.png', // Coloque o nome exato do seu arquivo de imagem
  LINK_CHECKOUT: 'https://pay.cakto.com.br/36g3gnf_385479',
  MOTIVATIONAL_GROUP_ID: '120363400501321065@g.us',

  DELAY_SEGUNDA_RECUPERACAO_HORAS: 24,
  MENSAGEM_DOWNSELL: "Oi, {nome}! Vi que você continuou com o desejo de mudar, mas algo te impediu de começar. Não quero que o valor seja um impedimento.\n\nPor isso, liberei um link *exclusivo* para você ter acesso a TUDO, de R$ 29,90 por **apenas R$ 9,90**. Esta é a minha forma de dizer: eu acredito em você.\n\nPegue seu acesso com desconto aqui:\n👉 {link_downsell}",
  LINK_DOWNSELL: 'https://pay.cakto.com.br/3ftb3ha',

  
  // Caminho do Chrome (deixe null no Windows/Linux se o Chrome/Chromium estiver instalado)
  CHROME_EXECUTABLE_PATH: null,
};