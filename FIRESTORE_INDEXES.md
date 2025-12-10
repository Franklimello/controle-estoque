# 📊 Índices Necessários no Firestore

Para o sistema funcionar corretamente em produção, você precisa criar os seguintes índices no Firestore:

## 🔧 Como Criar Índices

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em **Firestore Database** > **Índices**
4. Clique em **Criar Índice**

## 📋 Índices Obrigatórios

### 1. Índice para Estoque Baixo
- **Coleção**: `items`
- **Campos**:
  - `quantidade` (Ascendente)
- **Status**: Obrigatório para busca de itens com estoque baixo

### 2. Índice para Entradas por Data
- **Coleção**: `entries`
- **Campos**:
  - `data` (Ascendente)
  - `createdAt` (Ascendente)
- **Status**: Obrigatório para filtros por data

### 3. Índice para Saídas por Data
- **Coleção**: `exits`
- **Campos**:
  - `data` (Ascendente)
  - `createdAt` (Ascendente)
- **Status**: Obrigatório para filtros por data

## ⚠️ Nota

O Firebase pode criar índices automaticamente quando você executar uma query que precisa deles. Você verá um link de erro com a opção de criar o índice automaticamente.

## ✅ Verificação

Após criar os índices, aguarde alguns minutos para que sejam propagados. O sistema funcionará normalmente mesmo sem os índices, mas com performance reduzida.


