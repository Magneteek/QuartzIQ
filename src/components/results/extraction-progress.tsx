'use client'

import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Clock, Search, Database, FileText, AlertCircle } from 'lucide-react'

interface ExtractionProgressProps {
  progress: number
  currentStep: string
}

const progressSteps = [
  {
    id: 'init',
    label: 'Initializing',
    icon: Clock,
    keywords: ['initializing', 'starting', 'setup']
  },
  {
    id: 'search',
    label: 'Finding Businesses',
    icon: Search,
    keywords: ['finding', 'searching', 'businesses', 'maps']
  },
  {
    id: 'extract',
    label: 'Extracting Reviews',
    icon: Database,
    keywords: ['extracting', 'reviews', 'analyzing']
  },
  {
    id: 'process',
    label: 'Processing Results',
    icon: FileText,
    keywords: ['processing', 'filtering', 'formatting']
  },
]

export function ExtractionProgress({ progress, currentStep }: ExtractionProgressProps) {
  const getCurrentStepId = () => {
    const stepLower = currentStep.toLowerCase()

    for (const step of progressSteps) {
      if (step.keywords.some(keyword => stepLower.includes(keyword))) {
        return step.id
      }
    }

    return progress === 100 ? 'complete' : 'init'
  }

  const currentStepId = getCurrentStepId()
  const isComplete = progress === 100
  const hasError = currentStep.toLowerCase().includes('error') || currentStep.toLowerCase().includes('failed')

  const getStepStatus = (stepId: string) => {
    const stepIndex = progressSteps.findIndex(s => s.id === stepId)
    const currentIndex = progressSteps.findIndex(s => s.id === currentStepId)

    if (hasError) return 'error'
    if (isComplete) return 'complete'
    if (stepIndex < currentIndex) return 'complete'
    if (stepIndex === currentIndex) return 'active'
    return 'pending'
  }

  const getProgressForStep = (stepId: string) => {
    const stepIndex = progressSteps.findIndex(s => s.id === stepId)
    const currentIndex = progressSteps.findIndex(s => s.id === currentStepId)

    if (stepIndex < currentIndex) return 100
    if (stepIndex === currentIndex) return progress % 25 === 0 ? progress : (progress % 25) * 4
    return 0
  }

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Extraction Progress</h3>
            {hasError ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Error
              </Badge>
            ) : isComplete ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Complete
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                In Progress
              </Badge>
            )}
          </div>
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress
          value={progress}
          className={`h-2 ${hasError ? 'bg-red-100' : ''}`}
        />
      </div>

      {/* Current Step */}
      <Card className={`border-l-4 ${hasError ? 'border-l-red-500' : isComplete ? 'border-l-green-500' : 'border-l-blue-500'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-2">
            {hasError ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <Clock className="h-5 w-5 text-blue-500 animate-spin" />
            )}
            <span className="font-medium">Current Status</span>
          </div>
          <p className="text-sm text-muted-foreground">{currentStep}</p>
        </CardContent>
      </Card>

      {/* Step Details */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Process Steps</h4>
        <div className="space-y-2">
          {progressSteps.map((step) => {
            const status = getStepStatus(step.id)
            const stepProgress = getProgressForStep(step.id)
            const Icon = step.icon

            return (
              <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  status === 'complete' ? 'bg-green-100 text-green-600' :
                  status === 'active' ? 'bg-blue-100 text-blue-600' :
                  status === 'error' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {status === 'complete' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : status === 'error' ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Icon className={`h-4 w-4 ${status === 'active' ? 'animate-pulse' : ''}`} />
                  )}
                </div>

                <div className="flex-grow space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${
                      status === 'complete' ? 'text-green-700' :
                      status === 'active' ? 'text-blue-700' :
                      status === 'error' ? 'text-red-700' :
                      'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                    {status === 'active' && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(stepProgress)}%
                      </span>
                    )}
                  </div>

                  {status === 'active' && (
                    <Progress value={stepProgress} className="h-1" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Estimated Time */}
      {!isComplete && !hasError && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estimated time remaining:</span>
              <span className="font-medium">
                {progress < 25 ? '2-3 minutes' :
                 progress < 50 ? '1-2 minutes' :
                 progress < 75 ? '30-60 seconds' :
                 '10-30 seconds'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}