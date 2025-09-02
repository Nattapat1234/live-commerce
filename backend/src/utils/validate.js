// backend/src/utils/validate.js

/** ฟังก์ชันพื้นฐาน (ใช้ใน routes ได้เลย) */
export function str(v, name = "value") {
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`Invalid ${name}`);
  }
  return v.trim();
}

export function int(v, name = "value") {
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw new Error(`Invalid ${name}`);
  }
  return n;
}

export function posInt(v, name = "value") {
  // เขียนเต็ม ๆ โดยไม่เรียก int() เพื่อเลี่ยงการอ้างอิงข้ามที่เสี่ยง undefined
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw new Error(`Invalid ${name}`);
  }
  if (n < 0) {
    throw new Error(`${name} must be >= 0`);
  }
  return n;
}


export class Validator {
  static str = str;
  static int = int;
  static posInt = posInt;
}
