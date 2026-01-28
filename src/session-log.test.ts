import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionLog, Session } from "./session-log.js";
import { unlinkSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
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

  describe("error handling", () => {
    it("should handle corrupted JSON file gracefully", () => {
      // Write corrupted JSON to the file
      const dir = join(process.cwd(), "logs");
      mkdirSync(dir, { recursive: true });
      writeFileSync(TEST_LOG_PATH, "{ invalid json content");

      // Creating a new session log should not throw
      const corruptedLog = new SessionLog(TEST_LOG_PATH);
      const sessions = corruptedLog.getSessions();

      // Should start with empty sessions after corrupted file
      expect(sessions).toHaveLength(0);
    });

    it("should handle empty file gracefully", () => {
      const dir = join(process.cwd(), "logs");
      mkdirSync(dir, { recursive: true });
      writeFileSync(TEST_LOG_PATH, "");

      const emptyLog = new SessionLog(TEST_LOG_PATH);
      const sessions = emptyLog.getSessions();
      expect(sessions).toHaveLength(0);
    });

    it("should create directory if it does not exist", () => {
      const nestedPath = join(process.cwd(), "logs", "nested", "deep", "sessions-nested.json");

      // Clean up if exists
      try {
        unlinkSync(nestedPath);
      } catch {
        // Ignore if not exists
      }

      const nestedLog = new SessionLog(nestedPath);
      nestedLog.startSession();
      nestedLog.endSession();

      // Verify it was created
      expect(existsSync(nestedPath)).toBe(true);

      // Clean up
      try {
        unlinkSync(nestedPath);
        // Clean up nested directories
        const { rmdirSync } = require("fs");
        rmdirSync(join(process.cwd(), "logs", "nested", "deep"));
        rmdirSync(join(process.cwd(), "logs", "nested"));
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should return a copy of sessions array (immutability)", () => {
      sessionLog.startSession();
      const sessions1 = sessionLog.getSessions();
      const sessions2 = sessionLog.getSessions();

      // Should be different array instances
      expect(sessions1).not.toBe(sessions2);

      // But with same content
      expect(sessions1).toEqual(sessions2);
    });
  });
});
