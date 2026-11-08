import { BaseError, ContractFunctionRevertedError } from 'viem'

type InterpretedError =
  | { kind: 'user-rejected' }
  | { kind: 'contract-revert'; name?: string; args?: readonly unknown[] }
  | { kind: 'other'; message: string }

export function interpretError(error: unknown): InterpretedError {
  console.error(error)
  if (error instanceof BaseError) {
    const rejection = error.walk((e) => (e as Error & { code?: number }).code === 4001)
    if (rejection) return { kind: 'user-rejected' }

    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      return {
        kind: 'contract-revert',
        name: revert.data?.errorName,
        args: revert.data?.args,
      }
    }

    return { kind: 'other', message: error.shortMessage }
  } else {
    return {
      kind: 'other',
      message: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

const agreementErrorMapping: Record<string, string> = {
  InvalidBeneficiary: 'El beneficiario de una cuerdo no puede ser address(0)',
  InvalidAmount: 'La cantidad de tokens no puede ser 0',
  InvalidDateRange: 'La fecha de inicio debe ser anterior a la fecha de finalización',
  AgreementNotRevocable: 'El acuerdo no es revocable y por tanto no puede ser cancelado',
  UnauthorizedPayer: 'Solo el pagador de este acuerdo puede realizar la operación',
  AgreementEnded: 'El acuerdo ya finalizó',
  UnauthorizedBeneficiary: 'Solo el beneficiario de este acuerdo puede realizar la operación',
  InsufficientVestedAmount: 'El acuerdo no tiene suficiente saldo devengado',
  AgreementNotFound: 'El acuerdo especificado no existe',
  AgreementNotActive: 'El acuerdo no se encuentra activo',
}

const erc20ErrorMapping: Record<string, string> = {
  ERC20InsufficientBalance: 'El balance de tokens es insuficiente',
  ERC20InvalidSender: 'El remitente de tokens es inválido',
  ERC20InvalidReceiver: 'El receptor de tokens es inválido',
  ERC20InsufficientAllowance: 'La cantidad de tokens autorizados es insuficiente',
  ERC20InvalidApprover: 'No cuenta con autorización para aprobar',
  ERC20InvalidSpender: 'No cuenta con autrización para gastar',
}

export function errorAsMessage(error: InterpretedError): string {
  switch (error.kind) {
    case 'user-rejected':
      return 'Operación cancelada por el usuario'
    case 'contract-revert':
      if (error.name && error.name in agreementErrorMapping) {
        return agreementErrorMapping[error.name]!
      }
      if (error.name && error.name in erc20ErrorMapping) {
        return erc20ErrorMapping[error.name]!
      }
      return error.name ?? `El contrato revirtio con un error desconocido`
    case 'other':
      return error.message
  }
}
