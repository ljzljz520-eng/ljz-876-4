const crypto = require('crypto');

// 稳定序列化：键排序、紧凑输出，保证哈希可在不同运行中复现
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

function sha256(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

// 证据事件哈希：覆盖事件全部关键字段
function hashEvent(prev, ev) {
  const canonical = stableStringify({
    attempt_id: ev.attempt_id,
    event_type: ev.event_type,
    actor_id: ev.actor_id,
    occurred_at: ev.occurred_at,
    payload: ev.payload_json == null ? null : JSON.parse(ev.payload_json),
  });
  return sha256([prev, canonical]);
}

// 审计日志哈希
function hashAudit(prev, log) {
  const canonical = stableStringify({
    actor_id: log.actor_id,
    actor_name: log.actor_name,
    action: log.action,
    entity: log.entity,
    entity_id: log.entity_id,
    detail: log.detail_json == null ? null : JSON.parse(log.detail_json),
    created_at: log.created_at,
  });
  return sha256([prev, canonical]);
}

module.exports = { stableStringify, sha256, hashEvent, hashAudit };
