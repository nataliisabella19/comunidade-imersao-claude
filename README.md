# Comunidade Imersão Claude

Site da nossa comunidade. É um site estático (HTML + CSS), hospedado de graça no GitHub Pages.

## Arquivos

| Arquivo | Pra que serve |
|---|---|
| `index.html` | Todo o conteúdo do site: textos, agenda, materiais |
| `styles.css` | Toda a aparência: cores, espaçamentos, layout |

## Como editar

**Mudar as cores:** abra `styles.css` e mexa no bloco `:root` lá no topo. Todo o site usa aquelas variáveis, então trocar uma cor ali muda o site inteiro.

**Adicionar um encontro na agenda:** abra `index.html`, ache a seção `<!-- AGENDA -->`, copie um bloco `<li class="evento">` inteiro e troque a data, o título e a descrição.

**Adicionar um material:** mesma ideia — ache a seção `<!-- MATERIAIS -->` e copie um bloco `<a class="material">`. Troque o `href="#"` pelo link real.

## Como ver as mudanças antes de publicar

Dê dois cliques no `index.html` — ele abre no navegador direto do seu computador.

## Como publicar as mudanças

```bash
cd ~/comunidade-claude
git add .
git commit -m "Atualiza agenda"
git push
```

O GitHub Pages republica sozinho em ~1 minuto.
