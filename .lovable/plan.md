## O que vou implementar

### 1. Tabela nova: `app_security`
Guarda as configurações de bloqueio por usuário:
- `pin_hash` + `pin_salt` (PIN nunca em texto puro — hash SHA-256 com salt aleatório)
- `biometric_credential_id` + `biometric_public_key` (credencial WebAuthn registrada no dispositivo)
- `biometric_enabled` (boolean)

RLS: cada usuário só lê/edita o próprio registro.

### 2. Tela de configuração `/security/setup`
Aparece no primeiro login. Pede:
- Criar PIN de 4-6 dígitos (com confirmação)
- "Ativar biometria neste dispositivo?" → chama WebAuthn (`navigator.credentials.create`) e salva a credencial. Funciona com Face ID / Touch ID / impressão digital Android. Se o aparelho não suportar, esconde a opção.

Acessível depois em `/security` para trocar PIN ou desativar.

### 3. Tela de bloqueio (LockScreen)
Componente que envolve as rotas autenticadas. Mostra ao abrir/reabrir o app (controlado por flag em `sessionStorage` — uma vez desbloqueado fica liberado até fechar a aba).

- Botão grande "Desbloquear com biometria" (se ativada) → WebAuthn `get`
- Teclado numérico pra digitar o PIN
- Após 3 erros no PIN → bloqueio 30s; depois 5 erros → 2min; 7 erros → 10min (timer visível, persistido em `localStorage`)

### 4. Bloqueio progressivo no login (e-mail/senha)
Em `/login`, conto tentativas falhas por e-mail em `localStorage`:
- 5 erros → espera 30s
- 7 erros → 2min  
- 9 erros → 10min

Botão "Entrar" desabilita e mostra contagem regressiva. Reseta em login bem-sucedido.

> Observação: rate-limit "de verdade" (no servidor) o Supabase Auth já faz nativamente — limita tentativas por IP. Esse bloqueio do cliente é uma camada extra de UX e proteção contra scripts simples no mesmo navegador.

### 5. Outros reforços de segurança que já vou ligar
- **HIBP (verificação de senha vazada)** no cadastro/troca de senha via `configure_auth`
- **CSP básico** nos headers HTML (bloqueia scripts inline de origens estranhas)
- Confirmar que `dangerouslySetInnerHTML` não está em uso (já confirmei — não está)

## Detalhes técnicos

- **WebAuthn**: registro e autenticação 100% no cliente (challenge gerado client-side, credencial guardada no Supabase). Para um app pessoal de finanças isso é suficiente — a chave privada nunca sai do Secure Enclave do aparelho. Se quiser depois posso adicionar verificação server-side com `@simplewebauthn/server` numa server function.
- **Hash do PIN**: PBKDF2 via `crypto.subtle` no browser (100k iterações), salt único de 16 bytes por usuário.
- **Sessão Supabase**: continua intacta (você pediu pra não deslogar). A tela de bloqueio é só uma camada visual em cima das rotas `_authenticated`.

## Arquivos que vou criar/editar

- **Migration**: tabela `app_security` + RLS + grants
- **`src/lib/security.ts`**: hash PIN, registrar/verificar biometria (WebAuthn), gerenciar tentativas
- **`src/components/LockScreen.tsx`**: tela de desbloqueio
- **`src/routes/_authenticated/security.tsx`** + **`security.setup.tsx`**: configuração
- **`src/routes/_authenticated.tsx`**: integrar LockScreen
- **`src/routes/login.tsx`**: bloqueio progressivo
- **`src/routes/__root.tsx`**: meta CSP
- **`configure_auth`**: ligar HIBP

Posso seguir?