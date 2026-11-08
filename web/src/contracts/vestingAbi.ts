import { parseAbi } from 'viem'

const erc20ErrorsAbi = parseAbi([
  'error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)',
  'error ERC20InvalidSender(address sender)',
  'error ERC20InvalidReceiver(address receiver)',
  'error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)',
  'error ERC20InvalidApprover(address approver)',
  'error ERC20InvalidSpender(address spender)',
])

export const vestingAbi = [
  {
    inputs: [],
    name: 'AgreementEnded',
    type: 'error',
  },
  {
    inputs: [],
    name: 'AgreementNotActive',
    type: 'error',
  },
  {
    inputs: [],
    name: 'AgreementNotFound',
    type: 'error',
  },
  {
    inputs: [],
    name: 'AgreementNotRevocable',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InsufficientVestedAmount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidAmount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidBeneficiary',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidDateRange',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'SafeERC20FailedOperation',
    type: 'error',
  },
  {
    inputs: [],
    name: 'UnauthorizedBeneficiary',
    type: 'error',
  },
  {
    inputs: [],
    name: 'UnauthorizedPayer',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'agreementId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'payer',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'beneficiary',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'vestedAmount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'refundedAmount',
        type: 'uint256',
      },
    ],
    name: 'AgreementCancelled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'agreementId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'payer',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'beneficiary',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'totalAmount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'startDate',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'endDate',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'revocable',
        type: 'bool',
      },
    ],
    name: 'AgreementCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'agreementId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'beneficiary',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'AgreementWithdrawal',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'agreements',
    outputs: [
      {
        internalType: 'address',
        name: 'payer',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'address',
            name: 'beneficiary',
            type: 'address',
          },
          {
            internalType: 'contract IERC20',
            name: 'token',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'totalAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'startDate',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'endDate',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'revocable',
            type: 'bool',
          },
        ],
        internalType: 'struct Vesting.AgreementConfiguration',
        name: 'configuration',
        type: 'tuple',
      },
      {
        internalType: 'enum Vesting.AgreementState',
        name: 'state',
        type: 'uint8',
      },
      {
        internalType: 'uint256',
        name: 'vestedAmountBeforeCancelled',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'alreadyWithdrawnAmount',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'agreementId',
        type: 'uint256',
      },
    ],
    name: 'cancelAgreement',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'agreementId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'claimAmount',
        type: 'uint256',
      },
    ],
    name: 'claimAmountFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: 'address',
            name: 'beneficiary',
            type: 'address',
          },
          {
            internalType: 'contract IERC20',
            name: 'token',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'totalAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'startDate',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'endDate',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'revocable',
            type: 'bool',
          },
        ],
        internalType: 'struct Vesting.AgreementConfiguration',
        name: 'config',
        type: 'tuple',
      },
    ],
    name: 'createAgreement',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'agreementId',
        type: 'uint256',
      },
    ],
    name: 'vestedAmountOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  ...erc20ErrorsAbi,
] as const
