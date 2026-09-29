const db = require('./db');
const { hashEvent, hashAudit } = require('./hash');

const nowIso = () => new Date().toISOString();

// 追加一条不可变证据事件
function appendEvent({ attemptId, type, actorId, payload = null, ip = null, ua = null, at = null }) {
  const tail = db.prepare('SELECT record_hash FROM attempt_events ORDER BY id DESC LIMIT 1').get();
  const prevHash = tail ? tail.record_hash : 'GENESIS';
  const occurredAt = at || nowIso();
  const payloadJson = payload == null ? null : JSON.stringify(payload);
  const info = db
    .prepare(
      `INSERT INTO attempt_events (attempt_id,event_type,actor_id,occurred_at,payload_json,ip_address,user_agent,prev_hash,record_hash)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
.run(attemptId, type, actorId, occurredAt, payloadJson, ip, ua, prevHash, 'PENDING');
  const id = info.lastInsertRowid;
  const row = db.prepare('SELECT * FROM attempt_events WHERE id=?').get(id);
  const recordHash = hashEvent(prevHash, row);
  db.prepare('UPDATE attempt_events SET record_hash=? WHERE id=?').run(recordHash, id);
  return { id, recordHash, occurredAt };
}

// 追加审计日志（独立哈希链）
function audit({ actorId = null, actorName = null, action, entity, entityId = null, detail = null, ip = null }) {
  const tail = db.prepare('SELECT record_hash FROM audit_logs ORDER BY id DESC LIMIT 1').get();
  const prevHash = tail ? tail.record_hash : 'GENESIS';
  const createdAt = nowIso();
  const detailJson = detail == null ? null : JSON.stringify(detail);
  const info = db
    .prepare(
      `INSERT INTO audit_logs (actor_id,actor_name,action,entity,entity_id,detail_json,ip_address,created_at,prev_hash,record_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(actorId, actorName, action, entity, entityId == null ? null : String(entityId), detailJson, ip, createdAt, prevHash, 'PENDING');
  const id = info.lastInsertRowid;
  const row = db.prepare('SELECT * FROM audit_logs WHERE id=?').get(id);
  const recordHash = hashAudit(prevHash, row);
  db.prepare('UPDATE audit_logs SET record_hash=? WHERE id=?').run(recordHash, id);
  return id;
}

function verifyChain(table) {
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id ASC`).all();
  let prev = 'GENESIS';
  const hasher = table === 'attempt_events' ? hashEvent : hashAudit;
  for (const r of rows) {
    if (r.prev_hash !== prev) {
      return { ok: false, brokenAt: r.id, reason: `prev_hash 不匹配（链断裂/记录被删除或重排）` };
    }
    const expected = hasher(prev, r);
    if (expected !== r.record_hash) {
      return { ok: false, brokenAt: r.id, reason: 'record_hash 不匹配（记录内容被篡改）' };
    }
    prev = r.record_hash;
  }
  return { ok: true, count: rows.length, head: prev };
}

module.exports = { appendEvent, audit, verifyChain, nowIso };
