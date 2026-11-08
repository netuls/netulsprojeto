// Função do Vercel: devolve o áudio (MP3) de um capítulo, gerado pela ElevenLabs.
// Uso no site: /api/narrar?cap=0 ... /api/narrar?cap=7
// A chave fica na variável de ambiente ELEVENLABS_API_KEY do Vercel (nunca no código nem no GitHub).
// Só aceita o número do capítulo; o texto vem de _textos.json. O resultado fica em cache no Vercel por 1 ano,
// então cada capítulo costuma ser gerado uma única vez.
const TEXTOS = require("./_textos.json");

// Voz de cada personagem: cole o ID da voz (veja em elevenlabs.io, "My Voices"). Em branco = usa uma voz da sua conta.
// Dica: preencha todos, assim as vozes nunca mudam entre uma geração e outra.
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
const API = "https://api.elevenlabs.io/v1";
let vozesConta = null;

async function escolherVoz(key, nome) {
  if (VOZES[nome]) return VOZES[nome];
  if (!vozesConta) {
    const r = await fetch(API + "/voices", { headers: { "xi-api-key": key } });
    if (!r.ok) throw new Error("não consegui listar as vozes: " + r.status);
    vozesConta = (await r.json()).voices || [];
  }
  if (!vozesConta.length) throw new Error("a conta não tem vozes");
  const nomes = [...new Set(TEXTOS.map(c => c.w))];
  return vozesConta[nomes.indexOf(nome) % vozesConta.length].voice_id;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(500).json({ erro: "ELEVENLABS_API_KEY não configurada no Vercel" });
  const cap = Number(req.query.cap);
  if (!Number.isInteger(cap) || cap < 0 || cap >= TEXTOS.length) return res.status(400).json({ erro: "capítulo inválido" });
  try {
    const voz = await escolherVoz(key, TEXTOS[cap].w);
    const r = await fetch(`${API}/text-to-speech/${voz}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: TEXTOS[cap].t, model_id: MODELO, voice_settings: AJUSTES })
    });
    if (!r.ok) { console.error("ElevenLabs", r.status, await r.text()); return res.status(502).json({ erro: "ElevenLabs respondeu " + r.status }); }
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000");
    res.status(200).send(audio);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "falha ao gerar a narração" });
  }
};
