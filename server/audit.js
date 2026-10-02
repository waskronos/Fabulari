import { getDB } from './db.js';

// Store administrative events, never passwords or chat contents.
export async function recordAudit(actor, action, target, reason = '') {
    await getDB().collection('auditLogs').insertOne({actor, action, target, reason, timestamp: new Date()});
}
