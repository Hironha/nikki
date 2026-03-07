type ValuesOf<T> = T extends readonly [...any]
  ? T[number]
  : T extends Record<string, any>
    ? T[keyof T]
    : never;

const NIKKI_LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
export type NikkiLogLevel = ValuesOf<typeof NIKKI_LOG_LEVELS>;

function getLogLevelLabel(level: NikkiLogLevel): string {
  switch (level) {
    case "trace":
      return "TRACE";
    case "debug":
      return "DEBUG";
    case "info":
      return "INFO";
    case "warn":
      return "WARN";
    case "error":
      return "ERROR";
    case "fatal":
      return "FATAL";
  }
}

function getFlatKv(
  value: Record<string, unknown>,
  fmtkv: (k: string, v: unknown) => string,
  path: string[] = [],
): string[] {
  const kv: string[] = [];

  const obj = value as Record<string, unknown>;
  for (const key in obj) {
    path.push(key);

    const value = obj[key];
    if (Array.isArray(value)) {
      const fullpath = path.join(".");
      value.forEach((v, i) => {
        const k = fullpath ? `${fullpath}[${i}]` : i.toString();
        kv.push(fmtkv(k, v));
      });
    } else if (value != null && typeof value === "object") {
      const meta = getFlatKv(value as Record<string, unknown>, fmtkv, path);
      kv.push(...meta);
    } else {
      const fullpath = path.join(".");
      kv.push(fmtkv(fullpath, value));
    }

    path.pop();
  }

  return kv;
}

type AnsiCode = ValuesOf<typeof AnsiCode>;
// Standard ANSI 16-color codes
const AnsiCode = {
  RESET: "\x1b[0m",
  CYAN: "\x1b[36m",
  RED: "\x1b[31m",
  YELLOW: "\x1b[33m",
  BOLD: "\x1b[1m",
} as const;

class Ansi {
  private code: AnsiCode;

  constructor(code: AnsiCode) {
    this.code = code;
  }

  static bold(): Ansi {
    return new Ansi(AnsiCode.BOLD);
  }

  static cyan(): Ansi {
    return new Ansi(AnsiCode.CYAN);
  }

  static red(): Ansi {
    return new Ansi(AnsiCode.RED);
  }

  static yellow(): Ansi {
    return new Ansi(AnsiCode.YELLOW);
  }

  apply(txt: string) {
    return `${this.code}${txt}${AnsiCode.RESET}`;
  }
}

export type NikkiMetadata = Readonly<Record<string, unknown>>;

export type NikkiEntry = {
  msg: string;
  level: NikkiLogLevel;
  timestamp?: Date;
  metadata?: NikkiMetadata;
};

export interface NikkiFormatter {
  fmt(entry: NikkiEntry): string;
}

export type NikkiJsonConfig = {
  /**
   * Define if properties of nested objects in metadata should be flatten into
   * a single property.
   * @default false
   * @example
   * const formatter = new NikkiJson({ flat: true });
   * const out = formatter.fmt({
   *   msg: "Hello, World",
   *   level: "info",
   *   timestamp: new Date("2026-03-07T17:19:04.699Z"),
   *   metadata: {
   *     idol: {
   *       name: "marine"
   *     }
   *   }
   * });
   * expect(out).toStrictEqual(`{"timestamp":"2026-03-07T17:19:04.699Z","level":"INFO","msg":"Hello, World","idol.name":"marine"}`)
   */
  flat?: boolean;
};

export class NikkiJson implements NikkiFormatter {
  private flat: boolean;

  constructor(cfg?: NikkiJsonConfig) {
    this.flat = cfg?.flat ?? false;
  }

  fmt(entry: NikkiEntry): string {
    const date = entry.timestamp ?? new Date();
    let log: NikkiMetadata;
    if (entry.metadata != null) {
      log = {
        timestamp: date.toISOString(),
        level: getLogLevelLabel(entry.level),
        msg: entry.msg,
        ...entry.metadata,
      };
    } else {
      log = {
        timestamp: date.toISOString(),
        level: getLogLevelLabel(entry.level),
        msg: entry.msg,
      };
    }

    if (!this.flat) {
      return JSON.stringify(log);
    }
    return this.flatten(log);
  }

  private flatten(value: object): string {
    const kv = getFlatKv(value as Record<string, unknown>, this.fmtkv);
    return `{${kv}}`;
  }

  private fmtkv(key: string, value: unknown): string {
    const v = typeof value === "string" ? `"${value}"` : value;
    return `"${key}":${v}`;
  }
}

export type NikkiTextConfig = {
  /**
   * Define if output should be colored based on log level
   * @default false
   */
  colored?: boolean;
};

export class NikkiText implements NikkiFormatter {
  private readonly colored: boolean;
  private readonly lvlpad: number;

  constructor(cfg?: NikkiTextConfig) {
    this.colored = cfg?.colored ?? false;
    this.lvlpad = Math.max(...NIKKI_LOG_LEVELS.map((l) => l.length));
  }

  fmt(entry: NikkiEntry): string {
    let fmtmeta: string | undefined;
    if (entry.metadata) {
      fmtmeta = getFlatKv(entry.metadata as Record<string, unknown>, this.fmtkv).join(" ");
    }

    const fmtdate = (entry.timestamp ?? new Date()).toISOString();
    let fmtlabel = `${getLogLevelLabel(entry.level).padEnd(this.lvlpad, " ")}`;
    if (this.colored) {
      fmtlabel = Ansi.bold().apply(this.colorize(entry.level, fmtlabel));
    }

    return `[${fmtdate}] ${fmtlabel} ${entry.msg}${fmtmeta ? ` ${fmtmeta}` : ""}`;
  }

  private fmtkv(key: string, value: unknown): string {
    const v = typeof value === "string" ? `"${value}"` : value;
    return `"${key}"=${v}`;
  }

  private colorize(level: NikkiLogLevel, msg: string): string {
    switch (level) {
      case "debug":
      case "trace":
        return msg;
      case "error":
      case "fatal":
        return Ansi.red().apply(msg);
      case "info":
        return Ansi.cyan().apply(msg);
      case "warn":
        return Ansi.yellow().apply(msg);
    }
  }
}

export interface NikkiTransporter {
  transport(entries: NikkiEntry[]): void;
}

export class NikkiStdout implements NikkiTransporter {
  private formatter: NikkiFormatter;

  constructor(formatter: NikkiFormatter) {
    this.formatter = formatter;
  }

  transport(entries: NikkiEntry[]): void {
    const output = entries.map((entry) => this.formatter.fmt(entry).concat("\n")).join("");
    process.stdout.write(output);
  }
}

export class NikkiStderr implements NikkiTransporter {
  private formatter: NikkiFormatter;

  constructor(formatter: NikkiFormatter) {
    this.formatter = formatter;
  }

  transport(entries: NikkiEntry[]): void {
    const output = entries.map((entry) => this.formatter.fmt(entry).concat("\n")).join("");
    process.stderr.write(output);
  }
}

export type NikkiConfig = {
  capacity?: number;
  transporter?: NikkiTransporter;
};

export class Nikki {
  private buf: NikkiEntry[];
  private metadata: NikkiMetadata | undefined;
  private readonly capacity: number;
  private readonly transporter: NikkiTransporter;

  constructor(cfg?: NikkiConfig) {
    this.buf = [];
    this.capacity = cfg?.capacity ?? 32;
    this.transporter = cfg?.transporter ?? new NikkiStdout(new NikkiText());
  }

  /**
   * Logs a trace message.
   */
  trace(msg: string, metadata?: NikkiMetadata): void {
    this.log({ msg, level: "trace", metadata });
  }

  /**
   * Logs a debug message.
   */
  debug(msg: string, metadata?: NikkiMetadata): void {
    this.log({ msg, level: "debug", metadata });
  }

  /**
   * Logs an info message.
   */
  info(msg: string, metadata?: NikkiMetadata): void {
    this.log({ msg, level: "info", metadata });
  }

  /**
   * Logs a warning message.
   */
  warn(msg: string, metadata?: NikkiMetadata): void {
    this.log({ msg, level: "warn", metadata });
  }

  /**
   * Logs an error message.
   */
  error(msg: string, metadata?: NikkiMetadata): void {
    this.log({ msg, level: "error", metadata });
  }

  /**
   * Logs a fatal message.
   */
  fatal(msg: string, metadata?: NikkiMetadata): void {
    this.log({ msg, level: "fatal", metadata });
  }

  /**
   * Logs a custom entry.
   */
  log(entry: NikkiEntry): void {
    if (this.buf.length >= this.capacity) {
      this.flush();
    }

    if (this.metadata) {
      if (entry.metadata) {
        entry.metadata = { ...this.metadata, ...entry.metadata };
      } else {
        entry.metadata = this.metadata;
      }
    }

    this.buf.push(entry);
  }

  /**
   * Flushes the buffered log entries by joining them into a single string
   * and sending it to the transporter. The buffer is cleared after the
   * operation is complete.
   */
  flush(): void {
    this.transporter.transport(this.buf);
    this.buf = [];
  }

  /**
   * Adds metadata to the logger instance. This metadata will be included in all
   * subsequent log entries. If metadata already exists, the new metadata is
   * merged with the existing one.
   *
   * @returns A new instance of {@link Nikki}
   */
  with(metadata: NikkiMetadata): Nikki {
    const clone = this.cloneWithConfiguration();
    if (clone.metadata) {
      clone.metadata = { ...clone.metadata, ...metadata };
    } else {
      clone.metadata = metadata;
    }
    return clone;
  }

  private cloneWithConfiguration(): Nikki {
    const clone = new Nikki({
      capacity: this.capacity,
      transporter: this.transporter,
    });
    clone.metadata = this.metadata;
    return clone;
  }

  [Symbol.dispose]() {
    this.flush();
  }
}
