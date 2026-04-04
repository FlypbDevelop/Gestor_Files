# Plano de Implementação: Sistema de Gerenciamento de Arquivos

## Visão Geral

Este plano implementa um sistema completo de gerenciamento de arquivos com controle de acesso baseado em planos de assinatura. A implementação segue uma abordagem iterativa, começando pelo backend (configuração, banco de dados, autenticação) e progredindo para funcionalidades de arquivos, frontend e PWA.

**Stack Tecnológica:**
- Backend: Node.js 18+ com Express.js, SQLite3, JWT, bcrypt
- Frontend: React 18+ com TypeScript, Vite, TailwindCSS, React Router
- Arquitetura: Monorepo (client/server)

## Tarefas

### Passo 1: Configuração Inicial e Backend

- [x] 1. Estruturar projeto monorepo
  - Criar estrutura de diretórios: `client/`, `server/`
  - Inicializar package.json em ambos os diretórios
  - Configurar scripts de desenvolvimento e build
  - _Requisitos: Base para todos os requisitos_

- [-] 2. Configurar servidor Node.js + Express
  - [x] 2.1 Criar servidor Express básico
    - Implementar `server/src/server.js` com Express
    - Configurar middleware: CORS, helmet, express.json()
    - Configurar porta e variáveis de ambiente
    - _Requisitos: 1.1, 1.2, 3.1, 3.2_
  
  - [x] 2.2 Escrever testes unitários para configuração do servidor
    - Testar inicialização do servidor
    - Testar middleware CORS e helmet
    - _Requisitos: 1.1_


- [x] 3. Configurar banco de dados SQLite
  - [x] 3.1 Criar módulo de conexão SQLite
    - Implementar `server/src/db/database.js` com conexão SQLite
    - Configurar path do banco via variável de ambiente
    - Implementar função de inicialização do banco
    - _Requisitos: 1.1, 2.1, 8.1_
  
  - [x] 3.2 Criar sistema de migrations
    - Implementar `MigrationRunner` para executar migrations
    - Criar tabela `migrations` para tracking
    - Implementar lógica de detecção de migrations pendentes
    - _Requisitos: 1.1, 2.1_
  
  - [ ]* 3.3 Escrever testes unitários para migrations
    - Testar execução de migrations
    - Testar detecção de migrations já executadas
    - _Requisitos: 1.1_

- [x] 4. Criar tabelas do banco de dados
  - [x] 4.1 Criar migration para tabela plans
    - Implementar `001_create_plans_table.sql`
    - Definir schema: id, name, price, features (JSON), timestamps
    - Criar índice em name
    - _Requisitos: 10.1, 10.2, 10.3_
  
  - [x] 4.2 Criar migration para tabela users
    - Implementar `002_create_users_table.sql`
    - Definir schema: id, name, email, password_hash, role, plan_id, timestamps
    - Criar índices em email e plan_id
    - Adicionar constraint CHECK para role (USER, ADMIN)
    - _Requisitos: 1.1, 1.3, 2.1, 2.2, 3.4_

  
  - [x] 4.3 Criar migration para tabela files
    - Implementar `003_create_files_table.sql`
    - Definir schema: id, filename, path, mime_type, size, uploaded_by, allowed_plan_ids (JSON), max_downloads_per_user, timestamps
    - Criar índices em uploaded_by e created_at
    - _Requisitos: 4.1, 4.2, 5.1, 5.2, 5.3_
  
  - [x] 4.4 Criar migration para tabela downloads
    - Implementar `004_create_downloads_table.sql`
    - Definir schema: id, user_id, file_id, ip_address, downloaded_at
    - Criar índices em (user_id, file_id), file_id e downloaded_at
    - _Requisitos: 8.1, 8.3, 9.1_
  
  - [ ]* 4.5 Escrever testes de property para schema do banco
    - **Property 14: Plan IDs round-trip correctly**
    - **Valida: Requisitos 5.3**
    - Testar que arrays de plan IDs armazenados e recuperados são equivalentes

- [x] 5. Implementar serviço de autenticação
  - [x] 5.1 Criar AuthService com hash de senhas
    - Implementar `server/src/services/authService.js`
    - Implementar `hashPassword()` usando bcrypt com 10 rounds
    - Implementar `comparePassword()` para validação
    - _Requisitos: 1.3, 2.1_
  
  - [x] 5.2 Implementar registro de usuários
    - Implementar `register(name, email, password)` no AuthService
    - Validar formato de email (RFC 5322)
    - Validar senha mínima de 8 caracteres
    - Criar usuário com role USER e plano Free
    - Retornar erro 409 se email já existe
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

  
  - [x] 5.3 Implementar login e geração de JWT
    - Implementar `login(email, password)` no AuthService
    - Gerar JWT token com validade de 24 horas
    - Incluir userId, email e role no payload
    - Retornar erro 401 para credenciais inválidas
    - _Requisitos: 1.1, 1.2_
  
  - [x] 5.4 Implementar verificação de JWT
    - Implementar `verifyToken(token)` no AuthService
    - Validar assinatura e expiração do token
    - Retornar erro 401 para tokens expirados ou inválidos
    - _Requisitos: 1.4_
  
  - [x] 5.5 Escrever testes de property para autenticação
    - **Property 1: Valid credentials generate valid 24-hour tokens**
    - **Valida: Requisitos 1.1**
    - **Property 2: Invalid credentials return 401**
    - **Valida: Requisitos 1.2**
    - **Property 3: Expired tokens are rejected**
    - **Valida: Requisitos 1.4**
    - **Property 4: New users get default role and plan**
    - **Valida: Requisitos 2.1**
    - **Property 5: Duplicate emails are rejected**
    - **Valida: Requisitos 2.2**
    - **Property 6: Short passwords are rejected**
    - **Valida: Requisitos 2.3**
    - **Property 7: Invalid email formats are rejected**
    - **Valida: Requisitos 2.4**
  
  - [x] 5.6 Escrever testes unitários para AuthService
    - Testar casos de sucesso e erro para register
    - Testar casos de sucesso e erro para login
    - Testar validação de token
    - _Requisitos: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.4_


- [x] 6. Implementar middleware de autenticação e autorização
  - [x] 6.1 Criar middleware de autenticação JWT
    - Implementar `server/src/middleware/auth.js`
    - Extrair token do header Authorization
    - Verificar token usando AuthService
    - Adicionar dados do usuário em req.user
    - Retornar erro 401 se token ausente ou inválido
    - _Requisitos: 1.1, 1.4, 7.1_
  
  - [x] 6.2 Criar middleware de verificação de role
    - Implementar `server/src/middleware/roleCheck.js`
    - Criar função `roleCheck(allowedRoles)` que retorna middleware
    - Verificar se req.user.role está em allowedRoles
    - Retornar erro 403 se role não autorizada
    - _Requisitos: 3.1, 3.2, 3.3_
  
  - [x] 6.3 Escrever testes de property para controle de acesso
    - **Property 8: USER role cannot access admin endpoints**
    - **Valida: Requisitos 3.1**
    - **Property 9: ADMIN role can access admin endpoints**
    - **Valida: Requisitos 3.2**
  
  - [x] 6.4 Escrever testes unitários para middleware
    - Testar autenticação com token válido e inválido
    - Testar verificação de role para USER e ADMIN
    - _Requisitos: 1.4, 3.1, 3.2_

- [x] 7. Criar endpoints de autenticação
  - [x] 7.1 Implementar rotas de autenticação
    - Criar `server/src/routes/auth.js`
    - Implementar POST /api/auth/register
    - Implementar POST /api/auth/login
    - Implementar GET /api/auth/me (protegido)
    - _Requisitos: 1.1, 1.2, 2.1_

  
  - [x] 7.2 Criar controllers de autenticação
    - Implementar `server/src/controllers/authController.js`
    - Implementar `register()` controller
    - Implementar `login()` controller
    - Implementar `getCurrentUser()` controller
    - Adicionar tratamento de erros consistente
    - _Requisitos: 1.1, 1.2, 2.1_
  
  - [x] 7.3 Escrever testes de integração para endpoints de auth
    - Testar POST /api/auth/register com dados válidos e inválidos
    - Testar POST /api/auth/login com credenciais válidas e inválidas
    - Testar GET /api/auth/me com e sem token
    - _Requisitos: 1.1, 1.2, 2.1_

- [x] 8. Criar seed de dados iniciais
  - [x] 8.1 Criar migration de seed para planos padrão
    - Implementar `005_seed_default_plans.sql`
    - Inserir plano Free (price: 0.00, maxDownloadsPerMonth: 10)
    - Inserir plano Basic (price: 9.99, maxDownloadsPerMonth: 100)
    - Inserir plano Premium (price: 29.99, maxDownloadsPerMonth: -1)
    - _Requisitos: 10.1, 10.4_
  
  - [x] 8.2 Criar seed para usuário admin
    - Implementar `006_seed_admin_user.sql`
    - Criar usuário admin com email: admin@example.com, senha: admin123
    - Atribuir role ADMIN e plano Premium
    - _Requisitos: 3.2_
  
  - [x] 8.3 Escrever testes de property para planos
    - **Property 28: Plans can be created with all required fields**
    - **Valida: Requisitos 10.1**
    - **Property 29: Duplicate plan names are rejected**
    - **Valida: Requisitos 10.2**
    - **Property 30: Plan features round-trip correctly**
    - **Valida: Requisitos 10.3, 16.1, 16.2, 16.4**


- [x] 9. Checkpoint - Verificar configuração inicial
  - Executar migrations e verificar criação das tabelas
  - Testar registro e login de usuário via API
  - Verificar que usuário admin foi criado
  - Verificar que planos padrão foram criados
  - Garantir que todos os testes passam
  - Perguntar ao usuário se há dúvidas ou ajustes necessários

### Passo 2: Upload e Gestão de Arquivos (Admin)

- [x] 10. Implementar serviço de upload de arquivos
  - [x] 10.1 Configurar multer para upload
    - Instalar e configurar multer no servidor
    - Configurar diretório de uploads (`server/uploads/`)
    - Configurar limite de 100MB por arquivo
    - Implementar geração de nomes únicos para arquivos
    - _Requisitos: 4.1, 4.3_
  
  - [x] 10.2 Criar UploadService
    - Implementar `server/src/services/uploadService.js`
    - Implementar `processUpload(file, uploadedBy)`
    - Implementar `validateFile(file)` para validar tamanho
    - Implementar `generateUniqueFilename(originalName)`
    - Salvar arquivo no filesystem e criar registro no banco
    - _Requisitos: 4.1, 4.2, 4.3_
  
  - [x] 10.3 Escrever testes de property para upload
    - **Property 10: File upload creates both file and database record**
    - **Valida: Requisitos 4.1, 4.2**
    - **Property 11: Failed uploads don't create database records**
    - **Valida: Requisitos 4.4**
  
  - [x] 10.4 Escrever testes unitários para UploadService
    - Testar upload bem-sucedido
    - Testar rejeição de arquivos maiores que 100MB
    - Testar geração de nomes únicos
    - _Requisitos: 4.1, 4.3, 4.4_


- [x] 11. Implementar FileManager para gestão de arquivos
  - [x] 11.1 Criar FileManager service
    - Implementar `server/src/services/fileManager.js`
    - Implementar `createFile(fileData)` para criar registro
    - Implementar `getFileById(fileId)` para buscar arquivo
    - Implementar `listFilesForPlan(planId, userId)` para listar arquivos acessíveis
    - Implementar `deleteFile(fileId)` para remover arquivo e registro
    - _Requisitos: 4.1, 6.1, 6.2_
  
  - [x] 11.2 Implementar configuração de permissões de arquivo
    - Implementar `updateFilePermissions(fileId, allowedPlanIds, maxDownloadsPerUser)`
    - Validar que allowedPlanIds é array de IDs válidos
    - Validar que maxDownloadsPerUser é inteiro positivo ou NULL
    - _Requisitos: 5.1, 5.2, 5.4_
  
  - [x] 11.3 Escrever testes de property para FileManager
    - **Property 12: Multiple plans can be assigned to files**
    - **Valida: Requisitos 5.1**
    - **Property 13: Download limits accept positive integers**
    - **Valida: Requisitos 5.2**
    - **Property 15: Negative download limits are rejected**
    - **Valida: Requisitos 5.4**
    - **Property 16: Users only see files for their plan**
    - **Valida: Requisitos 6.1**
  
  - [x] 11.4 Escrever testes unitários para FileManager
    - Testar criação e busca de arquivos
    - Testar atualização de permissões
    - Testar listagem de arquivos por plano
    - Testar deleção de arquivos
    - _Requisitos: 4.1, 5.1, 5.2, 6.1_


- [x] 12. Criar endpoints de gestão de arquivos (Admin)
  - [x] 12.1 Implementar rotas de arquivos
    - Criar `server/src/routes/files.js`
    - Implementar POST /api/files/upload (protegido, ADMIN only)
    - Implementar PUT /api/files/:id/permissions (protegido, ADMIN only)
    - Implementar DELETE /api/files/:id (protegido, ADMIN only)
    - Implementar GET /api/files (protegido, retorna todos para ADMIN)
    - _Requisitos: 4.1, 5.1, 5.2_
  
  - [x] 12.2 Criar controllers de arquivos
    - Implementar `server/src/controllers/fileController.js`
    - Implementar `uploadFile()` controller
    - Implementar `updatePermissions()` controller
    - Implementar `deleteFile()` controller
    - Implementar `listFiles()` controller
    - _Requisitos: 4.1, 5.1, 5.2_
  
  - [x] 12.3 Escrever testes de integração para endpoints de arquivos
    - Testar POST /api/files/upload como ADMIN
    - Testar PUT /api/files/:id/permissions como ADMIN
    - Testar DELETE /api/files/:id como ADMIN
    - Testar que USER não pode acessar endpoints de admin
    - _Requisitos: 3.1, 4.1, 5.1_

- [x] 13. Checkpoint - Verificar upload e gestão de arquivos
  - Testar upload de arquivo como admin via API
  - Testar configuração de permissões de arquivo
  - Testar listagem de arquivos
  - Testar deleção de arquivo
  - Garantir que todos os testes passam
  - Perguntar ao usuário se há dúvidas ou ajustes necessários


### Passo 3: Download com Validação e Limites

- [x] 14. Implementar AccessValidator para validação de acesso
  - [x] 14.1 Criar AccessValidator service
    - Implementar `server/src/services/accessValidator.js`
    - Implementar `validateDownloadAccess(userId, fileId)` que retorna {allowed, reason}
    - Implementar `checkPlanAccess(planId, allowedPlanIds)` para verificar plano
    - Implementar `checkDownloadLimit(userId, fileId, maxDownloads)` para verificar limite
    - _Requisitos: 7.1, 7.2, 7.3, 9.1, 9.2_
  
  - [x] 14.2 Escrever testes de property para AccessValidator
    - **Property 20: Unauthenticated download requests fail**
    - **Valida: Requisitos 7.1**
    - **Property 21: Unauthorized plan access is denied**
    - **Valida: Requisitos 7.2**
    - **Property 22: Over-limit downloads are denied**
    - **Valida: Requisitos 7.3**
    - **Property 26: Download limit enforcement with count**
    - **Valida: Requisitos 9.1, 9.2, 9.4**
    - **Property 27: NULL limits allow unlimited downloads**
    - **Valida: Requisitos 9.3**
  
  - [x] 14.3 Escrever testes unitários para AccessValidator
    - Testar validação de acesso com plano autorizado e não autorizado
    - Testar verificação de limite com diferentes cenários
    - Testar limite NULL (ilimitado)
    - _Requisitos: 7.2, 7.3, 9.1, 9.2, 9.3_


- [x] 15. Implementar DownloadController para processamento de downloads
  - [x] 15.1 Criar DownloadController service
    - Implementar `server/src/services/downloadController.js`
    - Implementar `processDownload(userId, fileId, ipAddress, res)` que valida e faz streaming
    - Implementar `logDownload(userId, fileId, ipAddress)` para registrar download
    - Implementar `streamFile(filePath, filename, mimeType, res)` para streaming
    - Implementar `getRealIpAddress(req)` para extrair IP real
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 8.1, 8.3, 15.2, 15.3_
  
  - [x] 15.2 Garantir atomicidade entre entrega e registro
    - Criar registro de download antes de iniciar streaming
    - Implementar rollback se streaming falhar
    - _Requisitos: 8.4_
  
  - [x] 15.3 Escrever testes de property para DownloadController
    - **Property 23: Successful downloads create log entries**
    - **Valida: Requisitos 8.1**
    - **Property 24: Failed downloads don't create log entries**
    - **Valida: Requisitos 8.2**
    - **Property 25: Real IP address is extracted correctly**
    - **Valida: Requisitos 8.3**
    - **Property 40: Download responses include required headers**
    - **Valida: Requisitos 15.3**
    - **Property 41: Filesystem paths are never exposed**
    - **Valida: Requisitos 15.4**
  
  - [x] 15.4 Escrever testes unitários para DownloadController
    - Testar processamento de download bem-sucedido
    - Testar falha de validação (não cria log)
    - Testar streaming de arquivo
    - Testar extração de IP real com headers de proxy
    - _Requisitos: 7.4, 8.1, 8.2, 8.3, 15.2_


- [x] 16. Criar endpoints de download
  - [x] 16.1 Implementar rotas de download
    - Criar `server/src/routes/downloads.js`
    - Implementar GET /api/downloads/:fileId (protegido)
    - Implementar GET /api/downloads/history (protegido)
    - _Requisitos: 7.1, 13.1_
  
  - [x] 16.2 Criar controllers de download
    - Implementar `server/src/controllers/downloadController.js`
    - Implementar `downloadFile()` controller que usa DownloadController service
    - Implementar `getDownloadHistory()` controller
    - Adicionar tratamento de erros: 401, 403, 429
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 13.1_
  
  - [x] 16.3 Escrever testes de integração para endpoints de download
    - Testar GET /api/downloads/:fileId com acesso autorizado
    - Testar GET /api/downloads/:fileId com plano não autorizado (403)
    - Testar GET /api/downloads/:fileId com limite excedido (429)
    - Testar GET /api/downloads/history
    - _Requisitos: 7.1, 7.2, 7.3, 13.1_

- [x] 17. Checkpoint - Verificar download com validação
  - Testar download de arquivo como usuário autorizado
  - Testar rejeição de download para plano não autorizado
  - Testar rejeição de download quando limite excedido
  - Verificar que downloads são registrados corretamente
  - Garantir que todos os testes passam
  - Perguntar ao usuário se há dúvidas ou ajustes necessários


### Passo 4: Frontend React (Estrutura, Rotas, Componentes)

- [x] 18. Configurar projeto React com Vite e TailwindCSS
  - [x] 18.1 Inicializar projeto React com Vite
    - Criar projeto em `client/` usando Vite + React + TypeScript
    - Configurar `vite.config.ts` com proxy para backend
    - Configurar variáveis de ambiente para API URL
    - _Requisitos: 14.1, 14.2_
  
  - [x] 18.2 Configurar TailwindCSS
    - Instalar e configurar TailwindCSS
    - Configurar `tailwind.config.js` com breakpoints responsivos
    - Criar arquivo de estilos globais
    - _Requisitos: 14.1, 14.2, 14.3_
  
  - [x] 18.3 Escrever testes para configuração responsiva
    - Testar que componentes renderizam em viewport 320px
    - _Requisitos: 14.1_

- [x] 19. Criar estrutura de tipos TypeScript
  - [x] 19.1 Definir tipos de domínio
    - Criar `client/src/types/index.ts`
    - Definir interfaces: User, File, Download, Plan, FilePermissions
    - Definir tipos de resposta da API
    - Definir tipos de erro
    - _Requisitos: Todos os requisitos de frontend_


- [x] 20. Implementar API Client service
  - [x] 20.1 Criar ApiClient class
    - Implementar `client/src/services/apiClient.ts`
    - Configurar axios com baseURL e interceptors
    - Implementar `setToken(token)` para adicionar token aos headers
    - Implementar tratamento de erros global
    - _Requisitos: 1.1, 1.2_
  
  - [x] 20.2 Implementar métodos de autenticação
    - Implementar `login(email, password)`
    - Implementar `register(name, email, password)`
    - Implementar `getCurrentUser()`
    - _Requisitos: 1.1, 1.2, 2.1_
  
  - [x] 20.3 Implementar métodos de arquivos
    - Implementar `listFiles()`
    - Implementar `uploadFile(file, permissions)` (admin)
    - Implementar `updateFilePermissions(fileId, permissions)` (admin)
    - Implementar `deleteFile(fileId)` (admin)
    - _Requisitos: 4.1, 5.1, 5.2, 6.1_
  
  - [x] 20.4 Implementar métodos de download
    - Implementar `downloadFile(fileId)` que retorna Blob
    - Implementar `getDownloadHistory()`
    - _Requisitos: 7.1, 13.1_
  
  - [x] 20.5 Escrever testes unitários para ApiClient
    - Testar configuração de token
    - Testar tratamento de erros
    - Testar métodos de API com mock
    - _Requisitos: 1.1, 1.2, 4.1, 6.1, 7.1_


- [x] 21. Criar AuthContext para gerenciamento de estado global
  - [x] 21.1 Implementar AuthContext e AuthProvider
    - Criar `client/src/contexts/AuthContext.tsx`
    - Implementar estado: user, token, isAuthenticated, isAdmin
    - Implementar funções: login, register, logout
    - Armazenar token em localStorage
    - Carregar token do localStorage na inicialização
    - _Requisitos: 1.1, 1.2, 2.1_
  
  - [x] 21.2 Escrever testes unitários para AuthContext
    - Testar login e armazenamento de token
    - Testar logout e limpeza de token
    - Testar carregamento de token do localStorage
    - _Requisitos: 1.1, 1.2_

- [x] 22. Configurar React Router e rotas
  - [x] 22.1 Criar estrutura de rotas
    - Instalar e configurar React Router
    - Criar `client/src/App.tsx` com rotas
    - Definir rotas: /login, /register, /dashboard, /admin
    - Implementar navegação adaptativa mobile/desktop
    - _Requisitos: 14.4_
  
  - [x] 22.2 Criar componente de rota protegida
    - Criar `ProtectedRoute` component que verifica autenticação
    - Redirecionar para /login se não autenticado
    - Criar `AdminRoute` component que verifica role ADMIN
    - _Requisitos: 3.1, 3.2_


- [x] 23. Criar componentes de autenticação
  - [x] 23.1 Criar componente de Login
    - Implementar `client/src/components/auth/Login.tsx`
    - Criar formulário com email e senha
    - Integrar com AuthContext.login()
    - Exibir erros de validação e autenticação
    - Redirecionar para dashboard após login
    - _Requisitos: 1.1, 1.2_
  
  - [x] 23.2 Criar componente de Register
    - Implementar `client/src/components/auth/Register.tsx`
    - Criar formulário com nome, email e senha
    - Integrar com AuthContext.register()
    - Validar senha mínima de 8 caracteres
    - Exibir erros de validação e registro
    - Redirecionar para dashboard após registro
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 23.3 Escrever testes unitários para componentes de auth
    - Testar renderização de formulários
    - Testar validação de campos
    - Testar submissão de formulários
    - _Requisitos: 1.1, 1.2, 2.1_

- [x] 24. Checkpoint - Verificar estrutura do frontend
  - Testar navegação entre rotas
  - Testar login e registro via interface
  - Verificar que token é armazenado corretamente
  - Verificar que rotas protegidas funcionam
  - Garantir que todos os testes passam
  - Perguntar ao usuário se há dúvidas ou ajustes necessários


### Passo 5: Integração Frontend-Backend

- [x] 25. Criar componentes de listagem de arquivos
  - [x] 25.1 Criar componente FileList para usuários
    - Implementar `client/src/components/user/FileList.tsx`
    - Buscar arquivos via ApiClient.listFiles()
    - Exibir: filename, size, mime_type, downloads_remaining
    - Ordenar por data de criação (mais recente primeiro)
    - Adicionar botão de download para cada arquivo
    - _Requisitos: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 25.2 Implementar funcionalidade de download
    - Criar função handleDownload que chama ApiClient.downloadFile()
    - Criar Blob URL e trigger download no navegador
    - Exibir mensagens de erro (403, 429)
    - Atualizar lista após download bem-sucedido
    - _Requisitos: 7.1, 7.2, 7.3_
  
  - [x] 25.3 Escrever testes de property para listagem
    - **Property 17: File listings include remaining downloads**
    - **Valida: Requisitos 6.2**
    - **Property 18: Files are ordered by creation date descending**
    - **Valida: Requisitos 6.3**
    - **Property 19: File listings include required metadata**
    - **Valida: Requisitos 6.4**
  
  - [x] 25.4 Escrever testes unitários para FileList
    - Testar renderização de lista de arquivos
    - Testar download de arquivo
    - Testar exibição de erros
    - _Requisitos: 6.1, 6.2, 7.1_


- [x] 26. Criar componentes de upload de arquivos (Admin)
  - [x] 26.1 Criar componente FileUpload
    - Implementar `client/src/components/admin/FileUpload.tsx`
    - Criar input de seleção de arquivo
    - Criar seleção múltipla de planos (checkboxes)
    - Criar input para max_downloads_per_user (opcional)
    - Implementar upload via ApiClient.uploadFile()
    - Exibir progresso de upload
    - Exibir mensagens de sucesso e erro
    - _Requisitos: 4.1, 5.1, 5.2_
  
  - [x] 26.2 Criar componente FileManagement para admin
    - Implementar `client/src/components/admin/FileManagement.tsx`
    - Listar todos os arquivos (admin view)
    - Adicionar botão de editar permissões
    - Adicionar botão de deletar arquivo
    - Implementar modal de edição de permissões
    - _Requisitos: 5.1, 5.2_
  
  - [x] 26.3 Escrever testes unitários para componentes de admin
    - Testar upload de arquivo
    - Testar edição de permissões
    - Testar deleção de arquivo
    - _Requisitos: 4.1, 5.1, 5.2_

- [x] 27. Checkpoint - Verificar integração frontend-backend
  - Testar upload de arquivo como admin
  - Testar configuração de permissões
  - Testar listagem de arquivos como usuário
  - Testar download de arquivo
  - Verificar que limites são respeitados
  - Garantir que todos os testes passam
  - Perguntar ao usuário se há dúvidas ou ajustes necessários


### Passo 6: Dashboards (Admin e User)

- [x] 28. Implementar endpoints de dashboard
  - [x] 28.1 Criar rotas de dashboard
    - Criar `server/src/routes/dashboard.js`
    - Implementar GET /api/dashboard/admin (protegido, ADMIN only)
    - Implementar GET /api/dashboard/user (protegido)
    - _Requisitos: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3_
  
  - [x] 28.2 Criar controllers de dashboard
    - Implementar `server/src/controllers/dashboardController.js`
    - Implementar `getAdminStats()` que retorna: total users, files, downloads, most downloaded files, user distribution by plan
    - Implementar `getUserDashboard()` que retorna: current plan, download history, total downloads
    - _Requisitos: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3_
  
  - [x] 28.3 Escrever testes de property para dashboards
    - **Property 33: Admin dashboard shows accurate counts**
    - **Valida: Requisitos 12.1**
    - **Property 34: Most downloaded files ranked correctly**
    - **Valida: Requisitos 12.2**
    - **Property 35: User distribution by plan is accurate**
    - **Valida: Requisitos 12.3**
    - **Property 36: User download history is ordered by date**
    - **Valida: Requisitos 13.1**
    - **Property 37: User dashboard shows current plan info**
    - **Valida: Requisitos 13.2**
    - **Property 38: User dashboard shows accurate download count**
    - **Valida: Requisitos 13.3**
    - **Property 39: Download history includes required fields**
    - **Valida: Requisitos 13.4**

  
  - [x] 28.4 Escrever testes unitários para controllers de dashboard
    - Testar cálculo de estatísticas admin
    - Testar ordenação de arquivos mais baixados
    - Testar distribuição de usuários por plano
    - Testar histórico de downloads do usuário
    - _Requisitos: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3_

- [x] 29. Criar componente AdminDashboard
  - [x] 29.1 Implementar AdminDashboard component
    - Implementar `client/src/components/admin/AdminDashboard.tsx`
    - Buscar estatísticas via ApiClient
    - Exibir cards com: total de usuários, arquivos, downloads
    - Exibir tabela de arquivos mais baixados
    - Exibir gráfico de distribuição de usuários por plano
    - _Requisitos: 12.1, 12.2, 12.3_
  
  - [x] 29.2 Escrever testes unitários para AdminDashboard
    - Testar renderização de estatísticas
    - Testar exibição de arquivos mais baixados
    - Testar exibição de distribuição por plano
    - _Requisitos: 12.1, 12.2, 12.3_

- [x] 30. Criar componente UserDashboard
  - [x] 30.1 Implementar UserDashboard component
    - Implementar `client/src/components/user/UserDashboard.tsx`
    - Buscar dados via ApiClient
    - Exibir informações do plano atual
    - Exibir total de downloads realizados
    - Exibir tabela de histórico de downloads com: filename, data, hora
    - Ordenar histórico por data descendente
    - _Requisitos: 13.1, 13.2, 13.3, 13.4_

  
  - [x] 30.2 Escrever testes unitários para UserDashboard
    - Testar renderização de informações do plano
    - Testar exibição de histórico de downloads
    - Testar ordenação de histórico
    - _Requisitos: 13.1, 13.2, 13.3, 13.4_

- [ ] 31. Implementar gestão de planos de usuário
  - [ ] 31.1 Criar endpoints de gestão de usuários
    - Adicionar PUT /api/users/:id/plan (protegido, ADMIN only)
    - Implementar controller para atualizar plano do usuário
    - Validar que plano de destino existe
    - _Requisitos: 11.1, 11.2, 11.3, 11.4_
  
  - [ ] 31.2 Criar componente de gestão de usuários (Admin)
    - Implementar `client/src/components/admin/UserManagement.tsx`
    - Listar todos os usuários com seus planos
    - Adicionar dropdown para alterar plano de cada usuário
    - Implementar upgrade/downgrade de plano
    - _Requisitos: 11.1, 11.2, 11.4_
  
  - [ ]* 31.3 Escrever testes de property para gestão de planos
    - **Property 31: Plan changes update user immediately**
    - **Valida: Requisitos 11.1, 11.2, 11.4**
    - **Property 32: Invalid plan IDs are rejected**
    - **Valida: Requisitos 11.3**
  
  - [ ]* 31.4 Escrever testes unitários para gestão de usuários
    - Testar atualização de plano
    - Testar validação de plano inválido
    - Testar aplicação imediata de novas permissões
    - _Requisitos: 11.1, 11.2, 11.3_


- [ ] 32. Checkpoint - Verificar dashboards
  - Testar dashboard admin com estatísticas
  - Testar dashboard de usuário com histórico
  - Testar gestão de planos de usuários
  - Verificar que mudanças de plano aplicam imediatamente
  - Garantir que todos os testes passam
  - Perguntar ao usuário se há dúvidas ou ajustes necessários

### Passo 7: PWA (Progressive Web App)

- [ ] 33. Configurar PWA
  - [ ] 33.1 Criar manifest.json
    - Criar `client/public/manifest.json`
    - Configurar name, short_name, description
    - Configurar theme_color e background_color
    - Configurar display: standalone
    - Adicionar ícones em múltiplas resoluções (192x192, 512x512)
    - _Requisitos: 17.1, 17.4_
  
  - [ ] 33.2 Criar ícones PWA
    - Gerar ícones em resoluções: 192x192, 512x512
    - Salvar em `client/public/icons/`
    - _Requisitos: 17.4_
  
  - [ ] 33.3 Criar service worker básico
    - Criar `client/public/service-worker.js`
    - Implementar cache de assets estáticos (CSS, JS, imagens)
    - Implementar estratégia cache-first para assets
    - Implementar estratégia network-first para API calls
    - _Requisitos: 17.2, 17.3_

  
  - [ ] 33.4 Registrar service worker
    - Adicionar registro de service worker em `client/src/main.tsx`
    - Implementar lógica de atualização de service worker
    - _Requisitos: 17.2_
  
  - [ ]* 33.5 Testar funcionalidade offline
    - Testar que páginas visitadas são acessíveis offline
    - Testar que assets estáticos são servidos do cache
    - _Requisitos: 17.3_

- [ ] 34. Checkpoint - Verificar PWA
  - Testar instalação do app no dispositivo
  - Testar funcionamento offline
  - Verificar que ícones aparecem corretamente
  - Garantir que service worker está registrado
  - Perguntar ao usuário se há dúvidas ou ajustes necessários

### Passo 8: Testes Finais e Refinamentos

- [ ] 35. Executar suite completa de testes
  - [ ] 35.1 Executar todos os testes unitários
    - Rodar testes do backend (Jest)
    - Rodar testes do frontend (Vitest)
    - Verificar cobertura mínima de 80%
    - _Requisitos: Todos_
  
  - [ ] 35.2 Executar todos os testes de property
    - Rodar testes de property do backend (fast-check)
    - Rodar testes de property do frontend (fast-check)
    - Verificar que todas as 41 properties passam
    - _Requisitos: Todos_

  
  - [ ]* 35.3 Executar testes de integração
    - Testar todos os endpoints da API
    - Testar fluxos completos: registro → login → upload → download
    - _Requisitos: Todos_
  
  - [ ]* 35.4 Executar testes E2E
    - Testar fluxo de usuário: registro, login, listagem, download
    - Testar fluxo de admin: login, upload, configuração de permissões
    - _Requisitos: Todos_

- [ ] 36. Refinamentos finais
  - [ ] 36.1 Adicionar tratamento de erros global
    - Implementar error boundary no React
    - Implementar toast notifications para erros
    - Melhorar mensagens de erro para usuário final
    - _Requisitos: Todos_
  
  - [ ] 36.2 Otimizar performance
    - Implementar code splitting por rota
    - Implementar lazy loading de componentes
    - Otimizar queries do banco de dados
    - _Requisitos: 14.1, 14.2_
  
  - [ ] 36.3 Adicionar logging e monitoramento
    - Implementar logging de erros no backend
    - Implementar logging de eventos importantes
    - _Requisitos: 8.1_

- [ ] 37. Checkpoint final
  - Executar todos os testes e verificar que passam
  - Testar sistema completo end-to-end
  - Verificar que todos os requisitos foram implementados
  - Documentar qualquer limitação ou issue conhecido
  - Perguntar ao usuário se há ajustes finais necessários


## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de property validam propriedades universais de correção
- Testes unitários validam exemplos específicos e casos extremos
- A implementação segue abordagem iterativa: backend → funcionalidades → frontend → PWA → testes finais

## Convenções de Código

**Backend (JavaScript/Node.js):**
- Usar CommonJS (require/module.exports)
- Usar async/await para operações assíncronas
- Usar arrow functions quando apropriado
- Nomear arquivos em camelCase
- Usar JSDoc para documentação de funções

**Frontend (TypeScript/React):**
- Usar ES modules (import/export)
- Usar TypeScript strict mode
- Usar functional components com hooks
- Nomear componentes em PascalCase
- Nomear arquivos de componentes em PascalCase
- Usar interfaces para tipos de props

**Testes:**
- Nomear arquivos de teste: `*.test.js` ou `*.test.ts`
- Nomear testes de property: `*.property.test.js`
- Usar describe/it para estrutura de testes
- Incluir tag de property em testes de property: `// Feature: gestor-files, Property N: ...`

**Banco de Dados:**
- Nomear migrations: `NNN_description.sql` (ex: `001_create_plans_table.sql`)
- Usar snake_case para nomes de tabelas e colunas
- Sempre criar índices para foreign keys e colunas frequentemente consultadas

