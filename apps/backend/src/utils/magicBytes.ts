// Magic-byte sniffing for uploads. Extension/MIME alone are attacker-controlled
// so we verify content signatures on the buffer before trusting the file.

export type UploadKind = 'zip' | 'audio' | 'video';

const ZIP_SIGNATURES: readonly Uint8Array[] = [
  new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // standard local file header
  new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // empty archive
  new Uint8Array([0x50, 0x4b, 0x07, 0x08]), // spanned archive
];

// A subset of the most common audio/video container signatures we accept.
// MP3 can start with ID3 metadata OR a raw frame header (0xFF 0xFB/0xF3/0xF2).
// MP4/M4A files start with a 4-byte length then `ftyp`.
// WAV starts with `RIFF` then 4 bytes of size then `WAVE`.
// Ogg starts with `OggS`. FLAC with `fLaC`. WebM with an EBML header.
function isMatch(buf: Buffer, sig: Uint8Array, offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

function isZip(buf: Buffer): boolean {
  return ZIP_SIGNATURES.some((sig) => isMatch(buf, sig));
}

function isMp3(buf: Buffer): boolean {
  // ID3v2 tag
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
  // Raw MPEG frame — first 11 bits set
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  return false;
}

function isMp4(buf: Buffer): boolean {
  // Box starts at offset 4 with 'ftyp'
  return buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
}

function isWav(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 &&
    buf[9] === 0x41 &&
    buf[10] === 0x56 &&
    buf[11] === 0x45 // WAVE
  );
}

function isOgg(buf: Buffer): boolean {
  return isMatch(buf, new Uint8Array([0x4f, 0x67, 0x67, 0x53]));
}

function isFlac(buf: Buffer): boolean {
  return isMatch(buf, new Uint8Array([0x66, 0x4c, 0x61, 0x43]));
}

function isWebm(buf: Buffer): boolean {
  // EBML header
  return isMatch(buf, new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]));
}

export function isValidSignature(buf: Buffer, kind: UploadKind): boolean {
  if (!buf || buf.length < 4) return false;
  switch (kind) {
    case 'zip':
      return isZip(buf);
    case 'audio':
      return isMp3(buf) || isMp4(buf) || isWav(buf) || isOgg(buf) || isFlac(buf) || isWebm(buf);
    case 'video':
      return isMp4(buf) || isWebm(buf);
    default:
      return false;
  }
}
