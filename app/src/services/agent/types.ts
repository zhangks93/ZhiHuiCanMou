// Agent Core Types

export interface SkillParameter {
  name: string
  description: string
  required: boolean
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
}

export interface SkillResult {
  success: boolean
  data: any
  message: string
  visualizations?: Visualization[]
}

export interface Visualization {
  type: 'chart' | 'table' | 'card' | 'text'
  data: any
}

export interface SkillContext {
  accessToken?: string
  conversationHistory?: Message[]
  userPreferences?: Record<string, any>
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  skillName: string
  parameters: Record<string, any>
  status: 'pending' | 'success' | 'error'
  result?: SkillResult
  error?: string
}

export abstract class Skill {
  abstract name: string
  abstract description: string
  abstract parameters: SkillParameter[]

  abstract execute(params: Record<string, any>, context: SkillContext): Promise<SkillResult>

  validateParameters(params: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const param of this.parameters) {
      if (param.required && !(param.name in params)) {
        errors.push(`Missing required parameter: ${param.name}`)
      }

      if (param.name in params) {
        const value = params[param.name]
        const actualType = Array.isArray(value) ? 'array' : typeof value

        if (param.type === 'object' && actualType !== 'object') {
          errors.push(`Parameter ${param.name} must be an object`)
        } else if (param.type !== 'object' && param.type !== 'array' && actualType !== param.type) {
          errors.push(`Parameter ${param.name} must be of type ${param.type}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
