import assert from "node:assert/strict";
import test from "node:test";
import { clientIp } from "../src/lib/rate-limit";

test("Vercel's trusted forwarded IP takes precedence over spoofable fallbacks", () => {
  const request = new Request("https://eleza.example/api/viva/sessions", { headers: {
    "x-vercel-forwarded-for": "203.0.113.42",
    "x-forwarded-for": "198.51.100.9",
    "x-real-ip": "192.0.2.1",
  }});
  assert.equal(clientIp(request), "203.0.113.42");
});

test("the first address is used when a forwarded chain is present", () => {
  const request = new Request("https://eleza.example/api/viva/sessions", { headers: {
    "x-forwarded-for": "203.0.113.7, 10.0.0.4",
  }});
  assert.equal(clientIp(request), "203.0.113.7");
});
