# Testes do Sistema de Controle de Estoque

Este diretório contém os testes automatizados do sistema.

## Estrutura

```
src/test/
├── setup.js              # Configuração global dos testes
├── mocks/                # Mocks para serviços externos
│   └── firebase.js       # Mock do Firebase
├── utils/                # Testes de utilitários
│   └── validators.test.js
├── services/             # Testes de serviços
│   ├── entries.test.js
│   └── exits.test.js
└── components/           # Testes de componentes React
    └── Entry.test.jsx
```

## Como executar os testes

### Executar todos os testes
```bash
npm test
```

### Executar em modo watch (re-executa ao salvar arquivos)
```bash
npm test
```

### Executar com interface gráfica
```bash
npm run test:ui
```

### Executar uma vez e sair
```bash
npm run test:run
```

### Executar com cobertura de código
```bash
npm run test:coverage
```

## Comandos úteis

### Executar apenas um arquivo de teste
```bash
npm test validators
```

### Executar apenas testes que correspondem a um padrão
```bash
npm test -- --grep "validateEntry"
```

## Estrutura de um teste

```javascript
import { describe, it, expect } from 'vitest'
import { minhaFuncao } from '../utils/minhaFuncao'

describe('minhaFuncao', () => {
  it('deve retornar resultado correto', () => {
    const resultado = minhaFuncao('input')
    expect(resultado).toBe('esperado')
  })
})
```

## Boas práticas

1. **Um teste, uma coisa**: Cada teste deve verificar apenas uma funcionalidade
2. **Nomes descritivos**: Use nomes claros que descrevam o que o teste verifica
3. **Arrange-Act-Assert**: Organize seus testes em três partes:
   - Arrange: Preparar dados
   - Act: Executar ação
   - Assert: Verificar resultado
4. **Isolamento**: Cada teste deve ser independente dos outros
5. **Mocks**: Use mocks para dependências externas (Firebase, APIs, etc.)

## Adicionar novos testes

1. Crie o arquivo de teste seguindo o padrão: `*.test.js` ou `*.test.jsx`
2. Coloque no diretório correspondente (`utils/`, `services/`, `components/`)
3. Execute `npm test` para verificar se passa

## Cobertura de código

O objetivo é manter pelo menos 70% de cobertura de código. Execute `npm run test:coverage` para ver o relatório de cobertura.

## Troubleshooting

### Erro: "Cannot find module"
- Certifique-se de que todas as dependências estão instaladas: `npm install`
- Verifique os caminhos de import nos testes

### Erro: "Firebase is not defined"
- Os mocks do Firebase devem estar configurados no `setup.js`
- Verifique se os mocks estão corretos em `mocks/firebase.js`


