import { config } from "dotenv";
// quiet: dotenvx aksi halde stdout'a banner basıyor ve bu banner
// `prisma migrate diff --script` çıktısının içine karışıp migration SQL'ini bozuyor.
config({ path: ".env.local", quiet: true });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
