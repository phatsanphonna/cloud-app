import { atom, useAtom } from "jotai";
import UserProvider from "./Provider";

interface User {
  id: string;
  username: string;
  money: number;
  profilePicture: string;
}

const user = atom(null as User | null);
export const useUser = () => useAtom(user);

export { UserProvider }