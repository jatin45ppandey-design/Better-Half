import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { requestTimeout } from '../src/middleware/timeout.js';
import { getClientIp } from '../src/middleware/rateLimiter.js';
import { sanitizeLogMetadata, Logger } from '../src/utils/logger.js';
import { createApp } from '../src/app.js';

describe('B6 + S4 — Production Hardening Suite', () => {
  describe('Request Timeout Middleware (requestTimeout)', () => {
    it('allows fast requests to complete normally without error', async () => {
      const app = express();
      app.use(requestTimeout({ timeoutMs: 1000, skipInTest: false }));
      app.get('/test-fast', (_req, res) => {
        res.status(200).json({ status: 'ok' });
      });

      const res = await request(app).get('/test-fast');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('returns 504 Gateway Timeout when processing exceeds timeoutMs', async () => {
      const app = express();
      app.use(requestTimeout({ timeoutMs: 50, skipInTest: false }));
      app.get('/test-slow', (_req, _res) => {
        // intentionally do not respond within 50ms
        setTimeout(() => {}, 200);
      });

      const res = await request(app).get('/test-slow');
      expect(res.status).toBe(504);
      expect(res.body.code).toBe('REQUEST_TIMEOUT');
      expect(res.body.error).toContain('The server took too long to respond.');
    });
  });

  describe('Client IP Extraction & Anti-Spoofing (getClientIp)', () => {
    it('prefers req.ip determined by Express proxy settings over unverified x-forwarded-for header', () => {
      const mockReq: any = {
        ip: '10.0.0.1',
        headers: {
          'x-forwarded-for': '203.0.113.195, 198.51.100.17',
        },
        socket: {
          remoteAddress: '127.0.0.1',
        },
      };

      const resolvedIp = getClientIp(mockReq);
      expect(resolvedIp).toBe('10.0.0.1');
    });

    it('falls back safely to socket.remoteAddress if req.ip is undefined', () => {
      const mockReq: any = {
        headers: {},
        socket: {
          remoteAddress: '192.168.1.50',
        },
      };

      const resolvedIp = getClientIp(mockReq);
      expect(resolvedIp).toBe('192.168.1.50');
    });

    it('defaults to unknown when no IP can be extracted', () => {
      const mockReq: any = {
        headers: {},
        socket: {},
      };

      const resolvedIp = getClientIp(mockReq);
      expect(resolvedIp).toBe('unknown');
    });
  });

  describe('Security Headers & Helmet CSP Verification', () => {
    it('sets Content-Security-Policy, Cross-Origin-Resource-Policy, and Cross-Origin-Opener-Policy on responses', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('content-security-policy');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');

      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'self'");
    });
  });

  describe('Structured Redacted Logger & Sensitive Data Protection', () => {
    it('redacts credentials, tokens, API keys, and Between Us answers recursively', () => {
      const sensitiveData = {
        userId: 'usr_123',
        token: 'eyJhbGciOiJIUzI1Ni...',
        apiKey: 'secret_live_abc123',
        password: 'SuperSecretPassword',
        nested: {
          answer: 'Secret Answer to Question 4',
          unrevealedAnswer: 'Secret prompt response',
          safeField: 'harmless_metric_1',
        },
        answers: ['Secret Answer 1', 'Secret Answer 2'],
      };

      const sanitized = sanitizeLogMetadata(sensitiveData);

      expect(sanitized.userId).toBe('usr_123');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.nested.answer).toBe('[REDACTED]');
      expect(sanitized.nested.unrevealedAnswer).toBe('[REDACTED]');
      expect(sanitized.nested.safeField).toBe('harmless_metric_1');
      expect(sanitized.answers).toBe('[REDACTED]');
    });

    it('formats structured JSON output in production mode', () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const customLogger = new Logger();
      const output = customLogger.formatOutput('info', 'Room session initialized', {
        roomId: 'room_abc',
        token: 'super_secret_token',
      });

      process.env.NODE_ENV = prevEnv;

      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Room session initialized');
      expect(parsed.roomId).toBe('room_abc');
      expect(parsed.token).toBe('[REDACTED]');
      expect(parsed.timestamp).toBeDefined();
    });
  });
});
