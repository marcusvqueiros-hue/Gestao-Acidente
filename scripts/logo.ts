import sharp from "sharp";

const src = "public/logo-cgb.png";
const W = 720; // 2x–3x do maior tamanho exibido, reduzido com Lanczos para bordas suaves

const base = sharp(src).ensureAlpha().resize({ width: W, kernel: "lanczos3" });
await base.clone().png({ compressionLevel: 9 }).toFile("public/logo-cgb-claro.png");

// versão para o tema escuro: o texto cinza vira cinza-claro; o losango vinho é mantido
const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
const out = Buffer.from(data);
for (let i = 0; i < out.length; i += 4) {
  const [r, g, b] = [out[i], out[i + 1], out[i + 2]];
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (out[i + 3] > 0 && sat < 28) {
    out[i] = 0xf1; out[i + 1] = 0xee; out[i + 2] = 0xf2;
  } else if (out[i + 3] > 0) {
    // realça levemente o vinho para ter contraste sobre fundo escuro
    out[i] = Math.min(255, Math.round(r * 1.18 + 14)); out[i + 1] = Math.min(255, Math.round(g * 1.1 + 6)); out[i + 2] = Math.min(255, Math.round(b * 1.12 + 10));
  }
}
await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile("public/logo-cgb-escuro.png");
console.log("ok", info.width, info.height);
