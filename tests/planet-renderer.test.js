import test from "node:test";
import assert from "node:assert/strict";
import { spherePoint } from "../src/ui/canvas3d.js";

test("planet coordinates match the map projection and remain on the sphere", () => {
  const front = spherePoint(0, 0);
  assert.ok(Math.abs(front.x) < 1e-12 && Math.abs(front.y) < 1e-12);
  assert.equal(front.z, 1);
  const east = spherePoint(Math.PI / 2, 0, 2);
  assert.ok(Math.abs(east.x - 2) < 1e-12 && Math.abs(east.z) < 1e-12);
  const north = spherePoint(0, Math.PI / 2);
  assert.ok(Math.abs(north.y - 1) < 1e-12);
  assert.ok(Math.abs(spherePoint(1.2, -0.5).length() - 1) < 1e-12);
});
