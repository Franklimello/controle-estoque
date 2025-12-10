# Sistema de Controle de Almoxarifado

Sistema completo de controle de estoque desenvolvido com React, Firebase (Firestore + Auth + Hosting), Tailwind CSS e React Router DOM.

## 🚀 Funcionalidades

- ✅ Autenticação com Firebase Auth
- ✅ Cadastro de itens com código de barras
- ✅ Registro de entradas e saídas
- ✅ Dashboard com estatísticas
- ✅ Histórico completo de movimentações
- ✅ Validação de estoque (não permite estoque negativo)
- ✅ Alertas de estoque baixo
- ✅ Exportação de dados para CSV
- ✅ Interface responsiva e moderna

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn
- Conta no Firebase
- Projeto Firebase configurado

## 🔧 Instalação

1. Clone o repositório ou navegue até a pasta do projeto:
```bash
cd controle-estoque
```

2. Instale as dependências:
```bash
npm install
```

## ⚙️ Configuração do Firebase

### 1. Criar Projeto no Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Siga as instruções para criar o projeto
4. Anote o **Project ID**

### 2. Configurar Authentication

1. No Firebase Console, vá em **Authentication**
2. Clique em **Começar**
3. Habilite o método **Email/Password**
4. Clique em **Salvar**

### 3. Configurar Firestore

1. No Firebase Console, vá em **Firestore Database**
2. Clique em **Criar banco de dados**
3. Escolha o modo de produção
4. Selecione uma localização (ex: `southamerica-east1` para Brasil)
5. Clique em **Ativar**

### 4. Configurar Regras de Segurança

1. No Firebase Console, vá em **Firestore Database** > **Regras**
2. Cole o conteúdo do arquivo `firestore.rules` que está na raiz do projeto
3. Clique em **Publicar**

### 5. Obter Credenciais

1. No Firebase Console, vá em **Configurações do projeto** (ícone de engrenagem)
2. Role até **Seus aplicativos**
3. Clique em **</>** (Web)
4. Registre o app com um nome
5. Copie as credenciais do Firebase

### 6. Configurar no Projeto

As credenciais já estão configuradas no arquivo `src/services/firebase.js`. Se precisar alterar, edite esse arquivo.

## 🏃 Executando o Projeto

### Modo de Desenvolvimento

```bash
npm run dev
```

O projeto estará disponível em `http://localhost:5173`

### Build para Produção

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`

### Preview da Build

```bash
npm run preview
```

## 📦 Estrutura do Projeto

```
controle-estoque/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   │   ├── Navbar.jsx
│   │   └── ItemCard.jsx
│   ├── context/          # Contextos React
│   │   ├── AuthContext.jsx
│   │   └── ItemsContext.jsx
│   ├── pages/           # Páginas da aplicação
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Items.jsx
│   │   ├── NewItem.jsx
│   │   ├── EditItem.jsx
│   │   ├── Entry.jsx
│   │   ├── Exit.jsx
│   │   ├── EntriesHistory.jsx
│   │   └── ExitsHistory.jsx
│   ├── services/        # Serviços Firebase
│   │   ├── firebase.js
│   │   ├── items.js
│   │   ├── entries.js
│   │   └── exits.js
│   ├── utils/           # Utilitários
│   │   └── validators.js
│   ├── App.jsx          # Componente principal com rotas
│   └── main.jsx         # Ponto de entrada
├── firestore.rules      # Regras de segurança do Firestore
└── README.md
```

## 🔐 Primeiro Acesso

1. Execute o projeto: `npm run dev`
2. Acesse `http://localhost:5173`
3. Você será redirecionado para a página de login
4. **IMPORTANTE**: Você precisa criar um usuário primeiro no Firebase Console:
   - Vá em **Authentication** > **Usuários**
   - Clique em **Adicionar usuário**
   - Digite email e senha
   - Clique em **Adicionar**
5. Faça login com as credenciais criadas

## 📱 Como Usar

### Cadastrar Item

1. Vá em **Itens** > **Novo Item**
2. Preencha os dados (nome e código são obrigatórios)
3. O item será criado com quantidade inicial = 0
4. Use a página **Entrada** para adicionar estoque

### Registrar Entrada

1. Vá em **Entrada**
2. Digite ou escaneie o código de barras
3. Se o item não existir, você pode criá-lo na mesma tela
4. Preencha a quantidade e demais informações
5. Clique em **Registrar Entrada**

### Registrar Saída

1. Vá em **Saída**
2. Digite ou escaneie o código de barras
3. O sistema verifica automaticamente o estoque disponível
4. Preencha os dados obrigatórios (setor destino)
5. O sistema bloqueia saídas maiores que o estoque disponível
6. Clique em **Registrar Saída**

### Visualizar Histórico

- **Histórico de Entradas**: Lista todas as entradas com filtros
- **Histórico de Saídas**: Lista todas as saídas com filtros
- Ambos permitem exportação para CSV

## 🚀 Deploy no Firebase Hosting

### 1. Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Fazer Login

```bash
firebase login
```

### 3. Inicializar Firebase no Projeto

```bash
firebase init hosting
```

Escolha:
- Use an existing project (selecione seu projeto)
- Public directory: `dist`
- Configure as a single-page app: **Yes**
- Set up automatic builds: **No** (ou Yes se usar GitHub Actions)

### 4. Fazer Build

```bash
npm run build
```

### 5. Deploy

```bash
firebase deploy --only hosting
```

O site estará disponível em: `https://seu-projeto-id.web.app`

### 6. Deploy das Regras do Firestore

```bash
firebase deploy --only firestore:rules
```

## 🔒 Segurança

- Todas as rotas são protegidas (requerem autenticação)
- Apenas usuários autenticados podem ler/escrever no Firestore
- Quantidades negativas são bloqueadas
- Histórico de entradas/saídas é imutável
- Código de barras não pode ser alterado após criação

## 🛠️ Tecnologias Utilizadas

- **React 19** - Biblioteca JavaScript
- **Vite** - Build tool
- **Firebase** - Backend (Auth, Firestore, Hosting)
- **Tailwind CSS** - Framework CSS
- **React Router DOM** - Roteamento
- **Lucide React** - Ícones

## 📝 Notas Importantes

- O sistema usa **transactions** do Firestore para garantir consistência nas operações de estoque
- Estoque baixo é considerado quando a quantidade é ≤ 10 unidades
- Código de barras deve ser único (o sistema valida duplicidade)
- Quantidade inicial de novos itens é sempre 0 (use Entradas para adicionar estoque)

## 🐛 Solução de Problemas

### Erro de autenticação
- Verifique se o Authentication está habilitado no Firebase Console
- Verifique se o email/senha estão corretos

### Erro ao salvar dados
- Verifique as regras do Firestore
- Verifique se o usuário está autenticado
- Verifique o console do navegador para mais detalhes

### Build falha
- Verifique se todas as dependências estão instaladas: `npm install`
- Limpe o cache: `rm -rf node_modules && npm install`

## 📄 Licença

Este projeto é de uso interno.

---

Desenvolvido com ❤️ para controle de almoxarifado
