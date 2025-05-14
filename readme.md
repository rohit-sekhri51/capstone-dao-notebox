# NoteBox + DAO_Vote: Solana CPI PoC

![Solana](https://img.shields.io/badge/Solana-Blockchain-4CA1A3?logo=solana) ![Anchor](https://img.shields.io/badge/Anchor-Framework-blueviolet) ![Status](https://img.shields.io/badge/PoC-Complete-brightgreen)

## Overview

This is a modular Solana Proof-of-Concept (PoC) that demonstrates:
- **NoteBox:** An on-chain publishing platform (tweets, blogs, etc.)
- **DAO_Vote:** A DAO governance program that can change NoteBox's behavior via CPI
- **CPI Flow:** DAO executes `update_config` on NoteBox using PDA-based authority

## Features

### NoteBox Program
- `initialize_config` — One-time config setup (admin = DAO signer)
- `create_post` — Creates a user-owned post PDA
- `update_post`, `delete_post` — Post maintenance
- `update_config` — Only callable via DAO signer PDA

### DAO_Vote Program
- `create_proposal` — DAO members propose config changes
- `create_vote` — Members vote yes/no
- `close_proposal` — On success, calls NoteBox `update_config` via CPI

## CPI Architecture

- DAO and Notebox are **separate programs**
- DAO signer PDA: `seeds = [b"dao-authority"]`
- Config PDA: `seeds = [b"config"]`
- `with_signer()` used to authorize CPI from DAO to NoteBox

## Deployment

### Localnet
```bash
anchor build
anchor deploy
anchor test
```

### Devnet
```bash
anchor build
anchor deploy --provider.cluster devnet
anchor idl init -f target/idl/notebox.json <PROGRAM_ID>
anchor idl init -f target/idl/dao_vote.json <PROGRAM_ID>
```

## Deployed Program IDs (Devnet)

- **NoteBox Program ID:** `2gkh4PKHmENrdnjNmb515KVbvpdWGsvbDtQ4qzC2FqrV`
- **DAO_Vote Program ID:** `6f5HD6HfhDScH56N59mcGeDa44vCwdQF65JyZS668pJf`

## Folder Structure
```
.
├── programs/
│   ├── notebox/
│   └── dao_vote/
├── tests/
│   └── notebox_dao.ts
├── migrations/
├── target/
└── Anchor.toml
```

## Development Notes
- Only DAO PDA can update config in NoteBox
- PDA bumps must be passed and derived consistently
- DAO signer PDA is never initialized (used for authorization only)

## Future Enhancements
- Token-based DAO governance
- Arweave/IPFS content storage
- Frontend integration
- On-chain voting weights
- Delete abusive content
- Ban authors by writing to a BannedUserList PDA


## How to Contribute
```bash
git clone https://github.com/rohit-sekhri51/capstone-dao-notebox.git
cd capstone-dao-notebox
anchor build && anchor test
```

## License
MIT