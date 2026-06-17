import { Request } from "express";

export const getClientIp = (req: Request): string => {
  const forwardedFor = req.headers["x-forwarded-for"];
  let ip = "";

  if (forwardedFor) {
    if (typeof forwardedFor === "string") {
      ip = forwardedFor.split(",")[0].trim();
    } else if (Array.isArray(forwardedFor)) {
      ip = forwardedFor[0].split(",")[0].trim();
    }
  }

  if (!ip) {
    const realIp = req.headers["x-real-ip"];
    if (realIp && typeof realIp === "string") {
      ip = realIp.trim();
    }
  }

  if (!ip) {
    ip = req.ip || req.socket.remoteAddress || "";
  }

  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  return ip;
};
