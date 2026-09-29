const db = require('./db');
const { createUser } = require('./auth');
const { audit } = require('./evidence');

function seed() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count > 0) {
    console.log('已存在数据，跳过种子。');
    return;
  }

  const adminId = createUser({ username: 'admin', password: 'admin123', full_name: '系统管理员', department: '信息部', position: '平台管理员', high_risk: 0, role: 'admin' });
  const legalId = createUser({ username: 'legal01', password: 'legal123', full_name: '李法', department: '法务合规部', position: '合规经理', high_risk: 0, role: 'legal' });
  const auditId = createUser({ username: 'audit01', password: 'audit123', full_name: '沈审', department: '审计监察部', position: '审计主管', high_risk: 0, role: 'audit' });
  createUser({ username: 'zhangwei', password: 'emp123', full_name: '张伟', department: '采购部', position: '采购专员', high_risk: 1, role: 'employee' });
  createUser({ username: 'lina', password: 'emp123', full_name: '李娜', department: '信息技术部', position: '数据管理员', high_risk: 1, role: 'employee' });
  createUser({ username: 'wangfang', password: 'emp123', full_name: '王芳', department: '市场部', position: '市场专员', high_risk: 0, role: 'employee' });

  const quizzes = [
    {
      title: '反舞弊与廉洁从业红线测验',
      category: '反舞弊',
      description: '覆盖商业贿赂、利益冲突、舞弊红旗、举报与调查配合等廉洁从业要求。',
      questions: [
        { q: '供应商在节日期间向你赠送面值 5000 元的购物卡，正确做法是？', options: ['婉言拒绝，并按公司礼品申报与合规流程上报', '收下后不声张，也不影响业务', '收下后与同事均分', '让供应商改寄到家里'], answer: 0 },
        { q: '你发现同组同事存在虚报差旅费用的迹象，应当？', options: ['通过合规/审计举报渠道反映，由专业部门核查', '私下提醒其分你一半', '事不关己不予理会', '在部门群里公开质问'], answer: 0 },
        { q: '根据反商业贿赂相关规定，可能成为行贿对象的是？', options: ['客户单位工作人员', '受客户委托办理事务的人员', '能对交易施加影响的第三方中介', '以上都是'], answer: 3 },
        { q: '合法"折扣"与违法"回扣"最关键的区别在于？', options: ['折扣金额更小', '折扣如实入账并明示，回扣账外暗中给付', '折扣只能给个人', '没有区别'], answer: 1 },
        { q: '你的近亲属在一家重要供应商处任职，你应当？', options: ['主动申报利益冲突，并在相关业务中回避', '隐瞒关系继续负责', '让亲属不要告诉别人', '辞职且不申报'], answer: 0 },
        { q: '下列哪些是常见的舞弊"红旗"预警信号？', options: ['生活消费明显超出合法收入水平', '长期拒绝休假且不愿交接工作', '频繁绕过审批或与某供应商往来异常密切', '以上都是'], answer: 3 },
        { q: '因业务需要发生超过公司标准的招待支出，应当？', options: ['先自行垫付后用其他发票冲抵', '按规定事先报批，据实报销并留存凭证', '拆成多张小额发票报销', '让供应商结账'], answer: 1 },
        { q: '公司启动舞弊调查时，被调查与知情员工的义务是？', options: ['配合调查、如实说明、妥善保存相关资料', '删除聊天记录避免麻烦', '统一口径对抗调查', '请调查人员吃饭说情'], answer: 0 },
        { q: '关于合规举报渠道，下列说法正确的是？', options: ['只能向直接上级口头反映', '由审计/合规等独立渠道受理，并对举报人信息保密、禁止打击报复', '实名举报一定会被被举报人知道', '匿名举报一律不受理'], answer: 1 },
        { q: '收受了供应商财物但"没有为其办事"，该行为？', options: ['不构成任何问题', '只要金额小就没事', '仍可能违反廉洁纪律甚至法律，必须拒收并申报', '等离职后就没事了'], answer: 2 },
      ],
    },
    {
      title: '数据安全与个人信息保护测验',
      category: '数据安全',
      description: '依据《数据安全法》《个人信息保护法》及公司数据管理制度，覆盖数据分级、传输、泄露处置等要求。',
      questions: [
        { q: '处理客户个人信息时，最基本的合法性要求是？', options: ['取得个人同意，或具备法律规定的其他合法性基础', '只要是工作需要就可以任意处理', '先收集后补授权', '口头同意即可，无需记录'], answer: 0 },
        { q: '为在家加班，用私人 U 盘拷贝客户资料，正确评价是？', options: ['提高效率，值得提倡', '禁止行为，未经批准不得将公司数据复制外传', '只要不丢就没事', '拷完删除即可'], answer: 1 },
        { q: '发现可能发生客户数据泄露，第一时间应当？', options: ['自行处理，不上报', '立即按数据安全应急预案上报安全/合规部门并采取补救措施', '先观察几天', '在社交媒体提醒客户'], answer: 1 },
        { q: '下列属于"敏感个人信息"的是？', options: ['姓名', '生物识别、医疗健康、金融账户、行踪轨迹等', '工号', '办公邮箱'], answer: 1 },
        { q: '员工离职时，对工作中接触的数据应当？', options: ['拷贝留作纪念', '完整移交公司资料与账号，并删除个人设备上的公司数据', '发给接替同事的私人邮箱', '保留访问权限备用'], answer: 1 },
        { q: '因合作需要向第三方提供客户名单，应当？', options: ['直接发送完整名单', '履行对外提供审批，签署数据处理协议并遵循最小必要原则', '通过个人微信发送', '提供后再补手续'], answer: 1 },
        { q: '关于账号密码，符合要求的做法是？', options: ['多个系统共用一个密码方便记忆', '把密码贴在显示器上', '使用唯一强密码并开启多因素认证，不与他人共享', '让助理统一保管'], answer: 2 },
        { q: '实施数据分类分级管理的核心目的是？', options: ['增加流程负担', '按数据的重要程度和风险等级采取相匹配的保护措施', '方便统计数据数量', '限制员工使用任何数据'], answer: 1 },
        { q: '出差时通过机场公共 WiFi 处理公司业务，应当？', options: ['直接使用，公共网络很安全', '使用公司批准的 VPN 等加密通道接入', '关闭杀毒软件提速', '用邻居的热点'], answer: 1 },
        { q: '外部人员电话索要完整员工通讯录，应如何处理？', options: ['对方自称客户即可提供', '核实身份与授权，按数据对外提供流程审批后在最小范围内提供', '发到公司大群里询问', '提供通讯录并附带职务手机号'], answer: 1 },
      ],
    },
    {
      title: '采购合规与招投标红线测验',
      category: '采购红线',
      description: '覆盖供应商准入、询比价/招标、回避制度、围标串标识别、验收与付款红线。',
      questions: [
        { q: '采购金额达到公司规定的招标/询比价阈值时，应当？', options: ['选择熟悉的供应商直接下单', '严格履行招标或询比价等竞争程序', '化整为零分批采购', '先采购后补流程'], answer: 1 },
        { q: '关于在采购需求中指定品牌，正确的是？', options: ['采购员可随时指定', '不得无合理理由指定特定品牌以排斥竞争，确需指定须论证审批', '领导指定即可且不留痕', '指定品牌能保证质量，鼓励'], answer: 1 },
        { q: '供应商邀请参加高消费娱乐活动或赠送贵重礼品，应当？', options: ['谢绝并按规定申报', '出席但不拿礼品即可', '带着家人一起参加', '事后补个收据'], answer: 0 },
        { q: '为规避上级审批，将一笔大额合同拆成多笔小额合同，属于？', options: ['提高效率的技巧', '严禁的拆单规避审批行为', '只要总额不变就允许', '部门内部事务，无关合规'], answer: 1 },
        { q: '评标/比价过程中发现你与某投标人存在亲属关系，应当？', options: ['保密并公正打分', '主动申请回避，不参与该项目评审', '让其中标后再说明', '给其打高分以补偿'], answer: 1 },
        { q: '新供应商准入前，下列哪项不是必需的？', options: ['资质与信用核查', '签署廉洁/合规承诺', '合规黑名单筛查', '要求供应商赠送开业礼品'], answer: 3 },
        { q: '关于采购合同签署与履行，正确的是？', options: ['先发货验收，合同慢慢补签', '合同须先经法务/合规审核并完成签署后再履行', '口头协议与书面合同效力完全一样', '用部门章替代合同章'], answer: 1 },
        { q: '下列哪些迹象可能提示围标、串标？', options: ['多家投标文件内容异常一致或错误雷同', '报价呈规律性差异', '几家供应商轮流中标', '以上都是'], answer: 3 },
        { q: '因突发事件必须紧急采购时，应当？', options: ['绕开一切管控', '按紧急采购预案执行，事后限期补办审批并接受审计核查', '无需任何记录', '选择报价最高者保证速度'], answer: 1 },
        { q: '货物到库后的验收环节，符合内控要求的是？', options: ['采购员一人验收即可', '由需求、仓储等相关方双人或多部门联合验收并签字', '不验收直接付款', '凭供应商发票验收'], answer: 1 },
      ],
    },
  ];

  const insertQuiz = db.prepare(
    `INSERT INTO quizzes (title,category,description,pass_score,high_risk_pass_score,time_limit_minutes,min_duration_seconds,published,current_version,created_by)
     VALUES (?,?,?,?,?,?,?,1,1,?)`
  );
  const insertVersion = db.prepare(
    `INSERT INTO quiz_versions (quiz_id,version,questions_json,question_count,points_total,published_by)
     VALUES (?,?,?,?,?,?)`
  );
  const insertAssign = db.prepare(
    `INSERT INTO assignments (quiz_id,scope,scope_value,required,created_by) VALUES (?, 'all', '', 1, ?)`
  );

  for (const qz of quizzes) {
    const quizId = insertQuiz.run(qz.title, qz.category, qz.description, 80, 90, 30, 60, legalId).lastInsertRowid;
    const points = qz.questions.length * 10;
    insertVersion.run(quizId, 1, JSON.stringify(qz.questions), qz.questions.length, points, legalId);
    insertAssign.run(quizId, legalId);
  }

  audit({ actorId: adminId, actorName: '系统管理员', action: 'SYSTEM_SEED', entity: 'system', detail: { users: 6, quizzes: quizzes.length } });
  console.log('种子数据完成：6 个用户、3 套测验已发布。');
}

seed();
