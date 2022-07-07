import { ConnectionEncoding, ConnectionMode, ConnectionStatus } from '@modules/connections/connection.enums';

interface ConnectionConfig {
  encoding: ConnectionEncoding;
  source_ton?: number;
  source_npi?: number;
  dest_addr_ton?: number;
  dest_addr_npi?: number;
}

interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  system_id: string;
  password: string;
  mode: ConnectionMode;
  status: ConnectionStatus;
  config: ConnectionConfig;
  window_size?: number;
  speed?: number;
  system_type?: string;
}

export { Connection };
