# 🏭 Fábrica de Palavras

Jogo web de **alfabetização e letramento**: o aluno organiza uma linha de produção de palavras e frases, arrastando sílabas, palavras e letras para a esteira, que as leva até a montagem final.

Parte da coleção **A.R.S. HTML APPS e GAMES** · Jogos de Alfabetização "Pedagodigitais", de Alan Rezende.

> Esteiras e caixotes inspirados na animação *box flow system*, de masahito (ma5a.com).

---

## ▶ Como jogar

1. Digite seu nome e toque em **Entrar na Fábrica**.
2. Veja a palavra (ou frase) no painel superior.
3. **Arraste** as peças do estoque para a esteira, na ordem certa.
4. No fim da esteira as peças caem e se juntam. O jogo confere:
   - ✔ **Certo:** as peças se unem, o caixote some e vem a próxima palavra.
   - ✖ **Errado:** tudo volta para o estoque para tentar de novo.

Toque no painel para ouvir a palavra.

## 🎮 Modos de jogo

| Modo | Descrição |
|---|---|
| **Campanha** | 5 níveis × 10 fases × 10 palavras (500 palavras). Estrelas por desempenho. |
| **Contra o Tempo das Frases** | Liberado ao concluir as 50 fases. Monte frases com palavras e letras soltas em 30 minutos; vence a maior pontuação. |
| **Com o Prof** | Níveis criados pelo professor na Oficina. Só aparece se houver pelo menos um nível ativo. |

### Níveis da campanha

| Nível | Esteiras | Conteúdo | Inimigos |
|---|---|---|---|
| 1 | 1 | Palavras de 2 sílabas | — |
| 2 | 2 | Palavras de 3 sílabas | — |
| 3 | 2 | Dígrafos, nasais e ditongos | Caixotes vazios |
| 4 | 3 | Encontros consonantais | Caixotes vazios |
| 5 | 4 | Palavras longas | Caixotes vazios |

**Caixotes vazios** caem na esteira de tempos em tempos. Toque neles ou arraste para fora; se chegarem à montagem, a palavra é rejeitada.

## 🎓 Oficina do Professor

Na tela inicial, no rodapé, toque em **Com o Prof** e informe a senha de acesso (`prof123`).

Na Oficina é possível criar:

- **Níveis** com nome, dificuldade, número de esteiras (1 a 4), velocidade, caixotes vazios e regras para os alunos.
- **Fases** de três tipos: *sílabas → palavra*, *palavras/letras → frase* e *texto em sequência*.
- **Itens** com emoji ou imagem, peças erradas (distratores), peças extras, tempo limite e máximo de erros.
- **Desafio por fase:** esteiras, inimigos, velocidade e dificuldade próprios, diferentes do nível.
- Reordenar fases **arrastando** (⠿), duplicar, excluir e **testar** antes de liberar.

Para o aluno ver o nível, marque-o como **Ativo**. O conteúdo fica salvo **no aparelho**; para levar a outro aparelho use **Exportar** e **Importar** (arquivo `.json`).

> ⚠ A senha fica no código do jogo: serve para uso em sala de aula, não como segurança.

## ⚙ Configurações

Botão ⚙ no topo: tela cheia (liga/desliga), som (liga/desliga), salvar e sair, apagar dados.
O botão "Apagar dados" não remove os níveis do professor.

## 🧩 Características técnicas

- HTML, CSS e JavaScript puros, sem dependências nem etapa de build.
- **PWA:** instalável no celular e funciona offline após o primeiro acesso.
- Funciona em paisagem e retrato (computador, tablet e celular), com toque e mouse.
- Progresso, ranking e níveis do professor ficam no `localStorage` do aparelho (chaves `fabricaPalavrasARS.v1` e `fabricaPalavrasARS.prof.v1`). O ranking é local, não compartilhado entre aparelhos.
- Sons sintetizados (Web Audio) e voz do navegador em português do Brasil.

## 📁 Arquivos

```
index.html            estrutura das telas
style.css             estilos (fontes e sprites embutidos)
game.js               motor do jogo, oficina e telas
words.js              500 palavras, emojis e frases
manifest.webmanifest  configuração do PWA
sw.js                 service worker (offline)
icon*.png / .svg      ícones
```
## 📄 Créditos

- Jogo e conteúdo pedagógico: **Alan Rezende da Silva** (A.R.S.)
- Animação original de esteiras e caixotes: *box flow system* — masahito / ma5a.com
- Fontes: Fredoka e Press Start 2P (SIL Open Font License)
