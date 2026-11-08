// Função do Vercel: devolve o áudio (MP3) de um capítulo, gerado pela Fish Audio.
// Uso no site: /api/narrar?cap=0 ... /api/narrar?cap=7
// A chave fica na variável de ambiente FISH_API_KEY do Vercel (nunca no código nem no GitHub).
// Só aceita o número do capítulo; o texto vem de _textos.json. O resultado fica em cache no Vercel por 1 ano,
// então cada capítulo costuma ser gerado uma única vez.
const TEXTOS = require("./_textos.json");

// Voz padrão: Ivan Lima (ID do modelo, o final da URL da voz em fish.audio).
const VOZ_PADRAO = "885cb960c75b4dcd8b892518ad7b4c5e";

// Uma voz para cada capítulo, na ordem do site (cap=0 é o capítulo 1, cap=7 é o capítulo 8).
// Em branco = usa a VOZ_PADRAO (Ivan).
const VOZES_CAP = [
  "",                                  // capítulo 1 (cap=0): Ivan
  "2b0c8f3e0844496c8ce51938a70b193e",  // capítulo 2 (cap=1)
  "03e6eaa7aeb149a1a8d13c166a5d947e",  // capítulo 3 (cap=2)
  "dece2a4c7f8d476b8da3c3a6707298d4",  // capítulo 4 (cap=3)
  "102bccca7dc64b6b8f8494c199c5d153",  // capítulo 5 (cap=4)
  "4b215a58407c4def88e0892def6421b2",  // capítulo 6 (cap=5)
  "d339e19362fc42dc8e3f4a6be653ff83",  // capítulo 7 (cap=6)
  "c1783e806b19495ea2db85ea2847ba01"   // capítulo 8 (cap=7)
];

const MODELO = "s2.1-pro-free"; // modelo gratuito; com crédito na conta, troque por "s2.1-pro" (o s1 será desativado em 31/12/2026)
const VELOCIDADE = 0.9; // 1 = normal; 0.5 a 2. Mais baixo = fala mais devagar
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
      normalize: true,
      prosody: { speed: VELOCIDADE }
    };
    corpo.reference_id = VOZES_CAP[cap] || VOZ_PADRAO;
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
