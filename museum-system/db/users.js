const { load, save } = require('./store');
const { nanoid } = require('nanoid');

function findByUsername(username) {
  return load().users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
}

function findById(id) {
  return load().users.find(u => u.id === id);
}

function create({ username, passwordHash, role }) {
  const data = load();
  const user = {
    id: nanoid(10),
    username,
    passwordHash,
    role: role || 'admin',
    createdAt: new Date().toISOString()
  };
  data.users.push(user);
  save(data);
  return user;
}

function count() {
  return load().users.length;
}

module.exports = { findByUsername, findById, create, count };
