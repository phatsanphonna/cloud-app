import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { getUserByUUID, updateUserMoney } from '../auth/query'
import { getGameSession, type GameSession } from './bet'
import { db } from '../database'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'

interface MatchFixingQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: number
}

interface MatchFixingPlayer {
  id: string
  name: string
  betAmount: number
  answers: number[]
}

interface MatchFixingGameState {
  gameId: string
  roomId: string
  hostId: string
  players: MatchFixingPlayer[]
  questions: MatchFixingQuestion[]
  currentQuestionIndex: number
  gameStatus: 'setup' | 'answering' | 'finished'
  totalPrizePool: number
}

const matchFixingGames = new Map<string, MatchFixingGameState>()

const mapSessionStatus = (status: GameSession['status']): MatchFixingGameState['gameStatus'] => {
  switch (status) {
    case 'finished':
      return 'finished'
    default:
      return 'setup'
  }
}

const buildMatchFixingState = async (gameId: string): Promise<MatchFixingGameState | null> => {
  const session = await getGameSession(gameId)
  if (!session || session.gameType !== 'match-fixing') {
    return null
  }

  const savedData = (session as any).matchFixingData ?? {}
  const questions: MatchFixingQuestion[] = savedData.questions ?? []
  const answersByPlayer: Record<string, number[]> = savedData.playerAnswers ?? {}

  const players: MatchFixingPlayer[] = session.bets.map((bet) => {
    const answers = answersByPlayer[bet.playerId]
      ? [...answersByPlayer[bet.playerId]]
      : Array(questions.length).fill(-1)
    while (answers.length < questions.length) {
      answers.push(-1)
    }
    return {
      id: bet.playerId,
      name: `Player ${bet.playerId.slice(0, 6)}`,
      betAmount: bet.amount,
      answers,
    }
  })

  const state: MatchFixingGameState = {
    gameId,
    roomId: session.roomId,
    hostId: session.hostId || session.bets[0]?.playerId || '',
    players,
    questions,
    currentQuestionIndex: savedData.currentQuestionIndex ?? 0,
    gameStatus: savedData.gameStatus ?? mapSessionStatus(session.status),
    totalPrizePool: session.totalPrizePool,
  }

  matchFixingGames.set(gameId, state)
  return state
}

const ensureMatchFixingState = (gameId: string) => {
  return matchFixingGames.get(gameId)
}

const ensureStateOrBuild = async (gameId: string) => {
  return ensureMatchFixingState(gameId) ?? (await buildMatchFixingState(gameId))
}

const toAnswersRecord = (state: MatchFixingGameState) => {
  return state.players.reduce<Record<string, number[]>>((acc, player) => {
    acc[player.id] = player.answers
    return acc
  }, {})
}

const persistMatchFixingData = async (
  state: MatchFixingGameState,
  options?: { status?: GameSession['status']; result?: any }
) => {
  const session = await getGameSession(state.gameId)
  if (!session) return

  session.matchFixingData = {
    questions: state.questions,
    currentQuestionIndex: state.currentQuestionIndex,
    playerAnswers: toAnswersRecord(state),
    gameStatus: state.gameStatus,
  }

  if (options?.status) {
    session.status = options.status
    if (options.status === 'finished') {
      session.finishedAt = new Date().toISOString()
    }
  }

  if (options?.result !== undefined) {
    session.result = options.result
  }

  await db.send(
    new UpdateCommand({
      TableName: 'Rooms',
      Key: { id: session.roomId },
      UpdateExpression: 'SET gameSession = :gameSession',
      ExpressionAttributeValues: {
        ':gameSession': session,
      },
    })
  )
}

const ensurePlayerInState = async (state: MatchFixingGameState, userId: string) => {
  if (state.players.some((player) => player.id === userId)) {
    return state
  }

  const session = await getGameSession(state.gameId)
  if (!session) return state

  const bet = session.bets.find((item) => item.playerId === userId)
  if (!bet) return state

  state.players.push({
    id: userId,
    name: `Player ${userId.slice(0, 6)}`,
    betAmount: bet.amount,
    answers: Array(state.questions.length).fill(-1),
  })

  await persistMatchFixingData(state)
  return state
}

export const MatchFixingRoute = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET!,
    })
  )
  .ws('/game/match-fixing/ws/:gameId', {
    headers: t.Object({
      'sec-websocket-protocol': t.Optional(t.String()),
      authorization: t.Optional(t.String()),
    }),
    open: async (ws) => {
      try {
        const headers = ws.data.headers as Record<string, string | undefined>
        const authHeader = headers.authorization
        let token = ''

        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7)
        } else if (headers['sec-websocket-protocol']) {
          const protocols = headers['sec-websocket-protocol'].split(',').map((p) => p.trim())
          const tokenIndex = protocols.findIndex((p) => p === 'token')
          if (tokenIndex !== -1 && protocols[tokenIndex + 1]) {
            token = protocols[tokenIndex + 1] || ''
          }
        }

        if (!token) {
          ws.close(4001, 'No token provided')
          return
        }

        const cleanToken = token.replace(/^Bearer\s+/i, '')
        const payload = await ws.data.jwt.verify(cleanToken)
        const userId = (payload as any)?.uuid ?? (payload as any)?.sub
        if (!payload || !userId) {
          ws.close(4002, 'Invalid token')
          return
        }

        const userResult = await getUserByUUID(userId)
        if (!userResult.Item) {
          ws.close(4003, 'User not found')
          return
        }

        ;(ws.data as any).userId = userId
        const { gameId } = ws.data.params as { gameId: string }
        ws.subscribe(`match-fixing:${gameId}`)
        console.log('Match Fixing WebSocket connected for user', userId)
      } catch (error) {
        console.error('Match fixing WS auth error:', error)
        ws.close(4000, 'Authentication failed')
      }
    },
    message: async (ws, message) => {
      try {
        if (typeof message !== 'object' || message === null || !('type' in message)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid payload' }))
          return
        }

        const data = message as any
        const { gameId } = ws.data.params as { gameId: string }
        const userId = (ws.data as any).userId as string
        const channel = `match-fixing:${gameId}`

        let state = await ensureStateOrBuild(gameId)
        if (!state) {
          ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }))
          return
        }

        state = await ensurePlayerInState(state, userId)

        switch (data.type) {
          case 'get_game_status': {
            ws.send(
              JSON.stringify({
                type: 'game_status',
                hostId: state.hostId,
                players: state.players,
                questions: state.questions,
                currentQuestionIndex: state.currentQuestionIndex,
                gameStatus: state.gameStatus,
                totalPrizePool: state.totalPrizePool,
              })
            )
            break
          }

          case 'add_question': {
            if (userId !== state.hostId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Only host can add questions' }))
              return
            }
            if (state.questions.length >= 1) {
              ws.send(JSON.stringify({ type: 'error', message: 'Question already set for this room' }))
              return
            }

            const question: MatchFixingQuestion = {
              id: Date.now().toString(),
              question: data.question,
              options: data.options,
              correctAnswer: -1,
            }

            state.questions.push(question)
            state.players.forEach((player) => player.answers.push(-1))
            await persistMatchFixingData(state)

            ws.publish(channel, JSON.stringify({ type: 'question_added', questions: state.questions }))
            break
          }

          case 'start_game': {
            if (userId !== state.hostId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Only host can start the game' }))
              return
            }

            if (state.questions.length === 0) {
              ws.send(JSON.stringify({ type: 'error', message: 'No questions added' }))
              return
            }

            state.gameStatus = 'answering'
            state.currentQuestionIndex = 0
            state.players.forEach((player) => {
              while (player.answers.length < state.questions.length) {
                player.answers.push(-1)
              }
            })

            await persistMatchFixingData(state, { status: 'playing' })
            ws.publish(
              channel,
              JSON.stringify({
                type: 'game_started',
                questions: state.questions,
                currentQuestionIndex: state.currentQuestionIndex,
              })
            )
            break
          }

          case 'submit_answer': {
            if (state.gameStatus !== 'answering') return

            const player = state.players.find((item) => item.id === userId)
            if (!player) return

            if (data.questionIndex < 0 || data.questionIndex >= state.questions.length) return

            player.answers[data.questionIndex] = data.answerIndex
            await persistMatchFixingData(state)

            ws.send(
              JSON.stringify({
                type: 'answer_submitted',
                questionIndex: data.questionIndex,
                answerIndex: data.answerIndex,
              })
            )
            break
          }

          case 'next_question': {
            if (userId !== state.hostId) return
            if (state.currentQuestionIndex >= state.questions.length - 1) return

            state.currentQuestionIndex += 1
            await persistMatchFixingData(state)

            ws.publish(
              channel,
              JSON.stringify({
                type: 'next_question',
                questionIndex: state.currentQuestionIndex,
              })
            )
            break
          }

          case 'finish_game': {
            if (userId !== state.hostId) return
            if (typeof data.answerIndex !== 'number') {
              ws.send(JSON.stringify({ type: 'error', message: 'Answer index required' }))
              return
            }
            if (state.questions.length === 0) {
              ws.send(JSON.stringify({ type: 'error', message: 'No question to resolve' }))
              return
            }

            state.gameStatus = 'finished'
            const questionIndex = 0
            const correctIndex = data.answerIndex
            if (state.questions[questionIndex]) {
              state.questions[questionIndex].correctAnswer = correctIndex
            }

            const winners = state.players.filter(
              (player) => player.answers[questionIndex] === correctIndex
            )

            const winAmount = winners.length > 0 ? Math.floor(state.totalPrizePool / winners.length) : 0

            if (winAmount > 0) {
              for (const winner of winners) {
                const currentUser = await getUserByUUID(winner.id)
                if (currentUser.Item?.money?.N) {
                  const currentMoney = Number(currentUser.Item.money.N)
                  await updateUserMoney(winner.id, currentMoney + winAmount)
                }
              }
            }

            await persistMatchFixingData(state, {
              status: 'finished',
              result: {
                winners: winners.map((winner) => winner.id),
                winAmount,
                questions: state.questions,
              },
            })

            const finishPayload = JSON.stringify({
              type: 'game_finished',
              winners,
              winAmount,
              questions: state.questions,
            })

            ws.publish(channel, finishPayload)
            ws.send(finishPayload)
            break
          }

          default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown action' }))
            break
        }
      } catch (error) {
        console.error('Match Fixing WebSocket error:', error)
        ws.send(JSON.stringify({ type: 'error', message: 'An error occurred' }))
      }
    },
    close: (ws) => {
      const { gameId } = ws.data.params as { gameId: string }
      ws.unsubscribe(`match-fixing:${gameId}`)
      console.log('Match Fixing WebSocket disconnected')
    },
    body: t.Union([
      t.Object({ type: t.Literal('get_game_status') }),
      t.Object({
        type: t.Literal('add_question'),
        question: t.String(),
        options: t.Array(t.String(), { minLength: 2 }),
      }),
      t.Object({ type: t.Literal('start_game') }),
      t.Object({
        type: t.Literal('submit_answer'),
        questionIndex: t.Number(),
        answerIndex: t.Number(),
      }),
      t.Object({ type: t.Literal('next_question') }),
      t.Object({ type: t.Literal('finish_game'), answerIndex: t.Number() }),
    ]),
  })
