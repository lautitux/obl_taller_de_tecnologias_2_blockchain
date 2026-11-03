import { reactive, readonly } from 'vue'
import { settingsFields, type SettingField, type SettingsValues } from '@/config/settings'

function readSetting(field: SettingField) {
  try {
    const stored = localStorage.getItem(`agreements.${field.key}`)
    if (stored !== null && (field.rules ?? []).every((rule) => rule(stored) === true)) {
      return stored
    }
  } catch {
    // Use the default when browser storage is unavailable.
  }
  return field.defaultValue ?? ''
}

const settings = reactive<SettingsValues>(
  Object.fromEntries(settingsFields.map((field) => [field.key, readSetting(field)])),
)

export function useSettings() {
  function saveSettings(values: SettingsValues) {
    const normalized = Object.fromEntries(
      settingsFields.map((field) => [field.key, (values[field.key] ?? '').trim()]),
    )

    for (const field of settingsFields) {
      for (const rule of field.rules ?? []) {
        const result = rule(normalized[field.key] ?? '')
        if (result !== true) {
          throw new Error(typeof result === 'string' ? result : `Revisá ${field.name}.`)
        }
      }
    }

    for (const field of settingsFields) {
      const value = normalized[field.key] ?? ''
      const storageKey = `agreements.${field.key}`
      if (field.defaultValue !== undefined && value === field.defaultValue) {
        localStorage.removeItem(storageKey)
      } else {
        localStorage.setItem(storageKey, value)
      }
    }
    Object.assign(settings, normalized)
  }

  return { settings: readonly(settings), saveSettings }
}
