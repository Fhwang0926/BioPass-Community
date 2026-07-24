module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  rules: {
    // 코드 스타일 관련
    'semi': ['error', 'never'],
    'quotes': ['error', 'single'],
    'comma-dangle': ['error', 'never'],
    'space-before-function-paren': ['error', {
      'anonymous': 'always',
      'named': 'never',
      'asyncArrow': 'always'
    }],
    
    // 코드 품질 관련
    'no-unused-vars': ['warn', {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],
    'no-console': 'off', // 로깅을 위해 console 허용
    'camelcase': 'off', // snake_case 모델/컬럼 이름 사용 허용
    'no-var': 'error',
    'prefer-const': 'warn',
    
    // Node.js 관련
    'no-process-env': 'off', // process.env 사용 허용
    
    // Import 관련
    'import/order': ['warn', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'never',
      'alphabetize': {
        'order': 'asc',
        'caseInsensitive': true
      }
    }]
  }
}

