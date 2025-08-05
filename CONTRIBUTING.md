# 🤝 Contributing to Susurro Audio

First off, **THANK YOU** for considering contributing to Susurro! 🎉

We're building the future of voice interfaces, and we want YOU to be part of it.

## 🚀 Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/susurro.git
cd susurro

# Install dependencies
npm install

# Start development
npm run dev

# You're ready to contribute! 🎊
```

## 💡 Ways to Contribute

### 1. 🐛 Report Bugs

Found something broken? We want to know!

**How to report:**
1. Check if the bug already exists in [Issues](https://github.com/yourusername/susurro/issues)
2. Create a new issue with:
   - Clear title: "Audio chunks not emitting on Safari"
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (browser, OS, etc.)
   - Code snippet if possible

**Bug report template:**
```markdown
## Bug Description
Audio chunks stop emitting after 5 minutes on Safari

## Steps to Reproduce
1. Open Safari 17+
2. Start recording with `useSusurro()`
3. Wait 5 minutes
4. Chunks stop arriving

## Expected Behavior
Chunks should continue emitting indefinitely

## Environment
- Browser: Safari 17.1
- OS: macOS Sonoma
- Susurro version: 2.0.0
```

### 2. ✨ Suggest Features

Have an idea that would make Susurro even better? Let's hear it!

**Great feature requests include:**
- Use case explanation
- Code examples of how it would work
- Why it benefits the community

**Example:**
```markdown
## Feature: Automatic Language Detection

### Use Case
Multi-lingual apps need to detect language automatically

### Proposed API
\```typescript
const { detectedLanguage } = useSusurro({
  autoDetectLanguage: true,
  onLanguageChange: (lang) => console.log('Switched to', lang)
});
\```

### Benefits
- Better UX for international users
- No manual language switching
- Seamless multi-lingual conversations
```

### 3. 📖 Improve Documentation

Documentation is CRUCIAL. Help us make it better!

**You can:**
- Fix typos (yes, these matter!)
- Add examples
- Clarify confusing sections
- Translate to other languages
- Add diagrams or visuals

### 4. 🔧 Submit Code

Ready to code? Here's how:

#### Setup Your Environment

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/susurro.git
cd susurro
npm install

# Create a feature branch
git checkout -b feature/awesome-improvement

# Make your changes
code .

# Run tests
npm test

# Check types
npm run type-check

# Lint your code
npm run lint

# If all passes, commit!
git add .
git commit -m "feat: add awesome improvement"
git push origin feature/awesome-improvement
```

#### Code Style

We use Prettier and ESLint. They run automatically on commit, but you can run manually:

```bash
npm run format
npm run lint:fix
```

#### Writing Good Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add automatic language detection
fix: resolve memory leak in chunk processing
docs: update README with new examples
test: add tests for VAD scoring
perf: optimize chunk emission for <200ms latency
```

#### Pull Request Process

1. **Create a PR** with a clear title and description
2. **Link any related issues**
3. **Ensure all tests pass**
4. **Add tests for new features**
5. **Update documentation if needed**
6. **Be patient and responsive** to feedback

**PR Template:**
```markdown
## What does this PR do?
Adds automatic language detection to chunks

## Type of change
- [ ] Bug fix
- [x] New feature
- [ ] Breaking change
- [ ] Documentation update

## How to test
1. Start recording in Spanish
2. Switch to English mid-sentence
3. Observe language detection in console

## Checklist
- [x] Tests pass
- [x] Documentation updated
- [x] Types are correct
- [x] Linting passes
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- useSusurro.test.ts

# Watch mode
npm run test:watch
```

### Writing Tests

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useSusurro } from '../src';

describe('New Feature', () => {
  it('should work as expected', async () => {
    const { result } = renderHook(() => useSusurro({
      // your config
    }));
    
    // Your test assertions
    expect(result.current.isRecording).toBe(false);
  });
});
```

## 🏗️ Architecture

Understanding our architecture helps you contribute better:

```
susurro/
├── packages/susurro/          # Core library
│   ├── src/
│   │   ├── hooks/            # React hooks
│   │   │   └── useSusurro.ts # Main hook
│   │   ├── lib/              # Core logic
│   │   │   ├── audio/        # Audio processing
│   │   │   ├── transcription/# Whisper integration
│   │   │   └── middleware/   # Chunk processing
│   │   └── types/            # TypeScript types
│   └── tests/                # Test files
└── examples/                  # Example apps
```

### Key Concepts

1. **SusurroChunk**: Core data structure
2. **Middleware Pipeline**: Extensible processing
3. **Dual Async**: Audio + transcription in parallel
4. **Hook-based**: React 19 patterns

## 🎯 Current Focus Areas

We especially need help with:

1. **Safari Compatibility** - Audio API quirks
2. **Performance** - Getting to <200ms latency
3. **Mobile Support** - iOS/Android optimizations
4. **Internationalization** - Multi-language support
5. **WebRTC Integration** - Real-time streaming
6. **Edge Runtime** - Vercel Edge, Cloudflare Workers

## 💬 Community

### Discord

Join our [Discord](https://discord.gg/susurro) for:
- Real-time help
- Architecture discussions  
- Feature brainstorming
- Show off your projects!

### Weekly Calls

We have community calls every Thursday at 4pm UTC. Join us to:
- Demo new features
- Discuss roadmap
- Get feedback on PRs
- Meet other contributors

## 🌟 Recognition

We believe in recognizing contributions:

- **Contributors** get listed in README
- **Active contributors** get write access
- **Major contributors** join core team
- **All contributors** get our eternal gratitude! 🙏

## 📜 Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/). TL;DR:
- Be respectful
- Be welcoming
- Be constructive
- Be kind

## 🎁 Rewards

### Hacktoberfest

We participate in Hacktoberfest! Look for issues labeled `hacktoberfest`.

### Bounties

Some issues have bounties! Look for the `bounty` label.

### Swag

Major contributors get Susurro swag! 👕

## 🚀 Your First Contribution

Never contributed to open source? No problem! Look for issues labeled `good first issue`:

```bash
# Find a good first issue
# Go to: https://github.com/yourusername/susurro/labels/good%20first%20issue

# Pick one you like
# Comment "I'll take this!"
# Start coding!
```

### Example First Issues

1. **Add JSDoc comments** to functions
2. **Fix typos** in documentation
3. **Add examples** for common use cases
4. **Write tests** for existing features
5. **Improve error messages**

## 📚 Learning Resources

New to the codebase? Check these out:

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [API Reference](./packages/susurro/README.md#api-reference)
- [Example Apps](./packages/susurro/EXAMPLES.md)
- [Video Tutorials](https://youtube.com/susurro)

## ⚡ Development Tips

### Hot Reloading

```bash
# Terminal 1: Watch library
cd packages/susurro
npm run dev

# Terminal 2: Run demo app
cd ../..
npm run dev:vite
```

### Debug Mode

```typescript
const { startRecording } = useSusurro({
  debug: true, // Enables verbose logging
  conversational: {
    onChunk: (chunk) => {
      console.log('Debug:', chunk);
    }
  }
});
```

### Performance Profiling

```typescript
const { startRecording } = useSusurro({
  conversational: {
    onChunk: (chunk) => {
      performance.mark('chunk-received');
      // Your processing
      performance.measure('chunk-processing', 'chunk-received');
    }
  }
});
```

## 🤔 Questions?

- **Discord**: Fastest response
- **GitHub Issues**: For bugs/features
- **Twitter**: [@susurroaudio](https://twitter.com/susurroaudio)
- **Email**: contribute@susurro.dev

## 🙏 Thank You!

Seriously, thank you for contributing. Every PR, issue, and idea makes Susurro better for thousands of developers worldwide.

**You're not just contributing code, you're shaping the future of voice interfaces.** 🚀

---

Ready to contribute? Pick an issue and let's build something amazing together!

```bash
# Let's go! 🎉
git checkout -b feature/your-awesome-contribution
```