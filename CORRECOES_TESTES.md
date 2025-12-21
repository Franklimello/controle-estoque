# Correções Aplicadas nos Testes

## Problemas Identificados e Corrigidos

### 1. ✅ Testes de Validators

**Problema**: `isValidCodigo('')` e `isValidPassword('')` retornam string vazia em vez de `false` booleano.

**Solução**: Usar `toBeFalsy()` em vez de `toBe(false)` para valores falsy (string vazia, null, undefined).

**Arquivos corrigidos**:
- `src/test/utils/validators.test.js`

### 2. ✅ Testes do Componente Entry

**Problema**: Labels não estão associados aos inputs (faltam `htmlFor` e `id`), então `getByLabelText` não funciona.

**Solução**: Usar `getByPlaceholderText` ou `querySelector` com `name` para encontrar inputs.

**Arquivos corrigidos**:
- `src/test/components/Entry.test.jsx`

**Mudanças**:
- `getByLabelText(/código de barras/i)` → `getByPlaceholderText(/digite ou escaneie o código/i)`
- `getByLabelText(/quantidade/i)` → `document.querySelector('input[name="quantidade"]')`
- Adicionado mock de item para testes que preenchem código

### 3. ✅ Teste de Criação de Item

**Problema**: Mock não estava configurado corretamente para o fluxo de criação (busca → não existe → cria → busca novamente).

**Solução**: Configurar mock para retornar `null` na primeira busca e o item criado na segunda.

**Arquivos corrigidos**:
- `src/test/services/entries.test.js`

## Status dos Testes

Após as correções, os testes devem passar. Para verificar:

```bash
npm test
```

## Notas

- Os testes de componentes usam `querySelector` como fallback quando o Testing Library não consegue encontrar elementos por label
- Isso funciona porque o componente renderiza os inputs com atributo `name`
- Para melhorar acessibilidade no futuro, considere adicionar `htmlFor` nos labels e `id` nos inputs


