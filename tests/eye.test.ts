import { describe, expect, test } from "bun:test";
import {
  Eye,
  type EyeEntry,
  type EyeFormatter,
  EyeJsonFormatter,
  type EyeLogLevel,
  EyeTextFormatter,
  type EyeTransporter,
} from "../src";

const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"];

class BufferTransporter implements EyeTransporter {
  private formatter: EyeFormatter;
  private buf: string[] = [];

  constructor(formatter: EyeFormatter) {
    this.formatter = formatter;
  }

  transport(buf: EyeEntry[]): void {
    this.buf = buf.map((entry) => this.formatter.fmt(entry).concat("\n"));
  }

  take(): string[] {
    const out = this.buf;
    this.buf = [];
    return out;
  }
}

describe("eye", () => {
  describe("Eye", () => {
    test("scoped metadata works", () => {
      const formatter = new EyeTextFormatter();
      const transporter = new BufferTransporter(formatter);
      const correlationId = Bun.randomUUIDv7();
      const eye = new Eye({ capacity: 10, transporter })
        .with({ correlation_id: correlationId })
        .with({ service: "hololive" });

      const timestamp = new Date("2025-12-03");
      eye.log({ level: "info", msg: "Hello, World", timestamp });
      eye.flush();

      const buffer = transporter.take();
      const date = timestamp.toISOString();
      expect(buffer).toMatchObject([
        `[${date}] INFO  Hello, World "correlation_id"="${correlationId}" "service"="hololive"\n`,
      ]);
    });
  });

  describe("EyeTextFmt", () => {
    test.each(LOG_LEVELS)("simple %s formatting works", (level) => {
      const formatter = new EyeTextFormatter();
      const timestamp = new Date("2024-03-21");
      const out = formatter.fmt({ msg: "hello, world", level: level as EyeLogLevel, timestamp });
      const levelLabel = level.toUpperCase().padEnd(5, " ");

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(`[${date}] ${levelLabel} hello, world`);
    });

    test("formatting with string in metadata works", () => {
      const formatter = new EyeTextFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { name: "marine" };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "name"="marine"`);
    });

    test("formatting with int in metadata works", () => {
      const formatter = new EyeTextFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { age: 17 };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "age"=17`);
    });

    test("formatting with float in metadata works", () => {
      const formatter = new EyeTextFormatter();
      const timestamp = new Date("2024-03-21");

      const metadata = { weight: 45.8 };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "weight"=45.8`);
    });

    test("formatting with boolean in metadata works", () => {
      const formatter = new EyeTextFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { female: true };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "female"=true`);
    });

    test("formatting with null in metadata works", () => {
      const formatter = new EyeTextFormatter();
      const timestamp = new Date("2024-03-21");

      const metadata = { cat: null };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "cat"=null`);
    });

    test("formatting with undefined in metadata works", () => {
      const formatter = new EyeTextFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { cat: undefined };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "cat"=undefined`);
    });

    test("formatting with array in metadata works", () => {
      const formatter = new EyeTextFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { pets: ["rabbit", "sheep"] };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `[${date}] INFO  hello, world "pets[0]"="rabbit" "pets[1]"="sheep"`,
      );
    });

    test("formatting with nested object in metadata works", () => {
      const formatter = new EyeTextFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { hololive: { marinee: "cute", watame: "angel" } };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `[${date}] INFO  hello, world "hololive.marinee"="cute" "hololive.watame"="angel"`,
      );
    });
  });

  describe("EyeJsonFmt", () => {
    test.each(LOG_LEVELS)("simple %s formatting works", (level) => {
      const formatter = new EyeJsonFormatter();
      const timestamp = new Date("2024-03-21");
      const out = formatter.fmt({ msg: "hello, world", level: level as EyeLogLevel, timestamp });
      const levelLabel = level.toUpperCase();

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `{"timestamp":"${date}","level":"${levelLabel}","msg":"hello, world"}`,
      );
    });

    test("formatting with string in metadata works", () => {
      const formatter = new EyeJsonFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { name: "marine" };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `{"timestamp":"${date}","level":"INFO","msg":"hello, world","name":"marine"}`,
      );
    });

    test("formatting with int in metadata works", () => {
      const formatter = new EyeJsonFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { age: 17 };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `{"timestamp":"${date}","level":"INFO","msg":"hello, world","age":17}`,
      );
    });

    test("formatting with float in metadata works", () => {
      const formatter = new EyeJsonFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { weight: 45.8 };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `{"timestamp":"${date}","level":"INFO","msg":"hello, world","weight":45.8}`,
      );
    });

    test("formatting with boolean in metadata works", () => {
      const formatter = new EyeJsonFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { female: true };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `{"timestamp":"${date}","level":"INFO","msg":"hello, world","female":true}`,
      );
    });

    test("formatting with null in metadata works", () => {
      const formatter = new EyeJsonFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { cat: null };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `{"timestamp":"${date}","level":"INFO","msg":"hello, world","cat":null}`,
      );
    });

    test("formatting with undefined in metadata gets stripped", () => {
      const formatter = new EyeJsonFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { cat: undefined };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(`{"timestamp":"${date}","level":"INFO","msg":"hello, world"}`);
    });

    test("formatting with array in metadata works", () => {
      const formatter = new EyeJsonFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { pets: ["rabbit", "sheep"] };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `{"timestamp":"${date}","level":"INFO","msg":"hello, world","pets":["rabbit","sheep"]}`,
      );
    });

    test("formatting with nested object and without flat works", () => {
      const formatter = new EyeJsonFormatter();
      const timestamp = new Date("2024-03-21");
      const metadata = { hololive: { marinee: "cute", watame: "angel" } };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `{"timestamp":"${date}","level":"INFO","msg":"hello, world","hololive":{"marinee":"cute","watame":"angel"}}`,
      );
    });

    test("formatting with nested object and with flat works", () => {
      const formatter = new EyeJsonFormatter(true);
      const timestamp = new Date("2024-03-21");
      const metadata = { hololive: { marine: "cute", watame: "angel" } };
      const out = formatter.fmt({ msg: "hello, world", level: "info", timestamp, metadata });

      const date = timestamp.toISOString();
      expect(out).toStrictEqual(
        `{"timestamp":"${date}","level":"INFO","msg":"hello, world","hololive.marine":"cute","hololive.watame":"angel"}`,
      );
    });
  });
});
