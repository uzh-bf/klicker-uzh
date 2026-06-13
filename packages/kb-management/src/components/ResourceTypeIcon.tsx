import {
  BookOpenCheck,
  Database,
  FileText,
  Globe2,
  HelpCircle,
  Layers3,
  TextCursorInput,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type {
  KnowledgeResourceIcon,
  KnowledgeResourceType,
  KnowledgeResourceTypeDefinition,
} from '../types.js'
import { getResourceTypeDefinition } from '../utils.js'

interface ResourceTypeIconProps {
  type?: KnowledgeResourceType
  definition?: KnowledgeResourceTypeDefinition
  className?: string
}

export function ResourceTypeIcon({
  type = 'default',
  definition,
  className,
}: ResourceTypeIconProps) {
  const iconClassName = 'size-4'
  const resourceType = definition ?? getResourceTypeDefinition(type)
  const Icon = getIcon(resourceType.icon)

  return (
    <span
      className={twMerge(
        'inline-flex size-7 items-center justify-center rounded-sm bg-slate-100 text-slate-700',
        resourceType.colorClassName,
        className
      )}
      title={resourceType.label}
    >
      <Icon className={iconClassName} />
    </span>
  )
}

function getIcon(icon: KnowledgeResourceIcon = 'default') {
  switch (icon) {
    case 'document':
      return FileText
    case 'website':
      return Globe2
    case 'snippet':
      return TextCursorInput
    case 'internal':
      return Layers3
    case 'dataset':
      return Database
    case 'quiz':
      return HelpCircle
    default:
      return BookOpenCheck
  }
}
