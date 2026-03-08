import { describe, expect, test } from "bun:test";
import {
  Nikki,
  type NikkiEntry,
  type NikkiFormatter,
  NikkiJson,
  type NikkiLogLevel,
  NikkiText,
  type NikkiTransporter,
} from "../src";

const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"];

class BufferTransporter implements NikkiTransporter {
  private formatter: NikkiFormatter;
  private buf: string[] = [];

  constructor(formatter: NikkiFormatter) {
    this.formatter = formatter;
  }

  transport(buf: NikkiEntry[]): void {
    this.buf = buf.map((entry) => this.formatter.fmt(entry).concat("\n"));
  }

  take(): string[] {
    const out = this.buf;
    this.buf = [];
    return out;
  }
}

describe("nikki", () => {
  describe("Nikki", () => {
    test("scoped metadata works", () => {
      const formatter = new NikkiText();
      const transporter = new BufferTransporter(formatter);
      const correlationId = Bun.randomUUIDv7();
      const nikki = new Nikki({ capacity: 10, transporter })
        .with({ correlation_id: correlationId })
        .with({ service: "hololive" });

      const time = new Date("2025-12-03");
      nikki.log({ level: "info", msg: "Hello, World", time });
      nikki.flush();

      const buffer = transporter.take();
      const date = time.toISOString();
      expect(buffer).toMatchObject([
        `[${date}] INFO  Hello, World "correlation_id"="${correlationId}" "service"="hololive"\n`,
      ]);
    });
  });

  describe("NikkiText", () => {
    test.each(LOG_LEVELS)("simple %s formatting works", (level) => {
      const formatter = new NikkiText();
      const time = new Date("2024-03-21");
      const out = formatter.fmt({
        msg: "hello, world",
        level: level as NikkiLogLevel,
        time,
      });
      const levelLabel = level.toUpperCase().padEnd(5, " ");

      const date = time.toISOString();
      expect(out).toStrictEqual(`[${date}] ${levelLabel} hello, world`);
    });

    test("formatting with string in metadata works", () => {
      const formatter = new NikkiText();
      const time = new Date("2024-03-21");
      const metadata = { name: "marine" };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "name"="marine"`);
    });

    test("formatting with int in metadata works", () => {
      const formatter = new NikkiText();
      const time = new Date("2024-03-21");
      const metadata = { age: 17 };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "age"=17`);
    });

    test("formatting with float in metadata works", () => {
      const formatter = new NikkiText();
      const time = new Date("2024-03-21");

      const metadata = { weight: 45.8 };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "weight"=45.8`);
    });

    test("formatting with boolean in metadata works", () => {
      const formatter = new NikkiText();
      const time = new Date("2024-03-21");
      const metadata = { female: true };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "female"=true`);
    });

    test("formatting with null in metadata works", () => {
      const formatter = new NikkiText();
      const time = new Date("2024-03-21");

      const metadata = { cat: null };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "cat"=null`);
    });

    test("formatting with undefined in metadata works", () => {
      const formatter = new NikkiText();
      const time = new Date("2024-03-21");
      const metadata = { cat: undefined };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(`[${date}] INFO  hello, world "cat"=undefined`);
    });

    test("formatting with array in metadata works", () => {
      const formatter = new NikkiText();
      const time = new Date("2024-03-21");
      const metadata = { pets: ["rabbit", "sheep"] };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(
        `[${date}] INFO  hello, world "pets[0]"="rabbit" "pets[1]"="sheep"`,
      );
    });

    test("formatting with nested object in metadata works", () => {
      const formatter = new NikkiText();
      const time = new Date("2024-03-21");
      const metadata = { hololive: { marinee: "cute", watame: "angel" } };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(
        `[${date}] INFO  hello, world "hololive.marinee"="cute" "hololive.watame"="angel"`,
      );
    });
  });

  describe("NikkiJson", () => {
    test.each(LOG_LEVELS)("simple %s formatting works", (level) => {
      const formatter = new NikkiJson();
      const time = new Date("2024-03-21");
      const out = formatter.fmt({
        msg: "hello, world",
        level: level as NikkiLogLevel,
        time,
      });
      const levelLabel = level.toUpperCase();

      const date = time.toISOString();
      expect(out).toStrictEqual(`{"time":"${date}","level":"${levelLabel}","msg":"hello, world"}`);
    });

    test("formatting with string in metadata works", () => {
      const formatter = new NikkiJson();
      const time = new Date("2024-03-21");
      const metadata = { name: "marine" };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(
        `{"time":"${date}","level":"INFO","msg":"hello, world","name":"marine"}`,
      );
    });

    test("formatting with int in metadata works", () => {
      const formatter = new NikkiJson();
      const time = new Date("2024-03-21");
      const metadata = { age: 17 };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(`{"time":"${date}","level":"INFO","msg":"hello, world","age":17}`);
    });

    test("formatting with float in metadata works", () => {
      const formatter = new NikkiJson();
      const time = new Date("2024-03-21");
      const metadata = { weight: 45.8 };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(
        `{"time":"${date}","level":"INFO","msg":"hello, world","weight":45.8}`,
      );
    });

    test("formatting with boolean in metadata works", () => {
      const formatter = new NikkiJson();
      const time = new Date("2024-03-21");
      const metadata = { female: true };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(
        `{"time":"${date}","level":"INFO","msg":"hello, world","female":true}`,
      );
    });

    test("formatting with null in metadata works", () => {
      const formatter = new NikkiJson();
      const time = new Date("2024-03-21");
      const metadata = { cat: null };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(
        `{"time":"${date}","level":"INFO","msg":"hello, world","cat":null}`,
      );
    });

    test("formatting with undefined in metadata gets stripped", () => {
      const formatter = new NikkiJson();
      const time = new Date("2024-03-21");
      const metadata = { cat: undefined };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(`{"time":"${date}","level":"INFO","msg":"hello, world"}`);
    });

    test("formatting with array in metadata works", () => {
      const formatter = new NikkiJson();
      const time = new Date("2024-03-21");
      const metadata = { pets: ["rabbit", "sheep"] };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(
        `{"time":"${date}","level":"INFO","msg":"hello, world","pets":["rabbit","sheep"]}`,
      );
    });

    test("formatting with nested object and without flat works", () => {
      const formatter = new NikkiJson();
      const time = new Date("2024-03-21");
      const metadata = { hololive: { marinee: "cute", watame: "angel" } };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(
        `{"time":"${date}","level":"INFO","msg":"hello, world","hololive":{"marinee":"cute","watame":"angel"}}`,
      );
    });

    test("formatting with nested object and with flat works", () => {
      const formatter = new NikkiJson({ flat: true });
      const time = new Date("2024-03-21");
      const metadata = { hololive: { marine: "cute", watame: "angel" } };
      const out = formatter.fmt({ msg: "hello, world", level: "info", time, metadata });

      const date = time.toISOString();
      expect(out).toStrictEqual(
        `{"time":"${date}","level":"INFO","msg":"hello, world","hololive.marine":"cute","hololive.watame":"angel"}`,
      );
    });
  });
});
