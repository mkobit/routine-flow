import type { RoutineTemplate } from './routine-templates'

export interface TemplateVaultPort {
  readonly getAbstractFileByPath: (path: string) => unknown
  readonly createFolder: (path: string) => Promise<unknown>
  readonly create: (path: string, data: string) => Promise<unknown>
}

export interface ImportTemplateOptions {
  readonly destinationFolder?: string
  readonly fileName?: string
  readonly overwrite?: boolean
}

export interface ImportTemplateResult {
  readonly success: boolean
  readonly path: string
  readonly error?: string
}

export const DEFAULT_ROUTINES_FOLDER = 'Routines'

function normalizeFolderPath(folder: string): string {
  const trimmed = folder.trim().replace(/^\/+|\/+$/g, '')
  return trimmed
}

async function ensureFolderRecursive(vault: TemplateVaultPort, folderPath: string): Promise<void> {
  const normalized = normalizeFolderPath(folderPath)
  if (!normalized) {
    return
  }

  const parts = normalized.split('/')
  let current = ''
  for (const part of parts) {
    current = current ? `${current}/${part}` : part
    const exists = vault.getAbstractFileByPath(current) !== null
    if (!exists) {
      await vault.createFolder(current)
    }
  }
}

export async function importRoutineTemplate(
  vault: TemplateVaultPort,
  template: RoutineTemplate,
  options?: ImportTemplateOptions,
): Promise<ImportTemplateResult> {
  const folder = options?.destinationFolder !== undefined
    ? normalizeFolderPath(options.destinationFolder)
    : DEFAULT_ROUTINES_FOLDER

  const fileName = options?.fileName?.trim() || template.suggestedFileName
  const targetPath = folder ? `${folder}/${fileName}` : fileName

  if (folder) {
    try {
      await ensureFolderRecursive(vault, folder)
    }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      return { success: false, path: targetPath, error: `Failed to create folder "${folder}": ${message}` }
    }
  }

  const fileExists = vault.getAbstractFileByPath(targetPath) !== null
  if (fileExists && !options?.overwrite) {
    return {
      success: false,
      path: targetPath,
      error: `File already exists: "${targetPath}"`,
    }
  }

  try {
    await vault.create(targetPath, template.markdownContent)
    return {
      success: true,
      path: targetPath,
    }
  }
  catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return {
      success: false,
      path: targetPath,
      error: `Failed to create file "${targetPath}": ${message}`,
    }
  }
}
