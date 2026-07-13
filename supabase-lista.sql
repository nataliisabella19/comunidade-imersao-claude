-- ==========================================================
-- LISTA DE ALUNAS AUTORIZADAS
-- Rode no Supabase: SQL Editor -> New query -> Run
--
-- Sem isto, QUALQUER pessoa com conta Google entra na comunidade.
-- Depois disto, só entra quem estiver nesta tabela.
-- ==========================================================

create table if not exists alunas (
  email     text primary key,
  nome      text,
  criado_em timestamptz not null default now()
);

/* Guardo tudo em minúsculo. E-mail não diferencia maiúscula de
   minúscula, mas texto diferencia: sem isso, cadastrar
   "Maria@Gmail.com" e a pessoa entrar como "maria@gmail.com"
   daria "você não está na lista" — e ninguém entenderia por quê. */
create or replace function normalizar_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end $$;

drop trigger if exists alunas_normaliza on alunas;
create trigger alunas_normaliza
  before insert or update on alunas
  for each row execute function normalizar_email();

-- ==========================================================
-- A pergunta central: "quem está pedindo é da turma?"
--
-- security definer: a função enxerga a tabela `alunas` mesmo que
-- quem pergunta não tenha permissão de ler a lista. Ou seja, a
-- aluna consegue saber se ELA está autorizada, mas não consegue
-- baixar a lista de e-mails das colegas.
-- ==========================================================
create or replace function eh_aluna()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from alunas
    where email = lower(auth.jwt() ->> 'email')
  );
$$;

grant execute on function eh_aluna() to authenticated;

-- A lista em si é privada: ninguém baixa os e-mails da turma.
alter table alunas enable row level security;

-- ==========================================================
-- AS REGRAS PASSAM A EXIGIR "SER DA TURMA"
--
-- Antes bastava estar logado (`to authenticated`). Agora tem que
-- estar logado E na lista. É esta troca que fecha a comunidade de
-- verdade: ela vale mesmo se a pessoa montar a requisição na mão,
-- porque quem recusa é o banco.
-- ==========================================================

-- Ler os posts: só a turma.
drop policy if exists "posts_leitura_publica" on posts;
drop policy if exists "posts_leitura_logado" on posts;
drop policy if exists "posts_leitura_turma" on posts;
create policy "posts_leitura_turma"
  on posts for select
  to authenticated
  using (eh_aluna());

-- Publicar: só a turma, e só em nome de si mesma.
drop policy if exists "posts_criar_logado" on posts;
drop policy if exists "posts_criar_turma" on posts;
create policy "posts_criar_turma"
  on posts for insert
  to authenticated
  with check (eh_aluna() and auth.uid() = autor_id);

-- Editar e excluir: só a dona do post.
drop policy if exists "posts_editar_dono" on posts;
create policy "posts_editar_dono"
  on posts for update
  to authenticated
  using (eh_aluna() and auth.uid() = autor_id)
  with check (eh_aluna() and auth.uid() = autor_id);

drop policy if exists "posts_excluir_dono" on posts;
create policy "posts_excluir_dono"
  on posts for delete
  to authenticated
  using (eh_aluna() and auth.uid() = autor_id);

-- Curtidas: mesma regra.
drop policy if exists "curtidas_leitura_publica" on curtidas;
drop policy if exists "curtidas_leitura_logado" on curtidas;
drop policy if exists "curtidas_leitura_turma" on curtidas;
create policy "curtidas_leitura_turma"
  on curtidas for select
  to authenticated
  using (eh_aluna());

drop policy if exists "curtidas_criar_propria" on curtidas;
create policy "curtidas_criar_propria"
  on curtidas for insert
  to authenticated
  with check (eh_aluna() and auth.uid() = user_id);

drop policy if exists "curtidas_remover_propria" on curtidas;
create policy "curtidas_remover_propria"
  on curtidas for delete
  to authenticated
  using (eh_aluna() and auth.uid() = user_id);

-- ==========================================================
-- CADASTRE A TURMA AQUI
--
-- Troque pelos e-mails reais. Um por linha.
-- Para adicionar mais alunas depois, rode só este INSERT de novo
-- com os e-mails novos.
-- ==========================================================
insert into alunas (email, nome) values
  ('nataliisabella19@gmail.com', 'Isabella Natali'),   -- você (admin)
  ('laradam.ugc@gmail.com',      'Isabella (2ª conta)')
  -- ('aluna1@gmail.com', 'Nome da Aluna'),
  -- ('aluna2@gmail.com', 'Nome da Aluna'),
on conflict (email) do nothing;
