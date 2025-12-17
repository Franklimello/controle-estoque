# 🚀 Guia de Deploy para Produção

## 📋 Pré-requisitos

- ✅ Firebase CLI instalado
- ✅ Login no Firebase feito
- ✅ Projeto configurado: `controle-estoque-3acd6`
- ✅ Índices do Firestore criados
- ✅ Regras do Firestore configuradas
- ✅ Arquivo `.env` configurado com as credenciais do Firebase

## 🔧 Passo a Passo

### 1. Build do Projeto

```bash
npm run build
```

Isso criará a pasta `dist/` com os arquivos otimizados para produção.

### 2. Deploy no Firebase Hosting

```bash
firebase deploy --only hosting
```

### 3. Deploy Completo (Hosting + Firestore)

```bash
firebase deploy
```

Isso fará deploy de:
- ✅ Hosting (site)
- ✅ Firestore Rules (regras de segurança)
- ✅ Firestore Indexes (índices)

## 🌐 URLs Após Deploy

Após o deploy, seu site estará disponível em:

- **URL Principal**: `https://controle-estoque-3acd6.web.app`
- **URL Alternativa**: `https://controle-estoque-3acd6.firebaseapp.com`

⚠️ **Importante:** A URL muda automaticamente baseada no `projectId` do Firebase. Como você mudou de conta, a URL será diferente da anterior.

## 🔄 Atualizações Futuras

Para atualizar o site após fazer mudanças:

```bash
# 1. Build
npm run build

# 2. Deploy
firebase deploy --only hosting
```

## ⚙️ Configurações de Domínio Customizado (Opcional)

1. Acesse: https://console.firebase.google.com/project/controle-estoque-3acd6/hosting
2. Clique em "Adicionar domínio customizado"
3. Siga as instruções para configurar seu domínio

## 📊 Verificar Deploy

Após o deploy, você pode verificar:
- **Console Firebase**: https://console.firebase.google.com/project/controle-estoque-3acd6/hosting
- **Logs**: `firebase hosting:channel:list`

## 🔑 Variáveis de Ambiente no Deploy

⚠️ **IMPORTANTE:** O Firebase Hosting não lê o arquivo `.env` automaticamente. As variáveis de ambiente são **injetadas durante o build** pelo Vite.

Quando você roda `npm run build`, o Vite:
1. Lê o arquivo `.env` da raiz do projeto
2. Injeta as variáveis que começam com `VITE_` no código JavaScript
3. Gera os arquivos na pasta `dist/` com as credenciais já embutidas

**Isso significa:**
- ✅ Você só precisa ter o `.env` configurado antes de fazer o build
- ✅ Não precisa configurar variáveis de ambiente no Firebase Console
- ✅ As credenciais ficam no código JavaScript (isso é seguro para credenciais públicas do Firebase)

## 🐛 Troubleshooting

### Erro: "No currently active project"
```bash
# Primeiro, faça login no Firebase
firebase login

# Depois, selecione o projeto
firebase use controle-estoque-3acd6

# Ou inicialize o Firebase no projeto (se ainda não foi feito)
firebase init
```

### Erro: "Variáveis de ambiente não encontradas"
- Verifique se o arquivo `.env` existe na raiz do projeto
- Verifique se as variáveis começam com `VITE_`
- Reinicie o terminal e tente fazer o build novamente

### Erro: "Build failed"
- Verifique se há erros no código: `npm run lint`
- Teste localmente: `npm run preview`

### Site não atualiza
- Limpe o cache do navegador (Ctrl+Shift+R)
- Aguarde alguns minutos para propagação

## ✅ Checklist Antes do Deploy

- [ ] Testar todas as funcionalidades localmente
- [ ] Verificar se não há erros no console
- [ ] Testar login/logout
- [ ] Verificar se as regras do Firestore estão corretas
- [ ] Verificar se os índices foram criados
- [ ] Fazer build sem erros
- [ ] Testar preview local: `npm run preview`


