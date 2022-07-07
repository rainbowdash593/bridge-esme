//TODO read SMPP docs
import { ConnectionEncoding, ConnectionMode, ConnectionStatus } from '@modules/connections/connection.enums';

const connections = [
  {
    id: 'nf2i4nf29f203',
    name: 'P1sms',
    host: 'admin.beta.p1sms.ru',
    port: 2775,
    system_id: 'dash593',
    password: '123456',
    mode: ConnectionMode.TRX,
    status: ConnectionStatus.PENDING,
    window_size: 1,
    speed: 5,
    config: {
      encoding: ConnectionEncoding.GSM,
    },
  },
  {
    id: 'md1idm02d12dk12e',
    name: 'P1sms',
    host: 'admin.beta.p1sms.ru',
    port: 2776,
    system_id: 'dash593',
    password: '123456',
    mode: ConnectionMode.TRX,
    status: ConnectionStatus.PENDING,
    window_size: 5,
    speed: 5,
    config: {
      encoding: ConnectionEncoding.GSM,
      source_ton: 1,
      source_npi: 1,
      dest_addr_ton: 1,
      dest_addr_npi: 1,
    },
  },
];

export { connections };
