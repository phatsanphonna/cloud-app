import { atom, useAtom } from "jotai";
import UserProvider from "./Provider";
export { AuthProvider, NoAuthProvider } from "./AuthProvider";

export interface User {
  id: string;
  username: string;
  email?: string;
  money: number;
  profilePicture: string;
}

const user = atom(null as User | null);
export const useUser = () => useAtom(user);

export { UserProvider }