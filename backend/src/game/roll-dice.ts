import { Elysia, t } from "elysia";
import { auth } from "../auth";
import { getUserByUUID, updateUserMoney } from "../auth/query";
import { getGameSession, updateGameStatus, calculateWinnings } from "./bet";
import { getRoom } from "../room/query";

interface DiceGameState {
  gameId: string
  roomId: string
  hostId?: string
  players: Array<{
    id: string
    name: string
    prediction: number | null
    betAmount: number
  }>
  gameStatus: 'waiting' | 'rolling' | 'finished'
  diceResult?: number
  winners?: any[]
  totalPrizePool: number
}

let diceGames: Map<string, DiceGameState> = new Map()

const buildDiceState = async (gameId: string) => {
  const gameSession = await getGameSession(gameId);
  if (!gameSession || gameSession.gameType !== 'roll-dice') {
    return null;
  }

  const players = gameSession.bets.map(bet => ({
    id: bet.playerId,
    name: `Player ${bet.playerId.slice(0, 6)}`,
    prediction: bet.prediction as number,
    betAmount: bet.amount
  }));

  const diceGameState: DiceGameState = {
    gameId,
    roomId: gameSession.roomId,
    hostId: gameSession.hostId,
    players,
    gameStatus: gameSession.status === 'finished' ? 'finished' : 'waiting',
    totalPrizePool: gameSession.totalPrizePool
  };

  if (gameSession.status === 'finished' && typeof gameSession.result === 'number') {
    diceGameState.diceResult = gameSession.result;
  }

  diceGames.set(gameId, diceGameState);
  return diceGameState;
};

export const RollDiceRoute = new Elysia({ prefix: "/game/roll-dice" })
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
      if (!gameSession || gameSession.gameType !== 'roll-dice') {
        throw new Error("Game not found");
      }
      
      // สร้าง dice game state
      const players = gameSession.bets.map(bet => ({
        id: bet.playerId,
        name: `Player ${bet.playerId.slice(0, 6)}`,
        prediction: bet.prediction as number,
        betAmount: bet.amount
      }));
      
      const diceGameState: DiceGameState = {
        gameId,
        roomId: gameSession.roomId,
        hostId: gameSession.hostId,
        players,
        gameStatus: 'waiting',
        totalPrizePool: gameSession.totalPrizePool
      };
      
      diceGames.set(gameId, diceGameState);
      
      return { diceGameState, message: "Dice game initialized" };
    },
    {
      params: t.Object({
        gameId: t.String(),
      }),
    }
  )
  .post(
    "/:gameId/roll",
    async ({ params, user }) => {
      if (!user) {
        throw new Error("Unauthorized");
      }
      
      const { gameId } = params;
      let gameState = diceGames.get(gameId);
      if (!gameState) {
        gameState = await buildDiceState(gameId) ?? undefined;
      }
      
      if (!gameState || gameState.gameStatus !== 'waiting') {
        throw new Error("Game not ready");
      }
      
      if (gameState.hostId && gameState.hostId !== user.id) {
        throw new Error("Only host can roll");
      }
      
      // ทอยลูกเต๋า
      const diceResult = Math.floor(Math.random() * 6) + 1;
      
      // หาผู้ชนะ
      const winners = gameState.players.filter(player => player.prediction === diceResult);
      const winAmount = winners.length > 0 ? Math.floor(gameState.totalPrizePool / winners.length) : 0;
      
      // อัปเดตสถานะเกม
      gameState.gameStatus = 'finished';
      gameState.diceResult = diceResult;
      gameState.winners = winners;
      
      // อัปเดตฐานข้อมูล
      await updateGameStatus(gameId, 'finished', diceResult);
      
      // จ่ายเงินให้ผู้ชนะ
      for (const winner of winners) {
        const { Item } = await getUserByUUID(winner.id);
        if (Item?.money?.N) {
          const currentMoney = Number(Item.money.N);
          await updateUserMoney(winner.id, currentMoney + winAmount);
        }
      }
      
      return { 
        diceResult, 
        winners, 
        winAmount,
        message: "Dice rolled successfully" 
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
      const gameState = diceGames.get(gameId) ?? await buildDiceState(gameId);
      
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
        
        // Ensure state exists for late joiners
        const state = diceGames.get(gameId) ?? await buildDiceState(gameId);
        if (!state) {
          ws.send(JSON.stringify({ type: "error", message: "Game not found" }));
          ws.close(1000, "Game session missing");
          return;
        }

        // Subscribe to dice game updates
        ws.subscribe(`dice:${gameId}`);
        console.log(`User ${user.name} joined dice game ${gameId}`);
        
        // ส่งสถานะเกมปัจจุบัน
        if (state) {
          ws.send(JSON.stringify({
            type: 'game_status',
            hostId: state.hostId,
            players: state.players,
            totalPrizePool: state.totalPrizePool,
            gameStatus: state.gameStatus,
            diceResult: state.diceResult,
            winners: state.winners
          }));
        }
        
      } catch (error) {
        console.error("Dice WebSocket open error:", error);
        ws.close(1011, "Internal error");
      }
    },
    
    async close(ws) {
      try {
        const { gameId } = ws.data.params;
        ws.unsubscribe(`dice:${gameId}`);
        console.log(`User left dice game ${gameId}`);
      } catch (error) {
        console.error("Dice WebSocket close error:", error);
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
              const gameState = diceGames.get(gameId) ?? await buildDiceState(gameId);
              if (gameState) {
                ws.send(JSON.stringify({
                  type: 'game_status',
                  hostId: gameState.hostId,
                  players: gameState.players,
                  totalPrizePool: gameState.totalPrizePool,
                  gameStatus: gameState.gameStatus,
                  diceResult: gameState.diceResult,
                  winners: gameState.winners
                }));
              }
              break;
              
            case "start_roll":
              const currentGameState = diceGames.get(gameId) ?? await buildDiceState(gameId);
              
              if (!currentGameState || currentGameState.gameStatus !== 'waiting') {
                ws.send(JSON.stringify({ type: "error", message: "Game not ready" }));
                break;
              }

              if (currentGameState.hostId && currentGameState.hostId !== user.id) {
                ws.send(JSON.stringify({ type: "error", message: "Only host can roll" }));
                break;
              }
              
              // ทอยลูกเต๋า
              const diceResult = Math.floor(Math.random() * 6) + 1;
              
              // หาผู้ชนะ
              const winners = currentGameState.players.filter(player => player.prediction === diceResult);
              const winAmount = winners.length > 0 ? Math.floor(currentGameState.totalPrizePool / winners.length) : 0;
              
              // อัปเดตสถานะเกม
              currentGameState.gameStatus = 'finished';
              currentGameState.diceResult = diceResult;
              currentGameState.winners = winners;
              
              // ส่ง animation rolling ก่อน
              const rollingPayload = JSON.stringify({
                type: 'dice_rolling',
                result: diceResult,
                winners,
                winAmount
              });
              ws.send(rollingPayload);
              ws.publish(`dice:${gameId}`, rollingPayload);
              
              // อัปเดตฐานข้อมูลและจ่ายเงิน
              setTimeout(async () => {
                try {
                  await updateGameStatus(gameId, 'finished', diceResult);
                  
                  // จ่ายเงินให้ผู้ชนะ
                  for (const winner of winners) {
                    const { Item } = await getUserByUUID(winner.id);
                    if (Item?.money?.N) {
                      const currentMoney = Number(Item.money.N);
                      await updateUserMoney(winner.id, currentMoney + winAmount);
                    }
                  }
                  
                  // ส่งผลลัพธ์สุดท้าย
                  const finishedPayload = JSON.stringify({
                    type: 'game_finished',
                    diceResult,
                    winners,
                    winAmount
                  });
                  ws.send(finishedPayload);
                  ws.publish(`dice:${gameId}`, finishedPayload);
                  
                } catch (error) {
                  console.error("Error finalizing dice game:", error);
                }
              }, 3000); // รอ 3 วินาทีให้ animation จบ
              
              break;
          }
        }
        
      } catch (error) {
        console.error("Dice WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", message: "Internal error" }));
      }
    },
    
    body: t.Union([
      t.Object({ type: t.Literal("get_game_status") }),
      t.Object({ type: t.Literal("start_roll") }),
    ]),
  });
