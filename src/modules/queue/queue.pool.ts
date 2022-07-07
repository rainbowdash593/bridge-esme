import EventEmitter from 'events';
import { Queue } from '@modules/queue/queue';
import { EsmePool } from '@modules/esme/esme.pool';
import { Connection } from '@modules/connections/connection.types';
import { QueueEvent } from '@modules/queue/queue.enums';

class QueuePool {
  protected esmePool: EsmePool;
  protected emitter = new EventEmitter();
  protected queues = new Map<string, Queue>();

  constructor(connections: Connection[], esmePool: EsmePool) {
    this.esmePool = esmePool;
    connections.forEach(async (conn) => {
      await this.add(conn);
    });
  }

  public on(event: QueueEvent, cb: (...args: any[]) => void) {
    this.emitter.on(event, cb);
  }

  public once(event: QueueEvent, cb: (...args: any[]) => void) {
    this.emitter.on(event, cb);
  }

  public async add(conn: Connection): Promise<void> {
    const queue = new Queue(conn, this.emitter, this.esmePool);
    this.queues.set(conn.id, queue);
    await queue.connect();
  }

  public async remove(id: string): Promise<void> {
    if (this.queues.has(id)) {
      await this.queues.get(id).disconnect();
      this.queues.delete(id);
    }
  }

  public async clear(): Promise<void> {
    for (const id of this.queues.keys()) {
      await this.remove(id);
    }
  }
}

export { QueuePool };
