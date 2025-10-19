import { create } from "zustand";
import WSConnector from "./Connector";

export const useWS = create((set) => ({
  client: null,
  ready: false,
  connect: () => {
    const client = new WebSocket("ws://localhost:4000/ws");
    client.onopen = () => {
      console.log("WebSocket Client Connected");
      set({ ready: client.readyState === WebSocket.OPEN });
    };

    client.onclose = () => {
      console.log("WebSocket Client Disconnected");
      set({ ready: false });
    };

    client.onmessage = (message) => {
      console.log("WebSocket Message Received:", message.data);
    };
    set({ client });
  },
  send: (message) => {
    set((state) => {
      const json = JSON.stringify(message);
      state.client?.send(json);
      return state;
    }, false);
  }
}));


export { WSConnector };