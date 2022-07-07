class SmppConnectionError extends Error {
  constructor(message) {
    super(message);
  }
}

class PDUError extends Error {
  public pdu: number;
  public message: string;

  constructor(message, pdu) {
    super(message);
    this.pdu = pdu;
    this.message = message;
  }
}

export { SmppConnectionError, PDUError };
