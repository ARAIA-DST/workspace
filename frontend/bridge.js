import { CONFIG } from './config.js';

let frame, readyPromise, bridgeOrigin;
const pending = new Map();

export function bridgeReady() {
  if (!CONFIG.gasUrl) return Promise.reject(new Error('Alamat Apps Script belum diatur di config.js.'));
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {window.removeEventListener('message',onMessage);frame?.remove();frame=null;readyPromise=null;reject(new Error('Koneksi Apps Script belum siap. Periksa URL deployment dan izin akses.'));}, 18000);
    frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'Koneksi ARAIA';
    const url = new URL(CONFIG.gasUrl);
    url.searchParams.set('bridge', '1');
    frame.src = url.toString();
    document.body.append(frame);
    function onMessage(event) {
      if (event.source !== frame.contentWindow || !event.data || event.data.scope !== 'ARAIA_BRIDGE') return;
      if (event.data.type === 'READY') {
        bridgeOrigin = event.origin;
        clearTimeout(timer);
        resolve();
      }
      if (event.data.type === 'RESULT' && event.origin === bridgeOrigin) {
        const item = pending.get(event.data.id);
        if (!item) return;
        clearTimeout(item.timer);
        pending.delete(event.data.id);
        event.data.result?.ok ? item.resolve(event.data.result.data) : item.reject(new Error(event.data.result?.error || 'Permintaan gagal.'));
      }
    }
    window.addEventListener('message', onMessage);
  });
  return readyPromise;
}

export async function api(action, payload = {}, token = '') {
  await bridgeReady();
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timeout = /^(auth\.login|auth\.changePassword|auth\.resetPassword|employee\.create)$/.test(action) ? 90000 : 25000;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Permintaan terlalu lama. Silakan coba lagi.')); }, timeout);
    pending.set(id, { resolve, reject, timer });
    frame.contentWindow.postMessage({ scope: 'ARAIA_APP', type: 'REQUEST', id, action, payload, token }, bridgeOrigin);
  });
}
