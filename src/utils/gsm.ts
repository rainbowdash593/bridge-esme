import smpp from 'smpp';
import Splitter from 'split-sms';
import { randomInt } from '@utils/util';

interface GsmPart {
  message: string;
  udh?: Buffer;
}

interface GsmParts {
  parts: GsmPart[];
  encoding: number;
  esmClass: number;
}

const makeUDH = (uniq: number, total: number, index: number): Buffer => {
  return Buffer.from([
    0x05, // Length of User Data Header,
    0x00, // Information Element Identifier,
    0x03, // Length of the Information Element
    uniq, // CSMS reference number,
    total, // Total number of parts,
    index + 1, // Current part's number in the sequence
  ]);
};

const makeParts = (text: string): GsmParts => {
  const esm = {
    DEFAULT: 0,
    UDHI: smpp.ESM_CLASS.UDH_INDICATOR,
  };

  const encodings = {
    Unicode: smpp.ENCODING.UCS2,
    //TODO might be Latin1
    GSM: smpp.SMSC_DEFAULT,
  };

  const result = Splitter.split(text);

  const parts = [];
  const uniq = randomInt(1, 255);

  result.parts.forEach((item, index) => {
    parts.push({
      message: item.content,
      udh: result.parts.length > 1 ? makeUDH(uniq, result.parts.length, index) : undefined,
    });
  });

  return {
    parts,
    encoding: encodings[result.characterSet],
    esmClass: result.parts.length > 1 ? esm.UDHI : esm.DEFAULT,
  };
};

export { makeParts, makeUDH, GsmPart, GsmParts };
