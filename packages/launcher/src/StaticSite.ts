import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { pipeline, type Readable } from "node:stream";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export class StaticSite {
  private server: Server | undefined;

  /** `open` reads a file; `fs.createReadStream` when omitted. */
  constructor(private readonly open: (file: string) => Readable = createReadStream) {}

  /** Resolves once `dir` is served on `port`; rejects when the port is taken. */
  async serve(dir: string, port: number): Promise<void> {
    if (this.server) throw new Error("already serving");
    const root = resolve(dir);
    const server = createServer((req, res) => this.respond(root, `${req.url}`, res));
    await new Promise<void>((done, reject) => {
      server.once("error", reject);
      server.listen(port, done);
    });
    this.server = server;
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }

  private async respond(root: string, url: string, res: ServerResponse): Promise<void> {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
    } catch {
      res.writeHead(400).end("Bad Request");
      return;
    }
    const file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    const info = file.startsWith(root + sep) ? await stat(file).catch(() => undefined) : undefined;
    if (!info?.isFile()) {
      res.writeHead(404).end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    pipeline(this.open(file), res, () => {});
  }
}
