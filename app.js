import { ready } from 'https://lsong.org/scripts/dom.js';
import { h, render, useState, useEffect } from 'https://lsong.org/scripts/react/index.js';

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

export async function computeHMAC(key, data) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, {
    name: 'HMAC',
    hash: 'SHA-1',
  }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, data);
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

function useLocalStorageState(key, defaultValue) {
  const [state, setState] = useState(defaultValue);
  const storedValue = localStorage.getItem(key);
  useEffect(() => {
    setState(storedValue !== null ? JSON.parse(storedValue) : defaultValue);
  }, []);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}
const SiteItem = ({ site }) => {
  const [otp, setOtp] = useState('');
  // Function to update the OTP for this site
  const generateOtp = async () => {
    const newOtp = await generateTOTP(site.secret);
    setOtp(newOtp);
  };
  useEffect(() => {
    // Generate an OTP immediately
    generateOtp();
    // Calculate the remaining time until the next 30-second period
    const epoch = Math.floor(Date.now() / 1000);
    const remaining = 30 - (epoch % 30);
    // Set up a timeout to align the OTP generation with the 30-second period
    const timeoutId = setTimeout(() => {
      generateOtp();
      // After aligning, set up an interval to update the OTP every 30 seconds
      setInterval(generateOtp, 30000);
    }, remaining * 1000);
    // Clear the timeout and interval when the component is unmounted
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [site]);
  return h('li', null, `${site.issuer}: ${otp}`);
};

const App = () => {
  const [otpAuthUrl, setOtpAuthUrl] = useState('otpauth://totp/john.doe?secret=N2SJSUOXCKQM5MAX7N7J3NBUQ4WTL66G&issuer=example.org');
  const [sites, setSites] = useLocalStorageState('sites', []);
  const onSubmit = e => {
    e.preventDefault();
    const url = new URL(otpAuthUrl);
    const params = new URLSearchParams(url.search);
    const issuer = params.get('issuer');
    const secret = params.get('secret');
    if (issuer && secret) {
      setSites([...sites, { issuer, secret, otpAuthUrl }]);
      setOtpAuthUrl(''); // Clear the input after adding
    } else {
      console.error('Issuer or secret is missing in the URL');
    }
  };
  return h('div', null, [
    h('h2', null, "OTP Authenticator"),
    h('ul', null, sites.map((site, index) =>
      h(SiteItem, { key: index, site })
    )),
    h('form', { onSubmit }, [
      h('input', {
        name: "otpauth",
        value: otpAuthUrl,
        placeholder: "Enter otpauth URL",
        onChange: e => setOtpAuthUrl(e.target.value)
      }),
      h('button', { type: "submit" }, "Add Site")
    ])
  ]);
};

ready(() => {
  const app = document.getElementById('app');
  render(h(App), app);
});
