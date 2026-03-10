// ---------------------------------------------------------------------------
// Analyze Route (/api/analyze)
// ---------------------------------------------------------------------------

const express = require('express');

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
    let userAiTone = 'warm';
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
            .select('ai_tone')
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

        if (profileResult.data && profileResult.data.ai_tone) {
          userAiTone = profileResult.data.ai_tone;
        }
      } catch {
        // 맥락/톤 조회 실패 시 기존대로 분석 (비차단)
      }
    }

    const userPrompt = contextSection ? `${textV.value}${contextSection}` : textV.value;

    // 톤별 추가 지시 생성
    const toneInstructions = {
      warm: '', // 기본 톤 — SYSTEM_PROMPT 그대로
      professional: '\n\n추가 톤 지시: 전문적인 심리 상담사처럼 응답하세요. 감정 용어를 정확히 사용하고, 공감하되 분석적 통찰도 함께 제공합니다. 존댓말을 사용하되 약간 격식체를 유지합니다.',
      friendly: '\n\n추가 톤 지시: 다정한 친구처럼 편하게 응답하세요. 반말은 쓰지 않되, "~요" 체를 사용하고 구어체 표현을 자연스럽게 섞어주세요. "아 정말?" "대박" 같은 공감 추임새를 가볍게 활용합니다.',
      poetic: '\n\n추가 톤 지시: 감성적이고 시적인 문체로 응답하세요. 비유, 은유를 활용하고 짧은 문장으로 여운을 남기는 표현을 사용합니다. 마치 짧은 산문시처럼 리듬감 있게 작성합니다.',
    };
    const toneModifier = toneInstructions[userAiTone] || '';
    const finalSystemPrompt = SYSTEM_PROMPT + toneModifier;

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
      const crisisKeywords = [
        '죽고 싶', '자해', '자살', '살고 싶지 않', '끝내고 싶', '사라지고 싶',
        '삶을 끝', '죽을', '목숨', '세상을 떠나', '더 이상 못', '힘들어 못 살',
      ];
      // Normalize text: remove zero-width chars and collapse whitespace
      const textNormalized = textV.value
        .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
        .replace(/\s+/g, ' ');
      const isCrisis = crisisKeywords.some(kw => textNormalized.includes(kw));
      const severeEmotions = ['절망', '극심한 우울', '자기혐오', '공허'];
      const emotionCrisis = severeEmotions.includes(enrichedResult.emotion);

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
