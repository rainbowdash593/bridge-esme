import EventEmitter from 'events';
import { Mutex, MutexInterface } from 'async-mutex';
import { Esme } from '@modules/esme/esme';
import { EsmeEvent } from '@modules/esme/esme.enums';
import { SmppConnectionError } from '@modules/esme/esme.exceptions';
import { Connection } from '@modules/connections/connection.types';

class EsmePool {
  private BROKEN_CONN_CLEAR_TIMEOUT = 60 * 1000;

  private locks = new Map<string, MutexInterface>();
  private connections = new Map<string, Esme>();
  private brokenConnections = new Map();
  private brokenConnectionsTimer: NodeJS.Timer;

  private emitter = new EventEmitter();

  public on(event: EsmeEvent, cb: (...args: any[]) => void) {
    this.emitter.on(event, cb);
  }

  public once(event: EsmeEvent, cb: (...args: any[]) => void) {
    this.emitter.on(event, cb);
  }

  public async add(conn: Connection): Promise<Esme> {
    const esme = new Esme(conn, this.emitter);
    this.connections.set(conn.id, esme);

    this.emitter.on(EsmeEvent.CONNECTED, (conn) => {
      console.log(`Connection with id ${conn.id} was successfully established`);
    });

    this.emitter.on(EsmeEvent.ERROR, (conn, e) => {
      console.error(e);
      this.remove(conn);
    });

    this.emitter.on(EsmeEvent.CLOSED, (conn) => {
      this.connections.delete(conn.id);
      console.log(`Connection with id: ${conn.id} was closed`);
    });

    try {
      await esme.connect();
    } catch (e) {
      await esme.close();
      this.connections.delete(conn.id);
      this.brokenConnections.set(conn.id, conn);
      this.clearBrokenConnection(conn);
      throw e;
    }

    return esme;
  }

  public async remove(conn): Promise<void> {
    if (this.connections.has(conn.id)) {
      await this.connections.get(conn.id).close();
    }
  }

  public async clear(): Promise<void> {
    for (const esme of this.connections.values()) {
      await this.remove(esme);
    }
    if (this.brokenConnectionsTimer) {
      console.log(this.brokenConnectionsTimer);
      clearTimeout(this.brokenConnectionsTimer);
    }
  }

  public async findOrCreate(conn): Promise<Esme> {
    if (!this.locks.has(conn.id)) {
      this.locks.set(conn.id, new Mutex());
    }
    let esme = null;
    const release = await this.locks.get(conn.id).acquire();
    try {
      if (this.brokenConnections.has(conn.id)) {
        throw new SmppConnectionError(`Connection with id: ${conn.id} cached as broken`);
      }
      if (this.connections.has(conn.id)) {
        esme = this.connections.get(conn.id);
      } else {
        esme = await this.add(conn);
      }
    } finally {
      release();
    }
    return esme;
  }

  protected clearBrokenConnection(conn): void {
    this.brokenConnectionsTimer = setTimeout(() => {
      if (this.brokenConnections.has(conn.id)) {
        this.brokenConnections.delete(conn.id);
      }
    }, this.BROKEN_CONN_CLEAR_TIMEOUT);
  }
}

export { EsmePool };
