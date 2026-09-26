const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const name = event.queryStringParameters?.name;
  if (!name) return { statusCode: 400, body: 'name required' };

  const store = getStore('mahjong');
  const users = (await store.get('users', { type: 'json' })) || {};
  const user = users[name];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      winRate: user?.winRate ?? 35
    })
  };
};
