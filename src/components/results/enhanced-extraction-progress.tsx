'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  Clock, 
  Search, 
  Database, 
  FileText, 
  AlertCircle,
  Zap,
  TrendingUp,
  Target,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExtractionProgressProps {
  progress: number
  currentStep: string
  isVisible?: boolean
}

const progressSteps = [
  {
    id: 'init',
    label: 'Initializing AI extraction engine...',
    description: 'Setting up data collection parameters',
    icon: Zap,
    keywords: ['initializing', 'starting', 'setup'],
    color: 'text-blue-400'
  },
  {
    id: 'search',
    label: 'Scanning business directories...',
    description: 'Finding target businesses with AI algorithms',
    icon: Search,
    keywords: ['finding', 'searching', 'businesses', 'maps'],
    color: 'text-purple-400'
  },
  {
    id: 'extract',
    label: 'Extracting customer reviews...',
    description: 'Analyzing review sentiment and patterns',
    icon: Database,
    keywords: ['extracting', 'reviews', 'analyzing'],
    color: 'text-green-400'
  },
  {
    id: 'process',
    label: 'Processing intelligence data...',
    description: 'Filtering and organizing results',
    icon: Filter,
    keywords: ['processing', 'filtering', 'formatting'],
    color: 'text-orange-400'
  },
]

const loadingStates = [
  { text: "Initializing AI extraction engine..." },
  { text: "Scanning business directories..." },
  { text: "Identifying target businesses..." },
  { text: "Extracting customer reviews..." },
  { text: "Analyzing review sentiment..." },
  { text: "Processing intelligence data..." },
  { text: "Organizing results..." },
  { text: "Finalizing extraction..." }
]

export function EnhancedExtractionProgress({ 
  progress, 
  currentStep, 
  isVisible = true 
}: ExtractionProgressProps) {
  
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
  const hasError = currentStep.toLowerCase().includes('error') || 
                   currentStep.toLowerCase().includes('failed')

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
    if (stepIndex === currentIndex) {
      // Distribute progress across the step range
      const stepSize = 100 / progressSteps.length
      const stepStart = stepIndex * stepSize
      const stepProgress = ((progress - stepStart) / stepSize) * 100
      return Math.max(0, Math.min(100, stepProgress))
    }
    return 0
  }

  const currentStepData = progressSteps.find(s => s.id === currentStepId)

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Detailed Progress Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ 
                      rotate: isComplete ? 0 : 360,
                      scale: hasError ? [1, 1.2, 1] : 1
                    }}
                    transition={{ 
                      rotate: { duration: 2, repeat: isComplete ? 0 : Infinity, ease: "linear" },
                      scale: { duration: 0.5, repeat: hasError ? Infinity : 0 }
                    }}
                  >
                    {hasError ? (
                      <AlertCircle className="h-8 w-8 text-red-400" />
                    ) : isComplete ? (
                      <CheckCircle className="h-8 w-8 text-green-400" />
                    ) : (
                      <Target className="h-8 w-8 text-primary" />
                    )}
                  </motion.div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      AI Business Intelligence Extraction
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Advanced sentiment analysis and data mining
                    </p>
                  </div>
                </div>

                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Badge 
                    variant={hasError ? "destructive" : isComplete ? "default" : "secondary"}
                    className={cn(
                      "text-lg px-4 py-2 font-bold",
                      hasError && "bg-red-500/20 text-red-300 border-red-500/30",
                      isComplete && "bg-green-500/20 text-green-300 border-green-500/30",
                      !hasError && !isComplete && "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    )}
                  >
                    {Math.round(progress)}%
                  </Badge>
                </motion.div>
              </div>

              {/* Overall Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Overall Progress</span>
                  <span className="text-muted-foreground">
                    {hasError ? 'Error occurred' : 
                     isComplete ? 'Extraction complete' : 
                     'Processing...'}
                  </span>
                </div>
                
                <div className="relative">
                  <Progress
                    value={progress}
                    className={cn(
                      "h-3 transition-all duration-500",
                      hasError && "[&>div]:bg-red-500",
                      isComplete && "[&>div]:bg-green-500"
                    )}
                  />
                  
                  {/* Animated progress glow */}
                  {!hasError && !isComplete && (
                    <motion.div
                      className="absolute inset-0 rounded-full opacity-50"
                      style={{
                        background: `linear-gradient(90deg, transparent ${progress-10}%, rgba(59, 130, 246, 0.5) ${progress}%, transparent ${progress+10}%)`
                      }}
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </div>
              </div>

              {/* Current Step Highlight */}
              {currentStepData && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 border border-primary/20"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <currentStepData.icon className={cn("h-6 w-6", currentStepData.color)} />
                    </motion.div>
                    
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {currentStepData.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {currentStepData.description}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium text-primary">
                        Step {progressSteps.findIndex(s => s.id === currentStepId) + 1}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        of {progressSteps.length}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step Progress Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {progressSteps.map((step, index) => {
                  const status = getStepStatus(step.id)
                  const stepProgress = getProgressForStep(step.id)
                  const Icon = step.icon

                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn(
                        "p-3 rounded-lg border transition-all duration-300",
                        status === 'complete' && "bg-green-500/10 border-green-500/30",
                        status === 'active' && "bg-primary/10 border-primary/30",
                        status === 'error' && "bg-red-500/10 border-red-500/30",
                        status === 'pending' && "bg-card/50 border/50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <motion.div
                          animate={{ 
                            scale: status === 'active' ? [1, 1.1, 1] : 1,
                            rotate: status === 'active' ? 360 : 0
                          }}
                          transition={{ 
                            scale: { duration: 1, repeat: status === 'active' ? Infinity : 0 },
                            rotate: { duration: 2, repeat: status === 'active' ? Infinity : 0, ease: "linear" }
                          }}
                        >
                          <Icon className={cn(
                            "h-5 w-5 transition-colors",
                            status === 'complete' && "text-green-400",
                            status === 'active' && step.color,
                            status === 'error' && "text-red-400",
                            status === 'pending' && "text-muted-foreground"
                          )} />
                        </motion.div>
                        
                        <div className="text-xs font-medium">
                          Step {index + 1}
                        </div>
                      </div>
                      
                      <div className="text-sm font-medium mb-1 line-clamp-2">
                        {step.label.split('...')[0]}
                      </div>
                      
                      {status === 'active' && (
                        <Progress value={stepProgress} className="h-1 mt-2" />
                      )}
                      
                      {status === 'complete' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-1 mt-2 text-xs text-green-400"
                        >
                          <CheckCircle className="h-3 w-3" />
                          <span>Complete</span>
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </div>

              {/* Status Message */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "p-4 rounded-lg text-center",
                  hasError && "bg-red-500/10 border border-red-500/20",
                  isComplete && "bg-green-500/10 border border-green-500/20",
                  !hasError && !isComplete && "bg-primary/10 border border-primary/20"
                )}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  {hasError ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  ) : isComplete ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-primary" />
                  )}
                  
                  <span className="font-medium">
                    {hasError ? 'Extraction Failed' :
                     isComplete ? 'Extraction Complete!' :
                     'Extraction in Progress'}
                  </span>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {currentStep}
                </div>
                
                {!isComplete && !hasError && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Estimated time remaining: {
                      progress < 25 ? '2-3 minutes' :
                      progress < 50 ? '1-2 minutes' :
                      progress < 75 ? '30-60 seconds' :
                      '10-30 seconds'
                    }
                  </div>
                )}
              </motion.div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}