import { expect } from 'chai';
import { request } from 'chai-http';
import bcrypt from 'bcryptjs';
import { testUrl, testPassword, testImage, testDB, seedTestData, clearTestData, closeTestDB } from '../data.js';

describe('API routes', () => {
  let db;
  let study;
  let tokens;

  async function api(path, method = 'get', body = {}, actor = 'alice', status = 200) {
    let call = request.execute(testUrl)[method]('/api' + path);
    if (actor) call = call.set('Authorization', 'Bearer ' + tokens[actor]);
    const response = await call.send(body);
    expect(response.status, JSON.stringify(response.body)).to.equal(status);
    return response.body;
  }

  beforeEach(async () => {
    await seedTestData();
    db = await testDB();
    study = await db.collection('groups').findOne({title: 'Study'});
    tokens = {};
    for (const username of ['admin', 'alice', 'bob', 'outsider', 'young']) {
      const response = await api('/login', 'post', {username, password: testPassword}, null);
      tokens[username] = response.user.sessionToken;
    }
  });

  after(async () => {
    await clearTestData();
    await closeTestDB();
  });

  const registration = {
    username: 'newmember', firstName: 'New', lastName: 'Member', email: 'new@test.local',
    dateOfBirth: '2000-01-01', password: testPassword,
  };

  it('registers a user and saves a password hash', async () => {
    await api('/users', 'post', registration, null);
    const user = await db.collection('users').findOne({username: 'newmember'});
    expect(user.role).to.equal('user');
    expect(user.password).not.to.equal(testPassword);
    expect(await bcrypt.compare(testPassword, user.password)).to.equal(true);
  });

  it('makes the first registered account Super Admin without seeding', async () => {
    await clearTestData();
    await api('/users', 'post', registration, null);
    expect((await db.collection('users').findOne({username: 'newmember'})).role).to.equal('superAdmin');
  });

  it('rejects passwords longer than 72 bytes before saving', async () => {
    await api('/users', 'post', {...registration, password: 'A' + 'é'.repeat(36)}, null, 400);
    expect(await db.collection('users').countDocuments({username: 'newmember'})).to.equal(0);
  });

  it('rejects duplicate usernames', async () => {
    await api('/users', 'post', {...registration, username: 'ALICE'}, null, 400);
  });

  it('logs in without returning the password hash', async () => {
    const response = await api('/login', 'post', {username: 'ALICE', password: testPassword}, null);
    expect(response.user.username).to.equal('alice');
    expect(response.user.sessionToken).to.be.a('string');
    expect(response.user).not.to.have.property('password');
  });

  it('rejects an incorrect login password', async () => {
    await api('/login', 'post', {username: 'alice', password: 'WrongPassword'}, null, 401);
  });

  it('rejects protected routes without a login', async () => {
    await api('/groups', 'get', {}, null, 401);
  });

  it('invalidates the token after logout', async () => {
    await api('/logout', 'post');
    await api('/groups', 'get', {}, 'alice', 401);
  });

  it('lists available groups for a logged-in user', async () => {
    expect((await api('/groups')).map(group => group.title)).to.have.members(['Study', 'Games']);
  });

  it('prevents impersonating another requester', async () => {
    await api('/groups/join', 'post', {title: 'Study', username: 'outsider'}, 'bob', 403);
  });

  it('saves a group request for Super Admin', async () => {
    await api('/group-requests', 'post', {title: 'Reading', description: 'Read together', minimumAge: 18, requestedBy: 'alice'}, 'alice', 201);
    expect((await api('/group-requests', 'get', {}, 'admin'))[0].title).to.equal('Reading');
  });

  it('approves a group request and makes the requester its admin', async () => {
    await api('/group-requests', 'post', {title: 'Reading', description: 'Read together', minimumAge: 18, requestedBy: 'alice'}, 'alice', 201);
    const pending = await db.collection('requests').findOne({type: 'group'});
    await api('/group-requests/' + pending._id, 'patch', {action: 'approve'}, 'admin');
    expect((await db.collection('groups').findOne({title: 'Reading'})).admins).to.deep.equal(['alice']);
  });

  it('rejects a group request without creating the group', async () => {
    await api('/group-requests', 'post', {title: 'Reading', description: 'Read together', minimumAge: 18, requestedBy: 'alice'}, 'alice', 201);
    const pending = await db.collection('requests').findOne({type: 'group'});
    await api('/group-requests/' + pending._id, 'patch', {action: 'reject'}, 'admin');
    expect(await db.collection('groups').findOne({title: 'Reading'})).to.equal(null);
  });

  it('allows direct Super Admin group creation with an existing admin', async () => {
    await api('/groups', 'post', {title: 'Art', description: 'Make art', minimumAge: 18, adminUsername: 'bob'}, 'admin', 201);
    expect((await db.collection('groups').findOne({title: 'Art'})).admins).to.deep.equal(['bob']);
  });

  it('rejects direct group creation by normal users', async () => {
    await api('/groups', 'post', {title: 'Art', description: 'Make art', minimumAge: 18, adminUsername: 'bob'}, 'alice', 403);
  });

  it('edits group description, age, theme and icon', async () => {
    await api('/groups/' + study._id, 'patch', {description: 'New description', minimumAge: 20, theme: 'plum', icon: testImage});
    const group = await db.collection('groups').findOne({_id: study._id});
    expect(group.description).to.equal('New description');
    expect(group.minimumAge).to.equal(20);
    expect(group.icon).to.equal(testImage);
  });

  it('does not treat an admin of one group as admin of every group', async () => {
    await api('/groups/' + study._id, 'patch', {description: 'Wrong admin', minimumAge: 18}, 'bob', 403);
  });

  it('saves and approves a membership request', async () => {
    await api('/groups/join', 'post', {title: 'Study', username: 'outsider'}, 'outsider');
    await api('/groups/approve', 'post', {title: 'Study', username: 'outsider'});
    expect((await db.collection('groups').findOne({_id: study._id})).members).to.include('outsider');
  });

  it('rejects a membership request and records the decision', async () => {
    await api('/groups/join', 'post', {title: 'Study', username: 'outsider'}, 'outsider');
    await api('/groups/reject', 'post', {groupId: study._id.toString(), username: 'outsider'});
    expect((await db.collection('groups').findOne({_id: study._id})).joinRequests).to.deep.equal([]);
    expect((await db.collection('requests').findOne({type: 'membership'})).status).to.equal('rejected');
  });

  it('rejects underage membership requests', async () => {
    await api('/groups/join', 'post', {title: 'Study', username: 'young'}, 'young', 400);
  });

  it('removes a member without banning them', async () => {
    await api('/groups/' + study._id + '/members', 'patch', {action: 'remove', username: 'bob'});
    const group = await db.collection('groups').findOne({_id: study._id});
    expect(group.members).not.to.include('bob');
    expect(group.bannedMembers).not.to.include('bob');
  });

  it('bans a member, blocks rejoining and supports unbanning', async () => {
    await api('/groups/' + study._id + '/members', 'patch', {action: 'ban', username: 'bob', reason: 'Repeated spam'});
    await api('/groups/join', 'post', {title: 'Study', username: 'bob'}, 'bob', 403);
    await api('/groups/' + study._id + '/members', 'patch', {action: 'unban', username: 'bob'});
    await api('/groups/join', 'post', {title: 'Study', username: 'bob'}, 'bob');
  });

  it('promotes and demotes a group admin', async () => {
    await api('/groups/' + study._id + '/members', 'patch', {action: 'promote', username: 'bob'});
    expect((await db.collection('groups').findOne({_id: study._id})).admins).to.include('bob');
    await api('/groups/' + study._id + '/members', 'patch', {action: 'demote', username: 'bob'});
    expect((await db.collection('groups').findOne({_id: study._id})).admins).not.to.include('bob');
  });

  it('protects the last group admin', async () => {
    await api('/groups/' + study._id + '/members', 'patch', {action: 'leave', username: 'alice'}, 'alice', 400);
  });

  it('lets a member leave their group', async () => {
    await api('/groups/' + study._id + '/members', 'patch', {action: 'leave', username: 'bob'}, 'bob');
    expect((await db.collection('groups').findOne({_id: study._id})).members).not.to.include('bob');
  });

  it('creates a channel directly for the group admin', async () => {
    await api('/channels', 'post', {name: 'photos', groupTitle: 'Study', createdBy: 'alice'}, 'alice', 201);
    expect(await db.collection('channels').findOne({name: 'photos'})).not.to.equal(null);
  });

  it('rejects direct channel creation by a member', async () => {
    await api('/channels', 'post', {name: 'photos', groupTitle: 'Study', createdBy: 'bob'}, 'bob', 403);
  });

  it('lists only channels the member can access', async () => {
    expect((await api('/channels')).map(channel => channel.groupTitle)).to.deep.equal(['Study', 'Study']);
    expect(await api('/channels', 'get', {}, 'outsider')).to.deep.equal([]);
  });

  it('approves a member channel request', async () => {
    await api('/channel-requests', 'post', {name: 'photos', groupTitle: 'Study', requestedBy: 'bob'}, 'bob', 201);
    const pending = (await api('/channel-requests'))[0];
    await api('/channel-requests/' + pending._id, 'patch', {action: 'approve'});
    expect(await db.collection('channels').findOne({name: 'photos'})).not.to.equal(null);
  });

  it('rejects a channel request without creating a channel', async () => {
    await api('/channel-requests', 'post', {name: 'photos', groupTitle: 'Study', requestedBy: 'bob'}, 'bob', 201);
    const pending = (await api('/channel-requests'))[0];
    await api('/channel-requests/' + pending._id, 'patch', {action: 'reject'});
    expect(await db.collection('channels').findOne({name: 'photos'})).to.equal(null);
  });

  it('deletes a channel and its saved messages', async () => {
    const channel = await db.collection('channels').findOne({groupTitle: 'Study', name: 'chat'});
    await db.collection('messages').insertOne({groupTitle: 'Study', channelName: 'chat', username: 'alice'});
    await api('/channels/' + channel._id, 'delete');
    expect(await db.collection('messages').countDocuments({groupTitle: 'Study', channelName: 'chat'})).to.equal(0);
  });

  it('deletes a group and its channels', async () => {
    await api('/groups/' + study._id, 'delete');
    expect(await db.collection('groups').findOne({_id: study._id})).to.equal(null);
    expect(await db.collection('channels').countDocuments({groupTitle: 'Study'})).to.equal(0);
  });

  it('saves a member report for the group admin', async () => {
    await api('/moderation-requests', 'post', {groupId: study._id.toString(), type: 'ban', targetUsername: 'alice', reason: 'Spam'}, 'bob', 201);
    expect((await api('/moderation-requests'))[0].type).to.equal('ban');
  });

  it('requires a reason when reporting a member', async () => {
    await api('/moderation-requests', 'post', {groupId: study._id.toString(), type: 'ban', targetUsername: 'bob', reason: ''}, 'alice', 400);
  });

  it('approves a ban report', async () => {
    await api('/moderation-requests', 'post', {groupId: study._id.toString(), type: 'ban', targetUsername: 'bob', reason: 'Spam'}, 'alice', 201);
    const pending = await db.collection('requests').findOne({type: 'ban'});
    await api('/moderation-requests/' + pending._id, 'patch', {action: 'approve'});
    expect((await db.collection('groups').findOne({_id: study._id})).bannedMembers).to.include('bob');
  });

  it('lets Super Admin reject account-deletion requests', async () => {
    await api('/moderation-requests', 'post', {groupId: study._id.toString(), type: 'deleteUser', targetUsername: 'bob', reason: 'Repeated spam'}, 'alice', 201);
    const pending = await db.collection('requests').findOne({type: 'deleteUser'});
    await api('/moderation-requests/' + pending._id, 'patch', {action: 'reject'}, 'admin');
    expect(await db.collection('users').findOne({username: 'bob'})).not.to.equal(null);
  });

  it('restricts the user list to Super Admin and excludes passwords', async () => {
    const users = await api('/admin/users', 'get', {}, 'admin');
    expect(users).to.have.length(5);
    expect(users[0]).not.to.have.property('password');
    await api('/admin/users', 'get', {}, 'alice', 403);
  });

  it('lets Super Admin delete an account', async () => {
    await api('/users/outsider', 'delete', {}, 'admin');
    expect(await db.collection('users').findOne({username: 'outsider'})).to.equal(null);
  });

  it('prevents deleting the last group admin', async () => {
    await api('/users/alice', 'delete', {}, 'admin', 400);
  });

  it('updates a profile image and name but keeps email unchanged', async () => {
    const profile = {firstName: 'Alice', lastName: 'Updated', email: 'alice@test.local', dateOfBirth: '2000-01-01', currentPassword: testPassword, profileImage: testImage};
    const response = await api('/users/alice', 'patch', profile);
    expect(response.user.profileImage).to.equal(testImage);
    expect(response.user.lastName).to.equal('Updated');
    await api('/users/alice', 'patch', {...profile, email: 'changed@test.local'}, 'alice', 400);
  });

  it('changes the password only after checking the current password', async () => {
    await api('/users/alice/password', 'patch', {currentPassword: testPassword, newPassword: 'ChangedPassword8', confirmPassword: 'ChangedPassword8'});
    await api('/login', 'post', {username: 'alice', password: testPassword}, null, 401);
    await api('/login', 'post', {username: 'alice', password: 'ChangedPassword8'}, null);
  });

  it('filters audit records for Super Admin', async () => {
    await api('/channels', 'post', {name: 'photos', groupTitle: 'Study', createdBy: 'alice'}, 'alice', 201);
    const logs = await api('/audit-logs?actor=alice&action=channel%20created', 'get', {}, 'admin');
    expect(logs).to.have.length(1);
    expect(logs[0].action).to.equal('channel created');
    await api('/audit-logs', 'get', {}, 'alice', 403);
  });
});
