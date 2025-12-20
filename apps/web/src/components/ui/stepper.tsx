import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  id: string
  title: string
  description?: string
  icon?: React.ReactNode
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (stepIndex: number) => void
  allowClickBack?: boolean
  className?: string
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  allowClickBack = true,
  className,
}: StepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = allowClickBack && index < currentStep && onStepClick

          return (
            <React.Fragment key={step.id}>
              {/* Step */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-primary/10 text-primary',
                    !isCompleted &&
                      !isCurrent &&
                      'border-muted-foreground/30 text-muted-foreground/50',
                    isClickable && 'cursor-pointer hover:bg-primary/20'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : step.icon ? (
                    step.icon
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </button>
                <div className="text-center">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isCurrent && 'text-primary',
                      !isCurrent && !isCompleted && 'text-muted-foreground/70'
                    )}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-4 -mt-8',
                    index < currentStep ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
