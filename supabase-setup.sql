-- ==========================================================
-- Mural do aluno — estrutura do banco
-- Rode isto no Supabase: SQL Editor -> New query -> Run
-- ==========================================================

create table if not exists posts (
  id         uuid primary key default gen_random_uuid(),
  autor_id   uuid not null references auth.users(id) on delete cascade,
  autor_nome text not null,
  texto      text not null,
  tag        text,
  link       text,
  editado    boolean not null default false,
  criado_em  timestamptz not null default now(),

  -- Limites no BANCO, não só na tela. Validação de tela é
  -- sugestão; quem realmente impede um robô de mandar 1 MB de
  -- texto é o banco recusando.
  constraint texto_tamanho check (char_length(texto) between 1 and 2000),
  constraint nome_tamanho  check (char_length(autor_nome) between 1 and 60),
  constraint link_tamanho  check (link is null or char_length(link) <= 500)
);

create index if not exists posts_criado_em_idx on posts (criado_em desc);

-- ==========================================================
-- CURTIDAS
-- Tabela própria, com chave composta: assim o banco garante que
-- a mesma pessoa não curte o mesmo post duas vezes. Se fosse só
-- um contador na tabela de posts, qualquer um poderia inflá-lo.
-- ==========================================================
create table if not exists curtidas (
  post_id   uuid not null references posts(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ==========================================================
-- SEGURANÇA (Row Level Security)
--
-- Isto é o coração da coisa. Sem RLS, a chave anon (que fica
-- VISÍVEL no código do site) daria a qualquer pessoa o poder de
-- apagar o banco inteiro. Com RLS, o banco recusa por conta
-- própria — não importa o que o navegador tente enviar.
-- ==========================================================
alter table posts    enable row level security;
alter table curtidas enable row level security;

-- Ler: qualquer pessoa, mesmo deslogada. O mural é público.
drop policy if exists "posts_leitura_publica" on posts;
create policy "posts_leitura_publica"
  on posts for select
  using (true);

-- Escrever: só logado, e só em nome de si mesmo.
-- O `auth.uid() = autor_id` impede alguém de publicar se passando
-- por outro aluno.
drop policy if exists "posts_criar_logado" on posts;
create policy "posts_criar_logado"
  on posts for insert
  to authenticated
  with check (auth.uid() = autor_id);

-- Editar: só o dono do post.
drop policy if exists "posts_editar_dono" on posts;
create policy "posts_editar_dono"
  on posts for update
  to authenticated
  using (auth.uid() = autor_id)
  with check (auth.uid() = autor_id);

-- Excluir: só o dono do post.
drop policy if exists "posts_excluir_dono" on posts;
create policy "posts_excluir_dono"
  on posts for delete
  to authenticated
  using (auth.uid() = autor_id);

-- Curtidas: todo mundo vê a contagem; só o próprio usuário
-- cria e remove a curtida dele.
drop policy if exists "curtidas_leitura_publica" on curtidas;
create policy "curtidas_leitura_publica"
  on curtidas for select
  using (true);

drop policy if exists "curtidas_criar_propria" on curtidas;
create policy "curtidas_criar_propria"
  on curtidas for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "curtidas_remover_propria" on curtidas;
create policy "curtidas_remover_propria"
  on curtidas for delete
  to authenticated
  using (auth.uid() = user_id);

-- ==========================================================
-- ANTI-SPAM: no máximo 1 post a cada 30 segundos por pessoa.
-- Feito no banco de propósito — um limite só no JavaScript é
-- contornado por qualquer um que abra o console do navegador.
-- ==========================================================
create or replace function checar_intervalo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from posts
    where autor_id = new.autor_id
      and criado_em > now() - interval '30 seconds'
  ) then
    raise exception 'Espere um pouco antes de publicar de novo.';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_intervalo on posts;
create trigger posts_intervalo
  before insert on posts
  for each row execute function checar_intervalo();

-- ==========================================================
-- TEMPO REAL: o post de um aluno aparece na tela dos outros sem
-- ninguém precisar recarregar a página.
-- ==========================================================
alter publication supabase_realtime add table posts;
