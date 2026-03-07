# Nikki

A simple logging library based on Go's [slog](https://pkg.go.dev/log/slog) with support for JSON structured logs. It is designed to be simple and customizable. Nikki has built-in support for both Text and JSON output. The Text format is meant for simple logging into the terminal and the JSON format is a good fit for integration with log aggregation tools.

## Example

```ts
const formatter = new NikkiText({ colored: true });
const transporter = new NikkiStderr(formatter);
const nikki = new Nikki({ capacity: 16, transporter }).with({ scope: "example" });
nikki.info("Hello, World!");
nikki.flush();
```
