import { FC } from 'react'
import { Button } from '@/components/ui/button'

const GameLobby: FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Main Lobby Container */}
      <div className="border-4 border-slate-800 dark:border-slate-200 rounded-3xl p-8 bg-white dark:bg-slate-950 shadow-2xl">
        <div className="flex flex-col gap-4 w-80">
          {/* User Slots */}
          {[1, 2, 3, 4].map((slot) => (
            <div key={slot}>
              <Button
                variant="outline"
                className="w-full h-14 text-base font-medium border-2 border-slate-300 dark:border-slate-600 rounded-xl hover:border-slate-400 dark:hover:border-slate-500 transition-all"
              >
                user{slot}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default GameLobby