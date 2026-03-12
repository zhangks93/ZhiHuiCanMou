// Echo Skill - Simple test skill for Phase 1

import { Skill, type SkillParameter, type SkillResult, type SkillContext } from '../../agent/types'

export class EchoSkill extends Skill {
  name = 'echo'
  description = '简单的回声测试技能，返回用户输入的内容'

  parameters: SkillParameter[] = [
    {
      name: 'message',
      description: '要回显的消息',
      required: true,
      type: 'string',
    },
  ]

  async execute(params: Record<string, any>, _context: SkillContext): Promise<SkillResult> {
    const message = params.message as string

    return {
      success: true,
      message: '回声测试成功',
      data: {
        original: message,
        echo: `Echo: ${message}`,
        timestamp: new Date().toISOString(),
      },
    }
  }
}
