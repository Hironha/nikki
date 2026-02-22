import process from "node:process";

type ValuesOf<T> = T extends readonly [...any]
  ? T[number]
  : T extends Record<string, any>
    ? T[keyof T]
    : never;

const EYE_LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
export type EyeLogLevel = ValuesOf<typeof EYE_LOG_LEVELS>;

function getLogLevelLabel(level: EyeLogLevel): string {
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

export type EyeMetadata = Readonly<Record<string, unknown>>;

export type EyeFmtConfig = {
  msg: string;
  level: EyeLogLevel;
  timestamp?: Date;
  metadata?: EyeMetadata;
};

export interface EyeFormatter {
  fmt(cfg: EyeFmtConfig): string;
}

export class EyeJsonFormatter implements EyeFormatter {
  private flat: boolean;

  constructor(flat?: boolean) {
    this.flat = flat ?? false;
  }

  fmt(cfg: EyeFmtConfig): string {
    const date = cfg.timestamp ?? new Date();
    let entry: EyeMetadata;
    if (cfg.metadata != null) {
      entry = {
        timestamp: date.toISOString(),
        level: getLogLevelLabel(cfg.level),
        msg: cfg.msg,
        ...cfg.metadata,
      };
    } else {
      entry = {
        timestamp: date.toISOString(),
        level: getLogLevelLabel(cfg.level),
        msg: cfg.msg,
      };
    }

    if (!this.flat) {
      return JSON.stringify(entry);
    }
    return this.flatten(entry);
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

export class EyeTextFormatter implements EyeFormatter {
  private readonly colored: boolean;
  private readonly levelpad: number;

  constructor(colored?: boolean) {
    this.colored = colored ?? false;
    this.levelpad = Math.max(...EYE_LOG_LEVELS.map((l) => l.length));
  }

  fmt(cfg: EyeFmtConfig): string {
    let fmtmeta: string | undefined;
    if (cfg.metadata) {
      fmtmeta = getFlatKv(cfg.metadata as Record<string, unknown>, this.fmtkv).join(" ");
    }

    const fmtdate = (cfg.timestamp ?? new Date()).toISOString();
    let fmtlabel = `${getLogLevelLabel(cfg.level).padEnd(this.levelpad, " ")}`;
    if (this.colored) {
      fmtlabel = Ansi.bold().apply(this.colorize(cfg.level, fmtlabel));
    }

    return `[${fmtdate}] ${fmtlabel} ${cfg.msg}${fmtmeta ? ` ${fmtmeta}` : ""}`;
  }

  private fmtkv(key: string, value: unknown): string {
    const v = typeof value === "string" ? `"${value}"` : value;
    return `"${key}"=${v}`;
  }

  private colorize(level: EyeLogLevel, msg: string): string {
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

export interface EyeTransporter {
  transport(msg: string): void;
}

export class EyeStdoutTransporter implements EyeTransporter {
  transport(msg: string): void {
    process.stdout.write(msg);
  }
}

export class EyeStderrTransporter implements EyeTransporter {
  transport(msg: string): void {
    process.stderr.write(msg);
  }
}

export type EyeConfig = {
  capacity?: number;
  formatter?: EyeFormatter;
  transporter?: EyeTransporter;
};

export class Eye {
  private buf: string[];
  private metadata: Readonly<EyeMetadata> | undefined;
  private readonly capacity: number;
  private readonly formatter: EyeFormatter;
  private readonly transporter: EyeTransporter;

  constructor(cfg?: EyeConfig) {
    this.buf = [];
    this.capacity = cfg?.capacity ?? 32;
    this.formatter = cfg?.formatter ?? new EyeTextFormatter();
    this.transporter = cfg?.transporter ?? new EyeStdoutTransporter();
  }

  trace(msg: string, metadata?: EyeMetadata): void {
    this.log({ msg, level: "trace", metadata });
  }

  debug(msg: string, metadata?: EyeMetadata): void {
    this.log({ msg, level: "debug", metadata });
  }

  info(msg: string, metadata?: EyeMetadata): void {
    this.log({ msg, level: "info", metadata });
  }

  warn(msg: string, metadata?: EyeMetadata): void {
    this.log({ msg, level: "warn", metadata });
  }

  error(msg: string, metadata?: EyeMetadata): void {
    this.log({ msg, level: "error", metadata });
  }

  fatal(msg: string, metadata?: EyeMetadata): void {
    this.log({ msg, level: "fatal", metadata });
  }

  log(cfg: EyeFmtConfig): void {
    if (this.buf.length >= this.capacity) {
      this.flush();
    }

    if (this.metadata) {
      if (cfg.metadata) {
        cfg.metadata = { ...this.metadata, ...cfg.metadata };
      } else {
        cfg.metadata = this.metadata;
      }
    }

    const entry = this.formatter.fmt(cfg);
    this.buf.push(entry);
  }

  /**
   * Flushes the buffered log entries by joining them into a single string
   * and sending it to the transporter. The buffer is cleared after the
   * operation is complete.
   */
  flush(): void {
    const msg = this.buf.join("\n").concat("\n");
    this.transporter.transport(msg);
    this.buf = [];
  }

  /**
   * Adds metadata to the logger instance. This metadata will be included in all
   * subsequent log entries. If metadata already exists, the new metadata is
   * merged with the existing one.
   *
   * @returns A new instance of {@link Eye}
   */
  with(metadata: EyeMetadata): Eye {
    const clone = this.cloneWithConfiguration();
    if (clone.metadata) {
      clone.metadata = { ...clone.metadata, ...metadata };
    } else {
      clone.metadata = metadata;
    }
    return clone;
  }

  private cloneWithConfiguration(): Eye {
    const clone = new Eye({
      capacity: this.capacity,
      formatter: this.formatter,
      transporter: this.transporter,
    });
    clone.metadata = this.metadata;
    return clone;
  }

  [Symbol.dispose]() {
    this.flush();
  }
}
