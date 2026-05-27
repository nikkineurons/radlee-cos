# Contributing to Radlee

First off, thank you for considering contributing to Radlee! It's people like you that make open-source such a great community.

## How to Contribute

### Reporting Bugs
If you find a bug, please use the Bug Report issue template. Provide as much detail as possible, including steps to reproduce, what you expected to see, and what actually happened.

### Suggesting Enhancements
Have an idea to make Radlee better? We'd love to hear it. Please use the Feature Request issue template and clearly describe the problem you are trying to solve and your proposed solution.

### Contributing Code
If you want to contribute code to Radlee, here is the basic workflow:

1. **Fork the repository** to your own GitHub account.
2. **Clone the repository** locally.
3. **Set up Google Apps Script (clasp)**: We recommend using [clasp](https://developers.google.com/apps-script/guides/clasp) to develop and deploy Apps Script locally.
   - Run `npm install -g @google/clasp`
   - Run `clasp login`
   - Create a new project with `clasp create` or push directly to your fork.
4. **Create a new branch** for your feature or bug fix: `git checkout -b my-new-feature`
5. **Make your changes**. Keep your commits small and focused.
6. **Push your branch** to your fork: `git push origin my-new-feature`
7. **Open a Pull Request** against the `main` branch of this repository. Include a clear description of what your PR does and why it's needed.

## Code Style
- Please keep your code clean, readable, and well-commented.
- Radlee uses standard JavaScript (ES6+).
- Since Radlee runs in the Apps Script environment, ensure you are only using supported APIs and services.

## License
By contributing to Radlee, you agree that your contributions will be licensed under the MIT License.
