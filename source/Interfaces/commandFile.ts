/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The interface for command files inside source/Commands
 */
interface CommandFile {
  data: {
    name: string;
    toJSON: () => any;
  };
  [key: string]: any;
}

export type { CommandFile };