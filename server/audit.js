import { getDB } from './db.js';

export async function recordAudit(actor, action, target, reason = '') {
    await getDB().collection('auditLogs').insertOne({actor, action, target, reason, timestamp: new Date()});
}
