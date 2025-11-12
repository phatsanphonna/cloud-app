import { Elysia, t } from "elysia";
import { getGameByRoomCode, getGameRoomById, getLobbyInfo } from "./query.js";
import { AuthService } from "../auth/index.js";

export const game = new Elysia({
  prefix: "/games",
})
  .use(AuthService)
  .post("/join", async ({ body: { roomCode }, status, }) => {
    const { Item } = await getGameByRoomCode(roomCode);

    if (!Item) {
      return status(404, { message: "Game room not found" });
    }

    return { message: "Game room found.", gameId: Item.id!.S };
  }, {
    body: t.Object({
      roomCode: t.String()
    }),
    isSignIn: true
  })
  .onError(({ error, code }) => {
    console.error(`Error occurred with code ${code}:`, error);
  })
  .get("/:id", async ({ params: { id }, status }) => {
    const lobby = await getLobbyInfo(id);
    if (!lobby) {
      return status(404, { message: "Game room not found." });
    }

    return lobby;
  }, {
    params: t.Object({
      id: t.String()
    }),
    isSignIn: true
  }); 
