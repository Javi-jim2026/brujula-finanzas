-- FINANZAS PERSONALES • schema v1.1 • isolated Supabase project ONLY
-- Run in the NEW project's SQL editor, never in SUDMAR.
create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  bank_name text not null default '',
  kind text not null check(kind in ('credit','debit','cash')),
  last4 text check(last4 is null or last4 ~ '^[0-9]{4}$'),
  credit_limit numeric(14,2) not null default 0 check(credit_limit >= 0),
  opening_balance numeric(14,2) not null default 0,
  cutoff_day integer check(cutoff_day between 1 and 28),
  due_day integer check(due_day between 1 and 28),
  cutoff_tolerance_days integer not null default 2 check(cutoff_tolerance_days between 0 and 3),
  payment_alert_days integer not null default 2 check(payment_alert_days between 1 and 7),
  color text not null default '#6555e8',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(id,user_id)
);

create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  period_start date,
  close_date date not null,
  due_date date not null,
  no_interest_amount numeric(14,2) not null check(no_interest_amount >= 0),
  bank_available numeric(14,2) check(bank_available >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique(id,user_id),
  unique(user_id,account_id,close_date),
  constraint stmt_own_acc foreign key(account_id,user_id) references public.accounts(id,user_id) on delete cascade,
  constraint stmt_date_order check(due_date >= close_date)
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  statement_id uuid,
  transaction_date date not null,
  posting_date date,
  kind text not null check(kind in ('purchase','expense','income','payment','refund','fee','interest','adjustment_plus','adjustment_minus','transfer_in','transfer_out')),
  amount numeric(14,2) not null check(amount > 0),
  category text not null default 'Otros',
  description text not null default '',
  merchant text not null default '',
  reference text not null default '',
  created_at timestamptz not null default now(),
  unique(id,user_id),
  constraint mov_own_acc foreign key(account_id,user_id) references public.accounts(id,user_id) on delete cascade,
  constraint mov_own_stmt foreign key(statement_id,user_id) references public.statements(id,user_id) on delete set null (statement_id),
  constraint stmt_only_payment check(statement_id is null or kind='payment')
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  movement_id uuid,
  description text not null,
  original_amount numeric(14,2) not null check(original_amount > 0),
  months integer not null check(months between 2 and 120),
  first_charge_month date not null,
  installments_paid integer not null default 0 check(installments_paid >= 0),
  monthly_amount numeric(14,2) check(monthly_amount > 0),
  status text not null default 'active' check(status in ('active','finished','cancelled')),
  created_at timestamptz not null default now(),
  unique(id,user_id),
  constraint ins_own_acc foreign key(account_id,user_id) references public.accounts(id,user_id) on delete cascade,
  constraint ins_own_mov foreign key(movement_id,user_id) references public.movements(id,user_id) on delete set null (movement_id),
  constraint ins_paid_limit check(installments_paid <= months)
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  asset_value numeric(14,2) check(asset_value >= 0),
  down_payment numeric(14,2) not null default 0 check(down_payment >= 0),
  financed_amount numeric(14,2) not null check(financed_amount >= 0),
  term_months integer check(term_months between 1 and 480),
  annual_rate numeric(9,4) check(annual_rate between 0 and 200),
  monthly_payment numeric(14,2) check(monthly_payment >= 0),
  start_date date,
  next_due_date date,
  payroll_deduction boolean not null default false,
  lender text not null default '',
  notes text not null default '',
  status text not null default 'active' check(status in ('active','paid','cancelled')),
  created_at timestamptz not null default now(),
  unique(id,user_id)
);

create table if not exists public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  loan_id uuid not null,
  payment_date date not null,
  amount numeric(14,2) not null check(amount > 0),
  principal_part numeric(14,2) check(principal_part >= 0),
  interest_part numeric(14,2) check(interest_part >= 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint lp_own_loan foreign key(loan_id,user_id) references public.loans(id,user_id) on delete cascade,
  constraint lp_breakdown check(coalesce(principal_part,0) + coalesce(interest_part,0) <= amount)
);

create index if not exists idx_accounts_user on public.accounts(user_id);
create index if not exists idx_statements_user_dates on public.statements(user_id,due_date desc);
create index if not exists idx_movements_user_date on public.movements(user_id,transaction_date desc);
create index if not exists idx_movements_account on public.movements(account_id,transaction_date desc);
create index if not exists idx_installments_user on public.installments(user_id,status);
create index if not exists idx_loans_user on public.loans(user_id,status);
create index if not exists idx_loan_payments_user on public.loan_payments(user_id,payment_date desc);

-- NO anon access, enforce auth ownership for every operation.
do $$ declare tbl text; begin
  foreach tbl in array array['accounts','statements','movements','installments','loans','loan_payments'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('alter table public.%I force row level security',tbl);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))','read_own_'||tbl,tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))','insert_own_'||tbl,tbl);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))','update_own_'||tbl,tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))','delete_own_'||tbl,tbl);
  end loop;
end $$;

-- Explicit privilege constraints. Public/anon has no direct table access.
revoke all on public.accounts, public.statements, public.movements, public.installments, public.loans, public.loan_payments from anon;
grant select,insert,update,delete on public.accounts, public.statements, public.movements, public.installments, public.loans, public.loan_payments to authenticated;

-- Identity integrity: only link statements and MSI movements from the same account.
-- These constraints are ALREADY APPLIED to the new Brújula project as migration #2.
-- Included here so a fresh database created from this SQL has equivalent protections.
alter table public.statements add constraint stm_account_identity unique(id,account_id,user_id);
alter table public.movements drop constraint mov_own_stmt;
alter table public.movements add constraint mov_own_stmt_account foreign key(statement_id,account_id,user_id)
  references public.statements(id,account_id,user_id) on delete set null(statement_id);
alter table public.movements add constraint mov_account_identity unique(id,account_id,user_id);
alter table public.installments drop constraint ins_own_mov;
alter table public.installments add constraint ins_own_mov_account foreign key(movement_id,account_id,user_id)
  references public.movements(id,account_id,user_id) on delete set null(movement_id);
create index if not exists idx_stmt_acc_ownership on public.statements(account_id,user_id);
create index if not exists idx_mov_acc_ownership on public.movements(account_id,user_id);
create index if not exists idx_mov_stmt_ownership on public.movements(statement_id,account_id,user_id);
create index if not exists idx_install_acc_ownership on public.installments(account_id,user_id);
create index if not exists idx_install_mov_ownership on public.installments(movement_id,account_id,user_id);
create index if not exists idx_loan_pay_ownership on public.loan_payments(loan_id,user_id);
