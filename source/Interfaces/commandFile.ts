/* eslint-disable @typescript-eslint/no-explicit-any */
interface CommandFile {
  data: {
    name: string;
    toJSON: () => any;
  };
  [key: string]: any;
}

export type { CommandFile };