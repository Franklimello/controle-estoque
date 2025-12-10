# 🚀 Guia de Deploy para Produção

## 📋 Pré-requisitos

- ✅ Firebase CLI instalado
- ✅ Login no Firebase feito
- ✅ Projeto configurado: `controle-estoque-d918f`
- ✅ Índices do Firestore criados
- ✅ Regras do Firestore configuradas

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

- **URL Principal**: `https://controle-estoque-d918f.web.app`
- **URL Alternativa**: `https://controle-estoque-d918f.firebaseapp.com`

## 🔄 Atualizações Futuras

Para atualizar o site após fazer mudanças:

```bash
# 1. Build
npm run build

# 2. Deploy
firebase deploy --only hosting
```

## ⚙️ Configurações de Domínio Customizado (Opcional)

1. Acesse: https://console.firebase.google.com/project/controle-estoque-d918f/hosting
2. Clique em "Adicionar domínio customizado"
3. Siga as instruções para configurar seu domínio

## 📊 Verificar Deploy

Após o deploy, você pode verificar:
- **Console Firebase**: https://console.firebase.google.com/project/controle-estoque-d918f/hosting
- **Logs**: `firebase hosting:channel:list`

## 🐛 Troubleshooting

### Erro: "No currently active project"
```bash
firebase use controle-estoque-d918f
```

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


