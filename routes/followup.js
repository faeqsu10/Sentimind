// ---------------------------------------------------------------------------
// Follow-up Questions Route (/api/followup)
// AI 후속 질문 — 탐색→통찰→행동 3단계 감정 심층 대화
// ---------------------------------------------------------------------------

const express = require('express');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    optionalAuth,
    config, GEMINI_API_KEY,
    callGeminiAPI, GeminiAPIError,
    analyzeLimiter,
  } = deps;

  const FOLLOWUP_STAGES = {
    explore: {
      label: '탐색',
      systemPrompt: `당신은 따뜻하고 공감 능력이 뛰어난 감정 상담사 '마음이'입니다.
사용자가 감정 분석 결과를 받은 후 후속 대화를 요청했습니다.

현재 단계: 탐색 (Exploration)
목표: 감정을 더 깊이 이해하기 위한 부드러운 질문을 합니다.

규칙:
- 반드시 한국어로 답변
- 1~2개의 짧은 탐색 질문을 합니다
- 공감적이고 비판단적인 톤을 유지합니다
- 150자 이내로 답변합니다
- JSON 형식: {"question": "탐색 질문", "empathy": "공감 메시지 한 줄"}`,
    },
    insight: {
      label: '통찰',
      systemPrompt: `당신은 따뜻하고 공감 능력이 뛰어난 감정 상담사 '마음이'입니다.
사용자가 감정 탐색 후 통찰 단계에 있습니다.

현재 단계: 통찰 (Insight)
목표: 사용자의 답변에서 패턴이나 의미를 부드럽게 짚어줍니다.

규칙:
- 반드시 한국어로 답변
- 사용자의 답변에서 발견한 통찰을 공유합니다
- 강요하지 않고 제안하는 톤을 유지합니다
- 200자 이내로 답변합니다
- JSON 형식: {"insight": "통찰 메시지", "question": "한 걸음 더 나아가는 질문"}`,
    },
    action: {
      label: '행동',
      systemPrompt: `당신은 따뜻하고 공감 능력이 뛰어난 감정 상담사 '마음이'입니다.
사용자가 감정 탐색과 통찰을 거쳐 행동 단계에 있습니다.

현재 단계: 행동 (Action)
목표: 작고 실천 가능한 행동을 제안합니다.

규칙:
- 반드시 한국어로 답변
- 구체적이고 작은 행동 1~2개를 제안합니다
- 부담스럽지 않은 톤을 유지합니다
- 대화를 따뜻하게 마무리합니다
- 200자 이내로 답변합니다
- JSON 형식: {"action": "제안하는 행동", "closing": "따뜻한 마무리 메시지"}`,
    },
  };

  // POST /followup - AI 후속 질문
  router.post('/followup', optionalAuth, analyzeLimiter, async (req, res) => {
    const rid = requestId();
    const startTime = Date.now();

    if (!req.body) {
      return res.status(400).json({ error: 'JSON 형식의 요청 본문이 필요합니다.', code: 'VALIDATION_ERROR' });
    }

    const { stage, emotion, originalText, userReply, context } = req.body;

    if (!stage || !FOLLOWUP_STAGES[stage]) {
      return res.status(400).json({ error: '유효한 단계가 필요합니다 (explore/insight/action).', code: 'VALIDATION_ERROR' });
    }

    if (!emotion || typeof emotion !== 'string' || emotion.length > 50) {
      return res.status(400).json({ error: '유효한 감정 정보가 필요합니다.', code: 'VALIDATION_ERROR' });
    }

    if (userReply && (typeof userReply !== 'string' || userReply.length > 2000)) {
      return res.status(400).json({ error: '답변이 너무 깁니다.', code: 'VALIDATION_ERROR' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.', code: 'INTERNAL_ERROR' });
    }

    const stageConfig = FOLLOWUP_STAGES[stage];

    // Sanitize and limit context array (max 10 items)
    const safeContext = (Array.isArray(context) ? context : [])
      .slice(0, 10)
      .filter(c => c && (c.role === 'ai' || c.role === 'user') && typeof c.text === 'string')
      .map(c => ({ role: c.role, text: c.text.slice(0, 500) }));

    // Build conversation context
    const safeOriginal = (typeof originalText === 'string' ? originalText : '').slice(0, 500);
    const safeEmotion = emotion.slice(0, 50);
    let userPrompt = `원래 일기: "${safeOriginal}"
감정: ${safeEmotion}`;

    if (safeContext.length > 0) {
      userPrompt += '\n\n이전 대화:\n';
      safeContext.forEach(c => {
        userPrompt += `- ${c.role === 'ai' ? '마음이' : '사용자'}: ${c.text}\n`;
      });
    }

    if (userReply) {
      userPrompt += `\n사용자의 답변: "${userReply.slice(0, 500)}"`;
    }

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: stageConfig.systemPrompt }] },
      generationConfig: {
        maxOutputTokens: config.followup.maxOutputTokens,
        temperature: config.followup.temperature,
        thinkingConfig: { thinkingBudget: config.gemini.thinkingBudget },
      },
    };

    try {
      const { content } = await callGeminiAPI(requestBody, { rid, label: '후속 질문 (' + stageConfig.label + ')' });

      // Parse JSON response
      let parsed;
      try {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        parsed = JSON.parse(jsonStr);
      } catch {
        // Fallback: treat as plain text
        parsed = { question: content.slice(0, 300) };
      }

      const duration = Date.now() - startTime;
      logger.info('후속 질문 생성 완료', { requestId: rid, stage, emotion, duration: duration + 'ms' });

      return res.json({ stage, ...parsed });
    } catch (err) {
      const duration = Date.now() - startTime;
      if (err instanceof GeminiAPIError) {
        logger.error('Gemini API 후속 질문 실패', { requestId: rid, duration: duration + 'ms', error: err.message });
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      logger.error('후속 질문 오류', { requestId: rid, duration: duration + 'ms', error: err.message });
      return res.status(500).json({ error: '후속 질문을 만들지 못했습니다.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
