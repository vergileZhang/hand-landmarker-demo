const TITLES = {
  passive: '被动响应型 · AI 确认',
  wake: '用户唤醒型 · 直播快捷控制',
  continuous: '持续监听型 · 文档翻页',
};

const STATE_LABELS = {
  inactive: '未运行',
  'passive-waiting': '等待用户确认（8 秒）',
  'wake-standby': '低频待机 · 👍 持续 1 秒唤醒',
  'wake-active': '直播控制已唤醒',
  'continuous-active': '持续监听中',
  'continuous-paused': '已暂停 · ✋ 恢复',
};

const DOCUMENT_PAGES = [
  ['01 / PROJECT OVERVIEW', '手势驱动的人机交互', '使用摄像头与本地模型，把自然动作转化为可执行事件。'],
  ['02 / RECOGNITION', '21 个关键点 · 8 类静态手势', '视频帧在浏览器本地完成识别，不上传摄像头画面。'],
  ['03 / INTERACTION', '三类交互模式', '被动响应、用户唤醒和持续监听覆盖不同任务时机。'],
  ['04 / NEXT STEP', '从 Demo 到可落地工具', '下一阶段验证稳定性、误触率，并通过本地桥接控制外部应用。'],
];

export class DemoView {
  constructor(elements) {
    this.elements = elements;
    this.mode = 'passive';
    this.pageIndex = 0;
    this.sceneIndex = 0;
    this.selectScenario(this.mode);
  }

  selectScenario(mode) {
    if (!TITLES[mode]) return;
    this.mode = mode;
    this.elements['scenario-title'].textContent = TITLES[mode];
    for (const candidate of Object.keys(TITLES)) {
      this.elements[`scenario-${candidate}`].classList.toggle('active', candidate === mode);
      this.elements[`${candidate}-stage`].hidden = candidate !== mode;
    }
    this.renderState({ state: 'inactive' });
  }

  renderState(snapshot) {
    this.elements['scenario-state'].textContent = STATE_LABELS[snapshot.state] ?? snapshot.state;
    const running = snapshot.state !== 'inactive';
    this.elements['start-scenario'].disabled = running || this.elements['start-camera'].disabled;
    this.elements['stop-scenario'].disabled = !running;
    this.elements['continuous-stage'].classList.toggle(
      'paused', snapshot.state === 'continuous-paused',
    );
  }

  applyAction(action) {
    if (!action) return;
    const messages = {
      'summary.save': '已确认：会议摘要已保存到本地',
      'summary.cancel': '已取消：本次摘要不保存',
      'summary.defer': '已记录：稍后再次询问',
      'confirmation.timeout': '等待超时：未执行任何操作',
    };
    if (messages[action.type]) this.elements['passive-result'].textContent = messages[action.type];

    if (action.type === 'live.scene.next') {
      const scenes = ['主讲画面', '产品特写', '互动抽奖', '观众问答'];
      this.sceneIndex = (this.sceneIndex + 1) % scenes.length;
      this.elements['live-scene'].textContent = scenes[this.sceneIndex];
    }
    if (action.type === 'live.product.show') this.elements['live-product'].hidden = false;
    if (action.type === 'live.follow.show') this.elements['live-follow'].hidden = false;
    if (action.type === 'live.overlay.hide' || action.type === 'live.session.standby') {
      this.elements['live-product'].hidden = true;
      this.elements['live-follow'].hidden = true;
    }

    if (action.type === 'document.page.next') {
      this.pageIndex = Math.min(DOCUMENT_PAGES.length - 1, this.pageIndex + 1);
      this.renderDocumentPage();
    }
    if (action.type === 'document.page.previous') {
      this.pageIndex = Math.max(0, this.pageIndex - 1);
      this.renderDocumentPage();
    }
    this.appendEvent(action);
  }

  appendEvent(action) {
    const log = this.elements['event-log'];
    log.querySelector('.empty-log')?.remove();
    const item = document.createElement('li');
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    item.textContent = `${time}  ${action.type}${action.payload?.gesture ? `  ← ${action.payload.gesture}` : ''}`;
    log.prepend(item);
    while (log.children.length > 10) log.lastElementChild.remove();
  }

  reset(mode = this.mode) {
    this.pageIndex = 0;
    this.sceneIndex = 0;
    this.elements['passive-result'].textContent = '等待启动';
    this.elements['live-scene'].textContent = '主讲画面';
    this.elements['live-product'].hidden = true;
    this.elements['live-follow'].hidden = true;
    this.renderDocumentPage();
    this.selectScenario(mode);
  }

  renderDocumentPage() {
    const [section, title, description] = DOCUMENT_PAGES[this.pageIndex];
    this.elements['document-page'].innerHTML = `<span>${section}</span><h3>${title}</h3><p>${description}</p>`;
    this.elements['document-page-label'].textContent = `${this.pageIndex + 1} / ${DOCUMENT_PAGES.length}`;
  }
}
