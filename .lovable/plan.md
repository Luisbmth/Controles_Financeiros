## O que vou construir

Agrupei seus pedidos em 7 blocos. Posso fazer tudo de uma vez, mas confirma se a interpretação está certa.

---

### 1. Perfil do usuário + cadastro inicial
- Nova tabela `profiles` (nome completo, CPF, data de nascimento, telefone, limite de alerta vermelho).
- Quando o usuário loga pela primeira vez e não tem perfil → tela `/onboarding` pedindo esses dados (com máscara + validação de CPF e data).
- Nova rota `/profile` acessível por um ícone na home → editar dados, definir **"alerta de saldo baixo"** (ex.: R$ 300) e **importar histórico (CSV/Excel)**.

### 2. Lógica de "saldo do mês" repensada (o ponto mais importante)
Hoje, quando você marca uma conta como **paga**, o "Contas do mês" subtrai e some — você quer o oposto: **uma conta paga continua contando como gasto do mês**. Vou mudar para:

- **Gasto do mês** = soma de TUDO que vence ou foi gasto no mês (pago + pendente), sem distinção.
- **Falta pagar** = só pendentes (informativo, em outro card).
- **Saldo disponível** = salário − gasto do mês.
- Se `saldo disponível ≤ limite_alerta` (configurável no perfil) → número fica **vermelho** com ícone de alerta.

### 3. "Gastos do mês" avulsos (almoço, marmita, etc.)
- Nova categoria interna de lançamento: `expense_type = 'one_off'` na tabela `bills` (ou flag `is_one_off`).
- Aparecem só no mês em que foram lançados, **nunca se repetem**, nem viram fixos.
- Botão rápido na home: "+ Gasto rápido" (nome + valor + categoria, já marca como pago hoje).

### 4. Cadastro de conta — melhorias no modal
- Adicionar **seletor de status (Paga / Pendente)** já no cadastro (hoje só dá pra marcar depois).
- Parcelamento já funciona corretamente (300 ÷ 3 = 100/mês em 3 meses consecutivos), só vou deixar isso explícito com um preview: "3 parcelas de R$ 100,00".
- Quando escolher categoria **"Outros"** → abre um input para digitar categoria personalizada (salva em nova tabela `custom_categories` por usuário).

### 5. Renomear "Fixas" → "Custos"
- A aba `/fixed` vira `/costs` (ou só renomeia o label) e passa a listar **todos os custos recorrentes**: fixos + parcelamentos ativos agrupados.
- Cada item mostra: nome, valor, tipo (Fixa mensal / Parcela X/Y), próximas ocorrências.

### 6. Importar histórico (CSV/Excel)
- Tela em `/profile/import`.
- Aceita upload de `.csv` ou `.xlsx`.
- Mapeamento simples: colunas esperadas → `nome, valor, categoria, vencimento, status` (com preview antes de confirmar).
- Insere em lote em `bills`.

### 7. Visão do mês atualizada
Reflete a nova lógica do bloco 2:
- Receita: R$ X
- Gasto do mês: R$ Y (pago + pendente)
- Falta pagar: R$ Z
- **Saldo disponível: R$ (X−Y)** ← vermelho se ≤ limite

---

## Mudanças técnicas
- Migrations: `profiles`, `custom_categories`, coluna `is_one_off boolean default false` em `bills`, coluna `alert_threshold numeric` em `profiles`.
- Novas rotas: `_authenticated.onboarding.tsx`, `_authenticated.profile.tsx`, `_authenticated.profile.import.tsx`.
- Renomear: `_authenticated.fixed.tsx` → `_authenticated.costs.tsx` (mantém retrocompat com redirect).
- Refatorar `_authenticated.app.tsx` (cards de totais) e `_authenticated.month.tsx` (mesma lógica).
- Editar `BillEditSheet` e `_authenticated.new.tsx` para incluir status + categoria custom.
- Adicionar parse de CSV/XLSX (uso `papaparse` para CSV; XLSX uso `xlsx` package).

---

## Confirma antes de eu começar?
1. **Validação de CPF**: faço só formato (XXX.XXX.XXX-XX) ou valido dígito verificador também?
2. **Importar**: aceita só CSV ou quer XLSX também? (XLSX adiciona ~400KB ao bundle).
3. **Custos recorrentes**: prefere renomear "Fixas" → "Custos" ou criar uma aba nova e manter as duas?
4. Posso seguir com tudo isso de uma vez ou prefere por etapas?