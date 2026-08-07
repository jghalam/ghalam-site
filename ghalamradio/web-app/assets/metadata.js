// GhalamRadio Web — stream metadata parsing (title/artist only, no artwork)
//
// Two independent formats depending on stream type:
//   - HLS (.m3u8): timed ID3 tags, delivered as raw bytes by hls.js. We parse
//     the TIT2 (title) and TPE1 (artist) text frames ourselves.
//   - Icecast/Shoutcast (plain MP3/AAC streams): ICY metadata, a single
//     "StreamTitle='Artist - Song'" string. icecast-metadata-player extracts
//     the raw string for us; we just split it into artist/title.

// -- ID3v2 (HLS) --

function parseId3(bytes) {
  if (!bytes || bytes.length < 10) return null;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null; // "ID3"
  const majorVersion = bytes[3];
  const tagSize = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const end = Math.min(bytes.length, 10 + tagSize);
  let offset = 10;
  const result = {};

  function readFrameSize(pos) {
    if (majorVersion >= 4) {
      // ID3v2.4: synchsafe (7 bits used per byte)
      return ((bytes[pos] & 0x7f) << 21) | ((bytes[pos + 1] & 0x7f) << 14) | ((bytes[pos + 2] & 0x7f) << 7) | (bytes[pos + 3] & 0x7f);
    }
    // ID3v2.3: plain 32-bit big-endian
    return (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
  }

  function decodeText(frameBytes) {
    if (!frameBytes.length) return '';
    const encoding = frameBytes[0];
    const data = frameBytes.subarray(1);
    try {
      if (encoding === 0) return new TextDecoder('iso-8859-1').decode(data).replace(/\0+$/, '');
      if (encoding === 1) return new TextDecoder('utf-16').decode(data).replace(/\0+$/, '');
      if (encoding === 2) return new TextDecoder('utf-16be').decode(data).replace(/\0+$/, '');
      return new TextDecoder('utf-8').decode(data).replace(/\0+$/, '');
    } catch {
      return '';
    }
  }

  while (offset + 10 <= end) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (id === '\0\0\0\0') break; // padding reached
    const size = readFrameSize(offset + 4);
    const frameStart = offset + 10;
    if (size <= 0 || frameStart + size > bytes.length) break;
    if (id === 'TIT2') result.title = decodeText(bytes.subarray(frameStart, frameStart + size));
    if (id === 'TPE1') result.artist = decodeText(bytes.subarray(frameStart, frameStart + size));
    offset = frameStart + size;
  }

  if (!result.title && !result.artist) return null;
  return { title: result.title || '', artist: result.artist || '' };
}

// data: the FRAG_PARSING_METADATA event payload from hls.js ({ samples: [{ data }] })
function extractId3FromHlsEvent(data) {
  if (!data || !data.samples || !data.samples.length) return null;
  for (const sample of data.samples) {
    const bytes = sample.data instanceof Uint8Array ? sample.data : new Uint8Array(sample.data);
    const parsed = parseId3(bytes);
    if (parsed) return parsed;
  }
  return null;
}

// -- ICY (Icecast/Shoutcast) --

// StreamTitle is conventionally "Artist - Title", but not guaranteed —
// stations that don't follow the convention just come through as a title.
function parseStreamTitle(streamTitle) {
  if (!streamTitle || !streamTitle.trim()) return null;
  const parts = streamTitle.split(' - ');
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: '', title: streamTitle.trim() };
}
