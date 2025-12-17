# 🔥 Como Configurar o Firebase

Este guia explica como vincular o projeto a uma nova conta Firebase usando variáveis de ambiente.

## 📋 Passo a Passo

### 1. Obter as Credenciais do Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto (ou crie um novo)
3. Clique no ícone de **engrenagem** (⚙️) > **Configurações do projeto**
4. Role até a seção **Seus aplicativos**
5. Se já houver um app web, clique nele. Caso contrário:
   - Clique no ícone **`</>`** (Web)
   - Registre o app com um nome (ex: "Controle de Estoque")
   - Clique em **Registrar app**
6. Copie as credenciais que aparecem (ou role até a seção "Configuração do SDK")

Você precisará das seguintes informações:
- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

### 2. Criar o Arquivo .env

Na raiz do projeto (`controle-estoque/`), crie um arquivo chamado `.env` com o seguinte conteúdo:

```env
VITE_FIREBASE_API_KEY=sua-api-key-aqui
VITE_FIREBASE_AUTH_DOMAIN=seu-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-project-id
VITE_FIREBASE_STORAGE_BUCKET=seu-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=seu-messaging-sender-id
VITE_FIREBASE_APP_ID=seu-app-id
```

**Exemplo:**
```env
VITE_FIREBASE_API_KEY=AIzaSyCh-55LWeahrnI1jyCp8dEBm2rs7IN5gHg
VITE_FIREBASE_AUTH_DOMAIN=meu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=meu-projeto
VITE_FIREBASE_STORAGE_BUCKET=meu-projeto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

### 3. Configurar o Firebase no Console

#### 3.1. Authentication
1. No Firebase Console, vá em **Authentication**
2. Clique em **Começar** (se ainda não estiver ativado)
3. Habilite o método **Email/Password**
4. Clique em **Salvar**

#### 3.2. Firestore Database
1. No Firebase Console, vá em **Firestore Database**
2. Clique em **Criar banco de dados**
3. Escolha o modo de produção
4. Selecione uma localização (ex: `southamerica-east1` para Brasil)
5. Clique em **Ativar**

#### 3.3. Regras de Segurança
1. No Firebase Console, vá em **Firestore Database** > **Regras**
2. Cole o conteúdo do arquivo `firestore.rules` que está na raiz do projeto
3. Clique em **Publicar**

#### 3.4. Índices do Firestore (se necessário)
1. No Firebase Console, vá em **Firestore Database** > **Índices**
2. Se houver erros de índice, o Firebase mostrará links para criá-los automaticamente
3. Ou importe o arquivo `firestore.indexes.json` que está na raiz do projeto

### 4. Reiniciar o Servidor de Desenvolvimento

Após criar o arquivo `.env`, você precisa reiniciar o servidor:

```bash
# Pare o servidor (Ctrl+C) e inicie novamente
npm run dev
```

⚠️ **Importante:** O Vite só carrega variáveis de ambiente na inicialização. Se você criar ou modificar o `.env`, precisa reiniciar o servidor.

### 5. Verificar se Funcionou

1. Abra o console do navegador (F12)
2. Verifique se não há erros relacionados ao Firebase
3. Tente fazer login no sistema

## 🔒 Segurança

- ✅ O arquivo `.env` está no `.gitignore` e **não será commitado** no Git
- ✅ Nunca compartilhe suas credenciais do Firebase publicamente
- ✅ Use diferentes projetos Firebase para desenvolvimento e produção

## 🚀 Para Produção

Ao fazer deploy (ex: Firebase Hosting, Vercel, Netlify), configure as variáveis de ambiente na plataforma:

- **Firebase Hosting:** Use o Firebase CLI ou configure no console
- **Vercel:** Vá em Settings > Environment Variables
- **Netlify:** Vá em Site settings > Environment variables

## ❓ Problemas Comuns

### "Variáveis de ambiente do Firebase não configuradas"
- Verifique se o arquivo `.env` existe na raiz do projeto
- Verifique se as variáveis começam com `VITE_`
- Reinicie o servidor de desenvolvimento

### "Firebase: Error (auth/invalid-api-key)"
- Verifique se copiou a `apiKey` corretamente
- Certifique-se de que não há espaços extras nas variáveis

### "Permission denied" no Firestore
- Verifique se as regras de segurança estão configuradas corretamente
- Verifique se o usuário está autenticado

## 📝 Notas

- As variáveis de ambiente no Vite devem começar com `VITE_` para serem expostas ao código do cliente
- O arquivo `.env` é específico para cada ambiente (desenvolvimento, produção)
- Você pode criar `.env.local` para configurações locais que não serão commitadas





