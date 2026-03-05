// ---------------------------------------------------------------------------
// Analyze Route (/api/analyze)
// ---------------------------------------------------------------------------

const express = require('express');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    authMiddleware,
    config, GEMINI_API_KEY,
    ontologyEngine, SYSTEM_PROMPT,
    callGeminiAPI, GeminiAPIError,
    validateEntryText,
    parseGeminiResponse,
    analyzeLimiter,
  } = deps;

  // POST /analyze - 감정 분석
  router.post('/analyze', authMiddleware, analyzeLimiter, async (req, res) => {
    const rid = requestId();
    const startTime = Date.now();

    logger.info('POST /api/analyze 요청 수신', { requestId: rid, userId: req.user?.id });

    if (!req.body) {
      return res.status(400).json({ error: 'JSON 형식의 요청 본문이 필요합니다.', code: 'VALIDATION_ERROR' });
    }

    const textV = validateEntryText(req.body.text);
    if (!textV.valid) return res.status(400).json({ error: textV.error, code: 'VALIDATION_ERROR' });

    if (!GEMINI_API_KEY) {
      logger.error('Gemini API 키 미설정', { requestId: rid });
      return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.', code: 'INTERNAL_ERROR' });
    }

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: textV.value }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        maxOutputTokens: config.gemini.maxOutputTokens,
        temperature: config.gemini.temperature,
        thinkingConfig: { thinkingBudget: config.gemini.thinkingBudget },
      },
    };

    try {
      const { content, tokenCost } = await callGeminiAPI(requestBody, { rid, label: '감정 분석' });

      const result = parseGeminiResponse(content);
      const currentOntologyEngine = ontologyEngine();
      const enrichedResult = currentOntologyEngine
        ? currentOntologyEngine.enrichEmotion(result.emotion, textV.value, result)
        : result;

      const duration = Date.now() - startTime;
      logger.info('감정 분석 완료', {
        requestId: rid,
        emotion: enrichedResult.emotion,
        confidence: enrichedResult.ontology?.confidence,
        duration: `${duration}ms`,
        ...(tokenCost && {
          tokens: {
            input: tokenCost.input, output: tokenCost.output,
            thinking: tokenCost.thinking, cached: tokenCost.cached, total: tokenCost.total,
          },
          costUsd: {
            input: tokenCost.inputCost, output: tokenCost.outputCost,
            thinking: tokenCost.thinkingCost, total: tokenCost.totalCost,
          },
          model: config.gemini.model,
        }),
      });

      return res.json(enrichedResult);
    } catch (err) {
      const duration = Date.now() - startTime;
      if (err instanceof GeminiAPIError) {
        logger.error('Gemini API 최종 실패', { requestId: rid, duration: `${duration}ms`, error: err.message });
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      logger.error('감정 분석 오류', { requestId: rid, duration: `${duration}ms`, error: err.message });
      return res.status(500).json({ error: '응답을 해석하지 못했습니다. 다시 시도해주세요.', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
