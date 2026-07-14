-- ==========================================================
-- COMENTÁRIOS NOS POSTS (estilo Threads)
-- Rode no Supabase: SQL Editor -> New query -> Run
-- ==========================================================

create table if not exists comentarios (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  autor_id   uuid not null references auth.users(id) on delete cascade,
  autor_nome text not null check (length(autor_nome) between 1 and 80),
  texto      text not null check (length(trim(texto)) between 1 and 600),
  criado_em  timestamptz not null default now()
);

/* on delete cascade no post_id: apagar um post leva junto os
   comentários dele. Sem isso, sobrariam comentários órfãos,
   pendurados num post que não existe mais. */

-- Buscar os comentários de um post é a consulta mais frequente aqui.
create index if not exists comentarios_post_idx on comentarios (post_id, criado_em);

alter table comentarios enable row level security;

-- Ler: só a turma.
drop policy if exists "comentarios_leitura_turma" on comentarios;
create policy "comentarios_leitura_turma"
  on comentarios for select
  to authenticated
  using (eh_aluna());

-- Comentar: só a turma, e só em nome de si mesma.
drop policy if exists "comentarios_criar_turma" on comentarios;
create policy "comentarios_criar_turma"
  on comentarios for insert
  to authenticated
  with check (eh_aluna() and auth.uid() = autor_id);

/* Excluir: a dona do comentário OU a dona do post.
   Quem publicou precisa poder limpar a própria conversa — é o
   mínimo de moderação numa comunidade. */
drop policy if exists "comentarios_excluir" on comentarios;
create policy "comentarios_excluir"
  on comentarios for delete
  to authenticated
  using (
    eh_aluna() and (
      auth.uid() = autor_id
      or auth.uid() = (select autor_id from posts where posts.id = comentarios.post_id)
    )
  );

/* Numa exclusão, o Postgres manda por padrão só a chave primária do
   que sumiu — ou seja, o `id`, sem o `post_id`. A tela das OUTRAS
   alunas não teria como saber em qual post o comentário estava, e o
   contador ficaria travado num número errado. `replica identity full`
   faz o evento carregar a linha inteira. */
alter table comentarios replica identity full;

-- Tempo real: comentário de uma aluna aparece na tela das outras.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'comentarios'
  ) then
    alter publication supabase_realtime add table comentarios;
  end if;
end $$;
