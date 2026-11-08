// Função do Vercel: devolve o áudio (MP3) de um capítulo, gerado pela Fish Audio.
// Uso no site: /api/narrar?cap=0 ... /api/narrar?cap=7
// A chave fica na variável de ambiente FISH_API_KEY do Vercel (nunca no código nem no GitHub).
// Só aceita o número do capítulo; o texto vem de _textos.json. O resultado fica em cache no Vercel por 1 ano,
// então cada capítulo costuma ser gerado uma única vez.
const TEXTOS = require("./_textos.json");

// Voz usada em todos os capítulos: Ivan Lima (ID do modelo, o final da URL da voz em fish.audio).
const VOZ_PADRAO = "3171384a600d4688932f860ecefd5cc4";
// Se quiser uma voz diferente para algum personagem, cole o ID dele aqui. Em branco = usa a VOZ_PADRAO.
const VOZES = {
  "Cronista do Reino": "",
  "Mestra Aurora": "",
  "Arquiteto Vale": "",
  "Escriba Sheets": "",
  "Guardião do Portal": "",
  "Mestre de Obras": "",
  "Auditor Real": ""
};
const MODELO = "s2.1-pro"; // o s1 será desativado em 31/12/2026
const API = "https://api.fish.audio/v1/tts";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.FISH_API_KEY;
  if (!key) return res.status(500).json({ erro: "FISH_API_KEY não configurada no Vercel" });
  const cap = Number(req.query.cap);
  if (!Number.isInteger(cap) || cap < 0 || cap >= TEXTOS.length) return res.status(400).json({ erro: "capítulo inválido" });
  try {
    const corpo = {
      text: TEXTOS[cap].t,
      format: "mp3",
      mp3_bitrate: 128,
      latency: "normal",
      normalize: true
    };
    corpo.reference_id = VOZES[TEXTOS[cap].w] || VOZ_PADRAO;
    const r = await fetch(API, {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json", "model": MODELO },
      body: JSON.stringify(corpo)
    });
    if (!r.ok) { console.error("Fish Audio", r.status, await r.text()); return res.status(502).json({ erro: "Fish Audio respondeu " + r.status }); }
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000");
    res.status(200).send(audio);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "falha ao gerar a narração" });
  }
};
