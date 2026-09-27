import { describe, it, expect } from 'vitest';
import { imageSignatureType, isValidSignature } from './magicBytes.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const gif = Buffer.from('GIF89a......', 'latin1');
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WAVEfmt ')]);
const pdf = Buffer.from('%PDF-1.7\n%âãÏÓ', 'latin1');

describe('document signatures (region coding uploads)', () => {
  it('recognises each raster type by its bytes', () => {
    expect(imageSignatureType(png)).toBe('image/png');
    expect(imageSignatureType(jpeg)).toBe('image/jpeg');
    expect(imageSignatureType(gif)).toBe('image/gif');
    expect(imageSignatureType(webp)).toBe('image/webp');
  });

  it('does not mistake a RIFF WAVE recording for a WebP image', () => {
    expect(imageSignatureType(wav)).toBeNull();
    expect(isValidSignature(wav, 'audio')).toBe(true);
  });

  it('refuses SVG and HTML dressed as images', () => {
    expect(imageSignatureType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(isValidSignature(Buffer.from('<html><script>1</script>'), 'image')).toBe(false);
  });

  it('recognises PDF only by its %PDF- header', () => {
    expect(isValidSignature(pdf, 'pdf')).toBe(true);
    expect(isValidSignature(Buffer.from('PDF-1.7 not really'), 'pdf')).toBe(false);
    expect(isValidSignature(png, 'pdf')).toBe(false);
  });
});
