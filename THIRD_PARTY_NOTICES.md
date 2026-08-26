# Third-party dependency notices

OpenFilm uses the direct npm dependencies below. Versions are pinned by
`package.json` and `package-lock.json`. The lockfile also records the resolved
transitive dependency graph and its license metadata. Running `npm ci` installs
the package license files under `node_modules`.

OpenFilm does not ship remote fonts, stock images, analytics scripts, an update
client, or platform installers. The bundled sample photograph is project-owned
fixture data used for automated browser tests.

## Runtime dependencies

| Package     | Version | License | Project                                                        |
| ----------- | ------: | ------- | -------------------------------------------------------------- |
| `react`     |  19.2.8 | MIT     | [github.com/facebook/react](https://github.com/facebook/react) |
| `react-dom` |  19.2.8 | MIT     | [github.com/facebook/react](https://github.com/facebook/react) |

## Development dependencies

| Package                       | Version | License    | Project                                                                                                          |
| ----------------------------- | ------: | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `@axe-core/playwright`        |  4.13.0 | MPL-2.0    | [github.com/dequelabs/axe-core-npm](https://github.com/dequelabs/axe-core-npm)                                   |
| `@eslint/js`                  |  10.0.1 | MIT        | [github.com/eslint/eslint](https://github.com/eslint/eslint)                                                     |
| `@playwright/test`            |  1.62.1 | Apache-2.0 | [github.com/microsoft/playwright](https://github.com/microsoft/playwright)                                       |
| `@testing-library/jest-dom`   |   7.0.1 | MIT        | [github.com/testing-library/jest-dom](https://github.com/testing-library/jest-dom)                               |
| `@testing-library/react`      |  16.3.2 | MIT        | [github.com/testing-library/react-testing-library](https://github.com/testing-library/react-testing-library)     |
| `@types/node`                 |  26.2.0 | MIT        | [github.com/DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)                 |
| `@types/react`                | 19.2.18 | MIT        | [github.com/DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)                 |
| `@types/react-dom`            |  19.2.4 | MIT        | [github.com/DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)                 |
| `@vitejs/plugin-react`        |   6.1.0 | MIT        | [github.com/vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react)                               |
| `eslint`                      |  10.9.0 | MIT        | [eslint.org](https://eslint.org)                                                                                 |
| `eslint-plugin-react-hooks`   |   7.1.1 | MIT        | [github.com/facebook/react](https://github.com/facebook/react)                                                   |
| `eslint-plugin-react-refresh` |   0.5.4 | MIT        | [github.com/ArnaudBarre/eslint-plugin-react-refresh](https://github.com/ArnaudBarre/eslint-plugin-react-refresh) |
| `jsdom`                       |  29.1.1 | MIT        | [github.com/jsdom/jsdom](https://github.com/jsdom/jsdom)                                                         |
| `prettier`                    |   3.9.6 | MIT        | [prettier.io](https://prettier.io)                                                                               |
| `typescript`                  |   5.9.3 | Apache-2.0 | [github.com/microsoft/TypeScript](https://github.com/microsoft/TypeScript)                                       |
| `typescript-eslint`           |  8.67.0 | MIT        | [github.com/typescript-eslint/typescript-eslint](https://github.com/typescript-eslint/typescript-eslint)         |
| `vite`                        |   8.2.2 | MIT        | [github.com/vitejs/vite](https://github.com/vitejs/vite)                                                         |
| `vitest`                      |  4.1.11 | MIT        | [github.com/vitest-dev/vitest](https://github.com/vitest-dev/vitest)                                             |

The license texts for these packages are distributed by npm with each package.
For the complete transitive list, see [`package-lock.json`](./package-lock.json).
