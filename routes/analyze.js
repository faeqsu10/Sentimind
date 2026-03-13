// ---------------------------------------------------------------------------
// Analyze Route (/api/analyze)
// ---------------------------------------------------------------------------

const express = require('express');
const {
  DEFAULT_PERSONALIZATION,
  buildPersonalizationPrompt,
} = require('../config/ai-personalization');
const { isMissingColumnError } = require('../lib/db-utils');

module.exports = function (deps) {
  const router = express.Router();

  const {
    logger, requestId,
    optionalAuth,
    config, GEMINI_API_KEY,
    ontologyEngine, SYSTEM_PROMPT,
    callGeminiAPI, GeminiAPIError,
    validateEntryText,
    parseGeminiResponse,
    analyzeLimiter,
    logAiUsage,
  } = deps;

  // POST /analyze - 감정 분석 (인증 선택 — 게스트 모드 지원)
  router.post('/analyze', optionalAuth, analyzeLimiter, async (req, res) => {
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

    // 인증된 사용자의 최근 3개 일기 + AI 톤 설정 조회
    let contextSection = '';
    let userAiTone = DEFAULT_PERSONALIZATION.aiTone;
    let userResponseLength = DEFAULT_PERSONALIZATION.responseLength;
    let userAdviceStyle = DEFAULT_PERSONALIZATION.adviceStyle;
    let userPersonaPreset = DEFAULT_PERSONALIZATION.personaPreset;
    if (req.user && req.supabaseClient) {
      try {
        const [entriesResult, profileResult] = await Promise.all([
          req.supabaseClient
            .from('entries')
            .select('emotion, text, created_at')
            .eq('user_id', req.user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(3),
          req.supabaseClient
            .from('user_profiles')
            .select('ai_tone, response_length, advice_style, persona_preset')
            .eq('id', req.user.id)
            .single(),
        ]);

        if (entriesResult.data && entriesResult.data.length > 0) {
          const summary = entriesResult.data.map(e => {
            const date = new Date(e.created_at);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const snippet = (e.text || '').slice(0, 50);
            return `${dateStr}: ${e.emotion} '${snippet}'`;
          }).join(', ');
          contextSection = `\n\n참고: 사용자의 최근 감정 기록 - ${summary}`;
        }

        if (profileResult.error && !isMissingColumnError(profileResult.error, ['response_length', 'advice_style', 'persona_preset'])) {
          throw profileResult.error;
        }
        const profile = profileResult.data;
        if (profile) {
          if (profile.ai_tone) userAiTone = profile.ai_tone;
          if (profile.response_length) userResponseLength = profile.response_length;
          if (profile.advice_style) userAdviceStyle = profile.advice_style;
          if (profile.persona_preset) userPersonaPreset = profile.persona_preset;
        }
      } catch (profileErr) {
        logger.warn('user_profiles 조회 실패 — 기본 톤 사용', { error: profileErr.message });
      }
    }

    const userPrompt = contextSection ? `${textV.value}${contextSection}` : textV.value;

    const finalSystemPrompt = buildPersonalizationPrompt({
      systemPrompt: SYSTEM_PROMPT,
      aiTone: userAiTone,
      responseLength: userResponseLength,
      adviceStyle: userAdviceStyle,
      personaPreset: userPersonaPreset,
    });

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: finalSystemPrompt }] },
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
      logAiUsage({
        userId: req.user?.id,
        endpoint: 'analyze',
        tokenCost,
        durationMs: duration,
      });

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

      // Crisis detection — check for distress signals in text and emotion
      const textNormalized = textV.value
        .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
        .replace(/\s+/g, ' ');
      const isCrisis = config.crisis.keywords.some(kw => textNormalized.includes(kw));
      const emotionCrisis = config.crisis.severeEmotions.includes(enrichedResult.emotion);

      if (isCrisis || emotionCrisis) {
        enrichedResult.crisis_detected = true;
        logger.warn('위기 신호 감지', {
          requestId: rid,
          userId: req.user?.id || 'guest',
          emotion: enrichedResult.emotion,
          keywordMatch: isCrisis,
          emotionMatch: emotionCrisis,
        });
      }

      enrichedResult.personalization = {
        applied_tone: userAiTone,
        applied_response_length: userResponseLength,
        applied_advice_style: userAdviceStyle,
        applied_persona_preset: userPersonaPreset,
        safety_mode: isCrisis || emotionCrisis ? 'crisis' : 'normal',
      };

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
