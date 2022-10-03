import smpp from 'smpp';
import EventEmitter from 'events';
import { RateLimiter } from 'limiter';
import { makeParts } from '@utils/gsm';
import { ConnectionMode } from '@modules/connections/connection.enums';
import { PDUError, SmppConnectionError } from '@modules/esme/esme.exceptions';
import { EsmeUnackedPool } from '@modules/esme/esme.unackedPool';
import { EsmeEvent } from '@modules/esme/esme.enums';
import { Sms } from '@modules/sms/sms.types';
import { Connection } from '@modules/connections/connection.types';

class Esme {
  private ENQUIRE_LINK_PERIOD = 10 * 1000;
  private CONNECTION_TIMEOUT = 10 * 1000;
  private CONNECTION_TTL = 6 * 60 * 60 * 1000;

  protected conn: Connection;
  protected timer: NodeJS.Timeout;
  //TODO smpp lib types
  protected tx;
  protected rx;
  protected sessions = [];
  protected emitter: EventEmitter;
  protected unackedPool: EsmeUnackedPool;
  protected limiter: RateLimiter;

  public isConnected = false;

  constructor(conn: Connection, emitter: EventEmitter) {
    this.conn = conn;
    this.emitter = emitter;
    this.timer = this.createTimer();
    this.unackedPool = new EsmeUnackedPool(conn);
    if (conn.speed) {
      this.limiter = new RateLimiter({ tokensPerInterval: conn.speed, interval: 'second' });
    }
  }

  public get id(): string {
    return this.conn.id;
  }

  public async close(): Promise<void> {
    for (const s of this.sessions) {
      await s.close();
    }
    this.tx = this.rx = null;
    clearTimeout(this.timer);
    this.unackedPool.clear();
    this.emitter.emit(EsmeEvent.CLOSED, this.conn);
  }

  public async connect(): Promise<void> {
    switch (this.conn.mode) {
      case ConnectionMode.TRX:
        const session = await this.createSession();
        this.sessions.push(session);
        this.tx = this.rx = session;
        await this.bindTransceiver(session);

        break;
      case ConnectionMode.TX_RX:
        this.tx = await this.createSession();
        this.sessions.push(this.tx);
        await this.bindTransmitter(this.tx);

        this.rx = await this.createSession();
        this.sessions.push(this.rx);
        await this.bindReceiver(this.rx);

        break;
      default:
        throw new SmppConnectionError(
          `Invalid connection mode: ${this.conn.mode} for connection with id: ${this.conn.id}`,
        );
    }

    this.emitter.emit(EsmeEvent.CONNECTED, this.conn);
    this.isConnected = true;
  }

  protected async bindTransceiver(session, timeout = 5) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Bind timeout error'));
      }, timeout * 1000);
      session.bind_transceiver(
        {
          system_id: this.conn.system_id,
          password: this.conn.password,
          //system_type: conn.system_type,
        },
        function (pdu) {
          if (pdu.command_status === 0) {
            resolve(session);
          } else {
            reject(new PDUError(`Bind transceiver command status: ${pdu.command_status}`, pdu));
          }
        },
      );
    });
  }

  protected async bindTransmitter(session, timeout = 5) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Bind timeout error'));
      }, timeout * 1000);
      session.bind_transmitter(
        {
          system_id: this.conn.system_id,
          password: this.conn.password,
          //system_type: conn.system_type,
        },
        function (pdu) {
          if (pdu.command_status === 0) {
            resolve(session);
          } else {
            reject(new PDUError(`Bind transmitter command status: ${pdu.command_status}`, pdu));
          }
        },
      );
    });
  }

  protected async bindReceiver(session, timeout = 5) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Bind timeout error'));
      }, timeout * 1000);
      session.bind_receiver(
        {
          system_id: this.conn.system_id,
          password: this.conn.password,
          //system_type: conn.system_type,
        },
        function (pdu) {
          if (pdu.command_status === 0) {
            resolve(session);
          } else {
            reject(new PDUError(`Bind receiver command status: ${pdu.command_status}`, pdu));
          }
        },
      );
    });
  }

  protected addSessionListeners(session) {
    session.on('error', (e) => {
      this.close();
      console.log(`Sessions closed for connection with id: ${this.conn.id}`);
      this.emitter.emit(EsmeEvent.ERROR, this.conn, e);
    });

    session.on('close', () => {
      this.emitter.emit(EsmeEvent.CLOSED, this.conn);
    });

    session.on('deliver_sm', (pdu) => {
      this.emitter.emit(EsmeEvent.DLR, this.conn, pdu);
    });

    //TODO on submit_sm_resp (might be multipart)
  }

  protected async createSession(): Promise<any> {
    const session = await new Promise((resolve, reject) => {
      const session = smpp.connect(
        {
          //TODO TLS connection
          url: `smpp://${this.conn.host}:${this.conn.port}`,
          auto_enquire_link_period: this.ENQUIRE_LINK_PERIOD,
          debug: true,
          connectTimeout: this.CONNECTION_TIMEOUT,
        },
        (s) => resolve(s),
      );

      session.once('error', function (e) {
        reject(e);
      });
    });
    this.addSessionListeners(session);

    return session;
  }

  protected clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = this.createTimer();
  }

  protected createTimer(): NodeJS.Timeout {
    return setTimeout(() => {
      this.close();
    }, this.CONNECTION_TTL);
  }

  public async send(sms: Sms): Promise<void> {
    const { parts, encoding, esmClass } = makeParts(sms.message);

    // This is not quite right, but some SMSC can send
    // submit_sm pdu after accepting all parts of the sms
    await this.unackedPool.windowChecker();

    for (const part of parts) {
      if (this.limiter) {
        await this.limiter.removeTokens(1);
      }

      this.unackedPool.add(sms, (conn, unackedSms) => {
        this.emitter.emit(EsmeEvent.SEND_EXPIRED, conn, unackedSms);
      });
      this.tx.submit_sm(
        {
          short_message: { message: part.message, udh: part.udh },

          source_addr: sms.sender,
          source_addr_ton: this.conn.config.source_ton ?? 1,
          source_addr_npi: this.conn.config.source_ton ?? 1,

          destination_addr: sms.phone,
          dest_addr_ton: this.conn.config.dest_addr_ton ?? 1,
          dest_addr_npi: this.conn.config.dest_addr_npi ?? 1,

          data_coding: encoding,
          esm_class: esmClass,
        },
        (pdu) => {
          this.unackedPool.remove(sms);
          this.emitter.emit(EsmeEvent.SEND_SUCCESS, this.conn, pdu, sms);
        },
        null,
        (pdu, e) => {
          console.log(`Sms with id: ${sms.id} submit_sm failed`, e);
          this.emitter.emit(EsmeEvent.SEND_FAILURE, this.conn, pdu, sms);
          this.close();
        },
      );
    }

    this.clearTimer();
  }
}

export { Esme };
