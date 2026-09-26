const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const name = (body.name || '').trim().slice(0, 30) ||
    ('Pemain' + Date.now().toString().slice(-4));

  const store = getStore('mahjong');
  let users = (await store.get('users', { type: 'json' })) || {};

  if (!users[name]) {
    users[name] = {
      name,
      winRate: 35,
      createdAt: Date.now(),
      totalSpin: 0
    };
    await store.setJSON('users', users);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, winRate: users[name].winRate })
  };
};
