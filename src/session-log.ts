import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

export interface Session {
  startedAt: number;
  endedAt?: number;
}

export class SessionLog {
  private sessions: Session[] = [];
  private logPath: string;

  constructor(logPath: string) {
    this.logPath = logPath;
    this.load();
  }

  private load(): void {
    if (existsSync(this.logPath)) {
      try {
        const data = readFileSync(this.logPath, "utf-8");
        this.sessions = JSON.parse(data);
      } catch {
        this.sessions = [];
      }
    }
  }

  private save(): void {
    const dir = dirname(this.logPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.logPath, JSON.stringify(this.sessions, null, 2));
  }

  startSession(): void {
    if (this.hasActiveSession()) {
      return;
    }
    this.sessions.push({ startedAt: Date.now() });
    this.save();
  }

  endSession(): void {
    const activeSession = this.sessions.find((s) => s.endedAt === undefined);
    if (activeSession) {
      activeSession.endedAt = Date.now();
      this.save();
    }
  }

  hasActiveSession(): boolean {
    return this.sessions.some((s) => s.endedAt === undefined);
  }

  getSessions(): Session[] {
    return [...this.sessions];
  }
}
