'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { Readable } = require('node:stream');
const { protocol } = require('electron');
const { MIME_BY_EXT } = require('./library');

const APP_SCHEME = 'simplex';

const STATIC_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function notFound(message = 'Not found') {
  return new Response(message, {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ]);
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader).trim());
  if (!match) return 'invalid';

  let start = match[1] === '' ? null : Number(match[1]);
  let end = match[2] === '' ? null : Number(match[2]);

  if (start === null && end === null) return 'invalid';
  if (start === null) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else if (end === null || end >= size) {
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) {
    return 'invalid';
  }

  return { start, end };
}

function streamResponse(filePath, stat, range) {
  const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  };

  if (range && range !== 'invalid') {
    const length = range.end - range.start + 1;
    headers['Content-Length'] = String(length);
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${stat.size}`;
    return new Response(Readable.toWeb(fs.createReadStream(filePath, {
      start: range.start,
      end: range.end
    })), { status: 206, headers });
  }

  headers['Content-Length'] = String(stat.size);
  return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
    status: 200,
    headers
  });
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function serveStatic(appDir, pathname, method) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname);
  } catch {
    return notFound();
  }

  relativePath = relativePath.replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(appDir, relativePath);

  if (!isPathInside(appDir, filePath)) return notFound();

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return notFound();
    const mime = STATIC_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const body = method === 'HEAD' ? null : await fsp.readFile(filePath);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(stat.size),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch {
    return notFound();
  }
}

async function handleAudio(request, url, coversDir, library) {
  const prefix = '/__audio/';
  if (!url.pathname.startsWith(prefix)) return notFound();
  const token = url.pathname.slice(prefix.length).replace(/\/+$/, '');
  if (!token) return notFound();

  let filePath;
  try {
    filePath = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return notFound();
  }

  if (!filePath || !library.isAllowedAudioPath(filePath)) return notFound();

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return notFound();

    const range = parseRange(request.headers.get('Range'), stat.size);
    if (range === 'invalid') {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store'
        }
      });
    }

    if (request.method === 'HEAD') {
      const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      return new Response(null, {
        status: range ? 206 : 200,
        headers: {
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(range ? range.end - range.start + 1 : stat.size),
          ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}` } : {})
        }
      });
    }

    return streamResponse(filePath, stat, range);
  } catch {
    return notFound();
  }
}

async function handleCover(url, coversDir) {
  const prefix = '/__cover/';
  if (!url.pathname.startsWith(prefix)) return notFound();
  const name = url.pathname.slice(prefix.length);
  if (!/^[a-f0-9]{24}\.jpg$/.test(name)) return notFound();

  const filePath = path.join(coversDir, name);
  try {
    const data = await fsp.readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(data.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch {
    return notFound();
  }
}

function installAppProtocol({ appDir, coversDir, library }) {
  protocol.handle(APP_SCHEME, async (request) => {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return notFound();
    }

    if (url.hostname !== 'app') return notFound();
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (url.pathname === '/__audio/' || url.pathname.startsWith('/__audio/')) {
      return handleAudio(request, url, coversDir, library);
    }
    if (url.pathname.startsWith('/__cover/')) {
      return handleCover(url, coversDir);
    }
    if (url.pathname === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    return serveStatic(appDir, url.pathname, request.method);
  });
}

module.exports = {
  APP_SCHEME,
  registerAppScheme,
  installAppProtocol
};
