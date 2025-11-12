import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { GetCommand, PutCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import type { GameSession, GameBet } from './bet'
import { createGameSession, addBet, calculateWinnings } from './bet'
import { getUserByUUID, updateUserMoney } from '../auth/query'
import { db } from '../database'

interface VoteOption {
  id: string
  text: string
  votes: number
  voters: string[]
}

interface VoteGameState {
  gameId: string
  hostId: string
  players: Array<{
    id: string
    name: string
    betAmount: number
    vote: string | null
    isHost: boolean
  }>
  voteOptions: VoteOption[]
  gameStatus: 'setup' | 'voting' | 'finished'
  totalPrizePool: number
  gameSession?: GameSession
}

const voteGames = new Map<string, VoteGameState>()

export const VoteRoute = new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET!,
  }))
  .ws('/game/vote/:gameId', {
    beforeHandle: async ({ jwt, headers, set }) => {
      try {
        const authHeader = headers.authorization
        let token = ''
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7)
        } else if (headers['sec-websocket-protocol']) {
          const protocols = headers['sec-websocket-protocol'].split(',').map(p => p.trim())
          const tokenIndex = protocols.findIndex(p => p === 'token')
          if (tokenIndex !== -1 && protocols[tokenIndex + 1]) {
            token = protocols[tokenIndex + 1] || ''
          }
        }

        if (!token) {
          set.status = 401
          return { error: 'No token provided' }
        }

        const cleanToken = token.replace(/^Bearer\s+/i, '')
        const payload = await jwt.verify(cleanToken)
        if (!payload || !payload.sub) {
          set.status = 401
          return { error: 'Invalid token' }
        }

        // ตรวจสอบว่า user มีอยู่จริง
        const userResult = await getUserByUUID(payload.sub)
        if (!userResult.Item) {
          set.status = 404
          return { error: 'User not found' }
        }

        return { userId: payload.sub }
      } catch (error) {
        console.error('Auth error:', error)
        set.status = 401
        return { error: 'Authentication failed' }
      }
    },
    open: async (ws) => {
      console.log('Vote WebSocket connected')
    },
    message: async (ws, message) => {
      try {
        const data = JSON.parse(message as string)
        const { gameId } = ws.data.params as { gameId: string }
        const userId = (ws.data as any).userId

        // ดึงข้อมูลผู้ใช้
        const userResult = await getUserByUUID(userId)
        if (!userResult.Item) {
          ws.send(JSON.stringify({ type: 'error', message: 'User not found' }))
          return
        }

        const userMoney = Number(userResult.Item.money?.N || 0)

        let game = voteGames.get(gameId)
        
        if (!game) {
          // ดึงข้อมูลเกมจากฐานข้อมูล
          const response = await db.send(new GetCommand({
            TableName: 'GameSessions',
            Key: { gameId }
          }))

          if (response.Item && response.Item.gameType === 'vote') {
            const session = response.Item as any
            
            game = {
              gameId,
              hostId: session.createdBy || userId,
              players: session.bets?.map((bet: any) => ({
                id: bet.playerId,
                name: `Player ${bet.playerId}`,
                betAmount: bet.amount,
                vote: null,
                isHost: bet.playerId === session.createdBy
              })) || [],
              voteOptions: session.voteOptions || [],
              gameStatus: 'setup',
              totalPrizePool: session.totalPrizePool || 0,
              gameSession: session
            }
            voteGames.set(gameId, game)
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }))
            return
          }
        }

        // เพิ่มผู้เล่นใหม่ถ้ายังไม่มี
        if (!game.players.find(p => p.id === userId)) {
          const betAmount = game.gameSession?.bets?.find((b: any) => b.playerId === userId)?.amount || 0
          game.players.push({
            id: userId,
            name: `Player ${userId}`,
            betAmount,
            vote: null,
            isHost: userId === game.hostId
          })
        }

        if (data.type === 'get_game_status') {
          ws.send(JSON.stringify({
            type: 'game_status',
            gameId: game.gameId,
            hostId: game.hostId,
            players: game.players,
            voteOptions: game.voteOptions,
            gameStatus: game.gameStatus,
            totalPrizePool: game.totalPrizePool
          }))
        }

        if (data.type === 'add_option') {
          // เฉพาะ host เท่านั้นที่เพิ่มตัวเลือกได้
          if (userId !== game.hostId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only host can add options' }))
            return
          }

          const option: VoteOption = {
            id: Date.now().toString(),
            text: data.text,
            votes: 0,
            voters: []
          }

          game.voteOptions.push(option)

          // อัปเดตฐานข้อมูล
          if (game.gameSession) {
            await db.send(new UpdateCommand({
              TableName: 'GameSessions',
              Key: { gameId },
              UpdateExpression: 'SET voteOptions = :voteOptions',
              ExpressionAttributeValues: {
                ':voteOptions': game.voteOptions
              }
            }))
          }

          ws.send(JSON.stringify({
            type: 'option_added',
            voteOptions: game.voteOptions
          }))
        }

        if (data.type === 'start_voting') {
          // เฉพาะ host เท่านั้นที่เริ่มโหวตได้
          if (userId !== game.hostId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only host can start voting' }))
            return
          }

          if (game.voteOptions.length < 2) {
            ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 options' }))
            return
          }

          game.gameStatus = 'voting'

          // อัปเดตฐานข้อมูล
          if (game.gameSession) {
            await db.send(new UpdateCommand({
              TableName: 'GameSessions',
              Key: { gameId },
              UpdateExpression: 'SET gameStatus = :status',
              ExpressionAttributeValues: {
                ':status': 'playing'
              }
            }))
          }

          ws.send(JSON.stringify({
            type: 'voting_started',
            voteOptions: game.voteOptions
          }))
        }

        if (data.type === 'submit_vote') {
          const player = game.players.find(p => p.id === userId)
          if (!player || game.gameStatus !== 'voting' || player.vote) {
            return
          }

          const { optionId } = data
          const option = game.voteOptions.find(o => o.id === optionId)
          if (!option) return

          // บันทึกการโหวต
          player.vote = optionId
          option.votes++
          option.voters.push(userId)

          ws.send(JSON.stringify({
            type: 'vote_submitted',
            voteOptions: game.voteOptions,
            players: game.players
          }))
        }

        if (data.type === 'finish_voting') {
          // เฉพาะ host เท่านั้นที่จบโหวตได้
          if (userId !== game.hostId) {
            return
          }

          game.gameStatus = 'finished'

          // หาตัวเลือกที่ชนะ (โหวตมากสุด)
          let winningOption: VoteOption | null = null
          let maxVotes = 0
          let isTie = false

          for (const option of game.voteOptions) {
            if (option.votes > maxVotes) {
              maxVotes = option.votes
              winningOption = option
              isTie = false
            } else if (option.votes === maxVotes && maxVotes > 0) {
              isTie = true
            }
          }

          // ถ้าเสมอให้ไม่มีผู้ชนะ
          if (isTie) {
            winningOption = null
          }

          // หาผู้ชนะ (คนที่โหวตตัวเลือกที่ชนะ)
          const winners = winningOption 
            ? game.players.filter(p => p.vote === winningOption!.id)
            : []

          let winAmount = 0
          if (winners.length > 0) {
            winAmount = Math.floor(game.totalPrizePool / winners.length)
            
            // อัปเดตเงินผู้ชนะ
            for (const winner of winners) {
              const currentUser = await getUserByUUID(winner.id)
              if (currentUser.Item) {
                const currentMoney = Number(currentUser.Item.money?.N || 0)
                await updateUserMoney(winner.id, currentMoney + winAmount)
              }
            }
          }

          // อัปเดตฐานข้อมูล
          if (game.gameSession) {
            await db.send(new UpdateCommand({
              TableName: 'GameSessions',
              Key: { gameId },
              UpdateExpression: 'SET gameStatus = :status, #results = :results',
              ExpressionAttributeNames: {
                '#results': 'results'
              },
              ExpressionAttributeValues: {
                ':status': 'finished',
                ':results': {
                  winningOption,
                  winners: winners.map(w => w.id),
                  winAmount,
                  voteOptions: game.voteOptions,
                  allVotes: game.players.map(p => ({
                    userId: p.id,
                    vote: p.vote
                  }))
                }
              }
            }))
          }

          ws.send(JSON.stringify({
            type: 'game_finished',
            winningOption,
            winners,
            winAmount,
            voteOptions: game.voteOptions
          }))
        }

      } catch (error) {
        console.error('Vote WebSocket error:', error)
        ws.send(JSON.stringify({ type: 'error', message: 'An error occurred' }))
      }
    },
    close: (ws) => {
      console.log('Vote WebSocket disconnected')
    }
  })
