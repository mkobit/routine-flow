import tseslint from 'typescript-eslint'
import obsidianmd from 'eslint-plugin-obsidianmd'
import globals from 'globals'
import functional from 'eslint-plugin-functional'
import promise from 'eslint-plugin-promise'
import stylistic from '@stylistic/eslint-plugin'
import unicorn from 'eslint-plugin-unicorn'
import { globalIgnores } from 'eslint/config'
import json from '@eslint/json'
import yml from 'eslint-plugin-yml'

const jsFiles = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs', '**/*.cjs', '**/*.mts', '**/*.cts']

function restrictToJs(config: any) {
  // Strip the `json` plugin from obsidianmd's bundled configs so our own @eslint/json
  // registration doesn't conflict with obsidianmd's bundled instance.
  const plugins: Record<string, any> = config.plugins ?? {}
  const restPlugins = Object.fromEntries(Object.entries(plugins).filter(([k]) => k !== 'json'))
  const cleaned = { ...config, plugins: restPlugins }
  if (!cleaned.files) {
    return { ...cleaned, files: jsFiles }
  }
  return cleaned
}

// Define custom rule for package.json dependency sorting
const packageJsonPlugin = {
  rules: {
    'sort-dependencies': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Sort dependencies alphabetically',
        },
        fixable: 'code',
      },
      create(context: any) {
        return {
          'Member'(node: any) {
            if (
              node.name
              && node.name.type === 'String'
              && ['dependencies', 'devDependencies', 'peerDependencies', 'scripts'].includes(node.name.value)
            ) {
              if (node.value && node.value.type === 'Object') {
                const members = node.value.members
                const memberNames = members.map((m: any) => m.name.value)
                const sortedMemberNames = [...memberNames].sort()

                const isSorted = memberNames.every((name: string, index: number) => name === sortedMemberNames[index])

                if (!isSorted) {
                  context.report({
                    node: node.value,
                    message: `Dependencies in '${node.name.value}' should be sorted alphabetically.`,
                    fix(fixer: any) {
                      const memberPairs = members.map((m: any) => {
                        return {
                          name: m.name.value,
                          // We reconstruct the JSON string for the member
                          // Assuming simple key-value pairs for deps
                          key: JSON.stringify(m.name.value),
                          value: JSON.stringify(m.value.value),
                        }
                      })

                      memberPairs.sort((a: any, b: any) => a.name.localeCompare(b.name))

                      // Reconstruct the object content with indentation
                      // Assuming standard package.json indentation (tabs)
                      // The object itself is indented by 1 tab, so members are 2 tabs.
                      const indentation = '\t\t'
                      const content = memberPairs.map((p: any) => `${indentation}${p.key}: ${p.value}`).join(',\n')

                      // Wrap in braces with correct outer indentation
                      const newText = `{\n${content}\n\t}`

                      return fixer.replaceText(node.value, newText)
                    },
                  })
                }
              }
            }
          },
        }
      },
    },
  },
}

export default tseslint.config(
  {
    ignores: [
      // Plugin install artifacts inside the test vault — excluded from linting
      'routine-flow-example-vault/.obsidian/plugins/**',
      // Beads issue tracker — generated config and data files
      '.beads/**',
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        Number: 'readonly',
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.js',
            'manifest.json',
            'eslint.config.mts',
            'esbuild.config.mjs',
            'version-bump.mjs',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.json'],
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      'no-undef': 'off',
    },
  },
  // Recommended configs
  // Note: obsidianmd.configs.recommended is left applying to docs/ too
  // (it's what registers the @typescript-eslint plugin for the whole repo --
  // see the comment below). Its Obsidian-specific rules are individually
  // turned off for docs/ in the dedicated override block further down.
  ...[...obsidianmd.configs.recommended].map(restrictToJs),
  ...yml.configs['flat/recommended'],
  // docs/ is excluded from the FP-purity and repo stylistic presets --
  // it's a separate Docusaurus/React docs site, not plugin domain code, and
  // its generated code follows the Docusaurus ecosystem's own conventions
  // (no semicolons). See the dedicated docs/** override block further
  // down for the narrower set of rules (e.g. the Date ban) that still apply.
  { ...restrictToJs(functional.configs.strict), ignores: ['docs/**'] },
  { ...restrictToJs(functional.configs.stylistic), ignores: ['docs/**'] },
  { ...restrictToJs(stylistic.configs.recommended), ignores: ['docs/**'] },
  // Note: tseslint.configs.recommended and functional.configs.externalTypeScriptRecommended
  // are intentionally NOT spread here. obsidianmd.configs.recommended already registers the
  // @typescript-eslint plugin via its internal extends. Spreading tseslint.configs.recommended
  // would redefine the plugin with a different object instance and throw a ConfigError.
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      obsidianmd,
      functional,
      promise,
      unicorn,
    },
    rules: {
      ...promise.configs.recommended.rules,

      // ObsidianMD Rules
      'obsidianmd/prefer-file-manager-trash-file': 'error',

      // Additional clean code rules
      'no-console': 'error',
      'eqeqeq': 'error',
      'curly': 'error',

      'no-restricted-globals': ['error', {
        name: 'Date',
        message: 'Use Temporal (from temporal-polyfill) instead of Date. In Obsidian code, use moment.',
      }],
      'no-restricted-imports': ['error', {
        patterns: ['**/index', '**/index.ts', '**/index.js'],
      }],

      // Type Safety Rules
      '@typescript-eslint/consistent-type-assertions': ['error', {
        assertionStyle: 'never',
      }],
      // Enforce separate type imports (User Request)
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      }],

      // Unicorn Rules
      'unicorn/numeric-separators-style': 'error',

      // Ensure strictness explicitly (reinforcing 'strict' config)
      'functional/no-let': 'error',
      'functional/no-loop-statements': 'error',
      'functional/no-conditional-statements': 'error',
      'functional/no-expression-statements': ['error', { ignoreVoid: true }],
      'functional/no-classes': 'error',
      'functional/no-this-expressions': 'error',
      'functional/no-return-void': 'error',
      'functional/no-mixed-types': 'error',
      'functional/no-try-statements': 'error',
      'functional/no-throw-statements': 'error',
      'functional/no-promise-reject': 'error',
      'functional/prefer-property-signatures': 'error',
      'functional/prefer-tacit': 'error',
      'functional/readonly-type': ['error', 'keyword'],
      'functional/no-class-inheritance': 'error',
      'functional/functional-parameters': 'error',
      'functional/immutable-data': ['error', {
        ignoreClasses: true,
        ignoreAccessorPattern: ['this.**'],
      }],
      'functional/prefer-immutable-types': ['error', {
        enforcement: 'ReadonlyShallow',
        ignoreClasses: true,
        ignoreTypePattern: ['^.*Option$'],
      }],
      'functional/type-declaration-immutability': ['error', {
        rules: [
          {
            identifiers: '^I?Mutable.+',
            immutability: 'Mutable',
            comparator: 'AtLeast',
          },
          // zod's .brand() tags a type's output with a plain (non-readonly)
          // marker property, so any branded id — and anything that embeds
          // one — looks shallower than it really is to this checker (a
          // branded string can't actually be mutated). ignoreIdentifierPattern
          // below covers the ids themselves; types that embed one as a field
          // (and so only reach ReadonlyShallow) are named here explicitly.
          {
            identifiers: '^(PhaseInstance|Session|TaskQueueItem|ItemTouch|Phase|PhaseGraph|PhaseTransition|TransitionCondition|PhaseLogTarget|CompletionPolicy|FileMutation|HookReference|HookContext|EngineState|LogEntry|RoutineParseResult|RoutineParseIssue|PhaseListConversionResult|ApplyMutationsResult|HookInvocationOutcome)$',
            immutability: 'ReadonlyShallow',
            comparator: 'AtLeast',
          },
          {
            identifiers: '^(?!I?Mutable).+',
            immutability: 'ReadonlyDeep',
            comparator: 'AtLeast',
          },
        ],
        ignoreInterfaces: false,
        ignoreIdentifierPattern: ['Id$', 'Kind$', 'Name$'],
      }],

    },
  },
  // Generic JSON
  {
    files: ['**/*.json', '**/*.jsonc'],
    ignores: ['package.json'], // handled separately
    language: 'json/json',
    plugins: {
      json,
    },
    rules: {
      'json/no-duplicate-keys': 'error',
      'json/no-empty-keys': 'error',
    },
  },
  // Configuration for package.json
  {
    files: ['package.json'],
    language: 'json/json',
    plugins: {
      json,
      'package-json': packageJsonPlugin,
    },
    rules: {
      'package-json/sort-dependencies': 'error',
      // Enable recommended JSON rules
      'json/no-duplicate-keys': 'error',
      'json/no-empty-keys': 'error',
      // Restore override for depend/ban-dependencies
      'depend/ban-dependencies': 'off',
    },
  },
  // Overrides for Obsidian Plugin Code (Views, Main, Settings)
  {
    files: ['src/views/**/*.ts', 'src/main.ts', 'src/settings.ts', 'src/settings-*.ts', 'src/timer/**/*.ts'],
    rules: {
      // RELAX Functional Rules for Obsidian API
      // The Obsidian API necessitates classes, inheritance, side effects, and mutations (of 'this').
      'functional/no-let': 'off',
      'functional/no-expression-statements': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/prefer-readonly': 'off',
      'functional/no-classes': 'off',
      'functional/no-class-inheritance': 'off',
      'functional/no-this-expressions': 'off',
      'functional/no-return-void': 'off',
      'functional/no-try-statements': 'off',
      'functional/no-throw-statements': 'off',
      'functional/no-promise-reject': 'off',
      'functional/no-loop-statements': 'off',
      'functional/no-conditional-statements': 'off',
      'functional/no-mixed-types': 'off',
      'functional/functional-parameters': 'off',
      'functional/prefer-immutable-types': 'off',
      'functional/type-declaration-immutability': 'off',
      'functional/immutable-data': ['error', {
        ignoreClasses: true,
        ignoreAccessorPattern: ['this.**'],
      }],
      '@typescript-eslint/no-unused-expressions': 'off',
      // Method-shorthand signatures are bivariant on their parameter types;
      // property/arrow signatures are checked contravariantly. Port
      // interfaces that must accept Obsidian's real classes (e.g. Vault,
      // FileManager) structurally, without a cast, need that bivariance.
      'functional/prefer-property-signatures': 'off',
    },
  },
  // script-hook.ts deliberately uses `new Function` to execute vault-authored
  // script hooks in-process, per openspec/changes/transition-hook-script-runner's
  // 2026-07-28 design decision (no runtime isolation; the bind-time
  // confirmation in script-hook-source is the trust boundary instead). This
  // is the one production file allowed to do this -- do not widen this glob.
  {
    files: ['src/timer/script-hook.ts'],
    rules: {
      'obsidianmd/rule-custom-message': 'off', // covers no-new-func for the new Function() usage above
    },
  },
  // Overrides for Tests
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', 'e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha,
      },
    },
    rules: {
      // Relax rules for Testing patterns (Assertions, Mocking, Setup/Teardown)
      'functional/no-expression-statements': 'off', // Needed for expect() assertions
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }], // Allow devDependencies in tests
      'import/no-nodejs-modules': 'off', // Node built-ins are allowed in tests and e2e fixtures
      '@typescript-eslint/no-unsafe-argument': 'off', // Allow unsafe args in tests
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'functional/no-return-void': 'off', // Needed for test/beforeEach callbacks
      'functional/no-classes': 'off', // Allowed in tests if needed (e.g. mock classes)
      'functional/no-class-inheritance': 'off',
      'functional/no-this-expressions': 'off',
      'functional/no-try-statements': 'off',
      'functional/no-throw-statements': 'off',
      'functional/no-promise-reject': 'off',
      'functional/no-loop-statements': 'off',
      'functional/no-conditional-statements': 'off',
      'functional/no-mixed-types': 'off',
      'functional/functional-parameters': 'off',
      'functional/prefer-immutable-types': 'off',
      'functional/type-declaration-immutability': 'off',
      'functional/immutable-data': ['error', {
        ignoreClasses: true,
        ignoreAccessorPattern: ['this.**'],
      }],
      'no-empty-pattern': 'off', // Playwright fixtures require ({}, use) destructure syntax
      'functional/no-let': 'off', // Allow let in Playwright e2e tests
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow non-null assertions in tests
      '@typescript-eslint/no-implied-eval': 'off', // evaluateObsidian uses new Function() to serialize/deserialize test fns
      'obsidianmd/rule-custom-message': 'off', // covers no-new-func for the same new Function() usage above
      'obsidianmd/prefer-window-timers': 'off', // Node.js process code, not Obsidian renderer code -- `window` doesn't exist here
    },
  },

  // Scripts
  {
    files: ['scripts/**/*.ts', 'scripts/**/*.cjs', 'esbuild.config.mjs', 'version-bump.mjs', '.claude/hooks/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'obsidianmd/no-plugin-as-component': 'off',
      'obsidianmd/no-view-references-in-plugin': 'off',
      'obsidianmd/prefer-file-manager-trash-file': 'off',
      'obsidianmd/prefer-active-window-timers': 'off',
      'obsidianmd/prefer-active-doc': 'off',
      'obsidianmd/prefer-instanceof': 'off',
      'obsidianmd/no-obsidian-internal-api': 'off',
      'obsidianmd/no-unsupported-features': 'off',
      'obsidianmd/no-unsupported-api': 'off',
      'obsidianmd/hardcoded-config-path': 'off',
      'functional/no-conditional-statements': 'off',
      'functional/no-expression-statements': 'off',
      'import/no-nodejs-modules': 'off',
      'no-console': 'off',
      'obsidianmd/rule-custom-message': 'off',
      'functional/no-return-void': 'off',
      'functional/no-try-statements': 'off',
      'functional/no-throw-statements': 'off',
      'functional/no-promise-reject': 'off',
      'functional/no-loop-statements': 'off',
      'functional/immutable-data': 'off',
      'functional/prefer-immutable-types': 'off',
      'functional/type-declaration-immutability': 'off',
      'functional/readonly-type': 'off',
      'functional/functional-parameters': 'off',
      // Allow require in scripts
      '@typescript-eslint/no-require-imports': 'off',
      // Relax stylistic indent for scripts if mixed content, but generally enforce tab
      '@stylistic/indent': ['error', 2],
    },
  },
  // General overrides for src/ code
  // Relax select functional rules across src/ (e.g. no-try-statements, no-expression-statements)
  // to allow domain parsing logic to safely wrap throwing stdlib/parser APIs (e.g. JSON.parse,
  // Temporal.Duration.from in routine-file.ts) and permit procedural expression statements,
  // while preserving immutability and reducer-purity constraints (immutable-data).
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'functional/no-expression-statements': 'off',
      'functional/no-try-statements': 'off',
      'functional/prefer-immutable-types': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    // e2e tests should never need `as unknown as T` casts — augment the Obsidian
    // App interface in e2e/obsidian-internal.d.ts instead.
    files: ['e2e/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'TSAsExpression > TSAsExpression[typeAnnotation.type=\'TSUnknownKeyword\']',
        message: 'Avoid `as unknown as T` casts. Augment the Obsidian App interface in e2e/obsidian-internal.d.ts or use a typed accessor.',
      }],
    },
  },
  // Config files (relax rules)
  {
    files: ['eslint.config.mts', 'playwright.config.ts'],
    rules: {
      'functional/prefer-immutable-types': 'off',
      'functional/no-conditional-statements': 'off',
      'functional/no-expression-statements': 'off',
      'functional/no-return-void': 'off',
      'functional/immutable-data': 'off',
      'functional/type-declaration-immutability': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      'no-undef': 'off',
      // Tooling config, not shipped plugin code: obsidianmd's type-checked rules
      // walk ESLint's own loosely-typed config/rule APIs (Rule.RuleContext, ESTree
      // nodes), which are inherently `any`-shaped -- and hardcoded-config-path
      // fires on the vault-artifact ignore glob below, which is a real path, not a
      // plugin-runtime reference.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'obsidianmd/hardcoded-config-path': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: {
      'no-undef': 'off',
    },
  },
  // Overrides for docs/ -- a separate Docusaurus/React docs site, not
  // plugin domain code or an Obsidian API consumer. General hygiene (
  // no-console, eqeqeq, the Date ban) stays enforced; FP-purity and
  // type-unsafe-* rules that fight a normal React app are relaxed here,
  // mirroring the same carve-out already given to tests/e2e above.
  {
    files: ['docs/**/*.ts', 'docs/**/*.tsx', 'docs/**/*.mts', 'docs/**/*.cts'],
    rules: {
      'obsidianmd/prefer-file-manager-trash-file': 'off',
      'functional/no-let': 'off',
      'functional/no-loop-statements': 'off',
      'functional/no-conditional-statements': 'off',
      'functional/no-expression-statements': 'off',
      'functional/no-classes': 'off',
      'functional/no-this-expressions': 'off',
      'functional/no-return-void': 'off',
      'functional/no-mixed-types': 'off',
      'functional/no-try-statements': 'off',
      'functional/no-throw-statements': 'off',
      'functional/no-promise-reject': 'off',
      'functional/no-class-inheritance': 'off',
      'functional/functional-parameters': 'off',
      'functional/immutable-data': 'off',
      'functional/prefer-immutable-types': 'off',
      'functional/type-declaration-immutability': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  globalIgnores([
    'node_modules',
    'dist',
    'eslint.config.js',
    'versions.json',
    'main.js',
    'coverage',
    'playwright-report/**',
    'test-results/**',
    // Docusaurus build output/cache (gitignored, but may exist locally) and
    // its generated tsconfig.json, which has leading `//` comments that fail
    // strict (non-JSONC) JSON parsing.
    'docs/build/**',
    'docs/.docusaurus/**',
    'docs/tsconfig.json',
  ]),
)
