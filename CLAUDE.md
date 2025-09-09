# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
GalaChain Launchpad Chaincode - A blockchain smart contract for token sales and DEX operations built on the GalaChain platform.

## Development Commands

### Build and Compilation
- `npm run build` - Compile TypeScript to JavaScript
- `npm run build:watch` - Compile with watch mode
- `npm run clean` - Clean build artifacts

### Code Quality
- `npm run lint` - Run ESLint on .ts and .js files
- `npm run fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier

### Testing
- `npm test` - Run unit tests with Jest (uses RBAC by default)
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:e2e-mocked` - Run e2e tests with mocked chaincode
- `npm run update-snapshot` - Update Jest snapshots
- Running a single test: Use Jest with specific test file path

### Network Operations
- `npm run network:start` - Start local test network with watch mode
- `npm run network:up` - Start network with specific contracts
- `npm run network:prune` - Clean up network
- `npm run network:recreate` - Full network reset and restart

## Architecture

### Core Structure
The codebase follows a chaincode pattern with clear separation:

- **src/chaincode/** - Smart contract implementation
  - `LaunchpadContract.ts` - Main contract with all transaction methods
  - `launchpad/` - Individual transaction implementations (buy, sell, trade operations)
  - `dexLaunchpadFeeGate.ts` - Fee calculation and validation logic

- **src/api/** - External API layer
  - `types/` - DTOs and data models (LaunchpadSale, LaunchpadFeeConfig, etc.)
  - `validators/` - Custom validation decorators
  - `utils/` - Utility functions

### Key Patterns
1. **Transaction Methods**: Each major operation (buy, sell, trade) is implemented as a separate module in `src/chaincode/launchpad/`
2. **Fee Management**: Centralized fee logic through fee gates and configuration
3. **Batch Operations**: Support for batch submit authorities and batch processing
4. **GalaChain Integration**: Built on GalaChain SDK with GalaContract base class

### Dependencies
- Built on GalaChain SDK (@gala-chain/api, @gala-chain/chaincode)
- Integrates with @gala-chain/dex for DEX functionality
- Uses Fabric Contract API for blockchain interactions

### Testing Approach
- Unit tests alongside implementation files (*.spec.ts)
- E2E tests in separate e2e/ directory
- RBAC (Role-Based Access Control) enabled by default for tests
- Test environment configured via .dev-env file