# 📝 Guia de Testes - Sistema de Controle de Estoque

## ✅ Testes Criados

Criei uma estrutura completa de testes automatizados para o sistema usando **Vitest** e **React Testing Library**.

### 📁 Estrutura de Arquivos

```
controle-estoque/
├── src/test/
│   ├── setup.js                          # Configuração global
│   ├── mocks/
│   │   └── firebase.js                   # Mocks do Firebase
│   ├── utils/
│   │   └── validators.test.js           # ✅ Testes dos validadores
│   ├── services/
│   │   ├── entries.test.js              # ✅ Testes do serviço de entradas
│   │   └── exits.test.js                # ✅ Testes do serviço de saídas
│   ├── components/
│   │   └── Entry.test.jsx               # ✅ Testes do componente Entry
│   └── README.md                        # Documentação dos testes
├── vite.config.js                        # ✅ Configurado para Vitest
└── package.json                          # ✅ Scripts de teste adicionados
```

## 🚀 Como Usar

### 1. Instalar Dependências

```bash
npm install
```

Isso instalará todas as dependências necessárias para os testes:
- `vitest` - Framework de testes
- `@testing-library/react` - Utilitários para testar React
- `@testing-library/jest-dom` - Matchers adicionais
- `@testing-library/user-event` - Simulação de eventos do usuário
- `jsdom` - Ambiente DOM para testes
- `@vitest/ui` - Interface gráfica para testes
- `@vitest/coverage-v8` - Cobertura de código

### 2. Executar Testes

```bash
# Modo watch (re-executa ao salvar arquivos)
npm test

# Executar uma vez e sair
npm run test:run

# Interface gráfica (recomendado para desenvolvimento)
npm run test:ui

# Com cobertura de código
npm run test:coverage
```

## 📊 Testes Implementados

### ✅ Validadores (`validators.test.js`)

**31 testes** cobrindo todas as funções de validação:

- ✅ `isValidCodigo` - Validação de código de barras
- ✅ `isValidQuantidade` - Validação de quantidades
- ✅ `isValidEmail` - Validação de emails
- ✅ `isValidPassword` - Validação de senhas
- ✅ `validateItem` - Validação completa de itens
- ✅ `validateEntry` - Validação de entradas
- ✅ `validateExit` - Validação de saídas
- ✅ `formatDate` - Formatação de datas

**Exemplos de cenários testados:**
- Códigos válidos e inválidos
- Quantidades positivas, negativas, zero, NaN, Infinity
- Emails válidos e inválidos
- Senhas com tamanho mínimo
- Validação de campos obrigatórios
- Validação de regras de negócio

### ✅ Serviço de Entradas (`entries.test.js`)

**6 testes** cobrindo o fluxo de entradas:

- ✅ Validação de quantidade inválida
- ✅ Validação de código/nome obrigatório
- ✅ Criação automática de item quando não existe
- ✅ Incremento de estoque de item existente
- ✅ Normalização de validade
- ✅ Tratamento de validade vazia

**Exemplos de cenários testados:**
- Tentar registrar entrada sem quantidade
- Tentar registrar entrada sem código nem nome
- Criar item automaticamente na primeira entrada
- Incrementar estoque corretamente
- Gerenciar validade de lotes

### ✅ Serviço de Saídas (`exits.test.js`)

**8 testes** cobrindo o fluxo de saídas:

- ✅ Validação de quantidade inválida
- ✅ Validação de código/itemId obrigatório
- ✅ Item não encontrado
- ✅ Estoque insuficiente
- ✅ Processamento de saída com sucesso
- ✅ Busca por itemId
- ✅ Atualização de validade quando há lotes restantes
- ✅ Limpeza de validade quando não há lotes

**Exemplos de cenários testados:**
- Bloquear saída quando estoque é insuficiente
- Processar saída corretamente quando há estoque
- Consumir lotes seguindo FIFO
- Atualizar validade do item após saída

### ✅ Componente Entry (`Entry.test.jsx`)

**8 testes** cobrindo a interface do usuário:

- ✅ Renderização do formulário
- ✅ Preenchimento de campos
- ✅ Busca automática de item por código
- ✅ Exibição de item encontrado
- ✅ Validação de campos obrigatórios
- ✅ Processamento de entrada com sucesso
- ✅ Tratamento de erros
- ✅ Controle de acesso por permissão

**Exemplos de cenários testados:**
- Usuário preenche formulário
- Sistema busca item automaticamente
- Sistema exibe item encontrado
- Sistema valida antes de submeter
- Sistema processa entrada corretamente
- Sistema bloqueia acesso sem permissão

## 📈 Estatísticas

- **Total de testes**: ~53 testes
- **Cobertura estimada**: 
  - Validadores: ~95%
  - Serviços: ~70%
  - Componentes: ~40% (pode ser expandido)

## 🔄 Próximos Passos Recomendados

### Alta Prioridade

1. **Adicionar mais testes de componentes**
   - `Exit.test.jsx`
   - `Items.test.jsx`
   - `Dashboard.test.jsx`

2. **Testes de integração**
   - Fluxo completo entrada → item → estoque
   - Fluxo completo saída → item → estoque
   - Sistema de lotes e validade

3. **Testes de serviços adicionais**
   - `items.test.js`
   - `batches.test.js`
   - `users.test.js`

### Média Prioridade

4. **Testes E2E (End-to-End)**
   - Usar Playwright ou Cypress
   - Testar fluxos completos do usuário

5. **Testes de performance**
   - Tempo de resposta de queries
   - Performance de renderização

## 💡 Dicas

### Executar apenas um arquivo
```bash
npm test validators
```

### Executar apenas testes que correspondem a um padrão
```bash
npm test -- --grep "validateEntry"
```

### Ver cobertura de um arquivo específico
```bash
npm run test:coverage -- validators
```

### Debug de testes
Adicione `console.log` ou use `debugger`:
```javascript
it('teste de debug', () => {
  debugger // Pausa aqui no modo watch
  expect(resultado).toBe(true)
})
```

## ⚠️ Notas Importantes

1. **Mocks do Firebase**: Os testes usam mocks do Firebase, então não precisam de conexão real com o banco
2. **Isolamento**: Cada teste é independente e não afeta os outros
3. **Performance**: Todos os testes devem rodar em menos de 5 segundos
4. **Manutenção**: Atualize os testes quando adicionar novas funcionalidades

## 🐛 Troubleshooting

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "Firebase is not defined"
Os mocks estão configurados automaticamente. Se houver problema, verifique `src/test/setup.js`

### Testes muito lentos
- Use `vi.mock()` para mockar módulos pesados
- Evite fazer chamadas reais ao Firebase

### Testes falhando após mudanças
- Verifique se os mocks estão atualizados
- Atualize as expectativas conforme o código mudou

## 📚 Recursos

- [Documentação do Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Guia de testes do projeto](./src/test/README.md)

---

**Status**: ✅ Estrutura completa criada e funcional

Para começar, execute:
```bash
npm install
npm test
```


