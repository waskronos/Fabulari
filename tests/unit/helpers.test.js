import assert from 'node:assert/strict';
import { calculateAge, createSession, endSession } from '../../server/access.js';
import { isValidImage } from '../../server/images.js';
import { testImage } from '../data.js';

describe('Age calculation', () => {
  const today = new Date();
  const birthday = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
  function dateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  it('counts a birthday that is today', () => assert.equal(calculateAge(dateString(birthday)), 20));
  it('does not count a birthday that has not happened yet', () => {
    const tomorrow = new Date(birthday);
    tomorrow.setDate(tomorrow.getDate() + 1);
    assert.equal(calculateAge(dateString(tomorrow)), 19);
  });
  it('counts a birthday that has already happened', () => {
    const yesterday = new Date(birthday);
    yesterday.setDate(yesterday.getDate() - 1);
    assert.equal(calculateAge(dateString(yesterday)), 20);
  });
});

describe('Image validation', () => {
  it('allows no image', () => assert.equal(isValidImage(''), true));
  it('accepts a small PNG', () => assert.equal(isValidImage(testImage), true));
  it('rejects a fake PNG', () => assert.equal(isValidImage('data:image/png;base64,ZmFrZQ=='), false));
  it('rejects SVG uploads', () => assert.equal(isValidImage('data:image/svg+xml;base64,PHN2Zy8+'), false));
  it('rejects images over 2 MB', () => {
    const image = Buffer.alloc(2 * 1024 * 1024 + 1);
    Buffer.from('89504e470d0a1a0a', 'hex').copy(image);
    assert.equal(isValidImage('data:image/png;base64,' + image.toString('base64')), false);
  });
});

describe('Login tokens', () => {
  it('gives separate logins different tokens', () => {
    const first = createSession('alice');
    const second = createSession('alice');
    assert.notEqual(first, second);
    endSession(first);
    endSession(second);
  });
});
