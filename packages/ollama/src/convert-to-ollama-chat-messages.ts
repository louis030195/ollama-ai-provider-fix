import {
  LanguageModelV1Prompt,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider'
import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils'

import { injectToolsSchemaIntoSystem } from '@/generate-tool/inject-tools-schema-into-system'
import { OllamaChatPrompt } from '@/ollama-chat-prompt'

export function convertToOllamaChatMessages(
  prompt: LanguageModelV1Prompt,
): OllamaChatPrompt {
  const messages: OllamaChatPrompt = []

  for (const { content, role } of prompt) {
    switch (role) {
      case 'system': {
        messages.push({
          content: injectToolsSchemaIntoSystem({
            system: content,
          }),
          role: 'system',
        })
        break
      }

      case 'user': {
        messages.push({
          ...content.reduce<{ content: string; images?: string[] }>(
            (previous, current) => {
              if (current.type === 'text') {
                previous.content += current.text
              } else if (
                current.type === 'image' &&
                current.image instanceof URL
              ) {
                throw new UnsupportedFunctionalityError({
                  functionality: 'image-part',
                })
              } else if (
                current.type === 'image' &&
                current.image instanceof Uint8Array
              ) {
                previous.images = previous.images || []
                previous.images.push(convertUint8ArrayToBase64(current.image))
              }

              return previous
            },
            { content: '' },
          ),
          role: 'user',
        })
        break
      }

      case 'assistant': {
        messages.push({
          content: content
            .map((part) => {
              switch (part.type) {
                case 'text': {
                  return part.text
                }
              }
            })
            .join(''),
          role: 'assistant',
        })
        break
      }

      case 'tool': {
        messages.push(
          ...content.map((part) => ({
            // Non serialized contents are not accepted by ollama, triggering the following error:
            // "json: cannot unmarshal array into Go struct field ChatRequest.messages of type string"
            content:
              typeof part.result === 'object'
                ? JSON.stringify(part.result)
                : `${part.result}`,
            role: 'tool' as const,
            tool_call_id: part.toolCallId,
          })),
        )
        break
      }

      default: {
        const _exhaustiveCheck: string = role
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`)
      }
    }
  }

  return messages
}
