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

export const joinWSGame = (roomCode: string) => {
  const [, setWS] = useWSClient(); // eslint-disable-line
  const [, setMessage] = useWSMessage(); // eslint-disable-line

  const client = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/games/${roomCode}`);
  client.addEventListener('open', () => {
    setWS(client);
    console.log('Game joined:', roomCode);
  });


  client.addEventListener('close', () => {
    console.log("WebSocket Client Disconnected");
    setWS(null);
  });

  client.addEventListener('message', (message) => {
    console.log("WebSocket Message Received:", message.data);
    setMessage(JSON.parse(message.data));
  });
}

