// utils/exchangeIcons.js
export const exchangeIcons = {
  binance: "/assets/img/exchanges/binance-logo.png",
  gateio: "../assets/img/exchanges/gt.png",
  htx: "/assets/img/exchanges/htx-logo.png",
  mexc: "/assets/img/exchanges/mexc-logo.png",
  bybit: "/assets/img/exchanges/bybit-logo.png",
  kucoin: "/assets/img/exchanges/kucoin-logo.png",
  okx: "/assets/img/exchanges/okx-logo.png",
  // Add more as needed
};

export const getExchangeIcon = (exchange) => {
  return exchangeIcons[exchange.toLowerCase()] || "";
};
