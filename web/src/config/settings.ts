import { addressRules } from '@/validation/agreementRules'

export interface SettingField {
  key: string
  name: string
  description: string
  defaultValue?: string
  rules?: ((value: string) => boolean | string)[]
}

export const settingsFields: readonly SettingField[] = [
  {
    key: 'contractAddress',
    name: 'Dirección del contrato',
    description: 'Dirección del contrato de acuerdos desplegado en la red que vas a usar.',
    defaultValue: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    rules: addressRules,
  },
]

export type SettingsValues = Record<string, string>
