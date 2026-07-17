const COMMANDS: Array<{ patterns: RegExp[]; prompt: string }> = [
  {
    patterns: [/^analy[sz]e this contract\.?$/i],
    prompt: 'Analyze this contract and identify the most important legal risks.',
  },
  {
    patterns: [/^summari[sz]e the risks\.?$/i],
    prompt: 'Summarize the risks in this contract.',
  },
  {
    patterns: [/^explain clause (five|5)\.?$/i],
    prompt: 'Explain clause five in plain English.',
  },
  {
    patterns: [/^what is the overall risk\??$/i],
    prompt: 'What is the overall risk?',
  },
  {
    patterns: [/^should i sign this contract\??$/i],
    prompt: 'Should I sign this contract?',
  },
]

export function resolveVoiceCommand(transcript: string): string {
  const normalized = transcript.trim()
  const match = COMMANDS.find((command) =>
    command.patterns.some((pattern) => pattern.test(normalized))
  )
  return match?.prompt ?? normalized
}
