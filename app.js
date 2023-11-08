import "https://lsong.org/js/application.js";
import { ready } from 'https://lsong.org/scripts/dom.js';
import { sha1hmac } from 'https://lsong.org/scripts/crypto/sha.js';
import { base32decode } from 'https://lsong.org/scripts/crypto/base32.js';
import { h, render, useState, useEffect, useLocalStorageState } from 'https://lsong.org/scripts/react/index.js';

export async function generateTOTP(secret) {
  const epoch = Math.floor(Date.now() / 1000);
  const time = new Uint8Array(new DataView(new ArrayBuffer(8)).buffer);
  new DataView(time.buffer).setUint32(4, Math.floor(epoch / 30));
  const key = base32decode(secret);
  const hmac = await sha1hmac(key, time.buffer);
  const offset = new Uint8Array(hmac)[19] & 0xf;
  const otp = new DataView(hmac).getUint32(offset) & 0x7fffffff;
  const code = (otp % 1000000).toString().padStart(6, '0');
  return code;
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
