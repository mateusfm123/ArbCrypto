// Configurações
const WS_URL = "ws://localhost:8080"; // Substitua pela sua URL WebSocket
const RECONNECT_DELAY = 5000; // 5 segundos

// Estado da aplicação
const state = {
  socket: null,
  status: "connecting",
  opportunities: [],
  stats: {
    prevCount: 0,
    active: 0,
    maxProfit: 0,
    bestPair: "",
    totalVolume: 0,
    lastUpdated: null,
    crossCounts: {},
  },
  filters: {
    minProfit: -10,
    maxProfit: 100,
    exchanges: {}, // { "binance": true, "bybit": false }
    coins: [], // Moedas a serem ocultadas (vazio = mostrar todas)
    showOnlyBest: false,
  },
};

// Elementos DOM
const elements = {
  statusIndicator: document.getElementById("status-indicator"),
  connectionText: document.getElementById("connection-text"),
  activeOpp: document.getElementById("active-opp"),
  maxProfit: document.getElementById("max-profit"),
  bestPair: document.getElementById("best-pair"),
  totalVolume: document.getElementById("total-volume"),
  opportunitiesBody: document.getElementById("opportunities-body"),
  exitCount: document.getElementById("exit-count"),
  entryOrders: document.getElementById("entry-orders"),
  exitOrders: document.getElementById("exit-orders"),
  minProfitInput: document.getElementById("min-profit"),
  maxProfitInput: document.getElementById("max-profit"),
  coinSearch: document.getElementById("coin-search"),
  coinList: document.getElementById("coin-list"),
  filterModal: document.getElementById("filter-modal"),
};

// Formatação de números
const formatters = {
  price: (value) => {
    if (value < 0.0001) return value.toExponential(4);
    return parseFloat(value.toFixed(8)).toString();
  },
  profit: (value) => {
    const fixed = parseFloat(value.toFixed(2));
    return (fixed > 0 ? "+" : "") + fixed + "%";
  },
  volume: (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
    if (value >= 1000) return (value / 1000).toFixed(1) + "K";
    return value.toFixed(2);
  },
};

// Conexão WebSocket
function connectWebSocket() {
  if (
    state.socket &&
    [WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket.readyState)
  ) {
    return;
  }

  updateStatus("connecting");
  state.socket = new WebSocket(WS_URL);

  state.socket.onopen = () => {
    updateStatus("connected");
    console.log("Conectado ao WebSocket");
  };

  state.socket.onclose = () => {
    updateStatus("disconnected");
    console.log("Conexão perdida. Tentando reconectar...");
    setTimeout(connectWebSocket, RECONNECT_DELAY);
  };

  state.socket.onerror = (error) => {
    console.error("Erro no WebSocket:", error);
    updateStatus("error");
  };

  state.socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      processWebSocketMessage(data);
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
    }
  };
}

// Processa mensagens do WebSocket
function processWebSocketMessage(data) {
  if (Array.isArray(data)) {
    // Processa oportunidades de arbitragem
    state.opportunities = data;
    updateStatistics();
    updateUI();
  } else if (data.type === "orders") {
    // Processa ordens executadas
    state.entryOrders = data.entry || [];
    state.exitOrders = data.exit || [];
    renderOrders();
  }
}

// Atualiza estatísticas
function updateStatistics() {
  const prevCount = state.stats.active;
  const currentCount = state.opportunities.length;

  state.stats = {
    prevCount: currentCount,
    active: currentCount,
    maxProfit: Math.max(...state.opportunities.map((o) => o.profit)),
    bestPair: state.opportunities.reduce(
      (best, o) => (o.profit > best.profit ? o : best),
      { profit: 0 }
    ).pair,
    totalVolume: state.opportunities.reduce(
      (sum, o) => sum + (o.spot.volume || 0),
      0
    ),
  };

  // Atualiza elemento de mudança
  const changeElement = document.getElementById("opp-change");
  const diff = currentCount - prevCount;
  if (diff > 0) {
    changeElement.innerHTML = `<i class="fas fa-arrow-up"></i><span>+${diff} novas</span>`;
  } else if (diff < 0) {
    changeElement.innerHTML = `<i class="fas fa-arrow-down"></i><span>${diff} menos</span>`;
  }
}
function updateUI() {
  // Aplica filtros
  const filtered = applyFilters();

  // Atualiza estatísticas com dados filtrados
  elements.activeOpp.textContent = filtered.length;
  elements.maxProfit.textContent = formatters.profit(
    filtered.length > 0 ? Math.max(...filtered.map((o) => o.profit)) : 0
  );
  elements.bestPair.textContent =
    filtered.length > 0
      ? filtered.reduce((best, o) => (o.profit > best.profit ? o : best), {
          profit: 0,
        }).pair
      : "-";
  elements.totalVolume.textContent = formatters.volume(
    filtered.reduce((sum, o) => sum + (o.spot.volume || 0), 0)
  );

  // Renderiza oportunidades
  renderOpportunities(filtered);
}

// Aplica filtros atuais
function applyFilters() {
  return state.opportunities.filter((opp) => {
    // Filtro de lucro
    if (
      opp.profit < state.filters.minProfit ||
      opp.profit > state.filters.maxProfit
    ) {
      return false;
    }

    // Filtro de exchange (se pelo menos uma exchange foi desmarcada)
    if (Object.keys(state.filters.exchanges).length > 0) {
      const spotAllowed = state.filters.exchanges[opp.spot.exchange] !== false;
      const futureAllowed =
        state.filters.exchanges[opp.future.exchange] !== false;

      if (!spotAllowed || !futureAllowed) {
        return false;
      }
    }

    // Filtro de moedas (se pelo menos uma moeda foi selecionada)
    if (
      state.filters.coins.length > 0 &&
      !state.filters.coins.includes(opp.pair)
    ) {
      return false;
    }

    return true;
  });
}

// Manter o controle das abas abertas (Spot e Futuro)
let openTabs = {
  mexcSpot: null,
  mexcFuture: null,
  gateIoSpot: null,
  htxSpot: null, // Adicionando HTX Spot
};

// Função para abrir ou atualizar as exchanges para uma moeda específica
function openExchanges(pair, spotExchange, futureExchange) {
  const formattedPair = pair.replace("/", "_").toUpperCase(); // Formatar o par de moedas para ser utilizado na URL

  // Verifica se as abas estão fechadas, se estiverem, limpa as referências
  function checkAndClearTab(tabName) {
    if (openTabs[tabName] && openTabs[tabName].closed) {
      openTabs[tabName] = null; // Limpa a referência se a aba foi fechada
    }
  }

  // Para MEXC Spot
  if (spotExchange === "mexc") {
    checkAndClearTab("mexcSpot");
    if (openTabs.mexcSpot) {
      // Atualiza a URL da aba do MEXC Spot se já estiver aberta
      openTabs.mexcSpot.location.href = `https://www.mexc.com/exchange/${formattedPair}`;
    } else {
      // Se não estiver aberta, abre uma nova aba
      openTabs.mexcSpot = window.open(
        `https://www.mexc.com/exchange/${formattedPair}`,
        "_blank"
      );
    }
  }

  // Para MEXC Future
  if (futureExchange === "mexc") {
    checkAndClearTab("mexcFuture");
    if (openTabs.mexcFuture) {
      // Atualiza a URL da aba do MEXC Future se já estiver aberta
      openTabs.mexcFuture.location.href = `https://www.mexc.com/futures/${formattedPair}`;
    } else {
      // Se não estiver aberta, abre uma nova aba
      openTabs.mexcFuture = window.open(
        `https://www.mexc.com/futures/${formattedPair}`,
        "_blank"
      );
    }
  }

  // Para Gate.io Spot (Gate.io não tem mercado futuro)
  if (spotExchange === "gateio") {
    checkAndClearTab("gateIoSpot");
    if (openTabs.gateIoSpot) {
      // Atualiza a URL da aba do Gate.io Spot se já estiver aberta
      openTabs.gateIoSpot.location.href = `https://www.gate.io/trade/${formattedPair}`;
    } else {
      // Se não estiver aberta, abre uma nova aba
      openTabs.gateIoSpot = window.open(
        `https://www.gate.io/trade/${formattedPair}`,
        "_blank"
      );
    }
  }

  // Para HTX Spot (corrigido o link para a moeda)
  if (spotExchange === "htx") {
    checkAndClearTab("htxSpot");
    if (openTabs.htxSpot) {
      // Atualiza a URL da aba do HTX Spot se já estiver aberta
      openTabs.htxSpot.location.href = `https://www.htx.com/trade/${formattedPair.toLowerCase()}?type=spot`;
    } else {
      // Se não estiver aberta, abre uma nova aba
      openTabs.htxSpot = window.open(
        `https://www.htx.com/trade/${formattedPair.toLowerCase()}?type=spot`,
        "_blank"
      );
    }
  }
}

// Função para executar o trade (quando o usuário clicar na ação)
function executeTrade(pair, spotExchange, futureExchange) {
  // Exemplo de como abrir ou atualizar as exchanges de acordo com a moeda
  openExchanges(pair, spotExchange, futureExchange); // Abre ou atualiza as abas com a moeda selecionada
}

// Função para calcular o percentual de lucro ou perda
function calculateProfit(entryPrice, exitPrice) {
  return ((exitPrice - entryPrice) / entryPrice) * 100;
}

// Função para atualizar as ordens de entrada e saída
function updateOrders(entryOrders, exitOrders) {
  // Preenche a lista de ordens de entrada
  const entryOrdersList = document.getElementById("entry-orders");
  entryOrdersList.innerHTML = "";

  entryOrders.forEach((order) => {
    const orderElement = document.createElement("div");
    orderElement.classList.add("order-item");

    orderElement.innerHTML = `
      <p><strong>Moeda:</strong> ${order.pair}</p>
      <p><strong>Preço de Entrada:</strong> ${order.entryPrice}</p>
      <p><strong>Exchange:</strong> ${order.exchange}</p>
      <p><strong>Tipo:</strong> Entrada</p>
    `;
    entryOrdersList.appendChild(orderElement);
  });

  // Preenche a lista de ordens de saída
  const exitOrdersList = document.getElementById("exit-orders");
  exitOrdersList.innerHTML = "";

  exitOrders.forEach((order) => {
    const orderElement = document.createElement("div");
    orderElement.classList.add("order-item");

    const profit = calculateProfit(order.entryPrice, order.exitPrice); // Calcula o lucro/perda

    orderElement.innerHTML = `
      <p><strong>Moeda:</strong> ${order.pair}</p>
      <p><strong>Preço de Saída:</strong> ${order.exitPrice}</p>
      <p><strong>Porcentagem de Lucro:</strong> ${profit.toFixed(2)}%</p>
      <p><strong>Exchange:</strong> ${order.exchange}</p>
      <p><strong>Tipo:</strong> Saída</p>
    `;
    exitOrdersList.appendChild(orderElement);
  });
}

// Função para simular a execução de trade e carregar as ordens
function executeTrade(pair) {
  // Dados simulados para a moeda selecionada (os preços de entrada e saída serão passados de forma dinâmica)
  const entryOrders = [];

  const exitOrders = [];

  // Chama a função para atualizar as ordens na interface
  updateOrders(entryOrders, exitOrders);
}

function renderOpportunities(opportunities) {
  // Limpeza segura do container
  elements.opportunitiesBody.innerHTML = "";

  // Verificação de oportunidades vazias
  if (!opportunities || opportunities.length === 0) {
    elements.opportunitiesBody.innerHTML = `
      <tr class="no-opportunities">
        <td colspan="6">
          <i class="fas fa-search"></i>
          Nenhuma oportunidade encontrada com os filtros atuais
        </td>
      </tr>
    `;
    return;
  }

  // Processa cada oportunidade
  opportunities.forEach((opp) => {
    try {
      const row = document.createElement("tr");
      const profitClass = opp.profit >= 0 ? "positive" : "negative";
      const crosses = opp.crossCount || 0;

      // Extrai a moeda base do par (ex: BTC em BTC/USDT)
      const baseCurrency =
        opp.pair.split("/")[0] || opp.pair.split("-")[0] || "UNKNOWN";

      row.innerHTML = `
        <td class="pair">
          <div class="currency-pair">
            <i class="${getIconClass(
              baseCurrency
            )} currency-icon" title="${baseCurrency}"></i>
            <span>${opp.pair}</span>
          </div>
        </td>
        <td class="exchange-data">
          <div class="exchange-label ${opp.spot.exchange}">
            <i class="fas fa-coins exchange-icon"></i>
            ${opp.spot.exchange.toUpperCase()}
          </div>
          <div class="price">${formatters.price(opp.spot.price)}</div>
          <div class="volume">${formatters.volume(opp.spot.volume || 0)}</div>
        </td>
        <td class="exchange-data">
          <div class="exchange-label ${opp.future.exchange}">
            <i class="fas fa-chart-line exchange-icon"></i>
            ${opp.future.exchange.toUpperCase()}
          </div>
          <div class="price">${formatters.price(opp.future.price)}</div>
          <div class="volume">${
            opp.future.volume ? formatters.volume(opp.future.volume) : "-"
          }</div>
        </td>
        <td class="profit ${profitClass}">
          ${formatters.profit(opp.profit)}
          ${
            opp.profit >= 0
              ? '<i class="fas fa-arrow-up"></i>'
              : '<i class="fas fa-arrow-down"></i>'
          }
        </td>
        <td class="crosses">
          <div class="cross-visualization" data-count="${crosses}">
            ${createCrossVisualization(crosses)}
            <div class="cross-tooltip">${crosses} cruzamentos nos últimos 15min</div>
          </div>
        </td>
        <td class="actions">
          <button class="action-btn" title="Executar trade" onclick="openExchanges('${
            opp.pair
          }', '${opp.spot.exchange}', '${opp.future.exchange}')">
            <i class="fas fa-exchange-alt"></i>
            Trade
          </button>
        </td>
      `;

      elements.opportunitiesBody.appendChild(row);
    } catch (error) {
      console.error("Erro ao renderizar oportunidade:", opp, error);
    }
  });
}

// Função auxiliar para criar a visualização de cruzamentos
function createCrossVisualization(count) {
  return `
    <div class="cross-badge" data-count="${count}">
      ${count}
      <div class="cross-tooltip">${count} cruzamentos nos últimos 15min</div>
    </div>
  `;
}

// Função auxiliar para obter o ícone de uma moeda (exemplo de função)
function getIconClass(currency) {
  return `icon-${currency.toLowerCase()}`;
}

// Função para obter classe do ícone
function getIconClass(currency) {
  const icons = {
    BTC: "fab fa-bitcoin",
    ETH: "fab fa-ethereum",
    USDT: "fas fa-dollar-sign",
    "1INCH": "fas fa-shapes", // Ícone genérico para 1INCH
    // Adicione outros mapeamentos
  };
  return icons[currency] || "fas fa-coins";
}

function getIconClass(currency) {
  // Normaliza a moeda (remove hífens, espaços e pega a base de pares)
  const cleanCurrency = currency.split(/[-/]/)[0].toUpperCase();

  // Mapeamento completo das principais criptomoedas
  const cryptoIcons = {
    // Bitcoin e derivados
    BTC: "fab fa-bitcoin",
    XBT: "fab fa-bitcoin",
    BCH: "fas fa-bitcoin-sign",
    BSV: "fas fa-bitcoin-sign",

    // Ethereum e tokens ERC-20
    ETH: "fab fa-ethereum",
    ETC: "fab fa-ethereum",
    WETH: "fab fa-ethereum",

    // Stablecoins
    USDT: "fas fa-dollar-sign",
    USDC: "fas fa-dollar-sign",
    BUSD: "fas fa-dollar-sign",
    DAI: "fas fa-dollar-sign",
    TUSD: "fas fa-dollar-sign",
    USDP: "fas fa-dollar-sign",
    FRAX: "fas fa-dollar-sign",
    PAX: "fas fa-dollar-sign",
    GUSD: "fas fa-dollar-sign",

    // Exchange tokens
    HT: "fas fa-exchange-alt",
    FTT: "fas fa-exchange-alt",
    OKB: "fas fa-exchange-alt",
    LEO: "fas fa-exchange-alt",
    KCS: "fas fa-exchange-alt",
    GT: "fas fa-exchange-alt",

    // Privacy coins
    XMR: "fas fa-user-secret",
    ZEC: "fas fa-user-secret",
    DASH: "fas fa-user-secret",
    ZEN: "fas fa-user-secret",
    SCRT: "fas fa-user-secret",

    // Smart contract platforms
    SOL: "fas fa-sun",
    ADA: "fas fa-chart-network",
    DOT: "fas fa-circle-nodes",
    AVAX: "fas fa-mountain",
    MATIC: "fas fa-bezier-curve",
    ATOM: "fas fa-atom",
    NEAR: "fas fa-leaf",
    ALGO: "fas fa-microchip",
    EGLD: "fas fa-crown",
    FTM: "fas fa-bolt",
    ONE: "fas fa-link",
    KLAY: "fas fa-cube",

    // DeFi tokens
    UNI: "fas fa-handshake",
    LINK: "fas fa-link",
    AAVE: "fas fa-bank",
    COMP: "fas fa-bank",
    MKR: "fas fa-bank",
    SNX: "fas fa-bank",
    YFI: "fas fa-bank",
    CRV: "fas fa-bank",
    SUSHI: "fas fa-utensils",
    CAKE: "fas fa-pancakes",

    // Oracles
    BAND: "fas fa-database",
    GRT: "fas fa-database",
    TRB: "fas fa-database",

    // Meme coins
    DOGE: "fas fa-dog",
    SHIB: "fas fa-dog",
    FLOKI: "fas fa-dog",
    ELON: "fas fa-rocket",

    // Metaverse/NFT
    MANA: "fas fa-vr-cardboard",
    SAND: "fas fa-chess-board",
    AXS: "fas fa-gamepad",
    ENJ: "fas fa-dice",
    FLOW: "fas fa-paint-brush",

    // Storage
    FIL: "fas fa-database",
    AR: "fas fa-archive",
    STORJ: "fas fa-hdd",

    // AI
    AGIX: "fas fa-robot",
    OCEAN: "fas fa-brain",
    NMR: "fas fa-microscope",

    // Layer 2
    IMX: "fas fa-layer-group",
    ARB: "fas fa-layers",
    OP: "fas fa-layers",

    // Outras top 200
    XRP: "fas fa-bolt",
    LTC: "fab fa-litecoin",
    XLM: "fas fa-star",
    EOS: "fas fa-box-open",
    XTZ: "fas fa-mug-hot",
    VET: "fas fa-barcode",
    THETA: "fas fa-video",
    ICP: "fas fa-globe",
    CRO: "fas fa-wallet",
    QNT: "fas fa-infinity",
    ETC: "fas fa-coin",
    HBAR: "fas fa-network-wired",
    RUNE: "fas fa-shield-alt",
    KSM: "fas fa-link",
    NEO: "fas fa-coins",
    STX: "fas fa-block-brick",
    XDC: "fas fa-building-columns",
    MINA: "fas fa-compress",
    WAVES: "fas fa-water",
    CHZ: "fas fa-trophy",
    HOT: "fas fa-fire",
    BAT: "fas fa-bell",
    ZIL: "fas fa-z",
    IOTA: "fas fa-i",
    ENJ: "fas fa-dice",
    TFUEL: "fas fa-gas-pump",

    // Padrão para moedas não listadas
    DEFAULT: "fas fa-coins",
  };

  // 1. Verifica correspondência exata
  if (cryptoIcons[cleanCurrency]) {
    return cryptoIcons[cleanCurrency];
  }

  // 2. Tenta encontrar por similaridade (prefixos comuns)
  const prefix = cleanCurrency.substring(0, 3);
  for (const [symbol, icon] of Object.entries(cryptoIcons)) {
    if (symbol.startsWith(prefix)) {
      return icon;
    }
  }

  // 3. Para tokens (terminam com letras específicas)
  if (cleanCurrency.endsWith("X")) return "fas fa-x";
  if (cleanCurrency.endsWith("T")) return "fas fa-t";

  // 4. Retorna ícone padrão com cor baseada no hash do nome
  return cryptoIcons.DEFAULT;
}

function getIconClassForTradingPair(pair) {
  const [baseCurrency, quoteCurrency] = pair.split(/[-/]/);

  return {
    baseIcon: getIconClass(baseCurrency),
    quoteIcon: getIconClass(quoteCurrency),
  };
}

function renderCoinItem(coin) {
  const iconClass = getIconClass(coin.symbol || coin.pair);

  return `
    <div class="coin-item">
      <i class="${iconClass} coin-icon"></i>
      <span>${coin.name || coin.pair}</span>
    </div>
  `;
}
// Função auxiliar para classificar intensidade de cruzamentos
function getCrossIntensityClass(count) {
  if (count >= 10) return "high-frequency";
  if (count >= 5) return "medium-frequency";
  return "low-frequency";
}

// Função auxiliar para classificar intensidade de cruzamentos
function getCrossIntensityClass(count) {
  if (count >= 10) return "high-frequency";
  if (count >= 5) return "medium-frequency";
  return "low-frequency";
}
// Renderiza ordens executadas

function renderOrderList(container, orders) {
  container.innerHTML = "";

  orders.forEach((order) => {
    const orderEl = document.createElement("div");
    const profitClass = order.profit >= 0 ? "positive" : "negative";

    orderEl.innerHTML = `
            <div class="order-value">${order.pair}</div>
            <div class="order-value">${formatters.price(order.spotPrice)}</div>
            <div class="order-value order-profit ${profitClass}">${formatters.profit(
      order.profit
    )}</div>
        `;
    container.appendChild(orderEl);
  });
}

// Atualiza status da conexão
function updateStatus(status) {
  state.status = status;
  elements.statusIndicator.className =
    "status-indicator" + (status === "connected" ? " connected" : "");
  elements.connectionText.textContent =
    status === "connected"
      ? "Conectado"
      : status === "connecting"
      ? "Conectando..."
      : "Desconectado";
}

// Função global para executar trades
window.executeTrade = function (pair) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    alert("Erro: Não conectado ao servidor");
    return;
  }

  // Envia mensagem para executar trade
  const message = {
    type: "execute_trade",
    pair: pair,
    timestamp: new Date().toISOString(),
  };

  state.socket.send(JSON.stringify(message));
  alert(`Ordem enviada para: ${pair}`);
};

// Inicialização
window.addEventListener("load", () => {
  connectWebSocket();
});
