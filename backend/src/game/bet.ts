import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutItemCommand, GetItemCommand, UpdateItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ulid } from "ulid";
import { getRoom, setRoom } from "../room/query";
import { db } from "../database";

export interface GameBet {
  id: string;
  roomId: string;
  playerId: string;
  gameType: 'roll-dice' | 'spin-wheel' | 'match-fixing' | 'vote';
  amount: number;
  prediction?: any; // การทายผล (ขึ้นอยู่กับประเภทเกม)
  status: 'pending' | 'won' | 'lost' | 'draw';
  winAmount?: number;
  createdAt: string;
}

export interface GameSession {
  id: string;
  roomId: string;
  gameType: 'roll-dice' | 'spin-wheel' | 'match-fixing' | 'vote';
  status: 'betting' | 'playing' | 'finished';
  hostId?: string;
  bets: GameBet[];
  result?: any;
  totalPrizePool: number;
  createdAt: string;
  finishedAt?: string;
}

export async function createGameSession(roomId: string, gameType: GameSession['gameType']): Promise<GameSession> {
  const gameSession: GameSession = {
    id: ulid(),
    roomId,
    gameType,
    status: 'betting',
    bets: [],
    totalPrizePool: 0,
    createdAt: new Date().toISOString()
  };

  // บันทึกใน room แทนที่จะสร้าง table ใหม่
  const room = await getRoom(roomId);
  if (!room) throw new Error("Room not found");
  gameSession.hostId = room.hostId;

  // เพิ่มข้อมูลเกมเข้าไปใน room
  await db.send(new UpdateItemCommand({
    TableName: "Rooms",
    Key: marshall({ id: roomId }),
    UpdateExpression: "SET gameSession = :gameSession",
    ExpressionAttributeValues: marshall({
      ":gameSession": gameSession
    })
  }));

  return gameSession;
}

export async function getGameSession(gameId: string): Promise<GameSession | null> {
  try {
    // ค้นหาใน rooms ทั้งหมดที่มี gameSession.id ตรงกับ gameId
    const response = await db.send(new ScanCommand({
      TableName: "Rooms",
      ConsistentRead: true,
      FilterExpression: "gameSession.id = :gameId",
      ExpressionAttributeValues: marshall({
        ":gameId": gameId
      })
    }));

    if (!response.Items || response.Items.length === 0) return null;

    const roomItem = response.Items[0];
    if (!roomItem) return null;
    
    const room = unmarshall(roomItem);
    return room.gameSession as GameSession;
  } catch (error) {
    console.error("Error getting game session:", error);
    return null;
  }
}

export async function addBet(gameId: string, bet: Omit<GameBet, 'id' | 'createdAt'>): Promise<GameBet> {
  const gameBet: GameBet = {
    ...bet,
    id: ulid(),
    createdAt: new Date().toISOString()
  };

  // อัปเดต game session เพื่อเพิ่ม bet
  const game = await getGameSession(gameId);
  if (!game) throw new Error("Game not found");

  game.bets.push(gameBet);
  game.totalPrizePool += bet.amount;

  // อัปเดต room
  await db.send(new UpdateItemCommand({
    TableName: "Rooms",
    Key: marshall({ id: bet.roomId }),
    UpdateExpression: "SET gameSession = :gameSession",
    ExpressionAttributeValues: marshall({
      ":gameSession": game
    })
  }));

  return gameBet;
}

export async function updateGameStatus(gameId: string, status: GameSession['status'], result?: any): Promise<void> {
  const game = await getGameSession(gameId);
  if (!game) throw new Error("Game not found");

  game.status = status;
  if (result) game.result = result;
  if (status === 'finished') game.finishedAt = new Date().toISOString();

  // อัปเดต room
  await db.send(new UpdateItemCommand({
    TableName: "Rooms",
    Key: marshall({ id: game.roomId }),
    UpdateExpression: "SET gameSession = :gameSession",
    ExpressionAttributeValues: marshall({
      ":gameSession": game
    })
  }));
}

export async function calculateWinnings(gameId: string): Promise<{ [playerId: string]: number }> {
  const game = await getGameSession(gameId);
  if (!game || !game.result) throw new Error("Game not finished");

  const winnings: { [playerId: string]: number } = {};
  
  // คำนวณผลตามประเภทเกม
  switch (game.gameType) {
    case 'roll-dice':
      return calculateDiceWinnings(game);
    case 'spin-wheel':
      return calculateSpinWheelWinnings(game);
    case 'match-fixing':
      return calculateMatchFixingWinnings(game);
    case 'vote':
      return calculateVoteWinnings(game);
    default:
      return {};
  }
}

function calculateDiceWinnings(game: GameSession): { [playerId: string]: number } {
  const diceResult = game.result as number;
  const winnings: { [playerId: string]: number } = {};
  
  // หาผู้ที่ทายถูก
  const winners = game.bets.filter(bet => bet.prediction === diceResult);
  
  if (winners.length === 0) {
    // ไม่มีใครชนะ
    return {};
  }
  
  // แบ่งเงินรางวัลให้ผู้ชนะ
  const prizePerWinner = game.totalPrizePool / winners.length;
  
  winners.forEach(bet => {
    winnings[bet.playerId] = (winnings[bet.playerId] || 0) + prizePerWinner;
  });
  
  return winnings;
}

function calculateSpinWheelWinnings(game: GameSession): { [playerId: string]: number } {
  const winnerId = game.result as string;
  return { [winnerId]: game.totalPrizePool };
}

function calculateMatchFixingWinnings(game: GameSession): { [playerId: string]: number } {
  const correctAnswers = game.result as string[];
  const winnings: { [playerId: string]: number } = {};
  
  // หาผู้ที่ตอบถูกทุกข้อ
  const winners = game.bets.filter(bet => {
    const answers = bet.prediction as string[];
    return JSON.stringify(answers) === JSON.stringify(correctAnswers);
  });
  
  if (winners.length === 0) return {};
  
  const prizePerWinner = game.totalPrizePool / winners.length;
  winners.forEach(bet => {
    winnings[bet.playerId] = prizePerWinner;
  });
  
  return winnings;
}

function calculateVoteWinnings(game: GameSession): { [playerId: string]: number } {
  const winningOption = game.result as string;
  const winnings: { [playerId: string]: number } = {};
  
  // หาผู้ที่โหวตให้ตัวเลือกที่ชนะ
  const winners = game.bets.filter(bet => bet.prediction === winningOption);
  
  if (winners.length === 0) return {};
  
  const prizePerWinner = game.totalPrizePool / winners.length;
  winners.forEach(bet => {
    winnings[bet.playerId] = prizePerWinner;
  });
  
  return winnings;
}
