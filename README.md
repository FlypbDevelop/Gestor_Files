# Gestor de Arquivos

Sistema de Gerenciamento de Arquivos com controle de acesso baseado em planos de assinatura.

## Estrutura do Projeto

Este é um monorepo contendo:

- **client/**: Frontend React com TypeScript, Vite e TailwindCSS
- **server/**: Backend Node.js com Express, SQLite3 e JWT

## Requisitos

- Node.js 18+
- npm 9+

## Instalação

```bash
# Instalar dependências de todos os workspaces
npm install
```

## Desenvolvimento

```bash
# Iniciar servidor e cliente simultaneamente
npm run dev

# Iniciar apenas o servidor
npm run dev:server

# Iniciar apenas o cliente
npm run dev:client
```

O servidor estará disponível em `http://localhost:3000`  
O cliente estará disponível em `http://localhost:5173`

## Build

```bash
# Build de ambos os projetos
npm run build

# Build apenas do servidor
npm run build:server

# Build apenas do cliente
npm run build:client
```

## Testes

```bash
# Executar todos os testes
npm test

# Testes do servidor
npm run test:server

# Testes do cliente
npm run test:client
```

## Configuração

### Server

Copie `.env.example` para `.env` no diretório `server/` e configure as variáveis:

```env
PORT=3000
JWT_SECRET=seu-secret-aqui
JWT_EXPIRATION=24h
UPLOAD_DIR=./uploads
DB_PATH=./database.sqlite
NODE_ENV=development
```

### Client

O cliente usa proxy do Vite para se comunicar com o servidor em desenvolvimento.

## Estrutura de Diretórios

```
gestor-files/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── services/       # API clients
│   │   ├── hooks/          # Custom hooks
│   │   ├── contexts/       # React contexts
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utilitários
│   └── public/             # Assets estáticos
│
├── server/                 # Backend Node.js
│   ├── src/
│   │   ├── controllers/    # Controllers
│   │   ├── services/       # Lógica de negócio
│   │   ├── models/         # Modelos de dados
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # Rotas da API
│   │   ├── db/             # Database e migrations
│   │   ├── utils/          # Utilitários
│   │   └── config/         # Configurações
│   └── uploads/            # Arquivos enviados
│
└── README.md
```

## Tecnologias

### Backend
- Node.js 18+
- Express.js
- SQLite3
- JWT (jsonwebtoken)
- bcrypt
- multer

### Frontend
- React 18+
- TypeScript
- Vite
- TailwindCSS
- React Router
- Axios

## Licença

ISC
