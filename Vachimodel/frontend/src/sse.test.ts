import { describe, expect, it } from 'vitest'
import { SseParser } from './sse'

describe('SseParser', () => {
  it('parses complete events', () => {
    const parser = new SseParser()
    expect(parser.push('event: delta\ndata: {"text":"hi"}\n\n')).toEqual([
      { event: 'delta', data: '{"text":"hi"}' },
    ])
  })

  it('handles events split across chunks', () => {
    const parser = new SseParser()
    expect(parser.push('event: del')).toEqual([])
    expect(parser.push('ta\ndata: {"te')).toEqual([])
    expect(parser.push('xt":"a"}\n\nevent: done\ndata: {}\n\n')).toEqual([
      { event: 'delta', data: '{"text":"a"}' },
      { event: 'done', data: '{}' },
    ])
  })

  it('defaults the event name, joins multi-line data, ignores comments and CRLF', () => {
    const parser = new SseParser()
    expect(parser.push(': keep-alive\r\n\r\ndata: line1\r\ndata: line2\r\n\r\n')).toEqual([
      { event: 'message', data: 'line1\nline2' },
    ])
  })

  it('keeps Hindi text intact', () => {
    const parser = new SseParser()
    expect(parser.push('event: delta\ndata: {"text":"नमस्ते"}\n\n')[0].data).toBe('{"text":"नमस्ते"}')
  })
})
