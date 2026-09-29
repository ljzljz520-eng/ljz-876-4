const bcrypt = require('bcryptjs');
const db = require('./db');

console.log('开始写入演示数据...');

// 清空数据
db.exec('DELETE FROM signatures; DELETE FROM quiz_records; DELETE FROM questions; DELETE FROM quizzes; DELETE FROM users; DELETE FROM audit_logs;');
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users','quizzes','questions','quiz_records','signatures','audit_logs');");

const hash = bcrypt.hashSync('123456', 10);

// 用户
const users = [
  { employee_no: 'A001', name: '系统管理员', department: '信息技术部', position: '系统管理员', is_high_risk: 0, role: 'admin' },
  { employee_no: 'L001', name: '王法务', department: '法务部', position: '法务经理', is_high_risk: 0, role: 'legal' },
  { employee_no: 'U001', name: '李审计', department: '审计部', position: '审计主管', is_high_risk: 0, role: 'audit' },
  { employee_no: 'E001', name: '张三', department: '采购部', position: '采购经理', is_high_risk: 1, role: 'employee' },
  { employee_no: 'E002', name: '李四', department: '采购部', position: '采购专员', is_high_risk: 1, role: 'employee' },
  { employee_no: 'E003', name: '王五', department: '财务部', position: '财务主管', is_high_risk: 1, role: 'employee' },
  { employee_no: 'E004', name: '赵六', department: '数据部', position: '数据工程师', is_high_risk: 1, role: 'employee' },
  { employee_no: 'E005', name: '钱七', department: '人事部', position: '人事专员', is_high_risk: 0, role: 'employee' },
  { employee_no: 'E006', name: '孙八', department: '行政部', position: '行政前台', is_high_risk: 0, role: 'employee' },
  { employee_no: 'E007', name: '周九', department: '销售部', position: '销售经理', is_high_risk: 0, role: 'employee' },
  { employee_no: 'E008', name: '吴十', department: '采购部', position: '采购总监', is_high_risk: 1, role: 'employee' },
];

const insertUser = db.prepare(
  'INSERT INTO users (employee_no, name, department, position, is_high_risk, role, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
users.forEach(u => insertUser.run(u.employee_no, u.name, u.department, u.position, u.is_high_risk, u.role, hash));

// 测验1：反舞弊
const quiz1 = db.prepare(
  `INSERT INTO quizzes (title, category, description, passing_score, high_risk_required_score, time_limit, status, created_by, published_at)
   VALUES (?, ?, ?, ?, ?, ?, 'published', 2, datetime('now', 'localtime'))`
).run('反舞弊合规测验', '反舞弊', '本测验旨在提升员工反舞弊意识，识别和防范职务舞弊行为。所有员工须认真学习并通过测验。', 60, 90, 15);

const q1 = quiz1.lastInsertRowid;
const questions1 = [
  { type: 'single', content: '以下哪项属于舞弊行为？', options: ['收受供应商回扣', '正常加班', '参加公司培训', '按流程报销'], correct: [0], score: 10 },
  { type: 'single', content: '发现舞弊行为后，正确的做法是？', options: ['视而不见', '立即向法务或审计部门举报', '私下处理', '告诉同事但不报告'], correct: [1], score: 10 },
  { type: 'multiple', content: '舞弊的常见形式包括哪些？', options: ['贪污受贿', '挪用公款', '虚假报销', '泄露公司机密'], correct: [0,1,2,3], score: 15 },
  { type: 'judge', content: '只要金额小，收受客户礼品可以不上报。', options: ['正确', '错误'], correct: [1], score: 10 },
  { type: 'single', content: '公司反舞弊举报渠道不包括以下哪项？', options: ['法务部举报邮箱', '审计部举报电话', '匿名举报箱', '个人社交媒体'], correct: [3], score: 10 },
  { type: 'judge', content: '员工有义务配合公司的反舞弊调查。', options: ['正确', '错误'], correct: [0], score: 10 },
  { type: 'multiple', content: '以下哪些行为可能构成利益冲突？', options: ['在供应商处兼职', '持有竞争公司股份', '与亲属所在公司发生业务往来未申报', '正常上下班'], correct: [0,1,2], score: 15 },
  { type: 'single', content: '反舞弊工作的第一责任人是？', options: ['法务部', '审计部', '全体员工', '管理层'], correct: [2], score: 10 },
  { type: 'judge', content: '打击报复举报人属于严重违规行为。', options: ['正确', '错误'], correct: [0], score: 10 },
  { type: 'single', content: '以下哪项不是舞弊的特征？', options: ['故意行为', '谋取私利', '损害公司利益', '公开透明'], correct: [3], score: 10 },
];
const insertQ = db.prepare('INSERT INTO questions (quiz_id, type, content, options, correct_answer, score, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
questions1.forEach((q, i) => insertQ.run(q1, q.type, q.content, JSON.stringify(q.options), JSON.stringify(q.correct), q.score, i));

// 测验2：数据安全
const quiz2 = db.prepare(
  `INSERT INTO quizzes (title, category, description, passing_score, high_risk_required_score, time_limit, status, created_by, published_at)
   VALUES (?, ?, ?, ?, ?, ?, 'published', 2, datetime('now', 'localtime'))`
).run('数据安全与隐私保护测验', '数据安全', '本测验涵盖数据安全法律法规、个人信息保护及公司数据安全规范，高风险岗位须达到更高分数。', 60, 90, 20);
const q2 = quiz2.lastInsertRowid;
const questions2 = [
  { type: 'single', content: '根据《个人信息保护法》，处理个人信息应遵循的原则不包括？', options: ['合法正当', '最小必要', '公开透明', '利益最大化'], correct: [3], score: 10 },
  { type: 'single', content: '以下哪种行为存在数据泄露风险？', options: ['使用强密码', '在公共WiFi下传输敏感数据', '定期备份', '加密存储'], correct: [1], score: 10 },
  { type: 'multiple', content: '公司敏感数据包括哪些？', options: ['客户个人信息', '财务数据', '商业秘密', '公开的宣传资料'], correct: [0,1,2], score: 15 },
  { type: 'judge', content: '为了方便，可以将公司数据上传到个人网盘。', options: ['正确', '错误'], correct: [1], score: 10 },
  { type: 'single', content: '发现数据安全事件后，应在多长时间内上报？', options: ['24小时内', '72小时内', '一周内', '立即'], correct: [3], score: 10 },
  { type: 'judge', content: '员工离职后可以保留公司数据作为工作证明。', options: ['正确', '错误'], correct: [1], score: 10 },
  { type: 'multiple', content: '以下哪些是保护数据安全的正确做法？', options: ['定期更新密码', '启用双因素认证', '不点击可疑链接', '随意连接陌生U盘'], correct: [0,1,2], score: 15 },
  { type: 'single', content: '个人信息处理者处理个人信息应当取得个人的？', options: ['默示同意', '单独同意', '口头同意', '无需同意'], correct: [1], score: 10 },
];
questions2.forEach((q, i) => insertQ.run(q2, q.type, q.content, JSON.stringify(q.options), JSON.stringify(q.correct), q.score, i));

// 测验3：采购红线
const quiz3 = db.prepare(
  `INSERT INTO quizzes (title, category, description, passing_score, high_risk_required_score, time_limit, status, created_by, published_at)
   VALUES (?, ?, ?, ?, ?, ?, 'published', 3, datetime('now', 'localtime'))`
).run('采购红线合规测验', '采购红线', '本测验针对采购环节的合规风险，明确采购人员必须遵守的红线规定。采购等高风险岗位须重点掌握。', 60, 90, 15);
const q3 = quiz3.lastInsertRowid;
const questions3 = [
  { type: 'single', content: '采购过程中，以下哪项是允许的？', options: ['收受供应商回扣', '与供应商串通抬价', '按制度公开招标', '指定亲属为供应商'], correct: [2], score: 10 },
  { type: 'single', content: '采购达到一定金额必须进行？', options: ['直接采购', '比价或招标', '口头约定', '私下交易'], correct: [1], score: 10 },
  { type: 'multiple', content: '采购红线包括哪些？', options: ['收受回扣', '虚假采购', '利益输送', '拆分采购规避审批'], correct: [0,1,2,3], score: 15 },
  { type: 'judge', content: '为了提高效率，可以将大额采购拆分成小额采购规避审批。', options: ['正确', '错误'], correct: [1], score: 10 },
  { type: 'single', content: '采购人员与供应商存在亲属关系时，应当？', options: ['隐瞒', '主动申报并回避', '继续合作', '让供应商保密'], correct: [1], score: 10 },
  { type: 'judge', content: '采购合同可以事后补签。', options: ['正确', '错误'], correct: [1], score: 10 },
  { type: 'multiple', content: '以下哪些采购行为属于违规？', options: ['无采购订单采购', '超预算采购', '验收不合格仍付款', '按合同付款'], correct: [0,1,2], score: 15 },
  { type: 'single', content: '采购合规的第一原则是？', options: ['效率优先', '公平公开公正', '成本最低', '关系优先'], correct: [1], score: 10 },
];
questions3.forEach((q, i) => insertQ.run(q3, q.type, q.content, JSON.stringify(q.options), JSON.stringify(q.correct), q.score, i));

// 测验4：草稿（未发布）
const quiz4 = db.prepare(
  `INSERT INTO quizzes (title, category, description, passing_score, high_risk_required_score, time_limit, status, created_by)
   VALUES (?, ?, ?, ?, ?, ?, 'draft', 2)`
).run('合同管理合规测验', '反舞弊', '合同签订与履行中的合规要点（草稿）', 60, 90, 10);
const q4 = quiz4.lastInsertRowid;
insertQ.run(q4, 'single', '合同签订前必须进行？', JSON.stringify(['对方资信调查', '直接盖章', '口头约定', '无需审查']), JSON.stringify([0]), 10, 0);

console.log('演示数据写入完成！');
console.log('');
console.log('登录账号（密码均为 123456）：');
console.log('  管理员：A001 系统管理员');
console.log('  法务：  L001 王法务');
console.log('  审计：  U001 李审计');
console.log('  员工：  E001 张三（采购部·高风险）');
console.log('  员工：  E002 李四（采购部·高风险）');
console.log('  员工：  E003 王五（财务部·高风险）');
console.log('  员工：  E004 赵六（数据部·高风险）');
console.log('  员工：  E005 钱七（人事部）');
console.log('  员工：  E006 孙八（行政部）');
console.log('  员工：  E007 周九（销售部）');
console.log('  员工：  E008 吴十（采购部·高风险）');
