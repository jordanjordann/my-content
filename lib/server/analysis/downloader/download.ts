import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import https from "node:https";
import http from "node:http";

export async function downloadVideo(videoUrl: string): Promise<string> {
  const ext = path.extname(new URL(videoUrl).pathname) || ".mp4";
  const filePath = path.join("/tmp", `${randomUUID()}${ext}`);

  return new Promise((resolve, reject) => {
    const client = videoUrl.startsWith("https") ? https : http;

    const file = fs.createWriteStream(filePath);
    client
      .get(videoUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (location) {
            downloadVideo(location)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error("Redirect with no location header"));
          }
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }

        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve(filePath);
        });
      })
      .on("error", (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
  });
}
