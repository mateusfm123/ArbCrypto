import { FilterSystem } from "./filterSystem.js";
import { state } from "./state.js";

export const FilterModal = {
  init() {
    this.setupEvents();
    FilterSystem.updateFilterUI();
  },

  setupEvents() {
    document
      .getElementById("open-filters")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("close-modal")
      ?.addEventListener("click", () => this.close());
    document
      .getElementById("cancel-filters")
      ?.addEventListener("click", () => this.close());
    document
      .getElementById("apply-filters")
      ?.addEventListener("click", () => this.apply());
    document
      .getElementById("select-all")
      ?.addEventListener("click", () => FilterSystem.selectAllCoins());
    document
      .getElementById("deselect-all")
      ?.addEventListener("click", () => FilterSystem.deselectAllCoins());
    document
      .getElementById("coin-search")
      ?.addEventListener("input", () => FilterSystem.updateCoinList());
  },

  open() {
    const modal = document.getElementById("filter-modal");
    if (modal) {
      FilterSystem.updateFilterUI();
      modal.classList.add("active");
    }
  },

  close() {
    const modal = document.getElementById("filter-modal");
    if (modal) modal.classList.remove("active");
  },

  apply() {
    // Atualiza filtros de lucro
    const minProfit = parseFloat(document.getElementById("min-profit").value);
    const maxProfit = parseFloat(document.getElementById("max-profit").value);

    state.filters.minProfit = isNaN(minProfit) ? -10 : minProfit;
    state.filters.maxProfit = isNaN(maxProfit) ? 100 : maxProfit;

    // Atualiza exchanges
    state.filters.exchanges = {};
    document
      .querySelectorAll('#exchange-filters input[type="checkbox"]')
      .forEach((cb) => {
        const exchange = cb.id.replace("ex-", "");
        state.filters.exchanges[exchange] = cb.checked;
      });

    this.close();

    // Dispara evento personalizado para atualizar a UI
    document.dispatchEvent(new CustomEvent("filtersUpdated"));
  },
};
