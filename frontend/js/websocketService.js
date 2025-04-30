import { RECONNECT_DELAY, state, WS_URL } from "./state.js";

export class WebSocketService {
  static connect() {
    if (
      state.socket &&
      [WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket.readyState)
    ) {
      return;
    }

    this.updateStatus("connecting");
    state.socket = new WebSocket(WS_URL);

    state.socket.onopen = () => {
      this.updateStatus("connected");
      console.log("Conectado ao WebSocket");
    };

    state.socket.onclose = () => {
      this.updateStatus("disconnected");
      console.log("Conexão perdida. Tentando reconectar...");
      setTimeout(() => this.connect(), RECONNECT_DELAY);
    };

    state.socket.onerror = (error) => {
      console.error("Erro no WebSocket:", error);
      this.updateStatus("error");
    };

    state.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.processMessage(data);
      } catch (error) {
        console.error("Erro ao processar mensagem:", error);
      }
    };
  }

  static processMessage(data) {
    if (Array.isArray(data)) {
      state.opportunities = data;
      this.updateStatistics();
      document.dispatchEvent(
        new CustomEvent("dataUpdated", {
          detail: { opportunities: data },
        })
      );
    }
  }

  static updateStatistics() {
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
      lastUpdated: new Date(),
    };

    document.dispatchEvent(
      new CustomEvent("statsUpdated", {
        detail: { ...state.stats, prevCount },
      })
    );
  }

  static updateStatus(status) {
    state.status = status;
    document.dispatchEvent(
      new CustomEvent("statusUpdated", {
        detail: status,
      })
    );
  }

  static executeTrade(pair) {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
      alert("Erro: Não conectado ao servidor");
      return false;
    }

    const message = {
      type: "execute_trade",
      pair: pair,
      timestamp: new Date().toISOString(),
    };

    state.socket.send(JSON.stringify(message));
    return true;
  }
}
