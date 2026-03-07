import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Extract utility functions from server-v2.js
const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server-v2.js'), 'utf8');

// Extract parseGeminiResponse
const parseMatch = serverCode.match(/function parseGeminiResponse\(text\) \{[\s\S]*?\n\}/);
const parseGeminiResponse = new Function('return ' + parseMatch[0])();

// Extract isPlainObject
const plainMatch = serverCode.match(/function isPlainObject\(val\) \{[\s\S]*?\n\}/);
const isPlainObject = new Function('return ' + plainMatch[0])();

describe('parseGeminiResponse', () => {
  it('parses valid JSON response', () => {
    const input = '{"emotion":"기쁨","emoji":"😊","message":"좋은 하루","advice":"계속 웃어요"}';
    const result = parseGeminiResponse(input);
    expect(result.emotion).toBe('기쁨');
    expect(result.emoji).toBe('😊');
    expect(result.message).toBe('좋은 하루');
    expect(result.advice).toBe('계속 웃어요');
  });

  it('extracts JSON from code block', () => {
    const input = '```json\n{"emotion":"슬픔","emoji":"😢","message":"힘내세요","advice":"쉬세요"}\n```';
    const result = parseGeminiResponse(input);
    expect(result.emotion).toBe('슬픔');
    expect(result.emoji).toBe('😢');
  });

  it('extracts JSON from code block without json label', () => {
    const input = '```\n{"emotion":"평온","emoji":"😌","message":"","advice":""}\n```';
    const result = parseGeminiResponse(input);
    expect(result.emotion).toBe('평온');
  });

  it('defaults missing fields', () => {
    const input = '{"other":"data"}';
    const result = parseGeminiResponse(input);
    expect(result.emotion).toBe('알 수 없음');
    expect(result.emoji).toBe('💭');
    expect(result.message).toBe('');
    expect(result.advice).toBe('');
  });

  it('defaults non-string fields', () => {
    const input = '{"emotion":123,"emoji":null,"message":[],"advice":{}}';
    const result = parseGeminiResponse(input);
    expect(result.emotion).toBe('알 수 없음');
    expect(result.emoji).toBe('💭');
    expect(result.message).toBe('');
    expect(result.advice).toBe('');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseGeminiResponse('not json')).toThrow();
  });

  it('handles whitespace-wrapped JSON', () => {
    const input = '  \n{"emotion":"감사","emoji":"🙏","message":"감사해요","advice":"좋아요"}\n  ';
    const result = parseGeminiResponse(input);
    expect(result.emotion).toBe('감사');
  });
});

describe('isPlainObject', () => {
  it('returns true for plain object', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ key: 'value' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPlainObject(null)).toBe(false);
  });

  it('returns false for array', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1, 2])).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isPlainObject('string')).toBe(false);
    expect(isPlainObject(123)).toBe(false);
    expect(isPlainObject(true)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });
});
