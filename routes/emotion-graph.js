// ---------------------------------------------------------------------------
// Emotion Graph Route (/api/stats/emotion-graph)
// 감정 별자리 그래프 데이터 생성 — 노드(감정), 엣지(전환/연관), 별자리 패턴
// ---------------------------------------------------------------------------

const express = require('express');

// 사전 정의된 별자리 패턴
const CONSTELLATION_PATTERNS = [
  { name: '도전의 별자리', description: '도전 앞에서 성장하는 패턴', emotions: ['긴장', '설렘', '안도감', '자신감'], minMatch: 3 },
  { name: '성장의 별자리', description: '어려움을 통해 배우는 패턴', emotions: ['슬픔', '후회', '희망', '만족감'], minMatch: 3 },
  { name: '사랑의 별자리', description: '따뜻한 관계에서 행복을 느끼는 패턴', emotions: ['따뜻함', '감사', '기쁨', '사랑'], minMatch: 3 },
  { name: '회복의 별자리', description: '힘든 시기를 견디고 회복하는 패턴', emotions: ['피곤함', '슬픔', '안도감', '만족감'], minMatch: 3 },
  { name: '탐구의 별자리', description: '호기심으로 세상을 탐색하는 패턴', emotions: ['흥미', '설렘', '기쁨', '자신감'], minMatch: 3 },
  { name: '평온의 별자리', description: '내면의 평화를 찾아가는 패턴', emotions: ['불안', '평온', '감사', '안도감'], minMatch: 3 },
];

// 감정 별칭 매핑 — 유사 표현을 정식 감정명으로 통합
const EMOTION_ALIASES = {
  '피곤함': ['피곤', '지침', '피로', '무기력'],
  '안도감': ['안도', '홀가분'],
  '만족감': ['만족', '뿌듯함'],
  '따뜻함': ['따뜻', '온기'],
  '평온': ['편안함', '편안', '안정'],
  '기쁨': ['행복', '즐거움'],
  '슬픔': ['우울', '외로움'],
  '불안': ['걱정', '두려움'],
};

// 역방향 별칭 맵 — 별칭 → 정식 감정명
const ALIAS_TO_CANONICAL = {};
for (const [canonical, aliases] of Object.entries(EMOTION_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL[alias] = canonical;
  }
}

/**
 * 감정명을 정식 감정명으로 정규화 (별칭 처리)
 * @param {string} emotion
 * @returns {string}
 */
function canonicalize(emotion) {
  return ALIAS_TO_CANONICAL[emotion] || emotion;
}

/**
 * 사용자의 기록된 감정 집합에서 특정 감정(별칭 포함)이 있는지 확인
 * @param {Set<string>} recordedSet - 사용자가 기록한 정규화된 감정 집합
 * @param {string} emotion - 확인할 감정명 (별자리 패턴의 원본)
 * @returns {boolean}
 */
function hasEmotion(recordedSet, emotion) {
  if (recordedSet.has(emotion)) return true;
  // 별칭도 확인
  const aliases = EMOTION_ALIASES[emotion] || [];
  return aliases.some(alias => recordedSet.has(alias));
}

/**
 * period 파라미터에서 시작 날짜 ISO 문자열 계산
 * @param {string} period - '7d' | '30d' | '90d' | 'all'
 * @returns {string|null} ISO 문자열 또는 null (all인 경우)
 */
function calcPeriodStart(period) {
  const DAYS = { '7d': 7, '30d': 30, '90d': 90 };
  const days = DAYS[period];
  if (!days) return null; // 'all'
  return new Date(Date.now() - days * 86400000).toISOString();
}

module.exports = function (deps) {
  const router = express.Router();
  const { logger, requestId, optionalAuth } = deps;

  // GET /stats/emotion-graph?period=30d
  router.get('/stats/emotion-graph', optionalAuth, async (req, res) => {
    const rid = req.rid || requestId();

    // period 유효성 검사
    const VALID_PERIODS = new Set(['7d', '30d', '90d', 'all']);
    const period = req.query.period || '30d';
    if (!VALID_PERIODS.has(period)) {
      return res.status(400).json({
        error: "period 파라미터는 '7d', '30d', '90d', 'all' 중 하나여야 합니다.",
        code: 'VALIDATION_ERROR',
      });
    }

    logger.info('GET /api/stats/emotion-graph', { requestId: rid, userId: req.user?.id, period });

    // 게스트 모드 — 빈 구조 반환
    if (!req.user) {
      return res.json({
        nodes: [],
        edges: [],
        constellations: [],
        meta: { totalEntries: 0, uniqueEmotions: 0 },
      });
    }

    try {
      // Supabase에서 entries 조회
      const periodStart = calcPeriodStart(period);
      let query = req.supabaseClient
        .from('entries')
        .select('emotion, emoji, emotion_hierarchy, related_emotions, confidence_score, created_at')
        .eq('user_id', req.user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (periodStart) {
        query = query.gte('created_at', periodStart);
      }

      const { data: entries, error } = await query;

      if (error) {
        logger.error('감정 그래프 entries 조회 실패', { requestId: rid, error: error.message });
        return res.status(500).json({ error: '데이터 조회에 실패했습니다.', code: 'INTERNAL_ERROR' });
      }

      // 빈 entries 처리
      if (!entries || entries.length === 0) {
        return res.json({
          nodes: [],
          edges: [],
          constellations: [],
          meta: { totalEntries: 0, uniqueEmotions: 0 },
        });
      }

      // -----------------------------------------------------------------------
      // 1. 노드 구성 — 감정별 집계
      // -----------------------------------------------------------------------
      const nodeMap = {}; // emotion → { id, level, parent, emoji, count, firstSeen, lastSeen }

      for (const entry of entries) {
        const rawEmotion = entry.emotion;
        if (!rawEmotion) continue;
        const emotion = canonicalize(rawEmotion);

        if (!nodeMap[emotion]) {
          // emotion_hierarchy: { level1: '긍정', level2: '만족감' } 형태 또는 null
          const hierarchy = entry.emotion_hierarchy || {};
          const level1 = hierarchy.level1 || null;
          const level2 = hierarchy.level2 || null;

          // level 결정: level2가 있으면 2단계 감정, level1만 있으면 1단계
          const level = level2 ? 2 : (level1 ? 1 : 0);
          const parent = level2 ? level1 : null;

          nodeMap[emotion] = {
            id: emotion,
            level,
            parent,
            emoji: entry.emoji || '',
            count: 0,
            firstSeen: entry.created_at,
            lastSeen: entry.created_at,
          };
        }

        nodeMap[emotion].count += 1;
        // lastSeen 갱신 (entries가 created_at 오름차순이므로 순서대로 덮어쓰면 됨)
        nodeMap[emotion].lastSeen = entry.created_at;
      }

      // -----------------------------------------------------------------------
      // 2. 엣지 구성
      // -----------------------------------------------------------------------
      // (a) transitionsTo — 연속 항목 간 감정 전환
      const transitionMap = {}; // "source|target" → count

      for (let i = 0; i < entries.length - 1; i++) {
        const srcEmotion = canonicalize(entries[i].emotion || '');
        const tgtEmotion = canonicalize(entries[i + 1].emotion || '');
        if (!srcEmotion || !tgtEmotion || srcEmotion === tgtEmotion) continue;

        const key = `${srcEmotion}|${tgtEmotion}`;
        transitionMap[key] = (transitionMap[key] || 0) + 1;
      }

      const transitionEdges = Object.entries(transitionMap)
        .filter(([, count]) => count >= 2)
        .map(([key, count]) => {
          const [source, target] = key.split('|');
          return { source, target, type: 'transitionsTo', count };
        });

      // (b) relatedTo — related_emotions 필드에서 연관 감정 엣지
      // 양방향 중복 제거를 위해 정규화된 키 사용 (알파벳 정렬)
      const relatedMap = {}; // "a|b" (a < b 알파벳 기준) → count

      for (const entry of entries) {
        const srcEmotion = canonicalize(entry.emotion || '');
        if (!srcEmotion) continue;

        const relatedEmotions = entry.related_emotions;
        if (!Array.isArray(relatedEmotions) || relatedEmotions.length === 0) continue;

        for (const related of relatedEmotions) {
          const canonRelated = canonicalize(related);
          if (!canonRelated || canonRelated === srcEmotion) continue;

          // 양방향 중복 방지: 사전순 정렬로 키 정규화
          const [a, b] = srcEmotion < canonRelated ? [srcEmotion, canonRelated] : [canonRelated, srcEmotion];
          const key = `${a}|${b}`;
          relatedMap[key] = (relatedMap[key] || 0) + 1;
        }
      }

      const relatedEdges = Object.entries(relatedMap)
        .filter(([, count]) => count >= 1)
        .map(([key, count]) => {
          const [source, target] = key.split('|');
          return { source, target, type: 'relatedTo', count };
        });

      const edges = [...transitionEdges, ...relatedEdges];

      // -----------------------------------------------------------------------
      // 3. 별자리 탐지
      // -----------------------------------------------------------------------
      // 사용자가 기록한 감정 집합 (정규화 포함)
      const recordedEmotions = new Set(Object.keys(nodeMap));

      const constellations = CONSTELLATION_PATTERNS
        .map(pattern => {
          const matched = pattern.emotions.filter(e => hasEmotion(recordedEmotions, e));
          return {
            name: pattern.name,
            description: pattern.description,
            emotions: pattern.emotions,
            matched,
            progress: matched.length / pattern.emotions.length,
            complete: matched.length >= pattern.minMatch,
          };
        })
        .filter(c => c.matched.length >= 2);

      // -----------------------------------------------------------------------
      // 4. 메타 정보
      // -----------------------------------------------------------------------
      // 빈도순 정렬 + 최대 50개 노드 제한
      const nodes = Object.values(nodeMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

      // 제한된 노드 집합에 속하는 엣지만 포함
      const nodeIds = new Set(nodes.map(n => n.id));
      const filteredEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

      // 가장 많이 기록된 감정
      let dominantEmotion = null;
      if (nodes.length > 0) {
        dominantEmotion = nodes.reduce((max, n) => (n.count > max.count ? n : max), nodes[0]).id;
      }

      const meta = {
        totalEntries: entries.length,
        uniqueEmotions: nodes.length,
        dominantEmotion,
      };

      logger.info('감정 그래프 생성 완료', {
        requestId: rid,
        totalEntries: meta.totalEntries,
        uniqueEmotions: meta.uniqueEmotions,
        edgeCount: edges.length,
        constellationCount: constellations.length,
        period,
      });

      res.set('Cache-Control', 'private, max-age=60');
      return res.json({ nodes, edges: filteredEdges, constellations, meta });
    } catch (err) {
      logger.error('감정 그래프 생성 오류', { requestId: rid, error: err.message });
      return res.status(500).json({ error: '감정 그래프 생성에 실패했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
