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

## Unit Test Guidelines

### Test Structure Pattern
Follow this consistent pattern for all unit tests:

```typescript
describe("Feature Name", () => {
  // Declare reusable variables at describe block level
  let contract: LaunchpadContract;
  let currencyClass: TokenClass;
  let sale: LaunchpadSale;
  let userBalance: TokenBalance;
  // ... other test fixtures
  
  beforeEach(() => {
    // Initialize all reusable variables here
    contract = new LaunchpadContract();
    currencyClass = currency.tokenClass();
    // ... setup test data
  });

  it("should describe expected behavior", async () => {
    // Given - Setup test prerequisites
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        sale,
        userBalance
        // ... all required chain state
      );

    const dto = new SomeDto(param1, param2);
    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    // When - Execute the contract method
    const result = await contract.SomeMethod(ctx, dto);

    // Then - Verify expected outcomes
    expect(result.Status).toBe(1);
    expect(result.Data?.someProperty).toBe("expectedValue");
  });
});
```

### Key Requirements

1. **Proper Fixture Setup**: Always use `fixture(ContractClass).registeredUsers(...).savedState(...)` to set up blockchain state
2. **DTO Construction**: Use proper constructors with required parameters - never construct with empty `new Dto()`
3. **User Alias Format**: Use `asValidUserAlias("client|username")` format for user identifiers
4. **Signing**: Always call `dto.sign(user.privateKey)` before submitting DTOs
5. **State Dependencies**: Include ALL required chain objects (token classes, instances, balances, sales) in `.savedState()`

### Common Patterns

#### Balance Setup
```typescript
const userBalance = plainToInstance(TokenBalance, {
  ...currency.tokenBalance(),
  owner: users.testUser1.identityKey,
  quantity: new BigNumber("1000")
});
```

#### DTO Creation and Signing
```typescript
const dto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("100"));
dto.expectedNativeToken = new BigNumber("10"); // Optional slippage protection
dto.uniqueKey = randomUniqueKey();
dto.sign(users.testUser1.privateKey);
```

#### Result Validation
```typescript
// Test successful operations
expect(result.Status).toBe(1);
expect(result.Data?.outputQuantity).toBe("100");

// Test failures
expect(result.Status).toBe(0);
expect(result.ErrorKey).toContain("VALIDATION_FAILED");
expect(result.Message).toContain("expected error text");
```

### Test Data Management
- Use helper functions from `src/chaincode/test/` (e.g., `currency`, `launchpadgala`)
- Create consistent test users via `users.testUser1`, `users.testUser2`, etc.
- Use `plainToInstance()` to create properly typed test objects
- Set up complete object graphs - don't leave required properties undefined

### Execution Testing
- Always execute actual contract methods, not just internal functions
- Test both success and failure scenarios
- Verify state changes through result objects and contract responses
- Use real cryptographic signing and validation flows