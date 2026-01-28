import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionLog, Session } from "./session-log.js";
import { unlinkSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const TEST_LOG_PATH = join(process.cwd(), "logs", "sessions-test.json");

describe("SessionLog", () => {
  let sessionLog: SessionLog;

  beforeEach(() => {
    // Clean up test file
    if (existsSync(TEST_LOG_PATH)) {
      unlinkSync(TEST_LOG_PATH);
    }
    sessionLog = new SessionLog(TEST_LOG_PATH);
  });

  afterEach(() => {
    // Clean up test file
    if (existsSync(TEST_LOG_PATH)) {
      unlinkSync(TEST_LOG_PATH);
    }
  });

  describe("startSession", () => {
    it("should record a session start time", () => {
      const before = Date.now();
      sessionLog.startSession();
      const after = Date.now();

      const sessions = sessionLog.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].startedAt).toBeGreaterThanOrEqual(before);
      expect(sessions[0].startedAt).toBeLessThanOrEqual(after);
      expect(sessions[0].endedAt).toBeUndefined();
    });

    it("should not start a new session if one is already active", () => {
      sessionLog.startSession();
      sessionLog.startSession();

      const sessions = sessionLog.getSessions();
      expect(sessions).toHaveLength(1);
    });
  });

  describe("endSession", () => {
    it("should record a session end time", () => {
      sessionLog.startSession();
      const before = Date.now();
      sessionLog.endSession();
      const after = Date.now();

      const sessions = sessionLog.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].endedAt).toBeGreaterThanOrEqual(before);
      expect(sessions[0].endedAt).toBeLessThanOrEqual(after);
    });

    it("should do nothing if no session is active", () => {
      sessionLog.endSession();
      const sessions = sessionLog.getSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe("persistence", () => {
    it("should persist sessions to file", () => {
      sessionLog.startSession();
      sessionLog.endSession();

      // Create new instance to verify persistence
      const loaded = new SessionLog(TEST_LOG_PATH);
      const sessions = loaded.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].endedAt).toBeDefined();
    });

    it("should append to existing sessions", () => {
      sessionLog.startSession();
      sessionLog.endSession();

      sessionLog.startSession();
      sessionLog.endSession();

      const sessions = sessionLog.getSessions();
      expect(sessions).toHaveLength(2);
    });
  });

  describe("hasActiveSession", () => {
    it("should return false when no session exists", () => {
      expect(sessionLog.hasActiveSession()).toBe(false);
    });

    it("should return true when session is active", () => {
      sessionLog.startSession();
      expect(sessionLog.hasActiveSession()).toBe(true);
    });

    it("should return false when session has ended", () => {
      sessionLog.startSession();
      sessionLog.endSession();
      expect(sessionLog.hasActiveSession()).toBe(false);
    });
  });
});
