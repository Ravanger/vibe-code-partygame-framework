import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { freePort } from "@partygame/server/probe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StaticSite } from "../src/StaticSite.js";

let root: string;
let site: StaticSite;
let port: number;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "static-site-"));
  const dist = join(root, "dist");
  await mkdir(join(dist, "assets"), { recursive: true });
  await writeFile(join(dist, "index.html"), "<h1>home</h1>");
  await writeFile(join(dist, "app.js"), "console.log(1)");
  await writeFile(join(dist, "assets", "blob.bin"), "bin");
  await writeFile(join(root, "secret.txt"), "secret");
  port = await freePort();
  site = new StaticSite();
  await site.serve(join(dist), port);
});
afterEach(async () => {
  await site.close();
  await rm(root, { recursive: true, force: true });
});

const get = (path: string): Promise<{ status: number; type: string | undefined; body: string }> =>
  new Promise((resolve, reject) => {
    request({ port, path, host: "127.0.0.1" }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, type: res.headers["content-type"], body }),
      );
    })
      .on("error", reject)
      .end();
  });

describe("StaticSite", () => {
  it("serves files with their MIME type", async () => {
    expect(await get("/app.js")).toEqual({
      status: 200,
      type: "text/javascript; charset=utf-8",
      body: "console.log(1)",
    });
  });

  it("serves index.html for the root", async () => {
    const response = await get("/");
    expect(response.status).toBe(200);
    expect(response.type).toBe("text/html; charset=utf-8");
    expect(response.body).toBe("<h1>home</h1>");
  });

  it("falls back to a binary type for unknown extensions", async () => {
    expect((await get("/assets/blob.bin")).type).toBe("application/octet-stream");
  });

  it("answers 404 for a missing file and for a folder", async () => {
    expect((await get("/nope.js")).status).toBe(404);
    expect((await get("/assets")).status).toBe(404);
  });

  it("answers 404 for a path outside the folder", async () => {
    expect((await get("/..%2Fsecret.txt")).status).toBe(404);
  });

  it("answers 400 for a malformed URL", async () => {
    expect((await get("/%E0%A4%A")).status).toBe(400);
  });

  it("stops listening on close", async () => {
    await site.close();
    await expect(get("/")).rejects.toThrow();
  });

  it("refuses to serve twice", async () => {
    await expect(site.serve(root, await freePort())).rejects.toThrow("already serving");
  });

  it("drops the connection when a file cannot be read", async () => {
    const broken = new StaticSite(
      () =>
        new Readable({
          read() {
            this.destroy(new Error("disk gone"));
          },
        }),
    );
    const brokenPort = await freePort();
    await broken.serve(join(root, "dist"), brokenPort);
    try {
      await expect(
        new Promise<void>((resolve, reject) => {
          request({ port: brokenPort, path: "/app.js", host: "127.0.0.1" }, (res) => {
            res.on("error", () => resolve());
            res.on("close", () => resolve());
            res.resume();
          })
            .on("error", () => resolve())
            .end();
          setTimeout(() => reject(new Error("the connection stayed open")), 5000);
        }),
      ).resolves.toBeUndefined();
    } finally {
      await broken.close();
    }
  });

  it("rejects when the port is taken", async () => {
    const other = new StaticSite();
    await expect(other.serve(root, port)).rejects.toThrow();
  });
});
