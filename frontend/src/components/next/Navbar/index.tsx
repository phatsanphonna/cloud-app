'use client'

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/lib/user";
import { avataaarsNeutral  } from '@dicebear/collection';
import { createAvatar } from '@dicebear/core';
import { Coins, Wallet } from "lucide-react";
import Link from "next/link";
import { FC, useMemo } from "react";

const Navbar: FC = () => {
  const [user] = useUser()

  const avatar = useMemo(() => {
    return createAvatar(avataaarsNeutral, {
      size: 128,
    }).toDataUri();
  }, []);

  return (
    <div className="h-14 w-full rounded-full p-2 flex items-center justify-between">
      {user && (
        <>
          <Link href='/topup' className="flex"><Coins className="mr-1" />{user.money}</Link>

          <div className="flex items-center gap-2">
            <Avatar className="shadow bg-white">
              <AvatarImage src={avatar} />
            </Avatar>
          </div>
        </>
      )}
    </div>
  )
}

export default Navbar