# Emotion Ontology Graph Visualization - Research Report

> Sentimind AI 공감 다이어리 앱에 적용할 감정 온톨로지 그래프 시각화 연구
> 작성일: 2026-03-09

---

## 목차

1. [감정 온톨로지 모델 비교](#1-감정-온톨로지-모델-비교)
2. [웹 그래프 시각화 라이브러리 비교](#2-웹-그래프-시각화-라이브러리-비교)
3. [기존 앱의 감정 시각화 UX 패턴](#3-기존-앱의-감정-시각화-ux-패턴)
4. [인터랙티브 그래프 기법](#4-인터랙티브-그래프-기법)
5. [게이미피케이션 요소](#5-게이미피케이션-요소)
6. [실현 가능성 분석 및 구현 전략](#6-실현-가능성-분석-및-구현-전략)
7. [Sentimind 맞춤 제안](#7-sentimind-맞춤-제안)
8. [참고문헌](#8-참고문헌)

---

## 1. 감정 온톨로지 모델 비교

### 1.1 주요 모델 개요

| 모델 | 개발자/년도 | 기본 감정 수 | 구조 | 강점 | 약점 |
|------|-----------|------------|------|------|------|
| **Plutchik's Wheel** | Robert Plutchik, 1980 | 8 | 2D wheel + 3단계 강도 | 시각적 직관성, 감정 혼합(dyad) 표현 | 문화적 편향, 복합감정 표현 한계 |
| **OCC Model** | Ortony/Clore/Collins, 1988 | 22 | 인지평가 기반 트리 | 상황-감정 인과관계 명확 | 시각화 어려움, 복잡한 구조 |
| **Geneva Emotion Wheel** | Klaus Scherer, 2002 | 20 | 원형 + 강도 동심원 | 인지평가(appraisal) 기반, 정밀 측정 | 학습 비용 높음 |
| **Hourglass of Emotions** | Cambria et al., 2012 | 24 | 4차원 (쾌적/주목/민감/적성) | 감성 컴퓨팅에 최적, NLP 활용 | 시각화 복잡 |
| **TONE (3-Tiered)** | Gaonkar et al., 2024 | 144 (6 primary) | 3-tier 계층 (Parrott 기반) | 가장 세밀한 분류, 3종 관계 타입 | 과도한 세분화 위험 |
| **Parrott's Hierarchy** | Gerrod Parrott, 2001 | 6 primary -> 25 secondary -> 100+ tertiary | 트리 구조 | 직관적 계층, 온톨로지 구축에 최적 | 문화적 보편성 미검증 |

### 1.2 Plutchik's Wheel 상세

Plutchik 모델은 **시각화에 가장 적합**한 구조:

- **8개 기본 감정**: Joy, Trust, Fear, Surprise, Sadness, Disgust, Anger, Anticipation
- **3단계 강도**: 각 감정에 약/중/강 (예: Annoyance -> Anger -> Rage)
- **감정 혼합(Dyad)**: 인접 감정 조합으로 복합감정 생성
  - Primary Dyad: Joy + Trust = Love
  - Secondary Dyad: Joy + Fear = Guilt
  - Tertiary Dyad: Joy + Surprise = Delight
- **시각적 특성**: 꽃잎(petal) 형태의 원형 배치, 대립 감정은 반대편에 위치
- **PyPlutchik**: Python 라이브러리로 Plutchik 시각화 구현 (matplotlib 기반, 웹 변환 필요)

**Sentimind 적합도: 높음** -- 현재 3-level 온톨로지와 구조적으로 유사하며, 원형 시각화가 모바일 터치에 적합

### 1.3 TONE 3-Tiered Ontology (2024, 최신 연구)

TONE은 Parrott의 감정 분류를 기반으로 한 3-tier 온톨로지:

- **Tier 1 (Primary)**: Anger, Fear, Joy, Love, Sadness, Surprise (6개)
- **Tier 2 (Secondary)**: Primary에 종속된 극단적 변형
- **Tier 3 (Tertiary)**: Secondary에 종속된 미세한 감정 변형
- **총 144개 감정 카테고리**
- **3종 관계 타입**:
  - `isOppositeOf`: 대립 관계 (예: Joy <-> Sadness)
  - `isComposedOf`: 계층 관계 (하위->상위 클래스 연결)
  - `plus-LeadsTo`: 결합 관계 (예: Anger + Compassion -> Joy)
- **평가 점수**: 인간 평가 4.5~4.95/5.0
- **성능**: 감정 탐지 정확도 97/100 (경쟁 방법 92/100 대비 우수)

**Sentimind 적합도: 매우 높음** -- 현재 `emotion-ontology.json`의 3-level 구조와 거의 동일. `isOppositeOf`, `plus-LeadsTo` 관계를 추가하면 그래프 시각화의 핵심 데이터 소스가 됨

### 1.4 Hourglass of Emotions

Cambria의 Hourglass 모델은 4개 독립 차원으로 감정을 수치화:

- **Pleasantness** (쾌적): 사용자의 즐거움 수준
- **Attention** (주목): 콘텐츠에 대한 관심 수준
- **Sensitivity** (민감): 상호작용 역학에 대한 편안함
- **Aptitude** (적성): 상호작용 이점에 대한 확신
- 각 차원에 6단계 활성화 수준
- 복합 감정 = 다른 차원의 동시 활성화 조합

**Sentimind 적합도: 중간** -- 4차원 레이더 차트로 시각화 가능하나, 일반 사용자에게 직관성 부족

### 1.5 Sentimind에 권장하는 하이브리드 모델

현재 `emotion-ontology.json` 구조를 기반으로 TONE의 관계 타입을 결합한 하이브리드 접근:

```
Level 1 (Valence): 긍정 / 중립 / 부정
Level 2 (Category): 기쁨, 안도감, 사랑, 불안, 슬픔, 분노 등
Level 3 (Specific): 만족감, 설렘, 희망, 긴장, 걱정 등

관계 타입:
- isOppositeOf: 기쁨 <-> 슬픔, 희망 <-> 절망
- transitionsTo: 불안 -> 안도감 (시간적 전이)
- coOccursWith: 설렘 + 긴장 (동시 발생)
- intensifiesTo: 걱정 -> 두려움 -> 공포 (강도 변화)
```

이 구조는 **그래프 시각화에 4종류의 엣지(edge)**를 제공하여 풍부한 네트워크 표현이 가능.

---

## 2. 웹 그래프 시각화 라이브러리 비교

### 2.1 라이브러리 상세 비교

| 라이브러리 | 번들 크기 (min+gz) | 렌더링 | 터치 지원 | 레이아웃 | 학습 곡선 | 라이선스 |
|-----------|-------------------|--------|----------|---------|----------|---------|
| **D3.js** (d3-force) | ~30KB (force 모듈만) | SVG/Canvas | 직접 구현 필요 | Force-directed | 높음 | BSD-3 |
| **Cytoscape.js** | ~280KB | Canvas | 내장 (touchTapThreshold) | 10+ 내장 레이아웃 | 중간 | MIT |
| **Force-graph** | ~50KB | Canvas (HTML5) | 제한적 | Force-directed | 낮음 | MIT |
| **Sigma.js** | ~100KB | WebGL | 제한적 | Force Atlas 2 | 중간 | MIT |
| **ccNetViz** | ~30KB | WebGL | 미지원 | Force, circular 등 | 중간 | GPL-3 |
| **vis-network** | ~200KB | Canvas | 내장 | 여러 알고리즘 | 낮음 | Apache-2.0 |
| **순수 Canvas/SVG** | 0KB | Canvas/SVG | 직접 구현 | 직접 구현 | 높음 (자유도 최고) | - |

### 2.2 성능 비교

- **SVG**: ~1,000 노드까지 양호. DOM 트리 유지로 메모리 부담, 이벤트 핸들링 용이
- **Canvas**: ~10,000 노드까지 양호. 픽셀 기반, 이벤트는 hit detection 필요
- **WebGL** (Sigma.js, ccNetViz): 수만 노드 처리 가능. GPU 가속, 모바일 호환성 주의

감정 그래프의 노드 수는 최대 30~50개 수준이므로 **SVG가 최적** (이벤트 핸들링 용이, 스타일링 자유도, CSS 애니메이션 호환)

### 2.3 Sentimind 맞춤 평가

**Vanilla JS + 외부 라이브러리 최소화** 원칙에 따른 3가지 전략:

#### 전략 A: 순수 SVG + CSS (권장 -- 0KB 의존성)

```javascript
// 감정 노드를 SVG circle로 렌더링
function renderEmotionNode(svg, emotion) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', emotion.x);
  circle.setAttribute('cy', emotion.y);
  circle.setAttribute('r', emotion.count * 3 + 10); // 빈도에 비례
  circle.setAttribute('fill', emotion.color);
  circle.classList.add('emotion-node');

  // 터치/클릭 이벤트
  circle.addEventListener('click', () => showEmotionDetail(emotion));
  circle.addEventListener('touchstart', handleTouch, { passive: true });

  svg.appendChild(circle);
}
```

```css
.emotion-node {
  transition: r 0.3s ease, fill 0.3s ease;
  cursor: pointer;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}
.emotion-node:hover {
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
  transform-origin: center;
}
```

- 장점: 제로 의존성, CSS 애니메이션 완벽 호환, 접근성(ARIA) 지원
- 단점: Force layout 직접 구현 필요
- 복잡도: 중간 (물리 시뮬레이션 제외 시 낮음)
- 예상 구현 시간: 3~5일

#### 전략 B: D3-force만 사용 (~8KB)

```html
<script src="https://cdn.jsdelivr.net/npm/d3-force@3/dist/d3-force.min.js"></script>
```

d3-force 모듈만 CDN으로 로드하여 물리 시뮬레이션 활용, 렌더링은 직접 SVG/Canvas로 수행.

```javascript
// d3-force로 노드 위치 계산만 수행
const simulation = d3.forceSimulation(nodes)
  .force('charge', d3.forceManyBody().strength(-100))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide().radius(d => d.radius + 5))
  .force('link', d3.forceLink(links).id(d => d.id).distance(80))
  .on('tick', () => renderGraph(nodes, links)); // 커스텀 SVG 렌더링
```

- 장점: 물리 시뮬레이션 품질, 작은 번들, SVG 직접 제어 유지
- 단점: D3 의존성 추가
- 복잡도: 중간
- 예상 구현 시간: 2~3일

#### 전략 C: 순수 Canvas + 커스텀 물리 (~0KB)

```javascript
// 간단한 force-directed 알고리즘 직접 구현
class SimpleForceLayout {
  constructor(nodes, links, options = {}) {
    this.nodes = nodes;
    this.links = links;
    this.repulsion = options.repulsion || 500;
    this.attraction = options.attraction || 0.01;
    this.damping = options.damping || 0.9;
  }

  tick() {
    // Coulomb's law (반발력)
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[j].x - this.nodes[i].x;
        const dy = this.nodes[j].y - this.nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = this.repulsion / (dist * dist);

        this.nodes[i].vx -= (dx / dist) * force;
        this.nodes[i].vy -= (dy / dist) * force;
        this.nodes[j].vx += (dx / dist) * force;
        this.nodes[j].vy += (dy / dist) * force;
      }
    }

    // Hooke's law (인력 -- 연결된 노드 간)
    for (const link of this.links) {
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      link.source.vx += dx * this.attraction;
      link.source.vy += dy * this.attraction;
      link.target.vx -= dx * this.attraction;
      link.target.vy -= dy * this.attraction;
    }

    // 감쇠 + 위치 업데이트
    for (const node of this.nodes) {
      node.vx *= this.damping;
      node.vy *= this.damping;
      node.x += node.vx;
      node.y += node.vy;
    }
  }
}
```

- 장점: 완전 제로 의존성, 완전한 제어
- 단점: 알고리즘 품질 제한, Canvas hit detection 직접 구현 필요
- 복잡도: 높음
- 예상 구현 시간: 5~7일

### 2.4 최종 추천: 전략 B (d3-force 모듈 + SVG 직접 렌더링)

**이유**:
1. d3-force는 ~8KB로 매우 가벼움
2. 물리 시뮬레이션 품질이 검증됨
3. SVG 렌더링을 직접 제어하면 CSS 애니메이션/변수와 완벽 호환
4. 프로젝트의 기존 CSS 변수 시스템 (`--color-primary` 등)과 자연스럽게 통합
5. 노드 수가 30~50개로 적어 SVG 성능 문제 없음

---

## 3. 기존 앱의 감정 시각화 UX 패턴

### 3.1 Daylio

- **핵심 패턴**: 5점 척도 이모지 선택 -> 컬러풀 차트 (주/월 추세선)
- **시각화 방식**: 선형 시계열 차트, 활동-감정 상관관계 바 차트, 캘린더 히트맵
- **핵심 UX 원칙**: "2-tap logging" -- 감정 + 활동을 2번 탭으로 기록
- **게이미피케이션**: 연속 기록 스트릭, 목표 설정
- **교훈**: 극도의 단순함이 리텐션의 핵심. 복잡한 시각화보다 "한눈에 패턴 파악"이 중요

### 3.2 How We Feel (Yale 감정 지능 센터)

- **핵심 패턴**: 2차원 감정 좌표 (쾌적/활성화 축)
- **시각화 방식**: 감정을 컬러 블롭(blob)으로 표현, 사분면 레이아웃
- **핵심 UX 원칙**: 감정 어휘 교육 -- 사용할수록 감정 표현이 풍부해짐
- **교훈**: 감정 자체를 시각적 오브젝트로 표현 (텍스트가 아닌 형태와 색으로)

### 3.3 Bearable

- **핵심 패턴**: 증상-감정-활동 상관관계 네트워크
- **시각화 방식**: 레이더 차트, 인과관계 화살표, 상관계수 시각화
- **교훈**: "원인-결과" 관계를 시각화하면 사용자 인사이트 품질이 높아짐

### 3.4 Reflectly

- **핵심 패턴**: AI 기반 저널링 + 감정 추적
- **시각화 방식**: 부드러운 그라데이션 배경, 감정 칩(chip), 주간 요약
- **핵심 UX 원칙**: "playful, smooth, engaging" 디자인
- **교훈**: 따뜻한 컬러 팔레트 + 부드러운 애니메이션이 감정 다이어리의 신뢰감 형성

### 3.5 Moodfit

- **핵심 패턴**: "감정 피트니스" 메타포 -- 감정 건강을 운동처럼 훈련
- **시각화 방식**: 진행률 바, 성장 차트
- **교훈**: 성장/발전 메타포가 긍정적 동기부여에 효과적

### 3.6 연구 기반 인사이트

**AffectAura** (Microsoft Research):
- 연속적 감정 추적 데이터를 타임라인 시각화
- 감정 상태를 컬러 버블로 표현
- 사용자가 시간을 앞뒤로 탐색하며 감정 경험 회상
- **핵심 발견**: 시각화가 감정 회상의 정확도를 크게 향상시킴

**아바타 vs 대시보드 연구**:
- 감정 데이터를 아바타로 시각화하면 대시보드보다 정서적 연결감이 높음
- 개인화된 시각적 표현이 데이터 차트보다 사용자 참여를 유도
- **Sentimind "마음이" 페르소나**와 연계 가능

### 3.7 종합 UX 원칙

1. **1초 파악**: 복잡한 그래프보다 한눈에 읽히는 시각화 우선
2. **감정 = 시각 오브젝트**: 텍스트가 아닌 색/형태/크기로 감정 표현
3. **시간 흐름 중심**: 감정의 변화와 패턴이 핵심 인사이트
4. **따뜻한 톤**: 분석적/임상적 느낌 배제, 부드럽고 따뜻한 시각 언어
5. **성장 서사**: 데이터를 "성장 이야기"로 프레이밍

---

## 4. 인터랙티브 그래프 기법

### 4.1 Force-Directed 클러스터링 그래프

**용도**: 감정 간 관계와 빈도를 네트워크로 시각화

```
구조:
- 노드: 감정 (크기 = 빈도, 색 = 발렌스)
- 엣지: 감정 간 관계 (두께 = 공동발생 빈도)
- 클러스터: 유사 감정이 자연스럽게 군집

인터랙션:
- 노드 탭: 감정 상세 정보 + 관련 일기 표시
- 핀치 줌: 확대/축소
- 드래그: 노드 위치 조정 (물리 시뮬레이션과 상호작용)
- 롱프레스: 감정 히스토리 타임라인 표시
```

**구현 복잡도**: 중간 (d3-force 사용 시)
**모바일 적합성**: 높음 (터치 이벤트 매핑 필요)

### 4.2 Radial/Circular 감정 휠

**용도**: Plutchik 기반 감정 분포 시각화

```
구조:
- 중심: "나" 또는 현재 감정
- 내부 원: Level 1 감정 (긍정/부정/중립)
- 중간 원: Level 2 감정 (기쁨, 불안, 슬픔 등)
- 외부 원: Level 3 감정 (만족감, 설렘, 긴장 등)
- 꽃잎 크기: 빈도에 비례

인터랙션:
- 섹터 탭: 해당 감정 카테고리 확대
- 회전 제스처: 시간대별 감정 분포 전환
- 중심 탭: 전체 요약 표시
```

**구현 예시 (SVG + CSS)**:

```javascript
function renderEmotionWheel(container, emotionData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 400 400');
  svg.setAttribute('class', 'emotion-wheel');

  const center = { x: 200, y: 200 };
  const emotions = emotionData.level2;

  emotions.forEach((emotion, i) => {
    const angle = (i / emotions.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 80 + emotion.frequency * 40; // 빈도에 따른 반지름

    // 꽃잎 모양의 path 생성
    const path = createPetalPath(center, angle, radius, emotions.length);
    path.setAttribute('fill', emotion.color);
    path.setAttribute('opacity', 0.7 + emotion.frequency * 0.3);
    path.classList.add('emotion-petal');
    path.dataset.emotion = emotion.name;

    // 라벨
    const labelX = center.x + Math.cos(angle) * (radius * 0.6);
    const labelY = center.y + Math.sin(angle) * (radius * 0.6);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', labelX);
    text.setAttribute('y', labelY);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'emotion-label');
    text.textContent = emotion.emoji + ' ' + emotion.korean;

    svg.appendChild(path);
    svg.appendChild(text);
  });

  container.appendChild(svg);
}
```

**구현 복잡도**: 중간~높음 (SVG path 계산)
**모바일 적합성**: 매우 높음 (viewBox 기반 반응형)

### 4.3 Timeline-Based 감정 흐름 그래프

**용도**: 시간에 따른 감정 변화 패턴 시각화

```
구조:
- X축: 시간 (일/주/월)
- Y축: 감정 발렌스 (-1 ~ +1)
- 노드: 각 일기 엔트리 (이모지 표시)
- 연결선: 감정 전이 (색 = 전이 방향)
- 배경 영역: 감정 영역 (녹색=긍정, 회색=중립, 파란색=부정)

인터랙션:
- 수평 스와이프: 시간 탐색
- 노드 탭: 해당 일기 상세 표시
- 핀치 줌: 시간 스케일 조정 (일 <-> 주 <-> 월)
```

**구현 복잡도**: 낮음~중간 (SVG path + CSS transform)
**모바일 적합성**: 매우 높음 (수평 스크롤 자연스러움)

### 4.4 Emotion Co-occurrence 네트워크

**용도**: 동시에 또는 연속으로 나타나는 감정 조합 발견

```
구조:
- 노드: 각 감정 (Level 2/3)
- 엣지: 동시발생 또는 연속발생 관계
- 엣지 두께: 관계 빈도 (빈번할수록 굵음)
- 엣지 색: 전이 방향 (긍정 전이 = 따뜻한 색, 부정 전이 = 차가운 색)
- 노드 크기: 해당 감정 빈도
- 노드 색: 감정 카테고리별 색상

인사이트 예시:
"불안 -> 안도감" 패턴이 12회 발견 -- "도전 후 성취감을 느끼는 패턴이에요"
"기쁨 + 설렘" 동시발생 8회 -- "새로운 시작에 긍정적으로 반응하시네요"
```

**구현 복잡도**: 중간 (d3-force 권장)
**모바일 적합성**: 높음

---

## 5. 게이미피케이션 요소

### 5.1 감정 별자리 (Emotion Constellation) -- 핵심 제안

사용자의 감정 기록을 **밤하늘의 별자리**로 시각화하는 메타포:

```
핵심 개념:
- 각 감정 기록 = 하나의 별 (star)
- 별의 밝기 = 감정 강도
- 별의 색 = 감정 카테고리 (따뜻한 노란색~차가운 파란색)
- 별 간 연결선 = 감정 관계 -> 별자리(constellation) 형성
- 시간이 지남에 따라 별자리가 성장

진행 시스템:
1. 새 감정 발견 -> "새로운 별을 발견했어요!" 알림
2. 감정 패턴 반복 -> "별자리가 완성되었어요!" (예: "도전의 별자리" = 긴장+설렘+안도)
3. 100일 기록 -> "당신만의 감정 은하가 탄생했어요!"

기술 구현:
- 배경: CSS radial-gradient (어두운 남색)
- 별: SVG circle + CSS glow animation (@keyframes twinkle)
- 연결선: SVG line + dash animation
- 신규 별 등장: CSS scale + opacity transition (0 -> 1)
```

**CSS 별 반짝임 애니메이션**:

```css
@keyframes twinkle {
  0%, 100% { opacity: 0.6; filter: drop-shadow(0 0 3px currentColor); }
  50% { opacity: 1; filter: drop-shadow(0 0 8px currentColor); }
}

.emotion-star {
  animation: twinkle 3s ease-in-out infinite;
  animation-delay: var(--twinkle-delay, 0s);
}

.emotion-star--new {
  animation: starAppear 1s ease-out forwards, twinkle 3s ease-in-out 1s infinite;
}

@keyframes starAppear {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
```

**구현 복잡도**: 중간
**"마음이" 페르소나 연계**: "오늘도 새로운 별이 당신의 하늘에 떠올랐어요" (마음이 멘트)

### 5.2 감정 정원 (Emotion Garden)

기존 앱 사례 (Voidpet Garden, Mood Garden)에서 검증된 메타포:

```
핵심 개념:
- 감정 기록 -> 씨앗 심기
- 연속 기록 -> 식물 성장 (새싹 -> 꽃봉오리 -> 꽃)
- 긍정 감정 -> 밝은 꽃 (해바라기, 벚꽃)
- 부정 감정 -> 은은한 꽃 (라벤더, 스노우드롭) -- 부정 감정도 아름다움
- 다양한 감정 -> 다채로운 정원

게이미피케이션 연구 효과 (PMC 논문):
- 세션 시간 60% 증가
- 사용자 이탈률 40% 감소
- 감정 건강에 대한 긍정적 동기부여

기술 구현:
- CSS 식물 성장 애니메이션 (height transition + clip-path)
- SVG 꽃 아이콘 (감정별 다른 디자인)
- CSS Grid로 정원 레이아웃
```

**구현 복잡도**: 높음 (SVG 에셋 + 애니메이션 다수)

### 5.3 감정 날씨 지도 (Emotion Weather Map)

```
핵심 개념:
- 현재 감정 = 오늘의 날씨
- 기쁨 = 맑음 (☀️), 슬픔 = 비 (🌧), 불안 = 구름 (☁️), 분노 = 폭풍 (⛈)
- 주간 예보 형식으로 7일 감정 표시
- 감정 변화 = 날씨 변화 애니메이션

기술 구현:
- CSS gradient background (감정별 하늘 색)
- CSS @keyframes rain, sunshine, cloud 애니메이션
- SVG 아이콘으로 날씨 심볼
```

**구현 복잡도**: 낮음~중간
**모바일 적합성**: 매우 높음 (친숙한 날씨 앱 UI)

### 5.4 업적 기반 감정 노드 잠금해제

```
핵심 개념:
- 처음에는 기본 6개 감정만 표시 (Level 1)
- 일기를 쓸수록 세부 감정이 "발견"됨 (Level 2, Level 3)
- 감정 어휘가 풍부해지는 과정 자체가 성장 경험

잠금해제 조건:
- "설렘" 발견: 기쁨 관련 일기 3회 작성
- "안도감" 발견: 부정->긍정 전이 패턴 2회 경험
- "노스탤지어" 발견: 과거 회상 관련 일기 5회 작성
- "경이로움" 발견: 전체 20개 감정 발견 + 30일 연속 기록

시각적 표현:
- 잠긴 감정: 흐릿한 실루엣 (opacity: 0.2, filter: blur(3px))
- 발견 순간: 반짝임 효과 + "마음이" 축하 메시지
- 발견된 감정: 풀 컬러 + 빛 효과
```

**기존 구현과의 연계**: 현재 "마음의 스펙트럼" (감정 어휘 성장 트래커)와 직접 통합 가능

### 5.5 게이미피케이션 구현 우선순위

| 요소 | 구현 복잡도 | 사용자 영향 | 기존 기능 연계 | 우선순위 |
|------|-----------|-----------|-------------|---------|
| 감정 별자리 | 중간 | 높음 | 통계/캘린더 | **P0** |
| 업적 잠금해제 | 낮음 | 높음 | 마음의 스펙트럼 | **P0** |
| 감정 날씨 지도 | 낮음 | 중간 | 캘린더 히트맵 | **P1** |
| 감정 정원 | 높음 | 높음 | 스트릭 시스템 | **P2** |

---

## 6. 실현 가능성 분석 및 구현 전략

### 6.1 Sentimind 현재 기술 스택과의 호환성

| 항목 | 현재 상태 | 그래프 시각화 요구 | 호환성 |
|------|---------|-----------------|--------|
| 프론트엔드 | Vanilla JS + ES Module | SVG/Canvas + CSS | 완벽 호환 |
| CSS 시스템 | CSS 변수 + components.css | CSS 애니메이션/변수 | 완벽 호환 |
| 데이터 구조 | emotion_hierarchy (JSONB) | 노드/엣지 데이터 | 변환 필요 |
| 감정 분류 | 3-level 온톨로지 | 계층적 그래프 | 직접 활용 가능 |
| related_emotions | TEXT[] in entries | 엣지 데이터 | 직접 활용 가능 |
| 다크 모드 | 웜 세피아 톤 | 별자리 테마 적합 | 완벽 연계 |
| 모바일 | 반응형 CSS | 터치 이벤트 | 구현 필요 |

### 6.2 데이터 파이프라인

현재 저장되는 데이터로 그래프 시각화에 필요한 정보를 추출할 수 있는지 분석:

```
entries 테이블에서 추출 가능한 그래프 데이터:

1. 노드 (감정):
   - emotion (VARCHAR 100) -> 노드 ID
   - emotion_hierarchy (JSONB: {level1, level2, level3}) -> 계층 정보
   - emoji (VARCHAR 10) -> 노드 아이콘

2. 엣지 (관계):
   - related_emotions (TEXT[]) -> 직접 연결
   - 시간순 정렬 -> 전이(transition) 엣지 계산
   - 같은 날 복수 엔트리 -> 동시발생(co-occurrence) 엣지

3. 메타데이터:
   - confidence_score -> 노드 불투명도
   - created_at -> 시간축 위치
   - COUNT(*) GROUP BY emotion -> 노드 크기
```

**결론**: 현재 DB 스키마로 그래프 시각화에 필요한 데이터를 **100% 추출 가능**. 추가 테이블이나 스키마 변경 불필요.

### 6.3 필요한 새 API 엔드포인트

```
GET /api/stats/emotion-graph?period=30d

응답 구조:
{
  "nodes": [
    {
      "id": "만족감",
      "level": 3,
      "parent": "기쁨",
      "grandparent": "긍정",
      "emoji": "😌",
      "count": 8,
      "avgConfidence": 85,
      "firstSeen": "2026-01-15",
      "lastSeen": "2026-03-08"
    }
  ],
  "edges": [
    {
      "source": "불안",
      "target": "안도감",
      "type": "transitionsTo",
      "count": 5,
      "avgDaysBetween": 1.2
    },
    {
      "source": "설렘",
      "target": "긴장",
      "type": "coOccursWith",
      "count": 3
    }
  ],
  "constellations": [
    {
      "name": "도전의 별자리",
      "emotions": ["긴장", "설렘", "안도감"],
      "pattern": "도전 -> 성취",
      "count": 4
    }
  ],
  "meta": {
    "totalEntries": 45,
    "uniqueEmotions": 12,
    "dominantEmotion": "만족감",
    "emotionDiversity": 0.73
  }
}
```

### 6.4 구현 로드맵

#### Phase 1: 감정 네트워크 기본 (3~5일)

- [ ] `GET /api/stats/emotion-graph` API 엔드포인트 구현
- [ ] entries 테이블에서 노드/엣지 데이터 집계 SQL/로직
- [ ] SVG 기반 감정 네트워크 그래프 렌더러 (public/js/emotion-graph.js)
- [ ] d3-force CDN 추가 (8KB)
- [ ] 기본 터치 인터랙션 (탭, 드래그)
- [ ] 다크 모드 호환 스타일링

#### Phase 2: 별자리 + 게이미피케이션 (3~5일)

- [ ] 감정 별자리 테마 (다크 모드에서 별자리 배경)
- [ ] 별 반짝임 CSS 애니메이션
- [ ] 새 감정 발견 알림 ("마음이" 페르소나 멘트)
- [ ] 업적 기반 감정 노드 잠금해제 로직
- [ ] 마음의 스펙트럼과 통합

#### Phase 3: 시간 흐름 시각화 (2~3일)

- [ ] 감정 전이 타임라인 (수평 스크롤)
- [ ] 주간/월간 감정 패턴 요약
- [ ] 감정 날씨 지도 위젯

#### Phase 4: 고급 인사이트 (2~3일)

- [ ] 감정 동시발생 패턴 분석
- [ ] AI 기반 패턴 해석 (Gemini 연동)
- [ ] 감정 성장 리포트

**총 예상 구현 시간: 10~16일**

### 6.5 CSS-Only 가능 범위

외부 라이브러리 없이 순수 CSS로 구현 가능한 것들:

| 요소 | CSS-Only 가능 여부 | 기법 |
|------|------------------|------|
| 별 반짝임 | 가능 | `@keyframes` + `filter: drop-shadow` + `animation-delay` |
| 그라데이션 배경 전환 | 가능 | `@property` + CSS 변수 애니메이션 (2025 지원) |
| 블롭(blob) 형태 변형 | 가능 | `border-radius` 다중값 + `@keyframes` |
| 노드 호버 효과 | 가능 | `transition` + `transform` |
| 연결선 그리기 애니메이션 | 가능 | SVG `stroke-dasharray` + `stroke-dashoffset` 애니메이션 |
| 감정별 컬러 테마 전환 | 가능 | CSS 변수 토글 (`data-emotion` 속성) |
| 원형 레이아웃 | 가능 | CSS `transform: rotate() translateX()` |
| Force-directed 레이아웃 | 불가능 | JavaScript 물리 시뮬레이션 필수 |
| 드래그 인터랙션 | 불가능 | JavaScript touch/mouse 이벤트 필수 |
| 동적 데이터 바인딩 | 불가능 | JavaScript DOM 조작 필수 |

**결론**: 시각적 연출의 ~60%는 CSS-Only 가능, 레이아웃 계산과 인터랙션은 JavaScript 필수

---

## 7. Sentimind 맞춤 제안

### 7.1 "마음의 별자리" (Heart Constellation) -- 최종 제안

Sentimind의 "마음이" 페르소나, 웜 세피아 톤 디자인, 한국 사용자 감성에 최적화된 통합 시각화 제안:

**핵심 컨셉**: "당신이 기록한 감정들이 밤하늘의 별자리가 됩니다"

```
시각적 계층:

[다크 모드 배경 = 밤하늘]
  |
  +-- 별(Star) = 개별 감정 기록
  |     크기: 감정 강도 (confidence_score)
  |     색: 감정 카테고리 (웜톤 그라데이션)
  |     밝기: 최근일수록 밝음
  |
  +-- 별자리 선(Constellation Line) = 감정 관계
  |     실선: 직접 연결 (related_emotions)
  |     점선: 시간적 전이 (transitionsTo)
  |     색: 전이 방향 (긍정 = 금색, 부정 = 은색)
  |
  +-- 별자리 이름 = 감정 패턴
  |     "도전의 별자리" = 긴장 + 설렘 + 안도감
  |     "성장의 별자리" = 슬픔 + 배움 + 희망
  |     "사랑의 별자리" = 따뜻함 + 감사 + 기쁨
  |
  +-- 중심 (나) = 현재 감정 상태
        따뜻한 빛 (radial-gradient glow)
```

**"마음이" 페르소나 연동 메시지 예시**:

```
최초 방문: "여기는 당신만의 감정 밤하늘이에요. 일기를 쓸 때마다 새로운 별이 떠올라요."
새 별 발견: "오늘 '설렘'이라는 새로운 별을 찾았어요! 당신의 하늘이 더 빛나고 있어요."
별자리 완성: "'도전의 별자리'가 완성되었어요. 당신은 도전 앞에서 성장하는 사람이에요."
100일 기록: "100개의 별이 모여 당신만의 은하가 탄생했어요. 정말 아름다운 마음이에요."
```

### 7.2 기술 아키텍처 (최종)

```
public/js/emotion-graph.js (신규, ~300줄)
  |
  +-- EmotionGraphRenderer class
  |     - SVG 기반 렌더링
  |     - d3-force 물리 시뮬레이션 (CDN, ~8KB)
  |     - 터치 이벤트 핸들링
  |     - CSS 변수 기반 테마 연동
  |
  +-- ConstellationDetector class
  |     - 감정 패턴 매칭 (entries 기반)
  |     - 별자리 이름/설명 매핑
  |     - 잠금해제 조건 평가
  |
  +-- EmotionGraphAPI module
        - GET /api/stats/emotion-graph 호출
        - 데이터 캐싱 (sessionStorage)

public/css/components.css (확장)
  |
  +-- .emotion-graph-* 스타일
  +-- @keyframes twinkle, starAppear, constellationDraw
  +-- 다크 모드 별자리 테마 변수

routes/stats.js (확장)
  |
  +-- GET /api/stats/emotion-graph
        - 노드/엣지 집계
        - 별자리 패턴 매칭
        - 기간 필터 (7d/30d/90d/all)
```

### 7.3 반응형 / 모바일 전략

```css
/* 모바일 최적화 */
.emotion-graph-container {
  width: 100%;
  aspect-ratio: 1; /* 정사각형 영역 */
  touch-action: none; /* 브라우저 제스처 방지 */
  overflow: hidden;
}

.emotion-graph-container svg {
  width: 100%;
  height: 100%;
}

/* 작은 화면: 노드 라벨 숨김, 탭 시 표시 */
@media (max-width: 480px) {
  .emotion-label { display: none; }
  .emotion-node:focus .emotion-label,
  .emotion-node.active .emotion-label { display: block; }

  /* 터치 영역 확대 */
  .emotion-node { min-width: 44px; min-height: 44px; }
}
```

### 7.4 접근성 고려사항

```html
<!-- ARIA 속성으로 스크린 리더 지원 -->
<svg role="img" aria-label="감정 별자리 그래프">
  <title>나의 감정 별자리</title>
  <desc>지난 30일간 기록된 12개 감정의 관계를 별자리로 시각화한 그래프</desc>

  <g role="list" aria-label="감정 노드들">
    <circle role="listitem" aria-label="만족감 - 8회 기록" tabindex="0" />
    <circle role="listitem" aria-label="설렘 - 5회 기록" tabindex="0" />
  </g>
</svg>
```

### 7.5 데이터 변환 예시

현재 entries 테이블 데이터 -> 그래프 데이터 변환:

```javascript
// routes/stats.js 확장
async function buildEmotionGraph(userId, period) {
  // 1. 기간 내 엔트리 조회
  const { data: entries } = await supabase
    .from('entries')
    .select('emotion, emotion_hierarchy, related_emotions, confidence_score, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('created_at', periodStart)
    .order('created_at', { ascending: true });

  // 2. 노드 집계
  const nodeMap = {};
  entries.forEach(entry => {
    const emotion = entry.emotion;
    if (!nodeMap[emotion]) {
      nodeMap[emotion] = {
        id: emotion,
        level: entry.emotion_hierarchy?.level2 ? 2 : 1,
        parent: entry.emotion_hierarchy?.level1 || '중립',
        emoji: entry.emoji || '💭',
        count: 0,
        totalConfidence: 0,
        firstSeen: entry.created_at,
        lastSeen: entry.created_at,
      };
    }
    nodeMap[emotion].count++;
    nodeMap[emotion].totalConfidence += entry.confidence_score || 0;
    nodeMap[emotion].lastSeen = entry.created_at;
  });

  // 3. 엣지 계산 (전이 패턴)
  const edgeMap = {};
  for (let i = 0; i < entries.length - 1; i++) {
    const source = entries[i].emotion;
    const target = entries[i + 1].emotion;
    if (source === target) continue;

    const key = `${source}->${target}`;
    if (!edgeMap[key]) {
      edgeMap[key] = { source, target, type: 'transitionsTo', count: 0 };
    }
    edgeMap[key].count++;
  }

  // 4. 동시발생 엣지 (related_emotions)
  entries.forEach(entry => {
    if (entry.related_emotions?.length) {
      entry.related_emotions.forEach(related => {
        const key = `${entry.emotion}<->${related}`;
        const reverseKey = `${related}<->${entry.emotion}`;
        if (!edgeMap[key] && !edgeMap[reverseKey]) {
          edgeMap[key] = { source: entry.emotion, target: related, type: 'coOccursWith', count: 1 };
        }
      });
    }
  });

  // 5. 별자리 패턴 감지
  const constellations = detectConstellations(entries, edgeMap);

  return {
    nodes: Object.values(nodeMap).map(n => ({
      ...n,
      avgConfidence: Math.round(n.totalConfidence / n.count),
    })),
    edges: Object.values(edgeMap).filter(e => e.count >= 2), // 2회 이상만
    constellations,
    meta: {
      totalEntries: entries.length,
      uniqueEmotions: Object.keys(nodeMap).length,
      dominantEmotion: Object.values(nodeMap).sort((a, b) => b.count - a.count)[0]?.id,
    },
  };
}

function detectConstellations(entries, edgeMap) {
  // 미리 정의된 별자리 패턴
  const patterns = [
    {
      name: '도전의 별자리',
      description: '도전 앞에서 성장하는 패턴',
      emotions: ['긴장', '불안', '설렘', '안도감'],
      minMatch: 3,
    },
    {
      name: '성장의 별자리',
      description: '어려움을 통해 배우는 패턴',
      emotions: ['슬픔', '아쉬움', '배움', '희망'],
      minMatch: 3,
    },
    {
      name: '사랑의 별자리',
      description: '따뜻한 관계에서 행복을 느끼는 패턴',
      emotions: ['따뜻함', '감사', '기쁨', '사랑'],
      minMatch: 3,
    },
    {
      name: '회복의 별자리',
      description: '힘든 시기를 견디고 회복하는 패턴',
      emotions: ['지침', '슬픔', '안도감', '만족감'],
      minMatch: 3,
    },
  ];

  const userEmotions = new Set(entries.map(e => e.emotion));

  return patterns
    .map(pattern => {
      const matched = pattern.emotions.filter(e => userEmotions.has(e));
      return {
        ...pattern,
        matchedEmotions: matched,
        completionRate: matched.length / pattern.emotions.length,
        isComplete: matched.length >= pattern.minMatch,
      };
    })
    .filter(p => p.matchedEmotions.length >= 2); // 최소 2개 매칭
}
```

---

## 8. 참고문헌

### 감정 온톨로지 모델

1. Plutchik, R. (1980). A general psychoevolutionary theory of emotion. *Theories of emotion*. Academic Press.
   - PyPlutchik 구현: https://github.com/alfonsosemeraro/pyplutchik

2. Gaonkar, S. et al. (2024). TONE: A 3-Tiered ONtology for Emotion analysis. *IEEE Access*.
   - https://arxiv.org/abs/2401.06810

3. Cambria, E. et al. (2012). The Hourglass of Emotions. *Cognitive Behavioural Systems*.
   - https://sentic.net/hourglass-of-emotions.pdf

4. Scherer, K.R. (2002). Geneva Emotion Wheel.
   - 비교 분석: https://wheelofemotions.com/plutchik-vs-geneva-the-ultimate-showdown-of-2-emotion-wheels-that-will-transform-your-emotional-intelligence-today/

5. Parrott, W. G. (2001). Emotions in social psychology. Psychology Press.

### 그래프 시각화 라이브러리

6. Force-graph (Canvas 기반): https://github.com/vasturiano/force-graph

7. Cytoscape.js: https://js.cytoscape.org/

8. D3-force 모듈: https://github.com/d3/d3-force

9. Sigma.js (WebGL): https://www.sigmajs.org/

10. ccNetViz (WebGL 경량): https://github.com/HelikarLab/ccNetViz

11. 라이브러리 비교: https://www.cylynx.io/blog/a-comparison-of-javascript-graph-network-visualisation-libraries/

12. d3-celestial (별자리 시각화): https://github.com/ofrohn/d3-celestial

### UX 패턴 및 앱 분석

13. Daylio 분석: https://www.clustox.com/blog/mood-tracker-apps/

14. Daylio 의학적 리뷰: https://pmc.ncbi.nlm.nih.gov/articles/PMC5344152/

### 게이미피케이션 연구

15. Voidpet Garden (감정 정원): https://apps.apple.com/us/app/voidpet-garden-mental-health/id1668932264

16. 게이미피케이션 효과 메타분석: https://pmc.ncbi.nlm.nih.gov/articles/PMC8669581/

17. 감정 앱 게이미피케이션: https://www.hashstudioz.com/blog/mental-health-meets-gamification-designing-emotionally-intelligent-apps/

### CSS 기법

18. CSS gradient 애니메이션: https://dev.to/afif/we-can-finally-animate-css-gradient-kdk

19. Pure CSS blob 애니메이션: https://dev.to/prahalad/pure-css-blob-animation-no-svg-no-js-2f4m

20. CSS blob 효과 모음: https://freefrontend.com/css-blob-effects/

### 감정 추적 연구

21. 감정 지식 그래프 모델링 (ACM 2025): https://dl.acm.org/doi/10.1145/3731806.3731811

22. 소셜 그래프 감정 예측: https://www.nature.com/articles/s41598-023-33825-9

23. 감정 그래프 컨볼루션 네트워크: https://pmc.ncbi.nlm.nih.gov/articles/PMC12148580/

24. 무드 트래킹 앱 사용자 연구: https://pmc.ncbi.nlm.nih.gov/articles/PMC8387890/

25. 자기추적 시각화에서 감정의 역할 (아바타 vs 대시보드): ResearchGate Publication 347804497

### 한국어 감정 분석

26. KoreanSentimentAnalyzer: https://github.com/mrlee23/KoreanSentimentAnalyzer

27. 한국어 다중분류 감성분석: https://github.com/JH-lee95/Korean-Sentiments-Classification

28. Korean Emotion Analysis: https://github.com/lydiahjchung/korean-emotion-analysis

---

## 부록: 구현 복잡도 요약

| 기능 | 복잡도 | 시간 | 의존성 | 우선순위 |
|------|--------|------|--------|---------|
| 감정 네트워크 그래프 (SVG + d3-force) | 중간 | 3~5일 | d3-force (~8KB CDN) | **P0** |
| 별자리 테마 (CSS 애니메이션) | 낮음 | 1~2일 | 없음 | **P0** |
| 감정 노드 잠금해제 | 낮음 | 1~2일 | 없음 | **P0** |
| "마음이" 별자리 메시지 | 낮음 | 0.5일 | 없음 | **P0** |
| 감정 전이 타임라인 | 중간 | 2~3일 | 없음 | **P1** |
| 감정 날씨 지도 | 낮음~중간 | 1~2일 | 없음 | **P1** |
| 감정 원형 휠 (Plutchik) | 중간~높음 | 3~4일 | 없음 | **P2** |
| 감정 정원 메타포 | 높음 | 5~7일 | SVG 에셋 | **P3** |
| API: emotion-graph 엔드포인트 | 중간 | 1~2일 | 없음 | **P0** |
| 데이터 변환 + 캐싱 | 낮음 | 1일 | 없음 | **P0** |
