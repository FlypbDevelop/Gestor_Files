# Requirements Document

## Introduction

Sistema de Gerenciamento de Arquivos (File Manager) com controle de acesso baseado em planos de assinatura, limites de download e roles de usuário. O sistema permite que administradores façam upload e gerenciem arquivos com regras de acesso granulares, enquanto usuários podem baixar arquivos de acordo com seu plano de assinatura e limites estabelecidos.

## Glossary

- **System**: O Sistema de Gerenciamento de Arquivos completo (frontend + backend)
- **User**: Usuário com role USER que consome arquivos
- **Admin**: Usuário com role ADMIN que gerencia arquivos e usuários
- **File_Manager**: Componente responsável pelo gerenciamento de arquivos
- **Auth_Service**: Serviço de autenticação e autorização
- **Download_Controller**: Componente que controla e valida downloads
- **Plan**: Plano de assinatura que define permissões de acesso
- **Download_Log**: Registro de download realizado
- **JWT_Token**: Token de autenticação JSON Web Token
- **Upload_Service**: Serviço responsável pelo upload de arquivos
- **Access_Validator**: Componente que valida permissões de acesso

## Requirements

### Requirement 1: Autenticação de Usuários

**User Story:** Como um usuário, eu quero fazer login no sistema, para que eu possa acessar os arquivos disponíveis para meu plano.

#### Acceptance Criteria

1. WHEN um usuário fornece email e senha válidos, THE Auth_Service SHALL gerar um JWT_Token com validade de 24 horas
2. WHEN um usuário fornece credenciais inválidas, THE Auth_Service SHALL retornar erro com código 401
3. THE Auth_Service SHALL armazenar senhas usando hash bcrypt com salt de 10 rounds
4. WHEN um JWT_Token expirado é usado, THE System SHALL retornar erro 401 e solicitar novo login

### Requirement 2: Registro de Novos Usuários

**User Story:** Como um novo usuário, eu quero me registrar no sistema, para que eu possa acessar os arquivos.

#### Acceptance Criteria

1. WHEN um usuário fornece nome, email e senha, THE Auth_Service SHALL criar uma conta com role USER e plano Free
2. IF um email já está cadastrado, THEN THE Auth_Service SHALL retornar erro 409
3. THE Auth_Service SHALL validar que a senha tenha no mínimo 8 caracteres
4. THE Auth_Service SHALL validar que o email tenha formato válido

### Requirement 3: Controle de Acesso por Role

**User Story:** Como administrador do sistema, eu quero que apenas usuários com role ADMIN possam gerenciar arquivos, para que a segurança seja mantida.

#### Acceptance Criteria

1. WHEN um usuário com role USER tenta acessar endpoints administrativos, THE System SHALL retornar erro 403
2. WHEN um usuário com role ADMIN acessa endpoints administrativos, THE System SHALL permitir a operação
3. THE System SHALL validar o role do usuário através do JWT_Token em cada requisição
4. THE System SHALL ter apenas dois roles possíveis: ADMIN e USER

### Requirement 4: Upload de Arquivos

**User Story:** Como um Admin, eu quero fazer upload de arquivos, para que usuários possam baixá-los.

#### Acceptance Criteria

1. WHEN um Admin faz upload de um arquivo, THE Upload_Service SHALL armazenar o arquivo e criar registro no banco de dados
2. WHEN um Admin faz upload, THE Upload_Service SHALL registrar filename, path, mime_type, size e timestamp
3. THE Upload_Service SHALL aceitar arquivos de até 100MB
4. IF o upload falhar, THEN THE Upload_Service SHALL retornar erro descritivo e não criar registro no banco

### Requirement 5: Configuração de Permissões de Arquivo

**User Story:** Como um Admin, eu quero definir quais planos podem acessar cada arquivo, para que eu possa controlar o acesso baseado em assinatura.

#### Acceptance Criteria

1. WHEN um Admin configura um arquivo, THE File_Manager SHALL permitir selecionar múltiplos planos com acesso
2. WHEN um Admin configura um arquivo, THE File_Manager SHALL permitir definir limite máximo de downloads por usuário
3. THE File_Manager SHALL armazenar allowed_plan_ids como array de IDs de planos
4. THE File_Manager SHALL validar que max_downloads_per_user seja um número inteiro positivo

### Requirement 6: Listagem de Arquivos para Usuários

**User Story:** Como um User, eu quero ver apenas os arquivos disponíveis para meu plano, para que eu possa baixar o que tenho direito.

#### Acceptance Criteria

1. WHEN um User solicita lista de arquivos, THE System SHALL retornar apenas arquivos cujo allowed_plan_ids inclui o plan_id do usuário
2. WHEN um User solicita lista de arquivos, THE System SHALL incluir informação de quantos downloads restantes ele tem para cada arquivo
3. THE System SHALL ordenar arquivos por data de criação descendente
4. THE System SHALL incluir metadados: filename, size, mime_type e downloads_remaining

### Requirement 7: Validação de Download

**User Story:** Como desenvolvedor do sistema, eu quero que todos os downloads passem por validação, para que regras de negócio sejam aplicadas corretamente.

#### Acceptance Criteria

1. WHEN um usuário solicita download, THE Download_Controller SHALL validar que o usuário está autenticado
2. WHEN um usuário solicita download, THE Download_Controller SHALL validar que o plano do usuário permite acesso ao arquivo
3. WHEN um usuário solicita download, THE Download_Controller SHALL validar que o limite de downloads não foi excedido
4. IF qualquer validação falhar, THEN THE Download_Controller SHALL retornar erro apropriado e não permitir download

### Requirement 8: Registro de Downloads

**User Story:** Como administrador do sistema, eu quero registrar todos os downloads realizados, para que eu possa auditar o uso do sistema.

#### Acceptance Criteria

1. WHEN um download é bem-sucedido, THE System SHALL criar registro na tabela downloads com user_id, file_id, timestamp e ip_address
2. WHEN um download falha na validação, THE System SHALL não criar registro na tabela downloads
3. THE System SHALL registrar o IP real do usuário, considerando headers de proxy quando aplicável
4. THE System SHALL garantir atomicidade entre entrega do arquivo e criação do registro

### Requirement 9: Controle de Limite de Downloads

**User Story:** Como um Admin, eu quero limitar quantas vezes cada usuário pode baixar um arquivo, para que o uso seja controlado.

#### Acceptance Criteria

1. WHEN um usuário tenta baixar um arquivo, THE Download_Controller SHALL contar quantos downloads anteriores existem para aquele user_id e file_id
2. IF a contagem de downloads for maior ou igual a max_downloads_per_user, THEN THE Download_Controller SHALL retornar erro 429
3. WHERE max_downloads_per_user é NULL, THE Download_Controller SHALL permitir downloads ilimitados
4. THE Download_Controller SHALL retornar no erro a quantidade de downloads já realizados

### Requirement 10: Gestão de Planos de Assinatura

**User Story:** Como um Admin, eu quero gerenciar planos de assinatura, para que eu possa controlar níveis de acesso.

#### Acceptance Criteria

1. THE System SHALL suportar múltiplos planos com name, price e features
2. WHEN um Admin cria um plano, THE System SHALL validar que o name é único
3. THE System SHALL armazenar features como JSON com estrutura flexível
4. THE System SHALL ter três planos padrão: Free, Basic e Premium

### Requirement 11: Upgrade de Plano de Usuário

**User Story:** Como um User, eu quero fazer upgrade do meu plano, para que eu possa acessar mais arquivos.

#### Acceptance Criteria

1. WHEN um User solicita upgrade de plano, THE System SHALL atualizar o plan_id do usuário
2. WHEN um upgrade é realizado, THE System SHALL aplicar as novas permissões imediatamente
3. THE System SHALL validar que o plano de destino existe antes de realizar upgrade
4. THE System SHALL permitir downgrade de plano também

### Requirement 12: Dashboard Administrativo

**User Story:** Como um Admin, eu quero visualizar estatísticas do sistema, para que eu possa monitorar o uso.

#### Acceptance Criteria

1. WHEN um Admin acessa o dashboard, THE System SHALL exibir total de usuários, arquivos e downloads
2. WHEN um Admin acessa o dashboard, THE System SHALL exibir lista de arquivos mais baixados
3. WHEN um Admin acessa o dashboard, THE System SHALL exibir distribuição de usuários por plano
4. THE System SHALL calcular estatísticas em tempo real a cada requisição

### Requirement 13: Dashboard do Usuário

**User Story:** Como um User, eu quero visualizar meu histórico de downloads, para que eu possa acompanhar meu uso.

#### Acceptance Criteria

1. WHEN um User acessa seu dashboard, THE System SHALL exibir lista de downloads realizados ordenados por data
2. WHEN um User acessa seu dashboard, THE System SHALL exibir informações do plano atual
3. WHEN um User acessa seu dashboard, THE System SHALL exibir total de downloads realizados
4. THE System SHALL incluir para cada download: filename, data e hora do download

### Requirement 14: Interface Responsiva Mobile First

**User Story:** Como um usuário mobile, eu quero que a interface funcione bem no meu dispositivo, para que eu possa usar o sistema em qualquer lugar.

#### Acceptance Criteria

1. THE System SHALL renderizar corretamente em viewports de 320px de largura ou superior
2. THE System SHALL usar breakpoints responsivos do TailwindCSS
3. THE System SHALL priorizar layout mobile no desenvolvimento
4. THE System SHALL ter navegação adaptativa para mobile e desktop

### Requirement 15: Segurança de Download via Backend

**User Story:** Como desenvolvedor do sistema, eu quero que downloads nunca sejam links diretos, para que validações sejam sempre aplicadas.

#### Acceptance Criteria

1. THE System SHALL servir arquivos através de endpoint protegido que valida permissões
2. THE System SHALL usar streaming de arquivo ao invés de carregar arquivo completo em memória
3. THE System SHALL incluir headers apropriados: Content-Type, Content-Disposition e Content-Length
4. THE System SHALL não expor paths reais de arquivos no filesystem para o cliente

### Requirement 16: Parser e Serialização de Features de Plano

**User Story:** Como desenvolvedor, eu quero parsear e serializar features de planos, para que eu possa armazenar configurações flexíveis.

#### Acceptance Criteria

1. WHEN um plano é criado ou atualizado, THE System SHALL parsear o JSON de features e validar estrutura
2. WHEN um plano é recuperado, THE System SHALL serializar features de volta para JSON
3. THE System SHALL ter um Pretty_Printer que formata features JSON de forma legível
4. FOR ALL objetos de features válidos, parsear então serializar então parsear SHALL produzir objeto equivalente (round-trip property)

### Requirement 17: Preparação para PWA

**User Story:** Como um usuário mobile, eu quero instalar o sistema como app, para que eu tenha experiência nativa.

#### Acceptance Criteria

1. THE System SHALL incluir manifest.json com configurações de PWA
2. THE System SHALL incluir service worker básico para cache de assets estáticos
3. THE System SHALL ser acessível offline para páginas já visitadas
4. THE System SHALL ter ícones em múltiplas resoluções para instalação

