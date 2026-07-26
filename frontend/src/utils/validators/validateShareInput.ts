export const MAX_FILE_BYTES = 10_000_000

export function validateTextInput(text: string, requiredMessage: string): string[] {
  return text.trim() ? [] : [requiredMessage]
}

export function validateFileInput(file: File | null, requiredMessage: string, tooLargeMessage: string): string[] {
  if (!file) return [requiredMessage]
  if (file.size > MAX_FILE_BYTES) return [tooLargeMessage]
  return []
}
