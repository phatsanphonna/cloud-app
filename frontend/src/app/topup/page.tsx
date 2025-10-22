'use client'

import { SpinWheel, WheelItem } from "@/components/next/SpinWheel"
import { FC } from "react"
import { topup } from "./actions";
import { getMe } from "@/lib/user/actions";
import { useUser } from "@/lib/user";


// map to WheelItem<number>[]
const AMOUNTS: WheelItem<number>[] = [5, 10, 15, 20, 25, 30, 40, 50].map(amount => ({
  id: amount,
  label: `$${amount}`,
  value: amount,
}));

const TopupPage: FC = () => {
  const [, setUser] = useUser();

  const spin = async () => {
    const { got } = await topup();
    return got;
  }

  const onFinished = async (result: WheelItem<number>) => {
    alert(`Top-up successful! New balance: ${result.label}`);
    const user = await getMe()
    setUser(user);
  }

  return (
    <SpinWheel items={AMOUNTS} getResult={spin} onFinished={onFinished} />
  )
}

export default TopupPage