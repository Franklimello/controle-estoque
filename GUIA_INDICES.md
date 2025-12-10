# 📊 Guia Completo: Criar Índices no Firestore

## 🎯 Método 1: Usando Firebase CLI (Recomendado)

### Passo 1: Instalar Firebase CLI
```bash
npm install -g firebase-tools
```

### Passo 2: Fazer Login
```bash
firebase login
```

### Passo 3: Inicializar Firestore (se ainda não fez)
```bash
cd controle-estoque
firebase init firestore
```

Quando perguntado:
- **What file should be used for Firestore Rules?** → `firestore.rules`
- **What file should be used for Firestore indexes?** → `firestore.indexes.json`

### Passo 4: Deploy dos Índices
```bash
firebase deploy --only firestore:indexes
```

✅ **Pronto!** Os índices serão criados automaticamente.

---

## 🎯 Método 2: Pelo Firebase Console (Manual)

### Índice 1: Estoque Baixo (items)

1. Acesse: https://console.firebase.google.com/
2. Selecione seu projeto: **controle-estoque-d918f**
3. Vá em **Firestore Database** > **Índices**
4. Clique em **Criar Índice**
5. Preencha:
   - **Coleção**: `items`
   - **Campos para indexar**:
     - Campo: `quantidade`
     - Ordem: **Ascendente**
   - **Tipo de consulta**: **Coleção**
6. Clique em **Criar**

### Índice 2: Entradas por Data

1. Clique em **Criar Índice**
2. Preencha:
   - **Coleção**: `entries`
   - **Campos para indexar**:
     - Campo: `data`
     - Ordem: **Ascendente**
     - Campo: `createdAt`
     - Ordem: **Ascendente**
   - **Tipo de consulta**: **Coleção**
3. Clique em **Criar**

### Índice 3: Saídas por Data

1. Clique em **Criar Índice**
2. Preencha:
   - **Coleção**: `exits`
   - **Campos para indexar**:
     - Campo: `data`
     - Ordem: **Ascendente**
     - Campo: `createdAt`
     - Ordem: **Ascendente**
   - **Tipo de consulta**: **Coleção**
3. Clique em **Criar**

---

## 🎯 Método 3: Automático (Quando o Firebase Detectar)

O Firebase pode criar índices automaticamente quando você executar uma query que precisa deles:

1. Execute o sistema normalmente
2. Se aparecer um erro sobre índice faltando, você verá um link no erro
3. Clique no link para criar o índice automaticamente
4. Aguarde alguns minutos para o índice ser criado

---

## ⏱️ Tempo de Criação

- **Índices simples** (1 campo): 1-2 minutos
- **Índices compostos** (2+ campos): 2-5 minutos
- **Muitos dados**: Pode levar até 10 minutos

## ✅ Como Verificar se os Índices Foram Criados

1. Acesse: https://console.firebase.google.com/
2. Vá em **Firestore Database** > **Índices**
3. Você deve ver 3 índices listados:
   - `items` - quantidade (Ascendente)
   - `entries` - data, createdAt (Ascendente, Ascendente)
   - `exits` - data, createdAt (Ascendente, Ascendente)

## 🚨 Problemas Comuns

### Erro: "Index already exists"
- ✅ Significa que o índice já existe, está tudo certo!

### Erro: "Permission denied"
- Verifique se você está logado no Firebase CLI
- Verifique se tem permissões no projeto

### Índice não aparece
- Aguarde alguns minutos
- Recarregue a página do console

---

## 📝 Resumo dos Índices Necessários

| Coleção | Campos | Ordem | Uso |
|---------|--------|-------|-----|
| `items` | `quantidade` | ASC | Buscar itens com estoque baixo |
| `entries` | `data`, `createdAt` | ASC, ASC | Filtrar entradas por data |
| `exits` | `data`, `createdAt` | ASC, ASC | Filtrar saídas por data |

---

## 💡 Dica

Se você usar o **Método 1 (CLI)**, os índices serão criados automaticamente e você não precisa fazer nada manualmente!


