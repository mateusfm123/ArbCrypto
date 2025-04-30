import { formatters, formatVolume, state } from "./state.js";

export class UIService {
  static elements = {
    statusIndicator: document.getElementById("status-indicator"),
    connectionText: document.getElementById("connection-text"),
    activeOpp: document.getElementById("active-opp"),
    maxProfit: document.getElementById("max-profit"),
    bestPair: document.getElementById("best-pair"),
    totalVolume: document.getElementById("total-volume"),
    oppChange: document.getElementById("opp-change"),
    opportunitiesBody: document.getElementById("opportunities-body"),
    filterModal: document.getElementById("filter-modal"),
    minProfitInput: document.getElementById("min-profit"),
    maxProfitInput: document.getElementById("max-profit"),
    exchangeFilters: document.getElementById("exchange-filters"),
    coinSearch: document.getElementById("coin-search"),
    coinList: document.getElementById("coin-list"),
    selectAllBtn: document.getElementById("select-all"),
    deselectAllBtn: document.getElementById("deselect-all"),
    openFiltersBtn: document.getElementById("open-filters"),
    closeModalBtn: document.getElementById("close-modal"),
    cancelFiltersBtn: document.getElementById("cancel-filters"),
    applyFiltersBtn: document.getElementById("apply-filters"),
  };

  static init() {
    this.setupEventListeners();
    this.updateStatusIndicator("connecting");
  }

  static setupEventListeners() {
    // Modal handlers
    this.elements.openFiltersBtn.addEventListener("click", () =>
      this.toggleFilterModal(true)
    );
    this.elements.closeModalBtn.addEventListener("click", () =>
      this.toggleFilterModal(false)
    );
    this.elements.cancelFiltersBtn.addEventListener("click", () =>
      this.toggleFilterModal(false)
    );

    // Filter application
    this.elements.applyFiltersBtn.addEventListener("click", () =>
      this.applyFilters()
    );

    // Coin selection
    this.elements.selectAllBtn.addEventListener("click", () =>
      this.selectAllCoins(true)
    );
    this.elements.deselectAllBtn.addEventListener("click", () =>
      this.selectAllCoins(false)
    );
    this.elements.coinSearch.addEventListener("input", (e) =>
      this.filterCoinList(e.target.value)
    );
  }

  static toggleFilterModal(show) {
    this.elements.filterModal.style.display = show ? "block" : "none";
    if (show) this.initFilterModal();
  }

  static initFilterModal() {
    // Set current filter values
    this.elements.minProfitInput.value = state.filters.minProfit;
    this.elements.maxProfitInput.value = state.filters.maxProfit;

    // Initialize exchange filters
    this.renderExchangeFilters();

    // Initialize coin list
    this.renderCoinList();
  }

  static renderExchangeFilters() {
    const exchanges = Object.keys(state.filters.exchanges);
    this.elements.exchangeFilters.innerHTML = exchanges
      .map(
        (exchange) => `
      <label>
        <input type="checkbox" name="exchange" value="${exchange}" 
               ${state.filters.exchanges[exchange] ? "checked" : ""}>
        ${exchange.toUpperCase()}
      </label>
    `
      )
      .join("");
  }

  static renderCoinList() {
    const allCoins = [...new Set(state.opportunities.map((opp) => opp.pair))];
    this.elements.coinList.innerHTML = allCoins
      .map(
        (coin) => `
      <div class="coin-item">
        <label>
          <input type="checkbox" name="coin" value="${coin}" 
                 ${state.filters.coins.includes(coin) ? "checked" : ""}>
          ${coin}
        </label>
      </div>
    `
      )
      .join("");
  }

  static filterCoinList(searchTerm) {
    const items = this.elements.coinList.querySelectorAll(".coin-item");
    const term = searchTerm.toLowerCase();

    items.forEach((item) => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(term) ? "block" : "none";
    });
  }

  static selectAllCoins(select) {
    const checkboxes = this.elements.coinList.querySelectorAll(
      'input[type="checkbox"]'
    );
    checkboxes.forEach((checkbox) => {
      checkbox.checked = select;
    });
  }

  static applyFilters() {
    // Get profit filters
    state.filters.minProfit =
      parseFloat(this.elements.minProfitInput.value) || -100;
    state.filters.maxProfit =
      parseFloat(this.elements.maxProfitInput.value) || 1000;

    // Get exchange filters
    const exchangeCheckboxes = this.elements.exchangeFilters.querySelectorAll(
      'input[type="checkbox"]'
    );
    exchangeCheckboxes.forEach((checkbox) => {
      state.filters.exchanges[checkbox.value] = checkbox.checked;
    });

    // Get coin filters
    const coinCheckboxes = this.elements.coinList.querySelectorAll(
      'input[type="checkbox"]'
    );
    state.filters.coins = Array.from(coinCheckboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);

    this.toggleFilterModal(false);
    document.dispatchEvent(new Event("filtersUpdated"));
  }

  static updateStatusIndicator(status) {
    this.elements.statusIndicator.className = `status-indicator ${status}`;
    this.elements.connectionText.textContent =
      status === "connected"
        ? "Conectado"
        : status === "connecting"
        ? "Conectando..."
        : "Desconectado";
  }

  static renderOpportunities(opportunities) {
    const { opportunitiesBody } = this.elements;
    opportunitiesBody.innerHTML = "";

    if (!opportunities || opportunities.length === 0) {
      opportunitiesBody.innerHTML = `
        <tr class="no-opportunities">
          <td colspan="6">
            <i class="fas fa-search"></i>
            Nenhuma oportunidade encontrada
          </td>
        </tr>
      `;
      return;
    }

    // Mapeamento de nomes para português
    const exchangeNamesPT = {
      binance: "Binance",
      gateio: "Gate.io",
      mercadobitcoin: "Mercado Bitcoin",
      foxbit: "Foxbit",
      htx: "HTX",
      mexc: "MEXC",
    };

    // Mapeamento de ícones para criptomoedas
    const cryptoIcons = {
      BTC: "fab fa-bitcoin",
      ETH: "fab fa-ethereum",
      USDT: "fas fa-dollar-sign",
      BNB: "fab fa-btc", // Usando BTC como placeholder
      SOL: "fas fa-sun",
      XRP: "fas fa-money-bill-wave",
      ADA: "fas fa-project-diagram",
      DOGE: "fas fa-dog",
      // Adicione mais moedas conforme necessário
    };
    opportunities.forEach((opp) => {
      const row = document.createElement("tr");
      const profitClass = opp.profit >= 0 ? "positive" : "negative";
      const crosses = opp.crossCount || 0;
      const [baseCurrency] = opp.pair.split("/"); // Obtém a moeda base (BTC em BTC/USDT)

      row.innerHTML = `
        <td class="pair">
          <div class="currency-pair">
            <i class="${
              cryptoIcons[baseCurrency] || "fas fa-coins"
            } crypto-icon"></i>
            <span>${opp.pair.replace("/", " / ")}</span>
          </div>
        </td>
        <td class="exchange-data">
          <div class="exchange-label ${opp.spot.exchange}" 
               title="${
                 exchangeNamesPT[opp.spot.exchange] ||
                 opp.spot.exchange.toUpperCase()
               }">
            <i class="${
              [opp.spot.exchange] || "fas fa-exchange-alt"
            } exchange-icon"></i>
            <span class="exchange-name">${
              exchangeNamesPT[opp.spot.exchange] ||
              opp.spot.exchange.toUpperCase()
            }</span>
          </div>
          <div class="price">${formatters.price(opp.spot.price)}</div>
          <div class="volume">${formatVolume(opp.spot.volume)}</div>
        </td>
        <td class="exchange-data">
          <div class="exchange-label ${opp.future.exchange}" 
               title="${
                 exchangeNamesPT[opp.future.exchange] ||
                 opp.future.exchange.toUpperCase()
               }">
            <i class="${
              [opp.future.exchange] || "fas fa-exchange-alt"
            } exchange-icon"></i>
            <span class="exchange-name">${
              exchangeNamesPT[opp.future.exchange] ||
              opp.future.exchange.toUpperCase()
            }</span>
          </div>
          <div class="price">${formatters.price(opp.future.price)}</div>
        </td>
        <td class="profit ${profitClass}">
          ${formatters.profit(opp.profit)}
          <i class="fas fa-arrow-${opp.profit >= 0 ? "up" : "down"}"></i>
        </td>
        <td class="crosses">
          <div class="cross-badge" data-count="${crosses}">
            ${crosses}
          </div>
        </td>
         <td class="actions">
      <button class="action-btn" 
              onclick="window.executeTrade('${opp.pair}', '${
        opp.spot.exchange
      }', '${opp.future.exchange}')"
              title="Abrir ${exchangeNamesPT[opp.spot.exchange]} e ${
        exchangeNamesPT[opp.future.exchange]
      }">
        <i class="fas fa-exchange-alt"></i>
        Negociar
      </button>
    </td>
  `;
      opportunitiesBody.appendChild(row);
    });
  }

  static getCryptoIcon(symbol) {
    const iconMap = {
      BTC: "fab fa-bitcoin",
      ETH: "fab fa-ethereum",
      USDT: "fas fa-dollar-sign",
      BNB: "fas fa-chart-line",
      XRP: "fas fa-money-bill-wave",
      SOL: "fas fa-sun",
      ADA: "fas fa-project-diagram",
      DOGE: "fas fa-dog",
      // Adicione mais mapeamentos conforme necessário
    };

    const normalizedSymbol = symbol.split("/")[0]; // Remove a parte após a barra (BTC/USDT -> BTC)
    return iconMap[normalizedSymbol] || "fas fa-coins"; // Fallback padrão
  }

  static renderExits(data) {
    const tbody = document.getElementById("exit-body");
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr class="no-exits">
          <td colspan="6">
            <i class="fas fa-search"></i>
            Nenhuma saída encontrada
          </td>
        </tr>
      `;
      return;
    }

    // Mapeamento de ícones para criptomoedas
    const cryptoIcons = {
      BTC: "fab fa-bitcoin",
      ETH: "fab fa-ethereum",
      USDT: "fas fa-dollar-sign",
      BNB: "fab fa-btc", // Usando BTC como placeholder
      SOL: "fas fa-sun",
      XRP: "fas fa-money-bill-wave",
      ADA: "fas fa-project-diagram",
      DOGE: "fas fa-dog",
      // Adicione mais moedas conforme necessário
    };

    // Mapeamento de exchanges
    const exchangeNamesPT = {
      binance: "Binance",
      gateio: "Gate.io",
      mercadobitcoin: "Mercado Bitcoin",
      foxbit: "Foxbit",
      htx: "HTX",
      mexc: "MEXC",
    };

    data.forEach((opp) => {
      if (!opp.exit) return;

      const row = document.createElement("tr");

      const profitClass = opp.exit.profit >= 0 ? "positive" : "negative";
      const [baseCurrency] = opp.pair.split("/"); // Obtém a moeda base (BTC em BTC/USDT)
      const crosses = opp.crossCount || 0;

      row.innerHTML = `
        <td class="pair">
          <div class="currency-pair">
            <i class="${
              cryptoIcons[baseCurrency] || "fas fa-coins"
            } crypto-icon"></i>
            <span>${opp.pair.replace("/", " / ")}</span>
          </div>
        </td>
        <td class="exchange-data">
          <div class="exchange-label ${opp.exit.spot.exchange}" 
               title="${
                 exchangeNamesPT[opp.exit.spot.exchange] ||
                 opp.exit.spot.exchange.toUpperCase()
               }">
            <i class="${
              opp.exit.spot.exchange || "fas fa-exchange-alt"
            } exchange-icon"></i>
            <span class="exchange-name">${
              exchangeNamesPT[opp.exit.spot.exchange] ||
              opp.exit.spot.exchange.toUpperCase()
            }</span>
          </div>
          <div class="price">${formatters.price(opp.exit.spot.price)}</div>
          <div class="volume">${formatVolume(opp.spot.volume)}</div>
        </td>
        <td class="exchange-data">
          <div class="exchange-label ${opp.exit.future.exchange}" 
               title="${
                 exchangeNamesPT[opp.exit.future.exchange] ||
                 opp.exit.future.exchange.toUpperCase()
               }">
            <i class="${
              opp.exit.future.exchange || "fas fa-exchange-alt"
            } exchange-icon"></i>
            <span class="exchange-name">${
              exchangeNamesPT[opp.exit.future.exchange] ||
              opp.exit.future.exchange.toUpperCase()
            }</span>
          </div>
          <div class="price">${formatters.price(opp.exit.future.price)}</div>
        </td>
        <td class="profit ${profitClass}">
          ${formatters.profit(opp.exit.profit)}
          <i class="fas fa-arrow-${opp.exit.profit >= 0 ? "up" : "down"}"></i>
        </td>
        <td class="crosses">
          <div class="cross-badge" data-count="${opp.exit.crossCount || 0}">
            ${opp.exit.crossCount || 0}
          </div>
        </td>
        <td class="actions">
          <button class="action-btn" 
                  onclick="window.executeTrade('${opp.pair}', '${
        opp.exit.spot.exchange
      }', '${opp.exit.future.exchange}')"
                  title="Executar saída em ${
                    exchangeNamesPT[opp.exit.spot.exchange]
                  } e ${exchangeNamesPT[opp.exit.future.exchange]}">
            <i class="fas fa-exchange-alt"></i>
            Negociar
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  static updateStats({ active, maxProfit, bestPair, totalVolume, prevCount }) {
    this.elements.activeOpp.textContent = active;
    this.elements.maxProfit.textContent = formatters.profit(maxProfit);
    this.elements.bestPair.textContent = bestPair || "-";
    this.elements.totalVolume.textContent = formatters.volume(totalVolume);

    // Update change indicator
    const diff = active - prevCount;
    if (diff > 0) {
      this.elements.oppChange.innerHTML = `<i class="fas fa-arrow-up"></i><span>+${diff} novas</span>`;
    } else if (diff < 0) {
      this.elements.oppChange.innerHTML = `<i class="fas fa-arrow-down"></i><span>${diff} menos</span>`;
    }
  }
}
