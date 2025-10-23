import { atom, useAtom } from "jotai";

/** Public hook: returns a type-safe send() */
type WSMessage = { type: string; payload?: unknown };

const wsMessage = atom<WSMessage | null>(null);
const wsClient = atom<WebSocket | null>(null);

export const useWSMessage = () => useAtom(wsMessage);
export const useWSClient = () => useAtom(wsClient);
export const useWSSend = () => {
  const [client] = useWSClient();

  function send(msg: WSMessage) {
    const frame = typeof msg === "string" ? (msg as unknown as string) : JSON.stringify(msg);

    if (client) {
      client.send(frame);
    }
  }

  return send;
}

export const joinWSGame = (id: string) => {
  return new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/games/${id}`);
}

