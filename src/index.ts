import 'dotenv/config';
import { EsmePool } from '@modules/esme/esme.pool';
import { EsmeEvent } from '@modules/esme/esme.enums';
import { QueuePool } from '@modules/queue/queue.pool';
import { QueueEvent } from '@modules/queue/queue.enums';
import { connections } from '@/modules/connections/connection.consts';

(async () => {
  const esmePool = new EsmePool();
  esmePool.on(EsmeEvent.SEND_SUCCESS, (conn, pdu, sms) => {
    console.log(pdu);
  });

  esmePool.on(EsmeEvent.DLR, (conn, pdu) => {});

  const messageQueuePool = new QueuePool(connections, esmePool);
  messageQueuePool.on(QueueEvent.NEW_MESSAGE, async (conn, message) => {
    try {
      const esme = await esmePool.findOrCreate(conn);
      esme.send(message);
    } catch (e) {
      //TODO handle error
      console.log(e);
    }
  });

  process.on('SIGTERM', async () => {
    await messageQueuePool.clear();
    await esmePool.clear();
  });

  process.on('SIGINT', async () => {
    await messageQueuePool.clear();
    await esmePool.clear();
  });
})();
