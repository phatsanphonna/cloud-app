'use client'

import { useUser } from "@/lib/user";
import { Coins, LogIn } from "lucide-react";
import Link from "next/link";
import { FC } from "react";
import Profile from "./Profile";
import { buttonVariants } from "@/components/ui/button";





const Navbar: FC = () => {
  const [user] = useUser();

  return (
    <div className="h-14 w-full rounded-full p-2 flex items-center justify-between">
      {!user && (
        <>
          <div />
          <Link href='/signin' className={buttonVariants()}>
            <LogIn />
            Sign In
          </Link>
        </>
      )}

      {user && (
        <>
          <Link href='/topup' className="flex"><Coins className="mr-1" />{user.money}</Link>
          <div className="flex items-center gap-2">
            <Profile user={user} />
          </div>
        </>
      )}
    </div>
  )
}

export default Navbar
