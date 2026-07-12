/* ==========================================================
   Mural — compositor de posts

   ATENÇÃO (importante): o site é estático, sem servidor.
   Os posts são gravados no localStorage, ou seja, ficam SÓ no
   navegador de quem escreveu. Ninguém mais enxerga. É uma
   demonstração de interface, não uma comunidade funcionando.
   Pra virar um mural de verdade, precisa de um backend.

   ========================================================== */

/* ---------------- Carrossel 3D guiado pelo cursor ----------------
   O "centro" do carrossel é um número CONTÍNUO, não um índice.
   Quando ele vale 2.4, o carrossel está parado entre o card 2 e o
   card 3 — e é isso que permite os cards girarem suavemente junto
   com o cursor, em vez de saltarem de um pra outro.
   ---------------------------------------------------------------- */
(function () {
  const trilho = document.getElementById("trilho");
  if (!trilho) return;

  const palco = trilho.parentElement || trilho;   // área que capta o cursor
  const cards = Array.from(trilho.children);
  const n = cards.length;
  if (!n) return;

  const VISIVEIS = 2;      // quantos cards aparecem de cada lado
  const ALCANCE = n * 0.5; // quantos cards uma varrida da tela percorre
  const EASING = 0.085;    // 0 = não segue; 1 = gruda no cursor

  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let alvo = Math.floor(n / 2);   // pra onde o cursor quer levar
  let atual = alvo;               // onde de fato está (persegue o alvo)

  /* Distância circular até o centro, COM SINAL e fracionária.
     Ex.: com 6 cards e centro = 0, o card 5 fica a -1 (logo à
     esquerda), não a +5. É isso que faz o carrossel dar a volta
     em vez de bater na ponta. */
  function distancia(i) {
    let d = (((i - atual) % n) + n) % n;   // 0 .. n-1
    if (d > n / 2) d -= n;                 // -n/2 .. n/2
    return d;
  }

  function render() {
    cards.forEach((card, i) => {
      const d = distancia(i);
      const dist = Math.abs(d);

      // O CSS resolve toda a geometria a partir de --pos.
      card.style.setProperty("--pos", d.toFixed(3));

      // "Ativo" é quem está mais perto do centro — com centro
      // fracionário, ninguém fica exatamente em zero.
      const ehCentro = dist < 0.5;
      card.dataset.ativo = ehCentro ? "1" : "0";
      card.dataset.longe = dist > VISIVEIS + 0.5 ? "1" : "0";
      card.setAttribute("aria-hidden", ehCentro ? "false" : "true");
    });
  }

  /* ---------- Loop de animação ----------
     `alvo` é sempre a única fonte da verdade. Quem muda o alvo é o
     cursor, o clique ou o teclado — o loop só persegue. */
  function tique() {
    atual += (alvo - atual) * EASING;

    // Trava ao chegar perto, senão o resto decimal faz o loop
    // recalcular pra sempre sem nada mudar na tela.
    if (Math.abs(alvo - atual) < 0.001) atual = alvo;

    render();
    requestAnimationFrame(tique);
  }

  /* ---------- O cursor comanda ---------- */
  palco.addEventListener("pointermove", (e) => {
    if (reduzir) return;
    const r = palco.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;   // -0.5 (esq) .. +0.5 (dir)
    alvo = Math.floor(n / 2) + nx * 2 * ALCANCE;
  }, { passive: true });

  // Cursor saiu: encaixa no card mais próximo, em vez de largar o
  // carrossel congelado num meio-termo torto entre dois cards.
  palco.addEventListener("pointerleave", () => {
    alvo = Math.round(atual);
  }, { passive: true });

  /* Clicar num card lateral traz ele pro centro — é o caminho do
     celular, onde não existe cursor pairando. */
  cards.forEach((card, i) => {
    card.addEventListener("click", () => {
      if (Math.abs(distancia(i)) < 0.5) return;  // o do centro abre o conteúdo
      alvo = atual + distancia(i);
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    alvo = Math.round(atual) + (e.key === "ArrowRight" ? 1 : -1);
  });

  render();
  if (!reduzir) requestAnimationFrame(tique);
})();

/* ---------------- Mural ---------------- */
(function () {
  const campo = document.getElementById("campo-post");
  const botao = document.getElementById("btn-publicar");
  const feed = document.getElementById("feed");
  if (!campo || !botao || !feed) return;

  const CHAVE = "mural-imersao-claude";

  /* O textarea cresce junto com o texto, em vez de virar uma
     caixinha com barra de rolagem interna. */
  function ajustarAltura() {
    campo.style.height = "auto";
    campo.style.height = campo.scrollHeight + "px";
  }

  function podePublicar() {
    return campo.value.trim().length > 0;
  }

  function atualizarBotao() {
    botao.disabled = !podePublicar();
  }

  /* Monta o card do post via DOM, nunca via innerHTML.
     Se alguém digitar "<script>", tem que aparecer como texto
     literal na tela — e não ser executado pelo navegador. */
  function criarPost(texto, quando) {
    const art = document.createElement("article");
    art.className = "post liquid-glass";

    const av = document.createElement("span");
    av.className = "avatar";
    av.textContent = "VC";

    const corpo = document.createElement("div");
    corpo.className = "post-corpo";

    const topo = document.createElement("div");
    topo.className = "post-topo";

    const nome = document.createElement("strong");
    nome.textContent = "Você";

    const hora = document.createElement("span");
    hora.className = "post-hora";
    hora.textContent = quando;

    topo.append(nome, hora);

    const p = document.createElement("p");
    p.textContent = texto;

    corpo.append(topo, p);
    art.append(av, corpo);
    return art;
  }

  function lerSalvos() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch {
      // localStorage bloqueado (aba anônima, cookies off) ou JSON
      // corrompido: o mural degrada pro modo só-leitura em vez de
      // quebrar a página inteira.
      return [];
    }
  }

  function salvar(lista) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista));
    } catch {
      /* sem espaço ou sem permissão — o post ainda aparece na tela */
    }
  }

  function publicar() {
    if (!podePublicar()) return;

    const texto = campo.value.trim();
    const agora = new Date().toLocaleString("pt-BR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

    feed.prepend(criarPost(texto, agora));

    const lista = lerSalvos();
    lista.unshift({ texto, quando: agora });
    salvar(lista.slice(0, 50));

    campo.value = "";
    ajustarAltura();
    atualizarBotao();
  }

  // Restaura o que a pessoa já tinha escrito antes
  lerSalvos().reverse().forEach((p) => feed.prepend(criarPost(p.texto, p.quando)));

  campo.addEventListener("input", () => { ajustarAltura(); atualizarBotao(); });
  botao.addEventListener("click", publicar);

  // Enter publica; Shift+Enter quebra linha.
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      publicar();
    }
  });

  atualizarBotao();
})();
