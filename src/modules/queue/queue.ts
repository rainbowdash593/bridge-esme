import EventEmitter from 'events';
import amqp from 'amqp-connection-manager';
import { EsmePool } from '@modules/esme/esme.pool';
import { QueueEvent, QueueName } from '@modules/queue/queue.enums';
import { Connection } from '@modules/connections/connection.types';
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager';
import ChannelWrapper from 'amqp-connection-manager/dist/esm/ChannelWrapper';
import { Sms } from '@modules/sms/sms.types';

class Queue {
  public queueName;
  protected esmePool: EsmePool;
  protected conn: Connection;
  protected emitter: EventEmitter;
  protected connection: IAmqpConnectionManager;
  protected wrapper: ChannelWrapper;

  constructor(conn: Connection, emitter: EventEmitter, esmePool: EsmePool) {
    this.esmePool = esmePool;
    this.emitter = emitter;
    this.queueName = QueueName.SMS_QUEUE + conn.id;
    this.conn = conn;
    this.connection = this.setupConnection();
  }

  protected setupConnection(): IAmqpConnectionManager {
    const connection = amqp.connect([
      `amqp://${process.env.RMQ_USER}:${process.env.RMQ_PASSWORD}@${process.env.RMQ_HOST}:${process.env.RMQ_PORT}`,
    ]);
    connection.on('connect', () => {
      console.log(`[${this.queueName}] Connected!`);
    });

    connection.on('connectFailed', () => {
      console.log(`[${this.queueName}] Connection failed!`);
    });

    connection.on('disconnect', (err) => {
      console.log(`[${this.queueName}] Disconnected.`, err);
    });

    return connection;
  }

  protected onMessage = async (data) => {
    let message: Sms;
    try {
      message = JSON.parse(data.content.toString());
    } catch (e) {
      console.log(e);
    } finally {
      this.emitter.emit(QueueEvent.NEW_MESSAGE, this.conn, message);
      this.wrapper.ack(data);
    }
  };

  public async connect(): Promise<void> {
    this.wrapper = this.connection.createChannel({
      setup: (channel) => {
        return Promise.all([
          channel.assertQueue(this.queueName, { durable: true }),
          channel.prefetch(10),
          channel.consume(this.queueName, this.onMessage),
        ]);
      },
    });
    return this.wrapper.waitForConnect();
  }

  public async disconnect(): Promise<void> {
    if (this.wrapper) {
      await this.wrapper.close();
      await this.connection.close();
    }
  }
}

export { Queue };
