import { t } from "elysia";

const WSJoinType = t.Object({
  type: t.String(),
  payload: t.Object({
    roomCode: t.String()
  })
})

export const WSType = t.Union([WSJoinType])

export const WSParamsType = t.Object({
  id: t.String()
})