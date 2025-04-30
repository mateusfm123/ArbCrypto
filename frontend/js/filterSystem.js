import { state } from "./state.js";

export class FilterSystem {
  static applyAllFilters() {
    return state.opportunities.filter((opp) => {
      // Filtro de lucro
      if (
        opp.profit < state.filters.minProfit ||
        opp.profit > state.filters.maxProfit
      ) {
        return false;
      }

      // Filtro de exchange
      if (Object.keys(state.filters.exchanges).length > 0) {
        const spotAllowed =
          state.filters.exchanges[opp.spot.exchange] !== false;
        const futureAllowed =
          state.filters.exchanges[opp.future.exchange] !== false;
        if (!spotAllowed || !futureAllowed) return false;
      }

      // Filtro de moedas
      if (
        state.filters.coins.length > 0 &&
        !state.filters.coins.includes(opp.pair)
      ) {
        return false;
      }

      return true;
    });
  }

  static updateFilterSettings(settings) {
    state.filters = { ...state.filters, ...settings };
    document.dispatchEvent(new Event("filtersUpdated"));
  }

  static initExchangeFilters() {
    const exchangeContainer = document.getElementById("exchange-filters");

    // Limpa o container antes de recriar
    exchangeContainer.innerHTML = "";

    // Cria um Set com todas as exchanges únicas
    const allExchanges = new Set();
    state.opportunities.forEach((opp) => {
      allExchanges.add(opp.spot.exchange);
      allExchanges.add(opp.future.exchange);
    });

    // Ordena as exchanges alfabeticamente
    const sortedExchanges = Array.from(allExchanges).sort();

    // Cria os elementos de filtro para cada exchange
    sortedExchanges.forEach((exchange) => {
      // Inicializa no state se não existir
      if (state.filters.exchanges[exchange] === undefined) {
        state.filters.exchanges[exchange] = true;
      }

      // Cria o elemento HTML
      const exchangeId = `exchange-${exchange}`;
      const label = document.createElement("label");
      label.className = "exchange-filter";
      label.htmlFor = exchangeId;
      label.title = exchangeNamesPT[exchange] || exchange.toUpperCase();

      label.innerHTML = `
        <input type="checkbox" 
               id="${exchangeId}" 
               name="exchange" 
               value="${exchange}"
               ${state.filters.exchanges[exchange] ? "checked" : ""}>
        <span class="custom-checkbox"></span>
        <span class="exchange-name">${
          exchangeNamesPT[exchange] || exchange.toUpperCase()
        }</span>
      `;

      // Adiciona evento para atualizar o state
      const input = label.querySelector("input");
      input.addEventListener("change", (e) => {
        state.filters.exchanges[exchange] = e.target.checked;
      });

      exchangeContainer.appendChild(label);
    });

    // Adiciona estilos dinâmicos se necessário
    this.styleExchangeFilters();
  }

  static styleExchangeFilters() {
    const style = document.createElement("style");
    style.textContent = `
      .exchange-filters {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      
      .exchange-filter {
        display: flex;
        align-items: center;
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        background-color: #363d4f;
        transition: background-color 0.2s;
      }
      
      .exchange-filter:hover {
        background-color: #3a4055;
      }
      
      .exchange-filter input {
        opacity: 0;
        position: absolute;
      }
      
      .custom-checkbox {
        width: 16px;
        height: 16px;
        border: 1px solid #5468ff;
        border-radius: 3px;
        margin-right: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      .exchange-filter input:checked + .custom-checkbox {
        background-color: #5468ff;
      }
      
      .exchange-filter input:checked + .custom-checkbox::after {
        content: '✓';
        color: white;
        font-size: 12px;
      }
      
      .exchange-name {
        font-size: 0.85rem;
        color: #b8c1d9;
      }
    `;
    document.head.appendChild(style);
  }

  static initCoinFilters() {
    const allCoins = new Set();
    state.opportunities.forEach((opp) => {
      allCoins.add(opp.pair);
    });

    state.filters.coins = Array.from(allCoins);
  }
}
