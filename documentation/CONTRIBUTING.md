# Contributing to Gmail Support Triage AI

Thank you for considering contributing to this project! This document provides guidelines and standards for contributions.

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to ensure consistent and meaningful commit messages.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, missing semicolons, etc)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or correcting tests
- **build**: Changes to build process or tools
- **ci**: CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Examples

```
feat(gmail): add batch processing for large inboxes

Implement concurrent processing of Gmail threads to improve
performance when dealing with large inboxes. This reduces
processing time by up to 50%.

Closes #123
```

```
fix(logger): correct timestamp format in spreadsheet logs

The timestamp was using local time instead of UTC, causing
confusion in distributed teams. Now uses ISO 8601 format.
```

```
docs: update API key setup instructions

Add clearer instructions for obtaining Gemini API keys
and include troubleshooting section.
```

### Scope

The scope should be the module or area of the codebase:

- **ai**: AI/Gemini integration module
- **gmail**: Gmail API interactions
- **ui**: User interface components
- **logger**: Logging functionality
- **config**: Configuration management
- **utils**: Utility functions
- **draft-tracker**: Draft tracking functionality

## Git Hooks

This project uses Husky to enforce quality standards:

1. **pre-commit**: Runs linter and tests
2. **commit-msg**: Validates commit message format

If your commit is rejected, ensure it follows the conventional commit format.

## Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit using conventional commits
6. Push to your fork
7. Open a Pull Request

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Aim for high test coverage
- Use meaningful test descriptions

## Code Style

- Follow existing code patterns
- Use TypeScript types properly
- Keep functions small and focused
- Add JSDoc comments for public APIs
- No console.log statements (use Logger module)

## Pull Request Guidelines

1. Update README.md if needed
2. Update tests as appropriate
3. Ensure CI passes
4. Request review from maintainers
5. Be responsive to feedback

## Questions?

Feel free to open an issue for any questions about contributing!