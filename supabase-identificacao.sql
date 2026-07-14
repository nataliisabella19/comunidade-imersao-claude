-- ==========================================================
-- IDENTIFICAÇÃO DAS ALUNAS
-- Rode no Supabase: SQL Editor -> New query -> Run
--
-- A tabela `alunas` já diz quem PODE entrar. O que falta é saber
-- quem DE FATO entrou. Sem isso, você não tem como diferenciar
-- "a aluna nunca acessou" de "a aluna acessou e não postou nada" —
-- e essas duas coisas pedem atitudes bem diferentes de você.
-- ==========================================================

alter table alunas add column if not exists user_id       uuid;
alter table alunas add column if not exists nome_google   text;
alter table alunas add column if not exists foto          text;
alter table alunas add column if not exists primeiro_acesso timestamptz;
alter table alunas add column if not exists ultimo_acesso   timestamptz;
alter table alunas add column if not exists acessos         integer not null default 0;

-- ==========================================================
-- Carimbo de presença.
--
-- security definer: a aluna NÃO tem permissão de escrever na tabela
-- `alunas` (senão ela poderia se auto-cadastrar e furar a lista).
-- Esta função escreve por ela, mas só na linha do próprio e-mail —
-- o `where` abaixo é o que garante isso, e ele não recebe nada de
-- fora: o e-mail vem do token assinado, não de um parâmetro que a
-- pessoa poderia falsificar.
-- ==========================================================
create or replace function registrar_acesso()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  meu_email text := lower(auth.jwt() ->> 'email');
begin
  if meu_email is null then
    return;
  end if;

  update alunas set
    user_id         = auth.uid(),
    nome_google     = coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name',  nome_google),
    foto            = coalesce(auth.jwt() -> 'user_metadata' ->> 'avatar_url', foto),
    primeiro_acesso = coalesce(primeiro_acesso, now()),
    ultimo_acesso   = now(),
    acessos         = acessos + 1
  where email = meu_email;
end $$;

grant execute on function registrar_acesso() to authenticated;

-- ==========================================================
-- SUA LISTA DE PRESENÇA
--
-- Rode isto sempre que quiser ver a turma. Abre no SQL Editor e
-- mostra tudo: quem entrou, quando, quantas vezes, quantos posts.
-- ==========================================================
create or replace view turma as
  select
    a.nome,
    a.email,
    case when a.primeiro_acesso is null then 'nunca entrou'
         else 'ativa' end                       as situacao,
    a.acessos,
    a.ultimo_acesso,
    (select count(*) from posts p where p.autor_id = a.user_id) as posts
  from alunas a
  order by a.primeiro_acesso nulls first, a.nome;

-- Para consultar depois, é só:  select * from turma;
