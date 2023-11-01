import { ready } from 'https://lsong.org/scripts/dom.js';

import "https://lsong.org/js/application.js";

export function base32ToBuffer(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let result = new Uint8Array(Math.ceil(base32.length * 5 / 8));

  for (let i = 0; i < base32.length; i++) {
    let value = alphabet.indexOf(base32[i].toUpperCase());
    bits += value.toString(2).padStart(5, '0');
  }

  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(bits.substr(i * 8, 8), 2);
  }
  return result;
}

export async function computeHMAC(key, message) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, {
    name: 'HMAC',
    hash: 'SHA-1',
  }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, message);
}

export async function generateTOTP(secret) {
  const epoch = Math.floor(Date.now() / 1000);
  const time = new Uint8Array(new DataView(new ArrayBuffer(8)).buffer);
  new DataView(time.buffer).setUint32(4, Math.floor(epoch / 30));
  const key = base32ToBuffer(secret);
  const hmac = await computeHMAC(key, time.buffer);
  const offset = new Uint8Array(hmac)[19] & 0xf;
  const otp = new DataView(hmac).getUint32(offset) & 0x7fffffff;
  const code = (otp % 1000000).toString().padStart(6, '0');
  return code;
}

ready(() => {
  const btn = document.getElementById('gen');
  const otpauth = document.getElementById('otpauth');

  btn.addEventListener('click', async () => {
    const url = new URL(otpauth.value);
    const params = new URLSearchParams(url.search);
    const secret = params.get('secret');
    const code = await generateTOTP(secret);
    document.getElementById('result').textContent = code;
  });
});