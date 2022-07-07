import { Sms } from '@modules/sms/sms.types';
import { Connection } from '@modules/connections/connection.types';

class EsmeUnackedPool {
  private EXPIRED_TIMEOUT = 60 * 1000;
  private WINDOW_CHECKER_INTERVAL = 200;

  protected conn;
  protected windowSize;
  protected unacked = new Map<string, Sms>();
  protected timers = new Map<string, NodeJS.Timeout>();

  constructor(conn: Connection) {
    this.conn = conn;
    this.windowSize = conn.window_size;
  }

  public add(sms: Sms, expiredCallback: (conn: Connection, sms: Sms) => any): void {
    if (this.windowSize) {
      this.unacked.set(sms.id, sms);

      if (this.timers.has(sms.id)) {
        clearTimeout(this.timers.get(sms.id));
      }

      this.timers.set(
        sms.id,
        setTimeout(() => {
          expiredCallback(this.conn, sms);
        }, this.EXPIRED_TIMEOUT),
      );
    }
  }

  public remove(sms: Sms): void {
    if (this.timers.has(sms.id)) {
      clearTimeout(this.timers.get(sms.id));
      this.timers.delete(sms.id);
    }

    if (this.unacked.has(sms.id)) {
      this.unacked.delete(sms.id);
    }
  }

  public clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.unacked.clear();
  }

  public async windowChecker(): Promise<void> {
    if (!this.windowSize) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (this.windowSize > this.unacked.size) {
          clearInterval(interval);
          resolve();
        }
      }, this.WINDOW_CHECKER_INTERVAL);
    });
  }
}

export { EsmeUnackedPool };
