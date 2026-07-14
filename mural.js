/* ==========================================================
   Mural do aluno — feed real, ligado ao Supabase

   Esta página só é alcançada com sessão válida (ver guard.js),
   então aqui sempre existe um usuário logado.
   ========================================================== */

import { sb } from "./supabase.js";

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
const btnSair    = document.getElementById("btn-sair");
const authNome   = document.getElementById("auth-nome");
const aviso      = document.getElementById("mural-aviso");

let usuario = null;
let tag = "";
let curtidasMinhas = new Set();

/* Quais conversas estão abertas na tela.
   O feed é remontado do zero a cada mudança (post novo, curtida,
   login). Sem esta memória, a conversa que a aluna acabou de abrir
   se fecharia sozinha na cara dela quando outra pessoa postasse. */
const conversasAbertas = new Set();

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
  art.dataset.autor = p.autor_id;   // usado pra saber quem pode moderar a conversa

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

  const nComentarios = p.comentarios?.[0]?.count ?? 0;
  const comentar = botaoAcao("acao js-comentar", "i-balao", "Comentar", String(nComentarios));
  acoes.append(comentar);

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

  /* A conversa nasce fechada e vazia. Só busco os comentários quando
     alguém abre — carregar todos de todos os posts de uma vez seria
     puxar um monte de texto que ninguém pediu pra ver. */
  const conversa = document.createElement("div");
  conversa.className = "post-conversa";
  conversa.hidden = true;
  corpo.append(conversa);

  art.append(av, corpo);
  return art;
}

/* ================= Comentários ================= */

function criarComentario(c, donoDoPost) {
  const item = document.createElement("div");
  item.className = "resposta";
  item.dataset.id = c.id;

  const av = document.createElement("span");
  av.className = "avatar avatar-mini";
  av.textContent = iniciais(c.autor_nome);

  const corpo = document.createElement("div");
  corpo.className = "resposta-corpo";

  const topo = document.createElement("div");
  topo.className = "resposta-topo";

  const nome = document.createElement("strong");
  nome.textContent = c.autor_nome;

  const hora = document.createElement("span");
  hora.className = "post-hora";
  hora.textContent = tempoRelativo(c.criado_em);

  topo.append(nome, hora);

  const texto = document.createElement("p");
  texto.className = "resposta-texto";
  texto.textContent = c.texto;

  corpo.append(topo, texto);
  item.append(av, corpo);

  /* Some a própria resposta; e quem publicou o post pode apagar
     qualquer resposta nele — é o mínimo de moderação. Igual aos
     posts: o botão é conveniência, quem recusa de verdade é o RLS. */
  const podeApagar =
    usuario && (c.autor_id === usuario.id || donoDoPost === usuario.id);

  if (podeApagar) {
    item.append(
      botaoAcao("acao acao-perigo js-excluir-resposta", "i-lixeira", "Excluir comentário")
    );
  }

  return item;
}

function criarCompositorResposta() {
  const caixa = document.createElement("div");
  caixa.className = "resposta-nova";

  const av = document.createElement("span");
  av.className = "avatar avatar-mini";
  const meuNome = usuario?.user_metadata?.full_name || usuario?.email || "";
  av.textContent = iniciais(meuNome);

  const campo = document.createElement("input");
  campo.className = "resposta-campo";
  campo.type = "text";
  campo.maxLength = 600;
  campo.placeholder = "Responder…";

  const enviar = botaoAcao("acao js-enviar-resposta", "i-arrow-up", "Enviar comentário");

  caixa.append(av, campo, enviar);
  return caixa;
}

async function abrirConversa(art) {
  const conversa = art.querySelector(".post-conversa");
  if (!conversa) return;

  conversa.hidden = false;
  conversasAbertas.add(art.dataset.id);

  const { data, error } = await sb
    .from("comentarios")
    .select("id, post_id, autor_id, autor_nome, texto, criado_em")
    .eq("post_id", art.dataset.id)
    .order("criado_em", { ascending: true });

  if (error) {
    mostrarErro("Não consegui carregar os comentários: " + error.message);
    return;
  }

  const lista = document.createElement("div");
  lista.className = "respostas-lista";
  data.forEach((c) => lista.append(criarComentario(c, art.dataset.autor)));

  conversa.replaceChildren(lista, criarCompositorResposta());
  sincronizarContador(art, data.length);
}

function fecharConversa(art) {
  const conversa = art.querySelector(".post-conversa");
  if (!conversa) return;
  conversa.hidden = true;
  conversa.replaceChildren();
  conversasAbertas.delete(art.dataset.id);
}

function sincronizarContador(art, n) {
  const btn = art.querySelector(".js-comentar span");
  if (btn) btn.textContent = String(n);
}

async function responder(art, campo) {
  const texto = campo.value.trim();
  if (!usuario || !texto) return;

  campo.disabled = true;

  const { error } = await sb.from("comentarios").insert({
    post_id: art.dataset.id,
    autor_id: usuario.id,
    autor_nome: usuario.user_metadata?.full_name || usuario.email || "Aluno",
    texto,
  });

  campo.disabled = false;

  if (error) {
    mostrarErro("Não consegui comentar: " + error.message);
    return;
  }

  campo.value = "";
  await abrirConversa(art);   // recarrega a conversa já com a resposta nova
  art.querySelector(".resposta-campo")?.focus();
}

/* ================= Carregar o feed ================= */
async function carregarFeed() {
  const { data, error } = await sb
    .from("posts")
    .select("id, autor_id, autor_nome, texto, tag, link, editado, criado_em, curtidas(count), comentarios(count)")
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

  /* Reabre as conversas que a pessoa tinha aberto antes desta
     remontagem. Sem isto, um post novo de outra aluna fecharia a
     discussão que ela estava lendo. */
  conversasAbertas.forEach((id) => {
    const art = feed.querySelector(`.post[data-id="${CSS.escape(id)}"]`);
    if (art) abrirConversa(art);
    else conversasAbertas.delete(id);   // o post sumiu (excluído)
  });
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

  if (e.target.closest(".js-comentar")) {
    const conversa = art.querySelector(".post-conversa");
    if (conversa?.hidden) {
      await abrirConversa(art);
      art.querySelector(".resposta-campo")?.focus();
    } else {
      fecharConversa(art);
    }
    return;
  }

  const enviar = e.target.closest(".js-enviar-resposta");
  if (enviar) {
    const campo = art.querySelector(".resposta-campo");
    if (campo) await responder(art, campo);
    return;
  }

  const apagarResposta = e.target.closest(".js-excluir-resposta");
  if (apagarResposta) {
    const item = apagarResposta.closest(".resposta");
    if (!item || !confirm("Excluir este comentário?")) return;

    const { error } = await sb.from("comentarios").delete().eq("id", item.dataset.id);
    if (error) {
      mostrarErro("Não consegui excluir o comentário: " + error.message);
    } else {
      item.remove();
      sincronizarContador(art, art.querySelectorAll(".resposta").length);
    }
    return;
  }

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

/* Enter envia o comentário. Delegado no feed, como o clique: os
   campos de resposta nascem e morrem o tempo todo, então ligar o
   ouvinte em cada um deixaria os novos mudos. */
feed.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter" || !e.target.classList.contains("resposta-campo")) return;
  e.preventDefault();
  const art = e.target.closest(".post");
  if (art) await responder(art, e.target);
});

/* ================= Sair ================= */
const sair = () => sb.auth.signOut();

/* ================= Estado da interface ================= */
function atualizarAviso() {
  if (!aviso) return;
  aviso.dataset.erro = "0";
  aviso.textContent = "Seu post fica visível para toda a turma.";
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

  /* Comentário novo NÃO remonta o feed inteiro: se remontasse, o
     campo de resposta perderia o foco e o texto meio-digitado da
     aluna sumiria no meio da frase. Aqui eu mexo só no post afetado. */
  .on("postgres_changes", { event: "*", schema: "public", table: "comentarios" }, (payload) => {
    const postId = payload.new?.post_id || payload.old?.post_id;
    if (!postId) return;

    const art = feed.querySelector(`.post[data-id="${CSS.escape(postId)}"]`);
    if (!art) return;

    const conversa = art.querySelector(".post-conversa");
    if (conversa && !conversa.hidden) {
      // Conversa aberta: já estou vendo, então atualizo a lista.
      // (Se fui EU que comentei, `responder()` já recarregou — recarregar
      //  de novo é barato e mantém todo mundo vendo a mesma coisa.)
      abrirConversa(art);
    } else {
      // Fechada: basta o número no botão subir/descer.
      const btn = art.querySelector(".js-comentar span");
      if (btn) {
        const n = Number(btn.textContent || 0);
        btn.textContent = String(Math.max(0, n + (payload.eventType === "DELETE" ? -1 : 1)));
      }
    }
  })
  .subscribe();
