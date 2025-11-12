import { Elysia, t } from "elysia";
import { auth } from "../auth";
import { getUserByUUID, updateUserMoney } from "../auth/query";
import { getGameSession, updateGameStatus } from "./bet";

interface SpinWheelGameState {
  gameId: string
  roomId: string
  hostId?: string
  players: Array<{
    id: string
    name: string
    betAmount: number
  }>
  gameStatus: 'waiting' | 'spinning' | 'finished'
  winnerId?: string
  winnerName?: string
  totalPrizePool: number
}

let spinWheelGames: Map<string, SpinWheelGameState> = new Map()

const buildSpinWheelState = (session: Awaited<ReturnType<typeof getGameSession>>) => {
  if (!session || session.gameType !== "spin-wheel") {
    return null;
  }

  const players = session.bets.map(bet => ({
    id: bet.playerId,
    name: `Player ${bet.playerId.slice(0, 6)}`,
    betAmount: bet.amount
  }));

  const state: SpinWheelGameState = {
    gameId: session.id,
    roomId: session.roomId,
    hostId: session.hostId,
    players,
    gameStatus: session.status === "finished" ? "finished" : "waiting",
    totalPrizePool: session.totalPrizePool,
  };

  if (session.status === "finished" && typeof session.result === "string") {
    state.winnerId = session.result;
    state.winnerName = `Player ${session.result.slice(0, 6)}`;
  }

  return state;
};

const ensureSpinWheelState = async (gameId: string) => {
  let gameState = spinWheelGames.get(gameId);
  if (gameState) {
    return gameState;
  }

  const session = await getGameSession(gameId);
  gameState = buildSpinWheelState(session);
  if (gameState) {
    spinWheelGames.set(gameId, gameState);
  }
  return gameState;
};

export const SpinWheelRoute = new Elysia({ prefix: "/game/spin-wheel" })
  .use(auth)
  .derive(async ({ request, jwt }) => {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return { user: null };
    }
    const payload = await jwt.verify(token);
    if (!payload) {
      return { user: null };
    }
    const { Item } = await getUserByUUID(payload.uuid);
    if (!Item || !Item.id?.S || !Item.username?.S) {
      return { user: null };
    }
    return {
      user: {
        id: Item.id.S,
        name: Item.username.S,
      },
    };
  })
  .post(
    "/:gameId/start",
    async ({ params, user }) => {
      if (!user) {
        throw new Error("Unauthorized");
      }
      
      const { gameId } = params;
      
      // ดึงข้อมูลเกมจากฐานข้อมูล
      const gameSession = await getGameSession(gameId);
      if (!gameSession || gameSession.gameType !== 'spin-wheel') {
        throw new Error("Game not found");
      }
      
      // สร้าง spin wheel game state
      const players = gameSession.bets.map(bet => ({
        id: bet.playerId,
        name: `Player ${bet.playerId.slice(0, 6)}`,
        betAmount: bet.amount
      }));
      
      const spinWheelGameState: SpinWheelGameState = {
        gameId,
        roomId: gameSession.roomId,
        hostId: gameSession.hostId,
        players,
        gameStatus: 'waiting',
        totalPrizePool: gameSession.totalPrizePool
      };
      
      spinWheelGames.set(gameId, spinWheelGameState);
      
      return { spinWheelGameState, message: "Spin Wheel game initialized" };
    },
    {
      params: t.Object({
        gameId: t.String(),
      }),
    }
  )
  .post(
    "/:gameId/spin",
    async ({ params, user }) => {
      if (!user) {
        throw new Error("Unauthorized");
      }
      
      const { gameId } = params;
      const gameState = spinWheelGames.get(gameId);
      
      if (!gameState || gameState.gameStatus !== 'waiting') {
        throw new Error("Game not ready");
      }
      
      // สุ่มผู้ชนะ
      if (gameState.players.length === 0) {
        throw new Error("No players in game");
      }
      
      const randomIndex = Math.floor(Math.random() * gameState.players.length);
      const winner = gameState.players[randomIndex];
      
      if (!winner) {
        throw new Error("Winner not found");
      }
      
      // อัปเดตสถานะเกม
      gameState.gameStatus = 'finished';
      gameState.winnerId = winner.id;
      gameState.winnerName = winner.name;
      
      // อัปเดตฐานข้อมูล
      await updateGameStatus(gameId, 'finished', winner.id);
      
      // จ่ายเงินให้ผู้ชนะ
      const { Item } = await getUserByUUID(winner.id);
      if (Item?.money?.N) {
        const currentMoney = Number(Item.money.N);
        await updateUserMoney(winner.id, currentMoney + gameState.totalPrizePool);
      }
      
      return { 
        winnerId: winner.id,
        winnerName: winner.name,
        totalWinAmount: gameState.totalPrizePool,
        message: "Wheel spun successfully" 
      };
    },
    {
      params: t.Object({
        gameId: t.String(),
      }),
    }
  )
  .get(
    "/:gameId/status",
    async ({ params, user }) => {
      if (!user) {
        throw new Error("Unauthorized");
      }
      
      const { gameId } = params;
      const gameState = await ensureSpinWheelState(gameId);
      
      if (!gameState) {
        throw new Error("Game not found");
      }
      
      return { gameState };
    },
    {
      params: t.Object({
        gameId: t.String(),
      }),
    }
  )
  .ws("/ws/:gameId", {
    headers: t.Object({
      'sec-websocket-protocol': t.Optional(t.String()),
    }),
    async open(ws) {
      try {
        const { gameId } = ws.data.params;
        const protocol = ws.data.headers['sec-websocket-protocol'];
        
        if (!protocol) {
          ws.close(1008, "Unauthorized");
          return;
        }

        const token = protocol.split(",").map(s => s.trim())[1];
        if (!token) {
          ws.close(1008, "Unauthorized");
          return;
        }

        const payload = await ws.data.jwt.verify(token.replace("Bearer ", ""));
        if (!payload) {
          ws.close(1008, "Invalid token");
          return;
        }

        const { Item } = await getUserByUUID(payload.uuid);
        if (!Item || !Item.id?.S || !Item.username?.S) {
          ws.close(1008, "User not found");
          return;
        }

        const user = { id: Item.id.S, name: Item.username.S };
        
        // Ensure state exists (handles page refresh / late joiners)
        const existingState = await ensureSpinWheelState(gameId);
        if (!existingState) {
          ws.send(JSON.stringify({ type: "error", message: "Game not found" }));
          ws.close(1000, "Game session missing");
          return;
        }

        // Subscribe to spin wheel game updates
        ws.subscribe(`spinwheel:${gameId}`);
        console.log(`User ${user.name} joined spin wheel game ${gameId}`);
        
        // ส่งสถานะเกมปัจจุบัน
        if (existingState) {
          ws.send(JSON.stringify({
            type: 'game_status',
            players: existingState.players,
            totalPrizePool: existingState.totalPrizePool,
            gameStatus: existingState.gameStatus,
            winnerId: existingState.winnerId,
            winnerName: existingState.winnerName,
            hostId: existingState.hostId ?? existingState.players[0]?.id ?? null
          }));
        }
        
      } catch (error) {
        console.error("Spin Wheel WebSocket open error:", error);
        ws.close(1011, "Internal error");
      }
    },
    
    async close(ws) {
      try {
        const { gameId } = ws.data.params;
        ws.unsubscribe(`spinwheel:${gameId}`);
        console.log(`User left spin wheel game ${gameId}`);
      } catch (error) {
        console.error("Spin Wheel WebSocket close error:", error);
      }
    },
    
    async message(ws, message) {
      try {
        const { gameId } = ws.data.params;
        const protocol = ws.data.headers['sec-websocket-protocol'];
        
        if (!protocol) {
          ws.close(1008, "Unauthorized");
          return;
        }

        const token = protocol.split(",").map(s => s.trim())[1];
        if (!token) {
          ws.close(1008, "Unauthorized");
          return;
        }

        const payload = await ws.data.jwt.verify(token.replace("Bearer ", ""));
        if (!payload) {
          ws.close(1008, "Invalid token");
          return;
        }

        const { Item } = await getUserByUUID(payload.uuid);
        if (!Item || !Item.id?.S || !Item.username?.S) {
          ws.close(1008, "User not found");
          return;
        }

        const user = { id: Item.id.S, name: Item.username.S };
        
        if (typeof message !== "object" || message === null) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
          return;
        }

        // Handle different message types
        if ("type" in message) {
          switch (message.type) {
            case "get_game_status":
              const gameState = spinWheelGames.get(gameId);
              if (gameState) {
                ws.send(JSON.stringify({
                  type: 'game_status',
                  players: gameState.players,
                  totalPrizePool: gameState.totalPrizePool,
                  gameStatus: gameState.gameStatus,
                  winnerId: gameState.winnerId,
                  winnerName: gameState.winnerName,
                  hostId: gameState.hostId ?? gameState.players[0]?.id ?? null
                }));
              }
              break;
              
            case "start_spin":
              let currentGameState = spinWheelGames.get(gameId);
              if (!currentGameState) {
                currentGameState = await ensureSpinWheelState(gameId);
              }
              
              if (!currentGameState || currentGameState.gameStatus !== 'waiting') {
                ws.send(JSON.stringify({ type: "error", message: "Game not ready" }));
                break;
              }

              if (currentGameState.hostId && currentGameState.hostId !== user.id) {
                ws.send(JSON.stringify({ type: "error", message: "Only host can spin the wheel" }));
                break;
              }
              
              // สุ่มผู้ชนะ
              if (currentGameState.players.length === 0) {
                ws.send(JSON.stringify({ type: "error", message: "No players in game" }));
                break;
              }
              
              const randomIndex = Math.floor(Math.random() * currentGameState.players.length);
              const winner = currentGameState.players[randomIndex];
              
              if (!winner) {
                ws.send(JSON.stringify({ type: "error", message: "Winner not found" }));
                break;
              }
              
              // อัปเดตสถานะเกม
              currentGameState.gameStatus = 'finished';
              currentGameState.winnerId = winner.id;
              currentGameState.winnerName = winner.name;
              
              // ส่ง animation spinning ก่อน
              ws.publish(`spinwheel:${gameId}`, JSON.stringify({
                type: 'wheel_spinning',
                winnerId: winner.id,
                winnerName: winner.name,
                totalWinAmount: currentGameState.totalPrizePool
              }));
              
              // อัปเดตฐานข้อมูลและจ่ายเงิน
              setTimeout(async () => {
                try {
                  await updateGameStatus(gameId, 'finished', winner.id);
                  
                  // จ่ายเงินให้ผู้ชนะ
                  const { Item } = await getUserByUUID(winner.id);
                  if (Item?.money?.N) {
                    const currentMoney = Number(Item.money.N);
                    await updateUserMoney(winner.id, currentMoney + currentGameState.totalPrizePool);
                  }
                  
                  // ส่งผลลัพธ์สุดท้าย
                  ws.publish(`spinwheel:${gameId}`, JSON.stringify({
                    type: 'game_finished',
                    winnerId: winner.id,
                    winnerName: winner.name,
                    totalWinAmount: currentGameState.totalPrizePool
                  }));
                  
                } catch (error) {
                  console.error("Error finalizing spin wheel game:", error);
                }
              }, 5000); // รอ 5 วินาทีให้ animation จบ
              
              break;
          }
        }
        
      } catch (error) {
        console.error("Spin Wheel WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", message: "Internal error" }));
      }
    },
    
    body: t.Union([
      t.Object({ type: t.Literal("get_game_status") }),
      t.Object({ type: t.Literal("start_spin") }),
    ]),
  });
