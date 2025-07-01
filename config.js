// config.js
const path = require("path");

module.exports = {
  // Configs Gerais
  PORT: 3000,
  

  SESSION_NAME: "recuperador-de-carrinho",
  SESSION_FOLDER_PATH: path.join(__dirname, "tokens"),

 // --- PREÇOS ATUALIZADOS ---
  PRECO_CHEIO: "29,90",
  PRECO_DOWNSELL: "19,90",

  // --- ESTRATÉGIA 1: Para quem gera PIX ou preenche dados ---
  DELAY_PRIMEIRA_RECUPERACAO_MINUTOS: 10,
  MENSAGEM_1_RECUPERACAO: "Oi, {nome}! Tudo bem? 😊\n\nNotei que você gerou um PIX para o nosso *Mounjaro de Pobre* de R$ 37,90 mas ainda não finalizou. Aconteceu alguma coisa ou ficou com alguma dúvida?",
  MENSAGEM_2_RECUPERACAO: "Muitas pessoas ficam na dúvida, mas olha só o que algumas das nossas clientes estão comentando sobre os resultados! 👇",
  CAMINHO_IMAGEM_1: "./prova01.png",
  CAMINHO_IMAGEM_2: "./prova02.png",
  DELAY_DOWNSELL_MINUTOS_APOS_RECUPERACAO: 20,
  MENSAGEM_DOWNSELL_ESTAGIO_2: "Oi, {nome}! Vi que você continuou com o desejo de mudar, mas algo te impediu. Não quero que o valor seja um impedimento.\n\nLiberei um link *exclusivo* para você ter acesso a TUDO, de R$ 37,90 por **apenas R$ 17,90**.\n\nPegue seu acesso com desconto aqui:\n👉 {link_downsell}",

  // --- ESTRATÉGIA 2: Para quem SÓ visita o checkout ---
  DELAY_CHECKOUT_ABANDONMENT_MINUTOS: 8,
  MENSAGEM_CHECKOUT_ABANDONMENT: "ESPERE! NÃO SAIA AINDA! 🏃‍♀️\n\nVocê está a um clique de distância de descobrir o método que fez Sara secar 18 quilos. Eu sei que você quer essa transformação, então não vou deixar que o preço seja um problema.\n\nSó para você, que chegou até aqui, liberei um cupom de desconto final.\n\nO acesso completo ao método \"Mounjaro de Pobre\"...\n\nDe ~R$ 37,90~\n*POR APENAS R$ 17,90!*\n\nEste é o menor preço que você verá. Se fechar esta página, essa oferta desaparecerá para sempre!\n\nVocê vai mesmo trocar a chance de transformar seu corpo por menos do que o preço de um lanche?\n\n👉 {link_downsell}",

  // --- LINKS ---
  LINK_DOWNSELL: "https://pay.kirvano.com/396f5922-2bb3-4bc0-9e60-5df60594f964",
  LINK_PRINCIPAL: "https://pay.kirvano.com/5a90fdac-7afd-47c8-9d3b-1bc935581542",

  CAMINHO_EXCEL: './contatos.xlsx', // Coloque o caminho para o seu arquivo Excel aqui
    NOME_PLANILHA: 'Contatos',  
   MENSAGEM_CAMPANHA: `🚨 ÚLTIMA CHANCE! 🚨
Oi {nome}! Seu "Mounjaro de Pobre" te esperando no carrinho!
De R$29,90 por **APENAS R$19,90!** 🤩
Não perca essa oportunidade de emagrecer fácil e barato.
🏃‍♀️ Corre: https://pay.cakto.com.br/3ftb3ha`,

  // Config da Mensagem Motivacional
  MOTIVATIONAL_GROUP_ID: "120363400501321065@g.us",
};