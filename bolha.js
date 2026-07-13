/* ==========================================================
   Bolha iridescente — fundo da página de login.

   WebGL puro, sem biblioteca. Um shader desenha a cena pixel a
   pixel: uma esfera deformada por ruído, com as cores nascendo
   de INTERFERÊNCIA DE PELÍCULA FINA — o mesmo fenômeno que faz a
   bolha de sabão e a mancha de óleo ficarem arco-íris. A cor num
   ponto depende da espessura da película e do ângulo de visão,
   e é por isso que ela escorre quando a bolha gira.

   Se o WebGL não estiver disponível, o canvas some e fica só o
   degradê do CSS. A página nunca quebra por causa do fundo.
   ========================================================== */

(function () {
  const canvas = document.getElementById("bolha");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
  if (!gl) { canvas.style.display = "none"; return; }

  /* ---------------- Shaders ---------------- */
  const VERT = `
    attribute vec2 posicao;
    void main() { gl_Position = vec4(posicao, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;

    uniform vec2  u_tela;
    uniform float u_tempo;
    uniform vec2  u_mouse;   // -1 .. 1

    /* ---------- Ruído (value noise + fbm) ----------
       Serve pra amassar a esfera. Sem isso ela seria uma bola
       perfeita — e bolha de sabão real nunca é. */
    vec3 hash3(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
               dot(p, vec3(269.5, 183.3, 246.1)),
               dot(p, vec3(113.5, 271.9, 124.6)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    float ruido(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);   // suaviza as junções
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
      for (int i = 0; i < 4; i++) {
        v += a * ruido(p);
        p *= 2.02;
        a *= 0.5;
      }
      return v;
    }

    /* ---------- A bolha ----------
       Esfera cuja superfície é empurrada pra dentro e pra fora
       pelo ruído. O tempo entra no ruído, então ela respira. */
    float mapa(vec3 p) {
      float amasso = fbm(p * 1.35 + vec3(0.0, 0.0, u_tempo * 0.12));
      return length(p) - 1.0 - amasso * 0.22;
    }

    vec3 normal(vec3 p) {
      vec2 e = vec2(0.002, 0.0);
      return normalize(vec3(
        mapa(p + e.xyy) - mapa(p - e.xyy),
        mapa(p + e.yxy) - mapa(p - e.yxy),
        mapa(p + e.yyx) - mapa(p - e.yyx)
      ));
    }

    /* ---------- Iridescência ----------
       Paleta cossenoidal: as três componentes de cor oscilam
       defasadas, então varrer o valor de t percorre o espectro
       inteiro. É o que produz o arco-íris da película. */
    vec3 espectro(float t) {
      return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67)));
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_tela) / min(u_tela.x, u_tela.y);

      /* ----- Fundo: degradê claro, como no print ----- */
      float grad = uv.y * 0.5 + 0.5;
      vec3 corFundo = mix(vec3(0.96, 0.92, 0.87), vec3(0.85, 0.88, 0.93), grad);

      /* ----- Câmera ----- */
      vec3 ro = vec3(0.0, 0.0, 3.2);
      vec3 rd = normalize(vec3(uv, -1.6));

      /* O cursor gira a bolha. Suavizado no JS, então o giro
         chega aqui já sem tranco. */
      float ax = u_mouse.y * 0.55;
      float ay = u_mouse.x * 0.75 + u_tempo * 0.07;

      mat3 rotY = mat3(cos(ay), 0.0, -sin(ay),
                       0.0,     1.0,  0.0,
                       sin(ay), 0.0,  cos(ay));
      mat3 rotX = mat3(1.0, 0.0,      0.0,
                       0.0, cos(ax), -sin(ax),
                       0.0, sin(ax),  cos(ax));
      mat3 rot = rotY * rotX;

      vec3 roR = rot * ro;
      vec3 rdR = rot * rd;

      /* ----- Raymarch ----- */
      float t = 0.0;
      bool bateu = false;
      for (int i = 0; i < 72; i++) {
        vec3 p = roR + rdR * t;
        float d = mapa(p);
        if (d < 0.0015) { bateu = true; break; }
        if (t > 6.0) break;
        t += d * 0.85;
      }

      vec3 cor = corFundo;

      if (bateu) {
        vec3 p = roR + rdR * t;
        vec3 n = normal(p);
        vec3 v = normalize(-rdR);

        /* Fresnel: a borda da bolha reflete muito mais que o
           centro. É o que cria o anel de cor forte no contorno e
           deixa o miolo claro e lavado, como no print. */
        float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);

        /* Espessura da película: varia com o ângulo e com o
           ruído. Cada espessura reforça um comprimento de onda
           diferente — e é daí que vem a cor. */
        float espessura = 0.55
          + 0.42 * fbm(p * 2.1 + vec3(u_tempo * 0.10))
          + 0.34 * (1.0 - abs(dot(n, v)));

        vec3 iris = espectro(espessura * 1.35 + u_tempo * 0.02);

        /* O miolo é claro e quente; a cor sobe pras bordas. */
        vec3 nucleo = mix(vec3(1.0, 0.98, 0.94), vec3(0.98, 0.90, 0.74), 0.4);
        vec3 corpo = mix(nucleo, iris, smoothstep(0.06, 0.75, fres));

        /* Brilho especular: o risco de luz no alto da bolha. */
        vec3 luz = normalize(vec3(-0.45, 0.9, 0.6));
        float esp = pow(max(dot(reflect(-luz, n), v), 0.0), 48.0);

        corpo += vec3(esp) * 0.85;

        /* Vidro: deixa o fundo transparecer no meio. */
        float opacidade = smoothstep(0.0, 0.55, fres * 1.5 + 0.42);
        cor = mix(corFundo, corpo, clamp(opacidade, 0.0, 1.0));
      }

      /* Vinheta suave, pra atenção cair no cartão de login. */
      cor *= 1.0 - 0.18 * dot(uv, uv);

      gl_FragColor = vec4(cor, 1.0);
    }
  `;

  /* ---------------- Compilação ---------------- */
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

  // Um retângulo cobrindo a tela: o shader faz todo o resto.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "posicao");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uTela  = gl.getUniformLocation(prog, "u_tela");
  const uTempo = gl.getUniformLocation(prog, "u_tempo");
  const uMouse = gl.getUniformLocation(prog, "u_mouse");

  /* ---------------- Tamanho ---------------- */
  /* Limito o DPR a 1.5: este shader faz raymarch por pixel, e num
     monitor retina em tela cheia isso quadruplicaria o custo sem
     ganho visual perceptível numa imagem tão difusa. */
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
  }

  /* ---------------- Cursor ---------------- */
  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let alvoX = 0, alvoY = 0;
  let mx = 0, my = 0;

  if (!reduzir) {
    window.addEventListener("pointermove", (e) => {
      alvoX = (e.clientX / window.innerWidth) * 2 - 1;
      alvoY = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
  }

  /* ---------------- Loop ---------------- */
  const inicio = performance.now();

  function quadro(agora) {
    // Persegue o cursor com inércia: a bolha é um corpo mole, não
    // um espelho grudado no mouse.
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
