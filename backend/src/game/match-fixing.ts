import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { getUserByUUID, updateUserMoney } from '../auth/query'
import { getRoom } from '../room/query'
import { getGameSession, updateGameStatus, type GameSession } from './bet'
import { db } from '../database'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

interface MatchFixingQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: number
}

interface MatchFixingGameState {
  gameId: string
  hostId: string
  players: Array<{
    id: string
    name: string
    betAmount: number
    answers: number[]
    isHost: boolean
  }>
  questions: MatchFixingQuestion[]
  currentQuestionIndex: number
  gameStatus: 'setup' | 'waiting' | 'answering' | 'finished'
  totalPrizePool: number
  gameSession?: GameSession
}

const matchFixingGames = new Map<string, MatchFixingGameState>()

export const MatchFixingRoute = new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET!,
  }))
  .ws('/game/match-fixing/:gameId', {
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
      console.log('Match Fixing WebSocket connected')
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

        let game = matchFixingGames.get(gameId)
        
        if (!game) {
          // ดึงข้อมูลเกมจากฐานข้อมูล
          const response = await db.send(new GetCommand({
            TableName: 'GameSessions',
            Key: { gameId }
          }))

          if (response.Item && response.Item.gameType === 'match-fixing') {
            const session = response.Item as any // Note: Casting to any to match original logic
            
            game = {
              gameId,
              hostId: session.createdBy || userId, // ใช้ createdBy แทน hostId
              players: session.bets?.map((bet: any) => ({
                id: bet.playerId,
                name: `Player ${bet.playerId}`,
                betAmount: bet.amount,
                answers: [],
                isHost: bet.playerId === session.createdBy
              })) || [],
              questions: session.questions || [],
              currentQuestionIndex: 0,
              gameStatus: 'setup',
              totalPrizePool: session.totalPrizePool || 0,
              gameSession: session as GameSession
            }
            matchFixingGames.set(gameId, game)
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }))
            return
          }
        }
        
        if (!game) {
            ws.send(JSON.stringify({ type: 'error', message: 'Game could not be initialized.' }));
            return;
        }

        // เพิ่มผู้เล่นใหม่ถ้ายังไม่มี
        if (!game.players.find(p => p.id === userId)) {
          const betAmount = game.gameSession?.bets?.find((b: any) => b.playerId === userId)?.amount || 0
          game.players.push({
            id: userId,
            name: `Player ${userId}`,
            betAmount,
            answers: [],
            isHost: userId === game.hostId
          })
        }

        if (data.type === 'get_game_status') {
          ws.send(JSON.stringify({
            type: 'game_status',
            gameId: game.gameId,
            hostId: game.hostId,
            players: game.players,
            questions: game.questions,
            currentQuestionIndex: game.currentQuestionIndex,
            gameStatus: game.gameStatus,
            totalPrizePool: game.totalPrizePool
          }))
        }

        if (data.type === 'add_question') {
          // เฉพาะ host เท่านั้นที่เพิ่มคำถามได้
          if (userId !== game.hostId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only host can add questions' }))
            return
          }

          const question: MatchFixingQuestion = {
            id: Date.now().toString(),
            question: data.question,
            options: data.options,
            correctAnswer: data.correctAnswer
          }

          game.questions.push(question)

          // อัปเดตสถานะ (ในความจริงควรใช้ database แต่ตอนนี้ใช้ memory ก่อน)
          // TODO: บันทึกใน database

          ws.send(JSON.stringify({
            type: 'question_added',
            questions: game.questions
          }))
        }

        if (data.type === 'start_game') {
          // เฉพาะ host เท่านั้นที่เริ่มเกมได้
          if (userId !== game.hostId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only host can start game' }))
            return
          }

          if (game.questions.length === 0) {
            ws.send(JSON.stringify({ type: 'error', message: 'No questions added' }))
            return
          }

          game.gameStatus = 'answering'
          game.currentQuestionIndex = 0
          
          // รีเซ็ตคำตอบของผู้เล่น
          game.players.forEach(player => {
            player.answers = new Array(game.questions.length).fill(-1)
          })

          // อัปเดต game status
          if (game.gameSession) {
            await updateGameStatus(game.gameSession.id, 'playing')
          }

          ws.send(JSON.stringify({
            type: 'game_started',
            questions: game.questions,
            currentQuestionIndex: game.currentQuestionIndex
          }))
        }

        if (data.type === 'submit_answer') {
          const player = game.players.find(p => p.id === userId)
          if (!player || game.gameStatus !== 'answering') {
            return
          }

          const { questionIndex, answerIndex } = data
          
          if (questionIndex >= 0 && questionIndex < game.questions.length) {
            player.answers[questionIndex] = answerIndex
          }

          ws.send(JSON.stringify({
            type: 'answer_submitted',
            questionIndex,
            answerIndex
          }))
        }

        if (data.type === 'next_question') {
          // เฉพาะ host เท่านั้นที่ไปคำถามต่อไปได้
          if (userId !== game.hostId) {
            return
          }

          game.currentQuestionIndex++
          
          ws.send(JSON.stringify({
            type: 'next_question',
            questionIndex: game.currentQuestionIndex
          }))
        }

        if (data.type === 'finish_game') {
          // เฉพาะ host เท่านั้นที่จบเกมได้
          if (userId !== game.hostId) {
            return
          }

          game.gameStatus = 'finished'

          // คำนวณผู้ชนะ (ต้องตอบถูกทุกข้อ)
          const winners = game.players.filter(player => {
            return game.questions.every((question, index) => {
              return player.answers[index] === question.correctAnswer
            })
          })

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
                  winners: winners.map(w => w.id),
                  winAmount,
                  questions: game.questions,
                  playerAnswers: game.players.map(p => ({
                    userId: p.id,
                    answers: p.answers
                  }))
                }
              }
            }))
          }

          ws.send(JSON.stringify({
            type: 'game_finished',
            winners,
            winAmount,
            questions: game.questions
          }))
        }

      } catch (error) {
        console.error('Match Fixing WebSocket error:', error)
        ws.send(JSON.stringify({ type: 'error', message: 'An error occurred' }))
      }
    },
    close: (ws) => {
      console.log('Match Fixing WebSocket disconnected')
    }
  })
