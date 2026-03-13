// ---------------------------------------------------------------------------
// Illustrated Diary Route (/api/illustrated-diary)
// ---------------------------------------------------------------------------

const express = require('express');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    optionalAuth,
    config, GEMINI_API_KEY,
    callGeminiAPI, GeminiAPIError,
    parseGeminiResponse,
    validateEntryText,
    analyzeLimiter,
    logAiUsage,
  } = deps;

  // 그림일기 전용 시스템 프롬프트
  const ILLUSTRATED_DIARY_PROMPT = `당신은 감정 일기를 3컷 그림일기 장면으로 변환하는 작가입니다.

사용자의 일기 텍스트와 분석된 감정을 받으면, 그 하루를 3개의 장면으로 재구성하세요.

규칙:
- 각 장면은 시간 순서(before → during → after)로 구성
- 각 caption은 한국어 1문장 (15-30자)
- mood는 영어 소문자 단어 하나 (예: tense, relief, warm, sad, joyful, calm, anxious, hopeful, tired, angry)
- emoji는 장면 분위기에 어울리는 이모지 1개
- title은 시적이고 감성적인 한국어 (10-20자)
- closing은 하루를 정리하는 따뜻한 한 줄 (20-40자)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "title": "하루를 담은 제목",
  "panels": [
    { "scene": 1, "caption": "첫 번째 장면", "mood": "mood_word", "emoji": "이모지" },
    { "scene": 2, "caption": "두 번째 장면", "mood": "mood_word", "emoji": "이모지" },
    { "scene": 3, "caption": "세 번째 장면", "mood": "mood_word", "emoji": "이모지" }
  ],
  "closing": "마무리 한 줄"
}`;

  function parseIllustratedResponse(text) {
    // 코드블록 제거 + JSON 파싱은 parseGeminiResponse와 동일한 로직으로 처리
    let jsonStr = text.trim();
    const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonStr = codeBlock[1].trim();
    const parsed = JSON.parse(jsonStr);

    // Validate illustrated-diary-specific structure
    if (!parsed.title || !Array.isArray(parsed.panels) || parsed.panels.length !== 3) {
      throw new Error('Invalid illustrated diary response structure');
    }

    return {
      title: typeof parsed.title === 'string' ? parsed.title : '오늘의 그림일기',
      panels: parsed.panels.map((p, i) => ({
        scene: i + 1,
        caption: typeof p.caption === 'string' ? p.caption : '',
        mood: typeof p.mood === 'string' ? p.mood : 'calm',
        emoji: typeof p.emoji === 'string' ? p.emoji : '💭',
      })),
      closing: typeof parsed.closing === 'string' ? parsed.closing : '',
    };
  }

  router.post('/illustrated-diary', optionalAuth, analyzeLimiter, async (req, res) => {
    const rid = requestId();
    const startTime = Date.now();

    logger.info('POST /api/illustrated-diary 요청', { requestId: rid });

    if (!req.body) {
      return res.status(400).json({ error: 'JSON 형식의 요청 본문이 필요합니다.', code: 'VALIDATION_ERROR' });
    }

    const { text, emotion, emoji } = req.body;
    const textV = validateEntryText(text);
    if (!textV.valid) return res.status(400).json({ error: textV.error, code: 'VALIDATION_ERROR' });

    if (!emotion || typeof emotion !== 'string') {
      return res.status(400).json({ error: '감정 분석 결과가 필요합니다.', code: 'VALIDATION_ERROR' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.', code: 'INTERNAL_ERROR' });
    }

    // emoji 길이 제한 (prompt injection 방지)
    const safeEmoji = typeof emoji === 'string' ? emoji.slice(0, 10) : '';
    const userPrompt = `일기: "${textV.value}"\n분석된 감정: ${emotion} ${safeEmoji}`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: ILLUSTRATED_DIARY_PROMPT }] },
      generationConfig: {
        maxOutputTokens: parseInt(process.env.ILLUSTRATED_MAX_TOKENS || '512', 10),
        temperature: parseFloat(process.env.ILLUSTRATED_TEMPERATURE || '0.8'),
        thinkingConfig: { thinkingBudget: config.gemini.thinkingBudget },
      },
    };

    try {
      const { content, tokenCost } = await callGeminiAPI(requestBody, { rid, label: '그림일기 생성' });
      const result = parseIllustratedResponse(content);

      const duration = Date.now() - startTime;
      logAiUsage({
        userId: req.user?.id,
        endpoint: 'illustrated-diary',
        tokenCost,
        durationMs: duration,
      });

      logger.info('그림일기 생성 완료', {
        requestId: rid,
        duration: `${duration}ms`,
        title: result.title,
        ...(tokenCost && {
          tokens: { input: tokenCost.input, output: tokenCost.output, total: tokenCost.total },
          costUsd: tokenCost.totalCost,
        }),
      });

      return res.json(result);
    } catch (err) {
      const duration = Date.now() - startTime;
      if (err instanceof GeminiAPIError) {
        logger.error('Gemini API 실패 (그림일기)', { requestId: rid, duration: `${duration}ms`, error: err.message });
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      logger.error('그림일기 생성 오류', { requestId: rid, duration: `${duration}ms`, error: err.message });
      return res.status(500).json({ error: '그림일기를 만들지 못했어요. 다시 시도해주세요.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
