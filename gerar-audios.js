// Gera a narração de cada capítulo com a ElevenLabs e salva em audio/cap0.mp3, cap1.mp3...
// Rode no seu computador (precisa do Node 18 ou mais novo). A chave NUNCA vai para o site.
//
//   PowerShell:  $env:ELEVENLABS_API_KEY="sua_chave"
//   Terminal:    node gerar-audios.js --vozes      (lista as vozes da sua conta)
//                node gerar-audios.js --teste      (mostra os textos e a contagem de caracteres, sem gastar nada)
//                node gerar-audios.js --json       (atualiza api/_textos.json, usado pela função do Vercel)
//                node gerar-audios.js              (gera os capítulos que ainda não têm áudio)
//                node gerar-audios.js --refazer 3  (gera de novo só o capítulo 3; use "todos" para refazer tudo)
const fs = require("fs"), vm = require("vm"), path = require("path");

// Voz de cada personagem: cole aqui o ID da voz (veja com --vozes). Deixe "" para o script escolher uma voz da sua conta.
const VOZES = {
  "Cronista do Reino": "",
  "Mestra Aurora": "",
  "Arquiteto Vale": "",
  "Escriba Sheets": "",
  "Guardião do Portal": "",
  "Mestre de Obras": "",
  "Auditor Real": ""
};
const MODELO = "eleven_multilingual_v2";
const AJUSTES = { stability: 0.5, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true };

// Como ler em voz alta o que o texto escreve de um jeito técnico (só afeta o áudio; o texto da tela não muda)
const FALA = [
  [/Codigo\.gs/g, "Código ponto G S"], [/index\.html/g, "index ponto html"],
  [/act_123456789/g, "a c t, sublinhado, um dois três quatro cinco seis sete oito nove"],
  [/atualizarDadosMeta\(\)/g, "atualizar dados meta"], [/criarGatilhoDiario\(\)/g, "criar gatilho diário"],
  [/descobrirAcoes\(\)/g, "descobrir ações"], [/Debug_Acoes/g, "Debug ações"], [/Meta_Ads/g, "Meta Ads"],
  [/META_[A-Z_]+/g, m => m.replace(/_/g, " ").toLowerCase()], [/URL_FIXA/g, "U R L fixa"],
  [/\/exec/g, "barra exec"], [/ads_read/g, "ads read"], [/\bCSV\b/g, "C S V"], [/\bID\b/g, "I D"],
  [/\bURL\b/g, "U R L"], [/\bAPI\b/g, "A P I"], [/\bapp\b/gi, "aplicativo"], [/(\d+)h\b/g, "$1 horas"]
];
const falar = t => FALA.reduce((s, [r, v]) => s.replace(r, v), t);

const args = process.argv.slice(2), dir = __dirname;
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const m = html.match(/const C=(\[[\s\S]*?\n\s*\]);\s*\n\s*const bar=/);
if (!m) { console.error("Não achei a lista de capítulos no index.html."); process.exit(1); }
const C = vm.runInNewContext(m[1]);
const textos = C.map(c => typeof c.x === "function" ? c.x() : c.x);

if (args.includes("--teste")) {
  let tot = 0;
  C.forEach((c, i) => { const f = falar(textos[i]); tot += f.length; console.log(`\n[cap${i}] ${c.w} — ${f.length} caracteres\n${f}`); });
  console.log(`\nTotal: ${tot} caracteres (é isso que conta no seu plano da ElevenLabs).`); process.exit(0);
}

if (args.includes("--json")) { // gera api/_textos.json para a função do Vercel (api/narrar.js); rode de novo se mudar o texto dos capítulos
  fs.mkdirSync(path.join(dir, "api"), { recursive: true });
  fs.writeFileSync(path.join(dir, "api", "_textos.json"), JSON.stringify(C.map((c, i) => ({ w: c.w, t: falar(textos[i]) })), null, 1));
  console.log("api/_textos.json atualizado."); process.exit(0);
}

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Defina a chave primeiro. No PowerShell: $env:ELEVENLABS_API_KEY="sua_chave"'); process.exit(1); }
const API = "https://api.elevenlabs.io/v1";
const H = { "xi-api-key": KEY };

(async () => {
  const rv = await fetch(API + "/voices", { headers: H });
  if (!rv.ok) { console.error("Falha ao ler as vozes:", rv.status, await rv.text()); process.exit(1); }
  const vozes = (await rv.json()).voices || [];
  if (args.includes("--vozes")) { vozes.forEach(v => console.log(v.voice_id, "-", v.name, v.labels ? JSON.stringify(v.labels) : "")); return; }
  if (!vozes.length) { console.error("Sua conta não tem vozes disponíveis."); process.exit(1); }

  // escolhe uma voz para cada personagem que ficou em branco
  const escolha = {}; let k = 0;
  for (const c of C) if (!(c.w in escolha)) escolha[c.w] = VOZES[c.w] || vozes[k++ % vozes.length].voice_id;
  console.log("Vozes:"); for (const w in escolha) console.log(" ", w, "->", escolha[w], (vozes.find(v => v.voice_id === escolha[w]) || {}).name || "");

  const ia = args.indexOf("--refazer"), alvo = ia >= 0 ? args[ia + 1] : null;
  fs.mkdirSync(path.join(dir, "audio"), { recursive: true });
  for (let i = 0; i < C.length; i++) {
    const out = path.join(dir, "audio", `cap${i}.mp3`);
    const refazer = alvo === "todos" || alvo === String(i);
    if (fs.existsSync(out) && !refazer) { console.log(`cap${i}: já existe, pulando`); continue; }
    const r = await fetch(`${API}/text-to-speech/${escolha[C[i].w]}?output_format=mp3_44100_128`, {
      method: "POST", headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ text: falar(textos[i]), model_id: MODELO, voice_settings: AJUSTES })
    });
    if (!r.ok) { console.error(`cap${i}: erro ${r.status}`, await r.text()); process.exit(1); }
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    console.log(`cap${i}: ok (${C[i].w})`);
  }
  console.log("Pronto. Suba a pasta audio/ junto com o index.html.");
})();
