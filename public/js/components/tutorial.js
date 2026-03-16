/**
 * Interactive Tutorial Module
 * Provides a guided tour for new users.
 */

const tutorialSteps = [
  {
    target: '#diary-text',
    title: '나의 이야기 기록하기',
    desc: '오늘 하루, 어떤 마음이었나요? 자유롭게 적어보세요.',
    position: 'bottom'
  },
  {
    target: '#promptChips',
    title: '글쓰기가 막막할 때',
    desc: '성찰 프롬프트를 활용해 보세요. 마음을 꺼내놓기가 한결 쉬워질 거예요.',
    position: 'bottom'
  },
  {
    target: '#activityTags',
    title: '오늘의 활동',
    desc: '어떤 활동을 했는지 태그를 선택하면 내 기분과의 관계를 분석해 드려요.',
    position: 'top'
  },
  {
    target: '#submitBtn',
    title: '마음 전하기',
    desc: '작성을 마쳤다면 전송 버튼을 눌러보세요. AI 마음이가 당신의 이야기에 공감해 줄 거예요.',
    position: 'top'
  },
  {
    target: '.tab-nav',
    title: '마음의 변화 확인',
    desc: '달력과 통계 메뉴에서 내 마음이 어떻게 변해가는지 한눈에 볼 수 있어요.',
    position: 'top'
  }
];

let currentStepIndex = 0;
let overlay, tooltip;

export function initTutorial() {
  if (document.getElementById('tutorialOverlay')) return;

  overlay = document.createElement('div');
  overlay.id = 'tutorialOverlay';
  overlay.className = 'tutorial-overlay';
  
  tooltip = document.createElement('div');
  tooltip.id = 'tutorialTooltip';
  tooltip.className = 'tutorial-tooltip';
  
  overlay.appendChild(tooltip);
  document.body.appendChild(overlay);
}

export function startTutorial() {
  currentStepIndex = 0;
  initTutorial();
  showStep(0);
  overlay.classList.add('active');
}

function showStep(index) {
  const step = tutorialSteps[index];
  const targetEl = document.querySelector(step.target);
  
  if (!targetEl) {
    nextStep();
    return;
  }

  // Remove previous highlights
  document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
  
  // Highlight current target
  targetEl.classList.add('tutorial-highlight');
  
  // Update tooltip content
  tooltip.innerHTML = `
    <div class="tutorial-content">
      <h3 class="tutorial-title">${step.title}</h3>
      <p class="tutorial-desc">${step.desc}</p>
    </div>
    <div class="tutorial-footer">
      <button class="tutorial-btn-skip" id="tutorialSkip">건너뛰기</button>
      <div class="tutorial-progress">${index + 1} / ${tutorialSteps.length}</div>
      <button class="tutorial-btn-next" id="tutorialNext">${index === tutorialSteps.length - 1 ? '시작하기' : '다음'}</button>
    </div>
  `;

  tooltip.setAttribute('data-position', step.position);
  
  // Position tooltip relative to target
  positionTooltip(targetEl, step.position);

  // Event listeners
  document.getElementById('tutorialNext').onclick = nextStep;
  document.getElementById('tutorialSkip').onclick = endTutorial;
  
  tooltip.classList.add('active');
}

function positionTooltip(target, position) {
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  let top, left;

  switch (position) {
    case 'top':
      top = rect.top + scrollY - tooltipRect.height - 20;
      left = rect.left + scrollX + (rect.width / 2) - (tooltipRect.width / 2);
      break;
    case 'bottom':
      top = rect.bottom + scrollY + 20;
      left = rect.left + scrollX + (rect.width / 2) - (tooltipRect.width / 2);
      break;
    case 'left':
      top = rect.top + scrollY + (rect.height / 2) - (tooltipRect.height / 2);
      left = rect.left + scrollX - tooltipRect.width - 20;
      break;
    case 'right':
      top = rect.top + scrollY + (rect.height / 2) - (tooltipRect.height / 2);
      left = rect.right + scrollX + 20;
      break;
  }

  // Keep within viewport
  const margin = 10;
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin));

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function nextStep() {
  currentStepIndex++;
  if (currentStepIndex < tutorialSteps.length) {
    showStep(currentStepIndex);
  } else {
    endTutorial();
  }
}

function endTutorial() {
  overlay.classList.remove('active');
  tooltip.classList.remove('active');
  document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
  
  // Mark as seen in localStorage or state if needed
  localStorage.setItem('sentimind-tutorial-seen', 'true');
}
