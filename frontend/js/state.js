// Configurações
export const WS_URL = "ws://localhost:8080";
export const RECONNECT_DELAY = 5000;

// Estado da aplicação
export const state = {
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
    exchanges: {},
    coins: [],
    showOnlyBest: false,
  },
  openTabs: {
    spot: null,
    future: null,
  },
};

// Formatação de números
export const formatters = {
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

export const formatVolume = (value) => {
  if (value >= 1_000_000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
};
