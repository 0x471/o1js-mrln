# MRLN: Rate Limiting Nullifier on Mina

## What is RLN?
Rate Limiting Nullifier enables on-chain spam and DoS preventation using Shamir's Secret Sharing. For more details you can check out: https://rate-limiting-nullifier.github.io/rln-docs/what_is_rln.html

## RLN on Ethereum by PSE
- RLN Circuit in Circom: https://github.com/Rate-Limiting-Nullifier/circom-rln
- RLN Contract in Solidity: https://github.com/Rate-Limiting-Nullifier/rln-contract



## Quick start

The repo contains 1 package:

- `packages/chain` contains everything related to the RLN app-chain

**Prerequisites:**

- Node.js v18
- pnpm
- nvm


### Setup

```zsh
git clone https://github.com/0x471/rln-o1js mrln
cd mrln

# ensures you have the right node.js version
nvm use
pnpm install
```

### Current Test Cases
*Balances*
- Adding balance
- Removing balance

*MRLN Contract*
- Initialization
- Successful registration
- Registration fails when indexCommitment exceeds the set size
- Registration fails when the deposit is less than the minimum required
- Registration fails with duplicate identity commitment
- Successful withdrawal
- Withdrawal fails when user is not registered
- Withdrawal fails when already withdrawn
- Successful release
- Release fails when no withdrawal
- Release fails during freeze period
- Successful slashing
- Slashing fails when the receiver is zero
- Slashing fails when user is not registered
- Slashing fails with self-slashing

*MRLN Circuit*


### Running tests
```zsh
# run and watch tests for the `chain` package
pnpm run test --filter=chain -- --watchAll
```

