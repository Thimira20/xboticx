// Letter upload pipeline (PLAN E8): PDF only by default; image path (with compression) only if upload.allowImages.
import { cfg } from '../util.js';

const mb = n => (n / 1048576).toFixed(1);
export const fileSize = n => (n >= 1048576 ? mb(n) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
export const accept = () => (cfg.upload.allowImages ? 'application/pdf,.pdf,image/jpeg,image/png' : 'application/pdf,.pdf');

// Some Android pickers send an empty MIME type, so the real check is the file's magic bytes.
async function kind(file) {
  const b = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'img';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'img';
  return null;
}

async function compress(file, max) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, cfg.upload.imageMaxPx / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const toBlob = q => new Promise(r => c.toBlob(r, 'image/jpeg', q));
  let blob = await toBlob(cfg.upload.imageQuality);
  if (blob.size > max) blob = await toBlob(0.65);
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

// → { file } or { error }
export async function prepareFile(file) {
  const max = cfg.upload.maxMB * 1048576, k = await kind(file);
  if (k !== 'pdf' && !(k === 'img' && cfg.upload.allowImages)) return { error: cfg.upload.allowImages ? 'Please upload a PDF, JPG or PNG file.' : 'Please upload a PDF file.' };
  let out = file;
  if (k === 'img') { try { out = await compress(file, max); } catch { return { error: 'Could not read that image. Please try another file.' }; } }
  if (out.size > max) return { error: `Your ${k === 'pdf' ? 'PDF' : 'file'} is ${mb(out.size)} MB. Max is ${cfg.upload.maxMB} MB. ${k === 'pdf' ? 'Try scanning in black & white or at lower quality.' : 'Try a smaller photo.'}` };
  return { file: out };
}

// Base64 without the "data:...;base64," prefix.
export const toBase64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(file);
});
