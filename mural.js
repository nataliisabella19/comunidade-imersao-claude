/* ==========================================================
   Mural — compositor de posts

   ATENÇÃO (importante): o site é estático, sem servidor.
   Os posts são gravados no localStorage, ou seja, ficam SÓ no
   navegador de quem escreveu. Ninguém mais enxerga. É uma
   demonstração de interface, não uma comunidade funcionando.
   Pra virar um mural de verdade, precisa de um backend.

   ========================================================== */

/* ---------------- Carrossel 3D — desliza pro lado ----------------
   O "centro" é um número CONTÍNUO, não um índice. Quando vale 2.4,
   o carrossel está genuinamente ENTRE o card 2 e o 3, meio girado —
   é isso que permite a fita acompanhar o dedo em vez de saltar.

   A coleção é FINITA (do card 0 ao n-1), não circular. A versão
   circular anterior fazia o card mais afastado "dar a volta" e
   reaparecer do outro lado — perto das pontas isso virava um
   teleporte visível. Era a bugada.
   ---------------------------------------------------------------- */
(function () {
  const trilho = document.getElementById("trilho");
  if (!trilho) return;

  const cards = Array.from(trilho.children);
  const n = cards.length;
  if (!n) return;

  const VISIVEIS = 2;    // quantos cards aparecem de cada lado
  const EASING = 0.12;   // o quão rápido o carrossel alcança o alvo
  const PX_POR_CARD = 200;  // quantos pixels de arrasto valem um card
  const LIMIAR = 5;      // px pra virar arrasto (abaixo disso, é clique)

  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const limitar = (v) => Math.max(0, Math.min(n - 1, v));

  let alvo = Math.floor(n / 2);
  let atual = alvo;

  // Distância até o centro, com sinal. Sem volta: o primeiro card é
  // o primeiro, e ponto.
  const distancia = (i) => i - atual;

  function render() {
    cards.forEach((card, i) => {
      const d = distancia(i);
      const dist = Math.abs(d);

      // O CSS resolve toda a geometria a partir de --pos.
      card.style.setProperty("--pos", d.toFixed(3));

      // Com centro fracionário ninguém fica exatamente em zero:
      // "ativo" é quem está mais perto do meio.
      const ehCentro = dist < 0.5;
      card.dataset.ativo = ehCentro ? "1" : "0";
      card.dataset.longe = dist > VISIVEIS + 0.5 ? "1" : "0";
      card.setAttribute("aria-hidden", ehCentro ? "false" : "true");
    });
  }

  /* ---------- Loop de animação ----------
     `alvo` é a única fonte da verdade. Arrasto, clique e teclado só
     mudam o alvo; o loop apenas persegue. */
  let rodando = false;

  function tique() {
    atual += (alvo - atual) * EASING;

    if (Math.abs(alvo - atual) < 0.001) {
      atual = alvo;
      render();
      rodando = false;   // chegou: para o loop em vez de girar à toa
      return;
    }

    render();
    requestAnimationFrame(tique);
  }

  function animar() {
    if (rodando || reduzir) return;
    rodando = true;
    requestAnimationFrame(tique);
  }

  /* ==========================================================
     O CURSOR COMANDA (sem clicar, sem segurar)

     Mapeamento direto: a posição do mouse ao longo do palco É a
     posição na coleção. Mouse na borda esquerda = primeiro card;
     na borda direita = último.

     Escolhi assim de propósito. A versão anterior somava um
     deslocamento a partir do meio, o que deixava o alvo ESTOURAR
     as pontas (ir além do último card) — e era daí que vinha a
     bugada. Com o mapeamento direto, o fim da faixa é o fim da
     coleção: não existe "além".
     ========================================================== */
  const temHover = window.matchMedia("(hover: hover)").matches;

  if (temHover && !reduzir) {
    const palco = trilho.parentElement || trilho;

    palco.addEventListener("pointermove", (e) => {
      const r = trilho.getBoundingClientRect();

      // Uma margem morta nas laterais: sem ela, seria impossível
      // parar no primeiro ou no último card — bastaria um pixel de
      // sobra pra escapar da ponta.
      const margem = r.width * 0.12;
      const util = r.width - margem * 2;
      const bruto = (e.clientX - r.left - margem) / util;   // 0 .. 1

      alvo = limitar(bruto * (n - 1));
      animar();
    }, { passive: true });

    // Cursor saiu: encaixa no card mais próximo em vez de largar a
    // fita num meio-termo torto, com dois cards pela metade.
    palco.addEventListener("pointerleave", () => {
      alvo = limitar(Math.round(atual));
      animar();
    }, { passive: true });
  }

  /* ---------- Celular: deslizar com o dedo ----------
     Não existe cursor pairando no toque, então lá o gesto é o
     arrasto mesmo. */
  let arrastando = false;
  let arrastou = false;
  let x0 = 0;
  let alvo0 = 0;

  trilho.addEventListener("pointerdown", (e) => {
    if (temHover || e.button !== 0) return;
    arrastando = true;
    arrastou = false;
    x0 = e.clientX;
    alvo0 = atual;
    trilho.classList.add("deslizando");
  });

  trilho.addEventListener("pointermove", (e) => {
    if (!arrastando) return;
    const dx = e.clientX - x0;

    // Folga: sem ela, o tremor do dedo ao tocar já contaria como
    // arrasto e cancelaria o toque no card.
    if (!arrastou && Math.abs(dx) < LIMIAR) return;

    if (!arrastou) {
      arrastou = true;
      trilho.setPointerCapture(e.pointerId);
    }

    alvo = limitar(alvo0 - dx / PX_POR_CARD);
    animar();
  });

  function soltar() {
    if (!arrastando) return;
    arrastando = false;
    trilho.classList.remove("deslizando");
    alvo = limitar(Math.round(atual));
    animar();
  }

  trilho.addEventListener("pointerup", soltar);
  trilho.addEventListener("pointercancel", soltar);

  /* Tocar num card lateral traz ele pro centro (celular). */
  cards.forEach((card, i) => {
    card.addEventListener("click", (e) => {
      if (arrastou) {              // foi deslize, não toque
        e.preventDefault();
        return;
      }
      if (temHover) return;        // no desktop quem manda é o cursor
      if (Math.abs(distancia(i)) < 0.5) return;
      alvo = limitar(i);
      animar();
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    alvo = limitar(Math.round(atual) + (e.key === "ArrowRight" ? 1 : -1));
    animar();
  });

  render();
})();

/* ---------------- Mural do aluno — feed ---------------- */
(function () {
  const campo     = document.getElementById("campo-post");
  const nomeIn    = document.getElementById("campo-nome");
  const linkIn    = document.getElementById("campo-link");
  const linkBox   = document.getElementById("campo-link-caixa");
  const chipLink  = document.getElementById("chip-link");
  const botao     = document.getElementById("btn-publicar");
  const feed      = document.getElementById("feed");
  const meuAvatar = document.getElementById("meu-avatar");
  const chips     = document.querySelectorAll(".chip[data-tag]");
  if (!campo || !botao || !feed) return;

  const CHAVE_POSTS = "mural-imersao-claude";
  const CHAVE_NOME  = "mural-imersao-claude-nome";

  let tag = "";

  /* ================= Utilidades ================= */

  // "Marina Julia" -> "MJ"
  function iniciais(nome) {
    const p = nome.trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  }

  /* Só http/https. Um href "javascript:..." viraria execução de
     código no clique de quem lê — é o buraco clássico de feed. */
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

  const quandoAgora = () =>
    new Date().toLocaleString("pt-BR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

  /* Id único do post. Sem isso não dá pra editar nem excluir: dois
     posts com o mesmo texto seriam indistinguíveis na hora de achar
     qual apagar. */
  let contador = 0;
  const novoId = () => `${Date.now()}-${contador++}`;

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

  /* ================= Persistência (só neste navegador!) ========= */
  function lerSalvos() {
    try {
      const bruto = localStorage.getItem(CHAVE_POSTS);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch {
      // localStorage bloqueado (aba anônima) ou JSON corrompido: o
      // mural degrada pra só-leitura em vez de quebrar a página.
      return [];
    }
  }

  function salvar(lista) {
    try { localStorage.setItem(CHAVE_POSTS, JSON.stringify(lista)); }
    catch { /* sem espaço ou sem permissão */ }
  }

  function atualizarSalvo(id, mudancas) {
    const lista = lerSalvos();
    const i = lista.findIndex((p) => p.id === id);
    if (i === -1) return;
    lista[i] = { ...lista[i], ...mudancas };
    salvar(lista);
  }

  function removerSalvo(id) {
    salvar(lerSalvos().filter((p) => p.id !== id));
  }

  /* ================= Montagem do post =================
     Tudo via DOM e textContent, nunca innerHTML. Se alguém digitar
     "<script>", tem que virar texto na tela — não código rodando. */
  function criarPost(p) {
    const art = document.createElement("article");
    art.className = "post liquid-glass";
    art.dataset.id = p.id;

    const av = document.createElement("span");
    av.className = "avatar";
    av.textContent = iniciais(p.nome);

    const corpo = document.createElement("div");
    corpo.className = "post-corpo";

    // --- Cabeçalho ---
    const topo = document.createElement("div");
    topo.className = "post-topo";

    const nome = document.createElement("strong");
    nome.textContent = p.nome;
    topo.append(nome);

    if (p.tag) {
      const t = document.createElement("span");
      t.className = "post-tag";
      t.textContent = p.tag;
      topo.append(t);
    }

    const hora = document.createElement("span");
    hora.className = "post-hora";
    hora.textContent = p.quando + (p.editado ? " · editado" : "");
    topo.append(hora);

    // --- Texto ---
    const texto = document.createElement("p");
    texto.className = "post-texto";
    texto.textContent = p.texto;
    corpo.append(topo, texto);

    // --- Link ---
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

    // --- Ações ---
    const acoes = document.createElement("div");
    acoes.className = "post-acoes";

    const curtir = botaoAcao("acao js-curtir", "i-coracao", "Curtir", "0");
    curtir.dataset.curtidas = "0";
    acoes.append(curtir);

    /* Editar e excluir só nos posts DESTE navegador. Não faz sentido
       oferecer "excluir" num post que a pessoa não escreveu — e, com
       backend, o servidor terá que reforçar isso de verdade. */
    if (p.meu) {
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

  /* ================= Edição no lugar ================= */
  function abrirEdicao(art) {
    if (art.querySelector(".post-editor")) return;   // já está editando

    const texto = art.querySelector(".post-texto");
    const acoes = art.querySelector(".post-acoes");
    if (!texto || !acoes) return;

    const editor = document.createElement("textarea");
    editor.className = "post-editor";
    editor.value = texto.textContent;
    editor.rows = 1;

    const barra = document.createElement("div");
    barra.className = "editor-barra";

    const salvarBtn   = botaoAcao("acao js-salvar", "i-check", "Salvar", "Salvar");
    const cancelarBtn = botaoAcao("acao js-cancelar", "i-x", "Cancelar", "Cancelar");
    barra.append(salvarBtn, cancelarBtn);

    texto.hidden = true;
    acoes.hidden = true;
    texto.after(editor, barra);

    // O textarea cresce com o conteúdo em vez de virar caixinha
    // com rolagem interna.
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

  function fecharEdicao(art, confirmar) {
    const editor = art.querySelector(".post-editor");
    const barra  = art.querySelector(".editor-barra");
    const texto  = art.querySelector(".post-texto");
    const acoes  = art.querySelector(".post-acoes");
    const hora   = art.querySelector(".post-hora");
    if (!editor || !texto) return;

    const novo = editor.value.trim();

    // Salvar com o campo vazio apagaria o post sem a pessoa pedir.
    // Nesse caso, trata como cancelar.
    if (confirmar && novo) {
      texto.textContent = novo;
      atualizarSalvo(art.dataset.id, { texto: novo, editado: true });
      if (hora && !hora.textContent.includes("editado")) {
        hora.textContent += " · editado";
      }
    }

    editor.remove();
    if (barra) barra.remove();
    texto.hidden = false;
    if (acoes) acoes.hidden = false;
  }

  /* ================= Cliques no feed (delegados) =================
     Um só ouvinte no feed cobre também os posts criados depois —
     ligar ouvinte em cada botão deixaria os novos posts mudos. */
  feed.addEventListener("click", (e) => {
    const art = e.target.closest(".post");
    if (!art) return;

    if (e.target.closest(".js-curtir")) {
      const btn = e.target.closest(".js-curtir");
      const curtido = btn.dataset.curtido === "1";
      const base = Number(btn.dataset.curtidas || 0);
      btn.dataset.curtido = curtido ? "0" : "1";
      const span = btn.querySelector("span");
      if (span) span.textContent = String(base + (curtido ? 0 : 1));
      return;
    }

    if (e.target.closest(".js-editar"))   { abrirEdicao(art); return; }
    if (e.target.closest(".js-salvar"))   { fecharEdicao(art, true); return; }
    if (e.target.closest(".js-cancelar")) { fecharEdicao(art, false); return; }

    if (e.target.closest(".js-excluir")) {
      // Excluir é irreversível e não há "desfazer": confirma antes.
      if (!confirm("Excluir este post? Não dá pra desfazer.")) return;
      removerSalvo(art.dataset.id);
      art.remove();
    }
  });

  /* ================= Formulário ================= */
  const podePublicar = () =>
    campo.value.trim().length > 0 && nomeIn.value.trim().length > 0;

  const atualizarBotao = () => { botao.disabled = !podePublicar(); };

  function ajustarAltura() {
    campo.style.height = "auto";
    campo.style.height = campo.scrollHeight + "px";
  }

  function publicar() {
    if (!podePublicar()) return;

    const p = {
      id: novoId(),
      nome: nomeIn.value.trim(),
      texto: campo.value.trim(),
      tag,
      link: linkIn ? linkIn.value.trim() : "",
      quando: quandoAgora(),
      meu: true,
    };

    feed.prepend(criarPost(p));

    const lista = lerSalvos();
    lista.unshift(p);
    salvar(lista.slice(0, 50));

    try { localStorage.setItem(CHAVE_NOME, p.nome); } catch {}

    // Limpa tudo menos o nome: ninguém deve redigitar quem é a cada post.
    campo.value = "";
    if (linkIn) linkIn.value = "";
    if (linkBox) linkBox.hidden = true;
    if (chipLink) chipLink.dataset.ativo = "0";
    tag = "";
    chips.forEach((c) => (c.dataset.ativo = "0"));

    ajustarAltura();
    atualizarBotao();
  }

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

  campo.addEventListener("input", () => { ajustarAltura(); atualizarBotao(); });
  nomeIn.addEventListener("input", () => {
    atualizarBotao();
    if (meuAvatar) meuAvatar.textContent = iniciais(nomeIn.value);
  });
  botao.addEventListener("click", publicar);

  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); publicar(); }
  });

  /* ================= Restaura o que já existia ================= */
  try {
    const salvo = localStorage.getItem(CHAVE_NOME);
    if (salvo) {
      nomeIn.value = salvo;
      if (meuAvatar) meuAvatar.textContent = iniciais(salvo);
    }
  } catch {}

  /* Posts antigos (gravados antes de existir id) não teriam como ser
     editados nem excluídos. Em vez de deixá-los presos pra sempre,
     dou um id a eles na primeira carga. */
  const salvos = lerSalvos();
  let precisaRegravar = false;
  salvos.forEach((p) => {
    if (!p.id) { p.id = novoId(); p.meu = true; precisaRegravar = true; }
  });
  if (precisaRegravar) salvar(salvos);

  salvos.slice().reverse().forEach((p) => feed.prepend(criarPost(p)));

  atualizarBotao();
})();
