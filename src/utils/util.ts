export const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min)) + min;
