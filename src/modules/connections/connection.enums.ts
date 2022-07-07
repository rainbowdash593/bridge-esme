enum ConnectionMode {
  TRX = 'transceiver',
  //TX = 'transmitter',
  TX_RX = 'transmitter_receiver',
}

enum ConnectionStatus {
  ERROR = 'error',
  CLOSE = 'close',
  OPEN = 'open',
  PENDING = 'pending',
}

enum ConnectionEncoding {
  GSM = 'gsm',
  LATIN = 'latin1',
}

export { ConnectionMode, ConnectionStatus, ConnectionEncoding };
