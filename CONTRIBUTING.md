# Contributing to GRANULES

Thank you for your interest in contributing to GRANULES. This document provides guidelines for contributing to the project.

## Development Environment Setup

### Prerequisites

- Node.js (ES2022 compatible, v18+)
- npm

### Installation

```bash
git clone <repository-url>
cd granules
npm install
```

### Running the Project

```bash
# Start the orchestrator
npm start

# Build the TypeScript project
npm run build
```

## Running Tests

GRANULES uses [Vitest](https://vitest.dev/) as its test framework.

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

Test files are co-located with source files using the `.test.ts` suffix (e.g., `server.test.ts`).

## Coding Standards

### Test-Driven Development (TDD)

This project follows TDD principles as specified in `CLAUDE.md`:

1. **Red**: Write a failing test for the smallest valuable increment
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Improve the code while keeping tests green

### TypeScript

- The project uses strict TypeScript configuration
- Target: ES2022
- All source code is in the `src/` directory

### Code Style

- Use meaningful variable and function names
- Keep functions focused and small
- Co-locate tests with their source files

## Submitting Changes

### Branch Workflow

1. Create a feature branch from `main`
2. Make your changes following TDD
3. Ensure all tests pass (`npm test`)
4. Commit your changes with a clear commit message
5. Push your branch and open a pull request against `main`

### Commit Messages

Write clear, descriptive commit messages that explain what changed and why.

### Pull Request Guidelines

- Ensure all tests pass
- Keep pull requests focused on a single feature or fix
- Update documentation if needed

## Project Structure

```
granules/
├── src/
│   ├── index.ts           # Entry point, starts orchestrator
│   ├── server.ts          # MCP server setup
│   ├── server.test.ts     # Server tests
│   ├── orchestrator.ts    # Main loop, worker spawning
│   ├── orchestrator.test.ts
│   ├── store.ts           # Granule storage
│   ├── store.test.ts
│   ├── types.ts           # TypeScript type definitions
│   ├── worker.ts          # Worker spawning logic
│   └── tools/             # MCP tool implementations
│       ├── index.ts
│       ├── claim_granule.ts
│       ├── complete_granule.ts
│       ├── create_granule.ts
│       ├── list_granules.ts
│       └── release_granule.ts
├── logs/                  # Worker output logs (generated)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md              # Project documentation
├── CLAUDE.md              # AI assistant instructions
└── CONTRIBUTING.md        # This file
```

### Key Components

- **Orchestrator** (`orchestrator.ts`): Main loop that spawns workers and manages the system
- **MCP Server** (`server.ts`): HTTP server exposing granule management tools
- **Store** (`store.ts`): In-memory storage for granules
- **Tools** (`tools/`): Individual MCP tool implementations
- **Types** (`types.ts`): Shared TypeScript interfaces and types

## Questions?

If you have questions about contributing, please open an issue in the repository.
