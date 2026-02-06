'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Check, X } from 'lucide-react'

interface EditableCellProps {
  value: string | null
  leadId: string
  field: string
  type?: 'text' | 'email' | 'url' | 'textarea'
  onSave: (leadId: string, field: string, value: string) => Promise<void>
  className?: string
}

export function EditableCell({
  value,
  leadId,
  field,
  type = 'text',
  onSave,
  className = '',
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [isEditing])

  const handleSave = async () => {
    if (editValue === (value || '')) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(leadId, field, editValue)
      setIsEditing(false)
    } catch (error) {
      console.error('Error saving:', error)
      // Reset to original value on error
      setEditValue(value || '')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    const InputComponent = type === 'textarea' ? Textarea : Input

    return (
      <div className="flex items-center gap-1">
        <InputComponent
          ref={inputRef as any}
          type={type === 'textarea' ? undefined : type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={`h-8 ${type === 'textarea' ? 'min-h-[60px]' : ''} ${className}`}
        />
        {isSaving && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded min-h-[32px] flex items-center"
      title="Click to edit"
    >
      {value || <span className="text-gray-400 italic">Click to add...</span>}
    </div>
  )
}
