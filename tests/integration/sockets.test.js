import assert from 'node:assert/strict';
import { request } from 'chai-http';
import { io } from 'socket.io-client';
import { testUrl, testPassword, testImage, testDB, seedTestData, clearTestData, closeTestDB } from '../data.js';

describe('Socket rooms', () => {
  let db;
  let sockets;

  function nextEvent(socket, name) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(name, receive);
        reject(new Error('Timed out waiting for ' + name));
      }, 5000);
      function receive(value) {
        clearTimeout(timer);
        resolve(value);
      }
      socket.once(name, receive);
    });
  }

  async function connect(username) {
    const response = await request.execute(testUrl).post('/api/login').send({username, password: testPassword});
    assert.equal(response.status, 200);
    const socket = io(testUrl, {auth: {token: response.body.user.sessionToken}, autoConnect: false});
    sockets.push(socket);
    const connected = nextEvent(socket, 'connect');
    socket.connect();
    await connected;
    return socket;
  }

  async function join(socket, channelName = 'chat') {
    const history = nextEvent(socket, 'chat-history');
    const joined = nextEvent(socket, 'channel-joined');
    socket.emit('join-channel', {groupTitle: 'Study', channelName});
    const messages = await history;
    await joined;
    return messages;
  }

  async function send(socket, text, image = '') {
    const received = nextEvent(socket, 'new-message');
    socket.emit('send-message', {text, image});
    return received;
  }

  beforeEach(async () => {
    await seedTestData();
    db = await testDB();
    sockets = [];
  });

  afterEach(() => {
    for (const socket of sockets) socket.disconnect();
  });

  after(async () => {
    await clearTestData();
    await closeTestDB();
  });

  it('rejects a socket without a login token', async () => {
    const socket = io(testUrl, {autoConnect: false});
    sockets.push(socket);
    const rejected = nextEvent(socket, 'connect_error');
    socket.connect();
    assert.equal((await rejected).message, 'Please sign in again');
  });

  it('rejects nonmembers and Super Admin from chat rooms', async () => {
    for (const username of ['outsider', 'admin']) {
      const socket = await connect(username);
      const rejected = nextEvent(socket, 'chat-error');
      socket.emit('join-channel', {groupTitle: 'Study', channelName: 'chat'});
      assert.match(await rejected, /do not have access/);
    }
  });

  it('checks group age even when the account appears in members', async () => {
    await db.collection('groups').updateOne({title: 'Study'}, {$addToSet: {members: 'young'}});
    const socket = await connect('young');
    const rejected = nextEvent(socket, 'chat-error');
    socket.emit('join-channel', {groupTitle: 'Study', channelName: 'chat'});
    assert.match(await rejected, /do not have access/);
  });

  it('broadcasts saved messages only to their channel', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const other = await connect('bob');
    await join(alice);
    await join(bob);
    await join(other, 'help');
    const otherMessages = [];
    other.on('new-message', message => otherMessages.push(message));
    const received = nextEvent(bob, 'new-message');
    const message = await send(alice, 'Hello room');
    assert.equal((await received)._id, message._id);
    assert.equal(message.username, 'alice');
    assert.equal(message.isModerator, true);
    assert.equal((await db.collection('messages').findOne({text: 'Hello room'})).channelName, 'chat');
    // Waiting for the other channel's reply also lets earlier events arrive.
    await send(other, 'Different channel');
    assert.deepEqual(otherMessages.map(message => message.text), ['Different channel']);
  });

  it('saves an image-only message and rejects fake images', async () => {
    const alice = await connect('alice');
    await join(alice);
    assert.equal((await send(alice, '', testImage)).image, testImage);
    const rejected = nextEvent(alice, 'chat-error');
    alice.emit('send-message', {text: '', image: 'data:image/png;base64,ZmFrZQ=='});
    assert.match(await rejected, /PNG, JPEG or GIF/);
    assert.equal(await db.collection('messages').countDocuments(), 1);
  });

  it('keeps five saved messages and returns them oldest to newest', async () => {
    const alice = await connect('alice');
    await join(alice);
    for (let number = 1; number <= 7; number++) await send(alice, 'Message ' + number);
    assert.equal(await db.collection('messages').countDocuments(), 5);
    const bob = await connect('bob');
    assert.deepEqual((await join(bob)).map(message => message.text), ['Message 3', 'Message 4', 'Message 5', 'Message 6', 'Message 7']);
  });

  it('allows only the author to delete a message', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    await join(alice);
    await join(bob);
    const message = await send(alice, 'My message');
    const rejected = nextEvent(bob, 'chat-error');
    bob.emit('delete-message', message._id);
    assert.match(await rejected, /only delete your own/);
    const deleted = nextEvent(bob, 'message-deleted');
    alice.emit('delete-message', message._id);
    assert.equal(await deleted, message._id);
    assert.equal(await db.collection('messages').countDocuments(), 0);
  });

  it('deletes an older visible message after database history is trimmed', async () => {
    const alice = await connect('alice');
    await join(alice);
    const first = await send(alice, 'Older visible message');
    for (let number = 1; number <= 5; number++) await send(alice, 'Later ' + number);
    const deleted = nextEvent(alice, 'message-deleted');
    alice.emit('delete-message', first._id);
    assert.equal(await deleted, first._id);
    assert.equal(await db.collection('messages').countDocuments(), 5);
  });

  it('notifies existing members when someone joins and leaves', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    await join(alice);
    const joined = nextEvent(alice, 'room-notification');
    await join(bob);
    assert.equal(await joined, 'bob joined the room');
    const left = nextEvent(alice, 'room-notification');
    bob.disconnect();
    assert.equal(await left, 'bob left the room');
  });
});
