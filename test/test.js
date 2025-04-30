const WebSocket = require("ws");
const express = require("express");
const http = require("http");

// Criar o servidor Express
const app = express();
const server = http.createServer(app);

// Criar o servidor WebSocket para os clientes
const wss = new WebSocket.Server({ server });

// Conectar ao WebSocket do servidor externo (sharkcripto.com.br)
const ws = new WebSocket("wss://sharkcripto.com.br:8090", {
  rejectUnauthorized: false, // Desabilita a verificação SSL
});

// Evento disparado quando a conexão com o WebSocket externo é estabelecida
ws.on("open", () => {
  console.log("Conectado ao WebSocket externo");
  // Enviar uma mensagem de teste ao servidor externo
  ws.send("Mensagem de teste");
});

// Evento disparado quando uma mensagem é recebida do WebSocket externo
ws.on("message", (data) => {
  try {
    const jsonData = JSON.parse(data); // Assumindo que a resposta é JSON

    console.log("\n=== Dados brutos recebidos do WebSocket externo ===");
    console.log(data.toString());

    console.log("\n=== Estrutura dos dados recebidos ===");
    console.dir(jsonData, { depth: null, colors: true });

    console.log("\n=== Chaves principais do objeto recebido ===");
    console.log(Object.keys(jsonData));

    // Enviar os dados recebidos para todos os clientes WebSocket conectados ao servidor local
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(jsonData)); // Envia para o cliente conectado
      }
    });
  } catch (error) {
    console.error("Erro ao processar dados do WebSocket externo:", error);
  }
});

// Evento disparado em caso de erro no WebSocket externo
ws.on("error", (error) => {
  console.error("Erro no WebSocket externo:", error);
});

// Evento disparado quando a conexão com o WebSocket externo é fechada
ws.on("close", () => {
  console.log("Conexão WebSocket externa fechada");
});

// Configurar o servidor WebSocket para aceitar conexões de clientes locais
wss.on("connection", (socket) => {
  console.log("Cliente conectado ao servidor WebSocket local");

  // Enviar uma mensagem inicial para o cliente assim que ele se conectar
  socket.send(
    JSON.stringify({
      message: "Conexão estabelecida com o servidor WebSocket local!",
    })
  );

  // Evento para quando o cliente enviar uma mensagem
  socket.on("message", (message) => {
    console.log("Mensagem recebida do cliente:", message);
  });
});

// Iniciar o servidor Express
server.listen(8080, () => {
  console.log("Servidor rodando na porta 8080");
});
