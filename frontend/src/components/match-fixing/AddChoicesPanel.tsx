"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddChoicesPanelProps {
  choices: string[]
  onChangeChoices: (choices: string[]) => void
  onSubmit: () => void
  onStartGame?: () => void
  canStart?: boolean
  questionLabel?: string
  minChoices?: number
  disabled?: boolean
}

export function AddChoicesPanel({
  choices,
  onChangeChoices,
  onSubmit,
  onStartGame,
  canStart = false,
  questionLabel = 'Question',
  minChoices = 2,
  disabled = false,
}: AddChoicesPanelProps) {
  const [localChoices, setLocalChoices] = useState<string[]>(choices)

  useEffect(() => {
    setLocalChoices(choices)
  }, [choices])

  const handleChoiceChange = (index: number, value: string) => {
    const updated = [...localChoices]
    updated[index] = value
    setLocalChoices(updated)
    onChangeChoices(updated)
  }

  const addChoice = () => {
    const updated = [...localChoices, '']
    setLocalChoices(updated)
    onChangeChoices(updated)
  }

  const removeChoice = (index: number) => {
    if (localChoices.length <= minChoices) return
    const updated = localChoices.filter((_, i) => i !== index)
    setLocalChoices(updated)
    onChangeChoices(updated)
  }

  const isSubmitDisabled =
    localChoices.length < minChoices ||
    localChoices.some((choice) => !choice.trim()) ||
    disabled

  return (
    <Card className="border border-slate-200 shadow-none w-full">
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">{questionLabel}</Label>
          <p className="text-xs text-slate-500">
            Provide at least {minChoices} options for players to answer
            {disabled ? ' — question already set' : ''}
          </p>
        </div>

        <div className="space-y-3">
          {localChoices.map((choice, index) => (
            <div key={index} className="space-y-1">
              <Label className="text-xs text-slate-500">Option {index + 1}</Label>
              <div className="flex gap-2">
                <Input
                  value={choice}
                  onChange={(e) => handleChoiceChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="destructive"
                  disabled={localChoices.length <= minChoices || disabled}
                  onClick={() => removeChoice(index)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={addChoice}
          className="w-full"
          disabled={disabled}
        >
          Add Option
        </Button>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            className="bg-slate-900 text-white hover:bg-slate-900/90"
          >
            Save Question
          </Button>
          {onStartGame && (
            <Button
              onClick={onStartGame}
              disabled={!canStart}
              className="bg-emerald-600 hover:bg-emerald-600/90"
            >
              Start Game
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
