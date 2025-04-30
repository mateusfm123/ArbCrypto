import { FilterSystem } from "./filterSystem.js";
import { state } from "./state.js";
import { UIService } from "./uiService.js";
import { WebSocketService } from "./websocketService.js";

class VemCryptoDashboard {
  static init() {
    UIService.init();
    WebSocketService.connect();
    this.setupEventListeners();
    this.loadInitialData();
  }

  static loadInitialData() {
    // Simulação de dados iniciais
    state.opportunities = [];

    FilterSystem.initExchangeFilters();
    FilterSystem.initCoinFilters();
    document.dispatchEvent(new Event("dataUpdated"));
  }

  static setupEventListeners() {
    document.addEventListener("statusUpdated", (e) => {
      UIService.updateStatusIndicator(e.detail);
    });

    document.addEventListener("dataUpdated", () => {
      const filtered = FilterSystem.applyAllFilters();
      UIService.renderOpportunities(filtered);
    });

    document.addEventListener("statsUpdated", (e) => {
      UIService.updateStats(e.detail);
    });

    document.addEventListener("filtersUpdated", () => {
      const filtered = FilterSystem.applyAllFilters();
      UIService.renderOpportunities(filtered);
      UIService.updateStats(state.stats);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  VemCryptoDashboard.init();
});

window.executeTrade = (pair, spotExchange, futureExchange) => {
  const formattedPair = pair.replace("/", "_").toUpperCase();

  const exchangeUrls = {
    binance: {
      spot: `https://www.binance.com/en/trade/${formattedPair}`,
    },
    gateio: {
      spot: `https://www.gate.io/trade/${formattedPair}`,
    },
    htx: {
      spot: `https://www.htx.com/trade/${formattedPair.toLowerCase()}_spot`,
    },
    mexc: {
      spot: `https://www.mexc.com/exchange/${formattedPair}`,
      future: `https://www.mexc.com/futures/${formattedPair}`,
    },
    mercadobitcoin: {
      spot: `https://www.mercadobitcoin.com.br/trade/${formattedPair.replace(
        "_",
        "/"
      )}`,
    },
    foxbit: {
      spot: `https://trade.foxbit.com.br/exchange/${formattedPair.replace(
        "_",
        "-"
      )}`,
    },
  };

  const updateOrOpenTab = (exchange, type, url) => {
    const tab = state.openTabs[exchange]?.[type];

    if (tab && !tab.closed) {
      try {
        tab.location.href = url;
        tab.focus();
        return true;
      } catch (e) {
        console.warn(
          `Não foi possível recarregar a aba ${type} da ${exchange}:`,
          e
        );
      }
    }

    // Se chegou aqui, precisa abrir nova aba
    const newTab = window.open(url, `crypto_${exchange}_${type}`);
    if (state.openTabs[exchange]) {
      state.openTabs[exchange][type] = newTab;
    } else {
      state.openTabs[exchange] = { [type]: newTab };
    }
    return false;
  };

  // Gerencia aba spot
  if (exchangeUrls[spotExchange]?.spot) {
    updateOrOpenTab(spotExchange, "spot", exchangeUrls[spotExchange].spot);
  }

  // Gerencia aba future
  if (exchangeUrls[futureExchange]?.future) {
    updateOrOpenTab(
      futureExchange,
      "future",
      exchangeUrls[futureExchange].future
    );
  } else if (exchangeUrls[futureExchange]?.spot) {
    updateOrOpenTab(
      futureExchange,
      "future",
      exchangeUrls[futureExchange].spot
    );
  }
};

// Alternar entre Dashboard e Exit Table
document.getElementById("menu-exit").addEventListener("click", () => {
  // Esconde a tabela de oportunidades
  document.querySelector(".opportunities-container").style.display = "none";
  // Exibe a tabela de saída
  document.getElementById("exit-table-container").style.display = "block";

  // Atualiza a navegação
  document.getElementById("menu-dashboard").classList.remove("active");
  document.getElementById("menu-exit").classList.add("active");

  // Filtra e renderiza os dados de saída
  const filtered = FilterSystem.applyAllFilters();
  UIService.renderExits(filtered);
});

document.getElementById("menu-dashboard").addEventListener("click", () => {
  // Exibe a tabela de oportunidades
  document.querySelector(".opportunities-container").style.display = "block";
  // Esconde a tabela de saída
  document.getElementById("exit-table-container").style.display = "none";

  // Atualiza a navegação
  document.getElementById("menu-exit").classList.remove("active");
  document.getElementById("menu-dashboard").classList.add("active");
});
