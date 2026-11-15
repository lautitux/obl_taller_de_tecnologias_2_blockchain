import { vestingAbi } from '@/abis/vesting-abi'
import {
  ChainMismatchError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
  type ContractErrorName,
} from 'viem'

type InterpretedError =
  | { kind: 'user-rejected' }
  | { kind: 'contract-revert'; name?: string; args?: readonly unknown[] }
  | { kind: 'other'; message: string }

const wagmiErrorMessages: Record<string, string> = {
  ConnectorNotConnectedError: 'Conectá tu billetera para continuar.',
  ConnectorChainMismatchError:
    'La billetera está conectada a otra red. Cambiá de red e intentá de nuevo.',
  ConnectorAccountNotFoundError: 'La cuenta seleccionada no está disponible en la billetera.',
}

function findInCauseChain(error: unknown, predicate: (error: unknown) => boolean): unknown {
  const seen = new Set<unknown>()
  let current = error
  while (current != null && !seen.has(current)) {
    if (predicate(current)) return current
    seen.add(current)
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined
}

export function interpretError(error: unknown): InterpretedError {
  if (findInCauseChain(error, (e) => e instanceof UserRejectedRequestError)) {
    return { kind: 'user-rejected' }
  }

  const revert = findInCauseChain(error, (e) => e instanceof ContractFunctionRevertedError)
  if (revert instanceof ContractFunctionRevertedError) {
    return { kind: 'contract-revert', name: revert.data?.errorName, args: revert.data?.args }
  }

  if (findInCauseChain(error, (e) => e instanceof InsufficientFundsError)) {
    return { kind: 'other', message: 'No tenés saldo suficiente para pagar el gas.' }
  }
  if (findInCauseChain(error, (e) => e instanceof ChainMismatchError)) {
    return { kind: 'other', message: wagmiErrorMessages.ConnectorChainMismatchError! }
  }

  const wagmiError = findInCauseChain(error, (e) => (errorName(e) ?? '') in wagmiErrorMessages)
  if (wagmiError) {
    return { kind: 'other', message: wagmiErrorMessages[errorName(wagmiError) ?? '']! }
  }

  if (error instanceof Error) {
    const shortMessage = (error as Error & { shortMessage?: string }).shortMessage
    return { kind: 'other', message: shortMessage ?? error.message }
  }
  return { kind: 'other', message: 'Error desconocido.' }
}

const contractErrorMessages: Record<ContractErrorName<typeof vestingAbi>, string> = {
  InvalidBeneficiary: 'El beneficiario de un acuerdo no puede ser la dirección cero.',
  InvalidAmount: 'La cantidad de tokens no puede ser 0.',
  InvalidDateRange: 'La fecha de inicio debe ser anterior a la fecha de finalización.',
  AgreementNotRevocable: 'El acuerdo no es revocable y por tanto no puede ser cancelado.',
  UnauthorizedPayer: 'Solo el pagador de este acuerdo puede realizar la operación.',
  AgreementEnded: 'El acuerdo ya finalizó.',
  UnauthorizedBeneficiary: 'Solo el beneficiario de este acuerdo puede realizar la operación.',
  InsufficientVestedAmount: 'El acuerdo no tiene suficiente saldo devengado.',
  AgreementNotFound: 'El acuerdo especificado no existe.',
  AgreementNotActive: 'El acuerdo no se encuentra activo.',
  SafeERC20FailedOperation: 'El token rechazó la transferencia.',
  ERC20InsufficientBalance: 'El balance de tokens es insuficiente.',
  ERC20InvalidSender: 'El remitente de tokens es inválido.',
  ERC20InvalidReceiver: 'El receptor de tokens es inválido.',
  ERC20InsufficientAllowance: 'La cantidad de tokens autorizados es insuficiente.',
  ERC20InvalidApprover: 'No contás con autorización para aprobar.',
  ERC20InvalidSpender: 'La dirección autorizada a gastar es inválida.',
}

function isKnownContractError(name: string): name is keyof typeof contractErrorMessages {
  return name in contractErrorMessages
}

export function errorAsMessage(error: InterpretedError): string {
  switch (error.kind) {
    case 'user-rejected':
      return 'Operación cancelada por el usuario.'
    case 'contract-revert':
      if (error.name && isKnownContractError(error.name)) {
        return contractErrorMessages[error.name]
      }
      return error.name
        ? `El contrato revirtió con el error ${error.name}.`
        : 'El contrato revirtió con un error desconocido.'
    case 'other':
      return error.message
  }
}
