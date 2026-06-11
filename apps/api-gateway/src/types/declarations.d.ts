declare module 'bcrypt' {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
  export function hashSync(data: string, saltOrRounds: string | number): string;
  export function compareSync(data: string, encrypted: string): boolean;
  export function genSaltSync(rounds?: number): string;
  const bcrypt: {
    hash: typeof hash;
    compare: typeof compare;
    genSalt: typeof genSalt;
    hashSync: typeof hashSync;
    compareSync: typeof compareSync;
    genSaltSync: typeof genSaltSync;
  };
  export default bcrypt;
}

declare module 'winston' {
  export interface Logger {
    debug(message: string, ...meta: any[]): Logger;
    info(message: string, ...meta: any[]): Logger;
    warn(message: string, ...meta: any[]): Logger;
    error(message: string, ...meta: any[]): Logger;
    log(level: string, message: string, ...meta: any[]): Logger;
    add(transport: any): Logger;
    remove(transport: any): Logger;
    clear(): Logger;
    close(): Logger;
    defaultMeta?: any;
    level?: string;
    silent?: boolean;
  }

  export interface Logform {
    Format: any;
  }

  export namespace format {
    function combine(...formats: any[]): any;
    function timestamp(options?: any): any;
    function errors(options?: any): any;
    function json(): any;
    function colorize(options?: any): any;
    function printf(template: (info: any) => string): any;
    function simple(): any;
    function label(options: any): any;
    function metadata(options?: any): any;
  }

  export namespace transports {
    class Console {
      constructor(options?: any);
    }
    class File {
      constructor(options?: any);
    }
    class DailyRotateFile {
      constructor(options?: any);
    }
  }

  export function createLogger(options: any): Logger;
  export const logform: Logform;

  const winston: {
    Logger: Logger;
    format: typeof format;
    transports: typeof transports;
    createLogger: typeof createLogger;
    logform: Logform;
  };
  export default winston;
}

declare module 'winston-daily-rotate-file' {
  const DailyRotateFile: any;
  export default DailyRotateFile;
}

declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [key: string]: any;
    iss?: string;
    sub?: string;
    aud?: string | string[];
    exp?: number;
    nbf?: number;
    iat?: number;
    jti?: string;
  }

  export interface SignOptions {
    algorithm?: string;
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    issuer?: string;
    jwtid?: string;
    subject?: string;
    noTimestamp?: boolean;
    header?: any;
  }

  export interface VerifyOptions {
    algorithms?: string[];
    audience?: string | string[];
    issuer?: string | string[];
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    subject?: string;
    clockTimestamp?: number;
    maxAge?: string | number;
    clockTolerance?: number;
  }

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string | Buffer,
    options?: SignOptions,
  ): string;
  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: VerifyOptions,
  ): JwtPayload;
  export function decode(token: string, options?: { complete?: boolean }): JwtPayload | null;
}
