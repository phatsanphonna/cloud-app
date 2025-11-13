"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import Operation from "./Operation";

export default function Home() {
  return (
    <main className="min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-semibold text-slate-900">
            Join or create a room
          </h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Join a room
                </h2>
                <p className="text-sm text-slate-600">
                  Enter the six-character room code to join an existing game.
                </p>
              </div>
              <Operation />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Create a room
                </h2>
                <p className="text-sm text-slate-600">
                  Open a fresh lobby, choose a mini game, and send the room code
                  to your friends.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href="/create-room"
                  className={buttonVariants({
                    variant: "outline",
                    className: "w-full",
                  })}
                >
                  Create a room
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
