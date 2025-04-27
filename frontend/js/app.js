// Configurações
const WS_URL = "ws://localhost:8080"; // Substitua pela sua URL WebSocket
const RECONNECT_DELAY = 5000; // 5 segundos

// Estado da aplicação
const state = {
  socket: null,
  status: "connecting",
  opportunities: [],
  entryOrders: [],
  exitOrders: [],
  stats: {
    prevCount: 0,
    active: 0,
    maxProfit: 0,
    bestPair: "",
    totalVolume: 0,
  },
  filters: {
    minProfit: -100,
    maxProfit: 1000,
    exchanges: {}, // { "binance": true, "bybit": false }
    coins: [], // ["BTC/USDT", "ETH/USDT"]
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
  entryCount: document.getElementById("entry-count"),
  exitCount: document.getElementById("exit-count"),
  entryOrders: document.getElementById("entry-orders"),
  exitOrders: document.getElementById("exit-orders"),
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

// Atualiza a interface do usuário
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

  // Renderiza ordens
  renderOrders();
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

// Renderiza oportunidades na tabela
function renderOpportunities(opportunities) {
  elements.opportunitiesBody.innerHTML = "";

  opportunities.forEach((opp) => {
    const row = document.createElement("tr");
    const profitClass = opp.profit >= 0 ? "positive" : "negative";

    row.innerHTML = `
            <td>${opp.pair}</td>
            <td>${opp.spot.exchange.toUpperCase()}: ${formatters.price(
      opp.spot.price
    )}</td>
            <td>${opp.future.exchange.toUpperCase()}: ${formatters.price(
      opp.future.price
    )}</td>
            <td class="profit ${profitClass}">${formatters.profit(
      opp.profit
    )}</td>
            <td>
                <button class="action-btn" title="Executar trade" onclick="executeTrade('${
                  opp.pair
                }')">
                    <i class="fas fa-exchange-alt"></i>
                </button>
            </td>
        `;
    elements.opportunitiesBody.appendChild(row);
  });
}

// Renderiza ordens executadas
function renderOrders() {
  renderOrderList(elements.entryOrders, state.entryOrders);
  renderOrderList(elements.exitOrders, state.exitOrders);

  elements.entryCount.textContent = state.entryOrders.length;
  elements.exitCount.textContent = state.exitOrders.length;
}

function renderOrderList(container, orders) {
  container.innerHTML = "";

  orders.forEach((order) => {
    const orderEl = document.createElement("div");
    orderEl.className = "order-item";
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

// Funções do sistema de filtros
function initFilters() {
  // Configura eventos
  document
    .getElementById("open-filters")
    .addEventListener("click", openFilterModal);
  document
    .getElementById("close-modal")
    .addEventListener("click", closeFilterModal);
  document
    .getElementById("cancel-filters")
    .addEventListener("click", closeFilterModal);
  document
    .getElementById("apply-filters")
    .addEventListener("click", applyFiltersModal);
  document
    .getElementById("select-all")
    .addEventListener("click", selectAllCoins);
  document
    .getElementById("deselect-all")
    .addEventListener("click", deselectAllCoins);
  document.getElementById("coin-search").addEventListener("input", filterCoins);
}

function openFilterModal() {
  // Preenche exchanges disponíveis
  const exchangesContainer = document.getElementById("exchange-filters");
  exchangesContainer.innerHTML = "";

  // Obtém todas as exchanges únicas
  const allExchanges = new Set();
  state.opportunities.forEach((opp) => {
    allExchanges.add(opp.spot.exchange);
    allExchanges.add(opp.future.exchange);
  });

  // Cria checkboxes para cada exchange
  Array.from(allExchanges).forEach((ex) => {
    const isChecked = state.filters.exchanges[ex] !== false;
    const div = document.createElement("div");
    div.className = "exchange-filter";
    div.innerHTML = `
            <input type="checkbox" id="ex-${ex}" ${isChecked ? "checked" : ""}>
            <label for="ex-${ex}">${ex.toUpperCase()}</label>
        `;
    exchangesContainer.appendChild(div);
  });

  // Preenche valores atuais
  document.getElementById("min-profit").value = state.filters.minProfit;
  document.getElementById("max-profit").value = state.filters.maxProfit;

  // Atualiza lista de moedas
  updateCoinList();

  // Mostra modal
  document.getElementById("filter-modal").classList.add("active");
}

function closeFilterModal() {
  document.getElementById("filter-modal").classList.remove("active");
}

function applyFiltersModal() {
  // Obtém valores dos filtros
  state.filters.minProfit =
    parseFloat(document.getElementById("min-profit").value) || -100;
  state.filters.maxProfit =
    parseFloat(document.getElementById("max-profit").value) || 1000;

  // Obtém exchanges selecionadas
  const newExchanges = {};
  document
    .querySelectorAll('#exchange-filters input[type="checkbox"]')
    .forEach((cb) => {
      const exchange = cb.id.replace("ex-", "");
      newExchanges[exchange] = cb.checked;
    });
  state.filters.exchanges = newExchanges;

  // Obtém moedas selecionadas (apenas as que estão marcadas)
  state.filters.coins = [];
  document
    .querySelectorAll('#coin-list input[type="checkbox"]:checked')
    .forEach((cb) => {
      state.filters.coins.push(cb.id.replace("coin-", ""));
    });

  closeFilterModal();

  // Força a atualização imediata da UI
  updateUI();
}

function updateCoinList() {
  const coinList = document.getElementById("coin-list");
  coinList.innerHTML = "";

  const allCoins = [...new Set(state.opportunities.map((o) => o.pair))];
  const searchTerm = document.getElementById("coin-search").value.toLowerCase();

  // Mostra todas as moedas se nenhuma estiver selecionada, caso contrário só as selecionadas
  const showAll = state.filters.coins.length === 0;

  allCoins
    .filter((coin) => coin.toLowerCase().includes(searchTerm))
    .filter((coin) => showAll || state.filters.coins.includes(coin))
    .forEach((coin) => {
      const isChecked = showAll || state.filters.coins.includes(coin);
      const item = document.createElement("div");
      item.className = "coin-item";
      item.innerHTML = `
                <input type="checkbox" id="coin-${coin}" ${
        isChecked ? "checked" : ""
      }>
                <label for="coin-${coin}">${coin}</label>
            `;
      coinList.appendChild(item);
    });
}

function filterCoins() {
  updateCoinList();
}

function selectAllCoins() {
  document
    .querySelectorAll('#coin-list input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = true;
    });
}

function deselectAllCoins() {
  document
    .querySelectorAll('#coin-list input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = false;
    });
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
  initFilters();
});
