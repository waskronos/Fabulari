import { randomUUID } from 'crypto';
import { getDB } from './db.js';

const sessions = new Map();

// Remember each login until logout or server restart.
export function createSession(username) {
    const token = randomUUID();
    sessions.set(token, username);
    return token;
}

export function endSession(token) {
    sessions.delete(token);
}

export async function getSessionUser(token) {
    const username = sessions.get(token);
    if (!username) return null;
    return getDB().collection('users').findOne({ username });
}

export function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(`${dateOfBirth}T00:00:00`);
    let age = today.getFullYear() - birthDate.getFullYear();
    if (today.getMonth() < birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age--;
    return age;
}
