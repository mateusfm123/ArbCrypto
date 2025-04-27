const WebSocket = require("ws");
const express = require("express");
const http = require("http");

// Configurações
const PORT = process.env.PORT || 8080;
const EXTERNAL_WS_URL = "wss://sharkcripto.com.br:8090";

// Criar servidores
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Gerenciamento da conexão externa
let externalWs;
let reconnectInterval = 5000; // Começa com 5 segundos
const maxReconnectInterval = 30000; // Máximo de 30 segundos

function connectToExternal() {
  console.log(`🔗 Tentando conectar ao WebSocket externo: ${EXTERNAL_WS_URL}`);

  externalWs = new WebSocket(EXTERNAL_WS_URL, {
    rejectUnauthorized: false,
    handshakeTimeout: 10000,
  });

  externalWs.on("open", () => {
    console.log("✅ Conectado ao WebSocket externo");
    reconnectInterval = 5000; // Resetar intervalo de reconexão

    // Heartbeat para manter conexão ativa
    const heartbeatInterval = setInterval(() => {
      if (externalWs.readyState === WebSocket.OPEN) {
        externalWs.ping();
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
  });

  externalWs.on("message", (data) => {
    try {
      const message = JSON.parse(data);

      // Enviar para todos os clientes conectados
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    } catch (error) {
      console.error("Erro ao processar mensagem:", error.message);
    }
  });

  externalWs.on("error", (error) => {
    console.error("❌ Erro na conexão externa:", error.message);
  });

  externalWs.on("close", (code, reason) => {
    console.log(
      `🔌 Conexão externa fechada. Código: ${code}, Motivo: ${reason.toString()}`
    );

    // Aumentar progressivamente o intervalo de reconexão
    reconnectInterval = Math.min(reconnectInterval * 2, maxReconnectInterval);
    console.log(`⏳ Tentando reconectar em ${reconnectInterval / 1000}s...`);

    setTimeout(connectToExternal, reconnectInterval);
  });
}

// Conexão com clientes locais
wss.on("connection", (socket, req) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(`🌐 Novo cliente conectado: ${clientIp}`);

  // Enviar status atual da conexão externa
  socket.send(
    JSON.stringify({
      type: "connection_status",
      status:
        externalWs?.readyState === WebSocket.OPEN
          ? "connected"
          : "disconnected",
    })
  );

  socket.on("message", (message) => {
    // Encaminhar mensagens para o servidor externo
    if (externalWs?.readyState === WebSocket.OPEN) {
      try {
        externalWs.send(message);
      } catch (error) {
        console.error("Erro ao encaminhar mensagem:", error.message);
      }
    }
  });

  socket.on("close", () => {
    console.log(`❎ Cliente desconectado: ${clientIp}`);
  });

  socket.on("error", (error) => {
    console.error(`Erro no cliente ${clientIp}:`, error.message);
  });
});

// Middleware para logs de acesso
app.use((req, res, next) => {
  console.log(`📄 ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  const status = {
    status:
      externalWs?.readyState === WebSocket.OPEN ? "healthy" : "connecting",
    clients: wss.clients.size,
    externalWs: {
      state: externalWs?.readyState,
      readyState: getReadyStateDescription(externalWs?.readyState),
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
  };

  res.json(status);
});

function getReadyStateDescription(state) {
  switch (state) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "OPEN";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "CLOSED";
    default:
      return "UNKNOWN";
  }
}

// Rota de informações
app.get("/info", (req, res) => {
  res.json({
    description: "WebSocket Proxy Server",
    endpoints: {
      websocket: `ws://localhost:${PORT}`,
      health: `http://localhost:${PORT}/health`,
    },
    externalConnection: EXTERNAL_WS_URL,
  });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error("❌ Erro:", err.stack);
  res.status(500).json({ error: "Algo deu errado!" });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔗 WebSocket local: ws://localhost:${PORT}`);
  console.log(`📊 Endpoint de saúde: http://localhost:${PORT}/health`);
  console.log(`ℹ️  Informações: http://localhost:${PORT}/info`);

  // Iniciar conexão externa
  connectToExternal();
});

// Gerenciamento de encerramento
process.on("SIGINT", () => {
  console.log("\n🛑 Encerrando servidor...");

  // Fechar conexões
  wss.clients.forEach((client) => client.close());
  if (externalWs) externalWs.close();

  server.close(() => {
    console.log("✅ Servidor encerrado com sucesso");
    process.exit(0);
  });
});
