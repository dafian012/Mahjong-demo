const { getStore } = require('@netlify/blobs');

const TOKEN = process.env.TG_TOKEN || '8683487207:AAEVXMSbZF_DzmlOnssgwA9yZucJgTAY5OM';
const API = `https://api.telegram.org/bot${TOKEN}`;
const ADMIN_ID = 6157377532;

async function sendMessage(chatId, text, opts = {}) {
  return fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...opts })
  }).then(r => r.json());
}
async function answerCallback(id, text = '') {
  return fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text, show_alert: false })
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 200, body: 'ok' };

  let update;
  try { update = JSON.parse(event.body); }
  catch { return { statusCode: 200, body: 'ok' }; }

  const store = getStore('mahjong');
  let users = (await store.get('users', { type: 'json' })) || {};

  /* === CALLBACK QUERY (tombol) === */
  if (update.callback_query) {
    const cb = update.callback_query;
    await answerCallback(cb.id);
    const data = cb.data || '';
    const chatId = cb.message.chat.id;
    if (chatId !== ADMIN_ID) return { statusCode: 200, body: 'ok' };

    if (data.startsWith('set:')) {
      const [, name, rate] = data.split(':');
      const r = parseInt(rate, 10);
      if (users[name]) {
        users[name].winRate = r;
        await store.setJSON('users', users);
        await sendMessage(chatId, `✅ <b>${name}</b> → win rate <b>${r}%</b> tersimpan.`);
      }
    } else if (data.startsWith('show:')) {
      const name = data.slice(5);
      const u = users[name];
      if (u) {
        const kb = {
          inline_keyboard: [
            [
              { text: '10%', callback_data: `set:${name}:10` },
              { text: '20%', callback_data: `set:${name}:20` },
              { text: '35%', callback_data: `set:${name}:35` }
            ],
            [
              { text: '50%', callback_data: `set:${name}:50` },
              { text: '75%', callback_data: `set:${name}:75` },
              { text: '100%', callback_data: `set:${name}:100` }
            ]
          ]
        };
        await sendMessage(chatId,
          `⚙️ Atur win rate untuk <b>${name}</b>\nSaat ini: <b>${u.winRate}%</b>`,
          { reply_markup: kb }
        );
      }
    }
    return { statusCode: 200, body: 'ok' };
  }

  /* === MESSAGE === */
  if (!update.message) return { statusCode: 200, body: 'ok' };
  const msg = update.message;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const from = msg.from.id;

  if (from !== ADMIN_ID) {
    await sendMessage(chatId, '⛔ Bot ini hanya untuk admin.');
    return { statusCode: 200, body: 'ok' };
  }

  if (text === '/start' || text === '/help') {
    await sendMessage(chatId,
      `🀄 <b>MAHJONG DEMO — BOT KONTROL</b>\n\n` +
      `Perintah:\n` +
      `/list — Lihat semua pemain\n` +
      `/atur &lt;nama&gt; &lt;persen&gt; — Set win rate\n` +
      `/rtp &lt;persen&gt; — Set global semua pemain\n` +
      `/info &lt;nama&gt; — Detail pemain\n` +
      `/reset — Hapus semua data\n`
    );
  }
  else if (text === '/list') {
    const names = Object.keys(users);
    if (!names.length) {
      await sendMessage(chatId, '📭 Belum ada pemain terdaftar.');
      return { statusCode: 200, body: 'ok' };
    }
    let out = `📋 <b>DAFTAR PEMAIN (${names.length})</b>\n\n`;
    const kb = [];
    names.forEach((n, i) => {
      const u = users[n];
      out += `${i + 1}. <b>${n}</b> — Win Rate: <b>${u.winRate}%</b>\n`;
      kb.push([{ text: `⚙️ ${n} (${u.winRate}%)`, callback_data: `show:${n}` }]);
    });
    await sendMessage(chatId, out, { reply_markup: { inline_keyboard: kb } });
  }
  else if (text.startsWith('/atur')) {
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      await sendMessage(chatId, '❌ Format: /atur &lt;nama&gt; &lt;persen&gt;');
      return { statusCode: 200, body: 'ok' };
    }
    const name = parts[1];
    const rate = Math.max(0, Math.min(100, parseInt(parts[2], 10)));
    if (!users[name]) {
      await sendMessage(chatId, `❌ Pemain <b>${name}</b> tidak ditemukan.`);
      return { statusCode: 200, body: 'ok' };
    }
    users[name].winRate = rate;
    await store.setJSON('users', users);
    await sendMessage(chatId, `✅ <b>${name}</b> → win rate <b>${rate}%</b>`);
  }
  else if (text.startsWith('/rtp')) {
    const parts = text.split(/\s+/);
    const rate = Math.max(0, Math.min(100, parseInt(parts[1], 10)));
    if (isNaN(rate)) {
      await sendMessage(chatId, '❌ Format: /rtp &lt;persen&gt;');
      return { statusCode: 200, body: 'ok' };
    }
    Object.keys(users).forEach(n => users[n].winRate = rate);
    await store.setJSON('users', users);
    await sendMessage(chatId, `✅ Win rate GLOBAL semua pemain diset <b>${rate}%</b>`);
  }
  else if (text.startsWith('/info')) {
    const name = text.split(/\s+/)[1];
    const u = users[name];
    if (!u) {
      await sendMessage(chatId, '❌ Pemain tidak ditemukan.');
      return { statusCode: 200, body: 'ok' };
    }
    await sendMessage(chatId,
      `👤 <b>${u.name}</b>\nWin Rate: <b>${u.winRate}%</b>\nDaftar: ${new Date(u.createdAt).toLocaleString('id-ID')}`
    );
  }
  else if (text === '/reset') {
    await store.setJSON('users', {});
    await sendMessage(chatId, '🗑️ Semua data pemain dihapus.');
  }

  return { statusCode: 200, body: 'ok' };
};
