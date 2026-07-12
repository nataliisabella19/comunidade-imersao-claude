/* ==========================================================
   Mural — compositor de posts

   ATENÇÃO (importante): o site é estático, sem servidor.
   Os posts são gravados no localStorage, ou seja, ficam SÓ no
   navegador de quem escreveu. Ninguém mais enxerga. É uma
   demonstração de interface, não uma comunidade funcionando.
   Pra virar um mural de verdade, precisa de um backend.

   ========================================================== */

/* ---------------- Carrossel 3D (coverflow) ---------------- */
(function () {
  const trilho = document.getElementById("trilho");
  if (!trilho) return;

  const cards = Array.from(trilho.children);
  const n = cards.length;
  if (!n) return;

  const VISIVEIS = 2;              // quantos cards aparecem de cada lado
  let ativo = Math.floor(n / 2);   // começa com um card do meio em foco

  /* Distância circular até o card ativo, COM SINAL.
     Ex.: com 6 cards e o ativo = 0, o card 5 tem distância -1
     (ele está logo à esquerda), não +5. É isso que faz o
     carrossel dar a volta em vez de bater na ponta. */
  function distancia(i) {
    let d = (((i - ativo) % n) + n) % n;   // 0 .. n-1
    if (d > n / 2) d -= n;                 // -n/2 .. n/2
    return d;
  }

  function render() {
    cards.forEach((card, i) => {
      const d = distancia(i);
      // O CSS resolve toda a geometria a partir de --pos.
      card.style.setProperty("--pos", d);
      card.dataset.ativo = d === 0 ? "1" : "0";
      card.dataset.longe = Math.abs(d) > VISIVEIS ? "1" : "0";
      // Card de trás não deve ser alcançável pelo Tab
      card.setAttribute("aria-hidden", d === 0 ? "false" : "true");
    });
  }

  function irPara(i) {
    ativo = ((i % n) + n) % n;
    render();
  }

  cards.forEach((card, i) => {
    card.addEventListener("click", () => {
      // Clicar num card lateral traz ele pro centro. Clicar no
      // card do centro é que deve abrir o conteúdo (quando houver
      // link) — por isso o centro não re-renderiza aqui.
      if (distancia(i) !== 0) irPara(i);
    });
  });

  // Setas do teclado navegam o carrossel
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") irPara(ativo + 1);
    else if (e.key === "ArrowLeft") irPara(ativo - 1);
  });

  render();
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
