/* ==========================================================
   Mural do aluno — feed real, ligado ao Supabase

   Os posts agora vivem num banco de dados: quem publica é visto
   por TODO MUNDO. Login com Google.

   Sobre a chave abaixo estar exposta: é a chave `anon`, e ela é
   pública por natureza — todo site que usa Supabase a expõe. Quem
   protege os dados NÃO é o segredo da chave, e sim as regras de
   RLS no banco (ver supabase-setup.sql): elas impedem que alguém
   edite ou apague o post de outra pessoa, mesmo montando a
   requisição na mão pelo console do navegador.
   ========================================================== */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://hlyjhofiotsverogkorg.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseWpob2Zpb3RzdmVyb2drb3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4ODcwNDgsImV4cCI6MjA5OTQ2MzA0OH0.id4-EmVN64IsbHaCFQUccDRkFi2SYYCH0IH9Pe8IEFc";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ---------- Elementos ---------- */
const campo      = document.getElementById("campo-post");
const linkIn     = document.getElementById("campo-link");
const linkBox    = document.getElementById("campo-link-caixa");
const chipLink   = document.getElementById("chip-link");
const botao      = document.getElementById("btn-publicar");
const feed       = document.getElementById("feed");
const meuAvatar  = document.getElementById("meu-avatar");
const chips      = document.querySelectorAll(".chip[data-tag]");
const compositor = document.querySelector(".compositor");
const barraAuth  = document.getElementById("auth-barra");
const btnEntrar  = document.getElementById("btn-entrar");
const btnSair    = document.getElementById("btn-sair");
const authNome   = document.getElementById("auth-nome");
const aviso      = document.getElementById("mural-aviso");

let usuario = null;
let tag = "";
let curtidasMinhas = new Set();

/* ================= Utilidades ================= */

function iniciais(nome) {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/* Só http/https. Um href "javascript:..." viraria execução de
   código no clique de quem lê. Aqui isso vale em dobro: o link vem
   de OUTRO aluno, não de você. */
function urlSegura(bruta) {
  if (!bruta) return null;
  let texto = String(bruta).trim();
  if (!texto) return null;
  if (!/^https?:\/\//i.test(texto)) texto = "https://" + texto;
  try {
    const u = new URL(texto);
    return (u.protocol === "http:" || u.protocol === "https:") ? u : null;
  } catch { return null; }
}

function tempoRelativo(iso) {
  const d = new Date(iso);
  const seg = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seg < 60)     return "agora";
  if (seg < 3600)   return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400)  return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 604800) return `há ${Math.floor(seg / 86400)} d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function iconeSvg(id, classe) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", classe);
  const use = document.createElementNS(ns, "use");
  use.setAttribute("href", "#" + id);
  svg.appendChild(use);
  return svg;
}

function botaoAcao(classe, icone, rotulo, texto) {
  const b = document.createElement("button");
  b.className = classe;
  b.type = "button";
  b.setAttribute("aria-label", rotulo);
  b.append(iconeSvg(icone, "ic ic-sm"));
  if (texto !== undefined) {
    const s = document.createElement("span");
    s.textContent = texto;
    b.append(s);
  }
  return b;
}

function mostrarErro(msg) {
  if (!aviso) return;
  aviso.textContent = msg;
  aviso.dataset.erro = "1";
  setTimeout(atualizarAviso, 5000);
}

/* ================= Montagem do post =================
   Tudo via DOM e textContent, nunca innerHTML. O texto vem de
   outro aluno: se ele escrever "<script>", precisa aparecer como
   texto na tela — não rodar no navegador de quem lê. */
function criarPost(p) {
  const art = document.createElement("article");
  art.className = "post liquid-glass";
  art.dataset.id = p.id;

  const av = document.createElement("span");
  av.className = "avatar";
  av.textContent = iniciais(p.autor_nome);

  const corpo = document.createElement("div");
  corpo.className = "post-corpo";

  const topo = document.createElement("div");
  topo.className = "post-topo";

  const nome = document.createElement("strong");
  nome.textContent = p.autor_nome;
  topo.append(nome);

  if (p.tag) {
    const t = document.createElement("span");
    t.className = "post-tag";
    t.textContent = p.tag;
    topo.append(t);
  }

  const hora = document.createElement("span");
  hora.className = "post-hora";
  hora.textContent = tempoRelativo(p.criado_em) + (p.editado ? " · editado" : "");
  topo.append(hora);

  const texto = document.createElement("p");
  texto.className = "post-texto";
  texto.textContent = p.texto;

  corpo.append(topo, texto);

  const u = urlSegura(p.link);
  if (u) {
    const a = document.createElement("a");
    a.className = "post-link liquid-glass";
    a.href = u.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    const rotulo = document.createElement("span");
    rotulo.textContent = u.hostname.replace(/^www\./, "");
    a.append(iconeSvg("i-link", "ic ic-sm"), rotulo);
    corpo.append(a);
  }

  const acoes = document.createElement("div");
  acoes.className = "post-acoes";

  const total = p.curtidas?.[0]?.count ?? 0;
  const curtir = botaoAcao("acao js-curtir", "i-coracao", "Curtir", String(total));
  curtir.dataset.total = String(total);
  if (curtidasMinhas.has(p.id)) curtir.dataset.curtido = "1";
  acoes.append(curtir);

  /* Editar/excluir só aparecem pro dono. Isso é conveniência de
     interface — quem REALMENTE impede é o RLS no banco. Esconder
     um botão não protege nada por si só. */
  if (usuario && p.autor_id === usuario.id) {
    const espaco = document.createElement("span");
    espaco.className = "acoes-espaco";
    acoes.append(
      espaco,
      botaoAcao("acao js-editar", "i-lapis", "Editar post"),
      botaoAcao("acao acao-perigo js-excluir", "i-lixeira", "Excluir post")
    );
  }

  corpo.append(acoes);
  art.append(av, corpo);
  return art;
}

/* ================= Carregar o feed ================= */
async function carregarFeed() {
  const { data, error } = await sb
    .from("posts")
    .select("id, autor_id, autor_nome, texto, tag, link, editado, criado_em, curtidas(count)")
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) {
    mostrarErro("Não consegui carregar o mural: " + error.message);
    return;
  }

  if (usuario) {
    const { data: minhas } = await sb
      .from("curtidas")
      .select("post_id")
      .eq("user_id", usuario.id);
    curtidasMinhas = new Set((minhas || []).map((c) => c.post_id));
  } else {
    curtidasMinhas = new Set();
  }

  feed.replaceChildren();

  if (!data.length) {
    const vazio = document.createElement("p");
    vazio.className = "feed-vazio";
    vazio.textContent = "Nenhum post ainda. Seja a primeira pessoa a publicar.";
    feed.append(vazio);
    return;
  }

  data.forEach((p) => feed.append(criarPost(p)));
}

/* ================= Publicar ================= */
async function publicar() {
  if (!usuario || !campo.value.trim()) return;

  botao.disabled = true;

  const { error } = await sb.from("posts").insert({
    autor_id: usuario.id,
    autor_nome: usuario.user_metadata?.full_name || usuario.email || "Aluno",
    texto: campo.value.trim(),
    tag: tag || null,
    link: linkIn?.value.trim() || null,
  });

  if (error) {
    // O trigger anti-spam do banco cai aqui quando a pessoa publica
    // rápido demais.
    mostrarErro(error.message);
    atualizarBotao();
    return;
  }

  campo.value = "";
  campo.style.height = "auto";
  if (linkIn) linkIn.value = "";
  if (linkBox) linkBox.hidden = true;
  if (chipLink) chipLink.dataset.ativo = "0";
  tag = "";
  chips.forEach((c) => (c.dataset.ativo = "0"));

  await carregarFeed();
  atualizarBotao();
}

/* ================= Editar / excluir / curtir ================= */
function abrirEdicao(art) {
  if (art.querySelector(".post-editor")) return;

  const texto = art.querySelector(".post-texto");
  const acoes = art.querySelector(".post-acoes");
  if (!texto || !acoes) return;

  const editor = document.createElement("textarea");
  editor.className = "post-editor";
  editor.value = texto.textContent;
  editor.rows = 1;

  const barra = document.createElement("div");
  barra.className = "editor-barra";
  barra.append(
    botaoAcao("acao js-salvar", "i-check", "Salvar", "Salvar"),
    botaoAcao("acao js-cancelar", "i-x", "Cancelar", "Cancelar")
  );

  texto.hidden = true;
  acoes.hidden = true;
  texto.after(editor, barra);

  const crescer = () => {
    editor.style.height = "auto";
    editor.style.height = editor.scrollHeight + "px";
  };
  editor.addEventListener("input", crescer);
  crescer();
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);

  editor.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharEdicao(art, false);
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); fecharEdicao(art, true); }
  });
}

async function fecharEdicao(art, confirmar) {
  const editor = art.querySelector(".post-editor");
  const barra  = art.querySelector(".editor-barra");
  const texto  = art.querySelector(".post-texto");
  const acoes  = art.querySelector(".post-acoes");
  const hora   = art.querySelector(".post-hora");
  if (!editor || !texto) return;

  const novo = editor.value.trim();

  // Salvar vazio apagaria o post sem a pessoa pedir: trata como cancelar.
  if (confirmar && novo && novo !== texto.textContent) {
    const { error } = await sb
      .from("posts")
      .update({ texto: novo, editado: true })
      .eq("id", art.dataset.id);

    if (error) {
      mostrarErro("Não consegui salvar: " + error.message);
    } else {
      texto.textContent = novo;
      if (hora && !hora.textContent.includes("editado")) hora.textContent += " · editado";
    }
  }

  editor.remove();
  if (barra) barra.remove();
  texto.hidden = false;
  if (acoes) acoes.hidden = false;
}

async function alternarCurtida(btn, id) {
  if (!usuario) { mostrarErro("Entre com o Google para curtir."); return; }

  const curtido = btn.dataset.curtido === "1";
  const total = Number(btn.dataset.total || 0);

  /* Atualizo a tela ANTES da resposta do servidor: um coração que
     demora meio segundo pra reagir parece quebrado. Se der erro,
     desfaço logo abaixo. */
  const novoTotal = total + (curtido ? -1 : 1);
  btn.dataset.curtido = curtido ? "0" : "1";
  btn.dataset.total = String(novoTotal);
  btn.querySelector("span").textContent = String(novoTotal);

  const { error } = curtido
    ? await sb.from("curtidas").delete().eq("post_id", id).eq("user_id", usuario.id)
    : await sb.from("curtidas").insert({ post_id: id, user_id: usuario.id });

  if (error) {
    btn.dataset.curtido = curtido ? "1" : "0";
    btn.dataset.total = String(total);
    btn.querySelector("span").textContent = String(total);
    mostrarErro("Não consegui registrar a curtida.");
  }
}

/* Um só ouvinte no feed: cobre também os posts que chegam depois.
   Ligar ouvinte em cada botão deixaria os novos mudos. */
feed.addEventListener("click", async (e) => {
  const art = e.target.closest(".post");
  if (!art) return;

  const curtir = e.target.closest(".js-curtir");
  if (curtir) { alternarCurtida(curtir, art.dataset.id); return; }

  if (e.target.closest(".js-editar"))   { abrirEdicao(art); return; }
  if (e.target.closest(".js-salvar"))   { fecharEdicao(art, true); return; }
  if (e.target.closest(".js-cancelar")) { fecharEdicao(art, false); return; }

  if (e.target.closest(".js-excluir")) {
    if (!confirm("Excluir este post? Não dá pra desfazer.")) return;
    const { error } = await sb.from("posts").delete().eq("id", art.dataset.id);
    if (error) mostrarErro("Não consegui excluir: " + error.message);
    else art.remove();
  }
});

/* ================= Login ================= */
async function entrar() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    // Volta pra esta mesma página depois do login.
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) mostrarErro("Não consegui abrir o login: " + error.message);
}

const sair = () => sb.auth.signOut();

/* ================= Estado da interface ================= */
function atualizarAviso() {
  if (!aviso) return;
  aviso.dataset.erro = "0";
  aviso.textContent = usuario
    ? "Seu post fica visível para toda a turma."
    : "Entre com o Google para publicar. Ler o mural não exige login.";
}

function atualizarBotao() {
  botao.disabled = !usuario || !campo.value.trim();
}

function aplicarSessao(sessao) {
  usuario = sessao?.user || null;
  const logado = Boolean(usuario);

  if (barraAuth) barraAuth.dataset.logado = logado ? "1" : "0";
  if (compositor) compositor.dataset.bloqueado = logado ? "0" : "1";
  campo.disabled = !logado;

  if (logado) {
    const nome = usuario.user_metadata?.full_name || usuario.email || "Aluno";
    if (authNome) authNome.textContent = nome;
    if (meuAvatar) meuAvatar.textContent = iniciais(nome);
  } else if (meuAvatar) {
    meuAvatar.textContent = "?";
  }

  atualizarAviso();
  atualizarBotao();
}

/* ================= Ligações ================= */
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const nova = chip.dataset.tag;
    tag = tag === nova ? "" : nova;              // clicar de novo desmarca
    chips.forEach((c) => (c.dataset.ativo = c.dataset.tag === tag ? "1" : "0"));
  });
});

if (chipLink && linkBox) {
  chipLink.addEventListener("click", () => {
    linkBox.hidden = !linkBox.hidden;
    chipLink.dataset.ativo = linkBox.hidden ? "0" : "1";
    if (!linkBox.hidden && linkIn) linkIn.focus();
  });
}

campo.addEventListener("input", () => {
  campo.style.height = "auto";
  campo.style.height = campo.scrollHeight + "px";
  atualizarBotao();
});

campo.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); publicar(); }
});

botao.addEventListener("click", publicar);
btnEntrar?.addEventListener("click", entrar);
btnSair?.addEventListener("click", sair);

/* ================= Partida ================= */
const { data: { session } } = await sb.auth.getSession();
aplicarSessao(session);
await carregarFeed();

// Login e logout recarregam o feed: os botões de editar/excluir
// dependem de quem está logado.
sb.auth.onAuthStateChange((_evento, sessao) => {
  aplicarSessao(sessao);
  carregarFeed();
});

/* Tempo real: o post de um aluno aparece na tela dos outros sem
   ninguém precisar recarregar a página. */
sb.channel("mural")
  .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, carregarFeed)
  .subscribe();
