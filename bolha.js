/* ==========================================================
   Blob azul — fundo da página de login.

   WebGL puro, sem biblioteca. Um shader raymarcha uma esfera
   amassada por ruído e a veste com um material azul polido:
   brilho especular forte, vincos escuros nas dobras e uma luz
   de contorno. Fundo branco.

   Sem WebGL, o canvas some e sobra o branco do CSS. A porta de
   entrada da comunidade nunca abre quebrada.
   ========================================================== */

(function () {
  const canvas = document.getElementById("bolha");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
  if (!gl) { canvas.style.display = "none"; return; }

  const VERT = `
    attribute vec2 posicao;
    void main() { gl_Position = vec4(posicao, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;

    uniform vec2  u_tela;
    uniform float u_tempo;
    uniform vec2  u_mouse;    // -1 .. 1
    uniform float u_centro;   // deslocamento horizontal do blob

    /* ---------- Ruído ---------- */
    vec3 hash3(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
               dot(p, vec3(269.5, 183.3, 246.1)),
               dot(p, vec3(113.5, 271.9, 124.6)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    float ruido(vec3 p) {
      vec3 i = floor(p), f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
            mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
        mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
            mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y),
        u.z);
    }

    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) { v += a * ruido(p); p *= 2.05; a *= 0.5; }
      return v;
    }

    /* Esfera amassada. As dobras vêm daqui: onde o ruído afunda a
       superfície, nasce um vinco — e é o vinco que dá a leitura de
       "líquido", em vez de bola de borracha. */
    float mapa(vec3 p) {
      float d = length(p) - 1.0;
      d -= fbm(p * 1.15 + vec3(0.0, 0.0, u_tempo * 0.16)) * 0.30;
      return d;
    }

    vec3 normal(vec3 p) {
      vec2 e = vec2(0.0025, 0.0);
      return normalize(vec3(
        mapa(p + e.xyy) - mapa(p - e.xyy),
        mapa(p + e.yxy) - mapa(p - e.yxy),
        mapa(p + e.yyx) - mapa(p - e.yyx)
      ));
    }

    /* Oclusão: quanto mais "afundado" o ponto, mais escuro. É o que
       enegrece o fundo das dobras, como no print. */
    float oclusao(vec3 p, vec3 n) {
      float oc = 0.0, sca = 1.0;
      for (int i = 0; i < 4; i++) {
        float h = 0.02 + 0.14 * float(i);
        oc += (h - mapa(p + n * h)) * sca;
        sca *= 0.72;
      }
      return clamp(1.0 - 2.2 * oc, 0.0, 1.0);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_tela) / min(u_tela.x, u_tela.y);
      uv.x -= u_centro;               // empurra o blob pro lado

      vec3 corFundo = vec3(1.0);      // branco, como na referência

      vec3 ro = vec3(0.0, 0.0, 3.1);
      vec3 rd = normalize(vec3(uv, -1.7));

      float ax = u_mouse.y * 0.5;
      float ay = u_mouse.x * 0.7 + u_tempo * 0.09;

      mat3 rotY = mat3(cos(ay), 0.0, -sin(ay),
                       0.0,     1.0,  0.0,
                       sin(ay), 0.0,  cos(ay));
      mat3 rotX = mat3(1.0, 0.0,      0.0,
                       0.0, cos(ax), -sin(ax),
                       0.0, sin(ax),  cos(ax));
      mat3 rot = rotY * rotX;

      vec3 roR = rot * ro;
      vec3 rdR = rot * rd;

      float t = 0.0;
      bool bateu = false;
      for (int i = 0; i < 80; i++) {
        vec3 p = roR + rdR * t;
        float d = mapa(p);
        if (d < 0.0015) { bateu = true; break; }
        if (t > 6.5) break;
        t += d * 0.8;
      }

      vec3 cor = corFundo;

      if (bateu) {
        vec3 p = roR + rdR * t;
        vec3 n = normal(p);
        vec3 v = normalize(-rdR);

        vec3 luz1 = normalize(vec3(-0.5, 0.85, 0.7));   // principal, do alto-esquerda
        vec3 luz2 = normalize(vec3(0.7, -0.3, 0.5));    // preenchimento, de baixo

        /* Azul do print: vivo, saturado, com o fundo das dobras
           quase preto. */
        vec3 azulClaro = vec3(0.40, 0.62, 1.00);
        vec3 azulVivo  = vec3(0.13, 0.42, 0.98);
        vec3 azulFundo = vec3(0.01, 0.05, 0.16);

        float dif = max(dot(n, luz1), 0.0);
        float dif2 = max(dot(n, luz2), 0.0);
        float oc = oclusao(p, n);

        // Base escura -> viva -> clara, conforme a luz bate
        vec3 corpo = mix(azulFundo, azulVivo, smoothstep(0.0, 0.75, dif));
        corpo = mix(corpo, azulClaro, smoothstep(0.55, 1.0, dif) * 0.7);
        corpo += azulVivo * dif2 * 0.18;

        corpo *= mix(0.25, 1.0, oc);   // escurece as dobras

        /* Especular apertado: o ponto de luz duro que faz a
           superfície ler como polida, e não como fosca. */
        float esp = pow(max(dot(reflect(-luz1, n), v), 0.0), 64.0);
        corpo += vec3(1.0) * esp * 0.9;

        // Um segundo brilho, mais largo e suave
        float esp2 = pow(max(dot(reflect(-luz2, n), v), 0.0), 12.0);
        corpo += vec3(0.6, 0.75, 1.0) * esp2 * 0.20;

        /* Fresnel: fio de luz clara contornando a silhueta, que é
           o que solta o blob do fundo branco. */
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.5);
        corpo = mix(corpo, vec3(0.75, 0.86, 1.0), fres * 0.55);

        cor = corpo;

        /* Antisserrilhado na silhueta: sem isso a borda do blob
           fica com degrau de pixel sobre o branco, e salta aos
           olhos. */
        float borda = smoothstep(0.006, 0.0, mapa(p));
        cor = mix(corFundo, cor, borda);
      }

      gl_FragColor = vec4(cor, 1.0);
    }
  `;

  function compilar(tipo, fonte) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fonte);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("Shader falhou:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compilar(gl.VERTEX_SHADER, VERT);
  const fs = compilar(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.style.display = "none"; return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.style.display = "none";
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "posicao");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uTela   = gl.getUniformLocation(prog, "u_tela");
  const uTempo  = gl.getUniformLocation(prog, "u_tempo");
  const uMouse  = gl.getUniformLocation(prog, "u_mouse");
  const uCentro = gl.getUniformLocation(prog, "u_centro");

  /* DPR limitado a 1.5: o shader raymarcha por pixel, e numa tela
     retina inteira isso quadruplicaria o custo sem ganho visível. */
  function redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uTela, w, h);

    /* Desktop: blob à direita, cartão à esquerda (como na
       referência). Tela estreita: blob volta pro centro, senão
       metade dele sairia da tela. */
    const estreito = window.innerWidth < 900;
    gl.uniform1f(uCentro, estreito ? 0.0 : 0.30);
  }

  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let alvoX = 0, alvoY = 0, mx = 0, my = 0;

  if (!reduzir) {
    window.addEventListener("pointermove", (e) => {
      alvoX = (e.clientX / window.innerWidth) * 2 - 1;
      alvoY = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
  }

  const inicio = performance.now();

  function quadro(agora) {
    // Inércia: o blob é massa, não um espelho grudado no cursor.
    mx += (alvoX - mx) * 0.045;
    my += (alvoY - my) * 0.045;

    redimensionar();
    gl.uniform1f(uTempo, reduzir ? 0.0 : (agora - inicio) / 1000);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(quadro);
  }

  requestAnimationFrame(quadro);
})();
