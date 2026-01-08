# 🔑 Como Obter as Credenciais do Firebase

## Passo a Passo Rápido

1. **Acesse o Firebase Console:**
   - https://console.firebase.google.com/project/controle-estoque-3acd6/settings/general

2. **Vá até "Seus aplicativos":**
   - Role a página até encontrar a seção "Seus aplicativos"
   - Você verá um app web chamado "controle-estoque"

3. **Clique no app web** ou no ícone de configurações (⚙️)

4. **Copie as credenciais:**
   - Você verá algo como:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "controle-estoque-3acd6.firebaseapp.com",
     projectId: "controle-estoque-3acd6",
     storageBucket: "controle-estoque-3acd6.firebasestorage.app",
     messagingSenderId: "623108943506",
     appId: "1:623108943506:web:6ebeca402a747219cac04b"
   };
   ```

5. **Atualize o arquivo `.env` na raiz do projeto:**
   ```env
   VITE_FIREBASE_API_KEY=cole-a-api-key-aqui
   VITE_FIREBASE_AUTH_DOMAIN=controle-estoque-3acd6.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=controle-estoque-3acd6
   VITE_FIREBASE_STORAGE_BUCKET=controle-estoque-3acd6.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=623108943506
   VITE_FIREBASE_APP_ID=1:623108943506:web:6ebeca402a747219cac04b
   ```

## ⚠️ Importante

- O arquivo `.env` já foi criado com os valores corretos, exceto a `VITE_FIREBASE_API_KEY`
- Você precisa apenas copiar a `apiKey` do console e colar no arquivo `.env`
- Não commite o arquivo `.env` no Git (já está no .gitignore)

## ✅ Após Configurar

Execute:
```bash
npm run dev
```

Se tudo estiver correto, a aplicação deve funcionar normalmente!

