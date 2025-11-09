import { Elysia } from "elysia";
import { AuthService } from "../auth";
import { getUserByUUID, getUserByCognitoSub } from "../auth/query";

export const user = new Elysia({
  prefix: "/users",
})
  .use(AuthService)
  .get("/me", async ({ uuid, status }) => {
    const { Item } = await getUserByUUID(uuid);

    if (!Item) {
      return status(404, { message: "User not found." });
    }

    return {
      id: Item.id!.S,
      username: Item.username!.S,
      email: Item.email?.S,
      money: Number(Item.money!.N),
      profilePicture: Item.profilePicture!.S,
    };
  }, {
    isSignIn: true
  });